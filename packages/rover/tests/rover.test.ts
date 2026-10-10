import test from 'node:test'; import assert from 'node:assert/strict';
import { spawn, step, speed, hashRover, ROVERS, DT, type Ground, type RoverState, type Input } from '../src/index';
const flat: Ground = { height: () => 0, g: 1.62 };
const run = (s: RoverState, i: Input, n: number, g = flat) => { for (let k = 0; k < n; k++) s = step(s, i, g); return s; };
const idle: Input = { throttle: 0, steer: 0, brake: false };
const fwd = (s: RoverState) => { const [x, y, z, w] = s.q; return [2 * (x * z + w * y), 1 - 2 * (x * x + y * y)] as const; };
test('settles at rest, no jitter', () => {
  for (const k of ['scout', 'hauler', 'crawler'] as const) {
    let s = run(spawn(k, 0, 0, [0, 1], flat), idle, 600); const y = s.p[1]; s = run(s, idle, 60);
    assert.ok(Math.abs(s.p[1] - y) < 1e-3 && Math.hypot(...s.v) < 1e-2 && y > 0.2 && y < 2, `${k} ${y}`);
  }
});
test('top speed, +steer turns right (toward -x), brakes', () => {
  let s = run(run(spawn('scout', 0, 0, [0, 1], flat), idle, 120), { throttle: 1, steer: 0, brake: false }, 720);
  assert.ok(speed(s) > ROVERS.scout.topSpeed * 0.85 && speed(s) <= ROVERS.scout.topSpeed * 1.05, `${speed(s)}`);
  const t = run(s, { throttle: 0.6, steer: 1, brake: false }, 60); assert.ok(fwd(t)[0] < fwd(s)[0] - 0.05, 'turned right');
  s = run(s, { throttle: 0, steer: 0, brake: true }, 900); assert.ok(Math.abs(speed(s)) < 0.3);
});
test('the crawler turns on the spot; a braked hauler holds a 20 degree slope', () => {
  let c = run(spawn('crawler', 0, 0, [0, 1], flat), idle, 300); const p = [...c.p];
  c = run(c, { throttle: 0, steer: 1, brake: false }, 120); assert.ok(Math.hypot(c.p[0] - p[0]!, c.p[2] - p[2]!) < 1 && Math.abs(fwd(c)[0]) > 0.2);
  const slope: Ground = { height: (x) => x * 0.364, g: 1.62 };
  const h = run(spawn('hauler', 0, 0, [0, 1], slope), { throttle: 0, steer: 0, brake: true }, 600, slope);
  assert.ok(h.p[1] > slope.height(h.p[0], h.p[2]) + 0.1 && Math.abs(h.p[0]) < 1.5);
});
test('deterministic, pure, stopped by a wall', () => {
  const go = () => run(spawn('scout', 0, 0, [0, 1], flat), { throttle: 1, steer: 0.3, brake: false }, 900);
  assert.equal(hashRover(go()), hashRover(go()));
  const s0 = spawn('scout', 0, 0, [0, 1], flat), copy = JSON.stringify(s0); step(s0, { throttle: 1, steer: 0, brake: false }, flat); assert.equal(JSON.stringify(s0), copy);
  const walled: Ground = { ...flat, boxes: [{ cx: 0, cz: 12, hx: 6, hz: 0.25, yaw: 0, top: 3 }] };
  assert.ok(run(spawn('scout', 0, 0, [0, 1], walled), { throttle: 1, steer: 0, brake: false }, 480, walled).p[2] < 12); assert.ok(DT > 0.016 && DT < 0.017);
});
test('catalog numbers are exported', () => {
  assert.equal(ROVERS.scout.mass, 400);
  assert.equal(ROVERS.scout.topSpeed, 14);
  assert.equal(ROVERS.hauler.mass, 1600);
  assert.equal(ROVERS.hauler.topSpeed, 9);
  assert.equal(ROVERS.crawler.mass, 4000);
  assert.equal(ROVERS.crawler.topSpeed, 4);
  assert.equal(ROVERS.scout.wheelbase, 2.2);
  assert.equal(ROVERS.scout.track, 1.6);
  assert.equal(ROVERS.hauler.wheelbase, 3.6);
  assert.equal(ROVERS.crawler.length, 4.4);
});
test('reverse drives backward and left steer turns left', () => {
  let s = run(spawn('scout', 0, 0, [0, 1], flat), idle, 60);
  s = run(s, { throttle: -1, steer: 0, brake: false }, 300);
  assert.ok(speed(s) < -1);
  const s2 = run(spawn('scout', 0, 0, [0, 1], flat), idle, 60);
  const f0 = fwd(s2)[0];
  const tl = run(s2, { throttle: 0.6, steer: -1, brake: false }, 60);
  assert.ok(fwd(tl)[0] > f0 + 0.05);
});
test('never tunnels or explodes on bumps', () => {
  const bumps: Ground = { height: (x, z) => (x * x + z * z < 4 ? 0.6 : 0), g: 1.62 };
  let s = spawn('scout', 0, -6, [0, 1], bumps);
  s = run(s, { throttle: 1, steer: 0, brake: false }, 600, bumps);
  assert.ok(Number.isFinite(s.p[0]) && Number.isFinite(s.p[1]) && Number.isFinite(s.p[2]));
  assert.ok(Math.hypot(...s.v) < 30);
  assert.ok(s.p[1] > bumps.height(s.p[0], s.p[2]) + 0.05);
});
