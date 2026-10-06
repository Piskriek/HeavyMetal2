import { useEffect, useRef, useState } from "react";
import {
  initialMaster, stepMaster, requestMode, toggleRover, keyToMode,
  masterTelemetry, MODES, MODE_ORDER, TICK_HZ,
  type MasterState, type MasterInput, type MasterWorld, type Mode,
} from "@/drop/MasterRuntime";
import { normalised } from "@/drop/fidelity";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

/* ── deterministic world ─────────────────────────────────────────────── */
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
function terrainAt(x: number, z: number, oct: number) {
  let a = 1, f = 0.011, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vn(x * f + 31, z * f + 12); n += a; a *= 0.52; f *= 2.03; }
  const d = Math.min(1.3, Math.hypot(x, z) / 150);
  return (s / n - 0.47) * 46 + d * d * 18 - 10;
}

const PALETTES: [number, number, number][][] = [
  [[43,47,54],[74,81,92],[110,118,130],[154,163,176]],
  [[58,51,64],[106,90,99],[154,138,134],[203,191,174]],
  [[74,66,55],[107,99,80],[138,138,112],[182,180,154]],
  [[60,74,53],[93,107,67],[138,132,88],[185,172,134]],
  [[47,92,52],[73,128,63],[111,177,92],[168,192,122]],
  [[43,95,58],[63,138,74],[114,177,92],[207,224,160]],
];
const SKIES: [[number,number,number],[number,number,number]][] = [
  [[2,3,10],[5,6,14]], [[7,9,21],[22,26,51]], [[22,35,58],[58,85,116]],
  [[43,79,120],[134,180,221]], [[63,127,196],[169,210,240]], [[60,134,212],[207,232,255]],
];

const CHECKPOINTS: [number, number][] = [
  [40, -40], [70, 10], [40, 60], [-20, 70], [-60, 20], [-40, -40], [0, -70],
];

type Key = Record<string, boolean>;

export default function SetMixMaster() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("PLAY");
  const [exp, setExp] = useState(3.6);
  const [tel, setTel] = useState<ReturnType<typeof masterTelemetry> | null>(null);
  const [perf, setPerf] = useState({ ms: 0, hitch: 0, worst: 0 });
  const [focused, setFocused] = useState(false);

  const keys = useRef<Key>({});
  const stRef = useRef<MasterState | null>(null);
  const expRef = useRef(exp);
  expRef.current = exp;
  const wrapRef = useRef<HTMLDivElement>(null);

  /* ── keyboard ───────────────────────────────────────────────────── */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = wrapRef.current;
      if (!el || (!el.matches(":hover") && document.activeElement !== el)) return;
      if (["Tab", " ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      keys.current[e.key.toLowerCase()] = true;
      const st = stRef.current;
      if (!st) return;
      const action = keyToMode(e.key, st);
      if (action === "TOGGLE_ROVER") { stRef.current = toggleRover(st); setMode(stRef.current.mode); }
      else if (action) { stRef.current = requestMode(st, action); setMode(action); }
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  /* ── the one loop ───────────────────────────────────────────────── */
  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d", { alpha: false })!;
    const fid0: FidelityState = { pxd: 4e3, vtx: 3e3, lx: 2e3, aq: 9e2, tick: 0 };
    stRef.current = initialMaster(fid0);
    let raf = 0, last = performance.now(), acc = 0, statT = 0, frames = 0, msAcc = 0;
    let hitches = 0, worst = 0;
    const stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), b: Math.random() }));

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const f0 = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let st = stRef.current!;
      const v = Math.pow(10, expRef.current);
      st.fidelity = { pxd: v * 1.32, vtx: v, lx: v * 0.72, aq: v * 0.46, tick: st.tick };
      const n = normalised(st.fidelity);
      const oct = 1 + Math.floor(n.pxd * 5);

      const world: MasterWorld = {
        height: (x, z) => terrainAt(x, z, oct),
        planetRadius: 2048,
      };

      const k = keys.current;
      const input: MasterInput = {
        move: [
          (k["d"] ? 1 : 0) - (k["a"] ? 1 : 0),
          (k["w"] ? 1 : 0) - (k["s"] ? 1 : 0),
        ],
        look: [(k["arrowright"] ? 1 : 0) - (k["arrowleft"] ? 1 : 0), 0],
        throttle: k["w"] ? 1 : 0,
        brake: k["s"] ? 1 : 0,
        handbrake: !!k[" "],
        jump: !!k["shift"],
        interact: false,
      };

      acc += dt;
      const stepT = 1 / TICK_HZ;
      let guard = 0;
      while (acc >= stepT && guard++ < 24) { acc -= stepT; st = stepMaster(st, input, world, 1); }
      stRef.current = st;

      /* ── render ───────────────────────────────────────────────── */
      const dpr = Math.min(1.6, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.max(320, Math.round(r.width * dpr));
      const H = Math.max(200, Math.round(r.height * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }

      const stageI = Math.min(5, Math.max(0, Math.floor(n.pxd * 6)));
      const frac = Math.min(1, n.pxd * 6 - stageI);
      const lerp3 = (a: number[], b: number[], t: number) =>
        [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
      const pal = PALETTES[stageI].map((c, i) => lerp3(c, PALETTES[Math.min(5, stageI+1)][i], frac));
      const skyT = lerp3(SKIES[stageI][0], SKIES[Math.min(5,stageI+1)][0], frac);
      const skyH = lerp3(SKIES[stageI][1], SKIES[Math.min(5,stageI+1)][1], frac);

      // sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgb(${skyT[0]|0},${skyT[1]|0},${skyT[2]|0})`);
      g.addColorStop(1, `rgb(${skyH[0]|0},${skyH[1]|0},${skyH[2]|0})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const starA = Math.max(0, 1 - n.lx * 2.2);
      if (starA > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${starA})`;
        for (const s of stars) ctx.fillRect(s.x * W, s.y * H * 0.7, 1.4 * dpr, 1.4 * dpr);
      }

      /* camera */
      const cam = st.cam;
      const fwd = [cam.focus[0]-cam.pos[0], cam.focus[1]-cam.pos[1], cam.focus[2]-cam.pos[2]];
      const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
      const F = [fwd[0]/fl, fwd[1]/fl, fwd[2]/fl];
      const R = [F[2], 0, -F[0]];
      const rl = Math.hypot(R[0], R[2]) || 1;
      R[0] /= rl; R[2] /= rl;
      const U = [R[1]*F[2]-R[2]*F[1], R[2]*F[0]-R[0]*F[2], R[0]*F[1]-R[1]*F[0]];
      const foc = (W * 0.5) / Math.tan(cam.fov / 2);

      let pd = 0;
      const proj = (x: number, y: number, z: number): [number, number] | null => {
        const dx = x-cam.pos[0], dy = y-cam.pos[1], dz = z-cam.pos[2];
        const zz = dx*F[0]+dy*F[1]+dz*F[2];
        if (zz < 0.25) { pd = -1; return null; }
        pd = zz;
        return [W/2 + (dx*R[0]+dy*R[1]+dz*R[2])*foc/zz, H/2 - (dx*U[0]+dy*U[1]+dz*U[2])*foc/zz];
      };

      /* terrain grid — resolution follows Vtx, extent follows the mode */
      const far = cam.worldScale < 0.01 ? 1700 : 190;
      const N = Math.round(20 + n.vtx * 26);
      const cell = (far * 2) / N;
      const cx = cam.worldScale < 0.01 ? 0 : Math.round(cam.focus[0] / cell) * cell;
      const cz = cam.worldScale < 0.01 ? 0 : Math.round(cam.focus[2] / cell) * cell;
      const step = Math.max(0.3, 7.5 * (1 - Math.min(1, n.vtx / 0.46)));
      const quant = (h: number) => step > 0.4 ? Math.round(h / step) * step : h;
      const sea = -20 + n.aq * 23;

      type Quad = { d: number; p: [number, number][]; c: string };
      const quads: Quad[] = [];
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const x0 = cx - far + i * cell, z0 = cz - far + j * cell;
          const x1 = x0 + cell, z1 = z0 + cell;
          const hs = [terrainAt(x0,z0,oct), terrainAt(x1,z0,oct), terrainAt(x1,z1,oct), terrainAt(x0,z1,oct)].map(quant);
          const pts: [number, number][] = [];
          let depth = 0, okq = true;
          const corners: [number,number,number][] = [[x0,hs[0],z0],[x1,hs[1],z0],[x1,hs[2],z1],[x0,hs[3],z1]];
          for (const [px,py,pz] of corners) {
            const p = proj(px,py,pz);
            if (!p) { okq = false; break; }
            pts.push(p); depth += pd;
          }
          if (!okq) continue;
          depth /= 4;
          const hAvg = (hs[0]+hs[1]+hs[2]+hs[3])/4;
          const nx = (hs[0]+hs[3]-hs[1]-hs[2])*0.5/cell;
          const nz = (hs[0]+hs[1]-hs[3]-hs[2])*0.5/cell;
          const nl = Math.hypot(nx,1,nz);
          const ndl = Math.max(0, (nx/nl)*0.4 + (1/nl)*0.82 + (nz/nl)*-0.3);
          const band = Math.max(0, Math.min(1, (hAvg+22)/48));
          const pf = band*3, pi = Math.min(2, Math.floor(pf)), pm = pf-pi;
          let cr = pal[pi][0]+(pal[pi+1][0]-pal[pi][0])*pm;
          let cg = pal[pi][1]+(pal[pi+1][1]-pal[pi][1])*pm;
          let cb = pal[pi][2]+(pal[pi+1][2]-pal[pi][2])*pm;
          const shade = (1 - n.lx*0.58) + n.lx*(0.3 + 0.95*ndl);
          cr *= shade; cg *= shade; cb *= shade;
          if (n.aq > 0.05 && hAvg < sea) {
            const dep = Math.min(1, (sea-hAvg)/14);
            cr = cr*(1-dep*0.8) + 25*dep; cg = cg*(1-dep*0.6) + 110*dep; cb = cb*(1-dep*0.3) + 160*dep;
          }
          const fog = Math.min(1, Math.max(0, (depth - far*0.25)/(far*0.8))) * (0.25 + n.lx*0.6);
          cr = cr+(skyH[0]-cr)*fog; cg = cg+(skyH[1]-cg)*fog; cb = cb+(skyH[2]-cb)*fog;
          quads.push({ d: depth, p: pts, c: `rgb(${cr|0},${cg|0},${cb|0})` });
        }
      quads.sort((a,b)=>b.d-a.d);
      for (const q of quads) {
        ctx.fillStyle = q.c;
        ctx.beginPath(); ctx.moveTo(q.p[0][0], q.p[0][1]);
        for (let i=1;i<4;i++) ctx.lineTo(q.p[i][0], q.p[i][1]);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = q.c; ctx.lineWidth = 1; ctx.stroke();
      }

      /* the spire + plume */
      const spire: [number,number] = [18, -30];
      const sh = terrainAt(spire[0], spire[1], oct);
      const sb = proj(spire[0], sh, spire[1]);
      const stp = proj(spire[0], sh + 26, spire[1]);
      if (sb && stp) {
        ctx.strokeStyle = "#b46bff"; ctx.lineWidth = Math.max(2, 5*dpr/Math.max(1,pd*0.04));
        ctx.beginPath(); ctx.moveTo(sb[0],sb[1]); ctx.lineTo(stp[0],stp[1]); ctx.stroke();
        for (let i=0;i<22;i++){
          const t2 = ((now/1000*0.22 + i/22) % 1);
          const p = proj(spire[0]+Math.sin(i*2.1+now/900)*t2*7, sh+26+t2*34, spire[1]+Math.cos(i*1.7)*t2*7);
          if (!p) continue;
          const c2 = [[255,61,138],[124,255,77],[255,193,61],[61,200,255]][i%4];
          ctx.fillStyle = `rgba(${c2[0]},${c2[1]},${c2[2]},${(1-t2)*0.85})`;
          const sz = Math.max(1.5, 7*dpr*(1.9-n.pxd)/Math.max(1,pd*0.05));
          ctx.fillRect(p[0]-sz/2, p[1]-sz/2, sz, sz);
        }
      }
      // terraform wave ring
      const wr = ((now/1000*11) % 150);
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.6*dpr;
      ctx.beginPath();
      let started = false;
      for (let a=0;a<=50;a++){
        const ang=(a/50)*Math.PI*2;
        const wx=spire[0]+Math.cos(ang)*wr, wz=spire[1]+Math.sin(ang)*wr;
        const p=proj(wx, quant(terrainAt(wx,wz,oct))+0.9, wz);
        if(!p){started=false;continue;}
        if(!started){ctx.moveTo(p[0],p[1]);started=true;} else ctx.lineTo(p[0],p[1]);
      }
      ctx.stroke();

      /* checkpoints (DRIVE) */
      const driveW = st.mode === "DRIVE" ? cam.blend : (st.prevMode === "DRIVE" ? 1-cam.blend : 0);
      if (driveW > 0.02) {
        CHECKPOINTS.forEach(([gx,gz], i) => {
          const gh = terrainAt(gx,gz,oct);
          const a2 = proj(gx, quant(gh), gz), b2 = proj(gx, quant(gh)+7, gz);
          if (!a2 || !b2) return;
          ctx.strokeStyle = `rgba(255,193,61,${driveW*0.8})`;
          ctx.lineWidth = 3*dpr;
          ctx.beginPath(); ctx.moveTo(a2[0],a2[1]); ctx.lineTo(b2[0],b2[1]); ctx.stroke();
          ctx.fillStyle = `rgba(255,193,61,${driveW})`;
          ctx.font = `bold ${10*dpr}px ui-monospace,monospace`;
          ctx.fillText(String(i+1), b2[0]+4*dpr, b2[1]);
        });
      }

      /* rover */
      const rh = terrainAt(st.roverPos[0], st.roverPos[2], oct);
      const rp = proj(st.roverPos[0], quant(rh)+0.8, st.roverPos[2]);
      if (rp) {
        const sz = Math.max(4, 90*dpr/Math.max(1,pd*0.9));
        ctx.save(); ctx.translate(rp[0], rp[1]); ctx.rotate(st.roverDrift*0.4);
        ctx.fillStyle = st.inRover ? "#ffc13d" : "#8b6a2a";
        ctx.fillRect(-sz*0.9, -sz*0.45, sz*1.8, sz*0.9);
        ctx.fillStyle = "#2a3242";
        ctx.fillRect(-sz*0.95, -sz*0.6, sz*0.45, sz*0.3);
        ctx.fillRect(sz*0.5, -sz*0.6, sz*0.45, sz*0.3);
        ctx.restore();
        if (Math.abs(st.roverDrift) > 0.1 && Math.abs(st.roverSpeed) > 4) {
          ctx.fillStyle = `rgba(200,190,170,${Math.min(0.5, Math.abs(st.roverDrift))})`;
          for (let i=0;i<8;i++) ctx.fillRect(rp[0]+(Math.random()-0.5)*sz*3, rp[1]+Math.random()*sz, 2*dpr, 2*dpr);
        }
      }

      /* avatar */
      if (!st.inRover) {
        const ah = terrainAt(st.avatarPos[0], st.avatarPos[2], oct);
        const ap = proj(st.avatarPos[0], quant(ah)+0.9, st.avatarPos[2]);
        if (ap && st.mode !== "PLAY") {
          const sz = Math.max(3, 70*dpr/Math.max(1,pd*0.9));
          ctx.fillStyle = "#8fbf63";
          ctx.fillRect(ap[0]-sz*0.3, ap[1]-sz*1.4, sz*0.6, sz*1.4);
          ctx.fillStyle = "rgba(90,220,255,0.8)";
          ctx.fillRect(ap[0]-sz*0.2, ap[1]-sz*1.35, sz*0.4, sz*0.2);
        }
      }

      /* GALAXY overlay: neighbouring enclaves */
      const galW = st.mode === "GALAXY" ? cam.blend : (st.prevMode === "GALAXY" ? 1-cam.blend : 0);
      if (galW > 0.02) {
        const enclaves = [
          { n: "@dr.vex · Organ Canyon", a: 0.6, r: 900, c: "#b46bff" },
          { n: "@piskriek · Mirror Lagoon", a: 2.3, r: 1250, c: "#3dc8ff" },
          { n: "@goblinworks · Oxide Flats", a: 4.1, r: 760, c: "#a35c35" },
          { n: "@nyx · Prairie Wind", a: 5.4, r: 1480, c: "#86c954" },
        ];
        for (const e of enclaves) {
          const ex = Math.cos(e.a) * e.r, ez = Math.sin(e.a) * e.r;
          const p = proj(ex, terrainAt(ex,ez,oct)+40, ez);
          if (!p) continue;
          ctx.globalAlpha = galW;
          ctx.strokeStyle = e.c; ctx.lineWidth = 1.5*dpr;
          ctx.beginPath(); ctx.arc(p[0],p[1], 9*dpr, 0, 6.28); ctx.stroke();
          ctx.fillStyle = e.c;
          ctx.beginPath(); ctx.arc(p[0],p[1], 3*dpr, 0, 6.28); ctx.fill();
          ctx.font = `${9.5*dpr}px ui-monospace,monospace`;
          ctx.fillText(e.n, p[0]+14*dpr, p[1]+3*dpr);
          ctx.globalAlpha = 1;
        }
      }

      /* STUDIO overlay: the outliner lens */
      const stuW = st.mode === "STUDIO" ? cam.blend : (st.prevMode === "STUDIO" ? 1-cam.blend : 0);
      if (stuW > 0.02) {
        ctx.fillStyle = `rgba(4,6,10,${stuW*0.55})`;
        ctx.fillRect(0, 0, W*0.3, H);
        const rows = ["◉ Kepler-7b","  ❖ North Prairie","    ▦ chunk_12_7","      ⬢ Injector 04",
                      "        ▣ grass_handpainted","          ◇ noise · freq","            · 5.00"];
        ctx.font = `${10*dpr}px ui-monospace,monospace`;
        rows.forEach((t2,i)=>{
          const active = i === Math.floor(st.scopeDepth);
          ctx.fillStyle = active ? "#b46bff" : `rgba(200,210,230,${stuW*0.65})`;
          ctx.fillText(t2, 12*dpr, (26 + i*17)*dpr);
        });
        ctx.fillStyle = `rgba(180,107,255,${stuW})`;
        ctx.fillRect(6*dpr, (18 + Math.floor(st.scopeDepth)*17)*dpr, 3*dpr, 12*dpr);
      }

      /* PLAY: first-person hands */
      const playW = st.mode === "PLAY" && !st.inRover ? cam.blend : 0;
      if (playW > 0.3) {
        const tri = Math.round(48 * Math.pow(1000, n.vtx));
        const blocky = tri < 2000;
        ctx.fillStyle = "#8fbf63";
        const bob = Math.sin(now/220)*6*dpr*(Math.abs(input.move[1])+Math.abs(input.move[0]));
        if (blocky) {
          ctx.fillRect(W*0.12, H - 90*dpr + bob, 70*dpr, 100*dpr);
          ctx.fillRect(W*0.82, H - 86*dpr - bob, 70*dpr, 100*dpr);
        } else {
          ctx.beginPath(); ctx.ellipse(W*0.16, H-40*dpr+bob, 46*dpr, 62*dpr, 0.3, 0, 6.28); ctx.fill();
          ctx.beginPath(); ctx.ellipse(W*0.85, H-36*dpr-bob, 46*dpr, 62*dpr, -0.3, 0, 6.28); ctx.fill();
        }
      }

      /* perf */
      const fms = performance.now() - f0;
      msAcc += fms; frames++; statT += dt;
      if (fms > 24) hitches++;
      worst = Math.max(worst, fms);
      if (statT > 0.3) {
        setPerf({ ms: msAcc/frames, hitch: hitches, worst });
        setTel(masterTelemetry(st));
        msAcc = 0; frames = 0; statT = 0; worst = 0;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const spec = MODES[mode];

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="fi-panel border border-line bg-panel outline-none"
      style={{ borderColor: spec.colour + "66" }}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-void">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-scan opacity-20" />
        <div className="vignette pointer-events-none absolute inset-0" />

        {/* mode banner */}
        <div className="pointer-events-none absolute top-3 left-3">
          <div className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: spec.colour }}>
            MODE {MODE_ORDER.indexOf(mode) + 1} / 4 {tel?.transitioning ? "· TRANSITIONING" : ""}
          </div>
          <div className="text-2xl leading-none font-black drop-shadow-[0_2px_10px_#000]">
            {spec.label.toUpperCase()}
          </div>
          <div className="mono mt-1 max-w-[320px] text-[9.5px] leading-snug text-chalk/65">
            {spec.blurb}
          </div>
        </div>

        {/* telemetry */}
        {tel && (
          <div className="mono pointer-events-none absolute top-3 right-3 space-y-[2px] text-right text-[9.5px] text-chalk/70">
            <div>S{tel.stage} · Fi {tel.fi < 1e6 ? (tel.fi/1e3).toFixed(0)+"K" : (tel.fi/1e6).toFixed(2)+"M"}</div>
            <div>cam {tel.camDist.toFixed(0)} m · scale {tel.worldScale.toExponential(1)}</div>
            <div>{perf.ms.toFixed(2)} ms · worst {perf.worst.toFixed(1)}</div>
            <div className={perf.hitch > 0 ? "text-lx" : "text-vtx"}>
              {perf.hitch} hitches since boot
            </div>
            {tel.inRover && <div className="text-lx">{tel.roverSpeedKph.toFixed(0)} km/h · drift {tel.drift.toFixed(2)}</div>}
          </div>
        )}

        {/* transition bar */}
        {tel?.transitioning && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-void/60">
            <div className="h-full transition-none" style={{ width: `${tel.blend*100}%`, background: spec.colour }} />
          </div>
        )}

        {!focused && (
          <div className="absolute inset-0 flex items-center justify-center bg-void/55">
            <button
              onClick={() => wrapRef.current?.focus()}
              className="mono fi-accent-bg px-5 py-3 text-[11px] font-black tracking-[0.3em] text-void uppercase"
            >
              ▶ click to take the keyboard
            </button>
          </div>
        )}
      </div>

      {/* console */}
      <div className="border-t border-line bg-panel2 p-3">
        <div className="mb-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
          {MODE_ORDER.map((m) => {
            const s = MODES[m];
            const on = mode === m;
            return (
              <button
                key={m}
                onClick={() => {
                  const st = stRef.current;
                  if (st) { stRef.current = requestMode(st, m); setMode(m); }
                  wrapRef.current?.focus();
                }}
                className={cn("mono border px-2 py-2 text-left transition-all",
                  on ? "border-transparent text-void" : "border-line text-dim hover:text-chalk")}
                style={on ? { background: s.colour } : { borderColor: s.colour + "44" }}
              >
                <span className="block text-[8.5px] tracking-[0.2em] opacity-75">[{s.hotkey}]</span>
                <span className="block text-[12px] font-black">{s.label}</span>
                <span className="mono block text-[8px] opacity-70">{s.inputTarget}</span>
              </button>
            );
          })}
        </div>

        <div className="mono mb-1 flex justify-between text-[9.5px]">
          <span className="text-dim">planetary fidelity (all four metrics)</span>
          <span className="tnum text-chalk">S{tel?.stage ?? 1} · {Math.pow(10, exp).toExponential(1)}</span>
        </div>
        <input type="range" min={2} max={7.95} step={0.01} value={exp}
          onChange={(e) => setExp(+e.target.value)} className="w-full"
          style={{ ["--thumb" as string]: spec.colour }} />

        <div className="mono mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-dim">
          <span><span className="text-chalk">WASD</span> move</span>
          <span><span className="text-chalk">←→</span> look</span>
          <span><span className="text-chalk">E</span> enter/exit rover</span>
          <span><span className="text-chalk">1·2·3·4</span> mode</span>
          <span><span className="text-chalk">Tab / O</span> studio</span>
          <span><span className="text-chalk">G</span> galaxy</span>
          <span><span className="text-chalk">Space</span> handbrake</span>
          <span><span className="text-chalk">Esc</span> back to play</span>
        </div>

        {tel && (
          <div className="mono mt-2 border-t border-line pt-2 text-[9px] leading-snug text-dim">
            <span className="text-chalk">residency union</span> (prev ∪ next, nothing unloaded):{" "}
            <span className="text-vtx">{tel.residency.join(" · ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
