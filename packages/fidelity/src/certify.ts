// The export check: a cartridge must work at both ends of the stage ladder, inside its frame budget, with knobs people can read.
import { validateGraph, type TexGraph } from "@hm/texgraph";
import type { Cartridge, Certificate, DeviceProfile, FidelityState } from "./types";
import { EDGE_KEYS, adaptGraph, deriveBudget } from "./budget";

/** A rough cost per node type, per texel (noise also pays per octave; a curl warp pays for its gradient pass). */
export const NODE_WEIGHT: Readonly<Record<string, number>> = Object.freeze({
  constant: 1, checker: 1, grain: 1, stripes: 2, invert: 1, scaleBias: 1,
  levels: 2, blend: 2, ramp: 3, warp: 4, cellular: 9, noise: 1,
});

/** The estimated cost of evaluating a graph at a texture size. */
export function graphCost(g: TexGraph, size: number): { weight: number; texels: number; evalMs: number } {
  let weight = 0;
  for (const n of g.nodes) {
    const base = NODE_WEIGHT[n.type] ?? 1;
    if (n.type === "noise") weight += base + Math.max(1, Math.round(typeof n.octaves === "number" ? n.octaves : 4));
    else if (n.type === "warp" && n.curl === true) weight += base + 5;
    else weight += base;
  }
  return { weight, texels: size * size, evalMs: (weight * size * size) / 2.6e6 };
}

const STAGE_1: FidelityState = { pxd: 2e3, vtx: 1e3, lx: 4e2, aq: 0, tick: 0 };
const STAGE_6: FidelityState = { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 3.5e7, tick: 0 };

/** Checks a cartridge for a tier. Fails with plain reasons; a cartridge that fails does not ship. */
export function certify(c: Cartridge, dev: DeviceProfile): Certificate {
  const failures: string[] = [];
  const low = deriveBudget(STAGE_1, dev), high = deriveBudget(STAGE_6, dev);
  const gLow = adaptGraph(c.graph, low), gHigh = adaptGraph(c.graph, high);
  const cost = graphCost(gHigh, high.size);

  for (const [label, g] of [["stage 1", gLow], ["stage 6", gHigh]] as const) {
    if (!g.out.albedo) failures.push(`${label}: the albedo output was lost`);
    const check = validateGraph(g);
    if (!check.ok) failures.push(`${label}: not a valid texture graph (${check.errors[0] ?? "unknown"})`);
  }
  if (cost.evalMs > dev.msBudget * 0.5) failures.push(`stage 6 takes ${cost.evalMs.toFixed(2)} ms, more than half the frame budget`);
  if (c.vars.length > 8) failures.push(`${c.vars.length} knobs: the cap is 8`);

  const ids = new Set(gHigh.nodes.map((n) => n.id));
  for (const n of gHigh.nodes) {
    for (const k of EDGE_KEYS) if (typeof n[k] === "string" && !ids.has(n[k] as string)) failures.push(`node ${n.id}.${k} points at ${String(n[k])}, which is missing`);
  }

  for (const v of c.vars) {
    if (!v.explain || v.explain.length < 12) failures.push(`knob ${v.path} has no explanation`);
    if (v.def < v.min || v.def > v.max) failures.push(`knob ${v.path} starts outside its range`);
  }

  return {
    nodes: c.graph.nodes.length, weight: cost.weight, texels: cost.texels, evalMs: cost.evalMs,
    minStage: c.minStage, determinism: "seed-stable", pass: failures.length === 0, failures,
  };
}
