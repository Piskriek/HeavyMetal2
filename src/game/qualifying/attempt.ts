/**
 * T04 — one isolated qualifying attempt.
 *
 * An attempt is a single racer, a private copy of the course, and a clock. That is the whole design:
 * because the racer list has exactly one member, the isolation the ticket asks for is structural
 * rather than a pile of special cases. A hidden participant cannot steal a pickup, break a bridge,
 * influence an AI decision or bump anybody, because in this attempt there is nobody else to see:
 *
 * - **obstacles, supplies, timers, visited state and RNG are per attempt.** `cloneLayout` gives the
 *   attempt its own mutable copies and clears every `hit`/`broken`/`collectedBy` flag, so a barrel
 *   blown in one attempt is standing in the next, and a supply a rival took is still there for the
 *   human;
 * - **no bumps and no rival scoring.** `resolveBumps` is a race-only pass, and the CPU driver is
 *   handed `others: []` with `paceTargetX: null`, so a bot cannot chase or lean on a racer that is
 *   not in the run;
 * - **the RNG is its own stream**, seeded from `(session seed, racer ID, attempt)`, so a run is
 *   reproducible and one participant's pinball kick cannot shift another's.
 *
 * The attempt ends one of three ways: a valid swept crossing of the named gate (which wins at once),
 * a crash-out once the recovery budget is spent (`dnf`), or the fixed deadline. Retries are the
 * session's decision, not the attempt's.
 *
 * Launch geometry is the race's: aiming pulls the capsule back on the sling with `AIM_ANCHOR` exactly
 * as `GameEngine.adjustAim` does, and the impulse is the shared `launchVelocity` plus the bounded
 * angle fan. A qualifying time is therefore measured the same way a race lap would be.
 */
import { AIM_ANCHOR, START_X, type Obstacle } from '../scene';
import type { AirPickup } from '../powerups';
import type { CourseId } from '../types';
import type { Difficulty } from '../session';
import type { RaceEvent } from '../contracts/events';
import { createPickupArbiter, type GameplayEffect } from '../contracts/effects';
import {
  createQualifyingEntry, type CrossingRejection, type FallbackClass, type QualifyingEntry,
} from '../contracts/qualifying';
import type { CommandGate, CommandVerdict, GameCommand } from '../contracts/commands';
import { validateCommand } from '../contracts/commands';
import type { RacerId } from '../contracts/identity';
import { FIXED_STEP } from '../contracts/timing';
import { createRng, type Rng } from '../rng';
import { HEADLESS_SIM_FX, PROGRESS_RECOVERY, type RacerStepContext, type SimFx } from '../sim/context';
import { cloneLayout, createSimWorld, type SimWorld } from '../sim/world';
import {
  createStepTrace, performBounce, performBoost, performHop, resetTrace, stepRacer, type RacerStepTrace,
} from '../sim/racer-physics';
import { driveCpu, setLane, type CpuContext } from '../sim/cpu-driver';
import { resolvePickups } from '../sim/pickups';
import type { Racer } from '../racers';
import {
  DEFAULT_SEGMENT_PROVIDER, canonicalSpeed, createQualifyingGate, evaluateCrossing, recordCrossing,
  segmentForStep, speedToDisplay, type GateCrossing, type QualifyingGateSpec, type SegmentProvider,
} from './gate';
import {
  attemptSeed, createAttemptRacer, humanAim, initialDecisionDelay, launchAngleOffset, launchVelocityFor,
  resetToStagedState, type LaunchAim, type QualifyingParticipant, type StagedState,
} from './field';
import { mysteryPickup, recordedResolver, type MysteryRoute } from './mystery';
import { QualifyingError } from './errors';

/** One fixed step — the same tick the race runs at. */
export const ATTEMPT_STEP = FIXED_STEP;
/** Recoveries a single attempt may spend before it is over. */
export const ATTEMPT_MAX_RECOVERIES = 3;
/**
 * How long before the plane the gate lane becomes the objective. Inside the window a CPU holds the
 * lane the gate sits in — a run that collects its way past a missed gate is not a qualifying attempt.
 * Outside it the shared driver keeps scoring lanes on race terms, so bots still hunt pads and dodge
 * barrels. The human is never auto-steered: finding the lane is the player's half of the challenge.
 */
export const GATE_HOLD_SECONDS = 3;

export type AttemptPhase = 'awaiting-launch' | 'running' | 'complete';

export interface AttemptConfig {
  readonly participant: QualifyingParticipant;
  readonly fieldSize: number;
  readonly course: CourseId;
  /** Defaults to the gate derived from `layout`; pass one explicitly to share it across attempts. */
  readonly gate?: QualifyingGateSpec;
  /** The course layout this attempt clones. */
  readonly layout: readonly Obstacle[];
  readonly pickups: readonly AirPickup[];
  /** 1-based attempt number within the participant's retry budget. */
  readonly attempt: number;
  readonly seed: number;
  readonly control: 'human' | 'cpu';
  readonly difficulty: Difficulty;
  readonly deadlineSeconds: number;
  readonly maxRecoveries?: number;
  /** The state frozen on staging. A retry starts from this, never from the failed attempt. */
  readonly staged: StagedState;
  /** Carried across retries: the sling keeps the aim the player last chose. */
  readonly aim?: LaunchAim;
  readonly mystery?: MysteryRoute | null;
  readonly segments?: SegmentProvider;
  readonly fx?: SimFx;
  readonly reducedMotion?: boolean;
  readonly onEvent?: (event: RaceEvent) => void;
  readonly heatIndex?: number;
}

export interface AttemptRejection {
  readonly tick: number;
  readonly reason: CrossingRejection;
  readonly fraction: number;
}

export interface AttemptPickup {
  readonly pickupId: string;
  readonly kind: GameplayEffect;
  readonly fromMystery: boolean;
  readonly tick: number;
  readonly crossingFraction: number;
}

export interface AttemptOutcome {
  readonly racerId: RacerId;
  readonly attempt: number;
  readonly entry: QualifyingEntry;
  /** `valid` when the gate was crossed, otherwise the fallback class that ended the attempt. */
  readonly classification: 'valid' | FallbackClass;
  readonly crossing: GateCrossing | null;
  readonly rejections: readonly AttemptRejection[];
  readonly pickups: readonly AttemptPickup[];
  readonly ticks: number;
  readonly elapsed: number;
  readonly peakSpeed: number;
  readonly peakDisplaySpeed: number;
  readonly recoveries: number;
  readonly bestDistance: number;
  readonly finalLane: number;
  readonly reachedFinish: boolean;
}

export interface AttemptSnapshot {
  readonly racerId: RacerId;
  readonly name: string;
  readonly attempt: number;
  readonly phase: AttemptPhase;
  readonly control: 'human' | 'cpu';
  readonly launched: boolean;
  readonly runTime: number;
  readonly deadlineSeconds: number;
  readonly remaining: number;
  readonly distanceToGate: number;
  readonly gateDistance: number;
  readonly progress: number;
  readonly lane: number;
  readonly targetLane: number;
  readonly speed: number;
  readonly peakSpeed: number;
  readonly boosts: number;
  readonly bounces: number;
  readonly recoveries: number;
  readonly pickups: number;
  readonly classification: 'valid' | FallbackClass | null;
  readonly time: number | null;
}

let mysterySupplySequence = 0;

export class QualifyingAttempt {
  readonly racer: Racer;
  readonly participant: QualifyingParticipant;
  readonly gate: QualifyingGateSpec;
  readonly attempt: number;
  readonly control: 'human' | 'cpu';
  readonly course: CourseId;

  private readonly cfg: AttemptConfig;
  private readonly obstacles: Obstacle[];
  private readonly pickups: AirPickup[];
  private readonly mysterySupply: AirPickup | null;
  private readonly world: SimWorld;
  private readonly rng: Rng;
  private readonly ctx: RacerStepContext;
  private readonly cpuCtx: CpuContext;
  private readonly arbiter = createPickupArbiter();
  private readonly trace: RacerStepTrace = createStepTrace();
  private readonly segments: SegmentProvider;
  private readonly fx: SimFx;
  private readonly eventLog: RaceEvent[] = [];
  private readonly rejections: AttemptRejection[] = [];
  private readonly collected: AttemptPickup[] = [];
  private queued: GameCommand[] = [];

  private phaseValue: AttemptPhase = 'awaiting-launch';
  private stagedValue: StagedState;
  private aim: LaunchAim;
  private runTimeValue = 0;
  private tickValue = 0;
  private peakSpeedValue = 0;
  private recoveriesValue = 0;
  private launched = false;
  private crossingValue: GateCrossing | null = null;
  private outcomeValue: AttemptOutcome | null = null;

  constructor(cfg: AttemptConfig) {
    const host = this;
    this.cfg = cfg;
    this.participant = cfg.participant;
    this.attempt = cfg.attempt;
    this.control = cfg.control;
    this.course = cfg.course;
    this.gate = cfg.gate ?? createQualifyingGate(cfg.course, cfg.layout);
    this.segments = cfg.segments ?? DEFAULT_SEGMENT_PROVIDER;
    this.fx = cfg.fx ?? HEADLESS_SIM_FX;
    this.stagedValue = cfg.staged;
    this.aim = cfg.aim ? humanAim(cfg.aim.power, cfg.aim.angle) : humanAim(0.8, 36);

    // Per-attempt mutable world: everything the racer may change lives in this clone.
    const cloned = cloneLayout(cfg.layout, cfg.pickups);
    this.obstacles = cloned.obstacles;
    this.pickups = cloned.pickups;
    this.mysterySupply = cfg.mystery
      ? mysteryPickup(cfg.mystery, cfg.course, 900_000 + (mysterySupplySequence++ % 90_000))
      : null;
    if (this.mysterySupply) this.pickups.push(this.mysterySupply);
    this.pickups.sort((a, b) => a.x - b.x);

    this.racer = createAttemptRacer(cfg.participant);
    resetToStagedState(this.racer, this.stagedValue);
    this.applyAimPose();
    this.rng = createRng(attemptSeed(cfg.seed, cfg.participant.id, cfg.attempt));
    this.world = createSimWorld(cfg.course, this.obstacles, this.pickups);
    this.ctx = {
      world: this.world,
      fx: this.fx,
      // Qualifying punishes a fall by progress, not by whatever the fall drifted into.
      recovery: PROGRESS_RECOVERY,
      random: () => host.rng.next(),
      get runTime() { return host.runTimeValue; },
      get wallTime() { return host.runTimeValue; },
    };
    this.cpuCtx = {
      step: this.ctx,
      difficulty: cfg.difficulty,
      // The isolation rule, in two lines: a qualifying attempt has nobody else to look at, and
      // nobody to chase.
      others: [],
      paceTargetX: null,
      stagger: () => 0,
    };
  }

  // --- observation ----------------------------------------------------------

  get phase(): AttemptPhase { return this.phaseValue; }
  get complete(): boolean { return this.phaseValue === 'complete'; }
  get tick(): number { return this.tickValue; }
  get runTime(): number { return this.runTimeValue; }
  get events(): readonly RaceEvent[] { return Object.freeze([...this.eventLog]); }
  get stagedState(): StagedState { return this.stagedValue; }
  get launchAim(): LaunchAim { return this.aim; }
  get gateLane(): number { return this.gate.loopLane; }
  get pickupsCollected(): readonly AttemptPickup[] { return Object.freeze([...this.collected]); }

  get outcome(): AttemptOutcome {
    if (!this.outcomeValue) {
      throw new QualifyingError('E_ATTEMPT_COMPLETE', 'The attempt has not finished yet, so it has no outcome.', {
        racerId: this.participant.id, attempt: this.attempt,
      });
    }
    return this.outcomeValue;
  }

  /** Everything a staging screen or results row needs; nothing it may write back. */
  snapshot(): AttemptSnapshot {
    const racer = this.racer;
    const run = this.runTimeValue;
    return Object.freeze({
      racerId: racer.id,
      name: racer.name,
      attempt: this.attempt,
      phase: this.phaseValue,
      control: this.control,
      launched: this.launched,
      runTime: Math.round(run * 1000) / 1000,
      deadlineSeconds: this.cfg.deadlineSeconds,
      remaining: Math.max(0, this.cfg.deadlineSeconds - run),
      distanceToGate: Math.max(0, this.gate.x - racer.x),
      gateDistance: Math.round(this.gate.distance),
      progress: Math.max(0, Math.min(1, (racer.x - START_X) / Math.max(1, this.gate.x - START_X))),
      lane: racer.lane,
      targetLane: racer.targetLane,
      speed: speedToDisplay(canonicalSpeed(racer.vx, racer.vy)),
      peakSpeed: speedToDisplay(this.peakSpeedValue),
      boosts: racer.boosts,
      bounces: racer.bounces,
      recoveries: this.recoveriesValue,
      pickups: this.collected.length,
      classification: this.outcomeValue?.classification ?? null,
      time: this.outcomeValue?.crossing?.time ?? null,
    });
  }

  /** The attempt's own world, for an overlay that draws the isolated run. Read-only in spirit. */
  renderView() {
    const racer = this.racer;
    return Object.freeze({
      x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation,
      falling: racer.falling, inLoop: racer.loopRide !== null, finished: racer.finished,
      obstacles: this.obstacles, pickups: this.pickups,
      gateX: this.gate.x, gateZ: this.gate.z,
    });
  }

  // --- input ----------------------------------------------------------------

  private commandGate(): CommandGate {
    return {
      status: this.phaseValue === 'awaiting-launch' ? 'ready' : this.phaseValue === 'running' ? 'flying' : 'finished',
      phase: 'qualifying',
      inputEnabled: true,
      racerId: this.participant.isPlayer ? this.participant.id : null,
    };
  }

  /**
   * Validates a command against the frozen T01 gate and queues it for this tick. Illegal input is
   * reported and never applied, and a command after the attempt is over is refused rather than
   * silently moving a finished racer.
   */
  send(command: GameCommand): CommandVerdict {
    const verdict = validateCommand(command, this.commandGate());
    if (!verdict.ok) {
      this.emit({ type: 'command-rejected', tick: this.tickValue, command: command.type, code: verdict.code, reason: verdict.reason });
      return verdict;
    }
    if (this.complete) {
      this.emit({ type: 'command-rejected', tick: this.tickValue, command: command.type, code: 'E_COMMAND', reason: 'The attempt is over.' });
      return { ok: false, code: 'E_COMMAND', reason: 'The attempt is over.', command };
    }
    this.queued.push(command);
    return verdict;
  }

  /** Direct aim, for a CPU driver or a test that does not want to model input. */
  setAim(power: number, angle: number): void {
    this.aim = humanAim(power, angle);
    this.applyAimPose();
  }

  /** The race's own pull-back pose: the slingshot band is where the launch starts from. */
  private applyAimPose(): void {
    const angle = this.aim.angle * Math.PI / 180;
    const draw = this.aim.power * AIM_ANCHOR.fullPowerDraw;
    this.racer.x = AIM_ANCHOR.x - Math.cos(angle) * draw;
    this.racer.y = AIM_ANCHOR.y + Math.sin(angle) * draw;
  }

  private applyQueued(): void {
    const commands = this.queued;
    this.queued = [];
    for (const command of commands) {
      switch (command.type) {
        case 'aim': {
          // Aiming is aiming, not an advantage: power and angle persist across retries, and a
          // pre-launch lane request updates the *staged* state so it sticks into the next attempt.
          this.aim = humanAim(command.power, command.angle);
          this.applyAimPose();
          break;
        }
        case 'steer': {
          const lane = Math.max(0, Math.min(3, (this.phaseValue === 'awaiting-launch' ? this.stagedValue.targetLane : this.racer.targetLane) + command.direction));
          if (this.phaseValue === 'awaiting-launch') {
            this.stagedValue = { ...this.stagedValue, lane, targetLane: lane };
            this.racer.lane = lane;
            this.racer.targetLane = lane;
          } else {
            this.racer.targetLane = lane;
            this.racer.lastLaneChange = this.runTimeValue;
          }
          break;
        }
        case 'bounce':
          // The race launches with the bounce key from the grid; qualifying keeps that.
          if (this.phaseValue === 'awaiting-launch') this.launch();
          else performBounce(this.racer, this.ctx);
          break;
        case 'hop':
          // `canHop` inside the shared step is what rejects a mid-air or repeated hop.
          if (this.phaseValue === 'running') performHop(this.racer, this.ctx);
          break;
        case 'boost':
          if (this.phaseValue === 'running') performBoost(this.racer, this.ctx);
          break;
        case 'launch':
          this.launch();
          break;
        default:
          // Pause, restart, teleport and reservations belong to the heat, not to one attempt.
          break;
      }
    }
  }

  /** Leaves the grid. The impulse is the race's own launch, including the bounded angle fan. */
  launch(aim: LaunchAim = this.aim): boolean {
    if (this.phaseValue !== 'awaiting-launch') return false;
    this.aim = humanAim(aim.power, aim.angle);
    this.applyAimPose();
    const offset = launchAngleOffset(this.participant.id, this.participant.gridSlot, this.cfg.fieldSize);
    const velocity = launchVelocityFor(this.racer, this.aim, offset);
    const racer = this.racer;
    racer.vx = velocity.vx;
    racer.vy = velocity.vy;
    racer.launchOrigin = { x: racer.x, y: racer.y };
    Object.assign(racer.previous, { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation });
    // The race staggers first decisions by racer; an attempt keeps the same character, bounded.
    racer.nextDecision = this.control === 'cpu' ? initialDecisionDelay(this.participant.gridSlot, this.cfg.fieldSize) : 0;
    this.launched = true;
    this.phaseValue = 'running';
    this.emit({ type: 'qualifying-begun', heatIndex: this.cfg.heatIndex ?? 0, tick: this.tickValue, racerId: racer.id, attempt: this.attempt });
    this.fx.audio('launch');
    return true;
  }

  /**
   * Ends the attempt on the session's say-so — a heat being finalized while somebody is still
   * aiming, or an abandoned run. Classified as a fallback, ranked behind every valid entry.
   */
  finalize(fallback: FallbackClass): AttemptOutcome {
    if (this.complete) return this.outcome;
    this.finish(fallback);
    return this.outcomeValue!;
  }

  // --- the tick --------------------------------------------------------------

  /** Advances exactly one fixed step. A no-op once the attempt is over. */
  step(): void {
    if (this.complete) return;
    this.tickValue++;
    if (this.phaseValue === 'awaiting-launch') {
      this.applyQueued();
      return;
    }
    this.runTimeValue += ATTEMPT_STEP;
    this.applyQueued();
    const racer = this.racer;
    Object.assign(racer.previous, { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation });
    if (this.control === 'cpu' && this.runTimeValue >= racer.nextDecision) driveCpu(racer, this.cpuCtx);
    if (this.control === 'cpu') this.holdGateLane();

    const from = { x: racer.x, y: racer.y, z: racer.z };
    const segmentFrom = { x: racer.x, loop: racer.loopRide?.obstacle ?? null };
    resetTrace(this.trace);
    stepRacer(racer, this.ctx, ATTEMPT_STEP, this.trace);
    const trace = this.trace;

    // The canonical observation: before obstacle resolution could floor or boost the speed.
    const to = { x: trace.preObstacleX, y: trace.preObstacleY, z: trace.preObstacleZ };
    this.peakSpeedValue = Math.max(this.peakSpeedValue, canonicalSpeed(trace.preObstacleVx, trace.preObstacleVy));
    if (trace.fell) this.emit({ type: 'fell', tick: this.tickValue, racerId: racer.id });

    this.resolveSupplies();

    if (trace.recovered) {
      this.recoveriesValue++;
      this.emit({ type: 'recovered', tick: this.tickValue, racerId: racer.id });
      if (this.recoveriesValue >= (this.cfg.maxRecoveries ?? ATTEMPT_MAX_RECOVERIES)) {
        this.finish('dnf');
        return;
      }
    }

    if (!this.crossingValue) {
      const segment = segmentForStep(this.segments, segmentFrom, { x: to.x, loop: racer.loopRide?.obstacle ?? null });
      const outcome = evaluateCrossing(this.world, this.gate, from, to, segment);
      if (outcome.ok) {
        const crossing = recordCrossing(this.tickValue, outcome, trace.preObstacleVx, trace.preObstacleVy, ATTEMPT_STEP);
        this.crossingValue = crossing;
        this.emit({ type: 'gate-crossed', tick: this.tickValue, racerId: racer.id, attempt: this.attempt, fraction: crossing.fraction, speed: crossing.speed });
        this.finish('valid');
        return;
      }
      // `missed` means the plane was not in this tick's range at all: nothing happened, no rejection.
      if (outcome.reason !== 'missed') {
        this.rejections.push({ tick: this.tickValue, reason: outcome.reason, fraction: outcome.fraction });
        this.emit({ type: 'attempt-rejected', tick: this.tickValue, racerId: racer.id, attempt: this.attempt, reason: outcome.reason });
      }
    }

    if (racer.finished || this.runTimeValue >= this.cfg.deadlineSeconds) {
      // Past the line without the gate, or out of time: an attempt with no time to show for it.
      this.finish(this.rejections.length ? 'invalid-crossing' : 'deadline');
    }
  }

  /**
   * The one qualifying-specific steering rule, applied after the shared driver has had its say. It
   * sets the *target* lane only: the normal steering response still carries the capsule across, and a
   * post-recovery steer lock still delays it, so a badly judged run misses the gate honestly.
   */
  private holdGateLane(): void {
    const racer = this.racer;
    if (this.crossingValue || racer.finished || racer.falling || racer.loopRide) return;
    if (this.runTimeValue < racer.steerLockedUntil) return;
    const timeToGate = (this.gate.x - racer.x) / Math.max(1, racer.vx);
    if (timeToGate > GATE_HOLD_SECONDS || timeToGate < 0) return;
    setLane(racer, this.gate.loopLane, this.runTimeValue);
  }

  private resolveSupplies(): void {
    resolvePickups([this.racer], this.ctx, {
      reducedMotion: this.cfg.reducedMotion === true,
      onClaim: ({ pickup, crossingFraction }) => {
        const mystery = this.cfg.mystery ?? null;
        const fromMystery = mystery !== null && pickup === this.mysterySupply;
        const pickupId = fromMystery ? mystery.id : `supply:${pickup.id}`;
        const claim = this.arbiter.claim({
          pickupId, racerId: this.racer.id, tick: this.tickValue, crossingFraction,
          kind: fromMystery ? 'mystery' : pickup.kind,
        });
        if (claim.status === 'lost-arbitration') {
          this.emit({ type: 'pickup-ignored', tick: this.tickValue, pickupId, racerId: this.racer.id, reason: 'lost-arbitration' });
          return false;
        }
        const resolved = fromMystery ? this.arbiter.resolve(pickupId, recordedResolver(mystery!)) : this.arbiter.resolve(pickupId);
        if (!resolved) return true;
        this.collected.push({ pickupId, kind: resolved.effect, fromMystery: resolved.fromMystery, tick: this.tickValue, crossingFraction });
        this.emit({ type: 'pickup-claimed', tick: this.tickValue, pickupId, racerId: this.racer.id, effect: resolved.effect, fromMystery: resolved.fromMystery });
        return true;
      },
    });
  }

  private finish(classification: 'valid' | FallbackClass): void {
    if (this.phaseValue === 'complete') return;
    this.phaseValue = 'complete';
    const fallback: FallbackClass | null = classification === 'valid' ? null : classification;
    const entry = createQualifyingEntry({
      racerId: this.participant.id,
      attempt: this.attempt,
      status: classification === 'valid' ? 'valid' : 'fallback',
      time: this.crossingValue?.time ?? null,
      // No valid crossing, no gate speed: a fallback entry does not get to borrow the peak speed.
      speed: this.crossingValue?.speed ?? 0,
      peakSpeed: this.peakSpeedValue,
      fallback,
      // The heat reward was rolled for this participant exactly once, before this attempt started.
      rewardRolled: this.cfg.mystery != null,
    });
    if (fallback) this.emit({ type: 'fallback-classified', tick: this.tickValue, racerId: this.participant.id, fallback });
    this.outcomeValue = Object.freeze({
      racerId: this.participant.id,
      attempt: this.attempt,
      entry,
      classification,
      crossing: this.crossingValue,
      rejections: Object.freeze([...this.rejections]),
      pickups: Object.freeze([...this.collected]),
      ticks: this.tickValue,
      elapsed: this.runTimeValue,
      peakSpeed: this.peakSpeedValue,
      peakDisplaySpeed: speedToDisplay(this.peakSpeedValue),
      recoveries: this.recoveriesValue,
      bestDistance: this.racer.distance,
      finalLane: this.racer.lane,
      reachedFinish: this.racer.finished,
    });
    this.fx.refreshHud();
  }

  private emit(event: RaceEvent): void {
    this.eventLog.push(event);
    this.cfg.onEvent?.(event);
  }
}
