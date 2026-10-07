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

test('seeded terrain is repeatable and distinct seeds change the land', () => {
  const same = createTerrain({ seed: 7 });
  const other = createTerrain({ seed: 8 });
  const probes: readonly (readonly [number, number])[] = [[35, 72], [150, -80], [-210, 130], [320, 250]];
  assert.deepEqual(same.craters, t.craters);
  for (const [x, z] of probes) {
    assert.equal(same.height(x, z), t.height(x, z));
  }
  assert.notEqual(other.height(35, 72), t.height(35, 72));
  assert.deepEqual(same.boulders(-200, -200, 160), t.boulders(-200, -200, 160));
});

test('red soil stays off dominant rock and the pad is gravel with dust', () => {
  const padProbes: readonly (readonly [number, number])[] = [[0, 0], [2, 4], [-5, 3]];
  for (const [x, z] of padProbes) {
    const weights = t.materials(x, z);
    assert.equal(weights[0], 0);
    assert.equal(weights[1], 0);
    assert.equal(weights[2], 0.68);
    assert.equal(weights[3], 0.32);
    assert.equal(weights[4], 0);
    assert.equal(weights[5], 0);
  }
  let redPatches = 0;
  for (let x = -400; x <= 400; x += 13) for (let z = -400; z <= 400; z += 13) {
    const weights = t.materials(x, z);
    if (weights[0] > 0.5) assert.equal(weights[5], 0);
    if (weights[5] > 0.5) {
      redPatches++;
      assert.ok(weights[0] < 0.1);
    }
  }
  assert.ok(redPatches > 0);
});

test('smooth and flat chunk normals are unit length and flat triangles do not share vertices', () => {
  const smooth = chunkMesh(t, 18, -12, 48, 12, { skirt: 2 });
  for (let i = 0; i < smooth.normals.length; i += 3) {
    const length = Math.hypot(smooth.normals[i]!, smooth.normals[i + 1]!, smooth.normals[i + 2]!);
    assert.ok(near(length, 1, 1e-5));
  }
  const flat = chunkMesh(t, 18, -12, 48, 12, { flat: true });
  assert.equal(flat.positions.length / 3, 12 * 12 * 6);
  for (let i = 0; i < flat.indices.length; i++) assert.equal(flat.indices[i]!, i);
  for (let i = 0; i < flat.normals.length; i += 9) {
    const nx = flat.normals[i]!;
    const ny = flat.normals[i + 1]!;
    const nz = flat.normals[i + 2]!;
    for (let j = 3; j < 9; j += 3) {
      assert.equal(flat.normals[i + j], nx);
      assert.equal(flat.normals[i + j + 1], ny);
      assert.equal(flat.normals[i + j + 2], nz);
    }
    assert.ok(ny > 0);
  }
});

test('boulder candidates partition cleanly across neighbouring squares', () => {
  const left = t.boulders(-128, -64, 64);
  const right = t.boulders(-64, -64, 64);
  for (const a of left) for (const b of right) assert.ok(a.x !== b.x || a.z !== b.z);
});
