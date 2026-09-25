import { laneZ, START_X, START_Y, type LoopRide, type Obstacle, type RacerFrame } from './scene';
import { RACER_DEFINITIONS } from './types';
import { loadoutStats, riderById } from './loadouts';
import { PLAYER_ID, buildRoster, clampFieldSize, hash01 } from './roster';
import type { RaceConfig } from './session';

export interface Racer extends RacerFrame {
  vz: number;
  targetLane: number;
  weight: number;
  pace: number;
  loadout: import('./loadouts').Loadout;
  launchSpeed: number;
  handling: number;
  boostFactor: number;
  hopFactor: number;
  bumpRecovery: number;
  maximumSpeed: number;
  grounded: boolean;
  lastGroundedAt: number;
  lastHopAt: number;
  bufferedJump: number;
  fallingFor: number;
  stoppedFor: number;
  /** Recoveries spent in the current attempt/race. Reset with the racer, never inferred. */
  recoveries: number;
  recoveryUntil: number;
  steerLockedUntil: number;
  /** Race time of the last hit that shot this ball's lane rope out (sim/rope.ts). */
  ropeSince?: number;
  /** P6: race time of the last wall-scrape spark burst (presentation only, never physics). */
  scrapeFxAt?: number;
  nextDecision: number;
  /**
   * H11: a bot winding up a shove. `ramTargetId` is the rival it means to hit (null when none),
   * `ramTellUntil` the race time its wobble tell ends, and `ramLane`/`ramPathId` where it will go.
   */
  ramTargetId: number | null;
  ramTellUntil: number;
  ramLane: number;
  ramPathId: string | null;
  lastBoostAt: number;
  lastLaneChange: number;
  loopRide: LoopRide | null;
  finishTime: number | null;
  distance: number;
  bounces: number;
  boosts: number;
  /** T02: true for the local player. Identity is `id` (always PLAYER_ID for the player). */
  isPlayer: boolean;
  /**
   * M01 · T3 (IF-GYRO): the shell's roll, owned by the physics, not the renderer. `rollPhase` is
   * radians in [0, TAU) and `rollRate` radians/s; `advanceRoll` in `gyro-ball.ts` is the only writer.
   * Deliberately outside the parity fingerprint (T3 AC-9): roll is presentation, not outcome.
   */
  rollPhase: number;
  rollRate: number;
  /**
   * M01 · T2 (IF-MERGE): true while the first-loop pool holds this racer. Held racers are frozen at
   * the gate plane and only glide sideways into their pool slot; they are skipped by contact and by
   * every obstacle, and the race clock is stopped while the pool is filling.
   */
  mergeHeld: boolean;
  /** Where a held racer is gliding to: their pool slot, or the loop lane when they are next to go. */
  mergeSlotZ: number;
  /**
   * True from the moment of release until the rider is clear of the geometry loop (`passageExitX`), and
   * at least `PASSAGE_GHOST_TAIL_S` after the release: the rider is
   * intangible, so the ordered release cannot be spoiled by contact.
   */
  mergeGhost: boolean;
  /** Run time after which this rider's merge intangibility may end, once they are clear of the loop. */
  mergeGhostUntil: number;
  /** Run time the racer last left a loop, or -100. The ghost tail is measured from here. */
  loopExitTime: number;
  /**
   * M01 · T6 (IF-LANES): the authored path this racer is on, or `null` for the legacy four lanes.
   * The path owns the steering target and the corridor; `targetLane` stays meaningful either way,
   * because the HUD, the obstacles and the loop's lane filter all still speak in lanes.
   */
  pathId: string | null;
  visited: Set<Obstacle>;
  previous: { x: number; y: number; z: number; rotation: number };
}

/** Spacing between starting-grid rows when more than four racers share the four lanes. */
export const GRID_ROW_SPACING = 90;

/**
 * Builds the field for a race.
 *
 * - Without a config, or with a four-racer config, this reproduces the legacy field
 *   exactly: the original definitions, lanes [2, 0, 1, 3], legacy stagger schedule.
 * - Larger fields (20/50/100) come from `buildRoster`: dense stable IDs, the player at
 *   `PLAYER_ID`, bounded deterministic pace spread, and a starting grid stacked in rows
 *   behind the launch line so lane-mates never spawn inside each other.
 */
export function createRacers(config?: RaceConfig): Racer[] {
  const fieldSize = clampFieldSize(config?.fieldSize ?? 4);
  const roster = buildRoster(fieldSize, config?.roster?.[0] ?? { rider: 'rivet', capsule: 'iron' });
  return roster.map((entry) => {
    const definition = RACER_DEFINITIONS[entry.id];
    const legacy = fieldSize <= 4 && !!definition;
    const loadout = legacy ? config?.roster?.[entry.id] ?? entry.loadout : entry.loadout;
    const stats = loadoutStats(loadout);
    const row = Math.floor(entry.id / 4);
    const startX = fieldSize > 4 ? START_X - row * GRID_ROW_SPACING : START_X;
    return {
      ...entry, x: startX, y: START_Y, z: laneZ(entry.homeLane), vx: 0, vy: 0, vz: 0,
      // Legacy parity: the four-racer field always raced at pace 1 with loadout weight,
      // exactly as before T02 — no pace/balance drift is allowed by the acceptance list.
      weight: stats.weight,
      // Legacy parity: with a config, the original engine renamed every four-racer
      // slot to its loadout's rider name (roster[1] is NIX, not the definition's
      // GRUB). Large fields keep numbered names so 100 rows stay distinguishable.
      name: config
        ? (legacy || entry.isPlayer)
          ? riderById(loadout.rider).name.toUpperCase()
          : entry.name
        : entry.name,
      loadout, pace: legacy ? 1 : entry.pace,
      launchSpeed: stats.launchSpeed, handling: stats.handling, boostFactor: stats.boostFactor,
      hopFactor: stats.hopFactor, bumpRecovery: stats.bumpRecovery, maximumSpeed: stats.maximumSpeed,
      lane: entry.homeLane, targetLane: entry.homeLane, rotation: 0,
      rollPhase: 0, rollRate: 0,
      mergeHeld: false, mergeSlotZ: laneZ(entry.homeLane), mergeGhost: false, mergeGhostUntil: -100,
      loopExitTime: -100,
      pathId: null,
      falling: false, finished: false, grounded: false, bumpAt: -100,
      immuneUntil: -100, launchOrigin: { x: startX, y: START_Y },
      shieldUntil: -100, shieldHitAt: -100, pickupAt: -100,
      lastGroundedAt: -100, lastHopAt: -100, bufferedJump: -100,
      fallingFor: 0, stoppedFor: 0, recoveries: 0, recoveryUntil: -100, steerLockedUntil: -100,
      // Legacy four keep the exact 0.35 + id * 0.11 ramp; big fields fold the identity
      // hash into a bounded 0.55 s window instead of an 11-second wait at racer 99.
      nextDecision: legacy ? 0.35 + entry.id * 0.11 : 0.35 + hash01(entry.id) * 0.55,
      ramTargetId: null, ramTellUntil: -100, ramLane: entry.homeLane, ramPathId: null,
      lastBoostAt: -100, lastLaneChange: -100,
      loopRide: null, finishTime: null, distance: 0, bounces: 3, boosts: 2,
      isPlayer: entry.id === PLAYER_ID,
      visited: new Set<Obstacle>(),
      previous: { x: startX, y: START_Y, z: laneZ(entry.homeLane), rotation: 0 },
    };
  });
}

export function raceOrder(a: Racer, b: Racer) {
  if (a.finishTime !== null || b.finishTime !== null) {
    return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
  }
  return b.x - a.x || a.id - b.id;
}
