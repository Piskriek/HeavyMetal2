/**
 * T04 — the CPU driver, lifted out of `GameEngine` unchanged except for what it is allowed to see.
 *
 * In a race the driver scores three lanes against obstacles, supplies and *the other racers*, and
 * it rubber-bands against the human's position. An isolated qualifying attempt passes
 * `others: []` and `paceTargetX: null`, which is the whole point of the seam: a hidden bot cannot
 * influence another participant's decisions, cannot be bumped into a line change, and cannot be
 * chased as a catch-up target. Same code, same numbers, less knowledge.
 *
 * The decision stagger is a parameter for the same reason. The race keeps the legacy
 * `id * 0.023 s`; a large qualifying field uses a bounded stagger so decisions never queue behind
 * the racer's index.
 */
import { LANE_COUNT, laneZ, occupiesLane, weightImpulse, type Obstacle } from '../scene';
import type { AirPickup } from '../powerups';
import { hopTiming } from '../powerups';
import type { Racer } from '../racers';
import type { Difficulty } from '../session';
import type { RacerStepContext } from './context';
import { canHop, performBoost, performBounce, performHop } from './racer-physics';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** The engine's deterministic per-racer noise: stable for a given racer and moment. */
export const randomAt = (id: number, time: number) => {
  const value = Math.sin(id * 91.37 + Math.floor(time * 3) * 17.23) * 13791.73;
  return value - Math.floor(value);
};

export interface CpuContext {
  /** Shared simulation context (world, effects, clocks). */
  readonly step: RacerStepContext;
  readonly difficulty: Difficulty;
  /** Racers the driver may react to. An isolated attempt passes an empty list. */
  readonly others: readonly Racer[];
  /**
   * Down-range position the driver rubber-bands against — the human in a race, `nobody` in an
   * isolated attempt. `null` disables the catch-up term entirely.
   */
  readonly paceTargetX: number | null;
  /** Extra decision delay for this racer (engine: `id * 0.023`). Must stay bounded. */
  stagger(racer: Racer): number;
}

export function reactionDelay(difficulty: Difficulty): number {
  return difficulty === 'rookie' ? 0.43 : difficulty === 'veteran' ? 0.13 : 0.19;
}

export function laneCommitInterval(difficulty: Difficulty): number {
  return difficulty === 'rookie' ? 0.9 : difficulty === 'veteran' ? 0.48 : 0.66;
}

export function boostHoldOff(difficulty: Difficulty): number {
  return difficulty === 'rookie' ? 5.5 : difficulty === 'veteran' ? 2.8 : 3.4;
}

/** Requests a lane change; a lane only changes when the request is actually different. */
export function setLane(racer: Racer, lane: number, runTime: number): void {
  const next = clamp(Math.round(lane), 0, LANE_COUNT - 1);
  if (next === racer.targetLane) return;
  racer.targetLane = next; racer.lastLaneChange = runTime;
}

export function driveCpu(racer: Racer, ctx: CpuContext): void {
  const world = ctx.step.world;
  const runTime = ctx.step.runTime;
  const difficulty = ctx.difficulty;
  const reaction = reactionDelay(difficulty);
  racer.nextDecision = runTime + reaction + ctx.stagger(racer);
  if (racer.falling || racer.loopRide || racer.finished || runTime < racer.steerLockedUntil) return;
  const lookAhead = clamp(racer.vx * (difficulty === 'rookie' ? 0.54 : difficulty === 'veteran' ? 0.92 : 0.75), 360, 1350);
  const current = racer.targetLane;
  let bestLane = current; let bestScore = -Infinity;
  const seen = new Set<Obstacle>();
  const supplies = new Set<AirPickup>();
  for (const obstacle of world.obstaclesInSpan(racer.x, racer.x + lookAhead)) seen.add(obstacle);
  for (const pickup of world.pickupsInSpan(racer.x, racer.x + lookAhead)) if (pickup.collectedBy === null) supplies.add(pickup);
  for (let lane = Math.max(0, current - 1); lane <= Math.min(3, current + 1); lane++) {
    let score = lane === current ? 1.1 : -0.25;
    for (const obstacle of seen) {
      const distance = obstacle.x - racer.x;
      if (distance < -obstacle.width || distance > lookAhead || !occupiesLane(obstacle, laneZ(lane), 0)) continue;
      if (obstacle.kind === 'gap') score -= distance < racer.vx * 0.45 ? 13 : 7;
      else if (!racer.visited.has(obstacle) && !(obstacle.hit && (obstacle.kind === 'tnt' || obstacle.kind === 'sheep'))) {
        const proximity = 1 - clamp(distance / lookAhead, 0, 1);
        score += (obstacle.kind === 'boost' ? 6 : obstacle.kind === 'tnt' ? 3 : obstacle.kind === 'spring' ? 2 : obstacle.kind === 'sheep' ? -0.8 : 0.4) * proximity;
      }
    }
    for (const pickup of supplies) {
      const distance = pickup.x - racer.x;
      if (pickup.lane !== lane || distance < 45 || distance > lookAhead) continue;
      const needed = pickup.kind === 'shield' ? racer.shieldUntil <= runTime : pickup.kind === 'fuel' ? racer.boosts < 2 : racer.bounces < 3;
      score += (needed ? 4.8 : 0.8) * (1 - distance / lookAhead) * (world.y(pickup.x) - pickup.y > 160 ? 0.35 : 1);
    }
    for (const other of ctx.others) {
      if (other.id === racer.id || other.finished || other.falling) continue;
      if (Math.abs(other.x - racer.x) < 125 && Math.abs(other.z - laneZ(lane)) < 90) {
        score += racer.weight > other.weight * 1.05 && randomAt(racer.id, runTime) > 0.43 ? 3.8 : -2.8;
      }
    }
    if (score > bestScore) { bestScore = score; bestLane = lane; }
  }
  if (runTime - racer.lastLaneChange > laneCommitInterval(difficulty)) setLane(racer, bestLane, runTime);
  const soon = racer.x + racer.vx * 0.22;
  if (canHop(racer, runTime) && (world.inGap(soon, racer.z) || world.inGap(soon, laneZ(racer.targetLane)))) performHop(racer, ctx.step);
  if (canHop(racer, runTime)) {
    const timing = hopTiming(racer.vx, 290 * weightImpulse(racer.weight) * racer.hopFactor);
    for (const pickup of supplies) {
      const distance = pickup.x - racer.x;
      if (Math.abs(racer.z - pickup.z) < 52 && world.y(pickup.x) - pickup.y < 145 && distance > timing - 65 && distance < timing + 65 && !world.inGap(pickup.x, racer.z)) {
        performHop(racer, ctx.step); break;
      }
    }
  }
  if (!racer.grounded && racer.bounces && world.inGap(racer.x + racer.vx * 0.1, racer.z)
    && racer.y > world.y(racer.x) - 105 && racer.vy > 90) performBounce(racer, ctx.step);
  const behindPaceTarget = ctx.paceTargetX !== null && racer.x < ctx.paceTargetX - 85;
  if (racer.boosts && runTime - racer.lastBoostAt > boostHoldOff(difficulty) && runTime > 1.6
    && (racer.vx < racer.launchSpeed / 0.16 * 0.92 || behindPaceTarget)) performBoost(racer, ctx.step);
}
