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
  b.tint(997, new THREE.Color(1, 0, 0));
  for (let i = 0; i < 1000; i += 2) b.remove(i);
  assert.equal(b.instances, 500); assert.ok(!b.has(0) && b.has(1));
  const wall = root.children.find((c) => c.name === 'wall#0') as THREE.InstancedMesh;
  assert.equal(wall.count, [...Array(1000).keys()].filter((i) => i % 2 && i % 3).length);
  for (const id of [1, 5, 999]) { const m = b.matrixOf(id)!; assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(m).toArray(), [id, 0, id % 7]); }
  const slots: number[] = []; for (let s = 0; s < wall.count; s++) { const m = new THREE.Matrix4(); wall.getMatrixAt(s, m); slots.push(new THREE.Vector3().setFromMatrixPosition(m).x); }
  assert.deepEqual([...slots].sort((x, y) => x - y), [...Array(1000).keys()].filter((i) => i % 2 && i % 3));
  const c = new THREE.Color(); wall.getColorAt(slots.indexOf(997), c); assert.deepEqual(c.toArray(), [1, 0, 0]);
  b.set(5, 'pillar', at(-50, -50)); assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(b.matrixOf(5)!).toArray(), [-50, 0, -50]);
  for (let i = 0; i < 1000; i++) b.remove(i); assert.equal(b.instances, 0); assert.equal(b.drawCalls, 0);
  b.dispose(); assert.equal(root.children.length, 0);
});

// The single deviation from the test above, and why: 999 % 3 === 0, so id 999 is
// a *pillar*, never a wall - the `deepEqual` just above proves 999 is not one of
// the wall's slots, so `slots.indexOf(999)` was always -1 and `getColorAt(-1)`
// reads out of bounds, which can only ever return NaN/undefined, never [1,0,0].
// 997 is odd and not a multiple of 3, i.e. a live wall instance, which is what
// that assertion is about. The original intent (a tint surviving compaction on
// the *other* key) is covered by 'keeps a tint through re-keying' below.

const meshNamed = (root: THREE.Object3D, name: string): THREE.InstancedMesh => {
  const found = root.children.find((c) => c.name === name);
  assert.ok(found instanceof THREE.InstancedMesh, `missing ${name}`);
  return found;
};
const positionOf = (mesh: THREE.InstancedMesh, slot: number): number[] =>
  new THREE.Vector3().setFromMatrixPosition(mesh.getMatrixAt(slot, new THREE.Matrix4())).toArray();
const liveSlots = (mesh: THREE.InstancedMesh): number[] => {
  const xs: number[] = [];
  for (let slot = 0; slot < mesh.count; slot++) xs.push(positionOf(mesh, slot)[0]!);
  return xs;
};

test('doubles capacity from 16, carrying every matrix and tint into the rebuilt mesh', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);

  for (let i = 0; i < 16; i++) b.set(i, 'wall', at(i, i));
  assert.equal(meshNamed(root, 'wall#0').instanceMatrix.count, 16);

  b.tint(5, new THREE.Color(0, 0, 1));
  b.set(16, 'wall', at(16, 16)); // one past full -> rebuild

  const grown = meshNamed(root, 'wall#0');
  assert.equal(grown.instanceMatrix.count, 32);
  assert.equal(root.children.filter((c) => c.name === 'wall#0').length, 1);
  assert.equal(grown.count, 17);
  assert.equal(grown.name, 'wall#0');
  for (let i = 0; i < 17; i++) assert.deepEqual(positionOf(grown, i), [i, 0, i]);
  const c = new THREE.Color(); grown.getColorAt(5, c);
  assert.deepEqual(c.toArray(), [0, 0, 1]);
  assert.equal(meshNamed(root, 'wall#1').instanceMatrix.count, 32);
  assert.equal(meshNamed(root, 'wall#1').count, 17);

  // Moving instances that already have a slot must not rebuild anything.
  for (let i = 0; i < 17; i++) b.set(i, 'wall', at(i * 2, i));
  assert.ok(root.children.includes(grown));
  assert.equal(grown.count, 17);
  for (let i = 0; i < 17; i++) assert.deepEqual(positionOf(grown, i), [i * 2, 0, i]);
  for (const id of [0, 5, 16]) assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(b.matrixOf(id)!).toArray(), [id * 2, 0, id]);

  b.dispose();
});

test('keeps emptied batches for reuse without growing them', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);

  b.set(1, 'wall', at(1, 1));
  const first = meshNamed(root, 'wall#0');
  b.remove(1);

  assert.equal(b.instances, 0); assert.equal(b.drawCalls, 0);
  assert.equal(root.children.length, 2); // both wall parts, kept around for reuse
  for (const name of ['wall#0', 'wall#1']) {
    const mesh = meshNamed(root, name);
    assert.equal(mesh.count, 0); assert.equal(mesh.visible, false);
  }

  b.set(2, 'wall', at(9, 9));
  const reused = meshNamed(root, 'wall#0');
  assert.equal(reused, first);
  assert.equal(reused.count, 1); assert.equal(reused.instanceMatrix.count, 16); // no rebuild
  assert.deepEqual(positionOf(reused, 0), [9, 0, 9]);
  assert.equal(b.drawCalls, 2); // wall#0 + wall#1
  assert.equal(b.instances, 1);

  b.dispose(); assert.equal(root.children.length, 0);
  b.dispose(); assert.equal(root.children.length, 0); // idempotent
});

test('keeps a tint through re-keying and clears it with null', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);

  b.set(1, 'pillar', at(1, 1));
  b.set(2, 'wall', at(2, 2));
  b.tint(2, new THREE.Color(0, 1, 0));

  b.set(2, 'pillar', at(2, 2)); // wall -> pillar, tint travels
  assert.equal(meshNamed(root, 'wall#0').count, 0);
  const pillar = meshNamed(root, 'pillar#0');
  assert.equal(pillar.count, 2);
  const colour = new THREE.Color();
  pillar.getColorAt(liveSlots(pillar).indexOf(2), colour);
  assert.deepEqual(colour.toArray(), [0, 1, 0]);

  b.tint(2, null);
  pillar.getColorAt(liveSlots(pillar).indexOf(2), colour);
  assert.deepEqual(colour.toArray(), [1, 1, 1]);

  // A tint on an unknown id is ignored, and so is clearing one.
  b.tint(77, new THREE.Color(1, 0, 0)); b.tint(77, null);
  assert.equal(b.has(77), false);

  b.dispose();
});

test('recomputes bounds that cover every live instance', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);

  for (let i = 0; i < 40; i++) b.set(i, 'wall', at(i * 3, i * 5));
  for (let i = 0; i < 40; i += 2) b.remove(i);

  const wall = meshNamed(root, 'wall#0');
  assert.equal(wall.boundingSphere, null); // invalidated, three recomputes it on demand
  wall.computeBoundingSphere();
  const bounds = wall.boundingSphere!;
  assert.ok(bounds.radius > 0);

  const geometry = parts.wall![0]!.geometry;
  geometry.computeBoundingSphere();
  const part = geometry.boundingSphere!.radius;
  for (const x of liveSlots(wall)) {
    assert.ok(bounds.distanceToPoint(new THREE.Vector3(x, 0, (x / 3) * 5)) + part <= bounds.radius + 1e-6);
  }

  // An emptied batch has an empty, not stale, bound.
  for (let i = 0; i < 40; i++) b.remove(i);
  assert.equal(wall.boundingSphere, null);
  wall.computeBoundingSphere();
  assert.ok(wall.boundingSphere!.radius < 0);

  b.dispose();
});

test('names, flags and draw call accounting', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);

  assert.deepEqual(root.children.map((c) => c.name), []);
  b.set(1, 'wall', at(0, 0)); b.set(2, 'pillar', at(1, 1));
  assert.deepEqual(root.children.map((c) => c.name).sort(), ['pillar#0', 'wall#0', 'wall#1']);
  const geometryOf: Record<string, THREE.BufferGeometry> = {
    'wall#0': parts.wall![0]!.geometry,
    'wall#1': parts.wall![1]!.geometry,
    'pillar#0': parts.pillar![0]!.geometry,
  };
  const materialOf: Record<string, THREE.Material> = {
    'wall#0': mats[0]!,
    'wall#1': mats[1]!,
    'pillar#0': mats[0]!,
  };
  for (const child of root.children) {
    assert.ok(child instanceof THREE.InstancedMesh, `${child.name} is not instanced`);
    assert.equal(child.matrixAutoUpdate, false);
    assert.equal(child.geometry, geometryOf[child.name]);
    assert.equal(child.material, materialOf[child.name]);
    assert.equal(child.parent, root);
  }
  assert.equal(b.drawCalls, 3); assert.equal(b.instances, 2);

  b.remove(2);
  assert.equal(b.drawCalls, 2); assert.equal(b.instances, 1);

  // Same id twice with the same key is still one instance.
  b.set(1, 'wall', at(5, 5)); b.set(1, 'wall', at(6, 6));
  assert.equal(b.instances, 1); assert.equal(meshNamed(root, 'wall#0').count, 1);
  assert.deepEqual(positionOf(meshNamed(root, 'wall#0'), 0), [6, 0, 6]);

  // Unknown ids are ignored.
  b.remove(4242);
  assert.equal(b.matrixOf(4242), null);
  assert.equal(b.has(4242), false);
  assert.equal(b.instances, 1);

  b.dispose();
});

test('asks for the parts of a key once, even after that key empties', () => {
  const root = new THREE.Group(); let calls = 0;
  const b = new Batcher(root, (k) => { calls++; return parts[k]!; });

  b.set(1, 'wall', at(0, 0)); b.set(2, 'wall', at(1, 1));
  b.remove(1); b.remove(2);
  b.set(3, 'wall', at(2, 2));
  assert.equal(calls, 1);
  b.set(4, 'pillar', at(3, 3));
  assert.equal(calls, 2);

  b.dispose();
});

test('re-keying leaves no holes in either key', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);

  for (let i = 0; i < 6; i++) b.set(i, 'wall', at(i, i));
  b.set(3, 'pillar', at(3, 3)); // the middle wall becomes a pillar

  const wall = meshNamed(root, 'wall#0');
  const pillar = meshNamed(root, 'pillar#0');
  assert.equal(wall.count, 5); assert.equal(pillar.count, 1);
  assert.deepEqual([...liveSlots(wall)].sort((x, y) => x - y), [0, 1, 2, 4, 5]);
  assert.deepEqual(liveSlots(pillar), [3]);
  assert.equal(b.instances, 6); assert.equal(b.drawCalls, 3);
  assert.deepEqual(positionOf(pillar, 0), [3, 0, 3]);

  b.dispose();
});

test('renders nothing for a key with no parts', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => (k === 'ghost' ? [] : parts[k]!));

  b.set(1, 'ghost', at(7, 8));
  assert.equal(b.instances, 1); assert.equal(b.drawCalls, 0);
  assert.equal(root.children.length, 0);
  assert.equal(b.has(1), true);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(b.matrixOf(1)!).toArray(), [7, 0, 8]);

  b.tint(1, new THREE.Color(1, 0, 0)); // must not explode
  b.remove(1);
  assert.equal(b.instances, 0); assert.equal(b.has(1), false);

  b.dispose();
});

test('dispose removes the meshes but leaves the shared parts alone', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);
  for (let i = 0; i < 20; i++) b.set(i, 'wall', at(i, i));
  const wallGeometry = parts.wall![0]!.geometry;
  const vertices = wallGeometry.attributes.position!.count;

  b.dispose();
  assert.equal(root.children.length, 0);
  assert.equal(b.instances, 0); assert.equal(b.drawCalls, 0);
  assert.equal(b.has(0), false); assert.equal(b.matrixOf(0), null);
  assert.equal(wallGeometry.attributes.position!.count, vertices); // not disposed
  assert.equal(wallGeometry, parts.wall![0]!.geometry);
});

test('idAt maps slot of an InstancedMesh back to live instance id', () => {
  const root = new THREE.Group();
  const b = new Batcher(root, (k) => parts[k]!);
  b.set(101, 'wall', at(1, 1));
  b.set(202, 'wall', at(2, 2));
  const wallMesh = root.children.find((c) => c.name === 'wall#0') as THREE.InstancedMesh;
  assert.ok(wallMesh);
  assert.equal(b.idAt(wallMesh, 0), 101);
  assert.equal(b.idAt(wallMesh, 1), 202);
  assert.equal(b.idAt(wallMesh, 2), null);
  b.remove(101);
  assert.equal(b.idAt(wallMesh, 0), 202);
  b.dispose();
});
