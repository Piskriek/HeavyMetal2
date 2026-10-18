// ============================================================================
// File: apps/web/src/studio/audio-tab-data.ts
// Pure data types and audio calculation helpers for the Studio Audio tab (POL-87).
// Does NOT import CSS so Node unit tests can import this safely.
// ============================================================================

export interface AudioLevelEntry {
  readonly gain: number;
  readonly rms?: number;
  readonly start?: number;
  readonly end?: number;
  readonly loopStart?: number;
  readonly loopEnd?: number;
}

export type AudioLevels =
  | Readonly<Record<string, AudioLevelEntry>>
  | {
      readonly about?: string;
      readonly levels: Readonly<Record<string, AudioLevelEntry>>;
    };

export interface AudioPatch {
  readonly gain?: number;
  readonly loopStart?: number;
  readonly loopEnd?: number;
}

export type AudioCategory = 'all' | 'music' | 'machines' | 'combat' | 'vehicles' | 'ui';

export const CATEGORY_LABELS: Readonly<Record<AudioCategory, string>> = {
  all: 'All Sounds',
  music: 'Music',
  machines: 'Machines & Lab',
  combat: 'Beam & Combat',
  vehicles: 'Vehicles',
  ui: 'Build & UI',
};

/** Converts decibels (`-36` to `+18` dB) into linear Web Audio gain (`10^(dB / 20)`). */
export function dbToLinear(db: number): number {
  if (!Number.isFinite(db)) return 1;
  const clamped = Math.max(-48, Math.min(24, db));
  return Math.pow(10, clamped / 20);
}

/** Normalizes either `{ levels: Record<...> }` or a flat `Record<string, AudioLevelEntry>` into a clean map. */
export function normalizeAudioLevels(
  input: AudioLevels | null | undefined
): Readonly<Record<string, AudioLevelEntry>> {
  if (!input || typeof input !== 'object') return {};
  if ('levels' in input && input.levels && typeof input.levels === 'object' && !('gain' in input.levels)) {
    return input.levels as Readonly<Record<string, AudioLevelEntry>>;
  }
  return input as Readonly<Record<string, AudioLevelEntry>>;
}

/** Classifies a sound ID from `levels.json` into a filterable Studio bus category. */
export function audioCategoryOf(id: string): Exclude<AudioCategory, 'all'> {
  if (id.startsWith('music-')) return 'music';
  if (
    id.includes('motor-') ||
    id.includes('skid') ||
    id.includes('impact')
  ) {
    return 'vehicles';
  }
  if (
    id.includes('fire-') ||
    id.includes('reload') ||
    id.includes('empty') ||
    id.includes('beam') ||
    id.includes('storm')
  ) {
    return 'combat';
  }
  if (
    id.includes('mill') ||
    id.includes('press') ||
    id.includes('projector') ||
    id.includes('watermaker') ||
    id.includes('fabricator') ||
    id.includes('breaker') ||
    id.includes('relay') ||
    id.includes('lever') ||
    id.includes('capacitor') ||
    id.includes('gate-')
  ) {
    return 'machines';
  }
  return 'ui';
}

/** Clamps a gain/loop patch to safe finite ranges. */
export function clampAudioPatch(patch: AudioPatch): AudioPatch {
  const out: { gain?: number; loopStart?: number; loopEnd?: number } = {};
  if (patch.gain !== undefined && Number.isFinite(patch.gain)) {
    out.gain = Math.round(Math.max(-36, Math.min(18, patch.gain)) * 10) / 10;
  }
  if (patch.loopStart !== undefined && Number.isFinite(patch.loopStart)) {
    out.loopStart = Math.round(Math.max(0, patch.loopStart) * 1000) / 1000;
  }
  if (patch.loopEnd !== undefined && Number.isFinite(patch.loopEnd)) {
    out.loopEnd = Math.round(Math.max(0, patch.loopEnd) * 1000) / 1000;
  }
  return out;
}
