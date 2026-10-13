// The walkers: monsters that roam the wasteland outside the lab window, on straight patrols (out and back, deterministic in time).
// Pure: their poses come from the clock alone, so the same time always gives the same pose.
import type { Archetype, Era } from './roster';

export interface WalkerSpec {
  readonly id: number;
  readonly kind: Archetype;
  readonly era: Era;
  /** The ends of the patrol, on the ground (x, z in lab metres). */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  /** Metres per second along the patrol. */
  readonly speed: number;
  /** Where on the patrol the walker starts, as a fraction of one out-and-back trip (0 to 1). */
  readonly offset: number;
}

export interface WalkerPose {
  readonly id: number;
  readonly kind: Archetype;
  readonly x: number;
  readonly z: number;
  /** The facing (radians, atan2(x, z)): the way the walker is moving. */
  readonly yaw: number;
  /** Seconds into its walk (the walk clip plays from this). */
  readonly phaseT: number;
}

/** The pose of a walker at `t` seconds: out along the patrol and back, at the walker's speed, turning at each end. */
export function walkerPose(w: WalkerSpec, t: number): WalkerPose {
  const dx = w.to[0] - w.from[0], dz = w.to[1] - w.from[1];
  const len = Math.hypot(dx, dz);
  const ux = len > 0 ? dx / len : 0, uz = len > 0 ? dz / len : 0;
  if (len <= 0 || w.speed <= 0) {
    return { id: w.id, kind: w.kind, x: w.from[0], z: w.from[1], yaw: Math.atan2(ux, uz), phaseT: t };
  }
  const trip = (2 * len) / w.speed;
  const p = ((t / trip + w.offset) % 1 + 1) % 1;
  const outward = p < 0.5;
  // the triangle wave of the trip: 0 at the start, 1 at the far end, back to 0
  const f = outward ? p * 2 : (1 - p) * 2;
  const s = f * len;
  const sign = outward ? 1 : -1;
  return {
    id: w.id,
    kind: w.kind,
    x: w.from[0] + ux * s,
    z: w.from[1] + uz * s,
    yaw: Math.atan2(ux * sign, uz * sign),
    phaseT: t,
  };
}

/** The time of one out-and-back trip of a walker, in seconds. */
export function tripSeconds(w: WalkerSpec): number {
  const len = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]);
  return w.speed > 0 ? (2 * len) / w.speed : Infinity;
}
