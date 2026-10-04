import test from 'node:test';
import assert from 'node:assert/strict';
import { SlowMo, ease, lookYawPitch, orbitShot, sampleTrack, trackDuration, type CamTrack, type Vec3 } from '../src/index';
const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const nearV = (a: Vec3, b: Vec3, e = 1e-9): void => { near(a[0], b[0], e); near(a[1], b[1], e); near(a[2], b[2], e); };
const two: CamTrack = { keys: [{ t: 0, pos: [0, 0, 0], target: [0, 0, 10], fov: 60 }, { t: 2, pos: [10, 0, 0], target: [10, 0, 10], fov: 80 }], ease: 'linear', smooth: false, loop: false };

test('the eases', () => {
  near(ease('linear', 0.5), 0.5); near(ease('in', 0.5), 0.25); near(ease('out', 0.5), 0.75); near(ease('in-out', 0.25), 0.15625);
  near(ease('in', 2), 1); near(ease('out', -1), 0);
});
test('a straight track blends its keys, holds its ends and loops', () => {
  near(trackDuration(two), 2);
  const s = sampleTrack(two, 1); nearV(s.pos, [5, 0, 0]); nearV(s.target, [5, 0, 10]); near(s.fov, 70);
  nearV(sampleTrack(two, -1).pos, [0, 0, 0]); nearV(sampleTrack(two, 5).pos, [10, 0, 0]);
  nearV(sampleTrack({ ...two, loop: true }, 3).pos, [5, 0, 0]);
  nearV(sampleTrack({ ...two, ease: 'in' }, 1).pos, [2.5, 0, 0]);
});
test('a smooth track is a Catmull-Rom through its keys', () => {
  const k = (t: number, pos: Vec3) => ({ t, pos, target: [0, 0, 0] as Vec3, fov: 60 });
  const line: CamTrack = { keys: [k(0, [0, 0, 0]), k(1, [5, 0, 0]), k(2, [10, 0, 0])], ease: 'linear', smooth: true, loop: false };
  nearV(sampleTrack(line, 0.5).pos, [2.5, 0, 0]);
  const corner: CamTrack = { keys: [k(0, [0, 0, 0]), k(1, [10, 0, 0]), k(2, [10, 0, 10])], ease: 'linear', smooth: true, loop: false };
  nearV(sampleTrack(corner, 1).pos, [10, 0, 0]);
  nearV(sampleTrack(corner, 0.5).pos, [5.625, 0, -0.625]);
});
test('the orbit shot goes round its centre', () => {
  const o = orbitShot([0, 0, 0], 10, 5, 8, 0, 1, 50);
  assert.equal(o.keys.length, 9); assert.equal(o.smooth, true); near(o.keys[8]!.t, 8);
  nearV(o.keys[0]!.pos, [0, 5, 10]); nearV(o.keys[2]!.pos, [10, 5, 0], 1e-9); nearV(o.keys[4]!.target, [0, 0, 0]); near(o.keys[3]!.fov, 50);
  nearV(sampleTrack(o, 2).pos, [10, 5, 0], 1e-9);
});
test('looking from one point at another', () => {
  const a = lookYawPitch([0, 0, 0], [1, 0, 1]); near(a.yaw, 45); near(a.pitch, 0);
  const b = lookYawPitch([0, 0, 0], [0, 1, 1]); near(b.yaw, 0); near(b.pitch, 45);
});
test('slow motion ramps in and out', () => {
  const s = new SlowMo();
  near(s.scale, 1); near(s.tick(0.5), 0.5);
  s.setScale(0.25, 0.5);
  near(s.tick(0.25), 0.203125); near(s.scale, 0.625);
  near(s.tick(0.25), 0.109375); near(s.scale, 0.25);
  near(s.tick(1), 0.25);
  s.setScale(1, 0.5); near(s.tick(1), 0.8125); near(s.scale, 1);
  s.setScale(0.5, 0); near(s.tick(1), 0.5);
});

/* ---------------------------------------------------------------- own tests */

test('every ease is clamped, exact at both ends and mirrored about 0.5', () => {
  const kinds = ['linear', 'in', 'out', 'in-out'] as const;
  for (const kind of kinds) {
    near(ease(kind, 0), 0);
    near(ease(kind, 1), 1);
    near(ease(kind, -3), 0);
    near(ease(kind, 7), 1);
  }
  near(ease('out', 0.25), 0.4375);
  near(ease('in', 0.25), 0.0625);
  near(ease('in-out', 0.5), 0.5);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    near(ease('in', u) + ease('out', 1 - u), 1, 1e-12);
    near(ease('in-out', u) + ease('in-out', 1 - u), 1, 1e-12);
  }
});

test('the ease shapes pos, target and fov alike', () => {
  nearV(sampleTrack({ ...two, ease: 'in' }, 1.5).pos, [5.625, 0, 0]);
  near(sampleTrack({ ...two, ease: 'in' }, 1.5).fov, 71.25);
  nearV(sampleTrack({ ...two, ease: 'out' }, 1.5).pos, [9.375, 0, 0]);
  nearV(sampleTrack({ ...two, ease: 'in-out' }, 1).pos, [5, 0, 0]);
});

test('keys off the zero mark still hold, blend and loop', () => {
  const k = (t: number, pos: Vec3) => ({ t, pos, target: [0, 0, 0] as Vec3, fov: 50 });
  const late: CamTrack = { keys: [k(5, [0, 0, 0]), k(10, [10, 0, 0])], ease: 'linear', smooth: false, loop: false };
  near(trackDuration(late), 5);
  nearV(sampleTrack(late, 0).pos, [0, 0, 0]);
  nearV(sampleTrack(late, 7.5).pos, [5, 0, 0]);
  nearV(sampleTrack(late, 99).pos, [10, 0, 0]);
  const looped: CamTrack = { ...late, loop: true };
  nearV(sampleTrack(looped, 15).pos, [0, 0, 0]);
  nearV(sampleTrack(looped, 12.5).pos, [5, 0, 0]);
  nearV(sampleTrack(looped, 2.5).pos, [5, 0, 0]);
});

test('looping wraps both forwards and backwards', () => {
  const k = (t: number, pos: Vec3) => ({ t, pos, target: [0, 0, 0] as Vec3, fov: 60 });
  const tri: CamTrack = { keys: [k(0, [0, 0, 0]), k(1, [10, 0, 0]), k(2, [10, 0, 10])], ease: 'linear', smooth: false, loop: true };
  nearV(sampleTrack(tri, 2).pos, [0, 0, 0]);
  nearV(sampleTrack(tri, -1).pos, [10, 0, 0]);
  nearV(sampleTrack(tri, 3.5).pos, [10, 0, 5]);
  nearV(sampleTrack(tri, 1.5).pos, sampleTrack(tri, 3.5).pos);
});

test('tied key times do not divide by zero', () => {
  const k = (t: number, pos: Vec3, fov: number) => ({ t, pos, target: [0, 0, 1] as Vec3, fov });
  const stuck: CamTrack = { keys: [k(0, [0, 0, 0], 40), k(1, [1, 0, 0], 60), k(1, [9, 0, 0], 80)], ease: 'linear', smooth: false, loop: false };
  const s = sampleTrack(stuck, 1);
  nearV(s.pos, [9, 0, 0]);
  near(s.fov, 80);
});

test('a smooth track arcs past the corner, keeps targets and fov straight', () => {
  const k = (t: number, pos: Vec3, target: Vec3, fov: number) => ({ t, pos, target, fov });
  const arc: CamTrack = {
    keys: [k(0, [0, 0, 0], [0, 0, -1], 40), k(1, [10, 0, 0], [0, 0, 0], 60), k(2, [10, 0, 10], [0, 0, 1], 80)],
    ease: 'linear',
    smooth: true,
    loop: false,
  };
  nearV(sampleTrack(arc, 0).pos, [0, 0, 0]);
  nearV(sampleTrack(arc, 1).pos, [10, 0, 0]);
  nearV(sampleTrack(arc, 2).pos, [10, 0, 10]);
  nearV(sampleTrack(arc, -4).pos, [0, 0, 0]);
  nearV(sampleTrack(arc, 40).pos, [10, 0, 10]);
  const mid = sampleTrack(arc, 1.5);
  nearV(mid.pos, [10.625, 0, 4.375]); // tail mirrored to 2 p[n-1] - p[n-2] = [10, 0, 20]
  nearV(mid.target, [0, 0, 0.5]);
  near(mid.fov, 70);
  nearV(sampleTrack(arc, 0.5).target, [0, 0, -0.5]); // smoothed pos, straight target
});

test('a two-key smooth track mirrors both ends and stays straight', () => {
  const k = (t: number, pos: Vec3) => ({ t, pos, target: [0, 0, 0] as Vec3, fov: 50 });
  const track: CamTrack = { keys: [k(0, [0, 0, 0]), k(1, [10, 0, 0])], ease: 'linear', smooth: true, loop: false };
  nearV(sampleTrack(track, 0.25).pos, [2.5, 0, 0]);
  nearV(sampleTrack(track, 0.5).pos, [5, 0, 0]);
  nearV(sampleTrack(track, 0.75).pos, [7.5, 0, 0]);
});

test('an empty track is a still zero shot and a lone key is held forever', () => {
  const empty: CamTrack = { keys: [], ease: 'linear', smooth: false, loop: false };
  assert.equal(trackDuration(empty), 0);
  const e = sampleTrack(empty, 3);
  nearV(e.pos, [0, 0, 0]); nearV(e.target, [0, 0, 0]); near(e.fov, 0);

  const one: CamTrack = { keys: [{ t: 4, pos: [1, 2, 3], target: [9, 9, 9], fov: 40 }], ease: 'in-out', smooth: true, loop: true };
  assert.equal(trackDuration(one), 0);
  for (const t of [-7, 4, 99]) {
    const s = sampleTrack(one, t);
    nearV(s.pos, [1, 2, 3]);
    nearV(s.target, [9, 9, 9]);
    near(s.fov, 40);
  }
});

test('a sampled shot is a copy, never the key itself', () => {
  const src: CamTrack = {
    keys: [
      { t: 0, pos: [1, 1, 1], target: [2, 2, 2], fov: 30 },
      { t: 1, pos: [3, 3, 3], target: [4, 4, 4], fov: 40 },
    ],
    ease: 'linear',
    smooth: false,
    loop: false,
  };
  const s = sampleTrack(src, 0);
  s.pos[0] = 99;
  s.target[0] = 99;
  nearV(src.keys[0]!.pos, [1, 1, 1]);
  nearV(src.keys[0]!.target, [2, 2, 2]);
});

test('the orbit keeps its radius, height, centre and lens all the way round', () => {
  const c: Vec3 = [2, 3, 4];
  const o = orbitShot(c, 5, -1.5, 4, 90, 2, 35);
  assert.equal(o.keys.length, 17);
  assert.equal(o.ease, 'linear');
  assert.equal(o.smooth, true);
  assert.equal(o.loop, false);
  near(trackDuration(o), 4);
  near(o.keys[16]!.t, 4);
  near(o.keys[16]!.t - o.keys[15]!.t, 0.25);
  for (const key of o.keys) {
    near(Math.hypot(key.pos[0] - c[0], key.pos[2] - c[2]), 5, 1e-9);
    near(key.pos[1], 1.5);
    nearV(key.target, c);
    near(key.fov, 35);
  }
  nearV(o.keys[0]!.pos, [7, 1.5, 4], 1e-9); // startDeg 90: sin 1, cos 0
  nearV(o.keys[0]!.pos, o.keys[8]!.pos, 1e-9); // a full turn returns to the start
  nearV(o.keys[0]!.pos, o.keys[16]!.pos, 1e-9);
  nearV(sampleTrack(o, 0).pos, o.keys[0]!.pos);
  nearV(sampleTrack(o, 4).target, c);
});

test('an orbit of no turns is one key, and a fractional orbit rounds its steps', () => {
  const flat = orbitShot([0, 0, 0], 1, 0, 3, 0, 0, 50);
  assert.equal(flat.keys.length, 1);
  nearV(flat.keys[0]!.pos, [0, 0, 1]);
  near(flat.keys[0]!.t, 0);
  nearV(sampleTrack(flat, 12).pos, [0, 0, 1]);

  const half = orbitShot([0, 0, 0], 2, 0, 2, 0, 0.5, 50);
  assert.equal(half.keys.length, 5);
  near(half.keys[4]!.t, 2);
  nearV(half.keys[2]!.pos, [2, 0, 0], 1e-9);
});

test('yaw runs from -180 to 180 and pitch measures elevation', () => {
  const back = lookYawPitch([0, 0, 0], [0, 0, -4]);
  near(back.yaw, 180); near(back.pitch, 0);
  const left = lookYawPitch([0, 0, 0], [-1, 0, 1]);
  near(left.yaw, -45); near(left.pitch, 0);
  const east = lookYawPitch([0, 0, 0], [3, 0, 0]);
  near(east.yaw, 90);
  const sky = lookYawPitch([1, 1, 1], [1, 5, 1]);
  near(sky.yaw, 0); near(sky.pitch, 90);
  const pit = lookYawPitch([1, 2, 3], [1, -3, 3]);
  near(pit.yaw, 0); near(pit.pitch, -90);
  const iso = lookYawPitch([1, 1, 1], [2, 2, 2]);
  near(iso.yaw, 45); near(iso.pitch, 35.264389682754654, 1e-9);
  const same = lookYawPitch([5, 5, 5], [5, 5, 5]);
  near(same.yaw, 0); near(same.pitch, 0);
});

test('a look-at agrees with where the orbit camera is pointing', () => {
  const o = orbitShot([0, 0, 0], 10, 5, 8, 20, 1, 50);
  for (const key of o.keys) {
    const a = lookYawPitch(key.pos, key.target);
    const dx = key.target[0] - key.pos[0];
    const dz = key.target[2] - key.pos[2];
    near(a.yaw, Math.atan2(dx, dz) * (180 / Math.PI), 1e-12);
    near(a.pitch, Math.atan2(-5, Math.hypot(dx, dz)) * (180 / Math.PI), 1e-12);
    assert.ok(a.pitch < 0); // orbiting above the subject always looks down
  }
});

test('a ramp ending mid-step spends the rest of the step at the new scale', () => {
  const s = new SlowMo();
  s.setScale(0.5, 1);
  near(s.tick(0.5), 0.4375); near(s.scale, 0.75);
  near(s.tick(0.5), 0.3125); near(s.scale, 0.5);
  near(s.tick(2), 1); near(s.scale, 0.5);
  s.setScale(0.5, 0); near(s.tick(1), 0.5);
});

test('retargeting mid-ramp walks from wherever the scale got to', () => {
  const s = new SlowMo();
  s.setScale(0, 2);
  near(s.tick(1), 0.75); near(s.scale, 0.5);
  s.setScale(2, 1);
  near(s.tick(1), 1.25); near(s.scale, 2);
  near(s.tick(0.5), 1); near(s.scale, 2);
});

test('a zero-length ramp snaps at once, even mid-ramp', () => {
  const s = new SlowMo();
  s.setScale(0.2, 2);
  near(s.tick(0.5), 0.45); near(s.scale, 0.8);
  s.setScale(1, 0);
  near(s.scale, 1);
  near(s.tick(1), 1);
  s.setScale(0.25, 0);
  near(s.tick(3), 0.75);
});

test('ramping up to double speed passes twice the game time', () => {
  const s = new SlowMo();
  s.setScale(2, 1);
  near(s.tick(0.5), 0.625); near(s.scale, 1.5);
  near(s.tick(0.5), 0.875); near(s.scale, 2);
  near(s.tick(1), 2);
});

test('dead steps cost nothing and leave the ramp alone', () => {
  const s = new SlowMo();
  s.setScale(0.2, 1);
  near(s.tick(0), 0); near(s.scale, 1);
  near(s.tick(-0.5), 0); near(s.scale, 1);
  near(s.tick(0.5), 0.4); near(s.scale, 0.6);
  near(s.tick(0.5), 0.2); near(s.scale, 0.2);
  near(s.tick(4), 0.8);
});

test('the trapezoid step rule integrates a linear ramp exactly', () => {
  const s = new SlowMo();
  s.setScale(0.25, 0.5);
  let game = 0;
  for (let i = 0; i < 5; i++) game += s.tick(0.1);
  near(game, 0.3125, 1e-12);
  near(s.scale, 0.25, 1e-12);
  const exact = 1 * 0.5 - 0.5 * 0.75 * 0.5; // area under scale(t) = 1 - 1.5 t over 0..0.5
  near(game, exact, 1e-12);
});

test('a fresh clock runs at one speed', () => {
  const s = new SlowMo();
  near(s.scale, 1);
  near(s.tick(1 / 60), 1 / 60);
  near(s.tick(0), 0);
  near(s.scale, 1);
});