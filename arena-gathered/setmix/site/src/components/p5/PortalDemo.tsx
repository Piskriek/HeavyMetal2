import { useEffect, useRef, useState } from "react";
import {
  mat4, obliqueProjection, virtualCameraMatrix, portalPlaneViewSpace,
  stepThreshold, initialThreshold, portalAudioMix, sideOf,
  type PortalFrame, type ThresholdState, type Mat4,
} from "@/drop/PortalRenderer";
import { cn } from "@/utils/cn";

const VS = `#version 300 es
precision highp float;
uniform mat4 u_vp; uniform mat4 u_model;
in vec3 a_pos; in vec3 a_col;
out vec3 v_col; out vec3 v_world;
void main(){
  vec4 w = u_model * vec4(a_pos,1.0);
  v_world = w.xyz; v_col = a_col;
  gl_Position = u_vp * w;
}`;

const FS = `#version 300 es
precision highp float;
uniform float u_quant;   // 0 = smooth, >0 = palette levels
uniform float u_tint;
uniform vec3  u_fog;
uniform float u_alpha;
in vec3 v_col; in vec3 v_world;
out vec4 o;
void main(){
  vec3 c = v_col;
  float d = clamp((length(v_world.xz) - 6.0) / 34.0, 0.0, 1.0);
  c = mix(c, u_fog, d * 0.55);
  if (u_quant > 0.5) {
    float q = 1.0 / (u_quant - 1.0);
    vec2 p = mod(gl_FragCoord.xy, 4.0);
    float b = (mod(p.x*4.0 + p.y*1.0, 16.0)) / 16.0 - 0.5;
    c = floor(c / q + b * 0.6 + 0.5) * q;
  }
  o = vec4(c, u_alpha);
}`;

type Mesh = { vao: WebGLVertexArrayObject; count: number };

export default function PortalDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [walk, setWalk] = useState(0.0);          // −1 moon … +1 lab
  const [auto, setAuto] = useState(true);
  const [stencilOn, setStencilOn] = useState(true);
  const [obliqueOn, setObliqueOn] = useState(true);
  const [bandwidth, setBandwidth] = useState(0.55);
  const [th, setTh] = useState<ThresholdState>(initialThreshold("LAB"));
  const [stats, setStats] = useState({ passes: 0, side: 0, mix: 0, hum: 0, occl: 0 });

  const cfg = useRef({ walk, auto, stencilOn, obliqueOn, bandwidth });
  cfg.current = { walk, auto, stencilOn, obliqueOn, bandwidth };
  // the reducer is pure and must see its OWN previous output, not a React
  // snapshot captured at mount — otherwise `justCrossed` never fires
  const thRef = useRef<ThresholdState>(initialThreshold("LAB"));

  useEffect(() => {
    const cv = ref.current!;
    const gl = cv.getContext("webgl2", { stencil: true, antialias: true, alpha: false });
    if (!gl) { setErr("WebGL2 with a stencil buffer is required."); return; }

    const sh = (t: number, s: string) => {
      const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)!);
      return o;
    };
    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(prog, 0, "a_pos"); gl.bindAttribLocation(prog, 1, "a_col");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)!);
    } catch (e) { setErr(String(e).slice(0, 300)); return; }

    const U = {
      vp: gl.getUniformLocation(prog, "u_vp"), model: gl.getUniformLocation(prog, "u_model"),
      quant: gl.getUniformLocation(prog, "u_quant"), tint: gl.getUniformLocation(prog, "u_tint"),
      fog: gl.getUniformLocation(prog, "u_fog"), alpha: gl.getUniformLocation(prog, "u_alpha"),
    };

    /* ---------- mesh builders ---------- */
    const mk = (pos: number[], col: number[]): Mesh => {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      const b1 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b1);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      const b2 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b2);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      return { vao, count: pos.length / 3 };
    };
    const box = (p: number[], c: number[], x: number, y: number, z: number,
                 w: number, h: number, d: number, col: [number, number, number], shade = 1) => {
      const V = [[x-w,y,z-d],[x+w,y,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
                 [x-w,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
      const F = [[0,1,2,3,0.72],[5,4,7,6,0.72],[4,0,3,7,0.86],[1,5,6,2,0.86],[3,2,6,7,1.0],[4,5,1,0,0.5]];
      for (const [a,b2,c2,d2,s] of F) {
        for (const i of [a,b2,c2, a,c2,d2]) { p.push(...V[i as number]); }
        for (let k = 0; k < 6; k++)
          c.push(col[0]*(s as number)*shade, col[1]*(s as number)*shade, col[2]*(s as number)*shade);
      }
    };

    // LAB: white room, soft, smooth
    const lp: number[] = [], lc: number[] = [];
    box(lp, lc, 0, -0.2, 0, 9, 0.2, 9, [0.88, 0.89, 0.92]);
    box(lp, lc, 0, 0, -8.6, 9, 5, 0.3, [0.93, 0.94, 0.96]);
    box(lp, lc, -8.6, 0, 0, 0.3, 5, 9, [0.91, 0.92, 0.95]);
    box(lp, lc, 8.6, 0, 0, 0.3, 5, 9, [0.91, 0.92, 0.95]);
    box(lp, lc, -3.2, 0, -2.4, 1.1, 0.95, 0.7, [0.82, 0.84, 0.88]);
    box(lp, lc, -3.2, 0.95, -2.4, 0.9, 0.08, 0.55, [0.26, 0.78, 0.95]);
    box(lp, lc, 3.4, 0, -3.0, 0.9, 1.5, 0.5, [0.84, 0.86, 0.9]);
    box(lp, lc, 3.4, 1.5, -3.0, 0.7, 0.9, 0.08, [0.95, 0.42, 0.68]);
    box(lp, lc, 0, 0, 3.6, 1.4, 0.55, 1.4, [0.86, 0.88, 0.92]);
    const lab = mk(lp, lc);

    // MOON: blocky, 4 colours, harsh
    const mp: number[] = [], mc: number[] = [];
    const PAL: [number, number, number][] = [
      [0.17,0.18,0.21],[0.29,0.32,0.36],[0.43,0.46,0.51],[0.60,0.64,0.69]];
    let seed = 99;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let gx = -7; gx <= 7; gx++)
      for (let gz = -7; gz <= 7; gz++) {
        const h = Math.max(0.5, (Math.sin(gx * 0.8) + Math.cos(gz * 0.7) + rnd() * 0.8) * 1.1 + 1.4);
        box(mp, mc, gx * 2, -0.2, gz * 2 - 16, 1, h, 1, PAL[Math.floor(rnd() * 4)]);
      }
    // a spire
    box(mp, mc, 2, 2.0, -20, 0.5, 7, 0.5, [0.52, 0.42, 0.62]);
    box(mp, mc, 2, 9.0, -20, 0.8, 0.8, 0.8, [0.95, 0.24, 0.54]);
    const moon = mk(mp, mc);

    // portal aperture quad (local XY, +Z facing)
    const pw = 1.5, ph = 3.0;
    const portalQuad = mk(
      [-pw,0,0, pw,0,0, pw,ph,0, -pw,0,0, pw,ph,0, -pw,ph,0],
      new Array(18).fill(0.5),
    );
    // arch frame (drawn in the lab)
    const fp: number[] = [], fc: number[] = [];
    box(fp, fc, -pw - 0.16, 0, 0, 0.16, ph + 0.22, 0.26, [0.33, 0.36, 0.44]);
    box(fp, fc, pw + 0.16, 0, 0, 0.16, ph + 0.22, 0.26, [0.33, 0.36, 0.44]);
    box(fp, fc, 0, ph, 0, pw + 0.32, 0.22, 0.26, [0.38, 0.41, 0.5]);
    const frame = mk(fp, fc);

    /* ---------- portal frames ---------- */
    const labPortal: PortalFrame = {
      id: "lab", world: "LAB", width: pw * 2, height: ph,
      matrix: new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-5.5,1]) as Mat4,
    };
    const moonPortal: PortalFrame = {
      id: "moon", world: "MOON", width: pw * 2, height: ph,
      matrix: new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 2,0,-13,1]) as Mat4,
    };

    const draw = (m: Mesh, model: Mat4, vp: Mat4, quant: number, fog: [number,number,number]) => {
      gl.uniformMatrix4fv(U.model, false, model);
      gl.uniformMatrix4fv(U.vp, false, vp);
      gl.uniform1f(U.quant, quant);
      gl.uniform1f(U.tint, 0);
      gl.uniform1f(U.alpha, 1);
      gl.uniform3fv(U.fog, new Float32Array(fog));
      gl.bindVertexArray(m.vao);
      gl.drawArrays(gl.TRIANGLES, 0, m.count);
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    const I = mat4.identity();
    let raf = 0, t0 = performance.now(), w = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = cfg.current;
      const t = (now - t0) / 1000;
      w = c.auto ? Math.sin(t * 0.33) : c.walk;

      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      gl.viewport(0, 0, W, H);

      // camera walks along −Z toward the arch at z=−5.5
      const camZ = -1.2 - w * -4.0;           // w=+1 → z≈−5.2 (lab) ; w=−1 → z≈−9.2 (through)
      const camY = 1.62 + Math.sin(t * 2.1) * 0.015;
      const camX = Math.sin(t * 0.22) * 1.1;
      const camM = new Float32Array([
        1,0,0,0, 0,1,0,0, 0,0,1,0, camX, camY, camZ, 1,
      ]) as Mat4;
      // yaw slightly toward the arch so parallax is visible
      const yaw = -camX * 0.09;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      camM[0] = cy; camM[2] = -sy; camM[8] = sy; camM[10] = cy;

      const head: [number, number, number] = [camX, camY, camZ];
      const hand: [number, number, number] = [camX + 0.25, camY - 0.25, camZ - 0.75];
      const next = stepThreshold(thRef.current, labPortal, head, hand);
      thRef.current = next;
      const mix = portalAudioMix(next, c.bandwidth);
      const side = sideOf(labPortal, head);

      const view = mat4.invert(camM);
      const proj = mat4.perspective(1.05, W / H, 0.05, 220);
      const vpLab = mat4.multiply(proj, view);

      gl.clearColor(0.03, 0.035, 0.05, 1);
      gl.clearStencil(0);
      gl.stencilMask(0xff);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

      const inLab = side >= 0;
      const from = inLab ? labPortal : moonPortal;
      const to = inLab ? moonPortal : labPortal;
      let passes = 0;

      /* ── 1. stencil the aperture ─────────────────────────────── */
      if (c.stencilOn) {
        gl.enable(gl.STENCIL_TEST);
        gl.colorMask(false, false, false, false);
        gl.depthMask(false);
        gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        draw(portalQuad, from.matrix, vpLab, 0, [0, 0, 0]);
        passes++;
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        /* ── 2. clear depth inside the stencil only ────────────── */
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.clear(gl.DEPTH_BUFFER_BIT);
      } else {
        gl.disable(gl.STENCIL_TEST);
      }

      /* ── 3. destination world, oblique-clipped ───────────────── */
      const vCam = virtualCameraMatrix(camM, from, to);
      const vView = mat4.invert(vCam);
      const plane = portalPlaneViewSpace(to, vView, -1);
      const vProj = c.obliqueOn ? obliqueProjection(proj, plane) : proj;
      const vp2 = mat4.multiply(vProj, vView);
      const destIsMoon = to.world === "MOON";
      // bandwidth throttles the far side's palette — diegetically correct
      const quant = destIsMoon ? Math.max(2, Math.round(2 + c.bandwidth * 14)) : 0;
      draw(destIsMoon ? moon : lab, I, vp2, quant, destIsMoon ? [0.02,0.02,0.05] : [0.9,0.91,0.94]);
      passes++;

      /* ── 4. source world ─────────────────────────────────────── */
      gl.disable(gl.STENCIL_TEST);
      gl.depthFunc(gl.LEQUAL);
      const srcIsMoon = from.world === "MOON";
      draw(srcIsMoon ? moon : lab, I,
        mat4.multiply(proj, view),
        srcIsMoon ? Math.max(2, Math.round(2 + c.bandwidth * 14)) : 0,
        srcIsMoon ? [0.02,0.02,0.05] : [0.9,0.91,0.94]);
      draw(frame, from.matrix, mat4.multiply(proj, view), 0, [0.9,0.91,0.94]);
      passes++;

      setTh(next);
      setStats({ passes, side, mix: mix.moonGain, hum: mix.portalHumGain, occl: mix.occlusionHz });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const PH = ["AWAY", "APPROACHING", "REACHING", "CROSSING", "SETTLING"] as const;

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-void">
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
        {err && <pre className="mono absolute inset-0 bg-void/95 p-3 text-[10px] text-pxd">{err}</pre>}
        <div className="pointer-events-none absolute top-3 left-3">
          <div className="mono text-[9px] tracking-[0.25em] text-chalk/60 uppercase">
            stencil + oblique near-plane · {stats.passes} passes
          </div>
          <div className="text-xl leading-none font-black drop-shadow-[0_2px_8px_#000]">
            {th.world === "LAB" ? "THE WHITE ROOM" : "THE MOON"}
          </div>
          <div className="mono mt-1 text-[9.5px] text-chalk/70">
            {th.form} · d = {th.distance.toFixed(2)} m
          </div>
        </div>
        <div className="mono pointer-events-none absolute right-3 bottom-3 space-y-[2px] text-right text-[9px] text-chalk/70">
          <div>dissolve {th.dissolve.toFixed(2)}</div>
          <div>audio mix {stats.mix.toFixed(2)}</div>
          <div>hum {stats.hum.toFixed(2)} · occl {(stats.occl / 1000).toFixed(1)}k</div>
          {th.handThrough && <div className="text-vtx">◆ HAND THROUGH PLANE</div>}
        </div>
      </div>

      <div className="border-t border-line bg-panel2 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {PH.map((p) => (
            <span key={p}
              className={cn("mono border px-1.5 py-[2px] text-[8.5px] tracking-wider",
                th.phase === p ? "fi-accent-bg border-transparent text-void font-bold"
                  : "border-line text-dim")}>
              {p}
            </span>
          ))}
          <span className="mono ml-auto text-[9px] text-dim">
            threshold state machine · 120 Hz pure reducer
          </span>
        </div>

        <div className="mono mb-1 flex justify-between text-[9.5px]">
          <span className="text-dim">walk through the arch</span>
          <span className="tnum text-chalk">{walk >= 0 ? "lab" : "moon"} {walk.toFixed(2)}</span>
        </div>
        <input type="range" min={-1} max={1} step={0.01} value={walk} disabled={auto}
          onChange={(e) => setWalk(+e.target.value)} className="w-full disabled:opacity-40"
          style={{ ["--thumb" as string]: "var(--fi-accent)" }} />

        <div className="mono mt-2 mb-1 flex justify-between text-[9.5px]">
          <span className="text-dim">portal bandwidth (far-side fidelity)</span>
          <span className="tnum text-chalk">{(bandwidth * 100) | 0}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.01} value={bandwidth}
          onChange={(e) => setBandwidth(+e.target.value)} className="w-full"
          style={{ ["--thumb" as string]: "#b46bff" }} />

        <div className="mt-2 flex flex-wrap gap-1">
          {([
            ["auto walk", auto, setAuto, "#e8eef7"],
            ["stencil mask", stencilOn, setStencilOn, "#7cff4d"],
            ["oblique clip", obliqueOn, setObliqueOn, "#ff3d8a"],
          ] as const).map(([k, v, set, c]) => (
            <button key={k} onClick={() => (set as (b: boolean) => void)(!v)}
              className={cn("mono border px-2 py-1 text-[9px] font-bold tracking-wider uppercase",
                v ? "border-transparent text-void" : "border-line text-dim hover:text-chalk")}
              style={v ? { background: c } : {}}>
              {v ? "◉" : "○"} {k}
            </button>
          ))}
        </div>
        <p className="mono mt-2 text-[9.5px] leading-snug text-dim">
          Turn <span className="text-pxd">stencil mask</span> off: the moon renders over the whole
          lab, because nothing is clipping it to the aperture. Turn{" "}
          <span className="text-pxd">oblique clip</span> off and walk right up to the arch: moon
          geometry that sits <em className="not-italic">between</em> the virtual camera and the
          portal plane pokes through into the room.
        </p>
      </div>
    </div>
  );
}
