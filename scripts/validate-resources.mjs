import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertNoPathAliases, isAllowedFilePath, isSafeRelativePath, resourceFileRule, toPublicCatalog, validateCatalog } from "../src/lib/resourceValidation.js";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const managedFolders = ["pdfs", "prompt-packs", "covers", "notes"];

// lstat every component (including managed roots and dangling links), and
// require exact spelling even on Windows. Never follow a link to test existence.
export function inspectProjectPath(root, relativePath) {
  if (!isSafeRelativePath(relativePath)) throw new Error("Unsafe project-relative path.");
  root = path.resolve(root);
  const candidate = path.resolve(root, relativePath);
  if (!candidate.startsWith(`${root}${path.sep}`)) throw new Error("Path escapes the project root.");
  const volume = path.parse(root).root;
  let current = volume;
  const parts = path.relative(volume, candidate).split(path.sep);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const parent = current;
    current = path.join(current, part);
    let stats;
    try { stats = fs.lstatSync(current); } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (stats.isSymbolicLink()) throw new Error("Symlinked project paths are not permitted.");
    if (parent === root || parent.startsWith(`${root}${path.sep}`)) {
      if (!fs.readdirSync(parent).includes(part)) throw new Error("Case-insensitive project path aliases are not permitted.");
    }
    if (index < parts.length - 1 && !stats.isDirectory()) throw new Error("A project path parent is not a directory.");
    if (index === parts.length - 1) return stats;
  }
  return null;
}

export async function managedResourceFiles(root, base = "public") {
  const prefix = `${base}/assets/resources`;
  const rootStats = inspectProjectPath(root, prefix);
  if (!rootStats) return [];
  if (!rootStats.isDirectory()) throw new Error("Managed resource root is not a directory.");
  const files = [];
  async function visit(relativeDirectory, folder = null) {
    for (const name of await fsp.readdir(path.join(root, relativeDirectory))) {
      const relative = `${relativeDirectory}/${name}`;
      const stats = inspectProjectPath(root, relative);
      if (stats?.isDirectory()) {
        if (folder !== null || !managedFolders.includes(name)) throw new Error("Unmanaged or nested resource directory must be moved to private recovery before building.");
        await visit(relative, name);
      } else if (stats?.isFile()) {
        if (name === ".gitkeep" || (folder === null && ["README.md", "resources.json"].includes(name))) continue;
        const resourcePath = relative.slice(base.length + 1);
        if (!isAllowedFilePath(resourcePath)) throw new Error("Unmanaged resource file must be moved to private recovery before building.");
        files.push(resourcePath);
      } else throw new Error("Managed resources must be regular files.");
    }
  }
  await visit(prefix);
  assertNoPathAliases(files);
  return files;
}

async function ensureDirectory(root, relative) {
  const stats = inspectProjectPath(root, relative);
  if (stats && !stats.isDirectory()) throw new Error("Generated output parent is not a directory.");
  await fsp.mkdir(path.join(root, relative), { recursive: true });
  inspectProjectPath(root, relative);
}

async function writeJsonAtomic(root, relative, value) {
  const stats = inspectProjectPath(root, relative);
  if (stats && !stats.isFile()) throw new Error("Generated manifest is not a regular file.");
  const filePath = path.join(root, relative);
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(5).toString("hex")}`;
  try {
    await fsp.writeFile(temporaryPath, value, { encoding: "utf8", flag: "wx" });
    await fsp.rename(temporaryPath, filePath).catch(async (error) => {
      if (!["EEXIST", "EPERM"].includes(error?.code)) throw error;
      await fsp.rm(filePath, { force: true });
      await fsp.rename(temporaryPath, filePath);
    });
  } finally {
    await fsp.rm(temporaryPath, { force: true });
  }
}

// Importable for synthetic integration checks; importing never touches the repo.
export async function validateResources(root = defaultRoot) {
  root = path.resolve(root);
  const authoringPath = "src/data/resourceCatalog.json";
  const generatedPath = "src/data/resourceCatalog.public.json";
  const publicManifestPath = "public/assets/resources/resources.json";
  if (!inspectProjectPath(root, authoringPath)?.isFile()) throw new Error("The authoring catalog is missing.");
  const catalog = JSON.parse(await fsp.readFile(path.join(root, authoringPath), "utf8"));
  const inventory = await managedResourceFiles(root);
  const references = (catalog.resources || []).flatMap((resource) => [resource.filePath, resource.cover, resource.viewPath]).filter(Boolean);
  assertNoPathAliases([...inventory, ...references]);
  const result = validateCatalog(catalog, {
    fileExists: (relative) => isSafeRelativePath(relative) && Boolean(inspectProjectPath(root, `public/${relative}`)?.isFile()),
  });
  if (!result.valid) throw new Error(`Resource catalog validation failed (${result.errors.length} errors).`);

  const publicCatalog = toPublicCatalog(result.catalog);
  const referenced = new Set(publicCatalog.resources.flatMap((resource) => [resource.filePath, resource.cover, resource.viewPath]).filter(isAllowedFilePath));
  for (const relative of referenced) {
    const stats = inspectProjectPath(root, `public/${relative}`);
    if (!stats?.isFile() || !stats.size || stats.size > resourceFileRule(relative).maxBytes) throw new Error("Published resource is missing, empty or exceeds its size limit.");
  }

  // Preflight the entire managed tree before any writes. Unknown/nested files
  // fail closed; safe flat stale files retain the existing recovery behavior.
  for (const relative of [generatedPath, publicManifestPath]) {
    const stats = inspectProjectPath(root, relative);
    if (stats && !stats.isFile()) throw new Error("Generated manifest is not a regular file.");
  }
  const staleFiles = inventory.filter((relative) => !referenced.has(relative));
  const recovery = `.resource-studio/trash/validate-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(4).toString("hex")}`;
  for (const relative of staleFiles) {
    const destination = `${recovery}/public/${relative}`;
    await ensureDirectory(root, path.posix.dirname(destination));
    await fsp.rename(path.join(root, "public", relative), path.join(root, destination));
  }
  const json = `${JSON.stringify(publicCatalog, null, 2)}\n`;
  await ensureDirectory(root, "src/data");
  await ensureDirectory(root, "public/assets/resources");
  await writeJsonAtomic(root, generatedPath, json);
  await writeJsonAtomic(root, publicManifestPath, json);
  return { catalog: result.catalog, publicCatalog, staleFiles, recovery: staleFiles.length ? recovery : null, warningCount: result.warnings.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await validateResources();
    console.log(`Validated ${result.catalog.resources.length} resource records; prepared ${result.publicCatalog.resources.length} published resources.`);
    console.log("Generated src/data/resourceCatalog.public.json and public/assets/resources/resources.json.");
    if (result.warningCount) console.warn(`Resource catalog has ${result.warningCount} draft warnings; inspect them locally in Studio.`);
    if (result.staleFiles.length) console.log(`Moved ${result.staleFiles.length} stale public files to .resource-studio/trash for recovery.`);
  } catch {
    console.error("Resource validation failed. Check catalog references, managed paths and file limits locally; public output was not approved.");
    process.exitCode = 1;
  }
}
