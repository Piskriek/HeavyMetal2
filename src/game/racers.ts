import { laneZ, START_X, START_Y, type LoopRide, type Obstacle, type RacerFrame } from './scene';
import { RACER_DEFINITIONS } from './types';
import { DEFAULT_LOADOUT, loadoutStats, riderById, type Loadout } from './loadouts';
import type { RaceConfig } from './session';

export interface Racer extends RacerFrame {
  vz: number;
  targetLane: number;
  weight: number;
  pace: number;
  loadout: Loadout;
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
  recoveryUntil: number;
  steerLockedUntil: number;
  nextDecision: number;
  lastBoostAt: number;
  lastLaneChange: number;
  loopRide: LoopRide | null;
  finishTime: number | null;
  distance: number;
  bounces: number;
  boosts: number;
  visited: Set<Obstacle>;
  previous: { x: number; y: number; z: number; rotation: number };
}

export function createRacers(config?: RaceConfig): Racer[] {
  return RACER_DEFINITIONS.map((definition) => {
    const loadout = config?.roster[definition.id] ?? DEFAULT_LOADOUT;
    const stats = loadoutStats(loadout);
    return {
    ...definition, x: START_X, y: START_Y, z: laneZ(definition.homeLane), vx: 0, vy: 0, vz: 0,
    name: config ? riderById(loadout.rider).name.toUpperCase() : definition.name,
    loadout, weight: stats.weight, pace: 1,
    launchSpeed: stats.launchSpeed, handling: stats.handling, boostFactor: stats.boostFactor,
    hopFactor: stats.hopFactor, bumpRecovery: stats.bumpRecovery, maximumSpeed: stats.maximumSpeed,
    lane: definition.homeLane, targetLane: definition.homeLane, rotation: 0,
    falling: false, finished: false, grounded: false, bumpAt: -100,
    immuneUntil: -100, launchOrigin: { x: START_X, y: START_Y },
    shieldUntil: -100, shieldHitAt: -100, pickupAt: -100, ringAt: -100,
    lastGroundedAt: -100, lastHopAt: -100, bufferedJump: -100,
    fallingFor: 0, stoppedFor: 0, recoveryUntil: -100, steerLockedUntil: -100,
    nextDecision: 0.35 + definition.id * 0.11, lastBoostAt: -100, lastLaneChange: -100,
    loopRide: null, finishTime: null, distance: 0, bounces: 3, boosts: 2,
    visited: new Set<Obstacle>(),
    previous: { x: START_X, y: START_Y, z: laneZ(definition.homeLane), rotation: 0 },
    };
  });
}

export function raceOrder(a: Racer, b: Racer) {
  if (a.finishTime !== null || b.finishTime !== null) {
    return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
  }
  return b.x - a.x || a.id - b.id;
}