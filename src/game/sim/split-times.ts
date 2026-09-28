/**
 * Rivals' first-split (qualifying) times for the solo first split.
 *
 * The player runs the opening stint alone; the rivals do not appear until the player reaches the
 * sorting plane. Their split times are the same run done headlessly — the goblin push, then the real
 * racer physics on a private copy of the course — so the pool can queue the whole field by time and
 * the overlay can show every rider's split. Deterministic: no Math.random, no wall clock.
 */
import type { Racer } from '../racers';
import type { AirPickup } from '../powerups';
import { RADIUS, courseY, type Obstacle } from '../scene';
import type { CourseId } from '../types';
import type { LaneNetwork } from '../lane-network';
import { cloneLayout, createSimWorld } from './world';
import { stepRacer } from './racer-physics';
import { HEADLESS_SIM_FX, LEGACY_RECOVERY, type RacerStepContext } from './context';
import { PUSH_TICKS, applyPushTick, startPushVelocity } from './start-push';
import { FIXED_STEP } from '../contracts/timing';

/** A split slower than this (seconds) is treated as no split: the rider queues at the back. */
export const SPLIT_TIMEOUT_S = 90;

export interface SplitInput {
  readonly course: CourseId;
  readonly obstacles: readonly Obstacle[];
  readonly pickups: readonly AirPickup[];
  readonly network: LaneNetwork | null;
  readonly gateX: number;
  readonly pushSeed: number;
}

/** Small deterministic RNG per rider, so a recovery's coin flips replay identically. */
function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
}

/**
 * The tick (with its in-tick fraction) at which `template` would cross `gateX`, counting from the
 * first push tick exactly as the engine's own `tick` does. `null` when they never get there.
 */
export function simulateSplitTick(template: Racer, input: SplitInput): number | null {
  const layout = cloneLayout(input.obstacles, input.pickups);
  const world = createSimWorld(input.course, layout.obstacles, layout.pickups);
  const racer: Racer = {
    ...template,
    previous: { ...template.previous },
    visited: new Set(),
    loopRide: null,
  } as Racer;
  let runTime = 0;
  const ctx: RacerStepContext = {
    world, fx: HEADLESS_SIM_FX, recovery: LEGACY_RECOVERY, random: seeded(input.pushSeed ^ (racer.id * 2654435761)),
    get runTime() { return runTime; },
    get wallTime() { return runTime; },
    laneNetwork: input.network,
  };
  const target = startPushVelocity(racer.pace, input.pushSeed, racer.id);
  let tick = 0;
  for (let k = 1; k <= PUSH_TICKS; k++) {
    tick += 1; runTime += FIXED_STEP;
    applyPushTick(racer, k, target);
    racer.x += racer.vx * FIXED_STEP;
    racer.y = courseY(racer.x, input.course) - RADIUS;
  }
  const limit = Math.round(SPLIT_TIMEOUT_S / FIXED_STEP);
  while (tick < limit) {
    tick += 1; runTime += FIXED_STEP;
    const fromX = racer.x;
    stepRacer(racer, ctx, FIXED_STEP);
    if (fromX < input.gateX && racer.x >= input.gateX) {
      const fraction = racer.x === fromX ? 0 : (input.gateX - fromX) / (racer.x - fromX);
      return tick + Math.max(0, Math.min(1, fraction));
    }
    if (racer.finished) return null;
  }
  return null;
}

/** Split ticks for every rider in `rivals`, keyed by racer id. */
export function simulateSplitTicks(rivals: readonly Racer[], input: SplitInput): Map<number, number | null> {
  const out = new Map<number, number | null>();
  for (const rival of rivals) out.set(rival.id, simulateSplitTick(rival, input));
  return out;
}
