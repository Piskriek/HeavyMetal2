/**
 * ISLAND-ROUTE: the island's own placed props, kept apart from the owner's classic track.
 *
 * The classic track lives under the `hm2-track-props-*` keys and `backups/props/`; nothing here reads
 * or writes either. The island has its own browser key (plus one backup copy of the previous save)
 * and its own disk folder, `backups/island/`, written by the dev server's island endpoints.
 *
 * The island can hold several tracks (each its own set of placed props on the same island): the
 * first is Serpentine Isle, on the original key and folder; tracks made with "New" or "Duplicate" get
 * a key and a disk folder of their own. The active track is the one build mode shows and races run.
 */
import type { PlacedProp } from '../builder/prop-catalog';
import { validateProps } from '../track-storage';
import { shippedCourses, shippedTrack } from '../shipped-courses';

export const ISLAND_PROPS_KEY = 'hm2-island-props-v1';
export const ISLAND_PROPS_BACKUP_KEY = 'hm2-island-props-v1-backup';
export const ISLAND_PROPS_VERSION = 1;
export const ISLAND_TRACKS_KEY = 'hm2-island-tracks-v1';

/** The dev server's island routes (vite.config.ts): save + list, and read one saved file. */
export const ISLAND_BACKUP_ENDPOINTS = {
  backup: '/api/backup-island-props',
  restore: '/api/restore-island-backup',
  latestFile: 'island-props-latest.json',
} as const;

export interface IslandTrack { id: string; name: string; createdAt: number; startOffset?: number }
export interface IslandTrackIndex { active: string; tracks: IslandTrack[] }

/** The island's first track: the original key, the original disk folder. */
export const DEFAULT_ISLAND_TRACK: IslandTrack = { id: 'serpentine', name: 'Serpentine Isle', createdAt: 0, startOffset: 190 };

export interface IslandPropsDoc {
  version: number;
  course: 'basalt';
  timestamp: number;
  props: PlacedProp[];
}

const backend = (store?: Storage): Storage | null => {
  if (store) return store;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

/** A track's browser keys: the first track keeps the original ones. */
export const islandPropsKey = (trackId: string) => trackId === DEFAULT_ISLAND_TRACK.id ? ISLAND_PROPS_KEY : `${ISLAND_PROPS_KEY}:${trackId}`;
const islandBackupKey = (trackId: string) => trackId === DEFAULT_ISLAND_TRACK.id ? ISLAND_PROPS_BACKUP_KEY : `${ISLAND_PROPS_BACKUP_KEY}:${trackId}`;

/** The disk routes for one track (the server keeps each track in its own folder). */
export function islandEndpoints(trackId: string) {
  const q = trackId === DEFAULT_ISLAND_TRACK.id ? '' : `?track=${encodeURIComponent(trackId)}`;
  return { backup: `${ISLAND_BACKUP_ENDPOINTS.backup}${q}`, restore: `${ISLAND_BACKUP_ENDPOINTS.restore}${q}` };
}

/* ───────────── Tracks ───────────── */

/** The island's tracks and which one is active. Serpentine Isle is always there. */
export function readIslandTracks(store?: Storage): IslandTrackIndex {
  const s = backend(store);
  let index: IslandTrackIndex = { active: DEFAULT_ISLAND_TRACK.id, tracks: [] };
  let saved = false;
  try {
    const raw = s?.getItem(ISLAND_TRACKS_KEY);
    saved = !!raw;
    const parsed = raw ? JSON.parse(raw) as Partial<IslandTrackIndex> : null;
    if (parsed && Array.isArray(parsed.tracks)) {
      index = {
        active: typeof parsed.active === 'string' ? parsed.active : DEFAULT_ISLAND_TRACK.id,
        tracks: parsed.tracks
          .filter((t): t is IslandTrack => !!t && typeof t.id === 'string' && typeof t.name === 'string')
          .map((t) => ({
            ...t,
            startOffset: typeof t.startOffset === 'number' && Number.isFinite(t.startOffset) ? t.startOffset : 190,
          })),
      };
    }
  } catch { /* unreadable: the default index */ }
  // The owner's published island (shipped-courses.ts): its tracks join the list, and a new player
  // starts on its chosen track.
  const published = shippedCourses();
  if (published) {
    for (const t of published.tracks) if (!index.tracks.some((x) => x.id === t.id)) index.tracks.push({ id: t.id, name: t.name, createdAt: 0, startOffset: 190 });
    if (!saved) index.active = published.active;
  }
  if (!index.tracks.some((t) => t.id === DEFAULT_ISLAND_TRACK.id)) index.tracks.unshift({ ...DEFAULT_ISLAND_TRACK });
  if (!index.tracks.some((t) => t.id === index.active)) index.active = DEFAULT_ISLAND_TRACK.id;
  return index;
}

function writeIslandTracks(index: IslandTrackIndex, store?: Storage): boolean {
  const s = backend(store);
  if (!s) return false;
  try { s.setItem(ISLAND_TRACKS_KEY, JSON.stringify(index)); return true; } catch { return false; }
}

/** Makes a track the active one (build mode shows it, races run it). */
export function setActiveIslandTrack(trackId: string, store?: Storage): boolean {
  const index = readIslandTracks(store);
  if (!index.tracks.some((t) => t.id === trackId)) return false;
  return writeIslandTracks({ ...index, active: trackId }, store);
}

/** The start offset on the x axis for an island track (defaults to 190). */
export function getIslandTrackStartOffset(trackId?: string, store?: Storage): number {
  const index = readIslandTracks(store);
  const targetId = trackId ?? index.active;
  const track = index.tracks.find((t) => t.id === targetId);
  return typeof track?.startOffset === 'number' && Number.isFinite(track.startOffset) ? track.startOffset : 190;
}

/** Updates the start offset on the x axis for an island track. */
export function setIslandTrackStartOffset(trackId: string, startOffset: number, store?: Storage): boolean {
  if (!Number.isFinite(startOffset)) return false;
  const index = readIslandTracks(store);
  const track = index.tracks.find((t) => t.id === trackId);
  if (!track) return false;
  track.startOffset = Math.round(startOffset);
  return writeIslandTracks(index, store);
}

/** A track name trimmed to something a dropdown can show; empty names are refused. */
export const cleanTrackName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 40);

/**
 * Adds a track and makes it active. With `copyFrom`, its placed props are copied from that track
 * (the copy gets new ids, so the two never share an item); otherwise it starts empty.
 */
export function createIslandTrack(name: string, copyFrom?: string, store?: Storage, now = Date.now(), startOffset?: number): IslandTrack | null {
  const clean = cleanTrackName(name);
  if (!clean) return null;
  const index = readIslandTracks(store);
  const base = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'track';
  let id = base;
  for (let n = 2; index.tracks.some((t) => t.id === id); n++) id = `${base}-${n}`;
  const source = copyFrom ? index.tracks.find((t) => t.id === copyFrom) : null;
  const trackStartOffset = typeof startOffset === 'number' && Number.isFinite(startOffset)
    ? startOffset
    : (source?.startOffset ?? 190);
  const track: IslandTrack = { id, name: clean, createdAt: now, startOffset: trackStartOffset };
  const props = copyFrom
    ? readIslandProps(store, copyFrom).map((p, i) => ({ ...p, id: `${p.id}_c${now.toString(36)}${i}` }))
    : [];
  if (!writeIslandProps(props, store, now, id).ok) return null;
  if (!writeIslandTracks({ active: id, tracks: [...index.tracks, track] }, store)) return null;
  return track;
}

/* ───────────── Props ───────────── */

function parse(raw: string | null): PlacedProp[] | null {
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as Partial<IslandPropsDoc>;
    return doc && doc.course === 'basalt' && Array.isArray(doc.props) ? doc.props : null;
  } catch {
    return null;
  }
}

/** The published island's props for a track (valid ones only), or null. */
function shippedProps(trackId: string): PlacedProp[] | null {
  const t = shippedTrack(trackId);
  if (!t) return null;
  const props = t.props as PlacedProp[];
  return validateProps(props).valid ? props : null;
}

/** A track's saved props (the previous save if the latest is unreadable), else the published copy, or an empty list. */
export function readIslandProps(store?: Storage, trackId = readIslandTracks(store).active): PlacedProp[] {
  const s = backend(store);
  if (!s) return [];
  try {
    return parse(s.getItem(islandPropsKey(trackId))) ?? parse(s.getItem(islandBackupKey(trackId))) ?? shippedProps(trackId) ?? [];
  } catch {
    return [];
  }
}

/**
 * Saves a track's props. The previous save moves to the backup key first. Refuses a list with
 * duplicate ids (the save would lose props on load); a full or blocked storage reports `ok: false`.
 */
export function writeIslandProps(
  props: PlacedProp[], store?: Storage, now = Date.now(), trackId = readIslandTracks(store).active,
): { ok: boolean; error?: string } {
  const s = backend(store);
  if (!s) return { ok: false, error: 'storage unavailable' };
  const check = validateProps(props);
  if (!check.valid) return { ok: false, error: check.errors.join('; ') };
  const doc: IslandPropsDoc = { version: ISLAND_PROPS_VERSION, course: 'basalt', timestamp: now, props };
  try {
    const key = islandPropsKey(trackId);
    const previous = s.getItem(key);
    if (previous) s.setItem(islandBackupKey(trackId), previous);
    s.setItem(key, JSON.stringify(doc));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'storage full' };
  }
}
