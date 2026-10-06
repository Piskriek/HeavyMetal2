// The Resolution Crafter's data: a world's four numbers, the budgets they give the renderer, cartridges.
// From the SetMix Arena drop (arena-gathered/setmix, contracts.setmix.ts), on our own texgraph dialect.
import type { TexGraph } from "@hm/texgraph";

/** The four things the world is made of more of as it is terraformed. */
export type MetricKey = "pxd" | "vtx" | "lx" | "aq";

/** The six looks of a world, from 2-bit blocks (1) to full PBR with water (6). */
export type Stage = 1 | 2 | 3 | 4 | 5 | 6;

/** Texture sizes the budget can ask for. */
export type TexelSize = 16 | 32 | 64 | 128 | 256 | 512;

/** A world's whole progress: pixel density, vertex density, light and water, plus the sim tick. */
export interface FidelityState {
  pxd: number;
  vtx: number;
  lx: number;
  aq: number;
  tick: number;
}

/** One machine that raises a metric (a Pixel Chimney raises pxd). */
export interface Emitter {
  id: string;
  metric: MetricKey;
  /** 0 basic to 3 best; each tier multiplies the output (TIER_MULT). */
  tier: 0 | 1 | 2 | 3;
  /** Units per second at tier 0 with full power. */
  base: number;
  /** Power it draws, in clock units. */
  clock: number;
  /** The cartridge slotted in, if any: its affinity scales the output. */
  cartridge?: string;
  pos: [number, number];
}

/** What one step of the sim may use. */
export interface StepOptions {
  /** Power available to all emitters; below demand they all slow evenly. */
  clockSupply: number;
  /** 0 = nothing maintained (the world decays), 1 = fully maintained (no decay). */
  maintenance: number;
  /** How many 1/120 s ticks this step covers (default 1). */
  ticks?: number;
}

/** One exposed knob of a cartridge: a poetic label for players, the real term for pros. */
export interface VarDecl {
  path: string;
  label: string;
  real: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  def: number;
  explain: string;
  /** 1 play, 2 build, 3 pro: the harness's three depths. */
  tier: 1 | 2 | 3;
}

/** What a cartridge does when fused: a material, a verb on materials, a rule saying where, and so on. */
export type CartClass = "MATERIAL" | "OPERATOR" | "RULE" | "BIOME" | "MESH" | "RIG";

/** A cartridge: a texture graph you carry from the lab to a machine on the world. Immutable; edits make a new revision. */
export interface Cartridge {
  id: string;
  rev: number;
  name: string;
  kind: "setmix.cartridge";
  /** contentHash of everything else in the cartridge. */
  hash: string;
  /** The hashes of the cartridges it was fused from. */
  parents: string[];
  author: string;
  cls: CartClass;
  graph: TexGraph;
  vars: VarDecl[];
  /** The first stage at which it can be used. */
  minStage: Stage;
  /** Multiplies an emitter's output of that metric while slotted (1 when left out). */
  affinity: Partial<Record<MetricKey, number>>;
  /** A colour for its card and its machine's glow. */
  tint: string;
}

/** What a graphics tier can afford. Ids match the game's tiers (potato, low, medium, high, ultra). */
export interface DeviceProfile {
  id: string;
  label: string;
  maxTexel: TexelSize;
  /** Milliseconds a frame may spend; certify keeps a cartridge under half of it. */
  msBudget: number;
  allowNormal: boolean;
  allowWarp: boolean;
  /** At most 6: @hm/texgraph's noise limit. */
  maxOctaves: number;
}

/** What the renderer may spend on a world right now: the one place progress touches rendering. */
export interface RenderBudget {
  stage: Stage;
  size: TexelSize;
  octaveBudget: number;
  relief: number;
  normal: boolean;
  roughness: boolean;
  /** -1 a hard palette (every ramp stop, nothing between), 0 full colour, n levels per channel. */
  paletteLevels: number;
  shadowCascades: number;
  allowWarp: boolean;
  allowCellular: boolean;
  /** 0 dry to 1 soaked: darkens and glosses low ground. */
  wetness: number;
  /** Plain sentences for everything the tier turned down, so nothing drops silently. */
  demoted: string[];
}

/** How the ground is meshed: blocks, chamfered blocks, then smooth dual contouring. */
export type MeshMode = "CUBIC" | "CHAMFER" | "DUAL";

/** The meshing settings for a chunk at the world's vertex density. */
export interface MeshPolicy {
  lod: number;
  cellSize: number;
  mode: MeshMode;
  chamfer: number;
  relaxIterations: number;
  smoothAngleDeg: number;
  qefClamp: number;
  stage: Stage;
}

/** The export check of a cartridge. */
export interface Certificate {
  nodes: number;
  weight: number;
  texels: number;
  evalMs: number;
  minStage: number;
  determinism: "seed-stable";
  pass: boolean;
  failures: string[];
}

/** What the Fusion Matrix makes of two cartridges. */
export interface FusionResult {
  child: Cartridge;
  /** 0..100: how sure the grammar is that the pair means something. */
  confidence: number;
  /** "MATERIAL + OPERATOR" and so on. */
  grammar: string;
  rationale: string;
  addedNodes: string[];
}

/** The sim runs at 120 ticks a second. */
export const TICK_HZ = 120;

/** Fi = pxd^0.30 vtx^0.30 lx^0.25 aq^0.15 (times coherence): the exponents add up to 1. */
export const FI_WEIGHTS: Readonly<Record<MetricKey, number>> = Object.freeze({ pxd: 0.3, vtx: 0.3, lx: 0.25, aq: 0.15 });

/** The amounts at which a world is finished: normalised() reaches 1 here. */
export const METRIC_TARGET: Readonly<Record<MetricKey, number>> = Object.freeze({ pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7 });

/** Fi thresholds: index i is where stage i + 1 starts. */
export const STAGE_FI: readonly number[] = Object.freeze([0, 1.2e3, 3.0e4, 7.5e5, 5.0e6, 2.6e7, 1.0e8]);

/** The texture sizes the stages climb through. */
export const TEXEL_LADDER: readonly TexelSize[] = Object.freeze([16, 32, 64, 128, 256, 512]);

/** Mesh cell sizes in metres, one per level of detail (coarse to fine). */
export const CELL_LADDER: readonly number[] = Object.freeze([8, 4, 2, 1, 0.5, 0.25]);
