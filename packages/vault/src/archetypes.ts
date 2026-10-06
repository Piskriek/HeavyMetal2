// The eight look templates, rewritten for our texgraph (the Arena drop wrote them for its own texgraph copy).
// Translation, once and only here: freq -> scale (whole cells, so the tile stays seamless), input -> in, factor -> amount,
// mul -> multiply, the drop's gamma g -> ours 1/g, its warp offset (v - 0.5) * 2 * amount -> ours (v - 0.5) * amount,
// cellular invert -> an invert node, angled stripes -> count + tilt, sharpness -> 1 - softness, a curl node -> warp curl.
// Noise lacunarity is dropped (ours always doubles, which keeps every octave seamless); grain has no block size.
import type { TexGraph, TexNode } from "@hm/texgraph";
import type { VarDecl } from "@hm/fidelity";
import type { ArchParams, Archetype } from "./types";

/** What a template builds: the graph's nodes and outputs, and the knobs it exposes. */
export interface Built { nodes: TexNode[]; out: TexGraph["out"]; vars: VarDecl[] }

const scale = (f: number) => Math.max(1, Math.min(64, Math.round(f)));
const evenCount = (f: number) => Math.max(2, Math.min(32, 2 * Math.round(f / 2)));
const octaves = (o: number) => Math.max(1, Math.min(6, Math.round(o)));
const ourGamma = (theirs: number) => 1 / theirs;
const warpAmount = (theirs: number) => Math.min(0.3, Math.max(0, theirs * 2));
/** The drop's curl barely moved anything (about 1% of a tile); this keeps its 0.2..0.5 range distinct on ours. */
const curlAmount = (theirs: number) => Math.min(0.3, Math.max(0, theirs * 0.45));

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A palette as ramp stops, evenly spaced dark to light. */
export function paletteStops(palette: readonly string[]): { at: number; r: number; g: number; b: number }[] {
  return palette.map((c, i) => {
    const [r, g, b] = rgb(c);
    return { at: palette.length === 1 ? 0 : i / (palette.length - 1), r, g, b };
  });
}

/** Stripes at `freq` per tile along `angle` degrees, as whole counts on both axes (so they stay seamless). */
export function stripesAt(freq: number, angle: number, sharpness: number): { count: number; tilt: number; vertical: boolean; softness: number } {
  const rad = (angle * Math.PI) / 180;
  const cx = freq * Math.cos(rad), cy = freq * Math.sin(rad);
  const vertical = Math.abs(cx) >= Math.abs(cy);
  const main = vertical ? cx : cy, side = vertical ? cy : cx;
  return {
    count: Math.max(1, Math.round(Math.abs(main))),
    tilt: Math.max(-64, Math.min(64, Math.round(side * Math.sign(main || 1)))),
    vertical,
    softness: Math.max(0, Math.min(1, 1 - sharpness)),
  };
}

const levels = (id: string, input: string, inLow: number, inHigh: number, gamma = 1, outLow = 0, outHigh = 1): TexNode =>
  ({ id, type: "levels", in: input, inLow, inHigh, gamma, outLow, outHigh });

const ramp = (input: string, palette: readonly string[], interpolation: string): TexNode =>
  ({ id: "alb", type: "ramp", in: input, interpolation, stops: paletteStops(palette) });

const knob = (
  path: string, label: string, real: string, unit: string,
  min: number, max: number, step: number, def: number, explain: string, tier: 1 | 2 | 3,
): VarDecl => ({ path, label, real, unit, min, max, step, def, explain, tier });

const OUT = { albedo: "alb", height: "h", roughness: "rgh" };

/** The eight templates. Each takes a cartridge's tuning (in the drop's terms) and its palette. */
export const ARCHETYPES: Readonly<Record<Archetype, (p: ArchParams, pal: readonly string[]) => Built>> = {
  /** Crags, silt, regolith: layered noise broken up by cells. */
  rock: (p, pal) => {
    const f = p.freq ?? 5, o = p.octaves ?? 5, j = p.jitter ?? 0.85, seed = p.seed ?? 3, detail = p.detail ?? 0.34;
    return {
      nodes: [
        { id: "n", type: "noise", scale: scale(f), octaves: octaves(o), gain: p.gain ?? 0.52, seed },
        { id: "cell", type: "cellular", scale: scale(f * 1.6), jitter: j, mode: "f1", seed: seed + 11 },
        { id: "grit", type: "grain", seed: seed + 29 },
        { id: "mix", type: "blend", a: "n", b: "cell", mode: "min", amount: detail },
        { id: "spec", type: "blend", a: "mix", b: "grit", mode: "mix", amount: 0.11 },
        levels("h", "spec", 0.16, 0.88, ourGamma(p.gamma ?? 1.05)),
        ramp("h", pal, p.interp ?? "linear"),
        levels("rgh", "h", 0, 1, 1, p.roughLo ?? 0.62, p.roughHi ?? 0.95),
      ],
      out: OUT,
      vars: [
        knob("n.scale", "Coarseness", "base frequency", "cells/tile", 1, 24, 1, scale(f), "How many bumps fit across one tile.", 1),
        knob("n.octaves", "Grain Depth", "fBm octaves", "oct", 1, 6, 1, octaves(o), "How many times the detail halves and repeats.", 2),
        knob("cell.jitter", "Fracture", "Worley jitter", "-", 0, 1, 0.01, j, "Ordered lattice at 0, shattered rubble at 1.", 2),
        knob("mix.amount", "Crag Depth", "blend amount", "-", 0, 1, 0.01, detail, "How hard the fracture pattern cuts the surface.", 1),
      ],
    };
  },

  /**
   * Faceted, glassy: each cell a pyramid ridged towards its middle (cellular "edge"). The drop used inverted
   * distance-to-centre, which makes round shiny domes: the "christmas balls" the owner ruled out (2026-10-03).
   */
  crystal: (p, pal) => {
    const f = p.freq ?? 7, j = p.jitter ?? 0.9, seed = p.seed ?? 5, edge = ourGamma(p.gamma ?? 0.62);
    return {
      nodes: [
        { id: "cell", type: "cellular", scale: scale(f), jitter: j, mode: "edge", seed },
        levels("facet", "cell", 0, 0.65, edge),
        { id: "fine", type: "noise", scale: scale(f * 3.2), octaves: octaves(p.octaves ?? 2), gain: 0.5, seed: seed + 7 },
        { id: "h", type: "blend", a: "facet", b: "fine", mode: "add", amount: p.detail ?? 0.1 },
        ramp("h", pal, p.interp ?? "smooth"),
        levels("rgh", "h", 0, 1, 1, p.roughLo ?? 0.05, p.roughHi ?? 0.34),
      ],
      out: OUT,
      vars: [
        knob("cell.scale", "Facet Count", "Worley frequency", "cells/tile", 2, 28, 1, scale(f), "How many crystal faces fit across the tile.", 1),
        knob("cell.jitter", "Irregularity", "cell jitter", "-", 0, 1, 0.01, j, "Perfect lattice at 0, shattered geode at 1.", 2),
        knob("facet.gamma", "Edge Bite", "gamma", "-", 0.4, 5, 0.05, edge, "How hard the facet edges cut.", 3),
      ],
    };
  },

  /** Mycelium, moss, lichen: clumped cells crept sideways and matted with fuzz. */
  carpet: (p, pal) => {
    const f = p.freq ?? 6, w = warpAmount(p.warp ?? 0.06), seed = p.seed ?? 21, density = p.detail ?? 0.62;
    return {
      nodes: [
        { id: "clump", type: "cellular", scale: scale(f), jitter: 1, mode: "f1", seed },
        { id: "clumpInv", type: "invert", in: "clump" },
        { id: "fuzz", type: "noise", scale: scale(f * 5.5), octaves: octaves(p.octaves ?? 4), gain: 0.58, seed: seed + 13 },
        { id: "drift", type: "noise", scale: scale(f * 0.6), octaves: 3, gain: 0.5, seed: seed + 41 },
        { id: "w", type: "warp", in: "clumpInv", warp: "drift", amount: w },
        { id: "mix", type: "blend", a: "w", b: "fuzz", mode: "multiply", amount: density },
        levels("h", "mix", 0.06, 0.9, ourGamma(p.gamma ?? 1.25)),
        ramp("h", pal, p.interp ?? "smooth"),
        levels("rgh", "h", 0, 1, 1, p.roughLo ?? 0.48, p.roughHi ?? 0.88),
      ],
      out: OUT,
      vars: [
        knob("clump.scale", "Clumping", "Worley frequency", "clumps/tile", 2, 18, 1, scale(f), "How tightly the growth gathers into patches.", 1),
        knob("w.amount", "Creep", "domain warp", "uv", 0, 0.3, 0.005, w, "How far the colony has crept sideways.", 1),
        knob("mix.amount", "Density", "blend amount", "-", 0, 1, 0.01, density, "Sparse film at 0, matted carpet at 1.", 1),
      ],
    };
  },

  /** Kelp, currents, neon: stripes stirred by a curl (swirling, never bunching) warp. */
  flow: (p, pal) => {
    const f = p.freq ?? 2.5, w = curlAmount(p.warp ?? 0.3), seed = p.seed ?? 101;
    // at most 20 strands: the drop's 40-odd alias into zebra noise at game texture sizes (64 to 256 px)
    const ink = stripesAt(Math.min(20, p.detail ?? 14), p.angle ?? 12, p.sharp ?? 0.2);
    return {
      nodes: [
        // curl follows the gradient, which sharpens fine octaves into kinks: two octaves give smooth currents
        { id: "psi", type: "noise", scale: scale(f), octaves: Math.min(2, octaves(p.octaves ?? 4)), gain: 0.55, seed },
        { id: "ink", type: "stripes", count: ink.count, softness: ink.softness, vertical: ink.vertical, tilt: ink.tilt },
        { id: "w", type: "warp", in: "ink", warp: "psi", amount: w, curl: true },
        levels("h", "w", 0.18, 0.84, ourGamma(p.gamma ?? 1)),
        ramp("h", pal, p.interp ?? "smooth"),
        levels("rgh", "h", 0, 1, 1, p.roughLo ?? 0.08, p.roughHi ?? 0.4),
      ],
      out: OUT,
      vars: [
        knob("w.amount", "Vorticity", "curl warp amount", "uv", 0, 0.3, 0.005, w, "How hard the current swirls the strands.", 1),
        knob("psi.scale", "Eddy Scale", "stream function frequency", "eddies/tile", 1, 10, 1, scale(f), "How many whirlpools fit across the tile.", 1),
        knob("ink.count", "Strand Count", "stripe count", "strands", 4, 32, 1, ink.count, "The strands the whirlpools are visibly stirring.", 2),
      ],
    };
  },

  /**
   * Basalt, giant's causeway: column tops parted by dark cooling joints (cellular "edge": 0 on a cell's border).
   * The drop measured distance to the cell's centre, which pits each column with a dimple instead.
   */
  columnar: (p, pal) => {
    // our cells sit on a square grid, so low jitter gives square paving; real columns are irregular 5- to 7-sided
    const f = p.freq ?? 6, j = 0.45 + 0.4 * (p.jitter ?? 0.32), seed = p.seed ?? 13, weathering = p.detail ?? 0.26;
    return {
      nodes: [
        { id: "cols", type: "cellular", scale: scale(f), jitter: j, mode: "edge", seed },
        levels("joint", "cols", 0, 0.1, ourGamma(p.gamma ?? 1.6)),
        { id: "rock", type: "noise", scale: scale(f * 4.2), octaves: octaves(p.octaves ?? 5), gain: 0.46, seed: seed + 17 },
        { id: "h", type: "blend", a: "joint", b: "rock", mode: "mix", amount: weathering },
        ramp("h", pal, p.interp ?? "linear"),
        levels("rgh", "rock", 0, 1, 1, p.roughLo ?? 0.58, p.roughHi ?? 0.94),
      ],
      out: OUT,
      vars: [
        knob("cols.scale", "Column Width", "Worley frequency", "cols/tile", 2, 20, 1, scale(f), "Thick pillars at 2, pencil basalt at 20.", 1),
        knob("cols.jitter", "Regularity", "cell jitter", "-", 0, 1, 0.01, j, "Low values give the hexagonal cooling joints.", 2),
        knob("joint.inHigh", "Joint Width", "levels high", "-", 0.02, 0.4, 0.01, 0.1, "How wide the dark cracks between columns are.", 2),
        knob("h.amount", "Weathering", "blend amount", "-", 0, 1, 0.01, weathering, "How much surface rot breaks the columns.", 2),
      ],
    };
  },

  /** Roads, courses, sediment: stripes jittered by a warp and worn by cells. */
  strata: (p, pal) => {
    const bandsFreq = p.detail ?? 11, seed = p.seed ?? 61;
    const bands = stripesAt(bandsFreq, p.angle ?? 0, p.sharp ?? 0.72);
    return {
      nodes: [
        { id: "bands", type: "stripes", count: bands.count, softness: bands.softness, vertical: bands.vertical, tilt: bands.tilt },
        { id: "jit", type: "noise", scale: scale(p.freq ?? 7), octaves: octaves(p.octaves ?? 3), gain: 0.5, seed },
        { id: "w", type: "warp", in: "bands", warp: "jit", amount: warpAmount(p.warp ?? 0.032) },
        { id: "wear", type: "cellular", scale: scale(bandsFreq * 1.1), jitter: 0.55, mode: "f1", seed: seed + 9 },
        { id: "h", type: "blend", a: "w", b: "wear", mode: "overlay", amount: 0.3 },
        ramp("h", pal, p.interp ?? "linear"),
        levels("rgh", "h", 0, 1, 1, p.roughLo ?? 0.4, p.roughHi ?? 0.82),
      ],
      out: OUT,
      vars: [
        knob("bands.count", "Course Count", "stripe count", "courses", 2, 44, 1, bands.count, "How many strata bands the tool lays down.", 1),
        knob("bands.tilt", "Lean", "stripe tilt", "courses", -12, 12, 1, bands.tilt, "How far the courses lean off straight.", 1),
        knob("bands.softness", "Softness", "edge softness", "-", 0, 1, 0.01, bands.softness, "Cut masonry at 0, soft dunes at 1.", 2),
      ],
    };
  },

  /** Pavers, tiles, grids: a checker lattice bevelled by cells, with grime. */
  tile: (p, pal) => {
    // a checkerboard only tiles with an even count: with an odd one two same-coloured tiles meet at the wrap
    const n = evenCount(p.detail ?? 8), seed = p.seed ?? 77, contrast = p.sharp ?? 0.22;
    return {
      nodes: [
        { id: "grid", type: "checker", countX: n, countY: n },
        { id: "bevel", type: "cellular", scale: n, jitter: p.jitter ?? 0.08, mode: "f1", seed },
        levels("edge", "bevel", 0, 0.26, ourGamma(1.3)),
        { id: "grime", type: "noise", scale: scale(p.freq ?? 18), octaves: octaves(p.octaves ?? 4), gain: 0.5, seed: seed + 5 },
        { id: "base", type: "blend", a: "edge", b: "grid", mode: "mix", amount: contrast },
        { id: "h", type: "blend", a: "base", b: "grime", mode: "overlay", amount: p.detail2 ?? 0.24 },
        ramp("h", pal, p.interp ?? "linear"),
        levels("rgh", "h", 0, 1, 1, p.roughLo ?? 0.22, p.roughHi ?? 0.7),
      ],
      out: OUT,
      vars: [
        knob("grid.countX", "Tiles Across", "checker count", "tiles", 2, 32, 2, n, "How many tiles fit across (even, so it tiles).", 1),
        knob("grid.countY", "Tiles Down", "checker count", "tiles", 2, 32, 2, n, "How many tiles fit down (even, so it tiles).", 1),
        knob("edge.inHigh", "Bevel Width", "levels high", "-", 0.05, 0.6, 0.01, 0.26, "How far back from a joint the chamfer runs.", 2),
        knob("base.amount", "Joint Contrast", "blend amount", "-", 0, 1, 0.01, contrast, "How visible the grout line is.", 1),
      ],
    };
  },

  /** Jungle, forest, canopy: crowns of cells over warped leaf cells. */
  canopy: (p, pal) => {
    const f = p.freq ?? 4, w = warpAmount(p.warp ?? 0.1), seed = p.seed ?? 33, layering = p.detail ?? 0.58;
    return {
      nodes: [
        { id: "crown", type: "cellular", scale: scale(f), jitter: 1, mode: "f1", seed },
        { id: "crownInv", type: "invert", in: "crown" },
        { id: "leaf", type: "cellular", scale: scale(f * 4.5), jitter: 0.9, mode: "f1", seed: seed + 19 },
        { id: "leafInv", type: "invert", in: "leaf" },
        { id: "breeze", type: "noise", scale: scale(f * 0.8), octaves: octaves(p.octaves ?? 4), gain: 0.5, seed: seed + 51 },
        { id: "w1", type: "warp", in: "leafInv", warp: "breeze", amount: w },
        { id: "stack", type: "blend", a: "crownInv", b: "w1", mode: "overlay", amount: layering },
        levels("h", "stack", 0.1, 0.92, ourGamma(p.gamma ?? 1.15)),
        ramp("h", pal, p.interp ?? "smooth"),
        levels("rgh", "h", 0, 1, 1, p.roughLo ?? 0.42, p.roughHi ?? 0.8),
      ],
      out: OUT,
      vars: [
        knob("crown.scale", "Crown Scale", "Worley frequency", "crowns", 1, 14, 1, scale(f), "Size of each tree crown.", 1),
        knob("w1.amount", "Sway", "domain warp", "uv", 0, 0.3, 0.005, w, "How much the canopy has been combed by wind.", 1),
        knob("stack.amount", "Layering", "blend amount", "-", 0, 1, 0.01, layering, "How much leaf detail reads through the crowns.", 2),
      ],
    };
  },
};
