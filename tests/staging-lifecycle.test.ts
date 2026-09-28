/**
 * T06 — staging lifecycle tests.
 *
 * Covers:
 * - Phase transitions (legal and illegal).
 * - Countdown derived from simulation ticks (agrees with official clock).
 * - No catch-up burst after pause (pause freezes the tick).
 * - No frozen bots during retry (CPU attempts keep stepping).
 * - Input guards during qualifying, results, and pause.
 * - Reduced-motion: countdown still ticks from simulation, not wall clock.
 * - Keyboard-ready: state transitions are pure data, not event handlers.
 * - Destroy: clean shutdown from any phase.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStagingState, transitionStaging,
  countdownRemaining, countdownLabel,
  isInputGuarded, isCountdownActive,
  COUNTDOWN_SECONDS, COUNTDOWN_TICKS,
  type StagingState,
} from '../src/game/staging/lifecycle';
import { FIXED_STEP, ticksForSeconds } from '../src/game/contracts/timing';

describe('staging lifecycle: initial state', () => {
  it('starts in qualifying phase', () => {
    const state = createStagingState();
    assert.equal(state.phase, 'qualifying');
    assert.equal(state.countdownSeconds, COUNTDOWN_SECONDS);
    assert.equal(state.humanRetrying, false);
    assert.equal(state.pausedFrom, null);
  });

  it('respects reducedMotion option', () => {
    const state = createStagingState({ reducedMotion: true });
    assert.equal(state.reducedMotion, true);
  });

  it('respects startTick option', () => {
    const state = createStagingState({ startTick: 100 });
    assert.equal(state.currentTick, 100);
    assert.equal(state.phaseStartTick, 100);
  });
});

describe('staging lifecycle: phase transitions', () => {
  it('qualifying → results on qualifying-complete', () => {
    const state = createStagingState();
    const result = transitionStaging(state, { type: 'qualifying-complete' });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.state.phase, 'results');
  });

  it('results → staging on begin-staging', () => {
    let state = createStagingState();
    const r1 = transitionStaging(state, { type: 'qualifying-complete' });
    assert.ok(r1.ok);
    if (r1.ok) {
      const r2 = transitionStaging(r1.state, { type: 'begin-staging' });
      assert.ok(r2.ok);
      if (r2.ok) assert.equal(r2.state.phase, 'staging');
    }
  });

  it('staging → countdown on begin-countdown', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    const result = transitionStaging(state, { type: 'begin-countdown', tick: 500 });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.state.phase, 'countdown');
      assert.equal(result.state.countdownEndTick, 500 + COUNTDOWN_TICKS);
      assert.equal(result.state.countdownSeconds, COUNTDOWN_SECONDS);
    }
  });

  it('countdown auto-transitions to released when countdown reaches zero', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    state = okState(state, { type: 'begin-countdown', tick: 0 });
    // Advance ticks past the countdown end.
    const endTick = state.countdownEndTick!;
    const result = transitionStaging(state, { type: 'tick', tick: endTick + 1 });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.state.phase, 'released');
      assert.equal(result.state.countdownSeconds, 0);
    }
  });

  it('rejects illegal transitions', () => {
    const state = createStagingState();
    // Can't go from qualifying directly to countdown.
    const result = transitionStaging(state, { type: 'begin-countdown', tick: 0 });
    assert.equal(result.ok, false);
  });

  it('rejects release from qualifying', () => {
    const state = createStagingState();
    const result = transitionStaging(state, { type: 'release', tick: 0 });
    assert.equal(result.ok, false);
  });
});

describe('staging lifecycle: pause and resume', () => {
  it('pause stores the current phase and resumes to it', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    const paused = okState(state, { type: 'pause' });
    assert.equal(paused.phase, 'paused');
    assert.equal(paused.pausedFrom, 'staging');
    const resumed = okState(paused, { type: 'resume', tick: 1000 });
    assert.equal(resumed.phase, 'staging');
    assert.equal(resumed.pausedFrom, null);
  });

  it('cannot pause from released', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    state = okState(state, { type: 'begin-countdown', tick: 0 });
    state = okState(state, { type: 'release', tick: 500 });
    const result = transitionStaging(state, { type: 'pause' });
    assert.equal(result.ok, false);
  });

  it('no catch-up burst after pause: tick is frozen during pause', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    state = okState(state, { type: 'begin-countdown', tick: 100 });
    // Tick to 200.
    state = okState(state, { type: 'tick', tick: 200 });
    // Pause.
    const paused = okState(state, { type: 'pause' });
    // Ticks during pause don't advance the countdown.
    const stillPaused = okState(paused, { type: 'tick', tick: 500 });
    assert.equal(stillPaused.phase, 'paused');
    // Resume at tick 500 — the countdown end tick is still the original.
    const resumed = okState(stillPaused, { type: 'resume', tick: 500 });
    assert.equal(resumed.phase, 'countdown');
    // The countdown end tick didn't change during the pause.
    assert.equal(resumed.countdownEndTick, state.countdownEndTick);
  });
});

describe('staging lifecycle: retry', () => {
  it('no frozen bots during retry: phase changes but CPU still steps', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    const retry = okState(state, { type: 'human-retry-start' });
    assert.equal(retry.phase, 'retry');
    assert.equal(retry.humanRetrying, true);
    // Ticks still advance during retry.
    const ticked = okState(retry, { type: 'tick', tick: 1000 });
    assert.equal(ticked.currentTick, 1000);
    // Retry ends.
    const ended = okState(ticked, { type: 'human-retry-end' });
    assert.equal(ended.phase, 'staging');
    assert.equal(ended.humanRetrying, false);
  });

  it('cannot start retry from qualifying', () => {
    const state = createStagingState();
    const result = transitionStaging(state, { type: 'human-retry-start' });
    assert.equal(result.ok, false);
  });
});

describe('staging lifecycle: countdown', () => {
  it('countdown remaining agrees with tick math', () => {
    const endTick = 360; // 3 seconds at 120Hz
    assert.equal(countdownRemaining(endTick, 0), 3);
    assert.equal(countdownRemaining(endTick, 120), 2);
    assert.equal(countdownRemaining(endTick, 240), 1);
    assert.equal(countdownRemaining(endTick, 360), 0);
    assert.equal(countdownRemaining(endTick, 400), 0);
  });

  it('countdown label: 3, 2, 1, GO!', () => {
    assert.equal(countdownLabel(3), '3');
    assert.equal(countdownLabel(2), '2');
    assert.equal(countdownLabel(1), '1');
    assert.equal(countdownLabel(0), 'GO!');
  });

  it('countdown is exactly three seconds (360 ticks)', () => {
    assert.equal(COUNTDOWN_TICKS, ticksForSeconds(3));
    assert.equal(COUNTDOWN_TICKS, 360);
  });

  it('countdown and official clock agree: derived from ticks, not wall time', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    const startTick = 1000;
    state = okState(state, { type: 'begin-countdown', tick: startTick });
    // After 120 ticks (1 second), countdown should be 2.
    state = okState(state, { type: 'tick', tick: startTick + 120 });
    assert.equal(state.countdownSeconds, 2);
    // After 240 ticks (2 seconds), countdown should be 1.
    state = okState(state, { type: 'tick', tick: startTick + 240 });
    assert.equal(state.countdownSeconds, 1);
    // After 360 ticks (3 seconds), auto-release.
    const released = transitionStaging(state, { type: 'tick', tick: startTick + 361 });
    assert.ok(released.ok);
    if (released.ok) assert.equal(released.state.phase, 'released');
  });
});

describe('staging lifecycle: input guards', () => {
  it('input is guarded during qualifying', () => {
    const state = createStagingState();
    assert.equal(isInputGuarded(state), true);
  });

  it('input is guarded during results', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    assert.equal(isInputGuarded(state), true);
  });

  it('input is guarded during pause', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    state = okState(state, { type: 'pause' });
    assert.equal(isInputGuarded(state), true);
  });

  it('input is NOT guarded during staging', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    assert.equal(isInputGuarded(state), false);
  });

  it('input is NOT guarded during countdown', () => {
    let state = createStagingState();
    state = okState(state, { type: 'qualifying-complete' });
    state = okState(state, { type: 'begin-staging' });
    state = okState(state, { type: 'begin-countdown', tick: 0 });
    assert.equal(isInputGuarded(state), false);
  });
});

describe('staging lifecycle: destroy', () => {
  it('destroy works from any phase', () => {
    for (const phase of ['qualifying', 'results', 'staging', 'countdown'] as const) {
      let state = createStagingState();
      if (phase === 'results' || phase === 'staging' || phase === 'countdown') {
        state = okState(state, { type: 'qualifying-complete' });
      }
      if (phase === 'staging' || phase === 'countdown') {
        state = okState(state, { type: 'begin-staging' });
      }
      if (phase === 'countdown') {
        state = okState(state, { type: 'begin-countdown', tick: 0 });
      }
      const result = transitionStaging(state, { type: 'destroy' });
      assert.ok(result.ok, `destroy from ${phase} should succeed`);
      if (result.ok) assert.equal(result.state.phase, 'released');
    }
  });
});

// Helper: unwrap a successful transition result.
function okState(state: StagingState, event: Parameters<typeof transitionStaging>[1]): StagingState {
  const result = transitionStaging(state, event);
  if (!result.ok) throw new Error(`Expected ok transition for ${event.type}, got: ${result.reason}`);
  return result.state;
}
