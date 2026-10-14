// The leak overlay (TASK-23b-2): a monster keeps its own colours, and the leak is an overlay on them (Argo's O3; P0-MON-01 steps 1 to
// 3; P0-MON-02). Four things, all in the monster's own material: the gore reds go grey, the skin is pulled towards the gunmetal
// palette by its remapStrength (0.20 by default), the picture is quantised to the stage of the ground it stands on, and an
// archetype-coloured rim glows, pulsing on the wind-up. Horizontal glitch slices shift the bands on the wind-up and the pain.
// The pure helpers are tested (overlay.test.ts); the chunks are used by the sprite batch (sprite-batch.ts) and the 3D skins
// (model-instance.ts). No DOM, no clock: the time comes in as a uniform.
import * as THREE from 'three';
import type { Archetype } from './roster';

/** The rim colours by kind (Argo's O3): melee magenta, ranged amber, the rest cyan. */
export const RIM = Object.freeze({ melee: 0xff3d8a, ranged: 0xffc13d, other: 0x3dc8ff });

/** The rim colour of an archetype: charger, brute and swarmer are melee; spitter and flyer ranged; sapper the rest. */
export function rimOf(kind: Archetype): number {
  if (kind === 'charger' || kind === 'brute' || kind === 'swarmer') return RIM.melee;
  if (kind === 'spitter' || kind === 'flyer') return RIM.ranged;
  return RIM.other;
}

/**
 * The quantisation steps a channel gets on a ground of this stage (P0-MON-01 step 2): stage 0 is 1-bit (two steps), stage 1 is the
 * 16-colour look (four steps), stage 2 the 256-colour look (six steps); from stage 3 the monster is smooth (0: no quantisation).
 */
export function levelsFor(stage: number): number {
  const s = Math.floor(stage);
  if (s <= 0) return 1;
  if (s === 1) return 3;
  if (s === 2) return 5;
  return 0;
}

/** The emissive rim's strength: 0.2 at rest, rising from 0.2 to 2.0 over the first 350 ms of a wind-up (P0-MON-02); null is no wind-up. */
export function pulseFor(windupT: number | null): number {
  if (windupT === null) return 0.2;
  return 0.2 + 1.8 * Math.min(1, Math.max(0, windupT) / 0.35);
}

/** The glitch slice strength: up on the wind-up and the pain, none otherwise. */
export function sliceFor(phase: 'windup' | 'pain' | 'other'): number {
  if (phase === 'windup') return 0.8;
  if (phase === 'pain') return 1;
  return 0;
}

/** The look of one skin: its rim, its remap pull (0 to 1), and the quantisation steps of the ground it stands on. */
export interface Look {
  readonly rim: number;
  readonly remap: number;
  readonly levels: number;
}

/** The uniforms the overlay reads, shared by the materials of one monster (3D) or one skin (sprites). */
export interface OverlayUniforms {
  uRim: { value: THREE.Color };
  uPulse: { value: number };
  uRemap: { value: number };
  uLevels: { value: number };
  uSlice: { value: number };
  uTime: { value: number };
}

export function overlayUniforms(look: Look): OverlayUniforms {
  return {
    uRim: { value: new THREE.Color(look.rim) },
    uPulse: { value: 0.2 },
    uRemap: { value: look.remap },
    uLevels: { value: look.levels },
    uSlice: { value: 0 },
    uTime: { value: 0 },
  };
}

/** The GLSL the 3D skins take (uniforms, the glitch slices in the vertex stage, the overlay after the lighting). */
const UNIFORMS_GLSL = /* glsl */ `
uniform vec3 uRim;
uniform float uPulse;
uniform float uRemap;
uniform float uLevels;
uniform float uSlice;
uniform float uTime;
`;

const SLICE_GLSL = /* glsl */ `
transformed.x += uSlice * sin(floor((position.y + 1.0) * 9.0) * 12.9898 + uTime * 9.0) * 0.05;
`;

const OVERLAY_GLSL = /* glsl */ `
{
  vec3 c = gl_FragColor.rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float red = smoothstep(0.2, 0.42, c.r - max(c.g, c.b) * 1.5);
  c = mix(c, vec3(lum), red * 0.85);
  c = mix(c, vec3(lum) * vec3(0.78, 0.86, 0.96), uRemap);
  if (uLevels < 1.5 && uLevels > 0.5) {
    // stage 0: the one-bit look, an ordered (2x2 Bayer) dither of the luminance
    float bay = (mod(floor(gl_FragCoord.x), 2.0) + 2.0 * mod(floor(gl_FragCoord.y), 2.0)) / 4.0;
    c = vec3(step(bay * 0.8 + 0.1, lum * 1.5));
  } else if (uLevels > 1.5) {
    c = floor(c * uLevels + 0.5) / uLevels;
  }
  float rim = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.5);
  c += uRim * rim * uPulse;
  gl_FragColor.rgb = c;
}
`;

/**
 * Patches a standard material with the overlay. The material keeps its own maps and lighting; the overlay runs after them.
 * Call it on a material the instance owns (a clone), since the uniforms are per instance.
 */
export function patchStandard(mat: THREE.MeshStandardMaterial, u: OverlayUniforms): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${UNIFORMS_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SLICE_GLSL}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${UNIFORMS_GLSL}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${OVERLAY_GLSL}`);
  };
  mat.customProgramCacheKey = () => 'monster-leak-overlay';
  mat.needsUpdate = true;
}

/** The sprite overlay's uniforms (the batch's own shader: the atlas texel and the rim on the silhouette's inner edge). */
export const SPRITE_OVERLAY_VERT = /* glsl */ `
uniform float uSlice;
uniform float uTime;
`;
export const SPRITE_OVERLAY_FRAG = /* glsl */ `
uniform vec3 uRim;
uniform float uPulse;
uniform float uRemap;
uniform float uLevels;
uniform vec2 uTexel;
`;
/** Applied to the sprite's colour: the gore reds, the remap, the quantisation, and the rim on the silhouette's inner edge. */
export const SPRITE_OVERLAY_BODY = /* glsl */ `
  vec3 col = c.rgb * uTint;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float red = smoothstep(0.2, 0.42, col.r - max(col.g, col.b) * 1.5);
  col = mix(col, vec3(lum), red * 0.85);
  col = mix(col, vec3(lum) * vec3(0.78, 0.86, 0.96), uRemap);
  if (uLevels < 1.5 && uLevels > 0.5) {
    float bay = (mod(floor(gl_FragCoord.x), 2.0) + 2.0 * mod(floor(gl_FragCoord.y), 2.0)) / 4.0;
    col = vec3(step(bay * 0.8 + 0.1, lum * 1.5));
  } else if (uLevels > 1.5) {
    col = floor(col * uLevels + 0.5) / uLevels;
  }
  float e = 0.0;
  e = max(e, abs(step(0.5, texture2D(uAtlas, vUv + vec2(uTexel.x * 2.0, 0.0)).a) - 1.0));
  e = max(e, abs(step(0.5, texture2D(uAtlas, vUv - vec2(uTexel.x * 2.0, 0.0)).a) - 1.0));
  e = max(e, abs(step(0.5, texture2D(uAtlas, vUv + vec2(0.0, uTexel.y * 2.0)).a) - 1.0));
  e = max(e, abs(step(0.5, texture2D(uAtlas, vUv - vec2(0.0, uTexel.y * 2.0)).a) - 1.0));
  col += uRim * e * uPulse;
  gl_FragColor = vec4(col, 1.0);
`;
