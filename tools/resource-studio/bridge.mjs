import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertNoPathAliases,
  isAllowedCoverPath,
  isAllowedFilePath,
  isAllowedFilePathForKind,
  normalizeCatalog,
  resourceFileRule,
  resourcePathKey,
  toPublicCatalog,
  validateCatalog,
} from "../../src/lib/resourceValidation.js";

export const DEFAULT_BRIDGE_PORT = 4175;
export const STUDIO_ORIGIN = "http://127.0.0.1:4174";

const CATALOG_RELATIVE_PATH = "src/data/resourceCatalog.json";
const PUBLIC_CATALOG_RELATIVE_PATH = "src/data/resourceCatalog.public.json";
const PUBLIC_MANIFEST_RELATIVE_PATH = "public/assets/resources/resources.json";
const MANAGED_RESOURCE_ROOT = "public/assets/resources";
const PRIVATE_ROOT = ".resource-studio";
const DRAFT_ROOT = `${PRIVATE_ROOT}/drafts`;
const BACKUP_ROOT = `${PRIVATE_ROOT}/backups`;
const TRASH_ROOT = `${PRIVATE_ROOT}/trash`;
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 128;
const MAX_STATE_BYTES = 48 * 1024 * 1024;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function catalogRevision(catalog) {
  return crypto.createHash("sha256").update(JSON.stringify(normalizeCatalog(catalog))).digest("hex");
}

function relativePathForLog(value) {
  return path.relative(process.cwd(), value).replaceAll(path.sep, "/");
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeResourcePath(relativePath) {
  if (!isAllowedFilePath(relativePath)) throw new Error(`Unsafe resource path rejected: ${relativePath || "(empty)"}`);
  if (relativePath.length > 240) throw new Error("Resource file names must be 240 characters or fewer.");
}

function resolveRepositoryPath(root, relativePath) {
  const normalized = String(relativePath || "").replaceAll("/", path.sep);
  const candidate = path.resolve(root, normalized);
  if (!isInside(root, candidate)) throw new Error("The requested path is outside the local project.");
  return candidate;
}

async function assertNoSymlink(root, candidate) {
  if (!isInside(root, candidate)) throw new Error("The requested path is outside the local project.");
  const relative = path.relative(root, candidate);
  const parts = relative ? relative.split(path.sep) : [];
  let current = root;
  for (const part of ["", ...parts]) {
    current = path.join(current, part);
    try {
      if ((await fsp.lstat(current)).isSymbolicLink()) throw new Error(`Symlinked paths are not permitted: ${part}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      break;
    }
  }
}

async function ensureDirectory(directory) {
  await assertNoSymlink(path.parse(directory).root, directory);
  await fsp.mkdir(directory, { recursive: true });
  await assertNoSymlink(path.parse(directory).root, directory);
}

async function pathExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertRegularFile(filePath, label = "File") {
  await assertNoSymlink(path.parse(filePath).root, filePath);
  let stats;
  try {
    stats = await fsp.lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (!stats.isFile()) throw new Error(`${label} is not a regular file: ${filePath}`);
  return true;
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
}

async function writeAtomic(filePath, data) {
  await ensureDirectory(path.dirname(filePath));
  await assertRegularFile(filePath, "Atomic write target");
  const tempPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(5).toString("hex")}`;
  try {
    await fsp.writeFile(tempPath, data, { flag: "wx" });
    await fsp.rename(tempPath, filePath).catch(async (error) => {
      if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error;
      await fsp.rm(filePath, { force: true });
      await fsp.rename(tempPath, filePath);
    });
  } finally {
    await fsp.rm(tempPath, { force: true });
  }
}

async function listFiles(directory) {
  await assertNoSymlink(path.parse(directory).root, directory);
  if (!(await pathExists(directory))) return [];
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    const stats = await fsp.lstat(child);
    if (stats.isSymbolicLink()) throw new Error(`Symlinked resource files are not permitted: ${child}`);
    if (stats.isDirectory()) files.push(...await listFiles(child));
    else if (stats.isFile()) files.push(child);
    else throw new Error("Managed resources must be regular files.");
  }
  return files;
}

async function listManagedPublicFiles(root) {
  const directory = resolveRepositoryPath(root, MANAGED_RESOURCE_ROOT);
  await assertNoSymlink(root, directory);
  const files = await listFiles(directory);
  const managed = [];
  for (const filePath of files) {
    const relative = pathFromPublicAbsolute(root, filePath);
    if (/^assets\/resources\/(?:README\.md|resources\.json|\.gitkeep)$/.test(relative) || /^assets\/resources\/(?:pdfs|prompt-packs|covers|notes)\/\.gitkeep$/.test(relative)) continue;
    if (!isAllowedFilePath(relative)) throw new Error("Unmanaged or nested files in public/assets/resources must be moved to private recovery before saving.");
    managed.push(filePath);
  }
  assertNoPathAliases(managed.map((filePath) => pathFromPublicAbsolute(root, filePath)));
  return managed;
}

async function listDraftFiles(root) {
  const directory = resolveRepositoryPath(root, DRAFT_ROOT);
  await assertNoSymlink(root, directory);
  const files = await listFiles(directory);
  const paths = files.map((filePath) => pathFromDraftAbsolute(root, filePath));
  if (paths.some((value) => !isAllowedFilePath(value))) throw new Error("Unmanaged files in the private draft directory must be moved to recovery before saving.");
  assertNoPathAliases(paths);
  return files;
}

function publicPathFor(root, relativePath) {
  assertSafeResourcePath(relativePath);
  return resolveRepositoryPath(root, `public/${relativePath}`);
}

function draftPathFor(root, relativePath) {
  assertSafeResourcePath(relativePath);
  return resolveRepositoryPath(root, `${DRAFT_ROOT}/${relativePath}`);
}

function pathFromPublicAbsolute(root, absolutePath) {
  const publicRoot = resolveRepositoryPath(root, "public");
  const relative = path.relative(publicRoot, absolutePath).replaceAll(path.sep, "/");
  return relative;
}

function pathFromDraftAbsolute(root, absolutePath) {
  const draftRoot = resolveRepositoryPath(root, DRAFT_ROOT);
  return path.relative(draftRoot, absolutePath).replaceAll(path.sep, "/");
}

function decodeIncomingFiles(input) {
  if (input == null) return new Map();
  if (!Array.isArray(input)) throw new Error("Staged files must be an array.");
  if (input.length > MAX_FILES_PER_REQUEST) throw new Error(`A save may contain at most ${MAX_FILES_PER_REQUEST} files.`);
  const files = new Map();
  const identities = new Set();
  for (const item of input) {
    const relativePath = String(item?.path || "");
    assertSafeResourcePath(relativePath);
    const identity = resourcePathKey(relativePath);
    if (identities.has(identity)) throw new Error("Duplicate staged file path or case-insensitive alias.");
    if (typeof item?.base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(item.base64)) {
      throw new Error(`Invalid encoded content for ${relativePath}.`);
    }
    const data = Buffer.from(item.base64, "base64");
    if (data.toString("base64") !== item.base64) throw new Error("Staged file content must use canonical base64 encoding.");
    const rule = resourceFileRule(relativePath);
    if (!data.length || data.length > rule.maxBytes) throw new Error(`Staged ${rule.label} file is empty or exceeds its size limit.`);
    identities.add(identity);
    files.set(relativePath, { data, name: String(item.name || path.basename(relativePath)), type: String(item.type || "") });
  }
  return files;
}

function publicPathsForCatalog(catalog) {
  const paths = new Set();
  for (const resource of catalog.resources) {
    if (!resource.published) continue;
    for (const value of [resource.filePath, resource.cover, resource.viewPath]) {
      if (value && isAllowedFilePath(value)) paths.add(value);
    }
  }
  return paths;
}

function allCatalogPaths(catalog) {
  const paths = new Set();
  for (const resource of catalog.resources) {
    for (const value of [resource.filePath, resource.cover, resource.viewPath]) {
      if (value && isAllowedFilePath(value)) paths.add(value);
    }
  }
  return paths;
}

async function assertRepositoryShape(root) {
  await assertNoSymlink(path.parse(root).root, root);
  const required = ["package.json", "src", "src/data", "public", "public/assets"];
  for (const relativePath of required) {
    const absolute = resolveRepositoryPath(root, relativePath);
    if (!(await pathExists(absolute))) throw new Error(`This is not the portfolio root: missing ${relativePath}.`);
    await assertNoSymlink(root, absolute);
  }
  for (const relativePath of [CATALOG_RELATIVE_PATH, PUBLIC_CATALOG_RELATIVE_PATH, PUBLIC_MANIFEST_RELATIVE_PATH]) {
    const absolute = resolveRepositoryPath(root, relativePath);
    await assertRegularFile(absolute, relativePath);
  }
}

async function readCurrentCatalog(root) {
  const catalogPath = resolveRepositoryPath(root, CATALOG_RELATIVE_PATH);
  await assertRegularFile(catalogPath, CATALOG_RELATIVE_PATH);
  return normalizeCatalog(await readJson(catalogPath, { resources: [] }));
}

async function snapshot(root, directory) {
  await ensureDirectory(directory);
  const metadata = [CATALOG_RELATIVE_PATH, PUBLIC_CATALOG_RELATIVE_PATH, PUBLIC_MANIFEST_RELATIVE_PATH];
  for (const relativePath of metadata) {
    const source = resolveRepositoryPath(root, relativePath);
    if (await pathExists(source)) await writeAtomic(path.join(directory, relativePath), await fsp.readFile(source));
  }
  for (const source of [...await listManagedPublicFiles(root), ...await listDraftFiles(root)]) {
    const relativePath = source.includes(`${path.sep}${DRAFT_ROOT.replaceAll("/", path.sep)}${path.sep}`)
      ? path.join("drafts", pathFromDraftAbsolute(root, source))
      : path.join("public", pathFromPublicAbsolute(root, source));
    await writeAtomic(path.join(directory, relativePath), await fsp.readFile(source));
  }
}

async function restoreSnapshot(root, directory) {
  for (const relativePath of [CATALOG_RELATIVE_PATH, PUBLIC_CATALOG_RELATIVE_PATH, PUBLIC_MANIFEST_RELATIVE_PATH]) {
    const source = path.join(directory, relativePath);
    if (await pathExists(source)) await writeAtomic(resolveRepositoryPath(root, relativePath), await fsp.readFile(source));
    else {
      const destination = resolveRepositoryPath(root, relativePath);
      await assertRegularFile(destination, "Rollback target");
      await fsp.rm(destination, { force: true });
    }
  }
  for (const source of [...await listManagedPublicFiles(root), ...await listDraftFiles(root)]) await fsp.rm(source, { force: true });
  const savedFiles = await listFiles(directory);
  for (const source of savedFiles) {
    const relativePath = path.relative(directory, source).replaceAll(path.sep, "/");
    if (relativePath === CATALOG_RELATIVE_PATH || relativePath === PUBLIC_CATALOG_RELATIVE_PATH || relativePath === PUBLIC_MANIFEST_RELATIVE_PATH) continue;
    const destination = relativePath.startsWith("public/")
      ? resolveRepositoryPath(root, relativePath)
      : resolveRepositoryPath(root, `${DRAFT_ROOT}/${relativePath.slice("drafts/".length)}`);
    await writeAtomic(destination, await fsp.readFile(source));
  }
}

async function moveToPrivate(root, relativePath) {
  const source = publicPathFor(root, relativePath);
  if (!(await assertRegularFile(source, "Public resource"))) return;
  const destination = draftPathFor(root, relativePath);
  await ensureDirectory(path.dirname(destination));
  await fsp.rm(destination, { force: true });
  await fsp.copyFile(source, destination);
  await fsp.rm(source, { force: true });
}

async function moveToTrash(root, relativePath, trashDirectory) {
  const candidates = [publicPathFor(root, relativePath), draftPathFor(root, relativePath)];
  for (const source of candidates) {
    if (!(await assertRegularFile(source, "Resource to delete"))) continue;
    const destination = path.join(trashDirectory, source === candidates[0] ? "public" : "drafts", relativePath);
    await ensureDirectory(path.dirname(destination));
    await fsp.copyFile(source, destination);
    await fsp.rm(source, { force: true });
  }
}

async function prepareIncomingFiles(root, incoming, catalog, stagingDirectory) {
  const staged = new Map();
  const resourcesByPath = new Map();
  for (const resource of catalog.resources) {
    for (const value of [resource.filePath, resource.cover, resource.viewPath]) {
      if (value && isAllowedFilePath(value)) resourcesByPath.set(value, resource);
    }
  }

  for (const [relativePath, file] of incoming) {
    const resource = resourcesByPath.get(relativePath);
    if (resource && resource.kind !== "episode" && relativePath === resource.filePath && !isAllowedFilePathForKind(relativePath, resource.kind)) {
      throw new Error(`${resource.title}: staged file path does not match its resource type.`);
    }
    const destination = path.join(stagingDirectory, relativePath);
    await ensureDirectory(path.dirname(destination));
    await fsp.writeFile(destination, file.data, { flag: "wx" });
    staged.set(relativePath, destination);
  }
  return staged;
}

async function validateCandidate(root, catalog, incoming, currentPublicFiles, currentDraftFiles = []) {
  const normalized = normalizeCatalog(catalog);
  const incomingPaths = new Set(incoming.keys());
  const publicPaths = new Set(currentPublicFiles.map((filePath) => pathFromPublicAbsolute(root, filePath)));
  const draftPaths = new Set(currentDraftFiles.map((filePath) => pathFromDraftAbsolute(root, filePath)));
  const references = normalized.resources.flatMap((resource) => [resource.filePath, resource.cover, resource.viewPath]).filter(Boolean);
  assertNoPathAliases([...references, ...incomingPaths, ...publicPaths, ...draftPaths]);
  const legacyCovers = new Set();
  for (const value of references) {
    if (isAllowedCoverPath(value) && !isAllowedFilePath(value) && await assertRegularFile(resolveRepositoryPath(root, `public/${value}`), "Legacy cover")) legacyCovers.add(value);
    if (isAllowedFilePath(value)) {
      await assertNoSymlink(root, publicPathFor(root, value));
      await assertNoSymlink(root, draftPathFor(root, value));
    }
  }
  const result = validateCatalog(normalized, {
    fileExists: (relativePath) => incomingPaths.has(relativePath) || publicPaths.has(relativePath) || draftPaths.has(relativePath) || legacyCovers.has(relativePath),
  });
  if (!result.valid) {
    const error = new Error(`Resource validation failed: ${result.errors.slice(0, 8).join(" ")}`);
    error.details = result;
    throw error;
  }
  return { ...result, warnings: result.warnings };
}

async function commitProject(root, body, testOnlyAfterWrite) {
  await assertRepositoryShape(root);
  if (!body || !body.catalog || typeof body.catalog !== "object" || Array.isArray(body.catalog)) {
    throw new Error("The save did not include a catalog. Keep the Studio draft and try Save Changes again.");
  }
  const currentCatalog = await readCurrentCatalog(root);
  if (Object.hasOwn(body, "expectedRevision") && body.expectedRevision !== catalogRevision(currentCatalog)) {
    const error = new Error("The catalog changed in another session. Reload the project before saving again.");
    error.statusCode = 409;
    throw error;
  }
  const candidate = normalizeCatalog(body?.catalog);
  const incoming = decodeIncomingFiles(body?.files);
  const currentPublicFiles = await listManagedPublicFiles(root);
  const currentDraftFiles = await listDraftFiles(root);
  const validation = await validateCandidate(root, candidate, incoming, currentPublicFiles, currentDraftFiles);
  const now = `${timestamp()}-${crypto.randomBytes(4).toString("hex")}`;
  const backupDirectory = resolveRepositoryPath(root, `${BACKUP_ROOT}/${now}`);
  const trashDirectory = resolveRepositoryPath(root, `${TRASH_ROOT}/${now}`);
  const stagingDirectory = resolveRepositoryPath(root, `${PRIVATE_ROOT}/staging/${now}`);
  const journalPath = resolveRepositoryPath(root, `${PRIVATE_ROOT}/journal.json`);
  const currentPublicPaths = new Set(currentPublicFiles.map((filePath) => pathFromPublicAbsolute(root, filePath)));
  const desiredPublicPaths = publicPathsForCatalog(candidate);
  const catalogPaths = allCatalogPaths(candidate);
  const deletedResource = body?.operation === "delete" && body?.deleteResourceId
    ? currentCatalog.resources.find((resource) => resource.id === body.deleteResourceId)
    : null;
  if (body?.operation === "delete" && (!body.deleteResourceId || candidate.resources.some((resource) => resource.id === body.deleteResourceId))) {
    throw new Error("Delete confirmation was incomplete. The deleted resource must be absent from the saved catalog.");
  }
  const deletedPaths = new Set(deletedResource ? [deletedResource.filePath, deletedResource.cover, deletedResource.viewPath].filter((value) => value && isAllowedFilePath(value)) : []);

  await snapshot(root, backupDirectory);
  await ensureDirectory(stagingDirectory);
  await writeAtomic(journalPath, jsonBytes({
    version: 1,
    startedAt: new Date().toISOString(),
    operation: body?.operation || "save",
    backup: path.relative(root, backupDirectory).replaceAll(path.sep, "/"),
    status: "staging",
  }));

  try {
    const staged = await prepareIncomingFiles(root, incoming, candidate, stagingDirectory);

    for (const [relativePath, stagedPath] of staged) {
      if (!desiredPublicPaths.has(relativePath)) {
        const destination = draftPathFor(root, relativePath);
        await ensureDirectory(path.dirname(destination));
        await writeAtomic(destination, await fsp.readFile(stagedPath));
      }
    }

    for (const relativePath of desiredPublicPaths) {
      const stagedPath = staged.get(relativePath);
      const source = stagedPath || (await pathExists(publicPathFor(root, relativePath)) ? publicPathFor(root, relativePath) : draftPathFor(root, relativePath));
      if (!(await assertRegularFile(source, `Published file ${relativePath}`))) throw new Error(`Published file is missing from the staged project: ${relativePath}. Add it again or unpublish the resource.`);
      await writeAtomic(publicPathFor(root, relativePath), await fsp.readFile(source));
      const privateCopy = draftPathFor(root, relativePath);
      if (await pathExists(privateCopy)) await fsp.rm(privateCopy, { force: true });
    }

    for (const relativePath of currentPublicPaths) {
      if (desiredPublicPaths.has(relativePath)) continue;
      if (deletedPaths.has(relativePath) && !catalogPaths.has(relativePath)) await moveToTrash(root, relativePath, trashDirectory);
      else await moveToPrivate(root, relativePath);
    }

    for (const relativePath of deletedPaths) {
      if (catalogPaths.has(relativePath) || currentPublicPaths.has(relativePath)) continue;
      const draftFile = draftPathFor(root, relativePath);
      if (!(await pathExists(draftFile))) continue;
      const destination = path.join(trashDirectory, "drafts", relativePath);
      await ensureDirectory(path.dirname(destination));
      await fsp.copyFile(draftFile, destination);
      await fsp.rm(draftFile, { force: true });
    }

    // Constructor-injected fault hook only; request bodies cannot enable it.
    await testOnlyAfterWrite?.({ phase: "after-assets" });
    const publicCatalog = toPublicCatalog(candidate);
    await writeAtomic(resolveRepositoryPath(root, CATALOG_RELATIVE_PATH), jsonBytes(candidate));
    await writeAtomic(resolveRepositoryPath(root, PUBLIC_CATALOG_RELATIVE_PATH), jsonBytes(publicCatalog));
    await writeAtomic(resolveRepositoryPath(root, PUBLIC_MANIFEST_RELATIVE_PATH), jsonBytes(publicCatalog));
    await testOnlyAfterWrite?.({ phase: "after-manifests" });
    await writeAtomic(journalPath, jsonBytes({
      version: 1,
      completedAt: new Date().toISOString(),
      operation: body?.operation || "save",
      backup: path.relative(root, backupDirectory).replaceAll(path.sep, "/"),
      status: "complete",
    }));
    await fsp.rm(stagingDirectory, { recursive: true, force: true });

    return {
      catalog: candidate,
      revision: catalogRevision(candidate),
      publicCatalog,
      warnings: validation.warnings,
      backup: path.relative(root, backupDirectory).replaceAll(path.sep, "/"),
      trash: (await pathExists(trashDirectory)) ? path.relative(root, trashDirectory).replaceAll(path.sep, "/") : null,
      publicResourceCount: publicCatalog.resources.length,
    };
  } catch (error) {
    let rolledBack = true;
    try { await restoreSnapshot(root, backupDirectory); } catch (restoreError) {
      rolledBack = false;
      error.message += ` Recovery also failed: ${restoreError.message}`;
    }
    await writeAtomic(journalPath, jsonBytes({
      version: 1,
      failedAt: new Date().toISOString(),
      operation: body?.operation || "save",
      backup: path.relative(root, backupDirectory).replaceAll(path.sep, "/"),
      status: rolledBack ? "rolled-back" : "rollback-failed",
    }));
    await fsp.rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function readProjectState(root) {
  await assertRepositoryShape(root);
  const catalog = await readCurrentCatalog(root);
  const files = {};
  let stateBytes = Buffer.byteLength(JSON.stringify(catalog), "utf8");
  const candidates = [...await listManagedPublicFiles(root), ...await listDraftFiles(root)];
  assertNoPathAliases([
    ...catalog.resources.flatMap((resource) => [resource.filePath, resource.cover, resource.viewPath]).filter(Boolean),
    ...candidates.map((value) => isInside(resolveRepositoryPath(root, DRAFT_ROOT), value) ? pathFromDraftAbsolute(root, value) : pathFromPublicAbsolute(root, value)),
  ]);
  for (const absolutePath of candidates) {
    const isPublic = absolutePath.includes(`${path.sep}public${path.sep}assets${path.sep}resources${path.sep}`);
    const relativePath = isPublic ? pathFromPublicAbsolute(root, absolutePath) : pathFromDraftAbsolute(root, absolutePath);
    if (!isAllowedFilePath(relativePath) || files[relativePath]) continue;
    await assertRegularFile(absolutePath, "Managed resource");
    const stats = await fsp.stat(absolutePath);
    if (stats.size > MAX_FILE_BYTES) throw new Error(`Managed resource ${relativePath} exceeds the 20 MB bridge limit. Move it to recovery before restarting Studio.`);
    const data = await fsp.readFile(absolutePath);
    stateBytes += data.length + Math.ceil(data.length / 3) * 4;
    if (stateBytes > MAX_STATE_BYTES) throw new Error("The local resource state is too large to load in Studio. Export a ZIP or remove old recovery files, then retry.");
    files[relativePath] = {
      name: path.basename(absolutePath),
      type: "",
      size: data.length,
      base64: data.toString("base64"),
      location: isPublic ? "public" : "draft",
    };
  }
  return { catalog, revision: catalogRevision(catalog), files, generatedAt: new Date().toISOString() };
}

function responseHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    Vary: "Origin",
  };
}

function sendJson(response, status, value, origin) {
  const body = JSON.stringify(value);
  response.writeHead(status, { ...responseHeaders(origin), "Content-Length": Buffer.byteLength(body) });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(request.headers["content-length"] || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      reject(new Error("The request is too large. Save fewer files at once or use ZIP export."));
      request.resume();
      return;
    }
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("The request is too large. Save fewer files at once or use ZIP export."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("The bridge received invalid JSON.")); }
    });
    request.on("error", reject);
  });
}

export function createBridgeServer({ root, port = DEFAULT_BRIDGE_PORT, origin = STUDIO_ORIGIN, token = crypto.randomBytes(32).toString("hex"), testOnlyAfterWrite } = {}) {
  const repositoryRoot = path.resolve(root || process.cwd());
  let commitQueue = Promise.resolve();
  // State reads must share the queue so their revision and files cannot be
  // sampled halfway through a later commit.
  const enqueue = (operation) => {
    const run = commitQueue.then(operation);
    commitQueue = run.catch(() => undefined);
    return run;
  };
  const server = http.createServer(async (request, response) => {
    const requestOrigin = request.headers.origin;
    if (request.socket.remoteAddress && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress)) {
      sendJson(response, 403, { error: "The Resource Studio bridge accepts loopback connections only." }, origin);
      return;
    }
    if (requestOrigin !== origin) {
      sendJson(response, 403, { error: "This local bridge only accepts requests from the Resource Studio origin." }, origin);
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, responseHeaders(origin));
      response.end();
      return;
    }
    if (!request.url?.startsWith("/api/")) {
      sendJson(response, 404, { error: "Not found." }, origin);
      return;
    }
    if (request.url === "/api/session" && request.method === "GET") {
      sendJson(response, 200, { token, origin, port: server.address()?.port || port }, origin);
      return;
    }
    const suppliedToken = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (suppliedToken !== token) {
      sendJson(response, 401, { error: "The bridge session is missing or expired. Refresh Resource Studio." }, origin);
      return;
    }
    try {
      if (request.url === "/api/health" && request.method === "GET") {
        sendJson(response, 200, { ok: true, root: relativePathForLog(repositoryRoot), pid: process.pid }, origin);
      } else if (request.url === "/api/state" && request.method === "GET") {
        sendJson(response, 200, await enqueue(() => readProjectState(repositoryRoot)), origin);
      } else if (request.url === "/api/commit" && request.method === "POST") {
        const body = await readBody(request);
        sendJson(response, 200, { ok: true, ...(await enqueue(() => commitProject(repositoryRoot, body, testOnlyAfterWrite))) }, origin);
      } else {
        sendJson(response, 404, { error: "Unknown bridge operation." }, origin);
      }
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || "The local bridge could not complete the request." }, origin);
    }
  });
  return { server, token, root: repositoryRoot, origin };
}

export async function startBridge(options = {}) {
  const bridge = createBridgeServer(options);
  await new Promise((resolve, reject) => {
    bridge.server.once("error", reject);
    bridge.server.listen(options.port ?? DEFAULT_BRIDGE_PORT, "127.0.0.1", resolve);
  });
  return bridge;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  const rootArgumentIndex = process.argv.indexOf("--root");
  const portArgumentIndex = process.argv.indexOf("--port");
  const root = rootArgumentIndex >= 0 ? process.argv[rootArgumentIndex + 1] : process.cwd();
  const port = portArgumentIndex >= 0 ? Number(process.argv[portArgumentIndex + 1]) : Number(process.env.RESOURCE_BRIDGE_PORT || DEFAULT_BRIDGE_PORT);
  try {
    const bridge = await startBridge({ root, port });
    console.log(`Resource Studio bridge ready on http://127.0.0.1:${bridge.server.address().port}`);
    console.log(`Repository: ${bridge.root}`);
    process.stdout.write("Bridge token is process-local and is only exchanged with Resource Studio.\n");
  } catch (error) {
    console.error(`Resource Studio bridge failed to start: ${error.message}`);
    process.exitCode = 1;
  }
}
