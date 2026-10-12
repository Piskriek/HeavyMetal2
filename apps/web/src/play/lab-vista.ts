// The view from the lab window (docs/WINDOW_SCENE_PLAN.md): a planned 3D wasteland of the Bridge Array outside the lab's north window.
// It is its own scene, drawn first through the window's screen rectangle; the lab is then drawn over it after a depth clear, so the
// window frame and the walls still cover it. The lab camera and the vista share one coordinate frame (lab metres), so the parallax is real.
// The pure maths (pockets, bursts, progress, palettes) is in lab-vista-math.ts; this file is the scene, its layout and its shaders.
import * as THREE from 'three';
import { getGenSync, GEN, loadGen, type GenLevel } from '../assets/gen';
import {
  BASE_S, BURST_SECONDS, EGA16, MAX_POCKETS, POCKET_KINDS, burstLook, burstSchedule, clipRect, lookAt, mulberry32, polar,
  pocketFrame, pocketLifetime, type BurstEvent, type BurstLook, type VistaLook,
} from './lab-vista-math';

/** Full: the whole view. Lite: no curtains or pocket shells, half the dust. Static: the lab's flat storm plane (lab-room draws it). */
export type WindowView = 'static' | 'lite' | 'full';

/** The window in the lab frame: its outer face is at z `z` (the lab's north wall), its opening x0..x1 by y0..y1. */
export interface WindowRect { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly z: number }

/** A burst of static struck at (x, z), `t` seconds into the scene; `strength` 0..1. */
export interface FlashEvent { readonly x: number; readonly z: number; readonly strength: number; readonly t: number }

export interface LabVista {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly view: WindowView;
  /** The current light of the bursts, 0 to 0.7 (the lab's window light follows it; it never whites out). */
  readonly flashLight: number;
  readonly flash: { onFlash(cb: (e: FlashEvent) => void): () => void };
  setView(view: WindowView): void;
  setProgress(progress: number): void;
  /** Advances the clock (seconds since the lab opened): the wind, the pockets, the bursts. */
  update(now: number, dt: number): void;
  /** Draws the view inside the window's screen rectangle. `width`/`height` are the canvas's CSS size. Returns false when nothing was drawn. */
  render(renderer: THREE.WebGLRenderer, lab: THREE.PerspectiveCamera, width: number, height: number): boolean;
  /** Swaps the fallback boxes for the generated models that are loaded now. */
  adoptGenerated(): void;
  /** The draw calls and triangles of the view, counted from its visible objects. */
  stats(): { readonly drawCalls: number; readonly triangles: number; readonly dust: number };
  dispose(): void;
}

export interface LabVistaOptions {
  readonly view: WindowView;
  readonly window: WindowRect;
  readonly level: GenLevel;
}

// ---- The layout (lab metres; the vista sits beyond the north wall, at z below the window's z)
/** The spawn: the point the bearings are measured from (north is -z, east is +x). */
const SPAWN: readonly [number, number] = [-2.5, 1.0];
/** The distance from the spawn to the window's plane, metres (about 10). */
const WINDOW_DIST = 10;
/** The Breach: a third of the window from the left as seen from the spawn, about 1.2 km out (plan §3). */
const BREACH_BEARING = -2.5;
const BREACH_DIST = 1200;
const beyond = (bearing: number, w: number): readonly [number, number] => polar(SPAWN, bearing, WINDOW_DIST + w);
const BREACH = polar(SPAWN, BREACH_BEARING, BREACH_DIST);
/** The lab's north wall (the window's plane). */
const WALL_Z = -9;

/** Sizes the boxes use until a model is packed (metres: the assets' heights, plus a footprint). */
const FALLBACK: Readonly<Record<string, readonly [number, number, number]>> = {
  'datacentre-hall': [36, 9, 14],
  'chiller-block': [4, 3, 3],
  'shipping-container': [12, 2.6, 2.4],
  'pylon-tower': [6, 24, 6],
  'overpass-segment': [24, 9, 10],
  'rubble-slab': [6, 1.5, 5],
};
const FALLBACK_COLOUR: Readonly<Record<string, string>> = {
  'datacentre-hall': '#5b6670', 'chiller-block': '#9aa3a8', 'shipping-container': '#7a4a2e', 'pylon-tower': '#4d5358',
  'overpass-segment': '#77736c', 'rubble-slab': '#6f6a63',
};
/** The hero models (the vista class of assets). */
export const VISTA_ASSETS: readonly string[] = ['datacentre-hall', 'chiller-block', 'shipping-container', 'pylon-tower', 'overpass-segment', 'rubble-slab'];
/** The dressing that tumbles across the window (packed lab clutter) and the props that orbit the Breach. */
const CROSSWIND: readonly string[] = ['crate-small', 'cardboard-stack', 'toolbox', 'coolant-can', 'sample-case', 'old-monitor', 'filing-cabinet'];
const VORTEX: readonly string[] = ['server-rack', 'crate-large', 'shipping-container'];

/** Loads the vista's generated models at a level, behind the caller's loading bar. A model that fails stays a box. */
export async function preloadVista(level: GenLevel): Promise<void> {
  await Promise.all([...VISTA_ASSETS, ...CROSSWIND, ...VORTEX].map((id) => loadGen(id, level).catch(() => null)));
}

// ---- Pose helpers
const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const IDENTITY_Q = new THREE.Quaternion();
/** A placement: position, yaw (about y), pitch (x), roll (z), and a uniform scale. */
function pose(x: number, y: number, z: number, yaw = 0, pitch = 0, roll = 0, scale = 1): THREE.Matrix4 {
  tmpP.set(x, y, z);
  tmpQ.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  tmpS.set(scale, scale, scale);
  return new THREE.Matrix4().compose(tmpP, tmpQ, tmpS);
}
const at = (xz: readonly [number, number], y: number): [number, number, number] => [xz[0], y, xz[1]];

// ---- Shaders: the pocket patch (shared by every vista material that is standard-lit)
const EGA_GLSL = EGA16.map((c) => `vec3(${c.map((x) => x.toFixed(4)).join(', ')})`).join(', ');

/** The GLSL of the fidelity pockets. Mirrors `fidelityAt` and `pocketFrame` in lab-vista-math.ts. */
const POCKET_GLSL = /* glsl */ `
#define VISTA_POCKETS ${MAX_POCKETS}
uniform vec3 uPocketPos[VISTA_POCKETS];
uniform float uPocketRad[VISTA_POCKETS];
uniform vec4 uPocketS[VISTA_POCKETS];
uniform vec3 uPocketTint[VISTA_POCKETS];
uniform vec4 uBaseS;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uFlashPos;
uniform float uFlashAmt;
varying vec3 vVistaW;

// the fidelity at p: the storm base outside, the strongest pocket's S inside (soft over its last 15% of radius)
vec4 vistaFidelity(vec3 p, out vec3 tint) {
  vec4 s = uBaseS;
  tint = vec3(1.0);
  float best = 0.0;
  for (int i = 0; i < VISTA_POCKETS; i++) {
    float r = uPocketRad[i];
    if (r <= 0.0) continue;
    float d = length(p - uPocketPos[i]);
    float w = 1.0 - smoothstep(r * 0.85, r, d);
    if (w > best) {
      best = w;
      s = mix(uBaseS, uPocketS[i], w);
      tint = mix(vec3(1.0), uPocketTint[i], w);
    }
  }
  return s;
}

// Vtx: the world snapped to a grid of mix(1.5 m, 0, Vtx)
vec3 vistaSnap(vec3 p) {
  vec3 tint;
  vec4 s = vistaFidelity(p, tint);
  float g = 1.5 * (1.0 - clamp(s.y, 0.0, 1.0));
  if (g < 0.01) return p;
  return floor(p / g + 0.5) * g;
}
`;

const POCKET_FRAG_GLSL = /* glsl */ `
float vistaBayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  float m = 0.0;
  if (i < 0.5) m = 0.0; else if (i < 1.5) m = 8.0; else if (i < 2.5) m = 2.0; else if (i < 3.5) m = 10.0;
  else if (i < 4.5) m = 12.0; else if (i < 5.5) m = 4.0; else if (i < 6.5) m = 14.0; else if (i < 7.5) m = 6.0;
  else if (i < 8.5) m = 3.0; else if (i < 9.5) m = 11.0; else if (i < 10.5) m = 1.0; else if (i < 11.5) m = 9.0;
  else if (i < 12.5) m = 15.0; else if (i < 13.5) m = 7.0; else if (i < 14.5) m = 13.0; else m = 5.0;
  return (m + 0.5) / 16.0;
}
const vec3 VISTA_EGA[16] = vec3[16](${EGA_GLSL});
`;

/** Replaces the code after `#include <opaque_fragment>`: Lx, the flash, Pxd, Aq. `gl_FragColor` holds the lit colour on entry. */
const POCKET_FRAG_BODY = /* glsl */ `
{
  vec3 vTint;
  vec4 vS = vistaFidelity(vVistaW, vTint);
  vec3 vAlb = diffuseColor.rgb * vTint;
  vec3 vNg = normalize(cross(dFdx(vVistaW), dFdy(vVistaW)));
  float vNdl = abs(dot(vNg, uSunDir));
  vec3 vFlat = vAlb * (0.3 + 0.7 * vNdl);
  vec3 vUnlit = vAlb * 0.85;
  vec3 vPbr = gl_FragColor.rgb * vTint;
  float vLx = vS.z;
  vec3 vCol = vLx < 0.5 ? mix(vUnlit, vFlat, vLx * 2.0) : mix(vFlat, vPbr, (vLx - 0.5) * 2.0);
  vec3 vFd = vVistaW - uFlashPos;
  float vFall = 1.0 / (1.0 + dot(vFd, vFd) / 3600.0);
  vCol += vAlb * vec3(0.8, 0.95, 1.0) * uFlashAmt * vFall;
  float vP = vS.x;
  if (vP < 0.75) {
    vec3 sCol = pow(max(vCol, vec3(0.0)), vec3(1.0 / 2.2));
    if (vP < 0.125) {
      float lum = dot(sCol, vec3(0.299, 0.587, 0.114));
      float bit = step(vistaBayer(gl_FragCoord.xy * 0.5), lum);
      sCol = mix(vec3(0.03), vec3(0.94), bit);
    } else if (vP < 0.375) {
      float best = 1e9;
      vec3 bc = sCol;
      for (int i = 0; i < 16; i++) {
        vec3 dd = sCol - VISTA_EGA[i];
        float dsq = dot(dd, dd);
        if (dsq < best) { best = dsq; bc = VISTA_EGA[i]; }
      }
      sCol = bc;
    } else {
      sCol = floor(clamp(sCol, 0.0, 1.0) * vec3(7.0, 7.0, 3.0) + 0.5) / vec3(7.0, 7.0, 3.0);
    }
    vCol = pow(sCol, vec3(2.2));
  }
  float vAq = vS.w;
  vec3 vWet = vCol * vec3(0.4, 0.92, 0.95) + vec3(0.0, 0.03, 0.05);
  float vCaus = 0.5 + 0.5 * sin(vVistaW.x * 0.9 + uTime * 1.3) * sin(vVistaW.z * 0.7 - uTime * 1.1);
  vWet += vec3(0.05, 0.12, 0.14) * vCaus;
  vCol = mix(vCol, vWet, vAq);
  gl_FragColor = vec4(vCol, diffuseColor.a);
}
`;

/** Replaces the projection: the world position is snapped (Vtx), then projected. */
const PROJECT_REPLACEMENT = /* glsl */ `
#include <project_vertex>
{
  vec4 vW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  vW = instanceMatrix * vW;
#endif
  vW = modelMatrix * vW;
  vVistaW = vistaSnap(vW.xyz);
  gl_Position = projectionMatrix * viewMatrix * vec4(vVistaW, 1.0);
}
`;

/** The uniforms every pocket-patched material shares (the same objects, so one update reaches them all). */
interface Shared {
  readonly uPocketPos: THREE.IUniform<THREE.Vector3[]>;
  readonly uPocketRad: THREE.IUniform<number[]>;
  readonly uPocketS: THREE.IUniform<THREE.Vector4[]>;
  readonly uPocketTint: THREE.IUniform<THREE.Vector3[]>;
  readonly uBaseS: THREE.IUniform<THREE.Vector4>;
  readonly uTime: THREE.IUniform<number>;
  readonly uSunDir: THREE.IUniform<THREE.Vector3>;
  readonly uFlashPos: THREE.IUniform<THREE.Vector3>;
  readonly uFlashAmt: THREE.IUniform<number>;
}

function makeShared(): Shared {
  return {
    uPocketPos: { value: Array.from({ length: MAX_POCKETS }, () => new THREE.Vector3()) },
    uPocketRad: { value: new Array<number>(MAX_POCKETS).fill(0) },
    uPocketS: { value: Array.from({ length: MAX_POCKETS }, () => new THREE.Vector4()) },
    uPocketTint: { value: Array.from({ length: MAX_POCKETS }, () => new THREE.Vector3(1, 1, 1)) },
    uBaseS: { value: new THREE.Vector4(...BASE_S) },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() },
    uFlashPos: { value: new THREE.Vector3() },
    uFlashAmt: { value: 0 },
  };
}

/** Patches a standard-lit material with the pocket shading. Other materials are left as they are. */
function patchMaterial(mat: THREE.Material, shared: Shared): void {
  if (!(mat instanceof THREE.MeshStandardMaterial)) return;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${POCKET_GLSL}\nvoid main() {`)
      .replace('#include <project_vertex>', PROJECT_REPLACEMENT);
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${POCKET_GLSL}\n${POCKET_FRAG_GLSL}\nvoid main() {`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${POCKET_FRAG_BODY}`);
  };
  mat.customProgramCacheKey = () => 'vista-pocket-v1';
  mat.needsUpdate = true;
}

// ---- Shaders: the sky, the Breach, the curtains, the motes, the shells, the bursts
const NOISE_GLSL = /* glsl */ `
float vh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vh(i), vh(i + vec2(1.0, 0.0)), u.x), mix(vh(i + vec2(0.0, 1.0)), vh(i + vec2(1.0, 1.0)), u.x), u.y);
}
float vfbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
const SKY_FRAG = /* glsl */ `
uniform float uDusk, uGlow, uFlash, uTime;
uniform vec3 uBreachDir, uFlashDir;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 stormHorizon = vec3(0.13, 0.12, 0.15), stormZenith = vec3(0.025, 0.025, 0.04);
  vec3 duskHorizon = vec3(0.92, 0.52, 0.30), duskZenith = vec3(0.17, 0.18, 0.32);
  vec3 col = mix(mix(stormHorizon, duskHorizon, uDusk), mix(stormZenith, duskZenith, uDusk), pow(up, 0.6));
  vec2 cuv = d.xz / (d.y + 0.12) * 0.9 + vec2(uTime * 0.012, 0.0);
  float cl = smoothstep(0.42, 0.78, vfbm(cuv * 1.6));
  col = mix(col, col * 0.55 + vec3(0.05, 0.05, 0.07), cl * (1.0 - uDusk * 0.5) * 0.8);
  float glow = pow(max(dot(d, normalize(uBreachDir)), 0.0), 90.0);
  col += vec3(0.35, 0.85, 1.0) * glow * uGlow * 0.6;
  float fl = pow(max(dot(d, normalize(uFlashDir)), 0.0), 6.0);
  col += vec3(0.8, 0.95, 1.0) * fl * uFlash * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

const BREACH_VERT = /* glsl */ `
uniform float uTime, uH;
varying vec3 vP;
varying float vY;
float bh(float n) { return fract(sin(n * 91.345) * 47453.5453); }
void main() {
  vec3 p = position;
  p.y *= uH;
  float slice = floor(p.y / 14.0 + uTime * 0.7);
  float jolt = step(0.82, bh(slice)) * (bh(slice + 3.1) - 0.5) * 18.0;
  p.x += jolt;
  vP = p;
  vY = p.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const BREACH_FRAG = /* glsl */ `
uniform float uTime, uGlow;
varying vec3 vP;
varying float vY;
void main() {
  float bands = step(0.5, fract(vY / 18.0 - uTime * 0.9));
  float n = fract(sin(dot(floor(vP.xz * 0.25 + vec2(vY * 0.1, uTime)), vec2(12.9, 78.2))) * 43758.5);
  vec3 c = mix(vec3(0.22, 0.66, 0.86), vec3(0.92, 1.0, 1.0), bands * 0.6 + n * 0.4);
  gl_FragColor = vec4(c * (0.35 + uGlow * 0.9), 1.0);
}
`;

const CURTAIN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const CURTAIN_FRAG = /* glsl */ `
uniform float uTime, uDust, uOpacity;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  float n = vfbm(vec2(vUv.x * 5.0 + uTime * 0.02, vUv.y * 2.0));
  float a = smoothstep(0.45, 0.8, n) * (1.0 - vUv.y * 0.7) * uDust * uOpacity;
  gl_FragColor = vec4(vec3(0.52, 0.47, 0.40), a);
}
`;

const MOTE_VERT = /* glsl */ `
attribute vec4 aSeed;
attribute float aSize;
uniform float uTime, uDust;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  float t = uTime * (0.6 + aSeed.w);
  vec3 p = aSeed.xyz;
  p.x = mod(p.x + t * 6.0 + 80.0, 160.0) - 80.0;
  p.y += sin(t * 0.7 + aSeed.w * 6.28) * 0.6;
  p.z += cos(t * 0.5 + aSeed.x) * 0.8;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * aSize;
  vA = uDust;
  gl_Position = projectionMatrix * mv;
}
`;
const MOTE_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vA;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.4, 1.0, r)) * vA * 0.35;
  gl_FragColor = vec4(vec3(0.66, 0.6, 0.5), a);
}
`;

const SHELL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vY;
varying vec3 vCol;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vY = wp.y;
  vCol = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SHELL_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying float vY;
varying vec3 vCol;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  float scan = 0.5 + 0.5 * sin(vY * 3.0 + uTime * 6.0);
  vec3 c = vCol * (0.8 + 0.2 * scan) + vec3(0.5, 1.0, 1.0) * rim * 0.7;
  gl_FragColor = vec4(c, 1.0);
}
`;

const BURST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BURST_FRAG = /* glsl */ `
uniform float uTime, uAlpha;
varying vec2 vUv;
float bh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float n = bh(floor(vUv * 120.0) + floor(uTime * 40.0));
  gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * n, uAlpha * step(0.35, n));
}
`;

// ---- The parts of a set: a generated model's meshes (shared geometry), or a box we own
interface Part { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material; readonly local: THREE.Matrix4; readonly owned: boolean }
/** One model, drawn as one InstancedMesh per part (so the draw calls stay few). Dynamic sets are rewritten every frame. */
interface VistaSet {
  readonly key: string;
  readonly id: string;
  readonly poses: THREE.Matrix4[];
  readonly dynamic: boolean;
  parts: Part[];
  meshes: THREE.InstancedMesh[];
  source: 'gen' | 'box';
}

/** The parts of a model: its generated meshes at the level (their materials cloned and patched), else a box of its size. */
function partsOf(id: string, level: GenLevel, shared: Shared): { parts: Part[]; source: 'gen' | 'box' } {
  const gen = getGenSync(id, level);
  if (gen) {
    gen.updateMatrixWorld(true);
    const parts: Part[] = [];
    gen.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      const src = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!src) return;
      const local = new THREE.Matrix4();
      for (let node: THREE.Object3D | null = m; node && node !== gen; node = node.parent) local.premultiply(node.matrix);
      const material = src.clone();
      patchMaterial(material, shared);
      parts.push({ geometry: m.geometry, material, local, owned: false });
    });
    if (parts.length) return { parts, source: 'gen' };
  }
  const size = FALLBACK[id] ?? (GEN[id]?.size as readonly [number, number, number] | undefined) ?? [1, 1, 1];
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  geometry.translate(0, size[1] / 2, 0);
  const material = new THREE.MeshStandardMaterial({ color: FALLBACK_COLOUR[id] ?? '#7a7570', roughness: 0.85, metalness: 0.05 });
  patchMaterial(material, shared);
  return { parts: [{ geometry, material, local: new THREE.Matrix4(), owned: true }], source: 'box' };
}

function freeParts(parts: readonly Part[]): void {
  for (const p of parts) {
    p.material.dispose();
    if (p.owned) p.geometry.dispose();
  }
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The ground's crack texture: a seeded Voronoi of dust cells with dark cracks along their edges. It tiles. */
function crackTexture(seed: number): THREE.DataTexture {
  const N = 128, cells = 7;
  const r = mulberry32(seed);
  const pts: [number, number][] = Array.from({ length: cells * cells }, (_, i) => [((i % cells) + r()) / cells, (Math.floor(i / cells) + r()) / cells]);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      let d1 = 9, d2 = 9;
      for (const [px, py] of pts) {
        for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
          const d = Math.hypot(px + ox - u, py + oy - v);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      }
      const crack = 1 - Math.min(1, (d2 - d1) / 0.02);
      const base = (0.5 + 0.1 * d1) * (0.86 + 0.14 * r()) * (1 - 0.55 * crack);
      const i = (y * N + x) * 4;
      data[i] = Math.round(255 * Math.min(1, base * 1.05));
      data[i + 1] = Math.round(255 * Math.min(1, base));
      data[i + 2] = Math.round(255 * Math.min(1, base * 0.92));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createLabVista(o: LabVistaOptions): LabVista {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 9000);
  const shared = makeShared();
  const level = o.level;
  let view: WindowView = o.view;
  let progress = 0;
  let look: VistaLook;
  let clock = 0;
  let activeBurst: { event: BurstEvent; look: BurstLook } | null = null;
  let flashLight = 0;
  const listeners = new Set<(e: FlashEvent) => void>();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };

  // ---- Lights: a cold hemisphere, and the Breach as the key light (cyan-white) that rim-lights the silhouettes
  scene.add(new THREE.HemisphereLight('#7d8594', '#2b2622', 0.55));
  const sunDir = new THREE.Vector3(BREACH[0] - SPAWN[0], 260, BREACH[1] - SPAWN[1]).normalize();
  const key = new THREE.DirectionalLight('#bfe9ff', 0.9);
  key.position.copy(sunDir).multiplyScalar(400);
  key.target.position.set(SPAWN[0], 0, SPAWN[1]);
  scene.add(key, key.target);
  shared.uSunDir.value = sunDir.clone();
  scene.fog = new THREE.FogExp2('#4e4a52', 0.00072);

  // ---- The sky: a dome that follows the camera (infinitely far), drawn first, with no depth
  const skyU = {
    uTime: { value: 0 }, uDusk: { value: 0 }, uGlow: { value: 1 }, uFlash: { value: 0 },
    uBreachDir: { value: sunDir.clone() }, uFlashDir: { value: new THREE.Vector3(0, 1, 0) },
  };
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(4500, 32, 16)), keep(new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, side: THREE.BackSide, depthWrite: false, toneMapped: false,
  })));
  sky.renderOrder = -10;
  scene.add(sky);

  // ---- Ground: cracked dust over low-poly land that rises far away. The apron is the concrete the lab stands on.
  const GROUND = 3000, GRID = 60;
  // one crack texture, two tilings: the plain repeats every 24 m across 6 km, the apron every 8 m across its 80 m
  const crack = keep(crackTexture(1234));
  const groundTex = keep(crack.clone());
  groundTex.repeat.set((GROUND * 2) / 24, (GROUND * 2) / 24);
  const apronTex = keep(crack.clone());
  apronTex.repeat.set(10, 5);
  groundTex.needsUpdate = apronTex.needsUpdate = true;
  const groundMat = keep(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.92, metalness: 0, color: '#5f5a53' }));
  const apronMat = keep(new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.8, metalness: 0, color: '#6e6a63' }));
  patchMaterial(groundMat, shared);
  patchMaterial(apronMat, shared);
  const groundGeo = keep(new THREE.PlaneGeometry(GROUND * 2, GROUND * 2, GRID, GRID));
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(SPAWN[0], -0.25, SPAWN[1]);
  {
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const dist = Math.hypot(x - SPAWN[0], z - SPAWN[1]);
      const rise = smooth(260, 1400, dist) * (9 + 14 * (0.5 + 0.5 * Math.sin(x * 0.0036 + 1.3) * Math.cos(z * 0.0029)));
      pos.setY(i, -0.25 + rise);
    }
    groundGeo.computeVertexNormals();
  }
  scene.add(new THREE.Mesh(groundGeo, groundMat));
  const apronGeo = keep(new THREE.BoxGeometry(80, 0.4, 40));
  apronGeo.translate(0, -0.2, WALL_Z - 20);
  scene.add(new THREE.Mesh(apronGeo, apronMat));

  // ---- Square bollards and posts on the apron: one instanced box (plan §4, L0)
  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const boxMat = keep(new THREE.MeshStandardMaterial({ color: '#77716a', roughness: 0.8, metalness: 0.1 }));
  patchMaterial(boxMat, shared);
  const posts: { x: number; z: number; w: number; h: number }[] = [
    { x: -12, z: WALL_Z - 6, w: 0.6, h: 1.1 }, { x: -8, z: WALL_Z - 6, w: 0.6, h: 1.1 }, { x: 8, z: WALL_Z - 7, w: 0.6, h: 1.1 },
    { x: 12, z: WALL_Z - 9, w: 0.6, h: 1.1 }, { x: 4, z: WALL_Z - 12, w: 0.6, h: 1.1 }, { x: -4, z: WALL_Z - 14, w: 0.6, h: 1.1 },
    { x: -15, z: WALL_Z - 3.5, w: 0.25, h: 2.4 }, { x: -15, z: WALL_Z - 9.5, w: 0.25, h: 2.4 }, { x: 15, z: WALL_Z - 4, w: 0.25, h: 2.4 }, { x: 15, z: WALL_Z - 12, w: 0.25, h: 2.4 },
  ];
  const postMesh = new THREE.InstancedMesh(boxGeo, boxMat, posts.length);
  posts.forEach((p, i) => {
    tmpP.set(p.x, p.h / 2, p.z);
    tmpS.set(p.w, p.h, p.w);
    postMesh.setMatrixAt(i, tmpM.compose(tmpP, IDENTITY_Q, tmpS));
  });
  postMesh.frustumCulled = false;
  scene.add(postMesh);

  // ---- The ridge: a silhouette of hills across the far plain (plan §4, L3)
  {
    const shape = new THREE.Shape();
    shape.moveTo(-4500, -10);
    for (let x = -4500; x <= 4500; x += 150) shape.lineTo(x, 40 + 110 * (0.5 + 0.5 * Math.sin(x * 0.0021) * Math.cos(x * 0.0007 + 0.4)));
    shape.lineTo(4500, -10);
    shape.closePath();
    const m = keep(new THREE.MeshStandardMaterial({ color: '#2c2a33', roughness: 1, metalness: 0 }));
    patchMaterial(m, shared);
    const ridge = new THREE.Mesh(keep(new THREE.ShapeGeometry(shape)), m);
    ridge.position.set(0, 0, WALL_Z - 1800);
    scene.add(ridge);
  }

  // ---- The Breach: a square column, glitch-sliced, that rises from the split main hall into the clouds
  const breachU = { uTime: { value: 0 }, uH: { value: 1 }, uGlow: { value: 1 } };
  const breachGeo = keep(new THREE.BoxGeometry(150, 900, 150));
  breachGeo.translate(0, 450, 0);
  const breach = new THREE.Mesh(breachGeo, keep(new THREE.ShaderMaterial({
    vertexShader: BREACH_VERT, fragmentShader: BREACH_FRAG, uniforms: breachU, toneMapped: false,
  })));
  breach.position.set(BREACH[0], 0, BREACH[1]);
  scene.add(breach);

  // ---- The sets: each model's instances, one InstancedMesh per part
  const sets: VistaSet[] = [];
  const buildMeshes = (s: VistaSet): void => {
    for (const m of s.meshes) { scene.remove(m); m.dispose(); }
    s.meshes = s.parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, Math.max(1, s.poses.length));
      im.count = s.poses.length;
      im.frustumCulled = false;
      scene.add(im);
      return im;
    });
    flushSet(s);
  };
  const flushSet = (s: VistaSet): void => {
    s.meshes.forEach((im, k) => {
      const part = s.parts[k]!;
      for (let i = 0; i < s.poses.length; i++) im.setMatrixAt(i, tmpM.multiplyMatrices(s.poses[i]!, part.local));
      im.instanceMatrix.needsUpdate = true;
    });
  };
  const addSet = (key: string, id: string, poses: THREE.Matrix4[], dynamic: boolean): VistaSet => {
    const { parts, source } = partsOf(id, level, shared);
    const s: VistaSet = { key, id, poses, dynamic, parts, meshes: [], source };
    sets.push(s);
    buildMeshes(s);
    return s;
  };

  // hero placements (plan §4). Bearings and distances are from the spawn; `w` is the distance beyond the window.
  const hero: Record<string, THREE.Matrix4[]> = { 'datacentre-hall': [], 'chiller-block': [], 'shipping-container': [], 'pylon-tower': [], 'overpass-segment': [], 'rubble-slab': [] };
  // L0 the apron (3 to 25 m beyond the window): a container lying tilted, two slabs, a chiller knocked on its side
  hero['shipping-container']!.push(pose(...at(beyond(12, 9), 0), (12 * Math.PI) / 180, 0, 0.09));
  hero['rubble-slab']!.push(pose(...at(beyond(-8, 14), 0), -0.4));
  hero['rubble-slab']!.push(pose(...at(beyond(22, 20), 0), 1.1));
  hero['chiller-block']!.push(pose(...at(beyond(-18, 12), 1.35), 0.3, 0, 1.45));
  // L1 the near field (30 to 120 m): a two-high container stack, three slabs
  hero['shipping-container']!.push(pose(...at(beyond(26, 62), 0), 0.05));
  hero['shipping-container']!.push(pose(...at(beyond(26, 62), 2.6), 0.05));
  hero['rubble-slab']!.push(pose(...at(beyond(-4, 40), 0), 0.7));
  hero['rubble-slab']!.push(pose(...at(beyond(40, 70), 0), -0.2));
  hero['rubble-slab']!.push(pose(...at(beyond(10, 95), 0), 2.2));
  // L2 the farm (150 to 500 m): two rows of halls, a chiller at each one's side
  for (const [b, w] of [[-22, 190], [-2, 170], [22, 200], [-10, 330], [12, 300], [34, 360]] as const) {
    hero['datacentre-hall']!.push(pose(...at(beyond(b, w), 0), (b * Math.PI) / 180 * 0.2));
    hero['chiller-block']!.push(pose(...at(beyond(b, w - 24), 0), 0.1));
  }
  // the overpass: four spans marching from the left toward the Breach, with gaps
  const overStart = beyond(-22, 240);
  for (let i = 0; i < 4; i++) {
    const t = 0.1 + i * 0.12;
    const x = overStart[0] + (BREACH[0] - overStart[0]) * t, z = overStart[1] + (BREACH[1] - overStart[1]) * t;
    hero['overpass-segment']!.push(pose(x, 0, z, Math.atan2(-(BREACH[1] - overStart[1]), BREACH[0] - overStart[0])));
  }
  // the pylon line: from near-right (60 m) diagonally to the Breach
  const pylonStart = beyond(36, 60);
  for (const t of [0, 0.12, 0.26, 0.42, 0.6, 0.8]) {
    const x = pylonStart[0] + (BREACH[0] - pylonStart[0]) * t, z = pylonStart[1] + (BREACH[1] - pylonStart[1]) * t;
    hero['pylon-tower']!.push(pose(x, 0, z));
  }
  // L3 the Breach (600 to 2000 m): the main hall the column rises from, and far silhouettes
  hero['datacentre-hall']!.push(pose(BREACH[0], 0, BREACH[1], 0.1));
  for (const [b, w, s] of [[-20, 900, 1.8], [8, 1100, 1.6], [16, 1400, 1.9]] as const) {
    const [x, z] = beyond(b, w);
    hero['datacentre-hall']!.push(pose(x, 0, z, 0.02, 0, 0, s));
  }
  for (const [id, poses] of Object.entries(hero)) if (poses.length) addSet(`hero:${id}`, id, poses, false);

  // the crosswind stream: three of each prop tumble across the lanes 14 to 60 m beyond the window (plan §7)
  const crosswind: { set: VistaSet; slot: number; lane: number }[] = [];
  CROSSWIND.forEach((id, k) => {
    const set = addSet(`wind:${id}`, id, Array.from({ length: 3 }, () => new THREE.Matrix4()), true);
    for (let j = 0; j < 3; j++) crosswind.push({ set, slot: j, lane: k * 3 + j });
  });
  // the Breach vortex: containers, racks and crates orbit the column on a slow helix, 300 to 600 m out (plan §7)
  const vortex: { set: VistaSet; slot: number }[] = [];
  VORTEX.forEach((id, k) => {
    const set = addSet(`vortex:${id}`, id, Array.from({ length: 4 }, () => new THREE.Matrix4()), true);
    for (let j = 0; j < 4; j++) vortex.push({ set, slot: j + k * 4 });
  });

  // ---- The pocket shells: one instanced sphere; back faces show the pocket's sky, the rim is scanned static (plan §5)
  const shellMat = keep(new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, uniforms: { uTime: { value: 0 } }, side: THREE.BackSide,
  }));
  const shells = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(1, 40, 24)), shellMat, MAX_POCKETS);
  shells.frustumCulled = false;
  const SKY_COLOURS = POCKET_KINDS.map((k) => new THREE.Color(...k.sky));
  for (let i = 0; i < MAX_POCKETS; i++) shells.setColorAt(i, SKY_COLOURS[0]!);
  scene.add(shells);

  // ---- The dust: 900 motes, advected on the GPU (one draw call); the lite view draws half
  const MOTES = 900;
  const quad = new THREE.PlaneGeometry(1, 1);
  const moteGeo = keep(new THREE.InstancedBufferGeometry());
  moteGeo.setIndex(quad.index);
  moteGeo.setAttribute('position', quad.attributes.position!);
  moteGeo.setAttribute('uv', quad.attributes.uv!);
  quad.dispose();
  const seedArr = new Float32Array(MOTES * 4), sizeArr = new Float32Array(MOTES);
  {
    const r = mulberry32(0xd057);
    for (let i = 0; i < MOTES; i++) {
      const band = i % 3;
      seedArr[i * 4] = (r() * 2 - 1) * 70;
      seedArr[i * 4 + 1] = 0.5 + r() * 9;
      seedArr[i * 4 + 2] = WALL_Z - 4 - [6, 26, 60][band]! * (0.6 + r());
      seedArr[i * 4 + 3] = r();
      sizeArr[i] = [0.18, 0.3, 0.55][band]! * (0.7 + 0.6 * r());
    }
  }
  moteGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArr, 4));
  moteGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizeArr, 1));
  moteGeo.instanceCount = MOTES;
  const moteU = { uTime: { value: 0 }, uDust: { value: 1 } };
  const motes = new THREE.Mesh(moteGeo, keep(new THREE.ShaderMaterial({
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, uniforms: moteU, transparent: true, depthWrite: false,
  })));
  motes.frustumCulled = false;
  motes.renderOrder = 5;
  scene.add(motes);

  // ---- The curtains: three big planes at 45, 200 and 700 m (depth cues), and the ground drift near the horizon
  const curtainU = { uTime: { value: 0 }, uDust: { value: 1 }, uOpacity: { value: 0.6 } };
  const curtainMat = keep(new THREE.ShaderMaterial({
    vertexShader: CURTAIN_VERT, fragmentShader: CURTAIN_FRAG, uniforms: curtainU, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  const curtains = new THREE.Group();
  for (const dist of [45, 200, 700]) {
    const p = new THREE.Mesh(keep(new THREE.PlaneGeometry(1800, 150 + dist * 0.12)), curtainMat);
    p.position.set(0, 40 + dist * 0.06, WALL_Z - dist);
    p.renderOrder = 4;
    curtains.add(p);
  }
  const drift = new THREE.Mesh(keep(new THREE.PlaneGeometry(2600, 26)), curtainMat);
  drift.position.set(0, 8, WALL_Z - 260);
  drift.renderOrder = 4;
  curtains.add(drift);
  scene.add(curtains);

  // ---- The bursts: a jagged bolt (a ribbon), the burst shell, and the ring on the plain
  const BOLT_STEPS = 15;
  const boltGeo = keep(new THREE.BufferGeometry());
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((BOLT_STEPS + 1) * 2 * 3), 3));
  const boltIndex: number[] = [];
  for (let i = 0; i < BOLT_STEPS; i++) boltIndex.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  boltGeo.setIndex(boltIndex);
  const bolt = new THREE.Mesh(boltGeo, keep(new THREE.MeshBasicMaterial({ color: '#dff7ff', side: THREE.DoubleSide, transparent: true, toneMapped: false, depthWrite: false })));
  bolt.visible = false;
  scene.add(bolt);
  const burstMat = keep(new THREE.ShaderMaterial({
    vertexShader: BURST_VERT, fragmentShader: BURST_FRAG, uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
  }));
  const burstMesh = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 20, 12)), burstMat);
  burstMesh.visible = false;
  scene.add(burstMesh);
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: '#bff2ff', transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.85, 1, 48)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  /** Strikes the bolt: its zig-zag is seeded by the event's time, so every strike of one schedule repeats. */
  const strikeBolt = (e: BurstEvent): void => {
    const r = mulberry32(Math.floor(e.t * 1000) + 17);
    const pos = boltGeo.attributes.position as THREE.BufferAttribute;
    const top = 900, halfW = 6 + 4 * e.strength;
    for (let i = 0; i <= BOLT_STEPS; i++) {
      const f = i / BOLT_STEPS;
      const y = top * (1 - f);
      const x = e.x + (r() * 2 - 1) * 26 * (1 - f) + (i % 2 === 0 ? 0 : 6);
      pos.setXYZ(i * 2, x - halfW, y, e.z);
      pos.setXYZ(i * 2 + 1, x + halfW, y, e.z);
    }
    pos.needsUpdate = true;
    boltGeo.computeBoundingSphere();
  };

  /** Pockets collapse in a small burst where they stood (plan §5, §6); the strength is small so it reads as a flicker. */
  const lastCycle = Array.from({ length: MAX_POCKETS }, (_, i) => Math.floor(0 / pocketLifetime(i)));

  /** The flying props: the crosswind tumbles left to right, the vortex orbits. A nearby burst pushes the props it reaches. */
  const updateFlyers = (t: number): void => {
    for (const f of crosswind) {
      const speed = 5 + (f.lane % 5);
      const phase = ((t * speed) / 110 + f.lane * 0.173) % 1;
      let px = -40 + phase * 110;
      let py = 1.2 + ((f.lane * 0.37) % 1) * 3.5;
      const pz = WALL_Z - 14 - (f.lane % 7) * 9;
      if (activeBurst && activeBurst.look.burst > 0) {
        const dx = px - activeBurst.event.x, dz = pz - activeBurst.event.z;
        const d = Math.hypot(dx, dz);
        if (d < 90) {
          const k = (1 - (t - activeBurst.event.t) / BURST_SECONDS) * 4 * activeBurst.event.strength;
          px += (dx / (d || 1)) * k;
          py += k * 0.7;
        }
      }
      tmpQ.setFromEuler(new THREE.Euler(t * 1.4 + f.lane, t * 0.9 + f.lane * 0.3, t * 0.5, 'YXZ'));
      f.set.poses[f.slot]!.compose(tmpP.set(px, py, pz), tmpQ, tmpS.set(1, 1, 1));
    }
    for (const v of vortex) {
      const R = 300 + (v.slot % 4) * 90;
      const th = t * (0.012 + 0.004 * (v.slot % 3)) + v.slot * 1.7;
      const y = 60 + 120 * ((t * 0.02 + v.slot * 0.13) % 1);
      tmpQ.setFromEuler(new THREE.Euler(t * 0.3 + v.slot, th, 0, 'YXZ'));
      v.set.poses[v.slot % 4]!.compose(tmpP.set(BREACH[0] + R * Math.cos(th), y, BREACH[1] + R * Math.sin(th)), tmpQ, tmpS.set(1, 1, 1));
    }
    for (const s of sets) if (s.dynamic) flushSet(s);
  };

  /** The generated models replace their boxes once they are loaded (behind the loading bar, see preloadVista). */
  const adoptGenerated = (): void => {
    for (const s of sets) {
      if (s.source === 'gen' || !getGenSync(s.id, level)) continue;
      for (const m of s.meshes) { scene.remove(m); m.dispose(); }
      freeParts(s.parts);
      const next = partsOf(s.id, level, shared);
      s.parts = next.parts;
      s.source = next.source;
      buildMeshes(s);
    }
  };

  /** The view's settings: lite drops the curtains and the shells and halves the dust. Static hides the whole vista. */
  const applyView = (): void => {
    scene.visible = view !== 'static';
    curtains.visible = view === 'full';
    shells.visible = view === 'full';
    moteGeo.instanceCount = view === 'full' ? MOTES : Math.floor(MOTES / 2);
  };

  const setProgress = (p: number): void => {
    progress = Math.max(0, Math.min(1, p));
    look = lookAt(progress);
    breachU.uH.value = look.breachHeight;
    breachU.uGlow.value = look.breachGlow;
    skyU.uDusk.value = look.dusk;
    skyU.uGlow.value = look.breachGlow;
    curtainU.uDust.value = look.dust;
    moteU.uDust.value = look.dust;
    const b = look.baseS;
    shared.uBaseS.value.set(b[0], b[1], b[2], b[3]);
  };

  const schedule = burstSchedule(0xb7a5, BREACH[0], BREACH[1]);

  const update = (t: number, _dt: number): void => {
    const prev = clock;
    clock = t;
    shared.uTime.value = t;
    breachU.uTime.value = t;
    moteU.uTime.value = t;
    curtainU.uTime.value = t;
    skyU.uTime.value = t;
    shellMat.uniforms.uTime!.value = t;
    burstMat.uniforms.uTime!.value = t;
    if (view === 'static') { flashLight = 0; return; }

    // the scheduled bursts that fell due since the last frame, and a small flicker where a pocket's cycle turns over
    for (const e of schedule.eventsBetween(prev, t, progress)) {
      strikeBolt(e);
      activeBurst = { event: e, look: burstLook(0, e.strength) };
      for (const cb of listeners) cb({ x: e.x, z: e.z, strength: e.strength, t: e.t });
    }
    for (let i = 0; i < MAX_POCKETS; i++) {
      const cycle = Math.floor(t / pocketLifetime(i));
      if (cycle > lastCycle[i]!) {
        lastCycle[i] = cycle;
        const where = pocketFrame(i, Math.max(0, t - 0.05), look.pocketScale);
        const e: BurstEvent = { t, x: where.centre[0], z: where.centre[2], strength: 0.3 };
        strikeBolt(e);
        activeBurst = { event: e, look: burstLook(0, e.strength) };
      }
    }
    if (activeBurst) {
      const age = t - activeBurst.event.t;
      if (age > BURST_SECONDS) activeBurst = null;
      else activeBurst.look = burstLook(age, activeBurst.event.strength);
    }
    const bl = activeBurst?.look ?? burstLook(-1, 0);
    flashLight = bl.light;
    shared.uFlashAmt.value = bl.light;
    if (activeBurst) {
      const e = activeBurst.event;
      shared.uFlashPos.value.set(e.x, 40, e.z);
      skyU.uFlash.value = bl.light;
      skyU.uFlashDir.value.set(e.x - SPAWN[0], 300, e.z - SPAWN[1]).normalize();
      bolt.visible = bl.bolt > 0;
      burstMesh.visible = bl.burst > 0;
      burstMesh.position.set(e.x, 40, e.z);
      burstMesh.scale.setScalar(4 + 60 * bl.burst);
      burstMat.uniforms.uAlpha!.value = bl.burstAlpha * 0.9;
      ring.visible = true;
      ring.position.set(e.x, 0.1, e.z);
      ring.scale.setScalar(4 + 90 * bl.ring);
      ringMat.opacity = 0.85 * (1 - bl.ring);
    } else {
      skyU.uFlash.value = 0;
      bolt.visible = false;
      burstMesh.visible = false;
      ring.visible = false;
    }

    // the pockets: centres, radii and kinds into the shared uniforms, and their shells
    for (let i = 0; i < MAX_POCKETS; i++) {
      const pf = pocketFrame(i, t, look.pocketScale);
      const kind = POCKET_KINDS[pf.kind]!;
      shared.uPocketPos.value[i]!.set(pf.centre[0], pf.centre[1], pf.centre[2]);
      shared.uPocketRad.value[i] = pf.radius;
      shared.uPocketS.value[i]!.set(kind.s[0], kind.s[1], kind.s[2], kind.s[3]);
      shared.uPocketTint.value[i]!.set(kind.tint[0], kind.tint[1], kind.tint[2]);
      const sc = Math.max(pf.radius, 0.001);
      shells.setMatrixAt(i, tmpM.compose(tmpP.set(pf.centre[0], pf.centre[1] + 0.5, pf.centre[2]), IDENTITY_Q, tmpS.set(sc, sc, sc)));
      shells.setColorAt(i, SKY_COLOURS[pf.kind]!);
    }
    shells.instanceMatrix.needsUpdate = true;
    if (shells.instanceColor) shells.instanceColor.needsUpdate = true;
    updateFlyers(t);
  };

  setProgress(0);
  update(0, 0);
  applyView();

  /** Where the window is on the screen: its corners projected and clipped; the vista draws only inside it. */
  const windowRect = (lab: THREE.PerspectiveCamera, width: number, height: number): { x: number; y: number; w: number; h: number } | null => {
    lab.updateMatrixWorld(true);
    const pts: { x: number; y: number }[] = [];
    const w = o.window;
    for (const [x, y] of [[w.x0, w.y0], [w.x1, w.y0], [w.x1, w.y1], [w.x0, w.y1]] as const) {
      tmpV.set(x, y, w.z).applyMatrix4(lab.matrixWorldInverse);
      // a corner behind the camera (the lab camera close to the glass, turned to one side): the screen cannot be clipped to the
      // window, so the view covers the whole screen; the walls still cover everything outside the window's opening
      if (tmpV.z >= -0.05) return { x: 0, y: 0, w: width, h: height };
      tmpV.set(x, y, w.z).project(lab);
      pts.push({ x: ((tmpV.x + 1) / 2) * width, y: ((1 - tmpV.y) / 2) * height });
    }
    return clipRect(pts, width, height);
  };

  const render = (renderer: THREE.WebGLRenderer, lab: THREE.PerspectiveCamera, width: number, height: number): boolean => {
    if (view === 'static') return false;
    const rect = windowRect(lab, width, height);
    if (!rect) return false;
    camera.position.copy(lab.position);
    camera.quaternion.copy(lab.quaternion);
    camera.fov = lab.fov;
    camera.aspect = lab.aspect;
    camera.near = 0.5;
    camera.far = 9000;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const prevAuto = renderer.autoClear;
    // three.js scales the scissor by the pixel ratio itself, so these are CSS pixels; the origin is the bottom-left
    renderer.setScissorTest(true);
    renderer.setScissor(rect.x, height - rect.y - rect.h, rect.w, rect.h);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClear = prevAuto;
    renderer.setScissorTest(false);
    return true;
  };

  const stats = (): { drawCalls: number; triangles: number; dust: number } => {
    let drawCalls = 0, triangles = 0;
    scene.traverseVisible((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry as THREE.InstancedBufferGeometry;
      const im = m as THREE.InstancedMesh;
      const instances = im.isInstancedMesh ? im.count : (g.instanceCount ?? 1);
      drawCalls += 1;
      const indexed = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
      triangles += Math.floor(indexed / 3) * Math.max(1, instances);
    });
    return { drawCalls, triangles, dust: view === 'full' ? MOTES : view === 'lite' ? Math.floor(MOTES / 2) : 0 };
  };

  return {
    scene,
    camera,
    get view() { return view; },
    get flashLight() { return flashLight; },
    flash: {
      onFlash(cb) {
        listeners.add(cb);
        return () => { listeners.delete(cb); };
      },
    },
    setView(v) { view = v; applyView(); },
    setProgress,
    update,
    render,
    adoptGenerated,
    stats,
    dispose() {
      for (const s of sets) {
        for (const m of s.meshes) { scene.remove(m); m.dispose(); }
        freeParts(s.parts);
      }
      for (const x of owned) x.dispose();
      boxGeo.dispose();
      listeners.clear();
      scene.clear();
    },
  };
}
