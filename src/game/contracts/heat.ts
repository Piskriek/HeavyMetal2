/**
 * T01 — heat and participant transitions.
 *
 * A heat is a single staged event: participants are frozen on the grid, they qualify when
 * the field is larger than four, they are released together or by the bounded schedule, they
 * race, they settle, and their results are read. Every other phase change is illegal and
 * returns a typed refusal instead of silently mutating state.
 *
 * `transitionHeat` is pure: the caller's state object is never mutated, and repeating a
 * command is harmless (a second `release` cannot release twice).
 */

import { QUALIFYING_REQUIRED_ABOVE, type FieldSize, type RaceConfigV1 } from './config';
import { ContractError, frozenArray } from './core';
import type { RaceEvent } from './events';
import type { RacerId } from './identity';
import type { QualifyingEntry } from './qualifying';

export const HEAT_PHASES = ['staging', 'qualifying', 'release', 'racing', 'settling', 'results'] as const;
export type HeatPhase = (typeof HEAT_PHASES)[number];

export const INITIAL_HEAT_PHASE: HeatPhase = 'staging';

/** The legal phase graph. Anything absent from this table is a rejected transition. */
export const LEGAL_HEAT_TRANSITIONS: Readonly<Record<HeatPhase, readonly HeatPhase[]>> = Object.freeze({
  staging: frozenArray<HeatPhase>(['staging', 'qualifying', 'release']),
  qualifying: frozenArray<HeatPhase>(['qualifying', 'release']),
  release: frozenArray<HeatPhase>(['release', 'racing']),
  racing: frozenArray<HeatPhase>(['racing', 'settling']),
  settling: frozenArray<HeatPhase>(['settling', 'results']),
  results: frozenArray<HeatPhase>(['staging']),
});

export function canTransitionHeat(from: HeatPhase, to: HeatPhase): boolean {
  return (LEGAL_HEAT_TRANSITIONS[from] ?? []).includes(to);
}

export interface HeatState {
  readonly phase: HeatPhase;
  readonly heatIndex: number;
  readonly fieldSize: FieldSize;
  readonly participants: readonly RacerId[];
  /** Qualifying order from the phase that just closed; empty until qualifying completes. */
  readonly qualifyingOrder: readonly QualifyingEntry[];
  /** True once the field has been released. Release is once-per-heat by construction. */
  readonly released: boolean;
  readonly startedTick: number | null;
  readonly finished: readonly RacerId[];
}

export function createHeatState(config: RaceConfigV1): HeatState {
  return Object.freeze({
    phase: INITIAL_HEAT_PHASE,
    heatIndex: 0,
    fieldSize: config.fieldSize,
    participants: frozenArray(config.participants.map((participant) => participant.id)),
    qualifyingOrder: frozenArray<QualifyingEntry>([]),
    released: false,
    startedTick: null,
    finished: frozenArray<RacerId>([]),
  });
}

export type HeatEvent =
  | { readonly type: 'stage' }
  | { readonly type: 'begin-qualifying' }
  | { readonly type: 'qualifying-complete'; readonly order: readonly QualifyingEntry[] }
  | { readonly type: 'release' }
  | { readonly type: 'race-start'; readonly tick: number }
  | { readonly type: 'racer-finished'; readonly racerId: RacerId }
  | { readonly type: 'settle-complete' }
  | { readonly type: 'results-ready' }
  | { readonly type: 'acknowledge' }
  | { readonly type: 'abort'; readonly reason: string };

export type TransitionOutcome =
  | { readonly ok: true; readonly state: HeatState; readonly events: readonly RaceEvent[]; readonly idempotent: boolean }
  | { readonly ok: false; readonly code: 'E_PHASE_TRANSITION' | 'E_QUALIFYING_DISABLED' | 'E_PARTICIPANTS'; readonly reason: string; readonly state: HeatState };

const refuse = (state: HeatState, code: Extract<TransitionOutcome, { ok: false }>['code'], reason: string): TransitionOutcome =>
  Object.freeze({ ok: false as const, code, reason, state });

const accept = (state: HeatState, events: RaceEvent[], idempotent = false): TransitionOutcome =>
  Object.freeze({ ok: true as const, state, events: frozenArray(events), idempotent });

function phaseChange(state: HeatState, phase: HeatPhase, tick: number, events: RaceEvent[]): HeatState {
  events.push(Object.freeze({ type: 'phase-changed', tick, from: state.phase, to: phase }));
  return Object.freeze({ ...state, phase });
}

export function transitionHeat(state: HeatState, event: HeatEvent, tick = 0): TransitionOutcome {
  switch (event.type) {
    case 'stage': {
      // Re-staging an already staged heat must not double-apply anything.
      if (state.phase !== 'staging') return refuse(state, 'E_PHASE_TRANSITION', `Cannot stage from phase "${state.phase}".`);
      const events: RaceEvent[] = state.heatIndex === 0 && state.startedTick === null
        ? [Object.freeze({ type: 'heat-staged', heatIndex: state.heatIndex, tick })] : [];
      return accept(state, events, events.length === 0);
    }

    case 'begin-qualifying': {
      if (state.phase !== 'staging') return refuse(state, 'E_PHASE_TRANSITION', `Qualifying can only begin from staging, not "${state.phase}".`);
      if (state.fieldSize <= QUALIFYING_REQUIRED_ABOVE) {
        return refuse(state, 'E_QUALIFYING_DISABLED', `A ${state.fieldSize}-racer field does not qualify.`);
      }
      const events: RaceEvent[] = [];
      const next = phaseChange(state, 'qualifying', tick, events);
      for (const racerId of state.participants) {
        events.push(Object.freeze({ type: 'qualifying-begun', heatIndex: state.heatIndex, tick, racerId, attempt: 1 }));
      }
      return accept(next, events);
    }

    case 'qualifying-complete': {
      if (state.phase !== 'qualifying') return refuse(state, 'E_PHASE_TRANSITION', `Qualifying cannot complete from phase "${state.phase}".`);
      const supplied = new Set(event.order.map((entry) => entry.racerId));
      const expected = new Set(state.participants);
      const missing = state.participants.filter((id) => !supplied.has(id));
      const unknown = [...supplied].filter((id) => !expected.has(id));
      if (missing.length || unknown.length || supplied.size !== event.order.length) {
        return refuse(state, 'E_PARTICIPANTS', `Qualifying order does not match the field (missing ${missing.join(',') || 'none'}; unknown ${unknown.join(',') || 'none'}).`);
      }
      const events: RaceEvent[] = [Object.freeze({
        type: 'qualifying-complete', tick, order: frozenArray(event.order.map((entry) => entry.racerId)),
      })];
      const withOrder = Object.freeze({ ...state, qualifyingOrder: frozenArray(event.order) });
      return accept(phaseChange(withOrder, 'release', tick, events), events);
    }

    case 'release': {
      // Release is allowed from staging (small fields skip qualifying) or from qualifying.
      if (state.phase !== 'staging' && state.phase !== 'qualifying' && state.phase !== 'release') {
        return refuse(state, 'E_PHASE_TRANSITION', `Cannot release from phase "${state.phase}".`);
      }
      if (state.released) {
        // Repeating release is harmless: no state change, no second event.
        return accept(state, [], true);
      }
      const events: RaceEvent[] = [Object.freeze({ type: 'released', tick, heatIndex: state.heatIndex })];
      const next = Object.freeze({ ...state, released: true });
      return accept(state.phase === 'release' ? next : phaseChange(next, 'release', tick, events), events);
    }

    case 'race-start': {
      if (state.phase !== 'release') return refuse(state, 'E_PHASE_TRANSITION', `The race can only start from release, not "${state.phase}".`);
      if (!state.released) return refuse(state, 'E_PHASE_TRANSITION', 'The field was never released.');
      const events: RaceEvent[] = [Object.freeze({ type: 'race-started', tick, heatIndex: state.heatIndex })];
      return accept({ ...phaseChange(state, 'racing', tick, events), startedTick: tick }, events);
    }

    case 'racer-finished': {
      if (state.phase !== 'racing') return refuse(state, 'E_PHASE_TRANSITION', `Finishing is only meaningful while racing, not in "${state.phase}".`);
      if (!state.participants.includes(event.racerId)) return refuse(state, 'E_PARTICIPANTS', `Racer ${event.racerId} is not in this heat.`);
      if (state.finished.includes(event.racerId)) return accept(state, [], true);
      const position = state.finished.length + 1;
      const events: RaceEvent[] = [Object.freeze({
        type: 'finished', tick, racerId: event.racerId, position, time: tick / 120,
      })];
      return accept(Object.freeze({ ...state, finished: frozenArray([...state.finished, event.racerId]) }), events);
    }

    case 'settle-complete': {
      if (state.phase !== 'racing') return refuse(state, 'E_PHASE_TRANSITION', `Settling can only begin while racing, not in "${state.phase}".`);
      const events: RaceEvent[] = [Object.freeze({ type: 'settled', tick, heatIndex: state.heatIndex })];
      return accept(phaseChange(state, 'settling', tick, events), events);
    }

    case 'results-ready': {
      if (state.phase !== 'settling') return refuse(state, 'E_PHASE_TRANSITION', `Results can only be read after settling, not in "${state.phase}".`);
      const events: RaceEvent[] = [Object.freeze({ type: 'results-ready', tick, heatIndex: state.heatIndex })];
      return accept(phaseChange(state, 'results', tick, events), events);
    }

    case 'acknowledge': {
      if (state.phase !== 'results') return refuse(state, 'E_PHASE_TRANSITION', `Nothing to acknowledge in phase "${state.phase}".`);
      const events: RaceEvent[] = [];
      return accept(phaseChange(state, 'staging', tick, events), events);
    }

    case 'abort': {
      if (state.phase === 'results') return refuse(state, 'E_PHASE_TRANSITION', 'A read heat cannot be aborted; start the next heat instead.');
      const events: RaceEvent[] = [
        Object.freeze({ type: 'heat-aborted', heatIndex: state.heatIndex, tick, reason: event.reason }),
        Object.freeze({ type: 'phase-changed', tick, from: state.phase, to: 'staging' as HeatPhase }),
      ];
      return accept(Object.freeze({
        ...state, phase: 'staging' as HeatPhase, released: false, qualifyingOrder: frozenArray<QualifyingEntry>([]),
        startedTick: null, finished: frozenArray<RacerId>([]),
      }), events);
    }

    default: {
      const never: never = event;
      throw new ContractError('E_CONTRACT_SHAPE', `Unknown heat event ${JSON.stringify(never)}`);
    }
  }
}

export interface AdvanceHeatOptions {
  /** Racers that continue into the next heat; the rest of the field is refilled from the roster. */
  readonly advancing: readonly RacerId[];
  readonly roster: readonly RacerId[];
  readonly fieldSize: FieldSize;
}

/**
 * Participant transition between heats: keeps the advancing racers in their relative order,
 * refills from the roster, and drops duplicates. Returns a fresh staging state; the previous
 * heat's state object is untouched (no shared arrays).
 */
export function advanceHeat(state: HeatState, options: AdvanceHeatOptions): HeatState {
  const participants: RacerId[] = [];
  const add = (id: RacerId) => {
    if (participants.length >= options.fieldSize) return;
    if (!participants.includes(id)) participants.push(id);
  };
  for (const id of options.advancing) add(id);
  for (const id of options.roster) add(id);
  for (const id of state.participants) add(id);
  return Object.freeze({
    phase: INITIAL_HEAT_PHASE,
    heatIndex: state.heatIndex + 1,
    fieldSize: options.fieldSize,
    participants: frozenArray(participants),
    qualifyingOrder: frozenArray<QualifyingEntry>([]),
    released: false,
    startedTick: null,
    finished: frozenArray<RacerId>([]),
  });
}

/** Convenience guard for callers driving the phase machine from UI code. */
export function assertHeatPhase(state: HeatState, phase: HeatPhase): void {
  if (state.phase !== phase) {
    throw new ContractError('E_PHASE_TRANSITION', `Expected heat phase "${phase}", found "${state.phase}".`, { expected: phase, actual: state.phase });
  }
}
