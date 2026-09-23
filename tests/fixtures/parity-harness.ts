/**
 * T04 — the parity harness: two hosts, one tick loop.
 *
 * Host `a` runs the generated copy of the pre-refactor engine simulation. Host `b` is the same
 * fixture with only the extracted members shadowed by `src/game/sim/*` (see
 * `modern-engine-sim.ts`). `assertParity` steps both in lockstep and compares every observable
 * field after every tick; the first divergence is thrown with the tick number and the diff.
 *
 * The harness is exported rather than inlined into the test because later tickets (T05's release
 * timing, T09's contact events) will need the same guarantee for the code they move.
 */
import assert from 'node:assert/strict';
import { createSimCanvas, LegacyEngineSim } from './legacy-engine-sim';
import { attachModernSim, type ModernSimHost } from './modern-engine-sim';
import { createTrackLayout } from '../../src/game/track-layout';
import { createAirPickups } from '../../src/game/powerups';
import { FINISH, START_X, type Obstacle } from '../../src/game/scene';
import { DEFAULT_OPTIONS, type CourseId, type GameOptions } from '../../src/game/types';
import type { RaceConfig } from '../../src/game/session';
import type { Loadout } from '../../src/game/loadouts';
import { FIXED_STEP } from '../../src/game/contracts/timing';

export const STEP = FIXED_STEP;

export type ActionKind = 'aimUp' | 'aimDown' | 'angleUp' | 'angleDown' | 'launch'
  | 'laneLeft' | 'laneRight' | 'hop' | 'bounce' | 'boost' | 'reset';

export interface Action { readonly tick: number; readonly kind: ActionKind }
export const act = (tick: number, kind: ActionKind): Action => ({ tick, kind });

export interface ParityPair {
  /** The pure legacy host. */
  readonly a: LegacyEngineSim;
  /** The legacy host whose extracted members are shadowed by `src/game/sim`. */
  readonly b: LegacyEngineSim;
  readonly modern: ModernSimHost;
}

function raceConfig(course: CourseId, loadout: Loadout, difficulty: RaceConfig['difficulty']): RaceConfig {
  return {
    mode: 'quick', course, loadout, difficulty, customPhysics: false,
    fieldSize: 4, seed: 0x12345678,
    sessionId: 'parity-harness', round: 0, totalRounds: 1,
    roster: [
      loadout,
      { rider: 'grub', capsule: 'siege' },
      { rider: 'nix', capsule: 'springsteel' },
      { rider: 'rivet', capsule: 'iron' },
    ],
  };
}

function optionsFor(course: CourseId): GameOptions {
  // `reducedMotion` stays false: the fixture replaces the `prefers-reduced-motion` media query with
  // a plain field, and both hosts must read the same value out of it.
  return { ...DEFAULT_OPTIONS, course, sound: false, reducedMotion: false, screenShake: false };
}

/**
 * Builds the two hosts. `obstacles` replaces the course layout on both (the fixture rebuilds its
 * own bucket map, the shadowed host re-indexes its world), which is how a scenario gets to place a
 * pinball spinner in section 1 or a four-lane gap in front of the start gate.
 */
export function createParityPair(
  course: CourseId,
  loadout: Loadout,
  difficulty: RaceConfig['difficulty'],
  obstacles?: readonly Obstacle[],
): ParityPair {
  const config = raceConfig(course, loadout, difficulty);
  const noop = () => {};
  const a = new LegacyEngineSim(createSimCanvas(), optionsFor(course), noop, noop, config);
  const b = new LegacyEngineSim(createSimCanvas(), optionsFor(course), noop, noop, config);
  const modern = attachModernSim(b);
  if (obstacles) {
    a.setTrackObstacles(obstacles.map((obstacle) => ({ ...obstacle })));
    b.setTrackObstacles(obstacles.map((obstacle) => ({ ...obstacle })));
  }
  return { a, b, modern };
}

function applyAction(host: LegacyEngineSim, action: Action): void {
  switch (action.kind) {
    case 'aimUp': host.adjustAim(0.05, 0); return;
    case 'aimDown': host.adjustAim(-0.03, 0); return;
    case 'angleUp': host.adjustAim(0, 4); return;
    case 'angleDown': host.adjustAim(0, -6); return;
    case 'launch': host.launch(); return;
    case 'laneLeft': host.changeLane(-1); return;
    case 'laneRight': host.changeLane(1); return;
    case 'hop': host.performHop(host.racers[0]); return;
    case 'bounce': host.performBounce(host.racers[0]); return;
    case 'boost': host.performBoost(host.racers[0]); return;
    case 'reset': host.reset(); return;
  }
}

export const SNAPSHOT_FIELDS = [
  'status', 'distance', 'speed', 'power', 'angle', 'bounces', 'boosts', 'inLoop', 'falling', 'hopReady',
  'grounded', 'grade', 'sector', 'score', 'notice', 'progress', 'position', 'lane', 'targetLane', 'laneLocked',
  'bumps', 'raceTime', 'settling', 'finishWait', 'pickups', 'shieldSeconds', 'lastPickup', 'pickupNoticeUntil',
] as const;

/**
 * Everything the simulation is allowed to change, in exact numbers. Deliberately excludes the two
 * fields the T04 seam adds on purpose (`racer.recoveries`, `obstacle.hitBy`) and the wall-clock
 * fields a record would carry (`date`, `id`); the tests assert those separately.
 */
export function observe(host: LegacyEngineSim) {
  const snapshot = host.snapshot as unknown as Record<string, unknown>;
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
  return {
    runTime: host.runTime,
    time: host.time,
    counts: { ...host.counts },
    shake: host.shake,
    topSpeed: host.topSpeed,
    pickupCount: host.pickupCount,
    shieldBlocks: host.shieldBlocks,
    noticeUntil: host.noticeUntil,
    audio: [...host.audio.cues],
    particles: host.particles.length,
    particleSum: total(host.particles.flatMap((p) => [p.x, p.y, p.z, p.vx, p.vy, p.life, p.size])),
    sheep: host.airSheep.map((s) => [s.x, s.y, s.z, s.vx, s.vy, s.rotation, s.life]),
    trail: host.trail.map((t) => [t.x, t.y, t.z]),
    collisionTimes: Array.from(host.collisionTimes),
    racers: host.racers.map((racer) => ({
      x: racer.x, y: racer.y, z: racer.z, vx: racer.vx, vy: racer.vy, vz: racer.vz,
      rotation: racer.rotation, lane: racer.lane, targetLane: racer.targetLane, distance: racer.distance,
      grounded: racer.grounded, falling: racer.falling, fallingFor: racer.fallingFor, stoppedFor: racer.stoppedFor,
      finished: racer.finished, finishTime: racer.finishTime, bounces: racer.bounces, boosts: racer.boosts,
      shieldUntil: racer.shieldUntil, immuneUntil: racer.immuneUntil, recoveryUntil: racer.recoveryUntil,
      steerLockedUntil: racer.steerLockedUntil, lastHopAt: racer.lastHopAt, lastGroundedAt: racer.lastGroundedAt,
      lastBoostAt: racer.lastBoostAt, lastLaneChange: racer.lastLaneChange, nextDecision: racer.nextDecision,
      bumpAt: racer.bumpAt, shieldHitAt: racer.shieldHitAt, pickupAt: racer.pickupAt, visited: racer.visited.size,
      loop: racer.loopRide
        ? { angle: racer.loopRide.angle, speed: racer.loopRide.speed, entry: racer.loopRide.entryProgress, obstacle: racer.loopRide.obstacle.x }
        : null,
      previous: { ...racer.previous },
    })),
    standings: host.standings(),
    snapshot: Object.fromEntries(SNAPSHOT_FIELDS.map((key) => [key, snapshot[key]])),
    obstacles: host.obstacles.map((o) => [o.kind, o.x, o.hit ? 1 : 0, o.hitAt, o.hitMask ?? 0, o.broken ? 1 : 0]),
    pickups: host.pickups.map((p) => [p.id, p.kind, p.collectedBy, p.collectedAt]),
  };
}

export interface ParityOptions {
  readonly actions?: readonly Action[];
  readonly label?: string;
  /** Also fails if the run never left the launch pad, so a no-op scenario cannot pass by accident. */
  readonly requireProgress?: boolean;
}

/**
 * Steps both hosts for `ticks` fixed steps and asserts they agree after every single one.
 * Throws on the first divergence with the tick and the field diff.
 */
export function assertParity(pair: ParityPair, ticks: number, options: ParityOptions = {}): void {
  const { actions = [], label = 'parity', requireProgress = true } = options;
  for (let tick = 0; tick < ticks; tick++) {
    for (const host of [pair.a, pair.b]) {
      host.time += STEP;
      host.shake *= Math.exp(-9 * STEP);
      for (const racer of host.racers) {
        racer.previous.x = racer.x; racer.previous.y = racer.y;
        racer.previous.z = racer.z; racer.previous.rotation = racer.rotation;
      }
      for (const action of actions) if (action.tick === tick) applyAction(host, action);
      host.stepRace(STEP);
      host.updateParticles(STEP);
    }
    try {
      assert.deepEqual(observe(pair.b), observe(pair.a));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${label}: the shared sim diverged from the legacy engine on tick ${tick} (${(tick * STEP).toFixed(3)}s)\n${detail}`);
    }
  }
  if (requireProgress) {
    const travelled = Math.max(...pair.a.racers.map((racer) => racer.x)) - START_X;
    if (travelled < 500) throw new Error(`${label}: the scenario never went anywhere (max x advance ${travelled.toFixed(0)}), so it proves nothing`);
  }
}

/** Pins `Math.random` so both hosts draw the same value at every call site. */
export function withPinnedRandom<T>(run: () => T): T {
  const original = Math.random;
  Math.random = () => 0.25;
  try { return run(); } finally { Math.random = original; }
}

/** A layout with one of every obstacle kind, plus a four-lane gap and the course's first loop. */
export function everyKindLayout(course: CourseId, startX = 900, stride = 420): Obstacle[] {
  const kinds: Obstacle['kind'][] = [
    'boost', 'spring', 'tnt', 'sheep', 'water_rock', 'break_bridge', 'pinball_spinner', 'cauldron',
    'roller_rails', 'waterfall_splash', 'sign', 'blimp', 'rock_gate', 'cave_torch', 'stalactite', 'lane_tube',
  ];
  const obstacles: Obstacle[] = [];
  let x = startX;
  for (const kind of kinds) {
    obstacles.push({
      kind, x, width: kind === 'sign' || kind === 'waterfall_splash' || kind === 'rock_gate' ? 400 : 120,
      height: kind === 'blimp' ? 115 : kind === 'sign' ? 150 : 90,
      lane: 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0,
      ...(kind === 'blimp' ? { altitude: 210 } : {}),
      ...(kind === 'sign' ? { altitude: 240, signType: 'tnt' as const } : {}),
      ...(kind === 'break_bridge' ? { broken: false, health: 1, lane: -1, laneSpan: 4 } : {}),
      ...(kind === 'rock_gate' || kind === 'waterfall_splash' ? { lane: -1, laneSpan: 4 } : {}),
    });
    x += stride;
  }
  obstacles.push({ kind: 'ramp', x, width: 210, height: 120, lane: 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 });
  obstacles.push({ kind: 'gap', x: x + 900, width: 200, height: 0, lane: -1, laneSpan: 4, hit: false, hitAt: -100, hitMask: 0 });
  const firstLoop = createTrackLayout(course).filter((obstacle) => obstacle.kind === 'loop').slice(0, 1);
  return [...obstacles, ...firstLoop.map((obstacle) => ({ ...obstacle, x: Math.max(obstacle.x, x + 1600) }))].sort((left, right) => left.x - right.x);
}

/** A layout that is nothing but a wall-to-wall gap: the shortest honest way to make a racer fall. */
export function gapTrapLayout(x = 1200, width = 260): Obstacle[] {
  return [{ kind: 'gap', x, width, height: 0, lane: -1, laneSpan: 4, hit: false, hitAt: -100, hitMask: 0 }];
}

/** Convenience: the finish line, for scenarios that must not reach it. */
export const SAFE_TICKS_BEFORE_FINISH = Math.floor((FINISH - START_X) / 2000 / STEP);

export type { ModernSimHost };
export { createAirPickups };
