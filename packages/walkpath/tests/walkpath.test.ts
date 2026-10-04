import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleTime, legs, pathLength, samplePath, walkerAt, type PathMode, type Vec3, type WalkPath } from '../src/index';
const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const nearV = (a: Vec3, b: Vec3, e = 1e-9): void => { near(a[0], b[0], e); near(a[1], b[1], e); near(a[2], b[2], e); };
const P = (mode: PathMode): WalkPath => ({ points: [{ pos: [0, 0, 0], wait: 1 }, { pos: [4, 0, 0], wait: 0 }, { pos: [4, 0, 3], wait: 2 }], mode, speed: 2, smooth: false });

test('legs, lengths and times of each mode', () => {
  assert.deepEqual(legs(P('once')).map((l) => [l.from, l.to, l.length]), [[0, 1, 4], [1, 2, 3]]);
  near(pathLength(P('once')), 7); near(cycleTime(P('once')), 6.5);
  near(pathLength(P('loop')), 12); near(cycleTime(P('loop')), 9);
  assert.deepEqual(legs(P('ping-pong')).map((l) => [l.from, l.to]), [[0, 1], [1, 2], [2, 1], [1, 0]]);
  near(pathLength(P('ping-pong')), 14); near(cycleTime(P('ping-pong')), 10);
});
test('once: waits, walks, turns, waits, is done', () => {
  const p = P('once');
  let s = walkerAt(p, 0.5); nearV(s.pos, [0, 0, 0]); assert.equal(s.moving, false); near(s.yaw, 90);
  s = walkerAt(p, 2); nearV(s.pos, [2, 0, 0]); assert.equal(s.moving, true); near(s.yaw, 90);
  s = walkerAt(p, 3.75); nearV(s.pos, [4, 0, 1.5]); near(s.yaw, 0);
  s = walkerAt(p, 5); nearV(s.pos, [4, 0, 3]); assert.equal(s.moving, false); assert.equal(s.done, false);
  s = walkerAt(p, 7); nearV(s.pos, [4, 0, 3]); assert.equal(s.done, true);
});
test('loop comes back round; ping-pong comes back the way it went', () => {
  let s = walkerAt(P('loop'), 7.75); nearV(s.pos, [2, 0, 1.5]); near(s.yaw, -126.86989764584402, 1e-6);
  s = walkerAt(P('loop'), 9.5); nearV(s.pos, [0, 0, 0]); assert.equal(s.moving, false);
  s = walkerAt(P('ping-pong'), 9); nearV(s.pos, [2, 0, 0]); near(s.yaw, -90); assert.equal(s.moving, true);
  nearV(walkerAt(P('ping-pong'), 10.5).pos, [0, 0, 0]);
});
test('never faster than its speed', () => {
  const p = P('loop');
  let prev = walkerAt(p, 0).pos;
  for (let i = 1; i <= 2000; i++) { const cur = walkerAt(p, i * 0.01).pos; assert.ok(Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]) <= 2 * 0.01 + 1e-9, String(i)); prev = cur; }
});
test('smooth paths pass through their points and round the corners', () => {
  const line: WalkPath = { points: [{ pos: [0, 0, 0], wait: 0 }, { pos: [2, 0, 0], wait: 0 }, { pos: [4, 0, 0], wait: 0 }], mode: 'once', speed: 1, smooth: true };
  nearV(walkerAt(line, 3).pos, [3, 0, 0], 1e-3);
  const corner: WalkPath = { points: [{ pos: [0, 0, 0], wait: 1 }, { pos: [4, 0, 0], wait: 1 }, { pos: [4, 0, 4], wait: 1 }], mode: 'once', speed: 2, smooth: true };
  nearV(walkerAt(corner, 0.5).pos, [0, 0, 0]);
  nearV(walkerAt(corner, cycleTime(corner) - 0.5).pos, [4, 0, 4]);
  const seg = (p: Vec3, a: Vec3, b: Vec3): number => { const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const u = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); return Math.hypot(ap[0] - u * ab[0], ap[1] - u * ab[1], ap[2] - u * ab[2]); };
  const off = samplePath(corner, 0.25).map((q) => Math.min(seg(q, [0, 0, 0], [4, 0, 0]), seg(q, [4, 0, 0], [4, 0, 4])));
  assert.ok(Math.max(...off) > 0.01 && Math.max(...off) < 1.5, String(Math.max(...off)));
  nearV(samplePath(corner, 0.25)[0]!, [0, 0, 0]);
});

// ---- own tests ----
test('one point or zero speed: stands on points[0]', () => {
  const one: WalkPath = { points: [{ pos: [1, 2, 3], wait: 5 }], mode: 'loop', speed: 2, smooth: false };
  assert.deepEqual(legs(one), []); near(pathLength(one), 0); near(cycleTime(one), 0);
  const s = walkerAt(one, 42); nearV(s.pos, [1, 2, 3]); assert.equal(s.moving, false);
  const still = { ...P('loop'), speed: 0 };
  const z = walkerAt(still, 3); nearV(z.pos, [0, 0, 0]); assert.equal(z.moving, false); near(z.yaw, 90);
  assert.deepEqual(samplePath(one, 1), [[1, 2, 3]]);
});
test('negative time counts as 0', () => {
  const s = walkerAt(P('once'), -10); nearV(s.pos, [0, 0, 0]); assert.equal(s.moving, false); assert.equal(s.done, false); near(s.yaw, 90);
  nearV(walkerAt(P('loop'), -3).pos, [0, 0, 0]);
});
test('ping-pong waits at every point on the way back and keeps the last yaw', () => {
  const p: WalkPath = { points: [{ pos: [0, 0, 0], wait: 0 }, { pos: [2, 0, 0], wait: 1 }, { pos: [4, 0, 0], wait: 0 }], mode: 'ping-pong', speed: 1, smooth: false };
  near(cycleTime(p), 10);
  let s = walkerAt(p, 7.5); nearV(s.pos, [2, 0, 0]); assert.equal(s.moving, false); near(s.yaw, -90);
  s = walkerAt(p, 2.5); nearV(s.pos, [2, 0, 0]); assert.equal(s.moving, false); near(s.yaw, 90);
  s = walkerAt(p, 10.5); nearV(s.pos, [0.5, 0, 0]); assert.equal(s.moving, true); near(s.yaw, 90);
});
test('loop and ping-pong periodicity', () => {
  for (const mode of ['loop', 'ping-pong'] as const) {
    const p = P(mode), c = cycleTime(p);
    for (const t of [0.3, 2.2, 4.4, 7.1]) { nearV(walkerAt(p, t).pos, walkerAt(p, t + 3 * c).pos); assert.equal(walkerAt(p, t).moving, walkerAt(p, t + c).moving); }
  }
});
test('samplePath spacing on straight paths', () => {
  const s1 = samplePath(P('once'), 1);
  assert.equal(s1.length, 8); nearV(s1[0]!, [0, 0, 0]); nearV(s1[4]!, [4, 0, 0]); nearV(s1[7]!, [4, 0, 3]);
  const s2 = samplePath(P('once'), 2);
  assert.equal(s2.length, 5); nearV(s2[3]!, [4, 0, 2]); nearV(s2[4]!, [4, 0, 3]);
  const loop = samplePath(P('loop'), 3);
  nearV(loop[loop.length - 1]!, [0, 0, 0]);
});
test('smooth loop closes on itself and smooth legs are longer than straight ones at a corner', () => {
  const sq: WalkPath = { points: [{ pos: [0, 0, 0], wait: 0 }, { pos: [4, 0, 0], wait: 0 }, { pos: [4, 0, 4], wait: 0 }, { pos: [0, 0, 4], wait: 0 }], mode: 'loop', speed: 1, smooth: true };
  const c = cycleTime(sq);
  nearV(walkerAt(sq, c - 1e-6).pos, [0, 0, 0], 1e-4);
  assert.equal(legs(sq).length, 4);
  assert.ok(pathLength(sq) > 16 && pathLength(sq) < 24);
  const corner: WalkPath = { points: [{ pos: [0, 0, 0], wait: 0 }, { pos: [4, 0, 0], wait: 0 }, { pos: [4, 0, 4], wait: 0 }], mode: 'ping-pong', speed: 1, smooth: true };
  const L = legs(corner);
  near(L[0]!.length, L[3]!.length); near(L[1]!.length, L[2]!.length);
  nearV(walkerAt(corner, cycleTime(corner) / 2).pos, [4, 0, 4], 1e-9);
});