// ============================================================================
// File: apps/web/src/play/static-colliders.test.ts
// Unit tests for static-colliders.ts (TICKET-01 Part A & C):
// 1. Thin-wall tunnelling (0.56 m step vs 0.2 m wall)
// 2. Corners (exterior corner slide & interior L-corner clamp)
// 3. Step-height box ignored (<= feetY + 0.1) & overhead lintel ignored (>= feetY + 1.8)
// 4. Rotated gate frame (boxesToWorld + pushCircle + computeGateExitPose)
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boxesToWorld,
  computeGateExitPose,
  packBoxBounds,
  pushCircle,
  unpackBoxBounds,
} from './static-colliders';

function makeRotationYMatrix(
  angleRad: number,
  tx = 0,
  ty = 0,
  tz = 0
): number[] {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  // Column-major 4x4 matrix (matching THREE.Matrix4.elements)
  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    tx, ty, tz, 1,
  ];
}

test('pushCircle prevents 0.56 m step from tunnelling through a 0.2 m thin wall', () => {
  const thinWall = packBoxBounds(-0.1, 0, -4, 0.1, 3.0, 4);
  const radius = 0.35;

  // Approaching from -X: expanded wall spans [-0.45, +0.45].
  // A 0.56 m step from x = -0.45 lands at x = +0.11 (past the wall centerline,
  // closer to the far +0.45 face than the near -0.45 face).
  const resFromLeft = pushCircle(
    { x: -0.45, z: 0.2 },
    { x: 0.11, z: 0.5 },
    0,
    radius,
    [thinWall]
  );
  assert.ok(
    Math.abs(resFromLeft.x - -0.45) < 1e-6,
    `Expected ejection to near face -0.45, got ${resFromLeft.x}`
  );
  assert.ok(
    Math.abs(resFromLeft.z - 0.5) < 1e-6,
    `Expected Z slide preserved at 0.5, got ${resFromLeft.z}`
  );

  // Even an extreme 1.1 m step that crosses completely past the far face (+0.45)
  // is caught by the swept slab test and ejected back to -0.45:
  const resFullPass = pushCircle(
    { x: -0.46, z: 0 },
    { x: 0.64, z: 0 },
    0,
    radius,
    [thinWall]
  );
  assert.ok(
    Math.abs(resFullPass.x - -0.45) < 1e-6,
    `Expected full-pass step to be stopped at -0.45, got ${resFullPass.x}`
  );

  // Approaching from +X: a 0.56 m step from +0.45 to -0.11 ejects back to +0.45
  const resFromRight = pushCircle(
    { x: 0.45, z: 0 },
    { x: -0.11, z: -0.3 },
    0,
    radius,
    [thinWall]
  );
  assert.ok(
    Math.abs(resFromRight.x - 0.45) < 1e-6,
    `Expected ejection to +0.45, got ${resFromRight.x}`
  );
  assert.ok(Math.abs(resFromRight.z - -0.3) < 1e-6);
});

test('pushCircle resolves exterior and interior L-corners without tunnelling', () => {
  const radius = 0.35;
  const pillar = packBoxBounds(0, 0, 0, 1, 3, 1);

  // Exterior corner approach from (-0.6, -0.4) -> (-0.1, -0.1):
  // Enters Z slab [-0.35, 1.35] first and hits X face (-0.35) last -> ejects X to -0.35
  const extCorner = pushCircle(
    { x: -0.6, z: -0.4 },
    { x: -0.1, z: -0.1 },
    0,
    radius,
    [pillar]
  );
  assert.ok(Math.abs(extCorner.x - -0.35) < 1e-6);
  assert.ok(Math.abs(extCorner.z - -0.1) < 1e-6);

  // Interior L-corner formed by two perpendicular 0.2 m walls meeting at (2, 2):
  const eastWall = packBoxBounds(2.0, 0, -2.0, 2.2, 3.0, 2.2);
  const southWall = packBoxBounds(-2.0, 0, 2.0, 2.2, 3.0, 2.2);
  const lCorner = pushCircle(
    { x: 1.5, z: 1.5 },
    { x: 2.06, z: 2.06 },
    0,
    radius,
    [eastWall, southWall]
  );
  assert.ok(
    Math.abs(lCorner.x - 1.65) < 1e-6,
    `Expected X clamped at 1.65, got ${lCorner.x}`
  );
  assert.ok(
    Math.abs(lCorner.z - 1.65) < 1e-6,
    `Expected Z clamped at 1.65, got ${lCorner.z}`
  );
});

test('pushCircle ignores step-height boxes (<= feetY + 0.1) and overhead lintels (>= feetY + 1.8)', () => {
  const radius = 0.35;
  const lowStepCurb = packBoxBounds(-1, 0, -1, 1, 0.09, 1);
  const highGateLintel = packBoxBounds(-1, 1.85, -1, 1, 3.2, 1);

  const res = pushCircle(
    { x: -0.8, z: 0 },
    { x: 0.0, z: 0 },
    0,
    radius,
    [lowStepCurb, highGateLintel]
  );
  assert.equal(res.x, 0.0);
  assert.equal(res.z, 0.0);
});

test('boxesToWorld + pushCircle + computeGateExitPose handle a rotated Twin Gate frame', () => {
  // Local Twin Gate frame: two side pillars + high top lintel leaving a 2.0 m central doorway
  const localGate = [
    packBoxBounds(-1.6, 0, -0.4, -1.0, 3.2, 0.4), // Left upright
    packBoxBounds(1.0, 0, -0.4, 1.6, 3.2, 0.4),   // Right upright
    packBoxBounds(-1.6, 2.6, -0.4, 1.6, 3.2, 0.4), // Overhead lintel (above feetY + 1.8)
  ];

  // Rotate Gate by 90 degrees (+pi/2) around Y and place at world (10, 0, 20)
  const yaw = Math.PI / 2;
  const m = makeRotationYMatrix(yaw, 10, 0, 20);
  const worldGate = boxesToWorld(localGate, m);
  assert.equal(worldGate.length, 3);

  const firstGateBox = worldGate[0];
  assert.ok(firstGateBox);
  const leftWorld = unpackBoxBounds(firstGateBox);
  // Under +90 deg Y rotation (col0 = [0,0,-1], col2 = [1,0,0]):
  // local x in [-1.6, -1.0] maps to world z in [21.0, 21.6]; local z in [-0.4, 0.4] maps to world x in [9.6, 10.4]
  assert.ok(Math.abs(leftWorld.minX - 9.6) < 1e-6);
  assert.ok(Math.abs(leftWorld.maxX - 10.4) < 1e-6);
  assert.ok(Math.abs(leftWorld.minZ - 21.0) < 1e-6);
  assert.ok(Math.abs(leftWorld.maxZ - 21.6) < 1e-6);

  // Walking into the rotated left pillar at z = 21.3 from x = 9.25 -> x = 9.81 (0.56 m step) is blocked at x = 9.25:
  const hitPillar = pushCircle(
    { x: 9.25, z: 21.3 },
    { x: 9.81, z: 21.3 },
    0,
    0.35,
    worldGate
  );
  assert.ok(Math.abs(hitPillar.x - 9.25) < 1e-6);

  // Walking straight through the center doorway (z = 20.0) under the lintel passes freely:
  const throughDoor = pushCircle(
    { x: 9.25, z: 20.0 },
    { x: 10.75, z: 20.0 },
    0,
    0.35,
    worldGate
  );
  assert.ok(Math.abs(throughDoor.x - 10.75) < 1e-6);

  // computeGateExitPose places spawn at twin-local (0, 0, -3) -> world (7, 20) with yaw = gateYawDelta:
  const exit = computeGateExitPose(m, yaw, 3);
  assert.ok(Math.abs(exit.x - 7.0) < 1e-6);
  assert.ok(Math.abs(exit.z - 20.0) < 1e-6);
  assert.ok(Math.abs(exit.yaw - yaw) < 1e-6);
});
