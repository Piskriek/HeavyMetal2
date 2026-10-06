/* ============================================================================
   @hm/setmix-contracts  +  @hm/setmix-fidelity
   Types only + pure functions. Obeys kernel principle 6: packages talk
   ONLY through contracts. No imports from kernel/sim/platform — those
   wire us up, we never reach into them.
   ========================================================================== */

import type { TexGraph, TexNode, EvaluateOptions } from "@/engine/texgraph";
import { graphCost } from "@/engine/texgraph";

/* ───────────────────────────────── kernel contracts we conform to ──────── */

/** Mirrors packages/contracts/src/schema.ts — every parameter is a Variable.
 *  `label` is the poetic name, `real` is the true technical term.
 *  Jargon Mode is literally a UI toggle between two fields of this record. */
export interface VarDecl {
  path: string; // "material.noise.octaves"
  label: string; // "Grain Depth"
  real: string; // "fBm octaves"
  unit: string; // "octaves" | "m" | "×" | "°" | "—"
  min: number;
  max: number;
  step: number;
  def: number;
  explain: string; // the one-sentence explanation the kernel demands
  tier: 1 | 2 | 3; // play | build | pro  (the three depths)
}

/** Mirrors packages/contracts/src/preset.ts — one node type: Preset. */
export interface PresetHeader {
  id: string;
  rev: number;
  name: string;
  kind: string; // "setmix.cartridge"
  hash: string; // content hash, immutable per revision
  parents: string[]; // copy-on-write fork lineage
  author: string;
}

/** Mirrors packages/contracts/src/core.ts — all edits are Commands. */
export interface Command<T = unknown> {
  type: string;
  at: number; // sim tick (120 Hz) — replayable
  payload: T;
}

/* ───────────────────────────────────────────── SetMix domain contracts ── */

export type MetricKey = "pxd" | "vtx" | "lx" | "aq";
export type CartClass = "MATERIAL" | "OPERATOR" | "RULE" | "BIOME" | "MESH" | "RIG";
export const TICK_HZ = 120;

export interface FidelityState {
  pxd: number;
  vtx: number;
  lx: number;
  aq: number;
  tick: number;
}

export interface Emitter {
  id: string;
  metric: MetricKey;
  tier: 0 | 1 | 2 | 3;
  base: number; // units/s at T1
  clock: number; // cyc/s demand
  cartridge?: string; // slotted cartridge id
  pos: [number, number];
}

export interface Cartridge extends PresetHeader {
  kind: "setmix.cartridge";
  cls: CartClass;
  graph: TexGraph; // the @hm/texgraph payload — THIS is the preset body
  vars: VarDecl[]; // generated UI, max 8 exposed
  minStage: 1 | 2 | 3 | 4 | 5 | 6;
  affinity: Partial<Record<MetricKey, number>>; // yield multiplier when slotted
  tint: string;
}

/* ───────────────────────────────────────────────────── fidelity maths ── */

export const FI_WEIGHTS: Record<MetricKey, number> = {
  pxd: 0.3,
  vtx: 0.3,
  lx: 0.25,
  aq: 0.15,
};

/** Stage-6 normalisation targets (the GDD's 100M-Fi planet). */
export const METRIC_TARGET: Record<MetricKey, number> = {
  pxd: 1.24e8,
  vtx: 9.4e7,
  lx: 6.6e7,
  aq: 4.1e7,
};

export const STAGE_FI: number[] = [0, 1.2e3, 3.0e4, 7.5e5, 5.0e6, 2.6e7, 1.0e8];

/** C = 1 − 0.45·σ(n̂)/μ(n̂) — the balance term. Pure, deterministic. */
export function coherence(s: FidelityState): number {
  const n = (Object.keys(FI_WEIGHTS) as MetricKey[]).map((k) => s[k] / METRIC_TARGET[k]);
  const mu = n.reduce((a, b) => a + b, 0) / 4;
  if (mu <= 1e-12) return 1;
  const sd = Math.sqrt(n.reduce((a, b) => a + (b - mu) ** 2, 0) / 4);
  return Math.max(0.35, Math.min(1, 1 - 0.45 * (sd / mu)));
}

/** Fi = (Pxd^.30 · Vtx^.30 · Lx^.25 · Aq^.15) · C */
export function fidelityIndex(s: FidelityState): number {
  const p = Math.max(s.pxd, 1e-6) ** FI_WEIGHTS.pxd;
  const v = Math.max(s.vtx, 1e-6) ** FI_WEIGHTS.vtx;
  const l = Math.max(s.lx, 1e-6) ** FI_WEIGHTS.lx;
  const a = Math.max(s.aq, 1e-6) ** FI_WEIGHTS.aq;
  return p * v * l * a * coherence(s);
}

export function stageOf(fi: number): 1 | 2 | 3 | 4 | 5 | 6 {
  for (let i = 6; i >= 1; i--) if (fi >= STAGE_FI[i - 1]) return i as 1 | 2 | 3 | 4 | 5 | 6;
  return 1;
}

/** Metric 0..1 progress used by the renderer / governor.
 *  Log ratio, then a 2.5 power so the six stages land exactly on the
 *  texel ladder 16·32·64·128·256·512 (verified by the golden table). */
export function normalised(s: FidelityState): Record<MetricKey, number> {
  const f = (v: number, t: number) =>
    Math.pow(Math.min(1, Math.max(0, Math.log1p(Math.max(0, v)) / Math.log1p(t))), 2.5);
  return {
    pxd: f(s.pxd, METRIC_TARGET.pxd),
    vtx: f(s.vtx, METRIC_TARGET.vtx),
    lx: f(s.lx, METRIC_TARGET.lx),
    aq: f(s.aq, METRIC_TARGET.aq),
  };
}

const TIER_MULT = [1, 6.5, 42, 400];

/** Deterministic fixed-step integrator. Called from @hm/sim at 120 Hz.
 *  No Date.now(), no Math.random() — time and randomness are injected. */
export function stepFidelity(
  s: FidelityState,
  emitters: Emitter[],
  carts: Map<string, Cartridge>,
  opts: { clockSupply: number; maintenance: number; ticks?: number } = {
    clockSupply: Infinity,
    maintenance: 1,
  },
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

  const fi = fidelityIndex(s);
  const drain = 0.015 * Math.pow(Math.max(fi, 0), 0.82) * (1 - opts.maintenance);
  const share: Record<MetricKey, number> = FI_WEIGHTS;

  return {
    pxd: Math.max(0, s.pxd + (add.pxd - drain * share.pxd * 4) * dt),
    vtx: Math.max(0, s.vtx + (add.vtx - drain * share.vtx * 4) * dt),
    lx: Math.max(0, s.lx + (add.lx - drain * share.lx * 4) * dt),
    aq: Math.max(0, s.aq + (add.aq - drain * share.aq * 4) * dt),
    tick: s.tick + ticks,
  };
}

/* ───────────────────────────────── coherence (player survival) ────────── */

export interface SurvivalInput {
  distToHost: number;
  shelter: 0 | 0.72 | 1; // none | beacon | spire
  stormMult: 1 | 2.4 | 3.8;
  suitTier: 1 | 2 | 3 | 4;
}

export function coherenceRate(i: SurvivalInput) {
  const regen = (i.shelter === 1 ? 6 : i.shelter === 0.72 ? 2.5 : 0) + [0.4, 0.8, 1.2, 1.6][i.suitTier - 1];
  const drain = 0.9 * (1 - i.shelter) * Math.pow(1 + i.distToHost / 400, 1.3) * i.stormMult;
  return { regen, drain, net: regen - drain };
}

/* ════════════════════════════════════════════════════════════════════════
   @hm/setmix-governor — THE BRIDGE.
   FidelityState → EvaluateOptions. This single function is the entire
   "terraforming = resolution" thesis expressed as code.
   ════════════════════════════════════════════════════════════════════════ */

export interface DeviceProfile {
  id: string;
  label: string;
  maxTexel: 16 | 32 | 64 | 128 | 256 | 512;
  msBudget: number;
  allowNormal: boolean;
  allowWarp: boolean;
  maxOctaves: number;
}

export const DEVICES: DeviceProfile[] = [
  { id: "potato", label: "GTX 1050 / Deck", maxTexel: 128, msBudget: 16.6, allowNormal: true, allowWarp: true, maxOctaves: 4 },
  { id: "mid", label: "RTX 3060", maxTexel: 256, msBudget: 16.6, allowNormal: true, allowWarp: true, maxOctaves: 6 },
  { id: "ultra", label: "RTX 4080", maxTexel: 512, msBudget: 8.3, allowNormal: true, allowWarp: true, maxOctaves: 8 },
  { id: "mobile", label: "Mobile / RUN web", maxTexel: 64, msBudget: 16.6, allowNormal: false, allowWarp: false, maxOctaves: 3 },
];

export interface RenderBudget {
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  size: 16 | 32 | 64 | 128 | 256 | 512;
  octaveBudget: number;
  relief: number;
  normal: boolean;
  roughness: boolean;
  paletteLevels: number; // -1 = 4-colour ramp, 0 = truecolour
  shadowCascades: number;
  allowWarp: boolean;
  allowCellular: boolean;
  wetness: number;
  demoted: string[];
}

const TEXEL_LADDER: RenderBudget["size"][] = [16, 32, 64, 128, 256, 512];

/** Pxd → texel count. Vtx → relief. Lx → shading model. Aq → wetness.
 *  Device profile clamps; nothing gameplay-relevant is ever lost. */
export function deriveBudget(s: FidelityState, dev: DeviceProfile): RenderBudget {
  const n = normalised(s);
  const fi = fidelityIndex(s);
  const stage = stageOf(fi);
  const demoted: string[] = [];

  let sizeIdx = Math.round(n.pxd * 5);
  const capIdx = TEXEL_LADDER.indexOf(dev.maxTexel);
  if (sizeIdx > capIdx) {
    sizeIdx = capIdx;
    demoted.push(`texel ${TEXEL_LADDER[Math.round(n.pxd * 5)]}→${dev.maxTexel}`);
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
    size: TEXEL_LADDER[Math.max(0, sizeIdx)],
    octaveBudget: oct,
    relief: 0.15 + n.vtx * 1.55,
    normal,
    roughness: n.lx > 0.1,
    paletteLevels: n.pxd < 0.12 ? -1 : n.pxd < 0.3 ? 3 : n.pxd < 0.5 ? 6 : n.pxd < 0.72 ? 16 : 0,
    shadowCascades: Math.min(4, Math.floor(n.lx * 5)),
    allowWarp,
    allowCellular,
    wetness: Math.max(0, (n.aq - 0.22) / 0.78),
    demoted,
  };
}

export function toEvaluateOptions(b: RenderBudget, seed: number): EvaluateOptions {
  return { size: b.size, seed, relief: b.relief, normal: b.normal };
}

/* ─────────────────────────────── graph adaptation (same bundle, any stage) */

const SEA: [number, number, number] = [0.07, 0.3, 0.42];

/** Rewrites a cartridge graph to fit the budget. The SAME 90 kB bundle
 *  renders as 14 flat polygons at S2 and a raytraced landmark at S6 —
 *  this function is why. Pure, deterministic, allocation-light. */
export function adaptGraph(g: TexGraph, b: RenderBudget): TexGraph {
  const keep = new Map<string, TexNode>();
  const alias = new Map<string, string>();
  const lowRes = new Set<string>();

  for (const n of g.nodes) {
    const c: TexNode = { ...n };

    if (c.type === "noise" && typeof c.octaves === "number") {
      c.octaves = Math.min(c.octaves as number, b.octaveBudget);
    }
    // Q5 · palette quantisation now happens INSIDE the evaluator.
    // Stage 1's 2-bit look used to cost a full-screen post pass; with
    // interpolation:"constant" it costs nothing and, more importantly, a
    // cartridge authored at Stage 6 renders correctly at Stage 1 without
    // the renderer being involved at all.
    if (c.type === "ramp") {
      c.interpolation =
        b.paletteLevels === -1 ? "constant" : b.paletteLevels === 0 ? "smooth" : "linear";
    }
    // Q3 · the 2-channel curl driver is exact but costs a gradient pass.
    // Below 64 texels the vortices are sub-texel anyway, so we degrade to a
    // 1-channel scalar offset and let the warp take its legacy `by` path.
    if (c.type === "curl" && b.size <= 32) {
      keep.set(c.id, { id: c.id, type: "noise", freq: 2.5, octaves: 2, seed: 101 });
      lowRes.add(c.id);
      continue;
    }
    if (c.type === "warp" && typeof c.vectorField === "string" && b.size <= 32) {
      c.by = c.vectorField as string;
      delete c.vectorField;
    }
    if (c.type === "cellular" && !b.allowCellular) {
      // substitute: a 2-octave noise reads close enough at ≤64 texels
      alias.set(c.id, c.id);
      keep.set(c.id, { id: c.id, type: "noise", freq: (c.freq as number) ?? 6, octaves: 2, seed: c.seed ?? 0 });
      continue;
    }
    if (c.type === "warp" && !b.allowWarp) {
      // bypass the operator, pass its input straight through
      alias.set(c.id, (c.input as string) ?? c.id);
      continue;
    }
    keep.set(c.id, c);
  }

  // re-point any edge that referenced a bypassed node
  const resolve = (id?: string): string | undefined => {
    let cur = id;
    for (let i = 0; i < 8 && cur && alias.has(cur) && alias.get(cur) !== cur; i++) cur = alias.get(cur);
    return cur;
  };
  const nodes: TexNode[] = [];
  for (const n of keep.values()) {
    const c: TexNode = { ...n };
    for (const k of ["input", "a", "b", "by", "mask"]) {
      if (typeof c[k] === "string") c[k] = resolve(c[k] as string);
    }
    nodes.push(c);
  }

  const out = { ...g.out };
  out.albedo = resolve(out.albedo);
  out.height = resolve(out.height);
  out.roughness = b.roughness ? resolve(out.roughness) : undefined;

  // Hydrology: Aq injects a wetness darkening pass into every albedo on the planet
  if (b.wetness > 0.01 && out.albedo) {
    const wet: TexNode = {
      id: "__wet_src",
      type: "constant",
      rgb: [SEA[0], SEA[1], SEA[2]],
    };
    const mask: TexNode = {
      id: "__wet_mask",
      type: "invert",
      input: out.height ?? out.albedo,
    };
    const mix: TexNode = {
      id: "__wet_mix",
      type: "blend",
      a: out.albedo,
      b: "__wet_src",
      mode: "mul",
      factor: Math.min(0.75, b.wetness * 0.8),
      mask: "__wet_mask",
    };
    nodes.push(wet, mask, mix);
    out.albedo = "__wet_mix";

    if (out.roughness) {
      const rgh: TexNode = {
        id: "__wet_rough",
        type: "levels",
        input: out.roughness,
        inLow: 0,
        inHigh: 1,
        outLow: 0,
        outHigh: Math.max(0.12, 1 - b.wetness * 0.8),
      };
      nodes.push(rgh);
      out.roughness = "__wet_rough";
    }
  }

  return { id: `${g.id}@s${b.stage}`, name: g.name, nodes, out };
}

/* ════════════════════════════════════════════════════════════════════════
   @hm/setmix-cartridge — content hashing, certificates, .setmix bundles
   ════════════════════════════════════════════════════════════════════════ */

/** FNV-1a 32-bit over a stable key-sorted serialisation. Deterministic
 *  across machines — required for the kernel's content-hash identity. */
export function contentHash(v: unknown): string {
  const stable = (x: unknown): string => {
    if (x === null || x === undefined) return "n";
    if (Array.isArray(x)) return "[" + x.map(stable).join(",") + "]";
    if (typeof x === "object") {
      const o = x as Record<string, unknown>;
      return "{" + Object.keys(o).sort().map((k) => k + ":" + stable(o[k])).join(",") + "}";
    }
    return typeof x === "number" ? (Number.isInteger(x) ? String(x) : x.toFixed(6)) : String(x);
  };
  const s = stable(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "0x" + h.toString(16).padStart(8, "0");
}

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

/** The export gate. A bundle must render correctly at BOTH ends of the
 *  ladder and stay inside its declared budget, or it does not publish. */
export function certify(c: Cartridge, dev: DeviceProfile): Certificate {
  const failures: string[] = [];
  const low = deriveBudget({ pxd: 2e3, vtx: 1e3, lx: 4e2, aq: 0, tick: 0 }, dev);
  const high = deriveBudget({ pxd: 9e7, vtx: 8e7, lx: 6e7, aq: 3.5e7, tick: 0 }, dev);

  const gLow = adaptGraph(c.graph, low);
  const gHigh = adaptGraph(c.graph, high);
  const costHigh = graphCost(gHigh, high.size);

  if (!gLow.out.albedo) failures.push("S2 adaptation lost the albedo output");
  if (!gHigh.out.albedo) failures.push("S6 adaptation lost the albedo output");
  if (costHigh.evalMs > dev.msBudget * 0.5)
    failures.push(`S6 eval ${costHigh.evalMs.toFixed(2)}ms exceeds half the frame budget`);
  if (c.vars.length > 8) failures.push(`${c.vars.length} exposed vars — the cap is 8`);
  for (const v of c.vars) {
    if (!v.explain || v.explain.length < 12) failures.push(`var ${v.path} has no explanation`);
    if (v.def < v.min || v.def > v.max) failures.push(`var ${v.path} default out of range`);
  }

  return {
    nodes: c.graph.nodes.length,
    weight: costHigh.weight,
    texels: costHigh.texels,
    evalMs: costHigh.evalMs,
    minStage: c.minStage,
    determinism: "seed-stable",
    pass: failures.length === 0,
    failures,
  };
}

export function toBundle(c: Cartridge, cert: Certificate) {
  return {
    setmix: "1.0",
    kind: c.kind,
    id: c.id,
    rev: c.rev,
    hash: c.hash,
    author: c.author,
    class: c.cls,
    parents: c.parents,
    graph: { nodes: c.graph.nodes.length, out: c.graph.out, hash: contentHash(c.graph) },
    params: c.vars.map((v) => ({
      name: v.label,
      real: v.real,
      path: v.path,
      unit: v.unit,
      min: v.min,
      max: v.max,
      def: v.def,
      tier: v.tier,
    })),
    cost: { weight: cert.weight, evalMs: +cert.evalMs.toFixed(3), texels: cert.texels },
    minStage: c.minStage,
    affinity: c.affinity,
    determinism: "seed-stable",
    licence: "CC-BY-SA-SETMIX",
  };
}

/* ════════════════════════════════════════════════════════════════════════
   @hm/setmix-fusion — the Fusion Matrix as a real DAG merge.
   Copy-on-write fork: parents are never mutated, the child is a new
   immutable revision with its own content hash.
   ════════════════════════════════════════════════════════════════════════ */

export interface FusionResult {
  child: Cartridge | null;
  confidence: number;
  grammar: string;
  rationale: string;
  addedNodes: string[];
}

const prefixGraph = (g: TexGraph, p: string): TexGraph => ({
  ...g,
  nodes: g.nodes.map((n) => {
    const c: TexNode = { ...n, id: p + n.id };
    for (const k of ["input", "a", "b", "by", "mask"]) {
      if (typeof c[k] === "string") c[k] = p + (c[k] as string);
    }
    return c;
  }),
  out: {
    albedo: g.out.albedo ? p + g.out.albedo : undefined,
    height: g.out.height ? p + g.out.height : undefined,
    roughness: g.out.roughness ? p + g.out.roughness : undefined,
  },
});

/** Grammar:
 *    MATERIAL + OPERATOR → behavioural asset  (operator warps the material)
 *    MATERIAL + MATERIAL → hybrid material    (albedo/height blend)
 *    OPERATOR + OPERATOR → compound operator  (chained warp)
 *    ANY      + RULE     → spatial governance (rule becomes the blend mask)
 */
export function fuse(a: Cartridge, b: Cartridge, dominance: number, seed = 0): FusionResult {
  const A = prefixGraph(a.graph, "a_");
  const B = prefixGraph(b.graph, "b_");
  const nodes: TexNode[] = [...A.nodes, ...B.nodes];
  const added: string[] = [];
  const f = Math.min(1, Math.max(0, dominance));

  const grammar = `${a.cls} + ${b.cls}`;
  let out: TexGraph["out"];
  let rationale: string;
  let confidence: number;
  let cls: CartClass;

  const push = (n: TexNode) => {
    nodes.push(n);
    added.push(`${n.id} (${n.type})`);
    return n.id;
  };

  if (b.cls === "RULE" || a.cls === "RULE") {
    const rule = a.cls === "RULE" ? A : B;
    const subj = a.cls === "RULE" ? B : A;
    const maskId = rule.out.height ?? rule.out.albedo!;
    const al = push({
      id: "fx_rule_albedo",
      type: "blend",
      a: subj.out.albedo,
      b: rule.out.albedo ?? subj.out.albedo,
      mode: "mix",
      mask: maskId,
      factor: f,
    });
    const hg = push({
      id: "fx_rule_height",
      type: "blend",
      a: subj.out.height,
      b: rule.out.height ?? subj.out.height,
      mode: "max",
      factor: f,
    });
    out = { albedo: al, height: hg, roughness: subj.out.roughness };
    cls = subj === A ? a.cls : b.cls;
    rationale =
      "A RULE does not place anything — it decides WHERE another preset applies. The rule's height field is wired in as the blend mask, so the child keeps working as the terrain changes underneath it.";
    confidence = 88;
  } else if (a.cls === "OPERATOR" && b.cls === "OPERATOR") {
    const w1 = push({ id: "fx_chain_1", type: "warp", input: A.out.height, by: B.out.height, amount: 0.04 + f * 0.22 });
    const al = push({ id: "fx_chain_albedo", type: "ramp", input: w1, stops: [
      { t: 0, color: [0.16, 0.16, 0.2] },
      { t: 0.55, color: [0.5, 0.48, 0.44] },
      { t: 1, color: [0.92, 0.9, 0.84] },
    ] });
    out = { albedo: al, height: w1, roughness: A.out.roughness ?? B.out.roughness };
    cls = "OPERATOR";
    rationale =
      "VERB + VERB composes into a new verb. The second operator's field drives the first's domain warp, producing a compound operator you can apply to any material later.";
    confidence = 71;
  } else if (a.cls === "OPERATOR" || b.cls === "OPERATOR") {
    const op = a.cls === "OPERATOR" ? A : B;
    const mat = a.cls === "OPERATOR" ? B : A;
    const amount = 0.02 + f * 0.3;
    const wa = push({ id: "fx_warp_albedo", type: "warp", input: mat.out.albedo, by: op.out.height ?? op.out.albedo, amount });
    const wh = push({ id: "fx_warp_height", type: "warp", input: mat.out.height, by: op.out.height ?? op.out.albedo, amount });
    const hb = push({ id: "fx_op_height", type: "blend", a: wh, b: op.out.height, mode: "overlay", factor: f * 0.7 });
    out = { albedo: wa, height: hb, roughness: mat.out.roughness };
    cls = "MATERIAL";
    rationale =
      "NOUN + VERB is the workhorse: the operator's field becomes the domain-warp driver for the material's albedo AND height together, so colour and form deform in lockstep. No seams, because it is one coordinate transform.";
    confidence = 93;
  } else {
    const al = push({ id: "fx_mix_albedo", type: "blend", a: A.out.albedo, b: B.out.albedo, mode: "mix", factor: f });
    const hg = push({ id: "fx_mix_height", type: "blend", a: A.out.height, b: B.out.height, mode: "overlay", factor: f });
    const rg = A.out.roughness && B.out.roughness
      ? push({ id: "fx_mix_rough", type: "blend", a: A.out.roughness, b: B.out.roughness, mode: "max", factor: f })
      : (A.out.roughness ?? B.out.roughness);
    out = { albedo: al, height: hg, roughness: rg };
    cls = "MATERIAL";
    rationale =
      "NOUN + NOUN negotiates a third substance. Albedo mixes linearly, height uses overlay so both parents keep their silhouette detail, and roughness takes the max — a wet-looking parent never loses to a dry one.";
    confidence = 84;
  }

  const graph: TexGraph = {
    id: `fus_${contentHash([a.hash, b.hash, +f.toFixed(3), seed]).slice(2)}`,
    name: `${a.name} × ${b.name}`,
    nodes,
    out,
  };

  const vars: VarDecl[] = [
    {
      path: "fusion.dominance",
      label: "Dominance",
      real: "blend factor",
      unit: "—",
      min: 0,
      max: 1,
      step: 0.01,
      def: f,
      explain: "Which parent wins where the two graphs disagree.",
      tier: 1 as const,
    },
    ...[...a.vars, ...b.vars].slice(0, 7),
  ].slice(0, 8);

  const header = {
    id: graph.id,
    rev: 1,
    name: graph.name,
    kind: "setmix.cartridge" as const,
    parents: [a.hash, b.hash],
    author: "fusion-matrix",
    cls,
    graph,
    vars,
    minStage: Math.max(a.minStage, b.minStage) as Cartridge["minStage"],
    affinity: mergeAffinity(a.affinity, b.affinity, f),
    tint: f > 0.5 ? b.tint : a.tint,
  };

  const child: Cartridge = { ...header, hash: contentHash(header) };
  return { child, confidence, grammar, rationale, addedNodes: added };
}

function mergeAffinity(
  x: Cartridge["affinity"],
  y: Cartridge["affinity"],
  f: number,
): Cartridge["affinity"] {
  const o: Cartridge["affinity"] = {};
  for (const k of ["pxd", "vtx", "lx", "aq"] as MetricKey[]) {
    const a = x[k] ?? 1,
      b = y[k] ?? 1;
    const v = a * (1 - f) + b * f;
    if (Math.abs(v - 1) > 0.01) o[k] = +v.toFixed(2);
  }
  return o;
}

/* ════════════════════════════════════════════════════════════════════════
   Commands — every edit is replayable (kernel principle 4)
   ════════════════════════════════════════════════════════════════════════ */

export type SetmixCommand =
  | Command<{ emitterId: string; cartridgeId: string | null }> // SlotCartridge
  | Command<{ a: string; b: string; dominance: number }> // Fuse
  | Command<{ path: string; value: number }> // SetVariable
  | Command<{ cartridgeId: string }>; // PrintCartridge

export const COMMANDS = [
  { type: "setmix/slotCartridge", payload: "{ emitterId, cartridgeId|null }", undo: "re-slot previous id; wave recedes at 2× speed" },
  { type: "setmix/fuse", payload: "{ a, b, dominance }", undo: "drop child revision; parents untouched (copy-on-write)" },
  { type: "setmix/setVariable", payload: "{ path, value }", undo: "restore previous value from the variable journal" },
  { type: "setmix/printCartridge", payload: "{ cartridgeId }", undo: "dust down, refund 60% of materials" },
  { type: "setmix/placeEmitter", payload: "{ id, metric, tier, pos }", undo: "remove, refund full cost inside 30 s" },
  { type: "setmix/overclock", payload: "{ reactorId, factor }", undo: "not undoable — thermal state is simulated" },
];
