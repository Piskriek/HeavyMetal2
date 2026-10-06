import { useEffect, useRef, useState } from "react";
import {
  makeEcoField, stepEcosystem, ecoTelemetry, stepFlock,
  ECO_STAGES, SKY_MANTA, type EcoField, type Boid,
} from "@/drop/Ecosystem";
import { seaLevelFor, buoyancy, underwaterAudio } from "@/drop/WaterShader";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

const W = 112, H = 112, CELL = 4;

function h2(x: number, y: number) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vn(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const terrain = (x: number, z: number) =>
  (vn(x * 0.011 + 5, z * 0.011 + 9) - 0.46) * 56 +
  (vn(x * 0.038 + 2, z * 0.038 + 7) - 0.5) * 13 - 6;

export default function EcoLab() {
  const mapRef = useRef<HTMLCanvasElement>(null);
  const seaRef = useRef<HTMLCanvasElement>(null);
  const [exp, setExp] = useState(5.3);
  const [speed, setSpeed] = useState(14);
  const [run, setRun] = useState(true);
  const [layer, setLayer] = useState<"stage" | "moisture" | "light" | "biomass">("stage");
  const [tel, setTel] = useState<ReturnType<typeof ecoTelemetry> | null>(null);
  const [swim, setSwim] = useState({ sub: 0, lp: 20000, bub: 0 });

  const cfg = useRef({ exp, speed, run, layer });
  cfg.current = { exp, speed, run, layer };

  useEffect(() => {
    let field: EcoField = makeEcoField(W, H, CELL, terrain);
    let mantas: Boid[] = Array.from({ length: 22 }, (_, i) => ({
      x: (h2(i, 1) - 0.5) * 300, y: 60 + h2(i, 2) * 20, z: (h2(i, 3) - 0.5) * 300,
      vx: (h2(i, 4) - 0.5) * 6, vy: 0, vz: (h2(i, 5) - 0.5) * 6,
    }));
    let raf = 0, last = performance.now(), t = 0, acc = 0;
    const vents = [
      { x: -120, z: 60, strength: 0.95 }, { x: 90, z: -80, strength: 0.8 },
      { x: 30, z: 140, strength: 0.7 },
    ];

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;

      const v = Math.pow(10, c.exp);
      const fi: FidelityState = { pxd: v * 1.32, vtx: v, lx: v * 0.72, aq: v * 0.46, tick: 0 };
      const sea = seaLevelFor(fi);

      if (c.run) {
        acc += dt * c.speed;
        let guard = 0;
        while (acc >= 1 / 120 && guard++ < 40) {
          acc -= 1 / 120;
          field = stepEcosystem(field, {
            fi, seaLevel: sea, vents,
            daylight: 0.55 + 0.45 * Math.sin(t * 0.25), ticks: 1,
          });
        }
        mantas = stepFlock(mantas, SKY_MANTA, terrain, [Math.sin(t * 0.3) * 6, 2], dt);
      }

      /* ── top-down field map ─────────────────────────────────────── */
      const cv = mapRef.current;
      if (cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = cv.getBoundingClientRect();
        const w = Math.round(r.width * dpr);
        if (cv.width !== w || cv.height !== w) { cv.width = w; cv.height = w; }
        const g = cv.getContext("2d")!;
        const img = g.createImageData(W, H);
        for (let k = 0; k < W * H; k++) {
          let R = 0, G = 0, B = 0;
          const submerged = field.altitude[k] < sea;
          if (c.layer === "stage") {
            const spec = ECO_STAGES[field.stage[k] - 1];
            const shade = 0.55 + Math.min(1, Math.max(0, (field.altitude[k] + 30) / 70)) * 0.65;
            R = spec.colour[0] * 255 * shade; G = spec.colour[1] * 255 * shade; B = spec.colour[2] * 255 * shade;
            const e = spec.emissive * field.biomass[k];
            R += e * 60; G += e * 150; B += e * 120;
            if (submerged) {
              const d = Math.min(1, (sea - field.altitude[k]) / 16);
              R = R * (1 - d) * 0.3 + 18 * d; G = G * (1 - d) * 0.5 + 95 * (1 - d * 0.6); B = B * (1 - d) * 0.5 + 150;
            }
          } else if (c.layer === "moisture") {
            const m = field.moisture[k]; R = 20 + m * 40; G = 60 + m * 140; B = 90 + m * 165;
          } else if (c.layer === "light") {
            const l = field.light[k]; R = 25 + l * 230; G = 20 + l * 190; B = 15 + l * 70;
          } else {
            const b = field.biomass[k]; R = 10 + b * 70; G = 15 + b * 225; B = 20 + b * 90;
          }
          const o = k * 4;
          img.data[o] = R; img.data[o + 1] = G; img.data[o + 2] = B; img.data[o + 3] = 255;
        }
        const off = document.createElement("canvas");
        off.width = W; off.height = H;
        off.getContext("2d")!.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, w, w);
        g.drawImage(off, 0, 0, W, H, 0, 0, w, w);

        // vents
        for (const vt of vents) {
          const px = ((vt.x / CELL + W / 2) / W) * w, py = ((vt.z / CELL + H / 2) / H) * w;
          g.strokeStyle = "rgba(255,140,40,0.9)"; g.lineWidth = 1.6 * dpr;
          g.beginPath(); g.arc(px, py, 4 * dpr + Math.sin(t * 3) * dpr, 0, 6.28); g.stroke();
        }
        // mantas
        for (const m of mantas) {
          const px = ((m.x / CELL + W / 2) / W) * w, py = ((m.z / CELL + H / 2) / H) * w;
          g.fillStyle = "rgba(200,170,255,0.75)";
          g.fillRect(px - 1.5 * dpr, py - 1.5 * dpr, 3 * dpr, 3 * dpr);
        }
      }

      /* ── water cross-section with Gerstner + absorption ─────────── */
      const sc = seaRef.current;
      if (sc) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = sc.getBoundingClientRect();
        const w = Math.round(r.width * dpr), hh = Math.round(170 * dpr);
        if (sc.width !== w || sc.height !== hh) { sc.width = w; sc.height = hh; }
        const g = sc.getContext("2d")!;
        const SPAN = 420, yS = hh / 90, yB = hh * 0.74;
        const SX = (x: number) => ((x + SPAN / 2) / SPAN) * w;
        const SY = (y: number) => yB - y * yS;

        const nAq = Math.min(1, Math.max(0, Math.log1p(fi.aq) / Math.log1p(4.1e7)) ** 2.5);
        g.fillStyle = "#070b14"; g.fillRect(0, 0, w, hh);

        // terrain bed
        g.beginPath(); g.moveTo(0, hh);
        for (let px = 0; px <= w; px += 2) {
          const wx = -SPAN / 2 + (px / w) * SPAN;
          g.lineTo(px, SY(terrain(wx, 0)));
        }
        g.lineTo(w, hh); g.closePath();
        g.fillStyle = "#2c3038"; g.fill();

        if (nAq > 0.04) {
          // Gerstner surface
          const waves = Math.max(1, Math.min(4, Math.floor(nAq * 5)));
          const surf: number[] = [];
          for (let px = 0; px <= w; px += 2) {
            const wx = -SPAN / 2 + (px / w) * SPAN;
            let y = sea;
            for (let i = 0; i < waves; i++) {
              const scale = Math.pow(0.58, i);
              const L = (26 * scale) / Math.max(0.25, nAq);
              const A = 0.42 * scale * Math.min(1, Math.max(0, (nAq - 0.08) / 0.62));
              const k = 6.2831 / Math.max(L, 0.5);
              y += A * Math.sin(k * wx + t * Math.sqrt(9.8 * 6.2831 / Math.max(L, 0.5)) * 0.22 * k);
            }
            surf.push(y);
          }
          // Beer-Lambert column, drawn per 2-px slice
          for (let i = 0, px = 0; px <= w; px += 2, i++) {
            const wx = -SPAN / 2 + (px / w) * SPAN;
            const bed = terrain(wx, 0);
            const top = surf[i];
            if (bed >= top) continue;
            const depth = top - bed;
            const T = [Math.exp(-0.46 * depth), Math.exp(-0.11 * depth), Math.exp(-0.035 * depth)];
            const R = 4 + T[0] * 42, G = 18 + T[1] * 165, B = 48 + T[2] * 160;
            const caus = Math.pow(Math.max(0, Math.sin(wx * 0.26 + t * 1.3) * Math.sin(wx * 0.41 - t * 1.1)), 3) * Math.exp(-depth * 0.09);
            g.fillStyle = `rgba(${R + caus * 90},${G + caus * 120},${B + caus * 90},0.9)`;
            g.fillRect(px, SY(top), 2.4, SY(bed) - SY(top));
            // foam
            if (depth < 1.1 + nAq * 1.4) {
              g.fillStyle = `rgba(235,248,255,${0.75 * (1 - depth / (1.1 + nAq * 1.4))})`;
              g.fillRect(px, SY(top) - 2 * dpr, 2.4, 4 * dpr);
            }
          }
          // specular highlight line
          g.strokeStyle = "rgba(190,235,255,0.55)"; g.lineWidth = 1.4 * dpr;
          g.beginPath();
          surf.forEach((y, i) => { const px = i * 2; i ? g.lineTo(px, SY(y)) : g.moveTo(px, SY(y)); });
          g.stroke();

          // the swimmer
          const swx = Math.sin(t * 0.33) * 90;
          const bedY = terrain(swx, 0);
          const feetY = Math.max(bedY, sea - 1.4 + Math.sin(t * 0.9) * 2.4);
          const b = buoyancy(feetY, 1.6, sea, [0, Math.cos(t * 0.9) * 2, 0]);
          const au = underwaterAudio(b, Math.max(0, sea - feetY));
          g.fillStyle = b.headUnder ? "#3dc8ff" : "#ff6fb2";
          g.fillRect(SX(swx) - 3 * dpr, SY(feetY + 1.6), 6 * dpr, 1.6 * yS);
          setSwim({ sub: b.submersion, lp: au.lowpassHz, bub: au.bubbleRate });
        }

        g.font = `${9.5 * dpr}px ui-monospace, monospace`;
        g.fillStyle = "#6b7a90";
        g.fillText(`sea ${sea.toFixed(1)} m · σ=(0.46, 0.11, 0.035) m⁻¹`, 6 * dpr, 14 * dpr);
      }

      setTel(ecoTelemetry(field, sea));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scatter = tel ? Math.round(tel.coverage * 14200) : 0;

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_282px]">
        <div className="grid gap-3 border-b border-line p-3 sm:grid-cols-2 lg:border-r lg:border-b-0">
          <div>
            <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
              <span>Eco field · {W}×{H} cells</span>
              <span className="tnum text-chalk">{layer}</span>
            </div>
            <canvas ref={mapRef} className="w-full border border-line bg-void" style={{ aspectRatio: "1/1" }} />
            <div className="mt-1 grid grid-cols-4 gap-1">
              {(["stage", "moisture", "light", "biomass"] as const).map((l) => (
                <button key={l} onClick={() => setLayer(l)}
                  className={cn("mono border py-1 text-[8px] font-bold uppercase",
                    layer === l ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                  {l.slice(0, 5)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mono mb-1 flex items-center justify-between text-[9px] tracking-[0.18em] text-dim uppercase">
              <span>Hydrosphere cross-section</span>
              <span className="tnum text-aq">
                Gerstner ×{Math.max(1, Math.min(4, Math.floor(
                  Math.pow(Math.min(1, Math.log1p(Math.pow(10, exp) * 0.46) / Math.log1p(4.1e7)), 2.5) * 5,
                )))}
              </span>
            </div>
            <canvas ref={seaRef} className="w-full border border-line bg-void" style={{ height: 170 }} />
            <div className="mono mt-2 space-y-[3px] text-[9.5px]">
              {([
                ["submersion", swim.sub.toFixed(2), "#3dc8ff"],
                ["underwater LP", `${(swim.lp / 1000).toFixed(1)} kHz`, swim.lp < 2000 ? "#3dc8ff" : "#6b7a90"],
                ["bubbles/s", swim.bub.toFixed(1), "#8fe3ff"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="flex justify-between border-b border-line/40 py-[2px]">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3">
          <div className="mono mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">Fidelity (Aq drives the sea)</span>
            <span className="tnum text-chalk">{Math.pow(10, exp).toExponential(1)}</span>
          </div>
          <input type="range" min={2} max={7.98} step={0.01} value={exp}
            onChange={(e) => setExp(+e.target.value)} className="w-full"
            style={{ ["--thumb" as string]: "#3dc8ff" }} />
          <div className="mono mt-2 mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">sim speed</span><span className="tnum text-chalk">{speed}×</span>
          </div>
          <input type="range" min={1} max={40} step={1} value={speed}
            onChange={(e) => setSpeed(+e.target.value)} className="w-full" />
          <button onClick={() => setRun(!run)}
            className={cn("mono mt-2 w-full border px-2 py-1.5 text-[9.5px] font-bold uppercase",
              run ? "border-transparent bg-chalk text-void" : "border-line text-dim")}>
            {run ? "■ pause ecology" : "▶ run ecology"}
          </button>

          {tel && (
            <>
              <div className="mt-3 border-t border-line pt-2">
                {([
                  ["living coverage", `${(tel.coverage * 100).toFixed(1)}%`, "#7cff4d"],
                  ["submerged", `${(tel.submerged * 100).toFixed(1)}%`, "#3dc8ff"],
                  ["mean moisture", tel.meanMoisture.toFixed(3), "#8fe3ff"],
                  ["mean biomass", tel.meanBiomass.toFixed(3), "#86c954"],
                  ["instanced props", scatter.toLocaleString(), "#b46bff"],
                ] as const).map(([k, v, c]) => (
                  <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                    <span className="text-dim">{k}</span>
                    <span className="tnum" style={{ color: c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1 border-t border-line pt-2">
                {ECO_STAGES.map((s, i) => {
                  const share = tel.byStage[i] / tel.cells;
                  return (
                    <div key={s.stage}>
                      <div className="mono flex items-baseline justify-between text-[8.5px]">
                        <span style={{ color: `rgb(${s.colour.map((x) => Math.round(x * 255)).join(",")})` }}>
                          E{s.stage} {s.name}
                        </span>
                        <span className="tnum text-dim">{(share * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-[3px] w-full bg-line">
                        <div className="h-full transition-[width] duration-200"
                          style={{ width: `${share * 100}%`,
                            background: `rgb(${s.colour.map((x) => Math.round(x * 255)).join(",")})` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="mono mt-2 text-[9px] leading-snug text-dim">
            Switch to <span className="text-aq">moisture</span>: life does not fade in globally, it{" "}
            <em className="not-italic text-chalk">diffuses</em> outward from water and from the
            three orange vents. The vents grow Stage-2 chemotrophs{" "}
            <em className="not-italic text-chalk">before the sky exists</em>, because they need
            water and heat, not light.
          </p>
        </div>
      </div>
    </div>
  );
}
