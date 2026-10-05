/**
 * BIG STORE (RELEASE_PLAN Milestone 0.5): islands, the island list and the racetrack live in IndexedDB, not localStorage.
 * localStorage holds about 5 MB and overflows silently; IndexedDB holds hundreds of MB and says when it is full.
 *
 * The game reads saves synchronously everywhere, so this keeps the same shape: everything is loaded into memory once at boot
 * (behind the loading screen, before anything reads a save), reads answer from memory, and writes update memory at once and
 * go to IndexedDB in the background. A write that cannot land (the disk is full) is reported to `onStorageFull` listeners,
 * and the memory copy stays the truth for this session.
 *
 * Preferences (settings, seen-help flags) stay in localStorage: small, and some are read before boot.
 * In RUN.world, `localStorage` is already the cloud-backed shim (platform/storage-shim.ts), so the big store simply uses it.
 */

export interface KeyValueBackend {
  getAll(): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The keys that belong in the big store: every island's map, the island list, the racetrack. */
export const isBigKey = (key: string): boolean => key.startsWith('hm.island.') || key === 'hm.islands.v1' || key.startsWith('hm.racing.map.');

export class BigStore {
  private readonly data = new Map<string, string>();
  private readonly pending = new Set<Promise<void>>();
  private readonly fullListeners = new Set<(message: string) => void>();
  private failed = 0;

  constructor(private readonly backend: KeyValueBackend | null, initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) if (typeof v === 'string') this.data.set(k, v);
  }

  get(key: string): string | null { return this.data.get(key) ?? null; }
  has(key: string): boolean { return this.data.has(key); }
  keys(): string[] { return [...this.data.keys()]; }
  /** Bytes held (UTF-16 code units x 2, as the browser counts them). */
  bytes(): number { let n = 0; for (const [k, v] of this.data) n += (k.length + v.length) * 2; return n; }
  /** Writes that did not land this session. */
  get failures(): number { return this.failed; }

  /** Always succeeds in memory; the disk write follows in the background. */
  set(key: string, value: string): true {
    if (this.data.get(key) === value) return true;
    this.data.set(key, value);
    if (this.backend) this.track(this.backend.set(key, value));
    return true;
  }

  remove(key: string): void {
    if (!this.data.delete(key)) return;
    if (this.backend) this.track(this.backend.remove(key));
  }

  /** Called with a plain sentence when a save could not be written (the disk is full). Returns an unsubscribe. */
  onStorageFull(fn: (message: string) => void): () => void { this.fullListeners.add(fn); return () => { this.fullListeners.delete(fn); }; }

  /** Resolves once every write issued so far has settled (tests; before an export). */
  async flush(): Promise<void> { while (this.pending.size) await Promise.allSettled([...this.pending]); }

  private track(write: Promise<void>): void {
    const p = write.catch((error: unknown) => {
      this.failed++;
      const full = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'UnknownError');
      const message = full
        ? 'Your device is out of room for saves. This island still works, but new changes are not kept: free some space, or export the island to a file.'
        : 'A save could not be written to this device. This island still works; export it to a file to keep a copy.';
      for (const l of this.fullListeners) l(message);
    }).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }
}

/* ---- the browser backend: one IndexedDB database, one object store of key -> string ---- */

const DB = 'hm-store', STORE = 'kv';

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });

function openDb(): Promise<IDBDatabase> {
  return new Promise((ok, bad) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
    r.onblocked = () => bad(new Error('IndexedDB is blocked by another tab'));
  });
}

export function idbBackend(db: IDBDatabase): KeyValueBackend {
  const tx = (mode: IDBTransactionMode): IDBObjectStore => db.transaction(STORE, mode).objectStore(STORE);
  return {
    async getAll() {
      const s = tx('readonly');
      const [keys, values] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
      const out: Record<string, string> = {};
      keys.forEach((k, i) => { const v = values[i]; if (typeof k === 'string' && typeof v === 'string') out[k] = v; });
      return out;
    },
    async set(key, value) { await req(tx('readwrite').put(value, key)); },
    async remove(key) { await req(tx('readwrite').delete(key)); },
  };
}

/** localStorage as a backend (RUN's cloud shim, or a browser without IndexedDB). Its writes throw synchronously when full. */
export function storageBackend(storage: Storage): KeyValueBackend {
  return {
    async getAll() {
      const out: Record<string, string> = {};
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && isBigKey(k)) { const v = storage.getItem(k); if (v !== null) out[k] = v; } }
      return out;
    },
    async set(key, value) { storage.setItem(key, value); },
    async remove(key) { storage.removeItem(key); },
  };
}

/**
 * Move the big keys out of localStorage into the store: copy each, wait for the disk, then delete it from localStorage.
 * A key already in the store is not overwritten (the store is newer). Returns how many moved.
 */
export async function migrateFromLocalStorage(store: BigStore, storage: Storage): Promise<number> {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && isBigKey(k)) keys.push(k); }
  let moved = 0;
  for (const k of keys) {
    const v = storage.getItem(k);
    if (v === null) continue;
    if (!store.has(k)) { store.set(k, v); moved++; }
  }
  await store.flush();
  if (store.failures === 0) for (const k of keys) storage.removeItem(k);
  return moved;
}

let instance: BigStore | null = null;

/** The store. Before `initBigStore` resolves (and in tests) it is a memory-only store over nothing. */
export function bigStore(): BigStore {
  if (!instance) instance = new BigStore(null);
  return instance;
}

/** Load every big key into memory. Call once at boot, after the platform (RUN's cloud store) and before anything reads a save. Never throws. */
export async function initBigStore(platform: 'browser' | 'run'): Promise<{ backend: 'idb' | 'localStorage' | 'memory'; moved: number }> {
  try {
    if (platform === 'run' || typeof indexedDB === 'undefined') {
      const b = storageBackend(window.localStorage);
      instance = new BigStore(b, await b.getAll());
      return { backend: 'localStorage', moved: 0 };
    }
    const b = idbBackend(await openDb());
    instance = new BigStore(b, await b.getAll());
    const moved = await migrateFromLocalStorage(instance, window.localStorage);
    return { backend: 'idb', moved };
  } catch (err) {
    console.warn('[storage] IndexedDB unavailable; saves stay in localStorage', err);
    try {
      const b = storageBackend(window.localStorage);
      instance = new BigStore(b, await b.getAll());
      return { backend: 'localStorage', moved: 0 };
    } catch {
      instance = new BigStore(null);
      return { backend: 'memory', moved: 0 };
    }
  }
}
