import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import catalog from "../src/data/resourceCatalog.json" with { type: "json" };
import {
  reorderResources,
  toPublicCatalog,
  uniqueResourcePath,
  validateCatalog,
  validateUploadFile,
} from "../src/lib/resourceValidation.js";
import { createZip, decodeText, readZip } from "../tools/resource-studio/zip.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const exists = (relativePath) => fs.existsSync(path.join(publicRoot, ...relativePath.split("/")));

const uploadCheck = validateUploadFile(new File(["%PDF-test"], "Guide.pdf", { type: "application/pdf" }));
assert.equal(uploadCheck.valid, true);
assert.equal(uniqueResourcePath("pdf", "Guide.pdf", [{ filePath: "assets/resources/pdfs/guide.pdf" }], {}), "assets/resources/pdfs/guide-2.pdf");
assert.equal(reorderResources(catalog.resources, "part-7", "introduction")[0].id, "part-7");

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
  displayOrder: 9,
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
  displayOrder: 10,
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

const duplicate = validateCatalog({ ...draft, resources: [...draft.resources, { ...prompt, id: "part-1", displayOrder: 11 }] });
assert.equal(duplicate.valid, false);
assert.match(duplicate.errors.join(" "), /duplicate resource id/);

const unsafe = validateCatalog({ ...draft, resources: [...catalog.resources, { ...pdf, id: "unsafe-path", displayOrder: 9, filePath: "assets/resources/pdfs/../secret.pdf" }] });
assert.equal(unsafe.valid, false);
assert.match(unsafe.errors.join(" "), /file path must stay/);

const missing = validateCatalog({ ...draft, resources: [...catalog.resources, { ...pdf, id: "missing-file", displayOrder: 9, filePath: "assets/resources/pdfs/missing.pdf" }] }, { fileExists: exists });
assert.equal(missing.valid, false);
assert.match(missing.errors.join(" "), /is missing/);

const zip = await createZip([
  { name: "resource-package-manifest.json", data: "{\"ok\":true}" },
  { name: "public/assets/resources/pdfs/test.pdf", data: new Uint8Array([37, 80, 68, 70]) },
]);
const files = await readZip(zip);
assert.equal(decodeText(files.get("resource-package-manifest.json")), "{\"ok\":true}");
assert.deepEqual([...files.get("public/assets/resources/pdfs/test.pdf")], [37, 80, 68, 70]);

console.log("Resource validation smoke checks passed:");
console.log("- PDF and prompt records validate");
console.log("- unpublished records stay out of the public catalog");
console.log("- duplicate IDs, unsafe paths and missing files fail");
console.log("- package ZIP export/import round-trip works");
