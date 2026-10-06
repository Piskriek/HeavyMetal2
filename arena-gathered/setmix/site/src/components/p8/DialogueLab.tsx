import { useEffect, useRef, useState } from "react";
import {
  NPCS, DIALOGUE, VOICES, FORMANTS, phonemise, speak, utteranceDuration,
  BALLOON, type SynthHandle,
} from "@/drop/DialogueEngine";
import {
  STOCK, RESOURCES, initialTrader, priceOf, executeTrade, canAfford,
  MARKET_RULES, type Bundle, type TraderState, type TradeGood, type Resource,
} from "@/drop/GoblinTrader";
import { cn } from "@/utils/cn";

const START_INV: Bundle = {
  TOPOLOGY_SHARD: 240, PHOTON_SALT: 180, ICE_CLATHRATE: 90,
  CHROMATIC_CRYSTAL: 120, LOGIC_SUBSTRATE: 18, ENTROPY_SLAG: 400, DEEP_CHROMA: 7,
};

/* ─────────────────────────────────── the 3D stage (billboarded balloons) */

function Stage({ active, onPick }: { active: string | null; onPick: (id: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const activeRef = useRef(active);
  activeRef.current = active;
  const hitRef = useRef<{ id: string; x: number; y: number; r: number }[]>([]);

  useEffect(() => {
    const cv = ref.current!;
    let raf = 0, t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const t = (now - t0) / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;

      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#080c16"); sky.addColorStop(1, "#1a2436");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);

      // slow orbit camera
      const yaw = Math.sin(t * 0.09) * 0.42;
      const camPos: [number, number, number] = [Math.sin(yaw) * 34, 7.5, Math.cos(yaw) * 34 + 6];
      const look: [number, number, number] = [0, 1.6, 0];
      const fw = [look[0] - camPos[0], look[1] - camPos[1], look[2] - camPos[2]];
      const fl = Math.hypot(fw[0], fw[1], fw[2]);
      fw[0] /= fl; fw[1] /= fl; fw[2] /= fl;
      const rt = [fw[2], 0, -fw[0]];
      const rl = Math.hypot(rt[0], rt[2]); rt[0] /= rl; rt[2] /= rl;
      const up = [rt[2] * fw[1] - rt[1] * fw[2], rt[0] * fw[2] - rt[2] * fw[0], rt[1] * fw[0] - rt[0] * fw[1]];
      const f = (H * 0.5) / Math.tan((62 * Math.PI / 180) / 2);
      const proj = (p: readonly number[]) => {
        const dx = p[0] - camPos[0], dy = p[1] - camPos[1], dz = p[2] - camPos[2];
        const z = dx * fw[0] + dy * fw[1] + dz * fw[2];
        if (z < 0.4) return null;
        const x = dx * rt[0] + dy * rt[1] + dz * rt[2];
        const y = dx * up[0] + dy * up[1] + dz * up[2];
        return [W / 2 + (x * f) / z, H / 2 - (y * f) / z, z] as [number, number, number];
      };

      // ground grid
      g.strokeStyle = "#1b2434"; g.lineWidth = 1;
      for (let i = -30; i <= 30; i += 5) {
        const a = proj([i, 0, -30]), b = proj([i, 0, 30]);
        const c = proj([-30, 0, i]), d = proj([30, 0, i]);
        if (a && b) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        if (c && d) { g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke(); }
      }

      const hits: { id: string; x: number; y: number; r: number }[] = [];
      const sorted = [...NPCS].sort((a, b) => {
        const da = Math.hypot(a.pos[0] - camPos[0], a.pos[2] - camPos[2]);
        const db = Math.hypot(b.pos[0] - camPos[0], b.pos[2] - camPos[2]);
        return db - da;
      });

      for (const npc of sorted) {
        const base = proj(npc.pos);
        const head = proj([npc.pos[0], npc.pos[1] + npc.headHeight, npc.pos[2]]);
        if (!base || !head) continue;
        const dist = Math.hypot(npc.pos[0] - camPos[0], npc.pos[1] - camPos[1], npc.pos[2] - camPos[2]);
        const tt = Math.min(1, Math.max(0, (dist - BALLOON.nearDistance) / (BALLOON.maxDistance - BALLOON.nearDistance)));
        const fade = 1 - tt * tt;
        const scale = BALLOON.minScale + (1 - tt) * (1 - BALLOON.minScale);
        const isActive = activeRef.current === npc.id;
        const isHover = hoverRef.current === npc.id;

        // body
        const bw = Math.max(5, (0.9 * f) / base[2]);
        const bh = base[1] - head[1];
        g.fillStyle = npc.tint + (isActive ? "ff" : "bb");
        if (npc.kind === "SPIRE") {
          g.beginPath();
          g.moveTo(base[0] - bw * 0.7, base[1]); g.lineTo(base[0] + bw * 0.7, base[1]);
          g.lineTo(head[0] + bw * 0.16, head[1]); g.lineTo(head[0] - bw * 0.16, head[1]);
          g.closePath(); g.fill();
        } else {
          g.fillRect(base[0] - bw / 2, base[1] - bh * 0.62, bw, bh * 0.62);
          g.beginPath(); g.arc(head[0], head[1] + bh * 0.1, bw * 0.46, 0, 6.28); g.fill();
        }
        if (isActive || isHover) {
          g.strokeStyle = "#fff"; g.lineWidth = 1.6 * dpr;
          g.strokeRect(base[0] - bw * 0.8, head[1] - 6 * dpr, bw * 1.6, bh + 12 * dpr);
        }

        hits.push({ id: npc.id, x: base[0] / dpr, y: (head[1] + bh / 2) / dpr, r: (bw * 1.4) / dpr });

        // name tag, billboarded and distance-faded
        g.globalAlpha = fade;
        g.font = `bold ${Math.round(11 * dpr * scale)}px ui-monospace, monospace`;
        const label = `${npc.name} · ${VOICES[npc.voice].label}`;
        const tw = g.measureText(label).width;
        g.fillStyle = "rgba(5,7,12,0.82)";
        g.fillRect(head[0] - tw / 2 - 5 * dpr, head[1] - 22 * dpr * scale, tw + 10 * dpr, 15 * dpr * scale);
        g.strokeStyle = npc.tint + "88"; g.lineWidth = 1;
        g.strokeRect(head[0] - tw / 2 - 5 * dpr, head[1] - 22 * dpr * scale, tw + 10 * dpr, 15 * dpr * scale);
        g.fillStyle = npc.tint;
        g.fillText(label, head[0] - tw / 2, head[1] - 11 * dpr * scale);
        g.globalAlpha = 1;

        // distance readout
        g.font = `${9 * dpr}px ui-monospace, monospace`;
        g.fillStyle = "#6b7a90";
        g.fillText(`${dist.toFixed(0)} m · α${fade.toFixed(2)}`, base[0] - 22 * dpr, base[1] + 13 * dpr);
      }
      hitRef.current = hits;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={ref} className="w-full cursor-pointer bg-void" style={{ aspectRatio: "16/8" }}
      onMouseMove={(e) => {
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const h = hitRef.current.find((p) => Math.hypot(p.x - x, p.y - y) < p.r);
        setHover(h?.id ?? null);
      }}
      onClick={(e) => {
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const h = hitRef.current.find((p) => Math.hypot(p.x - x, p.y - y) < p.r);
        if (h) onPick(h.id);
      }} />
  );
}

/* ───────────────────────────────────────────────────────── the section */

export default function DialogueLab() {
  const [npcId, setNpcId] = useState("scout");
  const [nodeId, setNodeId] = useState("scout_hello");
  const [reveal, setReveal] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [market, setMarket] = useState(false);
  const [inv, setInv] = useState<Bundle>({ ...START_INV });
  const [trader, setTrader] = useState<TraderState>(initialTrader(4, 7));
  const [log, setLog] = useState<string[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const handleRef = useRef<SynthHandle | null>(null);

  const npc = NPCS.find((n) => n.id === npcId)!;
  const voice = VOICES[npc.voice];
  const node = DIALOGUE[nodeId] ?? DIALOGUE[`${npcId}_hello`];
  const phones = phonemise(node?.text ?? "", voice);
  const dur = utteranceDuration(phones);

  const say = (id: string) => {
    const n = DIALOGUE[id];
    if (!n) return;
    setNodeId(id);
    const v = VOICES[NPCS.find((x) => x.id === n.speaker)!.voice];
    const ph = phonemise(n.text, v);
    const d = utteranceDuration(ph);
    setReveal(0); setSpeaking(true);

    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      void ctx.resume();
      handleRef.current?.stop();
      handleRef.current = speak(ctx, ctx.destination, ph, v, { gain: 0.22 });
    } catch { /* audio blocked until a gesture */ }

    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 1000 / Math.max(0.1, d));
      setReveal(p);
      if (p < 1) requestAnimationFrame(tick);
      else setSpeaking(false);
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => () => handleRef.current?.stop(), []);

  const pick = (id: string) => {
    setNpcId(id);
    setMarket(false);
    say(`${id}_hello`);
  };

  const buy = (good: TradeGood) => {
    const r = executeTrade(good, inv, trader);
    setInv(r.inventory); setTrader(r.trader);
    setLog((l) => [r.message, ...l].slice(0, 5));
    if (r.ok) say("trader_open");
  };

  const shown = node?.text ?? "";
  const cut = Math.round(shown.length * reveal);

  return (
    <div className="space-y-3">
      <div className="fi-panel border border-line bg-panel">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border-b border-line lg:border-r lg:border-b-0">
            <Stage active={npcId} onPick={pick} />
            <div className="border-t border-line p-3">
              <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.2em] uppercase">
                <span style={{ color: npc.tint }}>{npc.name}</span>
                <span className="text-dim">
                  {voice.label} · {voice.pitch} Hz · formant ×{voice.formantScale}
                </span>
              </div>
              {/* the balloon, as it renders in world space */}
              <div className="fi-panel border p-3" style={{ borderColor: npc.tint + "66", background: npc.tint + "0d" }}>
                <p className="text-[14px] leading-snug text-chalk">
                  {shown.slice(0, cut)}
                  <span className="text-dim">{shown.slice(cut)}</span>
                  {speaking && <span className="anim-pulse fi-accent-text">▌</span>}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(node?.choices ?? []).map((c) => (
                  <button key={c.label}
                    onClick={() => { if (c.effect === "OPEN_MARKET") setMarket(true); if (c.next) say(c.next); }}
                    className="mono border border-line px-2 py-1 text-[10px] text-chalk/85 hover:border-chalk/50 hover:text-chalk">
                    › {c.label}
                  </button>
                ))}
                <button onClick={() => say(nodeId)}
                  className="mono ml-auto border border-line px-2 py-1 text-[9px] text-dim hover:text-chalk">
                  ♪ replay voice
                </button>
              </div>
              <p className="mono mt-2 text-[9px] leading-snug text-dim">
                Click an NPC in the scene. Audio needs one gesture first (browser policy). Every
                voice is synthesised from the TEXT — no samples, no voice actors, and the same
                line always sounds the same on every machine.
              </p>
            </div>
          </div>

          {/* formant inspector */}
          <div className="p-3">
            <div className="mono mb-1 text-[9px] tracking-[0.2em] text-dim uppercase">
              phoneme schedule · {phones.length} phones · {dur.toFixed(2)} s
            </div>
            <div className="relative h-[86px] border border-line bg-void">
              {phones.map((p, i) => {
                if (p.kind === "PAUSE") return null;
                const x = (p.at / Math.max(0.01, dur)) * 100;
                const w = (p.dur / Math.max(0.01, dur)) * 100;
                const y1 = 86 - (p.f1 / 3400) * 86;
                const y2 = 86 - (p.f2 / 3400) * 86;
                const y3 = 86 - (p.f3 / 3400) * 86;
                const on = reveal * dur >= p.at;
                return (
                  <div key={i}>
                    {[["#ff3d8a", y1], ["#7cff4d", y2], ["#3dc8ff", y3]].map(([c, y], k) => (
                      <div key={k} className="absolute transition-opacity"
                        style={{
                          left: `${x}%`, width: `${Math.max(0.6, w)}%`, top: y as number,
                          height: 2, background: c as string, opacity: on ? 1 : 0.22,
                        }} />
                    ))}
                  </div>
                );
              })}
              <div className="absolute inset-y-0 w-px bg-chalk/70" style={{ left: `${reveal * 100}%` }} />
              <div className="mono absolute right-1 bottom-0 text-[8px] text-dim">F1 F2 F3 (Hz)</div>
            </div>

            <div className="mono mt-2 text-[9px] tracking-[0.2em] text-dim uppercase">vowel formants</div>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(FORMANTS).map(([v, [f1, f2]]) => (
                <div key={v} className="mono border border-line bg-void/50 px-1.5 py-1 text-[9px]">
                  <span className="fi-accent-text font-bold">{v}</span>
                  <span className="ml-1 text-dim">
                    {Math.round(f1 * voice.formantScale)}/{Math.round(f2 * voice.formantScale)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mono mt-3 text-[9px] tracking-[0.2em] text-dim uppercase">voices</div>
            <div className="grid grid-cols-2 gap-1">
              {Object.values(VOICES).map((v) => (
                <div key={v.id} className="mono border border-line bg-void/40 px-1.5 py-1 text-[8.5px] leading-tight">
                  <div className="text-chalk">{v.label}</div>
                  <div className="text-dim">
                    {v.pitch}Hz ×{v.formantScale} · {v.rate}syl/s
                  </div>
                </div>
              ))}
            </div>

            <div className="mono mt-3 border border-line bg-void2 p-2 text-[9px] leading-snug text-dim">
              <span className="text-chalk">Source–filter:</span> a buzzy sawtooth glottis through
              three bandpasses at F1/F2/F3. Formants <em className="not-italic text-chalk">glide</em>{" "}
              via setTargetAtTime — that glide is the difference between speech and Morse code.
            </div>
          </div>
        </div>
      </div>

      {/* ── the market ─────────────────────────────────────────────── */}
      {market && (
        <div className="fi-panel border border-flux/50 bg-panel">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel2 px-3 py-2">
            <span className="mono text-[10px] font-bold tracking-[0.2em] text-flux uppercase">
              ▣ Skree's Cartridge Exchange
            </span>
            <span className="mono text-[9px] text-dim">
              reputation {(trader.reputation * 100) | 0}% · stage {trader.stage}
            </span>
            <button onClick={() => setMarket(false)}
              className="mono ml-auto border border-line px-2 py-1 text-[9px] text-dim hover:text-chalk">
              ✕ close
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-line bg-void2 px-3 py-2">
            {(Object.keys(RESOURCES) as Resource[]).map((k) => (
              <div key={k} className="mono flex items-center gap-1 text-[9.5px]">
                <span className="h-2 w-2" style={{ background: RESOURCES[k].colour }} />
                <span className="text-dim">{RESOURCES[k].label}</span>
                <span className="tnum font-bold text-chalk">{inv[k] ?? 0}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-px bg-line md:grid-cols-2">
            {STOCK.map((g) => {
              const p = priceOf(g, trader);
              const afford = canAfford(inv, p.bundle);
              const RARITY: Record<string, string> = {
                UNCOMMON: "#8b9bb4", RARE: "#3dc8ff", EXOTIC: "#b46bff", LEGENDARY: "#ffc13d",
              };
              return (
                <div key={g.id} className="bg-panel p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[13px] leading-tight font-bold" style={{ color: g.tint }}>
                        {g.name} <span className="mono text-[9px] text-dim">{g.version}</span>
                      </div>
                      <div className="mono mt-0.5 flex flex-wrap gap-1 text-[8px]">
                        <span className="px-1 py-[1px] font-bold" style={{ background: RARITY[g.rarity], color: "#04060a" }}>
                          {g.rarity}
                        </span>
                        <span className="border border-line px-1 py-[1px] text-dim">{g.cls}</span>
                        <span className="border border-line px-1 py-[1px] text-dim">S{g.minStage}+</span>
                        <span className="border border-line px-1 py-[1px] text-dim">
                          {Math.max(0, g.stock - (trader.bought[g.id] ?? 0))} left
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug text-dim">{g.blurb}</p>
                  <div className="mono mt-1.5 text-[9px] text-pxd">
                    lab cannot craft: {g.exoticNodes.join(", ")}
                  </div>
                  <div className="mono mt-1 text-[10px] leading-snug text-vtx">↳ {g.unlocks}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {(Object.entries(p.bundle) as [Resource, number][]).map(([k, n]) => (
                      <span key={k}
                        className={cn("mono border px-1.5 py-[2px] text-[9px]",
                          (inv[k] ?? 0) >= n ? "border-line text-chalk" : "border-pxd/60 text-pxd")}>
                        {n} {RESOURCES[k].label.split(" ")[0]}
                      </span>
                    ))}
                    <button onClick={() => buy(g)} disabled={!afford || !p.available}
                      className={cn("mono ml-auto border px-2 py-1 text-[9px] font-bold uppercase",
                        afford && p.available
                          ? "border-transparent bg-flux text-void"
                          : "border-line text-dim opacity-50")}>
                      {p.available ? "barter" : "sold out"}
                    </button>
                  </div>
                  {p.scarcity > 1.05 && (
                    <div className="mono mt-1 text-[8.5px] text-lx">
                      scarcity ×{p.scarcity.toFixed(2)} · rep discount ×{p.discount.toFixed(2)}
                      {g.minStage > trader.stage && " · stage markup ×2.2"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {log.length > 0 && (
            <div className="border-t border-line bg-void2 p-2">
              {log.map((l, i) => (
                <div key={i} className="mono text-[9.5px]" style={{ opacity: 1 - i * 0.16 }}>
                  <span className={l.startsWith("Acquired") ? "text-vtx" : "text-lx"}>› {l}</span>
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-line/60 border-t border-line">
            {MARKET_RULES.map(([k, v], i) => (
              <div key={k} className="grid gap-2 p-3 sm:grid-cols-[250px_1fr]">
                <div className="flex gap-2">
                  <span className="mono fi-accent-text text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[12px] leading-tight font-bold">{k}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-dim">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!market && (
        <button onClick={() => { setNpcId("trader"); say("trader_hello"); setMarket(true); }}
          className="mono fi-accent-bg w-full px-3 py-2 text-[10px] font-black tracking-[0.25em] text-void uppercase">
          ▣ open Skree's cartridge exchange
        </button>
      )}
    </div>
  );
}
