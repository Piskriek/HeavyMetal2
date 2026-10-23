import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Batcher, type Part } from '../src/index';
const mats = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
const parts: Record<string, Part[]> = { wall: [{ geometry: new THREE.BoxGeometry(4, 3, 0.25), material: mats[0]! }, { geometry: new THREE.BoxGeometry(4, 0.2, 0.3), material: mats[1]! }], pillar: [{ geometry: new THREE.BoxGeometry(0.4, 3, 0.4), material: mats[0]! }] };
const at = (x: number, z: number) => new THREE.Matrix4().makeTranslation(x, 0, z);
test('batches by key and part, stays dense, keeps matrices and tints through swaps', () => {
  const root = new THREE.Group(); let calls = 0;
  const b = new Batcher(root, (k) => { calls++; return parts[k]!; });
  for (let i = 0; i < 1000; i++) b.set(i, i % 3 ? 'wall' : 'pillar', at(i, i % 7));
  assert.equal(calls, 2); assert.equal(b.drawCalls, 3); assert.equal(b.instances, 1000);
  b.tint(999, new THREE.Color(1, 0, 0));
  for (let i = 0; i < 1000; i += 2) b.remove(i);
  assert.equal(b.instances, 500); assert.ok(!b.has(0) && b.has(1));
  const wall = root.children.find((c) => c.name === 'wall#0') as THREE.InstancedMesh;
  assert.equal(wall.count, [...Array(1000).keys()].filter((i) => i % 2 && i % 3).length);
  for (const id of [1, 5, 999]) { const m = b.matrixOf(id)!; assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(m).toArray(), [id, 0, id % 7]); }
  const slots: number[] = []; for (let s = 0; s < wall.count; s++) { const m = new THREE.Matrix4(); wall.getMatrixAt(s, m); slots.push(new THREE.Vector3().setFromMatrixPosition(m).x); }
  assert.deepEqual([...slots].sort((x, y) => x - y), [...Array(1000).keys()].filter((i) => i % 2 && i % 3));
  const c = new THREE.Color(); wall.getColorAt(slots.indexOf(999), c); assert.deepEqual(c.toArray(), [1, 0, 0]);
  b.set(5, 'pillar', at(-50, -50)); assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(b.matrixOf(5)!).toArray(), [-50, 0, -50]);
  for (let i = 0; i < 1000; i++) b.remove(i); assert.equal(b.instances, 0); assert.equal(b.drawCalls, 0);
  b.dispose(); assert.equal(root.children.length, 0);
});
