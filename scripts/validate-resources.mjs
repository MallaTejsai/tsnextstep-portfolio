import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { toPublicCatalog, validateCatalog } from "../src/lib/resourceValidation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const authoringPath = path.join(root, "src", "data", "resourceCatalog.json");
const generatedPath = path.join(root, "src", "data", "resourceCatalog.public.json");
const publicManifestPath = path.join(root, "public", "assets", "resources", "resources.json");
const publicRoot = path.join(root, "public");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function publicFileExists(relativePath) {
  return fs.existsSync(path.join(publicRoot, ...relativePath.split("/")));
}

const catalog = readJson(authoringPath);
const result = validateCatalog(catalog, { fileExists: publicFileExists });

if (!result.valid) {
  console.error("Resource catalog validation failed:");
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

if (result.warnings.length) {
  console.warn("Resource catalog warnings:");
  result.warnings.forEach((warning) => console.warn(`- ${warning}`));
}

const publicCatalog = toPublicCatalog(result.catalog);
const json = `${JSON.stringify(publicCatalog, null, 2)}\n`;

fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
fs.mkdirSync(path.dirname(publicManifestPath), { recursive: true });
fs.writeFileSync(generatedPath, json);
fs.writeFileSync(publicManifestPath, json);

console.log(`Validated ${result.catalog.resources.length} resource records.`);
console.log(`Prepared ${publicCatalog.resources.length} published resources.`);
console.log(`Generated ${path.relative(root, generatedPath)} and ${path.relative(root, publicManifestPath)}.`);
