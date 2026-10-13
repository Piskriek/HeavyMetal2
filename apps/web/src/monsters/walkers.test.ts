// The walkers' patrols (walkers.ts): the pose is a pure function of time, it stays on its patrol, it walks at its speed, it turns at each
// end, and it faces the way it is moving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tripSeconds, walkerPose, type WalkerSpec } from './walkers';

const spec: WalkerSpec = { id: 7, kind: 'charger', era: 'sprite', from: [0, 0], to: [30, 40], speed: 2, offset: 0 };
const LEN = 50;

test('a walker starts at the first end of its patrol, facing the second', () => {
  const p = walkerPose(spec, 0);
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.z) < 1e-9);
  assert.ok(Math.abs(p.yaw - Math.atan2(30, 40)) < 1e-12, 'yaw is atan2(x, z) of the travel');
  assert.equal(p.id, 7);
  assert.equal(p.kind, 'charger');
});

test('the pose is deterministic and periodic in the trip time', () => {
  const trip = tripSeconds(spec);
  assert.equal(trip, 50, 'out and back: 2 x 50 m at 2 m/s');
  for (const t of [0.3, 7.7, 24.9]) {
    const a = walkerPose(spec, t), b = walkerPose(spec, t);
    assert.deepEqual(a, b);
    const c = walkerPose(spec, t + trip);
    assert.ok(Math.abs(a.x - c.x) < 1e-9 && Math.abs(a.z - c.z) < 1e-9, `periodic at ${t}`);
  }
});

test('the walker stays on its patrol, reaches the far end at half a trip, and returns', () => {
  const trip = tripSeconds(spec);
  for (let k = 0; k <= 400; k++) {
    const p = walkerPose(spec, (k / 400) * trip * 2);
    const along = (p.x * 30 + p.z * 40) / LEN;
    const across = Math.abs(p.x * 40 - p.z * 30) / LEN;
    assert.ok(across < 1e-9, `on the line at ${k}`);
    assert.ok(along > -1e-9 && along < LEN + 1e-9, `between the ends at ${k}: ${along}`);
  }
  const far = walkerPose(spec, trip / 2);
  assert.ok(Math.abs(far.x - 30) < 1e-9 && Math.abs(far.z - 40) < 1e-9, 'the far end at half a trip');
  const back = walkerPose(spec, trip * 0.75);
  assert.ok(Math.abs(back.yaw - Math.atan2(-30, -40)) < 1e-9, 'it faces back on the return');
});

test('the walker covers its speed: a short step moves it speed x dt metres on the way out', () => {
  const dt = 0.01;
  const a = walkerPose(spec, 1), b = walkerPose(spec, 1 + dt);
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - spec.speed * dt) < 1e-9);
});

test('the offset starts the walker part-way along its trip, and a walker with no length stands still', () => {
  const half = walkerPose({ ...spec, offset: 0.5 }, 0);
  assert.ok(Math.abs(half.x - 30) < 1e-9 && Math.abs(half.z - 40) < 1e-9, 'half a trip in: at the far end');
  const still = walkerPose({ ...spec, to: [0, 0] }, 12);
  assert.equal(still.x, 0);
  assert.equal(still.z, 0);
  assert.equal(still.phaseT, 12, 'the walk clock still runs');
});
