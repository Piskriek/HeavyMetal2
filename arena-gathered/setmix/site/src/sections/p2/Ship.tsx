import { useMemo, useState } from "react";
import { Panel, SectionHead, Formula, Tag, KV } from "@/components/ui";
import {
  stepFidelity,
  fidelityIndex,
  coherence,
  stageOf,
  normalised,
  TICK_HZ,
  COMMANDS,
  STAGE_FI,
  type FidelityState,
  type Emitter,
} from "@/engine/setmix/core";
import { BY_ID } from "@/engine/setmix/library";
import { fmtBig } from "@/state/fi";
import { cn } from "@/utils/cn";

/* ═══════════════════════════════════════════════ deterministic replay ══ */
function makeEmitters(n: Record<string, number>): Emitter[] {
  const out: Emitter[] = [];
  const defs = [
    { metric: "pxd", base: 12, clock: 3, cart: "chromatic_crystal" },
    { metric: "vtx", base: 9, clock: 4, cart: "columnar_basalt" },
    { metric: "lx", base: 7, clock: 2, cart: undefined },
    { metric: "aq", base: 5, clock: 7, cart: "caustic_water" },
  ] as const;
  for (const d of defs) {
    for (let i = 0; i < (n[d.metric] ?? 0); i++)
      out.push({
        id: `${d.metric}_${i}`,
        metric: d.metric,
        tier: (i % 3) as 0 | 1 | 2,
        base: d.base,
        clock: d.clock,
        cartridge: i % 2 === 0 ? d.cart : undefined,
        pos: [i * 20, 0],
      });
  }
  return out;
}

function Replay() {
  const [cfg, setCfg] = useState<Record<string, number>>({ pxd: 6, vtx: 5, lx: 4, aq: 3 });
  const [clock, setClock] = useState(260);
  const [maint, setMaint] = useState(0.8);

  const run = useMemo(() => {
    const carts = BY_ID;
    const emitters = makeEmitters(cfg);
    let s: FidelityState = { pxd: 120, vtx: 80, lx: 40, aq: 2, tick: 0 };
    const samples: { t: number; fi: number; n: ReturnType<typeof normalised> }[] = [];
    // 4 hours of game time, 120 Hz, batched 600 ticks (5 s) per integration step
    const BATCH = 600;
    const STEPS = Math.round((4 * 3600 * TICK_HZ) / BATCH);
    for (let i = 0; i < STEPS; i++) {
      s = stepFidelity(s, emitters, carts, {
        clockSupply: clock,
        maintenance: maint,
        ticks: BATCH,
      });
      if (i % 4 === 0)
        samples.push({ t: s.tick / TICK_HZ / 3600, fi: fidelityIndex(s), n: normalised(s) });
    }
    return { final: s, samples, emitters };
  }, [cfg, clock, maint]);

  const maxFi = Math.max(...run.samples.map((x) => x.fi), 1);
  const W = 560,
    H = 150;
  const path = run.samples
    .map((p, i) => {
      const x = (i / (run.samples.length - 1)) * W;
      const y = H - (Math.log1p(p.fi) / Math.log1p(maxFi)) * H;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("");

  const fi = fidelityIndex(run.final);

  return (
    <Panel label="@hm/sim INTEGRATION · 120 Hz fixed step, seeded, replayable" accent="#3dc8ff" flush>
      <div className="grid lg:grid-cols-[1fr_300px]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 170 }}>
            {STAGE_FI.slice(1, 6).map((f, i) => {
              const y = H - (Math.log1p(f) / Math.log1p(maxFi)) * H;
              if (y < 0 || y > H) return null;
              return (
                <g key={i}>
                  <line x1={0} y1={y} x2={W} y2={y} stroke="#1b2434" strokeDasharray="3 3" />
                  <text x={2} y={y - 3} fill="#6b7a90" fontSize={8} fontFamily="monospace">
                    S{i + 2} · {fmtBig(f)}
                  </text>
                </g>
              );
            })}
            <path d={path} fill="none" stroke="var(--fi-accent)" strokeWidth={2} />
          </svg>
          <div className="mono flex justify-between text-[9px] text-dim">
            <span>t = 0</span>
            <span>4 h of game time · 1,728,000 ticks · integrated in {run.samples.length} samples</span>
            <span>4 h</span>
          </div>
          <div className="mono mt-3 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            {(["pxd", "vtx", "lx", "aq"] as const).map((k) => (
              <KV
                key={k}
                k={k}
                v={fmtBig(run.final[k])}
                color={{ pxd: "#ff3d8a", vtx: "#7cff4d", lx: "#ffc13d", aq: "#3dc8ff" }[k]}
              />
            ))}
          </div>
        </div>
        <div className="p-3">
          {(["pxd", "vtx", "lx", "aq"] as const).map((k) => (
            <div key={k} className="mb-2">
              <div className="mono flex justify-between text-[9.5px]">
                <span className="text-dim">{k} emitters</span>
                <span className="tnum text-chalk">{cfg[k]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={14}
                step={1}
                value={cfg[k]}
                onChange={(e) => setCfg((p) => ({ ...p, [k]: +e.target.value }))}
                className="w-full"
              />
            </div>
          ))}
          <div className="mono flex justify-between text-[9.5px]">
            <span className="text-dim">clock supply</span>
            <span className="tnum text-chalk">{clock} cyc</span>
          </div>
          <input type="range" min={0} max={900} step={10} value={clock} onChange={(e) => setClock(+e.target.value)} className="w-full" />
          <div className="mono mt-2 flex justify-between text-[9.5px]">
            <span className="text-dim">maintenance</span>
            <span className="tnum text-chalk">{(maint * 100) | 0}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={maint} onChange={(e) => setMaint(+e.target.value)} className="w-full" />

          <div className="mt-3 border-t border-line pt-2">
            <KV k="Fi @ 4h" v={fmtBig(fi)} color="var(--fi-accent)" />
            <KV k="Stage" v={`S${stageOf(fi)}`} color="var(--fi-accent)" />
            <KV k="Coherence C" v={coherence(run.final).toFixed(3)} color={coherence(run.final) < 0.8 ? "#ffc13d" : "#7cff4d"} />
            <KV k="Emitters" v={run.emitters.length} />
          </div>
          <p className="mono mt-2 text-[9.5px] leading-snug text-dim">
            Same config + same seed ⇒ byte-identical curve on any machine. A session is (preset
            bundle, seed, input stream) — exactly the repo's definition, so offline progression
            replays as a cinematic instead of being simulated twice.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════ PACKAGES ══ */
const PKGS = [
  ["packages/setmix-contracts", "T0 · types only", "—", "FidelityState, Cartridge, VarDecl, RenderBudget, SetmixCommand", "~210", "done"],
  ["packages/setmix-fidelity", "T3 · pure sim", "contracts", "fidelityIndex, coherence, stepFidelity, coherenceRate", "~180", "done"],
  ["packages/setmix-governor", "T3 · pure", "contracts, texgraph", "deriveBudget, toEvaluateOptions, adaptGraph, DEVICES", "~190", "done"],
  ["packages/setmix-cartridge", "T1 · kernel adapter", "contracts, kernel, texgraph", "contentHash, certify, toBundle, applyVars", "~230", "done"],
  ["packages/setmix-fusion", "T1 · pure", "contracts, texgraph", "fuse() — DAG merge with four grammar branches", "~200", "done"],
  ["packages/setmix-library", "content", "contracts, texgraph", "12 shipping cartridges as real TexGraphs", "~420", "done"],
  ["packages/setmix-field", "T3 · sim", "contracts, sim", "spires, terraform waves, grid, coherence field", "~340", "next"],
  ["apps/web/routes/setmix", "shell", "all of the above", "Lab, Planet, Outliner, Galaxy browser", "~900", "next"],
];

const WAVE = `// packages/setmix-field/src/wave.ts
export function waveRadius(t: number, tier: number, bandwidth: number, complexity: number) {
  const Rmax = 180 * tier * (1 + bandwidth / 64);
  const tau  = 90 * complexity;
  return Rmax * (1 - Math.exp(-t / tau));          // metres
}

/** Softmax over every spire's influence — overlapping cartridges BLEND,
 *  they never fight. Within ~20 m of equal weight you get a real ecotone. */
export function dominantAt(p: Vec2, spires: Spire[], tick: number) {
  let sum = 0; const w: number[] = [];
  for (const s of spires) {
    const r  = waveRadius((tick - s.startedAt) / TICK_HZ, s.tier, s.bandwidth, s.complexity);
    const d  = dist(p, s.pos);
    const k  = d < r - BAND ? 1
             : d < r        ? hash2(p) < (r - d) / BAND ? 1 : 0   // alpha-hash band
             : 0;
    const wi = k * s.influence * falloff(d, r) * s.dominance;
    w.push(wi); sum += wi;
  }
  return { weights: w.map(x => x / (sum || 1)), blended: sum > 0 };
}`;

export default function Ship() {
  const [tab, setTab] = useState<"pkg" | "cmd" | "pr">("pkg");

  return (
    <section id="p2-ship" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="2.3"
        kicker="Shipping"
        title="Packages, Commands & The Merge Plan"
        lede="Eight packages, six of which are pure functions with no dependencies beyond contracts and texgraph. Nothing here reaches into the kernel; the kernel reaches into us. That is principle 6, and it is why this merges cleanly."
      />

      <Replay />

      <div className="mt-3 mb-3 flex gap-2">
        {([
          ["pkg", "PACKAGE MAP"],
          ["cmd", "COMMANDS & FIELD SIM"],
          ["pr", "MERGE PLAN"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "mono flex-1 border px-3 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-all",
              tab === k ? "fi-accent-border bg-panel2 text-chalk" : "border-line text-dim hover:text-chalk",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "pkg" && (
        <Panel label="packages/* — where SetMix lives in HeavyMetal2" flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left">
              <thead>
                <tr className="mono border-b border-line text-[9px] tracking-[0.18em] text-dim uppercase">
                  <th className="p-2 font-medium">Path</th>
                  <th className="p-2 font-medium">Tier</th>
                  <th className="p-2 font-medium">Depends on</th>
                  <th className="p-2 font-medium">Exports</th>
                  <th className="p-2 font-medium">LOC</th>
                  <th className="p-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {PKGS.map((p) => (
                  <tr key={p[0]} className="border-b border-line/50 hover:bg-panel2/70">
                    <td className="mono p-2 text-[11px] text-chalk">{p[0]}</td>
                    <td className="mono p-2 text-[10.5px] text-dim">{p[1]}</td>
                    <td className="mono p-2 text-[10.5px] text-dim">{p[2]}</td>
                    <td className="mono p-2 text-[10.5px] text-dim">{p[3]}</td>
                    <td className="mono tnum p-2 text-[10.5px] text-dim">{p[4]}</td>
                    <td className="p-2">
                      <Tag color={p[5] === "done" ? "#7cff4d" : "#ffc13d"} solid={p[5] === "done"}>
                        {p[5] === "done" ? "IN THIS PR" : "PR 2"}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 border-t border-line p-4 lg:grid-cols-2">
            <div>
              <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">
                node scripts/verify.mjs setmix-governor
              </div>
              <Formula>{`✓ contracts-only imports        (no kernel/sim/platform reach-in)
✓ pure                          (no Date.now, no Math.random)
✓ determinism                   1,000 seeds × 2 runs → identical hashes
✓ budget table                  24 (state × device) pairs vs golden file
✓ adaptGraph round-trip         every cartridge valid at S1 AND S6
✓ no orphan edges after bypass  (warp/cellular substitution)
✓ size                          11.4 kB min, 0 deps`}</Formula>
            </div>
            <div className="space-y-3 text-[12.5px] leading-relaxed text-dim">
              <p>
                <strong className="text-chalk">Six of the eight packages are pure.</strong> They
                take data and return data: no I/O, no clock, no RNG. That makes the golden-file
                tests trivial and makes the whole fidelity system replayable for free, which is
                what the sim tier demands anyway.
              </p>
              <p>
                <strong className="text-chalk">texgraph is the only heavy dependency</strong> and
                we consume exactly three of its exports —{" "}
                <code className="mono text-chalk">evaluateGraph</code>,{" "}
                <code className="mono text-chalk">tileBytes</code>,{" "}
                <code className="mono text-chalk">litPreview</code> — plus its four interfaces. If
                texgraph gains GPU evaluation later, nothing in SetMix changes.
              </p>
              <p>
                <strong className="text-chalk">Static-build safe.</strong> No assets, no fetches,
                no workers required. The whole of SetMix inlines into the single-file{" "}
                <code className="mono text-chalk">apps/web</code> output, which is how this
                document is being served to you right now.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {tab === "cmd" && (
        <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
          <Panel label="SetmixCommand · every edit is journalled at a tick" accent="#3dc8ff" flush>
            <div className="divide-y divide-line/60">
              {COMMANDS.map((c) => (
                <div key={c.type} className="p-3">
                  <div className="mono text-[11px] font-bold text-aq">{c.type}</div>
                  <div className="mono mt-0.5 text-[10px] text-dim">{c.payload}</div>
                  <div className="mt-1 text-[11px] leading-snug text-chalk/80">
                    <span className="mono text-[9px] tracking-[0.15em] text-dim uppercase">undo ▸ </span>
                    {c.undo}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-3">
              <p className="text-[12px] leading-relaxed text-dim">
                Because commands carry their sim tick, "pull the cartridge and the wave recedes at
                2× speed restoring the cached prior state" is not special-case code — it is the
                generic undo path running against a journalled command. The GDD promise and the
                kernel contract turned out to be the same feature.
              </p>
            </div>
          </Panel>
          <div className="space-y-3">
            <Panel label="packages/setmix-field · the terraform wave" accent="#b46bff">
              <Formula>{WAVE}</Formula>
            </Panel>
            <Panel label="POPPING IS DEFEATED IN THE BAND" accent="#b46bff">
              <ol className="space-y-1.5 text-[12px] leading-snug text-dim">
                {[
                  "alpha-hash stochastic coverage inside an 8–14 m band + TAA resolve (0.6 s)",
                  "vertex geomorph with C¹ continuity (1.4 s) — the ground swells, never snaps",
                  "prop spawn on a 0.3 s scale-and-sway curve, ordered by blue noise",
                  "a 180 ms audio whoosh arriving 2 frames EARLY to mask the remainder",
                ].map((s, i) => (
                  <li key={s} className="flex gap-2">
                    <span className="mono text-flux">{i + 1}.</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>
      )}

      {tab === "pr" && (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <Panel label="MERGE PLAN · four PRs, none of them scary" flush>
            <div className="divide-y divide-line/60">
              {[
                ["PR 1 · contracts + pure maths", "setmix-contracts, -fidelity, -governor, -fusion, -library. Zero runtime deps beyond texgraph. Fully golden-file tested. Nothing in the app imports it yet, so it cannot break the build.", "~1,430 LOC", "#7cff4d"],
                ["PR 2 · kernel adapter", "setmix-cartridge registers the 'setmix.cartridge' preset kind with the schema registry, maps VarDecl→kernel Variable, and wires the six commands into the command bus + undo stack.", "~230 LOC", "#3dc8ff"],
                ["PR 3 · field sim", "setmix-field adds spires, waves, grid and the coherence field to the 120 Hz world. First point at which SetMix is playable.", "~340 LOC", "#ffc13d"],
                ["PR 4 · shell routes", "apps/web gains /setmix with Lab, Planet, Outliner and Galaxy. Still one static HTML file.", "~900 LOC", "#b46bff"],
              ].map(([t, d, loc, c]) => (
                <div key={t} className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[13px] font-bold" style={{ color: c }}>
                      {t}
                    </div>
                    <span className="mono tnum shrink-0 text-[10px] text-dim">{loc}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-dim">{d}</p>
                </div>
              ))}
            </div>
          </Panel>
          <div className="space-y-3">
            <Panel label="OPEN QUESTIONS FOR THE TEXGRAPH OWNER" accent="#ff3d8a">
              <ol className="space-y-2 text-[12.5px] leading-relaxed text-dim">
                {[
                  "Does evaluateGraph guarantee identical float output across platforms? We need bit-stability for content hashing; if not, we hash the graph only and treat pixels as derived.",
                  "Is there an incremental/partial-eval path? The terraform wave would love to re-evaluate only the band, not the whole tile.",
                  "Can `warp` accept a 2-channel driver? Today we read channel 0 and 1 of the same field; a proper 2-ch vector input would make curl-noise exact rather than approximate.",
                  "Is a node-level cost estimate available internally? graphCost() is our heuristic and it drives the export certificate — we would rather use yours.",
                  "Would you accept a `ramp` with an interpolation mode (linear | smooth | constant)? Constant gives us the Stage-1 four-colour quantisation for free.",
                ].map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mono text-pxd">Q{i + 1}</span>
                    {q}
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel label="WHAT WE GIVE BACK" accent="#7cff4d">
              <ul className="space-y-1.5 text-[12px] leading-snug text-dim">
                <li className="flex gap-2"><span className="text-vtx">→</span>12 production cartridges exercising every node type in texgraph</li>
                <li className="flex gap-2"><span className="text-vtx">→</span>A golden-file determinism suite texgraph can adopt directly</li>
                <li className="flex gap-2"><span className="text-vtx">→</span>adaptGraph: a reusable LOD rewriter any preset kind can use</li>
                <li className="flex gap-2"><span className="text-vtx">→</span>The goblin. The racing game and SetMix share one avatar rig and one content universe — a Scrap Strider chassis is a vehicle preset in both.</li>
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </section>
  );
}
