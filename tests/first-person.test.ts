/**
 * M01 · T0/T3 — the first-person camera frame.
 *
 * These are the T3 acceptance tests (AC-1..AC-3), written now because the pure function they cover
 * ships with the T0 spike. Nothing here needs WebGL: the camera composition is arithmetic, and the
 * renderer only copies its output.
 *
 * Run with: node --import tsx --test tests/first-person.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FP_DEGENERATE_DOT, FP_EYE_FORWARD, FP_EYE_HEIGHT, FP_FAR, FP_FOV, FP_NEAR,
  firstPersonFrame, firstPersonFlag, type GyroFrame, type Vec3,
} from '../src/game/first-person';

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: Vec3): Vec3 => scale(a, 1 / len(a));

/** A deterministic LCG so the fuzz test is reproducible. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('straight grounded descent: the eye sits one height and one nudge forward of the ball', () => {
  const up: Vec3 = [0, 1, 0];
  const forward: Vec3 = [0, 0, 1];
  const right: Vec3 = [-1, 0, 0];
  const gyro: GyroFrame = { forward, up, right };
  const ballCentre: Vec3 = [100, 200, 300];
  // Look well ahead, slightly down the hill, so the view is nowhere near the up axis.
  const lookPoint: Vec3 = [100, 170, 1300];

  const frame = firstPersonFrame({
    ballCentre, gyro, lookPoint, previousUp: null, dt: 1 / 60, falling: false,
  });

  const expected = add(add(ballCentre, scale(up, FP_EYE_HEIGHT)), scale(forward, FP_EYE_FORWARD));
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(frame.position[axis] - expected[axis]) < 1e-9,
      `position[${axis}] = ${frame.position[axis]} vs ${expected[axis]}`);
  }
  assert.equal(frame.degenerate, false);
  assert.ok(Math.abs(dot(frame.forward, frame.up)) < 1e-12, 'forward is perpendicular to up');
  assert.ok(Math.abs(len(frame.forward) - 1) < 1e-12, 'forward is unit length');
  assert.ok(Math.abs(len(frame.up) - 1) < 1e-12, 'up is unit length');
  assert.ok(Math.abs(dot(frame.right, frame.forward)) < 1e-12, 'right is perpendicular to forward');
  assert.deepEqual([frame.fov, frame.near, frame.far], [FP_FOV, FP_NEAR, FP_FAR]);
});

test('loop sweep: the frame goes head over heels and never degenerates', () => {
  const centre: Vec3 = [0, 0, 0];
  const radius = 114.56;
  let previousUp: Vec3 | null = null;
  let degenerate = 0;
  for (let step = 0; step < 360; step++) {
    const angle = (step / 360) * Math.PI * 2;
    // The ball rides the inside of the loop: its up points at the loop centre.
    const ballCentre: Vec3 = [centre[0] + Math.sin(angle) * radius, centre[1] + Math.cos(angle) * radius, centre[2]];
    const up = unit([centre[0] - ballCentre[0], centre[1] - ballCentre[1], 0]);
    const forward: Vec3 = [0, 0, 1];
    const right = unit([forward[1] * up[2] - forward[2] * up[1], forward[2] * up[0] - forward[0] * up[2], forward[0] * up[1] - forward[1] * up[0]]);
    // The look point is a spline sample ahead: it does not ride the loop, so the view sweeps past
    // the up axis twice per revolution — exactly what the degeneracy guard exists for.
    const lookPoint: Vec3 = [0, 0, 520];
    const frame = firstPersonFrame({
      ballCentre, gyro: { forward, up, right }, lookPoint, previousUp, dt: 1 / 60, falling: false,
    });
    previousUp = frame.up;
    for (const vector of [frame.position, frame.forward, frame.up, frame.right]) {
      assert.ok(vector.every((value) => Number.isFinite(value)), `finite at step ${step}`);
    }
    assert.ok(Math.abs(len(frame.up) - 1) < 1e-12);
    assert.ok(Math.abs(len(frame.forward) - 1) < 1e-12);
    assert.ok(Math.abs(dot(frame.forward, frame.up)) < 1e-12, `orthonormal at step ${step}`);
    if (frame.degenerate) degenerate++;
  }
  assert.ok(degenerate < 360, 'the guard must not be permanently engaged');

  // The guard's real trigger: a view that points nearly straight along the up axis. Both the
  // straight-up and the straight-down case must still return a usable, orthonormal frame.
  for (const sign of [1, -1]) {
    const ballCentre: Vec3 = [0, 0, 0];
    const up: Vec3 = [0, 1, 0];
    const frame = firstPersonFrame({
      ballCentre,
      gyro: { forward: [0, 0, 1], up, right: [-1, 0, 0] },
      lookPoint: [0, sign * 500, 0],
      previousUp: null,
      dt: 1 / 60,
      falling: false,
    });
    assert.equal(frame.degenerate, true, `guard engages for a view along up (sign ${sign})`);
    assert.ok(frame.forward.every((value) => Number.isFinite(value)));
    assert.ok(Math.abs(dot(frame.forward, frame.up)) < 1e-9, 'the guarded frame is still orthonormal');
    assert.ok(Math.abs(len(frame.forward) - 1) < 1e-9);
  }
});

test('fuzz: 10 000 hostile inputs stay finite and orthonormal', () => {
  const random = lcg(0xC0FFEE);
  const span = (min: number, max: number) => min + (max - min) * random();
  let degenerate = 0;
  let upSmoothed = 0;
  let previousUp: Vec3 | null = null;
  for (let i = 0; i < 10000; i++) {
    const gyro: GyroFrame = {
      forward: unit([span(-1, 1), span(-1, 1), span(-1, 1)]),
      up: unit([span(-1, 1), span(-1, 1), span(-1, 1)]),
      right: unit([span(-1, 1), span(-1, 1), span(-1, 1)]),
    };
    const ballCentre: Vec3 = [span(-1e6, 1e6), span(-1e6, 1e6), span(-1e6, 1e6)];
    const lookPoint: Vec3 = add(ballCentre, [span(-900, 900), span(-900, 900), span(-900, 900)]);
    const frame = firstPersonFrame({
      ballCentre, gyro, lookPoint, previousUp, dt: span(0, 0.1), falling: random() < 0.2,
    });
    previousUp = frame.up;
    if (frame.degenerate) degenerate++;
    if (len(frame.up) > 0 && Math.abs(len(frame.up) - 1) < 1e-12) upSmoothed++;
    for (const vector of [frame.position, frame.forward, frame.up, frame.right]) {
      assert.ok(vector.every((value) => Number.isFinite(value)), `finite at iteration ${i}`);
    }
    assert.ok(Math.abs(len(frame.up) - 1) < 1e-9, `up unit length at ${i}`);
    assert.ok(Math.abs(len(frame.forward) - 1) < 1e-9, `forward unit length at ${i}`);
    assert.ok(Math.abs(dot(frame.forward, frame.up)) < 1e-9, `orthonormal at ${i}`);
    assert.ok(Math.abs(dot(frame.forward, frame.up)) <= FP_DEGENERATE_DOT + 1e-9, `never parallel at ${i}`);
  }
  assert.ok(upSmoothed === 10000, 'every fuzzed frame produced a usable basis');
  assert.ok(degenerate > 0, 'the fuzz corpus does exercise the guard');
});

test('falling freezes the frame instead of smoothing through it', () => {
  const previousUp: Vec3 = [0, 1, 0];
  const gyroUp = unit([1, 0, 0]);
  const base = {
    ballCentre: [0, 100, 0] as Vec3,
    gyro: { forward: [0, 0, 1] as Vec3, up: gyroUp, right: [0, -1, 0] as Vec3 },
    lookPoint: [0, 60, 900] as Vec3,
    previousUp,
    dt: 1 / 60,
  };
  const falling = firstPersonFrame({ ...base, falling: true });
  assert.deepEqual(falling.up, gyroUp, 'a frozen frame never blends the previous up');

  const grounded = firstPersonFrame({ ...base, falling: false });
  assert.ok(grounded.up[0] < 1, 'a grounded frame does blend toward the new up');
  assert.ok(grounded.up[0] > 0, 'and it moves toward it, not past it');
});

test('the ?fp=1 flag is read narrowly', () => {
  assert.equal(firstPersonFlag('?fp=1'), true);
  assert.equal(firstPersonFlag('?fp'), true);
  assert.equal(firstPersonFlag('?debug=1&fp=true'), true);
  assert.equal(firstPersonFlag(''), false);
  assert.equal(firstPersonFlag('?fp=0'), false);
  assert.equal(firstPersonFlag('?fpx=1'), false);
});
