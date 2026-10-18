// src/print-sweep.ts
// The print sweep (P0-VFX-02, TASK-29 part A): a placed foundation, wall or machine is revealed from its base to its top by a
// clip plane over 0.65 s, with a bright leading edge, then settles with a small spring. Pure functions of time: no DOM, no Date,
// no randomness. The shader and the mesh code (T09b) read these numbers.
//
// The 4 cm: while the clip plane is still rising the piece is held 4 cm above its footprint; when the sweep reaches the top it
// drops into place on a damped spring (zeta 0.5, 5 Hz), which overshoots by about 6 mm and is at rest within 0.5 mm after
// about 0.3 s. Holding the offset during the sweep means the piece never jumps when the spring starts.

/** The clip-plane sweep, in seconds, from the base to the top. */
export const PRINT_SWEEP_S = 0.65;
/** The settle's starting height above the footprint, in metres (4 cm). */
export const PRINT_SETTLE_M = 0.04;
/** The bright leading edge of the sweep. */
export const PRINT_EDGE_HEX = '#7cff4d';
/** The settle spring: 5 Hz, damping ratio 0.5. */
export const PRINT_SETTLE_HZ = 5;
export const PRINT_SETTLE_ZETA = 0.5;
/** At rest once the offset is inside this many metres (0.5 mm). */
export const PRINT_REST_M = 0.0005;

export interface PrintFrame {
  /** How far the clip plane has risen: 0 at the base, 1 at the top. */
  readonly clip: number;
  /** The piece's height over its footprint in metres: 4 cm during the sweep, then the spring back to 0. */
  readonly offsetM: number;
  /** True once the sweep is done and the spring's swing is inside its rest band (0.5 mm), for good. */
  readonly settled: boolean;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The settle is at rest once its envelope (the largest swing left, not the swing right now) is inside the rest band: after
 * this many seconds of settle. Using the envelope means the flag cannot read true at a zero crossing.
 */
const SETTLE_AMP = Math.sqrt(1 + (PRINT_SETTLE_ZETA * PRINT_SETTLE_ZETA) / (1 - PRINT_SETTLE_ZETA * PRINT_SETTLE_ZETA));
export const PRINT_REST_AFTER_S = Math.log((PRINT_SETTLE_M * SETTLE_AMP) / PRINT_REST_M) / (2 * Math.PI * PRINT_SETTLE_HZ * PRINT_SETTLE_ZETA);

/** The clip-plane height (0 to 1) at `tS` seconds after the piece is placed. */
export function printSweepClip(tS: number): number {
  return Number.isFinite(tS) ? clamp01(tS / PRINT_SWEEP_S) : 0;
}

/**
 * The settle spring's offset `uS` seconds after the sweep ends: the damped response to a 4 cm start at rest, so it starts at
 * 4 cm with zero speed, then decays through a small overshoot to 0.
 */
export function printSettleM(uS: number): number {
  if (!(uS >= 0)) return PRINT_SETTLE_M;
  const w = 2 * Math.PI * PRINT_SETTLE_HZ;
  const z = PRINT_SETTLE_ZETA;
  const wd = w * Math.sqrt(1 - z * z);
  const env = Math.exp(-z * w * uS);
  return PRINT_SETTLE_M * env * (Math.cos(wd * uS) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * uS));
}

/** The whole print frame `tS` seconds after the piece is placed. */
export function printFrame(tS: number): PrintFrame {
  const t = Number.isFinite(tS) ? Math.max(0, tS) : 0;
  const clip = printSweepClip(t);
  if (t < PRINT_SWEEP_S) return { clip, offsetM: PRINT_SETTLE_M, settled: false };
  const offsetM = printSettleM(t - PRINT_SWEEP_S);
  return { clip: 1, offsetM, settled: t - PRINT_SWEEP_S >= PRINT_REST_AFTER_S };
}
