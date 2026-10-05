import test from 'node:test';
import assert from 'node:assert/strict';
import { RIG, dragLimb, pickLimb, restPose, solveLimb, toAngles } from '../src/index';
import { LIMBS, blend, dragBody, mirror } from '../src/index';
import type { Limb, LimbDef, Pose, Vec3 } from '../src/index';
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

// ---- own tests --------------------------------------------------------------

const nearVec = (a: Vec3, b: Vec3, e = 1e-6): void => {
  near(a[0], b[0], e);
  near(a[1], b[1], e);
  near(a[2], b[2], e);
};
const lengthsKept = (p: Pose, limb: Limb): void => {
  near(dist(RIG[limb].root, p.limbs[limb].mid), RIG[limb].upper);
  near(dist(p.limbs[limb].mid, p.limbs[limb].end), RIG[limb].lower);
};

test('out of reach: the whole limb lies on the ray to the target, lengths kept', () => {
  const root = RIG.armR.root;
  const target: Vec3 = [1.25, 2.2, -1.5];
  const s = solveLimb(RIG.armR, target);
  assert.equal(s.reached, false);
  const d = dist(root, target);
  const dir: Vec3 = [(target[0] - root[0]) / d, (target[1] - root[1]) / d, (target[2] - root[2]) / d];
  nearVec(s.mid, [root[0] + 0.3 * dir[0], root[1] + 0.3 * dir[1], root[2] + 0.3 * dir[2]]);
  nearVec(s.end, [root[0] + 0.6 * dir[0], root[1] + 0.6 * dir[1], root[2] + 0.6 * dir[2]]);
  // exactly at and just inside full reach still count as reached
  assert.equal(solveLimb(RIG.armR, [0.25, 1.8, 0]).reached, true);
  assert.equal(solveLimb(RIG.armR, [0.25, 0.6000001, 0]).reached, true);
});

test('a target on the root folds the limb fully, middle joint toward the pole', () => {
  const s = solveLimb(RIG.armL, RIG.armL.root);
  assert.equal(s.reached, true);
  nearVec(s.end, RIG.armL.root);
  near(dist(RIG.armL.root, s.mid), 0.3);
  near(dist(s.mid, s.end), 0.3);
  nearVec(s.mid, [-0.25, 1.2, -0.3]); // arm: elbow straight back
  nearVec(solveLimb(RIG.legR, RIG.legR.root).mid, [0.12, 0.6, 0.3]); // leg: knee straight forward
});

test('a target nearer than |upper - lower| is pushed out to that distance', () => {
  const def: LimbDef = { root: [0, 1, 0], upper: 0.4, lower: 0.2, pole: [0, 0, 1] };
  const s = solveLimb(def, [0, 0.95, 0]); // 5 cm below the root; the limb cannot fold shorter than 20 cm
  assert.equal(s.reached, false);
  nearVec(s.end, [0, 0.8, 0]);
  nearVec(s.mid, [0, 0.6, 0]);
  near(dist(def.root, s.mid), 0.4);
  near(dist(s.mid, s.end), 0.2);
});

test('mirror flips x onto the other side; mirroring back is the identity', () => {
  const rest = restPose();
  assert.deepEqual(mirror(mirror(rest, 'legL'), 'legR'), rest);
  const p = dragLimb(restPose(), 'armL', [-0.45, 1.35, 0.25]);
  const m = mirror(p, 'armL');
  assert.deepEqual(m.limbs.armL, p.limbs.armL);
  nearVec(m.limbs.armR.end, [0.45, 1.35, 0.25]);
  near(m.limbs.armR.mid[0], -p.limbs.armL.mid[0]);
  near(m.limbs.armR.mid[1], p.limbs.armL.mid[1]);
  near(m.limbs.armR.mid[2], p.limbs.armL.mid[2]);
  lengthsKept(m, 'armR');
  // identical to solving the mirrored target directly (the rig is symmetric)
  nearVec(m.limbs.armR.mid, solveLimb(RIG.armR, [0.45, 1.35, 0.25]).mid);
  const back = mirror(m, 'armR');
  assert.deepEqual(back.limbs.armL, p.limbs.armL);
  assert.deepEqual(back.limbs.legL, p.limbs.legL);
  assert.deepEqual(back.limbs.legR, p.limbs.legR);
  assert.deepEqual(back.limbs.armR, m.limbs.armR);
});

test('blend keeps bone lengths, lands halfway and interpolates the body offset', () => {
  const a = restPose();
  const b = dragBody(dragLimb(dragLimb(a, 'armR', [0.25, 1.2, 0.6]), 'legL', [-0.12, 0.3, 0.3]), [1, 0, 0]);
  const h = blend(a, b, 0.5);
  for (const limb of LIMBS) lengthsKept(h, limb);
  nearVec(h.limbs.armR.end, [0.25, 0.9, 0.3]);
  nearVec(h.limbs.legL.end, [-0.12, 0.15, 0.15]);
  nearVec(h.limbs.armL.end, a.limbs.armL.end);
  assert.ok(h.limbs.armR.mid[2] < 0.15, 'the blended elbow still bends backwards');
  assert.ok(LIMBS.every((l) => h.limbs[l].reached));
  nearVec(h.offset, [0.5, 0, 0]);
  nearVec(blend(a, b, 0).limbs.armR.end, a.limbs.armR.end);
  nearVec(blend(a, b, 1).limbs.legL.end, b.limbs.legL.end);
  nearVec(blend(a, b, 7).offset, b.offset); // t is clamped
});

test('toAngles of a raised arm', () => {
  const rest = restPose();
  const forward = toAngles(dragLimb(rest, 'armL', [-0.25, 1.2, 0.6])).armL; // straight out in front
  near(forward.swingX, -90);
  near(forward.swingZ, 0);
  near(forward.bend, 0);
  const back = toAngles(dragLimb(rest, 'armL', [-0.25, 1.2, -0.6])).armL; // straight back
  near(back.swingX, 90);
  const side = toAngles(dragLimb(rest, 'armL', [-0.85, 1.2, 0])).armL; // straight out to the side
  near(side.swingZ, -90);
  near(side.swingX, 0);
  near(side.bend, 0);
  near(toAngles(mirror(dragLimb(rest, 'armL', [-0.85, 1.2, 0]), 'armL')).armR.swingZ, 90);
  const up = toAngles(dragLimb(rest, 'armR', [0.25, 1.8, 0])).armR; // straight up
  near(Math.abs(up.swingX), 180);
  near(up.bend, 0);
  const bent = toAngles(dragLimb(rest, 'armL', [-0.25, 0.9, 0.3])).armL; // upper arm down, forearm forward
  near(bent.swingX, 0);
  near(bent.swingZ, 0);
  near(bent.bend, 90);
  const leg = toAngles(dragLimb(rest, 'armL', [-0.25, 1.2, 0.6])).legR; // untouched limbs stay at rest
  near(leg.swingX, 0);
  near(leg.swingZ, 0);
  near(leg.bend, 0);
});

test('dragBody moves the whole puppet: picking and dragging happen in world space', () => {
  const p = dragBody(restPose(), [2, 0, 1]);
  assert.deepEqual(p.limbs, restPose().limbs);
  assert.equal(pickLimb(p, [2.25, 0.62, 1], 0.1), 'armR');
  assert.equal(pickLimb(p, [0.25, 0.62, 0], 0.1), null);
  assert.equal(pickLimb(p, [1.88, 0.05, 1.02], 0.1), 'legL');
  const q = dragLimb(p, 'legR', [2.12, 0.3, 1.3]);
  nearVec(q.limbs.legR.end, [0.12, 0.3, 0.3]); // stored in body space
  assert.deepEqual(q.offset, [2, 0, 1]);
  assert.equal(pickLimb(q, [2.12, 0.3, 1.3], 0.01), 'legR');
});

test('pickLimb returns the nearest end when several are within the radius', () => {
  const p = restPose(); // feet at x = ±0.12, y = 0
  assert.equal(pickLimb(p, [0.01, 0, 0], 1), 'legR');
  assert.equal(pickLimb(p, [-0.01, 0, 0], 1), 'legL');
  assert.equal(pickLimb(p, [0.5, 0, 0], 0.37), null); // legR is 0.38 away
});

test('poses are never mutated', () => {
  const p = restPose();
  const snapshot = JSON.stringify(p);
  dragLimb(p, 'armL', [0, 1.5, 0.2]);
  mirror(p, 'legL');
  blend(p, dragLimb(p, 'legR', [0.3, 0.4, 0.2]), 0.3);
  dragBody(p, [3, 3, 3]);
  toAngles(p);
  assert.equal(JSON.stringify(p), snapshot);
});