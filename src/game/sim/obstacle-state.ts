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

export function obstacleTouchedBy(obstacle: Obstacle, racerId: number): boolean {
  return obstacle.hitBy?.has(racerId) ?? false;
}

/** Per-attempt state an isolated run owns: what it broke, what it set off, who touched it. */
export interface ObstacleLedgerEntry {
  readonly kind: Obstacle['kind'];
  readonly x: number;
  readonly hit: boolean;
  readonly broken: boolean;
}

export function obstacleLedger(obstacles: readonly Obstacle[]): readonly ObstacleLedgerEntry[] {
  return obstacles
    .filter((obstacle) => obstacle.hit || obstacle.broken === true)
    .map((obstacle) => Object.freeze({ kind: obstacle.kind, x: obstacle.x, hit: obstacle.hit, broken: obstacle.broken === true }));
}
