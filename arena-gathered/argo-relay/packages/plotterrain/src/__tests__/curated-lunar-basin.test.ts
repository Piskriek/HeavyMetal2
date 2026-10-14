// ============================================================================
// File: packages/plotterrain/src/__tests__/curated-lunar-basin.test.ts
// Plan: Plan 13 (P1-LAYOUT-04 Unit Tests for Curated 1 km Lunar Plot)
// ============================================================================

import { describe, expect, it } from 'vitest';
import { sampleCuratedLunarPlot } from '../curated-lunar-basin';

describe('Curated 1 km Starting Lunar Plot Topology (P1-LAYOUT-04)', () => {
  it('keeps the Gate Pad Plateau (0..25m) flat for starter base building', () => {
    const center = sampleCuratedLunarPlot(0, 0);
    const padEdge = sampleCuratedLunarPlot(18, -12);
    expect(center.zone).toBe('gate-plateau');
    expect(Math.abs(center.heightY)).toBeLessThan(0.05);
    expect(Math.abs(padEdge.heightY)).toBeLessThan(0.10);
  });

  it('carves a -3.5m depression in the Eastern Hydro Basin that floods at Stage 3', () => {
    const basin = sampleCuratedLunarPlot(62, 10);
    expect(basin.zone).toBe('east-hydro-basin');
    expect(basin.heightY).toBeLessThan(-3.0);
    expect(basin.isBelowStage3WaterTable).toBe(true);
  });

  it('raises the North-West Bouldered Ore Ridge (+8m) and Perimeter Wreck Rim (+12m)', () => {
    const ridge = sampleCuratedLunarPlot(-75, -65);
    expect(ridge.zone).toBe('nw-ore-ridge');
    expect(ridge.heightY).toBeGreaterThan(7.5);
    expect(ridge.oreVeinRichness0to1).toBeGreaterThan(0.85);

    const rim = sampleCuratedLunarPlot(180, 0);
    expect(rim.zone).toBe('perimeter-wreck-rim');
    expect(rim.heightY).toBeGreaterThan(12.0);
  });
});
