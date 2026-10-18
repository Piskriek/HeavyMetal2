// ============================================================================
// File: packages/plotsim/src/peaceful-drops.ts
// TICKET-13 Item b (P1-LOOP-05): peaceful drop parity.
// Every item a monster can drop must also come from a non-combat source, so that Aggression 'off' or 'calm' never blocks
// progress. A non-combat source is either a seal reward (sealing a leak or the dormant anomaly) or a Lab combiner recipe
// (salvage and a blank cartridge). The data itself lives where it is made: the drops in leaksim's table (mapped to items
// by apps/web/src/monsters/policy.ts), the seal rewards in the same file, the recipes in @hm/cartlab.
// This module is the pure check over those lists. No DOM, no clock, no randomness.
// ============================================================================

export interface PeacefulSources {
  /** Items a sealed leak or the dormant anomaly gives (the seal rewards). */
  readonly seal: readonly string[];
  /** Output items of the Lab combiner's peaceful recipes. */
  readonly combiner: readonly string[];
}

export interface PeacefulParity {
  readonly ok: boolean;
  /** Drops with no seal reward. */
  readonly withoutSeal: readonly string[];
  /** Drops with no combiner recipe. */
  readonly withoutCombiner: readonly string[];
}

/**
 * Checks that each monster drop item has a seal reward AND a combiner recipe. Drops and sources are item ids.
 */
export function verifyPeacefulDropParity(drops: readonly string[], sources: PeacefulSources): PeacefulParity {
  const withoutSeal: string[] = [];
  const withoutCombiner: string[] = [];
  for (const item of drops) {
    if (!sources.seal.includes(item)) withoutSeal.push(item);
    if (!sources.combiner.includes(item)) withoutCombiner.push(item);
  }
  return {
    ok: withoutSeal.length === 0 && withoutCombiner.length === 0,
    withoutSeal,
    withoutCombiner,
  };
}
