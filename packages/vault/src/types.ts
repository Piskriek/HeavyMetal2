// The SetMix vault's types: 50 cartridges of the Resolution Crafter, each a texture graph plus what it does in play.
import type { CartClass, Cartridge, Stage } from "@hm/fidelity";

/** Where a cartridge sits in the vault browser. */
export type VaultCategory = "TERRAIN" | "FLORA" | "LIQUID" | "CRYSTAL" | "ROAD" | "STRUCTURE" | "EXOTIC";

/** What slotting a cartridge changes in play (each is a multiplier unless its label says otherwise). */
export interface GameplayStats {
  /** x an emitter's output while slotted */
  plumeRate?: number;
  /** x rover and goblin traction on this surface */
  roverGrip?: number;
  /** + metres of coherence for a beacon standing on it */
  coherenceRadius?: number;
  /** x walk speed */
  walkSpeed?: number;
  /** x harvest from nodes in this biome */
  harvestYield?: number;
  /** x cooling for machines built on it */
  thermalShed?: number;
  /** x light captured by emissive and reflective surfaces */
  lumenGain?: number;
  /** x how long water stays before it evaporates */
  aqRetention?: number;
  /** 0..1 share of the world's variety bonus */
  biomass?: number;
  /** flat Fi per second while any emitter runs it */
  fiTrickle?: number;
}

/** The eight look templates every vault cartridge is built from. */
export type Archetype = "rock" | "crystal" | "carpet" | "flow" | "columnar" | "strata" | "tile" | "canopy";

/**
 * A cartridge's tuning, in the Arena drop's own terms (kept as authored so the data stays traceable;
 * archetypes.ts translates them into our texgraph's parameters).
 */
export interface ArchParams {
  freq?: number;
  octaves?: number;
  gain?: number;
  jitter?: number;
  warp?: number;
  sharp?: number;
  /** degrees */
  angle?: number;
  detail?: number;
  detail2?: number;
  roughLo?: number;
  roughHi?: number;
  /** the drop's gamma is an exponent of 1/gamma; ours is the exponent itself */
  gamma?: number;
  seed?: number;
  interp?: "linear" | "smooth" | "constant";
}

/** One authored vault entry, before it is built into a cartridge. */
export interface Spec {
  id: string;
  name: string;
  cat: VaultCategory;
  arch: Archetype;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  minStage: Stage;
  cls: CartClass;
  /** the ramp's colours, dark to light */
  pal: string[];
  lore: string;
  tags: string[];
  stats: GameplayStats;
  aff: Cartridge["affinity"];
  p?: ArchParams;
  author?: string;
}

/** A built vault cartridge. */
export interface VaultCartridge extends Cartridge {
  category: VaultCategory;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  tags: string[];
  palette: string[];
  flavorLore: string;
  gameplayStats: GameplayStats;
  archetype: Archetype;
}
