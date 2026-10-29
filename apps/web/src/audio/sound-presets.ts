/**
 * Sounds as presets (plan 57 §14.2, Argon's yes, 29 Oct): a `snd:` preset is a recorded file with how it plays. That covers the
 * trim on top of the file's measured level (public/audio/levels.json), its loop and loop region, how it falls off with distance,
 * and the moment it answers. An optional @hm/soundlab recipe id names a synth stand-in, for editing in the Audio Lab later; the
 * recorded file stays the sound today.
 *
 * The lab's sounds are the first: the breaker, the relays, the lever, the capacitor hum, the gate's spool and hum, the storm and
 * the lab's music. Pure data and the name code; game-audio plays them.
 */

/** How a positioned sound fades with distance (the Web Audio panner's inverse model). */
export interface SoundFalloff {
  /** Metres within which it plays at its full level. */
  readonly refDistance: number;
  /** Metres beyond which it fades no further. */
  readonly maxDistance: number;
  /** How fast it fades past refDistance. */
  readonly rolloff: number;
}

export interface SoundPreset {
  readonly id: string;
  /** The player's word for it. */
  readonly name: string;
  /** The recorded file's audio id (public/audio/index.json). */
  readonly file: string;
  /** A loop holds its voice until stopped; a one-shot plays once. */
  readonly loop: boolean;
  /** 0 to 1, on top of the file's measured level. */
  readonly volume: number;
  /** Seconds of the file to loop, where the measured region (levels.json) is not the one wanted. */
  readonly loopRegion?: { readonly start: number; readonly end: number };
  /** How it fades with distance; absent for a sound heard everywhere (music). */
  readonly falloff?: SoundFalloff;
  /** The moment it answers, as `<place>:<event>`. */
  readonly trigger: string;
  /** An @hm/soundlab recipe id: a synth stand-in for the Audio Lab, later. */
  readonly recipe?: string;
}

/** The panner's defaults in game-audio's play3d, so a preset says what a call there used to leave out. */
export const DEFAULT_FALLOFF: SoundFalloff = { refDistance: 1.5, maxDistance: 80, rolloff: 1 };

/** The lab's sounds, salvaged as presets. */
export const LAB_SOUNDS = {
  breaker: { id: 'lab-breaker', name: 'Breaker thrown', file: 'sfx-breaker', loop: false, volume: 1, falloff: DEFAULT_FALLOFF, trigger: 'breaker:thrown' },
  relay: { id: 'lab-relay', name: 'Relay click', file: 'sfx-relay', loop: false, volume: 1, falloff: DEFAULT_FALLOFF, trigger: 'relay:closed' },
  lever: { id: 'lab-lever', name: 'Main lever', file: 'sfx-lever', loop: false, volume: 1, falloff: DEFAULT_FALLOFF, trigger: 'gate:lever' },
  capacitorHum: { id: 'capacitor-hum', name: 'Capacitor hum', file: 'sfx-capacitor-hum', loop: true, volume: 0.9, falloff: DEFAULT_FALLOFF, trigger: 'capacitor:charged' },
  gateSpool: { id: 'gate-spool', name: 'Gate spool-up', file: 'sfx-gate-spool', loop: false, volume: 1, falloff: DEFAULT_FALLOFF, trigger: 'gate:spool' },
  gateHum: { id: 'gate-hum', name: 'Gate hum', file: 'sfx-gate-hum', loop: true, volume: 0.85, falloff: DEFAULT_FALLOFF, trigger: 'gate:open' },
  storm: { id: 'lab-storm', name: 'Storm outside', file: 'sfx-storm', loop: true, volume: 0.8, falloff: DEFAULT_FALLOFF, trigger: 'lab:storm' },
  music: { id: 'lab-music', name: 'Lab at night', file: 'music-lab', loop: true, volume: 1, trigger: 'lab:enter' },
} as const satisfies Readonly<Record<string, SoundPreset>>;

export const SOUND_PRESETS: readonly SoundPreset[] = Object.values(LAB_SOUNDS);

export const SOUND_PREFIX = 'snd:';

/** A preset's name, `snd:<id>`. */
export const soundName = (p: Pick<SoundPreset, 'id'>): string => `${SOUND_PREFIX}${p.id}`;

/** The preset a `snd:` name stands for, or undefined for any other name. */
export function soundPresetOfName(name: string): SoundPreset | undefined {
  if (!name.startsWith(SOUND_PREFIX)) return undefined;
  const id = name.slice(SOUND_PREFIX.length);
  return SOUND_PRESETS.find((p) => p.id === id);
}

/**
 * The seconds a file loops: the region a preset playing it sets, else the file's measured one (levels.json), else none (the whole
 * file loops).
 */
export function loopRegionOf(
  file: string,
  measured?: { readonly start?: number; readonly end?: number },
  presets: readonly SoundPreset[] = SOUND_PRESETS,
): { readonly start: number; readonly end: number } | null {
  const own = presets.find((p) => p.file === file)?.loopRegion;
  if (own) return own;
  return measured?.start !== undefined && measured.end !== undefined ? { start: measured.start, end: measured.end } : null;
}
