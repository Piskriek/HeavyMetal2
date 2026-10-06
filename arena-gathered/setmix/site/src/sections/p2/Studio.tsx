import { useMemo, useState } from "react";
import { Panel, SectionHead, Tag, KV } from "@/components/ui";
import TexCanvas, { useEvaluated } from "@/components/TexCanvas";
import { LIBRARY, BY_ID, applyVars } from "@/engine/setmix/library";
import {
  deriveBudget,
  toEvaluateOptions,
  adaptGraph,
  certify,
  toBundle,
  fuse,
  DEVICES,
  contentHash,
  type FidelityState,
  type VarDecl,
  type Cartridge,
} from "@/engine/setmix/core";
import { graphCost } from "@/engine/texgraph";
import { cn } from "@/utils/cn";

/* 128-texel preview profile: fast enough to re-evaluate on every slider
   frame, which is what makes the Synthesizer feel like clay and not software.
   Low Aq on purpose — the Orb is a neutral authoring environment, not the
   planet. You judge the material, not today's weather. */
const DEV = DEVICES[0];
const S5: FidelityState = { pxd: 3.4e7, vtx: 2.6e7, lx: 1.8e7, aq: 5.0e4, tick: 0 };

type Depth = 1 | 2 | 3;
const DEPTH_LABEL: Record<Depth, string> = { 1: "PLAY", 2: "BUILD", 3: "PRO" };

/* ═══════════════════════════════════════════════ generated variable UI ══ */
function VarRow({
  v,
  value,
  onChange,
  jargon,
  tint,
}: {
  v: VarDecl;
  value: number;
  onChange: (n: number) => void;
  jargon: boolean;
  tint: string;
}) {
  return (
    <div className="border-b border-line/50 py-2 last:border-0">
      <div className="mono flex items-baseline justify-between gap-2 text-[10.5px]">
        <span className="font-bold" style={{ color: jargon ? "#8b9bb4" : tint }}>
          {jargon ? v.real : v.label}
        </span>
        <span className="tnum text-chalk">
          {value.toFixed(v.step < 1 ? 2 : 0)}
          <span className="ml-1 text-dim">{v.unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={v.min}
        max={v.max}
        step={v.step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="mt-1 w-full"
        style={{ ["--thumb" as string]: tint }}
      />
      <div className="mono mt-0.5 flex items-baseline justify-between gap-2 text-[9px] text-dim">
        <span>{v.explain}</span>
        <span className="shrink-0 opacity-60">{v.path}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ SYNTHESIZER ══ */
function Synthesizer() {
  const [id, setId] = useState("caustic_water");
  const [depth, setDepth] = useState<Depth>(2);
  const [jargon, setJargon] = useState(false);
  const [ov, setOv] = useState<Record<string, number>>({});
  const [ch, setCh] = useState<"lit" | "albedo" | "height" | "roughness" | "normal">("lit");

  const cart = BY_ID.get(id)!;
  const budget = useMemo(() => deriveBudget(S5, DEV), []);
  const opts = useMemo(() => toEvaluateOptions(budget, 7), [budget]);

  const graph = useMemo(
    () => adaptGraph(applyVars(cart.graph, ov), budget),
    [cart, ov, budget],
  );
  const { ms } = useEvaluated(graph, opts);
  const cost = graphCost(graph, budget.size);
  const cert = useMemo(() => certify(cart, DEV), [cart]);

  const shown = cart.vars.filter((v) => v.tier <= depth);
  const val = (v: VarDecl) => ov[v.path] ?? v.def;

  return (
    <Panel label="THE MATERIAL SYNTHESIZER · UI generated from the schema, never hand-built" accent={cart.tint} flush>
      <div className="grid lg:grid-cols-[230px_1fr_300px]">
        {/* rack */}
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">
            Cartridge Archive
          </div>
          <div className="no-scrollbar max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {LIBRARY.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setId(c.id);
                  setOv({});
                }}
                className={cn(
                  "mono flex w-full items-center gap-2 border px-2 py-1.5 text-left text-[10px] transition-colors",
                  id === c.id ? "bg-chalk/10" : "bg-void/40 hover:bg-void",
                )}
                style={{ borderColor: c.tint + (id === c.id ? "" : "40") }}
              >
                <span className="h-2 w-2 shrink-0" style={{ background: c.tint }} />
                <span className="truncate text-chalk/90">{c.name}</span>
                <span className="ml-auto shrink-0 text-[8px] text-dim">{c.cls[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* orb */}
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mono mb-2 flex flex-wrap items-center justify-between gap-2 text-[9px] uppercase">
            <span className="tracking-[0.2em] text-dim">The Orb · live evaluateGraph()</span>
            <div className="flex gap-1">
              {(["lit", "albedo", "height", "roughness", "normal"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCh(c)}
                  className={cn(
                    "border px-1.5 py-[2px] text-[8.5px] tracking-wider",
                    ch === c
                      ? "border-transparent bg-chalk text-void"
                      : "border-line text-dim hover:text-chalk",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="mx-auto max-w-[380px] border border-line bg-void">
            <TexCanvas graph={graph} opts={opts} channel={ch} />
          </div>
          <div className="mono mt-2 grid grid-cols-4 gap-2 text-[9px]">
            <div>
              <div className="text-dim">size</div>
              <div className="tnum text-chalk">{budget.size}²</div>
            </div>
            <div>
              <div className="text-dim">nodes</div>
              <div className="tnum text-chalk">{graph.nodes.length}</div>
            </div>
            <div>
              <div className="text-dim">weight</div>
              <div className="tnum text-chalk">{cost.weight}</div>
            </div>
            <div>
              <div className="text-dim">eval</div>
              <div className="tnum text-lx">{ms.toFixed(1)}ms</div>
            </div>
          </div>

          {depth === 3 && (
            <pre className="mono mt-2 max-h-[180px] overflow-auto border border-line bg-void2 p-2 text-[9.5px] leading-snug text-chalk/80">
              {JSON.stringify(graph.nodes, null, 1)}
            </pre>
          )}
        </div>

        {/* generated panel */}
        <div className="p-3">
          <div className="mb-2 flex gap-1">
            {([1, 2, 3] as Depth[]).map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={cn(
                  "mono flex-1 border px-1 py-1 text-[9px] font-bold tracking-[0.15em]",
                  depth === d
                    ? "border-transparent bg-chalk text-void"
                    : "border-line text-dim hover:text-chalk",
                )}
              >
                {DEPTH_LABEL[d]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setJargon(!jargon)}
            className={cn(
              "mono mb-2 w-full border px-2 py-1 text-[9px] font-bold tracking-[0.2em] uppercase",
              jargon ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk",
            )}
          >
            {jargon ? "◉ jargon mode on" : "○ jargon mode off"}
          </button>

          <div className="no-scrollbar max-h-[330px] overflow-y-auto pr-1">
            {shown.map((v) => (
              <VarRow
                key={v.path}
                v={v}
                tint={cart.tint}
                jargon={jargon}
                value={val(v)}
                onChange={(n) => setOv((p) => ({ ...p, [v.path]: n }))}
              />
            ))}
            {shown.length === 0 && (
              <p className="mono py-6 text-center text-[10px] text-dim">
                No variables at this depth.
                <br />
                PLAY mode hides the machinery.
              </p>
            )}
          </div>

          <div className="mt-2 border-t border-line pt-2">
            <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] uppercase">
              <span className="text-dim">Export certificate</span>
              <Tag color={cert.pass ? "#7cff4d" : "#ff3d8a"} solid>
                {cert.pass ? "PASS" : "FAIL"}
              </Tag>
            </div>
            <KV k="S6 eval" v={`${cert.evalMs.toFixed(3)} ms`} />
            <KV k="graph weight" v={cert.weight} />
            <KV k="determinism" v={cert.determinism} color="#7cff4d" />
            {cert.failures.map((f) => (
              <div key={f} className="mono mt-1 text-[9px] text-pxd">
                ✕ {f}
              </div>
            ))}
            {Object.keys(ov).length > 0 && (
              <button
                onClick={() => setOv({})}
                className="mono mt-2 w-full border border-line px-2 py-1 text-[9px] text-dim hover:text-chalk"
              >
                ↶ undo all setVariable commands
              </button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ═════════════════════════════════════════════════════ FUSION MATRIX ══ */
function Fusion() {
  const [a, setA] = useState("mud_clay");
  const [b, setB] = useState("linear_strata");
  const [dom, setDom] = useState(0.6);
  const [ledger, setLedger] = useState<Cartridge[]>([]);

  const A = BY_ID.get(a)!;
  const B = BY_ID.get(b)!;
  const budget = useMemo(() => deriveBudget(S5, DEV), []);
  const opts = useMemo(() => toEvaluateOptions(budget, 7), [budget]);

  const res = useMemo(() => fuse(A, B, dom, 7), [A, B, dom]);
  const childGraph = useMemo(
    () => (res.child ? adaptGraph(res.child.graph, budget) : null),
    [res, budget],
  );
  const cert = useMemo(() => (res.child ? certify(res.child, DEV) : null), [res]);

  const gA = useMemo(() => adaptGraph(A.graph, budget), [A, budget]);
  const gB = useMemo(() => adaptGraph(B.graph, budget), [B, budget]);

  const commit = () => {
    if (res.child && !ledger.some((c) => c.hash === res.child!.hash))
      setLedger((l) => [res.child!, ...l].slice(0, 6));
  };

  return (
    <Panel label="THE FUSION MATRIX · a real DAG merge, copy-on-write" accent="#b46bff" flush>
      <div className="grid lg:grid-cols-[1fr_1.15fr]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="grid grid-cols-2 gap-3">
            {([
              ["SLOT A", a, setA, A, gA],
              ["SLOT B", b, setB, B, gB],
            ] as const).map(([label, cur, set, cart, g]) => (
              <div key={label}>
                <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
                  <span>{label}</span>
                  <Tag color={cart.tint}>{cart.cls}</Tag>
                </div>
                <div className="border border-line bg-void">
                  <TexCanvas graph={g} opts={opts} />
                </div>
                <select
                  value={cur}
                  onChange={(e) => set(e.target.value)}
                  className="mono mt-1 w-full border border-line bg-void2 px-1 py-1 text-[9.5px] text-chalk"
                >
                  {LIBRARY.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="mono mt-1 text-[8.5px] text-dim">{cart.hash}</div>
              </div>
            ))}
          </div>

          <div className="mono mt-3 mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">Dominance dial</span>
            <span className="tnum text-chalk">
              {((1 - dom) * 100) | 0}% A / {(dom * 100) | 0}% B
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={dom}
            onChange={(e) => setDom(+e.target.value)}
            className="w-full"
            style={{ ["--thumb" as string]: "#b46bff" }}
          />

          <div className="mono mt-3 border-t border-line pt-2 text-[9px] tracking-[0.18em] text-dim uppercase">
            Nodes synthesised by fuse()
          </div>
          <div className="mono mt-1 space-y-0.5">
            {res.addedNodes.map((n) => (
              <div key={n} className="text-[10px] text-flux">
                + {n}
              </div>
            ))}
          </div>
        </div>

        <div className="p-3">
          <div className="mono mb-2 flex flex-wrap items-center justify-between gap-2 text-[9px] uppercase">
            <span className="tracking-[0.2em] text-dim">Speculation Sphere</span>
            <span className="text-flux">
              {res.grammar} · confidence {res.confidence}%
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div className="border border-line bg-void">
              {childGraph && <TexCanvas graph={childGraph} opts={opts} />}
            </div>
            <div>
              <h4 className="text-[16px] leading-tight font-black" style={{ color: res.child?.tint }}>
                {res.child?.name}
              </h4>
              <p className="mt-1.5 text-[11.5px] leading-snug text-dim">{res.rationale}</p>
              <div className="mt-2 space-y-0">
                <KV k="child id" v={res.child?.id} />
                <KV k="content hash" v={res.child?.hash} color="var(--fi-accent)" />
                <KV k="parents" v={`${A.hash.slice(0, 6)}… × ${B.hash.slice(0, 6)}…`} />
                <KV k="nodes" v={`${A.graph.nodes.length} + ${B.graph.nodes.length} → ${res.child?.graph.nodes.length}`} />
                <KV k="class" v={res.child?.cls} color={res.child?.tint} />
                <KV k="minStage" v={`S${res.child?.minStage}`} />
                <KV
                  k="certificate"
                  v={cert?.pass ? "PASS" : "FAIL"}
                  color={cert?.pass ? "#7cff4d" : "#ff3d8a"}
                />
              </div>
            </div>
          </div>

          <button
            onClick={commit}
            className="mono mt-3 w-full bg-flux px-3 py-2 text-[10px] font-black tracking-[0.25em] text-void uppercase transition-transform active:translate-y-px"
          >
            ⌁ dispatch setmix/fuse command
          </button>

          {ledger.length > 0 && (
            <div className="mt-3 border-t border-line pt-2">
              <div className="mono mb-1 text-[9px] tracking-[0.18em] text-dim uppercase">
                Ledger · {ledger.length} immutable revisions
              </div>
              <div className="grid grid-cols-6 gap-1">
                {ledger.map((c) => (
                  <div key={c.hash} className="border border-line bg-void" title={c.name}>
                    <TexCanvas graph={adaptGraph(c.graph, budget)} opts={{ ...opts, size: 64 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="mt-3">
            <summary className="mono cursor-pointer text-[9.5px] tracking-[0.18em] text-dim uppercase hover:text-chalk">
              ▸ .setmix bundle (what ships to the Galaxy)
            </summary>
            <pre className="mono mt-1 max-h-[220px] overflow-auto border border-line bg-void2 p-2 text-[9.5px] leading-snug text-chalk/80">
              {res.child && cert ? JSON.stringify(toBundle(res.child, cert), null, 1) : ""}
            </pre>
          </details>
        </div>
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════ SECTION ══ */
export default function Studio() {
  const demoHash = contentHash({ demo: true, n: 1 });
  return (
    <section id="p2-studio" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
      <SectionHead
        n="2.2"
        kicker="Kernel Principles 1–4, Running"
        title="Presets, Variables, Forks, Commands"
        lede="The repo says: one node type (Preset), every parameter is a Variable, source is a tier not a different tool, and all edits are Commands. SetMix does not adapt to that — SetMix is the clearest possible demonstration of it. Both machines below are live."
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["P1 · One node type", "A Cartridge IS a Preset: immutable rev, content hash, copy-on-write parents[]. Fusing never mutates a parent.", "#ff3d8a"],
          ["P2 · UI from schema", "Every slider on the right-hand panel is generated from a VarDecl. Nobody wrote that panel per-material.", "#7cff4d"],
          ["P3 · Source is a tier", "PLAY hides the machinery · BUILD exposes tuned knobs · PRO shows the raw DAG JSON. Same object, three depths.", "#ffc13d"],
          ["P4 · Edits are Commands", "setVariable / fuse / slotCartridge are journalled at a sim tick, so undo, replay and later co-op editing come free.", "#3dc8ff"],
        ].map(([k, v, c]) => (
          <div key={k} className="fi-panel border border-line bg-panel/60 p-3" style={{ borderColor: c + "44" }}>
            <div className="mono text-[9.5px] font-bold tracking-[0.15em]" style={{ color: c }}>
              {k}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-dim">{v}</p>
          </div>
        ))}
      </div>

      <Synthesizer />
      <div className="mt-3">
        <Fusion />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel label="JARGON MODE IS A SCHEMA FEATURE" accent="#7cff4d">
          <p className="text-[12.5px] leading-relaxed text-dim">
            The kernel already demands that every Variable carries a path, a range, a unit and a
            one-sentence explanation. SetMix adds exactly one field —{" "}
            <code className="mono text-chalk">real</code> — and the entire pedagogical thesis of
            Section 5 falls out of the existing contract. Toggle it in the Synthesizer: "Grain
            Depth" becomes "fBm octaves" across every machine in the game simultaneously, because
            it is one field on one record, not a translation table.
          </p>
        </Panel>
        <Panel label="CONTENT HASHING = THE ARCHIVE" accent="#b46bff">
          <p className="text-[12.5px] leading-relaxed text-dim">
            FNV-1a over a key-sorted, fixed-precision serialisation. Deterministic across
            machines, so two players who fuse the same parents at the same dominance get the{" "}
            <em className="not-italic text-chalk">same hash</em> — automatic dedup in the Galaxy,
            and the "re-print for 20%" rule in the GDD becomes a cache lookup.
          </p>
          <div className="mono mt-2 text-[10px] text-dim">
            contentHash({"{ demo: true, n: 1 }"}) → <span className="text-flux">{demoHash}</span>
          </div>
        </Panel>
        <Panel label="WHAT THIS REPLACES" accent="#ff3d8a">
          <ul className="mono space-y-1 text-[11px] text-dim">
            <li>✕ a bespoke material editor UI per machine</li>
            <li>✕ a separate "preset" format for SetMix</li>
            <li>✕ an asset pipeline, importer, or texture cache</li>
            <li>✕ hand-authored LODs of any material</li>
            <li>✕ a translation table for the tutorial vocabulary</li>
            <li className="pt-1 text-vtx">✓ one schema, one graph, one hash, one governor</li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}
