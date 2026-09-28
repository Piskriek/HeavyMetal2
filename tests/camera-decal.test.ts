/**
 * TICKET-07 contracts: ball-chase camera math, off-screen edge pointer geometry,
 * and the airborne ground-decal equations.
 * Run with: node scripts/check.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_OPTIONS } from '../src/game/types';
import { AIRBORNE_CEILING, FINISH, GROUND, decalOpacity, decalRadius } from '../src/game/scene';
import { CAMERA_HEADROOM, RangeCamera, chaseLerp, clampCameraTarget, edgeAnchor } from '../src/game/projection';

const WIDTH = 1440;
const HEIGHT = 620;

test('follow ball is the default camera mode', () => {
  // M01 · T3: the game is built for the cockpit, so first person is the default view.
  assert.equal(DEFAULT_OPTIONS.cameraMode, 'first_person');
});

test('ball chase smoothing is the frame-rate independent lerp(camX, ballX, dt * 6)', () => {
  const step = chaseLerp(0, 300, 6, 1 / 60);
  assert.ok(Math.abs(step - 300 * (1 - Math.exp(-0.1))) < 1e-9);
  assert.ok(step > 300 * 0.06 && step < 300 * 0.14, `one 60fps frame moves ~6% of the gap, got ${step}`);
  assert.equal(chaseLerp(300, 300, 6, 0.5), 300);
  assert.equal(chaseLerp(100, 200, 6, 0), 100, 'no time means no movement');
});

test('camera target is soft-clamped inside the rendered track', () => {
  assert.equal(clampCameraTarget(-500), 0, 'never behind the launch pad');
  assert.equal(clampCameraTarget(FINISH), FINISH - CAMERA_HEADROOM, 'never past the stadium');
  const view = new RangeCamera();
  view.configure(WIDTH, 0, true, 0, 'follow_ball');
  view.configure(WIDTH, clampCameraTarget(view.followOffset(FINISH + 4000, 0)), true, 0, 'follow_ball');
  assert.ok(view.project(FINISH, GROUND, 0).x <= WIDTH, 'finish line stays on screen at the clamp');
});

test('follow offset frames the ball inside the central 60% band', () => {
  const view = new RangeCamera();
  view.configure(WIDTH, 0, true, 0, 'follow_ball');
  for (const x of [900, 4000, 12000, 28000]) {
    view.configure(WIDTH, clampCameraTarget(view.followOffset(x, 0)), true, 0, 'follow_ball');
    const point = view.project(x, GROUND, 0);
    assert.ok(point.x > WIDTH * 0.2 && point.x < WIDTH * 0.8, `ball at ${x} projects to ${point.x}`);
  }
});

test('third person mode frames the ball centrally', () => {
  const view = new RangeCamera();
  for (const x of [900, 4000, 12000]) {
    view.configure(WIDTH, x - 200, true, 0, 'third_person', { x, y: GROUND, z: 0 });
    const point = view.project(x, GROUND, 0);
    assert.ok(point.x > WIDTH * 0.4 && point.x < WIDTH * 0.6, `ball at ${x} in third person projects to ${point.x}`);
  }
});

test('edge pointer clamps to the viewport rim and keeps aiming at the ball', () => {
  const right = edgeAnchor(WIDTH + 240, 300, WIDTH, HEIGHT, 42);
  assert.equal(right.x, WIDTH - 42);
  assert.equal(right.y, 300);
  assert.equal(right.side, 1);
  assert.ok(Math.abs(right.angle) < 1e-9);
  const above = edgeAnchor(700, -180, WIDTH, HEIGHT, 42);
  assert.equal(above.y, 42);
  assert.equal(above.x, 700);
  assert.equal(above.side, 0);
  assert.ok(above.above);
  assert.ok(Math.abs(above.angle + Math.PI / 2) < 1e-9);
  const inside = edgeAnchor(700, 300, WIDTH, HEIGHT, 42);
  assert.equal(inside.x, 700);
  assert.equal(inside.y, 300);
  assert.equal(inside.side, 0);
  assert.ok(!inside.above);
  const behind = edgeAnchor(-140, 300, WIDTH, HEIGHT, 42);
  assert.equal(behind.x, 42);
  assert.equal(behind.side, -1);
});

test('airborne decal radius expands and softens with altitude', () => {
  const base = decalRadius(0);
  assert.ok(Math.abs(base - 31 * 1.1) < 1e-9, 'R_base is the ball radius scaled for readability');
  assert.ok(Math.abs(decalRadius(AIRBORNE_CEILING) / base - 2.8) < 1e-9, 'the 1.8 factor tops out at 2.8x at the ceiling');
  assert.ok(decalRadius(AIRBORNE_CEILING * 3) > decalRadius(AIRBORNE_CEILING), 'extreme air keeps expanding the circle');
  assert.ok(decalRadius(AIRBORNE_CEILING / 2) > base && decalRadius(AIRBORNE_CEILING / 2) < decalRadius(AIRBORNE_CEILING));
  assert.equal(decalOpacity(0), 0.85);
  assert.equal(decalOpacity(AIRBORNE_CEILING * 4), 0.25, 'never fainter than 0.25');
  const mid = decalOpacity(AIRBORNE_CEILING / 2);
  assert.ok(Math.abs(mid - 0.625) < 1e-9, 'mid-air opacity follows the linear fade');
});
