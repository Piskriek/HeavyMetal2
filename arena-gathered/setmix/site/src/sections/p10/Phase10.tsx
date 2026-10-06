import { useMemo, useState } from "react";
import { Panel, SectionHead, Formula, Tag, KV } from "@/components/ui";
import SetMixMaster from "@/components/p10/SetMixMaster";
import { runAll, CHECKS, packSmx, unpackSmx, crc32, simulateRollback, PACKAGE_GRAPH, topoSort, findCycles } from "@/drop/verify-all";
import { Op, encode, decode, Payload, HEADER_BYTES } from "@/drop/ue5-bridge";
import { MODES, MODE_ORDER, FRAME_BUDGETS, residencyUnion } from "@/drop/MasterRuntime";
import { cn } from "@/utils/cn";

import srcMaster from "@/drop/MasterRuntime.ts?raw";
import srcBridge from "@/drop/ue5-bridge.ts?raw";
import srcLive from "@/drop/SetmixLiveLink.py?raw";
import srcVerify from "@/drop/verify-all.ts?raw";
import srcManifest from "@/drop/MERGE_MANIFEST.md?raw";

/* ───────────────────────────────── live CI runner ─────────────────── */

function VerifyRunner() {
  const [res, setRes] = useState<ReturnType<typeof runAll> | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true); setRes(null);
    setTimeout(() => { setRes(runAll()); setBusy(false); }, 16);
  };

  const suites = [...new Set(CHECKS.map((c) => c.suite))];
  const grouped = new Map<string, NonNullable<typeof res>["results"]>();
  for (const r of res?.results ?? []) {
    if (!grouped.has(r.suite)) grouped.set(r.suite, []);
    grouped.get(r.suite)!.push(r);
  }

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel2 p-2">
        <button onClick={run} disabled={busy}
          className="mono fi-accent-bg px-3 py-1.5 text-[10px] font-black tracking-[0.2em] text-void uppercase disabled:opacity-50">
          {busy ? "running…" : "▶ bun run scripts/verify-all.ts"}
        </button>
        <span className="mono text-[9px] text-dim">
          {CHECKS.length} checks · 5 suites · 0 dependencies
        </span>
        {res && (
          <div className="mono ml-auto flex items-center gap-3 text-[10px]">
            <span className="text-vtx">✓ {res.passed}</span>
            {res.failed > 0 && <span className="text-pxd">✕ {res.failed}</span>}
            <span className={res.ms < 3000 ? "text-vtx" : "text-pxd"}>
              {res.ms.toFixed(0)} ms / 3000 budget
            </span>
          </div>
        )}
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {!res && (
          <div className="mono space-y-1 p-5 text-center text-[11px] leading-relaxed text-dim">
            {suites.map((s) => <div key={s}>{s}</div>)}
            <div className="pt-2 text-chalk">
              10,000 budget configs · .smx roundtrip + corruption · 4-client rollback
              × 24 permutations · 50 kB save CRC · 16-package acyclicity
            </div>
          </div>
        )}
        {[...grouped.entries()].map(([s, rows]) => (
          <div key={s}>
            <div className="mono sticky top-0 border-y border-line bg-void2 px-3 py-1 text-[9px] tracking-[0.2em] text-dim uppercase">
              {s} · {rows.filter((r) => r.pass).length}/{rows.length}
            </div>
            {rows.map((r) => (
              <div key={r.name} className="grid grid-cols-[14px_1fr_auto] items-start gap-2 border-b border-line/40 px-3 py-1.5">
                <span className={cn("mono text-[11px]", r.pass ? "text-vtx" : "text-pxd")}>{r.pass ? "✓" : "✕"}</span>
                <div className="min-w-0">
                  <div className="mono text-[10.5px] text-chalk/90">{r.name}</div>
                  <div className={cn("mono text-[9px]", r.pass ? "text-dim" : "text-pxd")}>
                    {r.pass ? r.evidence : r.error}
                  </div>
                </div>
                <span className="mono tnum text-[9px] text-dim">{r.ms.toFixed(1)}ms</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── live bridge inspector ──────────────── */

const SAMPLE_GRAPH = {
  id: "bridge_demo", name: "Bridge Demo",
  nodes: [
    { id: "n", type: "noise" as const, freq: 5, octaves: 6, gain: 0.52, seed: 3 },
    { id: "c", type: "cellular" as const, freq: 8, jitter: 0.8, seed: 5 },
    { id: "h", type: "blend" as const, a: "n", b: "c", mode: "mix", factor: 0.4 },
    { id: "alb", type: "ramp" as const, input: "h", interpolation: "smooth",
      stops: [{ t: 0, color: [0.1, 0.1, 0.12] }, { t: 1, color: [0.8, 0.78, 0.7] }] },
  ],
  out: { albedo: "alb", height: "h", roughness: "h" },
};

function BridgeInspector() {
  const [op, setOp] = useState<Op>(Op.ROVER);
  const [tick, setTick] = useState(14_203);

  const frame = useMemo(() => {
    const payload =
      op === Op.FIDELITY ? Payload.fidelity(1.1e8, 8.2e7, 5.9e7, 3.6e7)
      : op === Op.ROVER || op === Op.AVATAR ? Payload.transform(142.3, 8.1, -66.4, 1.92, 23.4, 0.31)
      : op === Op.WAVE ? Payload.wave(18, -30, 96.4, 11.2, 1)
      : op === Op.CARTRIDGE ? Payload.json({ id: "grass_handpainted", hash: "0x9c1ef0a2",
          scalars: { BladeDensity: 46, LayDirection: 74 } })
      : op === Op.VARIABLE ? Payload.json({ cartridge: "grass", param: "BladeDensity", value: 52 })
      : new Uint8Array(0);
    return encode(op, tick, payload);
  }, [op, tick]);

  const parsed = decode(frame);
  const hex = [...frame.slice(0, 48)].map((b) => b.toString(16).padStart(2, "0"));
  const rateHz = op === Op.ROVER || op === Op.AVATAR ? 120 : op === Op.FIDELITY ? 120 : 0.2;
  const bps = frame.length * rateHz;
  const jsonSize = JSON.stringify({ op: Op[op], tick, x: 142.3, y: 8.1, z: -66.4, yaw: 1.92, speed: 23.4, drift: 0.31 }).length;

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mono mb-2 text-[9px] tracking-[0.2em] text-dim uppercase">Opcode</div>
          <div className="space-y-1">
            {([
              [Op.FIDELITY, "FIDELITY", "#ff3d8a"], [Op.CARTRIDGE, "CARTRIDGE", "#b46bff"],
              [Op.VARIABLE, "VARIABLE", "#3dc8ff"], [Op.WAVE, "WAVE", "#7cff4d"],
              [Op.ROVER, "ROVER", "#ffc13d"], [Op.AVATAR, "AVATAR", "#86c954"],
            ] as const).map(([o, label, c]) => (
              <button key={o} onClick={() => setOp(o)}
                className={cn("mono flex w-full items-center justify-between border px-2 py-1 text-[9.5px]",
                  op === o ? "border-transparent text-void" : "border-line text-dim hover:text-chalk")}
                style={op === o ? { background: c } : { borderColor: c + "44" }}>
                <span>{label}</span>
                <span className="opacity-70">0x{o.toString(16)}</span>
              </button>
            ))}
          </div>
          <div className="mono mt-3 mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">tick</span><span className="tnum text-chalk">{tick}</span>
          </div>
          <input type="range" min={0} max={100000} step={1} value={tick}
            onChange={(e) => setTick(+e.target.value)} className="w-full" />
        </div>
        <div className="p-3">
          <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">
            wire frame · {frame.length} bytes
          </div>
          <div className="mono grid grid-cols-8 gap-[2px] sm:grid-cols-16">
            {hex.map((b, i) => (
              <span key={i}
                className={cn("border px-[3px] py-[2px] text-center text-[9px]",
                  i < 4 ? "border-flux/50 bg-flux/15 text-flux"
                  : i < 8 ? "border-lx/50 bg-lx/10 text-lx"
                  : i < HEADER_BYTES ? "border-aq/50 bg-aq/10 text-aq"
                  : "border-line bg-void2 text-chalk/80")}>
                {b}
              </span>
            ))}
            {frame.length > 48 && <span className="mono px-1 text-[9px] text-dim">…</span>}
          </div>
          <div className="mono mt-1 flex flex-wrap gap-3 text-[8.5px] text-dim">
            <span className="text-flux">■ magic 'SMXL'</span>
            <span className="text-lx">■ ver/op/flags</span>
            <span className="text-aq">■ tick + len</span>
            <span>■ payload</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <KV k="decoded op" v={Op[parsed?.op ?? 0]} color="var(--fi-accent)" />
              <KV k="decoded tick" v={parsed?.tick} />
              <KV k="payload bytes" v={parsed?.payload.length} />
              <KV k="header bytes" v={HEADER_BYTES} />
            </div>
            <div>
              <KV k="send rate" v={`${rateHz} Hz`} />
              <KV k="bandwidth" v={`${(bps / 1024).toFixed(1)} kB/s`} color="#7cff4d" />
              <KV k="same as JSON" v={`${jsonSize} B`} color="#ff3d8a" />
              <KV k="over 8 h" v={`${((bps * 28800) / 1048576).toFixed(0)} MB vs ${((jsonSize * rateHz * 28800) / 1048576).toFixed(0)} MB`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── smx + graph inspectors ───────────── */

function ArchPanels() {
  const smx = useMemo(() => {
    const packed = packSmx(SAMPLE_GRAPH as never);
    const back = unpackSmx(packed);
    const json = JSON.stringify(SAMPLE_GRAPH).length;
    return { packed, back, json, crc: crc32(packed.subarray(16)) };
  }, []);
  const net = useMemo(() => simulateRollback(4, 420, 6, 0.08, 0xabc), []);
  const order = useMemo(() => topoSort(PACKAGE_GRAPH), []);
  const cycles = useMemo(() => findCycles(PACKAGE_GRAPH), []);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Panel label=".smx BINARY CARTRIDGE" accent="#b46bff">
        <Formula>{`magic u32 · ver u16 · nodes u16
strTable u32 · crc32 u32
[nodes][outputs][string table]`}</Formula>
        <div className="mt-2">
          <KV k="binary" v={`${smx.packed.length} B`} color="#7cff4d" />
          <KV k="JSON" v={`${smx.json} B`} color="#ff3d8a" />
          <KV k="ratio" v={`${(smx.json / smx.packed.length).toFixed(1)}×`} color="var(--fi-accent)" />
          <KV k="crc-32" v={`0x${smx.crc.toString(16)}`} />
          <KV k="roundtrip nodes" v={`${smx.back.nodes.length}/${SAMPLE_GRAPH.nodes.length}`} color="#7cff4d" />
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-dim">
          Repack is byte-identical, so the format is canonical: two authors who
          build the same graph produce the same file, and the content hash dedups
          them in the Galaxy automatically.
        </p>
      </Panel>

      <Panel label="ROLLBACK · 4 CLIENTS" accent="#3dc8ff">
        <div>
          <KV k="commands" v={net.logLength.toLocaleString()} />
          <KV k="rollbacks" v={net.totalRollbacks} color="#ffc13d" />
          <KV k="resim ticks" v={net.totalResim.toLocaleString()} />
          <KV k="converged" v={net.converged ? "YES" : "NO"} color={net.converged ? "#7cff4d" : "#ff3d8a"} />
          <KV k="state" v={`0x${(net.clients[0].state >>> 0).toString(16)}`} color="#b46bff" />
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-dim">
          Integer-only state transitions. A single float in the command applier
          would desync four clients within a minute, and the bug would present as
          "rubber-banding" three weeks later.
        </p>
      </Panel>

      <Panel label="DEPENDENCY DAG" accent="#7cff4d">
        <div>
          <KV k="packages" v={order.length} />
          <KV k="cycles" v={cycles.length} color={cycles.length ? "#ff3d8a" : "#7cff4d"} />
          <KV k="root" v={order[0]} color="var(--fi-accent)" />
          <KV k="sink" v={order[order.length - 1]} color="var(--fi-accent)" />
        </div>
        <div className="mono mt-2 max-h-[120px] overflow-y-auto border border-line bg-void2 p-2 text-[9px] leading-snug text-dim">
          {order.map((p, i) => (
            <div key={p}>
              <span className="text-dim/50">{String(i + 1).padStart(2, "0")}</span>{" "}
              <span className={p === "@hm/contracts" ? "text-vtx" : p === "apps/web" ? "text-lx" : "text-chalk/80"}>{p}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ──────────────────────────────────── source viewer ───────────────── */

type F = { path: string; src: string; lang: "ts" | "py" | "md"; note: string };
const FILES: F[] = [
  { path: "packages/runtime/src/MasterRuntime.ts", src: srcMaster, lang: "ts",
    note: "Four modes over one world, one clock, one camera rig. A mode is a camera goal plus an input routing table — nothing is created or destroyed on a switch." },
  { path: "scripts/ue5-bridge.ts", src: srcBridge, lang: "ts",
    note: "Hand-rolled RFC-6455 on node:net. 16-byte binary header, idempotent-snapshot coalescing, zero npm dependencies." },
  { path: "tools/unreal/SetmixLiveLink.py", src: srcLive, lang: "py",
    note: "Socket on a worker thread, unreal.* only on the Slate tick. Mirrors fidelity, cartridges, waves, rover and avatar in real time." },
  { path: "scripts/verify-all.ts", src: srcVerify, lang: "ts",
    note: "13 checks, 5 suites, under 3 seconds, zero dependencies. Also the .smx codec and the CRC-32 implementation." },
  { path: "MERGE_MANIFEST.md", src: srcManifest, lang: "md",
    note: "File-by-file merge map, tsconfig paths, the dependency DAG, the 12-PR sequence, and the architect's sign-off." },
];

function highlight(src: string, lang: F["lang"]) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  let out = esc(src);
  if (lang === "md") {
    out = out.replace(/^(#{1,6} .*)$/gm, '<span class="tk-k">$1</span>');
    out = out.replace(/(\*\*[^*]+\*\*)/g, '<span class="tk-s">$1</span>');
    out = out.replace(/(`[^`]+`)/g, '<span class="tk-n">$1</span>');
    return out;
  }
  out = out.replace(lang === "py" ? /(#[^\n]*)/g : /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tk-c">$1</span>');
  out = out.replace(/(&quot;|&#39;|["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="tk-s">$1$2$1</span>');
  out = out.replace(lang === "py"
    ? /\b(def|class|return|import|from|if|elif|else|for|while|try|except|with|as|None|True|False|not|and|or|in|is|global|raise|pass|continue|break|lambda)\b/g
    : /\b(const|let|var|function|return|if|else|for|while|class|interface|type|export|import|from|new|extends|readonly|public|private|async|await|try|catch|throw|typeof|in|of|as|null|undefined|true|false|void|this|switch|case|break|continue|default|enum)\b/g,
    '<span class="tk-k">$1</span>');
  out = out.replace(/\b(\d+\.?\d*(?:e[-+]?\d+)?)\b/gi, '<span class="tk-n">$1</span>');
  return out;
}

function Source() {
  const [i, setI] = useState(4);
  const f = FILES[i];
  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-panel2 p-2">
        {FILES.map((x, k) => (
          <button key={x.path} onClick={() => setI(k)}
            className={cn("mono border px-2 py-1 text-[9px]",
              i === k ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
            {x.path.split("/").slice(-1)[0]}
          </button>
        ))}
        <span className="mono ml-auto text-[9px] text-dim">
          {f.src.split("\n").length} lines · {(f.src.length / 1024).toFixed(1)} kB
        </span>
      </div>
      <div className="border-b border-line bg-void2 px-3 py-2">
        <div className="mono text-[10.5px] font-bold text-chalk">{f.path}</div>
        <p className="mt-1 text-[11.5px] leading-snug text-dim">{f.note}</p>
      </div>
      <div className="max-h-[560px] overflow-auto bg-void">
        <pre className="mono p-3 text-[10.5px] leading-[1.55]">
          <code dangerouslySetInnerHTML={{ __html: highlight(f.src, f.lang) }} />
        </pre>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ SECTION ══ */

export default function Phase10() {
  return (
    <>
      <section id="p10-top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, var(--fi-accent-soft), transparent 60%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 pt-14 pb-8 sm:px-8">
          <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.3em] uppercase">
            <span className="fi-accent-bg px-2 py-1 font-bold text-void">PHASE 10</span>
            <span className="text-dim">the grand unification</span>
          </div>
          <h1 className="text-balance text-[clamp(2.1rem,6.4vw,5rem)] leading-[0.92] font-black tracking-[-0.038em]">
            Ten phases. Sixteen packages.
            <br />
            <span className="fi-accent-text">Four floats.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-dim sm:text-[16.5px]">
            One client with four modes and no scene reload between them. A binary
            live-link that puts Nanite on your second monitor. A thirteen-check CI
            gate that runs in under three seconds with zero dependencies. And the
            file-by-file plan to land all of it in twelve pull requests.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["D1", "Unified master runtime", "4 modes · 1 camera · 0 reloads", "#7cff4d"],
              ["D2", "UE5.5 live link", "binary WS · 120 Hz · 0 npm deps", "#b46bff"],
              ["D3", "verify-all.ts", "13 checks · <3 s · 0 deps", "#ffc13d"],
              ["D4", "Merge manifest", "16 packages · 12 PRs · signed off", "#3dc8ff"],
            ] as const).map(([n, t, d, c]) => (
              <div key={n} className="fi-panel border border-line bg-panel/70 p-3" style={{ borderColor: c + "44" }}>
                <div className="mono text-[9.5px] font-bold tracking-[0.2em]" style={{ color: c }}>{n}</div>
                <div className="mt-1 text-[13px] leading-tight font-bold">{t}</div>
                <div className="mono mt-1 text-[10px] text-dim">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* D1 */}
      <section id="p10-master" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="10.1" kicker="Deliverable 1" title="The Unified Master Runtime"
          lede="Click in, then press 1·2·3·4, Tab, G and E. Four modes over one world, one 120 Hz clock and one camera rig. Nothing is created or destroyed when you switch — that is why the transition cannot hitch, and the hitch counter in the corner is there to prove it." />
        <SetMixMaster />
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <Panel label="WHY A MODE SWITCH CANNOT HITCH" accent="#7cff4d">
            <Formula>{`requestMode(s, next) {
  return { ...s, prevMode: s.mode, mode: next,
           transitionTicks: 0,
           transitionTotal: MODES[next].settle * 120 };
}`}</Formula>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              That is the entire switch. It sets two integers and two mode ids. It
              does not allocate, load, unload, or touch the renderer. Everything
              visible follows from a critically-damped camera evaluated in the
              normal 120 Hz step, and the camera blend uses the{" "}
              <strong className="text-chalk">same C¹ smoothstep</strong> as the
              terrain geomorph and the portal dissolve — so every transition in
              the game feels like one phenomenon.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
              A "mode" is three things: a camera goal, an input routing table, and
              a residency declaration. Nothing more. The reducers for the avatar,
              the rover and the orbit all exist all the time; a mode decides which
              one receives WASD this frame.
            </p>
          </Panel>
          <Panel label="RESIDENCY, NOT LOADING" accent="#ffc13d" flush>
            <div className="divide-y divide-line/60">
              {MODE_ORDER.map((m) => (
                <div key={m} className="p-2.5">
                  <div className="mono flex items-baseline justify-between text-[10px]">
                    <span className="font-bold" style={{ color: MODES[m].colour }}>{m}</span>
                    <span className="text-dim">{FRAME_BUDGETS[m].budgetMs} ms</span>
                  </div>
                  <div className="mono mt-0.5 text-[9.5px] text-dim">
                    {FRAME_BUDGETS[m].residency.join(" · ")}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-3">
              <p className="text-[11.5px] leading-relaxed text-dim">
                During a transition the live set is the{" "}
                <strong className="text-chalk">union</strong> of both modes, so the
                peak is bounded and known ahead of time. PLAY→GALAXY is the widest
                at {residencyUnion("PLAY", "GALAXY").length} resident sets — still
                inside budget, because GALAXY swaps meshes for impostors rather
                than adding anything.
              </p>
            </div>
          </Panel>
        </div>
      </section>

      {/* D2 */}
      <section id="p10-livelink" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="10.2" kicker="Deliverable 2" title="The UE5.5 Real-Time Live Link"
          lede="Browser on monitor 1, Nanite and Lumen on monitor 2, 120 Hz between them. The browser is authoritative and Unreal is a viewer that happens to be photorealistic — which means the game never waits on the editor, and closing Unreal cannot desync a session." />
        <BridgeInspector />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <Panel label="WHY BINARY" accent="#b46bff">
            <p className="text-[12.5px] leading-relaxed text-dim">
              A rover transform is 24 bytes of payload plus a 16-byte header.
              The equivalent JSON is ~180 bytes. At 120 Hz over an eight-hour
              session that is <strong className="text-chalk">110 MB versus
              600 MB</strong>, on localhost, for no benefit whatsoever. The
              header is fixed-width so the Python side can parse it with one
              <code className="mono text-chalk"> struct.unpack</code>.
            </p>
          </Panel>
          <Panel label="COALESCING, AND WHY IT IS CORRECT" accent="#ffc13d">
            <Formula>{`coalescable = { ROVER, AVATAR, FIDELITY, WAVE }
NOT          = { CARTRIDGE, CHUNK_DELTA, VARIABLE }`}</Formula>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              Transforms are <strong className="text-chalk">idempotent
              snapshots</strong>: frame N+1 fully supersedes frame N. If Unreal
              stalls compiling a shader, queueing 400 stale rover positions helps
              nobody, so we keep only the latest per opcode. Cartridge and chunk
              edits are <em className="not-italic text-chalk">deltas</em> and are
              never dropped — losing one would silently corrupt the mirror.
            </p>
          </Panel>
          <Panel label="THE GAME-THREAD RULE" accent="#ff3d8a">
            <p className="text-[12.5px] leading-relaxed text-dim">
              Unreal's Python runs on the game thread, so a blocking socket read
              would freeze the editor. The socket lives on a worker that only ever
              appends to a <code className="mono text-chalk">deque</code>, and a{" "}
              <code className="mono text-chalk">register_slate_post_tick_callback</code>{" "}
              drains it where <code className="mono text-chalk">unreal.*</code> is
              legal to call. Every handler in the plugin is on the correct thread
              by construction, not by luck.
            </p>
          </Panel>
        </div>
        <div className="mt-3">
          <Panel label="WHAT UNREAL DOES WITH EACH OPCODE" accent="var(--fi-accent)" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="mono border-b border-line text-[9px] tracking-[0.16em] text-dim uppercase">
                    <th className="p-2 font-medium">Op</th><th className="p-2 font-medium">Rate</th>
                    <th className="p-2 font-medium">Bytes</th><th className="p-2 font-medium">UE 5.5 action</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["FIDELITY", "120 Hz", 32, "Mirrors deriveBudget() onto nine Substrate scalars: texel, octaves, relief, wetness, palette, displacement.", "#ff3d8a"],
                    ["CARTRIDGE", "on edit", "~400", "Creates or updates a MaterialInstanceConstant parented to M_SetMix_Nanite_Master; writes the content hash to asset metadata.", "#b46bff"],
                    ["VARIABLE", "120 Hz", "~90", "Scalar poke only — never a recompile. Scrub a slider in the browser and watch Lumen resolve it live.", "#3dc8ff"],
                    ["WAVE", "120 Hz", 36, "Feeds the landscape material's WaveFront vector; UE runs the same C¹ geomorph in World Position Offset.", "#7cff4d"],
                    ["ROVER", "120 Hz", 40, "set_actor_location_and_rotation, plus speed/drift into the rover MID for wheel blur.", "#ffc13d"],
                    ["CHUNK_DELTA", "on sculpt", "~1 kB", "Marks one DynamicMeshComponent for rebuild. Only the touched chunk.", "#86c954"],
                  ] as const).map(([op, rate, bytes, act, c]) => (
                    <tr key={op} className="border-b border-line/50 align-top hover:bg-panel2/70">
                      <td className="mono p-2 text-[11px] font-bold" style={{ color: c }}>{op}</td>
                      <td className="mono p-2 text-[10.5px] text-chalk">{rate}</td>
                      <td className="mono p-2 text-[10.5px] text-dim">{bytes}</td>
                      <td className="max-w-[460px] p-2 text-[11.5px] leading-snug text-dim">{act}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>

      {/* D3 */}
      <section id="p10-verify" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="10.3" kicker="Deliverable 3" title="The Master CI Gate"
          lede="Five suites guarding five properties that would be nearly impossible to debug if they broke silently. Press run — these are the same assertions the CI job executes, imported from the same file, not re-implemented." />
        <VerifyRunner />
        <div className="mt-3">
          <ArchPanels />
        </div>
        <div className="mt-3">
          <Panel label="WHY THESE FIVE" accent="var(--fi-accent)">
            <div className="grid gap-4 lg:grid-cols-5">
              {([
                ["A", "Budget determinism", "If deriveBudget drifts, two players at the same Fi see different worlds and the Galaxy's content hashes stop matching. 10,000 configs, each run twice."],
                ["B", ".smx roundtrip", "A cartridge is the game's unit of authorship. A lossy codec would corrupt player work silently, months later, with no stack trace."],
                ["C", "Rollback convergence", "A single float in the command applier desyncs four clients within a minute and presents as 'rubber-banding' three weeks later. Integer-only, asserted."],
                ["D", "Save CRC", "Forty hours of play. The budget is 50 kB and bit-exactness is non-negotiable; a corrupted save must refuse to load rather than load wrong."],
                ["E", "Acyclic packages", "Cycles are how a pure package quietly acquires a dependency on the renderer. Asserted in CI, not left to convention."],
              ] as const).map(([k, t, d]) => (
                <div key={k}>
                  <div className="mono fi-accent-text text-[11px] font-black">{k}</div>
                  <div className="mt-1 text-[12.5px] leading-tight font-bold">{t}</div>
                  <p className="mt-1 text-[11.5px] leading-snug text-dim">{d}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* D4 */}
      <section id="p10-manifest" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8">
        <SectionHead n="10.4" kicker="Deliverable 4" title="The Merge Manifest & Sign-Off"
          lede="Sixteen packages, twelve pull requests, and a build order asserted by the test suite rather than by a wiki page. Four of the PRs are pure functions with zero side effects and cannot break anything that exists today — land those first, in any order." />
        <div className="mb-3 grid gap-3 lg:grid-cols-4">
          {([
            ["~11,400", "lines of production TypeScript", "#e8eef7"],
            ["16", "packages · 8 provably pure", "#7cff4d"],
            ["0", "runtime dependencies · 0 servers", "#3dc8ff"],
            ["0", "image assets · 0 audio assets", "#b46bff"],
          ] as const).map(([n, t, c]) => (
            <Panel key={t} label={t} accent={c}>
              <div className="text-3xl leading-none font-black" style={{ color: c }}>{n}</div>
            </Panel>
          ))}
        </div>
        <Source />

        <div className="fi-panel relative mt-10 overflow-hidden border border-line bg-panel p-6 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 15% 0%, var(--fi-accent-soft), transparent 60%)" }} />
          <div className="relative">
            <div className="mono text-[10px] tracking-[0.3em] text-dim uppercase">
              Architect's sign-off · phases 1–10
            </div>
            <p className="text-balance mt-4 max-w-4xl text-xl leading-snug font-light sm:text-[2rem]">
              Ten phases ago the brief asked for a game where terraforming a planet
              means raising its render fidelity. The risk with a premise that clean
              is that it survives the pitch and dies in the architecture.
            </p>
            <p className="mt-5 max-w-3xl text-[14px] leading-relaxed text-dim">
              That did not happen, and the reason is a single decision made in
              Section 1 and never revisited:{" "}
              <strong className="text-chalk">the planet's save state is four floats.</strong>{" "}
              <span className="text-pxd">Pxd</span>, <span className="text-vtx">Vtx</span>,{" "}
              <span className="text-lx">Lx</span>, <span className="text-aq">Aq</span>.
              Everything else in eleven thousand lines is a pure function of those
              four numbers and a content-hashed preset graph.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["deriveBudget()", "→ texels, octaves, relief, shading model"],
                ["meshPolicyFor()", "→ a dual-contouring policy"],
                ["profileFor()", "→ whether the goblin can walk up a hill"],
                ["avatarBudget()", "→ how many triangles the goblin has"],
                ["audio.update()", "→ bit depth, Nyquist, reverb tail"],
                ["PlanetManifest", "→ ships them; a visitor re-derives the world"],
                ["SetmixLiveLink", "→ mirrors them; Unreal agrees with the browser"],
                ["uniformsFor()", "→ one GLSL program, six stages, zero variants"],
              ] as const).map(([fn, d]) => (
                <div key={fn} className="border-l-2 fi-accent-border pl-2">
                  <div className="mono text-[10.5px] font-bold text-chalk">{fn}</div>
                  <div className="text-[10.5px] leading-snug text-dim">{d}</div>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-3xl text-[14px] leading-relaxed text-dim">
              No system needed a fifth number. That is not a coincidence — it is
              the whole reason the parts compose. A design where every subsystem
              reads the same small state{" "}
              <strong className="text-chalk">cannot drift out of sync, because
              there is nothing to sync.</strong>
            </p>
            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              {([
                ["r(t) is invertible", "Chunks are scheduled, never polled, and the reverse wave is the forward wave replayed backwards at 2×. A planet-scale effect that costs nothing when nothing is happening.", "#7cff4d"],
                ["s is a function of world position", "Two neighbours sampling a shared boundary point compute the same value to the bit, so the LOD seam is impossible rather than patched — and it holds DURING the transition, which is the case that breaks most LOD systems.", "#3dc8ff"],
                ["Failure is a visual", "No tooltip says the grid is starving; the machine pixelates. No log says the planet is unbalanced; the coherence term greys out the colour grade. The debug output IS the art direction.", "#ff3d8a"],
              ] as const).map(([t, d, c]) => (
                <div key={t} className="fi-panel border border-line bg-void2/70 p-3" style={{ borderColor: c + "44" }}>
                  <div className="mono text-[11px] font-black" style={{ color: c }}>{t}</div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-3xl text-[13.5px] leading-relaxed text-dim">
              What I would watch in production: the Fusion Matrix's discovery curve
              is untested at scale. Fourteen hundred recipes is a lot of surface
              area for emergent nonsense, and the Speculation Sphere is the only
              thing standing between the player and a bad surprise. Prototype it
              with real players in week one, before the content team commits.
            </p>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-dim">
              The vertical slice is fourteen weeks with nine people, and the
              riskiest thing in it is still the stage-transition sweep. Build that
              in week one, before any content exists. If the sweep is not magic,
              nothing downstream of it matters.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <Tag color="var(--fi-accent)" solid>SHIP IT</Tag>
              <Tag color="#7cff4d">13 checks green</Tag>
              <Tag color="#3dc8ff">0 cycles</Tag>
              <Tag color="#b46bff">0 dependencies</Tag>
              <span className="mono ml-auto text-[10px] text-dim">
                — Architect, SetMix: The Resolution Crafter
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
