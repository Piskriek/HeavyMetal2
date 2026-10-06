import { useEffect, useRef, useState } from "react";
import {
  MACHINES, makeMachine, emptyRuntime, stepMachines, brownoutVisual,
  makePlumeSystem, stepPlumes,
  type MachineKind, type MachineRuntime, type PlumeSystem,
} from "@/drop/machines";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

const PALETTE: [number, number, number][] = [
  [255, 61, 138], [124, 255, 77], [255, 193, 61], [61, 200, 255],
];

const LAYOUT: [MachineKind, number, number, 0 | 1 | 2 | 3][] = [
  ["SOLAR_COLLECTOR", -46, -22, 1], ["SOLAR_COLLECTOR", -46, 6, 1],
  ["GEOTHERMAL_VENT", 44, 26, 1],
  ["RELAY_PYLON", -18, -10, 0], ["RELAY_PYLON", 16, 4, 0], ["RELAY_PYLON", 44, -6, 0],
  ["PIXEL_CHIMNEY", -30, -30, 1], ["PIXEL_CHIMNEY", -8, -26, 2],
  ["HARMONIC_VIBRATOR", -26, 16, 1], ["HARMONIC_VIBRATOR", 6, 22, 1],
  ["LUMEN_MAST", 26, -22, 1], ["RAYLEIGH_BELLOWS", 34, 12, 1],
  ["CONDENSATION_TOWER", 56, -24, 1],
  ["TEMPLATE_INJECTOR", 0, -4, 2],
  ["COHERENCE_BEACON", -4, 34, 0],
];

export default function GridLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [overclock, setOverclock] = useState(1.0);
  const [solarCount, setSolarCount] = useState(2);
  const [daylight, setDaylight] = useState(1);
  const [exp, setExp] = useState(4.4);
  const [wave, setWave] = useState(true);
  const [hud, setHud] = useState({
    supply: 0, demand: 0, sat: 1, islands: 0, brown: 0, trips: 0,
    maxTemp: 0, plumes: 0, consumed: 0, pxd: 0, vtx: 0, lx: 0, aq: 0,
  });

  const cfg = useRef({ overclock, solarCount, daylight, exp, wave });
  cfg.current = { overclock, solarCount, daylight, exp, wave };

  useEffect(() => {
    const cv = ref.current!;
    let rt: MachineRuntime = emptyRuntime(
      LAYOUT.map(([k, x, z, t], i) => makeMachine(`m${i}`, k, [x, z], t)),
    );
    let ps: PlumeSystem = makePlumeSystem(6000);
    let raf = 0, last = performance.now(), t = 0, acc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;

      const v = Math.pow(10, c.exp);
      const fi: FidelityState = { pxd: v * 1.32, vtx: v, lx: v * 0.72, aq: v * 0.46, tick: 0 };

      // apply live controls
      rt = {
        ...rt,
        machines: rt.machines.map((m, i) => {
          const isSolar = m.kind === "SOLAR_COLLECTOR";
          const solarIdx = rt.machines.filter((x, j) => x.kind === "SOLAR_COLLECTOR" && j <= i).length;
          return {
            ...m,
            overclock: MACHINES[m.kind].role === "EMITTER" ? c.overclock : 1,
            enabled: isSolar ? solarIdx <= c.solarCount : true,
          };
        }),
      };

      acc += dt;
      const stepT = 1 / 120;
      let guard = 0;
      while (acc >= stepT && guard++ < 16) {
        acc -= stepT;
        rt = stepMachines(rt, { fi, daylight: c.daylight, ambient: 20, ticks: 1 });
      }

      const waveR = c.wave ? ((t * 14) % 150) : -1e9;
      ps = stepPlumes(ps, {
        machines: rt.machines, output: rt.output, islands: rt.islands,
        wind: [Math.sin(t * 0.3) * 7 + 3, Math.cos(t * 0.22) * 4],
        waves: c.wave ? [{ origin: [0, -4], radius: waveR, thickness: 9 }] : [],
        fi, dt,
      });

      /* ---------- render ---------- */
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;
      g.fillStyle = "#05070c"; g.fillRect(0, 0, W, H);

      // iso-ish projection
      const S = Math.min(W / 160, H / 110);
      const PX = (x: number, z: number) => W / 2 + (x - z) * S * 0.84;
      const PY = (x: number, z: number, y = 0) => H * 0.58 + (x + z) * S * 0.42 - y * S * 0.72;

      // ground grid
      g.strokeStyle = "rgba(27,36,52,0.9)"; g.lineWidth = 1;
      for (let i = -80; i <= 80; i += 16) {
        g.beginPath(); g.moveTo(PX(i, -50), PY(i, -50)); g.lineTo(PX(i, 50), PY(i, 50)); g.stroke();
        g.beginPath(); g.moveTo(PX(-80, i * 0.6), PY(-80, i * 0.6)); g.lineTo(PX(80, i * 0.6), PY(80, i * 0.6)); g.stroke();
      }

      // terraform wave ring
      if (c.wave && waveR > 0) {
        g.strokeStyle = "rgba(124,255,77,0.55)"; g.lineWidth = 2 * dpr;
        g.beginPath();
        for (let a = 0; a <= 64; a++) {
          const ang = (a / 64) * Math.PI * 2;
          const wx = Math.cos(ang) * waveR, wz = -4 + Math.sin(ang) * waveR;
          a ? g.lineTo(PX(wx, wz), PY(wx, wz)) : g.moveTo(PX(wx, wz), PY(wx, wz));
        }
        g.stroke();
      }

      // grid links
      const ISLE = ["#7cff4d", "#ffc13d", "#ff3d8a", "#3dc8ff", "#b46bff"];
      for (const a of rt.machines)
        for (const b of rt.machines) {
          if (a.id >= b.id) continue;
          const reach = Math.max(MACHINES[a.kind].reach, MACHINES[b.kind].reach);
          if (reach <= 0) continue;
          const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
          if (d > reach) continue;
          const isl = rt.islands.find((i) => i.id === a.island);
          const sat = isl?.satisfaction ?? 1;
          g.strokeStyle = sat < 0.99
            ? `rgba(255,61,138,${0.25 + (1 - sat) * 0.5})`
            : `${ISLE[a.island % ISLE.length]}44`;
          g.lineWidth = (sat < 0.99 ? 1 : 1.6) * dpr;
          g.beginPath();
          g.moveTo(PX(a.pos[0], a.pos[1]), PY(a.pos[0], a.pos[1], 1));
          g.lineTo(PX(b.pos[0], b.pos[1]), PY(b.pos[0], b.pos[1], 1));
          g.stroke();
        }

      // machines, sorted back to front
      const sorted = [...rt.machines].sort((a, b) => (a.pos[0] + a.pos[1]) - (b.pos[0] + b.pos[1]));
      for (const m of sorted) {
        const spec = MACHINES[m.kind];
        const vis = brownoutVisual(m, rt.islands);
        const px = PX(m.pos[0], m.pos[1]), py = PY(m.pos[0], m.pos[1]);
        const h = (spec.role === "EMITTER" ? 7 : 4) * (1 + m.tier * 0.3);
        const w = 2.4 * S;

        // heat halo
        const heat = Math.max(0, (m.temperature - 40) / (spec.tripTemp - 40));
        if (heat > 0.05) {
          const rg = g.createRadialGradient(px, py, 0, px, py, w * 3.2);
          rg.addColorStop(0, `rgba(255,${120 - heat * 90},40,${heat * 0.42})`);
          rg.addColorStop(1, "rgba(255,80,20,0)");
          g.fillStyle = rg;
          g.fillRect(px - w * 3.2, py - w * 3.2, w * 6.4, w * 6.4);
        }

        const topY = py - h * S * 0.72;
        const col = spec.colour;
        g.globalAlpha = m.tripped ? 0.35 : 1;
        // body
        g.fillStyle = `${col}${m.tripped ? "33" : "cc"}`;
        g.beginPath();
        g.moveTo(px - w * 0.5, py); g.lineTo(px + w * 0.5, py);
        g.lineTo(px + w * 0.34, topY); g.lineTo(px - w * 0.34, topY);
        g.closePath(); g.fill();
        g.strokeStyle = m.tripped ? "#ff3d8a" : col;
        g.lineWidth = (m.tripped ? 2 : 1) * dpr; g.stroke();
        // brownout de-res: the machine literally pixelates when starved
        if (vis < 0.92) {
          g.fillStyle = `rgba(5,7,12,${(1 - vis) * 0.55})`;
          const q = Math.max(2, (1 - vis) * 9) * dpr;
          for (let yy = topY; yy < py; yy += q)
            for (let xx = px - w * 0.5; xx < px + w * 0.5; xx += q)
              if ((Math.floor(xx / q) + Math.floor(yy / q)) % 2) g.fillRect(xx, yy, q, q);
        }
        g.globalAlpha = 1;
        if (m.tripped) {
          g.fillStyle = "#ff3d8a";
          g.font = `bold ${9 * dpr}px ui-monospace, monospace`;
          g.fillText("TRIP", px - 11 * dpr, topY - 6 * dpr);
        }
      }

      // plume motes — GPU-instanced in production, drawn here as real cubes
      for (let i = 0; i < ps.liveCount; i++) {
        const o = i * 6;
        const x = ps.instanceData[o], y = ps.instanceData[o + 1], z = ps.instanceData[o + 2];
        const sz = ps.instanceData[o + 3], hue = ps.instanceData[o + 4], a = ps.instanceData[o + 5];
        const c2 = PALETTE[Math.min(3, Math.floor(hue * 4))];
        g.fillStyle = `rgba(${c2[0]},${c2[1]},${c2[2]},${a})`;
        const s2 = Math.max(1.2, sz * S * 0.9);
        g.fillRect(PX(x, z) - s2 / 2, PY(x, z, y * 0.42) - s2 / 2, s2, s2);
      }

      const isl = rt.islands;
      setHud({
        supply: isl.reduce((a, i) => a + i.supply, 0),
        demand: isl.reduce((a, i) => a + i.demand, 0),
        sat: isl.length ? Math.min(...isl.map((i) => i.satisfaction)) : 1,
        islands: isl.length,
        brown: rt.brownouts.length,
        trips: rt.machines.filter((m) => m.tripped).length,
        maxTemp: Math.max(...rt.machines.map((m) => m.temperature)),
        plumes: ps.liveCount,
        consumed: ps.consumed,
        pxd: rt.totals.pxd, vtx: rt.totals.vtx, lx: rt.totals.lx, aq: rt.totals.aq,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_278px]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <canvas ref={ref} className="w-full bg-void" style={{ aspectRatio: "16/10" }} />
        </div>
        <div className="p-3">
          {([
            ["overclock", overclock, 1, 1.8, 0.01, setOverclock, "×"],
            ["solar banks", solarCount, 0, 2, 1, setSolarCount, "/2"],
            ["daylight", daylight, 0, 1, 0.01, setDaylight, ""],
            ["fidelity 10^", exp, 2, 7.9, 0.05, setExp, ""],
          ] as const).map(([k, v, mn, mx, st, set, unit]) => (
            <div key={k} className="mb-1.5">
              <div className="mono flex justify-between text-[9.5px]">
                <span className="text-dim">{k}</span>
                <span className="tnum text-chalk">
                  {typeof v === "number" && st < 1 ? v.toFixed(2) : v}{unit}
                </span>
              </div>
              <input type="range" min={mn} max={mx} step={st} value={v}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)}
                className="w-full"
                style={{ ["--thumb" as string]: k === "overclock" && overclock > 1.3 ? "#ff3d8a" : "var(--fi-accent)" }} />
            </div>
          ))}

          <button onClick={() => setWave(!wave)}
            className={cn("mono mt-1 w-full border px-2 py-1 text-[9px] font-bold uppercase",
              wave ? "border-transparent bg-vtx text-void" : "border-line text-dim")}>
            ◎ terraform wave (motes dissipate into it)
          </button>

          <div className="mt-3 border-t border-line pt-2">
            {([
              ["supply / demand", `${hud.supply.toFixed(0)} / ${hud.demand.toFixed(0)} cyc`,
                hud.sat < 0.995 ? "#ff3d8a" : "#7cff4d"],
              ["worst island sat", `${(hud.sat * 100).toFixed(0)}%`, hud.sat < 0.995 ? "#ff3d8a" : "#7cff4d"],
              ["grid islands", hud.islands, "#8b9bb4"],
              ["browning out", hud.brown, hud.brown ? "#ffc13d" : "#6b7a90"],
              ["thermal trips", hud.trips, hud.trips ? "#ff3d8a" : "#6b7a90"],
              ["hottest", `${hud.maxTemp.toFixed(0)} °C`, hud.maxTemp > 150 ? "#ff8a3d" : undefined],
              ["live motes", hud.plumes, "#b46bff"],
              ["eaten by wave", hud.consumed.toLocaleString(), "#7cff4d"],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-3 border-t border-line pt-2">
            {([["Pxd", hud.pxd, "#ff3d8a"], ["Vtx", hud.vtx, "#7cff4d"],
               ["Lx", hud.lx, "#ffc13d"], ["Aq", hud.aq, "#3dc8ff"]] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between py-[2px] text-[9.5px]">
                <span style={{ color: c }}>{k}</span>
                <span className="tnum text-chalk">{v.toFixed(0)}/s</span>
              </div>
            ))}
          </div>

          <p className="mono mt-2 text-[9px] leading-snug text-dim">
            Push <span className="text-pxd">overclock past 1.3×</span>: heat rises with load²,
            machines trip, and starved machines visibly <em className="not-italic">pixelate</em>{" "}
            before their output drops. Drop <span className="text-lx">daylight</span> to 0 and the
            solar island browns out while the geothermal island keeps running — islands fail
            independently.
          </p>
        </div>
      </div>
    </div>
  );
}
