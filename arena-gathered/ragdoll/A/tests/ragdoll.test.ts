import { blend, type Ragdoll } from '../src/index';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOINTS, goblin, kick, resting, step, type V3 } from '../src/index';
const pose: Record<string, V3> = {
  head: [0, 1.6, 0], neck: [0, 1.4, 0], pelvis: [0, 0.9, 0],
  lElbow: [-0.3, 1.2, 0], lHand: [-0.5, 1.0, 0], rElbow: [0.3, 1.2, 0], rHand: [0.5, 1.0, 0],
  lKnee: [-0.1, 0.5, 0], lFoot: [-0.1, 0.05, 0], rKnee: [0.1, 0.5, 0], rFoot: [0.1, 0.05, 0],
};
test('eleven joints', () => {
  assert.equal(JOINTS.length, 11);
  assert.equal(goblin(pose).particles.length, 11);
});
test('it falls and comes to rest on the ground', () => {
  let r = kick(goblin(pose), [2, 0, 0], 1 / 60);
  for (let i = 0; i < 600; i++) r = step(r, 1 / 60, 8, 0);
  assert.ok(r.particles.every((p) => p.pos[1] >= -1e-6));
  assert.ok(r.particles.every((p) => p.pos[1] < 0.6));
  assert.ok(resting(r, 1e-3));
});

test('sticks recover their original lengths', () => {
  const hit = kick(goblin(pose), [12, 5, 0], 1 / 60, [3]);
  const r = step(hit, 1 / 60, 32, -100);
  for (const stick of r.sticks) {
    const a = r.particles[stick.a]!.pos;
    const b = r.particles[stick.b]!.pos;
    assert.ok(Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - stick.length) < 1e-3);
  }
});

test('a knee cannot fold backward through its minimum angle', () => {
  const knee: Ragdoll = {
    particles: [
      { pos: [0, 2, 0], prev: [0, 2, 0], mass: 0 },
      { pos: [0, 1, 0], prev: [0, 1, 0], mass: 0 },
      { pos: [0, 1.5, 0], prev: [0, 1.5, 0], mass: 1 },
    ],
    sticks: [],
    limits: [{ a: 0, mid: 1, b: 2, min: 0.1, max: Math.PI }],
  };
  const foot = step(knee, 0, 12, -1).particles[2]!.pos;
  const lower: V3 = [foot[0], foot[1] - 1, foot[2]];
  const angle = Math.acos(lower[1] / Math.hypot(...lower));
  assert.ok(angle >= 0.0999);
});

test('pinned joints ignore kicks and remain fixed during a step', () => {
  const r = goblin(pose);
  r.particles[0]!.mass = 0;
  const moved = step(kick(r, [7, 8, 9], 1 / 60), 1 / 60, 12, 0);
  assert.deepEqual(moved.particles[0]!.pos, pose.head);
  assert.deepEqual(moved.particles[0]!.prev, pose.head);
});

test('ground friction brings sliding to a stop', () => {
  let r: Ragdoll = {
    particles: [{ pos: [0, 0, 0], prev: [-1, 0, 0], mass: 1 }],
    sticks: [], limits: [],
  };
  r = step(r, 1 / 60, 2, 0);
  const start = r.particles[0]!.pos[0];
  for (let i = 0; i < 24; i++) r = step(r, 1 / 60, 2, 0);
  assert.ok(r.particles[0]!.pos[0] < start + 0.3);
  assert.ok(resting(r, 1e-4));
});

test('blend at zero preserves motion and at one exactly matches the pose', () => {
  const r = kick(goblin(pose), [3, 2, 1], 1 / 60);
  const zero = blend(r, pose, 0);
  assert.deepEqual(zero, r);
  assert.notStrictEqual(zero, r);
  const one = blend(r, pose, 1);
  JOINTS.forEach((name, i) => {
    assert.deepEqual(one.particles[i]!.pos, pose[name]);
    assert.deepEqual(one.particles[i]!.prev, pose[name]);
  });
  assert.ok(resting(one, 1e-10));
});

test('goblin, kick, step and blend leave their inputs unchanged', () => {
  const originalPose = JSON.stringify(pose);
  const r = goblin(pose);
  const original = JSON.stringify(r);
  const hit = kick(r, [2, 3, 4], 1 / 60, [3]);
  assert.equal(JSON.stringify(r), original);
  const originalHit = JSON.stringify(hit);
  const fallen = step(hit, 1 / 60, 8, 0);
  assert.equal(JSON.stringify(hit), originalHit);
  const originalFallen = JSON.stringify(fallen);
  blend(fallen, pose, 0.5);
  assert.equal(JSON.stringify(fallen), originalFallen);
  assert.equal(JSON.stringify(pose), originalPose);
});

test('repeated inputs produce identical simulations', () => {
  const run = (): Ragdoll => {
    let r = kick(goblin(pose), [2, 1, 3], 1 / 60);
    for (let i = 0; i < 20; i++) r = step(r, 1 / 60, 8, 0);
    return r;
  };
  assert.deepEqual(run(), run());
});