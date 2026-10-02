import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANIMATIONS, ANIM_VARIABLES, Animator, BONES, animById, animToParams, blendPose, finished, normalizeAnim, poseAt, restPose, stickFigure, type Pose } from '../src';

const close = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;
const maxDiff = (a: Pose, b: Pose): number => {
  let m = Math.abs(a.lift - b.lift) + Math.abs(a.lean - b.lean);
  for (const bone of BONES) for (const k of ['rx', 'ry', 'rz'] as const) m = Math.max(m, Math.abs(a.bones[bone][k] - b.bones[bone][k]));
  return m;
};

test('a walk swings the legs against each other and each arm against its leg', () => {
  const walk = animById('walk');
  for (const t of [0.1, 0.27, 0.6, 0.93]) {
    const p = poseAt(walk, t);
    assert.ok(close(p.bones.legL.rx, -p.bones.legR.rx), 'legs opposite');
    assert.ok(Math.sign(p.bones.armL.rx) === -Math.sign(p.bones.legL.rx) || close(p.bones.legL.rx, 0, 1e-6), 'left arm swings against the left leg');
    assert.ok(Math.abs(p.bones.legL.rx) <= (walk.legSwing * Math.PI) / 180 + 1e-9);
  }
  assert.ok(poseAt(walk, 0.3).lean > 0, 'leans into the walk');
});

test('poses are deterministic, continuous and junk-safe', () => {
  for (const p of ANIMATIONS) {
    assert.deepEqual(poseAt(p, 0.37), poseAt(p, 0.37));
    for (let t = 0; t < 2; t += 0.01) assert.ok(maxDiff(poseAt(p, t), poseAt(p, t + 0.01)) < 0.25, `${p.id} jumps at ${t}`);
  }
  assert.deepEqual(poseAt(animById('walk'), NaN), poseAt(animById('walk'), 0));
  assert.deepEqual(poseAt(animById('walk'), 1, NaN), poseAt(animById('walk'), 1, 1));
});

test('one-off moves start and end at rest and say when they are finished', () => {
  for (const id of ['jump', 'swing', 'wave', 'dance', 'cheer']) {
    const p = animById(id);
    assert.equal(p.loop, false);
    assert.ok(maxDiff(poseAt(p, 0), restPose()) < 0.05, `${id} starts at rest`);
    assert.ok(maxDiff(poseAt(p, p.duration), restPose()) < 0.05, `${id} ends at rest`);
    assert.ok(maxDiff(poseAt(p, p.duration / 2), restPose()) > 0.2, `${id} does something in the middle`);
    assert.equal(finished(p, p.duration + 0.01), true);
    assert.equal(finished(p, p.duration / 2), false);
  }
});

test('the animator picks idle, walk, run and air moves from the motion and fades between them', () => {
  const an = new Animator();
  an.update(0.1, { speed: 0, grounded: true, vy: 0 });
  assert.equal(an.slot, 'idle');
  an.update(0.1, { speed: 3.6, grounded: true, vy: 0 });
  assert.equal(an.slot, 'walk');
  an.update(0.1, { speed: 8, grounded: true, vy: 0 });
  assert.equal(an.slot, 'run');
  an.update(0.05, { speed: 3, grounded: false, vy: 5 });
  assert.equal(an.slot, 'jump');
  for (let i = 0; i < 20; i++) an.update(0.05, { speed: 3, grounded: false, vy: -2 });
  assert.equal(an.slot, 'fall');
  let prev = an.update(0.016, { speed: 0, grounded: true, vy: 0 });
  for (let i = 0; i < 30; i++) { const p = an.update(0.016, { speed: 0, grounded: true, vy: 0 }); assert.ok(maxDiff(prev, p) < 0.3, 'no snap while fading'); prev = p; }
});

test('a one-off move plays on top, ends by itself, and a tool swing keeps playing while walking', () => {
  const an = new Animator();
  an.play(animById('wave'));
  assert.equal(an.playing?.id, 'wave');
  an.update(0.3, { speed: 0, grounded: true, vy: 0 });
  assert.equal(an.playing?.id, 'wave');
  an.update(0.1, { speed: 3, grounded: true, vy: 0 });
  assert.equal(an.playing, null, 'walking away stops a wave');
  an.play(animById('swing'));
  const p = an.update(0.15, { speed: 3, grounded: true, vy: 0 });
  assert.equal((an.playing as { id: string } | null)?.id, 'swing');
  assert.ok(p.bones.armR.rx > 0.5, 'the right arm is up in the wind-up');
  for (let i = 0; i < 20; i++) an.update(0.05, { speed: 3, grounded: true, vy: 0 });
  assert.equal(an.playing, null, 'the swing ended by itself');
});

test('presets normalise junk, keep their style defaults, and round-trip through their params', () => {
  const n = normalizeAnim({ style: 'run', cadence: -3, legSwing: 900, loop: 'x' }, 'fast');
  assert.equal(n.style, 'run');
  assert.equal(n.cadence, 0);
  assert.equal(n.legSwing, 180);
  assert.equal(n.loop, animById('run').loop);
  assert.equal(normalizeAnim(null).style, 'walk');
  for (const p of ANIMATIONS) assert.deepEqual(normalizeAnim({ ...animToParams(p), id: p.id, name: p.name }), p);
  assert.equal(new Set(ANIMATIONS.map((p) => p.id)).size, ANIMATIONS.length);
  for (const v of ANIM_VARIABLES) assert.ok(v.label && v.doc, v.key);
});

test('blendPose hits both ends', () => {
  const a = poseAt(animById('walk'), 0.2), b = poseAt(animById('run'), 0.4);
  assert.deepEqual(blendPose(a, b, 0), a);
  assert.ok(maxDiff(blendPose(a, b, 1), b) < 1e-12);
});

test('the stick figure stays inside its box for every ready-made move', () => {
  for (const p of ANIMATIONS) {
    for (let t = 0; t < Math.max(1, p.duration); t += 0.05) {
      const f = stickFigure(poseAt(p, t));
      for (const s of f.segments) for (const v of [s.x1, s.y1, s.x2, s.y2]) assert.ok(v > -0.2 && v < 1.2, `${p.id} at ${t}: ${v}`);
    }
  }
});
