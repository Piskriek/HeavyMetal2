/**
 * ISLAND-ROUTE: the island's own placed props, kept apart from the owner's classic track.
 *
 * The classic track lives under the `hm2-track-props-*` keys and `backups/props/`; nothing here reads
 * or writes either. The island has its own browser key (plus one backup copy of the previous save)
 * and its own disk folder, `backups/island/`, written by the dev server's island endpoints.
 */
import type { PlacedProp } from '../builder/prop-catalog';
import { validateProps } from '../track-storage';

export const ISLAND_PROPS_KEY = 'hm2-island-props-v1';
export const ISLAND_PROPS_BACKUP_KEY = 'hm2-island-props-v1-backup';
export const ISLAND_PROPS_VERSION = 1;

/** The dev server's island routes (vite.config.ts): save + list, and read one saved file. */
export const ISLAND_BACKUP_ENDPOINTS = {
  backup: '/api/backup-island-props',
  restore: '/api/restore-island-backup',
  latestFile: 'island-props-latest.json',
} as const;

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

function parse(raw: string | null): PlacedProp[] | null {
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as Partial<IslandPropsDoc>;
    return doc && doc.course === 'basalt' && Array.isArray(doc.props) ? doc.props : null;
  } catch {
    return null;
  }
}

/** The island's saved props (the previous save if the latest is unreadable), or an empty list. */
export function readIslandProps(store?: Storage): PlacedProp[] {
  const s = backend(store);
  if (!s) return [];
  try {
    return parse(s.getItem(ISLAND_PROPS_KEY)) ?? parse(s.getItem(ISLAND_PROPS_BACKUP_KEY)) ?? [];
  } catch {
    return [];
  }
}

/**
 * Saves the island's props. The previous save moves to the backup key first. Refuses a list with
 * duplicate ids (the save would lose props on load); a full or blocked storage reports `ok: false`.
 */
export function writeIslandProps(props: PlacedProp[], store?: Storage, now = Date.now()): { ok: boolean; error?: string } {
  const s = backend(store);
  if (!s) return { ok: false, error: 'storage unavailable' };
  const check = validateProps(props);
  if (!check.valid) return { ok: false, error: check.errors.join('; ') };
  const doc: IslandPropsDoc = { version: ISLAND_PROPS_VERSION, course: 'basalt', timestamp: now, props };
  try {
    const previous = s.getItem(ISLAND_PROPS_KEY);
    if (previous) s.setItem(ISLAND_PROPS_BACKUP_KEY, previous);
    s.setItem(ISLAND_PROPS_KEY, JSON.stringify(doc));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'storage full' };
  }
}
