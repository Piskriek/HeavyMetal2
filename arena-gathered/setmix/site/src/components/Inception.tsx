import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScene,
  zoomInto,
  escapeUp,
  select,
  toggleExpand,
  rename,
  setTool,
  cycleHotbar,
  activeScope,
  matches,
  subtreeCost,
  setVisible,
  SCOPE_META,
  TOOLS,
  TOOL_BY_ID,
  type OutlinerState,
  type OutlinerNode,
} from "@/engine/setmix/outliner";
import { BY_ID } from "@/engine/setmix/library";
import { deriveBudget, toEvaluateOptions, adaptGraph, DEVICES } from "@/engine/setmix/core";
import { profileSample, type MeshPolicy } from "@/engine/setmix/mesh";
import TexCanvas from "@/components/TexCanvas";
import { cn } from "@/utils/cn";

const PREVIEW_BUDGET = deriveBudget(
  { pxd: 3.4e7, vtx: 2.6e7, lx: 1.8e7, aq: 5e4, tick: 0 },
  DEVICES[0],
);
const PREVIEW_OPTS = toEvaluateOptions(PREVIEW_BUDGET, 7);

/* ───────────────────────────────────────────────────────── viewport ──── */

const POL: MeshPolicy = {
  lod: 2, cellSize: 2, mode: "DUAL", chamfer: 0.5, relaxIterations: 5,
  smoothAngleDeg: 150, qefClamp: 0.34, stage: 4,
};
function hh(x: number) {
  return Math.sin(x * 0.09) * 7 + Math.sin(x * 0.31 + 1.2) * 2.6 + Math.sin(x * 0.03) * 4;
}

function ScopeViewport({ s, node }: { s: OutlinerState; node: OutlinerNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const kind = node.kind;

  useEffect(() => {
    if (kind === "CARTRIDGE" || kind === "VARIABLE") return;
    const cv = ref.current;
    if (!cv) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.max(240, Math.round(r.width * dpr));
      const H = Math.max(160, Math.round(r.height * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;
      const t = performance.now() / 1000;
      g.fillStyle = "#05070c"; g.fillRect(0, 0, W, H);
      const cxp = W / 2, cyp = H / 2;
      const col = SCOPE_META[kind].colour;

      if (kind === "GALAXY" || kind === "SYSTEM") {
        for (let i = 0; i < 180; i++) {
          const a = (i * 2.399) % 6.283;
          const rr = (i / 180) ** 0.7 * Math.min(W, H) * 0.47;
          const x = cxp + Math.cos(a + t * 0.02) * rr;
          const y = cyp + Math.sin(a + t * 0.02) * rr * 0.56;
          g.fillStyle = `rgba(200,215,240,${0.1 + (i % 7) / 22})`;
          g.fillRect(x, y, 1.2 * dpr, 1.2 * dpr);
        }
        const kids = node.childIds.map((id) => s.nodes.get(id)!).filter(Boolean);
        kids.forEach((k, i) => {
          const a = t * 0.12 + (i / Math.max(1, kids.length)) * 6.283;
          const rr = Math.min(W, H) * (kind === "GALAXY" ? 0.3 : 0.24) * (1 + (i % 3) * 0.22);
          const x = cxp + Math.cos(a) * rr, y = cyp + Math.sin(a) * rr * 0.56;
          g.strokeStyle = "rgba(139,155,180,0.18)"; g.lineWidth = 1;
          g.beginPath(); g.ellipse(cxp, cyp, rr, rr * 0.56, 0, 0, 6.283); g.stroke();
          g.fillStyle = k.id === s.selectionId ? "#fff" : (k.tint ?? col);
          g.beginPath(); g.arc(x, y, 5 * dpr, 0, 6.283); g.fill();
          g.font = `${9 * dpr}px ui-monospace, monospace`;
          g.fillStyle = "#8b9bb4";
          g.fillText(k.name, x + 9 * dpr, y + 3 * dpr);
        });
      } else if (kind === "MOON") {
        const R = Math.min(W, H) * 0.36;
        const m = node.payload?.metrics;
        const kids = node.childIds.map((id) => s.nodes.get(id)!).filter((k) => k?.kind === "BIOME");
        g.save(); g.beginPath(); g.arc(cxp, cyp, R, 0, 6.283); g.clip();
        kids.forEach((k, i) => {
          const a0 = (i / kids.length) * 6.283 + t * 0.05;
          const a1 = ((i + 1) / kids.length) * 6.283 + t * 0.05;
          g.beginPath(); g.moveTo(cxp, cyp);
          g.arc(cxp, cyp, R, a0, a1); g.closePath();
          g.fillStyle = (k.tint ?? col) + (k.id === s.selectionId ? "cc" : "66");
          g.fill();
        });
        g.restore();
        g.strokeStyle = "rgba(232,238,247,0.35)"; g.lineWidth = 1.4 * dpr;
        g.beginPath(); g.arc(cxp, cyp, R, 0, 6.283); g.stroke();
        const grd = g.createRadialGradient(cxp - R * 0.3, cyp - R * 0.35, 0, cxp, cyp, R * 1.3);
        grd.addColorStop(0, "rgba(255,255,255,0.14)"); grd.addColorStop(1, "rgba(0,0,0,0.55)");
        g.fillStyle = grd; g.beginPath(); g.arc(cxp, cyp, R, 0, 6.283); g.fill();
        if (m) {
          const bars: [string, number, string][] = [
            ["Pxd", m.pxd / 1.24e8, "#ff3d8a"], ["Vtx", m.vtx / 9.4e7, "#7cff4d"],
            ["Lx", m.lx / 6.6e7, "#ffc13d"], ["Aq", m.aq / 4.1e7, "#3dc8ff"],
          ];
          bars.forEach((b, i) => {
            const y = H - (bars.length - i) * 13 * dpr - 6 * dpr;
            g.fillStyle = "#1b2434"; g.fillRect(8 * dpr, y, W * 0.28, 5 * dpr);
            g.fillStyle = b[2]; g.fillRect(8 * dpr, y, W * 0.28 * Math.min(1, b[1]), 5 * dpr);
            g.font = `${8 * dpr}px ui-monospace, monospace`; g.fillStyle = b[2];
            g.fillText(b[0], 8 * dpr + W * 0.29, y + 5 * dpr);
          });
        }
      } else if (kind === "BIOME" || kind === "CHUNK") {
        const G = kind === "BIOME" ? 16 : 8;
        const cell = Math.min(W, H) / (G + 2);
        const ox = cxp - (G * cell) / 2, oy = cyp - (G * cell) / 2;
        for (let j = 0; j < G; j++)
          for (let i = 0; i < G; i++) {
            const n = (Math.sin(i * 1.7 + j * 2.3 + (node.id.length % 7)) + 1) / 2;
            const lit = n > 0.62 ? 1 : n > 0.34 ? 0.55 : 0.25;
            g.fillStyle = `rgba(${kind === "BIOME" ? "124,255,77" : "180,200,230"},${lit * 0.5})`;
            g.fillRect(ox + i * cell, oy + j * cell, cell - 1.4, cell - 1.4);
          }
        g.strokeStyle = (node.tint ?? col) + "88"; g.lineWidth = 1.5 * dpr;
        g.strokeRect(ox, oy, G * cell, G * cell);
        if (kind === "CHUNK") {
          g.beginPath();
          for (let i = 0; i <= 160; i++) {
            const wx = (i / 160) * 64 - 32;
            const y = oy + G * cell + 18 * dpr - profileSample(wx, (x) => hh(x), POL, 0) * 2.2 * dpr;
            i ? g.lineTo(ox + (i / 160) * G * cell, y) : g.moveTo(ox, y);
          }
          g.strokeStyle = "#7cff4d"; g.lineWidth = 2 * dpr; g.stroke();
          g.font = `${9 * dpr}px ui-monospace, monospace`; g.fillStyle = "#6b7a90";
          g.fillText(node.payload?.chunk?.policy ?? "", ox, oy - 6 * dpr);
        }
      } else if (kind === "OBJECT") {
        const bh = H * 0.62, bw = Math.min(W, H) * 0.1;
        g.fillStyle = "#141a26";
        g.beginPath();
        g.moveTo(cxp - bw, cyp + bh / 2); g.lineTo(cxp + bw, cyp + bh / 2);
        g.lineTo(cxp + bw * 0.42, cyp - bh / 2); g.lineTo(cxp - bw * 0.42, cyp - bh / 2);
        g.closePath(); g.fill();
        g.strokeStyle = (node.tint ?? col) + "cc"; g.lineWidth = 1.4 * dpr; g.stroke();
        const slots = node.childIds.map((id) => s.nodes.get(id)!).filter(Boolean).slice(0, 3);
        slots.forEach((k, i) => {
          const y = cyp - bh * 0.18 + i * 16 * dpr;
          g.fillStyle = k.tint ?? "#2a3242";
          g.fillRect(cxp - bw * 0.52, y, bw * 1.04, 9 * dpr);
          g.font = `${8 * dpr}px ui-monospace, monospace`; g.fillStyle = "#8b9bb4";
          g.fillText(k.name.slice(0, 22), cxp + bw * 0.7, y + 8 * dpr);
        });
        for (let i = 0; i < 26; i++) {
          const p = ((t * 0.3 + i / 26) % 1);
          const y = cyp - bh / 2 - p * H * 0.3;
          const sp = p * bw * 1.5;
          g.fillStyle = `rgba(180,107,255,${(1 - p) * 0.8})`;
          g.fillRect(cxp + Math.sin(i * 2.2 + t) * sp, y, 2.4 * dpr, 2.4 * dpr);
        }
      } else if (kind === "TEXNODE") {
        const tn = node.payload?.texNode;
        const siblings = node.parentId ? (s.nodes.get(node.parentId)?.childIds ?? []) : [];
        const items = siblings.map((id) => s.nodes.get(id)!).filter(Boolean);
        const cols = Math.ceil(Math.sqrt(items.length || 1));
        items.forEach((k, i) => {
          const x = 40 * dpr + (i % cols) * ((W - 80 * dpr) / Math.max(1, cols - 1 || 1));
          const y = 40 * dpr + Math.floor(i / cols) * 44 * dpr;
          const on = k.id === node.id;
          g.fillStyle = on ? "#3dc8ff" : "#131a26";
          g.fillRect(x - 26 * dpr, y - 11 * dpr, 52 * dpr, 22 * dpr);
          g.strokeStyle = on ? "#fff" : "#2a3242"; g.lineWidth = 1; g.strokeRect(x - 26 * dpr, y - 11 * dpr, 52 * dpr, 22 * dpr);
          g.font = `${8 * dpr}px ui-monospace, monospace`;
          g.fillStyle = on ? "#04060a" : "#8b9bb4";
          g.fillText(k.name.split(" · ")[1] ?? k.name, x - 22 * dpr, y + 3 * dpr);
        });
        g.font = `${10 * dpr}px ui-monospace, monospace`; g.fillStyle = "#3dc8ff";
        g.fillText(`${tn?.type ?? ""} → ${Object.keys(tn ?? {}).length - 2} params`, 10 * dpr, H - 10 * dpr);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind, node, s]);

  if (kind === "CARTRIDGE") {
    const cart = node.payload?.cartridge ?? BY_ID.get("moon_regolith")!;
    const g = adaptGraph(cart.graph, PREVIEW_BUDGET);
    return (
      <div className="flex h-full items-center justify-center bg-void p-4">
        <div className="w-full max-w-[260px]">
          <div className="border border-line">
            <TexCanvas graph={g} opts={PREVIEW_OPTS} channel="lit" />
          </div>
          <div className="mono mt-2 text-center text-[9.5px] text-dim">
            {cart.graph.nodes.length} nodes · {cart.hash} · evaluated live
          </div>
        </div>
      </div>
    );
  }
  if (kind === "VARIABLE") {
    const v = node.payload?.variable;
    const val = node.payload?.value ?? 0;
    return (
      <div className="flex h-full flex-col items-center justify-center bg-void p-6">
        <div className="mono text-[9px] tracking-[0.3em] text-dim uppercase">{v?.real}</div>
        <div className="mono tnum mt-2 text-5xl font-black text-pxd">{val.toFixed(2)}</div>
        <div className="mono mt-1 text-[10px] text-dim">
          {v?.unit} · range [{v?.min} … {v?.max}]
        </div>
        <div className="mt-4 h-1.5 w-full max-w-[260px] bg-line">
          <div
            className="h-full bg-pxd"
            style={{ width: `${Math.min(100, Math.max(0, ((val - (v?.min ?? 0)) / ((v?.max ?? 1) - (v?.min ?? 0))) * 100))}%` }}
          />
        </div>
        <p className="mono mt-4 max-w-[320px] text-center text-[10.5px] leading-snug text-dim">
          {v?.explain}
        </p>
        <div className="mono mt-3 text-[9px] text-flux">{v?.path}</div>
      </div>
    );
  }
  return <canvas ref={ref} className="h-full w-full" />;
}

/* ───────────────────────────────────────────────────────── tree row ──── */

function Row({
  s, id, depth, onSel, onZoom, onExpand, onVis, editing, setEditing, onRename,
}: {
  s: OutlinerState; id: string; depth: number;
  onSel: (id: string) => void; onZoom: (id: string) => void;
  onExpand: (id: string) => void; onVis: (id: string, v: boolean) => void;
  editing: string | null; setEditing: (v: string | null) => void;
  onRename: (id: string, n: string) => void;
}) {
  const n = s.nodes.get(id);
  if (!n) return null;
  if (!matches(s, id, s.search)) return null;
  const open = s.expanded.has(id) || (!!s.search && n.childIds.length > 0);
  const sel = s.selectionId === id;
  const inPath = s.path.includes(id);
  const meta = SCOPE_META[n.kind];

  return (
    <>
      <div
        onClick={() => onSel(id)}
        onDoubleClick={() => onZoom(id)}
        className={cn(
          "mono group grid cursor-pointer grid-cols-[1fr_46px_38px_26px] items-center gap-1 border-b border-line/35 px-1.5 py-[3px] text-[10px] transition-colors",
          sel ? "bg-chalk/12" : inPath ? "bg-panel2/80" : "hover:bg-panel2/60",
        )}
      >
        <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 9 }}>
          {n.childIds.length ? (
            <button
              onClick={(e) => { e.stopPropagation(); onExpand(id); }}
              className="w-3 shrink-0 text-dim hover:text-chalk"
            >
              {open ? "▾" : "▸"}
            </button>
          ) : <span className="w-3 shrink-0" />}
          <span className="shrink-0" style={{ color: n.tint ?? meta.colour }}>{meta.glyph}</span>
          {editing === id ? (
            <input
              autoFocus
              defaultValue={n.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => { onRename(id, e.target.value); setEditing(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onRename(id, (e.target as HTMLInputElement).value); setEditing(null); }
                if (e.key === "Escape") { e.stopPropagation(); setEditing(null); }
              }}
              className="min-w-0 flex-1 border border-flux bg-void px-1 text-[10px] text-chalk outline-none"
            />
          ) : (
            <span
              className={cn("truncate", n.visible ? "" : "opacity-35", sel && "text-white")}
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(id); }}
            >
              {n.name}
            </span>
          )}
          <span className="shrink-0 text-[7.5px] tracking-wider text-dim/60">{n.kind}</span>
        </div>
        <span className="tnum text-right text-dim">{n.tris ? (n.tris / 1000).toFixed(0) + "k" : "·"}</span>
        <span className="tnum text-right text-dim">{n.ms?.toFixed(2) ?? "·"}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onVis(id, !n.visible); }}
          className="text-right text-dim hover:text-chalk"
        >
          {n.visible ? "◉" : "○"}
        </button>
      </div>
      {open && n.childIds.map((c) => (
        <Row key={c} s={s} id={c} depth={depth + 1} onSel={onSel} onZoom={onZoom}
          onExpand={onExpand} onVis={onVis} editing={editing} setEditing={setEditing} onRename={onRename} />
      ))}
    </>
  );
}

/* ───────────────────────────────────────────────────────── component ─── */

export default function Inception() {
  const [s, setS] = useState<OutlinerState>(() => buildScene());
  const [editing, setEditing] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>(["setmix/zoomScope { nodeId: moon_2 }"]);
  const rootRef = useRef<HTMLDivElement>(null);

  const push = useCallback((c: string) => setLog((l) => [c, ...l].slice(0, 7)), []);

  const scope = activeScope(s);
  const sel = s.selectionId ? s.nodes.get(s.selectionId) : undefined;
  const tool = TOOL_BY_ID.get(s.tool)!;
  const toolOk = scope ? tool.scopes.includes(scope.kind) : false;
  const cost = useMemo(() => (scope ? subtreeCost(s, scope.id) : { tris: 0, ms: 0, n: 0 }), [s, scope]);

  const doZoom = (id: string) => { setS((p) => zoomInto(p, id)); push(`setmix/zoomScope { nodeId: "${id}" }`); };
  const doUp = useCallback(() => { setS((p) => escapeUp(p)); push("setmix/zoomScope ▲ escapeUp()"); }, [push]);
  const doTab = useCallback(() => {
    setS((p) => {
      const n = cycleHotbar(p);
      const held = n.hotbar[n.hotbarIndex];
      push(`setmix/cycleHotbar → held "${held ?? "—"}"`);
      return n;
    });
  }, [push]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT") return;
      if (!el.matches(":hover") && !el.contains(document.activeElement)) return;
      if (e.key === "Escape") { e.preventDefault(); doUp(); }
      if (e.key === "Tab") { e.preventDefault(); doTab(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUp, doTab]);

  const held = s.hotbar[s.hotbarIndex];
  const heldCart = held ? BY_ID.get(held) : undefined;

  return (
    <div ref={rootRef} tabIndex={0} className="fi-panel border border-line bg-panel outline-none">
      {/* breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-panel2 px-2 py-1.5">
        <button
          onClick={doUp}
          className="mono border border-line px-1.5 py-[2px] text-[9px] font-bold text-dim hover:border-chalk/50 hover:text-chalk"
        >
           esc ▲
        </button>
        {s.path.map((id, i) => {
          const n = s.nodes.get(id);
          if (!n) return null;
          const last = i === s.path.length - 1;
          return (
            <span key={id} className="mono flex items-center gap-1 text-[9.5px]">
              {i > 0 && <span className="text-dim/50">›</span>}
              <button
                onClick={() => setS((p) => ({ ...p, path: p.path.slice(0, i + 1), selectionId: id }))}
                className={cn("px-1 py-[2px]", last ? "fi-accent-bg text-void font-bold" : "text-dim hover:text-chalk")}
              >
                <span style={last ? {} : { color: n.tint }}>{SCOPE_META[n.kind].glyph}</span> {n.name}
              </button>
            </span>
          );
        })}
        <span className="mono ml-auto text-[9px] text-dim">
          depth {s.path.length - 1}/8 · {SCOPE_META[scope?.kind ?? "MOON"].blurb}
        </span>
      </div>

      <div className="grid lg:grid-cols-[52px_minmax(0,1fr)_288px]">
        {/* tool rail */}
        <div className="flex gap-1 border-b border-line bg-void2 p-1 lg:flex-col lg:border-r lg:border-b-0">
          {TOOLS.map((t) => {
            const ok = scope ? t.scopes.includes(scope.kind) : false;
            const on = s.tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setS((p) => setTool(p, t.id)); push(`setmix/selectTool { tool: "${t.id}" }`); }}
                title={`${t.label}${ok ? "" : " — not available at this scope"}`}
                className={cn(
                  "flex h-10 w-10 shrink-0 flex-col items-center justify-center border transition-all",
                  on ? "border-transparent" : "border-line hover:border-chalk/40",
                  !ok && "opacity-30",
                )}
                style={on ? { background: t.colour, color: "#04060a" } : { color: t.colour }}
              >
                <span className="text-[14px] leading-none">{t.glyph}</span>
                <span className="mono mt-[2px] text-[6.5px] tracking-wider uppercase">
                  {t.label.slice(0, 5)}
                </span>
              </button>
            );
          })}
        </div>

        {/* viewport + slide-out */}
        <div className="relative border-b border-line lg:border-r lg:border-b-0">
          <div className="relative h-[330px] bg-void">
            <ScopeViewport s={s} node={scope ?? s.nodes.get(s.rootId)!} />
            <div className="pointer-events-none absolute inset-0 bg-scan opacity-25" />
            <div className="pointer-events-none absolute top-2 left-2">
              <div className="mono text-[9px] tracking-[0.25em] uppercase" style={{ color: SCOPE_META[scope?.kind ?? "MOON"].colour }}>
                {scope?.kind}
              </div>
              <div className="text-[17px] leading-tight font-black">{scope?.name}</div>
              <div className="mono mt-0.5 text-[9px] text-dim">
                {cost.n} presets · {(cost.tris / 1000).toFixed(0)}k tri · {cost.ms.toFixed(2)} ms
              </div>
            </div>
            {!toolOk && (
              <div className="mono pointer-events-none absolute right-2 bottom-2 border border-pxd/50 bg-void/80 px-2 py-1 text-[9px] text-pxd">
                {tool.label} is not meaningful at {scope?.kind}
              </div>
            )}
          </div>

          {/* contextual slide-out */}
          <div className="border-t border-line bg-panel2 p-2">
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              <span className="mono mr-1 text-[9px] tracking-[0.2em] uppercase" style={{ color: tool.colour }}>
                {tool.glyph} {tool.label}
              </span>
              {tool.modes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setS((p) => ({ ...p, toolMode: m.key }))}
                  className={cn(
                    "mono border px-1.5 py-[2px] text-[9px] transition-colors",
                    s.toolMode === m.key ? "border-transparent text-void" : "border-line text-dim hover:text-chalk",
                  )}
                  style={s.toolMode === m.key ? { background: tool.colour } : {}}
                >
                  {m.label}
                </button>
              ))}
              <span className="mono ml-auto text-[8.5px] text-dim">{tool.command}</span>
            </div>
            <p className="mono mb-2 text-[9.5px] leading-snug text-dim">
              {tool.modes.find((m) => m.key === s.toolMode)?.hint}
            </p>
            <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
              {tool.settings.map((v) => (
                <div key={v.path}>
                  <div className="mono flex justify-between text-[9px]">
                    <span className="text-dim">{v.label}</span>
                    <span className="tnum text-chalk">{v.def}{v.unit !== "—" ? ` ${v.unit}` : ""}</span>
                  </div>
                  <div className="h-[3px] w-full bg-line">
                    <div
                      className="h-full"
                      style={{ width: `${((v.def - v.min) / (v.max - v.min)) * 100}%`, background: tool.colour }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* hotbar */}
          <div className="flex items-center gap-1 border-t border-line bg-void2 p-2">
            <span className="mono mr-1 text-[8.5px] tracking-[0.18em] text-dim uppercase">hands</span>
            {s.hotbar.map((h, i) => {
              const c = h ? BY_ID.get(h) : null;
              const on = i === s.hotbarIndex;
              return (
                <button
                  key={i}
                  onClick={() => setS((p) => ({ ...p, hotbarIndex: i }))}
                  className={cn(
                    "mono flex h-9 w-9 shrink-0 items-center justify-center border text-[8px] transition-all",
                    on ? "scale-110" : "border-line opacity-70 hover:opacity-100",
                  )}
                  style={on
                    ? { borderColor: c?.tint ?? "#e8eef7", background: (c?.tint ?? "#e8eef7") + "28" }
                    : { borderColor: (c?.tint ?? "#2a3242") + "77" }}
                >
                  {c ? <span style={{ color: c.tint }}>▣</span> : <span className="text-dim/40">{i + 1}</span>}
                </button>
              );
            })}
            <button
              onClick={doTab}
              className="mono ml-2 border border-line px-2 py-1 text-[9px] font-bold text-dim hover:border-chalk/50 hover:text-chalk"
            >
              TAB ⇄
            </button>
            <span className="mono ml-auto truncate text-[9px]" style={{ color: heldCart?.tint }}>
              {heldCart?.name ?? "empty hands"}
            </span>
          </div>
        </div>

        {/* outliner */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1 border-b border-line bg-void2 px-1.5 py-1">
            <input
              value={s.search}
              onChange={(e) => setS((p) => ({ ...p, search: e.target.value }))}
              placeholder="search scene…"
              className="mono min-w-0 flex-1 border border-line bg-void px-1.5 py-[3px] text-[9.5px] text-chalk outline-none placeholder:text-dim/60 focus:border-chalk/40"
            />
            <button
              onClick={() => setS((p) => ({ ...p, isolate: !p.isolate }))}
              className={cn(
                "mono border px-1.5 py-[3px] text-[8.5px] font-bold",
                s.isolate ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk",
              )}
            >
              ISO
            </button>
          </div>
          <div className="mono grid grid-cols-[1fr_46px_38px_26px] gap-1 border-b border-line bg-void2 px-1.5 py-1 text-[8px] tracking-[0.14em] text-dim uppercase">
            <span>name / kind</span><span className="text-right">tri</span>
            <span className="text-right">ms</span><span className="text-right">vis</span>
          </div>
          <div className="max-h-[300px] min-h-[220px] overflow-y-auto">
            <Row
              s={s} id={s.isolate ? (scope?.id ?? s.rootId) : s.rootId} depth={0}
              onSel={(id) => setS((p) => select(p, id))}
              onZoom={doZoom}
              onExpand={(id) => setS((p) => toggleExpand(p, id))}
              onVis={(id, v) => { setS((p) => setVisible(p, id, v)); push(`setmix/setVisible { ${id}, ${v} }`); }}
              editing={editing} setEditing={setEditing}
              onRename={(id, n) => { setS((p) => rename(p, id, n)); push(`setmix/renameNode { "${n}" }`); }}
            />
          </div>

          {/* inspector */}
          <div className="border-t border-line bg-panel2 p-2">
            <div className="mono mb-1 text-[8.5px] tracking-[0.2em] text-dim uppercase">
              inspector · {sel?.kind}
            </div>
            <div className="mono truncate text-[11px] font-bold" style={{ color: sel?.tint }}>
              {sel?.name}
            </div>
            <div className="mono mt-1 space-y-[2px] text-[9px] text-dim">
              <div className="flex justify-between"><span>id</span><span className="text-chalk">{sel?.id}</span></div>
              <div className="flex justify-between"><span>children</span><span className="text-chalk">{sel?.childIds.length ?? 0}</span></div>
              {sel?.payload?.cartridge && (
                <div className="flex justify-between"><span>hash</span><span className="text-flux">{sel.payload.cartridge.hash}</span></div>
              )}
              {sel?.payload?.texNode && (
                <div className="flex justify-between"><span>type</span><span className="text-aq">{sel.payload.texNode.type}</span></div>
              )}
            </div>
            <button
              onClick={() => sel && doZoom(sel.id)}
              disabled={!sel?.childIds.length}
              className="mono mt-2 w-full border border-line px-2 py-1 text-[9px] font-bold tracking-[0.15em] text-dim uppercase hover:border-chalk/50 hover:text-chalk disabled:opacity-30"
            >
              ⤓ zoom into (double-click)
            </button>
          </div>

          <div className="border-t border-line bg-void2 p-2">
            <div className="mono mb-1 text-[8.5px] tracking-[0.2em] text-dim uppercase">command journal</div>
            {log.map((l, i) => (
              <div key={i} className="mono truncate text-[8.5px]" style={{ opacity: 1 - i * 0.12 }}>
                <span className="text-aq">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
