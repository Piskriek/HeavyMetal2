/* ============================================================================
 *  packages/content/src/presets.ts
 *  ---------------------------------------------------------------------------
 *  THE PRESET BIBLE — 50 production cartridges.
 *
 *  AUTHORING PHILOSOPHY
 *  Fifty hand-written node soups would be fifty things to maintain and fifty
 *  places to get the roughness range wrong. Instead this file ships eight
 *  ARCHETYPE BUILDERS — rock, crystal, carpet, flow, columnar, strata, tile,
 *  canopy — each a parameterised, deterministic TexGraph generator, plus the
 *  per-cartridge tuning that makes each one itself.
 *
 *  That is exactly how a real content team works: a tech artist authors the
 *  archetype, and content designers tune instances. Every cartridge below
 *  expands to a genuine @hm/texgraph AST that evaluateGraph() can run right
 *  now, and every one carries its lore, palette, stats and stage gate.
 *
 *  Pure data + pure builders. No imports beyond contracts and the hasher.
 * ==========================================================================*/

import type { Cartridge, CartClass, Stage, TexGraph, TexNode, VarDecl } from "../contracts.setmix";
import { contentHash } from "../fidelity";

/* ───────────────────────────────────────────────────────────── contracts */

export type VaultCategory =
  | "TERRAIN" | "FLORA" | "LIQUID" | "CRYSTAL" | "ROAD" | "STRUCTURE" | "EXOTIC";

export interface GameplayStats {
  /** × multiplier on an emitter's output when this cartridge is slotted */
  plumeRate?: number;
  /** × rover / goblin traction on this surface */
  roverGrip?: number;
  /** + metres to any Coherence Beacon standing on it */
  coherenceRadius?: number;
  /** × walk speed */
  walkSpeed?: number;
  /** × harvest yield from nodes spawned in this biome */
  harvestYield?: number;
  /** × machine cooling for anything built on it */
  thermalShed?: number;
  /** × Lumen capture — emissive and reflective surfaces pay out */
  lumenGain?: number;
  /** × how long Aq persists before evaporating */
  aqRetention?: number;
  /** 0..1 contribution to the planet's Variety bonus */
  biomass?: number;
  /** flat Fi/s while any spire is emitting this */
  fiTrickle?: number;
}

export interface VaultCartridge extends Cartridge {
  category: VaultCategory;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  tags: string[];
  palette: string[];
  flavorLore: string;
  gameplayStats: GameplayStats;
  archetype: Archetype;
}

export type Archetype =
  | "rock" | "crystal" | "carpet" | "flow" | "columnar"
  | "strata" | "tile" | "canopy";

type Stop = { t: number; color: [number, number, number] };

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const ramp = (pal: string[]): Stop[] =>
  pal.map((c, i) => ({ t: pal.length === 1 ? 0 : i / (pal.length - 1), color: hex(c) }));

/* ═══════════════════════════════════════════ THE EIGHT ARCHETYPES ══════ */

export interface ArchParams {
  freq?: number; octaves?: number; gain?: number; jitter?: number;
  warp?: number; sharp?: number; angle?: number; detail?: number;
  detail2?: number;
  roughLo?: number; roughHi?: number; gamma?: number; seed?: number;
  interp?: "linear" | "smooth" | "constant";
}

type Built = { nodes: TexNode[]; out: TexGraph["out"]; vars: VarDecl[] };

const V = (
  path: string, label: string, real: string, unit: string,
  min: number, max: number, step: number, def: number, explain: string, tier: 1 | 2 | 3,
): VarDecl => ({ path, label, real, unit, min, max, step, def, explain, tier });

const ARCH: Record<Archetype, (p: ArchParams, pal: string[]) => Built> = {
  /* ── crags, silt, regolith: fBm against a Worley breakup ─────────── */
  rock: (p, pal) => {
    const f = p.freq ?? 5, o = p.octaves ?? 5, j = p.jitter ?? 0.85, g = p.gain ?? 0.52;
    return {
      nodes: [
        { id: "n", type: "noise", freq: f, octaves: o, gain: g, lacunarity: 2.05, seed: p.seed ?? 3 },
        { id: "cell", type: "cellular", freq: f * 1.6, jitter: j, seed: (p.seed ?? 3) + 11 },
        { id: "grit", type: "grain", scale: 2, seed: (p.seed ?? 3) + 29 },
        { id: "mix", type: "blend", a: "n", b: "cell", mode: "min", factor: p.detail ?? 0.34 },
        { id: "spec", type: "blend", a: "mix", b: "grit", mode: "mix", factor: 0.11 },
        { id: "h", type: "levels", input: "spec", inLow: 0.16, inHigh: 0.88, gamma: p.gamma ?? 1.05 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "linear", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.62, outHigh: p.roughHi ?? 0.95 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("n.freq", "Coarseness", "base frequency", "cyc/tile", 1, 24, 0.5, f, "How many bumps fit across one tile.", 1),
        V("n.octaves", "Grain Depth", "fBm octaves", "oct", 1, 8, 1, o, "How many times the detail halves and repeats.", 2),
        V("cell.jitter", "Fracture", "Worley jitter", "—", 0, 1, 0.01, j, "Ordered lattice at 0, shattered rubble at 1.", 2),
        V("mix.factor", "Crag Depth", "blend factor", "—", 0, 1, 0.01, p.detail ?? 0.34, "How hard the fracture pattern cuts the surface.", 1),
      ],
    };
  },

  /* ── faceted, emissive, specular: inverted Worley with a hard edge ─ */
  crystal: (p, pal) => {
    const f = p.freq ?? 7, j = p.jitter ?? 0.9;
    return {
      nodes: [
        { id: "cell", type: "cellular", freq: f, jitter: j, invert: 1, seed: p.seed ?? 5 },
        { id: "facet", type: "levels", input: "cell", inLow: 0.4, inHigh: 0.96, gamma: p.gamma ?? 0.62 },
        { id: "fine", type: "noise", freq: f * 3.2, octaves: p.octaves ?? 2, seed: (p.seed ?? 5) + 7 },
        { id: "h", type: "blend", a: "facet", b: "fine", mode: "add", factor: p.detail ?? 0.1 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "smooth", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.05, outHigh: p.roughHi ?? 0.34 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("cell.freq", "Facet Count", "Worley frequency", "cells/tile", 2, 28, 1, f, "How many crystal faces fit across the tile.", 1),
        V("cell.jitter", "Irregularity", "cell jitter", "—", 0, 1, 0.01, j, "Perfect lattice at 0, shattered geode at 1.", 2),
        V("facet.gamma", "Edge Bite", "gamma", "γ", 0.2, 2.5, 0.05, p.gamma ?? 0.62, "How hard the facet edges cut.", 3),
      ],
    };
  },

  /* ── mycelium, moss, lichen: clumped cells masked by fine fuzz ───── */
  carpet: (p, pal) => {
    const f = p.freq ?? 6, w = p.warp ?? 0.06;
    return {
      nodes: [
        { id: "clump", type: "cellular", freq: f, jitter: 1, invert: 1, seed: p.seed ?? 21 },
        { id: "fuzz", type: "noise", freq: f * 5.5, octaves: p.octaves ?? 4, gain: 0.58, seed: (p.seed ?? 21) + 13 },
        { id: "drift", type: "noise", freq: f * 0.6, octaves: 3, seed: (p.seed ?? 21) + 41 },
        { id: "w", type: "warp", input: "clump", by: "drift", amount: w },
        { id: "mix", type: "blend", a: "w", b: "fuzz", mode: "mul", factor: p.detail ?? 0.62 },
        { id: "h", type: "levels", input: "mix", inLow: 0.06, inHigh: 0.9, gamma: p.gamma ?? 1.25 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "smooth", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.48, outHigh: p.roughHi ?? 0.88 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("clump.freq", "Clumping", "Worley frequency", "clumps/tile", 2, 18, 1, f, "How tightly the growth gathers into patches.", 1),
        V("w.amount", "Creep", "domain warp", "uv", 0, 0.3, 0.005, w, "How far the colony has crept sideways.", 1),
        V("mix.factor", "Density", "blend factor", "—", 0, 1, 0.01, p.detail ?? 0.62, "Sparse film at 0, matted carpet at 1.", 1),
      ],
    };
  },

  /* ── kelp, currents, neon: TRUE curl noise driving a 2-ch warp ───── */
  flow: (p, pal) => {
    const f = p.freq ?? 2.5, w = p.warp ?? 0.3;
    return {
      nodes: [
        { id: "psi", type: "noise", freq: f, octaves: p.octaves ?? 4, gain: 0.55, seed: p.seed ?? 101 },
        { id: "vec", type: "curl", potential: "psi", scale: 1 },
        { id: "ink", type: "stripes", freq: p.detail ?? 14, angle: p.angle ?? 12, sharpness: p.sharp ?? 0.2 },
        { id: "w", type: "warp", input: "ink", vectorField: "vec", amount: w },
        { id: "h", type: "levels", input: "w", inLow: 0.18, inHigh: 0.84, gamma: p.gamma ?? 1 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "smooth", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.08, outHigh: p.roughHi ?? 0.4 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("w.amount", "Vorticity", "warp amount", "uv", 0, 0.6, 0.01, w, "How hard the incompressible field swirls.", 1),
        V("psi.freq", "Eddy Scale", "potential frequency", "cyc/tile", 0.5, 10, 0.25, f, "Size of each vortex in the stream function.", 1),
        V("ink.freq", "Strand Count", "stripe frequency", "strands", 4, 48, 1, p.detail ?? 14, "The tracer the vortices are visibly stirring.", 2),
      ],
    };
  },

  /* ── basalt, giant's causeway: low-jitter Worley cooling joints ──── */
  columnar: (p, pal) => {
    const f = p.freq ?? 6, j = p.jitter ?? 0.32;
    return {
      nodes: [
        { id: "cols", type: "cellular", freq: f, jitter: j, seed: p.seed ?? 13 },
        { id: "joint", type: "levels", input: "cols", inLow: 0, inHigh: 0.3, gamma: p.gamma ?? 1.6 },
        { id: "rock", type: "noise", freq: f * 4.2, octaves: p.octaves ?? 5, gain: 0.46, seed: (p.seed ?? 13) + 17 },
        { id: "h", type: "blend", a: "joint", b: "rock", mode: "mix", factor: p.detail ?? 0.26 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "linear", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "rock", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.58, outHigh: p.roughHi ?? 0.94 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("cols.freq", "Column Width", "Worley frequency", "cols/tile", 2, 20, 1, f, "Thick pillars at 2, pencil basalt at 20.", 1),
        V("cols.jitter", "Regularity", "cell jitter", "—", 0, 1, 0.01, j, "Low values give the hexagonal cooling joints.", 2),
        V("h.factor", "Weathering", "blend factor", "—", 0, 1, 0.01, p.detail ?? 0.26, "How much surface rot breaks the columns.", 2),
      ],
    };
  },

  /* ── roads, courses, sediment: directional stripes + jitter warp ─── */
  strata: (p, pal) => {
    const f = p.detail ?? 11, s = p.sharp ?? 0.72;
    return {
      nodes: [
        { id: "bands", type: "stripes", freq: f, angle: p.angle ?? 0, sharpness: s },
        { id: "jit", type: "noise", freq: p.freq ?? 7, octaves: p.octaves ?? 3, seed: p.seed ?? 61 },
        { id: "w", type: "warp", input: "bands", by: "jit", amount: p.warp ?? 0.032 },
        { id: "wear", type: "cellular", freq: f * 1.1, jitter: 0.55, seed: (p.seed ?? 61) + 9 },
        { id: "h", type: "blend", a: "w", b: "wear", mode: "overlay", factor: 0.3 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "linear", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.4, outHigh: p.roughHi ?? 0.82 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("bands.freq", "Course Count", "stripe frequency", "courses", 2, 44, 1, f, "How many strata bands the tool lays down.", 1),
        V("bands.angle", "Heading", "stripe angle", "°", 0, 180, 1, p.angle ?? 0, "Direction the courses run.", 1),
        V("bands.sharpness", "Compaction", "square-wave mix", "—", 0, 1, 0.01, s, "Soft dunes at 0, cut masonry at 1.", 2),
      ],
    };
  },

  /* ── pavers, tiles, grids: checker lattice bevelled by Worley ────── */
  tile: (p, pal) => {
    const f = p.detail ?? 8;
    return {
      nodes: [
        { id: "grid", type: "checker", freq: f },
        { id: "bevel", type: "cellular", freq: f, jitter: p.jitter ?? 0.08, seed: p.seed ?? 77 },
        { id: "edge", type: "levels", input: "bevel", inLow: 0, inHigh: 0.26, gamma: 1.3 },
        { id: "grime", type: "noise", freq: p.freq ?? 18, octaves: p.octaves ?? 4, seed: (p.seed ?? 77) + 5 },
        { id: "base", type: "blend", a: "edge", b: "grid", mode: "mix", factor: p.sharp ?? 0.22 },
        { id: "h", type: "blend", a: "base", b: "grime", mode: "overlay", factor: p.detail2 ?? 0.24 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "linear", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.22, outHigh: p.roughHi ?? 0.7 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("grid.freq", "Tile Count", "checker frequency", "tiles", 2, 32, 1, f, "How many tiles fit across the tile.", 1),
        V("edge.inHigh", "Bevel Width", "levels high", "—", 0.05, 0.6, 0.01, 0.26, "How far back from a joint the chamfer runs.", 2),
        V("base.factor", "Joint Contrast", "blend factor", "—", 0, 1, 0.01, p.sharp ?? 0.22, "How visible the grout line is.", 1),
      ],
    };
  },

  /* ── jungle, forest, canopy: warped multi-scale leaf clusters ────── */
  canopy: (p, pal) => {
    const f = p.freq ?? 4, w = p.warp ?? 0.1;
    return {
      nodes: [
        { id: "crown", type: "cellular", freq: f, jitter: 1, invert: 1, seed: p.seed ?? 33 },
        { id: "leaf", type: "cellular", freq: f * 4.5, jitter: 0.9, invert: 1, seed: (p.seed ?? 33) + 19 },
        { id: "breeze", type: "noise", freq: f * 0.8, octaves: p.octaves ?? 4, seed: (p.seed ?? 33) + 51 },
        { id: "w1", type: "warp", input: "leaf", by: "breeze", amount: w },
        { id: "stack", type: "blend", a: "crown", b: "w1", mode: "overlay", factor: p.detail ?? 0.58 },
        { id: "h", type: "levels", input: "stack", inLow: 0.1, inHigh: 0.92, gamma: p.gamma ?? 1.15 },
        { id: "alb", type: "ramp", input: "h", interpolation: p.interp ?? "smooth", stops: ramp(pal) },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: p.roughLo ?? 0.42, outHigh: p.roughHi ?? 0.8 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
      vars: [
        V("crown.freq", "Crown Scale", "Worley frequency", "crowns", 1, 14, 0.5, f, "Size of each tree crown.", 1),
        V("w1.amount", "Sway", "domain warp", "uv", 0, 0.3, 0.005, w, "How much the canopy has been combed by wind.", 1),
        V("stack.factor", "Layering", "blend factor", "—", 0, 1, 0.01, p.detail ?? 0.58, "How much leaf detail reads through the crowns.", 2),
      ],
    };
  },
};

/* ───────────────────────────────────────────── the authoring record ──── */

interface Spec {
  id: string; name: string; cat: VaultCategory; arch: Archetype;
  tier: 1 | 2 | 3 | 4 | 5 | 6; minStage: Stage; cls: CartClass;
  pal: string[]; lore: string; tags: string[];
  stats: GameplayStats; aff: Cartridge["affinity"];
  p?: ArchParams;
  author?: string;
}

function build(s: Spec): VaultCartridge {
  const b = ARCH[s.arch](s.p ?? {}, s.pal);
  const graph: TexGraph = { id: s.id, name: s.name, nodes: b.nodes, out: b.out };
  const header = {
    id: s.id, rev: 1, name: s.name, kind: "setmix.cartridge" as const,
    parents: [] as string[], author: s.author ?? "@hm/content",
    cls: s.cls, graph, vars: b.vars, minStage: s.minStage,
    affinity: s.aff, tint: s.pal[Math.min(2, s.pal.length - 1)],
  };
  return {
    ...header, hash: contentHash(header),
    category: s.cat, tier: s.tier, tags: s.tags,
    palette: s.pal, flavorLore: s.lore, gameplayStats: s.stats,
    archetype: s.arch,
  };
}

/* ══════════════════════ TIER 1–2 · BARREN REGOLITH & PRIMITIVE GEOLOGY ══ */

const T12: Spec[] = [
  { id: "lunar_anorthosite", name: "Lunar Anorthosite", cat: "TERRAIN", arch: "rock", tier: 1, minStage: 1, cls: "MATERIAL",
    pal: ["#1b1d22", "#3a3f48", "#6b7280", "#a7aeb8"], tags: ["regolith", "grey", "starter", "vacuum"],
    lore: "Plagioclase feldspar crushed by four billion years of micrometeorite rain. It is the colour of nothing having happened yet — which is why the first colour you add to it feels like an event.",
    stats: { plumeRate: 1.0, roverGrip: 0.82, coherenceRadius: 0, harvestYield: 1.0 }, aff: {},
    p: { freq: 4.5, octaves: 4, detail: 0.3, interp: "constant", roughLo: 0.76, roughHi: 0.97 } },

  { id: "obsidian_glass", name: "Volcanic Obsidian Glass", cat: "TERRAIN", arch: "rock", tier: 2, minStage: 2, cls: "MATERIAL",
    pal: ["#07070b", "#17141f", "#2d2838", "#5a4f6e"], tags: ["glass", "volcanic", "specular", "sharp"],
    lore: "Lava quenched faster than its atoms could agree on a lattice. The surface holds a mirror finish and an edge sharper than any tool your fabricator can print.",
    stats: { plumeRate: 1.12, roverGrip: 0.46, lumenGain: 1.45, thermalShed: 1.2 }, aff: { lx: 1.3 },
    p: { freq: 3.2, octaves: 6, jitter: 0.42, detail: 0.48, gamma: 0.82, roughLo: 0.04, roughHi: 0.26 } },

  { id: "sulfur_vent_crust", name: "Sulfur Vent Crust", cat: "TERRAIN", arch: "carpet", tier: 2, minStage: 2, cls: "MATERIAL",
    pal: ["#3a2a06", "#8a6a0d", "#d9b225", "#f7e98a"], tags: ["sulfur", "vent", "toxic", "yellow"],
    lore: "Where the mantle exhales, sulfur condenses into brittle yellow cauliflower. Beautiful, structurally useless, and it will eat an unsealed boot in ninety seconds.",
    stats: { plumeRate: 1.34, roverGrip: 0.58, harvestYield: 1.6, thermalShed: 0.7 }, aff: { pxd: 1.22 },
    p: { freq: 8, warp: 0.09, detail: 0.7, roughLo: 0.6, roughHi: 0.95 } },

  { id: "red_ochre_silt", name: "Red Ochre Silt", cat: "TERRAIN", arch: "rock", tier: 1, minStage: 1, cls: "MATERIAL",
    pal: ["#2a1008", "#6b2d14", "#a9542a", "#d99a6a"], tags: ["iron", "silt", "red", "dust"],
    lore: "Oxidised iron fines, graded by a wind that has had nothing else to do for an age. It compacts beautifully under a roller — the first material anyone ever paves with.",
    stats: { plumeRate: 1.06, roverGrip: 1.1, walkSpeed: 1.04, aqRetention: 1.25 }, aff: { pxd: 1.1 },
    p: { freq: 3.4, octaves: 5, jitter: 0.95, detail: 0.2, roughLo: 0.68, roughHi: 0.92 } },

  { id: "shock_quartz", name: "Impact Shock Quartz", cat: "CRYSTAL", arch: "crystal", tier: 2, minStage: 2, cls: "MATERIAL",
    pal: ["#171a24", "#49536b", "#9aa8c6", "#e4ecff"], tags: ["quartz", "impact", "lamellae", "rare"],
    lore: "Quartz that was present at a very bad afternoon. The shock lamellae running through it are a permanent recording of a pressure wave, and they still ring when struck.",
    stats: { plumeRate: 1.28, lumenGain: 1.3, harvestYield: 1.45, coherenceRadius: 12 }, aff: { pxd: 1.35, lx: 1.1 },
    p: { freq: 9, jitter: 0.74, gamma: 0.52, detail: 0.14 } },

  { id: "basalt_joint", name: "Basalt Columnar Joint", cat: "TERRAIN", arch: "columnar", tier: 2, minStage: 2, cls: "MATERIAL",
    pal: ["#0b0c10", "#24262e", "#43464f", "#6e727c"], tags: ["basalt", "hexagonal", "cliff", "landmark"],
    lore: "Cooling contraction cracks a lava sheet into hexagons because hexagons are what a plane does when it has to tile itself and minimise work. Physics, showing off.",
    stats: { plumeRate: 1.18, roverGrip: 0.74, coherenceRadius: 18, thermalShed: 1.35 }, aff: { vtx: 1.45 },
    p: { freq: 6, jitter: 0.3, detail: 0.26 } },

  { id: "pyrite_strata", name: "Iron Pyrite Strata", cat: "TERRAIN", arch: "strata", tier: 2, minStage: 2, cls: "MATERIAL",
    pal: ["#1a1509", "#564419", "#a98a2e", "#e3cf7a"], tags: ["pyrite", "metallic", "bedded", "fools-gold"],
    lore: "Fool's gold in finger-thick beds, laid down by a sea that no longer exists. Your drones will prioritise it over actual ore every single time unless you tell them not to.",
    stats: { plumeRate: 1.22, lumenGain: 1.55, harvestYield: 1.3, roverGrip: 0.88 }, aff: { lx: 1.28, pxd: 1.1 },
    p: { detail: 9, sharp: 0.55, angle: 8, warp: 0.05, roughLo: 0.18, roughHi: 0.52 } },

  { id: "permafrost_clathrate", name: "Permafrost Clathrate", cat: "LIQUID", arch: "crystal", tier: 2, minStage: 2, cls: "MATERIAL",
    pal: ["#0a1a22", "#1d4a5e", "#4f9fb8", "#c7f0fb"], tags: ["ice", "clathrate", "polar", "water-source"],
    lore: "Methane and water locked in a cage lattice, stable only in permanent shadow. Crack it and you release an ocean's worth of ambition one hiss at a time.",
    stats: { plumeRate: 1.4, roverGrip: 0.38, aqRetention: 2.2, thermalShed: 1.8 }, aff: { aq: 1.85 },
    p: { freq: 5.5, jitter: 0.55, gamma: 0.8, roughLo: 0.06, roughHi: 0.3 } },

  { id: "magnetite", name: "Magnetic Magnetite", cat: "TERRAIN", arch: "rock", tier: 2, minStage: 2, cls: "MATERIAL",
    pal: ["#07080c", "#1d2029", "#3b4150", "#767e92"], tags: ["magnetite", "magnetic", "ore", "dense"],
    lore: "So ferromagnetic that compasses, drones and loose tools all agree to be somewhere else. Mag-lev rail will not work anywhere else on the planet.",
    stats: { plumeRate: 1.15, roverGrip: 1.38, harvestYield: 1.25, coherenceRadius: -6 }, aff: { vtx: 1.2 },
    p: { freq: 6.5, octaves: 6, jitter: 0.6, detail: 0.46, roughLo: 0.3, roughHi: 0.62 } },

  { id: "crater_calcite", name: "Crater Calcite", cat: "CRYSTAL", arch: "crystal", tier: 1, minStage: 1, cls: "MATERIAL",
    pal: ["#26241e", "#6e675a", "#b5ab96", "#f2ead6"], tags: ["calcite", "crater", "pale", "common"],
    lore: "Pale carbonate blooming in the cool shadow of every impact rim. Soft enough to carve with a thumbnail, bright enough to see from orbit.",
    stats: { plumeRate: 1.08, lumenGain: 1.18, coherenceRadius: 8, harvestYield: 1.1 }, aff: { pxd: 1.12 },
    p: { freq: 5, jitter: 0.95, gamma: 0.95, roughLo: 0.4, roughHi: 0.72, interp: "constant" } },
];

/* ═══════════ TIER 3–4 · BIOLUMINESCENT FLORA, LICHEN & EARLY BIOSPHERE ══ */

const T34: Spec[] = [
  { id: "neon_mycelium", name: "Neon Mycelium Carpet", cat: "FLORA", arch: "carpet", tier: 3, minStage: 3, cls: "BIOME",
    pal: ["#06110c", "#0e4a32", "#2fd68a", "#b6ffdc"], tags: ["fungus", "glow", "network", "logistics"],
    lore: "A single organism the size of a valley, routing nutrients along whichever hypha is busiest. It will grow toward your machines because your machines are warm.",
    stats: { plumeRate: 1.3, biomass: 0.62, lumenGain: 1.9, walkSpeed: 1.08, coherenceRadius: 22 }, aff: { lx: 1.3, aq: 1.2 },
    p: { freq: 5, warp: 0.085, detail: 0.68, roughLo: 0.5, roughHi: 0.86 } },

  { id: "phosphor_spore", name: "Phosphor Cave Spore", cat: "FLORA", arch: "carpet", tier: 3, minStage: 3, cls: "BIOME",
    pal: ["#0b0718", "#2d1a5e", "#7a4ff0", "#d9c6ff"], tags: ["spore", "cave", "violet", "glow"],
    lore: "Spores that fluoresce under their own waste heat, lighting lava tubes in a slow violet pulse. Cavers navigate by their rhythm, not their light.",
    stats: { plumeRate: 1.26, biomass: 0.48, lumenGain: 2.1, harvestYield: 1.3 }, aff: { lx: 1.45 },
    p: { freq: 9, warp: 0.05, detail: 0.55, gamma: 1.4, roughLo: 0.55, roughHi: 0.9 } },

  { id: "cyan_kelp", name: "Bioluminescent Cyan Kelp", cat: "FLORA", arch: "flow", tier: 4, minStage: 4, cls: "BIOME",
    pal: ["#021519", "#0a5a66", "#2fd3e6", "#c9fbff"], tags: ["kelp", "aquatic", "current", "cyan"],
    lore: "Fronds forty metres long that photosynthesise their own glow and pay it back at night. The forest breathes in and out with the tide, visibly.",
    stats: { plumeRate: 1.42, biomass: 0.78, aqRetention: 1.7, lumenGain: 1.65, roverGrip: 0.6 }, aff: { aq: 1.6, lx: 1.2 },
    p: { freq: 2.2, warp: 0.34, detail: 18, angle: 78, roughLo: 0.1, roughHi: 0.4 } },

  { id: "hydro_coral_lichen", name: "Hydrothermal Coral Lichen", cat: "FLORA", arch: "carpet", tier: 4, minStage: 4, cls: "BIOME",
    pal: ["#1a0708", "#6b1f24", "#d4585c", "#ffc2b0"], tags: ["lichen", "vent", "symbiote", "coral"],
    lore: "Not a coral and not a lichen — a three-way symbiosis between an alga, a fungus and a chemotroph that only works within nine metres of a vent.",
    stats: { plumeRate: 1.38, biomass: 0.7, thermalShed: 0.68, harvestYield: 1.55, aqRetention: 1.3 }, aff: { aq: 1.35, pxd: 1.15 },
    p: { freq: 7.5, warp: 0.11, detail: 0.74, gamma: 1.1, roughLo: 0.44, roughHi: 0.82 } },

  { id: "giant_crystal_stalk", name: "Giant Crystal Stalk", cat: "CRYSTAL", arch: "columnar", tier: 4, minStage: 4, cls: "MATERIAL",
    pal: ["#0d1226", "#2c3f8a", "#6e8ff0", "#dfe9ff"], tags: ["selenite", "cathedral", "landmark", "blue"],
    lore: "Selenite blades grown over ten thousand years in a flooded chamber that never cooled. They hum at 58 Hz, and so, after a while, do you.",
    stats: { plumeRate: 1.5, lumenGain: 2.3, coherenceRadius: 45, harvestYield: 1.7, roverGrip: 0.4 }, aff: { pxd: 1.5, lx: 1.4 },
    p: { freq: 3.5, jitter: 0.18, detail: 0.14, gamma: 2.1, roughLo: 0.05, roughHi: 0.2 } },

  { id: "amber_resin", name: "Amber Conifer Resin", cat: "FLORA", arch: "rock", tier: 4, minStage: 4, cls: "MATERIAL",
    pal: ["#2a1403", "#8a4a09", "#e0932c", "#ffe0a3"], tags: ["amber", "resin", "fossil", "warm"],
    lore: "Fossilised sap from a conifer analogue that has not existed for six hundred thousand years. Things are suspended inside. Some of them are still viable.",
    stats: { plumeRate: 1.24, lumenGain: 1.5, harvestYield: 1.85, biomass: 0.3, thermalShed: 0.85 }, aff: { pxd: 1.3 },
    p: { freq: 2.8, octaves: 5, jitter: 0.4, detail: 0.22, gamma: 0.85, roughLo: 0.12, roughHi: 0.4 } },

  { id: "violet_puffball", name: "Violet Spore Puffball", cat: "FLORA", arch: "carpet", tier: 3, minStage: 3, cls: "BIOME",
    pal: ["#13081e", "#49196e", "#9d44c9", "#eac4ff"], tags: ["puffball", "violet", "hazard", "spore"],
    lore: "Step on one and it answers with a cubic metre of violet spores that are harmless, persistent, and will tint your suit for a week.",
    stats: { plumeRate: 1.32, biomass: 0.52, lumenGain: 1.35, walkSpeed: 0.94, harvestYield: 1.4 }, aff: { pxd: 1.28 },
    p: { freq: 4, warp: 0.13, detail: 0.8, gamma: 0.92, roughLo: 0.58, roughHi: 0.92 } },

  { id: "brackish_slime", name: "Iridescent Brackish Slime", cat: "LIQUID", arch: "flow", tier: 3, minStage: 3, cls: "MATERIAL",
    pal: ["#0a1510", "#1c5a42", "#56c9a0", "#d6fff0"], tags: ["slime", "iridescent", "shallow", "thin-film"],
    lore: "A biofilm one micron thick doing thin-film interference across an entire tidal flat. The colours are not pigment; they are geometry.",
    stats: { plumeRate: 1.28, lumenGain: 1.75, aqRetention: 1.45, roverGrip: 0.52, biomass: 0.35 }, aff: { aq: 1.4, lx: 1.25 },
    p: { freq: 1.8, warp: 0.4, detail: 24, angle: 34, roughLo: 0.03, roughHi: 0.18 } },

  { id: "geode_amethyst", name: "Deep Geode Amethyst", cat: "CRYSTAL", arch: "crystal", tier: 4, minStage: 4, cls: "MATERIAL",
    pal: ["#120820", "#3d1670", "#8445d6", "#e0c4ff"], tags: ["amethyst", "geode", "cavity", "purple"],
    lore: "A gas bubble that spent an epoch filling itself with irradiated quartz. Breaking one open is the single most popular screenshot in the Galaxy.",
    stats: { plumeRate: 1.46, lumenGain: 1.95, harvestYield: 2.1, coherenceRadius: 20 }, aff: { pxd: 1.45, lx: 1.2 },
    p: { freq: 11, jitter: 0.86, gamma: 0.48, detail: 0.16, roughLo: 0.04, roughHi: 0.22 } },

  { id: "spore_meadow", name: "Windblown Spore Meadow", cat: "FLORA", arch: "flow", tier: 3, minStage: 3, cls: "BIOME",
    pal: ["#141a07", "#4a5c17", "#9fbf43", "#e8f5b0"], tags: ["meadow", "wind", "grass", "pollen"],
    lore: "The first thing on this planet that moves when you are not touching it. Players stop walking the first time they see the wind cross a whole valley.",
    stats: { plumeRate: 1.3, biomass: 0.66, walkSpeed: 1.1, aqRetention: 1.3, harvestYield: 1.2 }, aff: { vtx: 1.25, aq: 1.2 },
    p: { freq: 2.6, warp: 0.26, detail: 32, angle: 71, sharp: 0.38, roughLo: 0.5, roughHi: 0.88 } },

  { id: "petrified_opal_bark", name: "Petrified Opal Bark", cat: "TERRAIN", arch: "strata", tier: 4, minStage: 4, cls: "MATERIAL",
    pal: ["#1b1208", "#5c3f1d", "#b08a4e", "#f0dcb0"], tags: ["petrified", "opal", "bark", "fossil"],
    lore: "Wood that was replaced cell by cell with hydrated silica, keeping every growth ring. The opal fire sits exactly where the sap used to run.",
    stats: { plumeRate: 1.36, lumenGain: 1.6, roverGrip: 1.12, harvestYield: 1.65, coherenceRadius: 14 }, aff: { pxd: 1.32, vtx: 1.15 },
    p: { detail: 22, sharp: 0.3, angle: 88, warp: 0.07, freq: 12, roughLo: 0.2, roughHi: 0.58 } },

  { id: "glowworm_shimmer", name: "Glow-Worm Shimmer", cat: "FLORA", arch: "carpet", tier: 4, minStage: 4, cls: "BIOME",
    pal: ["#030810", "#0d2f5e", "#3f9fe8", "#cfeeff"], tags: ["glowworm", "ceiling", "cave", "constellation"],
    lore: "Larvae hanging silk lines from a cave roof, each one a blue point of light. Stand underneath and you cannot tell the ceiling from a sky.",
    stats: { plumeRate: 1.34, lumenGain: 2.4, biomass: 0.44, coherenceRadius: 26 }, aff: { lx: 1.6 },
    p: { freq: 12, warp: 0.03, detail: 0.42, gamma: 1.8, roughLo: 0.6, roughHi: 0.95 } },

  { id: "silicon_fungal_spire", name: "Silicon Fungal Spire", cat: "EXOTIC", arch: "columnar", tier: 4, minStage: 4, cls: "MATERIAL",
    pal: ["#101418", "#36424c", "#7e919e", "#d6e4ec"], tags: ["silicon", "fungus", "spire", "alien"],
    lore: "A fungus that metabolises silicates and excretes glass, building towers that are simultaneously alive and load-bearing. Nobody has decided what to call that.",
    stats: { plumeRate: 1.44, biomass: 0.56, coherenceRadius: 32, thermalShed: 1.4, harvestYield: 1.5 }, aff: { vtx: 1.4, pxd: 1.2 },
    p: { freq: 4.5, jitter: 0.46, detail: 0.36, gamma: 1.3, roughLo: 0.22, roughHi: 0.6 } },

  { id: "sulfur_moss", name: "Sulfur Moss Cushion", cat: "FLORA", arch: "carpet", tier: 3, minStage: 3, cls: "BIOME",
    pal: ["#1c1a04", "#5e5610", "#b8ab2c", "#f2e888"], tags: ["moss", "cushion", "sulfur", "pioneer"],
    lore: "The first photosynthesiser to tolerate vent chemistry, growing in dense cushions that hold water like a sponge. A pioneer species in the proper sense.",
    stats: { plumeRate: 1.22, biomass: 0.58, aqRetention: 1.9, walkSpeed: 0.96, roverGrip: 1.15 }, aff: { aq: 1.4 },
    p: { freq: 7, warp: 0.1, detail: 0.78, gamma: 1.3, roughLo: 0.62, roughHi: 0.95 } },

  { id: "thermal_vent_reed", name: "Thermal Vent Reed", cat: "FLORA", arch: "flow", tier: 4, minStage: 4, cls: "BIOME",
    pal: ["#140a06", "#5c2a12", "#c06434", "#ffcfa0"], tags: ["reed", "vent", "thermal", "orange"],
    lore: "Hollow stems that vent superheated steam from their tips, whistling on a scale nobody wrote. Tune a field of them and the whole valley plays.",
    stats: { plumeRate: 1.48, biomass: 0.6, thermalShed: 0.6, aqRetention: 1.5, lumenGain: 1.3 }, aff: { aq: 1.45, lx: 1.15 },
    p: { freq: 3.2, warp: 0.2, detail: 40, angle: 92, sharp: 0.52, roughLo: 0.4, roughHi: 0.78 } },
];

/* ══════════ TIER 5–6 · LUSH LIVING BIOSPHERE & EXOTIC CIVILISATIONS ═════ */

const T56: Spec[] = [
  { id: "emerald_canopy", name: "Emerald Canopy Jungle", cat: "FLORA", arch: "canopy", tier: 5, minStage: 5, cls: "BIOME",
    pal: ["#041208", "#124a1e", "#39a648", "#b7e88a"], tags: ["jungle", "canopy", "humid", "signature"],
    lore: "Three storeys of competing photosynthesis, each stealing light from the one below. The understorey has given up on light entirely and eats the fallen.",
    stats: { plumeRate: 1.62, biomass: 1.0, aqRetention: 2.1, walkSpeed: 0.88, harvestYield: 1.6, coherenceRadius: 30 }, aff: { aq: 1.5, vtx: 1.3, pxd: 1.2 },
    p: { freq: 3.4, warp: 0.12, detail: 0.62, roughLo: 0.45, roughHi: 0.82 } },

  { id: "coral_atoll", name: "Bioluminescent Coral Atoll", cat: "LIQUID", arch: "carpet", tier: 5, minStage: 5, cls: "BIOME",
    pal: ["#02101c", "#0d4a7a", "#3fb8e0", "#ffd9a0"], tags: ["coral", "atoll", "reef", "shallow"],
    lore: "A ring of calcium carbonate built by a trillion animals over a drowned volcano, each polyp glowing a slightly different note of the same chord.",
    stats: { plumeRate: 1.7, biomass: 0.94, aqRetention: 2.4, lumenGain: 2.0, harvestYield: 1.9, roverGrip: 0.55 }, aff: { aq: 1.8, lx: 1.3 },
    p: { freq: 6, warp: 0.09, detail: 0.72, gamma: 1.05, roughLo: 0.25, roughHi: 0.68 } },

  { id: "prismata_grass", name: "Prismatic Prismata Grass", cat: "FLORA", arch: "flow", tier: 5, minStage: 5, cls: "BIOME",
    pal: ["#0a1405", "#2f6a16", "#7fd43c", "#e6ffb0"], tags: ["grass", "prismatic", "diffraction", "hero"],
    lore: "Each blade carries a diffraction grating down its spine, so a field of it throws a different rainbow at every sun angle. Entirely pointless. Utterly worth it.",
    stats: { plumeRate: 1.66, biomass: 0.88, lumenGain: 2.25, walkSpeed: 1.12, aqRetention: 1.6 }, aff: { lx: 1.55, pxd: 1.35 },
    p: { freq: 2.4, warp: 0.3, detail: 46, angle: 74, sharp: 0.45, roughLo: 0.3, roughHi: 0.7 } },

  { id: "celestial_orchid", name: "Celestial Orchid Vine", cat: "FLORA", arch: "canopy", tier: 6, minStage: 6, cls: "BIOME",
    pal: ["#140a1e", "#4a1e6e", "#b45cd6", "#ffd6f5"], tags: ["orchid", "vine", "epiphyte", "legendary"],
    lore: "An epiphyte that flowers only during an eclipse, which on this world is a scheduled event. Entire expeditions are planned around a ninety-second bloom.",
    stats: { plumeRate: 1.88, biomass: 0.82, lumenGain: 2.4, harvestYield: 2.6, coherenceRadius: 38, fiTrickle: 140 }, aff: { pxd: 1.6, lx: 1.45 },
    p: { freq: 5, warp: 0.16, detail: 0.68, gamma: 0.95, roughLo: 0.3, roughHi: 0.72 } },

  { id: "liquid_neon_shore", name: "Liquid Neon Shoreline", cat: "LIQUID", arch: "flow", tier: 6, minStage: 6, cls: "MATERIAL",
    pal: ["#02060e", "#0a3a6e", "#2fe0ff", "#eafcff"], tags: ["neon", "shore", "emissive", "signature"],
    lore: "Dinoflagellate analogues that fire on mechanical shock, so every wave writes its own outline in cyan light. The tide line is legible from orbit.",
    stats: { plumeRate: 1.92, lumenGain: 3.0, aqRetention: 2.0, biomass: 0.64, roverGrip: 0.48 }, aff: { lx: 1.8, aq: 1.6 },
    p: { freq: 1.6, warp: 0.44, detail: 20, angle: 16, roughLo: 0.02, roughHi: 0.14 } },

  { id: "runic_granite", name: "Ancient Runic Granite", cat: "STRUCTURE", arch: "tile", tier: 6, minStage: 6, cls: "MATERIAL",
    pal: ["#121014", "#3e3942", "#7d7585", "#e8dff0"], tags: ["runic", "ancient", "glyph", "precursor"],
    lore: "Granite incised with a glyph system that predates the facility by an amount nobody will put a number on. The glyphs are load-bearing. We checked.",
    stats: { plumeRate: 1.74, coherenceRadius: 60, roverGrip: 1.22, thermalShed: 1.5, fiTrickle: 95 }, aff: { vtx: 1.5, pxd: 1.3 },
    p: { detail: 10, jitter: 0.05, sharp: 0.4, freq: 22, roughLo: 0.3, roughHi: 0.72 } },

  { id: "red_mangrove", name: "Alien Red Mangrove", cat: "FLORA", arch: "canopy", tier: 5, minStage: 5, cls: "BIOME",
    pal: ["#1a0506", "#5e1216", "#c0423a", "#ffb49a"], tags: ["mangrove", "brackish", "stilt", "nursery"],
    lore: "Stilt roots that filter brine and aerate mud, creating the single most productive nursery habitat on any terraformed world. Build your docks elsewhere.",
    stats: { plumeRate: 1.6, biomass: 0.96, aqRetention: 2.6, walkSpeed: 0.82, harvestYield: 1.75 }, aff: { aq: 1.75, vtx: 1.2 },
    p: { freq: 2.8, warp: 0.14, detail: 0.66, gamma: 1.2, roughLo: 0.48, roughHi: 0.86 } },

  { id: "aurora_lichen", name: "Aurora Lichen Canopy", cat: "FLORA", arch: "carpet", tier: 6, minStage: 6, cls: "BIOME",
    pal: ["#030e14", "#0e4a52", "#36d6b0", "#d8fff0"], tags: ["lichen", "aurora", "magnetic", "polar"],
    lore: "Lichen that aligns to the magnetic field and fluoresces when the field is disturbed. During a solar flare the entire polar canopy ripples green.",
    stats: { plumeRate: 1.78, lumenGain: 2.8, biomass: 0.72, coherenceRadius: 42, thermalShed: 1.3 }, aff: { lx: 1.7, vtx: 1.2 },
    p: { freq: 6.5, warp: 0.12, detail: 0.6, gamma: 1.5, roughLo: 0.42, roughHi: 0.84 } },

  { id: "pearl_coral", name: "Subsurface Pearl Coral", cat: "LIQUID", arch: "crystal", tier: 6, minStage: 6, cls: "BIOME",
    pal: ["#0b1218", "#3a4a5e", "#9fb4c6", "#fff6ea"], tags: ["pearl", "nacre", "deep", "iridescent"],
    lore: "Nacre laid down in aragonite platelets exactly 400 nm thick — which is to say, deliberately tuned to visible light. Something decided that.",
    stats: { plumeRate: 1.84, lumenGain: 2.55, harvestYield: 2.8, aqRetention: 1.8, coherenceRadius: 24 }, aff: { pxd: 1.65, aq: 1.4 },
    p: { freq: 8, jitter: 0.68, gamma: 0.7, detail: 0.12, roughLo: 0.03, roughHi: 0.18 } },

  { id: "obsidian_garden", name: "Volcanic Obsidian Garden", cat: "EXOTIC", arch: "columnar", tier: 5, minStage: 5, cls: "BIOME",
    pal: ["#060509", "#1f1726", "#4e3a60", "#b49fd0"], tags: ["obsidian", "garden", "sculptural", "dark"],
    lore: "Where a lava field met a crystal bloom and neither won. Black glass spires wrapped in violet growth, maintained by nothing and perfect anyway.",
    stats: { plumeRate: 1.68, lumenGain: 1.9, biomass: 0.5, coherenceRadius: 36, thermalShed: 1.45, roverGrip: 0.5 }, aff: { vtx: 1.45, lx: 1.3 },
    p: { freq: 4.2, jitter: 0.38, detail: 0.3, gamma: 1.5, roughLo: 0.08, roughHi: 0.38 } },

  { id: "gilded_basalt_terrace", name: "Gilded Basalt Terrace", cat: "STRUCTURE", arch: "strata", tier: 6, minStage: 6, cls: "MATERIAL",
    pal: ["#0d0b08", "#3e3118", "#9c7a2e", "#f0d68c"], tags: ["gilded", "terrace", "agriculture", "gold"],
    lore: "Terraces cut into a basalt flank and veined with native gold by a hydrothermal accident. Somebody farmed here. The terraces are still level.",
    stats: { plumeRate: 1.8, lumenGain: 2.2, roverGrip: 1.3, harvestYield: 2.0, coherenceRadius: 48, fiTrickle: 110 }, aff: { lx: 1.5, pxd: 1.4 },
    p: { detail: 7, sharp: 0.78, angle: 4, warp: 0.04, freq: 9, roughLo: 0.16, roughHi: 0.54 } },

  { id: "chrono_kelp", name: "Chrono-Kelp Current", cat: "EXOTIC", arch: "flow", tier: 6, minStage: 6, cls: "BIOME",
    pal: ["#06111c", "#164a74", "#44b6e0", "#e0f8ff"], tags: ["chrono", "kelp", "temporal", "legendary"],
    lore: "Kelp whose fronds lag the current by between four and nine seconds, for reasons the Fusion Matrix refuses to speculate about. Swim through it slowly.",
    stats: { plumeRate: 2.0, biomass: 0.86, aqRetention: 2.2, lumenGain: 2.1, fiTrickle: 180, walkSpeed: 0.9 }, aff: { aq: 1.9, vtx: 1.4 },
    p: { freq: 1.4, warp: 0.5, detail: 26, angle: 52, roughLo: 0.06, roughHi: 0.3 } },

  { id: "aether_spore_forest", name: "Aether Spore Forest", cat: "EXOTIC", arch: "canopy", tier: 6, minStage: 6, cls: "BIOME",
    pal: ["#0a0618", "#2e1a5e", "#7a52d6", "#ded0ff"], tags: ["aether", "spore", "floating", "legendary"],
    lore: "Fruiting bodies buoyant enough to hang two metres off the ground, tethered by a single hypha. Walking through is like parting a crowd that forgives you.",
    stats: { plumeRate: 1.96, biomass: 0.9, lumenGain: 2.6, coherenceRadius: 52, harvestYield: 2.3, fiTrickle: 165 }, aff: { pxd: 1.7, lx: 1.5 },
    p: { freq: 4, warp: 0.2, detail: 0.7, gamma: 1.1, roughLo: 0.35, roughHi: 0.75 } },

  { id: "lapis_steppe", name: "Lapis Lazuli Steppe", cat: "TERRAIN", arch: "rock", tier: 5, minStage: 5, cls: "MATERIAL",
    pal: ["#060b1e", "#163068", "#3a62c6", "#b8cdff"], tags: ["lapis", "steppe", "blue", "pyrite-fleck"],
    lore: "Lazurite bedrock flecked with pyrite, so the whole plateau reads as a night sky seen from underneath. Caravans navigate by the flecks.",
    stats: { plumeRate: 1.58, lumenGain: 1.85, roverGrip: 1.18, coherenceRadius: 28, harvestYield: 1.7 }, aff: { pxd: 1.5, lx: 1.2 },
    p: { freq: 4.8, octaves: 6, jitter: 0.72, detail: 0.3, roughLo: 0.36, roughHi: 0.76 } },

  { id: "solar_fern_glade", name: "Solar Fern Glade", cat: "FLORA", arch: "canopy", tier: 5, minStage: 5, cls: "BIOME",
    pal: ["#141004", "#52470e", "#b8a032", "#f6eaa8"], tags: ["fern", "glade", "solar", "tracking"],
    lore: "Fronds that track the sun on a hydraulic hinge and close at dusk with an audible sigh. Build a solar collector in a glade and it will be out-performed.",
    stats: { plumeRate: 1.64, biomass: 0.8, lumenGain: 2.45, aqRetention: 1.5, walkSpeed: 1.06 }, aff: { lx: 1.65, aq: 1.2 },
    p: { freq: 3.8, warp: 0.1, detail: 0.6, gamma: 1.25, roughLo: 0.44, roughHi: 0.84 } },
];

/* ═════════════════ ARCHITECTURAL, INDUSTRIAL & ROAD CARTRIDGES ══════════ */

const ARCHI: Spec[] = [
  { id: "cobblestone_highway", name: "Carved Cobblestone Highway", cat: "ROAD", arch: "strata", tier: 3, minStage: 3, cls: "MATERIAL",
    pal: ["#140f0b", "#443529", "#7d6a56", "#c0ad94"], tags: ["road", "cobble", "transport", "classic"],
    lore: "Compacted silt projected along a spline and baked by a passing Lumen Mast. The first road anyone builds, and the one they keep.",
    stats: { plumeRate: 1.1, roverGrip: 1.55, walkSpeed: 1.28, coherenceRadius: 20 }, aff: { vtx: 1.3 },
    p: { detail: 13, sharp: 0.82, angle: 0, warp: 0.028, freq: 8, roughLo: 0.5, roughHi: 0.86 } },

  { id: "maglev_rail", name: "Mag-Lev Superconductor Rail", cat: "ROAD", arch: "strata", tier: 6, minStage: 6, cls: "MATERIAL",
    pal: ["#05070e", "#16294a", "#3f7ad0", "#d6e8ff"], tags: ["maglev", "rail", "superconductor", "fast"],
    lore: "A YBCO ribbon pinned above a magnetite bed. Frictionless, silent, and it only works on the one mineral your compass hates.",
    stats: { plumeRate: 1.3, roverGrip: 2.4, walkSpeed: 1.9, lumenGain: 1.4, coherenceRadius: 55, thermalShed: 1.9 }, aff: { vtx: 1.6, lx: 1.3 },
    p: { detail: 5, sharp: 0.95, angle: 0, warp: 0.006, freq: 24, roughLo: 0.04, roughHi: 0.2 } },

  { id: "pneumatic_deck", name: "Pneumatic Habitat Deck", cat: "STRUCTURE", arch: "tile", tier: 5, minStage: 5, cls: "MATERIAL",
    pal: ["#0e1114", "#2e3942", "#63747f", "#cdd9e0"], tags: ["habitat", "deck", "modular", "industrial"],
    lore: "Extruded decking with integrated pressure channels, rated for eight atmospheres and forty years. The flooring of every base anybody is proud of.",
    stats: { plumeRate: 1.2, roverGrip: 1.45, walkSpeed: 1.2, coherenceRadius: 34, thermalShed: 1.55 }, aff: { vtx: 1.4 },
    p: { detail: 6, jitter: 0.04, sharp: 0.5, freq: 20, roughLo: 0.28, roughHi: 0.6 } },

  { id: "hex_paver", name: "Hexagonal Basalt Paver", cat: "ROAD", arch: "tile", tier: 4, minStage: 4, cls: "MATERIAL",
    pal: ["#0c0d10", "#282c33", "#4e545e", "#8e96a2"], tags: ["paver", "hex", "basalt", "plaza"],
    lore: "Columnar basalt sliced into discs and laid flat, which is what the rock wanted to be anyway. Zero waste, perfect tessellation, mildly smug.",
    stats: { plumeRate: 1.14, roverGrip: 1.5, walkSpeed: 1.24, coherenceRadius: 26, thermalShed: 1.3 }, aff: { vtx: 1.35 },
    p: { detail: 9, jitter: 0.1, sharp: 0.34, freq: 16, roughLo: 0.4, roughHi: 0.74 } },

  { id: "glowstone_path", name: "Glowstone Beacon Path", cat: "ROAD", arch: "tile", tier: 5, minStage: 5, cls: "MATERIAL",
    pal: ["#120e04", "#4e3c08", "#c9a020", "#fff2b0"], tags: ["glowstone", "path", "beacon", "night"],
    lore: "Paving with crushed Photon Salt in the grout, so the joints charge by day and outline the route all night. Nobody has ever got lost on one.",
    stats: { plumeRate: 1.26, roverGrip: 1.42, walkSpeed: 1.26, lumenGain: 2.1, coherenceRadius: 48 }, aff: { lx: 1.7 },
    p: { detail: 8, jitter: 0.12, sharp: 0.6, freq: 14, roughLo: 0.3, roughHi: 0.66 } },

  { id: "heat_shield_tile", name: "Ceramic Heat Shield Tile", cat: "STRUCTURE", arch: "tile", tier: 5, minStage: 5, cls: "MATERIAL",
    pal: ["#141211", "#3b332e", "#6e635a", "#d8cec0"], tags: ["ceramic", "ablative", "shield", "industrial"],
    lore: "Silica fibre at 94% void, able to hold one face at 1200 °C while the other is cool enough to touch. Build your fission pile on this or do not build it.",
    stats: { plumeRate: 1.16, thermalShed: 3.0, roverGrip: 1.2, coherenceRadius: 18 }, aff: { vtx: 1.25 },
    p: { detail: 7, jitter: 0.06, sharp: 0.26, freq: 26, roughLo: 0.62, roughHi: 0.92 } },

  { id: "archway_pylon", name: "Monolithic Archway Pylon", cat: "STRUCTURE", arch: "columnar", tier: 6, minStage: 6, cls: "MATERIAL",
    pal: ["#0a0a0d", "#242430", "#4a4a5c", "#9c9cb4"], tags: ["pylon", "monolith", "portal", "legendary"],
    lore: "The structural grammar of the original arch, reverse-engineered and scaled. Place two and the bandwidth between them is yours to spend.",
    stats: { plumeRate: 1.5, coherenceRadius: 90, roverGrip: 1.1, fiTrickle: 220, thermalShed: 1.4 }, aff: { vtx: 1.7, pxd: 1.3 },
    p: { freq: 3, jitter: 0.12, detail: 0.18, gamma: 1.9, roughLo: 0.24, roughHi: 0.6 } },

  { id: "vault_plinth", name: "Subterranean Vault Plinth", cat: "STRUCTURE", arch: "tile", tier: 6, minStage: 6, cls: "MATERIAL",
    pal: ["#07070a", "#1c1c26", "#3c3c50", "#8484a0"], tags: ["vault", "plinth", "precursor", "deep"],
    lore: "Found, not built. Every vault on the planet sits on the same plinth pattern, which means the pattern is older than the vaults.",
    stats: { plumeRate: 1.42, coherenceRadius: 70, thermalShed: 1.6, fiTrickle: 150, roverGrip: 1.26 }, aff: { vtx: 1.55, pxd: 1.25 },
    p: { detail: 4, jitter: 0.02, sharp: 0.7, freq: 30, roughLo: 0.2, roughHi: 0.52 } },

  { id: "solar_absorb_grid", name: "Solar Absorb Grid", cat: "STRUCTURE", arch: "tile", tier: 5, minStage: 5, cls: "MATERIAL",
    pal: ["#04050a", "#101c3a", "#28487e", "#6a94d8"], tags: ["solar", "grid", "power", "industrial"],
    lore: "A sub-wavelength absorber structure that reflects 0.3% of anything that lands on it. Standing on it in daylight is genuinely unpleasant.",
    stats: { plumeRate: 1.34, lumenGain: 2.9, thermalShed: 0.55, roverGrip: 1.08, coherenceRadius: 22 }, aff: { lx: 1.9 },
    p: { detail: 18, jitter: 0.03, sharp: 0.85, freq: 36, roughLo: 0.66, roughHi: 0.96 } },

  { id: "prism_road", name: "Reflective Prism Road", cat: "ROAD", arch: "tile", tier: 6, minStage: 6, cls: "MATERIAL",
    pal: ["#07070c", "#2a1c4a", "#6e48c0", "#f0dcff"], tags: ["prism", "road", "refraction", "legendary"],
    lore: "Retroreflective corner-cube paving that throws every headlight straight back at its source. A convoy at night looks like it is driving on a star field.",
    stats: { plumeRate: 1.46, roverGrip: 1.68, walkSpeed: 1.42, lumenGain: 2.7, coherenceRadius: 44, fiTrickle: 100 }, aff: { lx: 1.8, pxd: 1.5 },
    p: { detail: 12, jitter: 0.0, sharp: 0.9, freq: 28, roughLo: 0.02, roughHi: 0.16 } },
];

/* ──────────────────────────────────────────────────────────── exports ── */

export const VAULT: VaultCartridge[] = [...T12, ...T34, ...T56, ...ARCHI].map(build);
export const VAULT_BY_ID = new Map(VAULT.map((c) => [c.id, c]));

export const CATEGORIES: VaultCategory[] = [
  "TERRAIN", "FLORA", "LIQUID", "CRYSTAL", "ROAD", "STRUCTURE", "EXOTIC",
];

export const STAT_LABELS: Record<keyof GameplayStats, { label: string; unit: string; good: "high" | "low" }> = {
  plumeRate: { label: "Plume Rate", unit: "×", good: "high" },
  roverGrip: { label: "Rover Grip", unit: "×", good: "high" },
  coherenceRadius: { label: "Coherence", unit: " m", good: "high" },
  walkSpeed: { label: "Walk Speed", unit: "×", good: "high" },
  harvestYield: { label: "Harvest", unit: "×", good: "high" },
  thermalShed: { label: "Cooling", unit: "×", good: "high" },
  lumenGain: { label: "Lumen Gain", unit: "×", good: "high" },
  aqRetention: { label: "Aq Retention", unit: "×", good: "high" },
  biomass: { label: "Biomass", unit: "", good: "high" },
  fiTrickle: { label: "Fi Trickle", unit: "/s", good: "high" },
};

export const VAULT_STATS = {
  total: VAULT.length,
  byCategory: CATEGORIES.map((c) => ({ c, n: VAULT.filter((x) => x.category === c).length })),
  byTier: [1, 2, 3, 4, 5, 6].map((t) => ({ t, n: VAULT.filter((x) => x.tier === t).length })),
  totalNodes: VAULT.reduce((a, c) => a + c.graph.nodes.length, 0),
  totalVars: VAULT.reduce((a, c) => a + c.vars.length, 0),
  archetypes: Object.keys(ARCH).length,
};
