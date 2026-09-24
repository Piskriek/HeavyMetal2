/**
 * M01 · T3 — the gyro ball (IF-GYRO), as pure numbers.
 *
 * Run with: `node --import tsx --test tests/gyro-ball.test.ts` (also registered in scripts/check.mjs).
 *
 * The shell rolls, the rider does not. These tests pin the four laws that make that true: the roll
 * phase advances without slipping while the ball has grip and coasts (decaying) while it does not;
 * the level pose is identical for every roll phase, so the caps and the rider can never tumble with
 * the shell; and the rolling pose turns about the frame's own right axis by exactly −rollPhase.
 *
 * The renderer consumes the same functions, so a pass here is a pass for the meshes as well — which
 * matters in a sandbox with no WebGL to look at.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AIR_ROLL_DECAY, CAP_RADIUS_SCALE, CAP_THETA, GYRO_RADIUS, TAU,
  advanceRoll, gyroFrameFor, gyroPose, quatAxisAngle, quatMultiply, quatRotate,
  type Quat, type RollState,
} from '../src/game/gyro-ball';
import type { GyroFrame, Vec3 } from '../src/game/first-person';

/**
 * A frame in the track's own convention: `right = forward × up` (three.js's mesh basis, local −Z
 * forward). A downhill run along +X with the road's up vertical gives a right that points at +Z.
 */
const FRAME: GyroFrame = { forward: [1, 0, 0], up: [0, 1, 0], right: [0, 0, 1] };

/** The same construction for a banked, drifting road: heading downhill, rolled to one side. */
function bankedFrame(): GyroFrame {
  const t = normalise([1, -0.15, 0.35]);
  const right = normalise(cross(t, [0, 1, 0]));
  const up = normalise(cross(right, t));
  return { forward: t, up, right };
}
const BANKED = bankedFrame();

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const vecNear = (a: readonly number[], b: readonly number[], eps = 1e-9) => {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(near(a[i], b[i], eps), `${a[i]} !== ${b[i]} (±${eps})`);
};
const length = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);
/** Unit check for a quaternion: all four components, unlike `length`, which is for points. */
const quatLength = (q: Quat) => Math.hypot(q[0], q[1], q[2], q[3]);

test('roll phase grounded law', () => {
  const state: RollState = { rollPhase: 0, rollRate: 0 };
  // Exactly the no-slip law: hypot(vx, vz)·dt / R.
  advanceRoll(state, { vx: 310, vz: 0, grounded: true, inLoop: false }, 1 / 120);
  assert.ok(near(state.rollRate, 310 / GYRO_RADIUS, 1e-12), `rate ${state.rollRate}`);
  assert.ok(near(state.rollPhase, (310 / GYRO_RADIUS) / 120, 1e-12), `phase ${state.rollPhase}`);

  // A loop counts as grip: the shell keeps rolling inside the ring.
  const looping: RollState = { rollPhase: 1, rollRate: 0 };
  advanceRoll(looping, { vx: 0, vz: 0, grounded: false, inLoop: true }, 0.5);
  assert.equal(looping.rollRate, 0, 'a standing ball in a loop has no roll rate');
  const rolling: RollState = { rollPhase: 0, rollRate: 0 };
  advanceRoll(rolling, { vx: 3, vz: 4, grounded: false, inLoop: true }, 1);
  assert.ok(near(rolling.rollRate, 5 / GYRO_RADIUS, 1e-12), 'the rate uses the planar speed');
  assert.ok(near(rolling.rollPhase, 5 / GYRO_RADIUS, 1e-12));

  // The phase wraps into [0, TAU) and never goes negative, however many frames run.
  let wrapped: RollState = { rollPhase: 0, rollRate: 0 };
  for (let tick = 0; tick < 20000; tick++) {
    wrapped = advanceRoll(wrapped, { vx: 1200, vz: 200, grounded: true, inLoop: false }, 1 / 120);
    assert.ok(wrapped.rollPhase >= 0 && wrapped.rollPhase < TAU, `phase ${wrapped.rollPhase} out of range`);
  }
  assert.ok(wrapped.rollPhase > 0, 'the shell really did roll a long way');

  // A negative or missing dt cannot corrupt the phase.
  const guarded: RollState = { rollPhase: 2, rollRate: 5 };
  advanceRoll(guarded, { vx: 100, vz: 0, grounded: true, inLoop: false }, 0);
  assert.equal(guarded.rollPhase, 2, 'a zero step moves nothing');
  const nan: RollState = { rollPhase: Number.NaN, rollRate: 3 };
  advanceRoll(nan, { vx: 100, vz: 0, grounded: true, inLoop: false }, Number.NaN);
  assert.ok(near(nan.rollPhase, 0), 'a NaN phase comes back to a number');
});

test('air decay', () => {
  const state: RollState = { rollPhase: 0.5, rollRate: 30 };
  advanceRoll(state, { vx: 300, vz: 0, grounded: false, inLoop: false }, 0.25);
  assert.ok(near(state.rollRate, 30 * Math.exp(-AIR_ROLL_DECAY * 0.25), 1e-12), `rate ${state.rollRate}`);
  // The phase still coasts on the decaying rate: it does not stop dead in the air.
  assert.ok(state.rollPhase > 0.5, 'the shell keeps turning in flight');

  // Twenty ticks of free fall: the rate is nearly gone but never quite negative.
  const long: RollState = { rollPhase: 0, rollRate: 40 };
  for (let tick = 0; tick < 240; tick++) {
    advanceRoll(long, { vx: 0, vz: 0, grounded: false, inLoop: false }, 1 / 120);
    assert.ok(long.rollRate > 0, 'free spin decays, never reverses');
  }
  assert.ok(long.rollRate < 40 * Math.exp(-AIR_ROLL_DECAY * 2) + 1e-9, 'two seconds of flight kills most of it');
});

test('caps stay level for all phases', () => {
  for (const frame of [FRAME, BANKED]) {
    const reference = gyroPose(0, frame);
    for (let step = 0; step < 72; step++) {
      const phase = (step / 72) * TAU;
      const pose = gyroPose(phase, frame);
      // The level pose does not depend on the roll: that is what keeps the caps and rider upright.
      vecNear(pose.gyro, reference.gyro, 1e-12);
      // And the caps' own axis (local ±X) is the frame's right axis, at every phase.
      vecNear(quatRotate(pose.gyro, [1, 0, 0]), frame.right, 1e-9);
      vecNear(quatRotate(pose.gyro, [0, 1, 0]), frame.up, 1e-9);
      // World up is untouched by the roll: the rider's horizon never tilts.
      vecNear(quatRotate(pose.gyro, [0, 1, 0]), quatRotate(reference.gyro, [0, 1, 0]), 1e-12);
      // The eye line (local −Z, the shell's face) stays on the track's heading.
      vecNear(quatRotate(pose.gyro, [0, 0, -1]), frame.forward, 1e-9);
    }
  }
  // The caps are a little proud of the shell, so they cannot z-fight with it.
  assert.ok(CAP_RADIUS_SCALE > 1.03 && CAP_RADIUS_SCALE < 1.06, `cap scale ${CAP_RADIUS_SCALE}`);
  assert.ok(CAP_THETA > 0.4 && CAP_THETA < 0.9, `cap angular radius ${CAP_THETA}`);
});

test('core rolls about right axis', () => {
  const axis: Vec3 = BANKED.right;
  for (let step = 0; step < 24; step++) {
    const phase = (step / 24) * TAU;
    const pose = gyroPose(phase, BANKED);
    // Roll = rotation of −phase about the frame's right axis, composed onto the level basis.
    vecNear(pose.core, quatMultiply(pose.gyro, quatAxisAngle([1, 0, 0], -phase)), 1e-12);
    // Concretely: a point on the shell that starts on the up axis ends up where rotating the frame's
    // up about its right axis by −phase puts it.
    const expected = rotateAboutAxis(BANKED.up, axis, -phase);
    vecNear(quatRotate(pose.core, [0, 1, 0]), expected, 1e-9);
    // The right axis is the rotation axis, so it does not move.
    vecNear(quatRotate(pose.core, [1, 0, 0]), BANKED.right, 1e-9);
    // And the shell is still a unit quaternion at every phase.
    assert.ok(near(quatLength(pose.core), 1, 1e-12), `core quaternion length ${quatLength(pose.core)}`);
    assert.ok(near(quatLength(pose.gyro), 1, 1e-12), `gyro quaternion length ${quatLength(pose.gyro)}`);
  }
  // Phase 0 is the level pose itself: a rolling ball at rest is not rotated at all.
  vecNear(gyroPose(0, FRAME).core, gyroPose(0, FRAME).gyro, 1e-12);
  // A full turn is the identity rotation again (the quaternion may be negated, which is the same
  // rotation — so compare what the pose *does*, not its four components).
  const afterFullTurn = gyroPose(TAU, FRAME).core;
  const rest = gyroPose(0, FRAME).core;
  for (const probe of [[0, 1, 0], [0, 0, -1], [1, 0, 0]] as Vec3[]) {
    vecNear(quatRotate(afterFullTurn, probe), quatRotate(rest, probe), 1e-9);
  }
});

test('gyro frame: loop, fall and plain track', () => {
  const ball: Vec3 = [0, 0, 0];
  // Plain track: the sample passes through untouched.
  const plain = gyroFrameFor(FRAME, null, ball, false, FRAME);
  vecNear(plain.up, FRAME.up, 1e-12);
  vecNear(plain.forward, FRAME.forward, 1e-12);

  // A loop: up points at the ring's centre, and the frame stays orthonormal and unit length.
  const centre: Vec3 = [0, 120, 40];
  const loop = gyroFrameFor(FRAME, { centre }, ball, false, FRAME);
  vecNear(loop.up, [0, 0.9486832980505138, 0.3162277660168379], 1e-9);
  assert.ok(near(length(loop.forward), 1), 'forward is unit');
  assert.ok(near(dot(loop.forward, loop.up), 0, 1e-9), 'forward is square to up');
  assert.ok(near(length(loop.right), 1), 'right is unit');
  vecNear(cross(loop.forward, loop.up), loop.right, 1e-9);

  // Every angle of the ride: never degenerate, always finite.
  const radius = 300;
  for (let step = 0; step < 360; step++) {
    const angle = (step / 360) * TAU;
    const at: Vec3 = [0, Math.cos(angle) * radius, Math.sin(angle) * radius];
    const heading: Vec3 = [1, -Math.sin(angle), Math.cos(angle)];
    const riding = gyroFrameFor(
      { forward: heading, up: [Math.sin(angle), Math.cos(angle), 0], right: [0, 0, 1] },
      { centre: [0, 0, 0] }, at, false, FRAME,
    );
    for (const v of [riding.forward, riding.up, riding.right]) {
      assert.ok(v.every((n) => Number.isFinite(n)), `non-finite vector at angle ${angle}`);
      assert.ok(near(length(v), 1, 1e-9), `non-unit vector at angle ${angle}`);
    }
    assert.ok(Math.abs(dot(riding.forward, riding.up)) < 1e-9, `degenerate at angle ${angle}`);
  }

  // Falling freezes the frame at the last grounded one.
  const frozen = gyroFrameFor(loop, { centre }, ball, true, FRAME);
  vecNear(frozen.up, FRAME.up, 1e-12);
  vecNear(frozen.forward, FRAME.forward, 1e-12);
});

function normalise(v: readonly number[]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}
function dot(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: readonly number[], b: readonly number[]) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function negate(v: readonly number[]) {
  return [-v[0], -v[1], -v[2]];
}
/** Rodrigues, for the expected core pose. */
function rotateAboutAxis(v: Vec3, axis: Vec3, angle: number): [number, number, number] {
  const k = axis;
  const c = Math.cos(angle); const s = Math.sin(angle);
  const kxv = cross(k, v);
  const kdv = dot(k, v);
  return [
    v[0] * c + kxv[0] * s + k[0] * kdv * (1 - c),
    v[1] * c + kxv[1] * s + k[1] * kdv * (1 - c),
    v[2] * c + kxv[2] * s + k[2] * kdv * (1 - c),
  ];
}
