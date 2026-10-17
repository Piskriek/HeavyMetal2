// ============================================================================
// File: apps/web/src/avatar/scientist/scientist-model.test.ts
// Unit tests for scientist default 'high' level and thirdPersonLightRig (TICKET-05 Item D).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  AVATAR_LIGHT_LAYER,
  enableAvatarLightLayer,
  getScientistLevel,
  scientistLevelFor,
  styleScientistGroup,
  thirdPersonLightRig,
} from './scientist-model';

test('avatar defaults to high detail and drops to mid on Low graphics only if fps < 30', () => {
  assert.equal(getScientistLevel(), 'high');
  assert.equal(scientistLevelFor('high', 20), 'high');
  assert.equal(scientistLevelFor('mid', 20), 'high');
  assert.equal(scientistLevelFor('low', 45), 'high');
  assert.equal(scientistLevelFor('low'), 'high');
  assert.equal(scientistLevelFor('low', 24), 'mid');
});

test('thirdPersonLightRig attaches key, rim, and hemisphere fill on AVATAR_LIGHT_LAYER only', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(10, 2, -5);

  const rig = thirdPersonLightRig(camera);
  assert.equal(rig.layer, AVATAR_LIGHT_LAYER);
  assert.ok(camera.layers.test(rig.key.layers), 'Camera sees AVATAR_LIGHT_LAYER');

  // A default world mesh (layer 0 only) must NOT be lit by the avatar rig lights
  const worldMesh = new THREE.Mesh();
  assert.equal(rig.key.layers.test(worldMesh.layers), false);
  assert.equal(rig.rim.layers.test(worldMesh.layers), false);
  assert.equal(rig.fill.layers.test(worldMesh.layers), false);

  // A styled scientist group has AVATAR_LIGHT_LAYER enabled alongside layer 0
  const avatarGroup = new THREE.Group();
  const avatarMesh = new THREE.Mesh();
  avatarGroup.add(avatarMesh);
  styleScientistGroup(avatarGroup);
  assert.equal(rig.key.layers.test(avatarMesh.layers), true);
  assert.equal(rig.rim.layers.test(avatarMesh.layers), true);
  assert.equal(rig.fill.layers.test(avatarMesh.layers), true);

  // enableAvatarLightLayer also works for the held rifle
  const rifleGroup = new THREE.Group();
  const rifleMesh = new THREE.Mesh();
  rifleGroup.add(rifleMesh);
  enableAvatarLightLayer(rifleGroup);
  assert.equal(rig.key.layers.test(rifleMesh.layers), true);

  rig.update();
  rig.dispose();
  assert.equal(rig.group.parent, null);
});
