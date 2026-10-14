import test from 'node:test';
import assert from 'node:assert/strict';
import {
  castHeightfield,
  castSpheres,
  createRoverArmState,
  nearestHit,
  ROVER_CAMERA,
  stepRoverArm,
  type RoverArmInput,
} from './rover-camera';

const FULL_ARM = Math.hypot(ROVER_CAMERA.armBack, ROVER_CAMERA.armUp);
const FRAME = 1 / 60;
const flat = (): number => 0;

function input(over: Partial<RoverArmInput> = {}): RoverArmInput {
  return { chassis: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, dt: FRAME, groundAt: flat, ...over };
}

test('with nothing in the way the arm holds its full length, 5.5 m back and 2.1 m up from the pivot', () => {
  const state = createRoverArmState();
  let out = stepRoverArm(state, input());
  for (let i = 0; i < 120; i++) out = stepRoverArm(state, input());
  assert.ok(Math.abs(state.arm - FULL_ARM) < 1e-6);
  assert.ok(Math.abs(out.camera.z + ROVER_CAMERA.armBack) < 1e-6, 'behind the chassis');
  assert.ok(Math.abs(out.camera.y - (ROVER_CAMERA.pivotHeight + ROVER_CAMERA.armUp)) < 0.05, 'up from the pivot');
  assert.equal(out.obstructed, false);
});

test('a wall at 3 m pulls the camera in to 2.65 m (the hit minus the 0.35 m sphere), and it snaps in quickly', () => {
  const state = createRoverArmState();
  const wall = () => 3.0;
  const first = stepRoverArm(state, input({ cast: wall }));
  assert.equal(first.obstructed, true);
  // 95% of the way within 25 ms: two frames at 60 fps
  stepRoverArm(state, input({ cast: wall }));
  assert.ok(Math.abs(state.arm - 2.65) < 0.05 * (FULL_ARM - 2.65) + 0.02, `after two frames ${state.arm}`);
  for (let i = 0; i < 6; i++) stepRoverArm(state, input({ cast: wall }));
  assert.ok(Math.abs(state.arm - 2.65) < 1e-3, `arm ${state.arm}`);
  const out = stepRoverArm(state, input({ cast: wall }));
  assert.ok(Math.abs(Math.hypot(out.camera.x, out.camera.y - ROVER_CAMERA.pivotHeight, out.camera.z) - 2.65) < 0.02);
});

test('the arm eases back out over about 250 ms once the wall is gone', () => {
  const state = createRoverArmState();
  for (let i = 0; i < 60; i++) stepRoverArm(state, input({ cast: () => 3.0 }));
  assert.ok(state.arm < 2.7);
  let t = 0;
  while (state.arm < 2.65 + (FULL_ARM - 2.65) * 0.95 && t < 3) {
    stepRoverArm(state, input());
    t += FRAME;
  }
  // 95% of the way back out in 250 ms
  assert.ok(t > 0.2 && t < 0.3, `took ${t}`);
});

test('the camera never goes below the ground at its own x and z plus 0.65 m, even on a crater lip', () => {
  const state = createRoverArmState();
  // a crater lip: the ground rises to 12 m behind the rover, where the camera sits
  const lip = (x: number, z: number): number => (z < -3 ? 12 + x * 0 : z < 0 ? 4 : 0);
  let worst = Infinity;
  for (let i = 0; i < 90; i++) {
    const out = stepRoverArm(state, input({ groundAt: lip }));
    worst = Math.min(worst, out.camera.y - (lip(out.camera.x, out.camera.z) + ROVER_CAMERA.floorClearance));
  }
  assert.ok(worst >= -1e-9, `camera dipped ${worst} m below the floor`);
  const out = stepRoverArm(state, input({ groundAt: () => 12 }));
  assert.ok(out.camera.y >= 12 + ROVER_CAMERA.floorClearance - 1e-9);
  assert.equal(out.floorClamped, true);
});

test('the horizon stays level: the look target lies in the chassis heading plane for every pitch', () => {
  const state = createRoverArmState();
  for (const pitch of [-0.5, -0.2, 0, 0.3, 0.6]) {
    for (let i = 0; i < 30; i++) stepRoverArm(state, input({ yaw: 0.7, pitch }));
    const out = stepRoverArm(state, input({ yaw: 0.7, pitch }));
    // the look target's sideways offset from the pivot is zero: no roll, the camera never leans
    const fwdX = Math.sin(0.7), fwdZ = Math.cos(0.7);
    const sideways = out.lookAt.x * fwdZ - out.lookAt.z * fwdX;
    assert.ok(Math.abs(sideways) < 1e-9, `sideways ${sideways} at pitch ${pitch}`);
  }
});

test('pitch follows the chassis with a 0.12 s lag, so a small bump does not shake the view', () => {
  const state = createRoverArmState();
  const steps = Math.round(0.12 / FRAME);
  for (let i = 0; i < steps; i++) stepRoverArm(state, input({ pitch: 0.3 }));
  assert.ok(Math.abs(state.pitch - 0.3 * (1 - Math.exp(-1))) < 0.01, `pitch ${state.pitch}`);
  // a bump that lasts one frame moves the look target by a fraction of the step
  const before = createRoverArmState();
  stepRoverArm(before, input({ pitch: 0 }));
  stepRoverArm(before, input({ pitch: 0.2 }));
  assert.ok(before.pitch < 0.2 * 0.2, 'one frame of a bump is damped');
});

test('a hill on the arm pulls the camera in; the cast only counts what is on the line', () => {
  const state = createRoverArmState();
  // a hill rising to 2 m high from 2 m behind the pivot on the arm's line
  const hill = (x: number, z: number): number => (z < -2 && x > -10 ? 2.5 : 0);
  const cast = (origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, max: number) =>
    castHeightfield(origin, dir, max, hill);
  for (let i = 0; i < 90; i++) stepRoverArm(state, input({ cast, groundAt: hill }));
  assert.ok(state.arm < FULL_ARM, `arm ${state.arm}`);
  const out = stepRoverArm(state, input({ cast, groundAt: hill }));
  // the camera stops in front of the hill's face; its own ground still sets the floor
  assert.ok(out.camera.y >= hill(out.camera.x, out.camera.z) + ROVER_CAMERA.floorClearance - 1e-9);
});

test('castHeightfield: a flat floor under an upward ray is clear; a slope on the ray is hit where it rises', () => {
  const origin = { x: 0, y: 1.5, z: 0 };
  assert.equal(castHeightfield(origin, { x: 0, y: 1, z: 0 }, 10, flat), null);
  // ground rises to 5 m for x > 2: a ray going along +x at 1.5 m is under it from x = 5 (the rise is at x = 2, height 5 > 1.5)
  const wall = (x: number): number => (x > 2 ? 5 : 0);
  const hit = castHeightfield(origin, { x: 1, y: 0, z: 0 }, 10, (x) => wall(x));
  assert.ok(hit !== null && Math.abs(hit - 2) < 0.05, `hit ${hit}`);
  // a ray that starts under the ground hits at once
  assert.equal(castHeightfield({ x: 0, y: -1, z: 0 }, { x: 1, y: 0, z: 0 }, 10, flat), 0);
});

test('castSpheres: the ray meets a boulder at its surface, and misses a boulder off its line', () => {
  const origin = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 1 };
  assert.ok(Math.abs((castSpheres(origin, dir, 20, [{ x: 0, y: 0, z: 6, r: 1 }]) ?? -1) - 5) < 1e-9);
  assert.equal(castSpheres(origin, dir, 20, [{ x: 3, y: 0, z: 6, r: 1 }]), null);
  assert.equal(castSpheres(origin, dir, 4, [{ x: 0, y: 0, z: 6, r: 1 }]), null, 'beyond the reach');
  assert.equal(nearestHit(4, 2), 2);
  assert.equal(nearestHit(null, 3), 3);
  assert.equal(nearestHit(null, null), null);
});
