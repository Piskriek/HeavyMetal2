// Hidden checks from the rover battle (not shown to the models): fuzzed driving, walls at angles, turned boxes, slope parking, purity, speed.
import test from 'node:test'; import assert from 'node:assert/strict';
import { spawn, step, speed, hashRover, ROVERS, DT, type Ground, type RoverState, type Input } from '../src/index';

const flat: Ground = { height: () => 0, g: 1.62 };
const run = (s: RoverState, i: Input, n: number, g: Ground = flat) => { for (let k = 0; k < n; k++) s = step(s, i, g); return s; };
const finite = (s: RoverState) => [...s.p, ...s.q, ...s.v, ...s.w].every(Number.isFinite);
const up = (s: RoverState) => { const [x, , z] = s.q; return 1 - 2 * (x * x + z * z); }; // body y axis . world y
// a lumpy crater floor: sums of smooth bumps, deterministic
const bumpy: Ground = { g: 1.62, height: (x, z) => 0.35 * Math.sin(x * 0.7) * Math.cos(z * 0.5) + 0.15 * Math.sin(x * 2.1 + z * 1.3) };

test('random driving on bumpy ground for 60 s never explodes, flips or tunnels', () => {
  for (const k of ['scout', 'hauler', 'crawler'] as const) {
    let s = spawn(k, 0, 0, [0, 1], bumpy), seed = 99;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    let input: Input = { throttle: 0, steer: 0, brake: false }, worstDip = 0, worstSpeed = 0;
    for (let t = 0; t < 3600; t++) {
      if (t % 45 === 0) input = { throttle: rnd() * 2 - 1, steer: rnd() * 2 - 1, brake: rnd() < 0.15 };
      s = step(s, input, bumpy);
      assert.ok(finite(s), `${k} NaN at ${t}`);
      worstDip = Math.max(worstDip, bumpy.height(s.p[0], s.p[2]) - s.p[1]);
      worstSpeed = Math.max(worstSpeed, Math.hypot(...s.v));
    }
    assert.ok(worstDip < 0.3, `${k} body sank ${worstDip.toFixed(2)} m into the ground`);
    assert.ok(worstSpeed < ROVERS[k].topSpeed * 1.6, `${k} hit ${worstSpeed.toFixed(1)} m/s`);
    assert.ok(up(s) > 0.5, `${k} ended on its side or roof (up ${up(s).toFixed(2)})`);
  }
});

// a crossing is the centre passing the wall's line while within its span: sliding along it and round its end is fine
const crossed = (k: 'scout' | 'hauler' | 'crawler', x0: number, z0: number, h: [number, number], g: Ground) => {
  const b = g.boxes![0]!, c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  // three.js rotation.y: world = Ry(yaw) * local, so local = (c x - s z, s x + c z)
  const local = (p: number[]) => [c * (p[0]! - b.cx) - sn * (p[2]! - b.cz), sn * (p[0]! - b.cx) + c * (p[2]! - b.cz)] as const;
  let s = spawn(k, x0, z0, h, g); const side = Math.sign(local(s.p)[1]);
  for (let t = 0; t < 900; t++) {
    s = step(s, { throttle: 1, steer: 0, brake: false }, g);
    const [lx, lz] = local(s.p);
    if (Math.abs(lx) < b.hx && Math.sign(lz) !== side) return `crossed at step ${t} (local ${lx.toFixed(2)}, ${lz.toFixed(2)})`;
  }
  return null;
};

test('a wall stops the scout at top speed from five angles, from both sides', () => {
  const g: Ground = { ...flat, boxes: [{ cx: 0, cz: 20, hx: 8, hz: 0.25, yaw: 0, top: 3 }] };
  for (const a of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const h: [number, number] = [Math.sin(a), Math.cos(a)];
    assert.equal(crossed('scout', -20 * h[0], 0, h, g), null, `angle ${a}`);
    assert.equal(crossed('scout', 20 * h[0], 40, [-h[0], -h[1]], g), null, `angle ${a}, far side`);
  }
});

test('a turned box (yaw) blocks too', () => {
  for (const yaw of [0.7, -0.4, 1.2]) {
    const g: Ground = { ...flat, boxes: [{ cx: 0, cz: 15, hx: 6, hz: 0.3, yaw, top: 2 }] };
    for (const k of ['scout', 'hauler', 'crawler'] as const) assert.equal(crossed(k, 0, 0, [0, 1], g), null, `${k} yaw ${yaw}`);
  }
});

test('a hauler parked across a 20 degree slope stays upright and put', () => {
  const slope: Ground = { height: (x) => x * 0.364, g: 1.62 };
  let h = run(spawn('hauler', 0, 0, [0, 1], slope), { throttle: 0, steer: 0, brake: true }, 600, slope);
  const p = [...h.p]; h = run(h, { throttle: 0, steer: 0, brake: true }, 600, slope);
  assert.ok(Math.hypot(h.p[0] - p[0]!, h.p[2] - p[2]!) < 0.05 && up(h) > 0.85, `crept ${Math.hypot(h.p[0] - p[0]!, h.p[2] - p[2]!)}`);
});

test('pure: same inputs, same hash, across kinds and ground', () => {
  for (const k of ['scout', 'hauler', 'crawler'] as const) {
    const go = () => run(spawn(k, 3, -2, [0.6, 0.8], bumpy), { throttle: 0.7, steer: -0.4, brake: false }, 600, bumpy);
    assert.equal(hashRover(go()), hashRover(go()));
  }
});

test('performance: 50 rovers x 60 steps stay well under a frame budget', () => {
  const fleet = Array.from({ length: 50 }, (_, i) => spawn((['scout', 'hauler', 'crawler'] as const)[i % 3]!, i * 6, 0, [0, 1], bumpy));
  const t0 = performance.now();
  for (let t = 0; t < 60; t++) for (let i = 0; i < fleet.length; i++) fleet[i] = step(fleet[i]!, { throttle: 1, steer: 0.2, brake: false }, bumpy);
  const ms = (performance.now() - t0) / 60;
  assert.ok(ms < 4, `${ms.toFixed(2)} ms per frame for 50 rovers`);
  assert.ok(DT > 0 && speed(fleet[0]!) > 0);
});
