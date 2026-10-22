export const RESOURCE_VERSION = 3;

export const DEFAULT_CATEGORIES = [
  { id: "ai", label: "AI & Artificial Intelligence" },
  { id: "prompts", label: "AI Prompts" },
  { id: "python", label: "Python & Programming" },
  { id: "web", label: "Web Development" },
  { id: "content", label: "Content Creation" },
  { id: "study", label: "Study Notes" },
  { id: "guides", label: "Guides & Tutorials" },
  { id: "cheatsheets", label: "Cheat Sheets" },
  { id: "project-docs", label: "Project Documentation" },
  { id: "other", label: "Other" },
];

export const RESOURCE_KINDS = ["episode", "pdf", "prompt", "note", "image"];
export const RESOURCE_TYPES = ["external", "pdf", "prompt", "note", "image"];

export const FILE_RULES = {
  pdf: { label: "PDF", extensions: [".pdf"], maxBytes: 20 * 1024 * 1024, folder: "pdfs" },
  prompt: {
    label: "TXT or Markdown prompt",
    extensions: [".txt", ".md", ".markdown"],
    maxBytes: 1 * 1024 * 1024,
    folder: "prompt-packs",
  },
  note: {
    label: "TXT or Markdown note",
    extensions: [".txt", ".md", ".markdown"],
    maxBytes: 1 * 1024 * 1024,
    folder: "notes",
  },
  image: {
    label: "PNG, JPEG or WebP image",
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxBytes: 5 * 1024 * 1024,
    folder: "covers",
  },
};

const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const LOCAL_RESOURCE_PATH_RE = /^assets\/resources\/(pdfs|prompt-packs|covers|notes)\/[^/]+$/;
const LEGACY_COVER_PATH_RE = /^images\/content\/[^/]+$/;
const URL_PROTOCOL_RE = /^https?:\/\//i;
const SECRET_LIKE_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*[^\s]+|(?:ghp_|github_pat_|sk-[A-Za-z0-9])/i;
const WINDOWS_DEVICE_RE = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³]) *(?:\.|$)/i;

// Use the same identity on case-sensitive hosts and Windows. Exact shared
// references are allowed; alternate spellings of that reference are not.
export function resourcePathKey(value) {
  return value.normalize("NFC").toUpperCase().toLowerCase();
}

export function assertNoPathAliases(paths) {
  const seen = new Map();
  for (const value of paths) {
    if (typeof value !== "string") continue;
    const key = resourcePathKey(value);
    if (seen.has(key) && seen.get(key) !== value) throw new Error("Case-insensitive resource path aliases are not permitted.");
    seen.set(key, value);
  }
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 64) || "resource";
}

export function sanitizeFileName(value, fallback = "resource") {
  const raw = String(value || "").trim().replace(/\\/g, "/").split("/").pop() || fallback;
  const dot = raw.lastIndexOf(".");
  const stem = dot > 0 ? raw.slice(0, dot) : raw;
  const extension = dot > 0 ? raw.slice(dot).toLowerCase() : "";
  return `${slugify(stem)}${extension}`;
}

export function extensionOf(path) {
  const value = String(path || "").toLowerCase();
  const dot = value.lastIndexOf(".");
  return dot === -1 ? "" : value.slice(dot);
}

export function uniqueResourcePath(kind, fileName, resources = [], files = {}, exceptPath = null) {
  const rule = FILE_RULES[kind] || FILE_RULES.note;
  const used = new Set(resources.flatMap((resource) => [resource.filePath, resource.cover, resource.viewPath]).filter(Boolean).map(resourcePathKey));
  Object.keys(files || {}).forEach((path) => used.add(resourcePathKey(path)));
  if (exceptPath) used.delete(resourcePathKey(exceptPath));
  const safeName = sanitizeFileName(fileName, "resource");
  const extension = extensionOf(safeName);
  const stem = extension ? safeName.slice(0, -extension.length) : safeName;
  let count = 1;
  let candidate = `assets/resources/${rule.folder}/${safeName}`;
  while (used.has(resourcePathKey(candidate))) candidate = `assets/resources/${rule.folder}/${stem}-${++count}${extension}`;
  return candidate;
}

export function isSafeRelativePath(path) {
  if (!path || typeof path !== "string") return false;
  if (
    path.includes("\\") ||
    path.includes("..") ||
    path.startsWith("/") ||
    /[:<>"|?*%]/.test(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return false;
  }
  return !path.split("/").some((segment) => !segment || segment === "." || /[. ]$/.test(segment) || WINDOWS_DEVICE_RE.test(segment) || /~[0-9]/.test(segment) || segment.length > 255);
}

export function isAllowedFilePath(path) {
  return Boolean(resourceFileRule(path));
}

export function resourceFileRule(path) {
  if (!isSafeRelativePath(path) || path.length > 240 || !LOCAL_RESOURCE_PATH_RE.test(path)) return null;
  return Object.values(FILE_RULES).find((rule) => path.startsWith(`assets/resources/${rule.folder}/`) && rule.extensions.includes(extensionOf(path))) || null;
}

export function isAllowedFilePathForKind(path, kind) {
  const rule = FILE_RULES[kind];
  if (!rule || !isAllowedFilePath(path)) return false;
  const folder = `assets/resources/${rule.folder}/`;
  return path.startsWith(folder) && rule.extensions.includes(extensionOf(path));
}

export function isAllowedCoverPath(path) {
  return isAllowedFilePathForKind(path, "image") || (isSafeRelativePath(path) && LEGACY_COVER_PATH_RE.test(path) && FILE_RULES.image.extensions.includes(extensionOf(path)));
}

export function getCategoryMap(categories = DEFAULT_CATEGORIES) {
  return new Map((categories || []).map((category) => [category.id, category]));
}

export function getCategoryLabel(categoryId, categories = DEFAULT_CATEGORIES) {
  return getCategoryMap(categories).get(categoryId)?.label || "Other";
}

export function getKindFromFile(fileName) {
  const extension = extensionOf(fileName);
  if (FILE_RULES.pdf.extensions.includes(extension)) return "pdf";
  if (FILE_RULES.image.extensions.includes(extension)) return "image";
  if (FILE_RULES.prompt.extensions.includes(extension)) return "prompt";
  return null;
}

export function validateUploadFile(file, kind = getKindFromFile(file?.name)) {
  const errors = [];
  if (!file) return { valid: false, errors: ["Choose a file first."] };
  if (!kind || !FILE_RULES[kind]) {
    errors.push("Use a PDF, TXT, Markdown, PNG, JPEG or WebP file.");
  } else {
    const rule = FILE_RULES[kind];
    const extension = extensionOf(file.name);
    if (!rule.extensions.includes(extension)) errors.push(`${rule.label} files must use ${rule.extensions.join(", ")}.`);
    if (file.size > rule.maxBytes) errors.push(`${rule.label} files must be smaller than ${Math.round(rule.maxBytes / (1024 * 1024))} MB.`);
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeResource(resource, index = 0, categories = DEFAULT_CATEGORIES) {
  const categoryId = resource?.categoryId || "other";
  const tags = Array.isArray(resource?.tags)
    ? Array.from(new Set(resource.tags.map((tag) => String(tag).trim()).filter(Boolean))).slice(0, 16)
    : [];

  return {
    id: String(resource?.id || `resource-${index + 1}`),
    kind: resource?.kind || "note",
    type: resource?.type || resource?.kind || "note",
    source: resource?.source || "resource-studio",
    series: resource?.series || "TS nextstep resource",
    number: resource?.number || null,
    title: String(resource?.title || resource?.originalFileName || "Untitled resource").trim(),
    description: String(resource?.description || "").trim(),
    categoryId,
    category: getCategoryLabel(categoryId, categories),
    tags,
    filePath: resource?.filePath || null,
    originalFileName: resource?.originalFileName || null,
    cover: resource?.cover || null,
    fileSize: Number.isFinite(resource?.fileSize) ? resource.fileSize : null,
    mimeType: resource?.mimeType || null,
    promptText: resource?.promptText || null,
    featured: resource?.featured === true,
    published: resource?.published === true,
    // Preserve missing/invalid orders so validation can report them instead of
    // silently turning a malformed catalog into a different order.
    displayOrder: Number.isInteger(resource?.displayOrder) ? resource.displayOrder : null,
    youtubeUrl: resource?.youtubeUrl || null,
    instagramUrl: resource?.instagramUrl || null,
    viewPath: resource?.viewPath || null,
  };
}

export function normalizeCatalog(input) {
  const categories = Array.isArray(input?.categories) ? input.categories : DEFAULT_CATEGORIES;
  const resources = Array.isArray(input?.resources) ? input.resources.map((resource, index) => normalizeResource(resource, index, categories)) : [];
  return {
    version: RESOURCE_VERSION,
    categories,
    resources: sortResources(resources),
  };
}

export function sortResources(resources) {
  return [...resources].sort((a, b) => {
    const order = (a.displayOrder || 0) - (b.displayOrder || 0);
    return order || String(a.title).localeCompare(String(b.title)) || String(a.id).localeCompare(String(b.id));
  });
}

export function withDisplayOrder(resources) {
  return sortResources(resources).map((resource, index) => ({ ...resource, displayOrder: index + 1 }));
}

export function validateCatalog(input, options = {}) {
  const catalog = normalizeCatalog(input);
  const errors = [];
  const warnings = [];
  const categories = getCategoryMap(catalog.categories);
  const ids = new Set();
  const orders = new Set();
  try {
    assertNoPathAliases(catalog.resources.flatMap((resource) => [resource.filePath, resource.cover, resource.viewPath]).filter(Boolean));
  } catch (error) {
    errors.push(error.message);
  }

  if (!catalog.categories.length) errors.push("Add at least one resource category.");
  catalog.categories.forEach((category, index) => {
    if (!category?.id || !/^[a-z0-9-]+$/.test(category.id)) errors.push(`Category ${index + 1} has an unsafe id.`);
    if (!category?.label?.trim()) errors.push(`Category ${category?.id || index + 1} needs a label.`);
  });

  catalog.resources.forEach((resource, index) => {
    const label = resource.title || resource.id || `resource ${index + 1}`;
    if (!ID_RE.test(resource.id)) errors.push(`${label}: use a unique lowercase id with letters, numbers and hyphens.`);
    if (ids.has(resource.id)) errors.push(`${label}: duplicate resource id "${resource.id}".`);
    ids.add(resource.id);
    if (!RESOURCE_KINDS.includes(resource.kind)) errors.push(`${label}: unsupported kind "${resource.kind}".`);
    if (!RESOURCE_TYPES.includes(resource.type)) errors.push(`${label}: unsupported type "${resource.type}".`);
    if (!categories.has(resource.categoryId)) errors.push(`${label}: choose a valid category.`);
    if (!resource.title.trim()) errors.push(`${label}: add a public title.`);
    if (!Number.isInteger(resource.displayOrder) || resource.displayOrder < 1) errors.push(`${label}: display order must be a positive whole number.`);
    if (orders.has(resource.displayOrder)) errors.push(`${label}: display order ${resource.displayOrder} is already used.`);
    orders.add(resource.displayOrder);

    if (resource.filePath) {
      if (!isAllowedFilePath(resource.filePath)) errors.push(`${label}: file path must stay inside public/assets/resources.`);
      if (resource.kind !== "episode" && !isAllowedFilePathForKind(resource.filePath, resource.kind)) {
        errors.push(`${label}: ${resource.kind} files must use the matching resource folder and extension.`);
      }
      if (typeof options.fileExists === "function" && !options.fileExists(resource.filePath)) {
        if (resource.published) {
          errors.push(`${label}: file "${resource.filePath}" is missing.`);
        } else {
          warnings.push(`${label}: draft file "${resource.filePath}" is not staged; it will stay out of the public export.`);
        }
      }
      const extension = extensionOf(resource.filePath);
      const fileRule = FILE_RULES[resource.kind];
      if (fileRule && !fileRule.extensions.includes(extension)) {
        errors.push(`${label}: ${resource.kind} files must use ${fileRule.extensions.join(", ")}.`);
      }
      const expectedKind = getKindFromFile(resource.filePath);
      if (expectedKind && resource.kind !== "episode" && expectedKind !== resource.kind && !(resource.kind === "note" && expectedKind === "prompt")) {
        warnings.push(`${label}: file extension suggests ${expectedKind}, but the record is ${resource.kind}.`);
      }
    }

    if (resource.cover) {
      if (!isAllowedCoverPath(resource.cover)) errors.push(`${label}: cover path is outside the public asset allowlist.`);
      if (typeof options.fileExists === "function" && !options.fileExists(resource.cover)) {
        (resource.published ? errors : warnings).push(`${label}: cover is missing and will not preview.`);
      }
    }

    if (resource.kind === "prompt" && resource.published && !String(resource.promptText || "").trim()) {
      errors.push(`${label}: published prompts need actual prompt text.`);
    }
    if (SECRET_LIKE_RE.test(String(resource.promptText || ""))) {
      errors.push(`${label}: text looks like it contains a secret or credential; remove it before export.`);
    }
    if (resource.published && ["pdf", "note", "image"].includes(resource.kind) && !resource.filePath) {
      errors.push(`${label}: published ${resource.kind} resources need a real file.`);
    }
    if (resource.youtubeUrl && !URL_PROTOCOL_RE.test(resource.youtubeUrl)) errors.push(`${label}: YouTube URL must use http or https.`);
    if (resource.instagramUrl && !URL_PROTOCOL_RE.test(resource.instagramUrl)) errors.push(`${label}: Instagram URL must use http or https.`);
    if (resource.viewPath && !isAllowedFilePath(resource.viewPath)) errors.push(`${label}: view path is outside the public asset allowlist.`);
    if (resource.viewPath && typeof options.fileExists === "function" && !options.fileExists(resource.viewPath)) {
      (resource.published ? errors : warnings).push(`${label}: view file is missing.`);
    }
  });

  const expectedOrders = Array.from({ length: catalog.resources.length }, (_, index) => index + 1);
  if (catalog.resources.length && expectedOrders.some((order) => !orders.has(order))) errors.push("Display order must contain every position from 1 to the number of resources.");

  return { valid: errors.length === 0, errors, warnings, catalog };
}

export function toPublicCatalog(input) {
  const catalog = normalizeCatalog(input);
  const publicResources = sortResources(catalog.resources)
    .filter((resource) => resource.published === true)
    .map((resource) => ({
      ...resource,
      category: getCategoryLabel(resource.categoryId, catalog.categories),
    }));

  return {
    version: RESOURCE_VERSION,
    generatedFrom: "src/data/resourceCatalog.json",
    categories: catalog.categories,
    resources: publicResources,
    // Keep one public resource record per item. These ID indexes are useful to
    // static tooling without duplicating full prompt/file metadata.
    prompts: publicResources.filter((resource) => resource.kind === "prompt").map((resource) => resource.id),
    downloads: publicResources.filter((resource) => resource.filePath && ["pdf", "note", "prompt"].includes(resource.kind)).map((resource) => resource.id),
  };
}

export function reorderResources(resources, sourceId, targetId) {
  const ordered = withDisplayOrder(resources);
  const sourceIndex = ordered.findIndex((resource) => resource.id === sourceId);
  const targetIndex = ordered.findIndex((resource) => resource.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ordered;
  const [source] = ordered.splice(sourceIndex, 1);
  ordered.splice(targetIndex, 0, source);
  return ordered.map((resource, index) => ({ ...resource, displayOrder: index + 1 }));
}

export function moveResource(resources, id, direction) {
  const ordered = withDisplayOrder(resources);
  const index = ordered.findIndex((resource) => resource.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((resource, itemIndex) => ({ ...resource, displayOrder: itemIndex + 1 }));
}
