/* ============================================================================
   @hm/setmix-library — starter cartridges.
   Every one is a REAL TexGraph that @hm/texgraph can evaluate right now.
   Every parameter is a real VarDecl → the Synthesizer UI is generated,
   never hand-built (kernel principle 2).
   ========================================================================== */

import type { TexGraph } from "@/engine/texgraph";
import { contentHash, type Cartridge, type CartClass, type VarDecl } from "./core";

type Seed = {
  id: string;
  name: string;
  cls: CartClass;
  minStage: Cartridge["minStage"];
  tint: string;
  affinity: Cartridge["affinity"];
  graph: Omit<TexGraph, "id" | "name">;
  vars: VarDecl[];
  blurb: string;
};

const V = (
  path: string,
  label: string,
  real: string,
  unit: string,
  min: number,
  max: number,
  step: number,
  def: number,
  explain: string,
  tier: 1 | 2 | 3,
): VarDecl => ({ path, label, real, unit, min, max, step, def, explain, tier });

export const BLURBS: Record<string, string> = {};

const SEEDS: Seed[] = [
  {
    id: "moon_regolith",
    name: "Moon Regolith",
    cls: "MATERIAL",
    minStage: 1,
    tint: "#8b8f98",
    affinity: {},
    blurb: "The default surface of a dead world. Two octaves, four colours, no opinions.",
    graph: {
      nodes: [
        { id: "noise", type: "noise", freq: 5, octaves: 4, gain: 0.52, lacunarity: 2.1, seed: 3 },
        { id: "dust", type: "grain", scale: 2, seed: 11 },
        { id: "mix", type: "blend", a: "noise", b: "dust", mode: "mix", factor: 0.14 },
        { id: "h", type: "levels", input: "mix", inLow: 0.18, inHigh: 0.86, gamma: 1.1 },
        {
          id: "alb",
          type: "ramp",
          input: "h",
          stops: [
            { t: 0, color: [0.17, 0.18, 0.21] },
            { t: 0.42, color: [0.29, 0.31, 0.36] },
            { t: 0.74, color: [0.43, 0.46, 0.51] },
            { t: 1, color: [0.6, 0.64, 0.69] },
          ],
        },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: 0.78, outHigh: 0.96 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
    },
    vars: [
      V("noise.freq", "Coarseness", "base frequency", "cyc/tile", 1, 24, 0.5, 5, "How many bumps fit across one tile.", 1),
      V("noise.octaves", "Grain Depth", "fBm octaves", "octaves", 1, 8, 1, 4, "How many times the detail halves and repeats.", 2),
      V("noise.gain", "Falloff", "fBm gain / persistence", "×", 0.2, 0.8, 0.01, 0.52, "How quickly finer detail fades out.", 3),
      V("mix.factor", "Dustiness", "blend factor", "—", 0, 1, 0.01, 0.14, "How much loose white-noise grit sits on top.", 1),
    ],
  },
  {
    id: "chromatic_crystal",
    name: "Chromatic Crystal",
    cls: "MATERIAL",
    minStage: 1,
    tint: "#ff3d8a",
    affinity: { pxd: 1.65 },
    blurb: "The only saturated colour on the moon. Worley cells → the first palette you ever own.",
    graph: {
      nodes: [
        { id: "cell", type: "cellular", freq: 7, jitter: 0.9, invert: 1, seed: 5 },
        { id: "sharp", type: "levels", input: "cell", inLow: 0.42, inHigh: 0.95, gamma: 0.7 },
        { id: "fine", type: "noise", freq: 22, octaves: 2, seed: 9 },
        { id: "mix", type: "blend", a: "sharp", b: "fine", mode: "add", factor: 0.1 },
        {
          id: "alb",
          type: "ramp",
          input: "mix",
          stops: [
            { t: 0, color: [0.1, 0.03, 0.12] },
            { t: 0.45, color: [0.62, 0.08, 0.36] },
            { t: 0.8, color: [1.0, 0.24, 0.54] },
            { t: 1, color: [1.0, 0.76, 0.9] },
          ],
        },
        { id: "rgh", type: "levels", input: "mix", inLow: 0, inHigh: 1, outLow: 0.08, outHigh: 0.4 },
      ],
      out: { albedo: "alb", height: "mix", roughness: "rgh" },
    },
    vars: [
      V("cell.freq", "Facet Count", "Worley cell frequency", "cells/tile", 2, 24, 1, 7, "How many crystal faces fit across the tile.", 1),
      V("cell.jitter", "Irregularity", "cell point jitter", "—", 0, 1, 0.01, 0.9, "Perfect lattice at 0, shattered geode at 1.", 2),
      V("sharp.gamma", "Edge Bite", "gamma correction", "γ", 0.3, 2.5, 0.05, 0.7, "How hard the facet edges cut.", 3),
    ],
  },
  {
    id: "grass_handpainted",
    name: "Hand-Painted Grass",
    cls: "MATERIAL",
    minStage: 5,
    tint: "#86c954",
    affinity: { aq: 1.2, vtx: 1.1 },
    blurb: "Stroke direction from stripes, clumping from Worley. The Stage-5 signature.",
    graph: {
      nodes: [
        { id: "blades", type: "stripes", freq: 46, angle: 74, sharpness: 0.45 },
        { id: "clump", type: "cellular", freq: 5, jitter: 1, seed: 21 },
        { id: "breakup", type: "noise", freq: 9, octaves: 4, seed: 4 },
        { id: "w", type: "warp", input: "blades", by: "breakup", amount: 0.055 },
        { id: "mix", type: "blend", a: "w", b: "clump", mode: "mul", factor: 0.72 },
        { id: "h", type: "levels", input: "mix", inLow: 0.08, inHigh: 0.9, gamma: 1.25 },
        {
          id: "alb",
          type: "ramp",
          input: "h",
          stops: [
            { t: 0, color: [0.05, 0.14, 0.06] },
            { t: 0.38, color: [0.15, 0.35, 0.12] },
            { t: 0.72, color: [0.37, 0.6, 0.21] },
            { t: 1, color: [0.72, 0.82, 0.38] },
          ],
        },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: 0.52, outHigh: 0.88 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
    },
    vars: [
      V("blades.freq", "Blade Density", "stripe frequency", "blades/tile", 8, 90, 1, 46, "How many blades the shader paints per tile.", 1),
      V("blades.angle", "Lay Direction", "stripe angle", "°", 0, 180, 1, 74, "Which way the grass has been combed.", 1),
      V("w.amount", "Scruffiness", "domain warp amount", "uv", 0, 0.25, 0.005, 0.055, "Bends the blades so they stop looking printed.", 2),
      V("clump.freq", "Clumping", "Worley frequency", "clumps/tile", 2, 14, 1, 5, "How tightly the tufts gather.", 2),
    ],
  },
  {
    id: "columnar_basalt",
    name: "Columnar Basalt",
    cls: "MATERIAL",
    minStage: 3,
    tint: "#7d7fa8",
    affinity: { vtx: 1.45 },
    blurb: "Low-jitter Worley gives the hexagonal cooling joints. Giant's Causeway from eight nodes.",
    graph: {
      nodes: [
        { id: "cols", type: "cellular", freq: 6, jitter: 0.35, seed: 13 },
        { id: "joint", type: "levels", input: "cols", inLow: 0.0, inHigh: 0.3, gamma: 1.6 },
        { id: "rock", type: "noise", freq: 26, octaves: 5, gain: 0.46, seed: 2 },
        { id: "h", type: "blend", a: "joint", b: "rock", mode: "mix", factor: 0.26 },
        {
          id: "alb",
          type: "ramp",
          input: "h",
          stops: [
            { t: 0, color: [0.04, 0.04, 0.06] },
            { t: 0.5, color: [0.17, 0.17, 0.22] },
            { t: 0.85, color: [0.33, 0.33, 0.39] },
            { t: 1, color: [0.52, 0.52, 0.58] },
          ],
        },
        { id: "rgh", type: "levels", input: "rock", inLow: 0, inHigh: 1, outLow: 0.62, outHigh: 0.94 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
    },
    vars: [
      V("cols.freq", "Column Width", "Worley frequency", "cols/tile", 2, 18, 1, 6, "Thick pillars at 2, pencil basalt at 18.", 1),
      V("cols.jitter", "Regularity", "cell jitter", "—", 0, 1, 0.01, 0.35, "Low values give the hexagonal cooling joints.", 2),
      V("h.factor", "Rock Noise", "blend factor", "—", 0, 1, 0.01, 0.26, "How much surface roughness breaks the columns.", 2),
    ],
  },
  {
    id: "rust_oxide",
    name: "Rust / Oxide Triplanar",
    cls: "MATERIAL",
    minStage: 2,
    tint: "#a35c35",
    affinity: { pxd: 1.15 },
    blurb: "Bloom-edged corrosion. The parent of the Patina Aging Rule.",
    graph: {
      nodes: [
        { id: "base", type: "noise", freq: 6, octaves: 5, gain: 0.58, seed: 31 },
        { id: "pit", type: "cellular", freq: 14, jitter: 1, invert: 1, seed: 7 },
        { id: "warped", type: "warp", input: "base", by: "pit", amount: 0.08 },
        { id: "h", type: "levels", input: "warped", inLow: 0.22, inHigh: 0.84, gamma: 0.95 },
        {
          id: "alb",
          type: "ramp",
          input: "h",
          stops: [
            { t: 0, color: [0.12, 0.07, 0.05] },
            { t: 0.4, color: [0.42, 0.18, 0.07] },
            { t: 0.72, color: [0.71, 0.36, 0.14] },
            { t: 1, color: [0.88, 0.63, 0.36] },
          ],
        },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: 0.68, outHigh: 1.0 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
    },
    vars: [
      V("base.freq", "Patch Scale", "base frequency", "cyc/tile", 1, 20, 0.5, 6, "Size of the corrosion blooms.", 1),
      V("warped.amount", "Creep", "domain warp amount", "uv", 0, 0.3, 0.005, 0.08, "How much the rust eats sideways into clean metal.", 2),
      V("pit.freq", "Pitting", "Worley frequency", "pits/tile", 4, 40, 1, 14, "Density of the little corrosion pits.", 2),
    ],
  },
  {
    id: "caustic_water",
    name: "Caustic Water",
    cls: "MATERIAL",
    minStage: 4,
    tint: "#3dc8ff",
    affinity: { aq: 1.7, lx: 1.2 },
    blurb: "Two crossed wave trains warped by each other. Real caustics are just interference.",
    graph: {
      nodes: [
        { id: "w1", type: "stripes", freq: 9, angle: 22, sharpness: 0 },
        { id: "w2", type: "stripes", freq: 13, angle: 104, sharpness: 0 },
        { id: "swell", type: "noise", freq: 3, octaves: 3, seed: 17 },
        { id: "x1", type: "warp", input: "w1", by: "swell", amount: 0.12 },
        { id: "x2", type: "warp", input: "w2", by: "swell", amount: 0.09 },
        { id: "inter", type: "blend", a: "x1", b: "x2", mode: "mul", factor: 1 },
        { id: "caustic", type: "levels", input: "inter", inLow: 0.46, inHigh: 1, gamma: 0.45 },
        {
          id: "alb",
          type: "ramp",
          input: "caustic",
          stops: [
            { t: 0, color: [0.02, 0.12, 0.22] },
            { t: 0.5, color: [0.06, 0.4, 0.6] },
            { t: 0.84, color: [0.3, 0.76, 0.92] },
            { t: 1, color: [0.88, 0.99, 1.0] },
          ],
        },
        { id: "rgh", type: "levels", input: "caustic", inLow: 0, inHigh: 1, outLow: 0.02, outHigh: 0.14 },
      ],
      out: { albedo: "alb", height: "caustic", roughness: "rgh" },
    },
    vars: [
      V("w1.freq", "Wave Train A", "stripe frequency", "waves/tile", 2, 30, 1, 9, "Spacing of the first wave set.", 1),
      V("w2.freq", "Wave Train B", "stripe frequency", "waves/tile", 2, 30, 1, 13, "Spacing of the crossing wave set.", 1),
      V("caustic.gamma", "Focus", "gamma correction", "γ", 0.2, 2, 0.05, 0.45, "How tightly the light pinches into bright veins.", 2),
      V("x1.amount", "Swell", "domain warp amount", "uv", 0, 0.3, 0.005, 0.12, "Low-frequency ocean motion under the ripples.", 2),
    ],
  },
  {
    id: "mud_clay",
    name: "Mud / Clay",
    cls: "MATERIAL",
    minStage: 2,
    tint: "#c98a5b",
    affinity: { aq: 1.1 },
    blurb: "Soft, wet, compactable. The parent of every road in the game.",
    graph: {
      nodes: [
        { id: "soft", type: "noise", freq: 4, octaves: 5, gain: 0.62, seed: 44 },
        { id: "crack", type: "cellular", freq: 9, jitter: 0.85, seed: 8 },
        { id: "h", type: "blend", a: "soft", b: "crack", mode: "min", factor: 0.35 },
        {
          id: "alb",
          type: "ramp",
          input: "h",
          stops: [
            { t: 0, color: [0.13, 0.09, 0.06] },
            { t: 0.45, color: [0.33, 0.23, 0.14] },
            { t: 0.8, color: [0.55, 0.41, 0.26] },
            { t: 1, color: [0.72, 0.6, 0.44] },
          ],
        },
        { id: "rgh", type: "levels", input: "h", inLow: 0, inHigh: 1, outLow: 0.4, outHigh: 0.8 },
      ],
      out: { albedo: "alb", height: "h", roughness: "rgh" },
    },
    vars: [
      V("soft.freq", "Lumpiness", "base frequency", "cyc/tile", 1, 16, 0.5, 4, "Scale of the soft mounds.", 1),
      V("crack.freq", "Crazing", "Worley frequency", "cells/tile", 2, 26, 1, 9, "Dried-mud crack density.", 2),
      V("h.factor", "Dryness", "blend factor", "—", 0, 1, 0.01, 0.35, "Pushes the cracks through the wet surface.", 1),
    ],
  },

  /* ───────────────────────────── OPERATORS (VERBS) ───────────────────── */
  {
    id: "linear_strata",
    name: "Linear Strata Tool",
    cls: "OPERATOR",
    minStage: 2,
    tint: "#7cff4d",
    affinity: { vtx: 1.3 },
    blurb: "Projects a 1-D repeating pattern along an axis. Feed it mud and you get a road.",
    graph: {
      nodes: [
        { id: "bands", type: "stripes", freq: 11, angle: 0, sharpness: 0.75 },
        { id: "jit", type: "noise", freq: 7, octaves: 2, seed: 61 },
        { id: "h", type: "warp", input: "bands", by: "jit", amount: 0.03 },
        { id: "alb", type: "ramp", input: "h", stops: [{ t: 0, color: [0.1, 0.1, 0.1] }, { t: 1, color: [0.85, 0.85, 0.85] }] },
      ],
      out: { albedo: "alb", height: "h" },
    },
    vars: [
      V("bands.freq", "Course Count", "stripe frequency", "courses/tile", 2, 40, 1, 11, "How many strata bands the tool lays down.", 1),
      V("bands.angle", "Heading", "stripe angle", "°", 0, 180, 1, 0, "Direction the strata run.", 1),
      V("bands.sharpness", "Compaction", "square-wave mix", "—", 0, 1, 0.01, 0.75, "Soft dunes at 0, cut masonry at 1.", 2),
    ],
  },
  {
    id: "wind_erosion",
    name: "Wind Erosion Field",
    cls: "OPERATOR",
    minStage: 3,
    tint: "#9fd6ff",
    affinity: { vtx: 1.25, lx: 1.05 },
    blurb: "Anisotropic subtractive operator. Stretches detail along the prevailing wind.",
    graph: {
      nodes: [
        { id: "flow", type: "noise", freq: 3, octaves: 4, gain: 0.55, seed: 77 },
        { id: "streak", type: "stripes", freq: 30, angle: 96, sharpness: 0.1 },
        { id: "h", type: "warp", input: "streak", by: "flow", amount: 0.2 },
        { id: "soft", type: "levels", input: "h", inLow: 0.12, inHigh: 0.88, gamma: 1.4 },
        { id: "alb", type: "ramp", input: "soft", stops: [{ t: 0, color: [0.12, 0.13, 0.15] }, { t: 1, color: [0.8, 0.82, 0.86] }] },
      ],
      out: { albedo: "alb", height: "soft" },
    },
    vars: [
      V("streak.angle", "Prevailing Wind", "stripe angle", "°", 0, 180, 1, 96, "The direction the weather has been coming from.", 1),
      V("h.amount", "Scour Depth", "domain warp amount", "uv", 0, 0.45, 0.01, 0.2, "How far the wind has dragged the material.", 1),
      V("soft.gamma", "Hardness Bias", "gamma correction", "γ", 0.4, 2.4, 0.05, 1.4, "Soft rock erodes first; this is that bias.", 3),
    ],
  },
  {
    id: "curl_flow",
    name: "Curl-Noise Flow Map",
    cls: "OPERATOR",
    minStage: 3,
    tint: "#b46bff",
    affinity: { aq: 1.2, vtx: 1.1 },
    blurb:
      "TRUE divergence-free curl noise (Q3). ∇⊥ψ drives a 2-channel warp, so the field is incompressible by construction — one cartridge that upgrades wind, water, fire and capes.",
    graph: {
      nodes: [
        { id: "psi", type: "noise", freq: 2.5, octaves: 4, gain: 0.55, seed: 101 },
        { id: "vec", type: "curl", potential: "psi", scale: 1.0 },
        { id: "ink", type: "stripes", freq: 14, angle: 12, sharpness: 0.2 },
        { id: "curl", type: "warp", input: "ink", vectorField: "vec", amount: 0.35 },
        { id: "h", type: "levels", input: "curl", inLow: 0.2, inHigh: 0.8, gamma: 1 },
        {
          id: "alb",
          type: "ramp",
          input: "h",
          interpolation: "smooth",
          stops: [
            { t: 0, color: [0.1, 0.02, 0.2] },
            { t: 0.5, color: [0.45, 0.2, 0.7] },
            { t: 1, color: [0.85, 0.7, 1] },
          ],
        },
      ],
      out: { albedo: "alb", height: "h" },
    },
    vars: [
      V("curl.amount", "Vorticity", "warp amount (2-ch vectorField)", "uv", 0, 0.6, 0.01, 0.35, "How hard the incompressible field swirls the dye.", 1),
      V("psi.freq", "Eddy Scale", "potential frequency", "cyc/tile", 0.5, 10, 0.25, 2.5, "Size of each vortex in the stream function.", 1),
      V("vec.scale", "Field Gain", "curl scale", "×", 0.1, 3, 0.05, 1, "Magnitude of ∇⊥ψ before it reaches the warp.", 2),
      V("ink.freq", "Dye Bands", "stripe frequency", "bands/tile", 4, 40, 1, 14, "The tracer the vortices are visibly stirring.", 2),
    ],
  },

  /* ──────────────────────────────── RULES ────────────────────────────── */
  {
    id: "altitude_mask",
    name: "Altitude Mask Rule",
    cls: "RULE",
    minStage: 3,
    tint: "#dfe9f5",
    affinity: {},
    blurb: "Does not place anything. Decides WHERE another preset is allowed to exist.",
    graph: {
      nodes: [
        { id: "grad", type: "stripes", freq: 0.5, angle: 90, sharpness: 0 },
        { id: "band", type: "levels", input: "grad", inLow: 0.55, inHigh: 0.85, gamma: 1 },
        { id: "noisy", type: "noise", freq: 12, octaves: 3, seed: 55 },
        { id: "h", type: "blend", a: "band", b: "noisy", mode: "mix", factor: 0.18 },
        { id: "alb", type: "ramp", input: "h", stops: [{ t: 0, color: [0.08, 0.1, 0.14] }, { t: 1, color: [0.97, 0.99, 1] }] },
      ],
      out: { albedo: "alb", height: "h" },
    },
    vars: [
      V("band.inLow", "Snowline", "levels input low", "norm. altitude", 0, 1, 0.01, 0.55, "Below this height the rule stops applying.", 1),
      V("band.inHigh", "Full Cover", "levels input high", "norm. altitude", 0, 1, 0.01, 0.85, "Above this height the rule applies at full strength.", 1),
      V("h.factor", "Edge Scatter", "blend factor", "—", 0, 0.6, 0.01, 0.18, "Breaks the boundary so it is not a drawn line.", 2),
    ],
  },
  {
    id: "curvature_wear",
    name: "Curvature Edge-Wear",
    cls: "RULE",
    minStage: 2,
    tint: "#e8c07a",
    affinity: { pxd: 1.1 },
    blurb: "Edge wear sells realism harder than resolution does. Applies to anything, forever.",
    graph: {
      nodes: [
        { id: "shape", type: "cellular", freq: 8, jitter: 0.7, seed: 23 },
        { id: "edges", type: "levels", input: "shape", inLow: 0.0, inHigh: 0.22, gamma: 0.8 },
        { id: "grit", type: "grain", scale: 1, seed: 88 },
        { id: "h", type: "blend", a: "edges", b: "grit", mode: "mul", factor: 0.3 },
        { id: "alb", type: "ramp", input: "h", stops: [{ t: 0, color: [0.06, 0.06, 0.07] }, { t: 1, color: [0.93, 0.88, 0.76] }] },
      ],
      out: { albedo: "alb", height: "h" },
    },
    vars: [
      V("edges.inHigh", "Wear Width", "levels input high", "—", 0.05, 0.6, 0.01, 0.22, "How far back from an edge the paint has rubbed off.", 1),
      V("h.factor", "Grit", "blend factor", "—", 0, 1, 0.01, 0.3, "Micro-scratches inside the worn band.", 2),
    ],
  },
];

function build(s: Seed): Cartridge {
  const graph: TexGraph = { id: s.id, name: s.name, nodes: s.graph.nodes, out: s.graph.out };
  const header = {
    id: s.id,
    rev: 1,
    name: s.name,
    kind: "setmix.cartridge" as const,
    parents: [] as string[],
    author: "@hm/setmix-library",
    cls: s.cls,
    graph,
    vars: s.vars,
    minStage: s.minStage,
    affinity: s.affinity,
    tint: s.tint,
  };
  BLURBS[s.id] = s.blurb;
  return { ...header, hash: contentHash(header) };
}

export const LIBRARY: Cartridge[] = SEEDS.map(build);
export const BY_ID = new Map(LIBRARY.map((c) => [c.id, c]));

/** Apply a variable override by path. Pure — returns a forked graph.
 *  Path format: "<nodeId>.<param>". This is how the kernel's variable
 *  bindings reach into a texgraph without knowing anything about texgraph. */
export function applyVars(g: TexGraph, overrides: Record<string, number>): TexGraph {
  if (!Object.keys(overrides).length) return g;
  const nodes = g.nodes.map((n) => {
    const patch: Record<string, unknown> = {};
    for (const [path, value] of Object.entries(overrides)) {
      const dot = path.lastIndexOf(".");
      if (dot < 0) continue;
      if (path.slice(0, dot) === n.id) patch[path.slice(dot + 1)] = value;
    }
    return Object.keys(patch).length ? { ...n, ...patch } : n;
  });
  return { ...g, nodes };
}
