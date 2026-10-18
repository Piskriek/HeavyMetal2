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

type RigMaterials = Parameters<typeof buildHardwareFabricatorProp>[0];
type RigBase = Parameters<typeof createRightWallMachineRig>[1];

/** One shared material stands in for every lab material: the rig's geometry does not need the real look to be checked. */
function fakeRigMaterials(): RigMaterials {
  const mat = new THREE.MeshBasicMaterial();
  return { paint: mat, gunmetal: mat, darkSteel: mat, copper: mat, glass: mat, rubber: mat, hazard: mat } as unknown as RigMaterials;
}

test('the station dress faces the room: the fabricator turns with its prop, the rack, bench and combiner turn their dress by PI (POL-103)', () => {
  const m = fakeRigMaterials();
  for (const id of ['preset-rack', 'preset-bench', 'preset-combiner', 'fabricator'] as const) {
    const base = { group: new THREE.Group(), colliders: [], sockets: [], lamps: [] } as unknown as RigBase;
    const rig = createRightWallMachineRig(id, base, m);
    assert.equal(rig.dressGroup.rotation.y, id === 'fabricator' ? 0 : Math.PI, `${id}: dress turn`);
  }

  // the fabricator's plume is one InstancedMesh (T06 draw-call budget), not 14 separate cubes
  const fab = createRightWallMachineRig('fabricator', buildHardwareFabricatorProp(m), m);
  let instanced = 0;
  fab.plumeGroup.traverse((obj) => {
    if ((obj as THREE.InstancedMesh).isInstancedMesh) instanced++;
  });
  assert.equal(instanced, 1, 'the station plume is a single InstancedMesh');
});

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
