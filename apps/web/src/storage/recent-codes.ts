// The plot codes this player visited most recently (Planetary Grid, "Recently visited codes"). Kept in the active profile's
// storage (kv), so each profile has its own list. The list logic is pure; only the two save helpers touch storage.

import { kv } from './profile-storage';

export const RECENT_CODES_KEY = 'hm.setmix.grid.recent';
export const RECENT_CODES_MAX = 8;

/** Pure: the list with `code` at the front, no repeats, at most `max` long. A blank code changes nothing. */
export function withRecentCode(list: readonly string[], code: string, max: number = RECENT_CODES_MAX): string[] {
  const c = code.trim();
  if (c.length === 0) return list.slice(0, max);
  return [c, ...list.filter((x) => x !== c)].slice(0, max);
}

/** Pure: keeps only the strings of a parsed save, at most `max`. Anything else (a damaged save) gives an empty list. */
export function cleanRecentCodes(raw: unknown, max: number = RECENT_CODES_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max);
}

/** The saved list of this profile, most recent first. */
export function loadRecentCodes(): string[] {
  try {
    return cleanRecentCodes(JSON.parse(kv.get(RECENT_CODES_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

/** Puts a visited code at the front of this profile's list and saves it. Returns the new list. */
export function rememberRecentCode(code: string): string[] {
  const next = withRecentCode(loadRecentCodes(), code);
  kv.set(RECENT_CODES_KEY, JSON.stringify(next));
  return next;
}
