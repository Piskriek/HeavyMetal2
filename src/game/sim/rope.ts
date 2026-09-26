/**
 * The lane rope.
 *
 * Every ball is tied to its own lane (its authored path) by a retractable rope: normally taut, so the
 * ball rides its lane. A collision "shoots" the rope out — for a moment it pays out slack, the ball
 * keeps the sideways speed the hit gave it (it can be knocked right across the road into the tree
 * line), and then the rope reels it back into its lane. A hit never changes which lane a ball belongs
 * to. Pure: no DOM, no THREE.
 */

/** Seconds the rope pays out freely after a hit. */
export const ROPE_PAYOUT_S = 0.6;
/** Seconds after the hit by which the rope is fully taut again. */
export const ROPE_REEL_S = 1.7;
/** Spring share while paying out (≈ free). */
export const ROPE_SLACK_SPRING = 0.04;
/** Damping share while paying out: the ball keeps its sideways speed. */
export const ROPE_SLACK_DAMPING = 0.05;
/** Sideways speed into the road edge that counts as smashing into the tree line. */
export const EDGE_SMASH_VZ = 220;

/**
 * H7b: the three rope timings the owner tunes by feel in the test drive. They travel on the sim
 * context (`RacerStepContext.rope`), never as a module global, so a race stays deterministic and a
 * context without them is the tuned defaults below.
 */
export interface RopeConfig {
  /** Seconds the rope pays out freely after a hit. */
  readonly payoutS: number;
  /** Seconds after the hit by which the rope is fully taut again. */
  readonly reelS: number;
  /** Sideways speed into the road edge that counts as a smash. */
  readonly edgeSmashVz: number;
}

export const DEFAULT_ROPE: RopeConfig = Object.freeze({ payoutS: ROPE_PAYOUT_S, reelS: ROPE_REEL_S, edgeSmashVz: EDGE_SMASH_VZ });

/** The tuning ranges (and slider steps) the test drive offers. */
export const ROPE_LIMITS = Object.freeze({
  payoutS: { min: 0.1, max: 2, step: 0.05 },
  reelS: { min: 0.5, max: 4, step: 0.1 },
  edgeSmashVz: { min: 100, max: 500, step: 10 },
});

/** A config with every value inside its range, and the reel always ending after the payout. */
export function clampRope(config: Partial<RopeConfig>, base: RopeConfig = DEFAULT_ROPE): RopeConfig {
  const pick = (key: keyof RopeConfig) => {
    const value = config[key];
    const { min, max } = ROPE_LIMITS[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : base[key];
  };
  const payoutS = pick('payoutS');
  return { payoutS, reelS: Math.max(pick('reelS'), payoutS + 0.05), edgeSmashVz: pick('edgeSmashVz') };
}

export interface RopeState {
  /** Multiplies the lane spring. 1 = taut. */
  readonly spring: number;
  /** Multiplies the lateral damping. 1 = normal. */
  readonly damping: number;
  /** True while the rope has slack: the ball may leave its lane corridor, up to the road edge. */
  readonly slack: boolean;
}

const TAUT: RopeState = Object.freeze({ spring: 1, damping: 1, slack: false });

/** The rope for a ball last hit at `hitAt` (seconds on the race clock), now `now`. */
export function ropeAt(hitAt: number | undefined, now: number, config: RopeConfig = DEFAULT_ROPE): RopeState {
  if (hitAt === undefined || !Number.isFinite(hitAt)) return TAUT;
  const { payoutS, reelS } = config;
  const t = now - hitAt;
  if (t < 0 || t >= reelS) return TAUT;
  if (t < payoutS) return { spring: ROPE_SLACK_SPRING, damping: ROPE_SLACK_DAMPING, slack: true };
  const u = (t - payoutS) / (reelS - payoutS);
  const s = u * u * (3 - 2 * u); // smoothstep: the reel starts gently and finishes firm
  return {
    spring: ROPE_SLACK_SPRING + (1 - ROPE_SLACK_SPRING) * s,
    damping: ROPE_SLACK_DAMPING + (1 - ROPE_SLACK_DAMPING) * s,
    slack: true,
  };
}
