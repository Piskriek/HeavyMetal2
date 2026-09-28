/**
 * T01 — the headless stepping seam.
 *
 * The contract is deliberately tiny so the existing `GameEngine` can satisfy it later with a
 * thin adapter instead of a rewrite:
 *
 * ```ts
 * interface SimulationAdapter {
 *   reset(seed?: number): void;
 *   tick(index: number, step: number, commands: readonly GameCommand[]): void;
 * }
 * ```
 *
 * Everything the seam needs is plain data and pure logic, so a heat can be stepped in a test
 * process with no DOM, no canvas and no WebGL. `HeatController` wraps the phase machine with
 * an event log; `runHeadless` drives fixed ticks from a frame-delta script.
 */

import { assertRaceConfig, type RaceConfigV1 } from './config';
import { ContractError, frozenArray, isFiniteNumber } from './core';
import type { GameCommand } from './commands';
import type { RaceEvent } from './events';
import {
  advanceHeat, createHeatState, transitionHeat, type AdvanceHeatOptions, type HeatEvent, type HeatPhase, type HeatState,
} from './heat';
import type { RacerId } from './identity';
import { FixedStepClock, TICK_RATE } from './timing';

export interface SimulationAdapter {
  /** Identifies the implementation in logs and replay comparisons. */
  readonly id: string;
  readonly seed: number;
  /** Restores the initial state. Calling it twice in a row is harmless. */
  reset(seed?: number): void;
  /** Advances exactly one fixed step. Never called concurrently. */
  tick(index: number, step: number, commands: readonly GameCommand[]): void;
  /** Optional observation record used to compare two runs tick for tick. */
  observe?(): Readonly<Record<string, number>>;
}

/**
 * A trivial adapter used by the contract tests and available to callers that only need the
 * phase machine. It stores the last tick and counts steps; it simulates no physics.
 */
export function createNullAdapter(seed = 1): SimulationAdapter & { steps: number; lastCommands: readonly GameCommand[]; resetCount: number } {
  let steps = 0;
  let lastCommands: readonly GameCommand[] = frozenArray([]);
  let resetCount = 0;
  return {
    id: 'null-adapter',
    seed,
    get steps() { return steps; },
    get lastCommands() { return lastCommands; },
    get resetCount() { return resetCount; },
    reset() { steps = 0; lastCommands = frozenArray([]); resetCount++; },
    tick(_index, _step, commands) { steps++; lastCommands = commands; },
    observe() { return Object.freeze({ steps }); },
  };
}

export interface HeadlessRunOptions {
  readonly adapter: SimulationAdapter;
  readonly config?: RaceConfigV1;
  /** Explicit frame deltas in seconds; the deterministic driver (tests and replays). */
  readonly frameDeltas?: readonly number[];
  /** Wall-clock style run: `seconds` of frames at `frameDelta` each. */
  readonly seconds?: number;
  readonly frameDelta?: number;
  /** Commands delivered on the tick after each frame is advanced. */
  readonly commandsForFrame?: (frame: number) => readonly GameCommand[];
}

export interface HeadlessRunResult {
  readonly ticks: number;
  readonly frames: number;
  readonly simulatedSeconds: number;
  readonly droppedSeconds: number;
  readonly adapterId: string;
  readonly seed: number;
  readonly observations: readonly Readonly<Record<string, number>>[];
}

/** Deterministic frame-delta script generator; frame pacing can be adversarial on purpose. */
export function frameScript(options: { seconds: number; frameDelta: number; jitter?: readonly number[] }): readonly number[] {
  const { seconds, frameDelta } = options;
  if (!isFiniteNumber(seconds) || seconds < 0 || !isFiniteNumber(frameDelta) || frameDelta <= 0) {
    throw new ContractError('E_TICK', `Frame script needs a positive delta and a non-negative duration (${frameDelta} / ${seconds}).`);
  }
  const frames = Math.max(1, Math.round(seconds / frameDelta));
  const jitter = options.jitter ?? [];
  return frozenArray(Array.from({ length: frames }, (_, index) => frameDelta + (jitter[index % Math.max(1, jitter.length)] ?? 0)));
}

/**
 * Steps the adapter with a fixed-step clock. Returns the tick count so a replay can assert
 * it produced exactly the same numbers.
 */
export function runHeadless(options: HeadlessRunOptions): HeadlessRunResult {
  const clock = new FixedStepClock();
  const deltas = options.frameDeltas
    ?? frameScript({ seconds: options.seconds ?? 1, frameDelta: options.frameDelta ?? 1 / 60 });
  options.adapter.reset(options.config?.seed);

  let droppedSeconds = 0;
  const observations: Readonly<Record<string, number>>[] = [];
  for (let frame = 0; frame < deltas.length; frame++) {
    const advance = clock.advance(deltas[frame]);
    droppedSeconds += advance.droppedSeconds;
    const commands = options.commandsForFrame?.(frame) ?? frozenArray<GameCommand>([]);
    for (let step = 0; step < advance.ticks; step++) {
      options.adapter.tick(clock.elapsedTicks - advance.ticks + step + 1, clock.step, commands);
    }
    if (options.adapter.observe) observations.push(options.adapter.observe());
  }

  return Object.freeze({
    ticks: clock.elapsedTicks,
    frames: deltas.length,
    simulatedSeconds: clock.elapsedTicks * clock.step,
    droppedSeconds,
    adapterId: options.adapter.id,
    seed: options.adapter.seed,
    observations: frozenArray(observations),
  });
}

/**
 * Binds the heat phase machine to an adapter and keeps the event log. Every transition goes
 * through `transitionHeat`, so illegal transitions are refused rather than applied.
 */
export class HeatController {
  private state: HeatState;
  private readonly log: RaceEvent[] = [];
  private tick = 0;

  constructor(readonly config: RaceConfigV1, private readonly adapter: SimulationAdapter = createNullAdapter(config.seed)) {
    this.state = createHeatState(assertRaceConfig(config));
  }

  get phase(): HeatPhase { return this.state.phase; }
  get heat(): HeatState { return this.state; }
  get events(): readonly RaceEvent[] { return frozenArray(this.log); }
  get currentTick(): number { return this.tick; }

  /** Applies one heat event. A refusal changes nothing and is returned to the caller. */
  send(event: HeatEvent): ReturnType<typeof transitionHeat> {
    const outcome = transitionHeat(this.state, event, this.tick);
    if (outcome.ok) {
      this.state = outcome.state;
      this.log.push(...outcome.events);
    } else {
      this.log.push(Object.freeze({ type: 'command-rejected', tick: this.tick, command: event.type, code: outcome.code, reason: outcome.reason }));
    }
    return outcome;
  }

  advance(options: AdvanceHeatOptions): HeatState {
    this.state = advanceHeat(this.state, options);
    return this.state;
  }

  /** Steps the adapter for `ticks` fixed steps, keeping the controller clock in sync. */
  step(ticks: number, commands: readonly GameCommand[] = frozenArray<GameCommand>([])): number {
    if (!Number.isInteger(ticks) || ticks < 0) {
      throw new ContractError('E_TICK', `Step count ${String(ticks)} must be a non-negative integer.`);
    }
    for (let index = 0; index < ticks; index++) {
      this.tick += 1;
      this.adapter.tick(this.tick, 1 / TICK_RATE, commands);
    }
    return this.tick;
  }

  finish(racerId: RacerId) { return this.send({ type: 'racer-finished', racerId }); }
}
