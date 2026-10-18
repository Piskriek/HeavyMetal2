// ============================================================================
// File: apps/web/src/play/lab-machines.test.ts
// Unit tests for the 4 right-wall Lab machines and E-interaction helpers (TICKET-06).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  aimLabStation,
  buildHardwareFabricatorProp,
  createRightWallMachineRig,
  LAB_STATIONS,
  nearestLabStation,
  RIGHT_WALL_MACHINES,
  stationById,
} from './lab-machines';

test('RIGHT_WALL_MACHINES defines all 4 distinct East-wall machines with Sheet 07 pixel colours and E actions', () => {
  assert.equal(RIGHT_WALL_MACHINES.length, 4);

  const ids = RIGHT_WALL_MACHINES.map((m) => m.id);
  assert.deepEqual(ids, ['preset-rack', 'preset-bench', 'preset-combiner', 'fabricator']);

  // Distinct actions, prompts, and non-empty functional descriptions
  const actions = new Set(RIGHT_WALL_MACHINES.map((m) => m.action));
  const prompts = new Set(RIGHT_WALL_MACHINES.map((m) => m.prompt));
  assert.equal(actions.size, 4);
  assert.equal(prompts.size, 4);

  for (const m of RIGHT_WALL_MACHINES) {
    assert.ok(m.prompt.startsWith('[E]'), `Prompt starts with [E]: ${m.prompt}`);
    assert.ok(m.summary.length > 25, `Machine ${m.id} explains what it does`);
    assert.equal(m.x, 7.45, `Machine ${m.id} stands grounded along the East wall`);
  }

  // Verify Sheet 07 pixel exhaust colours
  assert.equal(stationById('preset-rack')?.pixelColor, '#b46bff');
  assert.equal(stationById('preset-bench')?.pixelColor, '#ff3d8a');
  assert.equal(stationById('preset-combiner')?.pixelColor, '#b46bff');
  assert.equal(stationById('fabricator')?.pixelColor, '#7cff4d');
  assert.equal(stationById('planet-table')?.pixelColor, '#ffc13d');
});

test('nearestLabStation and aimLabStation resolve each of the 4 right-wall machines accurately', () => {
  for (const m of RIGHT_WALL_MACHINES) {
    // Player standing 1.4 m in front of the machine (x = 6.05, facing +x toward East wall)
    const near = nearestLabStation({ x: 6.45, z: m.z });
    assert.ok(near, `Expected nearestLabStation to find ${m.id}`);
    assert.equal(near.id, m.id);

    const aimed = aimLabStation(
      { x: 5.8, y: 1.2, z: m.z },
      { x: 1, y: -0.05, z: 0 },
      3.0,
    );
    assert.ok(aimed, `Expected aimLabStation to hit ${m.id}`);
    assert.equal(aimed.id, m.id);
  }

  // Out of reach returns null
  assert.equal(nearestLabStation({ x: 0, z: 0 }, 2.0), null);
  assert.equal(aimLabStation({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1, z: 0 }, 2.5), null);
  assert.equal(LAB_STATIONS.length, 6);
});

test('createRightWallMachineRig instances plume into 1 InstancedMesh and gates visibility on operating state (POL-103 / T06)', () => {
  const mat = new THREE.MeshBasicMaterial();
  const fakeMaterials = {
    paint: mat,
    gunmetal: mat,
    darkSteel: mat,
    copper: mat,
    glass: mat,
    rubber: mat,
    hazard: mat,
  } as unknown as Parameters<typeof buildHardwareFabricatorProp>[0];

  const prop = buildHardwareFabricatorProp(fakeMaterials);
  const rig = createRightWallMachineRig('fabricator', prop, fakeMaterials);

  let instancedCount = 0;
  rig.plumeGroup.traverse((obj) => {
    if ((obj as THREE.InstancedMesh).isInstancedMesh) instancedCount++;
  });
  assert.equal(instancedCount, 1, 'Station plume uses a single InstancedMesh');
  assert.equal(rig.plumeGroup.visible, false, 'Plume hidden when idle');

  rig.setPowered(1);
  assert.equal(rig.plumeGroup.visible, false, 'Plume stays hidden when powered but idle');

  rig.setOperating(true);
  assert.equal(rig.isOperating(), true);
  assert.equal(rig.plumeGroup.visible, true, 'Plume shows when powered and operating');

  rig.setOperating(false);
  assert.equal(rig.plumeGroup.visible, false, 'Plume hides immediately when operation stops');
});
