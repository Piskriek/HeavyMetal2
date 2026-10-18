// ============================================================================
// File: apps/web/src/avatar/two-bone-ik.test.ts
// Unit tests for two-bone-ik.ts (POL-28 analytical two-bone IK solver).
// Imports ONLY modules in the bundle/context.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { solveTwoBoneIk } from './two-bone-ik';

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

test('POL-28: solveTwoBoneIk places the hand on a reachable foregrip socket while preserving upper and lower bone lengths', () => {
  const rootPos = { x: -0.22, y: 1.42, z: 0.0 };
  const midPos = { x: -0.22, y: 1.12, z: 0.0 }; // 0.30 m upper arm
  const endPos = { x: -0.22, y: 0.84, z: 0.0 }; // 0.28 m forearm
  const targetPos = { x: 0.08, y: 1.18, z: 0.36 }; // Rifle foregrip socket in front of chest
  const polePos = { x: -0.45, y: 0.95, z: -0.15 }; // Left-down-back elbow pole

  const sol = solveTwoBoneIk({ rootPos, midPos, endPos, targetPos, polePos });
  assert.equal(sol.withinReach, true);
  assert.ok(Math.abs(sol.upperLen - 0.30) < 1e-6);
  assert.ok(Math.abs(sol.lowerLen - 0.28) < 1e-6);

  // Solved joint preserves both bone lengths and reaches targetPos
  assert.ok(Math.abs(dist(rootPos, sol.jointPos) - sol.upperLen) < 1e-5, 'upper arm length preserved');
  assert.ok(Math.abs(dist(sol.jointPos, sol.solvedEndPos) - sol.lowerLen) < 1e-5, 'forearm length preserved');
  assert.ok(dist(sol.solvedEndPos, targetPos) < 1e-5, 'hand lands on foregrip target');
});

test('POL-28: solveTwoBoneIk softly clamps unreachable targets without NaNs or hyper-extension', () => {
  const rootPos = { x: 0, y: 1.4, z: 0 };
  const midPos = { x: 0, y: 1.1, z: 0 }; // 0.30 m
  const endPos = { x: 0, y: 0.8, z: 0 }; // 0.30 m (total 0.60 m)
  const farTarget = { x: 0, y: 1.4, z: 2.0 }; // 2.0 m away
  const polePos = { x: -0.5, y: 1.0, z: 0 };

  const sol = solveTwoBoneIk({ rootPos, midPos, endPos, targetPos: farTarget, polePos });
  assert.equal(sol.withinReach, false);
  assert.ok(Number.isFinite(sol.jointPos.x) && Number.isFinite(sol.jointPos.y) && Number.isFinite(sol.jointPos.z));
  assert.ok(Math.abs(sol.reachDist - 0.60 * 0.9995) < 1e-4);
  assert.ok(Math.abs(dist(rootPos, sol.jointPos) - 0.30) < 1e-5);
  assert.ok(Math.abs(dist(sol.jointPos, sol.solvedEndPos) - 0.30) < 1e-5);
});
