/**
 * T04 — the qualifying session: who attempts, when, and what the heat ends up ranking.
 *
 * The session owns the schedule and nothing else. Every participant gets their own
 * `QualifyingAttempt` — a private clone of the course, one racer, one clock — and the session steps
 * every live attempt exactly once per tick, in field order. That one design decision is what makes
 * three acceptance criteria true at the same time:
 *
 * - **Bounded deployment, never index-linear.** Start times come from `cpuStagingDelay` in the frozen
 *   contract: monotonic in grid slot and capped at 2.5 s for 4, 20, 50 and 100 participants alike.
 *   Nobody waits 35 seconds because of their index.
 * - **A human re-aiming does not freeze the bots.** When the human's attempt ends without a crossing,
 *   their next attempt waits in `awaiting-launch` for input while the session clock keeps advancing and
 *   every CPU attempt keeps stepping on the same tick.
 * - **Fallback results always rank behind valid ones.** Ranking is `rankQualifying` from the contract;
 *   nothing in this file re-sorts it.
 *
 * A participant's heat entry is their first valid crossing or, once they have used every attempt,
 * `retry-exhausted`; each attempt keeps its own cause (`dnf`, `invalid-crossing`, `deadline`) in the
 * report. `settle()` classifies anybody still mid-flight so a heat can always be read.
 *
 * The heat phase machine is deliberately not owned here: `qualifyingCompleteEvent()` returns the exact
 * `HeatEvent` that `transitionHeat` expects, which is how T05 and T06 wrap a heat around this.
 */
import type { Obstacle } from '../scene';
import { createAirPickups, type AirPickup } from '../powerups';
import type { Difficulty } from '../session';
import { createTrackLayout } from '../track-layout';
import type { RaceEvent } from '../contracts/events';
import type { HeatEvent } from '../contracts/heat';
import {
  FALLBACK_ORDER, MAX_STAGING_DELAY, createQualifyingEntry, rankQualifying,
  type FallbackClass, type QualifyingEntry, type RankedQualifyingEntry,
} from '../contracts/qualifying';
import type { CommandVerdict, GameCommand } from '../contracts/commands';
import type { RacerId } from '../contracts/identity';
import { FIXED_STEP, FixedStepClock } from '../contracts/timing';
import { assertRaceConfig, type RaceConfigV1 } from '../contracts/config';
import type { SimFx } from '../sim/context';
import { createRng } from '../rng';
import { QualifyingAttempt, type AttemptConfig, type AttemptOutcome, type AttemptPhase, type AttemptSnapshot } from './attempt';
import { createQualifyingGate, type QualifyingGateSpec, type SegmentProvider } from './gate';
import {
  RETRY_DELAY_SECONDS, attemptSeed, cpuAim, createAttemptRacer, freezeStagedState, launchDelay,
  participantsFromConfig, type LaunchAim, type QualifyingParticipant, type StagedState,
} from './field';
import { createMysteryLedger, type MysteryLedger, type MysteryRoute } from './mystery';
import { QualifyingError } from './errors';

export type SessionStatus = 'staged' | 'running' | 'complete';

/** One session tick is one simulation tick: every live attempt advances exactly once per tick. */
export const SESSION_STEP = FIXED_STEP;
/** Pause before a CPU retries. Bounded and index-independent, like the deployment schedule. */
export const CPU_RETRY_GAP = RETRY_DELAY_SECONDS;

export interface MysterySessionOptions {
  readonly enabled: boolean;
  readonly weights?: Partial<Record<'fuel' | 'shield' | 'bounce', number>>;
}

export interface QualifyingSessionOptions {
  /** A normalized T01 config: participants, course, seed, retry budget and deadline. */
  readonly config: RaceConfigV1;
  readonly difficulty?: Difficulty;
  readonly heatIndex?: number;
  /** Defaults to the real course layout; pass one to qualify on an authored track. */
  readonly layout?: readonly Obstacle[];
  readonly pickups?: readonly AirPickup[];
  readonly gate?: QualifyingGateSpec;
  readonly segments?: SegmentProvider;
  /** Off by default: the mystery route is optional and must never change a run silently. */
  readonly mystery?: boolean | MysterySessionOptions;
  /**
   * `interactive` (default) leaves the human on the sling until they launch — the mode T06 drives.
   * `auto` gives the human entry the same deterministic treatment as a CPU, which is what the
   * headless harness and the reproducibility tests use.
   */
  readonly humanControl?: 'interactive' | 'auto';
  readonly maxRecoveries?: number;
  readonly fx?: SimFx;
  readonly reducedMotion?: boolean;
  /** Grid slots the ranking marks as advanced. Defaults to the whole field. */
  readonly capacity?: number;
}

export interface ParticipantReport {
  readonly racerId: RacerId;
  readonly name: string;
  readonly gridSlot: number;
  readonly isHuman: boolean;
  readonly startAt: number;
  readonly staged: StagedState;
  readonly mystery: MysteryRoute | null;
  readonly attempts: readonly AttemptOutcome[];
  readonly entry: QualifyingEntry | null;
  readonly pending: boolean;
}

export interface ParticipantState {
  readonly racerId: RacerId;
  readonly name: string;
  readonly gridSlot: number;
  readonly control: 'human' | 'cpu';
  readonly startAt: number;
  readonly phase: 'staged' | AttemptPhase;
  readonly attemptsTaken: number;
  readonly nextStartAt: number | null;
  readonly entry: QualifyingEntry | null;
  readonly attempt: AttemptSnapshot | null;
}

export interface SessionSnapshot {
  readonly status: SessionStatus;
  readonly time: number;
  readonly tick: number;
  readonly fieldSize: number;
  readonly completed: number;
  readonly outstanding: number;
  readonly attemptsTaken: number;
  readonly deadlineSeconds: number;
  readonly retries: number;
  readonly mysteryEnabled: boolean;
  readonly mysteryRolls: number;
  readonly gate: { readonly id: string; readonly x: number; readonly lane: number; readonly distance: number };
  readonly participants: readonly ParticipantState[];
}

interface LiveParticipant {
  readonly participant: QualifyingParticipant;
  readonly control: 'human' | 'cpu';
  readonly startAt: number;
  readonly attempts: AttemptOutcome[];
  staged: StagedState;
  aim: LaunchAim | null;
  attempt: QualifyingAttempt | null;
  nextStartAt: number | null;
  entry: QualifyingEntry | null;
}

/**
 * A CPU's launch window for this attempt. Drawn from the *attempt* seed, so a retry re-aims (aiming
 * is input, not a stored benefit) while the mystery reward behind it cannot be re-rolled.
 */
export function cpuLaunchAim(seed: number, racerId: RacerId, attempt: number, difficulty: Difficulty): LaunchAim {
  return cpuAim(createRng(attemptSeed(seed, racerId, attempt)), difficulty);
}

function fallbackRank(classification: 'valid' | FallbackClass): number {
  return classification === 'valid' ? -1 : FALLBACK_ORDER.indexOf(classification);
}

/**
 * The participant-level entry: the first valid crossing, else the least-bad cause among the attempts
 * they took — upgraded to `retry-exhausted` once the whole budget is gone. Rebuilt rather than reused
 * so the heat record and the per-attempt records can disagree on purpose.
 */
export function participantEntry(racerId: RacerId, attempts: readonly AttemptOutcome[], totalAttempts: number): QualifyingEntry {
  const valid = attempts.find((attempt) => attempt.classification === 'valid');
  if (valid) return valid.entry;
  const last = attempts[attempts.length - 1];
  if (!last) {
    return createQualifyingEntry({
      racerId, attempt: 1, status: 'fallback', time: null, speed: 0, peakSpeed: 0, fallback: 'dnf', rewardRolled: false,
    });
  }
  const best = attempts.reduce((carry, attempt) => (fallbackRank(attempt.classification) < fallbackRank(carry.classification) ? attempt : carry), last);
  return createQualifyingEntry({
    racerId,
    attempt: last.attempt,
    status: 'fallback',
    time: null,
    speed: 0,
    peakSpeed: Math.max(0, ...attempts.map((attempt) => attempt.peakSpeed)),
    fallback: attempts.length >= totalAttempts ? 'retry-exhausted' : (best.classification === 'valid' ? 'dnf' : best.classification),
    rewardRolled: attempts.some((attempt) => attempt.entry.rewardRolled),
  });
}

/** A participant who never got to launch still needs a classified record, or the field would read short. */
function unattemptedEntry(racerId: RacerId): AttemptOutcome {
  return Object.freeze({
    racerId, attempt: 1, entry: participantEntry(racerId, [], 1), classification: 'dnf' as const,
    crossing: null, rejections: Object.freeze([]), pickups: Object.freeze([]), ticks: 0, elapsed: 0,
    peakSpeed: 0, peakDisplaySpeed: 0, recoveries: 0, bestDistance: 0, finalLane: 0, reachedFinish: false,
  });
}

export interface QualifyingSession {
  readonly status: SessionStatus;
  readonly time: number;
  readonly tick: number;
  readonly gate: QualifyingGateSpec;
  readonly events: readonly RaceEvent[];
  readonly maxTicks: number;
  /** One session tick: every live attempt advances exactly one fixed step. */
  step(): void;
  /** Real-time style advance; the shared fixed-step clock decides how many ticks that is. */
  advance(deltaSeconds: number): { ticks: number; droppedSeconds: number };
  /** Human input, validated by the attempt's own command gate. */
  send(command: GameCommand): CommandVerdict;
  entries(): readonly QualifyingEntry[];
  ranked(): readonly RankedQualifyingEntry[];
  report(): readonly ParticipantReport[];
  snapshot(): SessionSnapshot;
  qualifyingCompleteEvent(): HeatEvent;
  /** Classifies every unfinished participant as a fallback so a heat can always be read. */
  settle(fallback?: FallbackClass): void;
  /** Runs the heat to its end. Bounded by the schedule and the per-attempt deadline. */
  run(ticks?: number): void;
}

export function createQualifyingSession(options: QualifyingSessionOptions): QualifyingSession {
  const config = assertRaceConfig(options.config);
  const difficulty: Difficulty = options.difficulty ?? 'racer';
  const heatIndex = options.heatIndex ?? 0;
  // Copied when supplied, so a caller cannot mutate an authored layout while the heat is running.
  const layout: Obstacle[] = options.layout ? [...options.layout] : createTrackLayout(config.course);
  const pickups = options.pickups ?? createAirPickups(config.course, layout);
  const gate = options.gate ?? createQualifyingGate(config.course, layout);
  const totalAttempts = Math.max(1, Math.min(10, Math.round(config.qualifying.retries + 1)));
  const deadlineSeconds = config.qualifying.deadlineSeconds;
  const capacity = options.capacity ?? config.participants.length;
  const humanControl = options.humanControl ?? 'interactive';
  const mysteryOptions: MysterySessionOptions = options.mystery === undefined
    ? { enabled: false }
    : typeof options.mystery === 'boolean' ? { enabled: options.mystery } : options.mystery;
  const mystery: MysteryLedger = createMysteryLedger({
    enabled: mysteryOptions.enabled, seed: config.seed, heatIndex, weights: mysteryOptions.weights,
  }, gate);

  const roster = participantsFromConfig(config);
  if (!roster.length) throw new QualifyingError('E_FIELD_EMPTY', 'A qualifying heat needs at least one participant.', { fieldSize: config.fieldSize });
  const participants: LiveParticipant[] = roster.map((participant) => ({
    participant,
    control: participant.isPlayer && humanControl === 'interactive' ? 'human' : 'cpu',
    startAt: launchDelay(participant.gridSlot, config.fieldSize, participant.isPlayer),
    attempts: [],
    staged: freezeStagedState(createAttemptRacer(participant)),
    aim: null,
    attempt: null,
    nextStartAt: null,
    entry: null,
  }));

  const events: RaceEvent[] = [];
  // The session accepts frame-style deltas, so it keeps the contract's fixed-step clock for
  // catch-up: identical input sequences produce identical tick counts, and a long stall is dropped
  // rather than simulated.
  const clock = new FixedStepClock();
  let status: SessionStatus = 'staged';
  let time = 0;
  let tick = 0;
  let attemptsTaken = 0;
  const maxTicks = Math.ceil((MAX_STAGING_DELAY + totalAttempts * (deadlineSeconds + CPU_RETRY_GAP) + 5) / SESSION_STEP);

  const emit = (event: RaceEvent): void => { events.push(event); };

  const entryAttempts = (entry: LiveParticipant): readonly AttemptOutcome[] =>
    entry.attempts.length ? entry.attempts : [unattemptedEntry(entry.participant.id)];

  function rankedNow(): readonly RankedQualifyingEntry[] {
    return rankQualifying(participants.map((entry) => entry.entry ?? participantEntry(entry.participant.id, entryAttempts(entry), totalAttempts)), capacity);
  }

  function startAttempt(entry: LiveParticipant): void {
    // A time trial starts on the gate's own lane unless the participant has deliberately chosen
    // another one on the sling. Without this, a rival staged in lane 0 would lose the heat to
    // geometry rather than to pace, and a 20-racer field would be 19 DNFs.
    const staged = entry.staged.lane === entry.participant.homeLane && entry.aim === null
      ? { ...entry.staged, lane: gate.loopLane, targetLane: gate.loopLane }
      : entry.staged;
    const attemptConfig: AttemptConfig = {
      participant: { ...entry.participant, homeLane: staged.lane },
      aim: entry.aim ?? undefined,
      fieldSize: config.fieldSize,
      course: config.course,
      gate,
      layout,
      pickups,
      attempt: entry.attempts.length + 1,
      seed: config.seed,
      control: entry.control,
      difficulty,
      deadlineSeconds,
      maxRecoveries: options.maxRecoveries,
      // Always the frozen staged record: a retry never inherits what the last attempt banked.
      staged,
      mystery: mystery.routeFor(entry.participant.id),
      segments: options.segments,
      fx: options.fx,
      reducedMotion: options.reducedMotion,
      heatIndex,
      onEvent: emit,
    };
    const attempt = new QualifyingAttempt(attemptConfig);
    if (entry.control === 'cpu') {
      // A CPU's launch window is drawn from its own attempt seed: reproducible, and independent of
      // how many attempts anybody else in the field has taken.
      attempt.launch(cpuLaunchAim(config.seed, entry.participant.id, attemptConfig.attempt, difficulty));
    }
    entry.attempt = attempt;
    entry.nextStartAt = null;
    attemptsTaken++;
  }

  function finishAttempt(entry: LiveParticipant): void {
    const attempt = entry.attempt;
    if (!attempt || !attempt.complete) return;
    entry.attempts.push(attempt.outcome);
    entry.attempt = null;
    // Aiming is input, not an attempt benefit: the sling keeps what the player chose.
    entry.staged = attempt.stagedState;
    entry.aim = attempt.launchAim;
    const last = attempt.outcome;
    // A retry re-aims from the frozen staged state. The failed run's charges, supplies, visited
    // obstacles and banked distance are already gone, because the next attempt is a new attempt.
    if (last.classification === 'valid' || entry.attempts.length >= totalAttempts) {
      entry.entry = participantEntry(entry.participant.id, entry.attempts, totalAttempts);
      return;
    }
    // The human goes straight back to the sling; a CPU waits a bounded moment.
    entry.nextStartAt = entry.control === 'human' ? time : time + CPU_RETRY_GAP;
  }

  function settleHeat(fallback: FallbackClass): void {
    for (const entry of participants) {
      if (entry.entry) continue;
      entry.attempt?.finalize(fallback);
      if (entry.attempt) finishAttempt(entry);
      entry.entry = participantEntry(entry.participant.id, entry.attempts, totalAttempts);
    }
    if (status !== 'complete') {
      status = 'complete';
      emit({ type: 'qualifying-complete', tick, order: Object.freeze(rankedNow().map((entry) => entry.racerId)) });
    }
  }

  function stepOnce(): void {
    if (status === 'complete') return;
    status = 'running';
    tick++;
    time = tick * SESSION_STEP;
    for (const entry of participants) {
      if (entry.entry) continue;
      if (!entry.attempt) {
        if (time < (entry.nextStartAt ?? entry.startAt)) continue;
        startAttempt(entry);
      }
      const attempt = entry.attempt;
      if (!attempt) continue;
      attempt.step();
      if (attempt.complete) finishAttempt(entry);
    }
    if (participants.every((entry) => entry.entry)) {
      status = 'complete';
      emit({ type: 'qualifying-complete', tick, order: Object.freeze(rankedNow().map((entry) => entry.racerId)) });
    }
  }

  function snapshotNow(): SessionSnapshot {
    let completed = 0;
    const states: ParticipantState[] = participants.map((entry) => {
      if (entry.entry) completed++;
      return Object.freeze({
        racerId: entry.participant.id,
        name: entry.participant.name,
        gridSlot: entry.participant.gridSlot,
        control: entry.control,
        startAt: entry.startAt,
        phase: entry.attempt ? entry.attempt.phase : entry.entry ? 'complete' as const : 'staged' as const,
        attemptsTaken: entry.attempts.length,
        nextStartAt: entry.nextStartAt,
        entry: entry.entry,
        attempt: entry.attempt ? entry.attempt.snapshot() : null,
      });
    });
    return Object.freeze({
      status,
      time: Math.round(time * 1000) / 1000,
      tick,
      fieldSize: config.fieldSize,
      completed,
      outstanding: participants.length - completed,
      attemptsTaken,
      deadlineSeconds,
      retries: totalAttempts - 1,
      mysteryEnabled: mysteryOptions.enabled,
      mysteryRolls: mystery.rolls,
      gate: { id: gate.id, x: gate.x, lane: gate.loopLane, distance: Math.round(gate.distance) },
      participants: Object.freeze(states),
    });
  }

  const session: QualifyingSession = {
    get status() { return status; },
    get time() { return time; },
    get tick() { return tick; },
    gate,
    get events() { return Object.freeze([...events]); },
    maxTicks,

    step: stepOnce,

    advance(deltaSeconds: number) {
      const result = clock.advance(deltaSeconds);
      for (let index = 0; index < result.ticks; index++) stepOnce();
      return { ticks: result.ticks, droppedSeconds: result.droppedSeconds };
    },

    send(command: GameCommand): CommandVerdict {
      const human = participants.find((entry) => entry.participant.isPlayer);
      if (!human) throw new QualifyingError('E_NO_HUMAN', 'This heat has no local player, so there is nobody to steer.', { fieldSize: config.fieldSize });
      if (!human.attempt && !human.entry && status !== 'complete' && time >= (human.nextStartAt ?? human.startAt)) {
        // Input arrives between ticks: a player on the sling gets their attempt created on the spot,
        // so aim and lane changes land before the first step rather than one tick late.
        startAttempt(human);
      }
      const attempt = human.attempt;
      if (!attempt) {
        return { ok: false, code: 'E_COMMAND', reason: 'The player is not on an attempt right now.', command };
      }
      return attempt.send(command);
    },

    entries: () => Object.freeze(participants.map((entry) => entry.entry ?? participantEntry(entry.participant.id, entryAttempts(entry), totalAttempts))),

    ranked: rankedNow,

    report: () => Object.freeze(participants.map((entry): ParticipantReport => Object.freeze({
      racerId: entry.participant.id,
      name: entry.participant.name,
      gridSlot: entry.participant.gridSlot,
      isHuman: entry.participant.isPlayer,
      startAt: entry.startAt,
      staged: entry.staged,
      mystery: mystery.routeFor(entry.participant.id),
      attempts: Object.freeze([...entry.attempts]),
      entry: entry.entry,
      pending: !entry.entry,
    }))),

    snapshot: snapshotNow,

    qualifyingCompleteEvent(): HeatEvent {
      return Object.freeze({ type: 'qualifying-complete', order: rankedNow() });
    },

    settle: (fallback: FallbackClass = 'dnf') => settleHeat(fallback),

    run(ticks: number = session.maxTicks) {
      let used = 0;
      while (status !== 'complete' && used < ticks) {
        stepOnce();
        used++;
      }
      if (status !== 'complete') settleHeat('deadline');
    },
  };
  return session;
}
