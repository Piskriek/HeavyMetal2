import { useEffect, useRef, useState } from "react";
import {
  emptyField,
  stepWaveField,
  evaluateChunkWaveState,
  sampleWaveTransition,
  waveRadius,
  waveVelocity,
  waveRMax,
  bandThickness,
  elapsedAt,
  reverseCompletionTick,
  type ChunkRef,
  type WaveFieldState,
  type WaveSource,
  type ChunkWaveState,
} from "@/engine/setmix/field";
import { profileSample, type MeshPolicy } from "@/engine/setmix/mesh";
import { TICK_HZ } from "@/engine/setmix/core";
import { cn } from "@/utils/cn";

/* world layout */
const WORLD = 520;
const CH = 20;
const N = WORLD / CH;
const CHUNKS = new Map<string, ChunkRef>();
for (let cz = 0; cz < N; cz++)
  for (let cx = 0; cx < N; cx++) {
    const id = `c_${cx}_${cz}`;
    CHUNKS.set(id, {
      id,
      cx,
      cz,
      centre: [(cx + 0.5) * CH - WORLD / 2, (cz + 0.5) * CH - WORLD / 2],
      radius: (CH * Math.SQRT2) / 2,
    });
  }

const STATE_COLOUR: Record<ChunkWaveState, string> = {
  DORMANT: "#0e131c",
  APPROACHING: "#2a2416",
  INSIDE_BAND: "#ffffff",
  STABILIZED: "#1d3a24",
};

/* deterministic terrain */
function h2(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vn(x: number, y: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const fx = x - xi,
    fy = y - yi;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi),
    b = h2(xi + 1, yi),
    c = h2(xi, yi + 1),
    d = h2(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const height = (x: number, z: number) =>
  (vn(x * 0.013 + 7, z * 0.013 + 3) - 0.5) * 34 +
  (vn(x * 0.047 + 21, z * 0.047 + 11) - 0.5) * 9;

const POL_PREV: MeshPolicy = {
  lod: 0, cellSize: 8, mode: "CUBIC", chamfer: 0, relaxIterations: 0,
  smoothAngleDeg: 0, qefClamp: 0.5, stage: 1,
};
const POL_NEXT: MeshPolicy = {
  lod: 2, cellSize: 2, mode: "DUAL", chamfer: 0.5, relaxIterations: 6,
  smoothAngleDeg: 148, qefClamp: 0.34, stage: 4,
};

function mkSource(id: string, pos: [number, number], tier: number, bw: number, cx: number, tick: number): WaveSource {
  return {
    id, spireId: id, cartridgeId: "grass_handpainted", pos,
    startedAt: tick, tier, bandwidth: bw, complexity: cx,
    dir: 1, influence: 1, dominance: 1,
  };
}

export default function WaveSim() {
  const [play, setPlay] = useState(true);
  const [speed, setSpeed] = useState(16);
  const [tier, setTier] = useState(1);
  const [bw, setBw] = useState(32);
  const [cx, setCx] = useState(0.9);
  const [two, setTwo] = useState(false);
  const [hud, setHud] = useState({
    tick: 0, r: 0, v: 0, dr: 0, active: 0, wake: 0, entered: 0, settled: 0,
    dormant: 0, band: 0, stable: 0, reeval: 0, dir: 1 as 1 | -1, done: false,
  });

  const fieldRef = useRef<WaveFieldState>(emptyField());
  const cfgRef = useRef({ play, speed, two });
  cfgRef.current = { play, speed, two };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profRef = useRef<HTMLCanvasElement>(null);
  const pendingRef = useRef<{ dispatch?: WaveSource[]; reverse?: string[] }>({});

  const dispatch = () => {
    const f = fieldRef.current;
    const srcs = [mkSource("s1", [-60, -30], tier, bw, cx, f.tick)];
    if (cfgRef.current.two) srcs.push({ ...mkSource("s2", [110, 70], Math.max(1, tier - 1), bw, cx * 1.4, f.tick), dominance: 0.8 });
    pendingRef.current.dispatch = srcs;
  };
  const reverse = () => {
    pendingRef.current.reverse = fieldRef.current.sources.filter((s) => s.dir === 1).map((s) => s.id);
  };
  const reset = () => {
    fieldRef.current = emptyField();
    pendingRef.current = {};
  };

  useEffect(() => {
    reset();
    dispatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, bw, cx, two]);

  useEffect(() => {
    let raf = 0;
    let acc = 0;
    let last = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cfg = cfgRef.current;

      /* ---- step the sim at a true 120 Hz, batched ---- */
      const p = pendingRef.current;
      let stepped = false;
      if (cfg.play || p.dispatch || p.reverse) {
        acc += cfg.play ? dt * TICK_HZ * cfg.speed : 0;
        const nTicks = Math.max(p.dispatch || p.reverse ? 1 : 0, Math.floor(acc));
        if (nTicks > 0) {
          acc -= Math.floor(acc);
          fieldRef.current = stepWaveField(fieldRef.current, {
            chunks: CHUNKS,
            dispatch: p.dispatch,
            reverse: p.reverse,
            texelsPerChunk: 1024,
            ticks: nTicks,
          });
          pendingRef.current = {};
          stepped = true;
        }
      }
      void stepped;

      const f = fieldRef.current;
      const tick = f.tick;

      /* ---- top-down map ---- */
      const cv = canvasRef.current;
      if (cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = cv.getBoundingClientRect();
        const W = Math.max(200, Math.round(rect.width * dpr));
        if (cv.width !== W || cv.height !== W) {
          cv.width = W;
          cv.height = W;
        }
        const g = cv.getContext("2d")!;
        const px = W / N;
        g.fillStyle = "#06080d";
        g.fillRect(0, 0, W, W);

        let nd = 0, nb = 0, ns = 0;
        for (const ch of CHUNKS.values()) {
          const smp = evaluateChunkWaveState(ch, f.sources, tick);
          if (smp.state === "DORMANT") nd++;
          else if (smp.state === "INSIDE_BAND") nb++;
          else if (smp.state === "STABILIZED") ns++;

          let col = STATE_COLOUR[smp.state];
          if (smp.state === "INSIDE_BAND") {
            const a = 0.25 + smp.phase * 0.75;
            col = `rgba(255,255,255,${a})`;
          } else if (smp.state === "STABILIZED") {
            col = "#1f4429";
          }
          g.fillStyle = col;
          g.fillRect(ch.cx * px, ch.cz * px, px - 0.6, px - 0.6);

          if (f.active.has(ch.id)) {
            g.strokeStyle = "rgba(255,193,61,0.85)";
            g.lineWidth = 1;
            g.strokeRect(ch.cx * px + 0.5, ch.cz * px + 0.5, px - 1.6, px - 1.6);
          }
        }

        // wave rings
        for (const s of f.sources) {
          const e = elapsedAt(s, tick);
          const r = waveRadius(e, s);
          const dr = bandThickness(e, s);
          const sx = ((s.pos[0] + WORLD / 2) / WORLD) * W;
          const sz = ((s.pos[1] + WORLD / 2) / WORLD) * W;
          const k = W / WORLD;
          g.strokeStyle = s.dir === 1 ? "rgba(124,255,77,0.9)" : "rgba(255,61,138,0.9)";
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(sx, sz, r * k, 0, 6.2832);
          g.stroke();
          g.strokeStyle = "rgba(255,255,255,0.22)";
          g.lineWidth = 1;
          for (const rr of [r - dr, r + dr]) {
            if (rr <= 0) continue;
            g.beginPath();
            g.arc(sx, sz, rr * k, 0, 6.2832);
            g.stroke();
          }
          g.strokeStyle = "rgba(180,107,255,0.35)";
          g.setLineDash([3, 4]);
          g.beginPath();
          g.arc(sx, sz, waveRMax(s) * k, 0, 6.2832);
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = "#b46bff";
          g.fillRect(sx - 3, sz - 3, 6, 6);
        }

        const s0 = f.sources[0];
        setHud({
          tick,
          r: s0 ? waveRadius(elapsedAt(s0, tick), s0) : 0,
          v: s0 ? (s0.dir === 1 ? 1 : -2) * waveVelocity(elapsedAt(s0, tick), s0) : 0,
          dr: s0 ? bandThickness(elapsedAt(s0, tick), s0) : 0,
          active: f.stats.activeChunks,
          wake: f.stats.wakeQueueLength,
          entered: f.stats.chunksEnteredThisTick,
          settled: f.stats.chunksSettledThisTick,
          reeval: f.stats.texelReEvalsThisTick,
          dormant: nd,
          band: nb,
          stable: ns,
          dir: s0?.dir ?? 1,
          done: !!s0 && s0.dir === -1 && tick >= reverseCompletionTick(s0),
        });
      }

      /* ---- cross-section through the first spire ---- */
      const pc = profRef.current;
      if (pc && f.sources.length) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = pc.getBoundingClientRect();
        const W = Math.max(240, Math.round(rect.width * dpr));
        const H = Math.round(150 * dpr);
        if (pc.width !== W || pc.height !== H) {
          pc.width = W;
          pc.height = H;
        }
        const g = pc.getContext("2d")!;
        g.fillStyle = "#06080d";
        g.fillRect(0, 0, W, H);

        const s0 = f.sources[0];
        const z0 = s0.pos[1];
        const yScale = 1.5 * dpr;
        const yBase = H * 0.62;
        const toX = (wx: number) => ((wx + WORLD / 2) / WORLD) * W;

        const lineFor = (fn: (wx: number) => number, stroke: string, wdt: number) => {
          g.beginPath();
          for (let i = 0; i <= 420; i++) {
            const wx = -WORLD / 2 + (i / 420) * WORLD;
            const y = yBase - fn(wx) * yScale;
            i ? g.lineTo(toX(wx), y) : g.moveTo(toX(wx), y);
          }
          g.strokeStyle = stroke;
          g.lineWidth = wdt;
          g.stroke();
        };

        lineFor((wx) => profileSample(wx, height, POL_PREV, z0), "rgba(107,122,144,0.5)", 1);
        lineFor((wx) => profileSample(wx, height, POL_NEXT, z0), "rgba(124,255,77,0.35)", 1);
        lineFor((wx) => {
          const t = sampleWaveTransition([wx, z0], f.sources, tick);
          const a = profileSample(wx, height, POL_PREV, z0);
          const b = profileSample(wx, height, POL_NEXT, z0);
          return a + (b - a) * t.s;
        }, "#ffffff", 2 * dpr);

        // band shading
        for (const s of f.sources) {
          const e = elapsedAt(s, tick);
          const r = waveRadius(e, s);
          const dr = bandThickness(e, s);
          for (const sgn of [-1, 1]) {
            const c = s.pos[0] + sgn * r;
            const x0 = toX(c - dr),
              x1 = toX(c + dr);
            const grd = g.createLinearGradient(x0, 0, x1, 0);
            grd.addColorStop(0, "rgba(255,255,255,0)");
            grd.addColorStop(0.5, s.dir === 1 ? "rgba(124,255,77,0.22)" : "rgba(255,61,138,0.22)");
            grd.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = grd;
            g.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
          }
          g.fillStyle = "#b46bff";
          g.fillRect(toX(s.pos[0]) - 1.5, 0, 3, H);
        }

        g.font = `${9 * dpr}px ui-monospace, monospace`;
        g.fillStyle = "#6b7a90";
        g.fillText("H_prev · CUBIC 8 m", 6 * dpr, 12 * dpr);
        g.fillStyle = "#4e8f3a";
        g.fillText("H_next · DUAL 2 m", 6 * dpr, 24 * dpr);
        g.fillStyle = "#e8eef7";
        g.fillText("H(x,t) = lerp(prev, next, S((r−d)/Δr))", 6 * dpr, 36 * dpr);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const simEvaluated = hud.active + hud.entered;
  const saving = 1 - simEvaluated / CHUNKS.size;

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div>
              <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
                <span>Chunk state field · {N}×{N}</span>
                <span className="tnum">{CHUNKS.size} chunks</span>
              </div>
              <canvas ref={canvasRef} className="w-full border border-line" style={{ aspectRatio: "1/1" }} />
              <div className="mono mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[8.5px] text-dim">
                {([
                  ["DORMANT", "#0e131c", hud.dormant],
                  ["APPROACH", "#2a2416", CHUNKS.size - hud.dormant - hud.band - hud.stable],
                  ["IN BAND", "#ffffff", hud.band],
                  ["STABLE", "#1f4429", hud.stable],
                ] as const).map(([k, c, n]) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="h-2 w-2 border border-line" style={{ background: c }} />
                    {k} <span className="tnum text-chalk">{n}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
                <span>Geomorph cross-section</span>
                <span className="tnum">z = spire</span>
              </div>
              <canvas ref={profRef} className="w-full border border-line" style={{ height: 150 }} />
              <div className="mono mt-2 space-y-1 text-[9.5px] text-dim">
                <div className="flex justify-between">
                  <span>r(t)</span>
                  <span className="tnum text-chalk">{hud.r.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between">
                  <span>v(t) = (R_max − r)/τ</span>
                  <span className={cn("tnum", hud.v < 0 ? "text-pxd" : "text-vtx")}>
                    {hud.v.toFixed(2)} m/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Δr band</span>
                  <span className="tnum text-chalk">{hud.dr.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between">
                  <span>R_max · τ</span>
                  <span className="tnum text-chalk">
                    {(180 * tier * (1 + bw / 64)).toFixed(0)} m · {(90 * cx).toFixed(0)} s
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3">
          <div className="mb-2 grid grid-cols-2 gap-1">
            <button
              onClick={() => setPlay(!play)}
              className={cn(
                "mono border px-2 py-1.5 text-[9.5px] font-bold tracking-[0.15em] uppercase",
                play ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk",
              )}
            >
              {play ? "■ pause" : "▶ run"}
            </button>
            <button
              onClick={() => { reset(); dispatch(); }}
              className="mono border border-line px-2 py-1.5 text-[9.5px] font-bold tracking-[0.15em] text-dim uppercase hover:text-chalk"
            >
              ⟲ dispatch
            </button>
            <button
              onClick={reverse}
              className="mono col-span-2 border border-pxd/60 bg-pxd/10 px-2 py-1.5 text-[9.5px] font-bold tracking-[0.15em] text-pxd uppercase hover:bg-pxd/20"
            >
              ◀◀ pull cartridge — reverse at 2×
            </button>
          </div>

          {([
            ["speed", speed, 1, 60, 1, setSpeed, "sim ×"],
            ["tier", tier, 1, 4, 1, setTier, "spire T"],
            ["bandwidth", bw, 0, 192, 8, setBw, "ch"],
            ["complexity", cx, 0.5, 4, 0.1, setCx, "× τ"],
          ] as const).map(([k, val, mn, mx, st, set, unit]) => (
            <div key={k} className="mb-1.5">
              <div className="mono flex justify-between text-[9px]">
                <span className="text-dim">{k}</span>
                <span className="tnum text-chalk">
                  {typeof val === "number" && st < 1 ? val.toFixed(1) : val} {unit}
                </span>
              </div>
              <input
                type="range" min={mn} max={mx} step={st} value={val}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)}
                className="w-full"
              />
            </div>
          ))}

          <button
            onClick={() => setTwo(!two)}
            className={cn(
              "mono mt-1 w-full border px-2 py-1 text-[9px] font-bold tracking-[0.15em] uppercase",
              two ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk",
            )}
          >
            {two ? "◉ two spires (softmax blend)" : "○ single spire"}
          </button>

          <div className="mt-3 border-t border-line pt-2">
            <div className="mono mb-1 text-[9px] tracking-[0.18em] text-dim uppercase">
              Scheduler · tick {hud.tick.toLocaleString()}
            </div>
            {([
              ["active (re-meshing)", hud.active, "#ffc13d"],
              ["wake queue", hud.wake, "#8b9bb4"],
              ["entered this tick", hud.entered, "#7cff4d"],
              ["settled this tick", hud.settled, "#3dc8ff"],
              ["texel re-evals/tick", hud.reeval, "#ff3d8a"],
            ] as const).map(([k, val, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{val.toLocaleString()}</span>
              </div>
            ))}
            <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[9.5px] leading-snug text-vtx">
              {(saving * 100).toFixed(1)}% of chunks are asleep. The sim touched{" "}
              <span className="tnum font-bold">{simEvaluated}</span> of{" "}
              <span className="tnum">{CHUNKS.size}</span> — work is O(circumference), not O(area),
              because t(r) is invertible.
            </div>
            {hud.done && (
              <div className="mono mt-2 border border-line bg-void2 p-2 text-[9.5px] leading-snug text-chalk">
                Reverse complete. Terrain restored to H_prev exactly: the recede replayed the same
                r(·) curve backwards, so every chunk was visited in the precise reverse order.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
