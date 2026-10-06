import { useEffect, useRef, useState } from "react";
import { STANDALONE_VERT, STANDALONE_FRAG, uniformsFor } from "@/drop/TerrainMaterial";
import { deriveBudget, DEVICES } from "@/drop/fidelity";
import type { FidelityState } from "@/drop/contracts.setmix";
import { cn } from "@/utils/cn";

const N = 150; // grid resolution → 45k triangles
const SPAN = 420;

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
function terrain(x: number, z: number, oct: number) {
  let a = 1, f = 0.0085, s = 0, nn = 0;
  for (let i = 0; i < oct; i++) { s += a * vn(x * f + 31, z * f + 12); nn += a; a *= 0.52; f *= 2.03; }
  const d = Math.min(1.25, Math.hypot(x, z) / 160);
  return (s / nn - 0.46) * 62 + d * d * 26 - 14;
}

/* minimal mat4 */
function perspective(fovy: number, ar: number, n: number, f: number) {
  const t = 1 / Math.tan(fovy / 2);
  return new Float32Array([t / ar,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,(2*f*n)/(n-f),0]);
}
function lookAtMV(eye: number[], at: number[]) {
  const up = [0, 1, 0];
  const z = [eye[0]-at[0], eye[1]-at[1], eye[2]-at[2]];
  let l = Math.hypot(z[0],z[1],z[2]); z[0]/=l; z[1]/=l; z[2]/=l;
  const x = [up[1]*z[2]-up[2]*z[1], up[2]*z[0]-up[0]*z[2], up[0]*z[1]-up[1]*z[0]];
  l = Math.hypot(x[0],x[1],x[2]) || 1; x[0]/=l; x[1]/=l; x[2]/=l;
  const y = [z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
  return new Float32Array([
    x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
    -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
    -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]), 1,
  ]);
}

export default function GLViewport({
  onFi,
}: {
  onFi?: (s: FidelityState) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [exp, setExp] = useState(3.4);
  const [devId, setDevId] = useState("ultra");
  const [orbit, setOrbit] = useState(true);
  const [wave, setWave] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState({ ms: 0, tris: 0, stage: 1, size: 16, oct: 1, pal: 0 });

  const cfg = useRef({ exp, devId, orbit, wave });
  cfg.current = { exp, devId, orbit, wave };

  useEffect(() => {
    const cv = ref.current!;
    const gl = cv.getContext("webgl2", { antialias: true, alpha: false });
    if (!gl) { setErr("WebGL2 unavailable in this browser."); return; }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };

    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, STANDALONE_VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, STANDALONE_FRAG));
      gl.bindAttribLocation(prog, 0, "position");
      gl.bindAttribLocation(prog, 1, "normal");
      gl.bindAttribLocation(prog, 2, "uv");
      gl.bindAttribLocation(prog, 3, "a_heightNext");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
    } catch (e) { setErr((e as Error).message.slice(0, 400)); return; }

    /* ---- geometry: H_prev in position.y, H_next in a_heightNext ---- */
    const n1 = N + 1;
    const pos = new Float32Array(n1 * n1 * 3);
    const nrm = new Float32Array(n1 * n1 * 3);
    const uvs = new Float32Array(n1 * n1 * 2);
    const hNext = new Float32Array(n1 * n1);
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const k = j * n1 + i;
        const x = -SPAN / 2 + (i / N) * SPAN;
        const z = -SPAN / 2 + (j / N) * SPAN;
        pos[k * 3] = x; pos[k * 3 + 1] = terrain(x, z, 2); pos[k * 3 + 2] = z;
        hNext[k] = terrain(x, z, 6);
        uvs[k * 2] = i / N; uvs[k * 2 + 1] = j / N;
        const e = SPAN / N;
        const dx = terrain(x + e, z, 6) - terrain(x - e, z, 6);
        const dz = terrain(x, z + e, 6) - terrain(x, z - e, 6);
        const nx = -dx, ny = 2 * e, nz = -dz;
        const l = Math.hypot(nx, ny, nz) || 1;
        nrm[k * 3] = nx / l; nrm[k * 3 + 1] = ny / l; nrm[k * 3 + 2] = nz / l;
      }
    const idx = new Uint32Array(N * N * 6);
    let p = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = (data: Float32Array, loc: number, size: number) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(pos, 0, 3); buf(nrm, 1, 3); buf(uvs, 2, 2); buf(hNext, 3, 1);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    const U = (name: string) => gl.getUniformLocation(prog, name);
    const loc = {
      proj: U("projectionMatrix"), mv: U("modelViewMatrix"), nm: U("normalMatrix"),
      pxd: U("u_pxd"), vtx: U("u_vtx"), lx: U("u_lx"), aq: U("u_aq"),
      time: U("u_time"), sea: U("u_seaLevel"), rain: U("u_rain"),
      palLv: U("u_paletteLevels"), pal: U("u_palette[0]"), palN: U("u_paletteCount"),
      relief: U("u_relief"), tri: U("u_triSharp"), oct: U("u_octaves"),
      cell: U("u_cellSize"), cham: U("u_chamfer"),
      sun: U("u_sunDir"), skyT: U("u_skyTop"), skyH: U("u_skyHorizon"), water: U("u_waterTint"),
      wo: U("u_waveOrigin[0]"), wr: U("u_waveRadius[0]"),
      wt: U("u_waveThickness[0]"), wd: U("u_waveDir[0]"), wc: U("u_waveCount"),
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    let raf = 0, yaw = 0.5, t0 = performance.now(), acc = 0, frames = 0, statT = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - t0) / 1000;
      const c = cfg.current;
      const f0 = performance.now();

      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);

      const v = Math.pow(10, c.exp);
      const state: FidelityState = { pxd: v * 1.32, vtx: v, lx: v * 0.72, aq: v * 0.46, tick: 0 };
      const dev = DEVICES.find((d) => d.id === c.devId)!;
      const budget = deriveBudget(state, dev);
      const waveR = c.wave ? ((t * 26) % 520) - 40 : -1e9;
      const u = uniformsFor(state, budget, {
        time: t,
        waves: c.wave ? [{ origin: [0, 0] as [number, number], radius: waveR, thickness: 12, dir: 1 as const }] : [],
      });

      const sky = u.u_skyTop;
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);

      if (c.orbit) yaw += 0.0022;
      const eye = [Math.sin(yaw) * 235, 96, Math.cos(yaw) * 235];
      gl.uniformMatrix4fv(loc.proj, false, perspective(0.82, w / h, 1, 2200));
      gl.uniformMatrix4fv(loc.mv, false, lookAtMV(eye, [0, 2, 0]));
      gl.uniformMatrix3fv(loc.nm, false, new Float32Array([1,0,0, 0,1,0, 0,0,1]));

      gl.uniform1f(loc.pxd, u.u_pxd); gl.uniform1f(loc.vtx, u.u_vtx);
      gl.uniform1f(loc.lx, u.u_lx);   gl.uniform1f(loc.aq, u.u_aq);
      gl.uniform1f(loc.time, u.u_time); gl.uniform1f(loc.sea, u.u_seaLevel);
      gl.uniform1f(loc.rain, u.u_rain);
      gl.uniform1f(loc.palLv, u.u_paletteLevels);
      gl.uniform3fv(loc.pal, new Float32Array(u.u_palette));
      gl.uniform1i(loc.palN, u.u_paletteCount);
      gl.uniform1f(loc.relief, u.u_relief); gl.uniform1f(loc.tri, u.u_triSharp);
      gl.uniform1f(loc.oct, u.u_octaves);
      gl.uniform1f(loc.cell, u.u_cellSize); gl.uniform1f(loc.cham, u.u_chamfer);
      gl.uniform3fv(loc.sun, new Float32Array(u.u_sunDir));
      gl.uniform3fv(loc.skyT, new Float32Array(u.u_skyTop));
      gl.uniform3fv(loc.skyH, new Float32Array(u.u_skyHorizon));
      gl.uniform3fv(loc.water, new Float32Array(u.u_waterTint));
      gl.uniform2fv(loc.wo, new Float32Array(u.u_waveOrigin));
      gl.uniform1fv(loc.wr, new Float32Array(u.u_waveRadius));
      gl.uniform1fv(loc.wt, new Float32Array(u.u_waveThickness));
      gl.uniform1fv(loc.wd, new Float32Array(u.u_waveDir));
      gl.uniform1i(loc.wc, u.u_waveCount);

      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);

      acc += performance.now() - f0; frames++; statT += 0.016;
      if (statT > 0.4) {
        setInfo({ ms: acc / frames, tris: idx.length / 3, stage: budget.stage,
          size: budget.size, oct: budget.octaveBudget, pal: budget.paletteLevels });
        onFi?.(state);
        acc = 0; frames = 0; statT = 0;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [onFi]);

  return (
    <div className="fi-panel border border-line bg-panel">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-void">
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
        {err && (
          <pre className="mono absolute inset-0 overflow-auto bg-void/95 p-3 text-[10px] text-pxd">
            {err}
          </pre>
        )}
        <div className="pointer-events-none absolute top-3 left-3">
          <div className="mono text-[9px] tracking-[0.25em] text-chalk/60 uppercase">
            WebGL2 · one program · zero variants
          </div>
          <div className="text-xl leading-none font-black drop-shadow-[0_2px_8px_#000]">
            STAGE {info.stage}
          </div>
        </div>
        <div className="mono pointer-events-none absolute top-3 right-3 space-y-[2px] text-right text-[9.5px] text-chalk/70">
          <div>{(info.tris / 1000).toFixed(0)}k tri · {info.ms.toFixed(2)} ms</div>
          <div>texel {info.size}² · oct {info.oct}</div>
          <div>palette {info.pal === -1 ? "4 hard" : info.pal === 0 ? "truecolour" : `${info.pal} lv`}</div>
        </div>
      </div>

      <div className="border-t border-line bg-panel2 p-3">
        <div className="mono mb-1 flex justify-between text-[9.5px]">
          <span className="text-dim">Fidelity (all four metrics, balanced)</span>
          <span className="tnum text-chalk">{Math.pow(10, exp).toExponential(2)}</span>
        </div>
        <input type="range" min={2} max={7.98} step={0.01} value={exp}
          onChange={(e) => setExp(+e.target.value)} className="w-full"
          style={{ ["--thumb" as string]: "var(--fi-accent)" }} />
        <div className="mt-2 grid grid-cols-6 gap-1">
          {[2.2, 3.35, 4.45, 5.5, 6.4, 7.5].map((v, i) => (
            <button key={v} onClick={() => setExp(v)}
              className={cn("mono border py-1 text-[9px] font-bold",
                info.stage === i + 1 ? "border-transparent bg-chalk text-void"
                  : "border-line text-dim hover:text-chalk")}>
              S{i + 1}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {DEVICES.map((d) => (
            <button key={d.id} onClick={() => setDevId(d.id)}
              className={cn("mono border px-2 py-1 text-[9px]",
                devId === d.id ? "border-transparent bg-chalk text-void"
                  : "border-line text-dim hover:text-chalk")}>
              {d.label}
            </button>
          ))}
          <button onClick={() => setWave(!wave)}
            className={cn("mono ml-auto border px-2 py-1 text-[9px] font-bold",
              wave ? "border-transparent bg-vtx text-void" : "border-line text-dim")}>
            ◎ GEOMORPH WAVE
          </button>
          <button onClick={() => setOrbit(!orbit)}
            className={cn("mono border px-2 py-1 text-[9px] font-bold",
              orbit ? "border-transparent bg-chalk text-void" : "border-line text-dim")}>
            ⟲ ORBIT
          </button>
        </div>
      </div>
    </div>
  );
}
