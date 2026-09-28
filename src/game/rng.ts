/**
 * T02 — separated RNG streams.
 *
 * The ticket requires gameplay randomness to be deterministic per seed and cosmetic
 * randomness to never leak into simulation state:
 *
 * - **Gameplay stream**: seeded from the session seed. Every call happens inside a fixed
 *   simulation step in deterministic order, so the same seed replays the same race.
 *   `reset(seed?)` restores the stream explicitly — this is what "reset RNG explicitly
 *   for deterministic same-seed replay" means in code.
 * - **Cosmetic stream**: seeded from the wall clock. Particles, shake jitter and record
 *   ids draw from it; consuming it can never change physics because no simulation code
 *   reads it.
 *
 * Pure module: no DOM, no engine imports — safe for headless tests.
 */

/** Deterministic 32-bit generator (mulberry32). Small, fast, and good enough for games. */
export function createRng(seed: number): Rng {
  let state = normalizeSeed(seed);
  const initial = state;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    get seed() { return initial; },
    next,
    nextInt: (boundExclusive: number) => Math.floor(next() * boundExclusive),
    nextRange: (min: number, max: number) => min + next() * (max - min),
    state: () => state,
    setState: (value: number) => { state = normalizeSeed(value); },
    reset: (value?: number) => { state = normalizeSeed(value ?? initial); },
  };
}

export interface Rng {
  /** The seed the stream was created with; `reset()` without arguments returns to it. */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, boundExclusive). */
  nextInt(boundExclusive: number): number;
  /** Uniform float in [min, max). */
  nextRange(min: number, max: number): number;
  /** Serializable generator state, for snapshots and replays. */
  state(): number;
  setState(value: number): void;
  /** Explicit reset: back to the given seed, or the creation seed when omitted. */
  reset(seed?: number): void;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1;
  return Math.floor(seed) | 0;
}

/**
 * A deliberately non-deterministic seed for cosmetic streams. Gameplay code must never
 * call this — gameplay seeds come from the session so replays stay reproducible.
 */
export function cosmeticSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
}
