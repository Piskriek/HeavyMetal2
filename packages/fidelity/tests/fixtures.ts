// Test cartridges and the six canonical world states, in our texgraph dialect
// (ported from the Arena drop's fidelity.spec.ts; its freq/input/angle became scale/in/tilt).
import type { TexNode } from "@hm/texgraph";
import type { Cartridge, FidelityState, Stage } from "../src";
import { contentHash } from "../src";

/** A cartridge with one exposed knob and the usual three outputs. */
export function makeCart(id: string, cls: Cartridge["cls"], nodes: TexNode[], knob: string): Cartridge {
  const header = {
    id, rev: 1, name: id, kind: "setmix.cartridge" as const, parents: [] as string[],
    author: "test", cls, minStage: 1 as Stage, affinity: {}, tint: "#fff",
    graph: { id, name: id, nodes, out: { albedo: "alb", height: "h", roughness: "h" } },
    vars: [{
      path: knob, label: "Coarseness", real: "base frequency", unit: "cells/tile",
      min: 1, max: 24, step: 1, def: 5, explain: "How many bumps fit across one tile.", tier: 1 as const,
    }],
  };
  return { ...header, hash: contentHash(header) };
}

const ramp = (dark: [number, number, number], light: [number, number, number]) => [
  { at: 0, r: dark[0], g: dark[1], b: dark[2] },
  { at: 1, r: light[0], g: light[1], b: light[2] },
];

/** A material: noise against cellular. */
export const CART_A = makeCart("rock", "MATERIAL", [
  { id: "n", type: "noise", scale: 5, octaves: 6, gain: 0.5, seed: 3 },
  { id: "cell", type: "cellular", scale: 8, jitter: 0.8, mode: "f1", seed: 5 },
  { id: "h", type: "blend", a: "n", b: "cell", mode: "mix", amount: 0.4 },
  { id: "alb", type: "ramp", in: "h", interpolation: "linear", stops: ramp([0.1, 0.1, 0.12], [0.8, 0.78, 0.7]) },
], "n.scale");

/** An operator: streaks warped by a flow field. */
export const CART_B = makeCart("erode", "OPERATOR", [
  { id: "flow", type: "noise", scale: 3, octaves: 4, gain: 0.5, seed: 77 },
  { id: "streak", type: "stripes", count: 30, softness: 0.9, vertical: false, tilt: -3 },
  { id: "h", type: "warp", in: "streak", warp: "flow", amount: 0.2 },
  { id: "alb", type: "ramp", in: "h", interpolation: "linear", stops: ramp([0.1, 0.1, 0.1], [0.9, 0.9, 0.9]) },
], "flow.scale");

/** A rule: a snow line across the tile. */
export const CART_C = makeCart("snowline", "RULE", [
  { id: "g", type: "stripes", count: 1, softness: 1, vertical: false },
  { id: "h", type: "levels", in: "g", inLow: 0.55, inHigh: 0.85, gamma: 1, outLow: 0, outHigh: 1 },
  { id: "alb", type: "ramp", in: "h", interpolation: "linear", stops: ramp([0, 0, 0], [1, 1, 1]) },
], "g.count");

export const CARTS = new Map([CART_A, CART_B, CART_C].map((c) => [c.id, c]));

/** One world state per stage, 1 to 6. */
export const STAGE_STATES: readonly FidelityState[] = [
  { pxd: 4.0e2, vtx: 2.0e2, lx: 4.0e1, aq: 1.0e0, tick: 0 },
  { pxd: 2.6e4, vtx: 1.1e4, lx: 6.0e3, aq: 4.0e1, tick: 0 },
  { pxd: 9.0e5, vtx: 7.0e5, lx: 3.4e5, aq: 1.2e4, tick: 0 },
  { pxd: 7.0e6, vtx: 5.2e6, lx: 3.0e6, aq: 1.6e6, tick: 0 },
  { pxd: 3.4e7, vtx: 2.6e7, lx: 1.8e7, aq: 9.0e6, tick: 0 },
  { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7, tick: 0 },
];

/** A seeded generator, so random-looking tests repeat exactly. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** A world state along the diagonal of the ladder, 10^(2..8). */
export function diagonalState(rnd: () => number): FidelityState {
  const v = Math.pow(10, 2 + rnd() * 6);
  return { pxd: v * 1.3, vtx: v, lx: v * 0.7, aq: v * 0.4, tick: 0 };
}
