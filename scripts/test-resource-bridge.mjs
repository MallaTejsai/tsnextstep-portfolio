import assert from "node:assert/strict";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { DEFAULT_CATEGORIES } from "../src/lib/resourceValidation.js";
import { startBridge, STUDIO_ORIGIN } from "../tools/resource-studio/bridge.mjs";

const root = await fsp.mkdtemp(path.join(os.tmpdir(), "tsnextstep-bridge-"));
const catalogPath = path.join(root, "src", "data", "resourceCatalog.json");
const publicCatalogPath = path.join(root, "src", "data", "resourceCatalog.public.json");
const publicManifestPath = path.join(root, "public", "assets", "resources", "resources.json");
await fsp.mkdir(path.join(root, "src", "data"), { recursive: true });
await fsp.mkdir(path.join(root, "public", "assets", "resources", "pdfs"), { recursive: true });
await fsp.mkdir(path.join(root, "public", "assets", "resources", "prompt-packs"), { recursive: true });
await fsp.writeFile(path.join(root, "package.json"), "{\"private\":true}\n");
await fsp.writeFile(catalogPath, `${JSON.stringify({ version: 3, categories: DEFAULT_CATEGORIES, resources: [] }, null, 2)}\n`);

const file = (text) => Buffer.from(text).toString("base64");
const publishedPdf = "assets/resources/pdfs/local-guide.pdf";
const draftPrompt = "assets/resources/prompt-packs/local-prompt.md";
let faultPhase = null;
let faultObservation = null;
const bridge = await startBridge({ root, port: 0, testOnlyAfterWrite: async ({ phase }) => {
  if (phase !== faultPhase) return;
  faultObservation = {
    phase,
    asset: await fsp.readFile(path.join(root, "public", publishedPdf), "utf8"),
    newCover: await fsp.readFile(path.join(root, "public/assets/resources/covers/new.png"), "utf8"),
    newDraft: await fsp.readFile(path.join(root, ".resource-studio/drafts/assets/resources/notes/new.md"), "utf8"),
    hasManifest: await fsp.access(publicManifestPath).then(() => true, () => false),
  };
  throw new Error("Synthetic mid-write fault.");
} });
const port = bridge.server.address().port;
const url = `http://127.0.0.1:${port}`;

async function request(endpoint, options = {}, withToken = true) {
  const headers = { Origin: STUDIO_ORIGIN, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(withToken ? { Authorization: `Bearer ${bridge.token}` } : {}) };
  const response = await fetch(`${url}${endpoint}`, { ...options, headers });
  const body = await response.json();
  return { response, body };
}

async function commit(catalog, files = [], operation = "save", deleteResourceId = null, extra = {}) {
  return request("/api/commit", { method: "POST", body: JSON.stringify({ catalog, files, operation, deleteResourceId, ...extra }) });
}

async function projectSnapshot() {
  const files = {};
  async function visit(relative) {
    const absolute = path.join(root, relative);
    const stats = await fsp.lstat(absolute).catch((error) => { if (error.code !== "ENOENT") throw error; });
    if (!stats) return;
    if (stats.isDirectory()) {
      for (const entry of await fsp.readdir(absolute)) await visit(`${relative}/${entry}`);
    } else {
      assert.equal(stats.isFile(), true);
      files[relative] = crypto.createHash("sha256").update(await fsp.readFile(absolute)).digest("hex");
    }
  }
  for (const directory of ["src/data", "public/assets/resources", ".resource-studio/drafts"]) await visit(directory);
  return files;
}

let restarted;
try {
const baseResource = {
  id: "local-guide",
  kind: "pdf",
  type: "pdf",
  title: "Local Guide",
  description: "A bridge test file.",
  categoryId: "guides",
  tags: ["test"],
  filePath: publishedPdf,
  originalFileName: "local-guide.pdf",
  fileSize: 12,
  mimeType: "application/pdf",
  promptText: null,
  featured: false,
  published: true,
  displayOrder: 1,
};
const baseCatalog = { version: 3, categories: DEFAULT_CATEGORIES, resources: [baseResource] };
await fsp.writeFile(path.join(root, "public", publishedPdf), "%PDF-original");
await fsp.writeFile(path.join(root, "public/assets/resources/pdfs/stale.pdf"), "%PDF-stale");
await fsp.mkdir(path.join(root, ".resource-studio/drafts/assets/resources/prompt-packs"), { recursive: true });
await fsp.writeFile(path.join(root, ".resource-studio/drafts", draftPrompt), "original synthetic draft");
const beforeFault = await projectSnapshot();
for (const phase of ["after-assets", "after-manifests"]) {
  faultPhase = phase;
  faultObservation = null;
  const failed = await commit({ ...baseCatalog, resources: [{ ...baseResource, cover: "assets/resources/covers/new.png" }] }, [
    { path: publishedPdf, base64: file("%PDF-replacement") },
    { path: draftPrompt, base64: file("replacement synthetic draft") },
    { path: "assets/resources/covers/new.png", base64: file("synthetic new cover") },
    { path: "assets/resources/notes/new.md", base64: file("synthetic new draft") },
  ]);
  assert.equal(failed.response.status, 400);
  assert.match(failed.body.error, /Synthetic mid-write fault/);
  assert.deepEqual(faultObservation, { phase, asset: "%PDF-replacement", newCover: "synthetic new cover", newDraft: "synthetic new draft", hasManifest: phase === "after-manifests" });
  assert.deepEqual(await projectSnapshot(), beforeFault, "mid-write rollback did not restore exact files and manifest absence");
  assert.equal(JSON.parse(await fsp.readFile(path.join(root, ".resource-studio/journal.json"), "utf8")).status, "rolled-back");
  assert.deepEqual(await fsp.readdir(path.join(root, ".resource-studio/staging")), [], "failed commit left staging files");
}
faultPhase = null;
await fsp.rm(path.join(root, "public/assets/resources/pdfs/stale.pdf"));
await fsp.rm(path.join(root, ".resource-studio/drafts", draftPrompt));
let result = await commit(baseCatalog, [{ path: publishedPdf, name: "local-guide.pdf", type: "application/pdf", base64: file("%PDF-bridge") }]);
assert.equal(result.response.status, 200, result.body.error);
assert.equal(result.body.publicResourceCount, 1);
assert.equal((await fsp.readFile(path.join(root, "public", publishedPdf))).toString(), "%PDF-bridge");
assert.match(await fsp.readFile(path.join(root, "src", "data", "resourceCatalog.json"), "utf8"), /local-guide/);
assert.deepEqual((JSON.parse(await fsp.readFile(publicCatalogPath, "utf8"))).resources.map((resource) => resource.id), ["local-guide"]);
assert.deepEqual((JSON.parse(await fsp.readFile(publicManifestPath, "utf8"))).resources.map((resource) => resource.id), ["local-guide"]);

const beforeExistingManifestFault = await projectSnapshot();
faultPhase = "after-manifests";
result = await commit({ ...baseCatalog, resources: [{ ...baseResource, title: "Synthetic interrupted edit", cover: "assets/resources/covers/new.png" }] }, [
  { path: publishedPdf, base64: file("%PDF-replacement") },
  { path: "assets/resources/covers/new.png", base64: file("synthetic new cover") },
  { path: "assets/resources/notes/new.md", base64: file("synthetic new draft") },
]);
assert.equal(result.response.status, 400);
assert.match(result.body.error, /Synthetic mid-write fault/);
assert.deepEqual(await projectSnapshot(), beforeExistingManifestFault, "rollback did not restore existing manifests and assets byte-for-byte");
faultPhase = null;

const edited = { ...baseCatalog, resources: [{ ...baseResource, title: "Edited Local Guide" }] };
result = await commit(edited);
assert.equal(result.response.status, 200, result.body.error);
assert.equal((JSON.parse(await fsp.readFile(catalogPath, "utf8"))).resources.length, 1, "editing created a duplicate");
assert.equal((JSON.parse(await fsp.readFile(catalogPath, "utf8"))).resources[0].title, "Edited Local Guide");

const unauthorized = await request("/api/state", {}, false);
assert.equal(unauthorized.response.status, 401, "bridge accepted a state read without its session token");
const wrongOrigin = await fetch(`${url}/api/health`, { headers: { Origin: "http://localhost:4174", Authorization: `Bearer ${bridge.token}` } });
assert.equal(wrongOrigin.status, 403, "bridge accepted a non-canonical Studio origin");

const draftResource = {
  id: "local-prompt",
  kind: "prompt",
  type: "prompt",
  title: "Local Prompt",
  description: "Private draft.",
  categoryId: "prompts",
  tags: ["draft"],
  filePath: draftPrompt,
  originalFileName: "local-prompt.md",
  fileSize: 18,
  mimeType: "text/markdown",
  promptText: "A private draft prompt.",
  featured: false,
  published: false,
  displayOrder: 2,
};
const withDraft = { ...edited, resources: [edited.resources[0], draftResource] };
result = await commit(withDraft, [{ path: draftPrompt, name: "local-prompt.md", type: "text/markdown", base64: file("A private draft prompt.") }]);
assert.equal(result.response.status, 200, result.body.error);
assert.equal(await fsp.access(path.join(root, "public", draftPrompt)).then(() => true).catch(() => false), false, "draft leaked into public/");
assert.equal(await fsp.readFile(path.join(root, ".resource-studio", "drafts", draftPrompt), "utf8"), "A private draft prompt.");
assert.equal(JSON.parse(await fsp.readFile(path.join(root, "public", "assets/resources/resources.json"), "utf8")).resources.length, 1);
assert.equal(JSON.parse(await fsp.readFile(publicCatalogPath, "utf8")).resources.some((resource) => resource.id === "local-prompt"), false, "draft leaked into generated source catalog");

const unpublished = { ...withDraft, resources: withDraft.resources.map((resource) => ({ ...resource, published: false })) };
result = await commit(unpublished);
assert.equal(result.response.status, 200, result.body.error);
assert.equal(await fsp.access(path.join(root, "public", publishedPdf)).then(() => true).catch(() => false), false, "unpublished file stayed in public/");
assert.equal((await fsp.readFile(path.join(root, ".resource-studio", "drafts", publishedPdf))).toString(), "%PDF-bridge");
assert.equal(JSON.parse(await fsp.readFile(path.join(root, "public", "assets/resources/resources.json"), "utf8")).resources.length, 0);

const publishedPrompt = { ...unpublished, resources: [{ ...unpublished.resources[0], published: true }, { ...unpublished.resources[1], published: true }] };
result = await commit(publishedPrompt, [{ path: draftPrompt, name: "local-prompt.md", type: "text/markdown", base64: file("A private draft prompt.") }]);
assert.equal(result.response.status, 200, result.body.error);
assert.equal((await fsp.readFile(path.join(root, "public", draftPrompt))).toString(), "A private draft prompt.");
assert.deepEqual(JSON.parse(await fsp.readFile(publicManifestPath, "utf8")).resources.map((resource) => resource.id), ["local-guide", "local-prompt"]);

const afterDelete = { ...publishedPrompt, resources: [publishedPrompt.resources[0]] };
result = await commit(afterDelete, [], "delete", "local-prompt");
assert.equal(result.response.status, 200, result.body.error);
assert.equal(await fsp.access(path.join(root, "public", draftPrompt)).then(() => true).catch(() => false), false);
const trashFiles = await fsp.readdir(path.join(root, ".resource-studio", "trash", result.body.trash.split("/").pop(), "public", "assets", "resources", "prompt-packs"));
assert.deepEqual(trashFiles, ["local-prompt.md"]);

const missingCatalog = await request("/api/commit", { method: "POST", body: JSON.stringify({ files: [] }) });
assert.equal(missingCatalog.response.status, 400);
assert.match(missingCatalog.body.error, /did not include a catalog/);

const beforeInvalid = await fsp.readFile(catalogPath, "utf8");
result = await commit({ ...afterDelete, resources: [{ ...afterDelete.resources[0], filePath: "assets/resources/pdfs/../escape.pdf" }] });
assert.equal(result.response.status, 400);
assert.equal(await fsp.readFile(catalogPath, "utf8"), beforeInvalid, "invalid paths changed the canonical catalog");

result = await commit({ ...afterDelete, resources: [{ ...afterDelete.resources[0], filePath: "assets/resources/pdfs/missing.pdf" }] });
assert.equal(result.response.status, 400, "a published record without a real file was accepted");
assert.equal(await fsp.readFile(catalogPath, "utf8"), beforeInvalid, "missing published files changed the canonical catalog");

result = await commit({ ...afterDelete, resources: [afterDelete.resources[0], { ...afterDelete.resources[0], id: "local-guide", displayOrder: 2 }] });
assert.equal(result.response.status, 400);
assert.match(result.body.error, /duplicate resource id/);

const beforeSecurityChecks = await projectSnapshot();
for (const unsafePath of [
  "assets/resources/pdfs/file.pdf:private", "assets/resources/pdfs/CON.pdf", "assets/resources/pdfs/NUL.pdf",
  "assets/resources/pdfs/COM1.pdf", "assets/resources/pdfs/LPT9.pdf", "assets/resources/pdfs/file.pdf.",
  "assets/resources/pdfs/file.pdf ", "assets/resources/pdfs/file%3astream.pdf", "assets/resources/pdfs/../escape.pdf",
  "assets/resources/pdfs/nested/private.pdf", "assets/resources/covers/private.svg", "assets/resources/notes/private.js",
]) {
  result = await commit(afterDelete, [{ path: unsafePath, name: "safe.pdf", type: "application/pdf", base64: file("synthetic invalid") }]);
  assert.equal(result.response.status, 400, "unsafe unreferenced staged file was accepted");
}
result = await commit(afterDelete, [
  { path: "assets/resources/pdfs/extra.pdf", base64: file("a") },
  { path: "assets/resources/pdfs/EXTRA.PDF", base64: file("b") },
]);
assert.equal(result.response.status, 400);
assert.match(result.body.error, /Duplicate staged file/);
result = await commit(afterDelete, [{ path: publishedPdf.replace("local-guide", "LOCAL-GUIDE"), base64: file("a") }]);
assert.equal(result.response.status, 400);
assert.match(result.body.error, /path aliases/);
result = await commit({ ...afterDelete, resources: [{ ...afterDelete.resources[0], viewPath: publishedPdf.replace("local-guide", "LOCAL-GUIDE") }] });
assert.equal(result.response.status, 400);
assert.match(result.body.error, /path aliases/);
for (const [stagedPath, size] of [
  ["assets/resources/covers/oversize.png", 5 * 1024 * 1024 + 1],
  ["assets/resources/prompt-packs/oversize.md", 1024 * 1024 + 1],
  ["assets/resources/notes/oversize.txt", 1024 * 1024 + 1],
  ["assets/resources/pdfs/oversize.pdf", 20 * 1024 * 1024 + 1],
]) {
  result = await commit(afterDelete, [{ path: stagedPath, name: "small.txt", size: 1, base64: Buffer.alloc(size, 65).toString("base64") }]);
  assert.equal(result.response.status, 400, "unreferenced staged bytes bypassed folder-specific size limit");
  assert.match(result.body.error, /size limit/);
}
result = await commit({ ...afterDelete, resources: [{ ...afterDelete.resources[0], cover: "assets/resources/covers/oversize.png" }] }, [
  { path: "assets/resources/covers/oversize.png", size: 1, base64: Buffer.alloc(5 * 1024 * 1024 + 1, 65).toString("base64") },
]);
assert.equal(result.response.status, 400, "referenced cover bypassed actual image size limit");
for (const base64 of ["", "Zg", "Zh==", "not-base64!"]) {
  result = await commit(afterDelete, [{ path: "assets/resources/notes/empty.txt", base64 }]);
  assert.equal(result.response.status, 400);
}
assert.deepEqual(await projectSnapshot(), beforeSecurityChecks, "rejected staged files changed the project");

// Fail closed on nested unmanaged files and on root/ancestor junctions.
const nested = path.join(root, "public/assets/resources/notes/nested");
await fsp.mkdir(nested, { recursive: true });
await fsp.writeFile(path.join(nested, "private.md"), "synthetic nested draft");
result = await commit(afterDelete);
assert.equal(result.response.status, 400);
assert.match(result.body.error, /Unmanaged or nested/);
await fsp.rm(nested, { recursive: true });
await fsp.mkdir(path.join(root, "outside"));
await fsp.writeFile(path.join(root, "outside/sentinel.txt"), "synthetic external sentinel");
for (const relative of ["public/assets/resources", "public/assets/resources/pdfs", ".resource-studio/drafts"]) {
  const target = path.join(root, relative);
  const saved = `${target}-saved`;
  await fsp.rename(target, saved);
  try {
    await fsp.symlink(path.join(root, "outside"), target, process.platform === "win32" ? "junction" : "dir");
    result = await commit(afterDelete);
    assert.equal(result.response.status, 400);
    assert.match(result.body.error, /Symlinked/);
    assert.equal((await request("/api/state")).response.status, 400);
  } finally {
    await fsp.rm(target, { recursive: true, force: true });
    await fsp.rename(saved, target);
  }
}
assert.equal(await fsp.readFile(path.join(root, "outside/sentinel.txt"), "utf8"), "synthetic external sentinel");
assert.deepEqual(await projectSnapshot(), beforeSecurityChecks);

// Two tabs read the same revision; the second must not overwrite the first.
const sessionA = (await request("/api/state")).body;
const sessionB = (await request("/api/state")).body;
assert.match(sessionA.revision, /^[a-f0-9]{64}$/);
assert.equal(sessionA.revision, sessionB.revision);
await fsp.writeFile(catalogPath, JSON.stringify(JSON.parse(await fsp.readFile(catalogPath, "utf8"))));
assert.equal((await request("/api/state")).body.revision, sessionA.revision, "revision must hash normalized catalog, not JSON whitespace");
const sessionAEdit = { ...sessionA.catalog, resources: [{ ...sessionA.catalog.resources[0], title: "Session A edit" }] };
result = await commit(sessionAEdit, [], "save", null, { expectedRevision: sessionA.revision });
assert.equal(result.response.status, 200);
assert.notEqual(result.body.revision, sessionA.revision);
assert.equal((await request("/api/state")).body.revision, result.body.revision);
const afterSessionA = await projectSnapshot();
const backupsBeforeConflict = await fsp.readdir(path.join(root, ".resource-studio/backups"));
result = await commit(sessionB.catalog, [{ path: publishedPdf, base64: file("%PDF-stale-session") }], "save", null, { expectedRevision: sessionB.revision });
assert.equal(result.response.status, 409);
assert.deepEqual(await projectSnapshot(), afterSessionA);
assert.deepEqual(await fsp.readdir(path.join(root, ".resource-studio/backups")), backupsBeforeConflict, "revision conflict must fail before snapshot/writes");
const concurrent = (await request("/api/state")).body;
const racing = await Promise.all(["one", "two"].map((label) => commit({ ...concurrent.catalog, resources: [{ ...concurrent.catalog.resources[0], title: `Session ${label}` }] }, [], "save", null, { expectedRevision: concurrent.revision })));
assert.deepEqual(racing.map((entry) => entry.response.status).sort(), [200, 409]);
const winner = racing.find((entry) => entry.response.status === 200).body;
assert.equal((await request("/api/state")).body.revision, winner.revision);
result = await commit(winner.catalog, [], "save", null, { testOnlyAfterWrite: "after-assets" });
assert.equal(result.response.status, 200, "legacy clients should work without expectedRevision, and HTTP cannot inject faults");

const forbidden = await fetch(`${url}/api/session`);
assert.equal(forbidden.status, 403, "bridge accepted a request without the Studio origin");
await new Promise((resolve) => bridge.server.close(resolve));

restarted = await startBridge({ root, port: 0 });
const restartedPort = restarted.server.address().port;
const stateResponse = await fetch(`http://127.0.0.1:${restartedPort}/api/state`, { headers: { Origin: STUDIO_ORIGIN, Authorization: `Bearer ${restarted.token}` } });
const state = await stateResponse.json();
assert.equal(stateResponse.status, 200);
assert.equal(state.catalog.resources.length, 1, "catalog did not survive bridge restart");
assert.equal(state.revision, result.body.revision, "revision did not survive bridge restart");
await new Promise((resolve) => restarted.server.close(resolve));

} finally {
  for (const instance of [bridge, restarted]) {
    if (instance?.server.listening) await new Promise((resolve) => instance.server.close(resolve));
  }
  await fsp.rm(root, { recursive: true, force: true });
}
console.log("Local bridge smoke checks passed:");
console.log("- add, edit, publish, unpublish and delete flows persist in the project");
console.log("- drafts stay outside public/ and deletes create recoverable trash");
console.log("- duplicate IDs, traversal paths and missing origin are rejected");
console.log("- restart reads the canonical catalog without browser storage");
console.log("- injected mid-write faults restore asset bytes and absent manifests exactly");
console.log("- all staged files enforce Windows-safe paths, extensions and actual byte limits");
console.log("- managed root links/nested files fail closed; optional revisions prevent stale/racing saves");
