import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createModel, fillBox, meshVoxels, setVoxel } from '@hm/voxel';
import { DecorView, halveModel } from '../src';

const bounds = (positions: Float32Array, k: number): number[] => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a]!, positions[i + a]! * k); hi[a] = Math.max(hi[a]!, positions[i + a]! * k); }
  return [...lo, ...hi];
};

test('the halved model covers the same space at twice the block size', () => {
  const m = fillBox(createModel('cube', 'cube', [4, 6, 4]), [0, 0, 0], [3, 5, 3], 1);
  const h = halveModel(m);
  assert.deepEqual(h.size, [2, 3, 2]);
  assert.deepEqual(h.pivot, [m.pivot[0] / 2, 0, m.pivot[2] / 2]);
  assert.deepEqual(bounds(meshVoxels(h).positions, 2), bounds(meshVoxels(m).positions, 1));
});

test('thin parts keep their silhouette and each group takes its most common colour', () => {
  let line = createModel('line', 'line', [6, 1, 1]);
  for (let x = 0; x < 6; x++) line = setVoxel(line, x, 0, 0, 3);
  assert.deepEqual([...halveModel(line).cells], [3, 3, 3]);
  let mixed = fillBox(createModel('mix', 'mix', [2, 2, 2]), [0, 0, 0], [1, 1, 1], 1);
  mixed = setVoxel(setVoxel(setVoxel(mixed, 0, 0, 0, 2), 1, 0, 0, 2), 0, 1, 0, 2);
  assert.deepEqual([...halveModel(mixed).cells], [1]);
});

test('plants far from the camera switch to the halved model, near ones keep every voxel', () => {
  const palm = fillBox(createModel('lod-palm', 'palm', [4, 8, 4]), [1, 0, 1], [2, 7, 2], 1);
  const at = (x: number) => ({ parts: [], x, y: 0, z: 0, yaw: 0, scale: 1, voxel: { id: 'lod-palm', model: palm, block: 0.25 } });
  const view = new DecorView([at(0), at(5), at(40), at(90)]);
  const [near, far] = view.group.children as THREE.InstancedMesh[];
  assert.equal(near!.count, 4, 'full detail everywhere until a tier sets a radius');
  view.setDetailRadius(18);
  view.update(new THREE.Vector3(0, 0, 0));
  assert.equal(near!.count, 2);
  assert.equal(far!.count, 2);
  view.setDetailRadius(Infinity);
  assert.equal(near!.count, 4);
  assert.equal(far!.count, 0);
  view.dispose();
});
