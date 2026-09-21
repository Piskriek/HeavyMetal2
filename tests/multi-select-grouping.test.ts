import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrackBuilder3D, type PlacedProp } from '../src/game/track-builder-3d';
import type { TrackData } from '../src/game/types';

// Mock minimal TrackData
const mockTrack: TrackData = {
  id: 'test_track',
  name: 'Test Track',
  theme: 'ridge',
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1000, y: 0, z: 0 },
    { x: 2000, y: 0, z: 0 },
  ],
  segments: [],
  spline: null as any,
  curve: null as any,
  loopings: [],
  ramps: [],
  boostPads: [],
  obstacles: [],
  skybox: 'ridge',
} as unknown as TrackData;

function createTestBuilder(): TrackBuilder3D {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const builder = new TrackBuilder3D(scene, camera, mockTrack);
  builder.clearAll();
  return builder;
}

test('Multi-select and Grouping Core Functionality', async (t) => {
  await t.test('Multi-selection toggles items in and out of selection', () => {
    const builder = createTestBuilder();
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 0, z: 100, scale: 1, rotY: 0 };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: 200, y: 0, z: 200, scale: 1, rotY: 0 };
    const p3: PlacedProp = { id: 'p3', type: 'pine_cluster', name: 'Pine 3', x: 300, y: 0, z: 300, scale: 1, rotY: 0 };

    builder.importJson(JSON.stringify([p1, p2, p3]));

    // Single select p1
    builder.selectProp('p1', false);
    assert.equal(builder.getSelectedProps().length, 1);
    assert.equal(builder.getSelectedProp()?.id, 'p1');

    // Multi-select add p2
    builder.selectProp('p2', true);
    assert.equal(builder.getSelectedProps().length, 2);
    assert.ok(builder.isPropSelected('p1'));
    assert.ok(builder.isPropSelected('p2'));
    assert.ok(!builder.isPropSelected('p3'));

    // Multi-select toggle p1 (removes p1)
    builder.selectProp('p1', true);
    assert.equal(builder.getSelectedProps().length, 1);
    assert.ok(!builder.isPropSelected('p1'));
    assert.ok(builder.isPropSelected('p2'));

    // Clear selection
    builder.selectProp(null);
    assert.equal(builder.getSelectedProps().length, 0);
  });

  await t.test('Grouping multiple props assigns shared groupId and group auto-selects', () => {
    const builder = createTestBuilder();
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 0, z: 100, scale: 1, rotY: 0 };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: 200, y: 0, z: 200, scale: 1, rotY: 0 };

    builder.importJson(JSON.stringify([p1, p2]));
    builder.selectProp('p1', false);
    builder.selectProp('p2', true);

    assert.equal(builder.isSelectionGrouped(), false);
    const groupId = builder.groupSelected();
    assert.ok(groupId, 'groupSelected should return a valid groupId string');
    assert.equal(builder.isSelectionGrouped(), true);

    // Deselect all
    builder.selectProp(null);
    assert.equal(builder.getSelectedProps().length, 0);

    // Single clicking p1 should automatically select p2 as well because they are grouped
    builder.selectProp('p1', false);
    assert.equal(builder.getSelectedProps().length, 2);
    assert.ok(builder.isPropSelected('p1'));
    assert.ok(builder.isPropSelected('p2'));

    // Ungrouping
    const ungruped = builder.ungroupSelected();
    assert.ok(ungruped);
    assert.equal(builder.isSelectionGrouped(), false);

    // Now single clicking p1 should only select p1
    builder.selectProp(null);
    builder.selectProp('p1', false);
    assert.equal(builder.getSelectedProps().length, 1);
    assert.ok(builder.isPropSelected('p1'));
    assert.ok(!builder.isPropSelected('p2'));
  });

  await t.test('Centroid and group translation preserves relative positions', () => {
    const builder = createTestBuilder();
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 50, z: 100, scale: 1, rotY: 0 };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: 300, y: 150, z: 300, scale: 1, rotY: 0 };

    builder.importJson(JSON.stringify([p1, p2]));
    builder.selectProp('p1', false);
    builder.selectProp('p2', true);

    const centroid = builder.getGroupCentroid();
    assert.equal(centroid.x, 200);
    assert.equal(centroid.y, 100);
    assert.equal(centroid.z, 200);

    // Move group by (+50, -25, +100)
    builder.moveSelectedProps(50, -25, 100);

    const props = builder.getProps();
    const updated1 = props.find((p) => p.id === 'p1')!;
    const updated2 = props.find((p) => p.id === 'p2')!;

    assert.equal(updated1.x, 150);
    assert.equal(updated1.y, 25);
    assert.equal(updated1.z, 200);

    assert.equal(updated2.x, 350);
    assert.equal(updated2.y, 125);
    assert.equal(updated2.z, 400);

    // Relative distance remains identical
    assert.equal(updated2.x - updated1.x, 200);
    assert.equal(updated2.y - updated1.y, 100);
    assert.equal(updated2.z - updated1.z, 200);
  });

  await t.test('Orbit rotation rotates items around group centroid', () => {
    const builder = createTestBuilder();
    // Two items aligned along X axis: (100, 0, 0) and (-100, 0, 0) -> centroid (0, 0, 0)
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 0, z: 0, scale: 1, rotY: 0 };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: -100, y: 0, z: 0, scale: 1, rotY: 0 };

    builder.importJson(JSON.stringify([p1, p2]));
    builder.selectProp('p1', false);
    builder.selectProp('p2', true);

    // Rotate 90 degrees (Math.PI / 2)
    builder.rotateSelectedProps(Math.PI / 2);

    const props = builder.getProps();
    const r1 = props.find((p) => p.id === 'p1')!;
    const r2 = props.find((p) => p.id === 'p2')!;

    // After 90 deg rotation, (100, 0) should be at (0, 100), (-100, 0) at (0, -100)
    assert.ok(Math.abs(r1.x) < 2);
    assert.ok(Math.abs(r1.z - 100) < 2);
    assert.ok(Math.abs(r2.x) < 2);
    assert.ok(Math.abs(r2.z - (-100)) < 2);
    assert.ok(Math.abs(r1.rotY - Math.PI / 2) < 1e-4);
  });

  await t.test('Duplicate group duplicates all members and groups duplicates together', () => {
    const builder = createTestBuilder();
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 0, z: 100, scale: 1, rotY: 0 };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: 200, y: 0, z: 200, scale: 1, rotY: 0 };

    builder.importJson(JSON.stringify([p1, p2]));
    builder.selectProp('p1', false);
    builder.selectProp('p2', true);
    builder.groupSelected();

    const duplicates = builder.duplicateSelected();
    assert.equal(duplicates.length, 2);
    assert.equal(builder.getProps().length, 4);

    // Duplicates should have a new shared groupId
    assert.ok(duplicates[0].groupId);
    assert.equal(duplicates[0].groupId, duplicates[1].groupId);
    assert.notEqual(duplicates[0].groupId, p1.groupId);

    // Duplicates should be currently selected
    assert.equal(builder.getSelectedProps().length, 2);
    assert.ok(builder.isPropSelected(duplicates[0].id));
    assert.ok(builder.isPropSelected(duplicates[1].id));
  });

  await t.test('Delete group batch removes all selected items', () => {
    const builder = createTestBuilder();
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 0, z: 100, scale: 1, rotY: 0 };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: 200, y: 0, z: 200, scale: 1, rotY: 0 };
    const p3: PlacedProp = { id: 'p3', type: 'pine_cluster', name: 'Pine 3', x: 300, y: 0, z: 300, scale: 1, rotY: 0 };

    builder.importJson(JSON.stringify([p1, p2, p3]));
    builder.selectProp('p1', false);
    builder.selectProp('p2', true);

    builder.deleteSelected();

    assert.equal(builder.getProps().length, 1);
    assert.equal(builder.getProps()[0].id, 'p3');
    assert.equal(builder.getSelectedProps().length, 0);
  });

  await t.test('Group tilt and flip updates all selected members', () => {
    const builder = createTestBuilder();
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 0, z: 100, scale: 1, rotY: 0, rotZ: 0, flipX: false };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: 200, y: 0, z: 200, scale: 1, rotY: 0, rotZ: 0.1, flipX: false };

    builder.importJson(JSON.stringify([p1, p2]));
    builder.selectProp('p1', false);
    builder.selectProp('p2', true);

    builder.tiltSelectedProps(0.2);
    const afterTilt = builder.getSelectedProps();
    assert.ok(Math.abs((afterTilt[0].rotZ ?? 0) - 0.2) < 1e-4);
    assert.ok(Math.abs((afterTilt[1].rotZ ?? 0) - 0.3) < 1e-4);

    builder.flipSelectedProps();
    const afterFlip = builder.getSelectedProps();
    assert.equal(afterFlip[0].flipX, true);
    assert.equal(afterFlip[1].flipX, true);
  });

  await t.test('Group scale expands/contracts from group centroid', () => {
    const builder = createTestBuilder();
    // Centroid at (200, 0, 200)
    const p1: PlacedProp = { id: 'p1', type: 'pine_cluster', name: 'Pine 1', x: 100, y: 0, z: 200, scale: 1, rotY: 0 };
    const p2: PlacedProp = { id: 'p2', type: 'pine_cluster', name: 'Pine 2', x: 300, y: 0, z: 200, scale: 1, rotY: 0 };

    builder.importJson(JSON.stringify([p1, p2]));
    builder.selectProp('p1', false);
    builder.selectProp('p2', true);

    // Scale by 2x from centroid
    builder.scaleSelectedProps(2);

    const s1 = builder.getSelectedProps().find((p) => p.id === 'p1')!;
    const s2 = builder.getSelectedProps().find((p) => p.id === 'p2')!;

    // Distances from centroid (200) doubled: -100 -> -200 (x=0), +100 -> +200 (x=400)
    assert.equal(s1.x, 0);
    assert.equal(s2.x, 400);
    assert.equal(s1.scale, 2);
    assert.equal(s2.scale, 2);
  });

  await t.test('Axis cycling logic transitions Y -> X -> Z -> Y', () => {
    const cycle = (current: 'y' | 'x' | 'z'): 'y' | 'x' | 'z' => {
      return current === 'y' ? 'x' : current === 'x' ? 'z' : 'y';
    };

    assert.equal(cycle('y'), 'x');
    assert.equal(cycle('x'), 'z');
    assert.equal(cycle('z'), 'y');
  });

  await t.test('Fly camera uses Z (and Q) for downward movement and ignores Ctrl', () => {
    const builder = createTestBuilder();
    builder.freeFly.active = true;
    builder.freeFly.y = 1000;

    // Pressing ControlLeft should NOT move camera downward
    builder.updateFlyCamera(0.1, new Set(['ControlLeft']));
    assert.equal(builder.freeFly.y, 1000, 'ControlLeft should not move camera downward');

    // Pressing Ctrl+Z (Undo) should NOT move camera downward
    builder.updateFlyCamera(0.1, new Set(['ControlLeft', 'KeyZ']));
    assert.equal(builder.freeFly.y, 1000, 'Ctrl+Z should not move camera downward');

    // Pressing KeyZ alone SHOULD move camera downward
    builder.updateFlyCamera(0.1, new Set(['KeyZ']));
    assert.ok(builder.freeFly.y < 1000, 'KeyZ should move camera downward');

    // Pressing Space SHOULD move camera upward
    const prevY = builder.freeFly.y;
    builder.updateFlyCamera(0.1, new Set(['Space']));
    assert.ok(builder.freeFly.y > prevY, 'Space should move camera upward');
  });
});
