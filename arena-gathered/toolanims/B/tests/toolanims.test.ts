import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_ANIMS, TOOL_IDS, check, sample, useAt, blend, restPose } from '../src/index';
import type { Bone, Channel, Pose, ToolAnim, ToolId } from '../src/index';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type Prop = 'rx' | 'ry' | 'rz';

function val(p: Pose, ch: Channel): number {
  if (ch === 'lift') return p.lift;
  if (ch === 'lean') return p.lean;
  const dot = ch.indexOf('.');
  const bone = ch.slice(0, dot) as Bone;
  const prop = ch.slice(dot + 1) as Prop;
  return p.bones[bone][prop];
}

const anim = (id: ToolId): ToolAnim => TOOL_ANIMS[id];

/** values of one channel across the use clip */
function sweep(id: ToolId, ch: Channel, t0: number, t1: number, steps = 60): number[] {
  const out: number[] = [];
  const a = anim(id);
  for (let i = 0; i <= steps; i++) {
    out.push(val(useAt(a, t0 + ((t1 - t0) * i) / steps), ch));
  }
  return out;
}

const max = (xs: number[]): number => xs.reduce((m, x) => (x > m ? x : m), -Infinity);
const min = (xs: number[]): number => xs.reduce((m, x) => (x < m ? x : m), Infinity);

/** how many local maxima (peaks) the sweep has */
function peaks(xs: number[]): number {
  let n = 0;
  for (let i = 1; i < xs.length - 1; i++) {
    const prev = xs[i - 1];
    const cur = xs[i];
    const next = xs[i + 1];
    if (prev === undefined || cur === undefined || next === undefined) continue;
    if (cur > prev && cur >= next) n++;
  }
  return n;
}

/** how many local minima (dips) the sweep has */
function dips(xs: number[]): number {
  let n = 0;
  for (let i = 1; i < xs.length - 1; i++) {
    const prev = xs[i - 1];
    const cur = xs[i];
    const next = xs[i + 1];
    if (prev === undefined || cur === undefined || next === undefined) continue;
    if (cur < prev && cur <= next) n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* acceptance tests (copied unchanged)                                 */
/* ------------------------------------------------------------------ */

test('eleven tools, all clean', () => {
  assert.equal(TOOL_IDS.length, 11);
  for (const id of TOOL_IDS) assert.deepEqual(check(TOOL_ANIMS[id]), [], id);
});

test('a clip starts and ends at the hold pose', () => {
  for (const id of TOOL_IDS) {
    const a = TOOL_ANIMS[id];
    const s = useAt(a, 0), e = useAt(a, a.use.duration);
    assert.ok(Math.abs(s.bones.armR.rx - a.hold.bones.armR.rx) <= 0.02, id);
    assert.ok(Math.abs(e.bones.armR.rx - a.hold.bones.armR.rx) <= 0.02, id);
  }
});

test('sample', () => {
  const k = [{ t: 0, v: 0, ease: 'linear' as const }, { t: 1, v: 2, ease: 'linear' as const }];
  assert.equal(sample(k, 0.5), 1);
  assert.equal(sample(k, -1), 0);
  assert.equal(sample(k, 5), 2);
});

test('the use moves the right arm somewhere in the middle', () => {
  for (const id of TOOL_IDS) {
    const a = TOOL_ANIMS[id];
    const mid = useAt(a, a.hitAt);
    const d = Math.abs(mid.bones.armR.rx - a.hold.bones.armR.rx) + Math.abs(mid.bones.armR.rz - a.hold.bones.armR.rz) + Math.abs(mid.bones.armR.ry - a.hold.bones.armR.ry) + Math.abs(mid.lift - a.hold.lift) + Math.abs(mid.bones.body.ry - a.hold.bones.body.ry);
    assert.ok(d > 0.1, id);
  }
});

/* ------------------------------------------------------------------ */
/* my own: the player                                                  */
/* ------------------------------------------------------------------ */

test('sample smoothsteps between keys', () => {
  const k = [
    { t: 0, v: 0, ease: 'smooth' as const },
    { t: 1, v: 1, ease: 'smooth' as const },
  ];
  assert.equal(sample(k, 0.5), 0.5);
  assert.equal(sample(k, 0.25), 0.15625);
  assert.equal(sample(k, 0.75), 0.84375);
});

test('sample holds through a step key, then eases to the next', () => {
  const k = [
    { t: 0, v: 0, ease: 'smooth' as const },
    { t: 0.5, v: 1, ease: 'step' as const },
    { t: 1, v: 2, ease: 'smooth' as const },
  ];
  assert.equal(sample(k, 0.25), 0);
  assert.equal(sample(k, 0.99), 1);
  assert.equal(sample(k, 1), 2);
});

test('useAt clamps t to the clip', () => {
  for (const id of TOOL_IDS) {
    const a = anim(id);
    const before = useAt(a, -3);
    const after = useAt(a, a.use.duration + 99);
    assert.ok(Math.abs(before.lift - a.hold.lift) < 1e-9, id);
    assert.ok(Math.abs(after.lift - a.hold.lift) < 1e-9, id);
  }
});

test('blend at 0, 0.5 and 1', () => {
  const a = restPose();
  const b: Pose = {
    bones: {
      body: { rx: 0.2, ry: -0.4, rz: 0.1 },
      head: { rx: -0.6, ry: 0.2, rz: 0 },
      armL: { rx: 1, ry: 0, rz: 0.5 },
      armR: { rx: -1, ry: 0.4, rz: -0.5 },
      legL: { rx: 0.3, ry: 0, rz: 0 },
      legR: { rx: -0.3, ry: 0, rz: 0.2 },
    },
    lift: 0.4,
    lean: -0.5,
  };
  const z = blend(a, b, 0);
  const h = blend(a, b, 0.5);
  const o = blend(a, b, 1);
  assert.equal(z.bones.armR.rx, a.bones.armR.rx);
  assert.equal(z.lift, a.lift);
  assert.equal(o.bones.armR.rx, b.bones.armR.rx);
  assert.equal(o.lean, b.lean);
  assert.equal(h.bones.armR.rx, -0.5);
  assert.equal(h.bones.head.rx, -0.3);
  assert.equal(h.bones.body.ry, -0.2);
  assert.equal(h.lift, 0.2);
  // blending never invents new bones
  for (const id of TOOL_IDS) {
    const p = blend(anim(id).hold, useAt(anim(id), anim(id).hitAt), 0.5);
    for (const bone of ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const) {
      assert.ok(Number.isFinite(p.bones[bone].rx), id);
    }
  }
});

test('hitAt lands inside every clip and on something worth seeing', () => {
  for (const id of TOOL_IDS) {
    const a = anim(id);
    assert.ok(a.hitAt > 0 && a.hitAt < a.use.duration, id);
  }
});

/* ------------------------------------------------------------------ */
/* my own: each tool does what it says on the tin                      */
/* ------------------------------------------------------------------ */

test('magnet points forward then jerks back into the chest', () => {
  const a = anim('magnet');
  const holdRx = a.hold.bones.armR.rx;
  const wind = min(sweep('magnet', 'armR.rx', 0, a.hitAt));
  const hit = val(useAt(a, a.hitAt), 'armR.rx');
  assert.ok(wind < holdRx - 0.2, 'anticipation pushes the magnet further out');
  assert.ok(hit > holdRx + 0.3, 'the jerk pulls it right into the chest');
  assert.ok(val(useAt(a, a.hitAt), 'lean') < a.hold.lean - 0.05, 'he leans back with the weight');
});

test('can shakes three times fast, then wiggles the spray', () => {
  const a = anim('can');
  const shake = sweep('can', 'armR.rx', 0.05, 0.9, 120);
  assert.ok(peaks(shake) >= 3, 'three up-shakes');
  assert.ok(dips(shake) >= 3, 'three down-shakes');
  const wiggle = sweep('can', 'armR.ry', a.hitAt, a.use.duration, 80);
  assert.ok(max(wiggle) - min(wiggle) > 0.3, 'side to side spray wiggle');
  assert.ok(val(useAt(a, a.hitAt), 'armR.rx') < a.hold.bones.armR.rx - 0.2, 'held out');
});

test('rollingPin rolls with both arms and leans into it', () => {
  const a = anim('rollingPin');
  const r = sweep('rollingPin', 'armR.rx', 0, 1.4, 100);
  const l = sweep('rollingPin', 'armL.rx', 0, 1.4, 100);
  assert.ok(peaks(r) + dips(r) >= 4, 'forward and back twice');
  assert.ok(min(r) < a.hold.bones.armR.rx - 0.2, 'right arm reaches further out');
  assert.ok(min(l) < a.hold.bones.armL.rx - 0.1, 'left arm reaches further out');
  assert.ok(max(sweep('rollingPin', 'lean', 0, 1.4)) > a.hold.lean + 0.1, 'body leans in');
});

test('baton beats twice and the head nods twice', () => {
  const nods = sweep('baton', 'head.rx', 0.05, 0.95, 120);
  assert.ok(peaks(nods) >= 2, 'two nods');
  const beats = sweep('baton', 'armR.rx', 0.1, 0.7, 80);
  assert.ok(max(beats) - min(beats) > 0.6, 'two quick beats up and down');
  assert.ok(peaks(beats) >= 2, 'two beat tops');
});

test('boombox is slapped by the left hand and the goblin hops', () => {
  const a = anim('boombox');
  const hit = useAt(a, a.hitAt);
  assert.ok(hit.bones.armL.rx < a.hold.bones.armL.rx - 1.0, 'left hand slaps down on it');
  assert.ok(hit.bones.armR.rx < a.hold.bones.armR.rx - 1.0, 'box up at the shoulder');
  assert.ok(max(sweep('boombox', 'lift', a.hitAt, a.use.duration)) > 0.08, 'small hop');
  assert.ok(min(sweep('boombox', 'legL.rx', a.hitAt, a.use.duration)) < -0.3, 'feet tuck on the hop');
});

test('flashlight is raised to the eyes and swept left to right', () => {
  const a = anim('flashlight');
  const hit = useAt(a, a.hitAt);
  assert.ok(hit.bones.armR.rx < a.hold.bones.armR.rx - 0.6, 'up to eye level');
  const turn = sweep('flashlight', 'armR.ry', 0.4, 1.3, 80);
  assert.ok(max(turn) - min(turn) > 0.9, 'a wide sweep');
  assert.ok(min(turn) < -0.3 && max(turn) > 0.3, 'left then right');
  assert.ok(Math.abs(val(useAt(a, a.hitAt), 'body.ry') - a.hold.bones.body.ry) > 0.05, 'body follows');
});

test('zapGun aims with both hands and recoils twice', () => {
  const a = anim('zapGun');
  const aimed = useAt(a, 0.5);
  assert.ok(aimed.bones.armR.rx < a.hold.bones.armR.rx - 0.7, 'right arm out');
  assert.ok(aimed.bones.armL.rx < a.hold.bones.armL.rx - 0.7, 'left hand on the grip');
  const back = sweep('zapGun', 'lean', 0.8, 1.6, 60);
  assert.ok(min(back) < a.hold.lean - 0.1, 'the body rocks back');
  assert.ok(dips(back) >= 2, 'kick, then a second kick');
});

test('camera comes up with both hands and the head clicks sideways', () => {
  const a = anim('camera');
  const hit = useAt(a, a.hitAt);
  assert.ok(hit.bones.armR.rx < -1.3, 'right hand up');
  assert.ok(hit.bones.armL.rx < -1.2, 'left hand up');
  assert.ok(hit.bones.armR.rz < 0.1, 'elbows tucked in to the face');
  const tilt = sweep('camera', 'head.rz', 0.8, 1.2, 60);
  assert.ok(max(tilt) > 0.15, 'a quick head tilt on the click');
});

test('windupKey turns in three ratchet steps then lets go', () => {
  const a = anim('windupKey');
  const holdRy = a.hold.bones.armR.ry;
  const clicks = [0.3, 0.7, 1.1].map((t) => val(useAt(a, t), 'armR.ry'));
  assert.ok(peaks(sweep('windupKey', 'armR.ry', 0.2, 1.3, 120)) >= 3, 'three ratchet turns');
  assert.ok(clicks[0] !== undefined && clicks[1] !== undefined && clicks[2] !== undefined);
  assert.ok(clicks[0] > holdRy + 0.3, 'first turn');
  assert.ok(clicks[1] > clicks[0] + 0.2, 'second turn is further');
  assert.ok(clicks[2] > clicks[1] + 0.2, 'third turn is further still');
  const released = val(useAt(a, a.use.duration - 0.05), 'armR.ry');
  assert.ok(Math.abs(released - holdRy) < 0.2, 'the key springs back when let go');
});

test('spade raises, stabs down with a right foot push, then levers back', () => {
  const a = anim('spade');
  const raise = min(sweep('spade', 'armR.rx', 0.2, 0.75, 60));
  assert.ok(raise < a.hold.bones.armR.rx - 1.0, 'raised high first');
  const hit = useAt(a, a.hitAt);
  assert.ok(hit.bones.armR.rx > a.hold.bones.armR.rx + 0.2, 'stabbed down');
  assert.ok(hit.bones.legR.rx < -0.4, 'the right foot pushes off');
  assert.ok(Math.abs(hit.bones.legL.rx) < Math.abs(hit.bones.legR.rx), 'only one foot does the work');
  assert.ok(val(useAt(a, 1.6), 'armR.rx') < a.hold.bones.armR.rx - 0.3, 'levered back up');
  assert.ok(val(useAt(a, a.hitAt), 'lean') > a.hold.lean + 0.1, 'weight goes into the stab');
});

test('fairyWand draws a little circle then flicks forward with a hop', () => {
  const a = anim('fairyWand');
  const loop = sweep('fairyWand', 'armR.ry', 0.25, 0.95, 90);
  assert.ok(peaks(loop) >= 2 && dips(loop) >= 1, 'the wand goes round in a circle');
  const hit = useAt(a, a.hitAt);
  assert.ok(hit.bones.armR.rx > a.hold.bones.armR.rx + 0.2, 'flicked forward');
  assert.ok(max(sweep('fairyWand', 'lift', a.hitAt, a.use.duration)) > 0.1, 'a hop on the flick');
  assert.ok(min(sweep('fairyWand', 'legL.rx', a.hitAt, a.use.duration)) < -0.2, 'feet leave the floor');
});