// ============================================================================
// File: apps/web/src/studio/socket-plume-gizmo.test.ts
// Unit tests for socketPlumeGizmo, normalizeSockets, and PLUME_COLOURS (TICKET-08b Item C).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  normalizeSockets,
  PLUME_COLOURS,
  plumeColourFor,
  socketPlumeGizmo,
} from './socket-plume-gizmo';

test('socketPlumeGizmo places square socket markers without 3D text labels and adds vertical ARGO_NOTE_08 plume arrow', () => {
  const machineMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3.2, 2),
    new THREE.MeshStandardMaterial({ color: 0x8899aa }),
  );
  machineMesh.geometry.translate(0, 1.6, 0);
  const root = new THREE.Group();
  root.name = 'press-frame';
  root.add(machineMesh);

  const gizmo = socketPlumeGizmo(root, {
    id: 'press-frame',
    class: 'machine',
    size: [4, 4, 3.8],
    sockets: [
      { name: 'power', at: [0, 0.2, -1.8] },
      { name: 'vent', at: [0.4, 3.2, -0.2] },
    ],
  });

  assert.equal(gizmo.sockets.length, 2);
  assert.equal(gizmo.machineKind, 'press');
  assert.equal(gizmo.plumeColour, '#7cff4d');
  assert.ok(gizmo.vent, 'Expected non-null vent vector on machine');
  assert.ok(gizmo.vent.y >= 3.2, `Expected vent at top of machine (>= 3.2), got ${gizmo.vent.y}`);

  const pwrMarker = gizmo.group.getObjectByName('socket-marker:power');
  const ventMarker = gizmo.group.getObjectByName('socket-marker:vent');
  assert.ok(pwrMarker, 'Power socket square marker exists');
  assert.ok(ventMarker, 'Vent socket square marker exists');
  assert.equal(pwrMarker.position.z, -1.8);
  assert.equal(pwrMarker.userData.shape, 'square');

  const arrow = gizmo.group.getObjectByName('plume-vent-arrow');
  assert.ok(arrow, 'Vertical plume arrow exists');
  assert.equal(arrow.userData.colour, '#7cff4d');
  assert.deepEqual(arrow.userData.direction, [0, 1, 0]);

  gizmo.dispose();
});

test('PLUME_COLOURS matches all 11 MachineKinds from ARGO_NOTE_08 and normalizeSockets accepts record or array', () => {
  assert.equal(PLUME_COLOURS.mill, '#ff3d8a');
  assert.equal(PLUME_COLOURS['heavy-mill'], '#ff3d8a');
  assert.equal(PLUME_COLOURS.press, '#7cff4d');
  assert.equal(PLUME_COLOURS['heavy-press'], '#7cff4d');
  assert.equal(PLUME_COLOURS.projector, '#ffc13d');
  assert.equal(PLUME_COLOURS['heavy-projector'], '#ffc13d');
  assert.equal(PLUME_COLOURS.water, '#3dc8ff');
  assert.equal(PLUME_COLOURS['heavy-water'], '#3dc8ff');
  assert.equal(PLUME_COLOURS.drill, '#ff7b3d');
  assert.equal(PLUME_COLOURS.power, '#b46bff');
  assert.equal(PLUME_COLOURS.pylon, '#5ce1e6');

  assert.equal(plumeColourFor('watermaker'), '#3dc8ff');
  assert.equal(plumeColourFor('pylon-tower'), '#5ce1e6');
  assert.equal(plumeColourFor({ class: 'rover-body' }), null);

  const fromRecord = normalizeSockets({
    sockets: {
      muzzle: [0, 0.12, 0.45],
      grip: { at: [0, -0.08, -0.1] },
    },
  });
  assert.equal(fromRecord.length, 2);
  assert.deepEqual(fromRecord[0], { name: 'muzzle', at: [0, 0.12, 0.45] });
  assert.deepEqual(fromRecord[1], { name: 'grip', at: [0, -0.08, -0.1] });
});
