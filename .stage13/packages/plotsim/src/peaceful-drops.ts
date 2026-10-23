// ============================================================================
// File: packages/plotsim/src/peaceful-drops.ts
// TASK-32 / TICKET-13 (Item b — P1-LOOP-05 & Rule 23): Peaceful Drop Parity
// - Guarantees every core or substrate fragment dropped by a monster also comes
//   from sealing a dormant leak OR from a Lab Preset Combiner recipe (salvage +
//   blank cartridge), so Aggression: 'off' | 'calm' never blocks progression.
// - 100% pure & deterministic: no DOM, no Date.now(), no Math.random()
// ============================================================================

export interface PeacefulCombinerRecipe {
  readonly id: string;
  readonly title: string;
  readonly inputs: readonly { readonly item: string; readonly n: number }[];
  readonly output: { readonly item: string; readonly n: number };
  readonly description: string;
}

export interface MonsterDropParityEntry {
  readonly item: string;
  readonly droppedByArchetypes: readonly string[];
  readonly dormantOrRiftSealReward: boolean;
  readonly wreckOrFieldHarvestSource: boolean;
  readonly combinerRecipeId: string;
}

/**
 * Every item ID that any monster archetype (`swarmer`, `sapper`, `charger`, `spitter`, `brute`)
 * or hostile wave can drop across Stages 0–6.
 */
export const MONSTER_DROP_ITEMS: readonly string[] = Object.freeze([
  'pxd-mono',
  'pxd-chroma',
  'vtx-rough',
  'vtx-fine',
  'lx-spark',
  'aq-drop',
  'anomaly-core',
]);

/**
 * Peaceful Lab Preset Combiner recipes (`Salvage / Substrate + Blank Cartridge -> Core / Fragment`).
 * Ensures players with `Aggression: 'off' | 'calm'` can synthesize any monster drop in the Lab.
 */
export const PEACEFUL_COMBINER_RECIPES: readonly PeacefulCombinerRecipe[] = Object.freeze([
  {
    id: 'combiner-peaceful-anomaly-core',
    title: 'Synthesize Anomaly Core (Peaceful)',
    inputs: [
      { item: 'ore', n: 20 },
      { item: 'pxd-chroma', n: 4 },
      { item: 'cartridge-blank', n: 1 },
    ],
    output: { item: 'anomaly-core', n: 1 },
    description: 'Fuses salvaged wreck substrate and a blank cartridge into a stable Anomaly Core without combat.',
  },
  {
    id: 'combiner-peaceful-pxd-mono',
    title: 'Synthesize 1-Bit Pixel Fragment',
    inputs: [
      { item: 'ore', n: 8 },
      { item: 'cartridge-blank', n: 1 },
    ],
    output: { item: 'pxd-mono', n: 8 },
    description: 'Extracts monochrome pixel fragments from raw lunar ore and a blank cartridge.',
  },
  {
    id: 'combiner-peaceful-pxd-chroma',
    title: 'Synthesize Chroma Pixel Fragment',
    inputs: [
      { item: 'pxd-mono', n: 4 },
      { item: 'ore', n: 10 },
      { item: 'cartridge-blank', n: 1 },
    ],
    output: { item: 'pxd-chroma', n: 6 },
    description: 'Up-samples monochrome fragments into EGA/VGA chroma substrate in the Combiner.',
  },
  {
    id: 'combiner-peaceful-vtx-rough',
    title: 'Synthesize Rough Vertex Shard',
    inputs: [
      { item: 'ore', n: 10 },
      { item: 'cartridge-blank', n: 1 },
    ],
    output: { item: 'vtx-rough', n: 6 },
    description: 'Presses raw ore into coarse wireframe vertex shards.',
  },
  {
    id: 'combiner-peaceful-vtx-fine',
    title: 'Synthesize Fine Vertex Shard',
    inputs: [
      { item: 'vtx-rough', n: 4 },
      { item: 'cartridge-blank', n: 1 },
    ],
    output: { item: 'vtx-fine', n: 4 },
    description: 'Tessellates coarse vertex shards into smooth high-poly vertex substrate.',
  },
  {
    id: 'combiner-peaceful-lx-spark',
    title: 'Synthesize Lux Photon Spark',
    inputs: [
      { item: 'pxd-chroma', n: 2 },
      { item: 'vtx-rough', n: 2 },
      { item: 'cartridge-blank', n: 1 },
    ],
    output: { item: 'lx-spark', n: 4 },
    description: 'Condenses chroma and vertex shards into radiant Lux photon sparks.',
  },
  {
    id: 'combiner-peaceful-aq-drop',
    title: 'Synthesize Sub-Aquifer Droplet',
    inputs: [
      { item: 'lx-spark', n: 2 },
      { item: 'vtx-fine', n: 2 },
      { item: 'cartridge-blank', n: 1 },
    ],
    output: { item: 'aq-drop', n: 4 },
    description: 'Synthesizes crystalline hydro-acoustic droplets from Lux and fine vertex substrate.',
  },
]);

export const PEACEFUL_PARITY_TABLE: readonly MonsterDropParityEntry[] = Object.freeze([
  {
    item: 'pxd-mono',
    droppedByArchetypes: ['swarmer', 'spitter'],
    dormantOrRiftSealReward: true,
    wreckOrFieldHarvestSource: true,
    combinerRecipeId: 'combiner-peaceful-pxd-mono',
  },
  {
    item: 'pxd-chroma',
    droppedByArchetypes: ['spitter', 'sapper'],
    dormantOrRiftSealReward: true,
    wreckOrFieldHarvestSource: true,
    combinerRecipeId: 'combiner-peaceful-pxd-chroma',
  },
  {
    item: 'vtx-rough',
    droppedByArchetypes: ['charger', 'swarmer'],
    dormantOrRiftSealReward: true,
    wreckOrFieldHarvestSource: true,
    combinerRecipeId: 'combiner-peaceful-vtx-rough',
  },
  {
    item: 'vtx-fine',
    droppedByArchetypes: ['charger', 'brute'],
    dormantOrRiftSealReward: true,
    wreckOrFieldHarvestSource: true,
    combinerRecipeId: 'combiner-peaceful-vtx-fine',
  },
  {
    item: 'lx-spark',
    droppedByArchetypes: ['sapper', 'spitter'],
    dormantOrRiftSealReward: true,
    wreckOrFieldHarvestSource: false,
    combinerRecipeId: 'combiner-peaceful-lx-spark',
  },
  {
    item: 'aq-drop',
    droppedByArchetypes: ['brute', 'sapper'],
    dormantOrRiftSealReward: true,
    wreckOrFieldHarvestSource: false,
    combinerRecipeId: 'combiner-peaceful-aq-drop',
  },
  {
    item: 'anomaly-core',
    droppedByArchetypes: ['brute'],
    dormantOrRiftSealReward: true,
    wreckOrFieldHarvestSource: true,
    combinerRecipeId: 'combiner-peaceful-anomaly-core',
  },
]);

/**
 * Pure verification check (Rule 23): confirms every monster drop item has at least one
 * non-combat source (dormant/rift seal reward AND a Lab Combiner recipe).
 */
export function verifyPeacefulDropParity(
  dropItems: readonly string[] = MONSTER_DROP_ITEMS,
): {
  readonly ok: boolean;
  readonly missingItems: readonly string[];
  readonly recipesByOutput: Readonly<Record<string, PeacefulCombinerRecipe>>;
} {
  const recipesByOutput: Record<string, PeacefulCombinerRecipe> = {};
  for (const r of PEACEFUL_COMBINER_RECIPES) {
    recipesByOutput[r.output.item] = r;
  }

  const missingItems: string[] = [];
  for (const item of dropItems) {
    const entry = PEACEFUL_PARITY_TABLE.find((e) => e.item === item);
    const recipe = recipesByOutput[item];
    if (!entry || (!entry.dormantOrRiftSealReward && !recipe)) {
      missingItems.push(item);
    }
  }

  return {
    ok: missingItems.length === 0,
    missingItems,
    recipesByOutput,
  };
}
