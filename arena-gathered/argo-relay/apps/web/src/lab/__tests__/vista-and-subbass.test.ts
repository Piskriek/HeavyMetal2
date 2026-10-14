// ============================================================================
// File: apps/web/src/lab/__tests__/vista-and-subbass.test.ts
// Plans: Plan 13 (P0-LAYOUT-03 Window Vista) & Plan 15 (P1-SOUND-05 Sub-Bass)
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  CANONICAL_BREACH_COLUMN_PLACEMENT,
  CANONICAL_VISTA_PROP_PLACEMENTS,
  isPointInsideVistaFidelityPocket,
} from '../vista-spheres-and-breach';
import { getSubBassReinforceParams } from '../../../../../packages/shareware/src/sub-bass-reinforcer';

describe('3D Window Vista Spherical Fidelity Pockets & Breach Column (P0-LAYOUT-03)', () => {
  it('places the Breach Column at the left one-third rule and towers above the glass', () => {
    expect(CANONICAL_BREACH_COLUMN_PLACEMENT.x).toBeLessThan(-15.0);
    expect(CANONICAL_BREACH_COLUMN_PLACEMENT.heightM).toBeGreaterThan(50.0);
  });

  it('straddles shipping-container across pocket-alpha boundary (half inside, half outside)', () => {
    const container = CANONICAL_VISTA_PROP_PLACEMENTS.find(
      (p) => p.assetId === 'shipping-container'
    )!;
    expect(container).toBeDefined();

    // Left end of container (-5.5, 2.5, -42.0) is inside pocket-alpha (-8.0, 4.5, -42.0, r=5.5)
    const leftEnd = isPointInsideVistaFidelityPocket(-5.5, 2.5, -42.0);
    expect(leftEnd.inside).toBe(true);
    expect(leftEnd.pocketId).toBe('pocket-alpha');

    // Right end of container (-1.0, 1.2, -42.0) is outside pocket-alpha (1-bit dither)
    const rightEnd = isPointInsideVistaFidelityPocket(-1.0, 1.2, -42.0);
    expect(rightEnd.inside).toBe(false);
  });

  it('configures 64Hz -> 31Hz sub-bass transient punch for 8-bit shareware shotgun blasts', () => {
    const sub = getSubBassReinforceParams('shotgun-blast');
    expect(sub.startFreqHz).toBeGreaterThan(60);
    expect(sub.endFreqHz).toBeLessThan(35);
    expect(sub.subGain).toBeGreaterThan(0.35);
  });
});
