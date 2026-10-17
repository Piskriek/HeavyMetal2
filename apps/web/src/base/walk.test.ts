import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { WalkWorld, type PlacedPiece } from './walk';
import { KitPieceCache } from './kit-pieces';

test('walk: stand on foundation, wall yaw collision, ramp climbing, airlock doorway', () => {
  const cache = new KitPieceCache();
  const walk = new WalkWorld();

  const foundationTmpl = cache.getTemplate('foundation', 1, 1);
  const wallTmpl = cache.getTemplate('wall', 1, 0);
  const rampTmpl = cache.getTemplate('ramp', 1, 0);
  const airlockTmpl = cache.getTemplate('airlock', 1, 0);

  // 1. You stand on a foundation top, not on the terrain under it
  const pieces: PlacedPiece[] = [
    {
      id: 1,
      kind: 'foundation',
      pos: { x: 0, y: 5.0, z: 0 },
      yaw: 0,
      colliders: foundationTmpl.colliders,
    },
  ];
  walk.setPieces(pieces);

  const groundUnder = 2.0;
  const feetY = 5.0;
  const stoodY = walk.standAt(0, 0, feetY, groundUnder);
  assert.equal(stoodY, 5.0, 'Must stand on foundation top (5.0), not ground under it (2.0)');

  // 2. A wall at yaw 0.7 rad stops you at the radius
  const wallYaw = 0.7;
  const wallPos = { x: 10, y: 0, z: 10 };
  walk.setPieces([
    {
      id: 2,
      kind: 'wall',
      pos: wallPos,
      yaw: wallYaw,
      colliders: wallTmpl.colliders,
    },
  ]);

  // Try to stand exactly inside the wall center
  const radius = 0.35;
  const pushed = walk.push(wallPos.x, wallPos.z, 0, radius);
  const dist = Math.hypot(pushed.x - wallPos.x, pushed.z - wallPos.z);
  // Distance from wall center along normal should be at least wall half-thickness (0.125) + radius (0.35) = 0.475
  assert.ok(dist >= 0.45, `Wall at yaw 0.7 rad must stop player at distance >= 0.45, got ${dist}`);

  // 3. Walking up a ramp raises you smoothly to 3 m
  walk.setPieces([
    {
      id: 3,
      kind: 'ramp',
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      colliders: rampTmpl.colliders,
    },
  ]);

  let lastY = 0;
  for (let z = -2.0; z <= 2.0; z += 0.25) {
    const y = walk.standAt(0, z, lastY, 0);
    assert.ok(y >= lastY - 0.001, `Height should monotonically increase: ${y} >= ${lastY}`);
    lastY = y;
  }
  assert.ok(Math.abs(lastY - 3.0) < 0.01, `Ramp top must reach 3.0 m, got ${lastY}`);

  // 4. An airlock's doorway lets you through
  walk.setPieces([
    {
      id: 4,
      kind: 'airlock',
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      colliders: airlockTmpl.colliders,
    },
  ]);

  // Walk straight through the center (x = 0) from z = -1 to z = +1
  for (let z = -1.0; z <= 1.0; z += 0.2) {
    const res = walk.push(0, z, 0.2, radius);
    assert.equal(res.x, 0, `Doorway center must let player through without X deflection at z=${z}`);
    assert.equal(res.z, z, `Doorway center must let player through without Z obstruction at z=${z}`);
  }

  // But walking into the wall flank at x = -1.5 must push the player out
  const flankPushed = walk.push(-1.5, 0, 0.2, radius);
  assert.notEqual(flankPushed.z, 0, 'Walking into wall flank must push player out');

  // 5. WindowWall blocks player at its center face (glass height)
  const windowTmpl = cache.getTemplate('windowWall', 1, 0);
  walk.setPieces([
    {
      id: 5,
      kind: 'windowWall',
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      colliders: windowTmpl.colliders,
    },
  ]);
  const windowCenterPushed = walk.push(0, 0, 0.2, radius);
  assert.ok(Math.abs(windowCenterPushed.z) >= 0.4, `Window center face must block player: ${windowCenterPushed.z}`);

  // 6. Door blocks when closed, lets player walk through when open
  const doorTmpl = cache.getTemplate('door', 1, 0);
  const closedDoorColliders = [
    ...doorTmpl.colliders,
    { min: [-0.7, 0, -0.125] as [number, number, number], max: [0.7, 2.3, 0.125] as [number, number, number] },
  ];
  walk.setPieces([
    {
      id: 6,
      kind: 'door',
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      colliders: closedDoorColliders,
    },
  ]);
  const closedPushed = walk.push(0, 0, 0.2, radius);
  assert.ok(Math.abs(closedPushed.z) >= 0.4, `Closed door must block player at doorway center: ${closedPushed.z}`);

  // When door is open (leaf swung out):
  walk.setPieces([
    {
      id: 6,
      kind: 'door',
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      colliders: doorTmpl.colliders,
    },
  ]);
  const openPass = walk.push(0, 0, 0.2, radius);
  assert.equal(openPass.x, 0, 'Open doorway must allow passage without X push');
  assert.equal(openPass.z, 0, 'Open doorway must allow passage without Z push');

  // 7. Roof at k=1 (ceiling) never pushes player walking underneath on floor
  const roofTmpl = cache.getTemplate('roof', 1, 0);
  walk.setPieces([
    {
      id: 7,
      kind: 'roof',
      pos: { x: 0, y: 3.0, z: 0 }, // k = 1 atop 3m walls
      yaw: 0,
      colliders: roofTmpl.colliders,
    },
  ]);
  const roofUnderPushed = walk.push(0, 0, 0.0, radius);
  assert.equal(roofUnderPushed.x, 0, 'Walking underneath roof must not deflect X');
  assert.equal(roofUnderPushed.z, 0, 'Walking underneath roof must not deflect Z');

  // 8. Ramp on a slope where terrain drops 0.8m under the low edge can still be stepped onto
  walk.setPieces([
    {
      id: 8,
      kind: 'ramp',
      pos: { x: 0, y: 5.0, z: 0 },
      yaw: 0,
      colliders: rampTmpl.colliders,
    },
  ]);
  // Player standing on ground at 4.2m (0.8m below ramp base at 5.0m)
  const rampSlopeY = walk.standAt(0, -2.0, 4.2, 4.2);
  assert.equal(rampSlopeY, 5.0, 'Must step onto low edge of ramp even on terrain slope drop');

  cache.dispose();
});

