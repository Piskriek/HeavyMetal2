// ============================================================================
// File: apps/web/src/base/plot-height.test.ts
// Unit tests for plotHeightAt (plan 36 Phase 1: the room and the clients build on the same ground).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain } from '@hm/plotterrain';
import { emptyField, encodeField, heightAt as brushHeightAt, type Field } from '@hm/terrainbrush';
import { drop } from '../crafter/planet';
import { OUTPOST_PLOT_SEED, plotHeightAt } from './plot-height';

const PAINT_CELLS = 256;
const BOULDER_SPAN = 320;
const PAINT_CELL = BOULDER_SPAN / PAINT_CELLS;
const PAINT_ORIGIN = -BOULDER_SPAN / 2;

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
  const h = plotHeightAt({ seed: OUTPOST_PLOT_SEED });
  for (const [x, z] of [[0, 0], [12.5, -40], [-88, 61], [150, -150], [-300, 220]] as const) {
    assert.equal(h(x, z), terrain.height(x, z) - drop(x, z));
  }
});

test('a sculpt edit adds the field height at the point, through the same brush heightAt as the play screen', () => {
  const { field, text } = raisedSculpt(20, -10, 1.5);
  const bare = plotHeightAt({ seed: OUTPOST_PLOT_SEED });
  const sculpted = plotHeightAt({ seed: OUTPOST_PLOT_SEED, sculpt: text });
  const expectedEdit = brushHeightAt(field, () => 0, 20 - PAINT_ORIGIN, -10 - PAINT_ORIGIN);
  assert.ok(expectedEdit > 1, 'the raised block lifts its centre');
  assert.ok(Math.abs(sculpted(20, -10) - bare(20, -10) - expectedEdit) < 1e-9);
  // far from the block the ground is as made
  assert.equal(sculpted(-200, 200), bare(-200, 200));
});

test('a field of another grid, or unreadable text, changes nothing', () => {
  const bare = plotHeightAt({ seed: OUTPOST_PLOT_SEED });
  const wrongSize = encodeField({ ...emptyField(64, PAINT_CELL * 4), delta: new Array(64 * 64).fill(2) });
  for (const sculpt of [wrongSize, 'not-a-field', '']) {
    const h = plotHeightAt({ seed: OUTPOST_PLOT_SEED, sculpt });
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
