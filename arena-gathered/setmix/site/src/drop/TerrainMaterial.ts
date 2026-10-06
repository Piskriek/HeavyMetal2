/* ============================================================================
 *  apps/web/src/render/TerrainMaterial.ts
 *  ---------------------------------------------------------------------------
 *  THE UBER-TERRAIN SHADER.  One program, all six stages.
 *
 *  Every stage transition is a UNIFORM CHANGE, never a shader variant. There
 *  is no runtime compilation anywhere in SetMix, therefore there is no shader
 *  hitching — the single most common cause of stutter in modern games.
 *
 *  The GLSL below compiles under both:
 *    · THREE.ShaderMaterial (Three.js injects projectionMatrix, position, …)
 *    · raw WebGL2           (#define SETMIX_STANDALONE declares them itself)
 *  The shader BODY is byte-identical in both cases; only the prelude differs.
 * ==========================================================================*/

import type { FidelityState, RenderBudget } from "./contracts.setmix";
import { normalised } from "./fidelity";

/* ───────────────────────────────────────────────────────────── prelude ── */

export const STANDALONE_PRELUDE_VERT = /* glsl */ `
precision highp float;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;
in vec2 uv;
`;

export const STANDALONE_PRELUDE_FRAG = /* glsl */ `
precision highp float;
out vec4 fragColour;
`;

/* ═══════════════════════════════════════════════════════ VERTEX SHADER ══ */

export const TERRAIN_VERT = /* glsl */ `
// ── wave front ──────────────────────────────────────────────────────────
uniform vec2  u_waveOrigin[4];
uniform float u_waveRadius[4];
uniform float u_waveThickness[4];
uniform float u_waveDir[4];       // +1 advancing, −1 receding
uniform int   u_waveCount;

// ── fidelity ────────────────────────────────────────────────────────────
uniform float u_vtx;              // Geometric Flux   0..1
uniform float u_lx;               // Atmospheric Lumens 0..1
uniform float u_aq;               // Hydrology        0..1
uniform float u_cellSize;         // metres — the active MeshPolicy
uniform float u_chamfer;
uniform float u_time;
uniform float u_seaLevel;

// position.y already carries H_prev (the pre-wave surface).
// a_heightNext carries H_next (what this vertex becomes once swept).
in float a_heightNext;

out vec3  v_world;
out vec3  v_normal;
out vec2  v_uv;
out float v_morph;        // 0..1 — how far through the geomorph this vertex is
out float v_bandGlow;     // 1 at the band centre, 0 away from it
out float v_wet;
out float v_height;

// C¹ smoothstep: S(0)=0 S(1)=1 S'(0)=S'(1)=0.
// Zero end-derivatives mean vertical VELOCITY is continuous, so the ground
// swells and settles instead of clicking into place. A linear blend is C⁰
// and players read its endpoints as a pop even though no vertex jumped.
float smoothstepC1(float u) {
  float t = clamp(u, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// C² quintic for tall silhouettes read against the sky.
float smoothstepC2(float u) {
  float t = clamp(u, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// s is a pure function of WORLD POSITION — never of chunk index. That single
// property is why two neighbouring chunks sampling a shared boundary point
// compute the same blend factor to the bit, on every tick of the sweep.
// The seam is therefore stable DURING the transition, which is the case that
// normally breaks LOD systems.
float waveBlend(vec2 p) {
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= u_waveCount) break;
    float d  = distance(p, u_waveOrigin[i]);
    float si = smoothstepC1((u_waveRadius[i] - d) / max(u_waveThickness[i], 0.001));
    s = max(s, si);
  }
  return s;
}

float bandProximity(vec2 p) {
  float g = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= u_waveCount) break;
    float d = distance(p, u_waveOrigin[i]);
    g = max(g, 1.0 - clamp(abs(d - u_waveRadius[i]) / u_waveThickness[i], 0.0, 1.0));
  }
  return g;
}

// Quantise toward the voxel plateau. At u_vtx = 0 this returns a hard step
// (Stage 1 cubes); as Vtx rises the chamfer term reintroduces the true
// surface, so CUBIC → CHAMFER → DUAL is one continuous expression.
float voxelise(float h, float cell, float chamfer) {
  float plateau = floor(h / cell + 0.5) * cell;
  return mix(plateau, h, chamfer * 2.0);
}

void main() {
  vec3 wp = position;

  float hPrev = voxelise(position.y, u_cellSize, 0.0);
  float hNext = mix(voxelise(a_heightNext, u_cellSize, u_chamfer), a_heightNext, u_vtx);

  float s  = waveBlend(position.xz);
  v_morph  = s;

  // THE GEOMORPH:  H(x,z,t) = lerp(H_prev, H_next, S((r − d)/Δr))
  wp.y = mix(hPrev, hNext, s);

  // the band itself lifts a few centimetres — a visible pressure ridge
  float glow = bandProximity(position.xz);
  v_bandGlow = glow;
  wp.y += glow * 0.45 * u_vtx;

  v_world  = wp;
  v_height = wp.y;
  v_uv     = uv;
  v_normal = normalize(normalMatrix * normal);

  // Aq wets anything near or below sea level, plus a shoreline band
  v_wet = clamp(u_aq * 1.2 - smoothstep(u_seaLevel - 1.0, u_seaLevel + 6.0, wp.y), 0.0, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
}
`;

/* ═════════════════════════════════════════════════════ FRAGMENT SHADER ══ */

export const TERRAIN_FRAG = /* glsl */ `
uniform float u_pxd;              // Pixel Density      0..1
uniform float u_vtx;
uniform float u_lx;
uniform float u_aq;
uniform float u_time;
uniform float u_seaLevel;

uniform float u_paletteLevels;    // −1 hard 4-colour · 0 truecolour · n levels
uniform vec3  u_palette[8];
uniform int   u_paletteCount;
uniform float u_relief;           // Vtx-driven normal strength
uniform float u_triSharp;         // triplanar sharpness
uniform float u_octaves;          // Pxd-driven fBm octaves
uniform vec3  u_sunDir;
uniform vec3  u_skyTop;
uniform vec3  u_skyHorizon;
uniform vec3  u_waterTint;
uniform float u_rain;

in vec3  v_world;
in vec3  v_normal;
in vec2  v_uv;
in float v_morph;
in float v_bandGlow;
in float v_wet;
in float v_height;

// ── 4×4 Bayer ordered dither ────────────────────────────────────────────
// Stage 1 & 2 run an honest low-bit framebuffer. The dither is what turns
// a 4-colour ramp into a perceived gradient, and watching that gradient
// resolve into true colour is the player's first fidelity reward.
const mat4 BAYER = mat4(
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);
float bayer(vec2 fragXY) {
  ivec2 p = ivec2(mod(fragXY, 4.0));
  return BAYER[p.x][p.y] / 16.0 - 0.5;
}

// ── value noise / fBm ───────────────────────────────────────────────────
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
}
// Octave count is driven by Pxd. The loop bound is a constant so the shader
// never recompiles; the OCTAVE BUDGET is a uniform that fades the tail off,
// which also means the transition between octave counts is continuous.
float fbm(vec2 p) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 8; i++) {
    float w = clamp(u_octaves - float(i), 0.0, 1.0);
    if (w <= 0.0) break;
    s += a * vnoise(p) * w;
    n += a * w;
    p *= 2.03; a *= 0.52;
  }
  return n > 0.0 ? s / n : 0.0;
}

// ── triplanar ───────────────────────────────────────────────────────────
vec3 triWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(u_triSharp));
  return w / max(w.x + w.y + w.z, 1e-4);
}
float triNoise(vec3 p, vec3 w) {
  return fbm(p.yz) * w.x + fbm(p.xz) * w.y + fbm(p.xy) * w.z;
}

// ── palette quantisation ────────────────────────────────────────────────
vec3 quantise(vec3 c, vec2 fragXY) {
  if (u_paletteLevels < 0.0) {
    // hard N-colour ramp indexed by dithered luminance (Stage 1)
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float idx = clamp(lum * float(u_paletteCount - 1) + bayer(fragXY) * 1.05,
                      0.0, float(u_paletteCount - 1));
    int i0 = int(floor(idx));
    return u_palette[i0];
  }
  if (u_paletteLevels < 0.5) return c;   // truecolour
  float q  = 1.0 / (u_paletteLevels - 1.0);
  float dd = clamp(1.0 - (u_paletteLevels - 3.0) / 22.0, 0.0, 1.0) * q * 0.85;
  return floor(c / q + bayer(fragXY) * dd / q + 0.5) * q;
}

// ── caustics (Stage 4) ──────────────────────────────────────────────────
// Two crossed wave trains warped by a swell. Real caustics ARE interference;
// this is the same construction as the Caustic Water cartridge, which is why
// the two read as the same phenomenon.
float caustics(vec2 p, float t) {
  vec2 q = p * 0.35 + vec2(fbm(p * 0.12 + t * 0.03) * 1.4);
  float a = sin(q.x * 2.1 + t * 1.3) * 0.5 + 0.5;
  float b = sin(q.y * 2.7 - t * 1.1 + sin(q.x * 1.3) * 1.7) * 0.5 + 0.5;
  float c = a * b;
  return pow(c, 3.0);
}

// ── GGX ────────────────────────────────────────────────────────────────
float distGGX(float ndh, float rough) {
  float a = rough * rough;
  float a2 = a * a;
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  return a2 / max(3.14159265 * d * d, 1e-6);
}
float smithG(float ndv, float ndl, float rough) {
  float k = (rough + 1.0) * (rough + 1.0) / 8.0;
  float gv = ndv / (ndv * (1.0 - k) + k);
  float gl = ndl / (ndl * (1.0 - k) + k);
  return gv * gl;
}

void main() {
  vec3  N  = normalize(v_normal);
  vec3  W  = triWeights(N);
  vec3  V  = normalize(-v_world + vec3(0.0, 90.0, 180.0));
  vec3  L  = normalize(u_sunDir);

  // ── surface detail · Pxd drives octaves, Vtx drives relief ────────────
  float det = triNoise(v_world * 0.07, W);
  float fine = triNoise(v_world * 0.31, W);

  // perturb the normal by the height gradient (Stage 3 onward)
  float e = 0.35;
  float hx = triNoise((v_world + vec3(e,0,0)) * 0.07, W)
           - triNoise((v_world - vec3(e,0,0)) * 0.07, W);
  float hz = triNoise((v_world + vec3(0,0,e)) * 0.07, W)
           - triNoise((v_world - vec3(0,0,e)) * 0.07, W);
  vec3 Nd = normalize(N + vec3(-hx, 0.0, -hz) * u_relief * 6.0 * step(0.18, u_lx));

  // ── albedo from the altitude band ─────────────────────────────────────
  float band = clamp((v_height + 20.0) / 44.0 + det * 0.22 - 0.1, 0.0, 1.0);
  float pf   = band * float(max(u_paletteCount - 1, 1));
  int   pi   = int(floor(pf));
  vec3  base = mix(u_palette[pi], u_palette[min(pi + 1, u_paletteCount - 1)], fract(pf));
  base = mix(base, base * (0.82 + fine * 0.36), smoothstep(0.1, 0.6, u_pxd));

  // ── Aq · wetness darkening + specular boost ───────────────────────────
  float wet = clamp(v_wet + u_rain * 0.45, 0.0, 1.0);
  base = mix(base, base * 0.42 * u_waterTint * 2.0, wet * 0.7);
  float rough = clamp(mix(0.92, 0.08, wet) - fine * 0.12, 0.03, 1.0);
  float metal = 0.0;

  // ── lighting · the Lx ladder, all in one expression ───────────────────
  float ndl = max(dot(Nd, L), 0.0);
  float ndv = max(dot(Nd, V), 1e-3);

  // S1 unlit → S2 lambert → S3+ shadow-ish wrap → S5 GGX
  float ambient = mix(1.0, 0.34, u_lx);
  float lambert = mix(0.0, 0.30 + 0.95 * ndl, smoothstep(0.02, 0.35, u_lx));
  vec3  lit     = base * (ambient + lambert);

  float pbrMix = smoothstep(0.42, 0.78, u_lx);
  if (pbrMix > 0.001) {
    vec3  H   = normalize(L + V);
    float ndh = max(dot(Nd, H), 0.0);
    float D   = distGGX(ndh, rough);
    float G   = smithG(ndv, max(ndl, 1e-3), rough);
    float F0m = mix(0.04, 1.0, metal);
    float F   = F0m + (1.0 - F0m) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    vec3  spec = vec3(D * G * F / (4.0 * ndv * max(ndl, 1e-3))) * ndl;
    vec3  diff = base * (1.0 - metal) * ndl / 3.14159265;
    lit = mix(lit, (diff + spec) * 3.0 + base * 0.26, pbrMix);
  }

  // ── Stage 4 · water, Beer–Lambert absorption, caustics ────────────────
  if (v_height < u_seaLevel && u_aq > 0.05) {
    float depth = clamp((u_seaLevel - v_height) / 14.0, 0.0, 1.0);
    // Beer–Lambert: transmittance falls exponentially, per channel
    vec3 absorb = exp(-depth * vec3(2.4, 0.9, 0.42) * 1.8);
    float caus  = caustics(v_world.xz, u_time) * (1.0 - depth) * smoothstep(0.25, 0.6, u_aq);
    lit = lit * absorb + u_waterTint * (0.12 + caus * 0.9) * smoothstep(0.05, 0.4, u_aq);
    float fres = pow(1.0 - ndv, 4.0);
    lit += u_skyHorizon * fres * 0.55 * u_lx;
  }

  // ── aerial perspective ────────────────────────────────────────────────
  float dist = length(v_world - vec3(0.0, 90.0, 180.0));
  float fog  = clamp((dist - 90.0) / 240.0, 0.0, 1.0) * smoothstep(0.18, 0.8, u_lx) * 0.85;
  lit = mix(lit, mix(u_skyHorizon, u_skyTop, 0.3), fog);

  // ── the Bloom front ───────────────────────────────────────────────────
  // alpha-hash stochastic coverage inside the band. Stochastic beats a
  // dissolve texture because the hash is temporally jittered: the transition
  // never bands and never reveals a pattern.
  float hashN = hash21(gl_FragCoord.xy + fract(u_time) * 71.3);
  if (v_bandGlow > 0.02) {
    float edge = v_bandGlow * v_bandGlow;
    lit += vec3(0.55, 0.95, 0.65) * edge * 0.42;
    if (hashN > v_morph + 0.55) lit *= 0.55;   // the dither grain in the band
  }

  // ── tonemap + quantise ────────────────────────────────────────────────
  lit = lit / (lit + vec3(0.72));                       // Reinhard
  lit = pow(max(lit, vec3(0.0)), vec3(1.0 / 2.2));      // gamma
  lit = quantise(lit, gl_FragCoord.xy);

  fragColour = vec4(lit, 1.0);
}
`;

/* ═══════════════════════════════════════════════════════════ UNIFORMS ══ */

export interface TerrainUniformValues {
  u_pxd: number; u_vtx: number; u_lx: number; u_aq: number;
  u_time: number; u_seaLevel: number; u_rain: number;
  u_paletteLevels: number; u_palette: number[]; u_paletteCount: number;
  u_relief: number; u_triSharp: number; u_octaves: number;
  u_cellSize: number; u_chamfer: number;
  u_sunDir: [number, number, number];
  u_skyTop: [number, number, number];
  u_skyHorizon: [number, number, number];
  u_waterTint: [number, number, number];
  u_waveOrigin: number[]; u_waveRadius: number[];
  u_waveThickness: number[]; u_waveDir: number[]; u_waveCount: number;
}

const STAGE_PALETTES: [number, number, number][][] = [
  [[0.17,0.18,0.21],[0.29,0.32,0.36],[0.43,0.46,0.51],[0.60,0.64,0.69]],
  [[0.23,0.20,0.25],[0.42,0.35,0.39],[0.60,0.54,0.52],[0.80,0.75,0.68]],
  [[0.29,0.26,0.21],[0.42,0.39,0.31],[0.54,0.54,0.44],[0.71,0.71,0.60]],
  [[0.24,0.29,0.21],[0.36,0.42,0.26],[0.54,0.52,0.35],[0.73,0.67,0.53]],
  [[0.18,0.36,0.20],[0.29,0.50,0.25],[0.44,0.63,0.29],[0.66,0.75,0.48]],
  [[0.17,0.37,0.23],[0.25,0.54,0.29],[0.45,0.69,0.36],[0.81,0.88,0.63]],
];
const SKIES: [[number,number,number],[number,number,number]][] = [
  [[0.01,0.01,0.04],[0.02,0.02,0.05]],
  [[0.03,0.04,0.08],[0.09,0.10,0.20]],
  [[0.09,0.14,0.23],[0.23,0.33,0.45]],
  [[0.17,0.31,0.47],[0.53,0.71,0.87]],
  [[0.25,0.50,0.77],[0.66,0.82,0.94]],
  [[0.24,0.53,0.83],[0.81,0.91,1.00]],
];

/**
 *  FidelityState + RenderBudget → uniform block.
 *  This is the ONLY function the render loop calls per frame. There is no
 *  branching on stage anywhere in the material; the stage is an input.
 */
export function uniformsFor(
  s: FidelityState,
  b: RenderBudget,
  opts: { time: number; waves?: { origin: [number, number]; radius: number; thickness: number; dir: 1 | -1 }[] } ,
): TerrainUniformValues {
  const n = normalised(s);
  const i = Math.min(5, Math.max(0, b.stage - 1));
  const t = Math.min(1, Math.max(0, n.pxd * 6 - i));
  const lerp3 = (a: number[], c: number[], k: number) =>
    [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k];

  const palA = STAGE_PALETTES[i];
  const palB = STAGE_PALETTES[Math.min(5, i + 1)];
  const palette: number[] = [];
  for (let k = 0; k < 4; k++) palette.push(...lerp3(palA[k], palB[k], t));
  while (palette.length < 24) palette.push(0, 0, 0);

  const skyA = SKIES[i], skyB = SKIES[Math.min(5, i + 1)];
  const waves = (opts.waves ?? []).slice(0, 4);
  const origin: number[] = [], radius: number[] = [], thick: number[] = [], dir: number[] = [];
  for (let k = 0; k < 4; k++) {
    const w = waves[k];
    origin.push(w ? w.origin[0] : 0, w ? w.origin[1] : 0);
    radius.push(w ? w.radius : -1e9);
    thick.push(w ? w.thickness : 1);
    dir.push(w ? w.dir : 1);
  }

  return {
    u_pxd: n.pxd, u_vtx: n.vtx, u_lx: n.lx, u_aq: n.aq,
    u_time: opts.time,
    u_seaLevel: -20 + n.aq * 23,
    u_rain: Math.max(0, (n.aq - 0.52) * 2.2),
    u_paletteLevels: b.paletteLevels,
    u_palette: palette,
    u_paletteCount: 4,
    u_relief: b.relief,
    u_triSharp: 2 + b.relief * 3,
    u_octaves: b.octaveBudget,
    u_cellSize: [8, 4, 2, 1, 0.5, 0.25][Math.min(5, Math.round(n.vtx * 5))],
    u_chamfer: n.vtx < 0.08 ? 0 : n.vtx < 0.3 ? ((n.vtx - 0.08) / 0.22) * 0.5 : 0.5,
    u_sunDir: [Math.cos(0.9) * 0.55, 0.72, -0.42],
    u_skyTop: lerp3(skyA[0], skyB[0], t) as [number, number, number],
    u_skyHorizon: lerp3(skyA[1], skyB[1], t) as [number, number, number],
    u_waterTint: [0.11, 0.44, 0.62],
    u_waveOrigin: origin, u_waveRadius: radius,
    u_waveThickness: thick, u_waveDir: dir, u_waveCount: waves.length,
  };
}

/* ══════════════════════════════════════════════════ THREE.JS FACTORY ══ */

/**
 *  Minimal structural type so this file never imports three — the web client
 *  passes its own THREE namespace in. Keeps `packages/*` free of a 600 kB
 *  dependency and lets the same GLSL run under raw WebGL2 in tests.
 */
export interface ThreeLike {
  ShaderMaterial: new (params: Record<string, unknown>) => {
    uniforms: Record<string, { value: unknown }>;
  };
  GLSL3: unknown;
  DoubleSide: unknown;
}

export function createTerrainMaterial(THREE: ThreeLike, init: TerrainUniformValues) {
  const uniforms: Record<string, { value: unknown }> = {};
  for (const [k, v] of Object.entries(init)) uniforms[k] = { value: v };

  // Three.js injects projectionMatrix / modelViewMatrix / normalMatrix and the
  // position|normal|uv attributes for us, but under GLSL3 it does NOT declare
  // a fragment output — that is ours to name. Everything else is shared with
  // the standalone build byte for byte.
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: TERRAIN_VERT,
    fragmentShader: `out vec4 fragColour;\n${TERRAIN_FRAG}`,
    side: THREE.DoubleSide,
    // No #define anywhere. No variants. No runtime compilation. Ever.
    defines: {},
  });
}

/** Per-frame update. Mutates in place — zero allocation in the render loop. */
export function updateTerrainMaterial(
  mat: { uniforms: Record<string, { value: unknown }> },
  next: TerrainUniformValues,
) {
  for (const [k, v] of Object.entries(next)) {
    const u = mat.uniforms[k];
    if (u) u.value = v;
  }
}

/** Standalone WebGL2 sources (used by the in-document viewport and by tests
 *  that compile the shader headlessly in CI). */
export const STANDALONE_VERT = `#version 300 es\n${STANDALONE_PRELUDE_VERT}${TERRAIN_VERT}`;
export const STANDALONE_FRAG = `#version 300 es\n${STANDALONE_PRELUDE_FRAG}${TERRAIN_FRAG}`;
