import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import initialCatalogJson from "../../src/data/resourceCatalog.json";
import {
  DEFAULT_CATEGORIES,
  FILE_RULES,
  getCategoryLabel,
  getKindFromFile,
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
} from "../../src/lib/resourceValidation.js";
import { loadDraft, saveDraft } from "./storage.js";
import { createZip, decodeText, readZip } from "./zip.js";
import "./resource-studio.css";

const INITIAL_CATALOG = normalizeCatalog(initialCatalogJson);
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
        {isText ? <pre>{resource.promptText || "No text has been added yet."}</pre> : null}
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
      <div className="studio-row-main" onClick={() => onSelect(resource.id)}>
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

function EditorPanel({ draft, categories, fileName, files, resources, editorIsDirty, onChange, onFileNameChange, onSave, onCancel, onChangeCover }) {
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
          <textarea rows="4" value={draft.description} onChange={(event) => onChange("description", event.target.value)} placeholder="What will someone learn or use?" />
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
      <p className="studio-visibility-note">Publishing is prepared locally. It does not deploy the website.</p>

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
        <li><b>Export for Website</b> to download a validated overlay package, or choose <b>Save to repository</b> on localhost.</li>
      </ol>
      <p className="studio-guide-note">Your draft is saved locally in this browser. A resource is not published until you review the exported files, run the build and deploy through GitHub Pages.</p>
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
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const categories = catalog.categories?.length ? catalog.categories : DEFAULT_CATEGORIES;
  const selected = catalog.resources.find((resource) => resource.id === selectedId) || null;
  const previewResource = catalog.resources.find((resource) => resource.id === previewId) || selected;
  const previewFile = previewResource?.filePath ? files[previewResource.filePath] : null;
  const editorIsDirty = Boolean(draft && selected && JSON.stringify({ ...draft, category: undefined, fileName }) !== JSON.stringify({ ...selected, category: undefined, fileName: fileNameFromPath(selected.filePath) }));

  useEffect(() => {
    let cancelled = false;
    loadDraft(INITIAL_CATALOG)
      .then((saved) => {
        if (cancelled) return;
        const nextCatalog = normalizeCatalog(saved.catalog);
        setCatalog(nextCatalog);
        setFiles(saved.files || {});
        setStorageName(saved.storage);
        setReady(true);
        const first = nextCatalog.resources[0];
        if (first) {
          setSelectedId(first.id);
          setPreviewId(first.id);
          setDraft({ ...first });
          setFileName(fileNameFromPath(first.filePath));
        }
      })
      .catch((error) => {
        setReady(true);
        setStorageName("unavailable");
        setNotice({ type: "error", text: error.message || "Could not load the local draft. The Studio is using the starter catalog." });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!editorIsDirty) return undefined;
    const warnBeforeLeave = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [editorIsDirty]);

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(null), 7000);
  }, []);

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

  const commitCatalog = useCallback((nextCatalog, message = "Draft saved locally.", nextFiles = files) => {
    setHistory((previous) => [...previous.slice(-19), catalog]);
    const normalized = normalizeCatalog(nextCatalog);
    void persist(normalized, nextFiles);
    showNotice("success", message);
  }, [catalog, files, persist, showNotice]);

  const selectResource = useCallback((id) => {
    const resource = catalog.resources.find((item) => item.id === id);
    if (!resource) return;
    setSelectedId(id);
    setPreviewId(id);
    setDraft({ ...resource, tags: [...(resource.tags || [])] });
    setFileName(fileNameFromPath(resource.filePath));
  }, [catalog.resources]);

  const resetEditor = useCallback(() => {
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
      await persist(nextCatalog, nextFiles);
      setSelectedId(lastId);
      setPreviewId(lastId);
      const added = nextCatalog.resources.find((resource) => resource.id === lastId);
      setDraft(added ? { ...added, tags: [...(added.tags || [])] } : null);
      setFileName(added ? fileNameFromPath(added.filePath) : "");
      showNotice(errors.length ? "warning" : "success", errors.length ? `Added valid files. ${errors.join(" ")}` : `Added ${fileList.length} file${fileList.length === 1 ? "" : "s"} as draft resources.`);
    } else if (errors.length) {
      showNotice("error", errors.join(" "));
    }
  }, [catalog, files, persist, showNotice]);

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
    const currentFile = draft.filePath ? files[draft.filePath] : null;
    const kindChanged = draft.kind !== oldResource.kind && draft.kind !== "episode";
    if (currentFile && (fileName || kindChanged)) {
      const candidateName = sanitizeFileName(fileName || currentFile.name, currentFile.name);
      nextPath = uniqueResourcePath(draft.kind, candidateName, catalog.resources, files, oldResource.filePath);
      if (oldResource.filePath && nextPath !== oldResource.filePath) {
        nextFiles[nextPath] = currentFile;
        delete nextFiles[oldResource.filePath];
      }
    }

    const nextResource = {
      ...draft,
      type: draft.kind === "episode" ? "external" : draft.kind,
      category: undefined,
      filePath: nextPath,
      originalFileName: draft.originalFileName || (currentFile ? currentFile.name : null),
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
    const validation = validateCatalog(nextCatalog);
    if (!validation.valid) {
      showNotice("error", validation.errors.slice(0, 3).join(" "));
      return;
    }
    commitCatalog(nextCatalog, "Changes saved to the local draft.", nextFiles);
    setDraft({ ...nextResource, category: getCategoryLabel(nextResource.categoryId, categories) });
    setFileName(fileNameFromPath(nextPath));
  }, [catalog, categories, commitCatalog, draft, fileName, files, showNotice]);

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
    const confirmed = window.confirm(`Delete “${resource.title}” from the Studio catalog? Existing repository files will not be deleted automatically.`);
    if (!confirmed) return;
    const nextFiles = { ...files };
    if (resource.filePath && nextFiles[resource.filePath]) delete nextFiles[resource.filePath];
    const nextResources = catalog.resources
      .filter((item) => item.id !== id)
      .map((item) => ({ ...item, cover: item.cover === resource.filePath ? null : item.cover }));
    const nextCatalog = normalizeCatalog({ ...catalog, resources: nextResources });
    void persist(nextCatalog, nextFiles);
    setHistory((previous) => [...previous.slice(-19), catalog]);
    const nextSelected = nextCatalog.resources[0] || null;
    setSelectedId(nextSelected?.id || null);
    setPreviewId(nextSelected?.id || null);
    setDraft(nextSelected ? { ...nextSelected, tags: [...(nextSelected.tags || [])] } : null);
    setFileName(fileNameFromPath(nextSelected?.filePath));
    showNotice("success", "Resource removed from the local catalog. Any existing repository file was left untouched.");
  }, [catalog, files, persist, showNotice]);

  const undo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    void persist(previous, files);
    const resource = previous.resources.find((item) => item.id === selectedId) || previous.resources[0] || null;
    setSelectedId(resource?.id || null);
    setPreviewId(resource?.id || null);
    setDraft(resource ? { ...resource, tags: [...(resource.tags || [])] } : null);
    setFileName(fileNameFromPath(resource?.filePath));
    showNotice("success", "Undid the last catalog change.");
  }, [files, history, persist, selectedId, showNotice]);

  const changeDraft = (field, value) => setDraft((current) => current ? { ...current, [field]: value } : current);

  const changeCover = (value) => setDraft((current) => current ? { ...current, cover: value } : current);

  const getKnownFileExists = useCallback((path, extraFiles = files) => {
    if (!path) return true;
    if (extraFiles[path]) return true;
    return INITIAL_CATALOG.resources.some((resource) => resource.filePath === path || resource.cover === path);
  }, [files]);

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
    const includedFiles = Object.keys(files).filter((path) => isAllowedFilePath(path));
    const manifest = {
      format: "ts-nextstep-resource-package",
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceCatalog: "src/data/resourceCatalog.json",
      publicManifest: "public/assets/resources/resources.json",
      files: includedFiles.map((path) => `public/${path}`),
      note: "Overlay this package onto the repository after reviewing it. It does not deploy or delete existing files.",
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
      showNotice("success", `Exported a validated package with ${includedFiles.length} staged file${includedFiles.length === 1 ? "" : "s"}.`);
    } catch (error) {
      showNotice("error", error.message || "Could not create the resource package.");
    }
  }, [files, showNotice, validateForExport]);

  const importPackage = useCallback(async (file) => {
    if (!file) return;
    try {
      let importedCatalog;
      let importedFiles = {};
      if (extensionOf(file.name) === ".zip") {
        const zipFiles = await readZip(file);
        const catalogBytes = zipFiles.get("src/data/resourceCatalog.json") || zipFiles.get("resource-catalog.json") || zipFiles.get("public/assets/resources/resources.json");
        if (!catalogBytes) throw new Error("The ZIP did not contain a resource catalog.");
        importedCatalog = JSON.parse(decodeText(catalogBytes));
        for (const [name, bytes] of zipFiles.entries()) {
          if (!name.startsWith("public/")) continue;
          const path = name.slice("public/".length);
          if (!isAllowedFilePath(path)) continue;
          importedFiles[path] = new File([bytes], fileNameFromPath(path), { type: mimeForPath(path) });
        }
      } else {
        importedCatalog = JSON.parse(await file.text());
      }

      const normalized = normalizeCatalog(importedCatalog);
      const validation = validateCatalog(normalized, { fileExists: (path) => Boolean(importedFiles[path]) || getKnownFileExists(path, importedFiles) });
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
      showNotice("success", `Imported ${normalized.resources.length} catalog records. Review them before exporting or saving to the repository.`);
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
      showNotice("warning", "This browser cannot write to a local folder. Use Export for Website instead.");
      return;
    }
    const result = validateForExport();
    if (!result) return;
    try {
      const root = await window.showDirectoryPicker({ mode: "readwrite", id: "tsnextstep-resource-studio" });
      await root.getFileHandle("package.json");
      const publicCatalog = toPublicCatalog(result.catalog);
      const targetPaths = Object.keys(files).filter((path) => isAllowedFilePath(path));
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
          <button className="studio-button studio-button-secondary" type="button" onClick={undo} disabled={!history.length}><Icon name="undo" /> Undo</button>
          <button className="studio-button studio-button-secondary" type="button" onClick={() => importInputRef.current?.click()}><Icon name="upload" /> Import Package</button>
          <button className="studio-button studio-button-secondary" type="button" onClick={exportCatalog}><Icon name="download" /> Export Catalog</button>
          <button className="studio-button studio-button-primary" type="button" onClick={() => void exportPackage()}><Icon name="download" /> Export for Website</button>
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
            <p>Local draft changes are recoverable in this browser. Use Export for Website before committing anything.</p>
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
              <div className="studio-filter-tabs" role="tablist" aria-label="Resource type filters">
                {STUDIO_FILTERS.map((option) => <button key={option.id} type="button" role="tab" aria-selected={filter === option.id} className={filter === option.id ? "is-active" : ""} onClick={() => setFilter(option.id)}>{option.label}</button>)}
              </div>
            </div>
            <p className="studio-reorder-hint"><Icon name="grip" /> Drag the grip to reorder. Every row also has keyboard-friendly Move Up and Move Down buttons.</p>
            <div className="studio-resource-list">
              {filteredResources.length ? filteredResources.map((resource, index) => { const fullIndex = catalog.resources.findIndex((item) => item.id === resource.id); return <ResourceRow key={resource.id} resource={resource} index={index} isFirst={fullIndex === 0} isLast={fullIndex === catalog.resources.length - 1} selected={selectedId === resource.id} onSelect={selectResource} onPreview={(id) => { setPreviewId(id); selectResource(id); }} onMove={move} onDelete={deleteResource} onDragStart={setDraggedId} onDrop={dropReorder} />; }) : <div className="studio-empty-list"><Icon name="search" /><h3>No matching resources</h3><p>Try another search or add a new file.</p></div>}
            </div>
          </div>

          <aside className="studio-side-column">
            <PreviewPanel resource={previewResource} file={previewFile} />
            <EditorPanel draft={draft} categories={categories} fileName={fileName} files={files} resources={catalog.resources} editorIsDirty={editorIsDirty} onChange={changeDraft} onFileNameChange={setFileName} onSave={saveEditor} onCancel={resetEditor} onChangeCover={changeCover} />
          </aside>
        </section>

        <section className="studio-publish-panel">
          <div><span className="studio-kicker">Prepare for GitHub Pages</span><h2>Ready when you are.</h2><p>The Studio validates IDs, categories, paths, file references and publication state before export. It never pushes, commits or claims that your site is live.</p></div>
          <div className="studio-publish-actions"><button className="studio-button studio-button-secondary" type="button" onClick={() => void saveToRepository()} disabled={!window.showDirectoryPicker}><Icon name="folder" /> Save to repository</button><button className="studio-button studio-button-primary" type="button" onClick={() => void exportPackage()}><Icon name="download" /> Export for Website</button></div>
          <p className="studio-publish-note">{window.showDirectoryPicker ? "Local folder writing is available on localhost in supported browsers." : "This browser cannot write to folders directly; use the validated ZIP export."}</p>
        </section>
      </main>

      <footer className="studio-footer"><span>TS nextstep Resource Studio</span><span>Local draft · not published · {previewIndex >= 0 ? `Preview ${previewIndex + 1} of ${catalog.resources.length}` : "No preview selected"}</span></footer>
    </div>
  );
}
