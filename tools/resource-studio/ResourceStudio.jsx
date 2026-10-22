import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_CATEGORIES,
  FILE_RULES,
  getCategoryLabel,
  getKindFromFile,
  isAllowedCoverPath,
  isAllowedFilePath,
  moveResource,
  normalizeCatalog,
  reorderResources,
  sanitizeFileName,
  slugify,
  toPublicCatalog,
  uniqueResourcePath,
  validateCatalog,
  validateUploadFile,
  withDisplayOrder,
} from "../../src/lib/resourceValidation.js";
import { loadDraft, saveDraft } from "./storage.js";
import { createZip, decodeText, readZip } from "./zip.js";
import "./resource-studio.css";

// The bridge is the project source of truth. Importing the authoring JSON here
// caused Vite to remount Studio during its own saves, losing the active editor.
// It also embedded private drafts into Studio's compiled JavaScript.
const INITIAL_CATALOG = normalizeCatalog({ resources: [] });
const STUDIO_FILTERS = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDFs" },
  { id: "prompt", label: "Prompts" },
  { id: "note", label: "Notes" },
  { id: "image", label: "Images" },
  { id: "episode", label: "Build notes" },
];
const MIME_BY_EXTENSION = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const BRIDGE_URL = "http://127.0.0.1:4175";

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/**
 * Client-side file existence for `validateCatalog`.
 *
 * The Studio only holds bridge-managed files (`public/assets/resources/**`
 * and `.resource-studio/drafts/**`) in local state. Legacy cover images under
 * `public/images/content/` are intentionally not shipped to the browser, so
 * the Studio cannot verify them and must not block a save when it sees one.
 * The bridge stays authoritative: it re-checks every reference against the
 * real filesystem and reports a genuinely missing cover as a visible error.
 */
function projectAssetExists(relativePath, files) {
  if (!relativePath) return true;
  if (files?.[relativePath]) return true;
  return isAllowedCoverPath(relativePath) && !isAllowedFilePath(relativePath);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encodeBridgeFiles(files) {
  return Promise.all(Object.entries(files || {}).filter(([, file]) => file).map(async ([filePath, file]) => ({
    path: filePath,
    name: file.name || filePath.split("/").pop(),
    type: file.type || mimeForPath(filePath),
    base64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
  })));
}

function decodeBridgeFiles(files) {
  return Object.fromEntries(Object.entries(files || {}).map(([filePath, record]) => [
    filePath,
    new File([base64ToBytes(record.base64)], record.name || filePath.split("/").pop(), { type: record.type || mimeForPath(filePath) }),
  ]));
}

function Icon({ name }) {
  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="8.5" /></>,
    upload: <><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M5 14.5V18h14v-3.5" /></>,
    download: <><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 4 4" /></>,
    edit: <><path d="m5 15-.8 4 4-.8L18 8.4 15.6 6 5 15Z" /><path d="m13.8 7.8 2.4 2.4" /></>,
    eye: <><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.2" /></>,
    trash: <><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></>,
    up: <><path d="m6 13 6-6 6 6" /><path d="M12 7v10" /></>,
    down: <><path d="m6 11 6 6 6-6" /><path d="M12 17V4" /></>,
    grip: <><circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="17" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="17" r="1" fill="currentColor" stroke="none" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    undo: <><path d="M9 7 4 12l5 5" /><path d="M4 12h9a6 6 0 1 1 0 12" /></>,
    folder: <><path d="M3 7.5h6l2 2h10v9H3v-11Z" /><path d="M3 9.5h18" /></>,
  };
  return <svg className="studio-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "No file size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameFromPath(path) {
  return String(path || "").split("/").pop() || "";
}

function extensionOf(path) {
  const value = String(path || "").toLowerCase();
  const dot = value.lastIndexOf(".");
  return dot === -1 ? "" : value.slice(dot);
}

function uniqueId(base, resources) {
  const used = new Set(resources.map((resource) => resource.id));
  const root = slugify(base);
  let candidate = root;
  let count = 2;
  while (used.has(candidate)) candidate = `${root}-${count++}`;
  return candidate;
}

function newResource(kind, overrides, catalog) {
  const resources = catalog.resources;
  return {
    id: uniqueId(overrides.id || `${kind}-${overrides.title || "resource"}`, resources),
    kind,
    type: kind === "episode" ? "external" : kind,
    source: "resource-studio",
    series: "TS nextstep resource",
    number: null,
    title: overrides.title || "Untitled resource",
    description: overrides.description || "",
    categoryId: overrides.categoryId || (kind === "prompt" ? "prompts" : "other"),
    tags: overrides.tags || [],
    filePath: overrides.filePath || null,
    originalFileName: overrides.originalFileName || null,
    cover: overrides.cover || null,
    fileSize: overrides.fileSize ?? null,
    mimeType: overrides.mimeType || null,
    promptText: overrides.promptText || (kind === "prompt" ? "" : null),
    featured: false,
    published: false,
    displayOrder: resources.length + 1,
    youtubeUrl: null,
    instagramUrl: null,
    viewPath: null,
  };
}

function publicAssetUrl(path) {
  return path ? `/${String(path).replace(/^\/+/, "")}` : "";
}

function mimeForPath(path) {
  return MIME_BY_EXTENSION[extensionOf(path)] || "application/octet-stream";
}

function publishedStagedPaths(catalog, files) {
  const referenced = new Set();
  catalog.resources
    .filter((resource) => resource.published === true)
    .forEach((resource) => {
      [resource.filePath, resource.cover, resource.viewPath]
        .filter((path) => path && isAllowedFilePath(path))
        .forEach((path) => referenced.add(path));
    });
  return Object.keys(files).filter((path) => isAllowedFilePath(path) && referenced.has(path));
}

function validatePackageManifest(zipFiles) {
  const manifestBytes = zipFiles.get("resource-package-manifest.json");
  if (!manifestBytes) return { listedFiles: null, legacy: true };

  let manifest;
  try {
    manifest = JSON.parse(decodeText(manifestBytes));
  } catch {
    throw new Error("The ZIP package manifest is not valid JSON. Export it again from Resource Studio.");
  }
  if (manifest?.format !== "ts-nextstep-resource-package" || manifest?.version !== 1 || !Array.isArray(manifest.files)) {
    throw new Error("This ZIP package uses an unsupported Resource Studio format. Export a fresh recovery ZIP.");
  }

  const listedFiles = new Set();
  for (const entry of manifest.files) {
    if (typeof entry !== "string" || !entry.startsWith("public/") || !isAllowedFilePath(entry.slice("public/"))) {
      throw new Error("The ZIP manifest contains an unsafe or unsupported public file path.");
    }
    if (listedFiles.has(entry) || !zipFiles.has(entry)) {
      throw new Error(`The ZIP manifest is missing its listed file: ${entry}`);
    }
    listedFiles.add(entry);
  }

  for (const name of zipFiles.keys()) {
    if (name.startsWith("public/") && isAllowedFilePath(name.slice("public/")) && !listedFiles.has(name)) {
      throw new Error(`The ZIP contains an unlisted managed resource file: ${name}`);
    }
  }
  return { listedFiles, legacy: false };
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadJson(value, fileName) {
  downloadBlob(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }), fileName);
}

function useObjectUrl(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url;
}

function PreviewPanel({ resource, file }) {
  const objectUrl = useObjectUrl(file);
  const [fileText, setFileText] = useState("");
  useEffect(() => {
    let active = true;
    setFileText("");
    if (file && ["prompt", "note"].includes(resource?.kind)) {
      void file.text().then((text) => { if (active) setFileText(text); });
    }
    return () => { active = false; };
  }, [file, resource?.kind]);
  const sourcePath = resource?.kind === "image" ? resource.filePath : resource?.filePath || resource?.cover;
  const sourceUrl = objectUrl || publicAssetUrl(sourcePath);
  const isText = resource?.kind === "prompt" || resource?.kind === "note";

  if (!resource) {
    return <div className="studio-preview-empty"><Icon name="eye" /><h3>Select a resource</h3><p>Choose a card to preview its file and edit its details.</p></div>;
  }

  return (
    <div className="studio-preview-panel">
      <div className="studio-panel-heading">
        <div><span className="studio-kicker">Preview</span><h2>{resource.title}</h2></div>
        <span className={`studio-status studio-status-${resource.published ? "published" : "draft"}`}>{resource.published ? "Published" : "Draft"}</span>
      </div>
      <div className="studio-preview-stage">
        {resource.kind === "pdf" && sourceUrl ? <iframe title={`${resource.title} PDF preview`} src={sourceUrl} /> : null}
        {resource.kind === "image" && sourceUrl ? <img src={sourceUrl} alt={`${resource.title} preview`} /> : null}
        {isText ? <pre>{resource.promptText || fileText || "No text has been added yet."}</pre> : null}
        {resource.kind === "episode" ? (
          <div className="studio-external-preview">
            <span className="studio-preview-number">{resource.number || "TS"}</span>
            {sourceUrl ? <img src={sourceUrl} alt={`${resource.title} cover`} /> : null}
            <p>This is an existing public TS nextstep build note. Use the public links to open it.</p>
            <div className="studio-preview-links">
              {resource.youtubeUrl ? <a href={resource.youtubeUrl} target="_blank" rel="noopener noreferrer">YouTube</a> : null}
              {resource.instagramUrl ? <a href={resource.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a> : null}
            </div>
          </div>
        ) : null}
        {!sourceUrl && !isText && resource.kind !== "episode" ? <div className="studio-preview-empty"><Icon name="folder" /><h3>File not attached</h3><p>Add a real file before publishing this resource.</p></div> : null}
      </div>
      <dl className="studio-preview-meta">
        <div><dt>Format</dt><dd>{resource.type || resource.kind}</dd></div>
        <div><dt>Category</dt><dd>{resource.category || resource.categoryId}</dd></div>
        <div><dt>File</dt><dd>{fileNameFromPath(resource.filePath) || resource.originalFileName || "External asset"}</dd></div>
        <div><dt>Size</dt><dd>{formatBytes(resource.fileSize)}</dd></div>
      </dl>
    </div>
  );
}

function ResourceRow({ resource, index, isFirst, isLast, selected, onSelect, onPreview, onMove, onDelete, onDragStart, onDrop }) {
  return (
    <article
      className={`studio-resource-row${selected ? " is-selected" : ""}`}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
      onDrop={(event) => { event.preventDefault(); onDrop(resource.id); }}
    >
      <button className="studio-drag-handle" type="button" draggable="true" onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", resource.id); onDragStart(resource.id); }} aria-label={`Drag ${resource.title} to reorder`} title="Drag to reorder">
        <Icon name="grip" />
      </button>
      <div className="studio-row-number">{String(resource.displayOrder || index + 1).padStart(2, "0")}</div>
      <div className="studio-row-main" role="button" tabIndex="0" aria-pressed={selected} aria-label={`Select ${resource.title || "resource"}`} onClick={() => onSelect(resource.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(resource.id); } }}>
        <div className="studio-row-heading">
          <h3>{resource.title || "Untitled resource"}</h3>
          <div className="studio-row-badges">
            {resource.featured ? <span className="studio-badge studio-badge-featured">Featured</span> : null}
            <span className={`studio-badge studio-badge-${resource.published ? "published" : "draft"}`}>{resource.published ? "Published" : "Draft"}</span>
          </div>
        </div>
        <p>{resource.description || "No description yet."}</p>
        <div className="studio-row-meta">
          <span>{resource.kind}</span><span>{resource.category || resource.categoryId}</span><span>{fileNameFromPath(resource.filePath) || resource.originalFileName || "External asset"}</span>
        </div>
      </div>
      <div className="studio-row-actions" aria-label={`${resource.title} actions`}>
        <button type="button" onClick={() => onPreview(resource.id)} title="Preview"><Icon name="eye" /><span className="studio-visually-hidden">Preview</span></button>
        <button type="button" onClick={() => onSelect(resource.id)} title="Edit details"><Icon name="edit" /><span className="studio-visually-hidden">Edit details</span></button>
        <button type="button" onClick={() => onMove(resource.id, -1)} disabled={isFirst} title="Move up"><Icon name="up" /><span className="studio-visually-hidden">Move up</span></button>
        <button type="button" onClick={() => onMove(resource.id, 1)} disabled={isLast} title="Move down"><Icon name="down" /><span className="studio-visually-hidden">Move down</span></button>
        <button className="studio-delete-button" type="button" onClick={() => onDelete(resource.id)} title="Delete resource"><Icon name="trash" /><span className="studio-visually-hidden">Delete resource</span></button>
      </div>
    </article>
  );
}

function EditorPanel({ draft, categories, fileName, files, resources, editorIsDirty, onChange, onFileNameChange, onSave, onCancel, onChangeCover, onReplaceFile }) {
  if (!draft) {
    return <div className="studio-editor-empty"><Icon name="edit" /><h3>Edit details</h3><p>Select a resource from the list, or add a prompt to begin.</p></div>;
  }

  const imageOptions = resources.filter((resource) => resource.kind === "image" && resource.filePath);
  const canEditFile = Boolean(draft.filePath && files[draft.filePath]);
  const hasActualFile = Boolean(draft.filePath);

  return (
    <div className="studio-editor-panel">
      <div className="studio-panel-heading">
        <div><span className="studio-kicker">Edit details</span><h2>{draft.title || "Untitled resource"}</h2>{editorIsDirty ? <span className="studio-unsaved-label">Unsaved edits · save before leaving</span> : null}</div>
        <span className="studio-editor-id">{draft.id}</span>
      </div>

      <div className="studio-form-grid">
        <label className="studio-field studio-field-wide">
          <span>Display title</span>
          <input value={draft.title} onChange={(event) => onChange("title", event.target.value)} placeholder="A clear public title" />
          <small>This changes the public title, not the actual file name.</small>
        </label>
        <label className="studio-field studio-field-wide">
          <span>Description</span>
          <textarea aria-label="Description" rows="4" value={draft.description} onChange={(event) => onChange("description", event.target.value)} placeholder="What will someone learn or use?" />
        </label>
        <label className="studio-field">
          <span>Resource type</span>
          <select value={draft.kind} onChange={(event) => onChange("kind", event.target.value)} disabled={draft.kind === "episode"}>
            <option value="pdf">PDF</option>
            <option value="prompt">Prompt</option>
            <option value="note">Note</option>
            <option value="image">Image</option>
            {draft.kind === "episode" ? <option value="episode">Build note</option> : null}
          </select>
        </label>
        <label className="studio-field">
          <span>Category</span>
          <select value={draft.categoryId} onChange={(event) => onChange("categoryId", event.target.value)}>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
          </select>
        </label>
        <label className="studio-field studio-field-wide">
          <span>Tags</span>
          <input value={(draft.tags || []).join(", ")} onChange={(event) => onChange("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="python, memory, learning" />
          <small>Separate tags with commas.</small>
        </label>
        <label className="studio-field studio-field-wide">
          <span>Cover image</span>
          <select value={draft.cover || ""} onChange={(event) => onChangeCover(event.target.value || null)}>
            <option value="">No cover image</option>
            {draft.cover && !imageOptions.some((resource) => resource.filePath === draft.cover) ? <option value={draft.cover}>{fileNameFromPath(draft.cover)} (current)</option> : null}
            {imageOptions.map((resource) => <option key={resource.filePath} value={resource.filePath}>{resource.title} · {fileNameFromPath(resource.filePath)}</option>)}
          </select>
          <small>Upload an image, then assign it here as a cover.</small>
        </label>
        {hasActualFile ? (
          <label className="studio-field studio-field-wide">
            <span>Actual file name on export</span>
            <input value={fileName} onChange={(event) => onFileNameChange(event.target.value)} disabled={!canEditFile} />
            <small>{canEditFile ? "Changing this creates a new safe filename and updates catalog references." : "This is an existing repository file. Re-upload it to rename it from the Studio."}</small>
          </label>
        ) : null}
        {draft.kind !== "episode" ? <label className="studio-field studio-field-wide">
          <span>{hasActualFile ? "Replace attached file" : "Attach a file"}</span>
          <input type="file" accept={FILE_RULES[draft.kind]?.extensions.join(",")} onChange={(event) => { onReplaceFile(event.target.files?.[0]); event.target.value = ""; }} />
          <small>Optional. Your existing file is preserved unless you select a replacement and save.</small>
        </label> : null}
        {draft.kind === "prompt" ? (
          <label className="studio-field studio-field-wide">
            <span>Prompt text</span>
            <textarea className="studio-prompt-editor" rows="12" value={draft.promptText || ""} onChange={(event) => onChange("promptText", event.target.value)} placeholder="Write the actual prompt visitors may copy." />
            <small>Visitors can copy this exact text only when the prompt is published.</small>
          </label>
        ) : null}
      </div>

      <div className="studio-toggle-row">
        <label className="studio-toggle"><input type="checkbox" checked={draft.featured} onChange={(event) => onChange("featured", event.target.checked)} /><span>Featured resource</span></label>
        <label className="studio-toggle"><input type="checkbox" checked={draft.published} onChange={(event) => onChange("published", event.target.checked)} /><span>Visible on public website</span></label>
      </div>
      <p className="studio-visibility-note">Saving validates and refreshes this local project only. It never commits, pushes or deploys.</p>

      <div className="studio-editor-actions">
        <button className="studio-button studio-button-primary" type="button" onClick={onSave}><Icon name="check" /> Save Changes</button>
        <button className="studio-button studio-button-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function FirstUseGuide() {
  return (
    <details className="studio-guide" open>
      <summary><span><span className="studio-kicker">First time here?</span><strong>Use the Studio in four steps.</strong></span><span className="studio-guide-arrow">⌄</span></summary>
      <ol>
        <li><b>Add Files</b> for PDFs, prompt files, notes or cover images. New files start as drafts.</li>
        <li><b>Edit Details</b> to set the public title, description, category, tags, cover and visibility.</li>
        <li><b>Arrange</b> resources with the grip or the keyboard Move Up / Move Down buttons.</li>
        <li><b>Save Changes</b> to validate the canonical catalog and refresh the local portfolio. Use <b>Export ZIP</b> as recovery.</li>
      </ol>
      <p className="studio-guide-note">Your browser draft is recoverable, but project saves are still local only. Review the preview, run the production build deliberately, and deploy through GitHub Pages only after explicit approval.</p>
    </details>
  );
}

export default function ResourceStudio() {
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const [files, setFiles] = useState({});
  const [storageName, setStorageName] = useState("loading");
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [fileName, setFileName] = useState("");
  const [history, setHistory] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState("checking");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [replacementFile, setReplacementFile] = useState(null);
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);
  const bridgeTokenRef = useRef(null);
  const bridgeQueueRef = useRef(Promise.resolve());
  const saveSequenceRef = useRef(0);

  const categories = catalog.categories?.length ? catalog.categories : DEFAULT_CATEGORIES;
  const selected = catalog.resources.find((resource) => resource.id === selectedId) || null;
  const previewResource = catalog.resources.find((resource) => resource.id === previewId) || selected;
  const previewFile = previewResource?.filePath ? files[previewResource.filePath] : null;
  const editorIsDirty = Boolean(replacementFile || (draft && selected && JSON.stringify({ ...draft, category: undefined, fileName }) !== JSON.stringify({ ...selected, category: undefined, fileName: fileNameFromPath(selected.filePath) })));

  useEffect(() => {
    if (!editorIsDirty && saveStatus !== "saving") return undefined;
    const warnBeforeLeave = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [editorIsDirty, saveStatus]);

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
    window.clearTimeout(showNotice.timer);
    if (type === "success") showNotice.timer = window.setTimeout(() => setNotice(null), 7000);
  }, []);

  const bridgeRequest = useCallback(async (endpoint, options = {}) => {
    let token = bridgeTokenRef.current;
    if (!token) {
      const session = await fetch(`${BRIDGE_URL}/api/session`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      if (!session.ok) throw new Error("The local bridge rejected the Studio origin.");
      token = (await session.json()).token;
      bridgeTokenRef.current = token;
    }
    const request = (currentToken) => fetch(`${BRIDGE_URL}${endpoint}`, {
      ...options,
      signal: AbortSignal.timeout(60000),
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${currentToken}`, ...(options.headers || {}) },
    });
    let response = await request(token);
    if (response.status === 401) {
      bridgeTokenRef.current = null;
      const session = await fetch(`${BRIDGE_URL}/api/session`, { signal: AbortSignal.timeout(5000) });
      if (!session.ok) throw new Error("The local bridge rejected the Studio origin. Open http://127.0.0.1:4174.");
      bridgeTokenRef.current = (await session.json()).token;
      response = await request(bridgeTokenRef.current);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) bridgeTokenRef.current = null;
      throw new Error(payload.error || `Bridge request failed (${response.status}).`);
    }
    setBridgeStatus("connected");
    return payload;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadDraft(INITIAL_CATALOG)
      .then(async (saved) => {
        if (cancelled) return;
        const browserCatalog = normalizeCatalog(saved.catalog);
        const browserFiles = saved.files || {};
        const hasUnsyncedBrowserChanges = saved.synced !== true && (
          JSON.stringify(browserCatalog) !== JSON.stringify(INITIAL_CATALOG) || Object.keys(browserFiles).length > 0
        );

        try {
          const state = await bridgeRequest("/api/state");
          if (cancelled) return;

          // A successfully bridged draft is project state, not a stale browser
          // cache. Unsynced browser work is deliberately kept visible so a
          // failed bridge save can be recovered instead of silently discarded.
          const nextCatalog = hasUnsyncedBrowserChanges ? browserCatalog : normalizeCatalog(state.catalog);
          const bridgedFiles = decodeBridgeFiles(state.files);
          const nextFiles = hasUnsyncedBrowserChanges ? { ...bridgedFiles, ...browserFiles } : bridgedFiles;
          setCatalog(nextCatalog);
          setFiles(nextFiles);
          setStorageName(hasUnsyncedBrowserChanges ? `${saved.storage} recovery` : "local project bridge");
          setReady(true);
          const first = nextCatalog.resources[0] || null;
          setSelectedId(first?.id || null);
          setPreviewId(first?.id || null);
          setDraft(first ? { ...first, tags: [...(first.tags || [])] } : null);
          setFileName(fileNameFromPath(first?.filePath));
          if (!hasUnsyncedBrowserChanges) await saveDraft(nextCatalog, nextFiles, { synced: true });
          if (hasUnsyncedBrowserChanges) {
            setSaveStatus("unsynced");
            showNotice("warning", "An unsynced browser recovery draft is open. Review it, then use Save to local project when the bridge is ready.");
          }
        } catch (error) {
          if (cancelled) return;
          setCatalog(browserCatalog);
          setFiles(browserFiles);
          setStorageName(saved.storage);
          setReady(true);
          setBridgeStatus("unavailable");
          const first = browserCatalog.resources[0] || null;
          setSelectedId(first?.id || null);
          setPreviewId(first?.id || null);
          setDraft(first ? { ...first, tags: [...(first.tags || [])] } : null);
          setFileName(fileNameFromPath(first?.filePath));
          showNotice("warning", `${error.message || "The local bridge is unavailable."} ${hasUnsyncedBrowserChanges ? "Showing your browser recovery draft." : "Project resources could not be loaded."} Use the TS nextstep — Start All desktop shortcut, then reload or save again.`);
        }
      })
      .catch((error) => {
        setReady(true);
        setStorageName("unavailable");
        setNotice({ type: "error", text: error.message || "Could not load the local draft. The Studio is using the starter catalog." });
      });
    return () => { cancelled = true; };
  }, [bridgeRequest, showNotice]);

  const syncBridge = useCallback((nextCatalog, nextFiles, operation = "save", deleteResourceId = null) => {
    const sequence = ++saveSequenceRef.current;
    setSaveStatus("saving");
    const run = bridgeQueueRef.current.then(async () => {
    try {
      const filesForBridge = await encodeBridgeFiles(nextFiles);
      const payload = await bridgeRequest("/api/commit", {
        method: "POST",
        body: JSON.stringify({ catalog: nextCatalog, files: filesForBridge, operation, deleteResourceId }),
      });
      // Mark the browser copy clean only after the bridge has confirmed the
      // canonical catalog, manifests and managed files were written.
      if (sequence === saveSequenceRef.current) {
        await saveDraft(nextCatalog, nextFiles, { synced: true });
        setStorageName("local project bridge");
        setSaveStatus("saved");
        const warning = payload.warnings?.length ? ` ${payload.warnings.slice(0, 2).join(" ")}` : "";
        showNotice("success", `Saved to the local project. ${payload.publicResourceCount} published resources; public files and both manifests updated. The local portfolio refreshes automatically. GitHub Pages is unchanged.${warning}`);
      }
      return payload;
    } catch (error) {
      setBridgeStatus("unavailable");
      setSaveStatus("unsynced");
      showNotice("error", `${error.message || "The local bridge is unavailable."} This change is NOT saved to the project. Your browser recovery draft is kept. Use TS nextstep — Start All, then Save to local project to retry.`);
      return null;
    }
    });
    bridgeQueueRef.current = run.catch(() => undefined);
    return run;
  }, [bridgeRequest, showNotice]);

  const persist = useCallback(async (nextCatalog, nextFiles = files) => {
    setCatalog(nextCatalog);
    setFiles(nextFiles);
    try {
      const storage = await saveDraft(nextCatalog, nextFiles);
      setStorageName(storage);
    } catch (error) {
      showNotice("error", error.message || "The draft could not be saved locally.");
    }
  }, [files, showNotice]);

  const commitCatalog = useCallback((nextCatalog, message = "Draft saved locally.", nextFiles = files, operation = "save", deleteResourceId = null) => {
    setHistory((previous) => [...previous.slice(-19), { catalog, files: { ...files } }]);
    const normalized = normalizeCatalog(nextCatalog);
    void persist(normalized, nextFiles);
    void syncBridge(normalized, nextFiles, operation, deleteResourceId);
  }, [catalog, files, persist, syncBridge]);

  const selectResource = useCallback((id) => {
    if (id !== selectedId && editorIsDirty && !window.confirm("Discard unsaved editor changes? Saved project resources are not affected.")) return;
    const resource = catalog.resources.find((item) => item.id === id);
    if (!resource) return;
    setSelectedId(id);
    setPreviewId(id);
    setDraft({ ...resource, tags: [...(resource.tags || [])] });
    setFileName(fileNameFromPath(resource.filePath));
    setReplacementFile(null);
  }, [catalog.resources, editorIsDirty, selectedId]);

  const resetEditor = useCallback(() => {
    setReplacementFile(null);
    if (selected) {
      setDraft({ ...selected, tags: [...(selected.tags || [])] });
      setFileName(fileNameFromPath(selected.filePath));
    } else {
      setDraft(null);
      setFileName("");
    }
  }, [selected]);

  const filteredResources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.resources.filter((resource) => {
      const searchable = [resource.title, resource.description, resource.category, resource.categoryId, resource.originalFileName, resource.filePath, ...(resource.tags || [])].filter(Boolean).join(" ").toLowerCase();
      return (filter === "all" || resource.kind === filter) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [catalog.resources, filter, query]);

  const handleFiles = useCallback(async (incoming) => {
    const fileList = Array.from(incoming || []);
    if (!fileList.length) return;
    let nextCatalog = catalog;
    let nextFiles = { ...files };
    let lastId = null;
    const errors = [];

    for (const file of fileList) {
      const kind = getKindFromFile(file.name);
      const check = validateUploadFile(file, kind);
      if (!check.valid) {
        errors.push(`${file.name}: ${check.errors.join(" ")}`);
        continue;
      }

      const originalName = file.name;
      const storedPath = uniqueResourcePath(kind, originalName, nextCatalog.resources, nextFiles);
      const titleStem = originalName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
      const promptText = kind === "prompt" ? await file.text() : null;
      const resource = newResource(kind, {
        id: `${kind}-${titleStem}`,
        title: titleStem || "Untitled resource",
        description: kind === "prompt" ? "A prompt imported for review." : kind === "image" ? "A cover image available for assignment." : "Imported public resource.",
        categoryId: kind === "prompt" ? "prompts" : kind === "pdf" ? "guides" : kind === "note" ? "study" : "other",
        filePath: storedPath,
        originalFileName: originalName,
        fileSize: file.size,
        mimeType: file.type || mimeForPath(storedPath),
        promptText,
      }, nextCatalog);
      nextCatalog = normalizeCatalog({ ...nextCatalog, resources: [...nextCatalog.resources, resource] });
      nextFiles[storedPath] = file;
      lastId = resource.id;
    }

    if (lastId) {
      setHistory((previous) => [...previous.slice(-19), { catalog, files: { ...files } }]);
      await persist(nextCatalog, nextFiles);
      void syncBridge(nextCatalog, nextFiles);
      setSelectedId(lastId);
      setPreviewId(lastId);
      const added = nextCatalog.resources.find((resource) => resource.id === lastId);
      setDraft(added ? { ...added, tags: [...(added.tags || [])] } : null);
      setFileName(added ? fileNameFromPath(added.filePath) : "");
      showNotice(errors.length ? "warning" : "success", errors.length ? `Added valid files. ${errors.join(" ")}` : `Added ${fileList.length} file${fileList.length === 1 ? "" : "s"} as draft resources.`);
    } else if (errors.length) {
      showNotice("error", errors.join(" "));
    }
  }, [catalog, files, persist, showNotice, syncBridge]);

  const onFileInput = (event) => {
    void handleFiles(event.target.files);
    event.target.value = "";
  };

  const onDropFiles = (event) => {
    event.preventDefault();
    setDragActive(false);
    void handleFiles(event.dataTransfer.files);
  };

  const addPrompt = useCallback(() => {
    const prompt = newResource("prompt", {
      id: "new-prompt",
      title: "New prompt",
      description: "A practical prompt ready for editing.",
      categoryId: "prompts",
      promptText: "",
    }, catalog);
    const nextCatalog = normalizeCatalog({ ...catalog, resources: [...catalog.resources, prompt] });
    commitCatalog(nextCatalog, "New prompt added as a local draft.");
    setSelectedId(prompt.id);
    setPreviewId(prompt.id);
    setDraft({ ...prompt });
    setFileName("");
  }, [catalog, commitCatalog]);

  const saveEditor = useCallback(() => {
    if (!draft) return;
    const oldResource = catalog.resources.find((resource) => resource.id === draft.id);
    if (!oldResource) return;

    let nextFiles = { ...files };
    let nextPath = draft.filePath;
    let currentFile = replacementFile || (draft.filePath ? files[draft.filePath] : null);
    const kindChanged = draft.kind !== oldResource.kind && draft.kind !== "episode";
    if (currentFile && (fileName || kindChanged || replacementFile)) {
      const candidateName = sanitizeFileName(fileName || currentFile.name, currentFile.name);
      nextPath = uniqueResourcePath(draft.kind, candidateName, catalog.resources, files, oldResource.filePath);
      nextFiles[nextPath] = currentFile;
      if (oldResource.filePath && nextPath !== oldResource.filePath) {
        delete nextFiles[oldResource.filePath];
      }
    }
    if (draft.kind === "prompt" && nextPath && currentFile && draft.promptText !== oldResource.promptText) {
      currentFile = new File([draft.promptText || ""], fileNameFromPath(nextPath), { type: mimeForPath(nextPath) });
      nextFiles[nextPath] = currentFile;
    }

    const nextResource = {
      ...draft,
      type: draft.kind === "episode" ? "external" : draft.kind,
      category: undefined,
      filePath: nextPath,
      originalFileName: replacementFile?.name || draft.originalFileName || (currentFile ? currentFile.name : null),
      fileSize: currentFile?.size ?? draft.fileSize ?? null,
      mimeType: currentFile?.type || draft.mimeType || (nextPath ? mimeForPath(nextPath) : null),
      tags: Array.from(new Set((draft.tags || []).map((tag) => String(tag).trim()).filter(Boolean))).slice(0, 16),
    };

    let nextResources = catalog.resources.map((resource) => resource.id === draft.id ? nextResource : resource);
    if (oldResource.filePath && nextPath !== oldResource.filePath) {
      nextResources = nextResources.map((resource) => ({
        ...resource,
        cover: resource.cover === oldResource.filePath ? nextPath : resource.cover,
        viewPath: resource.viewPath === oldResource.filePath ? nextPath : resource.viewPath,
      }));
    }
    const nextCatalog = normalizeCatalog({ ...catalog, resources: nextResources });
    const validation = validateCatalog(nextCatalog, { fileExists: (path) => projectAssetExists(path, nextFiles) });
    if (!validation.valid) {
      showNotice("error", validation.errors.slice(0, 3).join(" "));
      return;
    }
    commitCatalog(nextCatalog, "Changes saved to the local draft.", nextFiles);
    setDraft({ ...nextResource, category: getCategoryLabel(nextResource.categoryId, categories) });
    setFileName(fileNameFromPath(nextPath));
    setReplacementFile(null);
  }, [catalog, categories, commitCatalog, draft, fileName, files, replacementFile, showNotice]);

  const move = useCallback((id, direction) => {
    const nextResources = moveResource(catalog.resources, id, direction);
    commitCatalog({ ...catalog, resources: nextResources }, "Display order saved locally.");
  }, [catalog, commitCatalog]);

  const dropReorder = useCallback((targetId) => {
    if (!draggedId || draggedId === targetId) return;
    const nextResources = reorderResources(catalog.resources, draggedId, targetId);
    commitCatalog({ ...catalog, resources: nextResources }, "Display order saved locally.");
    setDraggedId(null);
  }, [catalog, commitCatalog, draggedId]);

  const deleteResource = useCallback((id) => {
    const resource = catalog.resources.find((item) => item.id === id);
    if (!resource) return;
    const confirmed = window.confirm(`Delete “${resource.title}” from the Studio catalog? The local bridge keeps a backup and moves unshared files to recoverable trash. Undo is available during this session.`);
    if (!confirmed) return;
    const nextFiles = { ...files };
    if (resource.filePath && nextFiles[resource.filePath]) delete nextFiles[resource.filePath];
    const nextResources = catalog.resources
      .filter((item) => item.id !== id)
      .map((item) => ({ ...item, cover: item.cover === resource.filePath ? null : item.cover }));
    const nextCatalog = normalizeCatalog({ ...catalog, resources: withDisplayOrder(nextResources) });
    commitCatalog(nextCatalog, "Resource removed from the local catalog.", nextFiles, "delete", id);
    const nextSelected = nextCatalog.resources[0] || null;
    setSelectedId(nextSelected?.id || null);
    setPreviewId(nextSelected?.id || null);
    setDraft(nextSelected ? { ...nextSelected, tags: [...(nextSelected.tags || [])] } : null);
    setFileName(fileNameFromPath(nextSelected?.filePath));
    setReplacementFile(null);
  }, [catalog, commitCatalog, files, showNotice]);

  const undo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    void persist(previous.catalog, previous.files);
    void syncBridge(previous.catalog, previous.files, "restore");
    const resource = previous.catalog.resources.find((item) => item.id === selectedId) || previous.catalog.resources[0] || null;
    setSelectedId(resource?.id || null);
    setPreviewId(resource?.id || null);
    setDraft(resource ? { ...resource, tags: [...(resource.tags || [])] } : null);
    setFileName(fileNameFromPath(resource?.filePath));
    showNotice("success", "Undid the last catalog change.");
  }, [history, persist, selectedId, showNotice, syncBridge]);

  const changeDraft = (field, value) => setDraft((current) => current ? { ...current, [field]: value } : current);

  const changeCover = (value) => setDraft((current) => current ? { ...current, cover: value } : current);

  const replaceFile = async (file) => {
    if (!file || !draft) return;
    const check = validateUploadFile(file, draft.kind);
    if (!check.valid) { showNotice("error", check.errors.join(" ")); return; }
    setReplacementFile(file);
    if (!draft.filePath) setFileName(file.name);
    if (draft.kind === "prompt") changeDraft("promptText", await file.text());
    showNotice("warning", "Replacement staged. Save Changes to replace the file; Cancel keeps the current file.");
  };

  const getKnownFileExists = useCallback((path, extraFiles = files) => projectAssetExists(path, extraFiles), [files]);

  const validateForExport = useCallback(() => {
    const result = validateCatalog(catalog, { fileExists: (path) => getKnownFileExists(path) });
    if (!result.valid) {
      showNotice("error", result.errors.slice(0, 5).join(" "));
      return null;
    }
    if (result.warnings.length) showNotice("warning", result.warnings.slice(0, 3).join(" "));
    return result;
  }, [catalog, getKnownFileExists, showNotice]);

  const exportCatalog = useCallback(() => {
    const result = validateForExport();
    if (!result) return;
    downloadJson(result.catalog, "resource-catalog.json");
    showNotice("success", "Catalog exported. It contains drafts and published metadata for review.");
  }, [showNotice, validateForExport]);

  const exportPackage = useCallback(async () => {
    const result = validateForExport();
    if (!result) return;
    const publicCatalog = toPublicCatalog(result.catalog);
    const includedFiles = publishedStagedPaths(result.catalog, files);
    const omittedDraftFiles = Object.keys(files).filter((path) => isAllowedFilePath(path) && !includedFiles.includes(path));
    const manifest = {
      format: "ts-nextstep-resource-package",
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceCatalog: "src/data/resourceCatalog.json",
      publicManifest: "public/assets/resources/resources.json",
      files: includedFiles.map((path) => `public/${path}`),
      omittedDraftFiles,
      note: "Overlay this package onto the repository after reviewing it. Only files referenced by published records are included. Draft files remain local and are never copied into public/.",
    };
    const entries = [
      { name: "src/data/resourceCatalog.json", data: `${JSON.stringify(result.catalog, null, 2)}\n` },
      { name: "src/data/resourceCatalog.public.json", data: `${JSON.stringify(publicCatalog, null, 2)}\n` },
      { name: "public/assets/resources/resources.json", data: `${JSON.stringify(publicCatalog, null, 2)}\n` },
      { name: "resource-package-manifest.json", data: `${JSON.stringify(manifest, null, 2)}\n` },
      { name: "RESOURCE-STUDIO-README.md", data: "# Resource Studio package\n\nReview this overlay, copy it into the portfolio repository, run npm run build, inspect dist/, and then use the existing GitHub Pages deployment process. No file is published by this download.\n" },
    ];
    includedFiles.forEach((path) => entries.push({ name: `public/${path}`, data: files[path] }));
    try {
      const zip = await createZip(entries);
      downloadBlob(zip, `tsnextstep-resource-package-${new Date().toISOString().slice(0, 10)}.zip`);
      showNotice("success", `Exported ${includedFiles.length} published file${includedFiles.length === 1 ? "" : "s"}. ${omittedDraftFiles.length ? `${omittedDraftFiles.length} draft file${omittedDraftFiles.length === 1 ? " was" : "s were"} kept local.` : ""}`);
    } catch (error) {
      showNotice("error", error.message || "Could not create the resource package.");
    }
  }, [files, showNotice, validateForExport]);

  const importPackage = useCallback(async (file) => {
    if (!file) return;
    try {
      let importedCatalog;
      let importedFiles = {};
      let legacyPackage = false;
      if (extensionOf(file.name) === ".zip") {
        const zipFiles = await readZip(file);
        const packageInfo = validatePackageManifest(zipFiles);
        legacyPackage = packageInfo.legacy;
        const catalogBytes = zipFiles.get("src/data/resourceCatalog.json") || zipFiles.get("resource-catalog.json") || zipFiles.get("public/assets/resources/resources.json");
        if (!catalogBytes) throw new Error("The ZIP did not contain a resource catalog.");
        importedCatalog = JSON.parse(decodeText(catalogBytes));
        for (const [name, bytes] of zipFiles.entries()) {
          if (!name.startsWith("public/")) continue;
          const path = name.slice("public/".length);
          if (!isAllowedFilePath(path)) continue;
          if (packageInfo.listedFiles && !packageInfo.listedFiles.has(name)) continue;
          importedFiles[path] = new File([bytes], fileNameFromPath(path), { type: mimeForPath(path) });
        }
      } else {
        importedCatalog = JSON.parse(await file.text());
      }

      const normalized = normalizeCatalog(importedCatalog);
      const validation = validateCatalog(normalized, { fileExists: (path) => getKnownFileExists(path, importedFiles) });
      if (!validation.valid) throw new Error(validation.errors.slice(0, 5).join(" "));
      const confirmed = window.confirm("Import this package and replace the current local draft? A catalog backup will download first. Existing repository files will not be deleted.");
      if (!confirmed) return;
      downloadJson(catalog, `resource-catalog-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      await persist(normalized, importedFiles);
      setHistory([]);
      const first = normalized.resources[0] || null;
      setSelectedId(first?.id || null);
      setPreviewId(first?.id || null);
      setDraft(first ? { ...first, tags: [...(first.tags || [])] } : null);
      setFileName(fileNameFromPath(first?.filePath));
      showNotice("success", `Imported ${normalized.resources.length} catalog records. ${legacyPackage ? "This is a legacy ZIP without a package manifest; export a fresh recovery ZIP after review. " : ""}Review them before saving to the local project.`);
    } catch (error) {
      showNotice("error", error.message || "The package could not be imported.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [catalog, getKnownFileExists, persist, showNotice]);

  const readRepositoryFile = async (directory, parts) => {
    let current = directory;
    for (const part of parts.slice(0, -1)) current = await current.getDirectoryHandle(part);
    return current.getFileHandle(parts[parts.length - 1]);
  };

  const writeRepositoryFile = async (directory, relativePath, data) => {
    const parts = relativePath.split("/");
    let current = directory;
    for (const part of parts.slice(0, -1)) current = await current.getDirectoryHandle(part, { create: true });
    const handle = await current.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  };

  const saveToRepository = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      showNotice("warning", "This browser cannot write to a local folder. Use Export ZIP instead.");
      return;
    }
    const result = validateForExport();
    if (!result) return;
    try {
      const root = await window.showDirectoryPicker({ mode: "readwrite", id: "tsnextstep-resource-studio" });
      await root.getFileHandle("package.json");
      const sourceDirectory = await root.getDirectoryHandle("src");
      await sourceDirectory.getFileHandle("App.jsx");
      const publicDirectory = await root.getDirectoryHandle("public");
      await publicDirectory.getDirectoryHandle("assets");
      const publicCatalog = toPublicCatalog(result.catalog);
      const targetPaths = publishedStagedPaths(result.catalog, files);
      const replace = targetPaths.length ? window.confirm(`Save the catalog and ${targetPaths.length} staged file${targetPaths.length === 1 ? "" : "s"} to this repository? Existing target files will be replaced only after this confirmation.`) : true;
      if (!replace) return;
      let previousCatalog = null;
      try {
        const oldHandle = await readRepositoryFile(root, ["src", "data", "resourceCatalog.json"]);
        previousCatalog = JSON.parse(await (await oldHandle.getFile()).text());
      } catch {
        // A new repository will simply receive the authoring catalog.
      }
      if (previousCatalog) downloadJson(previousCatalog, `resource-catalog-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      await writeRepositoryFile(root, "src/data/resourceCatalog.json", `${JSON.stringify(result.catalog, null, 2)}\n`);
      await writeRepositoryFile(root, "src/data/resourceCatalog.public.json", `${JSON.stringify(publicCatalog, null, 2)}\n`);
      await writeRepositoryFile(root, "public/assets/resources/resources.json", `${JSON.stringify(publicCatalog, null, 2)}\n`);
      for (const path of targetPaths) await writeRepositoryFile(root, `public/${path}`, files[path]);
      showNotice("success", "Saved the prepared catalog and staged files to the selected repository. Nothing has been published; run npm run build next.");
    } catch (error) {
      if (error?.name !== "AbortError") showNotice("error", error.message || "Could not save to that repository folder.");
    }
  }, [files, showNotice, validateForExport]);

  const saveToLocalProject = useCallback(() => {
    void syncBridge(catalog, files);
  }, [catalog, files, syncBridge]);

  const previewIndex = previewResource ? catalog.resources.findIndex((resource) => resource.id === previewResource.id) : -1;

  return (
    <div className="resource-studio-app">
      <header className="studio-header">
        <div className="studio-brand-lockup">
          <span className="studio-brand-mark">TS</span>
          <div><span className="studio-kicker">Owner tool · local only</span><h1>Resource Studio</h1></div>
        </div>
        <div className="studio-header-actions">
          <span className={`studio-storage-status is-${storageName === "loading" ? "loading" : "ready"}`}><span className="studio-status-dot" />{ready ? `Draft saved in ${storageName}` : "Loading local draft…"}</span>
          <span className={`studio-bridge-status is-${bridgeStatus}`}><span className="studio-status-dot" />{bridgeStatus === "connected" ? "Project bridge connected" : bridgeStatus === "checking" ? "Checking project bridge…" : "Browser draft mode"}</span>
          <button className="studio-button studio-button-secondary" type="button" onClick={undo} disabled={!history.length}><Icon name="undo" /> Undo</button>
          <button className="studio-button studio-button-secondary" type="button" onClick={() => importInputRef.current?.click()}><Icon name="upload" /> Import Package</button>
          <button className="studio-button studio-button-secondary" type="button" onClick={exportCatalog}><Icon name="download" /> Export Catalog</button>
          <button className="studio-button studio-button-primary" type="button" onClick={() => void exportPackage()}><Icon name="download" /> Export ZIP</button>
        </div>
      </header>

      <input ref={importInputRef} className="studio-hidden-input" type="file" accept=".zip,.json,application/zip,application/json" onChange={(event) => void importPackage(event.target.files?.[0])} />

      <main className="studio-main">
        <FirstUseGuide />

        {notice ? <div className={`studio-notice studio-notice-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}><span>{notice.type === "success" ? <Icon name="check" /> : notice.type === "error" ? <Icon name="close" /> : <Icon name="eye" />}</span><p>{notice.text}</p><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="close" /></button></div> : null}

        <section className="studio-upload-layout" aria-labelledby="upload-title">
          <div className={`studio-dropzone${dragActive ? " is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragActive(false); }} onDrop={onDropFiles}>
            <span className="studio-dropzone-icon"><Icon name="upload" /></span>
            <span className="studio-kicker">Add public material</span>
            <h2 id="upload-title">Drop files here</h2>
            <p>PDFs, TXT, Markdown, PNG, JPEG or WebP. Every upload starts as a draft so nothing is published accidentally.</p>
            <div className="studio-dropzone-actions">
              <button className="studio-button studio-button-primary" type="button" onClick={() => fileInputRef.current?.click()}><Icon name="plus" /> Add Files</button>
              <button className="studio-button studio-button-secondary" type="button" onClick={addPrompt}><Icon name="plus" /> Add Prompt</button>
            </div>
            <small>PDF up to 20 MB · text up to 1 MB · images up to 5 MB</small>
            <input ref={fileInputRef} className="studio-hidden-input" type="file" multiple accept=".pdf,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp" onChange={onFileInput} />
          </div>
          <div className="studio-stats-panel">
            <span className="studio-kicker">Workspace status</span>
            <div className="studio-stat-large"><strong>{catalog.resources.length}</strong><span>resources in draft catalog</span></div>
            <dl>
              <div><dt>Public</dt><dd>{catalog.resources.filter((resource) => resource.published).length}</dd></div>
              <div><dt>Drafts</dt><dd>{catalog.resources.filter((resource) => !resource.published).length}</dd></div>
              <div><dt>Staged files</dt><dd>{Object.keys(files).length}</dd></div>
            </dl>
            <p>Local draft changes are recoverable in this browser. Use Export ZIP as a portable recovery option.</p>
          </div>
        </section>

        <section className="studio-workspace" aria-label="Resource management workspace">
          <div className="studio-library-panel">
            <div className="studio-library-heading">
              <div><span className="studio-kicker">Catalog</span><h2>Your resources</h2></div>
              <span className="studio-result-count">{filteredResources.length} shown</span>
            </div>
            <div className="studio-library-controls">
              <label className="studio-search"><Icon name="search" /><span className="studio-visually-hidden">Search resources</span><input type="search" placeholder="Search title, filename or tag" value={query} onChange={(event) => setQuery(event.target.value)} />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="close" /></button> : null}</label>
              <div className="studio-filter-tabs" role="toolbar" aria-label="Resource type filters">
                {STUDIO_FILTERS.map((option) => <button key={option.id} type="button" aria-pressed={filter === option.id} className={filter === option.id ? "is-active" : ""} onClick={() => setFilter(option.id)}>{option.label}</button>)}
              </div>
            </div>
            <p className="studio-reorder-hint"><Icon name="grip" /> Drag the grip to reorder. Every row also has keyboard-friendly Move Up and Move Down buttons.</p>
            <div className="studio-resource-list">
              {filteredResources.length ? filteredResources.map((resource, index) => { const fullIndex = catalog.resources.findIndex((item) => item.id === resource.id); return <ResourceRow key={resource.id} resource={resource} index={index} isFirst={fullIndex === 0} isLast={fullIndex === catalog.resources.length - 1} selected={selectedId === resource.id} onSelect={selectResource} onPreview={(id) => { setPreviewId(id); selectResource(id); }} onMove={move} onDelete={deleteResource} onDragStart={setDraggedId} onDrop={dropReorder} />; }) : <div className="studio-empty-list"><Icon name="search" /><h3>No matching resources</h3><p>Try another search or add a new file.</p></div>}
            </div>
          </div>

          <aside className="studio-side-column">
            <PreviewPanel resource={previewResource} file={previewFile} />
            <EditorPanel draft={draft} categories={categories} fileName={fileName} files={files} resources={catalog.resources} editorIsDirty={editorIsDirty} onChange={changeDraft} onFileNameChange={setFileName} onSave={saveEditor} onCancel={resetEditor} onChangeCover={changeCover} onReplaceFile={replaceFile} />
          </aside>
        </section>

        <section className="studio-publish-panel">
          <div><span className="studio-kicker">Local project bridge</span><h2>Save deliberately.</h2><p>The local bridge validates the canonical catalog, keeps drafts outside public/, regenerates both manifests and refreshes Vite. It never pushes, commits or claims that your site is live.</p></div>
          <div className="studio-publish-actions"><button className="studio-button studio-button-primary" type="button" onClick={saveToLocalProject}><Icon name="check" /> Save to local project</button><button className="studio-button studio-button-secondary" type="button" onClick={() => void saveToRepository()} disabled={!window.showDirectoryPicker}><Icon name="folder" /> Folder recovery</button><button className="studio-button studio-button-secondary" type="button" onClick={() => void exportPackage()}><Icon name="download" /> Export ZIP</button></div>
          <p className="studio-publish-note">{bridgeStatus === "connected" ? "Published changes are local and Vite watches the project; deploy only with an explicit build and GitHub Pages action." : "Start npm run local to connect the bridge. Browser drafts and ZIP export remain available without it."}</p>
        </section>
      </main>

      <footer className="studio-footer"><span>TS nextstep Resource Studio</span><span role="status">{saveStatus === "saving" ? "Saving to project…" : saveStatus === "unsynced" ? "Not saved to project — retry required" : saveStatus === "saved" ? "Project saved · GitHub Pages unchanged" : "Local workspace · GitHub Pages unchanged"} · {previewIndex >= 0 ? `Preview ${previewIndex + 1} of ${catalog.resources.length}` : "No preview selected"}</span></footer>
    </div>
  );
}
