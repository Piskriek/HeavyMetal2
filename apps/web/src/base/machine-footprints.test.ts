// ============================================================================
// File: apps/web/src/base/machine-footprints.test.ts
// Unit tests for machineFootprint(kind) + swept pushCircle integration.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAVY_KINDS, MACHINE_KINDS, type MachineKind } from '@hm/plotsim';
import { machineFootprint, machineFootprintKinds } from './machine-footprints';
import { boxesToWorld, pushCircle, unpackBoxBounds } from '../play/static-colliders';

const PLOT_KINDS: readonly MachineKind[] = [...MACHINE_KINDS, ...HEAVY_KINDS];

test('every MachineKind the plot can place has a footprint', () => {
  assert.deepEqual([...machineFootprintKinds()].sort(), [...PLOT_KINDS].sort());
});

test('machineFootprint returns grounded, body-blocking local AABB for every field machine kind', () => {
  for (const kind of PLOT_KINDS) {
    const b = unpackBoxBounds(machineFootprint(kind));
    assert.equal(b.minY, 0, `${kind} is grounded`);
    assert.ok(b.maxY >= 1.2, `Expected ${kind} height >= 1.2m, got ${b.maxY}`);
    assert.ok(b.maxX - b.minX >= 0.8, `Expected ${kind} X width >= 0.8m`);
    assert.ok(b.maxZ - b.minZ >= 0.8, `Expected ${kind} Z depth >= 0.8m`);
  }
});

test('placed field machine footprint transformed into planetStatic blocks player walk', () => {
  const drillBox = machineFootprint('drill');
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
  // drill minX is -1.1 -> world minX = 4.9 -> expanded x0 = 4.9 - 0.35 = 4.55
  assert.ok(
    Math.abs(res.x - 4.55) < 1e-6,
    `Expected player stopped at machine face x = 4.55, got ${res.x}`
  );
});
