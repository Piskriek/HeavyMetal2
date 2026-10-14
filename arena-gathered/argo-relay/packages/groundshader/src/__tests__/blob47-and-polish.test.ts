// ============================================================================
// File: packages/groundshader/src/__tests__/blob47-and-polish.test.ts
// Closes: POL-05, POL-17, POL-25 & DEC-06 Unit Tests
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  evaluateTwinGatePresentation,
  evaluateWindowBreachFloorFlash,
  getBlob47TileIndex,
  sanitize8NeighborMask,
} from '../blob47-and-polish';

describe('POL-05 47-Tile Blob Autotile Reducer & Polish Gates', () => {
  it('reduces all 256 8-neighbor bitmasks into exactly 47 canonical tile indices (0..46)', () => {
    const indices = new Set<number>();
    for (let m = 0; m < 256; m++) {
      const idx = getBlob47TileIndex(m);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(47);
      indices.add(idx);
    }
    expect(indices.size).toBe(47);
    // Isolated corner bits without cardinal neighbors are stripped to 0
    expect(sanitize8NeighborMask(1 | 4 | 32 | 128)).toBe(0);
  });

  it('swaps Twin Gate to mid.glb at Stage 2 (POL-17) and casts a 15m amber pool (DEC-06)', () => {
    const s0 = evaluateTwinGatePresentation({ Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 }, 5.0);
    expect(s0.gateLod).toBe('low');
    expect(s0.amberPoolMix0to1).toBeGreaterThan(0.4);

    const outsidePool = evaluateTwinGatePresentation({ Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 }, 18.0);
    expect(outsidePool.amberPoolMix0to1).toBe(0);

    const s2 = evaluateTwinGatePresentation({ Pxd: 0.50, Vtx: 0.40, Lx: 0.40, Aq: 0.1 }, 5.0);
    expect(s2.gateLod).toBe('mid');
  });

  it('flashes the Lab floor during Window Breach static bursts (POL-25) and stops when healed', () => {
    const active = evaluateWindowBreachFloorFlash(2.8, 1.0);
    expect(active.floorLightIntensity).toBeGreaterThan(0);

    const healed = evaluateWindowBreachFloorFlash(2.8, 0.0);
    expect(healed.floorLightIntensity).toBe(0);
  });
});
