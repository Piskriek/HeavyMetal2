/* ============================================================================
 *  packages/fidelity/src/index.ts
 *  ---------------------------------------------------------------------------
 *  The pure math engine. No React. No Three.js. No DOM. No Node builtins.
 *  No Date.now(). No Math.random(). Every function below is referentially
 *  transparent, which is what makes the 120 Hz sim replayable and what makes
 *  the whole thing testable with golden files.
 *
 *  In the monorepo the import below reads:
 *      import type { ... } from "@hm/contracts/setmix";
 * ==========================================================================*/

import type {
  Cartridge, CartClass, Certificate, DeviceProfile, Emitter, FidelityState,
  FusionResult, MeshPolicy, MetricKey, RenderBudget, Stage, StepOptions,
  TexGraph, TexNode, TexelSize, VarDecl,
} from "./contracts.setmix";
import {
  CELL_LADDER, FI_WEIGHTS, METRIC_TARGET, STAGE_FI, TEXEL_LADDER, TICK_HZ,
} from "./contracts.setmix";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
/** C¹ smoothstep: S(0)=0, S(1)=1, S'(0)=S'(1)=0. */
export const smoothstepC1 = (u: number) => {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
};

/* ════════════════════════════════════════════════════ 1 · CONTENT HASH ══ */

/**
 *  FNV-1a 32-bit over a key-sorted, fixed-precision serialisation.
 *  Deterministic across platforms because:
 *    · object key order is normalised by sorting,
 *    · non-integer floats are pinned to 6 decimal places before hashing,
 *    · only the DAG and its parameters are hashed — never evaluated pixels.
 *  (Resolution to texgraph Q1: hash the graph, cache the buffers.)
 */
export function contentHash(value: unknown): string {
  const stable = (x: unknown): string => {
    if (x === null || x === undefined) return "n";
    if (Array.isArray(x)) return "[" + x.map(stable).join(",") + "]";
    if (typeof x === "object")
      return (
        "{" +
        Object.keys(x as object)
          .sort()
          .map((k) => k + ":" + stable((x as Record<string, unknown>)[k]))
          .join(",") +
        "}"
      );
    if (typeof x === "number")
      return Number.isInteger(x) ? String(x) : x.toFixed(6);
    return String(x);
  };
  const s = stable(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "0x" + h.toString(16).padStart(8, "0");
}

/* ══════════════════════════════════════════════════ 2 · FIDELITY MATHS ══ */

/** C = 1 − 0.45·σ(n̂)/μ(n̂). Punishes min-maxing one metric. */
export function coherence(s: FidelityState): number {
  const keys: MetricKey[] = ["pxd", "vtx", "lx", "aq"];
  const n = keys.map((k) => s[k] / METRIC_TARGET[k]);
  const mu = (n[0] + n[1] + n[2] + n[3]) / 4;
  if (mu <= 1e-12) return 1;
  let acc = 0;
  for (const v of n) acc += (v - mu) * (v - mu);
  const sd = Math.sqrt(acc / 4);
  return clamp(1 - 0.45 * (sd / mu), 0.35, 1);
}

/** Fi = (Pxd^.30 · Vtx^.30 · Lx^.25 · Aq^.15) · C — exponents sum to 1.0,
 *  so Fi grows linearly under uniform throughput. */
export function fidelityIndex(s: FidelityState): number {
  const p = Math.pow(Math.max(s.pxd, 1e-6), FI_WEIGHTS.pxd);
  const v = Math.pow(Math.max(s.vtx, 1e-6), FI_WEIGHTS.vtx);
  const l = Math.pow(Math.max(s.lx, 1e-6), FI_WEIGHTS.lx);
  const a = Math.pow(Math.max(s.aq, 1e-6), FI_WEIGHTS.aq);
  return p * v * l * a * coherence(s);
}

export function stageOf(fi: number): Stage {
  for (let i = 6; i >= 1; i--) if (fi >= STAGE_FI[i - 1]) return i as Stage;
  return 1;
}

/** Log ratio raised to 2.5 so the six stages land exactly on TEXEL_LADDER. */
export function normalised(s: FidelityState): Record<MetricKey, number> {
  const f = (v: number, t: number) =>
    Math.pow(clamp01(Math.log1p(Math.max(0, v)) / Math.log1p(t)), 2.5);
  return {
    pxd: f(s.pxd, METRIC_TARGET.pxd),
    vtx: f(s.vtx, METRIC_TARGET.vtx),
    lx: f(s.lx, METRIC_TARGET.lx),
    aq: f(s.aq, METRIC_TARGET.aq),
  };
}

const TIER_MULT = [1, 6.5, 42, 400] as const;

/** Deterministic fixed-step integrator. Call from @hm/sim at 120 Hz. */
export function stepFidelity(
  s: FidelityState,
  emitters: readonly Emitter[],
  carts: ReadonlyMap<string, Cartridge>,
  opts: StepOptions = { clockSupply: Infinity, maintenance: 1 },
): FidelityState {
  const ticks = opts.ticks ?? 1;
  const dt = ticks / TICK_HZ;

  let demand = 0;
  for (const e of emitters) demand += e.clock * (1 + e.tier * 1.4);
  const sat = demand <= 0 ? 1 : Math.min(1, opts.clockSupply / demand);

  const add: Record<MetricKey, number> = { pxd: 0, vtx: 0, lx: 0, aq: 0 };
  for (const e of emitters) {
    const cart = e.cartridge ? carts.get(e.cartridge) : undefined;
    const aff = cart?.affinity?.[e.metric] ?? 1;
    add[e.metric] += e.base * TIER_MULT[e.tier] * sat * aff;
  }

  const drain =
    0.015 * Math.pow(Math.max(fidelityIndex(s), 0), 0.82) * (1 - opts.maintenance);

  return {
    pxd: Math.max(0, s.pxd + (add.pxd - drain * FI_WEIGHTS.pxd * 4) * dt),
    vtx: Math.max(0, s.vtx + (add.vtx - drain * FI_WEIGHTS.vtx * 4) * dt),
    lx: Math.max(0, s.lx + (add.lx - drain * FI_WEIGHTS.lx * 4) * dt),
    aq: Math.max(0, s.aq + (add.aq - drain * FI_WEIGHTS.aq * 4) * dt),
    tick: s.tick + ticks,
  };
}

/* ════════════════════════════════════════════════════════ 3 · GOVERNOR ══ */

export const DEVICES: readonly DeviceProfile[] = Object.freeze([
  { id: "mobile", label: "Mobile / RUN web", maxTexel: 64,  msBudget: 16.6, allowNormal: false, allowWarp: false, maxOctaves: 3 },
  { id: "potato", label: "GTX 1050 / Deck",  maxTexel: 128, msBudget: 16.6, allowNormal: true,  allowWarp: true,  maxOctaves: 4 },
  { id: "mid",    label: "RTX 3060",         maxTexel: 256, msBudget: 16.6, allowNormal: true,  allowWarp: true,  maxOctaves: 6 },
  { id: "ultra",  label: "RTX 4080",         maxTexel: 512, msBudget: 8.3,  allowNormal: true,  allowWarp: true,  maxOctaves: 8 },
]);

/**
 *  THE BRIDGE. FidelityState → RenderBudget.
 *  The only place in the codebase where gameplay state touches render state.
 *  Pxd → texels + octaves · Vtx → relief · Lx → shading model · Aq → wetness.
 *  The device profile clamps; it never gates progression.
 */
export function deriveBudget(s: FidelityState, dev: DeviceProfile): RenderBudget {
  const n = normalised(s);
  const stage = stageOf(fidelityIndex(s));
  const demoted: string[] = [];

  const wantIdx = Math.round(n.pxd * 5);
  const capIdx = TEXEL_LADDER.indexOf(dev.maxTexel);
  let sizeIdx = wantIdx;
  if (capIdx >= 0 && sizeIdx > capIdx) {
    demoted.push(`texel ${TEXEL_LADDER[wantIdx]}→${dev.maxTexel}`);
    sizeIdx = capIdx;
  }

  let oct = 1 + Math.floor(n.pxd * 5);
  if (oct > dev.maxOctaves) {
    demoted.push(`octaves ${oct}→${dev.maxOctaves}`);
    oct = dev.maxOctaves;
  }

  const normal = n.lx > 0.18 && dev.allowNormal;
  if (n.lx > 0.18 && !dev.allowNormal) demoted.push("normal map → vertex light");
  const allowWarp = n.pxd > 0.3 && dev.allowWarp;
  if (n.pxd > 0.3 && !dev.allowWarp) demoted.push("domain warp → culled");
  const allowCellular = n.vtx > 0.22 || dev.maxTexel >= 128;
  if (!allowCellular) demoted.push("cellular → noise substitute");

  return {
    stage,
    size: TEXEL_LADDER[Math.max(0, sizeIdx)] as TexelSize,
    octaveBudget: oct,
    relief: 0.15 + n.vtx * 1.55,
    normal,
    roughness: n.lx > 0.1,
    paletteLevels:
      n.pxd < 0.12 ? -1 : n.pxd < 0.3 ? 3 : n.pxd < 0.5 ? 6 : n.pxd < 0.72 ? 16 : 0,
    shadowCascades: Math.min(4, Math.floor(n.lx * 5)),
    allowWarp,
    allowCellular,
    wetness: Math.max(0, (n.aq - 0.22) / 0.78),
    demoted,
  };
}

/** RenderBudget → the options @hm/texgraph consumes. The single seam between
 *  simulation and rendering, expressed as four fields. */
export function toEvaluateOptions(b: RenderBudget, seed: number) {
  return { size: b.size as number, seed, relief: b.relief, normal: b.normal };
}

/* ════════════════════════════════════════════════════ 4 · ADAPT GRAPH ══ */

const EDGE_KEYS = ["input", "a", "b", "by", "mask", "potential", "vectorField"] as const;

/**
 *  Rewrites a cartridge DAG to fit a budget. This is why ONE 90 kB bundle
 *  renders as 14 flat polygons at Stage 1 and a raytraced landmark at Stage 6:
 *    · clamps every noise octave count,
 *    · substitutes unresolvable `cellular` with a cheap 2-octave noise,
 *    · bypasses `warp` by re-pointing consumers at its input,
 *    · degrades `curl` 2-channel drivers below 64 texels,
 *    · sets `ramp.interpolation` from paletteLevels (texgraph Q5), which is
 *      how Stage 1's 2-bit look costs zero render passes,
 *    · injects the Aq wetness pass into every albedo on the planet.
 */
export function adaptGraph(g: TexGraph, b: RenderBudget): TexGraph {
  const keep = new Map<string, TexNode>();
  const alias = new Map<string, string>();

  for (const n of g.nodes) {
    const c: TexNode = { ...n };

    if (c.type === "noise" && typeof c.octaves === "number")
      c.octaves = Math.min(c.octaves, b.octaveBudget);

    if (c.type === "ramp")
      c.interpolation =
        b.paletteLevels === -1 ? "constant" : b.paletteLevels === 0 ? "smooth" : "linear";

    if (c.type === "cellular" && !b.allowCellular) {
      keep.set(c.id, {
        id: c.id, type: "noise",
        freq: (c.freq as number) ?? 6, octaves: 2, seed: (c.seed as number) ?? 0,
      });
      continue;
    }

    if (c.type === "curl" && b.size <= 32) {
      keep.set(c.id, { id: c.id, type: "noise", freq: 2.5, octaves: 2, seed: 101 });
      continue;
    }

    if (c.type === "warp") {
      if (!b.allowWarp) {
        alias.set(c.id, (c.input as string) ?? c.id);
        continue;
      }
      if (b.size <= 32 && typeof c.vectorField === "string") {
        c.by = c.vectorField;
        delete c.vectorField;
      }
    }

    keep.set(c.id, c);
  }

  const resolve = (id?: string): string | undefined => {
    let cur = id;
    for (let i = 0; i < 16 && cur && alias.has(cur) && alias.get(cur) !== cur; i++)
      cur = alias.get(cur);
    return cur;
  };

  const nodes: TexNode[] = [];
  for (const n of keep.values()) {
    const c: TexNode = { ...n };
    for (const k of EDGE_KEYS) if (typeof c[k] === "string") c[k] = resolve(c[k] as string);
    nodes.push(c);
  }

  const out = { ...g.out };
  out.albedo = resolve(out.albedo);
  out.height = resolve(out.height);
  out.roughness = b.roughness ? resolve(out.roughness) : undefined;

  if (b.wetness > 0.01 && out.albedo) {
    nodes.push(
      { id: "__wet_src", type: "constant", rgb: [0.07, 0.3, 0.42] },
      { id: "__wet_mask", type: "invert", input: out.height ?? out.albedo },
      {
        id: "__wet_mix", type: "blend", a: out.albedo, b: "__wet_src",
        mode: "mul", factor: Math.min(0.75, b.wetness * 0.8), mask: "__wet_mask",
      },
    );
    out.albedo = "__wet_mix";
    if (out.roughness) {
      nodes.push({
        id: "__wet_rough", type: "levels", input: out.roughness,
        inLow: 0, inHigh: 1, outLow: 0, outHigh: Math.max(0.12, 1 - b.wetness * 0.8),
      });
      out.roughness = "__wet_rough";
    }
  }

  return { id: `${g.id}@s${b.stage}`, name: g.name, nodes, out };
}

/* ══════════════════════════════════════════════════════════ 5 · MESH ══ */

export function meshPolicyFor(s: FidelityState, b: RenderBudget): MeshPolicy {
  const n = normalised(s).vtx;
  const lod = Math.min(5, Math.round(n * 5));
  let mode: MeshPolicy["mode"], chamfer: number, relax: number;
  if (n < 0.08) { mode = "CUBIC"; chamfer = 0; relax = 0; }
  else if (n < 0.3) { mode = "CHAMFER"; chamfer = smoothstepC1((n - 0.08) / 0.22) * 0.5; relax = 0; }
  else { mode = "DUAL"; chamfer = 0.5; relax = Math.min(8, Math.floor((n - 0.3) * 11)); }
  return {
    lod, cellSize: CELL_LADDER[lod], mode, chamfer, relaxIterations: relax,
    smoothAngleDeg: 180 * (1 - Math.exp(-s.vtx / 50000)),
    qefClamp: 0.5 - 0.18 * smoothstepC1(n),
    stage: b.stage,
  };
}

/** The coarser of two policies. Both neighbours call this with the same two
 *  arguments, so both derive the same boundary ring — agreement by arithmetic. */
export function minPolicy(a: MeshPolicy, b: MeshPolicy): MeshPolicy {
  if (a.lod === b.lod) {
    const rank = (m: MeshPolicy["mode"]) => (m === "CUBIC" ? 0 : m === "CHAMFER" ? 1 : 2);
    return rank(a.mode) <= rank(b.mode) ? a : b;
  }
  return a.lod < b.lod ? a : b;
}

export function seamKeyFor(
  p: MeshPolicy, edge: "N" | "S" | "E" | "W", origin: readonly [number, number],
): string {
  return contentHash([
    edge, p.cellSize, p.mode, +p.chamfer.toFixed(4), p.relaxIterations,
    +origin[0].toFixed(2), +origin[1].toFixed(2),
  ]);
}

export function seamsAgree(
  a: MeshPolicy, b: MeshPolicy, origin: readonly [number, number],
  edgeA: "N" | "S" | "E" | "W", edgeB: "N" | "S" | "E" | "W",
): boolean {
  const shared = minPolicy(a, b);
  const other = minPolicy(b, a);
  return (
    seamKeyFor(shared, edgeA, origin) === seamKeyFor(other, edgeA, origin) &&
    seamKeyFor(shared, edgeB, origin) === seamKeyFor(other, edgeB, origin)
  );
}

/* ════════════════════════════════════════════════════════ 6 · FUSION ══ */

const prefixGraph = (g: TexGraph, p: string): TexGraph => ({
  ...g,
  nodes: g.nodes.map((n) => {
    const c: TexNode = { ...n, id: p + n.id };
    for (const k of EDGE_KEYS) if (typeof c[k] === "string") c[k] = p + (c[k] as string);
    return c;
  }),
  out: {
    albedo: g.out.albedo ? p + g.out.albedo : undefined,
    height: g.out.height ? p + g.out.height : undefined,
    roughness: g.out.roughness ? p + g.out.roughness : undefined,
  },
});

function mergeAffinity(
  x: Cartridge["affinity"], y: Cartridge["affinity"], f: number,
): Cartridge["affinity"] {
  const o: Cartridge["affinity"] = {};
  for (const k of ["pxd", "vtx", "lx", "aq"] as MetricKey[]) {
    const v = (x[k] ?? 1) * (1 - f) + (y[k] ?? 1) * f;
    if (Math.abs(v - 1) > 0.01) o[k] = +v.toFixed(2);
  }
  return o;
}

/**
 *  A real DAG merge. Copy-on-write: parents are never mutated; the child is
 *  a new immutable revision carrying both parent hashes in `parents[]`.
 *    MATERIAL + OPERATOR → operator warps albedo AND height in lockstep
 *    MATERIAL + MATERIAL → albedo mix · height overlay · roughness max
 *    OPERATOR + OPERATOR → chained warp = a new compound verb
 *    ANY      + RULE     → the rule's height field becomes the blend mask
 */
export function fuse(a: Cartridge, b: Cartridge, dominance: number, seed = 0): FusionResult {
  const A = prefixGraph(a.graph, "a_");
  const B = prefixGraph(b.graph, "b_");
  const nodes: TexNode[] = [...A.nodes, ...B.nodes];
  const added: string[] = [];
  const f = clamp01(dominance);
  const push = (n: TexNode) => { nodes.push(n); added.push(`${n.id} (${n.type})`); return n.id; };

  let out: TexGraph["out"], rationale: string, confidence: number, cls: CartClass;

  if (a.cls === "RULE" || b.cls === "RULE") {
    const rule = a.cls === "RULE" ? A : B;
    const subj = a.cls === "RULE" ? B : A;
    out = {
      albedo: push({ id: "fx_rule_albedo", type: "blend", a: subj.out.albedo,
        b: rule.out.albedo ?? subj.out.albedo, mode: "mix",
        mask: rule.out.height ?? rule.out.albedo, factor: f }),
      height: push({ id: "fx_rule_height", type: "blend", a: subj.out.height,
        b: rule.out.height ?? subj.out.height, mode: "max", factor: f }),
      roughness: subj.out.roughness,
    };
    cls = (subj === A ? a.cls : b.cls);
    confidence = 88;
    rationale =
      "A RULE places nothing — it decides WHERE another preset applies. Its height field is wired in as the blend mask, so the child keeps working as the terrain changes under it.";
  } else if (a.cls === "OPERATOR" && b.cls === "OPERATOR") {
    const w = push({ id: "fx_chain", type: "warp", input: A.out.height, by: B.out.height, amount: 0.04 + f * 0.22 });
    out = {
      albedo: push({ id: "fx_chain_albedo", type: "ramp", input: w, interpolation: "smooth",
        stops: [{ t: 0, color: [0.16, 0.16, 0.2] }, { t: 0.55, color: [0.5, 0.48, 0.44] }, { t: 1, color: [0.92, 0.9, 0.84] }] }),
      height: w,
      roughness: A.out.roughness ?? B.out.roughness,
    };
    cls = "OPERATOR"; confidence = 71;
    rationale = "VERB + VERB composes into a new verb: the second operator's field drives the first's domain warp.";
  } else if (a.cls === "OPERATOR" || b.cls === "OPERATOR") {
    const op = a.cls === "OPERATOR" ? A : B;
    const mat = a.cls === "OPERATOR" ? B : A;
    const amount = 0.02 + f * 0.3;
    const drv = op.out.height ?? op.out.albedo;
    out = {
      albedo: push({ id: "fx_warp_albedo", type: "warp", input: mat.out.albedo, by: drv, amount }),
      height: push({ id: "fx_op_height", type: "blend",
        a: push({ id: "fx_warp_height", type: "warp", input: mat.out.height, by: drv, amount }),
        b: op.out.height, mode: "overlay", factor: f * 0.7 }),
      roughness: mat.out.roughness,
    };
    cls = "MATERIAL"; confidence = 93;
    rationale = "NOUN + VERB: one coordinate transform deforms albedo and height together, so colour and form never desynchronise.";
  } else {
    out = {
      albedo: push({ id: "fx_mix_albedo", type: "blend", a: A.out.albedo, b: B.out.albedo, mode: "mix", factor: f }),
      height: push({ id: "fx_mix_height", type: "blend", a: A.out.height, b: B.out.height, mode: "overlay", factor: f }),
      roughness: A.out.roughness && B.out.roughness
        ? push({ id: "fx_mix_rough", type: "blend", a: A.out.roughness, b: B.out.roughness, mode: "max", factor: f })
        : (A.out.roughness ?? B.out.roughness),
    };
    cls = "MATERIAL"; confidence = 84;
    rationale = "NOUN + NOUN negotiates a third substance: albedo mixes, height overlays so both silhouettes survive, roughness takes the max.";
  }

  const graph: TexGraph = {
    id: `fus_${contentHash([a.hash, b.hash, +f.toFixed(3), seed]).slice(2)}`,
    name: `${a.name} × ${b.name}`,
    nodes, out,
  };

  const vars: VarDecl[] = [
    { path: "fusion.dominance", label: "Dominance", real: "blend factor", unit: "—",
      min: 0, max: 1, step: 0.01, def: f,
      explain: "Which parent wins where the two graphs disagree.", tier: 1 as const },
    ...[...a.vars, ...b.vars].slice(0, 7),
  ].slice(0, 8);

  const header = {
    id: graph.id, rev: 1, name: graph.name, kind: "setmix.cartridge" as const,
    parents: [a.hash, b.hash], author: "fusion-matrix", cls, graph, vars,
    minStage: Math.max(a.minStage, b.minStage) as Stage,
    affinity: mergeAffinity(a.affinity, b.affinity, f),
    tint: f > 0.5 ? b.tint : a.tint,
  };

  return {
    child: { ...header, hash: contentHash(header) },
    confidence, grammar: `${a.cls} + ${b.cls}`, rationale, addedNodes: added,
  };
}

/* ════════════════════════════════════════════════════ 7 · CERTIFICATE ══ */

export const NODE_WEIGHT: Readonly<Record<string, number>> = Object.freeze({
  constant: 1, checker: 1, grain: 1, stripes: 2, invert: 1, scaleBias: 1,
  levels: 2, blend: 2, ramp: 3, curl: 5, warp: 4, cellular: 9, noise: 1,
});

export function graphCost(g: TexGraph, size: number) {
  let weight = 0;
  for (const n of g.nodes) {
    const base = NODE_WEIGHT[n.type] ?? 1;
    weight += n.type === "noise" ? base + Math.max(1, Math.round((n.octaves as number) ?? 4)) : base;
  }
  return { weight, texels: size * size, evalMs: (weight * size * size) / 2.6e6 };
}

const S1_STATE: FidelityState = { pxd: 2e3, vtx: 1e3, lx: 4e2, aq: 0, tick: 0 };
const S6_STATE: FidelityState = { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 3.5e7, tick: 0 };

/** The export gate. A bundle must survive both ends of the ladder, stay
 *  inside its declared budget and carry a usable schema, or it does not ship. */
export function certify(c: Cartridge, dev: DeviceProfile): Certificate {
  const failures: string[] = [];
  const low = deriveBudget(S1_STATE, dev);
  const high = deriveBudget(S6_STATE, dev);
  const gLow = adaptGraph(c.graph, low);
  const gHigh = adaptGraph(c.graph, high);
  const cost = graphCost(gHigh, high.size);

  if (!gLow.out.albedo) failures.push("S1 adaptation lost the albedo output");
  if (!gHigh.out.albedo) failures.push("S6 adaptation lost the albedo output");
  if (cost.evalMs > dev.msBudget * 0.5)
    failures.push(`S6 eval ${cost.evalMs.toFixed(2)}ms exceeds half the frame budget`);
  if (c.vars.length > 8) failures.push(`${c.vars.length} exposed vars — the cap is 8`);

  const ids = new Set(gHigh.nodes.map((n) => n.id));
  for (const n of gHigh.nodes)
    for (const k of EDGE_KEYS)
      if (typeof n[k] === "string" && !ids.has(n[k] as string))
        failures.push(`orphan edge ${n.id}.${k} → ${String(n[k])}`);

  for (const v of c.vars) {
    if (!v.explain || v.explain.length < 12) failures.push(`var ${v.path} has no explanation`);
    if (v.def < v.min || v.def > v.max) failures.push(`var ${v.path} default out of range`);
  }

  return {
    nodes: c.graph.nodes.length, weight: cost.weight, texels: cost.texels,
    evalMs: cost.evalMs, minStage: c.minStage, determinism: "seed-stable",
    pass: failures.length === 0, failures,
  };
}

export { TICK_HZ, FI_WEIGHTS, METRIC_TARGET, STAGE_FI, TEXEL_LADDER, CELL_LADDER };
