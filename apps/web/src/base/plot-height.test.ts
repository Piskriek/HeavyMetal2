// ============================================================================
// File: apps/web/src/base/plot-height.test.ts
// Unit tests for plotHeightAt (plan 36 Phase 1: the room and the clients build on the same ground)
// and for the Phase 2 constants and Moon Twin Gate footing pad (POL-111, POL-112).
// The Phase 1 cases pass `gate: false`, which is the bare plot terrain with no footing pad.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain } from '@hm/plotterrain';
import { emptyField, encodeField, heightAt as brushHeightAt, type Field } from '@hm/terrainbrush';
import { drop } from '../crafter/planet';
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

/** A field of the play screen's grid with a single raised cell block near (x, z), as encodeField text. */
function raisedSculpt(x: number, z: number, height: number): { field: Field; text: string } {
  const base = emptyField(PAINT_CELLS, PAINT_CELL);
  const delta = [...base.delta];
  const gx = Math.floor((x - PAINT_ORIGIN) / PAINT_CELL);
  const gz = Math.floor((z - PAINT_ORIGIN) / PAINT_CELL);
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      delta[(gz + dz) * PAINT_CELLS + gx + dx] = height;
    }
  }
  const field: Field = { ...base, delta };
  return { field, text: encodeField(field) };
}

test('with no sculpt, plotHeightAt is the plot terrain minus the planet curve (the play screen formula)', () => {
  const terrain = createTerrain({ seed: OUTPOST_PLOT_SEED });
  const h = plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: false });
  for (const [x, z] of [[0, 0], [12.5, -40], [-88, 61], [150, -150], [-300, 220]] as const) {
    assert.equal(h(x, z), terrain.height(x, z) - drop(x, z));
  }
});

test('a sculpt edit adds the field height at the point, through the same brush heightAt as the play screen', () => {
  const { field, text } = raisedSculpt(20, -10, 1.5);
  const bare = plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: false });
  const sculpted = plotHeightAt({ seed: OUTPOST_PLOT_SEED, sculpt: text, gate: false });
  const expectedEdit = brushHeightAt(field, () => 0, 20 - PAINT_ORIGIN, -10 - PAINT_ORIGIN);
  assert.ok(expectedEdit > 1, 'the raised block lifts its centre');
  assert.ok(Math.abs(sculpted(20, -10) - bare(20, -10) - expectedEdit) < 1e-9);
  // far from the block the ground is as made
  assert.equal(sculpted(-200, 200), bare(-200, 200));
});

test('a field of another grid, or unreadable text, changes nothing', () => {
  const bare = plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: false });
  const wrongSize = encodeField({ ...emptyField(64, PAINT_CELL * 4), delta: new Array(64 * 64).fill(2) });
  for (const sculpt of [wrongSize, 'not-a-field', '']) {
    const h = plotHeightAt({ seed: OUTPOST_PLOT_SEED, sculpt, gate: false });
    assert.equal(h(5, 5), bare(5, 5));
    assert.equal(h(-70, 90), bare(-70, 90));
  }
});

test('the same seed and text give the same heights on every call (purity)', () => {
  const { text } = raisedSculpt(-60, 30, 0.8);
  const a = plotHeightAt({ seed: OUTPOST_PLOT_SEED, sculpt: text });
  const b = plotHeightAt({ seed: OUTPOST_PLOT_SEED, sculpt: text });
  for (let i = 0; i < 40; i++) {
    const x = -150 + i * 7.3, z = 110 - i * 5.9;
    assert.equal(a(x, z), b(x, z));
  }
});

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
  const rawH = plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: false })(gx, gz);
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
    plotHeightAt({ seed: OUTPOST_PLOT_SEED, gate: false })(farX, farZ)
  );
});
