import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyAssetTweak } from './gen';

function sample(): { group: THREE.Group; mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x808080, metalness: 0.1, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  group.add(mesh);
  return { group, mesh, material };
}

test('an empty or missing tweak changes nothing: the same object comes back', () => {
  const { group } = sample();
  assert.equal(applyAssetTweak(group, undefined), group);
  assert.equal(applyAssetTweak(group, {}), group);
  assert.equal(group.children.length, 1);
  assert.deepEqual(group.position.toArray(), [0, 0, 0]);
});

test('transform tweaks go on a wrapper group, not the mesh', () => {
  const { group, mesh } = sample();
  const out = applyAssetTweak(group, { offset: [0.25, 0, -1], scale: 2, yaw: 90 });
  assert.notEqual(out, group);
  assert.equal(out.children[0], group, 'the model is inside the wrapper');
  assert.deepEqual(out.position.toArray(), [0.25, 0, -1]);
  assert.deepEqual(out.scale.toArray(), [2, 2, 2]);
  assert.ok(Math.abs(out.rotation.y - Math.PI / 2) < 1e-9);
  assert.deepEqual(mesh.position.toArray(), [0, 0, 0], 'the mesh itself is untouched');
});

test('a per-axis scale is applied axis by axis', () => {
  const { group } = sample();
  const out = applyAssetTweak(group, { scale: [1, 2, 3] });
  assert.deepEqual(out.scale.toArray(), [1, 2, 3]);
});

test('material tweaks clone each material, so the shared material is never changed', () => {
  const { group, mesh, material } = sample();
  // the callers (getGenSync, loadGen) always pass their own clone, so the shared original is never handed in
  const out = applyAssetTweak(group.clone(true), { tint: '#ff0000', metalness: 0.8, roughness: 0.2, emissive: '#00ff00', emissiveIntensity: 1.5 });
  const tuned = (out.children[0] as THREE.Group).children[0] as THREE.Mesh;
  const m = tuned.material as THREE.MeshStandardMaterial;
  assert.notEqual(m, material, 'a clone, not the shared material');
  assert.equal(m.color.getHexString(), 'ff0000');
  assert.equal(m.metalness, 0.8);
  assert.equal(m.roughness, 0.2);
  assert.equal(m.emissive.getHexString(), '00ff00');
  assert.equal(m.emissiveIntensity, 1.5);
  assert.equal(material.metalness, 0.1, 'the shared material keeps its own values');
  assert.equal(mesh.material, material);
});

test('a metal or roughness of -1 means the model keeps its own value', () => {
  const { group, material } = sample();
  const out = applyAssetTweak(group, { metalness: -1, roughness: -1 });
  const m = ((out.children[0] as THREE.Group).children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(m.metalness, material.metalness);
  assert.equal(m.roughness, material.roughness);
});
