/**
 * T04 — the single-racer physics step, lifted out of `GameEngine` unchanged.
 *
 * This is a faithful port of the engine's `stepRacer` / `recover` / `hitObstacle` /
 * `performHop` / `performBounce` / `performBoost` / `canHop`: same expressions, same order of
 * mutations, same constants. Two things are different, both deliberately:
 *
 * 1. **Side effects go through `SimFx`** instead of through the renderer, the audio graph and
 *    the snapshot, and gameplay randomness goes through `ctx.random()` instead of calling
 *    `Math.random()` inline (the pinball spinner). The race binds randomness to a hash of
 *    (seed, tick, racer id) (M9) so a race replays; a qualifying attempt binds the effects to a
 *    recorder and randomness to its seeded stream. `tests/physics-parity.test.ts` proves the port against a verbatim copy of
 *    the pre-refactor engine code.
 * 2. **Recovery is decided before the falling branch's early return.** The old code returned
 *    from `if (racer.falling)` immediately, so a falling racer could only ever be saved by the
 *    0.72 s timer and never by the depth or lava-lake checks below it. The decision now runs
 *    inside the falling branch, driven by a `RecoveryPolicy`. `LEGACY_RECOVERY` keeps the timer
 *    as the only trigger, so the race behaves bit for bit as before; `PROGRESS_RECOVERY` (used by
 *    qualifying) also ends a fall on depth and on the lava lake, and respawns against the best
 *    legitimate progress instead of wherever the fall drifted the ball.
 *
 * The step also reports a `RacerStepTrace`. The canonical capture point for a gate crossing is
 * `preObstacle*`: the state after motion integration and **before** obstacle resolution, i.e.
 * before a loop ride floors the speed at 650 and before its exit hands back `speed * 1.08`.
 */
import {
  FINISH, GRAVITY, LANE, PLAYER_LANE, RADIUS, START_X, TRACK_DISTANCE,
  closestLane, laneZ, loopGeometry, obstacleZ, occupiesLane, weightImpulse,
  type Obstacle,
} from '../scene';
import type { Racer } from '../racers';
import { advanceRoll } from '../gyro-ball';
import { HELD_DAMPING, HELD_RESPONSE } from '../merge/pool';
import { LANE_Z_LIMIT, advancePaths, oobCrossed, resolveLaneTarget, sampleLane } from '../lane-network';
import { DEFAULT_ROPE, ropeAt } from './rope';
import { recordObstacleHit } from './obstacle-state';
import { LAVA_LAKE_DEPTH, OFF_WORLD_DEPTH, type RacerStepContext, type RecoveryReason } from './context';

const TAU = Math.PI * 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Section 2's steeper gravity band and the lava lake, in engine x. */
export const STAGE_GRAVITY_START = 24000;
export const STAGE_GRAVITY_END = 48000;
export const LAVA_ZONE_START = 48000;
export const LAVA_ZONE_END = 68400;
/** Seconds a racer may sit nearly still before the crew intervenes. */
export const STALLED_SECONDS = 3;

export interface RacerStepTrace {
  /** Post-integration, pre-obstacle state: the canonical gate-capture point. */
  preObstacleX: number;
  preObstacleY: number;
  preObstacleZ: number;
  preObstacleVx: number;
  preObstacleVy: number;
  /** True when the step started with the racer already airborne in a fall. */
  wasFalling: boolean;
  fell: boolean;
  recovered: boolean;
  recoveryReason: RecoveryReason | null;
  loopEngaged: boolean;
  loopExited: boolean;
  /** M01 · T2: the step was a pool hold, so only the lateral glide ran. */
  held: boolean;
  /** M01 · T6: the id of the out-of-bounds node this step crossed, or null. */
  oobNode: string | null;
  landed: boolean;
  rampLaunch: boolean;
  finished: boolean;
  lavaPlunge: boolean;
  /** Obstacles touched this step, in resolution order. Reused; cleared by `resetTrace`. */
  hits: Obstacle[];
}

export function createStepTrace(): RacerStepTrace {
  return {
    preObstacleX: 0, preObstacleY: 0, preObstacleZ: 0, preObstacleVx: 0, preObstacleVy: 0,
    wasFalling: false, fell: false, recovered: false, recoveryReason: null, loopEngaged: false,
    loopExited: false, held: false, oobNode: null, landed: false, rampLaunch: false, finished: false,
    lavaPlunge: false, hits: [],
  };
}

export function resetTrace(trace: RacerStepTrace): void {
  trace.preObstacleX = trace.preObstacleY = trace.preObstacleZ = 0;
  trace.preObstacleVx = trace.preObstacleVy = 0;
  trace.wasFalling = trace.fell = trace.recovered = trace.loopEngaged = trace.loopExited = false;
  trace.held = false; trace.oobNode = null;
  trace.landed = trace.rampLaunch = trace.finished = trace.lavaPlunge = false;
  trace.recoveryReason = null;
  trace.hits.length = 0;
}

/** Furthest legitimate down-range position reached, excluding ground gained while falling. */
export function bestProgressX(racer: Racer): number {
  return START_X + racer.distance * 2;
}

export function canHop(racer: Racer, runTime: number): boolean {
  return !racer.falling && !racer.loopRide && !racer.finished && runTime - racer.lastHopAt >= 0.25
    && (racer.grounded || runTime - racer.lastGroundedAt < 0.085);
}

export function performHop(racer: Racer, ctx: RacerStepContext): void {
  racer.vy = racer.vx * ctx.world.surfaceAt(racer.x, racer.z).slope - 290 * weightImpulse(racer.weight) * racer.hopFactor;
  racer.grounded = false; racer.lastHopAt = ctx.runTime;
  racer.lastGroundedAt = racer.bufferedJump = -100;
  ctx.fx.emit(racer.x, racer.y + RADIUS, racer.z, 5, '#dbc294', 85);
  ctx.fx.effect('dust', racer.x, racer.y + RADIUS, racer.z, 0.6, racer.id);
  if (!racer.id) { ctx.fx.setHopReady(false); ctx.fx.audio('hop'); ctx.fx.notifyHud(); }
}

export function performBounce(racer: Racer, ctx: RacerStepContext): void {
  if (!racer.bounces || racer.falling || racer.loopRide || racer.finished) return;
  racer.bounces--; racer.vy = -760 * weightImpulse(racer.weight) * racer.hopFactor;
  racer.vx = Math.max(320, racer.vx + 65 * weightImpulse(racer.weight));
  racer.grounded = false; racer.lastGroundedAt = -100;
  ctx.fx.emit(racer.x, racer.y + RADIUS, racer.z, 10, '#a7dec1', 160);
  ctx.fx.effect('dust', racer.x, racer.y + RADIUS, racer.z, 1, racer.id);
  if (!racer.id) { ctx.fx.audio('bounce'); ctx.fx.say('GRAVITY IS A SUGGESTION.'); ctx.fx.refreshHud(); }
}

export function performBoost(racer: Racer, ctx: RacerStepContext): void {
  if (!racer.boosts || racer.falling || racer.finished) return;
  const impulse = 430 * weightImpulse(racer.weight) * racer.boostFactor;
  racer.boosts--; racer.lastBoostAt = ctx.runTime;
  if (racer.loopRide) racer.loopRide.speed = Math.min(racer.maximumSpeed, racer.loopRide.speed + impulse);
  racer.vx = Math.min(racer.maximumSpeed, racer.vx + impulse);
  if (racer.grounded) racer.vy = ctx.world.surfaceAt(racer.x, racer.z).slope * racer.vx;
  ctx.fx.emit(racer.x - RADIUS, racer.y, racer.z, 12, racer.color, 210);
  ctx.fx.effect('smoke', racer.x - RADIUS, racer.y, racer.z, 0.7, racer.id);
  if (!racer.id) { ctx.fx.audio('boost'); ctx.fx.say('MORE SPEED. LESS THINKING.'); ctx.fx.shake(2); ctx.fx.refreshHud(); }
}

/**
 * Puts the racer back on the track. Placement and the conditions that got us here belong to the
 * `RecoveryPolicy`; everything after that is the legacy crew routine.
 */
export function recoverRacer(racer: Racer, ctx: RacerStepContext, reason: RecoveryReason, trace?: RacerStepTrace): void {
  const x = racer.x;
  const recoveries = racer.recoveries;
  racer.x = ctx.recovery.respawnX({ racer, x, bestX: bestProgressX(racer), reason, recoveries });
  racer.recoveries = recoveries + 1;
  // M01 · T6: on a network the crew puts the racer back on the nearest *path*, not on the nearest
  // legacy lane. The gap rule is the one it has always been: the first candidate whose centre is
  // clear here and just ahead. With no network this walks the legacy lanes exactly as before.
  const network = ctx.laneNetwork ?? null;
  const candidates: { z: number; pathId: string | null }[] = [];
  const currentPath = network && racer.pathId ? sampleLane(network, racer.pathId, racer.x) : null;
  if (network && racer.pathId && currentPath) {
    candidates.push({ z: currentPath.z, pathId: racer.pathId });
    for (const path of network.paths) {
      if (path.id === racer.pathId) continue;
      const sample = sampleLane(network, path.id, racer.x);
      if (sample) candidates.push({ z: sample.z, pathId: path.id });
    }
    candidates.sort((a, b) => Math.abs(a.z - racer.z) - Math.abs(b.z - racer.z));
  } else {
    const lane = racer.targetLane;
    for (let i = 0; i < 4; i++) {
      candidates.push({ z: laneZ((lane + i) % 4), pathId: null });
    }
  }
  let chosen = candidates[0];
  for (const candidate of candidates) {
    if (!ctx.world.inGap(racer.x, candidate.z) && !ctx.world.inGap(racer.x + 110, candidate.z)) { chosen = candidate; break; }
  }
  racer.pathId = chosen.pathId;
  racer.targetLane = racer.lane = closestLane(chosen.z); racer.z = chosen.z; racer.vz = 0;
  racer.y = ctx.world.surfaceAt(racer.x, racer.z).y - RADIUS;
  racer.vx = ctx.recovery.respawnSpeed; racer.vy = ctx.world.slope(racer.x) * racer.vx;
  racer.falling = false; racer.grounded = true; racer.loopRide = null;
  racer.rollPhase = 0; racer.rollRate = 0;
  racer.fallingFor = racer.stoppedFor = 0; racer.immuneUntil = ctx.runTime + 1.5;
  racer.recoveryUntil = ctx.runTime + 1; racer.steerLockedUntil = ctx.runTime + 0.15;
  racer.boosts = Math.max(1, racer.boosts);
  racer.shieldUntil = -100;
  Object.assign(racer.previous, { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation });
  ctx.fx.effect('dust', racer.x, racer.y, racer.z, 1.4, racer.id);
  if (!racer.id) { ctx.fx.score(-100); ctx.fx.clearTrail(); ctx.fx.say('PIT CREW TO THE RESCUE. KEEP RACING.'); }
  if (trace) { trace.recovered = true; trace.recoveryReason = reason; }
}

/** Lava-lake vaporization feedback, shared by the falling and the grounded branches. */
function lavaPlunge(racer: Racer, ctx: RacerStepContext, trace?: RacerStepTrace): void {
  ctx.fx.emit(racer.x, racer.y, racer.z, 30, '#111111', 260);
  ctx.fx.emit(racer.x, racer.y, racer.z, 20, '#ff4400', 220);
  ctx.fx.effect('explosion', racer.x, racer.y, racer.z, 1.6, racer.id);
  ctx.fx.effect('smoke', racer.x, racer.y, racer.z, 1.2, racer.id);
  if (!racer.id) { ctx.fx.say('LAVA VAPORIZATION! RESCUED ONTO RAILS.'); ctx.fx.shake(5); }
  if (trace) trace.lavaPlunge = true;
}

export function hitObstacle(racer: Racer, obstacle: Obstacle, ctx: RacerStepContext, trace?: RacerStepTrace): void {
  racer.visited.add(obstacle);
  obstacle.hitAt = ctx.wallTime;
  recordObstacleHit(obstacle, racer.id);
  if (trace) trace.hits.push(obstacle);
  const impulse = weightImpulse(racer.weight);
  const x = obstacle.x + obstacle.width / 2; const y = ctx.world.y(x); const z = obstacleZ(obstacle);
  if (obstacle.kind !== 'boost') racer.lastGroundedAt = -100;
  switch (obstacle.kind) {
    case 'boost':
      racer.vx += 400 * impulse * racer.boostFactor;
      if (racer.grounded) racer.vy = ctx.world.surfaceAt(racer.x, racer.z).slope * racer.vx;
      racer.boosts = Math.min(2, racer.boosts + 1); ctx.fx.emit(x, y - 6, z, 8, '#ffbd6a', 135);
      ctx.fx.effect('sparks', x, y - 6, z, 0.8, racer.id);
      if (!racer.id) { ctx.fx.score(100); ctx.fx.audio('boost'); ctx.fx.say('THROTTLE REFILLED. TRY NOT TO SHARE.'); }
      break;
    case 'spring':
      racer.vy = -660 * impulse * racer.hopFactor; racer.vx += 90 * impulse; racer.grounded = false;
      racer.bounces = Math.min(3, racer.bounces + 1); ctx.fx.emit(x, y - 24, z, 10, '#a1e1bd', 160);
      ctx.fx.effect('dust', x, y - 24, z, 0.8, racer.id);
      if (!racer.id) { ctx.fx.score(100); ctx.fx.audio('bounce'); ctx.fx.say('SPRING BREAK! +1 BOUNCE'); }
      break;
    case 'tnt':
      obstacle.hit = true; racer.vx += 300 * impulse; racer.vy = -450 * impulse; racer.grounded = false;
      ctx.fx.emit(x, y - 30, z, 25, '#ffb25e', 245);
      ctx.fx.effect('explosion', x, y - 30, z, 1.2, racer.id);
      ctx.fx.effect('smoke', x, y - 30, z, 1, racer.id);
      if (!racer.id) { ctx.fx.score(200); ctx.fx.tally('explosions'); ctx.fx.shake(9); ctx.fx.audio('boom'); ctx.fx.say('THAT WAS PROBABLY LOAD-BEARING.'); }
      break;
    case 'sheep':
      obstacle.hit = true; racer.vx += 75 * impulse; racer.vy = -290 * impulse; racer.grounded = false;
      ctx.fx.airSheep({ x, y: y - 40, z, vx: racer.vx * 0.51, vy: -520 });
      ctx.fx.emit(x, y - 35, z, 8, '#e9e1c6', 115);
      ctx.fx.effect('dust', x, y - 35, z, 1.1, racer.id);
      if (!racer.id) { ctx.fx.score(125); ctx.fx.tally('sheep'); ctx.fx.audio('sheep'); ctx.fx.say('BAA-D DECISIONS.'); }
      break;
    case 'blimp': {
      obstacle.hit = true;
      racer.vy = Math.max(950, 1200 * impulse);
      racer.vx = Math.max(120, racer.vx * 0.72);
      racer.grounded = false;
      ctx.fx.effect('explosion', x, y - (obstacle.altitude ?? 540), z, 2, racer.id);
      ctx.fx.effect('smoke', x, y - (obstacle.altitude ?? 540), z, 1.5, racer.id);
      ctx.fx.emit(x, y - (obstacle.altitude ?? 540), z, 35, '#ff4400', 320);
      ctx.fx.emit(x, y - (obstacle.altitude ?? 540), z, 20, '#ffbb00', 250);
      ctx.fx.emit(x, y - (obstacle.altitude ?? 540), z, 20, '#333333', 180);
      for (const other of ctx.world.obstaclesNear(x)) {
        if (other.kind === 'sign' && !other.hit && Math.abs((other.x + other.width / 2) - x) < 90) {
          other.hit = true;
          other.hitAt = ctx.wallTime;
        }
      }
      if (!racer.id) {
        ctx.fx.score(250);
        ctx.fx.tally('explosions');
        ctx.fx.shake(6.0);
        ctx.fx.audio('boom');
        ctx.fx.say('AIRSPACE RESTRICTED! DOWN YOU GO!');
      }
      break;
    }
    case 'sign': {
      obstacle.hit = true;
      racer.vx = Math.max(90, racer.vx * 0.52);
      racer.vy = Math.max(90, racer.vy + 140);
      const signY = y - (obstacle.altitude ?? 315);
      ctx.fx.effect('impact', x, signY, z, 1.3, racer.id);
      ctx.fx.emit(x, signY, z, 24, '#8b5a2b', 210);
      ctx.fx.emit(x, signY, z, 16, '#c29a64', 170);
      ctx.fx.emit(x, signY, z, 12, '#ffffff', 130);
      if (!racer.id) {
        ctx.fx.score(150);
        ctx.fx.shake(3.2);
        ctx.fx.audio('land');
        ctx.fx.say('WATCH THE ROAD SIGNS! SPEED REDUCED.');
      }
      break;
    }
    case 'water_rock': {
      const dz = racer.z - obstacleZ(obstacle);
      racer.vz = (dz >= 0 ? 1 : -1) * 380 * (obstacle.deflectPower ?? 1.35);
      racer.vx = Math.max(160, racer.vx * 0.82);
      racer.vy = -180;
      racer.grounded = false;
      ctx.fx.emit(x, y, z, 14, '#6ebad8', 180);
      ctx.fx.emit(x, y, z, 8, '#b8a77b', 120);
      ctx.fx.effect('impact', x, y, z, 0.9, racer.id);
      ctx.fx.effect('dust', x, y, z, 0.7, racer.id);
      if (!racer.id) {
        ctx.fx.score(80);
        ctx.fx.shake(3.5);
        ctx.fx.audio('bump');
        ctx.fx.say('ROCK DEFLECTION! HOLD YOUR LINE!');
      }
      break;
    }
    case 'break_bridge':
      if (racer.vx > 450) {
        obstacle.broken = true;
        ctx.fx.emit(x, y, z, 20, '#8b5a2b', 180);
        ctx.fx.effect('impact', x, y, z, 1.1, racer.id);
        ctx.fx.effect('dust', x, y, z, 1.3, racer.id);
        if (!racer.id) {
          ctx.fx.score(90);
          ctx.fx.shake(2.5);
          ctx.fx.audio('land');
          ctx.fx.say('BRIDGE BROKEN! CHASM AHEAD!');
        }
      }
      break;
    case 'pinball_spinner':
      // The only gameplay coin-flip in the step. The race hashes (seed, tick, racer id) and an
      // isolated attempt draws from its seeded stream, so either replays exactly (M9).
      racer.vz = (ctx.random(racer.id) > 0.5 ? 1 : -1) * 440;
      racer.vx += 120;
      ctx.fx.effect('impact', x, y, z, 0.8, racer.id);
      ctx.fx.effect('sparks', x, y, z, 1, racer.id);
      if (!racer.id) {
        ctx.fx.score(110);
        ctx.fx.shake(3.0);
        ctx.fx.audio('bounce');
        ctx.fx.say('PINBALL KICK!');
      }
      break;
    case 'cauldron':
      racer.vx += 250 * impulse;
      racer.vy = -140;
      racer.grounded = false;
      ctx.fx.emit(x, y, z, 22, '#ff6600', 220);
      ctx.fx.effect('explosion', x, y, z, 1, racer.id);
      if (!racer.id) { ctx.fx.score(130); ctx.fx.shake(4.0); ctx.fx.audio('boom'); ctx.fx.say('MOLTEN SLAG BOOST! FEEL THE HEAT!'); }
      break;
    case 'roller_rails':
      racer.vx += 90;
      ctx.fx.emit(x, y, z, 6, '#ffd700', 90);
      ctx.fx.effect('sparks', x, y, z, 0.6, racer.id);
      break;
    case 'waterfall_splash':
      ctx.fx.emit(x, y, z, 16, '#c6f1ff', 140);
      ctx.fx.effect('smoke', x, y, z, 1.1, racer.id);
      if (!racer.id && ctx.wallTime - obstacle.hitAt < 0.2) {
        ctx.fx.say('THROUGH THE SPRAY!');
      }
      break;
    default: break;
  }
}

/**
 * Advances one racer by `dt` seconds. Mutates `racer` in place, exactly as the engine did, and
 * fills `trace` when the caller wants the canonical observations (gate capture, falls, hits).
 */
/** H6: how long the rope goblins take to haul a ball back from out of bounds. */
export const OOB_REEL_S = 1;
/** H6: the least forward speed a ball leaves the reel with. */
export const OOB_RELEASE_VX = 180;

/**
 * H6: an out-of-bounds recovery is not an instant teleport. The crew has already put the ball back
 * on its lane (`recoverRacer`); it is held there for `OOB_REEL_S` while the rope goblins haul it in
 * (the renderer draws it easing back from where it went out), then it rolls on.
 */
export function startRopeReel(racer: Racer, from: { x: number; y: number; z: number }, ctx: RacerStepContext): void {
  const until = ctx.runTime + OOB_REEL_S;
  racer.reel = { fromX: from.x, fromY: from.y, fromZ: from.z, startedAt: ctx.runTime, until, releaseVx: Math.max(OOB_RELEASE_VX, racer.vx) };
  racer.vx = racer.vy = racer.vz = 0;
  racer.steerLockedUntil = Math.max(racer.steerLockedUntil, until);
  racer.immuneUntil = Math.max(racer.immuneUntil, until + 0.5);
  if (!racer.id) { ctx.fx.audio('rope_reel'); ctx.fx.say('ROPE GOBLINS! HAULING YOU BACK ON COURSE.'); }
}

/** P6: a scraping ball throws a spark burst this often (seconds), sized by its speed. */
export const SCRAPE_SPARK_EVERY = 0.07;
/** P6: below this forward speed a ball leaning on the edge is resting, not scraping. */
export const SCRAPE_MIN_VX = 150;

/**
 * P6: a trail of sparks while a ball grinds along the road-edge wall: it is pinned at the road's
 * edge (`±LANE_Z_LIMIT`, not a lane corridor), still pushing into it, and rolling. Presentation
 * only: it emits effects and remembers when, and never touches the physics.
 */
export function scrapeSparks(racer: Racer, pushVz: number, ctx: RacerStepContext): void {
  const atEdge = Math.abs(racer.z) >= LANE_Z_LIMIT - 0.5;
  const intoEdge = Math.sign(pushVz) === Math.sign(racer.z) && Math.abs(pushVz) > 1;
  if (!atEdge || !intoEdge || racer.vx < SCRAPE_MIN_VX || !racer.grounded || racer.falling) return;
  if (racer.scrapeFxAt !== undefined && ctx.runTime - racer.scrapeFxAt < SCRAPE_SPARK_EVERY && ctx.runTime >= racer.scrapeFxAt) return;
  racer.scrapeFxAt = ctx.runTime;
  const scale = 0.3 + 0.5 * Math.min(1, racer.vx / 1200);
  ctx.fx.effect('sparks', racer.x, racer.y, racer.z + Math.sign(racer.z) * 26, scale, racer.id);
}

export function stepRacer(racer: Racer, ctx: RacerStepContext, dt: number, trace?: RacerStepTrace): void {
  const world = ctx.world;
  const oldX = racer.x;
  if (trace) {
    trace.wasFalling = racer.falling;
    trace.preObstacleX = racer.x; trace.preObstacleY = racer.y; trace.preObstacleZ = racer.z;
    trace.preObstacleVx = racer.vx; trace.preObstacleVy = racer.vy;
  }
  // H6: held on the lane while the rope goblins haul it in, then away at a rolling speed.
  if (racer.reel) {
    if (ctx.runTime < racer.reel.until) {
      racer.vx = racer.vy = racer.vz = 0;
      racer.y = world.surfaceAt(racer.x, racer.z).y - RADIUS;
      racer.grounded = true; racer.falling = false; racer.stoppedFor = 0;
      racer.lastGroundedAt = ctx.runTime;
      return;
    }
    racer.vx = racer.reel.releaseVx; racer.vy = world.slope(racer.x) * racer.vx;
    racer.reel = null;
  }
  // M01 · T2 (IF-MERGE): a held rider is out of the race for a moment. Nothing integrates — they
  // are pinned to the gate plane — except the lateral glide into their pool slot (or, when they are
  // next to go, into the loop's own lane, so the lane-filtered loop will actually engage them).
  if (racer.mergeHeld) {
    const steering = (racer.mergeSlotZ - racer.z) * HELD_RESPONSE - racer.vz * HELD_DAMPING;
    racer.vz = clamp(racer.vz + steering * dt, -650, 650);
    const previousZ = racer.z;
    racer.z = clamp(racer.z + racer.vz * dt, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
    if (racer.z === previousZ && Math.abs(racer.vz) > 1) racer.vz *= -0.25;
    racer.lane = closestLane(racer.z);
    racer.vx = 0; racer.vy = 0;
    racer.y = world.y(racer.x) - RADIUS;
    racer.falling = false; racer.grounded = true; racer.stoppedFor = 0;
    racer.lastGroundedAt = ctx.runTime;
    advanceRoll(racer, { vx: 0, vz: racer.vz, grounded: true, inLoop: false }, dt);
    if (trace) {
      trace.preObstacleX = racer.x; trace.preObstacleY = racer.y; trace.preObstacleZ = racer.z;
      trace.preObstacleVx = 0; trace.preObstacleVy = 0;
      trace.held = true;
    }
    return;
  }
  if (racer.falling) {
    racer.fallingFor += dt; racer.vy += GRAVITY * dt;
    racer.x += racer.vx * dt * 0.45; racer.y += racer.vy * dt; racer.rotation += 9 * dt;
    if (trace) { trace.preObstacleX = racer.x; trace.preObstacleY = racer.y; trace.preObstacleZ = racer.z; trace.preObstacleVx = racer.vx; trace.preObstacleVy = racer.vy; }
    // T04: recovery is decided *here*, before the early return, instead of only ever being
    // reachable by the timer. `LEGACY_RECOVERY` carries no depth triggers, so the race still
    // ends a fall on the 0.72 s timer alone and behaves exactly as it did before.
    const policy = ctx.recovery;
    const depth = racer.y - world.y(racer.x);
    const inLava = racer.x >= LAVA_ZONE_START && racer.x <= LAVA_ZONE_END;
    if (racer.fallingFor > policy.maxFallSeconds) {
      recoverRacer(racer, ctx, 'fall-timer', trace);
    } else if (policy.fallDepth !== null && depth > policy.fallDepth) {
      recoverRacer(racer, ctx, 'depth', trace);
    } else if (policy.lavaDepth !== null && inLava && depth > policy.lavaDepth) {
      lavaPlunge(racer, ctx, trace);
      recoverRacer(racer, ctx, 'lava', trace);
    }
    return;
  }
  if (!racer.loopRide) {
    // M01 · T6 (the merge law): a path that ends in a merge hands the racer to its successor. Without
    // this a racer simply drops back to the legacy corridor past the end of their own path, and the
    // authored network stops existing mid-course. `advancePaths` leaves OOB and flag ends alone on
    // purpose, so the OOB trigger still fires on the path it belongs to.
    advancePaths([racer], ctx.laneNetwork ?? null);
    const isWet = racer.x >= STAGE_GRAVITY_START && racer.x <= STAGE_GRAVITY_END;
    // The lane rope (sim/rope.ts): after a hit the spring and damping go slack and the ball keeps its
    // sideways speed, then the rope reels it back into its own lane. Untouched when never hit.
    const ropeConfig = ctx.rope ?? DEFAULT_ROPE;
    const rope = ropeAt(racer.ropeSince, ctx.runTime, ropeConfig);
    const response = (ctx.runTime < racer.steerLockedUntil ? 7 : (isWet ? 20 : 33)) * racer.handling * rope.spring;
    // M01 · T6 (D12): with no network this is exactly `laneZ(targetLane)` and the legacy corridor;
    // with one it is the racer's own path centre and the union corridor of the paths active here.
    // The PD spring, its damping, the clamp of the spring's own output and the steer lock are all
    // untouched — only the target and the two bounds are generalised.
    const lane = resolveLaneTarget(racer, ctx.laneNetwork ?? null);
    const steering = (lane.targetZ - racer.z) * response - racer.vz * (isWet ? 6.2 : 9.5) * Math.sqrt(racer.handling) * rope.damping;
    racer.vz = clamp(racer.vz + steering * dt, -650 * racer.handling, 650 * racer.handling);
    const previousZ = racer.z;
    // With slack on the rope the ball is not held to its lane corridor, only to the road itself.
    const zMin = rope.slack ? -LANE_Z_LIMIT : lane.zMin;
    const zMax = rope.slack ? LANE_Z_LIMIT : lane.zMax;
    const impactVz = racer.vz;
    racer.z = clamp(racer.z + racer.vz * dt, zMin, zMax);
    if (racer.z === previousZ && Math.abs(racer.vz) > 1) racer.vz *= -0.25;
    // Knocked into the tree line at the road edge: a smash. (Out-of-bounds zones, when authored, are
    // where a smash will hand the ball to the rope goblins for a reset instead.)
    if (rope.slack && (racer.z === zMin || racer.z === zMax) && Math.abs(impactVz) >= ropeConfig.edgeSmashVz) {
      ctx.fx.effect('impact', racer.x, racer.y, racer.z, 1.2, racer.id);
      ctx.fx.effect('sparks', racer.x, racer.y, racer.z, 1, racer.id);
      if (!racer.id) { ctx.fx.say('INTO THE TREES! THE ROPE REELS YOU BACK.'); ctx.fx.audio('tree_smash'); }
    }
    scrapeSparks(racer, impactVz, ctx);
    racer.lane = closestLane(racer.z);
  }
  const dragFactor = 120 / racer.weight;
  const stageGravity = (racer.x >= STAGE_GRAVITY_START && racer.x <= STAGE_GRAVITY_END ? GRAVITY * 1.45 : GRAVITY);
  if (racer.loopRide) {
    const ride = racer.loopRide; const loop = loopGeometry(ride.obstacle, world.course);
    racer.z += (obstacleZ(ride.obstacle) - racer.z) * Math.min(1, dt * 16); racer.vz = 0;
    if (ride.entryProgress < 1) {
      ride.entryProgress = Math.min(1, ride.entryProgress + dt * 7);
      const t = ride.entryProgress; const ease = t * t * (3 - 2 * t);
      const x = loop.x + Math.sin(ride.entryAngle) * loop.ballRadius;
      const y = loop.y + Math.cos(ride.entryAngle) * loop.ballRadius + world.y(x) - world.y(loop.x);
      racer.x = ride.entry.x + (x - ride.entry.x) * ease; racer.y = ride.entry.y + (y - ride.entry.y) * ease;
    } else {
      ride.angle += Math.min(ride.speed, 760) / loop.ballRadius * dt;
      racer.x = loop.x + Math.sin(ride.angle) * loop.ballRadius;
      racer.y = loop.y + Math.cos(ride.angle) * loop.ballRadius + world.y(racer.x) - world.y(loop.x);
    }
    racer.rotation += Math.min(ride.speed, 760) / RADIUS * dt;
    // A loop ride rewrites the position, so the canonical capture is the ring state *before* the
    // exit hands the racer back `speed * 1.08`. That is what "capture speed/vector before normal
    // loop boosts" means in code.
    if (trace) { trace.preObstacleX = racer.x; trace.preObstacleY = racer.y; trace.preObstacleZ = racer.z; trace.preObstacleVx = racer.vx; trace.preObstacleVy = racer.vy; }
    if (ride.angle >= ride.exitAngle) {
      racer.x = loop.x + 3; racer.y = loop.y + loop.ballRadius + world.y(racer.x) - world.y(loop.x);
      racer.vx = Math.min(racer.maximumSpeed, ride.speed * 1.08); racer.vy = world.slope(racer.x) * racer.vx;
      racer.loopRide = null; racer.grounded = false;
      racer.loopExitTime = ctx.runTime;
      ctx.fx.effect('sparks', racer.x, racer.y, racer.z, 1.2, racer.id);
      ctx.fx.effect('dust', racer.x, racer.y, racer.z, 1, racer.id);
      if (trace) trace.loopExited = true;
      if (!racer.id) { ctx.fx.score(350); ctx.fx.tally('loops'); ctx.fx.say('A WELL-ROUNDED BAD IDEA.'); ctx.fx.audio('loop'); }
    }
  } else {
    if (racer.bufferedJump >= ctx.runTime && canHop(racer, ctx.runTime)) performHop(racer, ctx);
    const before = world.surfaceAt(racer.x, racer.z);
    if (racer.grounded && !world.inGap(racer.x, racer.z)) {
      const downhill = stageGravity * before.slope / (1 + before.slope * before.slope) / 1.4;
      const resistance = 7 + racer.vx * 0.025 * Math.sqrt(dragFactor) + racer.vx * racer.vx * 0.000009 * dragFactor;
      racer.vx = Math.max(0, racer.vx + (downhill - resistance) * dt);
      racer.vy = before.slope * racer.vx; racer.x += racer.vx * dt;
      if (world.inGap(racer.x, racer.z)) { racer.grounded = false; racer.y += racer.vy * dt; }
      else {
        const surface = world.surfaceAt(racer.x, racer.z);
        racer.y = surface.y - RADIUS; racer.vy = surface.slope * racer.vx; racer.lastGroundedAt = ctx.runTime;
        if (surface.ramp && !racer.visited.has(surface.ramp) && (racer.x - surface.ramp.x) / surface.ramp.width > 0.94) {
          racer.vy -= 155 * weightImpulse(racer.weight); racer.y -= 2; racer.grounded = false;
          racer.visited.add(surface.ramp);
          if (trace) trace.rampLaunch = true;
          if (!racer.id) { ctx.fx.score(75); ctx.fx.audio('launch'); }
        }
      }
    } else {
      racer.grounded = false;
      racer.vx *= Math.exp(-0.009 * dragFactor * dt);
      racer.vy += stageGravity * dt; racer.x += racer.vx * dt; racer.y += racer.vy * dt;
    }
    // Canonical gate-capture point: integrated motion, no obstacle or loop effect applied yet.
    if (trace) {
      trace.preObstacleX = racer.x; trace.preObstacleY = racer.y; trace.preObstacleZ = racer.z;
      trace.preObstacleVx = racer.vx; trace.preObstacleVy = racer.vy;
    }
    for (const obstacle of world.obstaclesNear(racer.x)) {
      if (racer.visited.has(obstacle) || obstacle.kind === 'gap' || obstacle.kind === 'ramp' || !occupiesLane(obstacle, racer.z)) continue;
      if ((obstacle.kind === 'tnt' || obstacle.kind === 'sheep' || obstacle.kind === 'blimp' || obstacle.kind === 'sign') && obstacle.hit) continue;
      if (obstacle.kind === 'loop') {
        const loop = loopGeometry(obstacle, world.course); const dx = racer.x - loop.x;
        const dy = racer.y - (world.y(racer.x) - world.y(loop.x)) - loop.y;
        if (Math.abs(dx) <= loop.radius + RADIUS && Math.abs(Math.hypot(dx, dy) - loop.ballRadius) < RADIUS * 1.12 && racer.vx > 245) {
          const angle = (Math.atan2(dx, dy) + TAU) % TAU;
          racer.visited.add(obstacle); racer.grounded = false; racer.targetLane = obstacle.lane ?? PLAYER_LANE;
          racer.loopRide = { obstacle, angle, entryAngle: angle, exitAngle: Math.ceil((angle + TAU * 0.65) / TAU) * TAU,
            speed: Math.max(650, racer.vx), entry: { x: racer.x, y: racer.y }, entryProgress: 0 };
          if (trace) trace.loopEngaged = true;
          if (!racer.id) { ctx.fx.say('HOLD ON TO YOUR GOBLIN.'); ctx.fx.audio('boost'); }
          break;
        }
      } else {
        const center = obstacle.x + obstacle.width / 2; const base = world.y(center);
        if (obstacle.kind === 'blimp' || obstacle.kind === 'sign') {
          const alt = obstacle.altitude ?? (obstacle.kind === 'blimp' ? 540 : 315);
          const obsBottom = base - alt + 20;
          const obsTop = base - alt - obstacle.height - 20;
          if (Math.abs(racer.x - center) < obstacle.width / 2 + RADIUS && racer.y + RADIUS > obsTop && racer.y - RADIUS < obsBottom) {
            hitObstacle(racer, obstacle, ctx, trace);
          }
        } else {
          if (Math.abs(racer.x - center) < obstacle.width / 2 + RADIUS && racer.y + RADIUS > base - obstacle.height && racer.y - RADIUS < base + 10) hitObstacle(racer, obstacle, ctx, trace);
        }
      }
    }
    const surface = world.surfaceAt(racer.x, racer.z); const gap = world.inGap(racer.x, racer.z);
    if (gap && racer.y > world.y(racer.x) + RADIUS + 8) {
      racer.falling = true; racer.fallingFor = 0; racer.grounded = false;
      if (trace) trace.fell = true;
    }
    const normalSpeed = racer.vy - surface.slope * racer.vx;
    if (!gap && !racer.falling && !racer.loopRide && !racer.grounded && racer.y + RADIUS >= surface.y && normalSpeed >= 0) {
      racer.y = surface.y - RADIUS;
      const restitution = clamp(0.28 * Math.sqrt(dragFactor), 0.17, 0.38);
      if (normalSpeed > 260) {
        racer.vy = surface.slope * racer.vx - normalSpeed * restitution;
        ctx.fx.emit(racer.x, surface.y, racer.z, 3, '#b8a77b', 70);
        ctx.fx.effect('dust', racer.x, surface.y, racer.z, normalSpeed > 420 ? 1.2 : 0.7, racer.id);
        if (!racer.id) {
          ctx.fx.audio('land');
          if (normalSpeed > 360) ctx.fx.shake(Math.min(4.5, normalSpeed / 160));
        }
      } else { racer.grounded = true; racer.lastGroundedAt = ctx.runTime; racer.vy = surface.slope * racer.vx; }
      if (trace) trace.landed = true;
    }
    racer.rotation += (racer.x - oldX) * (racer.grounded ? Math.sqrt(1 + surface.slope * surface.slope) : 1) / RADIUS;
  }
  // M01 · T3 (IF-GYRO): the shell's roll is physics-owned and reads the *finished* velocities, so
  // the renderer never has to integrate anything of its own.
  advanceRoll(racer, {
    vx: racer.vx, vz: racer.vz, grounded: racer.grounded, inLoop: racer.loopRide !== null,
  }, dt);
  racer.vx = clamp(racer.vx, 0, racer.maximumSpeed);
  racer.distance = Math.max(racer.distance, clamp((racer.x - START_X) / 2, 0, TRACK_DISTANCE));
  racer.stoppedFor = racer.vx < 40 && !racer.loopRide ? racer.stoppedFor + dt : 0;
  // M01 · T6: an authored out-of-bounds node ends the racer's line for this attempt. The crossing is
  // the same swept test the gate uses — `prevX < node.x ≤ x` — so it fires exactly once, on the tick
  // the ball passes the node, and only for a racer who is on that path.
  if (ctx.laneNetwork && racer.pathId) {
    const node = oobCrossed(ctx.laneNetwork, racer.pathId, oldX, racer.x);
    if (node) {
      if (trace) trace.oobNode = node;
      const from = { x: racer.x, y: racer.y, z: racer.z };
      recoverRacer(racer, ctx, 'oob', trace);
      startRopeReel(racer, from, ctx);
      return;
    }
  }
  if (racer.x >= FINISH && !racer.falling) {
    racer.finishTime = ctx.runTime - dt + dt * clamp((FINISH - oldX) / Math.max(1, racer.x - oldX), 0, 1);
    racer.finished = true; racer.distance = TRACK_DISTANCE; racer.x = FINISH + 12; racer.vx = racer.vy = racer.vz = 0;
    if (racer.id) racer.y = world.y(racer.x) - RADIUS;
    if (trace) trace.finished = true;
  } else if (racer.x >= LAVA_ZONE_START && racer.x <= LAVA_ZONE_END && racer.y > world.y(racer.x) + LAVA_LAKE_DEPTH) {
    // Lava lake plunge in Section 3: instant black-smoke vaporization and checkpoint recovery
    lavaPlunge(racer, ctx, trace);
    recoverRacer(racer, ctx, 'lava', trace);
  } else if (racer.y > world.y(racer.x) + OFF_WORLD_DEPTH || racer.stoppedFor > STALLED_SECONDS) {
    recoverRacer(racer, ctx, racer.stoppedFor > STALLED_SECONDS ? 'stopped' : 'depth', trace);
  }
}
