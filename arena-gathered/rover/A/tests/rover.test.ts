import test from 'node:test'; import assert from 'node:assert/strict';
import { spawn, step, speed, hashRover, ROVERS, DT, type Ground, type RoverState, type Input } from '../src/rover';
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

// ---------------------------------------------------------------------------
// Additional tests (own). Given tests above are kept unchanged.
// ---------------------------------------------------------------------------

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const upOf = (s: RoverState) => {
  const [x, y, z, w] = s.q;
  return [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)] as const;
};

test('the catalog numbers are the published ones', () => {
  assert.deepEqual(
    { wheels: ROVERS.scout.wheels, mass: ROVERS.scout.mass, wheelbase: ROVERS.scout.wheelbase, track: ROVERS.scout.track, wheelRadius: ROVERS.scout.wheelRadius, topSpeed: ROVERS.scout.topSpeed, maxSteer: ROVERS.scout.maxSteer, tracked: ROVERS.scout.tracked },
    { wheels: 4, mass: 400, wheelbase: 2.2, track: 1.6, wheelRadius: 0.45, topSpeed: 14, maxSteer: 0.5, tracked: false },
  );
  assert.deepEqual(
    { wheels: ROVERS.hauler.wheels, mass: ROVERS.hauler.mass, wheelbase: ROVERS.hauler.wheelbase, track: ROVERS.hauler.track, wheelRadius: ROVERS.hauler.wheelRadius, topSpeed: ROVERS.hauler.topSpeed, maxSteer: ROVERS.hauler.maxSteer, tracked: ROVERS.hauler.tracked },
    { wheels: 6, mass: 1600, wheelbase: 3.6, track: 2.0, wheelRadius: 0.55, topSpeed: 9, maxSteer: 0.4, tracked: false },
  );
  assert.deepEqual(
    { wheels: ROVERS.crawler.wheels, mass: ROVERS.crawler.mass, length: ROVERS.crawler.length, track: ROVERS.crawler.track, topSpeed: ROVERS.crawler.topSpeed, tracked: ROVERS.crawler.tracked },
    { wheels: 8, mass: 4000, length: 4.4, track: 2.4, topSpeed: 4, tracked: true },
  );
});

test('spawn respects heading, rests level, and matches the terrain tilt', () => {
  const a = spawn('scout', 2, 3, [0, 1], flat);
  near(fwd(a)[0], 0); near(fwd(a)[1], 1);
  assert.deepEqual(a.v, [0, 0, 0]); assert.deepEqual(a.w, [0, 0, 0]);
  assert.ok(a.p[1] > 0.2 && a.p[1] < 2);
  const b = spawn('scout', 2, 3, [1, 0], flat);
  near(fwd(b)[0], 1); near(fwd(b)[1], 0);
  assert.ok(Math.abs(Math.hypot(...b.q) - 1) < 1e-12, 'unit quaternion');
  const slope: Ground = { height: (x) => x * 0.364, g: 1.62 };
  const c = spawn('hauler', 0, 0, [0, 1], slope);
  const up = upOf(c);
  near(up[0] / up[1], -0.364, 0.01); // leans 20 deg toward -x
  near(up[2], 0, 0.01);
});

test('every rover reaches, and never exceeds, its top speed', () => {
  for (const k of ['scout', 'hauler', 'crawler'] as const) {
    let s = run(spawn(k, 0, 0, [0, 1], flat), idle, 60);
    s = run(s, { throttle: 1, steer: 0, brake: false }, 1800);
    const v = speed(s);
    assert.ok(v > ROVERS[k].topSpeed * 0.9 && v <= ROVERS[k].topSpeed * 1.001, `${k} ${v}`);
  }
});

test('reverse drive works and speed() is signed', () => {
  const s = run(spawn('scout', 0, 0, [0, 1], flat), { throttle: -1, steer: 0, brake: false }, 900);
  assert.ok(speed(s) < 0 && speed(s) >= -ROVERS.scout.topSpeed * 1.05, `${speed(s)}`);
  assert.ok(s.p[2] < -10, 'actually backed up');
});

test('a braked rover comes to a clean stop and stays stopped', () => {
  let s = run(spawn('scout', 0, 0, [0, 1], flat), { throttle: 1, steer: 0, brake: false }, 720);
  assert.ok(Math.abs(speed(s)) > 10);
  s = run(s, { throttle: 0, steer: 0, brake: true }, 1200);
  assert.ok(Math.abs(speed(s)) < 0.05);
  const v0 = Math.hypot(...s.v);
  s = run(s, idle, 600);
  assert.ok(Math.hypot(...s.v) <= v0 + 1e-9, 'no self-starting jitter after release');
  assert.ok(Math.abs(speed(s)) < 0.05);
});

test('steer flicks are damped: yaw rate settles after release', () => {
  let s = run(run(spawn('scout', 0, 0, [0, 1], flat), idle, 60), { throttle: 1, steer: 0, brake: false }, 600);
  s = run(s, { throttle: 0.5, steer: 1, brake: false }, 45);
  assert.ok(Math.abs(s.w[1]) > 0.01, 'picked up yaw rate');
  s = run(s, { throttle: 0.5, steer: 0, brake: false }, 600);
  assert.ok(Math.abs(s.w[1]) < 0.02, 'yaw damped after release');
  const f1 = fwd(s);
  const s2 = run(s, { throttle: 0, steer: 0, brake: true }, 90);
  near(fwd(s2)[0], f1[0], 0.05); // keeps its heading while braking straight
});

test('oriented boxes pin the rover in a corner, never let it through', () => {
  const pocket: Ground = { ...flat, boxes: [
    { cx: 0, cz: 12, hx: 6, hz: 0.25, yaw: 0, top: 3 }, // z-facing wall
    { cx: 6, cz: 6, hx: 0.25, hz: 6, yaw: 0, top: 3 }, // x-facing wall
  ] };
  let s = spawn('scout', 0, 0, [0.31622776601683794, 0.9486832980505138], pocket); // heading (1,3)/sqrt(10)
  for (let k = 0; k < 600; k++) {
    s = step(s, { throttle: 1, steer: 0, brake: false }, pocket);
    assert.ok(s.p[2] < 12 - 0.2, `z face breached: ${s.p[2]}`);
    assert.ok(s.p[0] < 6 - 0.2, `x face breached: ${s.p[0]}`);
  }
  assert.ok(s.p[2] > 6 && s.p[0] > 2, `ended pinned near the corner: ${s.p}`);
});

test('idle on flat moon stays exactly put', () => {
  const s = run(spawn('scout', 5, -3, [0.6, 0.8], flat), idle, 1800);
  assert.ok(Math.hypot(s.p[0] - 5, s.p[2] + 3) < 1e-6, `drifted to ${s.p}`);
  assert.ok(Math.hypot(...s.v) < 1e-3);
  assert.ok(Math.hypot(...s.w) < 1e-3);
});
