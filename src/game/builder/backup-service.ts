/**
 * The track builder's disk backup (M8: lifted out of track-builder-3d.ts, unchanged in behaviour).
 *
 * Everything that keeps the owner's hand-built track safe on disk lives here, in one place:
 *
 *  - the dev server's `/api/backup-props` save (the server also writes the C2 milestone safety
 *    copies, see scripts/props-safety-copy.ts), spaced at least 15 s apart;
 *  - M12's content fingerprint, so an automatic save that would write what the disk already holds
 *    is skipped (an idle builder sends nothing), while an explicit save always writes;
 *  - the 30 s periodic save and the 2.5 s debounced save after an edit;
 *  - the status listeners the builder UI shows ("saving… / saved"), and the backup listing.
 *
 * The service only reads the props and the course through its source, so it holds no second copy of
 * the document.
 */
import type { PlacedProp } from './prop-catalog';

export type BackupStatus = 'idle' | 'saving' | 'saved' | 'error';
export interface BackupInfo { status: BackupStatus; timestamp: number; count: number }
export interface BackupSource { props(): PlacedProp[]; course(): string }
export interface BackupResult { success: boolean; count: number; timestamp: number; unchanged?: boolean }

/** T08: a copy of the props without runtime-only fields (pickup state, transient markers). */
export function stripPropsRuntimeState(props: PlacedProp[]): PlacedProp[] {
  return props.map((p) => {
    const cleaned = { ...p } as PlacedProp;
    delete (cleaned as any)._runtime;
    delete (cleaned as any)._pickupCollected;
    delete (cleaned as any)._pickupRespawn;
    delete (cleaned as any)._runtimeState;
    return cleaned;
  });
}

/**
 * FNV-1a (32-bit) over the course id and the saved form of every prop, in order. Two prop lists
 * that serialise the same way get the same fingerprint; any move, add, delete or edit changes it.
 */
export function propsFingerprint(props: PlacedProp[], course: string): string {
  const text = course + '\n' + JSON.stringify(stripPropsRuntimeState(props));
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + ':' + text.length;
}

const unref = (timer: unknown) => {
  if (timer && typeof (timer as { unref?: () => void }).unref === 'function') (timer as { unref: () => void }).unref();
};

export class PropBackupService {
  /** When the last save reached the disk (ms). Public so a test can step past the 15 s spacing. */
  lastBackupTimestamp = 0;
  /** Fingerprint of the props the disk holds (M12): an unchanged track is never re-sent. */
  private lastSavedPropsHash = '';
  private status: BackupStatus = 'idle';
  private listeners: ((info: BackupInfo) => void)[] = [];
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly source: BackupSource) {}

  /** Calls back at once with the current status, then on every change. Returns an unsubscribe. */
  onStatus(cb: (info: BackupInfo) => void): () => void {
    this.listeners.push(cb);
    cb(this.info());
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  private info(): BackupInfo {
    return { status: this.status, timestamp: this.lastBackupTimestamp, count: this.source.props().length };
  }

  private notify(status: BackupStatus) {
    this.status = status;
    const info = this.info();
    this.listeners.forEach((cb) => { try { cb(info); } catch {} });
  }

  /** The periodic automatic save (default every 30 s) while there is anything to save. */
  startPeriodic(intervalMs = 30000) {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      if (this.source.props().length > 0) void this.backupToFile(false);
    }, intervalMs);
    unref(this.intervalTimer);
  }

  /** The automatic save a short while after an edit (browser only). */
  scheduleDebounced(delayMs = 2500) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (typeof window === 'undefined') return;
    this.debounceTimer = setTimeout(() => { void this.backupToFile(false); }, delayMs);
    unref(this.debounceTimer);
  }

  /** Records what the disk holds, so an automatic save of the same props is skipped (M12). */
  markDiskState(props: PlacedProp[], course: string) {
    this.lastSavedPropsHash = propsFingerprint(props, course);
  }

  /**
   * Writes the props to the dev server's disk backup. An automatic save (`force = false`) is skipped
   * when the props match what the disk already holds, so an idle builder sends nothing (M12).
   * An explicit save (`force = true`) always writes.
   */
  async backupToFile(force = false): Promise<BackupResult | null> {
    if (typeof fetch === 'undefined') return null;
    const props = this.source.props();
    const course = this.source.course();
    const now = Date.now();
    const hash = propsFingerprint(props, course);
    if (!force && hash === this.lastSavedPropsHash) {
      return { success: true, count: props.length, timestamp: this.lastBackupTimestamp, unchanged: true };
    }
    if (!force && this.lastBackupTimestamp && now - this.lastBackupTimestamp < 15000) {
      return null;
    }

    this.notify('saving');
    try {
      const payload = { course, timestamp: now, props };
      const res = await fetch('/api/backup-props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.lastBackupTimestamp = now;
        // A refused save (the server keeps a bigger track) leaves the hash unset so it retries.
        const body = await res.json().catch(() => null);
        if (body?.success !== false) this.lastSavedPropsHash = hash;
        this.notify('saved');
        return { success: true, count: props.length, timestamp: now };
      }
      this.notify('error');
      return null;
    } catch {
      this.notify('idle');
      return null;
    }
  }

  /** The disk's latest backup and history (from the dev server) and the browser's own copies. */
  async list(): Promise<{ latest: any; history: any[]; localHistory: any[] }> {
    let latest = null;
    let history: any[] = [];
    const localHistory: any[] = [];

    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/backup-props');
        if (res.ok) {
          const data = await res.json();
          latest = data.latest ?? null;
          history = data.history ?? [];
        }
      } catch {}
    }

    try {
      const rawLatest = localStorage.getItem('hm2-3d-track-props-backup-latest');
      if (rawLatest) {
        const parsed = JSON.parse(rawLatest);
        localHistory.push({
          source: 'localStorage',
          title: 'Browser Auto-Save (Latest)',
          count: parsed.count || parsed.props?.length || 0,
          timestamp: parsed.timestamp || 0,
          props: parsed.props || parsed,
        });
      }
      const rawHist = localStorage.getItem('hm2-3d-track-props-backup-history');
      if (rawHist) {
        const list = JSON.parse(rawHist);
        if (Array.isArray(list)) {
          list.forEach((item, idx) => {
            localHistory.push({
              source: 'localStorage',
              title: `Browser History #${idx + 1}`,
              count: item.count || item.props?.length || 0,
              timestamp: item.timestamp || 0,
              props: item.props || item,
            });
          });
        }
      }
    } catch {}

    return { latest, history, localHistory };
  }

  /** The props of one disk history file, or null. */
  async fetchHistoryFile(filename: string): Promise<PlacedProp[] | null> {
    if (typeof fetch === 'undefined') return null;
    const res = await fetch('/api/restore-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const props = Array.isArray(data) ? data : data.props;
    return Array.isArray(props) ? props : null;
  }

  destroy() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.intervalTimer = this.debounceTimer = null;
    this.listeners.length = 0;
  }
}
