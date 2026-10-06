// The Fusion Matrix: two cartridges in, a new one out. Copy on write: the parents are never changed.
import type { TexGraph, TexNode } from "@hm/texgraph";
import type { CartClass, Cartridge, FusionResult, MetricKey, Stage, VarDecl } from "./types";
import { contentHash } from "./hash";
import { clamp } from "./metrics";
import { EDGE_KEYS, isColourNode } from "./budget";

function prefixOut(out: TexGraph["out"], p: string): TexGraph["out"] {
  const o: TexGraph["out"] = {};
  if (out.albedo !== undefined) o.albedo = p + out.albedo;
  if (out.height !== undefined) o.height = p + out.height;
  if (out.roughness !== undefined) o.roughness = p + out.roughness;
  return o;
}

/** The graph with every node id (and every reference to one) prefixed, so two graphs can share one node list. */
function prefixGraph(g: TexGraph, p: string): TexGraph {
  return {
    ...g,
    nodes: g.nodes.map((n) => {
      const c: TexNode = { ...n, id: p + n.id };
      for (const k of EDGE_KEYS) if (typeof c[k] === "string") c[k] = p + (c[k] as string);
      return c;
    }),
    out: prefixOut(g.out, p),
  };
}

function mergeAffinity(x: Cartridge["affinity"], y: Cartridge["affinity"], f: number): Cartridge["affinity"] {
  const o: Cartridge["affinity"] = {};
  for (const k of ["pxd", "vtx", "lx", "aq"] as MetricKey[]) {
    const v = (x[k] ?? 1) * (1 - f) + (y[k] ?? 1) * f;
    if (Math.abs(v - 1) > 0.01) o[k] = +v.toFixed(2);
  }
  return o;
}

const STONE_RAMP = [
  { at: 0, r: 0.16, g: 0.16, b: 0.2 },
  { at: 0.55, r: 0.5, g: 0.48, b: 0.44 },
  { at: 1, r: 0.92, g: 0.9, b: 0.84 },
];

interface Fused { out: TexGraph["out"]; cls: CartClass; confidence: number; rationale: string }

/**
 * Fuses two cartridges. The grammar:
 * - anything + RULE: the rule's height decides where its look lands on the other (a blend mask);
 * - OPERATOR + OPERATOR: the second's field warps the first: a new verb;
 * - MATERIAL + OPERATOR: one warp moves albedo and height together, so colour and shape never part;
 * - MATERIAL + MATERIAL: albedo mixes, heights overlay so both shapes survive, roughness takes the max.
 * Every graph it makes is valid for @hm/texgraph (a test fuses every vault pair to prove it).
 */
export function fuse(a: Cartridge, b: Cartridge, dominance: number, seed = 0): FusionResult {
  const A = prefixGraph(a.graph, "a_"), B = prefixGraph(b.graph, "b_");
  const nodes: TexNode[] = [...A.nodes, ...B.nodes];
  const added: string[] = [];
  const f = clamp(dominance, 0, 1);
  const push = (n: TexNode): string => { nodes.push(n); added.push(`${n.id} (${n.type})`); return n.id; };
  const sameKind = (x: string, y: string) => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return isColourNode(byId, x) === isColourNode(byId, y);
  };
  // when only one side has an output it passes through; when both do but cannot blend, the dominant one wins
  const pick = (x: string | undefined, y: string | undefined) => (x !== undefined && y !== undefined ? (f < 0.5 ? x : y) : x ?? y);
  const set = (out: TexGraph["out"], key: keyof TexGraph["out"], id: string | undefined) => { if (id !== undefined) out[key] = id; };

  const mixMaterials = (): Fused => {
    const out: TexGraph["out"] = {};
    const [aa, ba] = [A.out.albedo, B.out.albedo];
    if (aa !== undefined && ba !== undefined && sameKind(aa, ba)) out.albedo = push({ id: "fx_mix_albedo", type: "blend", a: aa, b: ba, mode: "mix", amount: f });
    else set(out, "albedo", pick(aa, ba));
    const [ah, bh] = [A.out.height, B.out.height];
    if (ah !== undefined && bh !== undefined) out.height = push({ id: "fx_mix_height", type: "blend", a: ah, b: bh, mode: "overlay", amount: f });
    else set(out, "height", pick(ah, bh));
    const [ar, br] = [A.out.roughness, B.out.roughness];
    if (ar !== undefined && br !== undefined) out.roughness = push({ id: "fx_mix_rough", type: "blend", a: ar, b: br, mode: "max", amount: f });
    else set(out, "roughness", pick(ar, br));
    return {
      out, cls: "MATERIAL", confidence: 84,
      rationale: "Two materials make a third: the colours mix, the heights overlay so both shapes survive, and roughness takes the rougher.",
    };
  };

  let fused: Fused;
  if (a.cls === "RULE" || b.cls === "RULE") {
    const ruleIsA = a.cls === "RULE";
    const rule = ruleIsA ? A : B, subject = ruleIsA ? B : A;
    const out: TexGraph["out"] = {};
    const sa = subject.out.albedo, ra = rule.out.albedo, rh = rule.out.height;
    if (sa !== undefined && ra !== undefined && sameKind(sa, ra)) {
      // a masked blend reaches full strength at dominance 0.5 where the mask is fully on
      const blend: TexNode = { id: "fx_rule_albedo", type: "blend", a: sa, b: ra, mode: "mix", amount: rh === undefined ? f : Math.min(1, 2 * f) };
      if (rh !== undefined) blend.mask = rh;
      out.albedo = push(blend);
    } else set(out, "albedo", sa ?? ra);
    const sh = subject.out.height;
    if (sh !== undefined && rh !== undefined) out.height = push({ id: "fx_rule_height", type: "blend", a: sh, b: rh, mode: "max", amount: f });
    else set(out, "height", sh ?? rh);
    set(out, "roughness", subject.out.roughness ?? rule.out.roughness);
    fused = {
      out, cls: ruleIsA ? b.cls : a.cls, confidence: 88,
      rationale: "A rule places nothing itself: it decides where. Its height becomes the mask, so the result keeps working as the ground changes under it.",
    };
  } else if (a.cls === "OPERATOR" && b.cls === "OPERATOR" && A.out.height !== undefined && B.out.height !== undefined) {
    const w = push({ id: "fx_chain", type: "warp", in: A.out.height, warp: B.out.height, amount: Math.min(0.3, 0.04 + f * 0.22) });
    const out: TexGraph["out"] = {
      albedo: push({ id: "fx_chain_albedo", type: "ramp", in: w, interpolation: "smooth", stops: STONE_RAMP }),
      height: w,
    };
    set(out, "roughness", A.out.roughness ?? B.out.roughness);
    fused = { out, cls: "OPERATOR", confidence: 71, rationale: "A verb and a verb make a new verb: the second one's field drives the first one's warp." };
  } else if ((a.cls === "OPERATOR") !== (b.cls === "OPERATOR")) {
    const opIsA = a.cls === "OPERATOR";
    const op = opIsA ? A : B, mat = opIsA ? B : A;
    const driver = op.out.height;
    if (driver === undefined || mat.out.albedo === undefined) fused = mixMaterials();
    else {
      const amount = Math.min(0.3, 0.02 + f * 0.3);
      const out: TexGraph["out"] = { albedo: push({ id: "fx_warp_albedo", type: "warp", in: mat.out.albedo, warp: driver, amount }) };
      if (mat.out.height !== undefined) {
        const hw = push({ id: "fx_warp_height", type: "warp", in: mat.out.height, warp: driver, amount });
        out.height = push({ id: "fx_op_height", type: "blend", a: hw, b: driver, mode: "overlay", amount: f * 0.7 });
      } else out.height = driver;
      set(out, "roughness", mat.out.roughness ?? op.out.roughness);
      fused = {
        out, cls: opIsA ? b.cls : a.cls, confidence: 93,
        rationale: "A material and a verb: one warp moves colour and height together, so they never come apart.",
      };
    }
  } else fused = mixMaterials();

  const graph: TexGraph = { id: `fus_${contentHash([a.hash, b.hash, +f.toFixed(3), seed]).slice(2)}`, name: `${a.name} x ${b.name}`, nodes, out: fused.out };

  // the parents' knobs still point at their nodes: their paths take the same prefix as the nodes did
  const dominanceKnob: VarDecl = {
    path: "fusion.dominance", label: "Dominance", real: "blend factor", unit: "-", min: 0, max: 1, step: 0.01, def: f,
    explain: "Which parent wins where the two disagree (changing it fuses again).", tier: 1,
  };
  const vars: VarDecl[] = [
    dominanceKnob,
    ...a.vars.map((v): VarDecl => ({ ...v, path: "a_" + v.path })),
    ...b.vars.map((v): VarDecl => ({ ...v, path: "b_" + v.path })),
  ].slice(0, 8);

  const header = {
    id: graph.id, rev: 1, name: graph.name, kind: "setmix.cartridge" as const,
    parents: [a.hash, b.hash], author: "fusion-matrix", cls: fused.cls, graph, vars,
    minStage: Math.max(a.minStage, b.minStage) as Stage,
    affinity: mergeAffinity(a.affinity, b.affinity, f),
    tint: f > 0.5 ? b.tint : a.tint,
  };
  return { child: { ...header, hash: contentHash(header) }, confidence: fused.confidence, grammar: `${a.cls} + ${b.cls}`, rationale: fused.rationale, addedNodes: added };
}
