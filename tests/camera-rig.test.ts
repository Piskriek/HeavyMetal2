import test from 'node:test';
import assert from 'node:assert/strict';
import {
  flyStep,
  orbitStep,
  focusTarget,
  dampRig,
  orthoFor,
  type RigState,
  FOCUS_MARGIN,
  DISTANCE_MIN,
  DISTANCE_MAX,
  PITCH_MIN,
  PITCH_MAX,
} from '../src/game/builder/camera-rig';

function makeInitialRig(): RigState {
  return {
    mode: 'fly',
    position: { x: 0, y: 500, z: 1000 },
    target: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    distance: 1000,
    orthoHalfHeight: 500,
    frame: 'world',
  };
}

test('T3 CameraRig: fly framerate independence', () => {
  const initial = makeInitialRig();
  const input = {
    fwd: 1,
    right: 0.5,
    up: -0.2,
    turbo: false,
    dYaw: 0,
    dPitch: 0,
  };

  // 1 step of dt = 1/30
  const oneStep = flyStep(initial, input, 1 / 30);

  // 2 steps of dt = 1/60
  const stepA = flyStep(initial, input, 1 / 60);
  const stepB = flyStep(stepA, input, 1 / 60);

  // Assert framerate independence: position integration matches within 1e-9
  assert.ok(Math.abs(oneStep.position.x - stepB.position.x) < 1e-9);
  assert.ok(Math.abs(oneStep.position.y - stepB.position.y) < 1e-9);
  assert.ok(Math.abs(oneStep.position.z - stepB.position.z) < 1e-9);
  assert.ok(Math.abs(oneStep.yaw - stepB.yaw) < 1e-9);
  assert.ok(Math.abs(oneStep.pitch - stepB.pitch) < 1e-9);
});

test('T3 CameraRig: focus margin', () => {
  const initial = makeInitialRig();
  const sphere = {
    center: { x: 200, y: 150, z: -300 },
    radius: 100,
  };

  const fov = 60;
  // Aspect > 1 (widescreen)
  const focusedWide = focusTarget(initial, sphere, fov, 16 / 9);
  assert.equal(focusedWide.target.x, sphere.center.x);
  assert.equal(focusedWide.target.y, sphere.center.y);
  assert.equal(focusedWide.target.z, sphere.center.z);

  // Expected distance: FOCUS_MARGIN * radius / sin(fov/2)
  const halfFovRad = ((fov * Math.PI) / 180) / 2;
  const expectedDist = (FOCUS_MARGIN * sphere.radius) / Math.sin(halfFovRad);
  assert.ok(Math.abs(focusedWide.distance - expectedDist) < 1e-4);

  // Aspect < 1 (portrait): horizontal FOV is smaller and limits the distance
  const focusedPortrait = focusTarget(initial, sphere, fov, 9 / 16);
  assert.ok(focusedPortrait.distance > focusedWide.distance); // Must back off further to fit
});

test('T3 CameraRig: orbit clamps distance and pitch', () => {
  const initial = makeInitialRig();

  // Zoom way in
  let s = initial;
  for (let i = 0; i < 50; i++) {
    s = orbitStep(s, 0, 0, -1);
  }
  assert.ok(s.distance >= DISTANCE_MIN);

  // Zoom way out
  for (let i = 0; i < 100; i++) {
    s = orbitStep(s, 0, 0, 1);
  }
  assert.ok(s.distance <= DISTANCE_MAX);

  // Pitch clamp test
  const overPitched = orbitStep(initial, 0, 10, 0);
  assert.ok(overPitched.pitch <= PITCH_MAX);

  const underPitched = orbitStep(initial, 0, -10, 0);
  assert.ok(underPitched.pitch >= PITCH_MIN);
});

test('T3 CameraRig: ortho track frame alignment', () => {
  const initial: RigState = {
    ...makeInitialRig(),
    frame: 'track',
    target: { x: 500, y: 100, z: 800 },
  };

  const trackSampler = (_x: number, _z: number) => ({
    tangent: [1, 0] as [number, number],
    right: [0, 1] as [number, number],
  });

  const topView = orthoFor(initial, 'top', trackSampler);
  assert.equal(topView.mode, 'ortho-top');
  assert.ok(Math.abs(topView.pitch - (-Math.PI / 2)) < 1e-3);

  const frontView = orthoFor(initial, 'front', trackSampler);
  assert.equal(frontView.mode, 'ortho-front');
  assert.equal(frontView.pitch, 0);

  const sideView = orthoFor(initial, 'side', trackSampler);
  assert.equal(sideView.mode, 'ortho-side');
  assert.equal(sideView.pitch, 0);
});

test('T3 CameraRig: dampRig smoothly interpolates towards target', () => {
  const from = makeInitialRig();
  const to: RigState = {
    ...from,
    position: { x: 500, y: 1000, z: 2000 },
    distance: 2000,
  };

  const damped = dampRig(from, to, 0.1);
  assert.ok(damped.position.x > from.position.x && damped.position.x < to.position.x);
  assert.ok(damped.position.y > from.position.y && damped.position.y < to.position.y);
  assert.ok(damped.distance > from.distance && damped.distance < to.distance);
});
