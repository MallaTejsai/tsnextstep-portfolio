import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  WORKSPACE, ORIGINS, PRIVATE_TEXT, UPLOAD_TEXT, EDITED_TEXT,
  createFixture, removeFixture, seedFixture, startFixtureServices, assertPortsFree,
  launchBrowser, newContext, readyStudio, commitAction, poll, screenshot,
  readCatalog, readJson, writeJson, assertManifests, exists, filesUnder, studioRow, publicCard,
} from "./browser/fixture.mjs";

const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => !["--baseline", "--help"].includes(arg))) throw new Error("Usage: node scripts/test-browser.mjs [--baseline]");
if (args.has("--help")) {
  console.log("Run: node scripts/test-browser.mjs [--baseline]\nRequires parent-installed playwright and Edge (or Playwright Chromium), and free ports 4174/4175/5173.\n--baseline labels this run's screenshots/report as a baseline; it runs the same assertions.\nOnly a synthetic approved-temp fixture is mutated; reports go to .resource-studio/qa/.");
  process.exit(0);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  console.error("Browser checks NOT RUN: playwright is not installed. After the parent installs it, run: node scripts/test-browser.mjs");
  process.exit(2);
}

// Fail before creating anything if the real launcher owns these fixed origins.
await assertPortsFree();
const label = args.has("--baseline") ? "baseline" : "final";
const runName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${label}`;
const reportDir = path.join(WORKSPACE, ".resource-studio/qa", runName);
await fsp.mkdir(reportDir, { recursive: true });
const report = { mode: label, startedAt: new Date().toISOString(), tests: [], milestones: [], screenshots: [], fixtureRemoved: false, servicesStopped: false };
console.log(`Browser QA reports: ${path.relative(WORKSPACE, reportDir)}`);

await test("isolated Studio → bridge → files → catalog → portfolio", { timeout: 420000 }, async (suite) => {
  let fixture;
  let services;
  let browser;
  const contexts = new Set();
  const capture = async (page, name, fullPage = false) => {
    await screenshot(page, reportDir, name, fullPage);
    report.screenshots.push(`${name}.png`);
  };
  const run = async (name, fn, options = {}) => {
    await suite.test(name, { timeout: options.timeout || 70000 }, async () => {
      const record = { name, status: "running", startedAt: new Date().toISOString() };
      report.tests.push(record);
      let context;
      try {
        await services.drain();
        await seedFixture(fixture);
        context = await newContext(browser, options.context);
        contexts.add(context);
        const studio = await context.newPage();
        const portfolio = await context.newPage();
        const pageErrors = [];
        studio.on("pageerror", (error) => pageErrors.push(`Studio: ${error.message}`));
        portfolio.on("pageerror", (error) => pageErrors.push(`Portfolio: ${error.message}`));
        await Promise.all([studio.goto(ORIGINS.studio), portfolio.goto(ORIGINS.portfolio)]);
        await fn({ studio, portfolio, context, record });
        assert.deepEqual(pageErrors, [], "Uncaught browser errors");
        record.status = "passed";
      } catch (error) {
        record.status = "failed";
        record.error = error.message;
        for (const [index, page] of (context?.pages() || []).entries()) {
          await capture(page, `failure-${report.tests.length}-${index}`).catch(() => undefined);
        }
        throw error;
      } finally {
        record.finishedAt = new Date().toISOString();
        if (context) { await context.close(); contexts.delete(context); }
        await writeJson(path.join(reportDir, "report.json"), report);
      }
    });
  };
  const select = async (studio, title) => {
    await studio.getByRole("button", { name: `Select ${title}`, exact: true }).click();
    await poll(async () => await studio.getByLabel("Display title", { exact: false }).inputValue() === title, "Editor selection did not update");
  };
  const save = (studio) => commitAction(studio, () => studio.getByRole("button", { name: "Save Changes", exact: true }).click());
  const upload = async (studio) => {
    await readyStudio(studio);
    await commitAction(studio, () => studio.locator('input[type="file"][multiple]').setInputFiles({ name: "qa-upload.txt", mimeType: "text/plain", buffer: Buffer.from(UPLOAD_TEXT) }));
    const catalog = await assertManifests(fixture);
    const added = catalog.resources.find((resource) => resource.originalFileName === "qa-upload.txt");
    assert(added, "Browser upload never reached the canonical catalog");
    assert.equal(added.published, false, "Uploads must start as drafts");
    assert.equal(await exists(path.join(fixture.root, "public", added.filePath)), false);
    assert.equal(await fsp.readFile(path.join(fixture.root, ".resource-studio/drafts", added.filePath), "utf8"), UPLOAD_TEXT);
    await select(studio, added.title);
    return added;
  };
  const publishUpload = async (studio) => {
    const added = await upload(studio);
    await studio.getByLabel("Display title", { exact: false }).fill("QA Uploaded Prompt");
    await studio.getByLabel("Description", { exact: true }).fill("A synthetic uploaded prompt for end-to-end QA.");
    await save(studio);
    assert.equal((await readCatalog(fixture)).resources.find((resource) => resource.id === added.id).published, false);
    await studio.getByLabel("Visible on public website").check();
    await save(studio);
    return { ...added, title: "QA Uploaded Prompt" };
  };
  const focusTrap = async (page, dialog) => {
    const controls = dialog.locator('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]');
    const first = controls.first();
    const last = controls.last();
    await poll(() => dialog.evaluate((element) => element.contains(document.activeElement)), "Dialog did not take keyboard focus");
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    assert(await last.evaluate((element) => element === document.activeElement), "Reverse tab escaped dialog");
    await page.keyboard.press("Tab");
    assert(await first.evaluate((element) => element === document.activeElement), "Forward tab escaped dialog");
  };

  try {
    fixture = await createFixture();
    services = await startFixtureServices(fixture);
    browser = await launchBrowser(chromium);
    report.browser = browser.version();

    await run("fresh browser storage initializes the editor and bridge", async ({ studio, portfolio }) => {
      await capture(studio, "baseline-studio-desktop");
      await capture(portfolio, "baseline-portfolio-desktop");
      await readyStudio(studio);
      assert.equal(await studio.locator(".studio-resource-row").count(), fixture.seed.resources.length);
      assert.equal(await studio.getByLabel("Display title", { exact: false }).inputValue(), "QA Alpha Note");
      await publicCard(portfolio, "QA Alpha Note").waitFor();
      assert.equal(await portfolio.getByRole("group", { name: "Format", exact: true }).getByRole("button", { name: "Prompts", exact: true }).count(), 0, "Draft-only format leaked into public filters");
      await capture(studio, "initialized-studio-desktop");
    });

    await run("upload draft → edit → publish → live filters → reload → stable metadata identity", async ({ studio, portfolio }) => {
      // Keep the portfolio open before upload/publish: a manual reload here
      // would hide a broken manifest refresh or static filter list.
      await publicCard(portfolio, "QA Alpha Note").waitFor();
      const added = await publishUpload(studio);
      report.milestones.push("draft upload and metadata edit committed before publish");
      let catalog = await assertManifests(fixture);
      assert.equal(catalog.resources.length, fixture.seed.resources.length + 1);
      let saved = catalog.resources.find((resource) => resource.id === added.id);
      assert.equal(saved.filePath, added.filePath);
      assert.equal(saved.title, added.title);
      assert.equal(saved.description, "A synthetic uploaded prompt for end-to-end QA.");
      assert.equal(saved.published, true);
      assert.equal(await fsp.readFile(path.join(fixture.root, "public", saved.filePath), "utf8"), UPLOAD_TEXT);
      const served = await portfolio.request.get(`${ORIGINS.portfolio}/${saved.filePath}`);
      assert.equal(served.status(), 200);
      assert.equal(await served.text(), UPLOAD_TEXT);
      const manifest = await portfolio.request.get(`${ORIGINS.portfolio}/assets/resources/resources.json`);
      assert.deepEqual((await manifest.json()).resources, catalog.resources.filter((resource) => resource.published));
      await publicCard(portfolio, saved.title).waitFor();
      await portfolio.getByRole("group", { name: "Format", exact: true }).getByRole("button", { name: "Prompts", exact: true }).click();
      await portfolio.getByRole("group", { name: "Category", exact: true }).getByRole("button", { name: "AI Prompts", exact: true }).click();
      assert.equal(await portfolio.locator("#resources-library .resource-grid > article").count(), 1);
      await portfolio.getByRole("searchbox", { name: "Search resources", exact: true }).fill("synthetic uploaded");
      await publicCard(portfolio, saved.title).waitFor();
      assert.equal(await publicCard(portfolio, saved.title).locator("p").first().innerText(), saved.description);
      await capture(portfolio, "published-dynamic-filters-desktop");
      report.milestones.push("public bytes, both manifests, live portfolio and newly introduced format/category filters agree");

      await Promise.all([studio.reload(), portfolio.reload()]);
      await readyStudio(studio);
      await select(studio, saved.title);
      assert.equal(await studio.getByLabel("Description", { exact: true }).inputValue(), saved.description);
      assert.equal(await studio.getByLabel("Visible on public website").isChecked(), true);
      await publicCard(portfolio, saved.title).waitFor();
      await studio.getByLabel("Display title", { exact: false }).fill("QA Renamed Prompt");
      await studio.getByLabel("Description", { exact: true }).fill("Metadata edited without replacing the file or resource identity.");
      await save(studio);
      catalog = await assertManifests(fixture);
      assert.equal(catalog.resources.length, fixture.seed.resources.length + 1);
      saved = catalog.resources.find((resource) => resource.id === added.id);
      assert.equal(saved.title, "QA Renamed Prompt");
      assert.equal(saved.filePath, added.filePath);
      assert.equal(saved.originalFileName, "qa-upload.txt");
      assert.equal(await fsp.readFile(path.join(fixture.root, "public", saved.filePath), "utf8"), UPLOAD_TEXT);
      await publicCard(portfolio, saved.title).waitFor();
      await publicCard(portfolio, added.title).waitFor({ state: "detached" });
      await capture(studio, "final-studio-published-desktop");
      await capture(portfolio, "final-portfolio-published-desktop");
      report.milestones.push("both reloads persist; metadata edit preserves ID, file path and bytes");
    }, { timeout: 100000 });

    await run("unpublish removes live cards and filters; production dist excludes draft bytes and metadata", async ({ studio, portfolio }) => {
      const added = await publishUpload(studio);
      await publicCard(portfolio, added.title).waitFor();
      await studio.getByLabel("Visible on public website").uncheck();
      await save(studio);
      const catalog = await assertManifests(fixture);
      assert.equal(catalog.resources.find((resource) => resource.id === added.id).published, false);
      assert.equal(await exists(path.join(fixture.root, "public", added.filePath)), false);
      assert.equal(await fsp.readFile(path.join(fixture.root, ".resource-studio/drafts", added.filePath), "utf8"), UPLOAD_TEXT);
      await publicCard(portfolio, added.title).waitFor({ state: "detached" });
      await portfolio.getByRole("group", { name: "Format", exact: true }).getByRole("button", { name: "Prompts", exact: true }).waitFor({ state: "detached" });
      await portfolio.getByRole("group", { name: "Category", exact: true }).getByRole("button", { name: "AI Prompts", exact: true }).waitFor({ state: "detached" });
      await Promise.all([studio.reload(), portfolio.reload()]);
      await readyStudio(studio);
      await select(studio, added.title);
      assert.equal(await studio.getByLabel("Visible on public website").isChecked(), false);
      assert.equal(await publicCard(portfolio, added.title).count(), 0);
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [path.join(WORKSPACE, "scripts/browser/build-fixture.mjs"), fixture.root], { cwd: fixture.root, timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true });
      await fsp.writeFile(path.join(reportDir, "fixture-build.log"), `${stdout}\n${stderr}`);
      const output = await filesUnder(path.join(fixture.root, "dist"));
      assert(output.some((file) => path.basename(file) === "index.html"), "Fixture production build produced no index");
      for (const file of output) {
        const relative = path.relative(path.join(fixture.root, "dist"), file).replaceAll(path.sep, "/");
        assert(!/resourceCatalog\.json|\.resource-studio|backups|\.env(?:\.|$)/.test(relative), "Private authoring artifact in dist");
        const bytes = await fsp.readFile(file);
        for (const marker of [PRIVATE_TEXT, "QA_PRIVATE_TITLE_91ab65", UPLOAD_TEXT, added.title, added.filePath]) {
          assert(!bytes.includes(Buffer.from(marker)), `Unpublished fixture marker leaked into dist/${relative}`);
        }
      }
      assert.equal(await exists(path.join(fixture.root, "dist", added.filePath)), false);
      assert.equal(await fsp.readFile(path.join(fixture.root, "dist/assets/resources/notes/qa-alpha.md"), "utf8"), "QA_ALPHA_PUBLIC_BYTES\nA synthetic public note.\n");
      assert.deepEqual((await readJson(path.join(fixture.root, "dist/assets/resources/resources.json"))).resources.map((resource) => resource.id), ["qa-note-alpha", "qa-note-beta", "qa-episode"]);
      report.milestones.push("unpublish survives reload and fixture production validation/build privacy scan");
      await capture(portfolio, "final-unpublished-portfolio-desktop");
    }, { timeout: 120000 });

    await run("edited prompt text matches canonical, generated, downloaded and rendered bytes", async ({ studio, portfolio }) => {
      const added = await publishUpload(studio);
      await studio.getByLabel("Prompt text", { exact: false }).fill(EDITED_TEXT);
      await save(studio);
      const catalog = await assertManifests(fixture);
      const saved = catalog.resources.find((resource) => resource.id === added.id);
      assert.equal(saved.filePath, added.filePath);
      assert.equal(saved.promptText, EDITED_TEXT);
      assert.equal(saved.fileSize, Buffer.byteLength(EDITED_TEXT), "Edited prompt file size is stale");
      assert.equal(await fsp.readFile(path.join(fixture.root, "public", saved.filePath), "utf8"), EDITED_TEXT, "Prompt editor and real published text file disagree");
      assert.equal(await (await portfolio.request.get(`${ORIGINS.portfolio}/${saved.filePath}`)).text(), EDITED_TEXT);
      await poll(async () => await publicCard(portfolio, saved.title).locator("pre").textContent() === EDITED_TEXT, "Public prompt content did not refresh");
      await publicCard(portfolio, saved.title).locator("summary").click();
      await capture(portfolio, "final-edited-prompt-desktop");
      await studio.reload();
      await readyStudio(studio);
      await select(studio, added.title);
      assert.equal(await studio.getByLabel("Prompt text", { exact: false }).inputValue(), EDITED_TEXT);
    });

    await run("delete NON-LAST resource reindexes remaining entries and preserves recoverable trash", async ({ studio, portfolio }) => {
      await readyStudio(studio);
      const before = await readCatalog(fixture);
      const target = before.resources[0];
      assert(before.resources.length >= 3 && target.id !== before.resources.at(-1).id);
      const bytes = await fsp.readFile(path.join(fixture.root, "public", target.filePath));
      studio.once("dialog", (dialog) => dialog.accept());
      const result = await commitAction(studio, () => studioRow(studio, target.title).getByRole("button", { name: "Delete resource", exact: true }).click());
      const after = await assertManifests(fixture);
      assert.deepEqual(after.resources.map((resource) => resource.id), before.resources.slice(1).map((resource) => resource.id));
      assert.equal(await exists(path.join(fixture.root, "public", target.filePath)), false);
      assert.equal(await exists(path.join(fixture.root, ".resource-studio/drafts", target.filePath)), false);
      assert(result.trash?.startsWith(".resource-studio/trash/"), "No recoverable trash returned");
      assert.deepEqual(await fsp.readFile(path.join(fixture.root, result.trash, "public", target.filePath)), bytes);
      await publicCard(portfolio, target.title).waitFor({ state: "detached" });
      await publicCard(portfolio, "QA Beta Note").waitFor();
      await studio.reload();
      await readyStudio(studio);
      assert.deepEqual(await studio.locator(".studio-resource-row h3").allTextContents(), after.resources.map((resource) => resource.title));
      await capture(studio, "final-delete-reindexed-desktop");
    });

    await run("keyboard reorder persists canonical, generated and rendered public order", async ({ studio, portfolio }) => {
      await readyStudio(studio);
      const move = studioRow(studio, "QA Beta Note").getByRole("button", { name: "Move up", exact: true });
      await move.focus();
      await commitAction(studio, () => studio.keyboard.press("Enter"));
      const catalog = await assertManifests(fixture);
      assert.deepEqual(catalog.resources.slice(0, 2).map((resource) => resource.id), ["qa-note-beta", "qa-note-alpha"]);
      await poll(async () => (await portfolio.locator("#resources-library .resource-grid > article h3").allTextContents()).join("|") === "QA Beta Note|QA Alpha Note", "Portfolio order did not follow the committed catalog");
      await Promise.all([studio.reload(), portfolio.reload()]);
      await readyStudio(studio);
      assert.deepEqual(await studio.locator(".studio-resource-row h3").allTextContents(), catalog.resources.map((resource) => resource.title));
      await publicCard(portfolio, "QA Beta Note").waitFor();
      assert.deepEqual(await portfolio.locator("#resources-library .resource-grid > article h3").allTextContents(), ["QA Beta Note", "QA Alpha Note"]);
    });

    await run("invalid upload and invalid editor data show actionable errors without committing", async ({ studio }) => {
      await readyStudio(studio);
      const before = await readCatalog(fixture);
      let commits = 0;
      studio.on("request", (request) => { if (request.url() === `${ORIGINS.bridge}/api/commit` && request.method() === "POST") commits += 1; });
      await studio.locator('input[type="file"][multiple]').setInputFiles({ name: "qa-invalid.exe", mimeType: "application/octet-stream", buffer: Buffer.from("synthetic-invalid-upload") });
      await studio.getByRole("alert").filter({ hasText: /PDF.*TXT.*Markdown/ }).waitFor();
      await select(studio, "QA_PRIVATE_TITLE_91ab65");
      await studio.getByLabel("Prompt text", { exact: false }).fill("");
      await studio.getByLabel("Visible on public website").check();
      await studio.getByRole("button", { name: "Save Changes", exact: true }).click();
      await studio.getByRole("alert").filter({ hasText: /actual prompt text/i }).waitFor();
      assert.equal(commits, 0, "Invalid UI data was sent to the bridge");
      assert.deepEqual(await readCatalog(fixture), before);
      await capture(studio, "final-invalid-editor-visible-error");
    });

    await run("bridge rejection and network loss remain visible; retry commits recovered browser draft", async ({ studio }) => {
      await readyStudio(studio);
      const before = await readCatalog(fixture);
      const endpoint = `${ORIGINS.bridge}/api/commit`;
      // Fault injection is limited to this negative boundary check; every
      // successful flow uses the real bridge and actual files.
      const reject = (route) => route.fulfill({ status: 400, contentType: "application/json", headers: { "Access-Control-Allow-Origin": ORIGINS.studio }, body: JSON.stringify({ error: "QA bridge rejected this synthetic save." }) });
      await studio.route(endpoint, reject);
      await studio.getByLabel("Display title", { exact: false }).fill("QA Recoverable Edit");
      await studio.getByRole("button", { name: "Save Changes", exact: true }).click();
      await studio.locator(".studio-notice").filter({ hasText: /QA bridge rejected this synthetic save/ }).waitFor();
      assert.deepEqual(await readCatalog(fixture), before);
      await studio.unroute(endpoint, reject);
      const abort = (route) => route.abort("connectionrefused");
      await studio.route(endpoint, abort);
      await studio.getByRole("button", { name: "Save to local project", exact: true }).click();
      await studio.locator(".studio-notice").filter({ hasText: /Failed to fetch|NetworkError|network|unavailable/i }).waitFor();
      await studio.getByText("Browser draft mode", { exact: true }).waitFor();
      assert.deepEqual(await readCatalog(fixture), before);
      await capture(studio, "final-bridge-network-visible-error");
      await studio.unroute(endpoint, abort);
      await studio.reload();
      await studio.getByRole("button", { name: "Select QA Recoverable Edit", exact: true }).waitFor();
      await commitAction(studio, () => studio.getByRole("button", { name: "Save to local project", exact: true }).click());
      const after = await assertManifests(fixture);
      assert.equal(after.resources[0].id, before.resources[0].id);
      assert.equal(after.resources[0].title, "QA Recoverable Edit");
      await studio.reload();
      await readyStudio(studio);
      assert.equal(await studio.getByLabel("Display title", { exact: false }).inputValue(), "QA Recoverable Edit");
    });

    await run("overlapping saves retain the latest edit after delayed real bridge I/O and reload", async ({ studio }) => {
      await readyStudio(studio);
      const endpoint = `${ORIGINS.bridge}/api/commit`;
      let releaseFirst;
      const gate = new Promise((resolve) => { releaseFirst = resolve; });
      let requests = 0;
      const delayFirst = async (route) => {
        requests += 1;
        if (requests === 1) await gate;
        await route.continue();
      };
      const responses = [];
      studio.on("response", (response) => {
        if (response.url() === endpoint && response.request().method() === "POST") responses.push(response);
      });
      await studio.route(endpoint, delayFirst);
      // Keep the same control if its accessible name changes to "Saving…".
      const button = studio.locator(".studio-editor-actions button").first();
      try {
        await studio.getByLabel("Display title", { exact: false }).fill("QA Queue First");
        await button.click();
        await poll(() => requests === 1, "First UI save never reached the bridge boundary");
        if (await button.isEnabled()) {
          await studio.getByLabel("Display title", { exact: false }).fill("QA Queue Latest");
          await button.click();
          // Give a second unqueued request a chance to overtake the held first
          // one. This delay changes scheduling only, never a response payload.
          await new Promise((resolve) => setTimeout(resolve, 350));
          releaseFirst();
        } else {
          // A UI that explicitly serializes editing by disabling Save is valid.
          releaseFirst();
          await poll(async () => await button.isEnabled(), "Save never re-enabled");
          await studio.getByLabel("Display title", { exact: false }).fill("QA Queue Latest");
          await button.click();
        }
        await poll(() => responses.length === 2, "Both user saves did not finish");
        for (const response of responses) assert.equal(response.status(), 200, "Queued bridge save was rejected");
        await services.drain();
        const catalog = await assertManifests(fixture);
        assert.equal(catalog.resources[0].id, "qa-note-alpha");
        assert.equal(catalog.resources[0].title, "QA Queue Latest", "Older save overtook the latest edit");
        await studio.reload();
        await readyStudio(studio);
        assert.equal(await studio.getByLabel("Display title", { exact: false }).inputValue(), "QA Queue Latest", "Browser recovery restored a stale queued edit");
      } finally {
        releaseFirst();
        await studio.unroute(endpoint, delayFirst);
      }
    });

    for (const width of [390, 768, 1440]) {
      await run(`${width}px reduced-motion overflow, navigation focus and modal Escape smoke`, async ({ studio, portfolio }) => {
        await readyStudio(studio);
        await publicCard(portfolio, "QA Alpha Note").waitFor();
        for (const [name, page] of [["studio", studio], ["portfolio", portfolio]]) {
          assert(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
          await capture(page, `final-${name}-${width}-reduced-motion`, true);
          const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
          assert(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1, `${name} has horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
        }
        const menuToggle = portfolio.getByRole("button", { name: "Open menu", exact: true });
        if (await menuToggle.isVisible()) {
          await menuToggle.click();
          const dialog = portfolio.getByRole("dialog", { name: "Site menu", exact: true });
          await focusTrap(portfolio, dialog);
          await capture(portfolio, `final-navigation-${width}`);
          await portfolio.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert(await menuToggle.evaluate((element) => element === document.activeElement), "Menu Escape did not restore focus");
        } else {
          const resources = portfolio.getByRole("navigation", { name: "Primary", exact: true }).locator('a[href="#resources"]');
          await resources.focus();
          await portfolio.keyboard.press("Enter");
          await poll(() => portfolio.locator("#resources").evaluate((element) => Math.abs(element.getBoundingClientRect().top) < 200), "Desktop nav did not reach resources");
        }
        const trigger = portfolio.getByRole("button", { name: "Open QA Synthetic Episode — choose where to watch this episode", exact: true });
        await trigger.click();
        const modal = portfolio.getByRole("dialog", { name: "QA Synthetic Episode", exact: true });
        await modal.waitFor();
        await focusTrap(portfolio, modal);
        await capture(portfolio, `final-episode-modal-${width}`);
        await portfolio.keyboard.press("Escape");
        await modal.waitFor({ state: "detached" });
        assert(await trigger.evaluate((element) => element === document.activeElement), "Modal Escape did not restore focus");
        // Intentionally never click external episode links or submit contact.
      }, { context: { viewport: { width, height: width === 390 ? 844 : 1000 } } });
    }
  } catch (error) {
    report.fatalError = error.message;
    throw error;
  } finally {
    for (const context of contexts) await context.close().catch(() => undefined);
    try {
      if (browser) await browser.close();
    } finally {
      try {
        if (services) { await services.close(); report.servicesStopped = true; }
      } finally {
        try {
          if (fixture) { await removeFixture(fixture.root); report.fixtureRemoved = true; }
        } finally {
          report.finishedAt = new Date().toISOString();
          await writeJson(path.join(reportDir, "report.json"), report);
        }
      }
    }
  }
});
