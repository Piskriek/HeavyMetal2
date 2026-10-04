// tests/ragdoll.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOINTS, blend, goblin, kick, resting, step, type Limit, type Particle, type Ragdoll, type V3 } from '../src/index';

const pose: Record<string, V3> = {
  head: [0, 1.6, 0], neck: [0, 1.4, 0], pelvis: [0, 0.9, 0],
  lElbow: [-0.3, 1.2, 0], lHand: [-0.5, 1.0, 0], rElbow: [0.3, 1.2, 0], rHand: [0.5, 1.0, 0],
  lKnee: [-0.1, 0.5, 0], lFoot: [-0.1, 0.05, 0], rKnee: [0.1, 0.5, 0], rFoot: [0.1, 0.05, 0],
};

/** flat on its back, every joint touching the ground plane */
const flatPose: Record<string, V3> = {
  head: [0, 0, 0.7], neck: [0, 0, 0.5], pelvis: [0, 0, 0],
  lElbow: [-0.25, 0, 0.45], lHand: [-0.45, 0, 0.35],
  rElbow: [0.25, 0, 0.45], rHand: [0.45, 0, 0.35],
  lKnee: [-0.12, 0, -0.25], lFoot: [-0.2, 0, -0.5],
  rKnee: [0.12, 0, -0.25], rFoot: [0.2, 0, -0.5],
};

const P = (r: Ragdoll, i: number): Particle => {
  const p: Particle | undefined = r.particles[i];
  if (p === undefined) throw new Error(`no particle ${i}`);
  return p;
};

const dist = (a: V3, b: V3): number => {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const angle = (r: Ragdoll, l: Limit): number => {
  const a = P(r, l.a).pos, m = P(r, l.mid).pos, b = P(r, l.b).pos;
  const ux = a[0] - m[0], uy = a[1] - m[1], uz = a[2] - m[2];
  const vx = b[0] - m[0], vy = b[1] - m[1], vz = b[2] - m[2];
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
  const vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const c = (ux * vx + uy * vy + uz * vz) / (ul * vl);
  return Math.acos(Math.min(1, Math.max(-1, c)));
};

const clonePose = (p: Record<string, V3>): Record<string, V3> => {
  const out: Record<string, V3> = {};
  for (const k of Object.keys(p)) {
    const v: V3 | undefined = p[k];
    if (v === undefined) continue;
    out[k] = [v[0], v[1], v[2]];
  }
  return out;
};

const cloneRagdoll = (r: Ragdoll): Ragdoll => ({
  particles: r.particles.map((p) => ({
    pos: [p.pos[0], p.pos[1], p.pos[2]],
    prev: [p.prev[0], p.prev[1], p.prev[2]],
    mass: p.mass,
  })),
  sticks: r.sticks.map((s) => ({ ...s })),
  limits: r.limits.map((l) => ({ ...l })),
});

const travel = (from: Ragdoll, to: Ragdoll, axis: 0 | 1 | 2): number => {
  let sum = 0;
  for (let i = 0; i < from.particles.length; i++) sum += Math.abs(P(to, i).pos[axis] - P(from, i).pos[axis]);
  return sum / from.particles.length;
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

test('sticks keep their length', () => {
  const r0 = goblin(pose);
  for (const s of r0.sticks) {
    assert.equal(dist(P(r0, s.a).pos, P(r0, s.b).pos), s.length);
  }
  assert.equal(r0.sticks.length, 10);

  let r = kick(goblin(pose), [1.5, -0.5, 0.75], 1 / 60);
  for (let i = 0; i < 120; i++) r = step(r, 1 / 60, 8, 0);
  for (const s of r.sticks) {
    const d = dist(P(r, s.a).pos, P(r, s.b).pos);
    assert.ok(Math.abs(d - s.length) < 1e-2, `stick ${s.a}-${s.b}: ${d} != ${s.length}`);
  }
});

test('a knee never bends backwards', () => {
  // heel kicked up into the hamstring: knee angle ~0, well under the 0.1 limit
  const folded: Record<string, V3> = clonePose(pose);
  folded.lFoot = [0.009, 0.937, 0];
  const started = angle(goblin(folded), goblin(folded).limits[2]!);
  assert.ok(started < 0.1, `knee started at ${started}`);

  let r = goblin(folded);
  for (let i = 0; i < 30; i++) r = step(r, 1 / 60, 8, 0);
  for (const l of r.limits) {
    const a = angle(r, l);
    assert.ok(a >= l.min - 1e-3, `joint ${l.mid} folded to ${a} < ${l.min}`);
    assert.ok(a <= l.max + 1e-3, `joint ${l.mid} bent to ${a} > ${l.max}`);
  }
  assert.ok(angle(r, r.limits[2]!) > 0.05);

  // and it stays legal through a long tumble
  let t = kick(goblin(pose), [3, 0, -1], 1 / 60);
  for (let i = 0; i < 300; i++) {
    t = step(t, 1 / 60, 8, 0);
    for (const l of t.limits) {
      const a = angle(t, l);
      assert.ok(a >= l.min - 1e-3 && a <= l.max + 1e-3, `joint ${l.mid} at ${a}`);
    }
  }
});

test('pinned particles stay', () => {
  const r0 = goblin(pose);
  P(r0, 2).mass = 0; // pelvis pinned
  const anchor: V3 = [P(r0, 2).pos[0], P(r0, 2).pos[1], P(r0, 2).pos[2]];
  const start: V3[] = r0.particles.map((p) => [p.pos[0], p.pos[1], p.pos[2]]);

  let r = kick(r0, [0, 0, 6], 1 / 60);
  for (let i = 0; i < 90; i++) r = step(r, 1 / 60, 8, 0);
  assert.deepEqual(P(r, 2).pos, anchor);
  assert.deepEqual(P(r, 2).prev, anchor);

  // ...while the rest of the goblin swings and crumples around the pin
  let swung = 0;
  for (let i = 0; i < r.particles.length; i++) {
    if (i === 2) continue;
    const from: V3 | undefined = start[i];
    if (from === undefined) continue;
    swung = Math.max(swung, dist(P(r, i).pos, from));
  }
  assert.ok(swung > 0.1, `body barely moved: ${swung}`);

  // an impulse aimed only at a pinned particle does nothing at all
  const still = kick(r0, [9, 9, 9], 1 / 60, [2]);
  assert.deepEqual(still, cloneRagdoll(r0));
});

test('friction stops sliding', () => {
  let r = kick(goblin(flatPose), [4, 0, 0], 1 / 60);
  const first = travel(r, step(r, 1 / 60, 8, 0), 0);
  assert.ok(first > 0.05, `first step moved ${first}`);

  for (let i = 0; i < 60; i++) r = step(r, 1 / 60, 8, 0);
  const last = travel(r, step(r, 1 / 60, 8, 0), 0);
  assert.ok(last < 1e-6, `still sliding ${last}`);
  assert.ok(last < first / 100);
  assert.ok(resting(r, 1e-4));
});

test('blend at 0 and 1', () => {
  let r = kick(goblin(pose), [3, 1, -2], 1 / 60);
  for (let i = 0; i < 20; i++) r = step(r, 1 / 60, 8, 0);

  const b0 = blend(r, pose, 0);
  for (let i = 0; i < JOINTS.length; i++) {
    assert.deepEqual(P(b0, i).pos, P(r, i).pos);
    assert.deepEqual(P(b0, i).prev, P(r, i).prev);
  }

  const half = blend(r, pose, 0.5);
  const hp = P(half, 0).pos, rp = P(r, 0).pos, tp = pose.head!;
  assert.ok(Math.abs(hp[0] - (rp[0] + tp[0]) / 2) < 1e-9);
  assert.ok(Math.abs(hp[1] - (rp[1] + tp[1]) / 2) < 1e-9);

  const b1 = blend(r, pose, 1);
  for (let i = 0; i < JOINTS.length; i++) {
    const name: string | undefined = JOINTS[i];
    const want: V3 | undefined = name === undefined ? undefined : pose[name];
    if (want === undefined) continue;
    assert.deepEqual(P(b1, i).pos, want);
    assert.deepEqual(P(b1, i).prev, want);
  }
  assert.ok(resting(b1, 1e-9));
});

test('inputs are not mutated', () => {
  const poseCopy = clonePose(pose);
  const r = goblin(pose);
  const rCopy = cloneRagdoll(r);
  const out = blend(step(kick(r, [1, 2, 3], 1 / 60, [0, 1, 2]), 1 / 60, 8, 0), pose, 0.75);
  resting(r, 1e-3);
  assert.deepEqual(pose, poseCopy);
  assert.deepEqual(r, rCopy);
  assert.ok(out.particles.length === 11);
});

test('same inputs, same result', () => {
  const run = (): number[] => {
    let r = kick(goblin(pose), [1.25, 0, -0.5], 1 / 60);
    for (let i = 0; i < 200; i++) r = step(r, 1 / 60, 8, 0);
    return r.particles.map((p) => p.pos[0]);
  };
  assert.deepEqual(run(), run());
});