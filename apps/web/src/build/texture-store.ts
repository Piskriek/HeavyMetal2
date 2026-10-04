/**
 * Your own textures (texture mode, MASTER_PLAN 6.4), kept in the browser's IndexedDB: a surface's painted and sculpted tile (colour and maps as
 * webp) and how it moves. They can be bigger than localStorage likes. Every call is safe: when storage is blocked nothing is kept, and
 * nothing breaks.
 */
export interface StoredTexture { readonly colour?: Blob; readonly maps?: Blob; readonly anim?: readonly [number, number, number, number] }

const DB = 'hm-textures', STORE = 'tiles';
function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

/** Every stored texture, by surface id. */
export async function loadTextures(): Promise<Map<number, StoredTexture>> {
  const out = new Map<number, StoredTexture>();
  const db = await open();
  if (!db) return out;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly'), store = tx.objectStore(STORE), req = store.openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.set(Number(c.key), c.value as StoredTexture); c.continue(); } else resolve(out); };
      req.onerror = () => resolve(out);
    } catch { resolve(out); }
  });
}

/** Keep (or with null, forget) a surface's texture. Merges with what is there (the tile and the movement are kept apart). */
export async function saveTexture(id: number, value: StoredTexture | null): Promise<void> {
  const db = await open();
  if (!db) return;
  const old = value ? (await loadTextures()).get(id) ?? {} : {};
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
      if (value) store.put({ ...old, ...value }, id); else store.delete(id);
      tx.oncomplete = () => resolve(); tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

/** RGBA bytes to a webp blob (quality 1 is lossless: the maps keep their exact height). */
export function encodeWebp(rgba: Uint8Array | Uint8ClampedArray, size: number, quality: number): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), size, size), 0, 0);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/webp', quality));
}

/** A stored blob back to RGBA bytes at `size`. */
export async function decodeBlob(blob: Blob, size: number): Promise<Uint8ClampedArray | null> {
  try {
    const img = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data;
  } catch { return null; }
}
