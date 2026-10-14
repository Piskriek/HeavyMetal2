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

test('a chunk with a height offset follows it: positions move by the offset, and a flat offset keeps the normals up', () => {
  const plain = chunkMesh(t, 40, -24, 32, 8);
  const lifted = chunkMesh(t, 40, -24, 32, 8, { offset: () => 1.5 });
  for (let i = 1; i < plain.positions.length; i += 3) assert.ok(near(lifted.positions[i]!, plain.positions[i]! + 1.5, 1e-4));
  for (let i = 0; i < plain.positions.length; i += 3) assert.equal(lifted.positions[i], plain.positions[i], 'x is unchanged');
  for (let i = 0; i < plain.normals.length; i++) assert.ok(near(lifted.normals[i]!, plain.normals[i]!, 1e-5), 'a flat lift changes no normal');
  // a sloped offset tilts the surface: its normals change and the heights follow the offset cell by cell
  const tilted = chunkMesh(t, 40, -24, 32, 8, { offset: (x) => (x - 40) * 0.25 });
  assert.notDeepEqual(Array.from(tilted.normals.slice(0, 3)), Array.from(plain.normals.slice(0, 3)));
  for (let v = 0; v < plain.positions.length; v += 3) {
    const x = tilted.positions[v]!;
    assert.ok(near(tilted.positions[v + 1]!, plain.positions[v + 1]! + (x - 40) * 0.25, 1e-4), 'the tilt is in the heights');
  }
});

test('a refined region keeps fine leaves; the leaves still tile the square; neighbours differ by at most 2x', () => {
  const touches = (cx: number, cz: number, size: number): boolean => Math.abs(cx - 120) < size / 2 + 40 && Math.abs(cz) < size / 2 + 40;
  const leaves = chunksAround(0, 0, { extent: 600, cells: 32, minSize: 16, budget: 60000, refine: { minSize: 16, touches } });
  let area = 0;
  for (const l of leaves) area += l.size * l.size;
  assert.ok(near(area, 1200 * 1200, 1), `the leaves tile the square (${area})`);
  // the quadtree halves a 1200 m root, so the finest leaf it makes for a refinement of 16 m is 18.75 m
  assert.ok(leaves.some((l) => l.size <= 18.75 + 1e-6 && Math.abs(l.cx - 120) < 40 && Math.abs(l.cz) < 40), 'the refined region has fine leaves');
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i]!, b = leaves[j]!;
      const reach = (a.size + b.size) / 2;
      const dx = Math.abs(a.cx - b.cx), dz = Math.abs(a.cz - b.cz);
      const shares = (near(dx, reach, 1e-6) && dz < reach - 1e-6) || (near(dz, reach, 1e-6) && dx < reach - 1e-6);
      // a seam round the refined region may be wider than 2x (the chunk skirts close it); everywhere else the balance holds
      const nearRegion = (l: { readonly cx: number; readonly cz: number }): boolean => Math.abs(l.cx - 120) < 200 && Math.abs(l.cz) < 200;
      if (shares) assert.ok(Math.max(a.size, b.size) <= 2 * Math.min(a.size, b.size) + 1e-6 || nearRegion(a) || nearRegion(b), `neighbours ${a.size} and ${b.size} differ by more than 2x away from the refined region`);
    }
  }
});

test('a refinement leaves the detail round the eye as it was: the leaves far from the refined region are the same', () => {
  const plain = chunksAround(0, 0, { extent: 600, cells: 32, minSize: 16, budget: 60000 });
  const touches = (cx: number, cz: number, size: number): boolean => Math.abs(cx - 120) < size / 2 + 20 && Math.abs(cz) < size / 2 + 20;
  const refined = chunksAround(0, 0, { extent: 600, cells: 32, minSize: 16, budget: 60000, refine: { minSize: 16, touches } });
  const key = (l: { cx: number; cz: number; size: number }): string => `${l.cx},${l.cz},${l.size}`;
  const refinedKeys = new Set(refined.map(key));
  // a plain leaf far from the refined region (more than 150 m from it) must stand in the refined set too
  const far = plain.filter((l) => Math.abs(l.cx - 120) - l.size / 2 > 150);
  assert.ok(far.length > 0, 'there are far leaves to compare');
  for (const l of far) assert.ok(refinedKeys.has(key(l)), `the far leaf ${key(l)} is unchanged`);
});

test('a wide cut (200 by 200 m, the eye in its middle) keeps the leaves inside the budget plus the refinement cap', () => {
  const budget = 60000; // the potato tier's ground budget: 29 leaves of 2048 triangles
  const cap = 48; // the plot ground's EDIT_LEAF_CAP: the most refined leaves a cut may make
  const inCut = (cx: number, cz: number, size: number): boolean => Math.abs(cx) - size / 2 < 100 && Math.abs(cz) - size / 2 < 100;
  const withinReach = (cx: number, cz: number, size: number): boolean =>
    Math.hypot(Math.max(Math.abs(cx) - size / 2, 0), Math.max(Math.abs(cz) - size / 2, 0)) <= 120;
  const plain = chunksAround(0, 0, { extent: 4096, cells: 32, minSize: 16, budget });
  const cut = chunksAround(0, 0, {
    extent: 4096,
    cells: 32,
    minSize: 16,
    budget,
    refine: { minSize: 16, maxLeaves: cap, touches: (cx, cz, size) => withinReach(cx, cz, size) && inCut(cx, cz, size) },
  });
  const budgetLeaves = Math.floor(budget / (2 * 32 * 32));
  assert.ok(plain.length <= budgetLeaves, `the eye's own leaves fit the budget (${plain.length} of ${budgetLeaves})`);
  assert.ok(cut.length <= budgetLeaves + cap, `with the cut the leaves stay within the budget plus the cap (${cut.length} of ${budgetLeaves} + ${cap})`);
  assert.ok(cut.length > plain.length, 'the cut adds leaves');
  assert.ok(cut.some((l) => l.size <= 16 + 1e-9 && Math.abs(l.cx) < 60 && Math.abs(l.cz) < 60), 'the cut has fine leaves next to the eye');
});
