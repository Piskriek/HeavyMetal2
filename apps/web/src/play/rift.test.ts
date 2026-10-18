// ============================================================================
// File: apps/web/src/play/rift.test.ts
// Unit tests for createRift and riftSliceOffset (TICKET-07 Item A + POL-100 & POL-98).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRift, riftSliceOffset } from './rift';

test('riftSliceOffset is deterministic and narrows on sealing and collapses on sealed', () => {
  const open1 = riftSliceOffset(42, 3, 'open', 1.25);
  const open2 = riftSliceOffset(42, 3, 'open', 1.25);
  assert.deepEqual(open1, open2);
  assert.ok(open1.widthScale >= 0.85);
  assert.equal(open1.amberMix, 0);

  const sealing = riftSliceOffset(42, 3, 'sealing', 1.25);
  assert.ok(sealing.widthScale < open1.widthScale, 'Sealing narrows the tear width');
  assert.equal(sealing.amberMix, 1);

  const sealed = riftSliceOffset(42, 3, 'sealed', 1.25);
  assert.equal(sealed.widthScale, 0);
});

test('createRift builds a single-draw-call unified mesh that bypasses stage look and transitions across states (POL-98, POL-100)', () => {
  const rift = createRift({ seed: 101, height: 3.4 });
  assert.equal(rift.getState(), 'open');
  assert.equal(rift.group.userData.ignoreStageLook, true);
  assert.equal(rift.mesh.userData.ignoreStageLook, true);

  let meshCount = 0;
  rift.group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshCount++;
  });
  assert.equal(meshCount, 1, 'Entire S-Space rift renders in a single draw call (POL-98)');

  const tear = rift.group.getObjectByName('rift-tear');
  const scar = rift.group.getObjectByName('rift-scar');
  const collar = rift.group.getObjectByName('rift-collar');
  assert.ok(tear && scar && collar);
  assert.equal(tear.visible, true);
  assert.equal(scar.visible, true);

  rift.setState('sealing', 0.8);
  assert.equal(rift.getState(), 'sealing');
  assert.equal(tear.visible, true);

  rift.setState('sealed', 2.0);
  assert.equal(rift.getState(), 'sealed');
  assert.equal(tear.visible, false, 'Vertical tear hides when sealed');
  assert.equal(scar.visible, true, 'Ground scar decal remains when sealed');

  rift.dispose();
});
