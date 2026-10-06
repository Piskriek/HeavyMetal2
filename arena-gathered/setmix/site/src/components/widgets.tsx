import { useMemo, useState } from "react";
import { RECIPES, STAGES, type Recipe } from "@/data/gdd";
import { Panel, Tag, Formula, KV, Slider } from "@/components/ui";
import { clamp, fmtBig } from "@/state/fi";
import { cn } from "@/utils/cn";

/* ======================================================== FUSION MATRIX */
type Ingredient = { name: string; type: "NOUN" | "VERB" | "RULE"; color: string };

const TYPE_COLOR = { NOUN: "#ff6fb2", VERB: "#7cff4d", RULE: "#ffc13d" } as const;

export function FusionMatrix() {
  const ingredients = useMemo(() => {
    const map = new Map<string, Ingredient>();
    for (const r of RECIPES) {
      if (!map.has(r.a)) map.set(r.a, { name: r.a, type: r.aType, color: TYPE_COLOR[r.aType] });
      if (!map.has(r.b)) map.set(r.b, { name: r.b, type: r.bType, color: TYPE_COLOR[r.bType] });
    }
    return [...map.values()];
  }, []);

  const [slots, setSlots] = useState<(Ingredient | null)[]>([null, null]);
  const [dom, setDom] = useState(50);
  const [found, setFound] = useState<string[]>([]);

  const match: Recipe | null = useMemo(() => {
    const [a, b] = slots;
    if (!a || !b) return null;
    return (
      RECIPES.find(
        (r) => (r.a === a.name && r.b === b.name) || (r.a === b.name && r.b === a.name),
      ) ?? null
    );
  }, [slots]);

  const load = (ing: Ingredient) => {
    setSlots((s) => {
      if (s[0]?.name === ing.name || s[1]?.name === ing.name) return s;
      if (!s[0]) return [ing, s[1]];
      if (!s[1]) return [s[0], ing];
      return [s[1], ing];
    });
  };

  const commit = () => {
    if (match && !found.includes(match.id)) setFound((f) => [...f, match.id]);
  };

  const confidence = match ? 62 + (match.tier === 1 ? 30 : match.tier === 2 ? 18 : 6) : 11;
  const grammar = slots[0] && slots[1] ? `${slots[0].type} + ${slots[1].type}` : "— + —";
  const grammarNote =
    grammar === "NOUN + VERB" || grammar === "VERB + NOUN"
      ? "Behavioural asset — a thing that now does something."
      : grammar === "NOUN + NOUN"
        ? "Hybrid material — two substances negotiate a third."
        : grammar === "VERB + VERB"
          ? "Compound operator — a new verb usable on anything."
          : grammar.includes("RULE")
            ? "Spatial governance — decides where other presets apply."
            : "Load two cartridges into the ring.";

  return (
    <Panel label="FUSION MATRIX · 2-SLOT PROTOTYPE" accent="#b46bff" flush>
      <div className="grid lg:grid-cols-[1fr_1.05fr]">
        {/* ingredient rail */}
        <div className="border-b border-line p-4 lg:border-r lg:border-b-0">
          <div className="mono mb-2 flex items-center justify-between text-[9px] tracking-[0.2em] text-dim uppercase">
            <span>Cartridge rack · {ingredients.length} presets</span>
            <span>
              <span style={{ color: TYPE_COLOR.NOUN }}>■</span> noun{" "}
              <span style={{ color: TYPE_COLOR.VERB }}>■</span> verb{" "}
              <span style={{ color: TYPE_COLOR.RULE }}>■</span> rule
            </span>
          </div>
          <div className="no-scrollbar grid max-h-[290px] grid-cols-2 gap-1.5 overflow-y-auto pr-1">
            {ingredients.map((ing) => {
              const active = slots.some((s) => s?.name === ing.name);
              return (
                <button
                  key={ing.name}
                  onClick={() => load(ing)}
                  className={cn(
                    "mono group border px-2 py-2 text-left text-[10px] leading-tight transition-all active:translate-y-px",
                    active ? "bg-chalk/10" : "bg-void/50 hover:bg-void",
                  )}
                  style={{ borderColor: ing.color + (active ? "" : "44") }}
                >
                  <span
                    className="mb-1 block text-[8px] font-bold tracking-[0.18em]"
                    style={{ color: ing.color }}
                  >
                    {ing.type}
                  </span>
                  <span className="text-chalk/90">{ing.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* matrix */}
        <div className="p-4">
          <div className="flex items-stretch gap-2">
            {[0, 1].map((i) => (
              <button
                key={i}
                onClick={() => setSlots((s) => s.map((v, k) => (k === i ? null : v)))}
                className="fi-panel flex min-h-[72px] flex-1 flex-col justify-center border border-dashed border-line bg-void/60 p-2 text-left transition-colors hover:border-chalk/40"
                style={slots[i] ? { borderStyle: "solid", borderColor: slots[i]!.color } : {}}
              >
                <span className="mono text-[8px] tracking-[0.2em] text-dim uppercase">
                  SLOT {i + 1}
                </span>
                <span className="mono mt-1 text-[11px] leading-tight text-chalk">
                  {slots[i]?.name ?? "empty"}
                </span>
              </button>
            ))}
          </div>

          <div className="mono mt-3 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
            <span>Dominance dial</span>
            <span className="tnum text-chalk">
              {slots[0] ? slots[0].name.split(" ")[0] : "A"} {100 - dom}% / {dom}%{" "}
              {slots[1] ? slots[1].name.split(" ")[0] : "B"}
            </span>
          </div>
          <Slider value={dom} onChange={setDom} min={0} max={100} step={1} color="#b46bff" />

          {/* speculation sphere */}
          <div className="fi-panel relative mt-3 overflow-hidden border border-line bg-void">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background: match
                  ? `radial-gradient(circle at 50% 54%, ${match.color}44, transparent 62%)`
                  : "radial-gradient(circle at 50% 54%, #b46bff22, transparent 62%)",
              }}
            />
            <div className="relative p-4">
              <div className="mono mb-2 flex items-center justify-between text-[9px] tracking-[0.2em] uppercase">
                <span className="text-dim">Speculation Sphere</span>
                <span style={{ color: match ? match.color : "#6b7a90" }}>
                  confidence {confidence}%
                </span>
              </div>

              {match ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag color={match.color} solid>
                      T{match.tier}
                    </Tag>
                    <Tag color={match.color}>{match.cls}</Tag>
                    {found.includes(match.id) && <Tag color="#7cff4d">LOGGED</Tag>}
                  </div>
                  <h4
                    className="mt-2 text-xl leading-tight font-black"
                    style={{ color: match.color }}
                  >
                    {dom > 70
                      ? `${match.out} · ${slots[1]?.name.split(" ")[0]}-dominant`
                      : dom < 30
                        ? `${match.out} · ${slots[0]?.name.split(" ")[0]}-dominant`
                        : match.out}
                  </h4>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-dim">{match.logic}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="border-l-2 pl-2" style={{ borderColor: match.color }}>
                      <div className="mono text-[8.5px] tracking-[0.2em] text-dim uppercase">
                        Emergent play
                      </div>
                      <p className="mt-1 text-[11.5px] leading-snug text-chalk/85">
                        {match.emergent}
                      </p>
                    </div>
                    <div className="border-l-2 border-line pl-2">
                      <div className="mono text-[8.5px] tracking-[0.2em] text-dim uppercase">
                        Secretly teaches
                      </div>
                      <p className="mt-1 text-[11.5px] leading-snug text-chalk/85">
                        {match.teaches}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={commit}
                    className="mono fi-accent-bg mt-3 w-full px-3 py-2 text-[10px] font-black tracking-[0.25em] text-void uppercase transition-transform active:translate-y-px"
                  >
                    ⌁ Pull the lever — commit fusion
                  </button>
                </>
              ) : (
                <div className="py-4">
                  <div className="mono text-[11px] text-chalk/70">
                    {slots[0] && slots[1]
                      ? "UNSTABLE SPECULATION — the Matrix cannot resolve a child from these parents. It will still let you try; failures return 60% of inputs and log a near-miss hint to the Codex."
                      : "Awaiting cartridges. The Matrix previews the child before you spend the parents — veto is free, curiosity is cheap."}
                  </div>
                </div>
              )}

              <div className="mono mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2 text-[9.5px] text-dim">
                <span className="text-chalk">{grammar}</span>
                <span className="opacity-60">→ {grammarNote}</span>
              </div>
            </div>
          </div>

          <div className="mono mt-2 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
            <span>Ledger: {found.length} / {RECIPES.length} discovered</span>
            <button onClick={() => setSlots([null, null])} className="hover:text-chalk">
              ✕ clear ring
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ======================================================== ECONOMY LAB */
const MACHINE_DEFS = [
  { key: "pxd", name: "Pixel Chimney", base: 12, clock: 3, color: "#ff3d8a", metric: "Pxd" },
  { key: "vtx", name: "Harmonic Vibrator", base: 9, clock: 4, color: "#7cff4d", metric: "Vtx" },
  { key: "lx", name: "Lumen Mast", base: 7, clock: 2, color: "#ffc13d", metric: "Lx" },
  { key: "aq", name: "Clathrate Sublimator", base: 5, clock: 7, color: "#3dc8ff", metric: "Aq" },
] as const;

const TIER_MULT = [1, 6.5, 42, 400];
const TIER_CLOCK = [1, 2.2, 5, 11];

export function EconomyLab() {
  const [n, setN] = useState<number[]>([6, 4, 4, 2]);
  const [tier, setTier] = useState<number[]>([1, 1, 0, 0]);
  const [reactors, setReactors] = useState(4);
  const [coverage, setCoverage] = useState(0.75);

  const demand = MACHINE_DEFS.reduce((a, d, i) => a + n[i] * d.clock * TIER_CLOCK[tier[i]], 0);
  const supply = reactors * 40 * 1.9;
  const sat = clamp(supply / Math.max(1, demand), 0, 1);

  const rates = MACHINE_DEFS.map((d, i) => n[i] * d.base * TIER_MULT[tier[i]] * sat);
  const [rp, rv, rl, ra] = rates;

  const nrm = [rp, rv, rl, ra].map((r) => r / Math.max(1e-6, (rp + rv + rl + ra) / 4));
  const mean = nrm.reduce((a, b) => a + b, 0) / 4;
  const sd = Math.sqrt(nrm.reduce((a, b) => a + (b - mean) ** 2, 0) / 4);
  const C = clamp(1 - 0.45 * (sd / Math.max(0.001, mean)), 0.35, 1);

  const K =
    Math.pow(Math.max(rp, 0.001), 0.3) *
    Math.pow(Math.max(rv, 0.001), 0.3) *
    Math.pow(Math.max(rl, 0.001), 0.25) *
    Math.pow(Math.max(ra, 0.001), 0.15) *
    C;

  const ceiling = Math.pow(K / (0.015 * Math.max(0.02, 1 - coverage)), 1 / 0.82);

  const eta = (target: number) => {
    if (target > ceiling) return "∞ (below ceiling)";
    const s = target / Math.max(1e-6, K);
    if (s < 90) return `${s.toFixed(0)} s`;
    if (s < 5400) return `${(s / 60).toFixed(1)} min`;
    if (s < 86400 * 2) return `${(s / 3600).toFixed(1)} h`;
    return `${(s / 86400).toFixed(1)} d`;
  };

  return (
    <Panel label="THROUGHPUT SOLVER · dFi/dt" accent="#ffc13d" flush>
      <div className="grid lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-3 border-b border-line p-4 lg:border-r lg:border-b-0">
          {MACHINE_DEFS.map((d, i) => (
            <div key={d.key}>
              <div className="mono mb-1 flex items-center justify-between text-[10px]">
                <span style={{ color: d.color }}>{d.name}</span>
                <span className="tnum text-dim">
                  ×{n[i]} · T{tier[i] + 1} · {fmtBig(rates[i])} {d.metric}/s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={n[i]}
                  min={0}
                  max={24}
                  step={1}
                  color={d.color}
                  onChange={(v) => setN((p) => p.map((x, k) => (k === i ? v : x)))}
                />
                <div className="flex shrink-0 gap-px">
                  {[0, 1, 2, 3].map((tk) => (
                    <button
                      key={tk}
                      onClick={() => setTier((p) => p.map((x, k) => (k === i ? tk : x)))}
                      className={cn(
                        "mono w-6 border py-[2px] text-[8px] font-bold",
                        tier[i] === tk
                          ? "border-transparent text-void"
                          : "border-line text-dim hover:text-chalk",
                      )}
                      style={tier[i] === tk ? { background: d.color } : {}}
                    >
                      T{tk + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="border-t border-line pt-3">
            <div className="mono mb-1 flex items-center justify-between text-[10px]">
              <span className="text-chalk">Compute Reactors</span>
              <span className="tnum text-dim">
                ×{reactors} · {supply.toFixed(0)} / {demand.toFixed(0)} cyc
              </span>
            </div>
            <Slider value={reactors} min={0} max={30} step={1} onChange={setReactors} />
            <div className="mono mt-2 mb-1 flex items-center justify-between text-[10px]">
              <span className="text-chalk">Maintenance coverage</span>
              <span className="tnum text-dim">{(coverage * 100).toFixed(0)}%</span>
            </div>
            <Slider value={coverage} min={0} max={0.98} step={0.01} onChange={setCoverage} />
          </div>
        </div>

        <div className="p-4">
          <Formula label="Master equation">{`Fi = (Pxd^.30 · Vtx^.30 · Lx^.25 · Aq^.15) · C
C  = 1 − 0.45·σ(n̂)/μ(n̂)          [balance term]
Σ exponents = 1.00  ⇒  Fi grows LINEARLY
                       with uniform throughput`}</Formula>

          <div className="mt-3 space-y-0">
            <KV
              k="Clock satisfaction"
              v={`${(sat * 100).toFixed(0)}%`}
              color={sat < 0.99 ? "#ff3d8a" : "#7cff4d"}
            />
            <KV
              k="Coherence term C"
              v={C.toFixed(3)}
              color={C < 0.8 ? "#ffc13d" : "#7cff4d"}
            />
            <KV k="dFi/dt" v={`${fmtBig(K)} Fi/s`} color="var(--fi-accent)" />
            <KV k="Entropy ceiling" v={fmtBig(ceiling)} color="#ff6fb2" />
          </div>

          <div className="mono mt-3 border-t border-line pt-2 text-[9px] tracking-[0.2em] text-dim uppercase">
            Time to stage threshold
          </div>
          <div className="mt-1 space-y-0">
            {STAGES.slice(1).map((s) => (
              <KV key={s.id} k={`S${s.id} · ${s.name.slice(0, 22)}`} v={eta(s.fiMin)} />
            ))}
          </div>

          <p className="mt-3 border-l-2 fi-accent-border pl-2 text-[11.5px] leading-snug text-dim">
            {sat < 0.95
              ? "Your grid is starved: machines idle, throughput collapses. Build reactors or drop a tier."
              : C < 0.82
                ? "Imbalanced planet. The coherence term is eating your yield — the fastest route to Fi is almost always the metric you have been neglecting."
                : coverage < 0.6
                  ? "Entropy outruns you. Without maintenance coverage the planet plateaus at the ceiling above, no matter how many machines you add."
                  : "Balanced, powered and maintained. This is the configuration the tutorial is secretly teaching the player to build."}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ======================================================= COHERENCE SIM */
export function CoherenceSim() {
  const [dist, setDist] = useState(240);
  const [shelter, setShelter] = useState<"none" | "beacon" | "spire">("none");
  const [storm, setStorm] = useState(false);
  const [suit, setSuit] = useState(1);

  const stormMult = storm ? 2.4 : 1;
  const shelterF = shelter === "spire" ? 1 : shelter === "beacon" ? 0.72 : 0;
  const regen = (shelter === "spire" ? 6 : shelter === "beacon" ? 2.5 : 0) + [0.4, 0.8, 1.2, 1.6][suit - 1];
  const drain = 0.9 * (1 - shelterF) * Math.pow(1 + dist / 400, 1.3) * stormMult;
  const net = regen - drain;
  const ttl = net >= 0 ? Infinity : 100 / -net;

  const state =
    net >= 0
      ? { label: "NOMINAL", color: "#7cff4d", fx: "Stable. Full triangle count, clean audio." }
      : ttl > 120
        ? { label: "UNDERSAMPLED", color: "#ffc13d", fx: "Hands lose 40% of their triangles; UI text dithers." }
        : ttl > 45
          ? { label: "QUANTISED", color: "#ff9a3d", fx: "Input snaps to a 12 Hz tick. Stop-motion movement." }
          : { label: "Z-FIGHTING", color: "#ff3d8a", fx: "The world flickers between LODs. Colour bands invert." };

  return (
    <Panel label="COHERENCE SOLVER · survival without oxygen" accent="#ff3d8a">
      <Formula label="dC/dt">{`dC/dt = R_spire + R_beacon + R_suit
        − 0.9·(1 − shelter)·(1 + d/400)^1.3 · stormMult`}</Formula>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mono mb-1 flex justify-between text-[10px]">
            <span className="text-dim">Distance to render host</span>
            <span className="tnum text-chalk">{dist} m</span>
          </div>
          <Slider value={dist} min={0} max={1200} step={10} onChange={setDist} color="#ff3d8a" />

          <div className="mono mt-3 mb-1 text-[10px] text-dim">Shelter</div>
          <div className="flex gap-1">
            {(["none", "beacon", "spire"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setShelter(s)}
                className={cn(
                  "mono flex-1 border px-2 py-1 text-[9px] font-bold tracking-wider uppercase",
                  shelter === s
                    ? "border-transparent bg-chalk text-void"
                    : "border-line text-dim hover:text-chalk",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mono mt-3 mb-1 text-[10px] text-dim">Suit tier</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSuit(s)}
                className={cn(
                  "mono flex-1 border px-2 py-1 text-[9px] font-bold",
                  suit === s
                    ? "border-transparent bg-chalk text-void"
                    : "border-line text-dim hover:text-chalk",
                )}
              >
                T{s}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStorm(!storm)}
            className={cn(
              "mono mt-3 w-full border px-2 py-1.5 text-[9.5px] font-bold tracking-[0.2em] uppercase",
              storm ? "border-transparent bg-pxd text-void" : "border-line text-dim hover:text-chalk",
            )}
          >
            {storm ? "⚡ NOISE STORM ACTIVE" : "○ clear skies"}
          </button>
        </div>

        <div>
          <div
            className="fi-panel flex h-full flex-col justify-between border p-3"
            style={{ borderColor: state.color + "66", background: state.color + "0d" }}
          >
            <div>
              <div className="mono text-[9px] tracking-[0.25em] text-dim uppercase">
                Avatar state
              </div>
              <div
                className="mt-1 text-2xl leading-none font-black"
                style={{ color: state.color }}
              >
                {state.label}
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-dim">{state.fx}</p>
            </div>
            <div className="mt-3 space-y-0">
              <KV k="Regen" v={`+${regen.toFixed(2)} %/s`} color="#7cff4d" />
              <KV k="Drain" v={`−${drain.toFixed(2)} %/s`} color="#ff3d8a" />
              <KV
                k="Net"
                v={`${net >= 0 ? "+" : ""}${net.toFixed(2)} %/s`}
                color={net >= 0 ? "#7cff4d" : "#ff3d8a"}
              />
              <KV
                k="Time to decohere"
                v={ttl === Infinity ? "SAFE" : `${ttl.toFixed(0)} s`}
                color={state.color}
              />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
