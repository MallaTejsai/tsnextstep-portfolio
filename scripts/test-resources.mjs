import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_CATEGORIES,
  isSafeRelativePath,
  reorderResources,
  toPublicCatalog,
  uniqueResourcePath,
  validateCatalog,
  validateUploadFile,
} from "../src/lib/resourceValidation.js";
import { createZip, decodeText, readZip } from "../tools/resource-studio/zip.js";
import { validateResources } from "./validate-resources.mjs";
import { verifyPublicOutput } from "./verify-public-output.mjs";

const catalog = {
  version: 3,
  categories: DEFAULT_CATEGORIES,
  resources: ["introduction", "part-1", "part-7"].map((id, index) => ({
    id, title: `Synthetic episode ${index + 1}`, kind: "episode", type: "external", categoryId: "ai", published: true, displayOrder: index + 1,
  })),
};
const exists = () => false;

const uploadCheck = validateUploadFile(new File(["%PDF-test"], "Guide.pdf", { type: "application/pdf" }));
assert.equal(uploadCheck.valid, true);
assert.equal(uniqueResourcePath("pdf", "Guide.pdf", [{ filePath: "assets/resources/pdfs/guide.pdf" }], {}), "assets/resources/pdfs/guide-2.pdf");
assert.equal(uniqueResourcePath("pdf", "Guide.pdf", [{ filePath: "assets/resources/pdfs/GUIDE.PDF" }], {}), "assets/resources/pdfs/guide-2.pdf");
assert.equal(reorderResources(catalog.resources, "part-7", "introduction")[0].id, "part-7");

const firstTestOrder = catalog.resources.length + 1;
const pdf = {
  id: "test-python-guide",
  kind: "pdf",
  type: "pdf",
  title: "Test Python Guide",
  description: "A validation-only PDF record.",
  categoryId: "guides",
  tags: ["Python"],
  filePath: "assets/resources/pdfs/test-python-guide.pdf",
  fileSize: 1200,
  mimeType: "application/pdf",
  published: true,
  featured: false,
  displayOrder: firstTestOrder,
};

const prompt = {
  id: "test-debug-prompt",
  kind: "prompt",
  type: "prompt",
  title: "Test Debug Prompt",
  description: "A validation-only prompt record.",
  categoryId: "prompts",
  tags: ["debugging"],
  promptText: "Explain this error and suggest a small next step.",
  filePath: "assets/resources/prompt-packs/test-debug-prompt.md",
  fileSize: 80,
  mimeType: "text/markdown",
  published: false,
  featured: false,
  displayOrder: firstTestOrder + 1,
};

const draft = {
  ...catalog,
  resources: [...catalog.resources, pdf, prompt],
};
const result = validateCatalog(draft, {
  fileExists: (relativePath) => exists(relativePath) || relativePath === pdf.filePath || relativePath === prompt.filePath,
});
assert.equal(result.valid, true, result.errors.join("\n"));

const publicCatalog = toPublicCatalog(draft);
assert.equal(publicCatalog.resources.some((resource) => resource.id === pdf.id), true);
assert.equal(publicCatalog.resources.some((resource) => resource.id === prompt.id), false, "unpublished prompt leaked into public catalog");

const duplicate = validateCatalog({ ...draft, resources: [...draft.resources, { ...prompt, id: "part-1", displayOrder: firstTestOrder + 2 }] });
assert.equal(duplicate.valid, false);
assert.match(duplicate.errors.join(" "), /duplicate resource id/);

const duplicateOrder = validateCatalog({ ...draft, resources: [...draft.resources, { ...prompt, id: "duplicate-order", displayOrder: firstTestOrder }] });
assert.equal(duplicateOrder.valid, false);
assert.match(duplicateOrder.errors.join(" "), /display order .* already used/);

const missingOrder = validateCatalog({ ...draft, resources: [...draft.resources, { ...prompt, id: "missing-order", displayOrder: undefined }] });
assert.equal(missingOrder.valid, false);
assert.match(missingOrder.errors.join(" "), /display order must be a positive whole number/);

const unsafe = validateCatalog({ ...draft, resources: [...catalog.resources, { ...pdf, id: "unsafe-path", displayOrder: firstTestOrder, filePath: "assets/resources/pdfs/../secret.pdf" }] });
assert.equal(unsafe.valid, false);
assert.match(unsafe.errors.join(" "), /file path must stay/);

const missing = validateCatalog({ ...draft, resources: [...catalog.resources, { ...pdf, id: "missing-file", displayOrder: firstTestOrder + 2, filePath: "assets/resources/pdfs/missing.pdf" }] }, { fileExists: exists });
assert.equal(missing.valid, false);
assert.match(missing.errors.join(" "), /is missing/);

const draftMissing = validateCatalog({ ...catalog, resources: [...catalog.resources, { ...prompt, id: "missing-draft-file", displayOrder: firstTestOrder, filePath: "assets/resources/prompt-packs/missing-draft.md" }] }, { fileExists: exists });
assert.equal(draftMissing.valid, true, draftMissing.errors.join("\n"));
assert.match(draftMissing.warnings.join(" "), /draft file .* is not staged/);

const zip = await createZip([
  { name: "resource-package-manifest.json", data: "{\"ok\":true}" },
  { name: "public/assets/resources/pdfs/test.pdf", data: new Uint8Array([37, 80, 68, 70]) },
]);
const files = await readZip(zip);
assert.equal(decodeText(files.get("resource-package-manifest.json")), "{\"ok\":true}");
assert.deepEqual([...files.get("public/assets/resources/pdfs/test.pdf")], [37, 80, 68, 70]);
await assert.rejects(
  () => createZip([{ name: "../escape.txt", data: "nope" }]),
  /Unsafe ZIP entry name/,
  "ZIP export accepted a traversal entry"
);

const unsafePaths = [
  "../escape.txt", "/absolute.txt", "a\\escape.txt", "a//file.txt", "a/./file.txt",
  "a/file.pdf:private", "a/file.pdf::$DATA", "a/CON.pdf", "a/nUl", "a/PRN.txt", "a/AUX.md",
  "a/COM1.txt", "a/lpt9.pdf", "a/COM¹.txt", "a/CONIN$.txt", "a/CONOUT$.txt", "a/CON .pdf", "a/CLOCK$.txt",
  "a/name. /file.txt", "a/name./file.txt", "a/file.txt ", "a/file.txt.", "a/FILENA~1.PDF",
  "a/%2e%2e/file.txt", "a/file%3astream.txt", "a/file%252e.txt", "a/file?.txt", "a/file\u0000.txt",
];
async function renameZipEntry(blob, before, after) {
  assert.equal(Buffer.byteLength(before), Buffer.byteLength(after));
  const bytes = Buffer.from(await blob.arrayBuffer());
  let offset = 0;
  let replacements = 0;
  while ((offset = bytes.indexOf(before, offset)) !== -1) {
    bytes.write(after, offset, "utf8");
    offset += Buffer.byteLength(after);
    replacements += 1;
  }
  assert.equal(replacements, 2, "synthetic ZIP mutation did not update both headers");
  return new Blob([bytes]);
}
for (const unsafePath of unsafePaths) {
  assert.equal(isSafeRelativePath(unsafePath), false, "unsafe synthetic path was accepted");
  await assert.rejects(() => createZip([{ name: unsafePath, data: "fixture" }]), /Unsafe ZIP entry name/);
  const placeholder = "x".repeat(Buffer.byteLength(unsafePath));
  const validZip = await createZip([{ name: placeholder, data: "fixture" }]);
  await assert.rejects(() => readZipFromRenamed(validZip, placeholder, unsafePath), /Unsafe path/);
}
async function readZipFromRenamed(blob, before, after) {
  return readZip(await renameZipEntry(blob, before, after));
}
await assert.rejects(() => createZip([{ name: "Guide.pdf", data: "a" }, { name: "GUIDE.PDF", data: "b" }]), /duplicate entry/);
await assert.rejects(() => createZip([{ name: "σ.pdf", data: "a" }, { name: "ς.pdf", data: "b" }]), /duplicate entry/);
const duplicateZip = await createZip([{ name: "Guide.pdf", data: "a" }, { name: "Other.pdf", data: "b" }]);
await assert.rejects(() => readZipFromRenamed(duplicateZip, "Other.pdf", "GUIDE.PDF"), /duplicate entry/);
const badChecksum = Buffer.from(await zip.arrayBuffer());
badChecksum[30 + Buffer.byteLength("resource-package-manifest.json")] ^= 1;
await assert.rejects(() => readZip(new Blob([badChecksum])), /checksum/);
const symlinkZip = Buffer.from(await zip.arrayBuffer());
const centralOffset = symlinkZip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
symlinkZip.writeUInt32LE((0xa1ff << 16) >>> 0, centralOffset + 38);
await assert.rejects(() => readZip(new Blob([symlinkZip])), /central directory verification/);

for (const field of ["filePath", "cover", "viewPath"]) {
  const filePath = field === "cover" ? "assets/resources/covers/guide.png" : pdf.filePath;
  const first = { ...pdf, displayOrder: 1, [field]: filePath };
  const second = { ...first, id: "alias-resource", displayOrder: 2, [field]: filePath.replace(/[^/]+$/, (name) => name.toUpperCase()) };
  const aliases = validateCatalog({ ...catalog, resources: [first, second] });
  assert.equal(aliases.valid, false);
  assert.match(aliases.errors.join(" "), /path aliases/);
}
const sharedPath = validateCatalog({ ...catalog, resources: [{ ...pdf, displayOrder: 1, viewPath: pdf.filePath }] });
assert.equal(sharedPath.valid, true, "exact shared references should remain valid");
for (const field of ["filePath", "cover", "viewPath"]) {
  const invalid = validateCatalog({ ...catalog, resources: [{ ...pdf, displayOrder: 1, [field]: "assets/resources/pdfs/NUL.pdf" }] });
  assert.equal(invalid.valid, false);
}

// Exercise the actual build guard and output verifier in a synthetic project.
// No Vite build or production catalog is read or written by this suite.
const fixture = await fsp.mkdtemp(path.join(os.tmpdir(), "resource-privacy-"));
async function write(relative, content) {
  await fsp.mkdir(path.dirname(path.join(fixture, relative)), { recursive: true });
  await fsp.writeFile(path.join(fixture, relative), content);
}
const testCatalog = {
  ...catalog,
  resources: [
    { ...pdf, displayOrder: 1, cover: "assets/resources/covers/guide.png", viewPath: "assets/resources/notes/view.md" },
    { ...prompt, displayOrder: 2, promptText: "Synthetic unpublished marker 4c98e7." },
  ],
};
try {
  await write("src/data/resourceCatalog.json", JSON.stringify(testCatalog));
  await write(`public/${pdf.filePath}`, "%PDF-fixture");
  await write("public/assets/resources/covers/guide.png", "synthetic image bytes");
  await write("public/assets/resources/notes/view.md", "synthetic view");
  await write(`public/${prompt.filePath}`, "synthetic stale draft bytes");
  await write("public/assets/resources/notes/nested/private.md", "synthetic nested private bytes");
  await assert.rejects(() => validateResources(fixture), /nested resource directory/);
  assert.equal(await fsp.access(path.join(fixture, "src/data/resourceCatalog.public.json")).then(() => true, () => false), false, "failed preflight wrote a manifest");
  await fsp.rm(path.join(fixture, "public/assets/resources/notes/nested"), { recursive: true });
  for (const patch of [
    { filePath: "assets/resources/pdfs/../escape.pdf" },
    { filePath: "assets/resources/pdfs/file.pdf:stream" },
    { filePath: "assets/resources/pdfs/CON.pdf" },
    { filePath: pdf.filePath.replace("test-python-guide", "TEST-PYTHON-GUIDE") },
    { cover: "assets/resources/covers/missing.png" },
    { viewPath: "assets/resources/notes/missing.md" },
  ]) {
    await write("src/data/resourceCatalog.json", JSON.stringify({ ...testCatalog, resources: [{ ...testCatalog.resources[0], ...patch }, testCatalog.resources[1]] }));
    await assert.rejects(() => validateResources(fixture), /validation failed|path aliases/);
  }
  await write("src/data/resourceCatalog.json", JSON.stringify(testCatalog));
  const prepared = await validateResources(fixture);
  assert.deepEqual(prepared.staleFiles, [prompt.filePath]);
  assert.equal(await fsp.readFile(path.join(fixture, prepared.recovery, "public", prompt.filePath), "utf8"), "synthetic stale draft bytes");
  await fsp.cp(path.join(fixture, "public"), path.join(fixture, "dist"), { recursive: true });
  await write("dist/index.html", "<html>synthetic public output</html>");
  assert.equal((await verifyPublicOutput(fixture)).publicResourceCount, 1);

  for (const reference of [pdf.filePath, testCatalog.resources[0].cover, testCatalog.resources[0].viewPath]) {
    const absolute = path.join(fixture, "dist", reference);
    const saved = await fsp.readFile(absolute);
    await fsp.rm(absolute);
    await assert.rejects(() => verifyPublicOutput(fixture), /reference is missing/);
    await fsp.writeFile(absolute, saved);
  }
  const manifestPath = "dist/assets/resources/resources.json";
  const manifest = toPublicCatalog(testCatalog);
  await write(manifestPath, JSON.stringify({ ...manifest, resources: [{ ...manifest.resources[0], description: "altered metadata, same ID" }] }));
  await assert.rejects(() => verifyPublicOutput(fixture), /Full production manifest/);
  await write(manifestPath, JSON.stringify(manifest));
  const generatedPath = "src/data/resourceCatalog.public.json";
  await write(generatedPath, JSON.stringify({ ...manifest, downloads: [] }));
  await assert.rejects(() => verifyPublicOutput(fixture), /Full source public catalog/);
  await write(generatedPath, JSON.stringify(manifest));
  for (const relative of ["assets/resources/notes/orphan.md", "assets/resources/notes/nested/private.md", "assets/resources/unmanaged/private.md", ".resource-studio/private.md"]) {
    await write(`dist/${relative}`, "synthetic orphan");
    await assert.rejects(() => verifyPublicOutput(fixture), /Unreferenced|nested|Private/);
    await fsp.rm(path.join(fixture, "dist", relative));
    if (relative.includes("nested/")) await fsp.rmdir(path.join(fixture, "dist/assets/resources/notes/nested"));
    if (relative.includes("unmanaged/")) await fsp.rmdir(path.join(fixture, "dist/assets/resources/unmanaged"));
    if (relative.startsWith(".resource-studio/")) await fsp.rmdir(path.join(fixture, "dist/.resource-studio"));
  }
  for (const leaked of [prompt.filePath, testCatalog.resources[1].promptText]) {
    await write("dist/index.html", leaked);
    await assert.rejects(() => verifyPublicOutput(fixture), /Unpublished resource data/);
  }
  await write("dist/index.html", "synthetic public output");

  // Junctions exercise root/ancestor link rejection on Windows without requiring
  // file-symlink privileges. Other platforms use directory symlinks.
  await write("outside/keep.txt", "synthetic external sentinel");
  for (const relative of ["public/assets/resources", "public/assets/resources/pdfs", "dist/assets/resources", "dist/assets/resources/pdfs"]) {
    const target = path.join(fixture, relative);
    const saved = `${target}-saved`;
    await fsp.rename(target, saved);
    try {
      await fsp.symlink(path.join(fixture, "outside"), target, process.platform === "win32" ? "junction" : "dir");
      await assert.rejects(() => relative.startsWith("dist/") ? verifyPublicOutput(fixture) : validateResources(fixture), /Symlinked/);
    } finally {
      await fsp.rm(target, { recursive: true, force: true });
      await fsp.rename(saved, target);
    }
  }
  assert.equal(await fsp.readFile(path.join(fixture, "outside/keep.txt"), "utf8"), "synthetic external sentinel");

  await write("public/assets/resources/notes/stale.md", "synthetic stale file");
  const recoveryRoot = path.join(fixture, ".resource-studio");
  await fsp.rename(recoveryRoot, `${recoveryRoot}-saved`);
  try {
    await fsp.symlink(path.join(fixture, "outside"), recoveryRoot, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(() => validateResources(fixture), /Symlinked/);
    assert.equal(await fsp.readFile(path.join(fixture, "public/assets/resources/notes/stale.md"), "utf8"), "synthetic stale file");
  } finally {
    await fsp.rm(recoveryRoot, { recursive: true, force: true });
    await fsp.rename(`${recoveryRoot}-saved`, recoveryRoot);
    await fsp.rm(path.join(fixture, "public/assets/resources/notes/stale.md"));
  }
  await verifyPublicOutput(fixture);
} finally {
  await fsp.rm(fixture, { recursive: true, force: true });
}

console.log("Resource validation smoke checks passed:");
console.log("- PDF and prompt records validate");
console.log("- unpublished records stay out of the public catalog");
console.log("- duplicate IDs/orders, unsafe paths and missing files fail");
console.log("- package ZIP export/import round-trip works");
console.log("- Windows names, ADS, path aliases, ZIP checksums and symlink entries are rejected");
console.log("- synthetic build guards recover stale files and reject nested files/root symlinks");
console.log("- full output manifests, all references, orphan files and private-data leaks are checked");
