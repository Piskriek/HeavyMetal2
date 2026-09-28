/**
 * M01 · T1 — the goblin push start, as pure math.
 *
 * Run with: `node --import tsx --test tests/start-push.test.ts` (also registered in scripts/check.mjs).
 *
 * The push must be reproducible: a replay, a headless attempt and the live engine all have to
 * produce the same launch from the same (pace, seed, racerId), because the acceptance race in
 * `tests/start-zone.test.ts` is measured against exactly this math.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PUSH_SEED, PUSH_BASE_VX, PUSH_SPREAD, PUSH_TICKS,
  applyPushTick, pushDistance, pushRampVx, pushHash01, startPushVelocity,
} from '../src/game/sim/start-push';
import { ContractError } from '../src/game/contracts/core';
import { RACER_DEFINITIONS } from '../src/game/types';
import { createRacers } from '../src/game/racers';
import { FIXED_STEP } from '../src/game/contracts/timing';
import { GROUND, RADIUS, START_DROP, START_PAD_END_X, START_X, courseY } from '../src/game/scene';

test('push velocity is seeded and bounded', () => {
  // Same inputs, same output — every time, on every machine.
  assert.equal(startPushVelocity(1, 0x5eed, 3), startPushVelocity(1, 0x5eed, 3));
  // Different racers get different pushes (the spread is real, not a constant).
  assert.notEqual(startPushVelocity(1, 0x5eed, 0), startPushVelocity(1, 0x5eed, 1));
  // AC-1: across a thousand ids every result stays inside PUSH_BASE_VX · pace · [0.98, 1.02].
  const low = PUSH_BASE_VX * (1 - PUSH_SPREAD / 2);
  const high = PUSH_BASE_VX * (1 + PUSH_SPREAD / 2);
  for (let id = 0; id < 1000; id++) {
    const v = startPushVelocity(1, DEFAULT_PUSH_SEED, id);
    assert.ok(v >= low - 1e-9 && v <= high + 1e-9, `id ${id} push ${v} escaped [${low}, ${high}]`);
    const paced = startPushVelocity(1.015, DEFAULT_PUSH_SEED, id);
    assert.ok(Math.abs(paced - v * 1.015) < 1e-9, 'pace scales the push exactly');
  }
  // The hash itself is a [0, 1) distribution, not a constant and not a coin flip.
  const hash = pushHash01(DEFAULT_PUSH_SEED, 7);
  assert.ok(hash >= 0 && hash < 1);
  assert.notEqual(hash, pushHash01(DEFAULT_PUSH_SEED, 8));
});

test('ramp reaches target on tick 48', () => {
  const target = startPushVelocity(1, DEFAULT_PUSH_SEED, 0);
  assert.equal(pushRampVx(target, PUSH_TICKS), target);
  assert.equal(pushRampVx(target, 1), target / PUSH_TICKS, 'a linear ramp from rest');
  assert.ok(Math.abs(pushRampVx(target, PUSH_TICKS / 2) - target / 2) < 1e-9, 'halfway is half the target');
  // Monotone: no tick ever goes backwards.
  for (let k = 2; k <= PUSH_TICKS; k++) assert.ok(pushRampVx(target, k) > pushRampVx(target, k - 1));
  // The whole push covers less than the flat pad, so the field never starts rolling mid-shove.
  const fastest = startPushVelocity(1.06, DEFAULT_PUSH_SEED, 999);
  assert.ok(pushDistance(fastest, FIXED_STEP) < START_PAD_END_X - START_X,
    `push distance ${pushDistance(fastest, FIXED_STEP)} must fit on the pad`);
});

test('ramp refuses out-of-range ticks', () => {
  for (const tick of [0, -1, PUSH_TICKS + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => pushRampVx(360, tick), (error: unknown) => {
      assert.ok(error instanceof ContractError, `expected a ContractError for tick ${String(tick)}`);
      assert.equal(error.code, 'E_PUSH_TICK');
      assert.match(error.message, /push_tick_range/);
      return true;
    });
  }
  // The boundary ticks are the only legal ones at the ends.
  assert.doesNotThrow(() => pushRampVx(360, 1));
  assert.doesNotThrow(() => pushRampVx(360, PUSH_TICKS));
});

test('push never touches z or targetLane', () => {
  const [racer] = createRacers();
  const original = { ...racer, lane: 3, targetLane: 3, z: 240 };
  const subject = { ...racer, lane: 3, targetLane: 3, z: 240 };
  const target = startPushVelocity(subject.pace, DEFAULT_PUSH_SEED, subject.id);
  for (let k = 1; k <= PUSH_TICKS; k++) applyPushTick(subject, k, target);
  assert.equal(subject.z, 240, 'the push does not steer');
  assert.equal(subject.targetLane, 3, 'the push does not queue a lane change');
  assert.equal(subject.lane, 3);
  assert.equal(subject.vz, 0, 'no lateral velocity is ever imparted');
  assert.equal(subject.vy, 0, 'the pad is flat, so the push never lifts the ball');
  assert.equal(subject.grounded, true);
  assert.equal(subject.vx, target, 'and the ramp ends exactly on the target');
  // Everything else on the racer is untouched — the push is not a teleport.
  assert.equal(subject.x, original.x);
  assert.equal(subject.y, original.y);
  assert.equal(subject.rotation, original.rotation);
  assert.equal(subject.weight, original.weight);
  assert.equal(subject.handling, original.handling);
  // The four legacy definitions all sit inside the accepted engagement window on the pad.
  for (const definition of RACER_DEFINITIONS) {
    const v = startPushVelocity(1, DEFAULT_PUSH_SEED, definition.id);
    assert.ok(v >= 340 && v <= 380, `legacy racer ${definition.name} push ${v}`);
  }
  // And the pad is real: the grid sits between START_DROP and the authored line, one ball radius
  // above the surface, with the flat pad long enough to hold the whole push.
  assert.equal(courseY(START_X), GROUND - START_DROP);
  assert.ok(courseY(START_X) + RADIUS < START_PAD_END_X);
  assert.ok(START_PAD_END_X < START_X + 400);
});
