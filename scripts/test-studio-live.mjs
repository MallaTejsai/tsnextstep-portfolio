/**
 * Live end-to-end proof against the REAL portfolio repository.
 *
 * Requires the real launcher services to be running:
 *   node tools/local-dev.mjs start --no-open
 *   node scripts/test-studio-live.mjs
 *
 * Only a single harmless test resource is created; it is deleted again at the
 * end and the canonical catalog is restored to a byte-identical snapshot
 * (unless --keep is passed).
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGINS = { studio: "http://127.0.0.1:4174", portfolio: "http://127.0.0.1:5173", bridge: "http://127.0.0.1:4175" };

const TITLE = "Astra Live Proof Resource";
const DESCRIPTION = "Temporary end-to-end proof record created by scripts/test-studio-live.mjs.";
const PAYLOAD = "ASTRA_LIVE_PROOF_9f2c31\nA harmless marker used to prove the real Studio pipeline.\n";

const args = new Set(process.argv.slice(2));
const KEEP = args.has("--keep");

const read = async (relative) => JSON.parse(await fsp.readFile(path.join(ROOT, relative), "utf8"));
const readText = async (relative) => fsp.readFile(path.join(ROOT, relative), "utf8");
const exists = async (absolute) => { try { await fsp.access(absolute); return true; } catch { return false; } };
const write = async (relative, value) => fsp.writeFile(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`);

const CATALOG = "src/data/resourceCatalog.json";
const PUBLIC_CATALOG = "src/data/resourceCatalog.public.json";
const MANIFEST = "public/assets/resources/resources.json";

async function poll(check, message, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let last;
  do {
    try { if (await check()) return; } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  } while (Date.now() < deadline);
  throw new Error(`${message}${last ? ` (${last.message})` : ""}`);
}

async function assertHealthyServices() {
  for (const [name, url] of [["studio", ORIGINS.studio], ["portfolio", ORIGINS.portfolio]]) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, `${name} is not serving on ${url}`);
    await response.text();
  }
  const bridge = await fetch(`${ORIGINS.bridge}/api/health`, {
    headers: { Origin: ORIGINS.studio },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  assert(bridge, "bridge did not answer; start the launcher first");
  await bridge.text();
}

async function buildProject() {
  await exec(process.execPath, [path.join(ROOT, "scripts/validate-resources.mjs")], { cwd: ROOT, timeout: 180000 });
  await exec(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build"], { cwd: ROOT, timeout: 300000 });
}

async function distFiles() {
  const root = path.join(ROOT, "dist");
  const out = [];
  const walk = async (dir) => {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  await walk(root);
  return out;
}

async function readyStudio(page) {
  await page.getByRole("heading", { name: "Resource Studio", exact: true }).waitFor();
  await page.getByText("Project bridge connected", { exact: true }).waitFor();
  await poll(async () => (await page.locator(".studio-storage-status").innerText()).includes("local project bridge"), "Studio never connected to the real project");
  await page.getByLabel("Display title", { exact: false }).waitFor();
}

async function commitAction(page, action) {
  const responsePromise = page.waitForResponse((response) => response.url() === `${ORIGINS.bridge}/api/commit` && response.request().method() === "POST");
  const [response] = await Promise.all([responsePromise, action()]);
  const result = await response.json();
  assert.equal(response.status(), 200, result.error || "Real bridge commit failed");
  assert.equal(result.ok, true);
  await poll(async () => (await page.locator(".studio-storage-status").innerText()).includes("local project bridge"), "Commit did not finish");
  return result;
}

const select = async (studio, title) => {
  await studio.getByRole("button", { name: `Select ${title}`, exact: true }).click();
  await poll(async () => await studio.getByLabel("Display title", { exact: false }).inputValue() === title, "Editor did not select the resource");
};
const save = (studio) => commitAction(studio, () => studio.getByRole("button", { name: "Save Changes", exact: true }).click());
const publicCard = (portfolio, title) => portfolio.locator("#resources-library .resource-grid > article").filter({ has: portfolio.getByRole("heading", { name: title, exact: true }) });

const captureReports = { dir: path.join(ROOT, ".resource-studio/qa", `live-${new Date().toISOString().replace(/[:.]/g, "-")}`), shots: [], async write() {
  await fsp.mkdir(this.dir, { recursive: true });
  await fsp.writeFile(path.join(this.dir, "screenshots.json"), `${JSON.stringify(this.shots, null, 2)}\n`);
} };

async function capture(page, name) {
  await fsp.mkdir(captureReports.dir, { recursive: true });
  await page.screenshot({ path: path.join(captureReports.dir, `${name}.png`), fullPage: true, animations: "disabled" });
  captureReports.shots.push(`${name}.png`);
}

await test("real repository: add → publish → render → persist → unpublish → delete", { timeout: 900000 }, async (suite) => {
  const snapshot = {
    catalog: await readText(CATALOG),
    publicCatalog: await readText(PUBLIC_CATALOG),
    manifest: await readText(MANIFEST),
  };
  const original = JSON.parse(snapshot.catalog);
  let chromium;
  ({ chromium } = await import("playwright"));
  let browser;
  let studio;
  let portfolio;
  let uploaded;
  let createdId;

  try {
    await assertHealthyServices();

    browser = await launchRealBrowser(chromium);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(20000);
    studio = await context.newPage();
    portfolio = await context.newPage();
    const errors = [];
    studio.on("pageerror", (error) => errors.push(`Studio: ${error.message}`));
    portfolio.on("pageerror", (error) => errors.push(`Portfolio: ${error.message}`));

    await Promise.all([studio.goto(ORIGINS.studio, { waitUntil: "domcontentloaded" }), portfolio.goto(ORIGINS.portfolio, { waitUntil: "domcontentloaded" })]);
    await readyStudio(studio);
    await suite.test("1. upload creates a draft with its real file outside public/", async () => {
      const before = await read(CATALOG);
      await studio.locator('input[type="file"][multiple]').setInputFiles({ name: "astra-live-proof.txt", mimeType: "text/plain", buffer: Buffer.from(PAYLOAD) });
      await poll(async () => (await read(CATALOG)).resources.length === before.resources.length + 1, "Upload never reached the canonical catalog");
      const catalog = await read(CATALOG);
      uploaded = catalog.resources.find((resource) => resource.originalFileName === "astra-live-proof.txt");
      assert(uploaded, "Uploaded record is missing from the canonical catalog");
      createdId = uploaded.id;
      assert.equal(uploaded.published, false, "New uploads must start as drafts");
      assert.equal(await exists(path.join(ROOT, "public", uploaded.filePath)), false, "Draft file leaked into public/");
      assert.equal(await readText(path.join(".resource-studio/drafts", uploaded.filePath)), PAYLOAD, "Draft file bytes are wrong");
      await select(studio, uploaded.title);
    });

    await suite.test("2. metadata edit + save persists and the draft stays hidden", async () => {
      await studio.getByLabel("Display title", { exact: false }).fill(TITLE);
      await studio.getByLabel("Description", { exact: true }).fill(DESCRIPTION);
      await save(studio);
      const catalog = await read(CATALOG);
      const record = catalog.resources.find((resource) => resource.id === createdId);
      assert.equal(record.title, TITLE);
      assert.equal(record.description, DESCRIPTION);
      assert.equal(record.published, false);
      assert.equal(await publicCard(portfolio, TITLE).count(), 0, "Draft leaked into the public portfolio");
    });

    await suite.test("3. publish writes the real file, catalogs, manifests and the live portfolio", async () => {
      await studio.getByLabel("Visible on public website").check();
      await save(studio);

      const catalog = await read(CATALOG);
      const record = catalog.resources.find((resource) => resource.id === createdId);
      assert.equal(record.published, true, "Canonical record is not published");
      assert.equal(record.filePath, uploaded.filePath);

      const publicPath = path.join(ROOT, "public", record.filePath);
      assert(await exists(publicPath), "Published file is missing from public/");
      assert.equal(await readText(path.join("public", record.filePath)), PAYLOAD, "Published file bytes differ");

      const publicCatalog = await read(PUBLIC_CATALOG);
      const manifest = await read(MANIFEST);
      assert.deepEqual(manifest, publicCatalog, "Generated catalog and HTTP manifest differ");
      const manifestRecord = manifest.resources.find((resource) => resource.id === createdId);
      assert(manifestRecord, "Public manifest does not reference the published resource");
      assert.equal(manifestRecord.filePath, record.filePath);

      const fileResponse = await portfolio.request.get(`${ORIGINS.portfolio}/${record.filePath}`);
      assert.equal(fileResponse.status(), 200, "Portfolio did not serve the published file");
      assert.equal(await fileResponse.text(), PAYLOAD);
      const manifestResponse = await portfolio.request.get(`${ORIGINS.portfolio}/assets/resources/resources.json`);
      assert.equal(manifestResponse.status(), 200);
      assert((await manifestResponse.json()).resources.some((resource) => resource.id === createdId));

      await publicCard(portfolio, TITLE).waitFor({ timeout: 30000 });
      await publicCard(portfolio, TITLE).getByText(DESCRIPTION).waitFor();
      assert((await publicCard(portfolio, TITLE).innerText()).includes(TITLE), "Rendered card does not show the resource title");
      await capture(portfolio, "live-published");
    });

    await suite.test("4. browser refresh keeps the published resource visible", async () => {
      await portfolio.reload({ waitUntil: "domcontentloaded" });
      await publicCard(portfolio, TITLE).waitFor({ timeout: 30000 });
      await studio.reload({ waitUntil: "domcontentloaded" });
      await readyStudio(studio);
      await select(studio, TITLE);
      assert.equal(await studio.getByLabel("Visible on public website").isChecked(), true);
    });

    await suite.test("5. production build publishes the file and its manifest", async () => {
      await buildProject();
      const files = await distFiles();
      const record = (await read(CATALOG)).resources.find((resource) => resource.id === createdId);
      assert(await exists(path.join(ROOT, "dist", record.filePath)), "dist does not contain the published file");
      const distManifest = JSON.parse(await readText("dist/assets/resources/resources.json"));
      assert(distManifest.resources.some((resource) => resource.id === createdId), "dist manifest omits the published resource");
      const bundled = await readText("dist/index.html");
      assert(bundled.includes(TITLE), "bundled index.html does not contain the published title");
      assert(bundled.includes(DESCRIPTION), "bundled index.html does not contain the published description");
      await capture(portfolio, "live-published-after-build");
    });

    await suite.test("6. unpublish removes it from the live UI and from production output", async () => {
      await studio.getByLabel("Visible on public website").uncheck();
      await save(studio);
      const record = (await read(CATALOG)).resources.find((resource) => resource.id === createdId);
      assert.equal(record.published, false);
      assert.equal(await exists(path.join(ROOT, "public", record.filePath)), false, "Unpublished file still sits in public/");
      assert.equal(await readText(path.join(".resource-studio/drafts", record.filePath)), PAYLOAD, "Unpublished file was not preserved privately");
      const manifest = await read(MANIFEST);
      assert(!manifest.resources.some((resource) => resource.id === createdId), "Public manifest still lists the unpublished resource");
      assert(!(await readText(PUBLIC_CATALOG)).includes(createdId), "Generated public catalog still lists the resource");

      await publicCard(portfolio, TITLE).waitFor({ state: "detached", timeout: 30000 });
      await portfolio.reload({ waitUntil: "domcontentloaded" });
      assert.equal(await publicCard(portfolio, TITLE).count(), 0, "Resource survived a reload after unpublish");
      await capture(portfolio, "live-unpublished");

      await buildProject();
      const files = await distFiles();
      const marker = Buffer.from(`ASTRA_LIVE_PROOF_9f2c31`);
      for (const file of files) {
        const relative = path.relative(path.join(ROOT, "dist"), file).replaceAll(path.sep, "/");
        const bytes = await fsp.readFile(file);
        assert(!bytes.includes(marker), `Draft bytes leaked into dist/${relative}`);
        assert(!bytes.includes(record.filePath), `Draft path leaked into dist/${relative}`);
        assert(!bytes.includes(TITLE) || !bytes.includes(DESCRIPTION), `Draft metadata leaked into dist/${relative}`);
        assert(!/resourceCatalog\.json|\.resource-studio/.test(relative), `Private artifact in dist/${relative}`);
      }
      assert.equal(await exists(path.join(ROOT, "dist", record.filePath)), false, "dist still contains the unpublished file");
      const distManifest = JSON.parse(await readText("dist/assets/resources/resources.json"));
      assert(!distManifest.resources.some((resource) => resource.id === createdId));
      assert.equal(files.length > 0, true);
    });

    await suite.test("7. delete removes the record and restores the original catalog", async () => {
      await readyStudio(studio);
      await select(studio, TITLE);
      studio.once("dialog", (dialog) => dialog.accept());
      const result = await commitAction(studio, () => studio.locator(".studio-resource-row").filter({ has: studio.getByRole("heading", { name: TITLE, exact: true }) }).getByRole("button", { name: "Delete resource", exact: true }).click());
      assert(result.trash?.startsWith(".resource-studio/trash/"), "Delete produced no recoverable trash");
      const catalog = await read(CATALOG);
      assert(!catalog.resources.some((resource) => resource.id === createdId), "Deleted record survived");
      assert.equal(catalog.resources.length, original.resources.length);
      assert.equal(await exists(path.join(ROOT, ".resource-studio/drafts", uploaded.filePath)), false, "Deleted draft file survived");
      assert.equal(await readText(CATALOG), snapshot.catalog, "Canonical catalog was not restored byte-for-byte");
      assert.equal(await readText(PUBLIC_CATALOG), snapshot.publicCatalog, "Generated public catalog was not restored");
      assert.equal(await readText(MANIFEST), snapshot.manifest, "Public manifest was not restored");
    });

    await suite.test("8. final production build matches the restored catalog", async () => {
      await buildProject();
      const distManifest = JSON.parse(await readText("dist/assets/resources/resources.json"));
      assert.deepEqual(distManifest, JSON.parse(snapshot.publicCatalog));
      const files = await distFiles();
      const marker = Buffer.from("ASTRA_LIVE_PROOF_9f2c31");
      for (const file of files) {
        const bytes = await fsp.readFile(file);
        assert(!bytes.includes(marker), `Leftover proof marker in ${path.relative(ROOT, file)}`);
      }
    });

    assert.deepEqual(errors, [], "Uncaught browser errors");
  } finally {
    if (!KEEP && createdId) {
      const catalog = await read(CATALOG);
      const record = catalog.resources.find((resource) => resource.id === createdId) || uploaded || null;
      if (catalog.resources.some((resource) => resource.id === createdId)) {
        const next = { ...catalog, resources: catalog.resources.filter((resource) => resource.id !== createdId) };
        next.resources = next.resources.map((resource, index) => ({ ...resource, displayOrder: index + 1 }));
        const { toPublicCatalog, normalizeCatalog } = await import(pathToFileURLSafe(path.join(ROOT, "src/lib/resourceValidation.js")));
        const publicCatalog = toPublicCatalog(normalizeCatalog(next));
        await write(CATALOG, next);
        await write(PUBLIC_CATALOG, publicCatalog);
        await write(MANIFEST, publicCatalog);
      }
      const current = await readText(CATALOG);
      if (current !== snapshot.catalog) {
        await fsp.writeFile(path.join(ROOT, CATALOG), snapshot.catalog);
        await fsp.writeFile(path.join(ROOT, PUBLIC_CATALOG), snapshot.publicCatalog);
        await fsp.writeFile(path.join(ROOT, MANIFEST), snapshot.manifest);
      }
      if (record?.filePath) {
        await fsp.rm(path.join(ROOT, "public", record.filePath), { force: true });
        await fsp.rm(path.join(ROOT, ".resource-studio/drafts", record.filePath), { force: true });
      }
      await buildProject().catch((error) => console.error(`Final build during cleanup failed: ${error.message}`));
    }
    await studio?.close().catch(() => undefined);
    await portfolio?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    await captureReports.write();
  }
});

function pathToFileURLSafe(value) {
  return `file://${value.replaceAll(path.sep, "/")}`;
}

async function launchRealBrowser(chromium) {
  try {
    return await chromium.launch({ channel: "msedge", headless: true, timeout: 20000 });
  } catch {
    const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    try { await fsp.access(edge); return chromium.launch({ executablePath: edge, headless: true, timeout: 20000 }); } catch { /* fall through */ }
    return chromium.launch({ headless: true, timeout: 20000 });
  }
}
