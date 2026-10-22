import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { isAllowedCoverPath, isAllowedFilePath, toPublicCatalog, validateCatalog } from "../src/lib/resourceValidation.js";
import { inspectProjectPath, managedResourceFiles } from "./validate-resources.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function requireCheck(condition, message) {
  // Do not include catalogs, prompt text, filenames or file bytes in failures.
  if (!condition) throw new Error(message);
}

async function readJson(root, relative) {
  requireCheck(inspectProjectPath(root, relative)?.isFile(), "A required catalog manifest is missing.");
  return JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));
}

async function filesIn(root, relativeDirectory) {
  requireCheck(inspectProjectPath(root, relativeDirectory)?.isDirectory(), "The output directory is missing.");
  const files = [];
  for (const name of await fs.readdir(path.join(root, relativeDirectory))) {
    requireCheck(name.toLowerCase() !== ".resource-studio", "Private Resource Studio output shipped in dist/.");
    const relative = `${relativeDirectory}/${name}`;
    const stats = inspectProjectPath(root, relative);
    if (stats?.isDirectory()) files.push(...await filesIn(root, relative));
    else {
      requireCheck(stats?.isFile(), "Output contains a non-regular file.");
      files.push(relative);
    }
  }
  return files;
}

export async function verifyPublicOutput(root = defaultRoot) {
  root = path.resolve(root);
  const authoringCatalog = await readJson(root, "src/data/resourceCatalog.json");
  requireCheck(validateCatalog(authoringCatalog).valid, "Authoring catalog validation failed.");
  const expected = toPublicCatalog(authoringCatalog);
  const generatedCatalog = await readJson(root, "src/data/resourceCatalog.public.json");
  const distManifest = await readJson(root, "dist/assets/resources/resources.json");
  requireCheck(isDeepStrictEqual(generatedCatalog, expected), "Full source public catalog is out of sync.");
  requireCheck(isDeepStrictEqual(distManifest, expected), "Full production manifest is out of sync.");

  const publicReferences = new Set();
  for (const resource of expected.resources) {
    for (const value of [resource.filePath, resource.cover, resource.viewPath].filter(Boolean)) {
      requireCheck(isAllowedFilePath(value) || isAllowedCoverPath(value), "Public manifest has an unsafe local reference.");
      publicReferences.add(value);
      requireCheck(inspectProjectPath(root, `dist/${value}`)?.isFile(), "Public manifest reference is missing from dist/.");
    }
  }

  const outputFiles = await filesIn(root, "dist");
  const privateReferences = new Set();
  const publicText = JSON.stringify(expected);
  const privateText = new Set();
  for (const resource of authoringCatalog.resources) {
    if (resource.published) continue;
    for (const value of [resource.filePath, resource.cover, resource.viewPath].filter(Boolean)) {
      if (publicReferences.has(value)) continue;
      requireCheck(!inspectProjectPath(root, `dist/${value}`), "Unpublished resource leaked into dist/.");
      privateReferences.add(value);
    }
    if (resource.promptText && !publicText.includes(resource.promptText)) privateText.add(resource.promptText);
  }
  const needles = [...privateReferences, ...privateText].map((value) => Buffer.from(value, "utf8"));
  for (const relative of outputFiles) {
    const content = await fs.readFile(path.join(root, relative));
    requireCheck(!needles.some((needle) => content.includes(needle)), "Unpublished resource data leaked into dist/.");
  }
  for (const relative of await managedResourceFiles(root, "dist")) {
    requireCheck(publicReferences.has(relative), "Unreferenced managed resource shipped in dist/.");
  }
  return { publicResourceCount: expected.resources.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyPublicOutput();
    console.log(`Production public-output privacy check passed for ${result.publicResourceCount} published records.`);
    console.log("- full manifests match, all local references exist, and no orphan managed or private Studio output ships");
  } catch {
    console.error("Production public-output privacy check failed. Inspect manifests, references and managed output locally.");
    process.exitCode = 1;
  }
}
