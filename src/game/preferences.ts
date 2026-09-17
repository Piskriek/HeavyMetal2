import { COURSES, DEFAULT_OPTIONS, type GameOptions, type RunRecord } from './types';
import { runRecordKey } from './session';

export const OPTIONS_KEY = 'goblin-rally-options-v1';
export const RECORDS_KEY = 'goblin-rally-records-v1';
/** One committed result per session round; a reload can never duplicate a record. */
export const MAX_RECORDS = 20;

export function defaultOptions(): GameOptions {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    ...DEFAULT_OPTIONS,
    reducedMotion: reduced,
    menuMotion: !reduced,
    screenShake: !reduced,
    highContrast: window.matchMedia('(prefers-contrast: more)').matches,
  };
}

export function readOptions(): GameOptions {
  const options = defaultOptions();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return options;
    const saved = stored as Partial<GameOptions>;
    for (const key of ['sound', 'screenShake', 'downrange', 'parallax', 'aimAssist', 'menuMotion', 'reducedMotion', 'highContrast'] as const) {
      if (typeof saved[key] === 'boolean') options[key] = saved[key];
    }
    if (COURSES.some((course) => course.id === saved.course)) options.course = saved.course!;
    if (saved.graphics === 'auto' || saved.graphics === 'performance' || saved.graphics === 'quality') options.graphics = saved.graphics;
    for (const [key, min, max] of [['launchSpeed', 80, 240], ['ballWeight', 40, 240], ['masterVolume', 0, 100]] as const) {
      if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) options[key] = Math.max(min, Math.min(max, saved[key]!));
    }
  } catch { /* Local storage is optional. */ }
  return options;
}

export function readRecords(): RunRecord[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    // Historical records are kept even when their course label is missing: the UI
    // already falls back to the first circuit, and history is not ours to delete.
    const valid = saved.filter((item): item is RunRecord => item && typeof item === 'object'
      && typeof item.id === 'string' && typeof item.date === 'string'
      && ['distance', 'score', 'topSpeed'].every((key) => typeof item[key] === 'number' && Number.isFinite(item[key])));
    const seen = new Set<string>();
    const unique = valid.filter((record) => {
      const key = runRecordKey(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.sort((a, b) => b.distance - a.distance || b.score - a.score).slice(0, MAX_RECORDS);
  } catch { return []; }
}

/** Adds one committed result, replacing any earlier record for the same session round. */
export function mergeRunRecord(records: RunRecord[], record: RunRecord): RunRecord[] {
  const key = runRecordKey(record);
  return [record, ...records.filter((item) => runRecordKey(item) !== key)]
    .sort((a, b) => b.distance - a.distance || b.score - a.score).slice(0, MAX_RECORDS);
}

/** Returns false when the browser denied the write, so the UI can say so honestly. */
export function savePreference(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}