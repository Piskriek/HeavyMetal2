import test from 'node:test';
import assert from 'node:assert/strict';
import { greedy, naiveFaces, toMesh, triangles, type Mesh, type Quad, type Volume } from '../src/index';

const solid = (n: number, c = 1): Volume => ({ sx: n, sy: n, sz: n, cells: new Uint8Array(n * n * n).fill(c) });

test('a solid cube becomes six quads', () => {
  const q = greedy(solid(8));
  assert.equal(q.length, 6);
  assert.equal(naiveFaces(solid(8)), 6 * 64);
  const m = toMesh(q);
  assert.equal(triangles(m), 12);
  assert.equal(m.positions.length / 3, 24);
});

test('a single cell', () => {
  const v: Volume = { sx: 3, sy: 3, sz: 3, cells: new Uint8Array(27) };
  v.cells[13] = 5;
  const q = greedy(v);
  assert.equal(q.length, 6);
  assert.ok(q.every((x) => x.color === 5 && x.u1 - x.u0 === 1 && x.v1 - x.v0 === 1));
});

// ---------------------------------------------------------------- helpers

type V3 = [number, number, number];

const empty = (sx: number, sy: number, sz: number): Volume => ({ sx, sy, sz, cells: new Uint8Array(sx * sy * sz) });

const put = (v: Volume, x: number, y: number, z: number, c: number): void => {
  v.cells[x + y * v.sx + z * v.sx * v.sy] = c;
};

const area = (qs: readonly Quad[]): number => qs.reduce((s, q) => s + (q.u1 - q.u0) * (q.v1 - q.v0), 0);

const f = (a: Float32Array, i: number): number => a[i] ?? Number.NaN;
const u32 = (a: Uint32Array, i: number): number => a[i] ?? -1;
const u8 = (a: Uint8Array, i: number): number => a[i] ?? -1;
const quadAt = (qs: readonly Quad[], i: number): Quad => {
  const q = qs[i];
  if (q === undefined) throw new Error('no quad at ' + String(i));
  return q;
};

const pos = (m: Mesh, i: number): V3 => [f(m.positions, i * 3), f(m.positions, i * 3 + 1), f(m.positions, i * 3 + 2)];
const nrm = (m: Mesh, i: number): V3 => [f(m.normals, i * 3), f(m.normals, i * 3 + 1), f(m.normals, i * 3 + 2)];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The 2x2x1 L: three cells of one colour, one corner missing. */
const lShape = (c = 1): Volume => {
  const v = empty(2, 2, 1);
  put(v, 0, 0, 0, c);
  put(v, 1, 0, 0, c);
  put(v, 0, 1, 0, c);
  return v;
};

/** A chunky two-colour 32^3 toy world: 8x8 plateaus of four different heights. */
const world = (): Volume => {
  const v = empty(32, 32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const h = 6 + 2 * (((x >> 3) * 3 + (y >> 3) * 5) % 4);
      for (let z = 0; z < h; z++) put(v, x, y, z, z < 4 ? 1 : 2);
    }
  }
  return v;
};

// ---------------------------------------------------------------- tests

test('quads cover every exposed face exactly once', () => {
  for (const v of [solid(1), solid(4, 9), lShape(), world()]) {
    assert.equal(area(greedy(v)), naiveFaces(v));
  }
});

test('an L shape', () => {
  const v = lShape();
  const q = greedy(v);
  // 3 (+x/-x) + 3 (+y/-y) + 4 (two steps top and bottom) quads for 14 cell faces
  assert.equal(q.length, 10);
  assert.equal(naiveFaces(v), 14);
  assert.equal(area(q), 14);
  assert.equal(triangles(toMesh(q)), 20);
  // the two bottom quads are the greedy run [0,2)x[0,1) plus the leftover [0,1)x[1,2)
  const bottom = q.filter((x) => x.axis === 2 && x.dir === -1);
  assert.deepEqual(bottom, [
    { axis: 2, dir: -1, plane: 0, u0: 0, v0: 0, u1: 2, v1: 1, color: 1 },
    { axis: 2, dir: -1, plane: 0, u0: 0, v0: 1, u1: 1, v1: 2, color: 1 },
  ]);
});

test('two colours side by side stay separate', () => {
  const v = empty(2, 1, 1);
  put(v, 0, 0, 0, 1);
  put(v, 1, 0, 0, 2);
  const q = greedy(v);
  assert.equal(naiveFaces(v), 10); // the shared wall is not exposed
  assert.equal(area(q), 10);
  assert.equal(q.length, 10); // nothing merges across the colour change
  assert.ok(q.every((x) => x.u1 - x.u0 === 1 && x.v1 - x.v0 === 1));
  assert.equal(q.filter((x) => x.color === 1).length, 5);
  assert.equal(q.filter((x) => x.color === 2).length, 5);
  // no face is generated between the two solid cells
  assert.equal(q.filter((x) => x.axis === 0 && x.plane === 1).length, 0);

  // same shape in one colour merges down to a 2x1x1 box
  const one = empty(2, 1, 1);
  put(one, 0, 0, 0, 1);
  put(one, 1, 0, 0, 1);
  assert.equal(greedy(one).length, 6);
});

test('a hollow box has inside faces', () => {
  const v = solid(3, 4);
  put(v, 1, 1, 1, 0); // carve the middle out
  const q = greedy(v);
  assert.equal(naiveFaces(v), 6 * 9 + 6); // outer shell plus the cavity
  assert.equal(area(q), 6 * 9 + 6);
  assert.equal(q.length, 12);
  assert.equal(q.filter((x) => (x.u1 - x.u0) * (x.v1 - x.v0) === 9).length, 6);
  const inside = q.filter((x) => (x.u1 - x.u0) * (x.v1 - x.v0) === 1);
  assert.equal(inside.length, 6);
  // inside faces look into the cavity, i.e. the opposite way of the outer shell
  for (const x of inside) assert.equal(x.plane, x.dir === 1 ? 1 : 2);
  assert.equal(triangles(toMesh(q)), 24);
});

test('faces at the volume edge count as exposed', () => {
  const one = empty(1, 1, 1);
  put(one, 0, 0, 0, 3);
  assert.equal(naiveFaces(one), 6);
  assert.equal(greedy(one).length, 6);
  // a cell touching a wall still gets its wall face
  const v = empty(2, 1, 1);
  put(v, 0, 0, 0, 3);
  const minusX = greedy(v).filter((q) => q.axis === 0 && q.dir === -1);
  assert.equal(minusX.length, 1);
  assert.equal(quadAt(minusX, 0).plane, 0);
  assert.equal(naiveFaces(v), 6);
});

test('normals point outward and triangles wind counter-clockwise', () => {
  const v = empty(3, 3, 3);
  put(v, 1, 1, 1, 7);
  const m = toMesh(greedy(v));
  assert.equal(triangles(m), 12);
  const centre: V3 = [1.5, 1.5, 1.5];
  for (let t = 0; t < triangles(m); t++) {
    const ia = u32(m.indices, t * 3);
    const ib = u32(m.indices, t * 3 + 1);
    const ic = u32(m.indices, t * 3 + 2);
    const a = pos(m, ia);
    const b = pos(m, ib);
    const c = pos(m, ic);
    const n = nrm(m, ia);
    assert.deepEqual(nrm(m, ib), n);
    assert.deepEqual(nrm(m, ic), n);
    assert.equal(Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]), 1); // unit axis normal
    assert.ok(dot(cross(sub(b, a), sub(c, a)), n) > 0, 'counter-clockwise seen from outside');
    const centroid: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    assert.ok(dot(n, sub(centroid, centre)) > 0, 'normal points away from the voxel');
    assert.equal(u8(m.colors, ia), 7);
  }
});

test('welding merges vertices of the same position, normal and colour', () => {
  const bottom = greedy(lShape()).filter((q) => q.axis === 2 && q.dir === -1);
  assert.equal(bottom.length, 2);
  const m = toMesh(bottom);
  assert.equal(triangles(m), 4);
  assert.equal(m.positions.length / 3, 7); // 8 corners, one shared corner welded away
  assert.equal(m.colors.length, 7);
  assert.equal(m.normals.length / 3, 7);

  // ... but never across a colour change, even for coplanar touching quads
  const two = empty(2, 1, 1);
  put(two, 0, 0, 0, 1);
  put(two, 1, 0, 0, 2);
  const split = greedy(two).filter((q) => q.axis === 2 && q.dir === -1);
  assert.equal(split.length, 2);
  assert.equal(toMesh(split).positions.length / 3, 8);
});

test('every vertex of a mesh is unique in position, normal and colour', () => {
  const m = toMesh(greedy(world()));
  const seen = new Set<string>();
  for (let i = 0; i < m.colors.length; i++) {
    const p = pos(m, i);
    const n = nrm(m, i);
    seen.add([p[0], p[1], p[2], n[0], n[1], n[2], u8(m.colors, i)].join(','));
  }
  assert.equal(seen.size, m.colors.length);
  assert.equal(m.positions.length, m.normals.length);
  for (let i = 0; i < m.indices.length; i++) assert.ok(u32(m.indices, i) < m.colors.length);
});

test('a 32x32x32 world costs hundreds of triangles, not tens of thousands', () => {
  const v = world();
  const q = greedy(v);
  const m = toMesh(q);
  const naiveTriangles = 2 * naiveFaces(v);
  assert.equal(area(q), naiveFaces(v));
  assert.equal(triangles(m), 2 * q.length);
  assert.ok(naiveTriangles > 5000, `naive ${naiveTriangles}`);
  assert.ok(triangles(m) < 500, `greedy ${triangles(m)}`);
  assert.ok(triangles(m) * 20 < naiveTriangles, `ratio ${naiveTriangles / triangles(m)}`);

  // and the worst case, a full block, is still six quads
  const block = solid(32, 2);
  assert.equal(greedy(block).length, 6);
  assert.equal(triangles(toMesh(greedy(block))), 12);
  assert.equal(naiveFaces(block), 6 * 32 * 32);
});

test('output order is deterministic', () => {
  const v = world();
  assert.deepEqual(greedy(v), greedy(v));
  const q = greedy(v);
  const rank = (x: Quad): number =>
    ((((x.axis * 2 + (x.dir === -1 ? 0 : 1)) * 64 + x.plane) * 64 + x.v0) * 64 + x.u0);
  for (let i = 1; i < q.length; i++) {
    assert.ok(rank(quadAt(q, i - 1)) < rank(quadAt(q, i)), 'quads come out in axis/dir/plane/v/u order');
  }
  assert.deepEqual(Array.from(toMesh(q).indices), Array.from(toMesh(greedy(v)).indices));
});

test('an empty volume makes no geometry', () => {
  const v = empty(4, 4, 4);
  assert.equal(greedy(v).length, 0);
  assert.equal(naiveFaces(v), 0);
  const m = toMesh([]);
  assert.equal(triangles(m), 0);
  assert.equal(m.positions.length, 0);
});