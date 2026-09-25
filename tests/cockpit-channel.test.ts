/**
 * M01 · T4 — **the gauges are wired to the race.**
 *
 * `tests/cockpit.test.ts` proves the *laws* of the HUD: the needle mapping, the yoke's ±38° lock, the
 * painted aperture, where the goblin's hands sit, the bob. None of that is worth anything if the
 * numbers arriving at the HUD are wrong — and until this suite, the thirteen assignments that fill the
 * channel were a method on `GameEngine`, which cannot exist without WebGL, so nothing checked them at
 * all. An assignment that read a constant, or the wrong field, or a snapshot from an earlier tick,
 * would have looked exactly like a working gauge.
 *
 * `fillCockpitState` is that mapping, pure: telemetry in, channel out. This suite feeds it literals —
 * one per phase a race actually has — and asserts what each gauge would read. It also asserts the two
 * properties the mapping must have beyond correctness: the **same object comes back** (a fresh record
 * per frame is a per-frame allocation in the render path, which the project forbids), and the engine
 * really does call it with the live snapshot (a structural guard, because the engine cannot be
 * constructed here).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VZ_MAX, createCockpitState, fillCockpitState, steerFrom, type CockpitTelemetry,
} from '../src/game/cockpit';

/** A snapshot as the engine would have it, with every field a gauge reads set to something tell-tale. */
function telemetry(overrides: Partial<CockpitTelemetry> = {}): CockpitTelemetry {
  return {
    status: 'flying', speed: 428, boosts: 2, bounces: 1, shieldSeconds: 3.5, grade: 41,
    grounded: true, inLoop: false, position: 3, raceTime: 12.75, merge: null,
    ...overrides,
  };
}

test('every gauge reads its own field, from the tick the physics just stepped', () => {
  const state = createCockpitState();
  const filled = fillCockpitState(state, telemetry(), steerFrom(420, 1));

  assert.equal(filled.speedKmh, 428, 'the speedometer');
  assert.equal(filled.boostCharges, 2, 'the boost dial');
  assert.equal(filled.bounceCharges, 1, 'the bounce dial');
  assert.equal(filled.shieldSeconds, 3.5, 'the shield ring');
  assert.equal(filled.gradePct, 41, 'the grade needle');
  assert.equal(filled.grounded, true, 'the ground lamp');
  assert.equal(filled.inLoop, false, 'the loop lamp');
  assert.equal(filled.status, 'flying');
  assert.equal(filled.position, 3, 'the position read-out');
  assert.equal(filled.raceTime, 12.75, 'the race clock');
  assert.equal(filled.pushing, false, 'not being shoved');
  assert.equal(filled.countdownLabel, null, 'and no centre read-out while racing');
  assert.equal(filled.steer, steerFrom(420, 1), 'the yoke leads the lane change: it is the player\'s own vz');

  // Change the telemetry, change the gauges — nothing is cached between calls.
  const second = fillCockpitState(state, telemetry({ speed: 12, grade: -18, grounded: false, inLoop: true }), 0);
  assert.equal(second.speedKmh, 12);
  assert.equal(second.gradePct, -18, 'a climb reads negative');
  assert.equal(second.grounded, false);
  assert.equal(second.inLoop, true, 'and the loop lamp follows the ride');
});

test('the channel is the same object every frame', () => {
  const state = createCockpitState();
  const first = fillCockpitState(state, telemetry(), 0);
  const second = fillCockpitState(state, telemetry({ speed: 900 }), 0);
  assert.equal(second, first, 'mutated and returned, never re-created: no per-frame allocation');
  assert.equal(state.speedKmh, 900, 'and it is the caller\'s object that carries the numbers');
});

test('the centre gauge belongs to the phase: POOL while queued, the pool\'s own countdown, blank otherwise', () => {
  const state = createCockpitState();

  // Queued at the gate, before the pool has anything to count.
  fillCockpitState(state, telemetry({ status: 'checkpoint', merge: null }), 0);
  assert.equal(state.countdownLabel, 'POOL');

  // Counting down: the pool's label wins over the phase's own.
  fillCockpitState(state, telemetry({ status: 'countdown', merge: { countdownLabel: '3' } }), 0);
  assert.equal(state.countdownLabel, '3');

  // The POOL fallback belongs to the *queued* phase alone. Once the countdown is running the pool
  // speaks for itself, and a pool that has no label to give reads blank rather than "POOL" forever.
  fillCockpitState(state, telemetry({ status: 'countdown', merge: {} }), 0);
  assert.equal(state.countdownLabel, null);
  fillCockpitState(state, telemetry({ status: 'checkpoint', merge: {} }), 0);
  assert.equal(state.countdownLabel, 'POOL', 'queued, with the pool silent: POOL');

  // Racing, finished, paused, loading: the centre is blank.
  for (const status of ['flying', 'finished', 'paused', 'ready', 'loading'] as const) {
    fillCockpitState(state, telemetry({ status, merge: null }), 0);
    assert.equal(state.countdownLabel, null, `${status} has no centre read-out`);
  }

  // …and once the pool is done it stops speaking, even if the phase somehow lags behind it.
  fillCockpitState(state, telemetry({ status: 'flying', merge: { countdownLabel: null } }), 0);
  assert.equal(state.countdownLabel, null);
});

test('the push lamp is the phase, not a separate flag that could get stuck on', () => {
  const state = createCockpitState();
  fillCockpitState(state, telemetry({ status: 'pushing' }), 0);
  assert.equal(state.pushing, true, 'the goblin is shoving');
  fillCockpitState(state, telemetry({ status: 'flying' }), 0);
  assert.equal(state.pushing, false, 'and the lamp goes out with the phase');
  fillCockpitState(state, telemetry({ status: 'pushing' }), 0);
  assert.equal(state.pushing, true, 'back on for a push start');
});

test('the yoke angle is the physics\' own steer, so the hands cannot drift from the ball', () => {
  const state = createCockpitState();
  for (const handling of [0.8, 1, 1.4]) {
    const steer = steerFrom(420, handling);
    fillCockpitState(state, telemetry(), steer);
    assert.equal(state.steer, steer, 'the channel carries exactly what the physics produced');
    assert.ok(Math.abs(state.steer) <= 1, 'and it is −1..1 whatever the handling');
  }

  // The sign law: `steer = vz / (VZ_MAX · handling)`, clamped. steerLeft (A) drives the ball at
  // negative vz (screen-left in both cameras), so it must turn the yoke anticlockwise (negative).
  // The old law had this backwards: in the cockpit the hands turned right when you steered left.
  fillCockpitState(state, telemetry(), steerFrom(-VZ_MAX, 1));
  assert.equal(state.steer, -1, 'steering left is full left lock');
  fillCockpitState(state, telemetry(), steerFrom(VZ_MAX, 1));
  assert.equal(state.steer, 1, 'and steering right is full right lock');
  fillCockpitState(state, telemetry(), steerFrom(0, 1));
  assert.equal(state.steer, 0, 'straight ahead is centred');

  // Handling changes how much lateral speed means full lock, never the sign or the range.
  for (const handling of [0.5, 1, 2]) {
    const lock = steerFrom(VZ_MAX * handling, handling);
    assert.ok(Math.abs(lock - 1) < 1e-9, `full lock at handling ${handling}`);
  }
  assert.equal(steerFrom(100, 0), 0, 'and a nonsense handling is a centred yoke, not a NaN one');
});

test('the wiring: the engine hands the live snapshot to the mapping, every frame', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /fillCockpitState\(state, this\.snapshot, steerFrom\(player\.vz, player\.handling\)\)/,
    'the engine fills the channel from the snapshot it just stepped');
  // No assignment may slip back into the engine: the mapping has exactly one home.
  const assignments = engine.match(/state\.[a-zA-Z]+ = /g) ?? [];
  assert.deepEqual(assignments, [], `the engine assigns no gauge field itself (found ${assignments.join(', ')})`);
});
