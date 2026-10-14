// ============================================================================
// File: packages/substrate/src/__tests__/guaranteed-anti-softlock.test.ts
// Plan: Plan 11 (P0-LOOP-01 Unit Tests for Unified Economy & Anti-Soft-Lock)
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  evaluateAntiSoftLockStatus,
  refineDirtToOre,
  spendOreFromPocketAndDepot,
  type PlayerSubstrateInventory,
} from '../guaranteed-anti-softlock';

const EMPTY_INV: PlayerSubstrateInventory = {
  dirt: 0,
  pocketOre: 0,
  linkedDepotOre: 0,
  salvage: 0,
  anomalyCores: 0,
  blankCartridges: 0,
  runningRockDrills: 0,
};

describe('Unified Dirt -> Ore -> Cartridge Economy & Anti-Soft-Lock (P0-LOOP-01)', () => {
  it('refines 50 Dirt into 25 Ore for Act IV quest A4-02', () => {
    const start = { ...EMPTY_INV, dirt: 50 };
    const { next, oreProduced } = refineDirtToOre(start, 50);
    expect(oreProduced).toBe(25);
    expect(next.dirt).toBe(0);
    expect(next.pocketOre).toBe(25);
  });

  it('pulls seamlessly from Pocket first and Linked Lattice Depot second', () => {
    const start = { ...EMPTY_INV, pocketOre: 10, linkedDepotOre: 30 };
    const after = spendOreFromPocketAndDepot(start, 25);
    expect(after).not.toBeNull();
    expect(after!.pocketOre).toBe(0);
    expect(after!.linkedDepotOre).toBe(15);
  });

  it('guarantees Rule 23 recovery from 0 Ore and 0 Drills via 20 Dirt or 2 Boulders', () => {
    const status = evaluateAntiSoftLockStatus(EMPTY_INV);
    expect(status.isStarvedOfOre).toBe(true);
    expect(status.dirtNeededForDrill).toBe(20);
    expect(status.bouldersNeededForDrill).toBe(2);

    const after20Dirt = refineDirtToOre({ ...EMPTY_INV, dirt: 20 }, 20).next;
    expect(evaluateAntiSoftLockStatus(after20Dirt).canBuildDrillNow).toBe(true);
  });
});
