/**
 * PLATFORM: a synchronous `Storage` (the `localStorage` shape the game already uses everywhere) kept in
 * memory and written through to an asynchronous backend: RUN.world's cloud `appStorage` when hosted,
 * where the real `localStorage` does not exist inside the game iframe.
 *
 * Reads never wait: the whole bucket is loaded once at boot (`getAllData`) before the game starts, so
 * every `getItem` answers from memory exactly as `localStorage` would. Writes update memory at once and
 * go to the backend in the background (the SDK buffers them ~100 ms); a failed write is reported, never
 * thrown, because a game on a flaky connection must keep running. The memory copy stays the truth for
 * this session either way.
 *
 * Pure (no DOM, no SDK import), so the tests exercise it with a fake backend.
 */

export interface AsyncKeyValueBackend {
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface WriteFailure { op: 'set' | 'remove' | 'clear'; key: string | null; error: unknown }

/** RUN.world's per-bucket limits (docs: Storage API → Limits). */
export const CLOUD_LIMITS = Object.freeze({ items: 128, valueBytes: 1_000_000, comfortableValueBytes: 256 * 1024, keyBytes: 256 });

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

export class CloudBackedStorage implements Storage {
  private readonly data = new Map<string, string>();
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly backend: AsyncKeyValueBackend,
    initial: Record<string, string> = {},
    private readonly onFailure: (failure: WriteFailure) => void = () => {},
  ) {
    for (const [k, v] of Object.entries(initial)) if (typeof v === 'string') this.data.set(k, v);
  }

  get length(): number { return this.data.size; }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.data.has(String(key)) ? this.data.get(String(key))! : null;
  }

  setItem(key: string, value: string): void {
    const k = String(key), v = String(value);
    // The cloud refuses these outright; refuse like a full localStorage does so callers take their
    // existing "could not save" paths instead of believing a save that will never land.
    if (utf8Bytes(k) > CLOUD_LIMITS.keyBytes) throw new DOMException(`Key too long for cloud storage: ${k.slice(0, 40)}…`, 'QuotaExceededError');
    if (utf8Bytes(v) > CLOUD_LIMITS.valueBytes) throw new DOMException(`Value too large for cloud storage (${k})`, 'QuotaExceededError');
    if (!this.data.has(k) && this.data.size >= CLOUD_LIMITS.items) throw new DOMException('Cloud storage is full (128 items)', 'QuotaExceededError');
    if (this.data.get(k) === v) return;
    this.data.set(k, v);
    this.track(this.backend.setItem(k, v), 'set', k);
  }

  removeItem(key: string): void {
    const k = String(key);
    if (!this.data.delete(k)) return;
    this.track(this.backend.removeItem(k), 'remove', k);
  }

  clear(): void {
    if (!this.data.size) return;
    this.data.clear();
    this.track(this.backend.clear(), 'clear', null);
  }

  /** Resolves once every write issued so far has settled (tests; a "saving…" indicator). */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  private track(write: Promise<void>, op: WriteFailure['op'], key: string | null) {
    const p = write.catch((error) => this.onFailure({ op, key, error })).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }
}

/**
 * Puts `storage` where the game looks for `localStorage`. Returns false when the browser would not let
 * the property be replaced (then the game keeps whatever `localStorage` it had).
 */
export function installLocalStorage(target: object, storage: Storage): boolean {
  try {
    Object.defineProperty(target, 'localStorage', { configurable: true, enumerable: true, get: () => storage });
    return (target as { localStorage?: Storage }).localStorage === storage;
  } catch {
    return false;
  }
}
