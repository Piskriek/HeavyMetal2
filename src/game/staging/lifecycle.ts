/**
 * T06 — staging lifecycle state machine.
 *
 * Pure, headless, no DOM. The staging overlay reads this state to decide what to show.
 * The engine reads it to decide when to start the race.
 *
 * States:
 * - `qualifying` — T04 qualifying is running; the overlay shows a progress indicator.
 * - `results` — qualifying finished; the leaderboard is shown, waiting for the user.
 * - `staging` — racers are placed on the grid; orbit bands animate; countdown hasn't started.
 * - `countdown` — the three-second countdown is ticking (derived from simulation ticks).
 * - `released` — the race has started; the overlay fades out.
 * - `paused` — the staging was paused (modal, visibility change, builder).
 * - `retry` — the human is re-aiming; bots keep running, input is restricted.
 *
 * Transitions are refusal-first: illegal transitions return a typed refusal, not a silent no-op.
 */

import { FIXED_STEP, ticksForSeconds } from '../contracts/timing';

export const STAGING_PHASES = [
  'qualifying', 'results', 'staging', 'countdown', 'released', 'paused', 'retry',
] as const;
export type StagingPhase = (typeof STAGING_PHASES)[number];

/** The countdown is exactly three seconds, derived from simulation ticks. */
export const COUNTDOWN_SECONDS = 3;
export const COUNTDOWN_TICKS = ticksForSeconds(COUNTDOWN_SECONDS);

export interface StagingState {
  readonly phase: StagingPhase;
  /** Tick at which the current phase started. */
  readonly phaseStartTick: number;
  /** Current simulation tick. */
  readonly currentTick: number;
  /** Tick at which the countdown will reach zero (only meaningful during `countdown`). */
  readonly countdownEndTick: number | null;
  /** Seconds remaining on the countdown (0 when not in countdown). */
  readonly countdownSeconds: number;
  /** The phase before a pause, so resume restores it. */
  readonly pausedFrom: StagingPhase | null;
  /** Whether the human is currently re-aiming a retry. */
  readonly humanRetrying: boolean;
  /** Reduced-motion flag: no orbit animation, instant countdown. */
  readonly reducedMotion: boolean;
}

export type StagingEvent =
  | { readonly type: 'qualifying-complete' }
  | { readonly type: 'show-results' }
  | { readonly type: 'begin-staging' }
  | { readonly type: 'begin-countdown'; readonly tick: number }
  | { readonly type: 'release'; readonly tick: number }
  | { readonly type: 'pause' }
  | { readonly type: 'resume'; readonly tick: number }
  | { readonly type: 'human-retry-start' }
  | { readonly type: 'human-retry-end' }
  | { readonly type: 'tick'; readonly tick: number }
  | { readonly type: 'destroy' };

export type StagingTransitionResult =
  | { readonly ok: true; readonly state: StagingState }
  | { readonly ok: false; readonly reason: string };

const refuse = (reason: string): StagingTransitionResult =>
  Object.freeze({ ok: false as const, reason });

const accept = (state: StagingState): StagingTransitionResult =>
  Object.freeze({ ok: true as const, state });

export interface CreateStagingOptions {
  readonly reducedMotion?: boolean;
  readonly startTick?: number;
}

export function createStagingState(options: CreateStagingOptions = {}): StagingState {
  return Object.freeze({
    phase: 'qualifying',
    phaseStartTick: options.startTick ?? 0,
    currentTick: options.startTick ?? 0,
    countdownEndTick: null,
    countdownSeconds: COUNTDOWN_SECONDS,
    pausedFrom: null,
    humanRetrying: false,
    reducedMotion: options.reducedMotion ?? false,
  });
}

/**
 * Countdown seconds remaining at a given tick, given the countdown end tick.
 * Always rounds UP so "3…2…1…GO" is never skipped.
 */
export function countdownRemaining(endTick: number, currentTick: number): number {
  if (currentTick >= endTick) return 0;
  const remainingTicks = endTick - currentTick;
  return Math.ceil(remainingTicks * FIXED_STEP);
}

/**
 * The countdown label for the HUD: "3", "2", "1", or "GO!".
 * Derived from ticks so it always agrees with the official clock.
 */
export function countdownLabel(seconds: number): string {
  if (seconds <= 0) return 'GO!';
  return String(Math.min(seconds, COUNTDOWN_SECONDS));
}

export function transitionStaging(state: StagingState, event: StagingEvent): StagingTransitionResult {
  switch (event.type) {
    case 'tick': {
      if (state.phase === 'released' || state.phase === 'paused') {
        return accept(Object.freeze({ ...state, currentTick: event.tick }));
      }
      const next: StagingState = Object.freeze({
        ...state,
        currentTick: event.tick,
        countdownSeconds: state.countdownEndTick !== null
          ? countdownRemaining(state.countdownEndTick, event.tick)
          : state.countdownSeconds,
      });
      // Auto-transition from countdown to released when the countdown reaches zero.
      if (state.phase === 'countdown' && next.countdownSeconds <= 0) {
        return accept(Object.freeze({
          ...next,
          phase: 'released' as const,
          phaseStartTick: event.tick,
          countdownEndTick: null,
          countdownSeconds: 0,
        }));
      }
      return accept(next);
    }

    case 'qualifying-complete': {
      if (state.phase !== 'qualifying') return refuse(`qualifying-complete is only valid during qualifying, not ${state.phase}.`);
      return accept(Object.freeze({ ...state, phase: 'results' as const, phaseStartTick: state.currentTick }));
    }

    case 'show-results': {
      if (state.phase !== 'qualifying' && state.phase !== 'results') {
        return refuse(`show-results is only valid during qualifying or results, not ${state.phase}.`);
      }
      return accept(Object.freeze({ ...state, phase: 'results' as const, phaseStartTick: state.currentTick }));
    }

    case 'begin-staging': {
      if (state.phase !== 'results' && state.phase !== 'staging') {
        return refuse(`begin-staging is only valid from results or staging, not ${state.phase}.`);
      }
      return accept(Object.freeze({
        ...state, phase: 'staging' as const, phaseStartTick: state.currentTick,
        countdownEndTick: null, countdownSeconds: COUNTDOWN_SECONDS,
      }));
    }

    case 'begin-countdown': {
      if (state.phase !== 'staging' && state.phase !== 'countdown') {
        return refuse(`begin-countdown is only valid from staging, not ${state.phase}.`);
      }
      const endTick = event.tick + COUNTDOWN_TICKS;
      return accept(Object.freeze({
        ...state, phase: 'countdown' as const, phaseStartTick: event.tick,
        countdownEndTick: endTick, countdownSeconds: COUNTDOWN_SECONDS,
      }));
    }

    case 'release': {
      if (state.phase !== 'countdown' && state.phase !== 'released') {
        return refuse(`release is only valid during countdown, not ${state.phase}.`);
      }
      return accept(Object.freeze({
        ...state, phase: 'released' as const, phaseStartTick: event.tick,
        countdownEndTick: null, countdownSeconds: 0,
      }));
    }

    case 'pause': {
      if (state.phase === 'paused' || state.phase === 'released') {
        return refuse(`Cannot pause from ${state.phase}.`);
      }
      return accept(Object.freeze({
        ...state, phase: 'paused' as const, pausedFrom: state.phase,
      }));
    }

    case 'resume': {
      if (state.phase !== 'paused') return refuse(`resume is only valid from paused, not ${state.phase}.`);
      const restoreTo = state.pausedFrom ?? 'staging';
      return accept(Object.freeze({
        ...state, phase: restoreTo, phaseStartTick: event.tick, pausedFrom: null,
      }));
    }

    case 'human-retry-start': {
      if (state.phase !== 'staging' && state.phase !== 'retry') {
        return refuse(`human-retry-start is only valid during staging, not ${state.phase}.`);
      }
      return accept(Object.freeze({ ...state, phase: 'retry' as const, humanRetrying: true }));
    }

    case 'human-retry-end': {
      if (state.phase !== 'retry') return refuse(`human-retry-end is only valid during retry, not ${state.phase}.`);
      return accept(Object.freeze({ ...state, phase: 'staging' as const, humanRetrying: false }));
    }

    case 'destroy': {
      return accept(Object.freeze({ ...state, phase: 'released' as const }));
    }

    default: {
      const _exhaustive: never = event;
      return refuse(`Unknown staging event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * True when input commands should be blocked because the human is re-aiming.
 * The qualifying session still steps CPU attempts during retry.
 */
export function isInputGuarded(state: StagingState): boolean {
  return state.phase === 'paused' || state.phase === 'qualifying' || state.phase === 'results';
}

/**
 * True when the countdown is actively ticking (not paused, not finished).
 * The engine uses this to know when to start stepping the release executor.
 */
export function isCountdownActive(state: StagingState): boolean {
  return state.phase === 'countdown';
}
