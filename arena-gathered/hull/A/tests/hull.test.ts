import test from 'node:test';
import assert from 'node:assert/strict';
import { aabb, contains, hull, obb, simplify, volume, voxelBoxes, type V3 } from '../src/index';
const cube: V3[] = [];
for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) cube.push([x, y, z]);
cube.push([0.5, 0.5, 0.5], [0.2, 0.7, 0.4]);
test('the hull of a cube', () => {
  const h = hull(cube);
  assert.equal(h.vertices.length, 8);
  assert.equal(h.faces.length, 12);
  assert.ok(Math.abs(volume(h) - 1) < 1e-9);
  assert.ok(contains(h, [0.5, 0.5, 0.5]));
  assert.ok(!contains(h, [1.5, 0.5, 0.5]));
});
test('a full 2x2x2 voxel block is one box', () => {
  assert.deepEqual(voxelBoxes(new Uint8Array(8).fill(1), 2, 2, 2, 4), [{ min: [0, 0, 0], max: [2, 2, 2] }]);
});

test('duplicate points do not break the hull', () => {
  const h = hull([...cube, ...cube, [1, 1, 1], [0, 0, 0]]);
  assert.equal(h.vertices.length, 8);
  assert.equal(h.faces.length, 12);
  assert.ok(Math.abs(volume(h) - 1) < 1e-9);
});
test('a flat square is a degenerate hull', () => {
  const h = hull([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0.5, 0.5, 0], [0.3, 0.2, 0]]);
  assert.equal(h.faces.length, 0);
  assert.equal(h.vertices.length, 4);
  assert.equal(volume(h), 0);
  assert.ok(contains(h, [0.5, 0.5, 0]));
  assert.ok(!contains(h, [0.5, 0.5, 0.1]));
});
test('collinear points give the two endpoints', () => {
  const h = hull([[0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3], [1.5, 1.5, 1.5]]);
  assert.equal(h.faces.length, 0);
  assert.equal(h.vertices.length, 2);
  assert.deepEqual(h.vertices.map((v) => v[0]).sort(), [0, 3]);
  assert.deepEqual(hull([[1, 2, 3], [1, 2, 3]]), { vertices: [[1, 2, 3]], faces: [] });
  assert.deepEqual(hull([]), { vertices: [], faces: [] });
});
function sphere(): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i < 400; i++) {
    const t = i * 2.399963, z = 1 - (2 * i + 1) / 400, r = Math.sqrt(1 - z * z);
    pts.push([r * Math.cos(t), r * Math.sin(t), z]);
  }
  return pts;
}
test("a sphere cloud's hull contains all points", () => {
  const pts = sphere();
  const h = hull(pts);
  assert.ok(h.vertices.length > 100);
  assert.equal(h.faces.length, 2 * h.vertices.length - 4);
  for (const p of pts) assert.ok(contains(h, p, 1e-7));
  assert.ok(!contains(h, [1.1, 0, 0]));
  const v = volume(h);
  assert.ok(v > 3.9 && v < 4.19);
});
test('simplify keeps the hull inside and under the vertex budget', () => {
  const h = hull(sphere());
  const s = simplify(h, 12);
  assert.ok(s.vertices.length <= 12 && s.vertices.length >= 4);
  assert.ok(s.faces.length > 0);
  for (const v of s.vertices) assert.ok(contains(h, v, 1e-7));
  assert.ok(volume(s) < volume(h));
  assert.ok(volume(s) > 1);
  assert.equal(simplify(h, 1000).vertices.length, h.vertices.length);
});
test('aabb and obb of a rotated box', () => {
  const a = aabb(cube);
  assert.deepEqual(a.centre, [0.5, 0.5, 0.5]);
  assert.deepEqual(a.half, [0.5, 0.5, 0.5]);
  const c = Math.cos(0.7), s = Math.sin(0.7);
  const pts: V3[] = [];
  for (const x of [-3, 3]) for (const y of [-2, 2]) for (const z of [-1, 1]) {
    const rx = c * x - s * y, ry = s * x + c * y;
    pts.push([rx + 10, ry - 4, z + 2]);
  }
  const b = obb(pts);
  const half = [...b.half].sort((p, q) => q - p);
  assert.ok(Math.abs(half[0]! - 3) < 1e-6 && Math.abs(half[1]! - 2) < 1e-6 && Math.abs(half[2]! - 1) < 1e-6);
  assert.ok(Math.abs(b.centre[0] - 10) < 1e-6 && Math.abs(b.centre[1] + 4) < 1e-6 && Math.abs(b.centre[2] - 2) < 1e-6);
  const ab = aabb(pts);
  assert.ok(ab.half[0] * ab.half[1] * ab.half[2] > 6);
  for (const ax of b.axes) assert.ok(Math.abs(Math.hypot(...ax) - 1) < 1e-9);
});
test('voxelBoxes of an L shape', () => {
  const cells = new Uint8Array(9);
  for (const [x, y] of [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]) cells[x! + y! * 3] = 1;
  const boxes = voxelBoxes(cells, 3, 3, 1, 8);
  assert.equal(boxes.length, 2);
  const inside = (x: number, y: number) => boxes.some((b) => x >= b.min[0] && x < b.max[0] && y >= b.min[1] && y < b.max[1]);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) assert.equal(inside(x, y), cells[x + y * 3] === 1);
  const one = voxelBoxes(cells, 3, 3, 1, 1);
  assert.deepEqual(one, [{ min: [0, 0, 0], max: [3, 3, 1] }]);
  assert.deepEqual(voxelBoxes(new Uint8Array(27), 3, 3, 3, 4), []);
});