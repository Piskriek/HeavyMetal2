import { useEffect, useRef, useState } from "react";
import {
  SPECIES, evaluatePlant, buildSkeleton, bezier, scatterCell,
  stepCycle, initialCycle, makeWake, stampWake, relaxWake, recentreWake,
  GRASS_DEFAULT, hash2i,
  type FloraSeed, type Species, type Climate, type CycleState, type WakeField,
} from "@/drop/flora";
import {
  makeField, stepField, materialise, steerCreature, poseCreature,
  faunaTelemetry, FAUNA,
  type DensityField, type Creature, type FaunaId,
} from "@/drop/fauna";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function vn(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2i(xi, yi), b = hash2i(xi + 1, yi), c = hash2i(xi, yi + 1), d = hash2i(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
const ground = (x: number) => Math.sin(x * 0.012) * 3.4 + Math.sin(x * 0.041 + 1.3) * 1.1;

/* ════════════════════════════════════════════════════ FLORA DEMO ══ */

export function FloraDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState(26);
  const [species, setSpecies] = useState<Species>("TREE");
  const [running, setRunning] = useState(true);
  const [wind, setWind] = useState(0.4);
  const [moistOverride, setMoist] = useState(-1);
  const [hud, setHud] = useState({
    years: 0, cycle: initialCycle(), plants: 0, branches: 0, bytes: 0, meshBytes: 0,
  });

  const cfg = useRef({ speed, species, running, wind, moistOverride });
  cfg.current = { speed, species, running, wind, moistOverride };

  useEffect(() => {
    const cv = ref.current!;
    let cycle: CycleState = initialCycle();
    let simSec = 0;
    let wake: WakeField = makeWake();
    let raf = 0, last = performance.now(), walkerX = 40;

    // seeds are DERIVED, never stored long-term — regenerated when species flips
    let seeds: FloraSeed[] = [];
    let seededFor: Species | null = null;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (seededFor !== c.species) {
        seeds = [];
        for (let cx = 0; cx < 14; cx++) {
          seeds.push(...scatterCell(cx, 0, 24, 1337,
            (x) => clamp01(0.35 + vn(x * 0.02, 3) * 0.6),
            () => c.species, "0x1a2b3c4d"));
        }
        seeds = seeds.slice(0, 46);
        seededFor = c.species;
      }

      if (c.running) simSec += dt * c.speed;
      const fi: FidelityState = { pxd: 9e7, vtx: 7e7, lx: 5e7, aq: 3e7, tick: 0 };
      if (c.running) cycle = stepCycle(cycle, fi, dt * c.speed * 0.4);

      // walker flattens grass
      if (c.running) {
        walkerX += dt * 14;
        if (walkerX > 330) walkerX = 10;
        recentreWake(wake, walkerX, 0);
        stampWake(wake, walkerX, 0, 2.2, 1);
        relaxWake(wake, dt, GRASS_DEFAULT);
      }

      /* ---------- render ---------- */
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;
      const S = H / 34;
      const SX = (wx: number) => wx * (W / 340);
      const SY = (wy: number) => H - 38 * dpr - wy * S;

      // sky reacts to the cycle
      const sky = g.createLinearGradient(0, 0, 0, H);
      const cl = cycle.cloud;
      sky.addColorStop(0, `rgb(${40 + cl * 70},${90 + cl * 60},${150 - cl * 40})`);
      sky.addColorStop(1, `rgb(${120 + cl * 60},${150 + cl * 50},${180 - cl * 30})`);
      g.fillStyle = sky; g.fillRect(0, 0, H ? 0 : 0, 0);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);

      // clouds
      for (let i = 0; i < 7; i++) {
        const cxp = ((i * 0.29 + simSec * 0.004) % 1.2 - 0.1) * W;
        const cyp = H * (0.08 + ((i * 37) % 11) / 90);
        const cr = W * 0.07 * (0.6 + cycle.cloud);
        const gr = g.createRadialGradient(cxp, cyp, 0, cxp, cyp, cr);
        gr.addColorStop(0, `rgba(255,255,255,${cycle.cloud * 0.5})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(cxp - cr, cyp - cr, cr * 2, cr * 2);
      }

      // rain
      if (cycle.rainfall > 0.01) {
        g.strokeStyle = `rgba(190,220,255,${Math.min(0.5, cycle.rainfall * 1.4)})`;
        g.lineWidth = dpr;
        g.beginPath();
        for (let i = 0; i < 140; i++) {
          const rx = ((i * 97 + simSec * 260) % W);
          const ry = ((i * 53 + simSec * 900) % H);
          g.moveTo(rx, ry); g.lineTo(rx - 3 * dpr, ry + 13 * dpr);
        }
        g.stroke();
      }

      // ground
      g.beginPath(); g.moveTo(0, H);
      for (let px = 0; px <= W; px += 3) g.lineTo(px, SY(ground(px / (W / 340))));
      g.lineTo(W, H); g.closePath();
      const soil = cycle.soilMoisture;
      g.fillStyle = `rgb(${Math.round(72 - soil * 28)},${Math.round(58 + soil * 36)},${Math.round(40 + soil * 10)})`;
      g.fill();

      // ── GRASS: unit blade instanced, with gust + wake ──────────────
      const bladeCount = 760;
      for (let i = 0; i < bladeCount; i++) {
        const wx = (i / bladeCount) * 340 + (hash2i(i, 3) - 0.5) * 0.9;
        const gy = ground(wx);
        const rnd = hash2i(i, 11);
        const h = 0.55 * (0.55 + rnd * 0.9) * clamp01(cycle.soilMoisture * 2.4) * 1.5;
        if (h < 0.05) continue;
        const k1 = 6.2831853 / GRASS_DEFAULT.gustWavelength;
        const gust = (Math.sin(wx * k1 - simSec * GRASS_DEFAULT.gustSpeed * k1) * 0.65
          + Math.sin(wx * k1 * 1.6 - simSec * 8) * 0.35) * 0.5 + 0.5;
        let bend = gust * c.wind * (0.35 + rnd * 0.3);
        const half = wake.extentM / 2;
        const u = Math.round(((wx - wake.cx + half) / wake.extentM) * wake.res);
        const vv = Math.round(wake.res / 2);
        const wk = u >= 0 && u < wake.res ? wake.data[vv * wake.res + u] : 0;
        bend = Math.max(bend, wk * 1.55);
        const tipX = SX(wx) + bend * h * S * 0.8;
        const tipY = SY(gy + h * (1 - wk * 0.45));
        g.strokeStyle = `rgb(${Math.round(60 + rnd * 40 - wk * 20)},${Math.round(120 + cycle.soilMoisture * 80)},${Math.round(50 + rnd * 30)})`;
        g.lineWidth = Math.max(1, 1.3 * dpr);
        g.beginPath();
        g.moveTo(SX(wx), SY(gy));
        g.quadraticCurveTo(SX(wx) + bend * h * S * 0.25, SY(gy + h * 0.6), tipX, tipY);
        g.stroke();
      }

      // ── TREES: evaluated from the seed + τ, every frame ────────────
      const climate: Climate = {
        moisture: c.moistOverride >= 0 ? c.moistOverride : cycle.soilMoisture,
        light: 0.8 - cycle.cloud * 0.35, temperature: 18, exposure: c.wind * 0.5,
      };
      let branchTotal = 0, drawn = 0;
      const sp = SPECIES[c.species];
      for (const s of seeds) {
        const st = evaluatePlant(s, simSec, s.plantedAt / 120, climate);
        if (!st.alive || st.heightM < 0.04) continue;
        drawn++;
        const sk = buildSkeleton(s, st, 2);
        branchTotal += sk.length;
        const bx = SX(s.x), by = SY(ground(s.x));
        const swayPh = simSec * 1.3 + s.variant * 31.4;
        for (const br of sk) {
          const col = br.depth === 0 ? sp.colour : sp.colour;
          g.strokeStyle = `rgb(${col[0] * 255 | 0},${col[1] * 255 | 0},${col[2] * 255 | 0})`;
          g.lineWidth = Math.max(0.8, br.radius0 * S * 2.1);
          g.beginPath();
          for (let t = 0; t <= 1.001; t += 0.25) {
            const p = bezier(br, t);
            const sway = Math.sin(swayPh) * c.wind * Math.pow(p[1] / Math.max(0.01, st.heightM), 2) * st.heightM * 0.07;
            const px = bx + (p[0] + sway) * S, py = by - p[1] * S;
            t === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
          }
          g.stroke();
          // leaf bud at the tip
          if (br.leafBud > 0.05 && br.depth > 0) {
            const p = bezier(br, 1);
            const sway = Math.sin(swayPh) * c.wind * Math.pow(p[1] / Math.max(0.01, st.heightM), 2) * st.heightM * 0.07;
            const lc = sp.leafColour;
            const stress = st.stress;
            g.fillStyle = `rgba(${Math.round((lc[0] * (1 - stress) + 0.74 * stress) * 255)},${Math.round((lc[1] * (1 - stress) + 0.46 * stress) * 255)},${Math.round((lc[2] * (1 - stress) + 0.14 * stress) * 255)},${0.55 + br.leafBud * 0.4})`;
            const rr = Math.max(1.5, st.canopyM3 * 0.055 * S * br.leafBud);
            g.beginPath();
            g.arc(bx + (p[0] + sway) * S, by - p[1] * S, rr, 0, 6.283);
            g.fill();
          }
        }
      }

      // walker
      g.fillStyle = "#ff6fb2";
      g.fillRect(SX(walkerX) - 3 * dpr, SY(ground(walkerX) + 1.7), 6 * dpr, 1.7 * S);

      setHud({
        years: simSec / 300, cycle, plants: drawn, branches: branchTotal,
        bytes: seeds.length * 24, meshBytes: branchTotal * 28 * 96,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const C = hud.cycle;
  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_268px]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <canvas ref={ref} className="w-full bg-void" style={{ aspectRatio: "16/8" }} />
        </div>
        <div className="p-3">
          <div className="mb-2 grid grid-cols-2 gap-1">
            {(Object.keys(SPECIES) as Species[]).map((s) => (
              <button key={s} onClick={() => setSpecies(s)}
                className={cn("mono border px-1 py-1 text-[8.5px] font-bold uppercase",
                  species === s ? "border-transparent bg-chalk text-void" : "border-line text-dim hover:text-chalk")}>
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          {([
            ["time ×", speed, 1, 120, 1, setSpeed],
            ["wind", wind, 0, 1.4, 0.01, setWind],
          ] as const).map(([k, v, mn, mx, st, set]) => (
            <div key={k} className="mb-1.5">
              <div className="mono flex justify-between text-[9.5px]">
                <span className="text-dim">{k}</span>
                <span className="tnum text-chalk">{st < 1 ? v.toFixed(2) : v}</span>
              </div>
              <input type="range" min={mn} max={mx} step={st} value={v}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
            </div>
          ))}
          <div className="mono mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">moisture override</span>
            <span className="tnum text-chalk">{moistOverride < 0 ? "cycle" : moistOverride.toFixed(2)}</span>
          </div>
          <input type="range" min={-0.05} max={1} step={0.01} value={moistOverride}
            onChange={(e) => setMoist(+e.target.value)} className="w-full"
            style={{ ["--thumb" as string]: "#3dc8ff" }} />
          <button onClick={() => setRunning(!running)}
            className={cn("mono mt-2 w-full border px-2 py-1 text-[9px] font-bold uppercase",
              running ? "border-transparent bg-chalk text-void" : "border-line text-dim")}>
            {running ? "■ pause the century" : "▶ run"}
          </button>

          <div className="mt-3 border-t border-line pt-2">
            {([
              ["sim age", `${hud.years.toFixed(1)} yr`, "var(--fi-accent)"],
              ["humidity", C.humidity.toFixed(3), "#3dc8ff"],
              ["cloud", C.cloud.toFixed(3), "#8b9bb4"],
              ["rainfall", C.rainfall.toFixed(4), "#3dc8ff"],
              ["soil moisture", C.soilMoisture.toFixed(3), "#86c954"],
              ["biomass", C.biomass.toFixed(3), "#7cff4d"],
              ["plants drawn", hud.plants, undefined],
              ["branches", hud.branches, undefined],
            ] as const).map(([k, v, c]) => (
              <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                <span className="text-dim">{k}</span>
                <span className="tnum" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[9px] leading-snug">
            <div className="text-dim">this forest, on the wire</div>
            <div className="text-[13px] font-black text-vtx">{hud.bytes} B</div>
            <div className="mt-1 text-dim">
              as baked meshes: <span className="text-pxd">{(hud.meshBytes / 1024).toFixed(0)} kB</span>
              {" "}· a seed is 24 bytes and a tree is a function of τ.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════ FAUNA DEMO ══ */

export function FaunaDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [showField, setShowField] = useState(true);
  const [radius, setRadius] = useState(300);
  const [threat, setThreat] = useState(false);
  const [speciesSel, setSpeciesSel] = useState<FaunaId>("MOON_STRIDER");
  const [tod, setTod] = useState(0.4);
  const [tel, setTel] = useState<ReturnType<typeof faunaTelemetry> | null>(null);

  const cfg = useRef({ showField, radius, threat, speciesSel, tod });
  cfg.current = { showField, radius, threat, speciesSel, tod };

  useEffect(() => {
    const cv = ref.current!;
    const WORLD = 6000;
    let field: DensityField = makeField(32, WORLD / 32, -WORLD / 2, -WORLD / 2);
    // seed the field so the sim has something to work with
    for (const id of Object.keys(FAUNA) as FaunaId[])
      for (let i = 0; i < field.n[id].length; i++)
        field.n[id][i] = FAUNA[id].K * 0.12 * hash2i(i, id.length);

    let creatures: Creature[] = [];
    let raf = 0, last = performance.now(), t = 0, px = 0, pz = 0, ecoAcc = 0;

    const bio = (x: number, z: number) =>
      clamp01(0.25 + vn(x * 0.0012 + 5, z * 0.0012 + 2) * 1.1 - Math.abs(z) * 0.00008);
    const wat = (x: number, z: number) => clamp01((vn(x * 0.0008, z * 0.0008 + 9) - 0.56) * 4);
    const hAt = (x: number, z: number) => vn(x * 0.004, z * 0.004) * 6;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;

      px = Math.cos(t * 0.13) * 1400;
      pz = Math.sin(t * 0.09) * 1100;

      // macroscopic: 2 Hz, coarse grid
      ecoAcc += dt;
      if (ecoAcc > 0.5) {
        field = stepField(field, { biomass: bio, water: wat, aq: 0.6, dtHours: ecoAcc * 2.2 });
        ecoAcc = 0;
      }

      // microscopic: materialise near the player
      const fresh = materialise(field, c.speciesSel, px, pz, hAt, c.radius);
      const byUid = new Map(creatures.map((x) => [x.uid, x]));
      creatures = fresh.map((f) => byUid.get(f.uid) ?? f);
      const threats = c.threat ? [{ x: px, z: pz, loudness: 1 }] : [];
      creatures = creatures.map((cr) =>
        steerCreature(cr, creatures, { biomass: bio, water: wat, heightAt: hAt, timeOfDay: c.tod, threats, dt }));

      /* ---------- render ---------- */
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d")!;
      g.fillStyle = "#05070c"; g.fillRect(0, 0, W, H);

      const VIEW = 3400;
      const SX = (x: number) => W / 2 + ((x - px) / VIEW) * W;
      const SZ = (z: number) => H / 2 + ((z - pz) / VIEW) * W;

      // density field heatmap
      if (c.showField) {
        const cell = (field.cellM / VIEW) * W;
        for (let j = 0; j < field.res; j++)
          for (let i = 0; i < field.res; i++) {
            const n = field.n[c.speciesSel][j * field.res + i];
            if (n < 0.01) continue;
            const wx = field.ox + i * field.cellM, wz = field.oz + j * field.cellM;
            const a = clamp01(n / (FAUNA[c.speciesSel].K * 0.5));
            g.fillStyle = `rgba(124,255,77,${a * 0.3})`;
            g.fillRect(SX(wx), SZ(wz), cell + 1, cell + 1);
          }
      }
      // biomass contour
      g.fillStyle = "rgba(60,120,50,0.18)";
      for (let j = 0; j < 46; j++)
        for (let i = 0; i < 46; i++) {
          const wx = px - VIEW / 2 + (i / 46) * VIEW, wz = pz - VIEW / 2 + (j / 46) * VIEW;
          if (bio(wx, wz) > 0.62) g.fillRect(SX(wx), SZ(wz), (VIEW / 46 / VIEW) * W + 1, (VIEW / 46 / VIEW) * W + 1);
        }

      // materialisation radius
      g.strokeStyle = "rgba(255,193,61,0.55)"; g.lineWidth = 1.5 * dpr;
      g.setLineDash([5, 5]);
      g.beginPath(); g.arc(SX(px), SZ(pz), (c.radius / VIEW) * W, 0, 6.283); g.stroke();
      g.setLineDash([]);

      // creatures, with legs
      const spec = FAUNA[c.speciesSel];
      for (const cr of creatures) {
        const pose = poseCreature(cr, hAt);
        const x = SX(cr.x), z = SZ(cr.z);
        const sz = Math.max(2, (spec.bodyM / VIEW) * W * 2.4) * cr.lod;
        const colour = cr.state === "FLEE" ? "#ff3d8a" : cr.state === "SLEEP" ? "#6b7a90"
          : cr.state === "GRAZE" ? "#7cff4d" : cr.state === "DRINK" ? "#3dc8ff" : spec.colour;
        // legs
        g.strokeStyle = `${colour}aa`; g.lineWidth = Math.max(0.6, dpr * 0.8);
        for (const L of pose.legs) {
          g.beginPath();
          g.moveTo(SX(L.hip[0]), SZ(L.hip[2]));
          g.lineTo(SX(L.knee[0]), SZ(L.knee[2]));
          g.lineTo(SX(L.foot[0]), SZ(L.foot[2]));
          g.stroke();
        }
        g.fillStyle = colour;
        g.globalAlpha = cr.lod;
        g.beginPath();
        g.ellipse(x, z, sz, sz * 0.62, cr.heading, 0, 6.283);
        g.fill();
        g.globalAlpha = 1;
      }

      // player
      g.fillStyle = c.threat ? "#ff3d8a" : "#e8eef7";
      g.beginPath(); g.arc(SX(px), SZ(pz), 4 * dpr, 0, 6.283); g.fill();

      setTel(faunaTelemetry(field, creatures.length));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_268px]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <canvas ref={ref} className="w-full bg-void" style={{ aspectRatio: "16/9" }} />
        </div>
        <div className="p-3">
          <div className="mb-2 grid grid-cols-2 gap-1">
            {(Object.keys(FAUNA) as FaunaId[]).map((s) => (
              <button key={s} onClick={() => setSpeciesSel(s)}
                className={cn("mono border px-1 py-1 text-[8px] font-bold uppercase",
                  speciesSel === s ? "border-transparent text-void" : "border-line text-dim hover:text-chalk")}
                style={speciesSel === s ? { background: FAUNA[s].colour } : {}}>
                {FAUNA[s].label}
              </button>
            ))}
          </div>
          <div className="mono mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">materialisation radius</span>
            <span className="tnum text-chalk">{radius} m</span>
          </div>
          <input type="range" min={60} max={700} step={10} value={radius}
            onChange={(e) => setRadius(+e.target.value)} className="w-full"
            style={{ ["--thumb" as string]: "#ffc13d" }} />
          <div className="mono mt-1 mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">time of day</span>
            <span className="tnum text-chalk">{(tod * 24).toFixed(1)} h</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={tod}
            onChange={(e) => setTod(+e.target.value)} className="w-full" />
          <div className="mt-2 grid grid-cols-2 gap-1">
            <button onClick={() => setShowField(!showField)}
              className={cn("mono border px-1 py-1 text-[9px] font-bold uppercase",
                showField ? "border-transparent bg-vtx text-void" : "border-line text-dim")}>
              ▦ field
            </button>
            <button onClick={() => setThreat(!threat)}
              className={cn("mono border px-1 py-1 text-[9px] font-bold uppercase",
                threat ? "border-transparent bg-pxd text-void" : "border-line text-dim")}>
              ⚠ rover
            </button>
          </div>

          {tel && (
            <div className="mt-3 border-t border-line pt-2">
              {(Object.keys(FAUNA) as FaunaId[]).map((id) => (
                <div key={id} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9px]">
                  <span style={{ color: FAUNA[id].colour }}>{FAUNA[id].label}</span>
                  <span className="tnum text-chalk">{Math.round(tel.populations[id]).toLocaleString()}</span>
                </div>
              ))}
              <div className="mono flex justify-between py-[3px] text-[9.5px]">
                <span className="text-dim">materialised</span>
                <span className="tnum text-lx">{tel.materialised}</span>
              </div>
              <div className="mono mt-2 border border-vtx/40 bg-vtx/5 p-2 text-[9px] leading-snug">
                <div className="text-dim">resident memory</div>
                <div className="text-[13px] font-black text-vtx">{(tel.bytesResident / 1024).toFixed(1)} kB</div>
                <div className="mt-1 text-dim">
                  as entities: <span className="text-pxd">{(tel.bytesIfEntities / 1048576).toFixed(2)} MB</span>
                  {" "}— four Float32Arrays, whatever the population.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
