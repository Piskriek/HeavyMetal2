import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlume, pixelAt, METRIC_COLOURS, PLUME_MODES, type EmitterSpec, type PlumeEnv } from '../src/index';

const calm: PlumeEnv = { wind: [1, 0], windSpeed: 0, windResponse: 1, waveCentre: [0, 0, 0], waveR: -1 };
const spec = (o: Partial<EmitterSpec> = {}): Required<EmitterSpec> => ({ at: [0, 1, 0], colour: METRIC_COLOURS.pxd, count: 160, height: 6.5, spread: 2.6, life: 3.1, size: 0.14, startAt: 0, ...o });
const sample = (e: Required<EmitterSpec>, t: number, env: PlumeEnv) => Array.from({ length: e.count }, (_, i) => pixelAt(e, i, t, env));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const flat = (p: { p: [number, number, number] }) => Math.hypot(p.p[0], p.p[2]);
const drawn = (o: THREE.Object3D): THREE.Object3D[] => {
  const out: THREE.Object3D[] = [];
  o.traverseVisible((x) => { if ((x as THREE.Mesh).isMesh || (x as THREE.Points).isPoints) out.push(x); });
  return out;
};

test('pixels rise from the vent, widen as they go, and shrink away at the end of their life', () => {
  const px = sample(spec(), 10, calm);
  const young = px.filter((p) => p.life < 0.2), old = px.filter((p) => p.life > 0.8);
  assert.ok(young.length > 15 && old.length > 15, 'lives are staggered, not in step');
  assert.ok(mean(old.map((p) => p.p[1])) > mean(young.map((p) => p.p[1])) + 3, 'old pixels are higher');
  assert.ok(mean(old.map(flat)) > mean(young.map(flat)) + 0.8, 'the pour widens');
  for (const p of px) {
    assert.ok(p.life >= 0 && p.life < 1);
    assert.ok(p.p[1] >= 1 - 1e-6, 'never below the vent');
    if (p.life > 0.97) assert.ok(p.size < 0.05, 'nearly gone at the end of its life');
  }
  assert.deepEqual(sample(spec(), 10, calm), sample(spec(), 10, calm), 'deterministic');
});

test('the wind carries the old pixels downwind, more with a stronger response', () => {
  const wind = (k: number): PlumeEnv => ({ ...calm, wind: [0, 1], windSpeed: 4, windResponse: k });
  const z = (k: number) => mean(sample(spec(), 10, wind(k)).filter((p) => p.life > 0.7).map((p) => p.p[2]));
  assert.ok(z(1) > 1.5, 'downwind is +z here');
  assert.ok(z(2) > z(1) + 0.5);
  assert.ok(Math.abs(z(0)) < 0.5, 'no response, no drift');
});

test('a starting machine fades its plume in over 1.5 seconds', () => {
  const e = spec({ startAt: 5 });
  assert.ok(sample(e, 4, calm).every((p) => p.size === 0), 'nothing before it starts');
  assert.ok(sample(e, 5, calm).every((p) => p.size === 0), 'nothing at the very start');
  assert.ok(sample(e, 7, calm).filter((p) => p.size > 0).length > 100, 'all of it after 1.5 s');
});

test('while a wave runs, a quarter of the pixels race out to its front and dissolve there', () => {
  const env: PlumeEnv = { ...calm, waveR: 60 };
  const out = sample(spec(), 10, env).filter((p) => p.toWave);
  assert.ok(out.length >= 30 && out.length <= 50, `about a quarter (${out.length})`);
  assert.ok(out.filter((p) => flat(p) > 30).length > 5, 'some are well on their way');
  assert.ok(out.every((p) => flat(p) <= 61), 'none beyond the front');
  assert.equal(sample(spec(), 10, calm).filter((p) => p.toWave).length, 0, 'no wave, no racers');
  assert.equal(sample(spec(), 10, { ...calm, waveR: 2e6 }).filter((p) => p.toWave).length, 0, 'a finished wave, no racers');
});

test('modes: one draw call each, the right primitive, and off draws nothing', () => {
  assert.deepEqual([...PLUME_MODES], ['cubes', 'splats', 'dither', 'off']);
  const plume = createPlume({ mode: 'cubes', density: 1 });
  plume.add({ at: [0, 1, 0], colour: METRIC_COLOURS.vtx });
  plume.add({ at: [10, 1, 0], colour: METRIC_COLOURS.lx, count: 80 });
  plume.update(3);
  let s = plume.stats();
  assert.equal(s.pixels, 240); assert.equal(s.drawCalls, 1); assert.equal(s.triangles, 240 * 12);
  assert.equal(drawn(plume.object).length, 1);
  plume.setMode('splats'); s = plume.stats();
  assert.equal(s.drawCalls, 1); assert.equal(s.triangles, 240 * 2); assert.equal(drawn(plume.object).length, 1);
  plume.setMode('dither'); s = plume.stats();
  const sprites = drawn(plume.object);
  assert.equal(sprites.length, 1); assert.ok((sprites[0] as THREE.Points).isPoints); assert.equal(s.triangles, 0); assert.equal(s.pixels, 240);
  plume.setMode('off'); s = plume.stats();
  assert.equal(drawn(plume.object).length, 0); assert.equal(s.drawCalls, 0); assert.equal(s.pixels, 0);
  plume.dispose();
});

test('density scales every plume, within the pixel budget', () => {
  const plume = createPlume({ mode: 'dither', maxPixels: 1000 });
  const a = plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.aq, count: 200 });
  plume.add({ at: [5, 0, 0], colour: METRIC_COLOURS.all, count: 200 });
  plume.setDensity(0.5); assert.equal(plume.stats().pixels, 200);
  plume.setDensity(2); assert.equal(plume.stats().pixels, 800);
  plume.setDensity(4); assert.equal(plume.stats().pixels, 1000, 'capped by maxPixels');
  plume.remove(a); plume.setDensity(1);
  assert.equal(plume.stats().pixels, 200); assert.equal(plume.stats().emitters, 1);
  plume.dispose();
});

test('the picture contract: every fragment writes the mark, alpha is never blended, and updating never changes a program', () => {
  const plume = createPlume({ mode: 'cubes', markAlpha: 0.5 });
  plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd });
  for (const mode of ['cubes', 'splats', 'dither'] as const) {
    plume.setMode(mode);
    const [obj] = drawn(plume.object);
    const mat = (obj as THREE.Mesh).material as THREE.ShaderMaterial;
    assert.ok(mat.isShaderMaterial, mode);
    assert.match(mat.fragmentShader, /uMark/, `${mode} writes the mark`);
    assert.equal((mat.uniforms.uMark as { value: number }).value, 0.5);
    const alphaSafe = mat.blending === THREE.NoBlending || (mat.blending === THREE.CustomBlending && mat.blendSrcAlpha === THREE.OneFactor && mat.blendDstAlpha === THREE.ZeroFactor);
    assert.ok(alphaSafe, `${mode}: the alpha channel is written, not blended`);
    const program = mat.vertexShader + mat.fragmentShader + JSON.stringify(mat.defines ?? {});
    plume.update(1); plume.setDensity(2); plume.setWind(1, 0, 5); plume.setWave([0, 0, 0], 30); plume.setViewport(360); plume.update(2);
    assert.equal(mat.vertexShader + mat.fragmentShader + JSON.stringify(mat.defines ?? {}), program, `${mode}: uniforms only`);
    plume.setDensity(1); plume.setWave([0, 0, 0], -1);
  }
  plume.dispose();
});

test('attributes rebuild deterministically and ids increase monotonically', () => {
  const plume = createPlume({ mode: 'dither' });
  const a = plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd, count: 3 });
  const b = plume.add({ at: [1, 0, 0], colour: METRIC_COLOURS.vtx, count: 2 });
  assert.equal(a, 1);
  assert.equal(b, 2);
  const pts = drawn(plume.object)[0] as THREE.Points;
  const g = pts.geometry;
  const ia = Array.from((g.getAttribute('iEmitter') as THREE.BufferAttribute).array as ArrayLike<number>);
  const ip = Array.from((g.getAttribute('iPixel') as THREE.BufferAttribute).array as ArrayLike<number>);
  assert.deepEqual(ia, [0, 0, 0, 1, 1]);
  assert.deepEqual(ip, [0, 1, 2, 0, 1]);
  plume.setDensity(1);
  const pts2 = drawn(plume.object)[0] as THREE.Points;
  const g2 = pts2.geometry;
  assert.deepEqual(Array.from((g2.getAttribute('iEmitter') as THREE.BufferAttribute).array as ArrayLike<number>), ia);
  assert.deepEqual(Array.from((g2.getAttribute('iPixel') as THREE.BufferAttribute).array as ArrayLike<number>), ip);
  plume.dispose();
});

test('removing the last emitter leaves an empty visible primitive until mode off', () => {
  const plume = createPlume({ mode: 'splats' });
  const id = plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.lx, count: 10 });
  plume.remove(id);
  assert.equal(plume.stats().emitters, 0);
  assert.equal(plume.stats().pixels, 0);
  assert.equal(drawn(plume.object).length, 1);
  plume.setMode('off');
  assert.equal(drawn(plume.object).length, 0);
  plume.dispose();
});

test('density clamps, fade-in is partial during the ramp, and stats follow mode', () => {
  const plume = createPlume({ mode: 'cubes', density: 0.001 });
  plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.all, count: 100 });
  assert.equal(plume.stats().pixels, 10);
  plume.setDensity(99);
  assert.equal(plume.stats().pixels, 400);
  const e = spec({ startAt: 2 });
  const mid = sample(e, 2.6, calm);
  assert.ok(mid.some((p) => p.size > 0));
  assert.ok(mid.some((p) => p.size < e.size));
  assert.equal(plume.stats().mode, 'cubes');
  plume.setMode('splats');
  assert.equal(plume.stats().triangles, plume.stats().pixels * 2);
  plume.setMode('dither');
  assert.equal(plume.stats().triangles, 0);
  plume.dispose();
});
