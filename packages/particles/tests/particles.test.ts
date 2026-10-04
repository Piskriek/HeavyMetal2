import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_PRESETS, ParticleSystem, STRIDE, presetById, type EmitterSpec } from '../src/index';
const base: EmitterSpec = { id: 't', name: 'T', rate: 0, burst: 0, duration: 0, life: [1, 1], speed: [0, 0], dir: [0, 1, 0], spread: 0,
  gravity: 0, drag: 0, size: [1, 1], colors: ['#ff0000'], alpha: [1, 1], area: [0, 0, 0], additive: false };

test('a burst, then the particles die at the end of their life', () => {
  const s = new ParticleSystem(100);
  s.spawn({ ...base, burst: 10 }, [0, 0, 0], 1);
  s.step(0.5); assert.equal(s.count, 10);
  s.step(0.6); assert.equal(s.count, 0); assert.equal(s.active, 0);
});
test('a rate carries fractions over and stops when told', () => {
  const s = new ParticleSystem(100);
  const h = s.spawn({ ...base, rate: 10, life: [10, 10] }, [0, 0, 0], 1);
  for (let i = 0; i < 4; i++) s.step(0.025);
  assert.equal(s.count, 1);
  s.step(0.9); assert.equal(s.count, 10);
  s.stop(h); s.step(1); assert.equal(s.count, 10);
});
test('never more than the cap', () => {
  const s = new ParticleSystem(5);
  s.spawn({ ...base, burst: 50 }, [0, 0, 0], 1); s.step(0.1);
  assert.equal(s.count, 5);
});
test('speed, gravity and colour reach the buffer', () => {
  const s = new ParticleSystem(10);
  s.spawn({ ...base, burst: 1, speed: [2, 2], gravity: -2, life: [5, 5] }, [0, 1, 0], 1);
  for (let i = 0; i < 50; i++) s.step(0.01);
  const y = s.buffer[1]!;
  assert.ok(y > 1 && y < 2, String(y));
  assert.ok(Math.abs(s.buffer[4]! - 1) < 1e-6 && Math.abs(s.buffer[5]!) < 1e-6);
  assert.equal(STRIDE, 8);
});
test('same seed, same particles', () => {
  const run = (): number[] => { const s = new ParticleSystem(200); s.spawn(presetById('firework')!, [0, 5, 0], 42); s.step(0.3); return Array.from(s.buffer.slice(0, s.count * STRIDE)); };
  assert.deepEqual(run(), run());
});
test('twelve legal presets', () => {
  assert.deepEqual(PARTICLE_PRESETS.map((p) => p.id).sort(), ['bubbles', 'campfire', 'confetti', 'dust', 'embers', 'firework', 'glitter', 'rain', 'smoke', 'snow', 'sparks', 'splash']);
  for (const p of PARTICLE_PRESETS) assert.ok(p.life[0] <= p.life[1] && p.speed[0] <= p.speed[1] && p.size[0] > 0 && p.size[1] > 0 && p.colors.length >= 1 && p.colors.length <= 6 && p.drag >= 0 && p.drag <= 1 && p.spread >= 0 && p.spread <= 180, p.id);
  assert.equal(presetById('firework')!.burst, 120); assert.equal(presetById('firework')!.rate, 0);
});

// --- additional tests -------------------------------------------------------

import { mulberry32 } from '../src/index';

test('the burst is live and packed right after spawn, capped at maxParticles', () => {
  const s = new ParticleSystem(8);
  s.spawn({ ...base, burst: 20, speed: [5, 5], gravity: -9 }, [1, 2, 3], 7);
  assert.equal(s.count, 8);
  assert.equal(s.active, 1);
  assert.equal(s.buffer[0], 1);
  assert.equal(s.buffer[1], 2);
  assert.equal(s.buffer[2], 3);
});
test('a positive duration limits how long an emitter runs', () => {
  const s = new ParticleSystem(100);
  s.spawn({ ...base, rate: 10, duration: 0.5, life: [10, 10] }, [0, 0, 0], 1);
  for (let i = 0; i < 4; i++) s.step(0.25); // 2 + 3 particles, then the 0.5 s are up
  assert.equal(s.count, 5);
  assert.equal(s.active, 1); // still counted: it has live particles
});
test('move changes where new particles appear, old ones stay put', () => {
  const s = new ParticleSystem(10);
  const h = s.spawn({ ...base, rate: 100, life: [10, 10], speed: [0, 0] }, [0, 0, 0], 3);
  s.step(0.01);
  s.move(h, [10, 0, 0]);
  s.step(0.01);
  assert.equal(s.count, 2);
  const xs = [s.buffer[0]!, s.buffer[STRIDE]!].sort((a, b) => a - b);
  assert.ok(xs[0]! < 1 && xs[1]! > 9, JSON.stringify(xs));
});
test('colour, size and alpha interpolate over the life', () => {
  const s = new ParticleSystem(4);
  s.spawn(
    { ...base, burst: 1, life: [2, 2], colors: ['#000000', '#ffffff'], alpha: [1, 0.5], size: [2, 4] },
    [0, 0, 0],
    5,
  );
  s.step(1); // halfway through the life
  assert.ok(Math.abs(s.buffer[4]! - 0.5) < 1e-6, String(s.buffer[4]));
  assert.ok(Math.abs(s.buffer[6]! - 0.5) < 1e-6, String(s.buffer[6]));
  assert.ok(Math.abs(s.buffer[7]! - 0.75) < 1e-6, String(s.buffer[7]));
  assert.ok(Math.abs(s.buffer[3]! - 3) < 1e-6, String(s.buffer[3]));
});
test('non-positive dt is ignored', () => {
  const s = new ParticleSystem(4);
  s.spawn({ ...base, burst: 2 }, [0, 0, 0], 1);
  const before = Array.from(s.buffer.slice(0, 2 * STRIDE));
  s.step(0);
  s.step(-1);
  s.step(Number.NaN);
  assert.equal(s.count, 2);
  assert.deepEqual(Array.from(s.buffer.slice(0, 2 * STRIDE)), before);
});
test('unknown handles are tolerated', () => {
  const s = new ParticleSystem(4);
  s.stop(999);
  s.move(999, [1, 1, 1]);
  s.step(0.1);
  assert.equal(s.count, 0);
  assert.equal(s.active, 0);
});
test('a preset burst bigger than the cap is truncated', () => {
  const s = new ParticleSystem(10);
  s.spawn(presetById('firework')!, [0, 0, 0], 1);
  s.step(0.1);
  assert.equal(s.count, 10);
});
test('every preset runs deterministically side by side', () => {
  const run = (): number[] => {
    const s = new ParticleSystem(4096);
    PARTICLE_PRESETS.forEach((p, i) => s.spawn(p, [i, 0, 0], 1000 + i));
    for (let i = 0; i < 30; i++) s.step(1 / 30);
    return Array.from(s.buffer.slice(0, s.count * STRIDE));
  };
  const a = run();
  assert.ok(a.length > 0);
  assert.deepEqual(run(), a);
});
test('snow drifts downwards across its wide area', () => {
  const s = new ParticleSystem(2000);
  s.spawn(presetById('snow')!, [0, 10, 0], 9);
  for (let i = 0; i < 60; i++) s.step(1 / 30);
  assert.ok(s.count > 50, String(s.count));
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < s.count; i++) {
    const y = s.buffer[i * STRIDE + 1]!;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  assert.ok(maxY <= 10.5 + 1e-3, String(maxY));
  assert.ok(minY < 9.5, String(minY));
});
test('art direction spot checks', () => {
  assert.equal(presetById('campfire')!.additive, true);
  assert.equal(presetById('smoke')!.additive, false);
  assert.equal(presetById('snow')!.additive, false);
  assert.equal(presetById('rain')!.additive, false);
  assert.equal(presetById('glitter')!.additive, true);
  assert.equal(presetById('embers')!.additive, true);
  assert.equal(presetById('firework')!.spread, 180);
  assert.ok(presetById('confetti')!.colors.length >= 4);
  assert.ok(presetById('snow')!.area[0] >= 5); // wide area
  assert.equal(presetById('nope'), undefined);
});
test('mulberry32 is seeded, repeatable and in [0, 1)', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  const c = mulberry32(124);
  let differs = false;
  for (let i = 0; i < 50; i++) {
    const x = a();
    assert.ok(x >= 0 && x < 1, String(x));
    assert.equal(b(), x);
    if (c() !== x) differs = true;
  }
  assert.ok(differs);
});