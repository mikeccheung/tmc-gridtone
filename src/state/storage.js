// Persistent storage using IndexedDB (no image data in localStorage).
// Stores tile blobs + metadata; keeps only the grid order in a small "meta" record.

const DB_NAME = 'gridtone-db';
const DB_VERSION = 1;
const STORE_TILES = 'tiles';
const STORE_META = 'meta';
const META_ORDER_KEY = 'order';

/**
 * Open (or create) the app database.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TILES)) {
        db.createObjectStore(STORE_TILES, { keyPath: 'id' }); // { id, avg, dom, blob: Blob }
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META); // key/value; order is saved under key 'order'
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Load tiles (order + blobs) and return in display order as {id, img, avg, dom}.
 */
export async function loadTiles() {
  try {
    const db = await openDB();

    const tx = db.transaction([STORE_TILES, STORE_META], 'readonly');
    const tilesStore = tx.objectStore(STORE_TILES);
    const metaStore = tx.objectStore(STORE_META);

    const order = await requestAsPromise(metaStore.get(META_ORDER_KEY)).then(v => v || []);
    const allTiles = await requestAll(tilesStore);

    // Map id -> record for quick lookup
    const byId = new Map(allTiles.map(t => [t.id, t]));

    // Rebuild images in the saved order (unknown ids are ignored)
    const out = [];
    for (const id of order) {
      const rec = byId.get(id);
      if (!rec) continue;
      const img = await blobToImage(rec.blob);
      out.push({ id: rec.id, img, avg: rec.avg, dom: rec.dom });
    }
    return out;
  } catch (e) {
    console.warn('IndexedDB loadTiles failed, starting empty:', e);
    return [];
  }
}

/**
 * Save tiles: writes order + per-tile blob+meta.
 * This clears the store first for simplicity.
 */
export async function saveTiles(items) {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_TILES, STORE_META], 'readwrite');
    const tilesStore = tx.objectStore(STORE_TILES);
    const metaStore = tx.objectStore(STORE_META);

    // Clear existing
    await requestAsPromise(tilesStore.clear());
    // Write order
    const order = items.map(t => t.id);
    await requestAsPromise(metaStore.put(order, META_ORDER_KEY));

    // Write tiles
    for (const t of items) {
      // Ensure we have a Blob for persistence. If item.blob is missing but img.src is a data: URL,
      // convert it to a Blob as a fallback.
      const blob = t.blob || (await dataURLFallbackToBlob(t.img?.src));
      if (!blob) continue;
      await requestAsPromise(tilesStore.put({ id: t.id, avg: t.avg, dom: t.dom, blob }));
    }

    await txDone(tx);

    // Cleanup legacy localStorage (no-op if absent)
    try { localStorage.removeItem('gridtone:v1'); } catch {}
  } catch (e) {
    console.warn('IndexedDB saveTiles failed (non-fatal):', e);
  }
}

/* ------------------------- helpers ------------------------- */

function requestAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function requestAll(store) {
  return new Promise((resolve, reject) => {
    const out = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) { out.push(cursor.value); cursor.continue(); }
      else resolve(out);
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}
async function dataURLFallbackToBlob(src) {
  if (!src || typeof src !== 'string') return null;
  if (!src.startsWith('data:')) return null;
  try {
    const res = await fetch(src);
    return await res.blob();
  } catch { return null; }
}
function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = err => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}
