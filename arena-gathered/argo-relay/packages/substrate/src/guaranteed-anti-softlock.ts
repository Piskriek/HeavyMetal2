// ============================================================================
// File: packages/substrate/src/guaranteed-anti-softlock.ts
// Plan: Plan 11 (P0-LOOP-01 Unified Dirt -> Ore -> Cartridge Economy & Rule 23)
// Purity: 100% pure deterministic functions for @hm/substrate.
// ============================================================================

export interface PlayerSubstrateInventory {
  dirt: number;
  pocketOre: number;
  linkedDepotOre: number;
  salvage: number;
  anomalyCores: number;
  blankCartridges: number;
  runningRockDrills: number;
}

export const DIRT_TO_ORE_RATIO = 2; // 2 Dirt -> 1 Ore in Lab Processor
export const ROCK_DRILL_ORE_COST = 10;
export const BLANK_CARTRIDGE_ORE_COST = 8;

export function getTotalAvailableOre(inv: PlayerSubstrateInventory): number {
  return Math.max(0, inv.pocketOre) + Math.max(0, inv.linkedDepotOre);
}

/**
 * Refines Raw Regolith (Dirt) into Substrate Ore at the 2:1 ratio (TASK-22 / A4-02).
 */
export function refineDirtToOre(
  inv: PlayerSubstrateInventory,
  dirtToRefine: number
): { next: PlayerSubstrateInventory; oreProduced: number } {
  const actualDirt = Math.min(inv.dirt, Math.max(0, Math.floor(dirtToRefine)));
  const usableDirt = actualDirt - (actualDirt % DIRT_TO_ORE_RATIO);
  const oreProduced = usableDirt / DIRT_TO_ORE_RATIO;

  return {
    oreProduced,
    next: {
      ...inv,
      dirt: inv.dirt - usableDirt,
      pocketOre: inv.pocketOre + oreProduced,
    },
  };
}

/**
 * Spends Ore across Pocket first, then Linked Lattice Depot (@hm/lattice Dimensional Depot).
 */
export function spendOreFromPocketAndDepot(
  inv: PlayerSubstrateInventory,
  cost: number
): PlayerSubstrateInventory | null {
  if (getTotalAvailableOre(inv) < cost) return null;

  const fromPocket = Math.min(inv.pocketOre, cost);
  const remainder = cost - fromPocket;

  return {
    ...inv,
    pocketOre: inv.pocketOre - fromPocket,
    linkedDepotOre: inv.linkedDepotOre - remainder,
  };
}

/**
 * Rule 23 Anti-Soft-Lock Diagnostic & Recovery Check:
 * Verifies that even if a player has 0 Ore and 0 running Rock Drills, mining 20 Dirt
 * (infinite anywhere on the plot) or hand-mining 2 surface boulders (5 Ore each)
 * guarantees immediate recovery to build a Rock Drill (10 Ore).
 */
export function evaluateAntiSoftLockStatus(inv: PlayerSubstrateInventory): {
  isStarvedOfOre: boolean;
  canBuildDrillNow: boolean;
  dirtNeededForDrill: number;
  bouldersNeededForDrill: number;
  recoveryHint: string;
} {
  const totalOre = getTotalAvailableOre(inv);
  const potentialOreFromDirt = Math.floor(inv.dirt / DIRT_TO_ORE_RATIO);
  const effectiveOre = totalOre + potentialOreFromDirt;
  const deficit = Math.max(0, ROCK_DRILL_ORE_COST - effectiveOre);

  const isStarvedOfOre = totalOre === 0 && inv.runningRockDrills === 0;
  const canBuildDrillNow = totalOre >= ROCK_DRILL_ORE_COST;
  const dirtNeededForDrill = deficit * DIRT_TO_ORE_RATIO;
  const bouldersNeededForDrill = Math.ceil(deficit / 5);

  const recoveryHint = canBuildDrillNow
    ? 'Ready to place Rock Drill [B].'
    : potentialOreFromDirt >= ROCK_DRILL_ORE_COST - totalOre
    ? 'Refine your mined Dirt at the Lab Processor to smelted Ore.'
    : `Hold [E] on ${bouldersNeededForDrill} surface boulder(s) or mine ${dirtNeededForDrill} Dirt with the Beam Tool.`;

  return {
    isStarvedOfOre,
    canBuildDrillNow,
    dirtNeededForDrill,
    bouldersNeededForDrill,
    recoveryHint,
  };
}
