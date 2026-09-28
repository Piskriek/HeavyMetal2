/**
 * T04 — mutable obstacle state, written the same way for a race and for an isolated attempt.
 *
 * The engine used to record who touched an obstacle with `hitMask |= 1 << racerId`. That wraps
 * past racer 30, and a qualifying field can be 20, 50 or 100 wide, so identity is recorded in a
 * `Set` instead. The legacy mask is still written inside its safe range because saves and the
 * 3D builder carry the field; nothing reads it for gameplay.
 */
import type { Obstacle } from '../scene';

/** Highest racer ID the legacy 32-bit `hitMask` can represent without wrapping. */
export const HIT_MASK_SAFE_MAX = 30;

export function recordObstacleHit(obstacle: Obstacle, racerId: number): void {
  (obstacle.hitBy ??= new Set<number>()).add(racerId);
  if (Number.isSafeInteger(racerId) && racerId >= 0 && racerId <= HIT_MASK_SAFE_MAX) {
    obstacle.hitMask = (obstacle.hitMask ?? 0) | (1 << racerId);
  }
}

/** Who has touched an obstacle, read from the scalable ledger. */
export function obstacleTouchedBy(obstacle: Obstacle, racerId: number): boolean {
  return obstacle.hitBy?.has(racerId) ?? false;
}
