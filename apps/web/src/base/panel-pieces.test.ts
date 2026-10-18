// ============================================================================
// File: apps/web/src/base/panel-pieces.test.ts
// Unit tests for gunmetalPanel and slideDoor (TICKET-05 Items B & C).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { gunmetalPanel, slideDoor, slidingDoorCollider } from './panel-pieces';

test('gunmetalPanel builds windowWall, door, halfWall, and gable with dark gunmetal materials and expected colliders', () => {
  const win = gunmetalPanel('windowWall', { w: 4, h: 3, d: 0.28 });
  assert.ok(win.group.children.length >= 10, 'windowWall has frame, infill panels, and glazing');
  assert.equal(win.colliders.length, 5, 'windowWall has 4 frame boxes + 1 window pane collider');
  assert.equal(win.leaf, undefined);
  assert.ok(win.group.getObjectByName('window-pane'), 'windowWall includes dark glazing pane');

  const half = gunmetalPanel('halfWall', { w: 4, h: 1.5, d: 0.28 });
  assert.ok(half.group.children.length >= 6);
  assert.equal(half.colliders.length, 1);
  assert.deepEqual(half.colliders[0], { min: [0, 0, -0.14], max: [4, 1.5, 0.14] });

  const gable = gunmetalPanel('gable', { w: 4, h: 3, d: 0.28 });
  assert.ok(gable.group.children.length >= 4);
  assert.equal(gable.colliders.length, 1);

  const door = gunmetalPanel('door', { w: 4, h: 3, d: 0.28 });
  assert.ok(door.leaf, 'door returns its leaf Object3D separately');
  assert.equal(door.leaf.name, 'door-leaf');
  assert.equal(door.group.getObjectByName('door-leaf'), door.leaf);
  assert.equal(door.colliders.length, 3, 'door frame has left flank, right flank, and lintel colliders');
});

test('slideDoor translates door leaf sideways along X without hinge rotation', () => {
  const door = gunmetalPanel('door', { w: 4, h: 3, d: 0.28 });
  const leaf = door.leaf!;
  leaf.rotation.y = -1.2; // simulate any prior hinge rotation

  slideDoor(leaf, 0, 1.32);
  assert.equal(leaf.position.x, 0);
  assert.equal(leaf.rotation.y, 0);

  slideDoor(leaf, 0.5, 1.32);
  assert.ok(Math.abs(leaf.position.x - 0.66) < 1e-6);
  assert.equal(leaf.rotation.y, 0);

  slideDoor(leaf, 1, 1.32);
  assert.ok(Math.abs(leaf.position.x - 1.32) < 1e-6);
  assert.equal(leaf.rotation.y, 0);

  // Clamp out-of-range values
  slideDoor(leaf, 2.5, 1.32);
  assert.ok(Math.abs(leaf.position.x - 1.32) < 1e-6);
  slideDoor(leaf, -1, 1.32);
  assert.equal(leaf.position.x, 0);

  // Collider follows slide state
  const closedBox = slidingDoorCollider(0, 1.32);
  const halfBox = slidingDoorCollider(0.5, 1.32);
  const openBox = slidingDoorCollider(1.0, 1.32);
  assert.ok(closedBox && halfBox);
  assert.ok(halfBox.min[0] > closedBox.min[0]);
  assert.equal(openBox, null);
});
