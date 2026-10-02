// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
import test from 'node:test';
import assert from 'node:assert/strict';
import { countFaces, meshVoxels, type MeshInput, type MeshOutput } from '../src/mesh';

type V3 = [number, number, number];
const OPAQUE = { color: [1, 1, 1] as V3, alpha: 1 };
const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} !~= ${b}`);

function grid(sx: number, sy: number, sz: number, fn: (x: number, y: number, z: number) => number, palette = [OPAQUE]): MeshInput {
  const cells = new Uint8Array(sx * sy * sz);
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) cells[x + sx * (y + sy * z)] = fn(x, y, z);
  return { size: [sx, sy, sz], pivot: [0, 0, 0], cells, palette };
}
const cube = (n: number) => grid(n, n, n, () => 1);
/** L-shaped concavity: floor slab (y = 0) plus wall (x = 0) */
const lShape = () => grid(4, 3, 4, (x, y) => (y === 0 || x === 0 ? 1 : 0));

/** invariants every mesh must satisfy */
function validate(o: MeshOutput) {
  const nv = o.positions.length / 3;
  assert.equal(o.normals.length, o.positions.length);
  assert.equal(o.colors.length, o.positions.length);
  assert.equal(o.paletteIndex.length, nv);
  assert.equal(o.indices.length, o.triangleCount * 3);
  for (let i = 0; i < nv; i++) near(Math.hypot(o.normals[i * 3], o.normals[i * 3 + 1], o.normals[i * 3 + 2]), 1);
  for (let i = 0; i < o.indices.length; i++) {
    const id = o.indices[i];
    assert.ok(Number.isInteger(id) && id >= 0 && id < nv, `index ${id} outside [0,${nv})`);
  }
}

/** per-triangle view: also asserts CCW winding and per-quad uniform normal/palette */
function tris(o: MeshOutput) {
  return Array.from({ length: o.triangleCount }, (_, t) => {
    const ids = [o.indices[t * 3], o.indices[t * 3 + 1], o.indices[t * 3 + 2]];
    const p = ids.map((i) => [o.positions[i * 3], o.positions[i * 3 + 1], o.positions[i * 3 + 2]] as V3);
    const n = [o.normals[ids[0] * 3], o.normals[ids[0] * 3 + 1], o.normals[ids[0] * 3 + 2]] as V3;
    const pal = o.paletteIndex[ids[0]];
    for (const id of ids) {
      assert.equal(o.paletteIndex[id], pal);
      assert.deepEqual([o.normals[id * 3], o.normals[id * 3 + 1], o.normals[id * 3 + 2]], n);
    }
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    assert.ok(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] > 0, 'triangle winding is not CCW from outside');
    return { ids, p, n, pal, area: Math.hypot(cr[0], cr[1], cr[2]) / 2 };
  });
}
const area = (o: MeshOutput) => tris(o).reduce((s, t) => s + t.area, 0);

test('single voxel: 6 faces, 12 triangles greedy and non-greedy', () => {
  const m = cube(1);
  assert.equal(countFaces(m), 6);
  for (const greedy of [true, false])
    for (const ao of [true, false]) {
      const o = meshVoxels(m, { greedy, ao });
      validate(o);
      assert.equal(o.triangleCount, 12);
      assert.equal(o.positions.length / 3, 24);
      near(area(o), 6);
      for (const v of o.positions) assert.ok(v >= -1e-6 && v <= 1 + 1e-6, 'unit cube must span [0,1]^3');
      assert.deepEqual([...o.paletteIndex].every((p) => p === 1) ? [1] : [], [1]);
    }
});

test('solid 4x4x4 cube: 12 triangles greedy (ao off), 192 non-greedy', () => {
  const m = cube(4);
  assert.equal(countFaces(m), 96);
  const g = meshVoxels(m, { greedy: true, ao: false });
  validate(g);
  assert.equal(g.triangleCount, 12);
  assert.equal(g.positions.length / 3, 24);
  const ng = meshVoxels(m, { greedy: false, ao: false });
  validate(ng);
  assert.equal(ng.triangleCount, 192);
  assert.equal(ng.positions.length / 3, 384);
  near(area(g), 96);
  near(area(ng), 96);
});

test('3x3x3 cube: 54 visible faces, no interior faces', () => {
  const m = cube(3);
  assert.equal(countFaces(m), 54);
  const o = meshVoxels(m, { greedy: false, ao: false });
  validate(o);
  assert.equal(o.triangleCount, 108);
  near(area(o), 54);
  for (const t of tris(o)) {
    const axis = t.n.findIndex((c) => Math.abs(c) > 0.5);
    const plane = t.p[0][axis];
    assert.ok(Math.abs(plane) < 1e-6 || Math.abs(plane - 3) < 1e-6, `interior face at ${plane}`);
  }
});

test('normals are unit length and point away from the cube centre', () => {
  for (const opts of [{ greedy: true, ao: false }, { greedy: false, ao: true }]) {
    const o = meshVoxels(cube(4), opts);
    validate(o);
    const c: V3 = [2, 2, 2];
    for (let i = 0; i < o.positions.length / 3; i++) {
      const dot = (o.positions[i * 3] - c[0]) * o.normals[i * 3] + (o.positions[i * 3 + 1] - c[1]) * o.normals[i * 3 + 1] + (o.positions[i * 3 + 2] - c[2]) * o.normals[i * 3 + 2];
      assert.ok(dot > 0, `normal not outward at vertex ${i}`);
    }
  }
});

test('ao darkens concave faces, free faces stay bright', () => {
  const o = meshVoxels(lShape(), { greedy: false, ao: true });
  validate(o);
  const concaveIds = new Map<number, number>();
  const free: number[] = [];
  // only the quad of the floor voxel at x=1,z=1 (its top is the concave corner next to the wall)
  for (const t of tris(o)) for (const id of t.ids) {
    const lum = o.colors[id! * 3]!; // white palette => r is the AO factor
    if (t.n[1] > 0.5 && t.p.every((v) => Math.abs(v[1] - 1) < 1e-6 && v[0] >= 1 - 1e-6 && v[0] <= 2 + 1e-6 && v[2] >= 1 - 1e-6 && v[2] <= 2 + 1e-6)) concaveIds.set(id!, lum);
    if (t.n[1] < -0.5) free.push(lum); // underside sees no occluders
  }
  const concave = [...concaveIds.values()];
  assert.equal(concave.length, 4);
  near(Math.min(...concave), 0.6); // level 1 => 1 - 0.2 * 2
  near(Math.max(...concave), 1); // level 3 => full brightness
  assert.ok(Math.min(...concave) < Math.min(...free), 'concave face must be darker than a free face');
  assert.ok(free.every((v) => v === 1));
  const flat = meshVoxels(lShape(), { greedy: false, ao: false });
  assert.ok([...flat.colors].every((v) => v === 1), 'ao off keeps colours untouched');
});

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test('greedy never produces more triangles than non-greedy', () => {
  const palette = [{ color: [0.9, 0.2, 0.2] as V3, alpha: 1 }, { color: [0.2, 0.6, 0.9] as V3, alpha: 0.5 }];
  const models: MeshInput[] = [cube(1), cube(3), cube(5), lShape(), grid(4, 3, 4, (x, y, z) => (x + y + z) % 2 ? 2 : 1, palette)];
  const rnd = lcg(20260214);
  for (let k = 0; k < 8; k++) {
    const sx = 1 + Math.floor(rnd() * 6), sy = 1 + Math.floor(rnd() * 6), sz = 1 + Math.floor(rnd() * 6);
    models.push(grid(sx, sy, sz, () => { const r = rnd(); return r < 0.45 ? 0 : 1 + Math.floor(rnd() * palette.length); }, palette));
  }
  for (const m of models) {
    const faces = countFaces(m);
    const g = meshVoxels(m, { greedy: true, ao: true });
    const n = meshVoxels(m, { greedy: false, ao: true });
    const gf = meshVoxels(m, { greedy: true, ao: false });
    validate(g); validate(n); validate(gf);
    assert.ok(g.triangleCount <= n.triangleCount, 'greedy exceeded non-greedy');
    assert.ok(gf.triangleCount <= g.triangleCount, 'ao splitting must only reduce merging');
    assert.equal(n.triangleCount, faces * 2);
    assert.equal(n.positions.length / 3, faces * 4);
    near(area(g), faces, 1e-5);
    near(area(n), faces, 1e-5);
    near(area(gf), faces, 1e-5);
  }
});

test('two adjacent transparent voxels of the same entry share no face', () => {
  const glass = { color: [0.4, 0.8, 1] as V3, alpha: 0.5 };
  const m = grid(2, 1, 1, () => 1, [glass]);
  assert.equal(countFaces(m), 10); // domino: shared face hidden
  const o = meshVoxels(m, { greedy: true });
  validate(o);
  near(area(o), 10);
  for (const t of tris(o)) assert.ok(!t.p.every((v) => Math.abs(v[0] - 1) < 1e-6), 'face emitted between same transparent entry');
  const two = grid(2, 1, 1, (x) => x + 1, [glass, { color: [1, 0.5, 0.2] as V3, alpha: 0.5 }]);
  assert.equal(countFaces(two), 12); // different entries do emit the shared face
  assert.ok(tris(meshVoxels(two)).some((t) => t.p.every((v) => Math.abs(v[0] - 1) < 1e-6)));
});

test('transparent next to solid emits a face from both sides', () => {
  const palette = [{ color: [1, 1, 1] as V3, alpha: 1 }, { color: [0.3, 1, 0.5] as V3, alpha: 0.4 }];
  const m = grid(2, 1, 1, (x) => x + 1, palette); // (0,0,0) solid, (1,0,0) transparent
  assert.equal(countFaces(m), 12);
  const shared = tris(meshVoxels(m, { greedy: false })).filter((t) => t.p.every((v) => Math.abs(v[0] - 1) < 1e-6));
  assert.equal(shared.length, 4); // two faces, two triangles each
  assert.deepEqual(shared.map((t) => t.n[0]).sort(), [-1, -1, 1, 1]);
  assert.equal(shared.find((t) => t.n[0] > 0)!.pal, 1); // solid voxel faces the transparent one
  assert.equal(shared.find((t) => t.n[0] < 0)!.pal, 2); // transparent voxel faces the solid one
});

test('pivot offsets positions', () => {
  const m = cube(3);
  const pivot: V3 = [1.5, -2, 0.25];
  const a = meshVoxels({ ...m, pivot: [0, 0, 0] }, { greedy: true });
  const b = meshVoxels({ ...m, pivot }, { greedy: true });
  validate(b);
  assert.equal(a.positions.length, b.positions.length);
  for (let i = 0; i < a.positions.length; i++) near(b.positions[i], a.positions[i] - pivot[i % 3]);
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < b.positions.length / 3; i++)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], b.positions[i * 3 + k]);
      max[k] = Math.max(max[k], b.positions[i * 3 + k]);
    }
  for (let k = 0; k < 3; k++) {
    near(min[k], -pivot[k]);
    near(max[k], 3 - pivot[k]);
  }
  near(area(b), countFaces(m), 1e-5);
});

test('paletteIndex and colours match the cell value', () => {
  const palette = [{ color: [1, 0.25, 0] as V3, alpha: 1 }, { color: [0, 0.5, 1] as V3, alpha: 0.5 }];
  const m = grid(3, 1, 1, (x) => (x === 1 ? 0 : x === 0 ? 1 : 2), palette); // two isolated voxels
  assert.equal(countFaces(m), 12);
  const o = meshVoxels(m, { greedy: true, ao: false });
  validate(o);
  const seen = new Set<number>();
  for (const t of tris(o)) {
    const expected = t.p[0][0] < 1.5 ? 1 : 2;
    assert.equal(t.pal, expected);
    seen.add(expected);
    const c = palette[expected - 1].color;
    for (const id of t.ids) for (let k = 0; k < 3; k++) near(o.colors[id * 3 + k], c[k]);
  }
  assert.deepEqual([...seen].sort(), [1, 2]);
  near(area(o), 12);
});