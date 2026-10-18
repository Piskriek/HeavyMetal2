// src/index.ts
// The five-bus mix as pure data and pure functions (TASK-29 part A, T09a).
// Voice, combat and UI, world SFX, ambience, music. Every source plays on exactly one bus.
// No DOM, no Date, no randomness: game-audio.ts turns these numbers into Web Audio ramps, and the tests pin them.

/** The five buses. */
export type BusId = 'voice' | 'combatUi' | 'world' | 'ambience' | 'music';

/** Bus order as the Settings sliders read top to bottom. */
export const BUS_IDS: readonly BusId[] = Object.freeze(['voice', 'combatUi', 'world', 'ambience', 'music'] as const);

export const BUS_LABELS: Readonly<Record<BusId, string>> = Object.freeze({
  voice: 'Voice (Dr. Haddy)',
  combatUi: 'Combat and UI',
  world: 'World effects',
  ambience: 'Ambience',
  music: 'Music',
});

/** Linear gain for a level in decibels (0 dB is 1.0). */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/**
 * The starting gains. Voice and music are the owner's mix (faders 80 and 45, MENTOR_MIX); the other three are Argo's
 * levels from brief 29: combat and UI -4 dB, world -6 dB, ambience -12 dB.
 */
export const BUS_START: Readonly<Record<BusId, number>> = Object.freeze({
  voice: 0.8,
  combatUi: dbToGain(-4),
  world: dbToGain(-6),
  ambience: dbToGain(-12),
  music: 0.45,
});

/**
 * While she speaks. Each bus ducks by its depth in dB (0 is not ducked: the voice itself) over the attack, and
 * comes back over the release. The world bus also drops its low-pass to 1.8 kHz while ducked.
 */
export const DUCK: {
  readonly attackS: number;
  readonly releaseS: number;
  readonly depthDb: Readonly<Record<BusId, number>>;
  readonly worldLowpassHz: number;
  readonly worldLowpassOpenHz: number;
} = Object.freeze({
  attackS: 0.08,
  releaseS: 0.45,
  depthDb: Object.freeze({ voice: 0, combatUi: -2, world: -6.5, ambience: -5, music: -8 }),
  worldLowpassHz: 1800,
  worldLowpassOpenHz: 20000,
});

/** Which bus a sound plays on. The voice bus is fed by the narrator's chain, not by a sound id. */
export function busOfSound(id: string): BusId {
  if (id.startsWith('music-') || id.startsWith('synth-radio-') || id.startsWith('tape-') || id === 'synth-choir-convergence') return 'music';
  if (id.startsWith('amb-')) return 'ambience';
  if (id.startsWith('sfx-ui-') || id === 'sfx-refuse') return 'combatUi';
  if (id.startsWith('sfx-fire-') || id === 'sfx-reload' || id === 'sfx-empty' || id.startsWith('sfx-turbobass') || id === 'sfx-bass-pulse') return 'combatUi';
  return 'world';
}

/**
 * The duck's level in dB at `t` seconds after she starts speaking. `releaseAt` is when she stops (null while she is
 * still going). The attack and the release are linear ramps; a release that comes before the attack has finished
 * starts from the level reached, so a short line never jumps.
 */
export function duckLevelDb(bus: BusId, t: number, releaseAt: number | null): number {
  const depth = DUCK.depthDb[bus];
  if (depth === 0 || t <= 0) return 0;
  if (releaseAt === null || t < releaseAt) return depth * Math.min(1, t / DUCK.attackS);
  const startLevel = depth * Math.min(1, Math.max(0, releaseAt) / DUCK.attackS);
  const f = Math.min(1, (t - releaseAt) / DUCK.releaseS);
  return startLevel * (1 - f);
}

/** The duck as a linear gain (1 = not ducked). */
export function duckGainAt(bus: BusId, t: number, releaseAt: number | null): number {
  return dbToGain(duckLevelDb(bus, t, releaseAt));
}

/** The bit-depth mirror (DEC-07): the sample rate it holds at, and the bits it keeps. */
export interface Crush {
  readonly rateHz: number;
  readonly bits: number;
}

/** Stage 0 is 8 kHz at 4 bits, stage 1 is 11 kHz at 8 bits, stage 2 is 22 kHz at 12 bits; stage 3 and up is full (null). */
const CRUSH_BY_STAGE: readonly (Crush | null)[] = [
  { rateHz: 8000, bits: 4 },
  { rateHz: 11025, bits: 8 },
  { rateHz: 22050, bits: 12 },
  null,
  null,
  null,
  null,
];

/** The crush for a Fidelity stage (0 to 6, a fraction rounds down); null means play at full depth. */
export function crushForStage(stage: number): Crush | null {
  const s = Number.isFinite(stage) ? Math.floor(Math.min(6, Math.max(0, stage))) : 0;
  return CRUSH_BY_STAGE[s] ?? null;
}

/** The pickup chime ladder: a run of chunks rises a semitone per chunk, up to an octave. */
export const CHIME_RESET_S = 1.2;
export const CHIME_MAX_SEMITONES = 12;

export interface ChimeState {
  /** Chunks in the current run, counted from 0 for the first. -1 before any. */
  readonly run: number;
  /** When the last chunk was, in seconds on the game clock. */
  readonly lastS: number;
}

export const CHIME_IDLE: ChimeState = Object.freeze({ run: -1, lastS: Number.NEGATIVE_INFINITY });

/**
 * One chunk at `atS` (seconds, never going back). Its semitone offset from the run's base note, and the state to keep.
 * A chunk within 1.2 s of the last one continues the run (+1 semitone); a longer gap starts a new run at 0.
 */
export function chimeStep(prev: ChimeState, atS: number): { readonly semitones: number; readonly state: ChimeState } {
  const continues = prev.run >= 0 && atS - prev.lastS <= CHIME_RESET_S;
  const run = continues ? prev.run + 1 : 0;
  return { semitones: Math.min(CHIME_MAX_SEMITONES, run), state: { run, lastS: atS } };
}

/** The playback-rate ratio for a number of semitones (12 is an octave). */
export function chimeRatio(semitones: number): number {
  return 2 ** (semitones / 12);
}
