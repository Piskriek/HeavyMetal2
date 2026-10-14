// ============================================================================
// File: packages/hydro/src/__tests__/stage34-water-and-trees.test.ts
// Plans: Plan 01, Plan 14 & Plan 26 Unit Tests for @hm/hydro and @hm/treegen
// ============================================================================

import { describe, expect, it } from 'vitest';
import { sampleHydroAndCoverageAtPoint } from '../stage34-water-and-shoreline';
import {
  evaluatePlotCanopyCell,
  evaluateStage6FaunaHerds,
} from '../../../treegen/src/stage56-lsystem-canopy';

describe('@hm/hydro Stage 3-6 Water Table & Shoreline Coverage Creep', () => {
  it('stays dry in Stages 0-2 and floods the -3.5m eastern basin when Aq >= 0.40', () => {
    const dry = sampleHydroAndCoverageAtPoint(
      62,
      -3.5,
      10,
      { Pxd: 0.2, Vtx: 0.2, Lx: 0.2, Aq: 0.1 },
      0
    );
    expect(dry.hasWater).toBe(false);

    const flooded = sampleHydroAndCoverageAtPoint(
      62,
      -3.5,
      10,
      { Pxd: 0.65, Vtx: 0.65, Lx: 0.65, Aq: 0.45 },
      1.0,
      5.0
    );
    expect(flooded.hasWater).toBe(true);
    expect(flooded.waterDepthM).toBeGreaterThan(0.2);
    expect(flooded.coverageCreep0to1).toBeGreaterThan(0.1);
  });
});

describe('@hm/treegen & @hm/fauna Stage 5-6 Canopy & Fauna Emergence', () => {
  it('keeps the 20m Twin Gate pad clear and spawns trees & fauna at Stage 6 (>= 0.85)', () => {
    const s6 = { Pxd: 0.9, Vtx: 0.9, Lx: 0.9, Aq: 0.9 };
    // Cell (0,0) is at the Twin Gate -> always clear
    expect(evaluatePlotCanopyCell(0, 0, 0, -1.25, s6)).toBeNull();

    // Outer cells spawn high-LOD trees and Stage 6 fauna herds
    const herd = evaluateStage6FaunaHerds(s6, 10.0);
    expect(herd.length).toBe(6);
  });
});
