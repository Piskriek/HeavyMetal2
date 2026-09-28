/**
 * T05 — GO clock standalone tests.
 *
 * Focused tests on the GoClock class and computeFinishOrder, separate from the
 * scheduler integration tests in release-scheduler.test.ts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GoClock, computeFinishOrder } from '../src/game/release/go-clock';
import { FIXED_STEP, ticksForSeconds } from '../src/game/contracts/timing';

describe('GoClock: construction', () => {
  it('creates with a valid goTick', () => {
    const clock = new GoClock({ goTick: 0 });
    assert.equal(clock.elapsedSeconds, 0);
    assert.equal(clock.isSettled, false);
  });

  it('rejects a negative goTick', () => {
    assert.throws(() => new GoClock({ goTick: -1 }));
  });

  it('rejects a non-integer goTick', () => {
    assert.throws(() => new GoClock({ goTick: 1.5 }));
  });
});

describe('GoClock: ticking', () => {
  it('elapsedSeconds increases with ticks', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 300 });
    for (let i = 0; i < 120; i++) clock.tick();
    assert.equal(clock.elapsedSeconds, 1.0);
  });

  it('remainingSeconds decreases with ticks', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 10 });
    assert.equal(clock.remainingSeconds, 10);
    for (let i = 0; i < 120; i++) clock.tick();
    assert.equal(clock.remainingSeconds, 9);
  });

  it('settles at timeout', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 1, participants: [0] });
    for (let i = 0; i < 130; i++) clock.tick();
    assert.equal(clock.isSettled, true);
  });

  it('tick after settle is a no-op', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 1, participants: [0] });
    clock.settle();
    const timedOut = clock.tick();
    assert.equal(timedOut.length, 0);
  });
});

describe('GoClock: finish recording', () => {
  it('records a finish and returns the record', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 300, participants: [0, 1] });
    const record = clock.recordFinish(0, 6000);
    assert.ok(record !== null);
    assert.equal(record!.racerId, 0);
    assert.equal(record!.position, 1);
    assert.equal(record!.raceTimeSeconds, 50);
  });

  it('auto-settles when all participants finish', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 300, participants: [0, 1] });
    clock.recordFinish(0, 6000);
    assert.equal(clock.isSettled, false);
    clock.recordFinish(1, 6600);
    assert.equal(clock.isSettled, true);
  });

  it('state snapshot is frozen', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 300, participants: [0] });
    clock.recordFinish(0, 6000);
    const state = clock.state;
    assert.ok(Object.isFrozen(state));
    assert.ok(Object.isFrozen(state.finishes));
    assert.ok(Object.isFrozen(state.timedOut));
  });

  it('raceTime returns null for unfinished racers', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 300, participants: [0, 1] });
    clock.recordFinish(0, 6000);
    assert.equal(clock.raceTime(0), 50);
    assert.equal(clock.raceTime(1), null);
  });
});

describe('GoClock: timeout detection', () => {
  it('returns timed-out racers on the timeout tick', () => {
    const clock = new GoClock({ goTick: 0, timeoutSeconds: 1, participants: [0, 1, 2] });
    clock.recordFinish(1, 60); // Finished early
    let timedOut: readonly number[] = [];
    for (let i = 0; i < 130; i++) {
      const t = clock.tick();
      if (t.length > 0) timedOut = t;
    }
    assert.deepEqual([...timedOut].sort(), [0, 2]);
  });
});

describe('computeFinishOrder: pure function', () => {
  it('sorts by finish tick ascending', () => {
    const finishes = new Map<number, number>([[0, 7200], [1, 6000], [2, 6600]]);
    const order = computeFinishOrder(finishes, 0);
    assert.equal(order[0].racerId, 1);
    assert.equal(order[1].racerId, 2);
    assert.equal(order[2].racerId, 0);
  });

  it('excludes finishes before the GO tick', () => {
    const finishes = new Map<number, number>([[0, 50], [1, 200]]);
    const order = computeFinishOrder(finishes, 100);
    assert.equal(order.length, 1);
    assert.equal(order[0].racerId, 1);
  });

  it('race time is in seconds', () => {
    const finishes = new Map<number, number>([[0, 600]]);
    const order = computeFinishOrder(finishes, 0);
    // 600 ticks at 120Hz = 5 seconds.
    assert.equal(order[0].raceTimeSeconds, 5.0);
  });

  it('empty finishes returns empty order', () => {
    const order = computeFinishOrder(new Map(), 0);
    assert.equal(order.length, 0);
  });
});
