// Hidden landing suite for @hm/batcher (not sent): bounds, capacity, re-keying, tints through swaps, shared parts
// untouched, and a long random workload checked against a plain model.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Batcher, type Part } from '../src/index';

const mat = new THREE.MeshBasicMaterial();
const geo = { a: new THREE.BoxGeometry(1, 1, 1), b: new THREE.BoxGeometry(2, 1, 1), c: new THREE.BoxGeometry(1, 2, 1) };
const parts: Record<string, Part[]> = { a: [{ geometry: geo.a, material: mat }], b: [{ geometry: geo.b, material: mat }, { geometry: geo.c, material: mat }] };
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const meshes = (root: THREE.Object3D) => root.children.filter((c): c is THREE.InstancedMesh => (c as THREE.InstancedMesh).isInstancedMesh === true);
/** Whatever lazy work the batcher does before a frame, then the mesh's sphere. */
function sphereOf(m: THREE.InstancedMesh): THREE.Sphere {
  const dummy = null as unknown as THREE.WebGLRenderer;
  m.onBeforeRender(dummy, new THREE.Scene(), new THREE.PerspectiveCamera(), m.geometry, m.material as THREE.Material, null as unknown as THREE.Group);
  if (!m.boundingSphere) m.computeBoundingSphere();
  return m.boundingSphere!;
}

test('bounds follow moves and removals', () => {
  const root = new THREE.Group(), b = new Batcher(root, (k) => parts[k]!);
  for (let i = 0; i < 20; i++) b.set(i, 'a', at(i, 0, 0));
  const m = meshes(root).find((x) => x.name === 'a#0')!;
  b.set(3, 'a', at(500, 0, 500));
  assert.ok(sphereOf(m).containsPoint(new THREE.Vector3(500, 0, 500)), 'a moved instance is outside its bounds');
  assert.ok(m.matrixAutoUpdate === false);
});

test('capacity doubles from 16 and keeps every matrix and tint', () => {
  const root = new THREE.Group(), b = new Batcher(root, (k) => parts[k]!);
  for (let i = 0; i < 16; i++) { b.set(i, 'a', at(i, 1, 2)); b.tint(i, new THREE.Color(i / 20, 0, 1)); }
  const before = meshes(root).find((x) => x.name === 'a#0')!; assert.equal(before.instanceMatrix.count, 16);
  b.set(16, 'a', at(16, 1, 2));
  const after = meshes(root).find((x) => x.name === 'a#0')!; assert.equal(after.instanceMatrix.count, 32); assert.equal(after.count, 17);
  for (let i = 0; i < 16; i++) { assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(b.matrixOf(i)!).toArray(), [i, 1, 2]); }
  const c = new THREE.Color(); for (let s = 0; s < after.count; s++) { const mm = new THREE.Matrix4(); after.getMatrixAt(s, mm); const x = new THREE.Vector3().setFromMatrixPosition(mm).x; if (x < 16) { after.getColorAt(s, c); assert.ok(Math.abs(c.r - x / 20) < 1e-6 && c.b === 1, `tint of ${x}`); } }
});

test('re-keying moves an instance between batches; dispose leaves the shared parts alone', () => {
  const root = new THREE.Group(), b = new Batcher(root, (k) => parts[k]!);
  b.set(1, 'a', at(1, 0, 0)); b.set(2, 'a', at(2, 0, 0)); b.set(1, 'b', at(1, 0, 0));
  const count = (n: string) => meshes(root).find((x) => x.name === n)?.count ?? 0;
  assert.deepEqual([count('a#0'), count('b#0'), count('b#1')], [1, 1, 1]); assert.equal(b.drawCalls, 3);
  let disposed = 0; for (const g of Object.values(geo)) g.addEventListener('dispose', () => disposed++);
  b.remove(42); b.dispose(); assert.equal(disposed, 0); assert.equal(meshes(root).length, 0);
});

test('a long random workload matches a plain model', () => {
  const root = new THREE.Group(), b = new Batcher(root, (k) => parts[k]!);
  const model = new Map<number, { key: string; x: number }>();
  let s = 7; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let op = 0; op < 3000; op++) {
    const id = Math.floor(rnd() * 300), r = rnd();
    if (r < 0.6) { const key = rnd() < 0.5 ? 'a' : 'b', x = Math.floor(rnd() * 1000); b.set(id, key, at(x, 0, 0)); model.set(id, { key, x }); }
    else { b.remove(id); model.delete(id); }
  }
  assert.equal(b.instances, model.size);
  for (const [id, v] of model) assert.equal(new THREE.Vector3().setFromMatrixPosition(b.matrixOf(id)!).x, v.x);
  const want = (k: string) => [...model.values()].filter((v) => v.key === k).map((v) => v.x).sort((p, q) => p - q);
  const got = (n: string) => { const m = meshes(root).find((x) => x.name === n)!; const xs: number[] = []; for (let i = 0; i < m.count; i++) { const mm = new THREE.Matrix4(); m.getMatrixAt(i, mm); xs.push(new THREE.Vector3().setFromMatrixPosition(mm).x); } return xs.sort((p, q) => p - q); };
  assert.deepEqual(got('a#0'), want('a')); assert.deepEqual(got('b#0'), want('b')); assert.deepEqual(got('b#1'), want('b'));
});
