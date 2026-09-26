/**
 * T04 — the seam between the simulation and everything that is not simulation.
 *
 * The racer step, the CPU driver and the pickup resolution are shared by the live race and by
 * an isolated qualifying attempt. What differs between them is only *where the side effects go*
 * and *how a fall is punished*:
 *
 * - `SimFx` is the whole cosmetic/feedback surface (particles, audio, notices, score, shake,
 *   HUD counters). The engine binds it to the renderer, the audio graph and the snapshot; a
 *   headless attempt binds it to `HEADLESS_SIM_FX` or to a recorder. No simulation code touches
 *   the DOM any more, which is what makes an attempt runnable in a Node test process.
 * - `RecoveryPolicy` decides when the pit crew intervenes and where the racer is put back. The
 *   race keeps the legacy timed recovery bit for bit; a qualifying attempt recovers against
 *   **progress**, and it evaluates the fall conditions *before* the falling branch's early
 *   return instead of only ever reaching the 0.72 s timer.
 *
 * Everything here is pure: no DOM, no canvas, no three.js, no React.
 */
import type { RopeConfig } from './rope';
import { START_X } from '../scene';
import type { Racer } from '../racers';
import type { PowerupKind } from '../powerups';
import type { SoundName } from '../audio';
import type { SimWorld } from './world';
import type { EffectKind } from '../effects/events';
import type { LaneNetwork } from '../lane-network';
import type { RouteGraph, RouteLayout } from './route';

export type TallyKind = 'sheep' | 'explosions' | 'loops';

/** Everything the simulation may do to the outside world, and nothing it may read back. */
export interface SimFx {
  /** Cosmetic particle burst. Implementations cull and cap as they see fit. */
  emit(x: number, y: number, z: number, count: number, color: string, speed: number): void;
  /**
   * M01 · T5 — a typed effect (explosion, impact, dust, smoke, sparks) at an engine-space point.
   * The particles above are the legacy spray; this is the one the effect runtime renders from a
   * painted sheet. Headless runs drop it, exactly like every other cosmetic channel.
   */
  effect(kind: EffectKind, x: number, y: number, z: number, scale: number, racerId: number | null): void;
  /** A sheep went flying. */
  airSheep(spawn: { x: number; y: number; z: number; vx: number; vy: number }): void;
  /** On-screen one-liner. */
  say(text: string): void;
  audio(cue: SoundName): void;
  /** Chaos points. Implementations clamp; the simulation only ever reports the delta. */
  score(delta: number): void;
  shake(amount: number): void;
  tally(kind: TallyKind): void;
  /** Recompute the player's HUD numbers and publish them (engine: refreshSnapshot + notify). */
  refreshHud(): void;
  /** Publish the HUD without recomputing it (engine: notify). */
  notifyHud(): void;
  setHopReady(ready: boolean): void;
  /** The player's motion trail was dropped (a recovery). */
  clearTrail(): void;
  /** The player collected a supply: counters and the notice window belong to the HUD. */
  pickupCollected(kind: PowerupKind): void;
}

/** Qualifying attempts and every other headless run: side effects go nowhere. */
export const HEADLESS_SIM_FX: SimFx = Object.freeze({
  emit: () => {}, effect: () => {}, airSheep: () => {}, say: () => {}, audio: () => {}, score: () => {},
  shake: () => {}, tally: () => {}, refreshHud: () => {}, notifyHud: () => {}, setHopReady: () => {},
  clearTrail: () => {}, pickupCollected: () => {},
});

export type RecordedFx =
  | { readonly type: 'emit'; readonly x: number; readonly y: number; readonly z: number; readonly count: number; readonly color: string }
  | { readonly type: 'effect'; readonly kind: EffectKind; readonly x: number; readonly y: number; readonly z: number; readonly scale: number; readonly racerId: number | null }
  | { readonly type: 'airSheep'; readonly x: number; readonly y: number; readonly z: number }
  | { readonly type: 'say'; readonly text: string }
  | { readonly type: 'audio'; readonly cue: SoundName }
  | { readonly type: 'score'; readonly delta: number }
  | { readonly type: 'shake'; readonly amount: number }
  | { readonly type: 'tally'; readonly kind: TallyKind }
  | { readonly type: 'refreshHud' }
  | { readonly type: 'notifyHud' }
  | { readonly type: 'hopReady'; readonly ready: boolean }
  | { readonly type: 'clearTrail' }
  | { readonly type: 'pickup'; readonly kind: PowerupKind };

/** A `SimFx` that keeps a log, for tests and for the qualifying harness diagnostics. */
export function createRecordingFx(log: RecordedFx[] = []): SimFx & { readonly log: RecordedFx[] } {
  return {
    log,
    emit: (x, y, z, count, color) => { log.push({ type: 'emit', x, y, z, count, color }); },
    effect: (kind, x, y, z, scale, racerId) => { log.push({ type: 'effect', kind, x, y, z, scale, racerId }); },
    airSheep: (spawn) => { log.push({ type: 'airSheep', x: spawn.x, y: spawn.y, z: spawn.z }); },
    say: (text) => { log.push({ type: 'say', text }); },
    audio: (cue) => { log.push({ type: 'audio', cue }); },
    score: (delta) => { log.push({ type: 'score', delta }); },
    shake: (amount) => { log.push({ type: 'shake', amount }); },
    tally: (kind) => { log.push({ type: 'tally', kind }); },
    refreshHud: () => { log.push({ type: 'refreshHud' }); },
    notifyHud: () => { log.push({ type: 'notifyHud' }); },
    setHopReady: (ready) => { log.push({ type: 'hopReady', ready }); },
    clearTrail: () => { log.push({ type: 'clearTrail' }); },
    pickupCollected: (kind) => { log.push({ type: 'pickup', kind }); },
  };
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

export type RecoveryReason = 'fall-timer' | 'depth' | 'lava' | 'stopped' | 'oob';

export interface RecoveryRequest {
  readonly racer: Racer;
  /** Down-range position when recovery fired. */
  readonly x: number;
  /** Furthest legitimate progress (never includes ground gained while falling). */
  readonly bestX: number;
  readonly reason: RecoveryReason;
  /** How many recoveries this racer has already spent in the current attempt/race. */
  readonly recoveries: number;
}

export interface RecoveryPolicy {
  readonly id: 'legacy' | 'progress';
  /** Seconds a fall may last before the crew intervenes. */
  readonly maxFallSeconds: number;
  /**
   * Depth below the surface that ends a fall, or `null` when the fall only ends on the timer.
   * The legacy race measured depth solely for racers that were *not* falling, because the
   * falling branch returned early; `progress` measures it before that return.
   */
  readonly fallDepth: number | null;
  /**
   * Depth inside the Section 3 lava lake that ends a fall, or `null` to leave the lava lake to
   * the grounded branch alone (the legacy behaviour).
   */
  readonly lavaDepth: number | null;
  /** Speed the racer is relaunched with after a recovery. */
  readonly respawnSpeed: number;
  /** Where the racer is put back. */
  respawnX(request: RecoveryRequest): number;
}

/** How far behind the best progress a progress-based recovery places the racer. */
export const PROGRESS_RECOVERY_MARGIN = 40;
/** Never recover behind the launch ridge, matching the legacy floor. */
export const RECOVERY_FLOOR_X = START_X + 440;
/** Legacy fall duration and respawn speed, unchanged. */
export const LEGACY_FALL_SECONDS = 0.72;
export const RECOVERY_RESPAWN_SPEED = 390;
/** Ground-relative depth that ends a run of bad luck (engine: `y > courseY + 360`). */
export const OFF_WORLD_DEPTH = 360;
/** Depth inside the Section 3 lava lake that vaporizes a racer (engine: `y > courseY + 260`). */
export const LAVA_LAKE_DEPTH = 260;

/**
 * The race's recovery, exactly as it has always been: 0.72 s of falling, then 200 units back
 * from wherever the fall carried the racer.
 */
export const LEGACY_RECOVERY: RecoveryPolicy = Object.freeze({
  id: 'legacy',
  maxFallSeconds: LEGACY_FALL_SECONDS,
  fallDepth: null,
  lavaDepth: null,
  respawnSpeed: RECOVERY_RESPAWN_SPEED,
  respawnX: (request: RecoveryRequest) => Math.max(RECOVERY_FLOOR_X, request.x - 200),
});

/**
 * Qualifying recovery: anchored to **progress** instead of to wherever a fall drifted the ball.
 * A fall can no longer be used to skip a hazard, and the depth/lava conditions are evaluated
 * while the racer is still falling rather than after the early return.
 */
export const PROGRESS_RECOVERY: RecoveryPolicy = Object.freeze({
  id: 'progress',
  maxFallSeconds: LEGACY_FALL_SECONDS,
  fallDepth: OFF_WORLD_DEPTH,
  lavaDepth: LAVA_LAKE_DEPTH,
  respawnSpeed: RECOVERY_RESPAWN_SPEED,
  respawnX: (request: RecoveryRequest) => Math.max(RECOVERY_FLOOR_X, request.bestX - PROGRESS_RECOVERY_MARGIN),
});

// ---------------------------------------------------------------------------
// Step context
// ---------------------------------------------------------------------------

export interface RacerStepContext {
  readonly world: SimWorld;
  readonly fx: SimFx;
  readonly recovery: RecoveryPolicy;
  /**
   * Gameplay randomness, in [0, 1). The live race hashes (seed, tick, racer id) (M9), so the same
   * seed and the same inputs replay the same race; an isolated attempt draws from its seeded
   * stream and may ignore the racer id.
   */
  readonly random: (racerId?: number) => number;
  /** Simulation clock in seconds (engine: `runTime`); advanced by the caller before the step. */
  readonly runTime: number;
  /** Wall clock stamped onto obstacles (engine: `time`). */
  readonly wallTime: number;
  /**
   * M01 · T6 (IF-LANES): the authored lane network this race runs on, or `null`/absent for the
   * legacy four lanes. Absent and `null` are the same thing — the integration point returns the
   * legacy target and corridor for both, so an old context is not a special case.
   */
  readonly laneNetwork?: LaneNetwork | null;
  /** H7b: the rope timings (the test drive's dev sliders). Absent means the tuned defaults. */
  readonly rope?: RopeConfig;
  /**
   * ROUTE-1: the course's forks and this race's open branches, or absent/`null` for an unforked
   * course (the old game, exactly).
   */
  readonly route?: { readonly graph: RouteGraph; readonly layout?: RouteLayout | null } | null;
}

/**
 * ROUTE-1: the context as this racer meets the world: only the obstacles and pickups on its branches.
 * On a course with no tagged content it is the same context object, so nothing changes.
 */
export function routed(ctx: RacerStepContext, racer: Racer): RacerStepContext {
  if (!ctx.world.routed) return ctx;
  const world = ctx.world.forRoute(racer.route);
  return world === ctx.world ? ctx : { ...ctx, world };
}
