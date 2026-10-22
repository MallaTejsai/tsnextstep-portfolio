const DB_NAME = "tsnextstep-resource-studio";
const DB_VERSION = 2;
const CATALOG_STORE = "catalog";
const FILE_STORE = "files";
const META_STORE = "meta";
const CATALOG_KEY = "draft";
const STATUS_KEY = "status";

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local draft storage failed."));
  });
}

function openDatabase() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CATALOG_STORE)) db.createObjectStore(CATALOG_STORE);
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local draft storage."));
  });
}

function fileForBrowser(record) {
  if (!record?.blob) return null;
  try {
    return new File([record.blob], record.name || "resource", { type: record.type || "application/octet-stream" });
  } catch {
    return record.blob;
  }
}

export async function loadDraft(initialCatalog) {
  const db = await openDatabase();
  if (!db) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${DB_NAME}:catalog`) || "null");
      const status = JSON.parse(window.localStorage.getItem(`${DB_NAME}:status`) || "null");
      return { catalog: saved || initialCatalog, files: {}, synced: status?.synced === true, storage: "browser settings only" };
    } catch {
      return { catalog: initialCatalog, files: {}, synced: false, storage: "browser settings only" };
    }
  }

  const catalog = await requestValue(db.transaction(CATALOG_STORE, "readonly").objectStore(CATALOG_STORE).get(CATALOG_KEY));
  const records = await requestValue(db.transaction(FILE_STORE, "readonly").objectStore(FILE_STORE).getAll());
  const status = await requestValue(db.transaction(META_STORE, "readonly").objectStore(META_STORE).get(STATUS_KEY));
  const files = Object.fromEntries(records.map((record) => [record.path, fileForBrowser(record)]));
  db.close();
  return { catalog: catalog || initialCatalog, files, synced: status?.synced === true, storage: "IndexedDB" };
}

let writeQueue = Promise.resolve();

export function saveDraft(catalog, files, options = {}) {
  const write = writeQueue.then(() => writeDraft(catalog, files, options));
  writeQueue = write.catch(() => undefined);
  return write;
}

async function writeDraft(catalog, files, { synced = false } = {}) {
  const db = await openDatabase();
  if (!db) {
    window.localStorage.setItem(`${DB_NAME}:catalog`, JSON.stringify(catalog));
    window.localStorage.setItem(`${DB_NAME}:status`, JSON.stringify({ synced, updatedAt: new Date().toISOString() }));
    return "browser settings only";
  }

  const existing = await requestValue(db.transaction(FILE_STORE, "readonly").objectStore(FILE_STORE).getAllKeys());
  const tx = db.transaction([CATALOG_STORE, FILE_STORE, META_STORE], "readwrite");
  tx.objectStore(CATALOG_STORE).put(catalog, CATALOG_KEY);
  const fileStore = tx.objectStore(FILE_STORE);
  const paths = new Set(Object.keys(files));
  existing.forEach((path) => {
    if (!paths.has(path)) fileStore.delete(path);
  });
  Object.entries(files).forEach(([path, file]) => {
    if (!file) return;
    fileStore.put({ path, name: file.name || path.split("/").pop(), type: file.type || "", size: file.size || 0, blob: file }, path);
  });
  const metaStore = tx.objectStore(META_STORE);
  metaStore.put({ synced, updatedAt: new Date().toISOString() }, STATUS_KEY);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Could not save the local draft."));
    tx.onabort = () => reject(tx.error || new Error("Could not save the local draft."));
  });
  db.close();
  return "IndexedDB";
}
