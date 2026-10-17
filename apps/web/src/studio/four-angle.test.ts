// ============================================================================
// File: apps/web/src/studio/four-angle.test.ts
// Unit tests for anglePoses (TICKET-08b Item D).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { anglePoses } from './four-angle';

test('anglePoses places cameras at 0, 90, 180, and 270 degrees at three-quarter height around bbox center', () => {
  const bbox = {
    min: [-2, 0, -1] as const,
    max: [2, 4, 3] as const,
  };

  const poses = anglePoses(bbox);

  // Target is the exact center of the bounding box: [0, 2, 1]
  assert.deepEqual(poses.front.target, [0, 2, 1]);
  assert.deepEqual(poses.right.target, [0, 2, 1]);
  assert.deepEqual(poses.back.target, [0, 2, 1]);
  assert.deepEqual(poses.left.target, [0, 2, 1]);

  // All four views stand at the same elevated three-quarter height above target.y
  const y = poses.front.position[1];
  assert.ok(y >= 3.0, `Expected three-quarter height >= 3.0, got ${y}`);
  assert.equal(poses.right.position[1], y);
  assert.equal(poses.back.position[1], y);
  assert.equal(poses.left.position[1], y);

  // Check azimuth directions relative to target [0, 2, 1]:
  // Front (0°): x == 0, z > 1
  assert.ok(Math.abs(poses.front.position[0] - 0) < 1e-5);
  assert.ok(poses.front.position[2] > 1);

  // Right (90°): x > 0, z == 1
  assert.ok(poses.right.position[0] > 0);
  assert.ok(Math.abs(poses.right.position[2] - 1) < 1e-5);

  // Back (180°): x == 0, z < 1
  assert.ok(Math.abs(poses.back.position[0] - 0) < 1e-5);
  assert.ok(poses.back.position[2] < 1);

  // Left (270°): x < 0, z == 1
  assert.ok(poses.left.position[0] < 0);
  assert.ok(Math.abs(poses.left.position[2] - 1) < 1e-5);

  // Equal horizontal distance from target on all 4 views
  const dFront = Math.hypot(poses.front.position[0] - 0, poses.front.position[2] - 1);
  const dRight = Math.hypot(poses.right.position[0] - 0, poses.right.position[2] - 1);
  const dBack = Math.hypot(poses.back.position[0] - 0, poses.back.position[2] - 1);
  const dLeft = Math.hypot(poses.left.position[0] - 0, poses.left.position[2] - 1);
  assert.ok(Math.abs(dFront - dRight) < 1e-5);
  assert.ok(Math.abs(dFront - dBack) < 1e-5);
  assert.ok(Math.abs(dFront - dLeft) < 1e-5);
});

test('anglePoses also accepts registry tuple bbox [[minX, minY, minZ], [maxX, maxY, maxZ]]', () => {
  const tuplePoses = anglePoses([
    [-1.2, 0, -3.1],
    [1.2, 2.2, 3.1],
  ]);
  assert.deepEqual(tuplePoses.front.target, [0, 1.1, 0]);
  assert.equal(tuplePoses.front.deg, 0);
  assert.equal(tuplePoses.right.deg, 90);
  assert.equal(tuplePoses.back.deg, 180);
  assert.equal(tuplePoses.left.deg, 270);
});
