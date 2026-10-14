// ============================================================================
// File: apps/web/src/lab/__tests__/planet-table-and-ambience.test.ts
// Plans: P1-LORE-05, P1-SOUND-03, P2-SOUND-06 & P1-HOUR-04 Unit Tests
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  CANONICAL_11_NEIGHBOR_ENCLAVES,
  computeContinentalConsensusSummary,
} from '../planet-table-hologram';
import {
  evaluateShepardStageSwell,
  evaluateStageAmbienceStems,
} from '../../../../../packages/soundscape/src/stage-ambience-stems';
import { computeGateSkyBeaconOpacity } from '../../crafter/twin-gate-sky-beacon';

describe('Planet Table 11 Neighbor Enclaves & Consensus Summary (P1-LORE-05)', () => {
  it('tracks all 11 neighboring enclaves on the 4.2 km horizon and locks consensus at Stage 4+', () => {
    expect(CANONICAL_11_NEIGHBOR_ENCLAVES.length).toBe(11);
    const high = computeContinentalConsensusSummary({
      Pxd: 0.95,
      Vtx: 0.95,
      Lx: 0.95,
      Aq: 0.95,
    });
    expect(high.continentalConsensusPct).toBeGreaterThanOrEqual(85.0);
    expect(high.statusHeadline).toContain('MAJORITY CONSENSUS LOCKED');
  });
});

describe('5-Stem Stage Ambience & Shepard Swell (P1-SOUND-03, P2-SOUND-06)', () => {
  it('crossfades from Lab 50Hz hum to Stage 0 respirator to Stage 4 canopy/fauna', () => {
    const lab = evaluateStageAmbienceStems(true, { Pxd: 0, Vtx: 0, Lx: 0, Aq: 0 });
    expect(lab.lab50HzHum0to1).toBeGreaterThan(0.8);
    expect(lab.stage0HelmetRespirator0to1).toBe(0);

    const s0Moon = evaluateStageAmbienceStems(false, { Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 });
    expect(s0Moon.stage0HelmetRespirator0to1).toBeGreaterThan(0.8);

    const s6Moon = evaluateStageAmbienceStems(
      false,
      { Pxd: 0.9, Vtx: 0.9, Lx: 0.9, Aq: 0.85 },
      5.0
    );
    expect(s6Moon.stage0HelmetRespirator0to1).toBe(0);
    expect(s6Moon.stage3WaterLapping0to1).toBeGreaterThan(0.5);
    expect(s6Moon.stage4CanopyAndFauna0to1).toBeGreaterThan(0.8);

    const swell = evaluateShepardStageSwell(3.0);
    expect(swell.active).toBe(true);
    expect(swell.swellGain0to1).toBeCloseTo(1.0, 2);
  });

  it('keeps the Twin Gate Sky Beacon bright in Stage 0 and fades it in Stage 4 daylight', () => {
    const s0Opacity = computeGateSkyBeaconOpacity({ Pxd: 0.1, Vtx: 0.1, Lx: 0.05, Aq: 0 }, 0);
    const s4Opacity = computeGateSkyBeaconOpacity({ Pxd: 0.9, Vtx: 0.9, Lx: 0.95, Aq: 0.9 }, 0);
    expect(s0Opacity).toBeGreaterThan(0.3);
    expect(s4Opacity).toBeLessThan(0.15);
  });
});
