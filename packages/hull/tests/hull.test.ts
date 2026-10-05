import test from 'node:test';
import assert from 'node:assert/strict';
import { contains, hull, volume, voxelBoxes, type V3 } from '../src/index';
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

import { obb, simplify } from '../src/index';

test('duplicate points do not add hull vertices', () => {
  const h = hull([
    ...cube,
    [0, 0, 0],
    [1, 1, 1],
    [0.5, 0.5, 0.5],
  ]);
  assert.equal(h.vertices.length, 8);
  assert.equal(h.faces.length, 12);
});

test('a flat square returns only its extreme points', () => {
  const h = hull([
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0.5, 0.5, 0],
    [0, 0, 0],
  ]);
  assert.equal(h.vertices.length, 4);
  assert.equal(h.faces.length, 0);
  assert.ok(contains(h, [0.5, 0.5, 0]));
  assert.ok(!contains(h, [0.5, 0.5, 0.1]));
});

test('collinear points reduce to their endpoints', () => {
  const h = hull([
    [0, 0, 0],
    [1, 1, 1],
    [2, 2, 2],
    [1, 1, 1],
  ]);
  assert.equal(h.vertices.length, 2);
  assert.equal(h.faces.length, 0);
  assert.ok(contains(h, [0.5, 0.5, 0.5]));
  assert.ok(!contains(h, [3, 3, 3]));
});

test('a sphere cloud is contained by its hull and simplified hull', () => {
  const points: V3[] = [];
  const count = 48;
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (2 * (index + 0.5)) / count;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * 2.399963229728653;
    points.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
  }

  const full = hull(points);
  for (const point of points) assert.ok(contains(full, point, 1e-7));

  const reduced = simplify(full, 12);
  assert.ok(reduced.vertices.length <= 12);
  assert.ok(volume(reduced) <= volume(full) + 1e-8);
  for (const point of reduced.vertices) assert.ok(contains(full, point, 1e-7));
});

test('a rotated box is fitted along its principal axes', () => {
  const angleZ = 0.47;
  const angleY = 0.31;
  const cosZ = Math.cos(angleZ);
  const sinZ = Math.sin(angleZ);
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const points: V3[] = [];

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const localX = 3 * sx;
        const localY = 2 * sy;
        const localZ = sz;
        const rotatedX = cosY * localX + sinY * localZ;
        const rotatedZ = -sinY * localX + cosY * localZ;
        points.push([
          cosZ * rotatedX - sinZ * localY,
          sinZ * rotatedX + cosZ * localY,
          rotatedZ,
        ]);
      }
    }
  }

  const fit = obb(points);
  assert.ok(Math.abs(fit.half[0] - 3) < 1e-8);
  assert.ok(Math.abs(fit.half[1] - 2) < 1e-8);
  assert.ok(Math.abs(fit.half[2] - 1) < 1e-8);

  const expectedLongAxis: V3 = [cosZ * cosY, sinZ * cosY, -sinY];
  const alignment =
    fit.axes[0][0] * expectedLongAxis[0] +
    fit.axes[0][1] * expectedLongAxis[1] +
    fit.axes[0][2] * expectedLongAxis[2];
  assert.ok(Math.abs(alignment) > 1 - 1e-8);
});

test('an L-shaped voxel model uses two boxes, or one covering box when capped', () => {
  const cells = new Uint8Array([1, 1, 1, 0]);
  const exact = voxelBoxes(cells, 2, 2, 1, 4);
  assert.deepEqual(exact, [
    { min: [0, 0, 0], max: [2, 1, 1] },
    { min: [0, 1, 0], max: [1, 2, 1] },
  ]);

  const capped = voxelBoxes(cells, 2, 2, 1, 1);
  assert.deepEqual(capped, [{ min: [0, 0, 0], max: [2, 2, 1] }]);
});