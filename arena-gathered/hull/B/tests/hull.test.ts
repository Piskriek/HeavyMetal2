import test from 'node:test';
import assert from 'node:assert/strict';
import { contains, hull, volume, voxelBoxes, type V3 } from '../src/index';
import { aabb, obb, simplify } from '../src/index';
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

test('duplicate points do not duplicate hull vertices', () => {
  const h = hull([...cube, [0, 0, 0], [1, 1, 1], [0.5, 0.5, 0.5]]);
  assert.equal(h.vertices.length, 8);
});

test('a flat square returns its extreme corners without faces', () => {
  const h = hull([
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0.5, 0.5, 0], [0.5, 0, 0], [0, 0, 0],
  ]);
  assert.equal(h.vertices.length, 4);
  assert.deepEqual(h.faces, []);
});

test('collinear points return only the two endpoints', () => {
  const h = hull([[0, 0, 0], [1, 2, 3], [2, 4, 6], [0.5, 1, 1.5], [1, 2, 3]]);
  assert.equal(h.vertices.length, 2);
  assert.deepEqual(h.faces, []);
  assert.ok(contains(h, [1, 2, 3]));
  assert.ok(!contains(h, [1, 2, 4]));
});

test("a sphere cloud's hull contains every point", () => {
  const cloud: V3[] = [];
  const count = 48;
  for (let index = 0; index < count; index += 1) {
    const y = 1 - 2 * (index + 0.5) / count;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * 2.399963229728653;
    cloud.push([radius * Math.cos(angle), y, radius * Math.sin(angle)]);
  }
  const h = hull(cloud);
  assert.ok(h.faces.length > 0);
  for (const point of cloud) assert.ok(contains(h, point, 1e-8));
});

test('simplification keeps its new hull inside the source hull', () => {
  const source = hull(cube);
  const reduced = simplify(source, 4);
  assert.ok(reduced.vertices.length <= 4);
  for (const point of reduced.vertices) assert.ok(contains(source, point));
});

test('the principal-axis box fits a rotated box', () => {
  const angle = 0.37;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const points: V3[] = [];
  for (const x of [-3, 3]) {
    for (const y of [-1, 1]) {
      for (const z of [-0.5, 0.5]) points.push([x * cosine - y * sine, x * sine + y * cosine, z]);
    }
  }
  const box = obb(points);
  assert.ok(Math.abs(box.half[0] - 3) < 1e-8);
  assert.ok(Math.abs(box.half[1] - 1) < 1e-8);
  assert.ok(Math.abs(box.half[2] - 0.5) < 1e-8);
});

test('an axis-aligned box uses world axes', () => {
  const box = aabb([[1, 2, 3], [5, 8, 11]]);
  assert.deepEqual(box.centre, [3, 5, 7]);
  assert.deepEqual(box.half, [2, 3, 4]);
  assert.deepEqual(box.axes, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
});

test('voxelBoxes preserves an L shape with a small greedy decomposition', () => {
  const cells = new Uint8Array([1, 1, 1, 0]);
  const boxes = voxelBoxes(cells, 2, 2, 1, 4);
  assert.equal(boxes.length, 2);
  const isCovered = (x: number, y: number): boolean => boxes.some(({ min, max }) =>
    x >= min[0] && x < max[0] && y >= min[1] && y < max[1] && 0 >= min[2] && 0 < max[2],
  );
  assert.ok(isCovered(0, 0));
  assert.ok(isCovered(1, 0));
  assert.ok(isCovered(0, 1));
  assert.ok(!isCovered(1, 1));
});

test('voxelBoxes merges to a strict box budget while covering solids', () => {
  const cells = new Uint8Array([1, 1, 1, 0]);
  const boxes = voxelBoxes(cells, 2, 2, 1, 1);
  assert.ok(boxes.length <= 1);
  for (const [index, value] of cells.entries()) {
    if (value === 0) continue;
    const x = index % 2;
    const y = Math.floor(index / 2);
    assert.ok(boxes.some(({ min, max }) => x >= min[0] && x < max[0] && y >= min[1] && y < max[1]));
  }
});