import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatten } from '@hm/kitspec';
import { FABRICATOR_FRAME_KIT } from './kit-fabricator-frame';
import { kitFabricator, setKitFrames, withoutChild } from './plot-kits';

test('taking a child out of an assembly keeps every other part where it was', () => {
  const full = flatten(FABRICATOR_FRAME_KIT, 'fabricator-frame');
  const cut = flatten(withoutChild(FABRICATOR_FRAME_KIT, 'fabricator-frame', 'carriage'), 'fabricator-frame');
  assert.equal(cut.length, full.length - 1);
  assert.ok(!cut.some((p) => p.path === 'carriage'));
  for (const p of cut) {
    const q = full.find((x) => x.path === p.path);
    assert.ok(q, p.path);
    assert.deepEqual(p.matrix, q!.matrix, `${p.path} moved`);
  }
  assert.throws(() => withoutChild(FABRICATOR_FRAME_KIT, 'fabricator-frame', 'gantry'), /carries other parts/);
});

test('the kit fabricator hangs its carriage where the frame puts it, as a head the scene can slide', () => {
  assert.equal(kitFabricator('high', 6, 0.78), null, 'off until the frames are switched on');
  setKitFrames(true);
  try {
    const fab = kitFabricator('high', 6, 0.78)!;
    const rest = flatten(FABRICATOR_FRAME_KIT, 'fabricator-frame').find((p) => p.path === 'carriage')!;
    assert.equal(fab.head.position.x, 0);
    assert.ok(Math.abs(fab.head.position.y - (rest.matrix[13]! + 0.78)) < 1e-9);
    assert.deepEqual(fab.sockets.bed?.at, [0, 0.7 + 0.78, 0]);
    const meshes: THREE.Mesh[] = [];
    fab.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    assert.ok(meshes.length >= 4, `${meshes.length} meshes`);
    // the head carries only the carriage; the frame's own build carries none of it
    const headMeshes: THREE.Mesh[] = [];
    fab.head.traverse((o) => { if ((o as THREE.Mesh).isMesh) headMeshes.push(o as THREE.Mesh); });
    assert.ok(headMeshes.length > 0 && headMeshes.length < meshes.length);
  } finally {
    setKitFrames(false);
  }
});
