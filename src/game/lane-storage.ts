/**
 * M01 · T6 (IF-LANESTORE) — versioned storage for authored lane networks.
 *
 * One document per browser: `hm2-lane-paths-v1`, plus a `-backup` sibling holding the previous
 * good document. The rules are `track-storage.ts`'s rules, restated for networks because the two
 * documents must not share a key or a shape (law 8: a node is never coerced into a `PlacedProp`):
 *
 *  - **validated before write** — `validateLaneNetwork` runs over every course in the document, and
 *    a refused save leaves the previous document exactly as it was;
 *  - **backup first** — the current document is copied to the backup key before the new one lands;
 *  - **unknown fields survive** — the document and both record types carry `[key: string]: unknown`,
 *    and a round trip re-writes what it did not understand;
 *  - **quota is reported, not thrown** — `reason: 'quotaExceeded'` for the builder to show.
 *
 * Pure except for the `Storage` it is handed: no DOM assumptions, no canvas, no three.js.
 */
import { COURSES, type CourseId } from './types';
import { validateLaneNetwork, type LaneNetwork, type LaneRefusal } from './lane-network';

export const LANE_STORAGE_VERSION = 1 as const;
export const LANE_STORAGE_KEY = 'hm2-lane-paths-v1';
export const LANE_BACKUP_KEY = 'hm2-lane-paths-v1-backup';

export interface LaneStorageDocument {
  version: typeof LANE_STORAGE_VERSION;
  savedAt: string;
  networks: Partial<Record<CourseId, LaneNetwork>>;
  [key: string]: unknown;
}

export type LaneWriteResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; errors: LaneRefusal[] }
  | { ok: false; reason: 'quotaExceeded' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The store to use: the one handed in, or `localStorage` when there is one. */
function resolveStore(store?: Storage): Storage | null {
  if (store) return store;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // A blocked storage (private mode, disabled cookies) is "no storage", not a crash.
    return null;
  }
}

/**
 * Every course in a document, validated. Unknown course keys are dropped, not refused, and a
 * document that is not shaped like one at all is refused rather than thrown on — the builder hands
 * this whatever it has assembled.
 */
export function validateLaneDocument(doc: LaneStorageDocument): LaneRefusal[] {
  if (!isRecord(doc) || !isRecord(doc.networks)) return [{ code: 'kind_mismatch', nodeId: '', expected: 'normal' }];
  const errors: LaneRefusal[] = [];
  for (const course of COURSES) {
    const network = doc.networks[course.id];
    if (network === undefined) continue;
    const result = validateLaneNetwork(network);
    if (!result.ok) errors.push(...result.errors);
  }
  return errors;
}

/** Builds a document from a partial set of networks. Unknown fields on each network survive. */
export function buildLaneDocument(
  networks: Partial<Record<CourseId, LaneNetwork>>,
  savedAt: string = new Date().toISOString(),
): LaneStorageDocument {
  return { version: LANE_STORAGE_VERSION, savedAt, networks };
}

/**
 * Reads the stored document, or `null` when there is none or it cannot be trusted. A document whose
 * shape is wrong, or whose networks do not validate, is reported as absent — the caller keeps
 * running the legacy lanes rather than driving on a half-read network.
 */
export function readLaneStorage(store?: Storage): LaneStorageDocument | null {
  const backend = resolveStore(store);
  if (!backend) return null;
  let raw: string | null = null;
  try {
    raw = backend.getItem(LANE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== LANE_STORAGE_VERSION || !isRecord(parsed.networks)) return null;
  const networks: Partial<Record<CourseId, LaneNetwork>> = {};
  for (const course of COURSES) {
    const candidate = (parsed.networks as Record<string, unknown>)[course.id];
    if (candidate === undefined) continue;
    const result = validateLaneNetwork(candidate);
    if (result.ok) networks[course.id] = result.network;
  }
  const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString();
  return { ...parsed, version: LANE_STORAGE_VERSION, savedAt, networks } as LaneStorageDocument;
}

/** The network stored for one course, validated, or `null` (which means: the legacy lanes). */
export function loadLaneNetwork(course: CourseId, store?: Storage): LaneNetwork | null {
  const doc = readLaneStorage(store);
  return doc?.networks[course] ?? null;
}

/**
 * Writes the document. Validation first, then a backup of whatever is currently stored, then the
 * write. A refused validation or a quota error leaves the previous document readable.
 */
export function writeLaneStorage(store: Storage | undefined, doc: LaneStorageDocument): LaneWriteResult {
  const errors = validateLaneDocument(doc);
  if (errors.length) return { ok: false, reason: 'invalid', errors };
  const backend = resolveStore(store);
  if (!backend) return { ok: false, reason: 'quotaExceeded' };
  const serialized = JSON.stringify(doc);
  try {
    const existing = backend.getItem(LANE_STORAGE_KEY);
    if (existing === serialized) return { ok: true };
    if (existing) backend.setItem(LANE_BACKUP_KEY, existing);
  } catch {
    // A failed backup is not a failed save: the write below still gets its turn.
  }
  try {
    backend.setItem(LANE_STORAGE_KEY, serialized);
    return { ok: true };
  } catch {
    // Full quota, storage disabled, or a string too long for the backend: from the builder's side
    // these are one outcome — the save did not land, and the previous document is still there.
    return { ok: false, reason: 'quotaExceeded' };
  }
}

/** Puts the backup back, if there is one. Returns what it restored. */
export function restoreLaneBackup(store?: Storage): LaneStorageDocument | null {
  const backend = resolveStore(store);
  if (!backend) return null;
  try {
    const backup = backend.getItem(LANE_BACKUP_KEY);
    if (!backup) return null;
    backend.setItem(LANE_STORAGE_KEY, backup);
  } catch {
    return null;
  }
  return readLaneStorage(backend);
}

/** The document as a pretty JSON string, for the builder's Export button. */
export function exportLaneNetworks(doc: LaneStorageDocument): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * Reads an exported document back. Everything that reaches the game goes through validation, so an
 * import cannot smuggle in a network the runtime would refuse.
 */
export function importLaneNetworks(json: string):
{ ok: true; doc: LaneStorageDocument } | { ok: false; errors: LaneRefusal[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, errors: [{ code: 'kind_mismatch', nodeId: '', expected: 'normal' }] };
  }
  if (!isRecord(parsed) || parsed.version !== LANE_STORAGE_VERSION || !isRecord(parsed.networks)) {
    return { ok: false, errors: [{ code: 'kind_mismatch', nodeId: '', expected: 'normal' }] };
  }
  const networks: Partial<Record<CourseId, LaneNetwork>> = {};
  const errors: LaneRefusal[] = [];
  for (const course of COURSES) {
    const candidate = (parsed.networks as Record<string, unknown>)[course.id];
    if (candidate === undefined) continue;
    const result = validateLaneNetwork(candidate);
    if (result.ok) networks[course.id] = result.network;
    else errors.push(...result.errors);
  }
  if (errors.length) return { ok: false, errors };
  const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString();
  return { ok: true, doc: { ...parsed, version: LANE_STORAGE_VERSION, savedAt, networks } as LaneStorageDocument };
}
