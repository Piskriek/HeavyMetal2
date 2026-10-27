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
  // the world camera stays on layer 0, so the world pass never collects the rig's lights
  assert.equal(camera.layers.test(rig.key.layers), false, 'The main camera does not see the rig lights');
  assert.equal(rig.key.layers.mask, 1 << AVATAR_LIGHT_LAYER, 'The rig lights sit on AVATAR_LIGHT_LAYER only');

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

test('every clip Astro plays stands its hips at Astro height in metres (the 100 m bug: the companion and the third-person body)', async () => {
  const { loadScientistAnimations } = await import('./anims-loader');
  const { adaptClipsForAstro, hipsInMetres } = await import('./scientist-model');
  const { ASTRO_HIPS_Y } = await import('../astro/astro-model');
  const set = await loadScientistAnimations();
  // the procedural suit carries no clips of its own, so every one is a fallback from the scientist set
  const root = new THREE.Group();
  root.userData.astroClips = [];
  const fitted = adaptClipsForAstro(root, set);
  assert.equal(fitted.size, set.size);
  for (const [name, clip] of fitted) {
    const hips = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
    if (!hips) continue;
    // metres, within the body's own reach: a crouch to plant drops them to about 0.5 m, a jump lifts them about 0.4 m
    for (let i = 1; i < hips.values.length; i += 3) {
      assert.ok(hips.values[i]! > 0.2 && hips.values[i]! < 2, `${name}: hips at ${hips.values[i]} m`);
    }
  }
  // the shared clip is untouched (the player and the companion both read it), and the copy is made once
  const source = set.get('breathing-idle');
  assert.ok(source);
  const idle = fitted.get('breathing-idle')?.tracks.find((t) => t.name === 'mixamorigHips.position');
  assert.ok(idle && Math.abs(idle.values[1]! - ASTRO_HIPS_Y) < 0.1, `the standing idle's hips at ${idle?.values[1]} m, Astro's at ${ASTRO_HIPS_Y} m`);
  const raw = source.tracks.find((t) => t.name === 'mixamorigHips.position');
  assert.ok(raw && raw.values[1]! > 10, 'the scientist set stays in centimetres');
  assert.equal(hipsInMetres(source), hipsInMetres(source));
  assert.equal(adaptClipsForAstro(root, set).get('breathing-idle'), fitted.get('breathing-idle'));
  // a metre clip is left as it is
  const metres = new THREE.AnimationClip('m', 1, [new THREE.VectorKeyframeTrack('mixamorigHips.position', [0], [0, 0.9, 0])]);
  assert.equal(hipsInMetres(metres), metres);
});
