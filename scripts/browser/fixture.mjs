import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TEMP_ROOT = process.env.ASTRA_QA_TEMP
  || (process.platform === "win32"
    ? "C:\\Users\\tejsa\\AppData\\Local\\Temp\\agent-tmp"
    : "/mnt/c/Users/tejsa/AppData/Local/Temp/agent-tmp");
export const ORIGINS = { studio: "http://127.0.0.1:4174", bridge: "http://127.0.0.1:4175", portfolio: "http://127.0.0.1:5173" };
export const PRIVATE_TEXT = "BROWSER_QA_PRIVATE_DRAFT_6ac913: unpublished fixture text only.";
export const UPLOAD_TEXT = "BROWSER_QA_UPLOAD_47ec21\nExplain this small synthetic browser integration example.\n";
export const EDITED_TEXT = "BROWSER_QA_EDITED_28fe91\nExplain the updated example with Unicode: café → ✓.\n";

export async function exists(file) {
  try { await fsp.access(file); return true; } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(file) {
  return JSON.parse(await fsp.readFile(file, "utf8"));
}

export async function filesUnder(root) {
  if (!await exists(root)) return [];
  const result = [];
  for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    assert(!entry.isSymbolicLink(), "Unexpected link in fixture output");
    if (entry.isDirectory()) result.push(...await filesUnder(file));
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

export function assertFixtureRoot(root) {
  assert.equal(path.dirname(root), TEMP_ROOT, "Fixture must be directly under the approved temp root");
  assert(path.basename(root).startsWith("portfolio-browser-"), "Unexpected fixture name");
  assert.notEqual(root, WORKSPACE);
}

// The filter runs before copying or traversing private paths. In particular,
// never copy the real canonical catalog and replace it afterwards.
function copyAllowed(source) {
  const relative = path.relative(WORKSPACE, source).replaceAll(path.sep, "/");
  const parts = relative.split("/");
  return !parts.some((part) => part.startsWith(".env") || [".resource-studio", "backups", "node_modules", ".git", "dist", ".resource-studio-dist"].includes(part))
    && !/^src\/data\/resourceCatalog[^/]*\.json(?:\.|$)/i.test(relative)
    && relative !== "public/assets/resources"
    && !relative.startsWith("public/assets/resources/");
}

export async function createFixture() {
  assert((await fsp.stat(TEMP_ROOT)).isDirectory(), "Approved temp root is missing");
  const root = await fsp.mkdtemp(path.join(TEMP_ROOT, "portfolio-browser-"));
  assertFixtureRoot(root);
  try {
    for (const entry of ["src", "public", "tools", "index.html", "package.json", "vite.config.js"]) {
      await fsp.cp(path.join(WORKSPACE, entry), path.join(root, entry), {
        recursive: true,
        filter: async (source) => {
          if (!copyAllowed(source)) return false;
          assert(!(await fsp.lstat(source)).isSymbolicLink(), "Source copy encountered a link");
          return true;
        },
      });
    }
    await fsp.mkdir(path.join(root, "scripts"));
    await fsp.copyFile(path.join(WORKSPACE, "scripts/validate-resources.mjs"), path.join(root, "scripts/validate-resources.mjs"));
    // Dependency-only junction; application files, generated data, cache and
    // output remain in the temp tree. Unlink it explicitly before cleanup.
    const dependencies = path.join(WORKSPACE, "node_modules");
    assert((await fsp.stat(dependencies)).isDirectory(), "Workspace dependencies are missing");
    await fsp.symlink(dependencies, path.join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await fsp.writeFile(path.join(root, ".browser-qa-fixture"), "Synthetic browser fixture; safe to remove.\n");
    const validation = await import(pathToFileURL(path.join(root, "src/lib/resourceValidation.js")));
    const fixture = { root, validation };
    await seedFixture(fixture);
    return fixture;
  } catch (error) {
    await removeFixture(root);
    throw error;
  }
}

export async function seedFixture(fixture) {
  const { root, validation } = fixture;
  assertFixtureRoot(root);
  for (const relative of ["public/assets/resources", ".resource-studio", "dist"]) {
    await fsp.rm(path.join(root, relative), { recursive: true, force: true });
  }
  const definitions = [
    { id: "qa-note-alpha", title: "QA Alpha Note", kind: "note", categoryId: "study", filePath: "assets/resources/notes/qa-alpha.md", text: "QA_ALPHA_PUBLIC_BYTES\nA synthetic public note.\n", published: true },
    { id: "qa-note-beta", title: "QA Beta Note", kind: "note", categoryId: "study", filePath: "assets/resources/notes/qa-beta.md", text: "QA_BETA_PUBLIC_BYTES\nA second synthetic note.\n", published: true },
    { id: "qa-private-draft", title: "QA_PRIVATE_TITLE_91ab65", kind: "prompt", categoryId: "prompts", filePath: "assets/resources/prompt-packs/qa-private.txt", text: PRIVATE_TEXT, published: false },
  ];
  const resources = [];
  for (const [index, definition] of definitions.entries()) {
    const { text, ...resource } = definition;
    const file = path.join(root, resource.published ? "public" : ".resource-studio/drafts", resource.filePath);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, text);
    resources.push({ ...resource, type: resource.kind, description: "Synthetic browser QA resource.", tags: ["browser-qa"], originalFileName: path.basename(resource.filePath), fileSize: Buffer.byteLength(text), mimeType: "text/plain", promptText: resource.kind === "prompt" ? text : null, featured: false, displayOrder: index + 1 });
  }
  resources.push({ id: "qa-episode", title: "QA Synthetic Episode", description: "Synthetic modal fixture. No external navigation is performed.", kind: "episode", type: "external", categoryId: "ai", number: "01", published: true, displayOrder: resources.length + 1, youtubeUrl: "https://example.invalid/qa-video", instagramUrl: "https://example.invalid/qa-social" });
  const catalog = validation.normalizeCatalog({ categories: validation.DEFAULT_CATEGORIES, resources });
  const publicCatalog = validation.toPublicCatalog(catalog);
  await writeJson(path.join(root, "src/data/resourceCatalog.json"), catalog);
  await writeJson(path.join(root, "src/data/resourceCatalog.public.json"), publicCatalog);
  await writeJson(path.join(root, "public/assets/resources/resources.json"), publicCatalog);
  fixture.seed = catalog;
}

export async function removeFixture(root) {
  assertFixtureRoot(root);
  const link = path.join(root, "node_modules");
  if (await exists(link)) {
    assert((await fsp.lstat(link)).isSymbolicLink(), "Refusing to remove a non-link dependencies directory");
    await fsp.unlink(link);
  }
  await fsp.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export async function assertPortsFree() {
  for (const port of [4174, 4175, 5173]) {
    for (const host of ["127.0.0.1", "::1"]) {
      await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once("error", (error) => {
          if (["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)) resolve();
          else reject(new Error(`Required port ${port} is occupied or unavailable (${error.code}). Stop your own launcher before running QA; no existing service was touched.`));
        });
        probe.listen({ port, host, exclusive: true }, () => probe.close(resolve));
      });
    }
  }
}

export async function startFixtureServices(fixture) {
  const { root } = fixture;
  assertFixtureRoot(root);
  await assertPortsFree();
  const { createServer } = await import("vite");
  const { startBridge } = await import(pathToFileURL(path.join(root, "tools/resource-studio/bridge.mjs")));
  const services = [];
  let bridge;
  const drain = async () => {
    const response = await fetch(`${ORIGINS.bridge}/api/state`, { headers: { Origin: ORIGINS.studio, Authorization: `Bearer ${bridge.token}` }, signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, "Could not drain fixture bridge before cleanup or the next scenario");
    await response.arrayBuffer();
  };
  const close = async () => {
    const results = await Promise.allSettled(services.map((server) => server.close()));
    if (bridge) {
      try { await drain(); } finally {
        bridge.server.closeAllConnections();
        await new Promise((resolve, reject) => bridge.server.close((error) => error ? reject(error) : resolve()));
      }
    }
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected) throw rejected.reason;
  };
  try {
    bridge = await startBridge({ root, port: 4175 });
    for (const [name, port, config, serverRoot] of [
      ["portfolio", 5173, "vite.config.js", root],
      ["studio", 4174, "tools/resource-studio/vite.config.js", path.join(root, "tools/resource-studio")],
    ]) {
      const server = await createServer({
        root: serverRoot,
        configFile: path.join(root, config),
        configLoader: "runner",
        envDir: root,
        envPrefix: "BROWSER_QA_",
        // Keep optimized deps under a node_modules-named segment so React's
        // source transforms skip them, without caching through the junction.
        cacheDir: path.join(root, ".browser-cache/node_modules", name),
        logLevel: "error",
        clearScreen: false,
        server: { host: "127.0.0.1", port, strictPort: true, open: false, fs: { allow: [root, path.join(WORKSPACE, "node_modules")] } },
      });
      services.push(server);
      await server.listen();
      assert.equal(server.httpServer.address().port, port);
    }
    return { close, drain };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function launchBrowser(chromium) {
  try {
    return await chromium.launch({ channel: "msedge", headless: true, timeout: 20000 });
  } catch {
    const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    if (await exists(edge)) return chromium.launch({ executablePath: edge, headless: true, timeout: 20000 });
    return chromium.launch({ headless: true, timeout: 20000 });
  }
}

export async function newContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", serviceWorkers: "block", ...options });
  // Only fixture origins may receive requests, including form submissions.
  // This also makes screenshot smoke independent of external font/CDN services.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["data:", "blob:"].includes(url.protocol) || Object.values(ORIGINS).includes(url.origin)) await route.continue();
    else await route.abort("blockedbyclient");
  });
  context.setDefaultTimeout(12000);
  context.setDefaultNavigationTimeout(20000);
  return context;
}

export async function poll(check, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let lastError;
  do {
    try { if (await check()) return; } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`${message}${lastError ? ` (${lastError.message})` : ""}`);
}

export async function readyStudio(page) {
  await page.getByRole("heading", { name: "Resource Studio", exact: true }).waitFor();
  await page.getByText("Project bridge connected", { exact: true }).waitFor();
  await poll(async () => (await page.locator(".studio-storage-status").innerText()).includes("local project bridge"), "Studio never finished loading fixture project state");
  await page.getByLabel("Display title", { exact: false }).waitFor();
}

export async function commitAction(page, action) {
  // Observe the actual browser POST, not a test-side API save.
  const responsePromise = page.waitForResponse((response) => response.url() === `${ORIGINS.bridge}/api/commit` && response.request().method() === "POST");
  const [response] = await Promise.all([responsePromise, action()]);
  const result = await response.json();
  assert.equal(response.status(), 200, result.error || "Browser bridge commit failed");
  assert.equal(result.ok, true);
  await poll(async () => (await page.locator(".studio-storage-status").innerText()).includes("local project bridge"), "Commit did not finish browser persistence");
  return result;
}

export async function readCatalog(fixture) {
  return readJson(path.join(fixture.root, "src/data/resourceCatalog.json"));
}

export async function assertManifests(fixture) {
  const catalog = await readCatalog(fixture);
  const expected = catalog.resources.filter((resource) => resource.published);
  const generated = await readJson(path.join(fixture.root, "src/data/resourceCatalog.public.json"));
  const manifest = await readJson(path.join(fixture.root, "public/assets/resources/resources.json"));
  assert.deepEqual(generated, manifest, "Generated source and HTTP manifest differ");
  assert.deepEqual(manifest.resources, expected, "Public manifest differs from published canonical records");
  assert.deepEqual(catalog.resources.map((resource) => resource.displayOrder), catalog.resources.map((_, index) => index + 1), "Canonical order must remain contiguous");
  assert.equal(new Set(catalog.resources.map((resource) => resource.id)).size, catalog.resources.length, "Duplicate canonical IDs");
  assert.equal((await readJson(path.join(fixture.root, ".resource-studio/journal.json"))).status, "complete");
  return catalog;
}

export function studioRow(page, title) {
  return page.locator(".studio-resource-row").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

export function publicCard(page, title) {
  return page.locator("#resources-library .resource-grid > article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

export async function screenshot(page, reportDir, name, fullPage = false) {
  await page.screenshot({ path: path.join(reportDir, `${name}.png`), fullPage, animations: "disabled", timeout: 15000 });
}
