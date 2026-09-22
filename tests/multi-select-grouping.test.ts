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

    // After 90 deg rotation around +Y by standard right-hand rule, (100, 0, 0) rotates to (0, 0, -100), (-100, 0, 0) to (0, 0, 100)
    assert.ok(Math.abs(r1.x) < 2);
    assert.ok(Math.abs(r1.z - (-100)) < 2);
    assert.ok(Math.abs(r2.x) < 2);
    assert.ok(Math.abs(r2.z - 100) < 2);
    assert.ok(Math.abs(r1.rotY - Math.PI / 2) < 1e-4);
  });

  await t.test('Rotating group of 3D ramp and decal rotates both in the EXACT SAME direction and preserves relative orientation', () => {
    const builder = createTestBuilder();
    const ramp: PlacedProp = {
      id: 'sync_ramp',
      type: 'timber_ramp',
      name: 'Timber Stunt Ramp',
      x: 100,
      y: 0,
      z: 0,
      scale: 1,
      rotY: 0,
      isDecal: false,
    };
    const decal: PlacedProp = {
      id: 'sync_decal',
      type: 'decal_panel_reinforced_wood',
      name: 'Reinforced Wood Decal',
      x: -100,
      y: 0,
      z: 0,
      scale: 1,
      rotY: 0,
      isDecal: true,
    };

    builder.importJson(JSON.stringify([ramp, decal]));
    builder.selectProp('sync_ramp', false);
    builder.selectProp('sync_decal', true);
    builder.groupSelected();

    const centroidBefore = builder.getGroupCentroid();
    assert.equal(centroidBefore.x, 0);
    assert.equal(centroidBefore.z, 0);

    // Initial distance between ramp and decal is 200 units along X
    const distBefore = Math.hypot(ramp.x - decal.x, ramp.z - decal.z);
    assert.equal(distBefore, 200);

    // Rotate group by +90 degrees (Math.PI / 2)
    builder.rotateSelectedProps(Math.PI / 2);

    const updatedRamp = builder.getProps().find((p) => p.id === 'sync_ramp')!;
    const updatedDecal = builder.getProps().find((p) => p.id === 'sync_decal')!;

    // Distance must still be precisely 200 units (rigid-body distance preserved)
    const distAfter = Math.hypot(updatedRamp.x - updatedDecal.x, updatedRamp.z - updatedDecal.z);
    assert.ok(Math.abs(distAfter - 200) < 1e-3, `Distance must be preserved, got ${distAfter}`);

    // Centroid must remain at (0, 0, 0)
    const centroidAfter = builder.getGroupCentroid();
    assert.equal(centroidAfter.x, 0);
    assert.equal(centroidAfter.z, 0);

    // Orbit: (100, 0, 0) orbits to (0, 0, -100); (-100, 0, 0) orbits to (0, 0, 100)
    assert.ok(Math.abs(updatedRamp.x) < 2);
    assert.ok(Math.abs(updatedRamp.z - (-100)) < 2);
    assert.ok(Math.abs(updatedDecal.x) < 2);
    assert.ok(Math.abs(updatedDecal.z - 100) < 2);

    // Orientation: Both ramp and decal rotY must have incremented by +Math.PI / 2 in unison
    assert.ok(Math.abs(updatedRamp.rotY - Math.PI / 2) < 1e-4, 'Ramp rotY rotated by +PI/2');
    assert.ok(Math.abs(updatedDecal.rotY - Math.PI / 2) < 1e-4, 'Decal rotY rotated by +PI/2');

    // Decal quaternion must also reflect rotation in the exact same direction around world Y
    assert.ok(updatedDecal.quaternion, 'Decal must have quaternion');
    const qDecal = new THREE.Quaternion(...updatedDecal.quaternion!);
    const decalFwd = new THREE.Vector3(0, 1, 0).applyQuaternion(qDecal);
    // Initially decal flat forward was (0, 0, -1). Rotated +90 deg around +Y gives (-1, 0, 0)
    assert.ok(Math.abs(decalFwd.x - (-1)) < 1e-3, `Decal forward x should be -1, got ${decalFwd.x}`);
    assert.ok(Math.abs(decalFwd.z) < 1e-3, `Decal forward z should be ~0, got ${decalFwd.z}`);
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

  await t.test('Decal edge manipulation (nudgeDecalSide) and resetDecalFlat', () => {
    const builder = createTestBuilder();
    const decalProp: PlacedProp = {
      id: 'decal_1',
      type: 'decal_road_tire_burn_patch',
      name: 'Tire Burn Decal',
      x: 500,
      y: 10,
      z: 500,
      scale: 1,
      rotY: 0,
      isDecal: true,
    };
    builder.importJson(JSON.stringify([decalProp]));
    assert.ok(builder.isPropDecal(decalProp), 'Prop identified as decal');

    // Nudge front edge up by 30 units
    builder.nudgeDecalSide('decal_1', 'front', 30);
    let prop = builder.getProps().find((p) => p.id === 'decal_1')!;
    let angles = builder.getDecalAngles(prop);
    assert.ok(angles.pitchDeg > 0, `Front edge raised should give positive pitch, got ${angles.pitchDeg}`);

    // Nudge back edge up by 30 units
    builder.nudgeDecalSide('decal_1', 'back', 30);
    prop = builder.getProps().find((p) => p.id === 'decal_1')!;
    angles = builder.getDecalAngles(prop);
    // After raising back edge equally, pitch returns towards 0
    assert.ok(Math.abs(angles.pitchDeg) <= 1, `Pitch should balance out, got ${angles.pitchDeg}`);

    // Nudge left edge up
    builder.nudgeDecalSide('decal_1', 'left', 20);
    prop = builder.getProps().find((p) => p.id === 'decal_1')!;
    angles = builder.getDecalAngles(prop);
    assert.ok(angles.rollDeg < 0, `Left edge raised should tilt towards right (negative roll), got ${angles.rollDeg}`);

    // Nudge right edge up
    builder.nudgeDecalSide('decal_1', 'right', 20);
    prop = builder.getProps().find((p) => p.id === 'decal_1')!;
    angles = builder.getDecalAngles(prop);
    assert.ok(Math.abs(angles.rollDeg) <= 1, `Roll should balance out after right edge raised equally, got ${angles.rollDeg}`);

    // Reset flat
    builder.resetDecalFlat('decal_1');
    prop = builder.getProps().find((p) => p.id === 'decal_1')!;
    angles = builder.getDecalAngles(prop);
    assert.equal(angles.pitchDeg, 0, 'Pitch is 0 after reset flat');
    assert.equal(angles.rollDeg, 0, 'Roll is 0 after reset flat');
    assert.equal(prop.rotX, 0);
    assert.equal(prop.rotZ, 0);
    assert.equal(prop.quaternion, undefined);
  });

  await t.test('Rotating group containing 3D ramp and decal preserves ramp scale and does not shrink', () => {
    const builder = createTestBuilder();
    const ramp: PlacedProp = {
      id: 'test_ramp',
      type: 'timber_ramp',
      name: 'Timber Stunt Ramp',
      x: 200,
      y: 100,
      z: 200,
      scale: 0.85,
      rotY: 0.2,
      isDecal: false,
    };
    const decal: PlacedProp = {
      id: 'test_decal',
      type: 'decal_panel_reinforced_wood',
      name: 'Reinforced Iron-Wood Panel',
      x: 300,
      y: 100,
      z: 300,
      scale: 0.5,
      rotY: 0,
      isDecal: true,
    };

    builder.importJson(JSON.stringify([ramp, decal]));
    builder.selectProp('test_ramp', false);
    builder.selectProp('test_decal', true);

    const groupId = builder.groupSelected();
    assert.ok(groupId);
    assert.equal(builder.isSelectionGrouped(), true);

    const rampMeshBefore = (builder as any).propObjects.get('test_ramp');
    assert.ok(rampMeshBefore, 'Ramp 3D mesh should exist in scene');
    assert.equal(rampMeshBefore.userData.isRamp, true);
    assert.equal(rampMeshBefore.userData.isDecal, undefined);
    assert.equal(rampMeshBefore.scale.y, 0.85, 'Initial ramp scale on Y should be 0.85');

    // Rotate group by +45 degrees (Math.PI / 4)
    builder.rotateSelectedProps(Math.PI / 4);

    const updatedRamp = builder.getProps().find((p) => p.id === 'test_ramp')!;
    const updatedDecal = builder.getProps().find((p) => p.id === 'test_decal')!;

    // Assert data model scale is preserved
    assert.equal(updatedRamp.scale, 0.85, 'Ramp data model scale must remain 0.85');
    assert.equal(updatedRamp.isDecal, false, 'Ramp must never be flagged as decal');
    assert.equal(updatedDecal.scale, 0.5, 'Decal data model scale must remain 0.5');

    // Assert 3D scene mesh scale is NOT double-scaled or shrunk
    const rampMeshAfter = (builder as any).propObjects.get('test_ramp');
    assert.equal(rampMeshAfter.scale.y, 0.85, 'Ramp 3D mesh scale.y must stay 0.85 (not 0.85^2 = 0.72)');
    assert.equal(rampMeshAfter.scale.z, 0.85, 'Ramp 3D mesh scale.z must stay 0.85');
    assert.ok(Math.abs(Math.abs(rampMeshAfter.scale.x) - 0.85) < 1e-4, 'Ramp 3D mesh scale.x magnitude must stay 0.85');

    // Rotate group multiple times
    for (let i = 0; i < 4; i++) {
      builder.rotateSelectedProps(Math.PI / 4);
    }
    const finalRamp = builder.getProps().find((p) => p.id === 'test_ramp')!;
    const finalMesh = (builder as any).propObjects.get('test_ramp');
    assert.equal(finalRamp.scale, 0.85, 'Ramp scale must remain 0.85 after multiple group rotations');
    assert.equal(finalMesh.scale.y, 0.85, 'Ramp mesh scale must remain 0.85 after multiple group rotations');
  });

  await t.test('Decal atmosphere lighting uses MeshStandardMaterial by default and switches to MeshBasicMaterial when unlit', () => {
    const builder = createTestBuilder();
    const decal: PlacedProp = {
      id: 'decal_lighting_test',
      type: 'decal_panel_reinforced_wood',
      name: 'Reinforced Wood Decal',
      x: 100,
      y: 10,
      z: 100,
      scale: 1,
      rotY: 0,
      isDecal: true,
    };

    builder.importJson(JSON.stringify([decal]));

    // By default, decals receive lighting (prop.lit !== false)
    const meshInitial = (builder as any).propObjects.get('decal_lighting_test') as THREE.Mesh;
    assert.ok(meshInitial, 'Decal mesh exists in scene');
    assert.ok(meshInitial.material instanceof THREE.MeshStandardMaterial, 'Default decal material must be MeshStandardMaterial');
    assert.equal((meshInitial.material as THREE.MeshStandardMaterial).roughness, 0.95, 'Roughness must match track surface (0.95)');
    assert.equal((meshInitial.material as THREE.MeshStandardMaterial).metalness, 0, 'Metalness must be 0');

    // Turn lighting OFF (lit: false)
    builder.updatePropTransform('decal_lighting_test', { lit: false });
    const propUnlit = builder.getProps().find((p) => p.id === 'decal_lighting_test')!;
    assert.equal(propUnlit.lit, false);

    const meshUnlit = (builder as any).propObjects.get('decal_lighting_test') as THREE.Mesh;
    assert.ok(meshUnlit.material instanceof THREE.MeshBasicMaterial, 'Unlit decal must use MeshBasicMaterial');

    // Turn lighting back ON (lit: true)
    builder.updatePropTransform('decal_lighting_test', { lit: true });
    const propLitAgain = builder.getProps().find((p) => p.id === 'decal_lighting_test')!;
    assert.equal(propLitAgain.lit, true);

    const meshLitAgain = (builder as any).propObjects.get('decal_lighting_test') as THREE.Mesh;
    assert.ok(meshLitAgain.material instanceof THREE.MeshStandardMaterial, 'Re-enabled decal must use MeshStandardMaterial');
  });

  await t.test('Batch atmosphere lighting controls update selection and sections correctly', () => {
    const builder = createTestBuilder();
    const d1: PlacedProp = { id: 'd1', type: 'decal_panel_scrap_steel', name: 'Decal 1', x: 5000, y: 0, z: 0, scale: 1, rotY: 0, isDecal: true, lit: true };
    const d2: PlacedProp = { id: 'd2', type: 'decal_panel_scrap_steel', name: 'Decal 2', x: 30000, y: 0, z: 0, scale: 1, rotY: 0, isDecal: true, lit: true };
    const d3: PlacedProp = { id: 'd3', type: 'decal_panel_scrap_steel', name: 'Decal 3', x: 55000, y: 0, z: 0, scale: 1, rotY: 0, isDecal: true, lit: true };

    builder.importJson(JSON.stringify([d1, d2, d3]));

    // Multi-selection batch: select d1 and d2, set lighting to false
    builder.selectProp('d1', false);
    builder.selectProp('d2', true);
    builder.setSelectedPropsLighting(false);

    let props = builder.getProps();
    assert.equal(props.find((p) => p.id === 'd1')!.lit, false);
    assert.equal(props.find((p) => p.id === 'd2')!.lit, false);
    assert.equal(props.find((p) => p.id === 'd3')!.lit, true);

    // Multi-selection batch: set lighting to true
    builder.setSelectedPropsLighting(true);
    props = builder.getProps();
    assert.equal(props.find((p) => p.id === 'd1')!.lit, true);
    assert.equal(props.find((p) => p.id === 'd2')!.lit, true);

    // Section batch: set ALL decals to OFF
    const countOff = builder.setAllDecalsLighting(false, 'all');
    assert.equal(countOff, 3);
    props = builder.getProps();
    assert.ok(props.every((p) => p.lit === false));

    // Section batch: turn ON only Alpine section (x < 25600)
    const countAlpine = builder.setAllDecalsLighting(true, 'alpine');
    assert.equal(countAlpine, 1);
    props = builder.getProps();
    assert.equal(props.find((p) => p.id === 'd1')!.lit, true, 'd1 in Alpine is ON');
    assert.equal(props.find((p) => p.id === 'd2')!.lit, false, 'd2 outside Alpine stays OFF');
    assert.equal(props.find((p) => p.id === 'd3')!.lit, false, 'd3 outside Alpine stays OFF');

    // Section batch: turn ON all decals across entire track
    const countAllOn = builder.setAllDecalsLighting(true, 'all');
    assert.equal(countAllOn, 3);
    props = builder.getProps();
    assert.ok(props.every((p) => p.lit === true));
  });
});
