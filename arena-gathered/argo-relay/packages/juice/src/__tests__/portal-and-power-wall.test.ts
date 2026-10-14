// ============================================================================
// File: packages/juice/src/__tests__/portal-and-power-wall.test.ts
// Plans: Plan 17 (P1-VFX-04 Portal Shimmer) & Plan 13 (P0-LAYOUT-02 Power Wall)
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  EARTH_GRAVITY_MPS2,
  MOON_GRAVITY_MPS2,
  PORTAL_SPARK_COUNT,
  evaluatePortalCrossingFrame,
  generatePortalThresholdSparks,
} from '../portal-threshold-shimmer';
import {
  CANONICAL_LAB_CLUTTER_PLACEMENTS,
  CANONICAL_POWER_CHAIN_NODES,
} from '../../../../apps/web/src/lab/power-wall-and-clutter-staging';

describe('Portal Threshold Shimmer & 6x Gravity Dip (P1-VFX-04)', () => {
  it('applies upward buoyant camera pop onto Moon (1.62 m/s2) and heavy dip into Lab (9.81 m/s2)', () => {
    const toMoon = evaluatePortalCrossingFrame('lab-to-moon', 0.08);
    expect(toMoon.targetGravityMps2).toBe(MOON_GRAVITY_MPS2);
    expect(toMoon.shimmerVignetteAlpha0to1).toBeGreaterThan(0.7);
    expect(toMoon.cameraVerticalDipMeters).toBeGreaterThan(0);

    const toLab = evaluatePortalCrossingFrame('moon-to-lab', 0.08);
    expect(toLab.targetGravityMps2).toBe(EARTH_GRAVITY_MPS2);
    expect(toLab.cameraVerticalDipMeters).toBeLessThan(0);

    const settled = evaluatePortalCrossingFrame('lab-to-moon', 0.65);
    expect(settled.isComplete).toBe(true);
    expect(settled.cameraVerticalDipMeters).toBe(0);
  });

  it('spawns 24 amber coil sparks around the 2.6m x 1.7m Gate aperture', () => {
    const sparks = generatePortalThresholdSparks('lab-to-moon');
    expect(sparks.length).toBe(PORTAL_SPARK_COUNT);
    expect(sparks[0].velZ).toBeGreaterThan(0);
  });
});

describe('Canonical Lab Power Chain & Clutter Staging (P0-LAYOUT-02)', () => {
  it('orders the Power Wall strictly left-to-right (Capacitor -> Breaker -> 4 Relays -> Control)', () => {
    for (let i = 1; i < CANONICAL_POWER_CHAIN_NODES.length; i++) {
      expect(CANONICAL_POWER_CHAIN_NODES[i].x).toBeGreaterThan(
        CANONICAL_POWER_CHAIN_NODES[i - 1].x
      );
    }
    const relays = CANONICAL_POWER_CHAIN_NODES.filter((n) => n.hasAmberTopBeacon);
    expect(relays.length).toBe(4);
  });

  it('stages all 10 Lab clutter props with 2 permanent lore fixtures and 8 dissolvable props', () => {
    expect(CANONICAL_LAB_CLUTTER_PLACEMENTS.length).toBe(10);
    const permanent = CANONICAL_LAB_CLUTTER_PLACEMENTS.filter((c) => !c.canDissolveForSalvage);
    const dissolvable = CANONICAL_LAB_CLUTTER_PLACEMENTS.filter((c) => c.canDissolveForSalvage);
    expect(permanent.map((p) => p.assetId).sort()).toEqual(['old-monitor', 'server-rack']);
    expect(dissolvable.length).toBe(8);
  });
});
