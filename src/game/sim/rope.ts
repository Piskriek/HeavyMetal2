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
export function ropeAt(hitAt: number | undefined, now: number): RopeState {
  if (hitAt === undefined || !Number.isFinite(hitAt)) return TAUT;
  const t = now - hitAt;
  if (t < 0 || t >= ROPE_REEL_S) return TAUT;
  if (t < ROPE_PAYOUT_S) return { spring: ROPE_SLACK_SPRING, damping: ROPE_SLACK_DAMPING, slack: true };
  const u = (t - ROPE_PAYOUT_S) / (ROPE_REEL_S - ROPE_PAYOUT_S);
  const s = u * u * (3 - 2 * u); // smoothstep: the reel starts gently and finishes firm
  return {
    spring: ROPE_SLACK_SPRING + (1 - ROPE_SLACK_SPRING) * s,
    damping: ROPE_SLACK_DAMPING + (1 - ROPE_SLACK_DAMPING) * s,
    slack: true,
  };
}
