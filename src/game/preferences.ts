import { COURSES, DEFAULT_OPTIONS, type GameOptions, type RunRecord } from './types';

export const OPTIONS_KEY = 'goblin-rally-options-v1';
export const RECORDS_KEY = 'goblin-rally-records-v1';

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
    return saved.filter((item): item is RunRecord => item && typeof item === 'object'
      && typeof item.id === 'string' && typeof item.date === 'string'
      && ['distance', 'score', 'topSpeed'].every((key) => typeof item[key] === 'number' && Number.isFinite(item[key])))
      .sort((a, b) => b.distance - a.distance || b.score - a.score).slice(0, 20);
  } catch { return []; }
}

export function savePreference(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing may deny storage. */ }
}