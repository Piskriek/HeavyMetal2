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
import { dsin } from './det-math';
import { LANE_COUNT, closestLane, laneZ, occupiesLane, weightImpulse, type Obstacle } from '../scene';
import { adjacentPath, resolveLaneTarget, sampleLane, type LaneNetwork } from '../lane-network';
import type { AirPickup } from '../powerups';
import { hopTiming } from '../powerups';
import type { Racer } from '../racers';
import type { Difficulty } from '../session';
import type { RacerStepContext } from './context';
import { canHop, performBoost, performBounce, performHop } from './racer-physics';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** The engine's deterministic per-racer noise: stable for a given racer and moment. */
export const randomAt = (id: number, time: number) => {
  const value = dsin(id * 91.37 + Math.floor(time * 3) * 17.23) * 13791.73;
  return value - Math.floor(value);
};

export interface CpuContext {
  /** Shared simulation context (world, effects, clocks). */
  readonly step: RacerStepContext;
  readonly difficulty: Difficulty;
  /**
   * H11: how a bot decides to shove a rival. `'rope'` (the default) weighs mass, shields and hazards
   * and gives a wobble tell before the lane slam; `'legacy'` is the old coin flip, kept for the
   * frozen parity recordings.
   */
  readonly tactics?: 'legacy' | 'rope';
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

/** H11: how long a bot wobbles before it slams into a rival's lane. */
export function ramTell(difficulty: Difficulty): number {
  return difficulty === 'rookie' ? 0.5 : 0.3;
}

/** H11: the mass edge a bot wants before it shoves (rookies only pick on much lighter balls). */
export function ramMassEdge(difficulty: Difficulty): number {
  return difficulty === 'rookie' ? 1.25 : difficulty === 'veteran' ? 1 : 1.05;
}

/** H11: a rival counts as in reach from this far behind to this far ahead (engine x units). */
export const RAM_REACH_BEHIND = 80;
export const RAM_REACH_AHEAD = 160;

/**
 * H11: what shoving `other` is worth to `racer`, as a lane score. Positive means go for it, negative
 * means keep out of that lane. A shielded or still-immune rival is never worth it, a rival without
 * the mass edge is avoided, and a veteran (less so a pro) goes for a rival with a gap just ahead of
 * it, where a knock costs the most. Deterministic: no noise at all.
 */
export function ramWorth(racer: Racer, other: Racer, ctx: CpuContext): number {
  const runTime = ctx.step.runTime;
  if (other.shieldUntil > runTime || other.immuneUntil > runTime) return -3.5;
  if (!(racer.weight >= other.weight * ramMassEdge(ctx.difficulty))) return -2.8;
  let worth = 3.2 + Math.min(1.2, (racer.weight / other.weight - 1) * 3);
  const hazardAhead = ctx.step.world.inGap(other.x + Math.max(0, other.vx) * 0.6, other.z);
  if (hazardAhead) worth += ctx.difficulty === 'veteran' ? 1.6 : ctx.difficulty === 'rookie' ? 0 : 0.8;
  return worth;
}

const inReach = (racer: Racer, other: Racer, z: number) =>
  other.x - racer.x > -RAM_REACH_BEHIND && other.x - racer.x < RAM_REACH_AHEAD && Math.abs(other.z - z) < 90;

/** Requests a lane change; a lane only changes when the request is actually different. */
export function setLane(racer: Racer, lane: number, runTime: number): void {
  const next = clamp(Math.round(lane), 0, LANE_COUNT - 1);
  if (next === racer.targetLane) return;
  racer.targetLane = next; racer.lastLaneChange = runTime;
}

/**
 * M01 · T6 (IF-LANES): one place a bot may be thinking of going, as a *place* rather than a lane
 * number — the lane index (so obstacles, pickups and the HUD keep working), the lateral centre to
 * score against, and the authored path that centre belongs to (`null` on the legacy lanes).
 */
export interface LaneCandidate {
  readonly lane: number;
  readonly z: number;
  readonly pathId: string | null;
  readonly current: boolean;
}

/**
 * The candidates a bot may pick from, in a deterministic order.
 *
 * Without a network: the racer's lane and its two neighbours, ordered by ascending lane index —
 * which is descending z, and is the order the legacy driver scored in. With a network: the racer's
 * own path and the adjacent paths on either side at this x, in that same descending-z order, so a
 * network race is the same race with better addresses.
 */
export function laneCandidates(racer: Racer, network: LaneNetwork | null): LaneCandidate[] {
  if (network && racer.pathId) {
    const own = sampleLane(network, racer.pathId, racer.x);
    if (own) {
      const out: LaneCandidate[] = [
        { lane: closestLane(own.z), z: own.z, pathId: racer.pathId, current: true },
      ];
      for (const dir of [-1, 1] as const) {
        const nextId = adjacentPath(network, racer.pathId, racer.x, dir);
        if (!nextId) continue;
        const sample = sampleLane(network, nextId, racer.x);
        if (!sample) continue;
        out.push({ lane: closestLane(sample.z), z: sample.z, pathId: nextId, current: false });
      }
      return out.sort((a, b) => b.z - a.z);
    }
  }
  const current = racer.targetLane;
  const out: LaneCandidate[] = [];
  for (let lane = Math.max(0, current - 1); lane <= Math.min(3, current + 1); lane++) {
    out.push({ lane, z: laneZ(lane), pathId: null, current: lane === current });
  }
  return out;
}

/** Commits a bot to a candidate: the path when there is one, the lane either way. */
export function setCandidate(racer: Racer, candidate: LaneCandidate, runTime: number): void {
  const changed = candidate.pathId !== racer.pathId || candidate.lane !== racer.targetLane;
  racer.pathId = candidate.pathId;
  racer.targetLane = clamp(Math.round(candidate.lane), 0, LANE_COUNT - 1);
  if (changed) racer.lastLaneChange = runTime;
}

/**
 * H11: commit a lane, telegraphing a shove. A lane change *into a rival in reach* is not taken at
 * once: the bot first wobbles for `ramTell` seconds (`ramTellUntil`, drawn by the renderer) and only
 * then slams across, if the rival is still there and still worth it. Every other lane change
 * commits as before.
 */
function steerWithTell(racer: Racer, best: LaneCandidate, ram: Racer | null, ctx: CpuContext): void {
  const runTime = ctx.step.runTime;
  if (racer.ramTargetId !== null) {
    if (runTime < racer.ramTellUntil) return; // still wobbling: hold the lane
    const target = ctx.others.find((other) => other.id === racer.ramTargetId);
    const z = racer.ramPathId && ctx.step.laneNetwork
      ? sampleLane(ctx.step.laneNetwork, racer.ramPathId, racer.x)?.z ?? laneZ(racer.ramLane)
      : laneZ(racer.ramLane);
    const lane = racer.ramLane; const pathId = racer.ramPathId;
    racer.ramTargetId = null; racer.ramPathId = null;
    if (target && !target.finished && !target.falling && inReach(racer, target, z) && ramWorth(racer, target, ctx) > 0) {
      setCandidate(racer, { lane, z, pathId, current: false }, runTime);
    }
    return;
  }
  if (runTime - racer.lastLaneChange <= laneCommitInterval(ctx.difficulty)) return;
  if (ram && !best.current) {
    racer.ramTargetId = ram.id; racer.ramTellUntil = runTime + ramTell(ctx.difficulty);
    racer.ramLane = best.lane; racer.ramPathId = best.pathId;
    // The tell is also heard and seen at the rims: a scrape of sparks as the bot winds up.
    ctx.step.fx.effect('sparks', racer.x, racer.y, racer.z, 0.35, racer.id);
    return;
  }
  setCandidate(racer, best, runTime);
}

export function driveCpu(racer: Racer, ctx: CpuContext): void {
  const world = ctx.step.world;
  const runTime = ctx.step.runTime;
  const difficulty = ctx.difficulty;
  const reaction = reactionDelay(difficulty);
  racer.nextDecision = runTime + reaction + ctx.stagger(racer);
  if (racer.falling || racer.loopRide || racer.finished || runTime < racer.steerLockedUntil) return;
  const lookAhead = clamp(racer.vx * (difficulty === 'rookie' ? 0.54 : difficulty === 'veteran' ? 0.92 : 0.75), 360, 1350);
  const candidates = laneCandidates(racer, ctx.step.laneNetwork ?? null);
  const legacyTactics = ctx.tactics === 'legacy';
  let bestCandidate = candidates[0]; let bestScore = -Infinity; let bestRam: Racer | null = null;
  const seen = new Set<Obstacle>();
  const supplies = new Set<AirPickup>();
  for (const obstacle of world.obstaclesInSpan(racer.x, racer.x + lookAhead)) seen.add(obstacle);
  for (const pickup of world.pickupsInSpan(racer.x, racer.x + lookAhead)) if (pickup.collectedBy === null) supplies.add(pickup);
  for (const candidate of candidates) {
    const lane = candidate.lane;
    let score = candidate.current ? 1.1 : -0.25;
    for (const obstacle of seen) {
      const distance = obstacle.x - racer.x;
      if (distance < -obstacle.width || distance > lookAhead || !occupiesLane(obstacle, candidate.z, 0)) continue;
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
    let ram: Racer | null = null; let ramBest = 0;
    for (const other of ctx.others) {
      if (other.id === racer.id || other.finished || other.falling) continue;
      if (legacyTactics) {
        if (Math.abs(other.x - racer.x) < 125 && Math.abs(other.z - candidate.z) < 90) {
          score += racer.weight > other.weight * 1.05 && randomAt(racer.id, runTime) > 0.43 ? 3.8 : -2.8;
        }
        continue;
      }
      if (!inReach(racer, other, candidate.z)) continue;
      const worth = ramWorth(racer, other, ctx);
      score += worth;
      if (worth > ramBest) { ramBest = worth; ram = other; }
    }
    if (score > bestScore) { bestScore = score; bestCandidate = candidate; bestRam = ram; }
  }
  if (legacyTactics) {
    if (runTime - racer.lastLaneChange > laneCommitInterval(difficulty)) setCandidate(racer, bestCandidate, runTime);
  } else {
    steerWithTell(racer, bestCandidate, bestRam, ctx);
  }
  const soon = racer.x + racer.vx * 0.22;
  const targetZ = resolveLaneTarget(racer, ctx.step.laneNetwork ?? null).targetZ;
  if (canHop(racer, runTime) && (world.inGap(soon, racer.z) || world.inGap(soon, targetZ))) performHop(racer, ctx.step);
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
