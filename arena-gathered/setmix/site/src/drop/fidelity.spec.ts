/* ============================================================================
 *  packages/fidelity/test/specs.ts
 *  ---------------------------------------------------------------------------
 *  The assertions themselves, as data. Imported by:
 *    · fidelity.test.ts   (node:test wrapper — CI)
 *    · apps/web harness   (the live runner in the design document)
 *  One definition, two runners. No drift between what CI checks and what the
 *  documentation claims.
 * ==========================================================================*/

import type { Cartridge, FidelityState, MeshPolicy, Stage } from "./contracts.setmix";
import { STAGE_FI, TEXEL_LADDER } from "./contracts.setmix";
import {
  adaptGraph, certify, coherence, contentHash, deriveBudget, DEVICES,
  fidelityIndex, fuse, graphCost, meshPolicyFor, minPolicy, normalised,
  seamKeyFor, seamsAgree, stageOf, stepFidelity,
} from "./fidelity";

/* ─────────────────────────────── tiny assertion kit (no deps) ─────────── */

export class AssertionError extends Error {}
export const ok = (c: boolean, m: string) => { if (!c) throw new AssertionError(m); };
export const eq = (a: unknown, b: unknown, m: string) => {
  if (!Object.is(a, b)) throw new AssertionError(`${m} — got ${String(a)}, want ${String(b)}`);
};
export const near = (a: number, b: number, eps: number, m: string) => {
  if (!(Math.abs(a - b) <= eps)) throw new AssertionError(`${m} — |${a} − ${b}| > ${eps}`);
};

export interface Spec {
  group: string;
  name: string;
  /** returns a short evidence string shown by the live runner */
  run: () => string;
}

/* ───────────────────────────────────────────── fixtures (deterministic) ── */

const mkCart = (id: string, cls: Cartridge["cls"], nodes: Cartridge["graph"]["nodes"]): Cartridge => {
  const header = {
    id, rev: 1, name: id, kind: "setmix.cartridge" as const, parents: [] as string[],
    author: "test", cls, minStage: 1 as Stage, affinity: {}, tint: "#fff",
    graph: { id, name: id, nodes, out: { albedo: "alb", height: "h", roughness: "h" } },
    vars: [{
      path: "n.freq", label: "Coarseness", real: "base frequency", unit: "cyc/tile",
      min: 1, max: 24, step: 0.5, def: 5,
      explain: "How many bumps fit across one tile.", tier: 1 as const,
    }],
  };
  return { ...header, hash: contentHash(header) };
};

export const CART_A = mkCart("rock", "MATERIAL", [
  { id: "n", type: "noise", freq: 5, octaves: 6, seed: 3 },
  { id: "cell", type: "cellular", freq: 8, jitter: 0.8, seed: 5 },
  { id: "h", type: "blend", a: "n", b: "cell", mode: "mix", factor: 0.4 },
  { id: "alb", type: "ramp", input: "h", interpolation: "linear",
    stops: [{ t: 0, color: [0.1, 0.1, 0.12] }, { t: 1, color: [0.8, 0.78, 0.7] }] },
]);

export const CART_B = mkCart("erode", "OPERATOR", [
  { id: "flow", type: "noise", freq: 3, octaves: 4, seed: 77 },
  { id: "streak", type: "stripes", freq: 30, angle: 96, sharpness: 0.1 },
  { id: "h", type: "warp", input: "streak", by: "flow", amount: 0.2 },
  { id: "alb", type: "ramp", input: "h", interpolation: "linear",
    stops: [{ t: 0, color: [0.1, 0.1, 0.1] }, { t: 1, color: [0.9, 0.9, 0.9] }] },
]);

export const CART_C = mkCart("snowline", "RULE", [
  { id: "g", type: "stripes", freq: 0.5, angle: 90, sharpness: 0 },
  { id: "h", type: "levels", input: "g", inLow: 0.55, inHigh: 0.85, gamma: 1 },
  { id: "alb", type: "ramp", input: "h", interpolation: "linear",
    stops: [{ t: 0, color: [0, 0, 0] }, { t: 1, color: [1, 1, 1] }] },
]);

export const CARTS = new Map([CART_A, CART_B, CART_C].map((c) => [c.id, c]));

/** The six canonical planet states, one per stage. */
export const STAGE_STATES: FidelityState[] = [
  { pxd: 4.0e2, vtx: 2.0e2, lx: 4.0e1, aq: 1.0e0, tick: 0 },
  { pxd: 2.6e4, vtx: 1.1e4, lx: 6.0e3, aq: 4.0e1, tick: 0 },
  { pxd: 9.0e5, vtx: 7.0e5, lx: 3.4e5, aq: 1.2e4, tick: 0 },
  { pxd: 7.0e6, vtx: 5.2e6, lx: 3.0e6, aq: 1.6e6, tick: 0 },
  { pxd: 3.4e7, vtx: 2.6e7, lx: 1.8e7, aq: 9.0e6, tick: 0 },
  { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7, tick: 0 },
];

const EDGE_KEYS = ["input", "a", "b", "by", "mask", "potential", "vectorField"] as const;

/* ═══════════════════════════════════════════════════════════ THE SPECS ══ */

export const SPECS: Spec[] = [
  /* ── determinism ───────────────────────────────────────────────────── */
  {
    group: "determinism",
    name: "contentHash is stable over 1,000 repeats",
    run() {
      const first = contentHash(CART_A.graph);
      for (let i = 0; i < 1000; i++) eq(contentHash(CART_A.graph), first, `repeat ${i}`);
      return first;
    },
  },
  {
    group: "determinism",
    name: "contentHash is key-order independent",
    run() {
      const a = { alpha: 1, beta: [2, 3], gamma: { x: 0.1234567, y: 2 } };
      const b = { gamma: { y: 2, x: 0.1234567 }, beta: [2, 3], alpha: 1 };
      eq(contentHash(a), contentHash(b), "reordered keys must hash equal");
      return contentHash(a);
    },
  },
  {
    group: "determinism",
    name: "float precision is pinned to 6 dp (no IEEE drift)",
    run() {
      eq(contentHash(0.1 + 0.2), contentHash(0.3), "0.1+0.2 must hash as 0.3");
      ok(contentHash(1.0000001) !== contentHash(1.1), "but real differences survive");
      return contentHash(0.3);
    },
  },
  {
    group: "determinism",
    name: "fuse() is a pure function of (a, b, dominance, seed)",
    run() {
      const h = new Set<string>();
      for (let i = 0; i < 1000; i++) h.add(fuse(CART_A, CART_B, 0.6, 7).child!.hash);
      eq(h.size, 1, "1,000 fusions must yield exactly one hash");
      return [...h][0];
    },
  },
  {
    group: "determinism",
    name: "fuse() never mutates its parents (copy-on-write)",
    run() {
      const before = [contentHash(CART_A), contentHash(CART_B)];
      const child = fuse(CART_A, CART_B, 0.75, 1).child!;
      eq(contentHash(CART_A), before[0], "parent A mutated");
      eq(contentHash(CART_B), before[1], "parent B mutated");
      ok(child.parents.includes(CART_A.hash), "child must cite parent A");
      ok(child.parents.includes(CART_B.hash), "child must cite parent B");
      return `child ${child.hash} ← ${child.parents.length} parents`;
    },
  },
  {
    group: "determinism",
    name: "stepFidelity replays identically over 1,200 ticks",
    run() {
      const emit = [
        { id: "a", metric: "pxd" as const, tier: 1 as const, base: 12, clock: 3, cartridge: "rock", pos: [0, 0] as [number, number] },
        { id: "b", metric: "vtx" as const, tier: 0 as const, base: 9, clock: 4, pos: [8, 0] as [number, number] },
        { id: "c", metric: "lx" as const, tier: 2 as const, base: 7, clock: 2, pos: [0, 8] as [number, number] },
      ];
      const run = () => {
        let s: FidelityState = { pxd: 120, vtx: 80, lx: 40, aq: 2, tick: 0 };
        for (let i = 0; i < 1200; i++)
          s = stepFidelity(s, emit, CARTS, { clockSupply: 260, maintenance: 0.8 });
        return contentHash(s);
      };
      eq(run(), run(), "two identical runs diverged");
      return run();
    },
  },

  /* ── fidelity maths ────────────────────────────────────────────────── */
  {
    group: "fidelity",
    name: "coherence is 1.0 for a perfectly balanced planet",
    run() {
      const s: FidelityState = { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7, tick: 0 };
      near(coherence(s), 1, 1e-9, "balanced planet must score C = 1");
      return coherence(s).toFixed(9);
    },
  },
  {
    group: "fidelity",
    name: "coherence floors at 0.35 for a pathological planet",
    run() {
      const s: FidelityState = { pxd: 1.24e8, vtx: 1, lx: 1, aq: 1, tick: 0 };
      near(coherence(s), 0.35, 1e-9, "all-pixels planet must hit the floor");
      return coherence(s).toFixed(4);
    },
  },
  {
    group: "fidelity",
    name: "Fi exponents sum to 1.0 ⇒ linear under uniform scaling",
    run() {
      const base: FidelityState = { pxd: 1e5, vtx: 1e5, lx: 1e5, aq: 1e5, tick: 0 };
      const x10: FidelityState = { pxd: 1e6, vtx: 1e6, lx: 1e6, aq: 1e6, tick: 0 };
      near(fidelityIndex(x10) / fidelityIndex(base), 10, 1e-6, "10× input must give 10× Fi");
      return `${fidelityIndex(base).toFixed(1)} → ${fidelityIndex(x10).toFixed(1)}`;
    },
  },
  {
    group: "fidelity",
    name: "stageOf is monotone and matches STAGE_FI boundaries",
    run() {
      for (let i = 1; i <= 6; i++) eq(stageOf(STAGE_FI[i - 1]), i, `floor of stage ${i}`);
      for (let i = 2; i <= 6; i++) eq(stageOf(STAGE_FI[i - 1] - 1), i - 1, `just below stage ${i}`);
      return "12 boundary probes clean";
    },
  },
  {
    group: "fidelity",
    name: "normalised() is monotone and bounded in [0,1]",
    run() {
      let prev = -1;
      for (const s of STAGE_STATES) {
        const n = normalised(s).pxd;
        ok(n >= 0 && n <= 1, `n=${n} out of range`);
        ok(n > prev, "normalised must strictly increase with the ladder");
        prev = n;
      }
      return `0 → ${prev.toFixed(4)}`;
    },
  },

  /* ── governor: the 24-permutation golden table ─────────────────────── */
  {
    group: "governor",
    name: "golden budget table · 6 stages × 4 devices",
    run() {
      const rows: string[] = [];
      for (const dev of DEVICES)
        for (let i = 0; i < 6; i++) {
          const b = deriveBudget(STAGE_STATES[i], dev);
          ok(TEXEL_LADDER.includes(b.size), `size ${b.size} off the ladder`);
          ok(b.size <= dev.maxTexel, `${dev.id} exceeded its texel cap`);
          ok(b.octaveBudget <= dev.maxOctaves, `${dev.id} exceeded its octave cap`);
          ok(b.relief >= 0.15 && b.relief <= 1.7, "relief out of range");
          ok(b.wetness >= 0 && b.wetness <= 1, "wetness out of range");
          ok(b.shadowCascades >= 0 && b.shadowCascades <= 4, "cascades out of range");
          rows.push(`${dev.id}:S${b.stage}:${b.size}:${b.octaveBudget}`);
        }
      eq(rows.length, 24, "must cover all 24 permutations");
      return contentHash(rows);
    },
  },
  {
    group: "governor",
    name: "stage is device-independent (progression is never gated)",
    run() {
      for (let i = 0; i < 6; i++) {
        const stages = DEVICES.map((d) => deriveBudget(STAGE_STATES[i], d).stage);
        eq(new Set(stages).size, 1, `stage diverged across devices at rung ${i}`);
      }
      return "6 rungs × 4 devices → one stage each";
    },
  },
  {
    group: "governor",
    name: "demotions are reported, never silent",
    run() {
      const mobile = deriveBudget(STAGE_STATES[5], DEVICES[0]);
      const ultra = deriveBudget(STAGE_STATES[5], DEVICES[3]);
      ok(mobile.demoted.length > 0, "mobile at S6 must report demotions");
      eq(ultra.demoted.length, 0, "ultra at S6 must report none");
      return mobile.demoted.join(" · ");
    },
  },
  {
    group: "governor",
    name: "texel ladder is strictly non-decreasing with Pxd",
    run() {
      let prev = 0;
      const seen: number[] = [];
      for (const s of STAGE_STATES) {
        const b = deriveBudget(s, DEVICES[3]);
        ok(b.size >= prev, `size went backwards: ${prev} → ${b.size}`);
        prev = b.size;
        seen.push(b.size);
      }
      return seen.join(" → ");
    },
  },

  /* ── adaptGraph round trip ─────────────────────────────────────────── */
  {
    group: "adaptGraph",
    name: "S1→S6 round trip keeps every cartridge valid",
    run() {
      let checked = 0;
      for (const cart of [CART_A, CART_B, CART_C])
        for (const dev of DEVICES)
          for (const st of STAGE_STATES) {
            const b = deriveBudget(st, dev);
            const g = adaptGraph(cart.graph, b);
            ok(!!g.out.albedo, `${cart.id}@${dev.id}:S${b.stage} lost albedo`);
            ok(g.nodes.length > 0, "graph emptied");
            checked++;
          }
      eq(checked, 72, "3 cartridges × 4 devices × 6 stages");
      return `${checked} adaptations valid`;
    },
  },
  {
    group: "adaptGraph",
    name: "no orphan edges after warp bypass or node substitution",
    run() {
      let edges = 0;
      for (const cart of [CART_A, CART_B, CART_C])
        for (const dev of DEVICES)
          for (const st of STAGE_STATES) {
            const g = adaptGraph(cart.graph, deriveBudget(st, dev));
            const ids = new Set(g.nodes.map((n) => n.id));
            for (const n of g.nodes)
              for (const k of EDGE_KEYS)
                if (typeof n[k] === "string") {
                  ok(ids.has(n[k] as string), `orphan ${n.id}.${k} → ${String(n[k])}`);
                  edges++;
                }
            for (const o of [g.out.albedo, g.out.height, g.out.roughness])
              if (o) ok(ids.has(o), `orphan output → ${o}`);
          }
      return `${edges} edges resolved`;
    },
  },
  {
    group: "adaptGraph",
    name: "octaves are clamped to the device budget everywhere",
    run() {
      for (const dev of DEVICES)
        for (const st of STAGE_STATES) {
          const b = deriveBudget(st, dev);
          for (const n of adaptGraph(CART_A.graph, b).nodes)
            if (n.type === "noise")
              ok((n.octaves as number) <= b.octaveBudget, `${dev.id}: ${n.octaves} > ${b.octaveBudget}`);
        }
      return "24 permutations within budget";
    },
  },
  {
    group: "adaptGraph",
    name: "ramp.interpolation tracks paletteLevels (texgraph Q5)",
    run() {
      const s1 = adaptGraph(CART_A.graph, deriveBudget(STAGE_STATES[0], DEVICES[3]));
      const s6 = adaptGraph(CART_A.graph, deriveBudget(STAGE_STATES[5], DEVICES[3]));
      const modeOf = (g: typeof s1) => g.nodes.find((n) => n.type === "ramp")?.interpolation;
      eq(modeOf(s1), "constant", "Stage 1 must quantise inside the evaluator");
      eq(modeOf(s6), "smooth", "Stage 6 must interpolate smoothly");
      return `S1 ${modeOf(s1)} · S6 ${modeOf(s6)}`;
    },
  },
  {
    group: "adaptGraph",
    name: "Aq injects the wetness pass exactly once",
    run() {
      const wet = adaptGraph(CART_A.graph, deriveBudget(STAGE_STATES[5], DEVICES[3]));
      const dry = adaptGraph(CART_A.graph, deriveBudget(STAGE_STATES[0], DEVICES[3]));
      eq(wet.nodes.filter((n) => n.id === "__wet_mix").length, 1, "wet pass missing or duplicated");
      eq(dry.nodes.filter((n) => n.id === "__wet_mix").length, 0, "dry planet must have no wet pass");
      eq(wet.out.albedo, "__wet_mix", "wetness must own the albedo output");
      return "1 injection at S6, 0 at S1";
    },
  },

  /* ── mesh seams ────────────────────────────────────────────────────── */
  {
    group: "mesh",
    name: "seamsAgree over 10,000 random policy pairs",
    run() {
      // deterministic LCG — no Math.random in a test
      let seed = 0x5eed;
      const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 10000; i++) {
        const mk = (): MeshPolicy => {
          const v = Math.pow(10, 2 + rnd() * 6);
          const st: FidelityState = { pxd: v * 1.3, vtx: v, lx: v * 0.7, aq: v * 0.4, tick: 0 };
          return meshPolicyFor(st, deriveBudget(st, DEVICES[3]));
        };
        const a = mk(), b = mk();
        ok(seamsAgree(a, b, [0, 0], "E", "W"), `pair ${i} disagreed`);
      }
      return "10,000 pairs, zero disagreements";
    },
  },
  {
    group: "mesh",
    name: "minPolicy is commutative and selects the coarser cell",
    run() {
      let seed = 0xbeef;
      const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 2000; i++) {
        const mk = (): MeshPolicy => {
          const v = Math.pow(10, 2 + rnd() * 6);
          const st: FidelityState = { pxd: v * 1.3, vtx: v, lx: v * 0.7, aq: v * 0.4, tick: 0 };
          return meshPolicyFor(st, deriveBudget(st, DEVICES[3]));
        };
        const a = mk(), b = mk();
        eq(minPolicy(a, b).cellSize, minPolicy(b, a).cellSize, "not commutative");
        eq(minPolicy(a, b).cellSize, Math.max(a.cellSize, b.cellSize), "did not pick coarser");
      }
      return "2,000 pairs commutative";
    },
  },
  {
    group: "mesh",
    name: "smoothAngle follows 180·(1 − e^(−Vtx/50000))",
    run() {
      for (const vtx of [0, 5e3, 5e4, 5e5, 5e6]) {
        const st: FidelityState = { pxd: vtx * 1.3 + 1, vtx, lx: vtx * 0.7 + 1, aq: vtx * 0.4 + 1, tick: 0 };
        const p = meshPolicyFor(st, deriveBudget(st, DEVICES[3]));
        near(p.smoothAngleDeg, 180 * (1 - Math.exp(-vtx / 50000)), 1e-9, `at Vtx=${vtx}`);
      }
      return "5 probes exact";
    },
  },
  {
    group: "mesh",
    name: "mode ladder is monotone CUBIC → CHAMFER → DUAL",
    run() {
      const rank = { CUBIC: 0, CHAMFER: 1, DUAL: 2 } as const;
      let prev = -1;
      const seen: string[] = [];
      for (let e = 2; e <= 8; e += 0.25) {
        const v = Math.pow(10, e);
        const st: FidelityState = { pxd: v * 1.3, vtx: v, lx: v * 0.7, aq: v * 0.4, tick: 0 };
        const p = meshPolicyFor(st, deriveBudget(st, DEVICES[3]));
        ok(rank[p.mode] >= prev, `mode went backwards at 1e${e}`);
        if (rank[p.mode] > prev) seen.push(p.mode);
        prev = rank[p.mode];
      }
      return seen.join(" → ");
    },
  },
  {
    group: "mesh",
    name: "seamKeyFor is position- and policy-sensitive",
    run() {
      const st: FidelityState = { pxd: 1e6, vtx: 1e6, lx: 1e6, aq: 1e6, tick: 0 };
      const p = meshPolicyFor(st, deriveBudget(st, DEVICES[3]));
      ok(seamKeyFor(p, "E", [0, 0]) !== seamKeyFor(p, "E", [32, 0]), "origin ignored");
      ok(seamKeyFor(p, "E", [0, 0]) !== seamKeyFor(p, "N", [0, 0]), "edge ignored");
      eq(seamKeyFor(p, "E", [0, 0]), seamKeyFor(p, "E", [0, 0]), "not stable");
      return seamKeyFor(p, "E", [0, 0]);
    },
  },

  /* ── certificate ───────────────────────────────────────────────────── */
  {
    group: "certify",
    name: "well-formed cartridges pass on every device",
    run() {
      for (const c of [CART_A, CART_B, CART_C])
        for (const d of DEVICES) {
          const cert = certify(c, d);
          ok(cert.pass, `${c.id}@${d.id}: ${cert.failures.join("; ")}`);
        }
      return "3 cartridges × 4 devices → PASS";
    },
  },
  {
    group: "certify",
    name: "rejects >8 exposed variables and missing explanations",
    run() {
      const bad: Cartridge = {
        ...CART_A,
        vars: Array.from({ length: 9 }, (_, i) => ({
          path: `n.p${i}`, label: "x", real: "x", unit: "—",
          min: 0, max: 1, step: 0.1, def: 0.5, explain: "short", tier: 1 as const,
        })),
      };
      const cert = certify(bad, DEVICES[2]);
      ok(!cert.pass, "must fail");
      ok(cert.failures.some((f) => f.includes("the cap is 8")), "must cite the var cap");
      ok(cert.failures.some((f) => f.includes("no explanation")), "must cite explanations");
      return `${cert.failures.length} failures reported`;
    },
  },
  {
    group: "certify",
    name: "graphCost scales linearly with texel count",
    run() {
      const a = graphCost(CART_A.graph, 128).evalMs;
      const b = graphCost(CART_A.graph, 256).evalMs;
      near(b / a, 4, 1e-9, "4× texels must cost 4×");
      return `${a.toFixed(4)}ms @128 → ${b.toFixed(4)}ms @256`;
    },
  },
  {
    group: "certify",
    name: "fused children certify as cleanly as their parents",
    run() {
      const pairs: [Cartridge, Cartridge][] = [[CART_A, CART_B], [CART_A, CART_C], [CART_B, CART_C]];
      for (const [a, b] of pairs)
        for (const f of [0, 0.5, 1]) {
          const child = fuse(a, b, f, 3).child!;
          const cert = certify(child, DEVICES[2]);
          ok(cert.pass, `${a.id}×${b.id}@${f}: ${cert.failures.join("; ")}`);
          ok(child.vars.length <= 8, "child exceeded the var cap");
        }
      return "9 fusions certified";
    },
  },
];

export function runSpecs(filter?: string) {
  const results = SPECS.filter((s) => !filter || s.group === filter).map((s) => {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    try {
      const evidence = s.run();
      const ms = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
      return { ...s, pass: true, evidence, ms, error: "" };
    } catch (e) {
      const ms = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
      return { ...s, pass: false, evidence: "", ms, error: (e as Error).message };
    }
  });
  return {
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    ms: results.reduce((a, r) => a + r.ms, 0),
  };
}
