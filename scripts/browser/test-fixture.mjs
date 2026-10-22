// Dependency-independent harness check. This is not a browser-test substitute.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { WORKSPACE, ORIGINS, PRIVATE_TEXT, createFixture, removeFixture, startFixtureServices, assertPortsFree, readJson, exists, filesUnder } from "./fixture.mjs";
import fsp from "node:fs/promises";

await test("synthetic fixture isolation, strict services and production build preflight", { timeout: 90000 }, async () => {
  await assertPortsFree();
  const fixture = await createFixture();
  let services;
  try {
    for (const relative of [".env", ".env.local", "backups"]) assert.equal(await exists(path.join(fixture.root, relative)), false);
    const catalog = await readJson(path.join(fixture.root, "src/data/resourceCatalog.json"));
    assert.equal(catalog.resources.length, 4);
    assert(catalog.resources.every((resource) => resource.id.startsWith("qa-")));
    const managed = await filesUnder(path.join(fixture.root, "public/assets/resources"));
    assert.equal(managed.length, 3, "Unexpected non-synthetic managed asset copied");
    services = await startFixtureServices(fixture);
    await services.drain();
    for (const [name, url, modulePath] of [["studio", ORIGINS.studio, "/ResourceStudio.jsx"], ["portfolio", ORIGINS.portfolio, "/src/App.jsx"]]) {
      const html = await fetch(url, { signal: AbortSignal.timeout(15000) });
      assert.equal(html.status, 200, `${name} HTML unavailable`);
      assert.match(await html.text(), /type="module"/);
      const module = await fetch(`${url}${modulePath}`, { signal: AbortSignal.timeout(15000) });
      assert.equal(module.status, 200, `${name} fixture module failed to transform`);
    }
    const manifest = await fetch(`${ORIGINS.portfolio}/assets/resources/resources.json`, { signal: AbortSignal.timeout(15000) });
    assert.equal((await manifest.json()).resources.length, 3);
    await promisify(execFile)(process.execPath, [path.join(WORKSPACE, "scripts/browser/build-fixture.mjs"), fixture.root], { cwd: fixture.root, timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true });
    const output = await filesUnder(path.join(fixture.root, "dist"));
    assert(output.some((file) => path.basename(file) === "index.html"));
    for (const file of output) assert(!(await fsp.readFile(file)).includes(Buffer.from(PRIVATE_TEXT)), "Synthetic private prompt leaked into preflight output");
  } finally {
    try { if (services) await services.close(); } finally { await removeFixture(fixture.root); }
  }
  await assertPortsFree();
  assert.equal(await exists(fixture.root), false, "Temporary fixture was not removed");
});
