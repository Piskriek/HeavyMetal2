/**
 * IF-ASSET-DB: IndexedDB content-addressed asset store with MemoryKV fallback.
 * Stores blobs, asset records, thumbnails, and lighting bakes.
 */

export const ASSET_DB_NAME = 'hm2_custom_assets';
export const ASSET_DB_VERSION = 1;
export type AssetStore = 'blobs' | 'assets' | 'thumbs' | 'bakes';

export interface KV {
  get<T>(store: AssetStore, key: string): Promise<T | undefined>;
  put(store: AssetStore, key: string, value: unknown): Promise<void>;
  delete(store: AssetStore, key: string): Promise<void>;
  keys(store: AssetStore): Promise<string[]>;
  all<T>(store: AssetStore): Promise<T[]>;
}

export class MemoryKV implements KV {
  private stores: Record<AssetStore, Map<string, unknown>> = {
    blobs: new Map(),
    assets: new Map(),
    thumbs: new Map(),
    bakes: new Map(),
  };

  async get<T>(store: AssetStore, key: string): Promise<T | undefined> {
    return this.stores[store].get(key) as T | undefined;
  }

  async put(store: AssetStore, key: string, value: unknown): Promise<void> {
    this.stores[store].set(key, value);
  }

  async delete(store: AssetStore, key: string): Promise<void> {
    this.stores[store].delete(key);
  }

  async keys(store: AssetStore): Promise<string[]> {
    return Array.from(this.stores[store].keys());
  }

  async all<T>(store: AssetStore): Promise<T[]> {
    return Array.from(this.stores[store].values()) as T[];
  }
}

export class IdbKV implements KV {
  constructor(private db: IDBDatabase) {}

  private tx<T>(
    store: AssetStore,
    mode: IDBTransactionMode,
    fn: (os: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(store, mode);
      const request = fn(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(store: AssetStore, key: string): Promise<T | undefined> {
    return this.tx<T | undefined>(store, 'readonly', (os) => os.get(key));
  }

  async put(store: AssetStore, key: string, value: unknown): Promise<void> {
    await this.tx(store, 'readwrite', (os) => os.put(value, key));
  }

  async delete(store: AssetStore, key: string): Promise<void> {
    await this.tx(store, 'readwrite', (os) => os.delete(key));
  }

  async keys(store: AssetStore): Promise<string[]> {
    return this.tx<string[]>(store, 'readonly', (os) => (os as any).getAllKeys());
  }

  async all<T>(store: AssetStore): Promise<T[]> {
    return this.tx<T[]>(store, 'readonly', (os) => os.getAll());
  }
}

export interface QuotaProbe {
  estimate(): Promise<{ usage: number; quota: number }>;
  persist(): Promise<boolean>;
}

export class DefaultQuotaProbe implements QuotaProbe {
  async estimate(): Promise<{ usage: number; quota: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
      } catch {}
    }
    return { usage: 0, quota: 0 };
  }

  async persist(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      try {
        return await navigator.storage.persist();
      } catch {}
    }
    return false;
  }
}

export async function computeSha256(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {}
  }
  // Fallback FNV-1a hash
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv_${h.toString(16).padStart(8, '0')}`;
}

export class AssetDB {
  constructor(
    readonly kv: KV,
    readonly quotaProbe: QuotaProbe = new DefaultQuotaProbe(),
  ) {}

  static async open(name = ASSET_DB_NAME): Promise<AssetDB> {
    if (typeof indexedDB === 'undefined') {
      return new AssetDB(new MemoryKV());
    }

    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name, ASSET_DB_VERSION);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
          if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets');
          if (!d.objectStoreNames.contains('thumbs')) d.createObjectStore('thumbs');
          if (!d.objectStoreNames.contains('bakes')) d.createObjectStore('bakes');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB blocked'));
      });

      return new AssetDB(new IdbKV(db));
    } catch {
      return new AssetDB(new MemoryKV());
    }
  }

  async putBlob(
    bytes: Uint8Array,
  ): Promise<{ ok: true; sha256: string; reused: boolean } | { ok: false; refusal: 'quota_exceeded' }> {
    const sha256 = await computeSha256(bytes);
    const existing = await this.kv.get('blobs', sha256);
    if (existing) {
      return { ok: true, sha256, reused: true };
    }

    const est = await this.quotaProbe.estimate();
    if (est.quota > 0 && est.usage + bytes.length > 0.9 * est.quota) {
      return { ok: false, refusal: 'quota_exceeded' };
    }

    await this.kv.put('blobs', sha256, bytes);
    return { ok: true, sha256, reused: false };
  }

  async getBlob(sha256: string): Promise<Uint8Array | undefined> {
    return this.kv.get<Uint8Array>('blobs', sha256);
  }

  async putAsset(record: any, thumb?: string | Blob): Promise<void> {
    await this.kv.put('assets', record.assetId, record);
    if (thumb) {
      await this.kv.put('thumbs', record.assetId, thumb);
    }
  }

  async getAsset<T = any>(assetId: string): Promise<T | undefined> {
    return this.kv.get<T>('assets', assetId);
  }

  async getThumb(assetId: string): Promise<string | Blob | undefined> {
    return this.kv.get<string | Blob>('thumbs', assetId);
  }

  async list<T = any>(): Promise<T[]> {
    const all = await this.kv.all<T>('assets');
    return all.sort((a: any, b: any) =>
      String(b.importedAt || '').localeCompare(String(a.importedAt || '')),
    );
  }

  async remove(
    assetId: string,
    refs: ReadonlySet<string>,
  ): Promise<{ ok: true } | { ok: false; refusal: 'asset_in_use' }> {
    if (refs.has(assetId)) {
      return { ok: false, refusal: 'asset_in_use' };
    }

    const asset = await this.getAsset(assetId);
    await this.kv.delete('assets', assetId);
    await this.kv.delete('thumbs', assetId);

    if (asset?.sha256) {
      const all = await this.list();
      const stillUsed = all.some((a) => a.sha256 === asset.sha256);
      if (!stillUsed) {
        await this.kv.delete('blobs', asset.sha256);
      }
    }

    return { ok: true };
  }
}
