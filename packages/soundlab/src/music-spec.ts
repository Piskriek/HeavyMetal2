import { mulberry32 } from './render';

export type Mood = 'chill' | 'energetic' | 'dramatic';
export const MOODS: readonly Mood[] = ['chill', 'energetic', 'dramatic'];

/** The music is a recipe too: a mood, a tempo, a length and a seed for a different tune. */
export interface MusicSpec { seed: number; bars: number; mood: Mood; bpm: number }

export const DEFAULT_MUSIC_SPEC: MusicSpec = { seed: 7, bars: 8, mood: 'energetic', bpm: 138 };

export function moodDefaults(m: Mood): { bpm: number } {
  return { bpm: m === 'chill' ? 100 : m === 'dramatic' ? 112 : 138 };
}

export function validateMusicSpec(s: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof s !== 'object' || s === null) return { ok: false, errors: ['The music settings must be an object.'] };
  const o = s as Record<string, unknown>;
  if (typeof o['seed'] !== 'number' || !Number.isFinite(o['seed'])) errors.push('The seed must be a number.');
  if (typeof o['bars'] !== 'number' || !Number.isInteger(o['bars']) || o['bars'] < 1 || o['bars'] > 16) errors.push('The length must be a whole number of bars from 1 to 16.');
  if (!(MOODS as readonly unknown[]).includes(o['mood'])) errors.push(`The mood must be one of ${MOODS.join(', ')}.`);
  if (typeof o['bpm'] !== 'number' || !Number.isFinite(o['bpm']) || o['bpm'] < 60 || o['bpm'] > 200) errors.push('The tempo must be between 60 and 200 BPM.');
  return { ok: errors.length === 0, errors };
}

export function normalizeMusicSpec(s: MusicSpec): MusicSpec {
  const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);
  return {
    seed: Math.max(0, Math.round(fin(s.seed, 7))),
    bars: Math.min(16, Math.max(1, Math.round(fin(s.bars, 8)))),
    mood: (MOODS as readonly unknown[]).includes(s.mood) ? s.mood : 'energetic',
    bpm: Math.min(200, Math.max(60, Math.round(fin(s.bpm, 138)))),
  };
}

export function randomMusicSpec(seed: number): MusicSpec {
  const r = mulberry32(Math.floor(seed) * 3266489917 + 5);
  const mood = MOODS[Math.floor(r() * MOODS.length)]!;
  const base = moodDefaults(mood).bpm;
  return normalizeMusicSpec({ seed: Math.floor(seed), bars: [4, 8, 8, 12, 16][Math.floor(r() * 5)]!, mood, bpm: base + Math.round((r() * 2 - 1) * 12) });
}

export function describeMusicSpec(s: MusicSpec): string {
  return `${s.bars} bar${s.bars === 1 ? '' : 's'} of ${s.mood} music at ${s.bpm} BPM, seed ${s.seed}`;
}
