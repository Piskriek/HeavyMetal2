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

/* ---------------------------------------------------------------- my own tests */

const pixAttr = (plume: ReturnType<typeof createPlume>, n: number): number[] => {
  const mesh = drawn(plume.object)[0] as THREE.Mesh;
  const a = mesh.geometry.getAttribute('aPix') as THREE.BufferAttribute;
  return Array.from(a.array.slice(0, n * 3));
};

test('the instance attributes are deterministic: slot, index and a 24-bit seed per pixel', () => {
  const build = () => {
    const p = createPlume({ mode: 'cubes' });
    p.add({ at: [0, 1, 0], colour: METRIC_COLOURS.pxd, count: 50 });
    p.add({ at: [7, 1, 3], colour: METRIC_COLOURS.aq, count: 30 });
    return p;
  };
  const a = build(), b = build();
  const xa = pixAttr(a, 80), xb = pixAttr(b, 80);
  assert.deepEqual(xa, xb);
  assert.equal(xa.length, 240);
  for (let i = 0; i < 80; i++) {
    const slot = xa[i * 3]!, idx = xa[i * 3 + 1]!, seed = xa[i * 3 + 2]!;
    assert.equal(slot, i < 50 ? 0 : 1);
    assert.equal(idx, i < 50 ? i : i - 50);
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 1 << 24);
  }
  assert.ok(new Set(xa.filter((_, i) => i % 3 === 2)).size > 70, 'seeds differ from pixel to pixel');
  assert.notDeepEqual(xa.slice(2, 3), xa.slice(152, 153), 'and from emitter to emitter');
  // the shared buffer feeds every mode
  a.setMode('splats'); assert.deepEqual(pixAttr(a, 80), xa);
  a.dispose(); b.dispose();
});

test('emitters at different vents do not pour the same pattern', () => {
  const a = sample(spec({ at: [0, 1, 0] }), 10, calm), b = sample(spec({ at: [9, 1, 4] }), 10, calm);
  assert.notDeepEqual(a.map((p) => p.p[0]), b.map((p) => p.p[0] - 9));
});

test('ids are unique and never reused; removing an unknown id does nothing; removing the last emitter empties the plume', () => {
  const plume = createPlume({ mode: 'splats' });
  const a = plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd });
  const b = plume.add({ at: [3, 0, 0], colour: METRIC_COLOURS.vtx });
  assert.notEqual(a, b);
  plume.remove(9999);
  assert.equal(plume.stats().emitters, 2);
  plume.remove(a);
  const c = plume.add({ at: [6, 0, 0], colour: METRIC_COLOURS.lx });
  assert.ok(c !== a && c !== b);
  plume.remove(b); plume.remove(c);
  const s = plume.stats();
  assert.equal(s.emitters, 0); assert.equal(s.pixels, 0); assert.equal(s.drawCalls, 0); assert.equal(s.triangles, 0);
  assert.equal(drawn(plume.object).length, 0);
  plume.remove(c); // again: harmless
  plume.update(5);
  const d = plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.all, count: 10 });
  assert.ok(d !== a && d !== b && d !== c);
  assert.equal(plume.stats().pixels, 10); assert.equal(drawn(plume.object).length, 1);
  plume.dispose();
});

test('density is clamped to 0.1..4', () => {
  const plume = createPlume({ mode: 'dither' });
  plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd, count: 100 });
  plume.setDensity(100); assert.equal(plume.stats().pixels, 400);
  plume.setDensity(0); assert.equal(plume.stats().pixels, 10);
  plume.setDensity(-3); assert.equal(plume.stats().pixels, 10);
  plume.setDensity(Number.NaN); assert.equal(plume.stats().pixels, 10, 'NaN is ignored');
  plume.setDensity(1); assert.equal(plume.stats().pixels, 100);
  plume.dispose();
  const big = createPlume({ mode: 'dither', density: 50 });
  big.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd, count: 100 });
  assert.equal(big.stats().pixels, 400);
  big.dispose();
});

test('the fade-in is linear over 1.5 s and only scales the size', () => {
  const late = spec({ startAt: 5 }), always = spec();
  const half = sample(late, 5.75, calm), full = sample(always, 5.75, calm);
  half.forEach((p, i) => {
    assert.ok(Math.abs(p.size - 0.5 * full[i]!.size) < 1e-12);
    assert.deepEqual(p.p, full[i]!.p, 'positions are not affected');
  });
  assert.ok(mean(sample(late, 5.5, calm).map((p) => p.size)) < mean(sample(late, 6.2, calm).map((p) => p.size)));
});

test('a wave only sends racers from vents it has reached', () => {
  const far = spec({ at: [40, 1, 0] });
  const env = (r: number): PlumeEnv => ({ ...calm, waveR: r });
  assert.equal(sample(far, 10, env(20)).filter((p) => p.toWave).length, 0, 'front still 20 m short of the vent');
  const reached = sample(far, 10, env(70)).filter((p) => p.toWave);
  assert.ok(reached.length >= 30);
  for (const p of reached) assert.ok(Math.hypot(p.p[0], p.p[2]) <= 70.5, 'racers stay inside the front');
  for (const p of reached) assert.ok(p.p[1] >= 1 - 1e-6 && p.p[1] < 6, 'low arc');
});

test('stats per mode, with and without emitters', () => {
  const plume = createPlume({ mode: 'cubes' });
  assert.deepEqual(plume.stats(), { mode: 'cubes', emitters: 0, pixels: 0, drawCalls: 0, triangles: 0 });
  plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd, count: 100 });
  assert.deepEqual(plume.stats(), { mode: 'cubes', emitters: 1, pixels: 100, drawCalls: 1, triangles: 1200 });
  plume.setMode('splats');
  assert.deepEqual(plume.stats(), { mode: 'splats', emitters: 1, pixels: 100, drawCalls: 1, triangles: 200 });
  plume.setMode('dither');
  assert.deepEqual(plume.stats(), { mode: 'dither', emitters: 1, pixels: 100, drawCalls: 1, triangles: 0 });
  plume.setMode('off');
  assert.deepEqual(plume.stats(), { mode: 'off', emitters: 1, pixels: 0, drawCalls: 0, triangles: 0 });
  assert.equal(plume.mode, 'off');
  plume.setMode('cubes');
  assert.equal(plume.stats().pixels, 100);
  plume.dispose();
});

test('every fragment shader ends with the colour space include and discards faint fragments', () => {
  const plume = createPlume({ mode: 'cubes' });
  plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd });
  for (const mode of ['cubes', 'splats', 'dither'] as const) {
    plume.setMode(mode);
    const mat = (drawn(plume.object)[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    assert.match(mat.fragmentShader, /#include <colorspace_fragment>\s*}\s*$/, mode);
    assert.match(mat.fragmentShader, /discard/, mode);
    assert.match(mat.fragmentShader, /vec4\([^;]*uMark\)/, mode);
  }
  plume.dispose();
});

test('mode switching reuses one material per mode', () => {
  const plume = createPlume({ mode: 'cubes' });
  plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd });
  const mats = new Map<string, THREE.Material>();
  for (const mode of ['cubes', 'splats', 'dither', 'cubes', 'splats', 'dither'] as const) {
    plume.setMode(mode);
    const m = (drawn(plume.object)[0] as THREE.Mesh).material as THREE.Material;
    const seen = mats.get(mode);
    if (seen) assert.equal(seen, m); else mats.set(mode, m);
  }
  assert.equal(new Set(mats.values()).size, 3);
  plume.dispose();
});

test('the colours are linear working-space values of the sRGB hex', () => {
  const plume = createPlume({ mode: 'cubes' });
  plume.add({ at: [0, 0, 0], colour: '#ff3d8a' });
  const mat = (drawn(plume.object)[0] as THREE.Mesh).material as THREE.ShaderMaterial;
  const table = (mat.uniforms.uEm as { value: THREE.Vector4[] }).value;
  const want = new THREE.Color('#ff3d8a');
  const b = table[1]!;
  assert.ok(Math.abs(b.x - want.r) < 1e-6 && Math.abs(b.y - want.g) < 1e-6 && Math.abs(b.z - want.b) < 1e-6);
  assert.equal(b.w, 2.6, 'spread rides along');
  plume.dispose();
});

test('budgets: update is cheap and a 16384-pixel rebuild takes a few ms at most', () => {
  const plume = createPlume({ mode: 'dither' });
  for (let i = 0; i < 4; i++) plume.add({ at: [i * 4, 0, 0], colour: METRIC_COLOURS.pxd, count: 4096 });
  assert.equal(plume.stats().pixels, 16384);
  let best = Infinity;
  for (let r = 0; r < 9; r++) {
    const t0 = performance.now();
    plume.setDensity(1);
    best = Math.min(best, performance.now() - t0);
  }
  assert.ok(best < 3, `rebuild ${best.toFixed(2)} ms`);
  const n = 5000, t0 = performance.now();
  for (let i = 0; i < n; i++) plume.update(i * 0.016);
  const per = (performance.now() - t0) / n;
  assert.ok(per < 0.05, `update ${per.toFixed(4)} ms`);
  plume.dispose();
});

test('the pixel budget caps a huge request evenly', () => {
  const plume = createPlume({ mode: 'dither', maxPixels: 16384 });
  plume.add({ at: [0, 0, 0], colour: METRIC_COLOURS.pxd, count: 10000 });
  plume.add({ at: [9, 0, 0], colour: METRIC_COLOURS.vtx, count: 10000 });
  assert.equal(plume.stats().pixels, 16384);
  plume.dispose();
});
