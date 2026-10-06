import { useCallback, useEffect, useRef, useState } from "react";
import { mat4, type Mat4 } from "@/drop/PortalRenderer";
import { deriveBudget, DEVICES, fidelityIndex, stageOf } from "@/drop/fidelity";
import { uniformsFor } from "@/drop/TerrainMaterial";
import { SetmixAudio } from "@/drop/setmixAudio";
import {
  initialQuest, stepQuest, type QuestState, type PlayerEvent, type QuestNotification,
} from "@/drop/QuestEngine";
import type { FidelityState } from "@/drop/contracts.setmix";
import SetmixHUD, { type HUDModel } from "@/components/p6/SetmixHUD";

/* ══════════════════════════════════════════════════════════ CONSTANTS ══ */
const MOON_G = -1.62, LAB_G = -9.81;
const EYE = 1.62;
const PORTAL_Z = -9.0, PORTAL_W = 1.6, PORTAL_H = 3.0;
const MOON_ORIGIN_Z = -46;   // where the moon-side arch sits
const TICK = 1 / 120;

type World = "LAB" | "MOON";
interface Node { x: number; z: number; kind: "CRYSTAL" | "SHARD"; taken: boolean; hp: number }
interface Placed { x: number; z: number; kind: string; wired: boolean; slotted: boolean; t: number }

/* deterministic moon terrain */
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
function moonH(x: number, z: number, oct: number) {
  let a = 1, f = 0.018, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vn(x * f + 11, z * f + 7); n += a; a *= 0.52; f *= 2.03; }
  const zz = z - MOON_ORIGIN_Z;
  const bowl = Math.min(1.2, Math.hypot(x, zz) / 70);
  return (s / n - 0.47) * 26 + bowl * bowl * 14 - 5;
}

/* ══════════════════════════════════════════════════════════ SHADERS ══ */
const VS = `#version 300 es
precision highp float;
uniform mat4 u_vp, u_model;
uniform float u_waveR, u_waveT, u_vtxN, u_cell;
uniform vec2 u_waveO;
uniform int u_isMoon;
in vec3 a_pos, a_col, a_nrm;
in float a_hi;
out vec3 v_col, v_nrm, v_world;
out float v_morph;
float sC1(float u){ float t=clamp(u,0.,1.); return t*t*(3.-2.*t); }
void main(){
  vec3 p = (u_model * vec4(a_pos,1.)).xyz;
  if (u_isMoon == 1) {
    float lo = floor(p.y/u_cell+0.5)*u_cell;
    float hi = mix(floor(a_hi/u_cell+0.5)*u_cell, a_hi, u_vtxN);
    float d = distance(p.xz, u_waveO);
    float s = sC1((u_waveR - d)/max(u_waveT,0.001));
    v_morph = s;
    p.y = mix(lo, hi, s);
  } else { v_morph = 0.0; }
  v_world = p; v_col = a_col; v_nrm = a_nrm;
  gl_Position = u_vp * vec4(p,1.);
}`;

const FS = `#version 300 es
precision highp float;
uniform float u_pal, u_lxN, u_pxdN, u_time, u_aqN;
uniform vec3 u_pl[4], u_fog, u_sun;
uniform int u_isMoon;
uniform float u_emis;
in vec3 v_col, v_nrm, v_world;
in float v_morph;
out vec4 o;
float bayer(vec2 p){
  ivec2 q = ivec2(mod(p,4.));
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[q.y*4+q.x]/16.-0.5;
}
void main(){
  vec3 N = normalize(v_nrm);
  float ndl = max(dot(N, normalize(u_sun)), 0.);
  float amb = mix(1., .34, u_lxN);
  float lam = mix(0., .3+.95*ndl, smoothstep(.02,.35,u_lxN));
  vec3 c = v_col * (amb + lam) + v_col * u_emis;
  if (u_isMoon==1 && v_morph>0.02 && v_morph<0.98)
    c += vec3(.35,.85,.45) * (1.-abs(v_morph*2.-1.)) * .45;
  float d = clamp((length(v_world - vec3(0.,20.,0.)) - 30.)/120., 0., 1.);
  c = mix(c, u_fog, d * (u_isMoon==1 ? .55*smoothstep(.1,.7,u_lxN) : .25));
  c = c/(c+vec3(.78));
  c = pow(max(c,vec3(0.)), vec3(1./2.2));
  if (u_pal < -0.5) {
    float l = dot(c, vec3(.299,.587,.114));
    int i0 = int(clamp(floor(l*3. + bayer(gl_FragCoord.xy)*1.05), 0., 3.));
    c = u_pl[i0];
  } else if (u_pal > 0.5) {
    float q = 1./(u_pal-1.);
    c = floor(c/q + bayer(gl_FragCoord.xy)*.7 + .5)*q;
  }
  o = vec4(c,1.);
}`;

const PVS = `#version 300 es
precision highp float;
uniform mat4 u_vp; uniform float u_time;
in vec3 a_cube; in vec3 i_pos; in float i_size; in float i_hue; in float i_alpha;
out vec3 v_c; out float v_a;
void main(){
  float s=sin(u_time*1.6+i_hue*31.4), c=cos(u_time*1.6+i_hue*31.4);
  vec3 r=vec3(a_cube.x*c-a_cube.z*s, a_cube.y, a_cube.x*s+a_cube.z*c);
  vec3 P[4] = vec3[4](vec3(1.,.24,.54), vec3(.49,1.,.3), vec3(1.,.76,.24), vec3(.24,.78,1.));
  v_c = P[int(clamp(floor(i_hue*4.),0.,3.))]; v_a = i_alpha;
  gl_Position = u_vp * vec4(i_pos + r*i_size, 1.);
}`;
const PFS = `#version 300 es
precision highp float;
in vec3 v_c; in float v_a; out vec4 o;
void main(){ o = vec4(v_c, v_a); }`;

/* ══════════════════════════════════════════════════════ COMPONENT ══ */

export default function SetMixPlayable() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [locked, setLocked] = useState(false);
  const [hud, setHud] = useState<HUDModel | null>(null);
  const [toasts, setToasts] = useState<QuestNotification[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<SetmixAudio | null>(null);
  const evQ = useRef<PlayerEvent[]>([]);

  const pushEvent = useCallback((e: PlayerEvent) => { evQ.current.push(e); }, []);

  const toggleAudio = async () => {
    if (audioOn) { await audioRef.current?.stop(); setAudioOn(false); return; }
    if (!audioRef.current) audioRef.current = new SetmixAudio({ masterGain: 0.4, seed: 7 });
    await audioRef.current.start();
    setAudioOn(true);
  };

  useEffect(() => {
    const cv = canvas.current!;
    const gl = cv.getContext("webgl2", { antialias: true, stencil: true, alpha: false });
    if (!gl) { setErr("WebGL2 with a stencil buffer is required."); return; }

    /* ---------- programs ---------- */
    const mkProg = (vs: string, fs: string, attrs: string[]) => {
      const sh = (t: number, s: string) => {
        const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)!);
        return o;
      };
      const p = gl.createProgram()!;
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)!);
      return p;
    };
    let prog: WebGLProgram, pprog: WebGLProgram;
    try {
      prog = mkProg(VS, FS, ["a_pos", "a_col", "a_nrm", "a_hi"]);
      pprog = mkProg(PVS, PFS, ["a_cube", "i_pos", "i_size", "i_hue", "i_alpha"]);
    } catch (e) { setErr(String(e).slice(0, 400)); return; }

    const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
    const u = {
      vp: U(prog, "u_vp"), model: U(prog, "u_model"), waveO: U(prog, "u_waveO"),
      waveR: U(prog, "u_waveR"), waveT: U(prog, "u_waveT"), vtxN: U(prog, "u_vtxN"),
      cell: U(prog, "u_cell"), isMoon: U(prog, "u_isMoon"), pal: U(prog, "u_pal"),
      lxN: U(prog, "u_lxN"), pxdN: U(prog, "u_pxdN"), aqN: U(prog, "u_aqN"),
      time: U(prog, "u_time"), pl: U(prog, "u_pl[0]"), fog: U(prog, "u_fog"),
      sun: U(prog, "u_sun"), emis: U(prog, "u_emis"),
    };
    const pu = { vp: U(pprog, "u_vp"), time: U(pprog, "u_time") };

    /* ---------- geometry builders ---------- */
    type Mesh = { vao: WebGLVertexArrayObject; n: number };
    const build = (pos: number[], col: number[], nrm: number[], hi: number[]): Mesh => {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      const bind = (data: number[], loc: number, size: number) => {
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      };
      bind(pos, 0, 3); bind(col, 1, 3); bind(nrm, 2, 3); bind(hi, 3, 1);
      gl.bindVertexArray(null);
      return { vao, n: pos.length / 3 };
    };
    const pushBox = (P: number[], C: number[], N: number[], H: number[],
      x: number, y: number, z: number, w: number, h: number, d: number,
      c: [number, number, number], hiY?: number) => {
      const V = [[x-w,y,z-d],[x+w,y,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
                 [x-w,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
      const F: [number,number,number,number,[number,number,number]][] = [
        [0,1,2,3,[0,0,-1]],[5,4,7,6,[0,0,1]],[4,0,3,7,[-1,0,0]],
        [1,5,6,2,[1,0,0]],[3,2,6,7,[0,1,0]],[4,5,1,0,[0,-1,0]]];
      for (const [a,b,c2,d2,nn] of F)
        for (const i of [a,b,c2, a,c2,d2]) {
          P.push(...V[i]); C.push(c[0], c[1], c[2]); N.push(nn[0], nn[1], nn[2]);
          H.push(hiY ?? (V[i][1]));
        }
    };

    /* ---------- LAB ---------- */
    const LP: number[] = [], LC: number[] = [], LN: number[] = [], LH: number[] = [];
    pushBox(LP,LC,LN,LH, 0,-0.3,-2, 10,0.3,10, [0.90,0.91,0.94]);
    pushBox(LP,LC,LN,LH, 0,0,-12.2, 10,5,0.3, [0.94,0.95,0.97]);
    pushBox(LP,LC,LN,LH, -10,0,-2, 0.3,5,10, [0.92,0.93,0.96]);
    pushBox(LP,LC,LN,LH, 10,0,-2, 0.3,5,10, [0.92,0.93,0.96]);
    pushBox(LP,LC,LN,LH, 0,5,-2, 10,0.3,10, [0.97,0.98,1.0]);
    // Synthesizer
    pushBox(LP,LC,LN,LH, -4.5,0,-5, 1.2,0.95,0.7, [0.80,0.82,0.86]);
    pushBox(LP,LC,LN,LH, -4.5,0.95,-5, 1.0,0.06,0.55, [0.95,0.24,0.54]);
    // Fusion Matrix
    pushBox(LP,LC,LN,LH, 4.5,0,-5, 1.1,0.7,1.1, [0.82,0.84,0.88]);
    pushBox(LP,LC,LN,LH, 4.5,0.7,-5, 0.45,0.9,0.45, [0.70,0.42,1.0]);
    // Bench
    pushBox(LP,LC,LN,LH, 0,0,-11, 2.0,0.85,0.6, [0.84,0.86,0.9]);
    pushBox(LP,LC,LN,LH, 0,0.85,-11, 1.7,0.05,0.45, [0.3,0.85,1.0]);
    const labMesh = build(LP, LC, LN, LH);

    // arch frame
    const AP: number[] = [], AC: number[] = [], AN: number[] = [], AH: number[] = [];
    pushBox(AP,AC,AN,AH, -PORTAL_W-0.18,0,PORTAL_Z, 0.18,PORTAL_H+0.25,0.3, [0.30,0.33,0.42]);
    pushBox(AP,AC,AN,AH, PORTAL_W+0.18,0,PORTAL_Z, 0.18,PORTAL_H+0.25,0.3, [0.30,0.33,0.42]);
    pushBox(AP,AC,AN,AH, 0,PORTAL_H,PORTAL_Z, PORTAL_W+0.36,0.25,0.3, [0.36,0.39,0.5]);
    const archMesh = build(AP, AC, AN, AH);

    // portal aperture quad
    const qp = [-PORTAL_W,0,PORTAL_Z, PORTAL_W,0,PORTAL_Z, PORTAL_W,PORTAL_H,PORTAL_Z,
                -PORTAL_W,0,PORTAL_Z, PORTAL_W,PORTAL_H,PORTAL_Z, -PORTAL_W,PORTAL_H,PORTAL_Z];
    const quad = build(qp, new Array(18).fill(0.5), new Array(18).fill(0), new Array(6).fill(0));

    /* ---------- MOON terrain (dual height: lo=blocky, hi=smooth) ---------- */
    const GN = 86, GS = 2.4;
    const MP: number[] = [], MC: number[] = [], MN: number[] = [], MH: number[] = [];
    const PAL4: [number,number,number][] = [[0.17,0.18,0.21],[0.29,0.32,0.36],[0.43,0.46,0.51],[0.60,0.64,0.69]];
    // The moon occupies the SAME world space, beyond the portal plane. No
    // teleport, no second coordinate system — the arch is a window onto a
    // region that is simply further down −Z. That is what makes the crossing
    // seamless: there is nothing to transition.
    for (let j = 0; j < GN; j++)
      for (let i = 0; i < GN; i++) {
        const x = (i - GN/2) * GS, z = (j - GN/2) * GS + MOON_ORIGIN_Z;
        if (z > PORTAL_Z - GS * 0.5) continue;          // never poke into the lab
        const lo = Math.round(moonH(x, z, 2) / 2) * 2;
        const hi = moonH(x, z, 6);
        const band = Math.max(0, Math.min(3, Math.floor((hi + 12) / 8)));
        pushBox(MP, MC, MN, MH, x, lo - 6, z, GS/2, 6.2, GS/2, PAL4[band], hi);
      }
    const moonMesh = build(MP, MC, MN, MH);

    // machine proxy meshes
    const chimneyMesh = (() => {
      const P: number[] = [], C: number[] = [], N: number[] = [], H: number[] = [];
      pushBox(P,C,N,H, 0,0,0, 0.8,0.6,0.8, [0.35,0.37,0.44], 0);
      pushBox(P,C,N,H, 0,0.6,0, 0.45,3.6,0.45, [0.5,0.3,0.42], 0);
      pushBox(P,C,N,H, 0,4.2,0, 0.62,0.4,0.62, [1.0,0.24,0.54], 0);
      return build(P,C,N,H);
    })();
    const solarMesh = (() => {
      const P: number[] = [], C: number[] = [], N: number[] = [], H: number[] = [];
      pushBox(P,C,N,H, 0,0,0, 0.2,1.0,0.2, [0.4,0.42,0.5], 0);
      pushBox(P,C,N,H, 0,1.0,0, 1.3,0.12,0.9, [1.0,0.86,0.42], 0);
      return build(P,C,N,H);
    })();
    const nodeMesh = (() => {
      const P: number[] = [], C: number[] = [], N: number[] = [], H: number[] = [];
      pushBox(P,C,N,H, 0,0,0, 0.42,0.9,0.42, [1,1,1], 0);
      return build(P,C,N,H);
    })();

    /* ---------- plume instancing ---------- */
    const CAP = 3000;
    const cube = [-1,-1,-1, 1,-1,-1, 1,1,-1, -1,-1,-1, 1,1,-1, -1,1,-1,
                  -1,-1,1, 1,1,1, 1,-1,1, -1,-1,1, -1,1,1, 1,1,1,
                  -1,-1,-1, -1,1,1, -1,-1,1, -1,-1,-1, -1,1,-1, -1,1,1,
                  1,-1,-1, 1,-1,1, 1,1,1, 1,-1,-1, 1,1,1, 1,1,-1,
                  -1,1,-1, 1,1,-1, 1,1,1, -1,1,-1, 1,1,1, -1,1,1,
                  -1,-1,-1, 1,-1,1, 1,-1,-1, -1,-1,-1, -1,-1,1, 1,-1,1].map((v) => v * 0.5);
    const pvao = gl.createVertexArray()!;
    gl.bindVertexArray(pvao);
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const instBuf = gl.createBuffer();
    const instData = new Float32Array(CAP * 6);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, instData.byteLength, gl.DYNAMIC_DRAW);
    const S6 = 6 * 4;
    [[1,3,0],[2,1,12],[3,1,16],[4,1,20]].forEach(([loc, size, off]) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S6, off);
      gl.vertexAttribDivisor(loc, 1);
    });
    gl.bindVertexArray(null);

    /* ---------- world state ---------- */
    const nodes: Node[] = [];
    let ns = 4242;
    const rnd = () => ((ns = (Math.imul(ns, 1664525) + 1013904223) >>> 0) / 4294967296);
    // seeded in an arc beyond the arch, nearest ones close enough that the
    // first crystal is found inside 90 s without a quest marker
    for (let i = 0; i < 52; i++) {
      const a = rnd() * Math.PI * 2, r = 6 + rnd() * 52;
      const z = Math.min(PORTAL_Z - 4, MOON_ORIGIN_Z + Math.sin(a) * r);
      nodes.push({
        x: Math.cos(a) * r, z,
        kind: rnd() > 0.42 ? "CRYSTAL" : "SHARD", taken: false, hp: 3,
      });
    }
    for (let i = 0; i < 6; i++)
      nodes.push({ x: (i - 2.5) * 5.5, z: PORTAL_Z - 12 - (i % 3) * 5,
        kind: i % 2 ? "CRYSTAL" : "SHARD", taken: false, hp: 3 });
    const placed: Placed[] = [];
    const parts: { x:number;y:number;z:number;vx:number;vy:number;vz:number;l:number;s:number;h:number }[] = [];

    let fi: FidelityState = { pxd: 90, vtx: 60, lx: 30, aq: 1, tick: 0 };
    let quest: QuestState = initialQuest();
    let world: World = "LAB";
    let coherence = 1;
    let waveR = -1e9, waveActive = false, waveT0 = 0;
    const waveO: [number, number] = [0, MOON_ORIGIN_Z];   // set to the chimney on dispatch

    /* ---------- player ---------- */
    const P = { x: 0, y: 0, z: -2, vx: 0, vy: 0, vz: 0, yaw: Math.PI, pitch: 0, grounded: true };
    const keys = new Set<string>();
    let hotbar = 0;
    const inv = { CHROMATIC_CRYSTAL: 0, TOPOLOGY_SHARD: 0 };
    let mining: Node | null = null;
    let holdFire = false, holdPlace = false;

    const groundAt = (x: number, z: number, w: World) =>
      w === "LAB" ? 0 : (() => {
        const n = Math.min(1, Math.log1p(fi.vtx) / Math.log1p(9.4e7));
        const lo = Math.round(moonH(x, z, 2) / 2) * 2;
        const hi = moonH(x, z, 6);
        const d = Math.hypot(x - waveO[0], z - waveO[1]);
        const s = waveActive ? Math.max(0, Math.min(1, (waveR - d) / 10)) : 0;
        const sm = s * s * (3 - 2 * s);
        return lo + (hi - lo) * sm * Math.max(0.15, n);
      })();

    /* ---------- input ---------- */
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.code;
      if (down) {
        keys.add(k);
        if (k.startsWith("Digit")) hotbar = Math.max(0, Math.min(7, +k.slice(5) - 1));
        if (k === "KeyE") pushEvent({ t: "INTERACTED", target: world === "LAB" ? "FUSION_MATRIX" : "SPIRE" });
      } else keys.delete(k);
      if (["KeyW","KeyA","KeyS","KeyD","Space","ShiftLeft","Tab"].includes(k)) e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const mm = (e: MouseEvent) => {
      if (document.pointerLockElement !== cv) return;
      P.yaw -= e.movementX * 0.0022;
      P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * 0.0022));
    };
    const md = (e: MouseEvent) => {
      if (document.pointerLockElement !== cv) { cv.requestPointerLock(); return; }
      if (e.button === 0) holdFire = true;
      if (e.button === 2) holdPlace = true;
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) holdFire = false; if (e.button === 2) holdPlace = false; };
    const ctx = (e: Event) => e.preventDefault();
    const plc = () => setLocked(document.pointerLockElement === cv);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", mm);
    cv.addEventListener("mousedown", md); window.addEventListener("mouseup", mu);
    cv.addEventListener("contextmenu", ctx);
    document.addEventListener("pointerlockchange", plc);

    /* ---------- loop ---------- */
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    let raf = 0, last = performance.now(), acc = 0, t = 0, reticle = "NONE", hudAcc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      acc += dt;
      let guard = 0;

      while (acc >= TICK && guard++ < 8) {
        acc -= TICK;
        /* ---- movement ---- */
        const sp = (keys.has("ShiftLeft") ? 7.0 : 4.2) * (world === "LAB" ? 1 : 1.15);
        const fwd = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
        const str = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
        const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
        let wx = str * cy - fwd * sy, wz = str * sy + fwd * cy;
        const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
        const a = P.grounded ? 22 : 5;
        P.vx += (wx * sp - P.vx) * Math.min(1, a * TICK);
        P.vz += (wz * sp - P.vz) * Math.min(1, a * TICK);
        P.vy += (world === "LAB" ? LAB_G : MOON_G) * TICK;
        if (keys.has("Space") && P.grounded) {
          P.vy = world === "LAB" ? 4.4 : 5.0;
          P.grounded = false;
          if (world === "MOON") pushEvent({ t: "JUMPED" });
        }
        P.x += P.vx * TICK; P.y += P.vy * TICK; P.z += P.vz * TICK;
        const g = groundAt(P.x, P.z, world);
        if (P.y <= g) { P.y = g; P.vy = 0; P.grounded = true; }

        /* ---- portal crossing ---- */
        const dPlane = P.z - PORTAL_Z;
        const inAp = Math.abs(P.x) < PORTAL_W && P.y < PORTAL_H + 1;
        const nowWorld: World = inAp ? (dPlane > 0 ? "LAB" : "MOON") : world;
        if (inAp && nowWorld !== world) {
          world = nowWorld;   // position is continuous; only the RULES change
          pushEvent({ t: "ENTERED_WORLD", world });
          audioRef.current?.bandWhoosh(0.8);
        }
        if (inAp && Math.abs(dPlane) < 1.6 && world === "LAB")
          pushEvent({ t: "HAND_THROUGH_PORTAL" });

        /* ---- coherence ---- */
        if (world === "MOON") {
          const dPortal = Math.hypot(P.x, P.z - PORTAL_Z);
          const nearSpire = placed.some((m) => Math.hypot(P.x - m.x, P.z - m.z) < 26);
          const drain = nearSpire || dPortal < 30 ? -0.08 : 0.9 * Math.pow(1 + dPortal / 160, 1.3) * 0.0016;
          coherence = Math.max(0, Math.min(1, coherence - drain * TICK * 2.2));
          if (coherence < 0.55) pushEvent({ t: "COHERENCE_LOW", value: coherence });
          if (coherence <= 0) {
            pushEvent({ t: "DECOHERED" });
            P.x = 0; P.z = PORTAL_Z - 2; P.y = groundAt(0, PORTAL_Z - 2, "MOON"); coherence = 1;
          }
        } else coherence = Math.min(1, coherence + 0.6 * TICK);

        /* ---- fidelity accrual ---- */
        let pxd = 0, vtx = 0;
        for (const m of placed) if (m.wired) { pxd += m.slotted ? 26 : 12; vtx += 2; }
        fi = {
          pxd: fi.pxd + pxd * TICK * 26, vtx: fi.vtx + vtx * TICK * 26,
          lx: fi.lx + (pxd > 0 ? 6 : 0) * TICK * 26, aq: fi.aq + (pxd > 0 ? 1 : 0) * TICK * 10,
          tick: fi.tick + 1,
        };

        /* ---- wave ---- */
        if (waveActive) {
          waveR = 150 * (1 - Math.exp(-(t - waveT0) / 16));
          if (t - waveT0 > 90) { waveActive = false; waveR = 1e9; }
        }
      }

      /* ---- raycast reticle & actions ---- */
      const dirX = -Math.sin(P.yaw) * Math.cos(P.pitch);
      const dirY = Math.sin(P.pitch);
      const dirZ = Math.cos(P.yaw) * Math.cos(P.pitch);
      reticle = "NONE"; mining = null;
      if (world === "MOON") {
        let best = 7;
        for (const n of nodes) {
          if (n.taken) continue;
          const ny = groundAt(n.x, n.z, "MOON") + 0.8;
          const vx = n.x - P.x, vy = ny - (P.y + EYE), vz = n.z - P.z;
          const d = Math.hypot(vx, vy, vz);
          if (d > 7) continue;
          const dot = (vx * dirX + vy * dirY + vz * dirZ) / d;
          if (dot > 0.965 && d < best) { best = d; mining = n; }
        }
        if (mining) reticle = mining.kind === "CRYSTAL" ? "CRYSTAL" : "SHARD";
        else if (P.grounded) reticle = "PLACE";
      } else {
        const dSyn = Math.hypot(P.x + 4.5, P.z + 5), dFus = Math.hypot(P.x - 4.5, P.z + 5);
        if (dSyn < 3 || dFus < 3) reticle = "MACHINE";
      }

      if (holdFire && mining) {
        mining.hp -= dt * 2.6;
        if (mining.hp <= 0) {
          mining.taken = true;
          const kind = mining.kind === "CRYSTAL" ? "CHROMATIC_CRYSTAL" : "TOPOLOGY_SHARD";
          inv[kind] += 1;
          pushEvent({ t: "MINED", resource: kind, amount: 1 });
          audioRef.current?.footstep(mining.kind === "CRYSTAL" ? "crystal" : "metal");
        }
      }
      if (holdPlace && world === "MOON" && reticle === "PLACE") {
        holdPlace = false;
        const px = P.x + dirX * 5, pz = P.z + dirZ * 5;
        const kind = hotbar === 0 ? "PIXEL_CHIMNEY" : hotbar === 1 ? "SOLAR_COLLECTOR" : "COHERENCE_BEACON";
        const canChimney = inv.CHROMATIC_CRYSTAL >= 4 || placed.length > 0;
        if (kind !== "PIXEL_CHIMNEY" || canChimney) {
          placed.push({ x: px, z: pz, kind, wired: false, slotted: false, t });
          pushEvent({ t: "PLACED_MACHINE", kind, id: `m${placed.length}` });
          if (kind === "PIXEL_CHIMNEY") inv.CHROMATIC_CRYSTAL = Math.max(0, inv.CHROMATIC_CRYSTAL - 4);
          audioRef.current?.fidelityChime(2);
          // auto-wire & slot when a solar exists nearby — Act 3 chain
          const ch = placed.find((m) => m.kind === "PIXEL_CHIMNEY");
          const so = placed.find((m) => m.kind === "SOLAR_COLLECTOR");
          if (ch && so && !ch.wired) {
            ch.wired = true; pushEvent({ t: "WIRED", from: "solar", to: "chimney" });
            setTimeout(() => {
              ch.slotted = true;
              pushEvent({ t: "SLOTTED_CARTRIDGE", machineId: "chimney", cartridgeId: "moon_regolith" });
              // the wave departs from the CHIMNEY, so the causal chain is
              // legible: that machine is making this ring
              waveO[0] = ch.x; waveO[1] = ch.z;
              waveActive = true; waveT0 = t; waveR = 0;
              pushEvent({ t: "WAVE_DISPATCHED", sourceId: "chimney" });
              audioRef.current?.fidelityChime(3);
              audioRef.current?.bandWhoosh(1);
            }, 1400);
          }
        }
      }

      /* ---- plumes ---- */
      for (const m of placed) {
        if (m.kind !== "PIXEL_CHIMNEY" || !m.wired) continue;
        if (parts.length < CAP && Math.random() < 0.7) {
          const ang = Math.random() * 6.283;
          parts.push({
            x: m.x + Math.cos(ang) * 0.3, y: groundAt(m.x, m.z, "MOON") + 4.6,
            z: m.z + Math.sin(ang) * 0.3,
            vx: Math.cos(ang) * 0.4, vy: 5 + Math.random() * 2, vz: Math.sin(ang) * 0.4,
            l: 0, s: 0.3 + Math.random() * 0.26, h: Math.random(),
          });
        }
      }
      let live = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.l += dt / 4.5;
        p.vy += (-0.6 + 1.6 * (1 - p.l)) * dt;
        p.vx += Math.sin(p.h * 31 + p.y * 0.1) * 0.5 * dt + 0.5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (waveActive) {
          const d = Math.hypot(p.x - waveO[0], p.z - waveO[1]);
          if (Math.abs(d - waveR) < 8 && p.l > 0.3) { parts.splice(i, 1); continue; }
        }
        if (p.l >= 1) { parts.splice(i, 1); continue; }
        if (live < CAP) {
          const o = live * 6, f = p.l < 0.14 ? p.l / 0.14 : 1 - (p.l - 0.14) / 0.86;
          instData[o] = p.x; instData[o+1] = p.y; instData[o+2] = p.z;
          instData[o+3] = p.s * (0.6 + f * 0.4); instData[o+4] = p.h; instData[o+5] = Math.max(0, f) * 0.92;
          live++;
        }
      }

      /* ---- quest ---- */
      const q = stepQuest(quest, evQ.current, fi, 1);
      evQ.current = [];
      quest = q.nextState;
      if (q.notifications.length) {
        setToasts((prev) => [...prev, ...q.notifications].slice(-4));
        for (const n of q.notifications)
          if (n.kind === "BEAT") audioRef.current?.fidelityChime(stageOf(fidelityIndex(fi)));
      }

      /* ---- audio ---- */
      if (audioRef.current) {
        const audioFi: FidelityState = world === "LAB"
          ? { pxd: 1.2e8, vtx: 9e7, lx: 6e7, aq: 2e6, tick: 0 } : fi;
        audioRef.current.update(audioFi, dt);
      }

      /* ---------- RENDER ---------- */
      const dpr = Math.min(1.6, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      gl.viewport(0, 0, W, H);

      const budget = deriveBudget(fi, DEVICES[3]);
      const un = uniformsFor(fi, budget, { time: t });
      const camM = mat4.identity();
      const cyw = Math.cos(P.yaw), syw = Math.sin(P.yaw);
      const cpt = Math.cos(P.pitch), spt = Math.sin(P.pitch);
      camM[0] = cyw; camM[2] = -syw;
      camM[4] = syw * spt; camM[5] = cpt; camM[6] = cyw * spt;
      camM[8] = syw * cpt; camM[9] = -spt; camM[10] = cyw * cpt;
      camM[12] = P.x; camM[13] = P.y + EYE; camM[14] = P.z;
      const view = mat4.invert(camM);
      const proj = mat4.perspective(1.12, W / H, 0.05, 400);
      const vp = mat4.multiply(proj, view);

      const labSky: [number,number,number] = [0.88, 0.90, 0.94];
      const moonSky: [number,number,number] = un.u_skyTop as [number,number,number];
      const sky = world === "LAB" ? labSky : moonSky;
      gl.clearColor(sky[0] * 0.5, sky[1] * 0.5, sky[2] * 0.55, 1);
      gl.clearStencil(0); gl.stencilMask(0xff);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

      gl.useProgram(prog);
      gl.uniform1f(u.time, t);
      gl.uniform3fv(u.sun, new Float32Array([0.42, 0.78, -0.3]));
      gl.uniform2fv(u.waveO, new Float32Array(waveO));
      gl.uniform1f(u.waveR, waveActive ? waveR : 1e9);
      gl.uniform1f(u.waveT, 10);
      const vtxN = Math.min(1, Math.log1p(fi.vtx) / Math.log1p(9.4e7));
      gl.uniform1f(u.vtxN, Math.max(0.1, vtxN));
      gl.uniform1f(u.cell, 2);
      gl.uniform1f(u.aqN, un.u_aq);

      const drawMesh = (m: Mesh, model: Mat4, VP: Mat4, isMoon: boolean, emis = 0) => {
        gl.uniformMatrix4fv(u.vp, false, VP);
        gl.uniformMatrix4fv(u.model, false, model);
        gl.uniform1i(u.isMoon, isMoon ? 1 : 0);
        gl.uniform1f(u.emis, emis);
        gl.bindVertexArray(m.vao);
        gl.drawArrays(gl.TRIANGLES, 0, m.n);
      };
      const setWorldUniforms = (isMoon: boolean) => {
        gl.uniform1f(u.pal, isMoon ? un.u_paletteLevels : 0);
        gl.uniform1f(u.lxN, isMoon ? Math.max(0.08, un.u_lx) : 0.9);
        gl.uniform1f(u.pxdN, isMoon ? un.u_pxd : 1);
        gl.uniform3fv(u.pl, new Float32Array(un.u_palette));
        gl.uniform3fv(u.fog, new Float32Array(isMoon ? moonSky : labSky));
      };
      const drawMoonScene = (VP: Mat4) => {
        setWorldUniforms(true);
        drawMesh(moonMesh, I, VP, true);
        for (const n of nodes) {
          if (n.taken) continue;
          const M = mat4.identity();
          M[12] = n.x; M[13] = groundAt(n.x, n.z, "MOON"); M[14] = n.z;
          gl.uniform1f(u.emis, n.kind === "CRYSTAL" ? 0.9 : 0.35);
          drawMesh(nodeMesh, M, VP, false, n.kind === "CRYSTAL" ? 1.1 : 0.4);
        }
        for (const m of placed) {
          const M = mat4.identity();
          M[12] = m.x; M[13] = groundAt(m.x, m.z, "MOON"); M[14] = m.z;
          drawMesh(m.kind === "PIXEL_CHIMNEY" ? chimneyMesh : solarMesh, M, VP, false,
            m.wired ? 0.3 : 0);
        }
        // plumes
        if (live > 0) {
          gl.useProgram(pprog);
          gl.uniformMatrix4fv(pu.vp, false, VP);
          gl.uniform1f(pu.time, t);
          gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, instData, 0, live * 6);
          gl.bindVertexArray(pvao);
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
          gl.depthMask(false);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, live);
          gl.depthMask(true); gl.disable(gl.BLEND);
          gl.useProgram(prog);
        }
      };
      const I = mat4.identity();

      if (world === "LAB") {
        /* portal: stencil the aperture, clear depth inside, draw the moon */
        gl.enable(gl.STENCIL_TEST);
        gl.colorMask(false, false, false, false); gl.depthMask(false);
        gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        setWorldUniforms(false);
        drawMesh(quad, I, vp, false);
        gl.colorMask(true, true, true, true); gl.depthMask(true);
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        // Co-located portal: the virtual camera IS the camera. Parallax
        // through the arch is correct for free, and walking through needs no
        // coordinate transform at all — only the physics rules change.
        drawMoonScene(vp);
        gl.disable(gl.STENCIL_TEST);
        setWorldUniforms(false);
        drawMesh(labMesh, I, vp, false);
        drawMesh(archMesh, I, vp, false, 0.2);
      } else {
        drawMoonScene(vp);
        // the arch seen from the moon: a warm rectangle of impossible quality
        gl.enable(gl.STENCIL_TEST);
        gl.colorMask(false, false, false, false); gl.depthMask(false);
        gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        drawMesh(quad, I, vp, false);
        gl.colorMask(true, true, true, true); gl.depthMask(true);
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        setWorldUniforms(false);
        drawMesh(labMesh, I, vp, false);
        gl.disable(gl.STENCIL_TEST);
        setWorldUniforms(true);
        drawMesh(archMesh, I, vp, false, 0.3);
      }

      /* ---- HUD model ----
       * Throttled to 20 Hz. Numeric read-outs do not benefit from 60 Hz and
       * re-rendering React every frame would cost more than the whole scene. */
      hudAcc += dt;
      if (hudAcc < 0.05) return;
      hudAcc = 0;
      const f = fidelityIndex(fi);
      setHud({
        fi: f, stage: stageOf(f),
        metrics: { pxd: fi.pxd, vtx: fi.vtx, lx: fi.lx, aq: fi.aq },
        rates: { pxd: placed.filter((m) => m.wired).length * 26, vtx: placed.filter((m) => m.wired).length * 2, lx: 6, aq: 1 },
        coherence, world, reticle,
        mineProgress: mining ? 1 - mining.hp / 3 : 0,
        hotbar, inventory: { ...inv },
        quest, locked: document.pointerLockElement === cv,
        waveActive, waveRadius: waveR, plumes: live,
        machines: placed.length,
      });
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu);
      cv.removeEventListener("mousedown", md); cv.removeEventListener("contextmenu", ctx);
      document.removeEventListener("pointerlockchange", plc);
    };
  }, [pushEvent]);

  useEffect(() => {
    if (!toasts.length) return;
    const id = setTimeout(() => setToasts((t) => t.slice(1)), 5200);
    return () => clearTimeout(id);
  }, [toasts]);

  return (
    <div className="fi-panel relative overflow-hidden border border-line bg-void">
      <canvas ref={canvas} className="block w-full cursor-crosshair"
        style={{ aspectRatio: "16/9" }} onClick={() => canvas.current?.requestPointerLock()} />
      {err && <pre className="mono absolute inset-0 overflow-auto bg-void/95 p-3 text-[10px] text-pxd">{err}</pre>}
      {hud && <SetmixHUD model={hud} toasts={toasts} audioOn={audioOn} onToggleAudio={toggleAudio} />}
      {!locked && !err && (
        <div className="absolute inset-0 flex items-center justify-center bg-void/75 backdrop-blur-sm">
          <div className="max-w-md px-6 text-center">
            <div className="mono text-[10px] tracking-[0.3em] text-dim uppercase">
              SetMix · playable vertical slice
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight">CLICK TO ENTER</div>
            <p className="mono mt-3 text-[11px] leading-relaxed text-dim">
              <span className="text-chalk">WASD</span> move ·{" "}
              <span className="text-chalk">MOUSE</span> look ·{" "}
              <span className="text-chalk">SPACE</span> jump ·{" "}
              <span className="text-chalk">SHIFT</span> sprint
              <br />
              <span className="text-chalk">LEFT-CLICK</span> extraction beam ·{" "}
              <span className="text-chalk">RIGHT-CLICK</span> place ·{" "}
              <span className="text-chalk">1–8</span> hotbar ·{" "}
              <span className="text-chalk">E</span> interact
              <br />
              <span className="text-chalk">ESC</span> release the cursor
            </p>
            <p className="mono mt-4 text-[10.5px] leading-relaxed text-dim/80">
              Walk through the archway. Mine the magenta crystals. Place a solar collector, then a
              pixel chimney, and watch the first resolution wave cross the crater floor.
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); toggleAudio(); }}
              className="mono mt-4 border border-line px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-dim uppercase hover:border-chalk/50 hover:text-chalk"
            >
              {audioOn ? "◉ audio on" : "○ enable procedural audio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
