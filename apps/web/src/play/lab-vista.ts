// The view from the lab window (docs/WINDOW_SCENE_PLAN.md): a planned 3D wasteland of the Bridge Array outside the lab's north window.
// It is its own scene, drawn first through the window's screen rectangle; the lab is then drawn over it after a depth clear, so the
// window frame and the walls still cover it. The lab camera and the vista share one coordinate frame (lab metres), so the parallax is real.
// The pure maths (pockets, bursts, progress, palettes) is in lab-vista-math.ts; this file is the scene, its layout and its shaders.
import * as THREE from 'three';
import { getGenSync, GEN, loadGen, type GenLevel } from '../assets/gen';
import {
  BASE_S, BREACH_XZ, BURST_SECONDS, CORRIDOR_DEG, EGA16, MAX_POCKETS, POCKET_KINDS, SPAWN_XZ, WINDOW_DIST, bearingFromSpawn, burstLook,
  burstSchedule, clipRect, groundFade, inCorridor, lookAt, mulberry32, polar, pocketFrame, pocketLifetime, type BurstEvent, type BurstLook,
  type PocketFrame, type VistaLook,
} from './lab-vista-math';

/** Full: the whole view. Lite: no curtains or pocket shells, half the dust. Static: the lab's flat storm plane (lab-room draws it). */
export type WindowView = 'static' | 'lite' | 'full';

/** The vista always draws the low level of its models (plan §9: the budget is 120k triangles on the GTX 950M): the HD pack is not used here. */
export const VISTA_LEVEL: GenLevel = 'low';

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
  /** The pockets as they are now (for the shots and the tests). */
  debugPockets(): readonly { readonly slot: number; readonly centre: readonly number[]; readonly radius: number; readonly kind: number }[];
  /** The crosswind props as they are now (world metres). */
  debugFlyers(): readonly { readonly lane: number; readonly x: number; readonly y: number; readonly z: number }[];
  /** Each model set: its id, whether it is the generated model or the box, and its instances (for the checks). */
  debugSets(): readonly { readonly key: string; readonly id: string; readonly source: 'gen' | 'box'; readonly instances: number }[];
  dispose(): void;
}

export interface LabVistaOptions {
  readonly view: WindowView;
  readonly window: WindowRect;
  readonly level: GenLevel;
}

// ---- The layout (lab metres; the vista sits beyond the north wall, at z below the window's z)
/** The Breach (math: a third of the window from the left as seen from the spawn, 1.2 km out). */
const BREACH = BREACH_XZ;
const beyond = (bearing: number, w: number): readonly [number, number] => polar(SPAWN_XZ, bearing, WINDOW_DIST + w);
/** The lab's north wall (the window's plane). */
const WALL_Z = -9;
/** The breach column: a square core 120 m across and 600 m tall (review 3, W1). From the spawn it stands 26.6 degrees high, above the glass top. */
const BREACH_CORE_W = 120, BREACH_H = 600;
/** The storm's cloud layer, 450 m up: the Breach's top rises through it (review 2, V1). */
const CLOUD_H = 450;
/** The soft glow sheath is 300 m across: it glows just outside the core's edge and fades to nothing at its own edge (review 3, W1). */
const SHEATH_W = 300;
/** The pocket shells' rim colours are the kinds' (math); the back faces take the kinds' sky. Padded to the shader's array length. */
const SHELL_RIM = Array.from({ length: MAX_POCKETS }, (_, i) => POCKET_KINDS[i]?.rim ?? [0, 0, 0] as const);
const SHELL_SKY = Array.from({ length: MAX_POCKETS }, (_, i) => POCKET_KINDS[i]?.sky ?? [0, 0, 0] as const);

/** The horizon colour at the storm and at dusk (sRGB, as the sky shader writes it); the fog takes the same colour. The storm is dark
 *  (review 3, W2): the Breach and the pockets' rims are the only bright things in the view. */
const HORIZON_STORM: Readonly<[number, number, number]> = [0.13, 0.12, 0.16];
const HORIZON_DUSK: Readonly<[number, number, number]> = [0.92, 0.52, 0.3];
/** exp2 fog: half faded at 500 m, nearly gone at 1.5 km (the brief, R3). */
const FOG_DENSITY = 0.00167;

/** Sizes the boxes use until a model is packed (metres: the assets' heights, plus a footprint). */
const FALLBACK: Readonly<Record<string, readonly [number, number, number]>> = {
  'datacentre-hall': [10, 9, 23],
  'chiller-block': [3.1, 3, 3.1],
  'shipping-container': [2.4, 2.6, 5.6],
  'pylon-tower': [6.4, 24, 11.1],
  'overpass-segment': [5.9, 9, 8.5],
  'rubble-slab': [6, 1.5, 5],
};
const FALLBACK_COLOUR: Readonly<Record<string, string>> = {
  'datacentre-hall': '#5b6670', 'chiller-block': '#9aa3a8', 'shipping-container': '#7a4a2e', 'pylon-tower': '#4d5358',
  'overpass-segment': '#77736c', 'rubble-slab': '#6f6a63',
};
/** The hero models (the vista class of assets). */
export const VISTA_ASSETS: readonly string[] = ['datacentre-hall', 'chiller-block', 'shipping-container', 'pylon-tower', 'overpass-segment', 'rubble-slab'];
/** The dressing that tumbles across the window (lane 0 is the crate that flies through pocket 0) and the props that orbit the Breach. */
const CROSSWIND: readonly string[] = ['server-rack', 'cardboard-stack', 'toolbox', 'coolant-can', 'sample-case', 'old-monitor', 'filing-cabinet'];
const VORTEX: readonly string[] = ['server-rack', 'crate-large', 'shipping-container'];

/** Loads the vista's generated models at a level, behind the caller's loading bar. A model that fails stays a box (and is logged). */
export async function preloadVista(level: GenLevel): Promise<void> {
  await Promise.all([...VISTA_ASSETS, ...CROSSWIND, ...VORTEX].map((id) => loadGen(id, level).catch((err: unknown) => {
    console.warn(`[window view] ${id} stays a box:`, err);
    return null;
  })));
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
uniform float uPocketFade[VISTA_POCKETS];
uniform vec4 uBaseS;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uFlashPos;
uniform float uFlashAmt;
varying vec3 vVistaW;

// the fidelity at p: the storm base outside, the strongest pocket's S inside (soft over its last 15% of radius).
// A point on the ground (under 0.5 m) takes the pocket's disc straight down, faded by the pocket's height (review 2, V2).
vec4 vistaFidelity(vec3 p, out vec3 tint) {
  vec4 s = uBaseS;
  tint = vec3(1.0);
  float best = 0.0;
  bool ground = p.y < 0.5;
  for (int i = 0; i < VISTA_POCKETS; i++) {
    float r = uPocketRad[i];
    if (r <= 0.0) continue;
    vec3 dv = p - uPocketPos[i];
    float d = ground ? length(dv.xz) : length(dv);
    float w = 1.0 - smoothstep(r * 0.85, r, d);
    if (ground) w *= uPocketFade[i];
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
  readonly uPocketFade: THREE.IUniform<number[]>;
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
    uPocketFade: { value: new Array<number>(MAX_POCKETS).fill(1) },
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
  mat.customProgramCacheKey = () => 'vista-pocket-v2';
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
uniform float uDusk, uGlow, uFlash, uTime, uCloudH;
uniform vec3 uBreachDir, uFlashDir, uHorizon, uDuskHorizon, uEye;
uniform vec2 uBreachXZ;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 hz = mix(uHorizon, uDuskHorizon, uDusk);
  vec3 zen = mix(vec3(0.025, 0.025, 0.045), vec3(0.17, 0.18, 0.32), uDusk);
  vec3 col = mix(hz, zen, smoothstep(0.0, 0.5, up));
  // the storm clouds are a layer at uCloudH: the view ray meets it, the clouds drift on it, and their undersides within 1.5 km
  // of the Breach take its cyan (cloudLitAt in the maths) and the flashes' light (review 2, V1)
  float cl = 0.0;
  float lit = 0.0;
  if (d.y > 0.02) {
    float t = (uCloudH - uEye.y) / d.y;
    vec2 q = uEye.xz + d.xz * t;
    cl = smoothstep(0.42, 0.74, vfbm(q * 0.0022 + vec2(uTime * 0.004, uTime * 0.0015)));
    cl *= smoothstep(0.02, 0.12, d.y);
    lit = 1.0 - smoothstep(200.0, 1500.0, length(q - uBreachXZ));
  }
  vec3 cloudDark = mix(vec3(0.11, 0.105, 0.13), vec3(0.36, 0.22, 0.18), uDusk);
  vec3 cloudLit = vec3(0.45, 0.92, 1.0) * uGlow;
  vec3 cloudCol = mix(cloudDark, cloudLit, lit) + vec3(0.8, 0.95, 1.0) * uFlash * 0.5 * (0.3 + 0.7 * lit);
  col = mix(col, cloudCol, cl * 0.9);
  float glow = pow(max(dot(d, normalize(uBreachDir)), 0.0), 60.0);
  col += vec3(0.35, 0.85, 1.0) * glow * uGlow * 0.6;
  float fl = pow(max(dot(d, normalize(uFlashDir)), 0.0), 6.0);
  col += vec3(0.8, 0.95, 1.0) * fl * uFlash * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * The Breach (review 3, W1): a square column of 60 rigid 10 m slices. Each slice is its own box, so a glitched slice jumps sideways as
 * one band (its vertices share the slice index), and the bands are darker when they jump. The core is cyan, with a few white cells
 * (the only white in the column) and a few dead cells. The top 28% dissolves into the lit cloud, and is see-through there.
 */
const BREACH_VERT = /* glsl */ `
uniform float uTime, uH;
attribute float aSlice;
varying vec3 vP;
varying float vY;
varying float vT;
varying float vBand;
float bh(float n) { return fract(sin(n * 91.345) * 47453.5453); }
void main() {
  vec3 p = position;
  p.y *= uH;
  float tick = floor(uTime * 2.2);
  float roll = bh(aSlice * 1.7 + tick * 13.1);
  float off = step(0.6, roll);
  p.x += off * (bh(aSlice * 3.3 + tick * 7.7) - 0.5) * 56.0;
  vP = p;
  vY = p.y;
  vT = position.y / ${BREACH_H.toFixed(1)};
  vBand = off;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const BREACH_FRAG = /* glsl */ `
uniform float uTime, uGlow, uHaze;
uniform vec3 uHazeCol;
varying vec3 vP;
varying float vY;
varying float vT;
varying float vBand;
float bh2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float tick = floor(uTime * 18.0);
  vec2 cell = floor(vec2(vP.x + vP.z, vY) / vec2(5.0, 3.0));
  float n = bh2(cell + tick * 0.37);
  vec3 cold = vec3(0.55, 0.92, 1.0);
  vec3 c = mix(cold, vec3(1.0), step(0.88, n));
  c = mix(c, vec3(0.08, 0.16, 0.2), step(n, 0.06));
  c *= (0.85 + 0.15 * uGlow) * mix(1.0, 0.6, vBand);
  c = mix(c, uHazeCol * 1.3, uHaze * 0.5);
  float top = smoothstep(0.72, 1.0, vT);
  c = mix(c, vec3(0.4, 0.7, 0.8) * uGlow, top * 0.6);
  gl_FragColor = vec4(c, 1.0 - top);
}
`;

/** The glow sheath: a soft additive cylinder, 300 m across. Its screen radius s (0 at the axis, 1 at the silhouette) puts the glow just
 *  outside the core's edge (the core is 120 m of the 300 m, so s 0.4) and fades it to nothing at the sheath's edge (review 3, W1). */
const SHEATH_VERT = /* glsl */ `
uniform float uH;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  vec3 p = position;
  p.y *= uH;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vY = p.y / ${BREACH_H.toFixed(1)};
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SHEATH_FRAG = /* glsl */ `
uniform float uGlow;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float s = sqrt(max(0.0, 1.0 - facing * facing));
  float ring = smoothstep(0.36, 0.44, s) * (1.0 - smoothstep(0.6, 1.0, s));
  float a = 0.55 * ring * uGlow * (1.0 - smoothstep(0.75, 1.0, vY));
  gl_FragColor = vec4(vec3(0.35, 0.85, 1.0), a);
}
`;

/** The breach column's geometry: 60 boxes of 10 m, one per slice, each with its slice index (`aSlice`), in one buffer. */
function breachColumnGeometry(): THREE.BufferGeometry {
  const slices = Math.round(BREACH_H / 10);
  const box = new THREE.BoxGeometry(BREACH_CORE_W, 10, BREACH_CORE_W);
  const pos = box.attributes.position as THREE.BufferAttribute;
  const nor = box.attributes.normal as THREE.BufferAttribute;
  const uv = box.attributes.uv as THREE.BufferAttribute;
  const idx = box.index!;
  const n = pos.count;
  const P: number[] = [], N: number[] = [], U: number[] = [], S: number[] = [], I: number[] = [];
  for (let k = 0; k < slices; k++) {
    for (let v = 0; v < n; v++) {
      P.push(pos.getX(v), pos.getY(v) + 10 * k + 5, pos.getZ(v));
      N.push(nor.getX(v), nor.getY(v), nor.getZ(v));
      U.push(uv.getX(v), uv.getY(v));
      S.push(k);
    }
    for (let i = 0; i < idx.count; i++) I.push(idx.getX(i) + k * n);
  }
  box.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('aSlice', new THREE.Float32BufferAttribute(S, 1));
  g.setIndex(I);
  return g;
}

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
  gl_FragColor = vec4(vec3(0.50, 0.44, 0.36), a);
}
`;

/** Dust: dust-coloured, streaked along the wind (east), mostly low and near. Never white points. */
const MOTE_VERT = /* glsl */ `
attribute vec4 aSeed;
attribute float aSize;
uniform float uTime, uDust;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  float t = uTime;
  vec3 p = aSeed.xyz;
  p.x = mod(p.x + t * (6.0 + 6.0 * aSeed.w) + 80.0, 160.0) - 80.0;
  p.y += sin(t * 0.7 + aSeed.w * 6.28) * 0.25;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += vec2(position.x * aSize * (3.0 + 3.0 * aSeed.w), position.y * aSize * 0.6);
  vA = uDust;
  gl_Position = projectionMatrix * mv;
}
`;
const MOTE_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vA;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.3, 1.0, r)) * vA * 0.42;
  gl_FragColor = vec4(vec3(0.52, 0.46, 0.38), a);
}
`;

/** The pocket shell: the back faces show the pocket's sky; only a thin fresnel line of scanned static lights the edge. */
/**
 * The pocket shell (review 2, V2): transparent, no depth write, and no dark fill. A thin fresnel rim of scanline static in the
 * pocket's own colour; the back faces carry the pocket's sky at no more than 25% opacity. The kind rides in the instance colour.
 */
const SHELL_VERT = /* glsl */ `
flat varying int vSlot;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vY = wp.y;
  vSlot = int(instanceColor.r + 0.5);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SHELL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uShellRim[${MAX_POCKETS}];
uniform vec3 uShellSky[${MAX_POCKETS}];
flat varying int vSlot;
varying vec3 vN;
varying vec3 vV;
varying float vY;
float sh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(1.0 - ndv, 3.0);
  float scan = 0.5 + 0.5 * sin(vY * 3.0 + uTime * 6.0);
  float grain = step(0.4, sh(floor(vec2(vY * 6.0, uTime * 20.0))));
  vec3 rimCol = uShellRim[vSlot] * (0.55 + 0.45 * scan) * (0.6 + 0.8 * grain);
  float a = clamp(rim * 1.6 * (0.5 + 0.5 * grain), 0.0, 0.9);
  vec3 c = rimCol;
  if (!gl_FrontFacing) {
    // the back faces: the pocket's sky at 25% opacity, dimmed by half so the rim is what is bright (review 3, W2), with the rim on top
    c = mix(uShellSky[vSlot] * 0.5, rimCol, rim);
    a = max(a, 0.25);
  }
  gl_FragColor = vec4(c, a);
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
      const crack = 1 - Math.min(1, (d2 - d1) / 0.022);
      const base = (0.62 + 0.25 * d1) * (0.86 + 0.14 * r()) * (1 - 0.35 * crack);
      const i = (y * N + x) * 4;
      data[i] = Math.round(255 * Math.min(1, base * 1.04));
      data[i + 1] = Math.round(255 * Math.min(1, base * 0.98));
      data[i + 2] = Math.round(255 * Math.min(1, base * 0.9));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const hexOf = (c: readonly [number, number, number]): THREE.Color => new THREE.Color(c[0], c[1], c[2]);

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
  let framePockets: PocketFrame[] = [];
  const flyerPos: { lane: number; x: number; y: number; z: number }[] = [];
  const listeners = new Set<(e: FlashEvent) => void>();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };

  // ---- Lights: a cold hemisphere, and the Breach as the key light (cyan-white) that rim-lights the silhouettes
  scene.add(new THREE.HemisphereLight('#7d8594', '#2b2622', 0.55));
  const sunDir = new THREE.Vector3(BREACH[0] - SPAWN_XZ[0], 260, BREACH[1] - SPAWN_XZ[1]).normalize();
  const key = new THREE.DirectionalLight('#bfe9ff', 0.9);
  key.position.copy(sunDir).multiplyScalar(400);
  key.target.position.set(SPAWN_XZ[0], 0, SPAWN_XZ[1]);
  scene.add(key, key.target);
  shared.uSunDir.value = sunDir.clone();
  // exp2 fog in the horizon colour (R3): half faded at 500 m, a silhouette only at 1.5 km
  const fog = new THREE.FogExp2(0xffffff, FOG_DENSITY);
  scene.fog = fog;
  const horizonNow = new THREE.Color();

  // ---- The sky: a dome that follows the camera (infinitely far), drawn first, with no depth
  const skyU = {
    uTime: { value: 0 }, uDusk: { value: 0 }, uGlow: { value: 1 }, uFlash: { value: 0 },
    uBreachDir: { value: sunDir.clone() }, uFlashDir: { value: new THREE.Vector3(0, 1, 0) },
    uHorizon: { value: hexOf(HORIZON_STORM) }, uDuskHorizon: { value: hexOf(HORIZON_DUSK) },
    uCloudH: { value: CLOUD_H }, uEye: { value: new THREE.Vector3() }, uBreachXZ: { value: new THREE.Vector2(BREACH[0], BREACH[1]) },
  };
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(4500, 32, 16)), keep(new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, side: THREE.BackSide, depthWrite: false, toneMapped: false,
  })));
  sky.renderOrder = -10;
  scene.add(sky);

  // ---- Ground: cracked grey-brown dust, flat from the wall to the horizon (R2); it only rises far beyond the fog.
  const crack = keep(crackTexture(1234));
  const GROUND = 3000, GRID = 60;
  const groundTex = keep(crack.clone());
  groundTex.repeat.set((GROUND * 2) / 24, (GROUND * 2) / 24);
  const apronTex = keep(crack.clone());
  apronTex.repeat.set(10, 5);
  groundTex.needsUpdate = apronTex.needsUpdate = true;
  // the dust plain is dark under the storm (review 3, W2): the Breach and the pockets are what is bright
  const groundMat = keep(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.94, metalness: 0, color: '#6a6155' }));
  const apronMat = keep(new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.8, metalness: 0, color: '#4f4a43' }));
  patchMaterial(groundMat, shared);
  patchMaterial(apronMat, shared);
  const groundGeo = keep(new THREE.PlaneGeometry(GROUND * 2, GROUND * 2, GRID, GRID));
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(SPAWN_XZ[0], -0.05, SPAWN_XZ[1]);
  {
    const pos = groundGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const dist = Math.hypot(x - SPAWN_XZ[0], z - SPAWN_XZ[1]);
      const rise = smooth(1500, 3000, dist) * (12 + 18 * (0.5 + 0.5 * Math.sin(x * 0.0036 + 1.3) * Math.cos(z * 0.0029)));
      pos.setY(i, -0.05 + rise);
    }
    groundGeo.computeVertexNormals();
  }
  scene.add(new THREE.Mesh(groundGeo, groundMat));
  // the apron: the concrete a few metres out from the glass, level with the lab floor
  const apronGeo = keep(new THREE.BoxGeometry(60, 0.2, 26));
  apronGeo.translate(0, 0.0, WALL_Z - 13);
  scene.add(new THREE.Mesh(apronGeo, apronMat));

  // ---- Square bollards at the window's far edges only (the middle bays stay clear, R1): one instanced box
  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const boxMat = keep(new THREE.MeshStandardMaterial({ color: '#77716a', roughness: 0.8, metalness: 0.1 }));
  patchMaterial(boxMat, shared);
  const bollards: { x: number; z: number }[] = ([[-24, 4], [-21, 6], [40, 5], [43, 7]] as const).map(([b, w]) => {
    const [x, z] = beyond(b, w);
    return { x, z };
  });
  const bollardMesh = new THREE.InstancedMesh(boxGeo, boxMat, bollards.length);
  bollards.forEach((p, i) => {
    tmpP.set(p.x, 0.55, p.z);
    tmpS.set(0.6, 1.1, 0.6);
    bollardMesh.setMatrixAt(i, tmpM.compose(tmpP, IDENTITY_Q, tmpS));
  });
  bollardMesh.frustumCulled = false;
  scene.add(bollardMesh);

  // ---- The ridge: a silhouette across the far plain (R3: it is a silhouette, darker than the fog, not fogged itself)
  {
    const shape = new THREE.Shape();
    shape.moveTo(-4500, -10);
    for (let x = -4500; x <= 4500; x += 150) shape.lineTo(x, 40 + 110 * (0.5 + 0.5 * Math.sin(x * 0.0021) * Math.cos(x * 0.0007 + 0.4)));
    shape.lineTo(4500, -10);
    shape.closePath();
    const m = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.095, 0.12), fog: false, toneMapped: false }));
    const ridge = new THREE.Mesh(keep(new THREE.ShapeGeometry(shape)), m);
    ridge.position.set(0, 0, WALL_Z - 1800);
    scene.add(ridge);
  }

  // ---- The Breach: a square core 120 m across, 600 m tall, its 10 m slices jumping sideways in dark and white bands (R4, W1)
  const breachU = { uTime: { value: 0 }, uH: { value: 1 }, uGlow: { value: 1 }, uHaze: { value: 0.3 }, uHazeCol: { value: hexOf(HORIZON_STORM) } };
  const breachGeo = keep(breachColumnGeometry());
  const breach = new THREE.Mesh(breachGeo, keep(new THREE.ShaderMaterial({
    vertexShader: BREACH_VERT, fragmentShader: BREACH_FRAG, uniforms: breachU, toneMapped: false, transparent: true,
  })));
  breach.position.set(BREACH[0], 0, BREACH[1]);
  scene.add(breach);
  // the glow sheath: a soft additive cylinder of twice the column's width, the same height and the same slow scale
  const sheathGeo = keep(new THREE.CylinderGeometry(SHEATH_W / 2, SHEATH_W / 2, BREACH_H, 40, 1, true));
  sheathGeo.translate(0, BREACH_H / 2, 0);
  const sheathMat = keep(new THREE.ShaderMaterial({
    vertexShader: SHEATH_VERT, fragmentShader: SHEATH_FRAG, uniforms: { uH: breachU.uH, uGlow: breachU.uGlow },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  const sheath = new THREE.Mesh(sheathGeo, sheathMat);
  sheath.position.set(BREACH[0], 0, BREACH[1]);
  sheath.renderOrder = 3;
  scene.add(sheath);

  // ---- The sets: each model's instances, one InstancedMesh per part
  const sets: VistaSet[] = [];
  const flushSet = (s: VistaSet): void => {
    s.meshes.forEach((im, k) => {
      const part = s.parts[k]!;
      for (let i = 0; i < s.poses.length; i++) im.setMatrixAt(i, tmpM.multiplyMatrices(s.poses[i]!, part.local));
      im.instanceMatrix.needsUpdate = true;
    });
  };
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
  const addSet = (key: string, id: string, poses: THREE.Matrix4[], dynamic: boolean): VistaSet => {
    const { parts, source } = partsOf(id, level, shared);
    const s: VistaSet = { key, id, poses, dynamic, parts, meshes: [], source };
    sets.push(s);
    buildMeshes(s);
    return s;
  };

  // hero placements (plan §4). Bearings are from the spawn (the bays: far-left -26..-7, middle -7..25, far-right 25..45). `w` is the
  // distance beyond the window. The near field (w under 25) stays low in the middle bays (R1).
  const hero: Record<string, THREE.Matrix4[]> = { 'datacentre-hall': [], 'chiller-block': [], 'shipping-container': [], 'pylon-tower': [], 'overpass-segment': [], 'rubble-slab': [] };
  // L0 the apron (3 to 25 m beyond the window): the container lies tilted in the far-left bay, two slabs, a chiller knocked on its side
  hero['shipping-container']!.push(pose(...at(beyond(-22, 30), 0), Math.PI / 2, 0, 0.09));
  hero['rubble-slab']!.push(pose(...at(beyond(-12, 8), 0), -0.4));
  hero['rubble-slab']!.push(pose(...at(beyond(30, 18), 0), 1.1));
  hero['chiller-block']!.push(pose(...at(beyond(38, 16), 1.35), 0.3, 0, 1.45));
  // L1 the near field (30 to 120 m): a two-high container stack at the right bay's edge, three slabs, the first pylon far right
  hero['shipping-container']!.push(pose(...at(beyond(26, 62), 0), Math.PI / 2));
  hero['shipping-container']!.push(pose(...at(beyond(26, 62), 2.6), Math.PI / 2));
  hero['rubble-slab']!.push(pose(...at(beyond(-13, 40), 0), 0.7));
  hero['rubble-slab']!.push(pose(...at(beyond(12, 95), 0), 2.2));
  hero['rubble-slab']!.push(pose(...at(beyond(-18, 70), 0), -0.2));
  // L2 the farm (150 to 500 m): five halls low on the horizon, a chiller beside each one
  // the halls sit clear of the Breach's corridor (review 2, V1): nothing stands in front of the column
  for (const [b, w] of [[-20, 300], [-12, 170], [10, 230], [24, 330], [38, 260]] as const) {
    // the halls' long side (23 m) faces the window; the far rows are scaled up 1.8 (the real hall is 10 x 9 x 23 m)
    hero['datacentre-hall']!.push(pose(...at(beyond(b, w), 0), Math.PI / 2 + (b * Math.PI) / 180 * 0.1, 0, 0, 1.8));
    hero['chiller-block']!.push(pose(...at(beyond(b - 3, w - 30), 0), 0.1));
  }
  // the overpass: fourteen pier-and-deck pieces (5.9 x 9 x 8.5 m) in a line toward the Breach, 18 m apart; it stops short of the corridor
  const overStart = beyond(-22, 200);
  const overLen = Math.hypot(BREACH[0] - overStart[0], BREACH[1] - overStart[1]);
  const ux = (BREACH[0] - overStart[0]) / overLen, uz = (BREACH[1] - overStart[1]) / overLen;
  for (let i = 0; i < 14; i++) {
    const d = 18 * i;
    const x = overStart[0] + ux * d, z = overStart[1] + uz * d;
    if (inCorridor(bearingFromSpawn(x, z), CORRIDOR_DEG + 1)) continue;
    hero['overpass-segment']!.push(pose(x, 0, z, Math.atan2(ux, uz)));
  }
  // the pylon line: from the near right (60 m) toward the Breach's right edge; the pylons inside the corridor are left out
  const pylonStart = beyond(40, 60);
  const pylonEnd = polar(SPAWN_XZ, 9, 1000);
  for (const t of [0, 0.2, 0.4, 0.6, 0.8]) {
    const x = pylonStart[0] + (pylonEnd[0] - pylonStart[0]) * t, z = pylonStart[1] + (pylonEnd[1] - pylonStart[1]) * t;
    if (inCorridor(bearingFromSpawn(x, z), CORRIDOR_DEG + 1)) continue;
    hero['pylon-tower']!.push(pose(x, 0, z, 0));
  }
  // L3 the Breach (600 to 2000 m): the main hall the column rises from, and far silhouettes
  // the main hall (scaled up 3, the Breach rises from it), and the far halls (scaled up 4: silhouettes beyond the fog's half)
  hero['datacentre-hall']!.push(pose(BREACH[0], 0, BREACH[1], Math.PI / 2 + 0.1, 0, 0, 3));
  for (const [b, w, s] of [[-16, 900, 4], [6, 1100, 4], [20, 1400, 4.5]] as const) {
    const [x, z] = beyond(b, w);
    hero['datacentre-hall']!.push(pose(x, 0, z, Math.PI / 2 + 0.02, 0, 0, s));
  }
  for (const [id, poses] of Object.entries(hero)) if (poses.length) addSet(`hero:${id}`, id, poses, false);

  // the crosswind stream: three of each prop tumble across the window (plan §7). Lane 0 is the crate that flies through pocket 0:
  // its height and its depth are the pocket's, so it passes through the pocket's middle.
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

  // ---- The pocket shells: one instanced sphere; back faces show the pocket's sky, a thin static rim (plan §5, R5)
  const shellMat = keep(new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uShellRim: { value: SHELL_RIM.map((c) => new THREE.Vector3(c[0], c[1], c[2])) },
      uShellSky: { value: SHELL_SKY.map((c) => new THREE.Vector3(c[0], c[1], c[2])) },
    },
  }));
  const shells = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(1, 40, 24)), shellMat, MAX_POCKETS);
  shells.frustumCulled = false;
  shells.renderOrder = 2;
  // the instance colour carries the pocket's kind in its red channel (the kind changes each cycle, the slot does not)
  const KIND_IDS = POCKET_KINDS.map((_, k) => new THREE.Color(k, 0, 0));
  for (let i = 0; i < MAX_POCKETS; i++) shells.setColorAt(i, KIND_IDS[0]!);
  scene.add(shells);

  // ---- The dust: 900 motes, advected on the GPU (one draw call); the lite view draws half. Low and near (R6).
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
      const near = r() < 0.7;
      seedArr[i * 4] = (r() * 2 - 1) * 70;
      seedArr[i * 4 + 1] = r() < 0.8 ? 0.3 + 2.4 * r() : 3 + 6 * r();
      seedArr[i * 4 + 2] = near ? WALL_Z - 4 - 46 * r() : WALL_Z - 50 - 120 * r();
      seedArr[i * 4 + 3] = r();
      // twice the first size (review 2, V4): the motes read as dust from the glass
      sizeArr[i] = 2 * ((near ? 0.12 : 0.28) + 0.22 * r());
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
    const top = BREACH_H + 300, halfW = 6 + 4 * e.strength;
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
  const lastCycle = Array.from({ length: MAX_POCKETS }, () => 0);

  /** The flying props: the crosswind tumbles left to right (lane 0 at pocket 0's height and depth), the vortex orbits. A burst pushes what it reaches. */
  const updateFlyers = (t: number): void => {
    flyerPos.length = 0;
    const pocket0 = pocketFrame(0, t, look.pocketScale);
    for (const f of crosswind) {
      const speed = f.lane === 0 ? 6 : 5 + (f.lane % 5);
      const phase = ((t * speed) / 110 + f.lane * 0.173) % 1;
      let px = -40 + phase * 110;
      let py = 1.2 + ((f.lane * 0.37) % 1) * 3.5;
      let pz = WALL_Z - 14 - (f.lane % 7) * 9;
      if (f.lane === 0) { py = pocket0.centre[1]; pz = pocket0.centre[2]; }
      if (activeBurst && activeBurst.look.burst > 0) {
        const dx = px - activeBurst.event.x, dz = pz - activeBurst.event.z;
        const d = Math.hypot(dx, dz);
        if (d < 90) {
          const k = (1 - (t - activeBurst.event.t) / BURST_SECONDS) * 4 * activeBurst.event.strength;
          px += (dx / (d || 1)) * k;
          py += k * 0.7;
        }
      }
      flyerPos.push({ lane: f.lane, x: px, y: py, z: pz });
      tmpQ.setFromEuler(new THREE.Euler(t * 1.4 + f.lane, t * 0.9 + f.lane * 0.3, t * 0.5, 'YXZ'));
      // lane 0 is scaled up (2.5: a 5 m rack) so it reads inside the pocket from the glass
      const sc = f.lane === 0 ? 2.5 : 1;
      f.set.poses[f.slot]!.compose(tmpP.set(px, py, pz), tmpQ, tmpS.set(sc, sc, sc));
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
    // the fog is the horizon colour, which turns to dusk with the storm's progress
    const h = [0, 1, 2].map((i) => HORIZON_STORM[i]! + (HORIZON_DUSK[i]! - HORIZON_STORM[i]!) * look.dusk);
    horizonNow.setRGB(h[0]!, h[1]!, h[2]!, THREE.SRGBColorSpace);
    fog.color.copy(horizonNow);
    (breachU.uHazeCol.value as THREE.Color).copy(horizonNow);
    (skyU.uHorizon.value as THREE.Color).setRGB(HORIZON_STORM[0], HORIZON_STORM[1], HORIZON_STORM[2]);
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
      skyU.uFlashDir.value.set(e.x - SPAWN_XZ[0], 300, e.z - SPAWN_XZ[1]).normalize();
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
    framePockets = [];
    for (let i = 0; i < MAX_POCKETS; i++) {
      const pf = pocketFrame(i, t, look.pocketScale);
      framePockets.push(pf);
      const kind = POCKET_KINDS[pf.kind]!;
      shared.uPocketPos.value[i]!.set(pf.centre[0], pf.centre[1], pf.centre[2]);
      shared.uPocketRad.value[i] = pf.radius;
      shared.uPocketS.value[i]!.set(kind.s[0], kind.s[1], kind.s[2], kind.s[3]);
      shared.uPocketTint.value[i]!.set(kind.tint[0], kind.tint[1], kind.tint[2]);
      shared.uPocketFade.value[i] = groundFade(pf.centre[1]);
      const sc = Math.max(pf.radius, 0.001);
      shells.setMatrixAt(i, tmpM.compose(tmpP.set(pf.centre[0], pf.centre[1], pf.centre[2]), IDENTITY_Q, tmpS.set(sc, sc, sc)));
      shells.setColorAt(i, KIND_IDS[pf.kind]!);
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
    // the sky's cloud layer is intersected from the eye, so the eye's place is needed (the sky dome itself is at the origin)
    (skyU.uEye.value as THREE.Vector3).copy(camera.position);
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
    debugPockets: () => framePockets.map((f, slot) => ({ slot, centre: [...f.centre], radius: f.radius, kind: f.kind })),
    debugFlyers: () => flyerPos.map((f) => ({ ...f })),
    debugSets: () => sets.map((s) => ({ key: s.key, id: s.id, source: s.source, instances: s.poses.length })),
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
