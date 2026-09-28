/**
 * T04 — shared builders for the qualifying suites.
 *
 * Every suite needs the same three things: a participant, a gate, and a way to run an attempt to its
 * end without hand-writing the tick loop. Keeping them here also keeps the suites independent of each
 * other — each file can be run alone (`node --import tsx --test tests/qualifying-gate.test.ts`).
 */
import { createAirPickups, type AirPickup } from '../../src/game/powerups';
import { createTrackLayout } from '../../src/game/track-layout';
import { LANE_COUNT, LANE_WIDTH, RADIUS, laneZ, loopGeometry, obstacleZ, type Obstacle } from '../../src/game/scene';
import type { CourseId } from '../../src/game/types';
import { DEFAULT_LOADOUT, type Loadout } from '../../src/game/loadouts';
import { QUALIFYING_GATE_ALTITUDE_TOLERANCE, QUALIFYING_GATE_ID, type QualifyingGate } from '../../src/game/contracts/qualifying';
import { QualifyingError } from '../../src/game/qualifying/errors';
import { QualifyingAttempt, type AttemptConfig, type AttemptOutcome } from '../../src/game/qualifying/attempt';
import type { GameCommand } from '../../src/game/contracts/commands';
import type { MysteryRoute } from '../../src/game/qualifying/mystery';
import type { SegmentProvider } from '../../src/game/qualifying/gate';
import type { SimFx } from '../../src/game/sim/context';
import { createQualifyingGate, segmentAtX, type QualifyingGateSpec } from '../../src/game/qualifying/gate';
import { createAttemptRacer, freezeStagedState, type QualifyingParticipant, type StagedState } from '../../src/game/qualifying/field';
import type { Difficulty } from '../../src/game/session';

export const DEFAULT_DEADLINE = 20;

export function makeParticipant(id = 0, overrides: Partial<QualifyingParticipant> = {}): QualifyingParticipant {
  const loadout: Loadout = overrides.loadout ?? DEFAULT_LOADOUT;
  return Object.freeze({
    id,
    name: id === 0 ? 'YOU' : `GOBLIN ${String(id + 1).padStart(2, '0')}`,
    homeLane: 2,
    pace: 1,
    loadout,
    isPlayer: id === 0,
    color: '#f0a15b',
    gridSlot: id,
    ...overrides,
  });
}

export function stagedFor(participant: QualifyingParticipant, lane = participant.homeLane): StagedState {
  const racer = createAttemptRacer({ ...participant, homeLane: lane });
  return freezeStagedState(racer);
}

export interface CourseSetup {
  readonly course: CourseId;
  readonly layout: Obstacle[];
  readonly pickups: AirPickup[];
  readonly gate: QualifyingGateSpec;
}

/** The real course, ready to clone per attempt. */
export function courseSetup(course: CourseId = 'ridge'): CourseSetup {
  const layout = createTrackLayout(course);
  return { course, layout, pickups: createAirPickups(course, layout), gate: createQualifyingGate(course, layout) };
}

/** A gate placed by hand, for scenarios that need an unreachable plane or a loop-sized lane. */
export function manualGate(overrides: Partial<Omit<QualifyingGateSpec, 'id'>> = {}): QualifyingGateSpec {
  // Annotated so the gate's literal `id` does not widen to `string` through the spread.
  const base: Omit<QualifyingGateSpec, 'loop' | 'loopLane' | 'ringRadius' | 'distance'> = {
    id: QUALIFYING_GATE_ID,
    x: 1184.44,
    z: laneZ(2),
    halfWidth: LANE_WIDTH / 2,
    altitude: 0,
    altitudeTolerance: QUALIFYING_GATE_ALTITUDE_TOLERANCE,
    segment: segmentAtX(1184.44),
  };
  const merged = { ...base, ...overrides };
  return Object.freeze({
    ...merged,
    loop: merged.loop ?? { kind: 'loop' as const, x: merged.x + RADIUS, width: 375, height: 322, lane: merged.loopLane ?? 2, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 },
    loopLane: merged.loopLane ?? 2,
    ringRadius: merged.ringRadius ?? loopGeometry({ x: merged.x + RADIUS, height: 322 }, 'ridge').radius,
    distance: merged.distance ?? (merged.x - 190) / 2,
  });
}

/** Everything an `AttemptConfig` needs, with the boring parts defaulted. */
export interface RunAttemptOptions {
  readonly participant?: QualifyingParticipant;
  readonly setup?: CourseSetup;
  readonly layout?: readonly Obstacle[];
  readonly pickups?: readonly AirPickup[];
  readonly gate?: QualifyingGateSpec;
  readonly attempt?: number;
  readonly fieldSize?: number;
  readonly seed?: number;
  readonly control?: 'human' | 'cpu';
  readonly difficulty?: Difficulty;
  readonly deadlineSeconds?: number;
  readonly maxRecoveries?: number;
  readonly staged?: StagedState;
  readonly mystery?: MysteryRoute | null;
  readonly segments?: SegmentProvider;
  readonly fx?: SimFx;
  readonly reducedMotion?: boolean;
  readonly heatIndex?: number;
  readonly maxTicks?: number;
  /** `false` leaves the capsule on the sling, which is how a player who has not pressed anything is modelled. */
  readonly autoLaunch?: boolean | { power: number; angle: number };
  readonly commands?: readonly { readonly tick: number; readonly command: GameCommand }[];
}

export interface AttemptRun {
  readonly attempt: QualifyingAttempt;
  readonly outcome: AttemptOutcome;
  readonly ticks: number;
}

/**
 * Runs one attempt. `autoLaunch: false` leaves the capsule on the sling, which is how the
 * interactive-human tests model a player who has not pressed anything yet.
 */
export function runAttempt(options: RunAttemptOptions = {}): AttemptRun {
  const setup = options.setup ?? courseSetup('ridge');
  const participant = options.participant ?? makeParticipant();
  const config: AttemptConfig = {
    participant,
    fieldSize: options.fieldSize ?? 4,
    course: setup.course,
    gate: options.gate ?? setup.gate,
    layout: options.layout ?? setup.layout,
    pickups: options.pickups ?? setup.pickups,
    attempt: options.attempt ?? 1,
    seed: options.seed ?? 7,
    control: options.control ?? 'cpu',
    difficulty: (options.difficulty ?? 'racer') as Difficulty,
    deadlineSeconds: options.deadlineSeconds ?? DEFAULT_DEADLINE,
    maxRecoveries: options.maxRecoveries,
    staged: options.staged ?? stagedFor(participant),
    mystery: options.mystery ?? null,
    segments: options.segments,
    fx: options.fx,
    reducedMotion: options.reducedMotion,
    heatIndex: options.heatIndex,
  };
  const attempt = new QualifyingAttempt(config);
  const autoLaunch = options.autoLaunch ?? true;
  if (autoLaunch) attempt.launch(typeof autoLaunch === 'object' ? autoLaunch : { power: 0.9, angle: 30 });
  const maxTicks = options.maxTicks ?? Math.ceil((config.deadlineSeconds + 2) * 120);
  let tick = 0;
  for (; tick < maxTicks && !attempt.complete; tick++) {
    for (const entry of options.commands ?? []) if (entry.tick === tick) attempt.send(entry.command);
    attempt.step();
  }
  if (!attempt.complete) {
    // The attempt loop is bounded, so a runaway scenario says so loudly instead of returning a
    // half-finished outcome.
    throw new QualifyingError('E_ATTEMPT_COMPLETE', `The attempt did not finish within ${maxTicks} ticks (phase ${attempt.phase}).`, {
      racerId: participant.id, attempt: config.attempt,
    });
  }
  return { attempt, outcome: attempt.outcome, ticks: tick + 1 };
}

/** A layout whose first loop sits at `loopX`, with everything else optional. */
export function loopLayout(loopX = 1370, loopLane = 2, extra: readonly Obstacle[] = []): Obstacle[] {
  const loop: Obstacle = { kind: 'loop', x: loopX, width: 375, height: 322, lane: loopLane, laneSpan: 1, hit: false, hitAt: -100, hitMask: 0 };
  return [...extra, loop].sort((a, b) => a.x - b.x);
}

export function gapAcrossTrack(x: number, width = 240): Obstacle[] {
  return [{ kind: 'gap', x, width, height: 0, lane: -1, laneSpan: LANE_COUNT, hit: false, hitAt: -100, hitMask: 0 }];
}

/** A breakable bridge the racer can smash before the gate, for the per-attempt mutation tests. */
export function bridgeLayout(x: number, extra: readonly Obstacle[] = []): Obstacle[] {
  const bridge: Obstacle = { kind: 'break_bridge', x, width: 320, height: 40, lane: -1, laneSpan: LANE_COUNT, hit: false, hitAt: -100, hitMask: 0, broken: false, health: 1 };
  return [...extra, bridge].sort((a, b) => a.x - b.x);
}

export const obstacleZOf = (obstacle: Obstacle): number => obstacleZ(obstacle);
