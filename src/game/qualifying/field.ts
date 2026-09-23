/**
 * T04 — the qualifying field: who is attempting, what they are frozen with, and when they deploy.
 *
 * A qualifying participant is described by the T01 config contract's `ParticipantConfig`; this module
 * turns that record into the same `Racer` body the race simulates, so an attempt runs the real physics
 * with real loadout stats and no special-casing.
 *
 * Two rules worth naming:
 *
 * - **Staging freezes gameplay state.** `freezeStagedState` captures the charges, the lane, the
 *   progress and the recovery count while the participant is on the grid, and every attempt (and
 *   every retry) starts by restoring exactly that. Nothing a participant might have picked up before
 *   their own attempt — a stray supply, a shield, a head start — survives into it, and a retry cannot
 *   keep an advantage.
 * - **The schedule is bounded.** Launch delays come from `cpuStagingDelay` in the contract, which is
 *   capped for every field size, and the launch-angle fan is spread across a fixed envelope instead of
 *   `(id - 2) * 1.2`, which grows without limit past a four-racer field. Nobody waits 35 seconds
 *   because of their index.
 */
import { LANE_COUNT, START_X, START_Y, laneZ, launchVelocity, type Obstacle } from '../scene';
import { RACER_DEFINITIONS } from '../types';
import { CAPSULES, DEFAULT_LOADOUT, RIDERS, loadoutStats, type Loadout } from '../loadouts';
import type { Racer } from '../racers';
import type { ParticipantConfig } from '../contracts/config';
import { cpuStagingDelay } from '../contracts/qualifying';
import type { RacerId } from '../contracts/identity';
import type { Difficulty } from '../session';
import { clamp } from '../contracts/core';
import { createRng } from '../rng';

export const SYNTHETIC_COLORS = ['#f0a15b', '#87d7ba', '#b7a0e8', '#e4cc77', '#d98c6a', '#7fc4a7', '#c9b26f', '#9fb7d9'] as const;

export interface QualifyingParticipant extends ParticipantConfig {
  readonly color: string;
  /** Field-local grid slot (0-based). Identity is `id`; the slot is assignment metadata. */
  readonly gridSlot: number;
}

/** The four canonical racers, in their legacy order and colours. */
export function legacyParticipants(loadout: Loadout = DEFAULT_LOADOUT): readonly QualifyingParticipant[] {
  return RACER_DEFINITIONS.map((definition, index) => Object.freeze({
    id: definition.id,
    name: definition.name,
    homeLane: definition.homeLane,
    pace: 1,
    loadout: Object.freeze({ ...(index === 0 ? loadout : opponentLoadoutFor(index)) }),
    isPlayer: definition.id === 0,
    color: definition.color,
    gridSlot: index,
  }));
}

function opponentLoadoutFor(index: number): Loadout {
  const rider = RIDERS[(index + 1) % RIDERS.length];
  const capsule = CAPSULES[(index + 1) % CAPSULES.length];
  return { rider: rider.id, capsule: capsule.id };
}

/**
 * A deterministic field of any supported size, for the 20/50/100 runs and for tests. Loadouts cycle
 * through the twelve real builds, so a synthetic rival is a real physics budget rather than a
 * statistical stub. `normalizeRaceConfig` still gets the final say on the shape.
 */
export function syntheticField(size: number, seed: number, playerLoadout: Loadout = DEFAULT_LOADOUT): readonly QualifyingParticipant[] {
  const count = clamp(Math.round(size), 1, 100);
  const combos: Loadout[] = [];
  for (const rider of RIDERS) for (const capsule of CAPSULES) combos.push({ rider: rider.id, capsule: capsule.id });
  const rng = createRng(seed ^ 0x5bf03635);
  const participants: QualifyingParticipant[] = [];
  for (let slot = 0; slot < count; slot++) {
    const loadout = slot === 0 ? playerLoadout : combos[Math.floor(rng.next() * combos.length) % combos.length];
    participants.push(Object.freeze({
      id: slot,
      name: slot === 0 ? 'YOU' : `GOBLIN ${String(slot + 1).padStart(2, '0')}`,
      homeLane: slot % LANE_COUNT,
      pace: 1,
      loadout: Object.freeze({ ...loadout }),
      isPlayer: slot === 0,
      color: SYNTHETIC_COLORS[slot % SYNTHETIC_COLORS.length],
      gridSlot: slot,
    }));
  }
  return Object.freeze(participants);
}

export function participantsFromConfig(config: { participants: readonly ParticipantConfig[] }): readonly QualifyingParticipant[] {
  return Object.freeze(config.participants.map((participant, index) => {
    const legacy = RACER_DEFINITIONS.find((definition) => definition.id === participant.id);
    return Object.freeze({
      ...participant,
      // No hidden speed: the race neutralises `pace` for everyone, and so does qualifying.
      pace: 1,
      color: legacy?.color ?? SYNTHETIC_COLORS[participant.id % SYNTHETIC_COLORS.length],
      gridSlot: index,
    });
  }));
}

/**
 * Builds the racer body an attempt simulates. The stat function is the one the race uses
 * (`loadoutStats`), so a qualifying time is comparable with a race time.
 */
export function createAttemptRacer(participant: QualifyingParticipant): Racer {
  const stats = loadoutStats(participant.loadout);
  const lane = clamp(Math.round(participant.homeLane), 0, LANE_COUNT - 1);
  const z = laneZ(lane);
  return {
    id: participant.id,
    name: participant.name.toUpperCase(),
    color: participant.color,
    homeLane: lane,
    x: START_X, y: START_Y, z, vx: 0, vy: 0, vz: 0,
    weight: stats.weight,
    pace: 1,
    loadout: { ...participant.loadout },
    launchSpeed: stats.launchSpeed,
    handling: stats.handling,
    boostFactor: stats.boostFactor,
    hopFactor: stats.hopFactor,
    bumpRecovery: stats.bumpRecovery,
    maximumSpeed: stats.maximumSpeed,
    lane, targetLane: lane, rotation: 0,
    falling: false, finished: false, grounded: false, bumpAt: -100,
    immuneUntil: -100, launchOrigin: { x: START_X, y: START_Y },
    shieldUntil: -100, shieldHitAt: -100, pickupAt: -100,
    lastGroundedAt: -100, lastHopAt: -100, bufferedJump: -100,
    fallingFor: 0, stoppedFor: 0, recoveries: 0, recoveryUntil: -100, steerLockedUntil: -100,
    nextDecision: 0, lastBoostAt: -100, lastLaneChange: -100,
    loopRide: null, finishTime: null, distance: 0, bounces: 3, boosts: 2,
    isPlayer: (participant as any).isPlayer ?? participant.id === 0,
    visited: new Set<Obstacle>(),
    previous: { x: START_X, y: START_Y, z, rotation: 0 },
  };
}

// ---------------------------------------------------------------------------
// Staging freeze
// ---------------------------------------------------------------------------

/** What "frozen on staging" means: the gameplay state an attempt is allowed to start from. */
export interface StagedState {
  readonly boosts: number;
  readonly bounces: number;
  readonly lane: number;
  readonly targetLane: number;
  readonly distance: number;
  readonly recoveries: number;
  readonly shieldUntil: number;
}

export function freezeStagedState(racer: Racer): StagedState {
  return Object.freeze({
    boosts: racer.boosts,
    bounces: racer.bounces,
    lane: racer.lane,
    targetLane: racer.targetLane,
    distance: racer.distance,
    recoveries: racer.recoveries,
    shieldUntil: racer.shieldUntil,
  });
}

/**
 * Puts a racer back on the grid and re-applies the frozen state. Everything the previous attempt
 * gained or lost — charges spent, supplies held, visited obstacles, the loop it was riding, the
 * distance it banked — is gone; only the staged record survives.
 */
export function resetToStagedState(racer: Racer, staged: StagedState): void {
  const z = laneZ(staged.lane);
  racer.x = START_X; racer.y = START_Y; racer.z = z;
  racer.vx = 0; racer.vy = 0; racer.vz = 0;
  racer.rotation = 0;
  racer.lane = staged.lane; racer.targetLane = staged.targetLane;
  racer.falling = false; racer.fallingFor = 0; racer.stoppedFor = 0;
  racer.finished = false; racer.finishTime = null;
  racer.grounded = false; racer.loopRide = null;
  racer.bounces = staged.bounces; racer.boosts = staged.boosts;
  racer.shieldUntil = staged.shieldUntil;
  racer.recoveries = staged.recoveries;
  racer.distance = staged.distance;
  racer.immuneUntil = -100; racer.recoveryUntil = -100; racer.steerLockedUntil = -100;
  racer.lastHopAt = -100; racer.lastGroundedAt = -100; racer.bufferedJump = -100;
  racer.lastBoostAt = -100; racer.lastLaneChange = -100;
  racer.bumpAt = -100; racer.shieldHitAt = -100; racer.pickupAt = -100;
  racer.launchOrigin = { x: START_X, y: START_Y };
  racer.visited.clear();
  Object.assign(racer.previous, { x: START_X, y: START_Y, z, rotation: 0 });
}

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

export interface LaunchAim { readonly power: number; readonly angle: number }

/** The envelope `GameOptions` and the on-screen sliders already clamp to. */
export const AIM_POWER_MIN = 0.18;
export const AIM_POWER_MAX = 1;
export const AIM_ANGLE_MIN = 12;
export const AIM_ANGLE_MAX = 68;

export function humanAim(power: number, angle: number): LaunchAim {
  return Object.freeze({
    power: clamp(power, AIM_POWER_MIN, AIM_POWER_MAX),
    angle: clamp(angle, AIM_ANGLE_MIN, AIM_ANGLE_MAX),
  });
}

/**
 * A CPU's qualifying launch is a *decision*, like a line choice: a bounded, deterministic draw
 * around a sensible launch window, tightened by difficulty. It is not a speed bonus — the physics
 * budget is identical, and the same draw is available to the human by moving the sliders.
 */
export function cpuAim(rng: { next(): number }, difficulty: Difficulty): LaunchAim {
  const sloppiness = difficulty === 'rookie' ? 1 : difficulty === 'veteran' ? 0.35 : 0.65;
  const power = clamp(1 - sloppiness * 0.22 * rng.next(), AIM_POWER_MIN, AIM_POWER_MAX);
  const angle = clamp(34 + (rng.next() - 0.5) * 2 * 14 * sloppiness, AIM_ANGLE_MIN, AIM_ANGLE_MAX);
  return Object.freeze({ power, angle });
}

/**
 * The launch-angle fan. Up to four racers this is the legacy `(id - 2) * 1.2` spread, which keeps the
 * four-racer path bit-compatible with the race. Above four it is a bounded spread across the same
 * ±12° envelope, because a fan that grows with the index would aim half the field at the sky.
 */
export function launchAngleOffset(racerId: RacerId, gridSlot: number, fieldSize: number): number {
  if (racerId === 0) return 0;
  if (fieldSize <= 4) return (racerId - 2) * 1.2;
  const span = fieldSize > 1 ? clamp(gridSlot / (fieldSize - 1), 0, 1) - 0.5 : 0;
  return span * 24;
}

export function clampedLaunchAngle(aim: LaunchAim, offset: number): number {
  return clamp(aim.angle + offset, AIM_ANGLE_MIN, AIM_ANGLE_MAX);
}

/** The launch impulse, in the same form the race uses: velocity by pace, split by the launch angle. */
export function launchVelocityFor(racer: Racer, aim: LaunchAim, offset: number): { vx: number; vy: number } {
  const velocity = launchVelocity(aim.power, racer.launchSpeed);
  const angle = clampedLaunchAngle(aim, offset) * Math.PI / 180;
  return { vx: Math.cos(angle) * velocity * racer.pace, vy: -Math.sin(angle) * velocity * racer.pace };
}

/** Bounded CPU deployment schedule; slot 0 (the human) goes first and never waits for a queue. */
export function launchDelay(gridSlot: number, fieldSize: number, isHuman: boolean): number {
  if (isHuman) return 0;
  return cpuStagingDelay(gridSlot, fieldSize);
}

/** Gap between a failed attempt and its retry. Bounded, index-independent, and short. */
export const RETRY_DELAY_SECONDS = 0.35;

/** First decision delay, mirroring the race's `0.35 + id * 0.11` without letting it grow with the field. */
export function initialDecisionDelay(gridSlot: number, fieldSize: number): number {
  const stagger = fieldSize <= 4 ? gridSlot * 0.11 : (gridSlot % 4) * 0.11;
  return 0.35 + stagger;
}

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

/**
 * Per-attempt gameplay seed. Mixed from (session seed, racer ID, attempt number) so it is stable for
 * a rerun and independent of how many attempts anybody else has taken.
 */
export function attemptSeed(seed: number, racerId: RacerId, attempt: number): number {
  let hash = (seed | 0) ^ 0x9e3779b9;
  hash = Math.imul(hash ^ ((racerId + 1) | 0), 0x85ebca6b);
  hash = Math.imul(hash ^ Math.imul(attempt | 0, 0x2545f491), 0xc2b2ae35);
  hash ^= hash >>> 15;
  return hash | 0;
}

/** Heat-scoped seed: the mystery route rolls once per heat and a retry reuses it, by construction. */
export function heatSeed(seed: number, racerId: RacerId, heatIndex: number): number {
  let hash = (seed | 0) ^ 0x165667b1;
  hash = Math.imul(hash ^ ((racerId + 1) | 0), 0x9e3779b1);
  hash = Math.imul(hash ^ ((heatIndex + 1) | 0), 0x85ebca6b);
  hash ^= hash >>> 13;
  return hash | 0;
}
