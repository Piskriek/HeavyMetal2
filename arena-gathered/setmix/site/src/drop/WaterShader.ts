/* ============================================================================
 *  packages/setmix-ecosystem/src/WaterShader.ts
 *  ---------------------------------------------------------------------------
 *  THE HYDROSPHERE.
 *
 *  The water table is not a prop the designer placed — it is a scalar derived
 *  from Aq, and the coastline is wherever that scalar intersects the terrain.
 *  Raise Aq and craters become lakes, lakes become seas, and the player's own
 *  extractor farm can drown. That is the whole Stage-4 drama, and it costs one
 *  uniform.
 *
 *  Everything below is ONE program. Like the terrain uber-shader, every stage
 *  transition is a uniform change — no variants, no runtime compilation.
 * ==========================================================================*/

import type { FidelityState } from "./contracts.setmix";
import { normalised } from "./fidelity";

/* ═══════════════════════════════════════════════════════ VERTEX SHADER ══ */

export const WATER_VERT = /* glsl */ `
uniform float u_time;
uniform float u_aq;
uniform float u_seaLevel;
uniform vec2  u_wind;
uniform int   u_waveCount;

out vec3  v_world;
out vec3  v_normal;
out float v_depthBelow;     // metres of water column under this vertex
out vec3  v_viewDir;
out float v_foamHint;

uniform vec3 u_camPos;
// terrain height sampled into a vertex attribute by the chunk builder, so the
// shader knows how deep the water is WITHOUT a depth pre-pass. One attribute
// buys us absorption, foam and caustic attenuation.
in float a_bedHeight;

/*  GERSTNER WAVES
 *  Unlike a sum of sines, Gerstner displaces X and Z as well as Y, so crests
 *  sharpen and troughs broaden — the shape real water has. The analytic
 *  derivative gives us an exact normal, so there is no normal-map sampling
 *  and no mip aliasing out at the horizon.
 *
 *      P = (x + Σ Qᵢ·Aᵢ·Dᵢ.x·cos(wᵢ·D·P + φt),
 *           Σ Aᵢ·sin(wᵢ·D·P + φt),
 *           z + Σ Qᵢ·Aᵢ·Dᵢ.y·cos(...))
 *
 *  Q is the steepness; Σ(Qᵢ·wᵢ·Aᵢ) must stay ≤ 1 or the surface self-
 *  intersects and you get the classic "water turning inside out" artefact.
 */
struct Gerstner { vec2 dir; float amp; float len; float speed; float steep; };

Gerstner waveAt(int i, float aq) {
  // four octaves, each derived from Aq so the sea grows up as the planet does
  float f = float(i);
  float scale = pow(0.58, f);
  Gerstner g;
  float ang = 0.6 + f * 2.39996;                 // golden-angle spread
  g.dir   = normalize(vec2(cos(ang), sin(ang)) + u_wind * 0.35);
  g.len   = (26.0 * scale) / max(0.25, aq);
  g.amp   = (0.42 * scale) * smoothstep(0.08, 0.7, aq);
  g.speed = sqrt(9.8 * 6.2831 / max(g.len, 0.5)) * 0.22;
  g.steep = 0.72 * scale;
  return g;
}

void main() {
  vec3 p = position;
  p.y = u_seaLevel;

  vec3 nrm = vec3(0.0, 1.0, 0.0);
  float sumSteep = 0.0;

  for (int i = 0; i < 4; i++) {
    if (i >= u_waveCount) break;
    Gerstner g = waveAt(i, u_aq);
    float w = 6.2831 / max(g.len, 0.5);
    float phase = w * dot(g.dir, position.xz) + u_time * g.speed * w;
    float c = cos(phase), s = sin(phase);
    float Q = g.steep / max(w * g.amp * float(u_waveCount), 1e-3);
    sumSteep += Q * w * g.amp;

    p.x += Q * g.amp * g.dir.x * c;
    p.z += Q * g.amp * g.dir.y * c;
    p.y += g.amp * s;

    // analytic normal — exact, no texture fetch, no aliasing
    nrm.x -= g.dir.x * w * g.amp * c;
    nrm.z -= g.dir.y * w * g.amp * c;
    nrm.y -= Q * w * g.amp * s;
  }

  v_world      = p;
  v_normal     = normalize(nrm);
  v_depthBelow = max(0.0, u_seaLevel - a_bedHeight);
  v_viewDir    = normalize(u_camPos - p);
  v_foamHint   = clamp(sumSteep, 0.0, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

/* ═════════════════════════════════════════════════════ FRAGMENT SHADER ══ */

export const WATER_FRAG = /* glsl */ `
uniform float u_time;
uniform float u_aq;
uniform float u_lx;
uniform float u_pxd;
uniform float u_seaLevel;
uniform vec3  u_sunDir;
uniform vec3  u_skyTop;
uniform vec3  u_skyHorizon;
uniform vec3  u_shallow;      // turquoise
uniform vec3  u_deep;         // navy abyss
uniform vec3  u_absorb;       // Beer-Lambert σ per channel
uniform float u_foamWidth;
uniform float u_paletteLevels;
uniform float u_causticGain;

in vec3  v_world;
in vec3  v_normal;
in float v_depthBelow;
in vec3  v_viewDir;
in float v_foamHint;

float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), u.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y);
}

/*  CAUSTICS
 *  Real caustics are an interference pattern: two crossed wave trains,
 *  each domain-warped by a slow swell, multiplied and sharpened. This is
 *  the identical construction the Caustic Water CARTRIDGE uses, which is
 *  why the two read as the same physical phenomenon rather than as two
 *  separate effects that happen to look wet.
 */
float caustics(vec2 p, float t) {
  vec2 q = p * 0.22 + vec2(vnoise(p * 0.07 + t * 0.035) * 1.6);
  float a = sin(q.x * 2.3 + t * 1.25) * 0.5 + 0.5;
  float b = sin(q.y * 2.9 - t * 1.05 + sin(q.x * 1.4) * 1.9) * 0.5 + 0.5;
  float c = a * b;
  return pow(c, 3.4);
}

/*  BEER-LAMBERT
 *  T(d) = exp(-σ·d), evaluated per channel. Red extinguishes in ~2 m,
 *  green in ~8 m, blue in ~25 m — which is precisely why shallow water is
 *  turquoise and deep water is navy. We are not tinting by depth with a
 *  gradient; we are attenuating by wavelength, and the gradient falls out.
 */
vec3 transmittance(float d) { return exp(-u_absorb * d); }

float bayer(vec2 c){
  ivec2 p = ivec2(mod(c, 4.0));
  float m[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
  return m[p.y*4 + p.x] / 16.0 - 0.5;
}

out vec4 fragColour;

void main() {
  vec3 N = normalize(v_normal);
  vec3 V = normalize(v_viewDir);
  vec3 L = normalize(u_sunDir);
  float d = v_depthBelow;

  /* ── absorption: the colour of the water column ──────────────────── */
  vec3 T = transmittance(d);
  vec3 bodyCol = mix(u_deep, u_shallow, T.b);
  float caus = caustics(v_world.xz, u_time) * u_causticGain
             * exp(-d * 0.09) * smoothstep(0.2, 0.6, u_aq);
  bodyCol += vec3(0.55, 0.85, 0.75) * caus * 0.55;
  bodyCol *= mix(0.45, 1.0, T.g);

  /* ── FRESNEL (Schlick) + planar sky reflection ───────────────────── *
   *  F₀ = 0.02 for water. At grazing angles F → 1, which is why a lake
   *  is a mirror at the far shore and a window at your feet. Getting the
   *  exponent right is the single biggest "is this water" cue. */
  float ndv  = max(dot(N, V), 1e-3);
  float F    = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3  R     = reflect(-V, N);
  vec3  skyC  = mix(u_skyHorizon, u_skyTop, clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
  float sunSpec = pow(max(dot(R, L), 0.0), mix(60.0, 900.0, u_lx)) * u_lx * 3.2;

  vec3 col = mix(bodyCol, skyC, F * mix(0.35, 1.0, u_lx));
  col += vec3(1.0, 0.96, 0.88) * sunSpec;

  /* ── SHORELINE FOAM ───────────────────────────────────────────────── *
   *  Depth-difference edge detection: where the water column is thinner
   *  than u_foamWidth we are at a shore, a rock or a sandbar. Modulated by
   *  wave steepness so foam gathers on crests, and dissolved by noise so
   *  the band never reads as an outline. */
  float shoreT = 1.0 - smoothstep(0.0, u_foamWidth, d);
  float churn  = vnoise(v_world.xz * 1.6 + u_time * 0.45);
  float foam   = smoothstep(0.42, 0.95, shoreT * (0.55 + v_foamHint * 0.9) + churn * 0.35);
  // a second, tighter band right at the waterline: the wet-sand lip
  foam = max(foam, smoothstep(0.86, 1.0, shoreT) * 0.8);
  col  = mix(col, vec3(0.93, 0.97, 1.0), foam * smoothstep(0.1, 0.4, u_aq));

  /* ── alpha: shallow water is see-through, deep water is not ───────── */
  float alpha = mix(0.42, 0.97, clamp(d / 5.0, 0.0, 1.0));
  alpha = max(alpha, foam * 0.95);
  alpha = max(alpha, F * 0.85);

  /* ── the palette ladder applies to water too ─────────────────────── */
  col = col / (col + vec3(0.78));
  col = pow(max(col, vec3(0.0)), vec3(1.0/2.2));
  if (u_paletteLevels > 0.5) {
    float q = 1.0 / (u_paletteLevels - 1.0);
    col = floor(col / q + bayer(gl_FragCoord.xy) * 0.75 + 0.5) * q;
  }

  fragColour = vec4(col, alpha);
}
`;

/* ═══════════════════════════════════════════════════════════ UNIFORMS ══ */

export interface WaterUniforms {
  u_time: number;
  u_aq: number; u_lx: number; u_pxd: number;
  u_seaLevel: number;
  u_wind: [number, number];
  u_waveCount: number;
  u_camPos: [number, number, number];
  u_sunDir: [number, number, number];
  u_skyTop: [number, number, number];
  u_skyHorizon: [number, number, number];
  u_shallow: [number, number, number];
  u_deep: [number, number, number];
  u_absorb: [number, number, number];
  u_foamWidth: number;
  u_paletteLevels: number;
  u_causticGain: number;
}

/** Sea level is a pure function of Aq. This one line is the Stage-4 drama. */
export function seaLevelFor(fi: FidelityState): number {
  const n = normalised(fi);
  return -20 + n.aq * 23;
}

export function waterUniforms(
  fi: FidelityState, o: { time: number; camPos: [number, number, number];
  wind: [number, number]; paletteLevels: number;
  skyTop: [number, number, number]; skyHorizon: [number, number, number] },
): WaterUniforms {
  const n = normalised(fi);
  return {
    u_time: o.time,
    u_aq: n.aq, u_lx: n.lx, u_pxd: n.pxd,
    u_seaLevel: seaLevelFor(fi),
    u_wind: o.wind,
    // wave octaves are an Aq read-out, exactly as the GDD specified
    u_waveCount: Math.max(1, Math.min(4, Math.floor(n.aq * 5))),
    u_camPos: o.camPos,
    u_sunDir: [Math.cos(0.9) * 0.55, 0.72, -0.42],
    u_skyTop: o.skyTop,
    u_skyHorizon: o.skyHorizon,
    u_shallow: [0.18, 0.72, 0.68],
    u_deep: [0.015, 0.07, 0.19],
    // per-channel extinction, m⁻¹. Red dies first; this IS why water is blue.
    u_absorb: [0.46, 0.11, 0.035],
    u_foamWidth: 1.1 + n.aq * 1.4,
    u_paletteLevels: o.paletteLevels,
    u_causticGain: 0.4 + n.lx * 1.4,
  };
}

/* ══════════════════════════════════ BUOYANCY · SWIM · UNDERWATER AUDIO ══ */

export interface BuoyancyResult {
  submersion: number;
  /** net vertical acceleration from Archimedes minus gravity, m/s² */
  upthrust: number;
  drag: number;
  /** true when the head is below the surface */
  headUnder: boolean;
  /** 0..1 blend into the underwater audio bus */
  audioBlend: number;
}

/**
 *  Archimedes with a soft entry: upthrust is proportional to displaced
 *  volume, which for a capsule entering a plane is a smooth ramp rather
 *  than a step. The ramp is what stops the player bobbing like a cork at
 *  the exact waterline — the single most common buoyancy bug.
 */
export function buoyancy(
  feetY: number, height: number, seaLevel: number,
  vel: [number, number, number],
): BuoyancyResult {
  const submersion = Math.max(0, Math.min(1, (seaLevel - feetY) / Math.max(0.3, height)));
  const headUnder = feetY + height * 0.92 < seaLevel;
  const displaced = submersion * submersion * (3 - 2 * submersion);  // C¹ ramp
  const upthrust = 13.5 * displaced;
  const speed = Math.hypot(vel[0], vel[1], vel[2]);
  const drag = 3.1 * displaced * (1 + speed * 0.08);
  return {
    submersion, upthrust, drag, headUnder,
    audioBlend: headUnder ? 1 : submersion * 0.35,
  };
}

export interface UnderwaterAudio {
  lowpassHz: number;
  resonanceQ: number;
  reverbSeconds: number;
  bubbleRate: number;
  /** muffles the surface world, not the player's own foley */
  worldGain: number;
  pitchShift: number;
}

/**
 *  400 Hz low-pass with a resonant Q is the canonical "head underwater"
 *  cue — it is what a 20 cm air cavity does to a broadband source. The
 *  bubble rate is tied to depth so diving deeper is audibly committing.
 */
export function underwaterAudio(b: BuoyancyResult, depthM: number): UnderwaterAudio {
  const t = b.audioBlend;
  return {
    lowpassHz: 20000 - t * 19600,        // → 400 Hz fully under
    resonanceQ: 0.7 + t * 5.5,
    reverbSeconds: 0.4 + t * 2.6,
    bubbleRate: t * (2 + Math.min(8, depthM * 0.6)),
    worldGain: 1 - t * 0.72,
    pitchShift: 1 - t * 0.04,            // slight downward drift; sells pressure
  };
}

export const WATER_NOTES = [
  ["Gerstner, not sines",
   "Displacing X and Z as well as Y sharpens crests and broadens troughs — the shape real water has. Σ(Q·w·A) is clamped ≤ 1 or the surface self-intersects and turns inside out."],
  ["Analytic normals",
   "The Gerstner derivative is exact, so there is no normal-map fetch and no mip aliasing at the horizon. The sea stays crisp at 2 km, which a texture-based ocean never does."],
  ["Beer–Lambert, per channel",
   "σ = (0.46, 0.11, 0.035) m⁻¹. Red extinguishes in ~2 m, blue in ~25 m. We do not tint by depth — we attenuate by wavelength, and turquoise-to-navy falls out of the physics."],
  ["Depth from an attribute, not a pre-pass",
   "The chunk builder writes the bed height into a_bedHeight. One float per vertex buys absorption, foam and caustic attenuation with zero extra render targets — which is what makes this affordable on the mobile profile."],
  ["Foam is edge detection",
   "Water thinner than u_foamWidth is a shore, a rock or a sandbar. Modulated by wave steepness so foam gathers on crests, dissolved by noise so it never reads as an outline."],
] as const;
