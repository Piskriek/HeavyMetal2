// Smooth animals against their own claims: each body comes out the size @hm/fauna gives it, and a herd stays near home.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FAUNA } from '@hm/fauna';
import { animalBody, createCreatures, type Animal } from './creatures';

test('each animal body is about as long as its species says', () => {
  for (const id of ['MOON_STRIDER', 'CRYSTAL_TORTOISE', 'SKY_MANTA'] as Animal[]) {
    const g = animalBody(id);
    g.computeBoundingBox();
    // a manta's size is its span (across, z); the walkers' is their length (x)
    const box = g.boundingBox!, length = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    assert.ok(g.index!.count / 3 > 200, `${id} is meshed`);
    assert.ok(length > FAUNA[id].bodyM * 0.8 && length < FAUNA[id].bodyM * 1.6, `${id} is ${length.toFixed(2)} m long, not about ${FAUNA[id].bodyM}`);
  }
});

test('a herd walks, and stays near home', () => {
  const scene = new THREE.Scene();
  const herd = createCreatures(scene, [{ id: 'MOON_STRIDER', x: 100, z: 50, count: 5, roam: 12 }], () => 0, false);
  const body = scene.children.find((c) => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  const at = (k: number) => { const m = new THREE.Matrix4(); body.getMatrixAt(k, m); return new THREE.Vector3().setFromMatrixPosition(m); };
  const start = at(0);
  for (let i = 0; i < 1200; i++) herd.update(i / 30, 1 / 30);
  assert.ok(at(0).distanceTo(start) > 0.5, 'it moved');
  for (let k = 0; k < 5; k++) assert.ok(Math.hypot(at(k).x - 100, at(k).z - 50) < 12 + 30, 'it stayed near home');
  herd.dispose();
  assert.equal(scene.children.length, 0, 'dispose takes the herd out of the scene');
});
