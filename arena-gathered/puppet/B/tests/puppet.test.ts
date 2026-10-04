// tests/puppet.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { RIG, dragLimb, pickLimb, restPose, solveLimb, toAngles } from '../src/index';
import { blend, mirror } from '../src/index';
const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
test('at rest the limbs hang straight down', () => {
  const p = restPose();
  assert.deepEqual(p.limbs.armL.end.map((v) => Math.round(v * 1e6) / 1e6), [-0.25, 0.6, 0]);
  near(toAngles(p).armL.bend, 0);
});
test('IK keeps bone lengths and reaches the target', () => {
  const t: [number, number, number] = [-0.25, 0.9, 0.3];
  const s = solveLimb(RIG.armL, t);
  assert.equal(s.reached, true);
  near(dist(RIG.armL.root, s.mid), 0.3); near(dist(s.mid, s.end), 0.3); near(dist(s.end, t), 0);
  assert.ok(s.mid[2] < 0.15, 'the elbow bends towards its pole (-z)');
});
test('out of reach points straight at the target', () => {
  const s = solveLimb(RIG.legR, [0.12, 0.6, 5]);
  assert.equal(s.reached, false);
  near(s.end[2], 0.6); near(s.end[1], 0.6);
});
test('grab and drag', () => {
  const p = restPose();
  assert.equal(pickLimb(p, [0.25, 0.62, 0], 0.1), 'armR');
  assert.equal(pickLimb(p, [0, 2, 0], 0.1), null);
  const q = dragLimb(p, 'armR', [0.25, 1.2, 0.6]);
  near(q.limbs.armR.end[2], 0.6);
  assert.deepEqual(q.limbs.legL, p.limbs.legL);
});

// --- additional tests ---
test('out of reach still keeps bone lengths and is collinear', () => {
  const s = solveLimb(RIG.armL, [-0.25, 1.2, 5]);
  assert.equal(s.reached, false);
  near(dist(RIG.armL.root, s.mid), 0.3); near(dist(s.mid, s.end), 0.3);
  near(dist(RIG.armL.root, s.end), 0.6);
});
test('a target at the root folds the limb, lengths kept', () => {
  const s = solveLimb(RIG.armL, [-0.25, 1.2, 0]);
  near(dist(RIG.armL.root, s.mid), 0.3); near(dist(s.mid, s.end), 0.3);
  near(dist(s.end, RIG.armL.root), 0);
  assert.ok(s.mid[2] < 0, 'folded elbow sticks out towards the pole');
});
test('mirror copies to the other side; mirror twice is identity', () => {
  const p = dragLimb(restPose(), 'armL', [-0.45, 1.0, 0.2]);
  const m = mirror(p, 'armL');
  near(m.limbs.armR.end[0], -p.limbs.armL.end[0]);
  near(m.limbs.armR.end[1], p.limbs.armL.end[1]);
  near(m.limbs.armR.mid[0], -p.limbs.armL.mid[0]);
  const back = mirror(m, 'armR');
  for (let i = 0; i < 3; i++) {
    near(back.limbs.armL.end[i]!, p.limbs.armL.end[i]!);
    near(back.limbs.armL.mid[i]!, p.limbs.armL.mid[i]!);
  }
  assert.deepEqual(back.limbs.legL, p.limbs.legL);
});
test('blend keeps bone lengths and hits the blended end', () => {
  const a = restPose();
  const b = dragLimb(dragLimb(a, 'armL', [-0.25, 1.4, 0.4]), 'legR', [0.3, 0.3, 0.3]);
  const h = blend(a, b, 0.5);
  for (const l of ['armL', 'armR', 'legL', 'legR'] as const) {
    near(dist(RIG[l].root, h.limbs[l].mid), 0.3);
    near(dist(h.limbs[l].mid, h.limbs[l].end), 0.3);
    for (let i = 0; i < 3; i++) near(h.limbs[l].end[i]!, (a.limbs[l].end[i]! + b.limbs[l].end[i]!) / 2);
  }
});
test('toAngles of an arm raised straight forward', () => {
  const p = dragLimb(restPose(), 'armL', [-0.25, 1.2, 0.6]);
  const ang = toAngles(p).armL;
  near(ang.swingX, 90, 1e-6);
  near(ang.swingZ, 0, 1e-6);
  near(ang.bend, 0, 1e-4);
  const side = toAngles(dragLimb(restPose(), 'armR', [0.85, 1.2, 0])).armR;
  near(side.swingZ, 90, 1e-6);
});