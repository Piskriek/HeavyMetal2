/**
 * TILE_LIBRARY (TICKET-41, plan 41 §4.6): the 20 procedural tiles the matstack shelf names, as texgraph graphs.
 *
 * Every tile is pure and deterministic, wraps at the tile edge, and outputs three maps the CPU reference and the layered-material
 * shader both read: `albedo` (a grey map: the shelf's ramp and colour variation ride on its luminance), `height` (relief) and
 * `roughness`. Ids match the shelf's `tile.tile` references exactly, so `registerTileGraphs(TILE_LIBRARY)` in
 * apps/web/src/play/layered-material.ts is all the wiring the game needs.
 *
 * Authoring rules (the tests in tests/tile-library.test.ts hold every entry to them):
 *  - the grey map is contrasty (5th to 95th percentile at least 0.35 apart) so a material's colour variation shows;
 *  - the height map is not constant (it must catch a grazing light);
 *  - the wrap differs no more than the worst neighbour inside does (no visible seam);
 *  - a 128 px evaluation stays inside 25 ms on the min-spec laptop class.
 */

import type { TexGraph, TexNode } from "./index";

type N = TexNode;
type Stops = ReadonlyArray<readonly [at: number, grey: number]>;

const noise = (id: string, scale: number, octaves: number, gain: number, seed: number, scaleY?: number): N =>
  scaleY === undefined
    ? { id, type: "noise", scale, octaves, gain, seed }
    : { id, type: "noise", scale, scaleY, octaves, gain, seed };
const cellular = (id: string, scale: number, jitter: number, mode: "f1" | "f2" | "edge", seed: number): N =>
  ({ id, type: "cellular", scale, jitter, mode, seed });
const grain = (id: string, seed: number): N => ({ id, type: "grain", seed });
const stripes = (id: string, count: number, softness: number, vertical: boolean, tilt = 0): N =>
  ({ id, type: "stripes", count, softness, vertical, tilt });
const spots = (id: string, count: number, radius: number, softness: number, seed: number): N =>
  ({ id, type: "spots", count, radius, softness, seed });
const hex = (id: string, count: number, mode: "edge" | "cell", seed: number, band = 0.18, jitter = 0): N =>
  ({ id, type: "hex", count, mode, seed, band, jitter });
const weave = (id: string, threads: number, contrast = 0.75): N => ({ id, type: "weave", threads, contrast });
const scratches = (id: string, count: number, length: number, width: number, vertical: boolean, seed: number): N =>
  ({ id, type: "scratches", count, length, width, vertical, seed });
const blur = (id: string, input: string, radius: number): N => ({ id, type: "blur", in: input, radius });
const warp = (id: string, input: string, field: string, amount: number, curl = false): N =>
  ({ id, type: "warp", in: input, warp: field, amount, curl });
const blend = (id: string, a: string, b: string, mode: "mix" | "add" | "multiply" | "min" | "max" | "overlay", amount: number, mask?: string): N =>
  mask === undefined ? { id, type: "blend", a, b, mode, amount } : { id, type: "blend", a, b, mode, amount, mask };
const levels = (id: string, input: string, inLow: number, inHigh: number, gamma: number, outLow = 0, outHigh = 1): N =>
  ({ id, type: "levels", in: input, inLow, inHigh, gamma, outLow, outHigh });
const scaleBias = (id: string, input: string, scale: number, bias: number): N => ({ id, type: "scaleBias", in: input, scale, bias });
/** A grey ramp: the tile's albedo, read by the shelf as luminance. */
const grey = (id: string, input: string, stops: Stops, interpolation?: "linear" | "smooth" | "constant"): N =>
  ({
    id,
    type: "ramp",
    in: input,
    stops: stops.map(([at, value]) => ({ at, r: value, g: value, b: value })),
    ...(interpolation ? { interpolation } : {}),
  });

/** A tile's graph from its nodes and outputs; every tile writes grey, height and roughness under the same ids. */
const tile = (
  id: string,
  name: string,
  nodes: readonly N[],
  out: { albedo: string; height: string; roughness: string } = { albedo: "albedo", height: "height", roughness: "roughness" },
): TexGraph => ({ id, name, nodes: [...nodes], out });

// ------------------------------------------------------------------ the 20 tiles

const TILES: readonly TexGraph[] = [
  // 1. Brushed metal: long streaks across, broken by grit, half a millimetre of relief.
  tile("brushed-metal", "Brushed metal", [
    noise("streaks", 48, 2, 0.45, 101, 3),
    noise("grit", 22, 3, 0.5, 7, 16),
    blend("surface", "streaks", "grit", "mix", 0.32),
    blur("soft", "surface", 1),
    noise("bands", 3, 2, 0.5, 211, 32),
    blend("laid", "soft", "bands", "add", 0.18),
    levels("contrast", "laid", 0.3, 0.7, 1),
    grey("albedo", "contrast", [[0, 0.06], [0.45, 0.42], [1, 0.88]]),
    levels("height", "laid", 0.08, 0.92, 1, 0.35, 0.65),
    scaleBias("roughness", "soft", 0.35, 0.36),
  ]),

  // 2. Galvanised cells: the spangle of a zinc bath, edges polished.
  tile("cells", "Zinc spangle", [
    cellular("spangle", 6, 0.9, "edge", 17),
    noise("warpField", 3, 2, 0.5, 31),
    warp("wobble", "spangle", "warpField", 0.06),
    levels("cells", "wobble", 0.02, 0.42, 0.7),
    noise("sheen", 14, 2, 0.5, 71),
    blend("surface", "cells", "sheen", "mix", 0.22),
    cellular("plate", 3, 0.7, "f2", 53),
    grey("albedo", "surface", [[0, 0.05], [0.5, 0.4], [1, 0.9]]),
    blend("heightMix", "cells", "plate", "mix", 0.35),
    levels("height", "heightMix", 0.05, 0.95, 1, 0.3, 0.72),
    scaleBias("roughness", "cells", 0.28, 0.44),
  ]),

  // 3. Cast iron: a coarse sand-cast skin with blowholes.
  tile("cast-iron", "Cast iron", [
    cellular("blowholes", 9, 0.85, "f1", 23),
    noise("sand", 32, 3, 0.55, 67),
    warp("cast", "blowholes", "sand", 0.05),
    levels("skin", "cast", 0.0, 0.55, 0.8),
    grain("speck", 89),
    blend("surface", "skin", "speck", "mix", 0.24),
    grey("albedo", "surface", [[0, 0.05], [0.55, 0.34], [1, 0.8]]),
    levels("height", "surface", 0.04, 0.96, 1, 0.22, 0.82),
    scaleBias("roughness", "surface", 0.22, 0.6),
  ]),

  // 4. Pits: pinholes left by a gas bubble in the pour.
  tile("pits", "Pinholes", [
    spots("holes", 42, 0.055, 0.25, 131),
    noise("floor", 20, 2, 0.5, 151),
    blend("surface", "holes", "floor", "mix", 0.35),
    grey("albedo", "surface", [[0, 0.04], [0.5, 0.36], [1, 0.86]]),
    levels("height", "holes", 0, 1, 1, 0.18, 0.75),
    scaleBias("roughness", "surface", 0.3, 0.5),
  ]),

  // 5. Fine grain: the flat, even tooth of a machined or bead-blasted face.
  tile("fine-grain", "Fine grain", [
    noise("blast", 40, 3, 0.55, 191),
    grain("tooth", 193),
    blend("surface", "blast", "tooth", "mix", 0.45),
    blur("soft", "surface", 1),
    levels("contrast", "soft", 0.38, 0.62, 1),
    grey("albedo", "contrast", [[0, 0.08], [0.5, 0.45], [1, 0.84]]),
    levels("height", "soft", 0.25, 0.75, 1, 0.34, 0.66),
    scaleBias("roughness", "soft", 0.4, 0.3),
  ]),

  // 6. Orange peel: the dimple of a powder coat that has not flowed flat.
  tile("orange-peel", "Orange peel", [
    noise("dimples", 11, 3, 0.52, 241),
    blur("peel", "dimples", 2),
    cellular("pores", 24, 0.8, "f1", 251),
    blend("surface", "peel", "pores", "mix", 0.16),
    levels("contrast", "surface", 0.3, 0.7, 1),
    grey("albedo", "contrast", [[0, 0.12], [0.5, 0.46], [1, 0.86]]),
    levels("height", "surface", 0.06, 0.94, 1, 0.3, 0.74),
    scaleBias("roughness", "surface", 0.2, 0.44),
  ]),

  // 7. Stripes: a soft banded grain for painted plate.
  tile("stripes", "Banded paint", [
    stripes("bands", 8, 0.72, true),
    noise("under", 24, 2, 0.5, 271, 6),
    blend("surface", "bands", "under", "mix", 0.28),
    grain("tooth", 277),
    blend("toothed", "surface", "tooth", "add", 0.1),
    grey("albedo", "toothed", [[0, 0.1], [0.5, 0.44], [1, 0.9]]),
    levels("height", "toothed", 0.06, 0.94, 1, 0.4, 0.62),
    scaleBias("roughness", "surface", 0.24, 0.42),
  ]),

  // 8. Rubber grain: a matte, pebbled tread surface.
  tile("rubber-grain", "Rubber grain", [
    spots("pebble", 30, 0.075, 0.7, 283),
    noise("swell", 18, 2, 0.5, 293),
    blend("surface", "pebble", "swell", "mix", 0.4),
    grain("dust", 307),
    blend("matte", "surface", "dust", "mix", 0.18),
    levels("contrast", "matte", 0.3, 0.7, 1),
    grey("albedo", "contrast", [[0, 0.05], [0.55, 0.32], [1, 0.76]]),
    levels("height", "surface", 0, 1, 1, 0.24, 0.78),
    scaleBias("roughness", "matte", 0.18, 0.7),
  ]),

  // 9. Concrete: form-board grain, aggregate and a few hairline cracks.
  tile("concrete", "Concrete", [
    noise("cement", 8, 3, 0.55, 311),
    grain("aggregate", 313),
    blend("body", "cement", "aggregate", "mix", 0.26),
    spots("stones", 16, 0.09, 0.45, 317),
    blend("mix", "body", "stones", "mix", 0.3),
    scratches("cracks", 5, 0.7, 0.006, false, 331),
    blend("surface", "mix", "cracks", "max", 1),
    levels("contrast", "surface", 0.3, 0.7, 1),
    grey("albedo", "contrast", [[0, 0.06], [0.5, 0.42], [1, 0.88]]),
    levels("height", "surface", 0.04, 0.96, 1, 0.26, 0.74),
    scaleBias("roughness", "body", 0.2, 0.62),
  ]),

  // 10. Carbon weave: a 2x2 twill read at a distance, with a clear coat sheen.
  tile("carbon-weave", "Carbon weave", [
    weave("cloth", 10, 0.85),
    noise("sheen", 26, 2, 0.5, 337),
    blend("surface", "cloth", "sheen", "mix", 0.18),
    noise("tow", 40, 2, 0.5, 347, 4),
    blend("tows", "surface", "tow", "mix", 0.22),
    grey("albedo", "tows", [[0, 0.04], [0.5, 0.34], [1, 0.82]]),
    levels("height", "tows", 0.04, 0.96, 1, 0.2, 0.8),
    scaleBias("roughness", "tows", 0.3, 0.26),
  ]),

  // 11. Micro hex: an anodised honeycomb, the walls darker than the cells.
  tile("hex-micro", "Micro hex", [
    hex("grid", 12, "edge", 359, 0.22),
    hex("cells", 12, "cell", 359),
    noise("dust", 30, 2, 0.5, 367),
    blend("surface", "cells", "dust", "mix", 0.2),
    blend("walled", "surface", "grid", "max", 1),
    grey("albedo", "walled", [[0, 0.05], [0.5, 0.4], [1, 0.88]]),
    blend("heightMix", "grid", "cells", "add", 0.35),
    levels("height", "heightMix", 0.05, 0.95, 1, 0.3, 0.72),
    scaleBias("roughness", "surface", 0.26, 0.42),
  ]),

  // 12. Flake scale: micaceous paint, small bright flakes in a dull binder.
  tile("flake-scale", "Flake scale", [
    cellular("flakes", 18, 0.95, "edge", 373),
    levels("flake", "flakes", 0.05, 0.6, 0.6),
    noise("binder", 12, 3, 0.52, 379),
    blend("surface", "binder", "flake", "add", 0.45),
    spots("large", 9, 0.08, 0.35, 383),
    blend("mixed", "surface", "large", "mix", 0.22),
    grey("albedo", "mixed", [[0, 0.06], [0.5, 0.4], [1, 0.92]]),
    levels("height", "mixed", 0.05, 0.95, 1, 0.3, 0.7),
    scaleBias("roughness", "mixed", 0.3, 0.4),
  ]),

  // 13. Grime clouds: soft, sooty blooms that gather in low places.
  tile("grime-clouds", "Grime clouds", [
    noise("fog", 4, 4, 0.58, 389),
    blur("cloud", "fog", 2),
    cellular("patch", 5, 0.9, "f1", 397),
    blend("surface", "cloud", "patch", "multiply", 0.5),
    grain("grit", 401),
    blend("gritted", "surface", "grit", "mix", 0.12),
    levels("contrast", "gritted", 0.26, 0.5, 1),
    grey("albedo", "contrast", [[0, 0.06], [0.5, 0.4], [1, 0.9]]),
    levels("height", "gritted", 0.05, 0.95, 1, 0.38, 0.62),
    scaleBias("roughness", "gritted", 0.18, 0.66),
  ]),

  // 14. Regolith: the grey, glassy dust of the moon's surface.
  tile("regolith-grain", "Regolith", [
    noise("drift", 6, 3, 0.55, 409),
    grain("shards", 419),
    spots("pebbles", 26, 0.06, 0.4, 421),
    blend("body", "drift", "shards", "mix", 0.35),
    blend("surface", "body", "pebbles", "mix", 0.3),
    levels("contrast", "surface", 0.3, 0.7, 1),
    grey("albedo", "contrast", [[0, 0.08], [0.5, 0.44], [1, 0.9]]),
    levels("height", "surface", 0.04, 0.96, 1, 0.3, 0.72),
    scaleBias("roughness", "surface", 0.24, 0.58),
  ]),

  // 15. Moss clump: soft cushions thrown over a rough substrate.
  tile("moss-clump", "Moss", [
    spots("clump", 14, 0.18, 0.85, 431),
    noise("fuzz", 26, 3, 0.55, 433),
    warp("wobble", "clump", "fuzz", 0.09),
    cellular("cushions", 12, 0.9, "f1", 439),
    blend("body", "wobble", "cushions", "max", 0.65),
    grain("leaf", 443),
    blend("surface", "body", "leaf", "mix", 0.28),
    grey("albedo", "surface", [[0, 0.05], [0.5, 0.4], [1, 0.88]]),
    levels("height", "surface", 0.04, 0.96, 1, 0.18, 0.88),
    scaleBias("roughness", "surface", 0.2, 0.66),
  ]),

  // 16. Frost crystal: needles that cross the surface in two directions.
  tile("frost-crystal", "Frost", [
    scratches("needlesA", 14, 0.8, 0.012, true, 449),
    scratches("needlesB", 10, 0.7, 0.01, false, 457),
    blend("needles", "needlesA", "needlesB", "max", 1),
    cellular("rime", 16, 0.9, "edge", 461),
    blend("surface", "needles", "rime", "add", 0.4),
    noise("chill", 20, 2, 0.5, 463),
    blend("frosted", "surface", "chill", "mix", 0.16),
    grey("albedo", "frosted", [[0, 0.1], [0.5, 0.5], [1, 0.96]]),
    levels("height", "frosted", 0.05, 0.95, 1, 0.24, 0.82),
    scaleBias("roughness", "frosted", 0.26, 0.3),
  ]),

  // 17. Mud splatter: thrown drops that have dried at the edges.
  tile("mud-splatter", "Mud splatter", [
    spots("drops", 22, 0.13, 0.3, 467),
    noise("spatter", 7, 3, 0.55, 479),
    warp("splat", "drops", "spatter", 0.1),
    cellular("dry", 14, 0.85, "edge", 487),
    blend("surface", "splat", "dry", "add", 0.3),
    grain("grit", 491),
    blend("gritted", "surface", "grit", "mix", 0.18),
    grey("albedo", "gritted", [[0, 0.04], [0.5, 0.36], [1, 0.84]]),
    levels("height", "gritted", 0.04, 0.96, 1, 0.2, 0.8),
    scaleBias("roughness", "gritted", 0.22, 0.6),
  ]),

  // 18. Mineral crust: salt and oxide crystals blooming out of a seam.
  tile("mineral-crust", "Mineral crust", [
    cellular("crystals", 10, 0.92, "edge", 499),
    levels("veins", "crystals", 0.03, 0.5, 0.65),
    noise("bloom", 5, 4, 0.6, 503),
    blur("soft", "bloom", 1),
    blend("surface", "soft", "veins", "add", 0.55),
    grain("grit", 509),
    blend("gritted", "surface", "grit", "mix", 0.2),
    grey("albedo", "gritted", [[0, 0.05], [0.5, 0.4], [1, 0.9]]),
    levels("height", "gritted", 0.04, 0.96, 1, 0.22, 0.84),
    scaleBias("roughness", "gritted", 0.24, 0.52),
  ]),

  // 19. Scorch burn: heat bloom, soot and a bright oxidised core.
  tile("scorch-burn", "Scorch", [
    noise("heat", 3, 4, 0.6, 521),
    blur("bloom", "heat", 2),
    noise("soot", 16, 3, 0.55, 523),
    blend("body", "bloom", "soot", "multiply", 0.55),
    cellular("crack", 11, 0.88, "edge", 541),
    blend("surface", "body", "crack", "add", 0.25),
    levels("contrast", "surface", 0.3, 0.7, 1),
    grey("albedo", "contrast", [[0, 0.04], [0.45, 0.3], [1, 0.86]]),
    levels("height", "surface", 0.04, 0.96, 1, 0.3, 0.7),
    scaleBias("roughness", "surface", 0.2, 0.64),
  ]),

  // 20. Scratches: a worn panel that has been dragged past things.
  tile("scratches", "Scratches", [
    scratches("long", 9, 0.9, 0.014, false, 547),
    scratches("short", 16, 0.4, 0.008, true, 557),
    blend("lines", "long", "short", "max", 1),
    noise("wear", 18, 3, 0.52, 563),
    blend("surface", "wear", "lines", "add", 0.6),
    grain("grit", 569),
    blend("gritted", "surface", "grit", "mix", 0.14),
    grey("albedo", "gritted", [[0, 0.06], [0.5, 0.4], [1, 0.9]]),
    levels("height", "gritted", 0.04, 0.96, 1, 0.36, 0.64),
    scaleBias("roughness", "gritted", 0.24, 0.44),
  ]),
];

/** The 20 tiles by id (the shelf's tile names). */
export const TILE_LIBRARY: Readonly<Record<string, TexGraph>> = Object.freeze(
  Object.fromEntries(TILES.map((graph) => [graph.id, graph])),
);

/** The tile ids in shelf order. */
export const TILE_LIBRARY_IDS: readonly string[] = Object.freeze(TILES.map((graph) => graph.id));

/** The tiles as an array, for a Studio palette or a contact sheet. */
export const TILE_LIBRARY_LIST: readonly TexGraph[] = Object.freeze([...TILES]);
