import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_ANIMS, TOOL_IDS, check, sample, useAt } from '../src/index';
import { blend, restPose } from '../src/index';
import type { Channel, Key, Pose, ToolAnim, ToolId } from '../src/index';

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

// ---- helpers --------------------------------------------------------------------------------

const BONES = ['body', 'head', 'armL', 'armR', 'legL', 'legR'] as const;
const P = (id: ToolId, t: number): Pose => useAt(TOOL_ANIMS[id], t);
const keysOf = (id: ToolId, ch: Channel): readonly Key[] => TOOL_ANIMS[id].use.tracks[ch] ?? [];

function closeTo(actual: number, expected: number, eps = 1e-9, msg = ''): void {
  assert.ok(Math.abs(actual - expected) <= eps, `${msg} expected ${expected}, got ${actual}`);
}
function run(f: (t: number) => number, t0: number, t1: number): number[] {
  const out: number[] = [];
  const n = Math.round((t1 - t0) / 0.005);
  for (let i = 0; i <= n; i++) out.push(f(t0 + i * 0.005));
  return out;
}
/** Strict local maxima above `min`. */
function peaks(v: readonly number[], min: number): number {
  let n = 0;
  for (let i = 1; i < v.length - 1; i++) {
    const c = v[i], p = v[i - 1], q = v[i + 1];
    if (c !== undefined && p !== undefined && q !== undefined && c > p && c > q && c > min) n++;
  }
  return n;
}
/** Strict local minima below `max`. */
function troughs(v: readonly number[], max: number): number {
  return peaks(v.map((x) => -x), -max);
}
function crossings(v: readonly number[], mid: number): number {
  let n = 0;
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1], b = v[i];
    if (a !== undefined && b !== undefined && (a - mid) * (b - mid) < 0) n++;
  }
  return n;
}
const range = (v: readonly number[]): number => Math.max(...v) - Math.min(...v);
const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ---- sample, blend, restPose ----------------------------------------------------------------

test('sample: clamping, smoothstep, step, degenerate input', () => {
  const lin: Key[] = [{ t: 1, v: 10, ease: 'linear' }, { t: 3, v: 20, ease: 'linear' }];
  assert.equal(sample(lin, 0), 10);
  assert.equal(sample(lin, 1), 10);
  assert.equal(sample(lin, 2), 15);
  assert.equal(sample(lin, 3), 20);
  assert.equal(sample(lin, 99), 20);
  const sm: Key[] = [{ t: 0, v: 0, ease: 'smooth' }, { t: 1, v: 1, ease: 'smooth' }];
  closeTo(sample(sm, 0.5), 0.5);
  closeTo(sample(sm, 0.25), 0.15625);
  closeTo(sample(sm, 0.75), 0.84375);
  const st: Key[] = [{ t: 0, v: 1, ease: 'step' }, { t: 1, v: 5, ease: 'step' }, { t: 2, v: 9, ease: 'linear' }];
  assert.equal(sample(st, 0.99), 1);
  assert.equal(sample(st, 1), 5);
  assert.equal(sample(st, 1.99), 5);
  assert.equal(sample(st, 2), 9);
  const one: Key[] = [{ t: 0.5, v: 7, ease: 'smooth' }];
  assert.equal(sample(one, 0), 7);
  assert.equal(sample(one, 9), 7);
  assert.equal(sample([], 1), 0);
});
test('sample: mixed eases pick the ease of the key you just passed', () => {
  const k: Key[] = [
    { t: 0, v: 0, ease: 'linear' },
    { t: 1, v: 1, ease: 'smooth' },
    { t: 2, v: 3, ease: 'linear' },
  ];
  closeTo(sample(k, 0.25), 0.25);
  closeTo(sample(k, 1.25), 1 + 2 * 0.15625);
});
test('restPose is all zero and a fresh object every time', () => {
  const a = restPose(), b = restPose();
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.bones, b.bones);
  a.bones.armR.rx = 1;
  assert.equal(b.bones.armR.rx, 0);
  assert.equal(b.lift, 0);
  assert.equal(b.lean, 0);
  for (const bone of BONES) assert.deepEqual(b.bones[bone], { rx: 0, ry: 0, rz: 0 });
});
test('blend at 0, 0.5 and 1', () => {
  const a = restPose();
  const b = restPose();
  b.lift = 0.4; b.lean = 0.2; b.bones.armR.rx = 2; b.bones.head.ry = -1; b.bones.legL.rz = 0.6;
  const before = copy(b);
  assert.deepEqual(blend(a, b, 0), a);
  assert.deepEqual(blend(a, b, 1), b);
  const m = blend(a, b, 0.5);
  closeTo(m.lift, 0.2); closeTo(m.lean, 0.1);
  closeTo(m.bones.armR.rx, 1); closeTo(m.bones.head.ry, -0.5); closeTo(m.bones.legL.rz, 0.3);
  closeTo(m.bones.body.rx, 0);
  assert.deepEqual(b, before, 'inputs are not mutated');
  assert.deepEqual(a, restPose(), 'inputs are not mutated');
  assert.notStrictEqual(blend(a, b, 0), a, 'blend returns a new pose');
});
test('blend between two real holds', () => {
  const a = TOOL_ANIMS.magnet.hold, b = TOOL_ANIMS.zapGun.hold;
  closeTo(blend(a, b, 0.5).bones.armR.rx, (a.bones.armR.rx + b.bones.armR.rx) / 2);
});

// ---- useAt and check ------------------------------------------------------------------------

test('every tool: whole pose is back at the hold at both ends, time is clamped, hold is untouched', () => {
  for (const id of TOOL_IDS) {
    const a = TOOL_ANIMS[id];
    const snapshot = copy(a.hold);
    for (const t of [0, a.use.duration]) {
      const p = useAt(a, t);
      for (const bone of BONES) {
        for (const axis of ['rx', 'ry', 'rz'] as const) {
          assert.ok(Math.abs(p.bones[bone][axis] - a.hold.bones[bone][axis]) <= 0.02, `${id} ${bone}.${axis} @${t}`);
        }
      }
      assert.ok(Math.abs(p.lift - a.hold.lift) <= 0.02, `${id} lift`);
      assert.ok(Math.abs(p.lean - a.hold.lean) <= 0.02, `${id} lean`);
    }
    assert.deepEqual(useAt(a, -5), useAt(a, 0), id);
    assert.deepEqual(useAt(a, 99), useAt(a, a.use.duration), id);
    assert.deepEqual(a.hold, snapshot, `${id} hold mutated`);
  }
});
test('tool table is consistent and every clip has anticipation time before the hit', () => {
  assert.deepEqual([...TOOL_IDS].sort(), Object.keys(TOOL_ANIMS).sort());
  assert.equal(new Set(TOOL_IDS).size, 11);
  const names = new Set<string>();
  for (const id of TOOL_IDS) {
    const a = TOOL_ANIMS[id];
    assert.equal(a.id, id);
    assert.ok(a.name.length > 0);
    names.add(a.name);
    assert.ok(a.hitAt >= 0.25, `${id} needs a wind-up before the hit`);
    assert.ok(a.hitAt <= a.use.duration - 0.5, `${id} needs follow-through after the hit`);
    assert.ok(a.use.duration >= 1 && a.use.duration <= 3, `${id} duration`);
    assert.ok(Object.keys(a.use.tracks).length >= 4, `${id} should animate a handful of channels`);
  }
  assert.equal(names.size, 11);
});
test('unlisted channels stay at the hold pose', () => {
  const a = TOOL_ANIMS.camera;
  const p = useAt(a, a.hitAt);
  assert.equal(p.bones.armR.ry, a.hold.bones.armR.ry);
  assert.equal(p.bones.legL.rz, a.hold.bones.legL.rz);
  assert.equal(p.bones.body.rx, a.hold.bones.body.rx);
});
test('check reports each kind of problem', () => {
  const base = TOOL_ANIMS.magnet;
  const make = (tracks: ToolAnim['use']['tracks'], hitAt = base.hitAt, duration = 1): ToolAnim => ({
    ...base, hitAt, use: { duration, tracks },
  });
  const hv = base.hold.bones.armR.rx;
  const has = (a: ToolAnim, re: RegExp): boolean => check(a).some((s) => re.test(s));
  const good: Key[] = [{ t: 0, v: hv, ease: 'smooth' }, { t: 1, v: hv, ease: 'smooth' }];

  assert.deepEqual(check(make({ 'armR.rx': good })), []);
  assert.ok(has(make({ 'armR.rx': [{ t: 0, v: hv, ease: 'smooth' }, { t: 0.6, v: 1, ease: 'smooth' }, { t: 0.4, v: 1, ease: 'smooth' }, { t: 1, v: hv, ease: 'smooth' }] }), /out of time order/));
  assert.ok(has(make({ 'armR.rx': [{ t: 0, v: hv, ease: 'smooth' }, { t: 1.5, v: hv, ease: 'smooth' }] }), /outside 0\.\.duration/));
  assert.ok(has(make({ 'armR.rx': [{ t: -0.1, v: hv, ease: 'smooth' }, { t: 1, v: hv, ease: 'smooth' }] }), /outside 0\.\.duration/));
  assert.ok(has(make({ 'head.rx': [{ t: 0, v: 0, ease: 'smooth' }, { t: 0.5, v: 2.7, ease: 'smooth' }, { t: 1, v: 0, ease: 'smooth' }] }), /beyond ±2\.6/));
  assert.ok(has(make({ 'head.rx': [{ t: 0, v: 0, ease: 'smooth' }, { t: 0.5, v: -2.7, ease: 'smooth' }, { t: 1, v: 0, ease: 'smooth' }] }), /beyond ±2\.6/));
  assert.ok(has(make({ lift: [{ t: 0, v: 0, ease: 'smooth' }, { t: 0.5, v: 0.6, ease: 'smooth' }, { t: 1, v: 0, ease: 'smooth' }] }), /lift.*beyond 0\.\.0\.5/));
  assert.ok(has(make({ lift: [{ t: 0, v: 0, ease: 'smooth' }, { t: 0.5, v: -0.1, ease: 'smooth' }, { t: 1, v: 0, ease: 'smooth' }] }), /lift.*beyond 0\.\.0\.5/));
  assert.ok(has(make({ 'armR.rx': good }, 1.2), /hitAt/));
  assert.ok(has(make({ 'armR.rx': good }, -0.1), /hitAt/));
  assert.ok(has(make({ 'armR.rx': [{ t: 0, v: hv + 0.5, ease: 'smooth' }, { t: 1, v: hv, ease: 'smooth' }] }), /first value.*hold pose/));
  assert.ok(has(make({ 'armR.rx': [{ t: 0, v: hv, ease: 'smooth' }, { t: 1, v: hv - 0.5, ease: 'smooth' }] }), /last value.*hold pose/));
  assert.ok(!has(make({ 'armR.rx': [{ t: 0, v: hv + 0.015, ease: 'smooth' }, { t: 1, v: hv - 0.015, ease: 'smooth' }] }), /hold pose/), 'within 0.02 is allowed');
  const badHold = { ...make({ 'armR.rx': good }), hold: copy(base.hold) };
  badHold.hold.bones.head.ry = 3;
  assert.ok(has(badHold, /hold head\.ry/));
});

// ---- each tool's described motion appears ---------------------------------------------------

test('magnet: points forward, then JERKS back toward the chest, body whips backwards', () => {
  const a = TOOL_ANIMS.magnet;
  const arm = (t: number): number => P('magnet', t).bones.armR.rx;
  assert.ok(arm(0.55) > a.hold.bones.armR.rx + 0.5, 'pointed forward first');
  assert.ok(arm(a.hitAt - 0.12) - arm(a.hitAt) > 1.0, 'a fast drop of the arm at the hit');
  assert.ok(arm(a.hitAt + 0.12) < arm(a.hitAt), 'overshoots past the jerk');
  assert.ok(arm(a.hitAt) < 0.4, 'ends up near the chest');
  assert.ok(P('magnet', 0.62).lean > 0.1 && P('magnet', 0.8).lean < -0.1, 'leans in, then rocks back');
});
test('can: shaken three times fast, then held out spraying with a side-to-side wiggle', () => {
  const a = TOOL_ANIMS.can;
  const rx = run((t) => P('can', t).bones.armR.rx, 0, 0.8);
  assert.equal(peaks(rx, 1.0), 3, 'three shakes');
  assert.ok(range(run((t) => P('can', t).bones.armR.rx, 0, 0.72)) > 0.7, 'shakes are big');
  assert.ok(P('can', a.hitAt).bones.armR.rx > 1.3, 'held out at the hit');
  const wiggle = run((t) => P('can', t).bones.armR.ry, a.hitAt, 1.9);
  assert.ok(crossings(wiggle, 0) >= 3, 'wiggles side to side');
  assert.ok(range(wiggle) < 0.6, 'but only a small wiggle');
  assert.ok(crossings(run((t) => P('can', t).bones.body.ry, a.hitAt, 1.9), 0) >= 3, 'body wiggles too');
});
test('rollingPin: both arms forward, two rolls forward and back, leaning in', () => {
  const rx = run((t) => P('rollingPin', t).bones.armR.rx, 0, 2.4);
  assert.equal(peaks(rx, 1.4), 2, 'two forward rolls');
  assert.ok(troughs(rx, 0.8) >= 2, 'two pulls back');
  const lx = run((t) => P('rollingPin', t).bones.armL.rx, 0, 2.4);
  assert.equal(peaks(lx, 1.4), 2, 'left arm rolls too');
  const lean = run((t) => P('rollingPin', t).lean, 0, 2.4);
  assert.ok(Math.max(...lean) > TOOL_ANIMS.rollingPin.hold.lean + 0.25, 'leans into it');
  const hold = TOOL_ANIMS.rollingPin.hold;
  assert.ok(hold.bones.armR.rx > 0.8 && hold.bones.armL.rx > 0.8, 'both arms forward');
});
test('baton: two quick beats up and down with the head nodding', () => {
  const rx = run((t) => P('baton', t).bones.armR.rx, 0, 1.4);
  assert.equal(troughs(rx, 0.5), 2, 'two downbeats');
  const nod = run((t) => P('baton', t).bones.head.rx, 0, 1.4);
  assert.equal(peaks(nod, 0.2), 2, 'two nods');
  assert.ok(TOOL_ANIMS.baton.use.duration <= 1.6, 'quick');
  const beats = [0.3, 0.6].map((t) => P('baton', t).bones.head.rx);
  assert.ok(beats.every((x) => x > 0.2), 'nod lands on the beats');
});
test('boombox: lifted to the shoulder, slapped by the left hand, small hop', () => {
  const a = TOOL_ANIMS.boombox;
  assert.ok(P('boombox', 0.55).bones.armR.rz > a.hold.bones.armR.rz + 0.4, 'raised toward the shoulder');
  assert.ok(P('boombox', 0.65).bones.armL.rx < -0.3, 'left hand winds back');
  assert.ok(P('boombox', a.hitAt).bones.armL.rx > 1.2, 'left hand slaps forward at the hit');
  const lift = run((t) => P('boombox', t).lift, 0, 1.8);
  const top = Math.max(...lift);
  assert.ok(top > 0.1 && top <= 0.3, 'a small hop');
  assert.equal(lift.indexOf(top) * 0.005 > a.hitAt, true, 'hop comes after the slap');
  assert.ok(P('boombox', a.hitAt).lift < 0.02, 'feet still on the ground at the slap');
});
test('flashlight: raised to eye level and swept left to right', () => {
  assert.ok(P('flashlight', 0.6).bones.armR.rx > 1.3, 'eye level');
  const ry = (t: number): number => P('flashlight', t).bones.body.ry;
  assert.ok(ry(0.7) > 0.3 && ry(1.6) < -0.3, 'twists from one side to the other');
  const sweep = run(ry, 0.7, 1.6);
  for (let i = 1; i < sweep.length; i++) assert.ok((sweep[i] ?? 0) <= (sweep[i - 1] ?? 0) + 1e-9, 'sweep is one direction');
  assert.ok(range(sweep) > 1.0, 'wide sweep');
  assert.ok(P('flashlight', 0.7).bones.head.ry > P('flashlight', 1.6).bones.head.ry + 0.5, 'head follows the beam');
});
test('zapGun: aimed with both hands, recoil kick back on firing, the body rocks', () => {
  const a = TOOL_ANIMS.zapGun;
  assert.ok(P('zapGun', 0.6).bones.armR.rx > 1.3 && P('zapGun', 0.6).bones.armL.rx > 1.3, 'both hands aim');
  assert.ok(P('zapGun', a.hitAt).bones.armR.rx > P('zapGun', 0.6).bones.armR.rx + 0.3, 'muzzle kicks up');
  assert.ok(P('zapGun', 0.65).lean > 0.1 && P('zapGun', 0.74).lean < -0.2, 'body kicks back on firing');
  const lean = run((t) => P('zapGun', t).lean, 0.7, 1.4);
  assert.ok(crossings(lean, 0) >= 2, 'then rocks back and forth');
  assert.ok(Math.min(...run((t) => P('zapGun', t).bones.legR.rx, 0.5, 1.2)) < -0.3, 'rear leg braces');
});
test('camera: lifted to the face with both hands, quick head tilt on the click', () => {
  const a = TOOL_ANIMS.camera;
  assert.ok(P('camera', 0.7).bones.armR.rx > 1.4 && P('camera', 0.7).bones.armL.rx > 1.4, 'both hands at the face');
  assert.ok(Math.abs(P('camera', 0.6).bones.head.rz) < 0.05, 'head level while framing');
  assert.ok(P('camera', a.hitAt).bones.head.rz > 0.3, 'tilt on the click');
  const tilt = run((t) => P('camera', t).bones.head.rz, 0.6, 1.3);
  assert.ok(crossings(tilt, 0) >= 1, 'overshoots back past level');
  assert.ok(P('camera', a.hitAt).bones.armR.rx < P('camera', 0.8).bones.armR.rx, 'finger dips on the click');
});
test('windupKey: three ratchet twists (ry steps), then let go', () => {
  const a = TOOL_ANIMS.windupKey;
  const ks = keysOf('windupKey', 'armR.ry').filter((key) => key.t < 1.65);
  let steps = 0;
  for (let i = 1; i < ks.length; i++) if ((ks[i]?.v ?? 0) - (ks[i - 1]?.v ?? 0) > 0.3) steps++;
  assert.equal(steps, 3, 'three upward steps in armR.ry');
  const ry = (t: number): number => P('windupKey', t).bones.armR.ry;
  closeTo(ry(0.8), 0.6, 1e-9, 'plateau 1');
  closeTo(ry(1.2), 1.2, 1e-9, 'plateau 2');
  closeTo(ry(1.5), 1.8, 1e-9, 'plateau 3');
  closeTo(ry(a.hitAt), 0.6, 1e-9, 'first ratchet at the hit');
  const rises = run(ry, 0.4, 1.6);
  for (let i = 1; i < rises.length; i++) assert.ok((rises[i] ?? 0) >= (rises[i - 1] ?? 0) - 1e-9, 'never unwinds while winding');
  assert.ok(ry(1.72) < 0, 'let go: springs back past zero');
  closeTo(ry(a.use.duration), 0, 0.02);
  assert.ok(P('windupKey', 1.8).lift > 0.05, 'hops when released');
});
test('spade: raised, stabbed down with a foot push on legR, levered back', () => {
  const a = TOOL_ANIMS.spade;
  const arm = (t: number): number => P('spade', t).bones.armR.rx;
  assert.ok(arm(0.7) > 1.9, 'raised high');
  assert.ok(arm(a.hitAt) < 0.5, 'stabbed down at the hit');
  assert.ok(arm(1.6) > arm(1.25) + 0.5, 'levered back');
  const leg = run((t) => P('spade', t).bones.legR.rx, 0, 2.4);
  assert.ok(range(leg) > 0.5, 'legR moves');
  assert.ok(P('spade', 0.8).bones.legR.rx > 0.5, 'foot lifts onto the blade');
  assert.ok(P('spade', 0.7).lean < -0.1 && P('spade', 1.1).lean > 0.3, 'leans back, then drops into it');
});
test('fairyWand: a little circle in the air, then a flick forward with a hop', () => {
  const a = TOOL_ANIMS.fairyWand;
  const rx = run((t) => P('fairyWand', t).bones.armR.rx, 0.3, 1.1);
  const rz = run((t) => P('fairyWand', t).bones.armR.rz, 0.3, 1.1);
  assert.ok(range(rx) > 0.5 && range(rz) > 0.5, 'tip travels in both axes');
  assert.ok(range(rx) < 0.8 && range(rz) < 0.8, 'but only a little circle');
  closeTo(rx[0] ?? 0, rx[rx.length - 1] ?? 1, 0.01, 'circle closes (rx)');
  closeTo(rz[0] ?? 0, rz[rz.length - 1] ?? 1, 0.01, 'circle closes (rz)');
  const ix = rx.indexOf(Math.max(...rx)), iz = rz.indexOf(Math.max(...rz));
  assert.ok(Math.abs(ix - iz) >= 30, 'rx and rz are out of phase (round, not a diagonal)');
  assert.ok(P('fairyWand', a.hitAt).bones.armR.rx > 1.5, 'flick forward at the hit');
  assert.ok(Math.max(...run((t) => P('fairyWand', t).lift, 1.2, 1.6)) > 0.1, 'hop');
  assert.ok(P('fairyWand', a.hitAt).lift > 0.05, 'in the air on the flick');
});