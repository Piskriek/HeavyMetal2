import { useEffect, useRef } from "react";
import type { QuestState, QuestNotification } from "@/drop/QuestEngine";
import { ACT_META, questTelemetry } from "@/drop/QuestEngine";
import { cn } from "@/utils/cn";

export interface HUDModel {
  fi: number;
  stage: number;
  metrics: { pxd: number; vtx: number; lx: number; aq: number };
  rates: { pxd: number; vtx: number; lx: number; aq: number };
  coherence: number;
  world: "LAB" | "MOON";
  reticle: string;
  mineProgress: number;
  hotbar: number;
  inventory: { CHROMATIC_CRYSTAL: number; TOPOLOGY_SHARD: number };
  quest: QuestState;
  locked: boolean;
  waveActive: boolean;
  waveRadius: number;
  plumes: number;
  machines: number;
}

const TARGETS = { pxd: 1.24e8, vtx: 9.4e7, lx: 6.6e7, aq: 4.1e7 };
const COLOUR = { pxd: "#ff3d8a", vtx: "#7cff4d", lx: "#ffc13d", aq: "#3dc8ff" };
const LABEL = { pxd: "PXD", vtx: "VTX", lx: "LX", aq: "AQ" };

const fmt = (n: number) =>
  n < 1000 ? n.toFixed(0)
  : n < 1e6 ? (n / 1e3).toFixed(1) + "K"
  : n < 1e9 ? (n / 1e6).toFixed(2) + "M" : (n / 1e9).toFixed(2) + "B";

const HOTBAR = [
  { k: "Pixel Chimney", c: "#ff3d8a", g: "▲" },
  { k: "Solar Collector", c: "#ffe08a", g: "▬" },
  { k: "Coherence Beacon", c: "#e8eef7", g: "◈" },
  { k: "Moon Regolith", c: "#8b8f98", g: "▣" },
  { k: "Mud / Clay", c: "#c98a5b", g: "▣" },
  { k: "Linear Strata", c: "#7cff4d", g: "▣" },
  { k: "—", c: "#2a3242", g: "" },
  { k: "—", c: "#2a3242", g: "" },
];

/* ───────────────────────────────── the Fi radial, drawn on canvas ────── */
function FiRadial({ fi, stage }: { fi: number; stage: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = 112 * dpr;
    cv.width = S; cv.height = S;
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, R = S * 0.40;
    // log progress toward 100M
    const p = Math.min(1, Math.log1p(Math.max(0, fi)) / Math.log1p(1e8));

    g.strokeStyle = "rgba(27,36,52,0.95)"; g.lineWidth = 6 * dpr;
    g.beginPath(); g.arc(cx, cy, R, -Math.PI * 0.75, Math.PI * 0.75); g.stroke();

    // stage ticks
    for (let i = 1; i <= 5; i++) {
      const sp = Math.log1p([1.2e3, 3e4, 7.5e5, 5e6, 2.6e7][i - 1]) / Math.log1p(1e8);
      const a = -Math.PI * 0.75 + sp * Math.PI * 1.5;
      g.strokeStyle = i < stage ? "rgba(232,238,247,0.6)" : "rgba(107,122,144,0.45)";
      g.lineWidth = 1.5 * dpr;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 7 * dpr), cy + Math.sin(a) * (R - 7 * dpr));
      g.lineTo(cx + Math.cos(a) * (R + 7 * dpr), cy + Math.sin(a) * (R + 7 * dpr));
      g.stroke();
    }

    const grd = g.createLinearGradient(0, 0, S, S);
    grd.addColorStop(0, "#ff3d8a"); grd.addColorStop(0.5, "#7cff4d"); grd.addColorStop(1, "#3dc8ff");
    g.strokeStyle = grd; g.lineWidth = 6 * dpr; g.lineCap = "round";
    g.beginPath();
    g.arc(cx, cy, R, -Math.PI * 0.75, -Math.PI * 0.75 + p * Math.PI * 1.5);
    g.stroke();
  }, [fi, stage]);
  return <canvas ref={ref} style={{ width: 112, height: 112 }} />;
}

/* ─────────────────────────────────────────── contextual reticle ──────── */
function Reticle({ kind, progress }: { kind: string; progress: number }) {
  const map: Record<string, { c: string; label: string }> = {
    NONE: { c: "#8b9bb4", label: "" },
    CRYSTAL: { c: "#ff3d8a", label: "CHROMATIC CRYSTAL · hold LMB" },
    SHARD: { c: "#7cff4d", label: "TOPOLOGY SHARD · hold LMB" },
    PLACE: { c: "#ffc13d", label: "RMB to place" },
    MACHINE: { c: "#b46bff", label: "E to interact" },
  };
  const m = map[kind] ?? map.NONE;
  const active = kind !== "NONE";
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <svg width="46" height="46" viewBox="0 0 46 46" className="overflow-visible">
        {active ? (
          <>
            {[0, 90, 180, 270].map((a) => (
              <line key={a} x1={23} y1={9} x2={23} y2={15} stroke={m.c} strokeWidth={1.6}
                transform={`rotate(${a} 23 23)`} />
            ))}
            <circle cx={23} cy={23} r={13} fill="none" stroke={m.c} strokeWidth={0.9} opacity={0.4} />
            {progress > 0 && (
              <circle cx={23} cy={23} r={13} fill="none" stroke={m.c} strokeWidth={2.6}
                strokeDasharray={`${progress * 81.6} 81.6`} transform="rotate(-90 23 23)" strokeLinecap="round" />
            )}
          </>
        ) : (
          <>
            <circle cx={23} cy={23} r={1.6} fill="#8b9bb4" opacity={0.85} />
            <circle cx={23} cy={23} r={9} fill="none" stroke="#8b9bb4" strokeWidth={0.7} opacity={0.3} />
          </>
        )}
      </svg>
      {m.label && (
        <div className="mono mt-2 text-[9px] tracking-[0.2em] uppercase drop-shadow-[0_1px_4px_#000]"
          style={{ color: m.c }}>{m.label}</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ THE HUD ══ */

export default function SetmixHUD({
  model, toasts, audioOn, onToggleAudio,
}: {
  model: HUDModel;
  toasts: QuestNotification[];
  audioOn: boolean;
  onToggleAudio: () => void;
}) {
  const m = model;
  const tel = questTelemetry(m.quest);
  const active = m.quest.objectives.filter((o) => o.act === m.quest.act && !o.done);
  const hold = toasts.find((t) => t.holdSeconds);

  // which metric is climbing fastest — the derivative indicator
  const fastest = (Object.keys(m.rates) as (keyof typeof m.rates)[])
    .reduce((a, b) => (m.rates[b] / TARGETS[b] > m.rates[a] / TARGETS[a] ? b : a), "pxd");

  const coh = m.coherence;
  const cohState = coh > 0.7 ? "NOMINAL" : coh > 0.45 ? "UNDERSAMPLED" : coh > 0.2 ? "QUANTISED" : "Z-FIGHTING";
  const cohColour = coh > 0.7 ? "#7cff4d" : coh > 0.45 ? "#ffc13d" : "#ff3d8a";

  return (
    <>
      {/* screen-space degradation as coherence drops — the HUD itself dithers */}
      {m.world === "MOON" && coh < 0.72 && (
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay"
          style={{
            opacity: (0.72 - coh) * 1.1,
            backgroundImage: "radial-gradient(rgba(255,61,138,0.5) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }} />
      )}
      {m.locked && <Reticle kind={m.reticle} progress={m.mineProgress} />}

      {/* ── TOP LEFT · Fi radial ─────────────────────────────────────── */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-start gap-3">
        <div className="relative">
          <FiRadial fi={m.fi} stage={m.stage} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="mono text-[8px] tracking-[0.25em] text-dim">FIDELITY</div>
            <div className="mono tnum text-[17px] leading-none font-black text-chalk drop-shadow-[0_1px_4px_#000]">
              {fmt(m.fi)}
            </div>
            <div className="mono mt-0.5 text-[9px] font-bold tracking-[0.2em]"
              style={{ color: m.stage >= 3 ? "#7cff4d" : "#8b9bb4" }}>
              S{m.stage}
            </div>
          </div>
        </div>
        <div className="pt-2">
          <div className="mono text-[8.5px] tracking-[0.3em] uppercase"
            style={{ color: m.world === "LAB" ? "#e8eef7" : "#8b9bb4" }}>
            {m.world === "LAB" ? "▣ THE WHITE ROOM" : "◇ KEPLER-7B"}
          </div>
          <div className="mono mt-1 space-y-[3px]">
            {(["pxd", "vtx", "lx", "aq"] as const).map((k) => {
              const p = Math.min(1, Math.log1p(m.metrics[k]) / Math.log1p(TARGETS[k]));
              return (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="w-6 text-[8px] font-bold" style={{ color: COLOUR[k] }}>{LABEL[k]}</span>
                  <span className="relative block h-[5px] w-[96px] border border-line/80 bg-void/70">
                    <span className="absolute inset-y-0 left-0" style={{
                      width: `${p * 100}%`, background: COLOUR[k],
                      boxShadow: `0 0 6px ${COLOUR[k]}`,
                    }} />
                  </span>
                  <span className="tnum w-11 text-[8px] text-chalk/70">{fmt(m.metrics[k])}</span>
                  {fastest === k && m.rates[k] > 0 && (
                    <span className="text-[8px] anim-pulse" style={{ color: COLOUR[k] }}>▲</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── TOP RIGHT · objectives ───────────────────────────────────── */}
      <div className="pointer-events-none absolute top-3 right-3 w-[270px] text-right">
        <div className="mono text-[8.5px] tracking-[0.25em] uppercase"
          style={{ color: ACT_META[m.quest.act].colour }}>
          ACT {ACT_META[m.quest.act].n} · {ACT_META[m.quest.act].title}
        </div>
        <div className="mono mt-1 space-y-1">
          {active.slice(0, 3).map((o) => (
            <div key={o.id} className="border-r-2 pr-2" style={{ borderColor: ACT_META[o.act].colour }}>
              <div className="text-[10.5px] leading-tight text-chalk drop-shadow-[0_1px_3px_#000]">
                {o.text}
              </div>
              {o.need > 1 && (
                <div className="mt-0.5 flex items-center justify-end gap-1.5">
                  <span className="relative block h-[3px] w-[70px] bg-void/80">
                    <span className="absolute inset-y-0 left-0"
                      style={{ width: `${o.progress * 100}%`, background: ACT_META[o.act].colour }} />
                  </span>
                  <span className="tnum text-[8.5px] text-dim">{o.have}/{o.need}</span>
                </div>
              )}
            </div>
          ))}
          {active.length === 0 && (
            <div className="text-[10px] text-vtx">act complete</div>
          )}
        </div>
        <div className="mono mt-2 text-[8px] text-dim/70">
          {tel.minutes.toFixed(1)} min · {tel.done}/{tel.total} ·{" "}
          {m.machines} machines · {m.plumes} motes
          {m.waveActive && <span className="text-vtx"> · WAVE r={m.waveRadius.toFixed(0)}m</span>}
        </div>
      </div>

      {/* ── BOTTOM LEFT · coherence ──────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-3 left-3">
        <div className="mono mb-1 flex items-baseline gap-2 text-[8.5px] tracking-[0.2em] uppercase">
          <span className="text-dim">COHERENCE</span>
          <span style={{ color: cohColour }} className={coh < 0.45 ? "anim-pulse font-bold" : ""}>
            {cohState}
          </span>
        </div>
        <div className="relative h-[7px] w-[190px] border border-line bg-void/80">
          <div className="absolute inset-y-0 left-0 transition-[width] duration-100"
            style={{ width: `${coh * 100}%`, background: cohColour, boxShadow: `0 0 8px ${cohColour}` }} />
          {[0.2, 0.45, 0.7].map((x) => (
            <div key={x} className="absolute inset-y-0 w-px bg-void" style={{ left: `${x * 100}%` }} />
          ))}
        </div>
        <div className="mono mt-1 flex gap-3 text-[8.5px]">
          <span className="text-pxd">◆ {m.inventory.CHROMATIC_CRYSTAL}</span>
          <span className="text-vtx">◇ {m.inventory.TOPOLOGY_SHARD}</span>
        </div>
      </div>

      {/* ── BOTTOM CENTRE · hotbar ───────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
        <div className="flex gap-1">
          {HOTBAR.map((h, i) => {
            const on = m.hotbar === i;
            const qty = i === 0 ? m.inventory.CHROMATIC_CRYSTAL >= 4 ? "✓" : "4◆" : "";
            return (
              <div key={i}
                className={cn("relative flex h-11 w-11 flex-col items-center justify-center border bg-void/75 backdrop-blur-sm transition-all",
                  on ? "scale-110" : "opacity-70")}
                style={{ borderColor: on ? h.c : h.c + "44" }}>
                <span className="text-[15px] leading-none" style={{ color: h.c }}>{h.g}</span>
                <span className="mono absolute top-[2px] left-[3px] text-[7px] text-dim">{i + 1}</span>
                {qty && <span className="mono absolute right-[3px] bottom-[2px] text-[7px] text-pxd">{qty}</span>}
              </div>
            );
          })}
        </div>
        <div className="mono mt-1 text-center text-[9px] tracking-[0.15em]"
          style={{ color: HOTBAR[m.hotbar].c }}>
          {HOTBAR[m.hotbar].k}
        </div>
      </div>

      {/* ── BOTTOM RIGHT · audio toggle ──────────────────────────────── */}
      <button onClick={onToggleAudio}
        className={cn("mono absolute right-3 bottom-3 border px-2 py-1 text-[9px] font-bold tracking-[0.15em] uppercase backdrop-blur-sm",
          audioOn ? "border-vtx/60 bg-vtx/15 text-vtx" : "border-line bg-void/70 text-dim hover:text-chalk")}>
        {audioOn ? "◉ audio" : "○ audio"}
      </button>

      {/* ── TOASTS ───────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 w-[400px] -translate-x-1/2 translate-y-16 space-y-1.5">
        {toasts.filter((t) => !t.holdSeconds).slice(-3).map((t) => (
          <div key={t.id}
            className="fi-panel border bg-void/85 px-3 py-2 backdrop-blur-sm"
            style={{ borderColor: t.colour + "66" }}>
            {t.title && (
              <div className="mono text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: t.colour }}>
                {t.kind === "UNLOCK" ? "⊕ " : t.kind === "WARNING" ? "⚠ " : "✓ "}{t.title}
              </div>
            )}
            <div className="mt-0.5 text-[11px] leading-snug text-chalk/90">{t.body}</div>
          </div>
        ))}
      </div>

      {/* ── THE BEAT · stops the world ───────────────────────────────── */}
      {hold && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-void/55 backdrop-blur-[2px]">
          <div className="max-w-lg px-8 text-center">
            <div className="mono text-[10px] tracking-[0.4em] uppercase anim-pulse" style={{ color: hold.colour }}>
              {hold.title}
            </div>
            <p className="mt-3 text-[15px] leading-snug font-light text-chalk">{hold.body}</p>
          </div>
        </div>
      )}
    </>
  );
}
