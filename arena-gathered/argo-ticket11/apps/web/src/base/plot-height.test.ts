// ============================================================================
// File: apps/web/src/base/plot-height.test.ts
// Unit tests for plot-height.ts (POL-111 shared paint constants & POL-112 Moon Twin Gate footing pad).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOULDER_SPAN,
  GATE_PAD_HALF_X,
  GATE_PAD_HALF_Z,
  GATE_PAD_LIFT,
  isInsideGatePad,
  OUTPOST_PLOT_SEED,
  PAINT_CELL,
  PAINT_CELLS,
  PAINT_ORIGIN,
  plotHeightAt,
} from './plot-height';

test('POL-111: plot-height exports canonical terrain paint grid constants', () => {
  assert.equal(BOULDER_SPAN, 320);
  assert.equal(PAINT_CELLS, 256);
  assert.equal(PAINT_CELL, 320 / 256);
  assert.equal(PAINT_ORIGIN, -160);
});

test('POL-112: plotHeightAt levels the Moon Twin Gate footing pad at rawHeight(gx, gz) + 0.25m in its yaw frame', () => {
  const gx = 14;
  const gz = -22;
  const yaw = Math.PI / 6;
  const rawH = plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: null })(gx, gz);
  const withGate = plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: { x: gx, z: gz, yaw } });

  const expectedPadTop = rawH + GATE_PAD_LIFT;
  assert.equal(withGate(gx, gz), expectedPadTop, 'centre of gate pad stands at padTop');

  // Points inside the rotated pad footprint [±1.9m, ±1.25m] also return expectedPadTop
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const lx = GATE_PAD_HALF_X * 0.8;
  const lz = GATE_PAD_HALF_Z * 0.8;
  const wx = gx + lx * cos + lz * sin;
  const wz = gz - lx * sin + lz * cos;
  assert.equal(isInsideGatePad(wx, wz, { x: gx, z: gz, yaw }), true);
  assert.equal(withGate(wx, wz), expectedPadTop);

  // Points well outside the pad footprint follow natural crater height
  const farX = gx + 10;
  const farZ = gz + 10;
  assert.equal(isInsideGatePad(farX, farZ, { x: gx, z: gz, yaw }), false);
  assert.equal(
    withGate(farX, farZ),
    plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: null })(farX, farZ)
  );
});
