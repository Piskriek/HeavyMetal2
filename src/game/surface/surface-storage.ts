/**
 * NewRoads · Phase 3.2 — where a road's paint job lives.
 *
 * Q4 answer: `track-storage.ts` keeps a JSON `TrackDocV2` in localStorage and preserves unknown fields,
 * so a road mask (a few KB of RLE+base64) can ride inside the track document as `surfacePaint`. Until
 * the builder's save path is threaded through (`attachToTrackDoc` below is the one call it needs), the
 * mask also has its own sidecar key per course, so a paint job survives a reload today.
 *
 * The **mask** is persisted, never a baked texture (plan §3.2): it is tiny and re-editable.
 */
import { RoadMask, type RoadMaskDoc } from './road-mask';

export const SURFACE_PAINT_KEY_PREFIX = 'hm2-surface-paint-v1:';
/** The field a road mask occupies inside a `TrackDocV2` (an unknown field to v2's validator, preserved). */
export const TRACK_DOC_SURFACE_FIELD = 'surfacePaint';

function backend(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export const surfacePaintKey = (courseId: string) => `${SURFACE_PAINT_KEY_PREFIX}${courseId}`;

export interface SurfaceWriteResult {
  ok: boolean;
  skipped: boolean;
  quotaExceeded?: boolean;
  error?: string;
}

/** Save a road mask for a course. Skips the write when the content hash has not changed. */
export function writeRoadMask(courseId: string, mask: RoadMask, storage?: Storage): SurfaceWriteResult {
  const store = backend(storage);
  if (!store) return { ok: false, skipped: false, error: 'No storage backend available' };
  const doc = mask.toDoc(courseId);
  const key = surfacePaintKey(courseId);
  try {
    const existing = store.getItem(key);
    if (existing) {
      const parsed = JSON.parse(existing) as Partial<RoadMaskDoc>;
      if (parsed.hash === doc.hash) return { ok: true, skipped: true };
    }
  } catch {
    // An unreadable previous value is simply overwritten.
  }
  try {
    store.setItem(key, JSON.stringify(doc));
    return { ok: true, skipped: false };
  } catch (error) {
    const quota = error instanceof Error && /quota/i.test(error.name + error.message);
    return { ok: false, skipped: false, quotaExceeded: quota, error: quota ? 'Storage quota exceeded' : String(error) };
  }
}

/** Load a course's road mask, or null when there is none (or it no longer fits the track). */
export function readRoadMask(courseId: string, trackLength: number, storage?: Storage): RoadMask | null {
  const store = backend(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(surfacePaintKey(courseId));
    if (!raw) return null;
    return RoadMask.fromDoc(JSON.parse(raw), trackLength);
  } catch {
    return null;
  }
}

export function clearRoadMask(courseId: string, storage?: Storage): void {
  const store = backend(storage);
  if (!store) return;
  try { store.removeItem(surfacePaintKey(courseId)); } catch { /* nothing to clear */ }
}

/**
 * Embed the mask in a track document (the builder's save/export path). Returns a new object; the
 * document's own fields are untouched and v2 validation ignores the extra field.
 */
export function attachToTrackDoc<T extends object>(doc: T, courseId: string, mask: RoadMask): T & { surfacePaint: RoadMaskDoc } {
  return { ...doc, [TRACK_DOC_SURFACE_FIELD]: mask.toDoc(courseId) } as T & { surfacePaint: RoadMaskDoc };
}

/** Read the mask back out of a track document, if one was embedded and still fits. */
export function roadMaskFromTrackDoc(doc: unknown, trackLength: number): RoadMask | null {
  if (!doc || typeof doc !== 'object') return null;
  return RoadMask.fromDoc((doc as Record<string, unknown>)[TRACK_DOC_SURFACE_FIELD], trackLength);
}

/** A file the painter can hand to someone else (or keep as a backup). */
export function exportRoadMask(courseId: string, mask: RoadMask): string {
  return JSON.stringify(mask.toDoc(courseId), null, 2);
}

export function importRoadMask(json: string, trackLength: number): RoadMask | null {
  try { return RoadMask.fromDoc(JSON.parse(json), trackLength); } catch { return null; }
}
