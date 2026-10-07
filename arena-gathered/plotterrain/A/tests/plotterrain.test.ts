// tests/plotterrain.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, chunkMesh, chunksAround, MATERIALS } from '../src/index';

const t = createTerrain({ seed: 7 });
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

test('the pad is flat and the land rises gently from it, never a cone or a bowl', () => {
  const h0 = t.height(0, 0);
  for (let a = 0; a < Math.PI * 2; a += 0.3) for (const r of [0, 3, 6, 8.5]) assert.ok(near(t.height(Math.cos(a) * r, Math.sin(a) * r), h0, 0.03));
  for (let a = 0; a < Math.PI * 2; a += 0.2) for (let r = 9; r < 24; r += 1) {
    const s = t.slope(Math.cos(a) * r, Math.sin(a) * r);
    assert.ok(s < 12, `slope ${s} at r ${r}`);
  }
  // the pad is not on a peak: the land 150 m out in every direction is not all far below it
  let below = 0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) if (t.height(Math.cos(a) * 150, Math.sin(a) * 150) < h0 - 10) below++;
  assert.ok(below < 12);
});

test('natural relief within bounds, no craters near the gate', () => {
  let lo = Infinity, hi = -Infinity, steep = 0, n = 0;
  for (let x = -480; x <= 480; x += 16) for (let z = -480; z <= 480; z += 16) {
    if (x * x + z * z > 480 * 480) continue;
    const h = t.height(x, z) - t.height(0, 0);
    lo = Math.min(lo, h); hi = Math.max(hi, h); n++;
    if (t.slope(x, z) > 30) steep++;
  }
  assert.ok(lo >= -15.5 && hi <= 35.5 && hi - lo > 8, `relief ${lo}..${hi}`);
  assert.ok(steep > 0 && steep < n * 0.15);
  assert.ok(t.craters.length >= 3);
  for (const c of t.craters) assert.ok(Math.hypot(c.x, c.z) - c.r >= 40);
});

test('materials sum to 1 and follow the land', () => {
  assert.deepEqual([...MATERIALS], ['rock', 'scree', 'gravel', 'dust', 'cracked', 'redsoil']);
  let rockOnSteep = 0, steep = 0, seenRed = false;
  for (let x = -400; x <= 400; x += 10) for (let z = -400; z <= 400; z += 10) {
    const w = t.materials(x, z);
    assert.ok(near(w.reduce((a, b) => a + b, 0), 1, 1e-6));
    for (const v of w) assert.ok(v >= 0 && v <= 1);
    if (t.slope(x, z) > 35) { steep++; if (w[0] > 0.5) rockOnSteep++; }
    if (w[5] > 0.5) seenRed = true;
  }
  assert.ok(steep === 0 || rockOnSteep / steep > 0.7);
  assert.ok(seenRed);
});

test('boulders: deterministic, none on the pad', () => {
  const a = t.boulders(-64, -64, 128), b = t.boulders(-64, -64, 128);
  assert.deepEqual(a, b);
  for (const k of a) assert.ok(Math.hypot(k.x, k.z) > t.padRadius + 2);
});

test('chunks: meshes and a crack-free quadtree within budget', () => {
  const m = chunkMesh(t, 0, 0, 64, 16);
  assert.equal(m.positions.length, 17 * 17 * 3);
  assert.equal(m.indices.length, 16 * 16 * 6);
  const f = chunkMesh(t, 0, 0, 64, 16, { flat: true });
  assert.equal(f.positions.length, 16 * 16 * 6 * 3);
  const leaves = chunksAround(5, -3, { extent: 600, cells: 32, minSize: 16, budget: 200000 });
  let area = 0, tris = 0;
  for (const l of leaves) { area += l.size * l.size; tris += 2 * l.cells * l.cells; }
  assert.ok(near(area, 1200 * 1200, 1));
  assert.ok(tris <= 200000);
  // sizes halve from 1200: the finest near the eye is 18.75 (the first at or above minSize 16), the farthest 150 or more
  assert.ok(leaves.some((l) => l.size < 20) && leaves.some((l) => l.size >= 150));
  for (const l of leaves) assert.ok(l.size >= 16);
});

// ---- own tests ----
test('determinism and continuity', () => {
  const u = createTerrain({ seed: 7 });
  for (let i = 0; i < 200; i++) {
    const x = Math.sin(i) * 450, z = Math.cos(i * 1.3) * 450;
    assert.equal(u.height(x, z), t.height(x, z));
    assert.deepEqual(u.materials(x, z), t.materials(x, z));
    assert.ok(Math.abs(t.height(x + 0.01, z) - t.height(x, z)) < 0.05);
  }
  assert.ok(Number.isFinite(t.height(2000, -3000)));
});

test('rock on steep, redsoil never on rock, pad is gravel+dust', () => {
  for (let x = -480; x <= 480; x += 7) for (let z = -480; z <= 480; z += 7) {
    const w = t.materials(x, z);
    if (t.slope(x, z) > 40) assert.ok(w[0] > 0.5);
    if (w[0] > 0.5) assert.ok(w[5] < w[0]);
  }
  const p = t.materials(2, 1);
  assert.ok(near(p[2] + p[3], 1, 1e-6));
});

test('boulders: neighbours never duplicate, square-local', () => {
  const a = t.boulders(0, 0, 64), b = t.boulders(64, 0, 64), all = t.boulders(0, 0, 128);
  const key = (k: { x: number; z: number }) => `${k.x},${k.z}`;
  const sa = new Set(a.map(key));
  for (const k of b) assert.ok(!sa.has(key(k)));
  for (const k of a) assert.ok(k.x >= 0 && k.x < 64 && k.z >= 0 && k.z < 64);
  assert.ok(all.length >= a.length + b.length);
});

test('chunk normals unit; flat vertices unshared; skirt', () => {
  const m = chunkMesh(t, 300, -200, 64, 16, { skirt: 2 });
  for (let i = 0; i < m.normals.length; i += 3) assert.ok(near(Math.hypot(m.normals[i] ?? 0, m.normals[i + 1] ?? 0, m.normals[i + 2] ?? 0), 1, 1e-4));
  assert.ok(m.positions.length > 17 * 17 * 3);
  const f = chunkMesh(t, 0, 0, 32, 8, { flat: true });
  assert.equal(new Set(f.indices).size, f.indices.length);
  for (let i = 0; i < f.normals.length; i += 3) assert.ok((f.normals[i + 1] ?? 0) > 0);
});

test('quadtree is balanced', () => {
  const L = chunksAround(5, -3, { extent: 600, cells: 32, minSize: 16, budget: 200000 });
  for (const a of L) for (const b of L) {
    const touch = Math.abs(a.cx - b.cx) <= (a.size + b.size) / 2 + 1e-6 && Math.abs(a.cz - b.cz) <= (a.size + b.size) / 2 + 1e-6;
    if (touch) assert.ok(Math.max(a.size, b.size) / Math.min(a.size, b.size) <= 2);
  }
});

test('budgets', () => {
  let s = 0, t0 = performance.now();
  for (let i = 0; i < 400000; i++) s += t.height((i % 997) - 500, (i % 991) - 500);
  const rate = 400000 / ((performance.now() - t0) / 1000);
  assert.ok(rate > 2e6 && Number.isFinite(s), `rate ${rate}`);
  t0 = performance.now(); chunkMesh(t, 0, 0, 64, 64);
  assert.ok(performance.now() - t0 < 20 * 3);
  t0 = performance.now(); chunksAround(5, -3, { extent: 600, cells: 32, minSize: 16, budget: 200000 });
  assert.ok(performance.now() - t0 < 5 * 3);
});
