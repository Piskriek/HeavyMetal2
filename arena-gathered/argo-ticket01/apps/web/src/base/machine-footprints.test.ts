// ============================================================================
// File: apps/web/src/base/machine-footprints.test.ts
// Unit tests for machineFootprint(kind) + swept pushCircle integration.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { machineFootprint } from './machine-footprints';
import { boxesToWorld, pushCircle, unpackBoxBounds } from '../play/static-colliders';
import type { MachineKind } from './machine-props';

test('machineFootprint returns grounded, body-blocking local AABB for every field machine kind', () => {
  const kinds: readonly string[] = [
    'rockDrill',
    'textureMill',
    'shapePress',
    'lightTower',
    'waterGen',
    'powerCell',
    'relayPylon',
    'weaponBench',
  ];

  for (let i = 0; i < kinds.length; i++) {
    const k = kinds[i];
    if (!k) continue;
    const box = machineFootprint(k as unknown as MachineKind);
    const b = unpackBoxBounds(box);
    assert.equal(b.minY, 0);
    assert.ok(b.maxY >= 1.2, `Expected ${k} height >= 1.2m, got ${b.maxY}`);
    assert.ok(b.maxX - b.minX >= 0.8, `Expected ${k} X width >= 0.8m`);
    assert.ok(b.maxZ - b.minZ >= 0.8, `Expected ${k} Z depth >= 0.8m`);
  }
});

test('placed field machine footprint transformed into planetStatic blocks player walk', () => {
  const drillBox = machineFootprint('rockDrill' as unknown as MachineKind);
  // Translate machine to world (6, 0, -4)
  const worldBoxes = boxesToWorld(
    [drillBox],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 6, 0, -4, 1]
  );
  const res = pushCircle(
    { x: 4.5, z: -4.0 },
    { x: 5.05, z: -4.0 },
    0,
    0.35,
    worldBoxes
  );
  // rockDrill minX is -1.1 -> world minX = 4.9 -> expanded x0 = 4.9 - 0.35 = 4.55
  assert.ok(
    Math.abs(res.x - 4.55) < 1e-6,
    `Expected player stopped at machine face x = 4.55, got ${res.x}`
  );
});
