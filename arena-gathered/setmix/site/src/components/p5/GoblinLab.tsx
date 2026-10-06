import { useEffect, useRef, useState } from "react";
import {
  initialGoblin, stepGoblin, goblinTelemetry, profileFor,
  type GoblinState, type GoblinInput, type WorldProbe,
} from "@/drop/GoblinController";
import {
  solveTwoBoneIK, planFootPlant, makeCape, stepCape, avatarBudget,
  AVATAR_LADDER, type ClothState,
} from "@/drop/AvatarFidelityManager";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

/* deterministic stepped terrain — the Stage-1 moon in cross-section */
function baseHeight(x: number) {
  return (
    Math.sin(x * 0.07) * 4.2 +
    Math.sin(x * 0.19 + 1.1) * 1.8 +
    Math.sin(x * 0.031) * 3.1 +
    (x > 36 && x < 64 ? (x - 36) * 0.34 : 0) -
    2
  );
}

export default function GoblinLab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [exp, setExp] = useState(2.3);
  const [running, setRunning] = useState(true);
  const [showIK, setShowIK] = useState(true);
  const [tel, setTel] = useState<ReturnType<typeof goblinTelemetry> | null>(null);

  const cfg = useRef({ exp, running, showIK });
  cfg.current = { exp, running, showIK };

  useEffect(() => {
    const cv = ref.current!;
    let g: GoblinState = initialGoblin([6, 10, 0]);
    let cape: ClothState = makeCape([6, 11.4, 0], 6, 7, 0.7, 0.9);
    let raf = 0, last = performance.now(), acc = 0, t = 0;
    const trail: [number, number][] = [];
    let distance = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      const v = Math.pow(10, c.exp);
      const fi: FidelityState = { pxd: v * 1.32, vtx: v, lx: v * 0.72, aq: v * 0.46, tick: 0 };
      const p = profileFor(fi);
      const n = Math.min(1, Math.max(0, Math.log1p(fi.aq) / Math.log1p(4.1e7)));
      const sea = n > 0.25 ? -1.5 + n * 5 : -1e9;

      const world: WorldProbe = {
        height: (x: number, _z = 0) => {
          const h = baseHeight(x);
          // Stage 1 the world is literally steps; the quantum dissolves with Vtx
          const q = p.posQuantum > 0.001 ? 1.0 : 0;
          return q > 0 ? Math.round(h / q) * q * (1 - p.continuity) + h * p.continuity : h;
        },
        seaLevel: sea,
        wind: [Math.sin(t * 0.4) * 6 + 4, 0],
      };

      if (c.running) {
        acc += dt;
        const stepT = 1 / 120;
        let guard = 0;
        while (acc >= stepT && guard++ < 20) {
          acc -= stepT;
          // scripted input: walk right, jump at obstacles, dive in water
          const ahead = world.height(g.pos[0] + 1.6, 0);
          const rise = ahead - g.pos[1];
          const input: GoblinInput = {
            move: [0, 1],
            yaw: Math.PI / 2,
            jump: rise > p.stepHeight * 0.85 && g.grounded,
            sprint: rise < 0.1,
            crouch: false,
            ascend: g.submersion > 0.7,
          };
          const before = g.pos[0];
          g = stepGoblin(g, input, world, fi, 1);
          distance += Math.abs(g.pos[0] - before);
          if (g.pos[0] > 92) { g = initialGoblin([6, world.height(6, 0) + 4, 0]); trail.length = 0; }
        }
        const anchor: [number, number, number] = [g.pos[0] - 0.22, g.pos[1] + 1.25, 0];
        cape = stepCape(cape, anchor, [-1, 0, 0],
          [world.wind[0], 0, 0], [g.vel[0], g.vel[1], 0], fi, dt);
        trail.push([g.pos[0], g.pos[1]]);
        if (trail.length > 420) trail.shift();
      }

      /* ---------- render ---------- */
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const x2 = cv.getContext("2d")!;
      const scale = (H / 26);
      const camX = g.pos[0] - 14;
      const SX = (wx: number) => (wx - camX) * scale;
      const SY = (wy: number) => H - (wy + 8) * scale;

      const nv = Math.min(1, Math.max(0, Math.log1p(fi.vtx) / Math.log1p(9.4e7)));
      x2.fillStyle = nv < 0.2 ? "#05070c" : nv < 0.5 ? "#0b1320" : "#16314e";
      x2.fillRect(0, 0, W, H);

      // terrain
      x2.beginPath();
      x2.moveTo(0, H);
      for (let px = 0; px <= W; px += 2) {
        const wx = camX + px / scale;
        x2.lineTo(px, SY(world.height(wx, 0)));
      }
      x2.lineTo(W, H); x2.closePath();
      const grd = x2.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, nv < 0.3 ? "#3a4049" : nv < 0.6 ? "#4d5a3f" : "#3f7a44");
      grd.addColorStop(1, "#151a22");
      x2.fillStyle = grd; x2.fill();
      x2.strokeStyle = nv < 0.3 ? "#6e7682" : "#8ac46a"; x2.lineWidth = 1.5 * dpr; x2.stroke();

      // water
      if (sea > -1e8) {
        x2.fillStyle = "rgba(45,160,210,0.42)";
        x2.fillRect(0, SY(sea), W, H - SY(sea));
        x2.strokeStyle = "rgba(160,225,255,0.6)"; x2.lineWidth = dpr;
        x2.beginPath();
        for (let px = 0; px <= W; px += 4)
          x2.lineTo(px, SY(sea + Math.sin(px * 0.03 + t * 2) * 0.1));
        x2.stroke();
      }

      // trail
      x2.strokeStyle = "rgba(255,193,61,0.35)"; x2.lineWidth = dpr;
      x2.beginPath();
      trail.forEach(([tx, ty], i) => (i ? x2.lineTo(SX(tx), SY(ty)) : x2.moveTo(SX(tx), SY(ty))));
      x2.stroke();

      /* ---------- the goblin ---------- */
      const bud = avatarBudget(fi, { distanceWalked: distance, timeInMud: 0, submersion: g.submersion, coldBiome: 0 });
      const gx = SX(g.pos[0]), gy = SY(g.pos[1]);
      const bodyH = 1.5 * scale;
      const col = bud.tier === "BLOCK" ? "#9aa3b0" : bud.tier === "SEGMENTED" ? "#c08a6a"
        : bud.tier === "SKINNED" ? "#8fbf63" : "#b8e07a";

      // cape (Verlet)
      if (bud.cape > 0.01) {
        x2.strokeStyle = `rgba(180,107,255,${0.25 + bud.cape * 0.5})`;
        x2.lineWidth = dpr;
        for (let y = 0; y < cape.rows - 1; y++)
          for (let x = 0; x < cape.cols - 1; x++) {
            const a = cape.nodes[y * cape.cols + x].p;
            const b = cape.nodes[y * cape.cols + x + 1].p;
            const c2 = cape.nodes[(y + 1) * cape.cols + x].p;
            x2.beginPath();
            x2.moveTo(SX(a[0]), SY(a[1])); x2.lineTo(SX(b[0]), SY(b[1]));
            x2.moveTo(SX(a[0]), SY(a[1])); x2.lineTo(SX(c2[0]), SY(c2[1]));
            x2.stroke();
          }
      }

      // legs via two-bone IK
      const hipY = g.pos[1] + 0.78;
      const stride = Math.sin(t * (bud.animFps / 3.4)) * 0.34 * Math.min(1, Math.hypot(g.vel[0], g.vel[2]) / 3);
      for (const [k, phase] of [[0, 0], [1, Math.PI]] as const) {
        const footX = g.pos[0] + Math.sin(stride * 3 + phase) * 0.36;
        const animFootY = hipY - 0.74 + Math.max(0, Math.cos(stride * 3 + phase)) * 0.2;
        const plant = planFootPlant([footX, animFootY, 0], (x) => world.height(x, 0), bud.ik);
        const ik = solveTwoBoneIK([g.pos[0], hipY, 0], plant.target, 0.42, 0.42, [1, 0, 0]);
        x2.strokeStyle = col; x2.lineWidth = 3.4 * dpr; x2.lineCap = "round";
        x2.beginPath();
        x2.moveTo(SX(ik.hip[0]), SY(ik.hip[1]));
        x2.lineTo(SX(ik.knee[0]), SY(ik.knee[1]));
        x2.lineTo(SX(ik.foot[0]), SY(ik.foot[1]));
        x2.stroke();
        if (c.showIK && bud.ik > 0.02) {
          x2.fillStyle = k ? "#3dc8ff" : "#ff3d8a";
          x2.beginPath(); x2.arc(SX(ik.knee[0]), SY(ik.knee[1]), 3 * dpr, 0, 6.28); x2.fill();
          x2.strokeStyle = "rgba(124,255,77,0.7)"; x2.lineWidth = dpr;
          x2.beginPath();
          x2.moveTo(SX(plant.target[0]) - 7, SY(plant.target[1]));
          x2.lineTo(SX(plant.target[0]) + 7, SY(plant.target[1]));
          x2.stroke();
        }
      }

      // body
      x2.fillStyle = col;
      if (bud.tier === "BLOCK") {
        x2.fillRect(gx - 0.3 * scale, gy - bodyH, 0.6 * scale, bodyH);
      } else {
        x2.fillRect(gx - 0.26 * scale, gy - bodyH * 0.95, 0.52 * scale, bodyH * 0.62);
        x2.beginPath();
        x2.arc(gx, gy - bodyH * 1.02, 0.26 * scale, 0, 6.28);
        x2.fill();
      }
      // visor
      x2.fillStyle = `rgba(90,220,255,${0.3 + bud.uniforms.u_visorReflect * 0.6})`;
      x2.fillRect(gx - 0.17 * scale, gy - bodyH * 1.08, 0.34 * scale, 0.16 * scale);

      // mode pill
      x2.font = `bold ${10 * dpr}px ui-monospace, monospace`;
      x2.fillStyle = g.mode === "SWIM" || g.mode === "DIVE" ? "#3dc8ff"
        : g.mode === "CLAMBER" ? "#ffc13d" : g.mode === "AIR" ? "#b46bff" : "#7cff4d";
      x2.fillText(g.mode, gx - 16 * dpr, gy - bodyH - 12 * dpr);

      setTel(goblinTelemetry(g, fi));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="border-b border-line lg:border-r lg:border-b-0">
          <canvas ref={ref} className="w-full bg-void" style={{ aspectRatio: "16/8" }} />
        </div>
        <div className="p-3">
          <div className="mono mb-1 flex justify-between text-[9.5px]">
            <span className="text-dim">Fidelity</span>
            <span className="tnum text-chalk">
              S{tel?.stage ?? 1} · tier {tel?.tier ?? 1}
            </span>
          </div>
          <input type="range" min={2} max={7.98} step={0.01} value={exp}
            onChange={(e) => setExp(+e.target.value)} className="w-full"
            style={{ ["--thumb" as string]: "var(--fi-accent)" }} />
          <div className="mt-1 grid grid-cols-6 gap-1">
            {[2.2, 3.35, 4.45, 5.5, 6.4, 7.5].map((v, i) => (
              <button key={v} onClick={() => setExp(v)}
                className={cn("mono border py-1 text-[8px] font-bold",
                  tel?.stage === i + 1 ? "border-transparent bg-chalk text-void"
                    : "border-line text-dim hover:text-chalk")}>
                S{i + 1}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-1">
            <button onClick={() => setRunning(!running)}
              className={cn("mono flex-1 border px-2 py-1 text-[9px] font-bold uppercase",
                running ? "border-transparent bg-chalk text-void" : "border-line text-dim")}>
              {running ? "■ pause" : "▶ run"}
            </button>
            <button onClick={() => setShowIK(!showIK)}
              className={cn("mono flex-1 border px-2 py-1 text-[9px] font-bold uppercase",
                showIK ? "border-transparent bg-vtx text-void" : "border-line text-dim")}>
              ⊹ ik rig
            </button>
          </div>

          {tel && (
            <div className="mt-3 border-t border-line pt-2">
              {([
                ["mode", tel.mode, "#7cff4d"],
                ["speed", `${tel.speed.toFixed(2)} m/s`, undefined],
                ["pos quantum", tel.quantum > 0.001 ? `${tel.quantum.toFixed(3)} m` : "continuous", tel.quantum > 0.001 ? "#ff3d8a" : "#7cff4d"],
                ["max slope", `${tel.maxSlopeDeg.toFixed(0)}°`, undefined],
                ["current slope", `${tel.slopeDeg.toFixed(0)}°`, tel.slopeDeg > tel.maxSlopeDeg ? "#ff3d8a" : undefined],
                ["anim", `${tel.animFrames}f @ ${tel.animFps.toFixed(0)} fps`, "#ffc13d"],
                ["can swim", tel.canSwim ? "yes" : "no", tel.canSwim ? "#3dc8ff" : "#6b7a90"],
                ["submersion", tel.submersion.toFixed(2), "#3dc8ff"],
                ["avatar tris", tel.triBudget.toLocaleString(), "var(--fi-accent)"],
              ] as const).map(([k, v, c]) => (
                <div key={k} className="mono flex justify-between border-b border-line/40 py-[3px] text-[9.5px] last:border-0">
                  <span className="text-dim">{k}</span>
                  <span className="tnum" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-1 border-t border-line pt-2">
            {AVATAR_LADDER.map((a) => {
              const on = (tel?.triBudget ?? 48) >= a.tris;
              return (
                <div key={a.tier} className={cn("mono text-[9px] leading-snug", on ? "text-chalk" : "text-dim/50")}>
                  <span className={on ? "text-vtx" : ""}>{on ? "◉" : "○"}</span>{" "}
                  <span className="font-bold">{a.tier}</span>{" "}
                  <span className="text-dim">{a.tris.toLocaleString()} tri · {a.bones} bones</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
