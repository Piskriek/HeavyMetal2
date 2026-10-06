// @hm/vault: the Resolution Crafter's 50 cartridges (texture graphs on our texgraph, with what they do in play)
// and the Fusion Matrix's recipe table. From the SetMix Arena drop; see docs/SETMIX_LANDING.md.
import type { TexGraph } from "@hm/texgraph";
import { contentHash } from "@hm/fidelity";
import { ARCHETYPES } from "./archetypes";
import { SPECS } from "./specs";
import type { GameplayStats, Spec, VaultCartridge, VaultCategory } from "./types";

export * from "./types";
export { ARCHETYPES, paletteStops, stripesAt, type Built } from "./archetypes";
export { SPECS } from "./specs";
export * from "./recipes";

/** Builds one authored spec into a cartridge: its template's graph, knobs, and a content hash over all of it. */
export function buildCartridge(s: Spec): VaultCartridge {
  const built = ARCHETYPES[s.arch](s.p ?? {}, s.pal);
  const graph: TexGraph = { id: s.id, name: s.name, nodes: built.nodes, out: built.out };
  const header = {
    id: s.id, rev: 1, name: s.name, kind: "setmix.cartridge" as const,
    parents: [] as string[], author: s.author ?? "@hm/vault",
    cls: s.cls, graph, vars: built.vars, minStage: s.minStage,
    affinity: s.aff, tint: s.pal[Math.min(2, s.pal.length - 1)] ?? "#808080",
  };
  return {
    ...header, hash: contentHash(header),
    category: s.cat, tier: s.tier, tags: s.tags, palette: s.pal,
    flavorLore: s.lore, gameplayStats: s.stats, archetype: s.arch,
  };
}

/** All 50 cartridges. */
export const VAULT: readonly VaultCartridge[] = SPECS.map(buildCartridge);

/** Cartridges by id. */
export const VAULT_BY_ID: ReadonlyMap<string, VaultCartridge> = new Map(VAULT.map((c) => [c.id, c]));

/** The vault browser's shelves, in order. */
export const CATEGORIES: readonly VaultCategory[] = ["TERRAIN", "FLORA", "LIQUID", "CRYSTAL", "ROAD", "STRUCTURE", "EXOTIC"];

/** How to show each gameplay stat. */
export const STAT_LABELS: Readonly<Record<keyof GameplayStats, { label: string; unit: string }>> = {
  plumeRate: { label: "Plume Rate", unit: "x" },
  roverGrip: { label: "Rover Grip", unit: "x" },
  coherenceRadius: { label: "Coherence", unit: " m" },
  walkSpeed: { label: "Walk Speed", unit: "x" },
  harvestYield: { label: "Harvest", unit: "x" },
  thermalShed: { label: "Cooling", unit: "x" },
  lumenGain: { label: "Lumen Gain", unit: "x" },
  aqRetention: { label: "Water Retention", unit: "x" },
  biomass: { label: "Biomass", unit: "" },
  fiTrickle: { label: "Fi Trickle", unit: "/s" },
};
