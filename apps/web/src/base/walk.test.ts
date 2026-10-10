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

  cache.dispose();
});
