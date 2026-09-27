/**
 * ISLAND-ROUTE: the island terrain's ground shader.
 *
 * The island's own texture is 2048 pixels across ~94,000 world units (about 45 units a pixel), so up
 * close it is soft. Two things fix that, both computed from the world position, so nothing tiles and
 * no repeat can show:
 *
 * - **Grain**: fine noise and tiny pebbles multiplied into the base colour, fading out with distance
 *   (from afar the base texture has enough detail of its own).
 * - **Painted sand**: a paint mask over the island (painted in build mode) lays sand over the
 *   texture: a plain, mottled sand with pitting and a scatter of pebbles, no ripples.
 *
 * The owner tunes both in build mode (Primitives or Custom 3D: click the terrain). The settings and the
 * mask are saved per island track, in the browser and on disk (backups/island/), and are keyed by
 * world position, so they survive a re-exported island model.
 */
import * as THREE from 'three';

export interface IslandGroundSettings {
  /** Multiplied into the island texture, #rrggbb. */
  tint: string;
  /** 1 = as painted by the texture. */
  brightness: number;
  /** How strongly the grain and pebbles show up close (0 = off). */
  grain: number;
  /** Size of the tiny pebbles in world units (the ball is 62 across). */
  pebbleSize: number;
  /** Share of the ground with a pebble (0..1). */
  pebbles: number;
  /** Painted sand: its colour, how much it covers the texture, its pebbles and its pitting. */
  sandColor: string;
  sandStrength: number;
  sandPebbles: number;
  /** How strongly the dirt's cracks show (0 = smooth). The key keeps its old name so saves still load. */
  sandPits: number;
  /** Size of the painted dirt's cracks and stones: 1 = as made, 2 = twice as big. */
  sandScale: number;
  /** The terrain's roughness (1 = fully matte). */
  roughness: number;
  /** Shine: how much glossier dark rock gets than the rest (a specular map made from the texture). */
  shine: number;
  /** How dark the baked sun shadows are (0 = off, 1 = no direct sun at all). */
  shadowStrength: number;
  /** Relief: how strongly pebbles stand up and cracks cut in, so light and shine catch them (0 = flat). */
  bump: number;
}

export const DEFAULT_ISLAND_GROUND: IslandGroundSettings = {
  tint: '#ffffff',
  brightness: 1,
  grain: 0.7,
  pebbleSize: 9,
  pebbles: 0.45,
  sandColor: '#c8b99c',
  sandStrength: 1,
  sandPebbles: 0.3,
  sandPits: 0.6,
  sandScale: 1,
  roughness: 0.95,
  shine: 0.5,
  shadowStrength: 0.8,
  bump: 0.6,
};

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const hex = (v: unknown, fallback: string) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;

export function normalizeIslandGround(raw: unknown): IslandGroundSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_ISLAND_GROUND;
  return {
    tint: hex(r.tint, d.tint),
    brightness: clamp(r.brightness, 0.3, 2, d.brightness),
    grain: clamp(r.grain, 0, 1, d.grain),
    pebbleSize: clamp(r.pebbleSize, 3, 40, d.pebbleSize),
    pebbles: clamp(r.pebbles, 0, 1, d.pebbles),
    sandColor: hex(r.sandColor, d.sandColor),
    sandStrength: clamp(r.sandStrength, 0, 1, d.sandStrength),
    sandPebbles: clamp(r.sandPebbles, 0, 1, d.sandPebbles),
    sandPits: clamp(r.sandPits, 0, 1, d.sandPits),
    sandScale: clamp(r.sandScale, 0.25, 4, d.sandScale),
    roughness: clamp(r.roughness, 0.2, 1, d.roughness),
    shine: clamp(r.shine, 0, 1, d.shine),
    shadowStrength: clamp(r.shadowStrength, 0, 1, d.shadowStrength),
    bump: clamp(r.bump, 0, 2, d.bump),
  };
}

/* ───────────── The paint mask ───────────── */

/** The painted square: centred on the island, a little wider than the model (world units). */
export const PAINT_HALF = 48000;
/** Mask pixels across (about 47 world units a pixel; the sand's own detail is procedural). */
export const PAINT_RES = 2048;

/** World (x, z) to mask pixel (fractional). */
export function paintPixel(x: number, z: number): { u: number; v: number } {
  return { u: ((x + PAINT_HALF) / (2 * PAINT_HALF)) * PAINT_RES, v: ((z + PAINT_HALF) / (2 * PAINT_HALF)) * PAINT_RES };
}

/**
 * Paints (or erases) a soft round dab into the mask. `radius` in world units, `strength` 0..1 per dab.
 * Returns the touched pixel rows (for a partial upload), or null when the dab is off the mask.
 */
export function paintDab(mask: Uint8Array, x: number, z: number, radius: number, strength: number, erase: boolean): { y0: number; y1: number } | null {
  const { u, v } = paintPixel(x, z);
  const r = (radius / (2 * PAINT_HALF)) * PAINT_RES;
  const x0 = Math.max(0, Math.floor(u - r)), x1 = Math.min(PAINT_RES - 1, Math.ceil(u + r));
  const y0 = Math.max(0, Math.floor(v - r)), y1 = Math.min(PAINT_RES - 1, Math.ceil(v + r));
  if (x0 > x1 || y0 > y1) return null;
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d = Math.hypot(px + 0.5 - u, py + 0.5 - v) / Math.max(r, 0.5);
      if (d >= 1) continue;
      // Soft falloff: full in the middle, nothing at the rim.
      const k = strength * (1 - d * d) * (1 - d * d);
      const i = py * PAINT_RES + px;
      const now = mask[i] / 255;
      const next = erase ? now * (1 - k) : now + (1 - now) * k;
      mask[i] = Math.round(Math.min(1, Math.max(0, next)) * 255);
    }
  }
  return { y0, y1 };
}

/* ───────────── The shader ───────────── */

/** GLSL added to the fragment shader's header: uniforms, hashes, noise and the pebble field. */
export const GROUND_FRAGMENT_HEADER = /* glsl */ `
uniform vec3 groundTint;
uniform float groundBright;
uniform float groundGrain;
uniform float groundPebbleSize;
uniform float groundPebbles;
uniform float groundFade;
uniform sampler2D paintMask;
uniform float paintHalf;
uniform vec3 sandColor;
uniform float sandStrength;
uniform float sandPebbles;
uniform float sandPits;
uniform float sandScale;
uniform sampler2D groundDetail;
uniform sampler2D groundDetailHeight;
uniform float groundRough;
uniform float groundShine;
uniform sampler2D sunShadow;
uniform float sunShadowOn;
uniform float sunShadowStrength;
// Set in the colour pass, read by the shine and relief passes: how much of this pixel is painted dirt,
// how much is a pebble, how deep a crack, its height (world units) and how close the camera is.
float gPaint = 0.0;
float gStoneCover = 0.0;
float gCrack = 0.0;
float gHeight = 0.0;
float gNear = 0.0;
uniform float groundBump;
// A surface normal tilted by the slope of a height (screen-space derivatives; three.js's bump-map way).
vec3 gBump(vec3 surfPos, vec3 surfNorm, vec2 dHdxy) {
  vec3 sigmaX = dFdx(surfPos); vec3 sigmaY = dFdy(surfPos);
  vec3 r1 = cross(sigmaY, surfNorm); vec3 r2 = cross(surfNorm, sigmaX);
  float det = dot(sigmaX, r1);
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
varying vec3 vGroundWorld;
varying vec3 vGroundNormal;

// 2D hash and value noise (the only noise still computed per pixel: 4 hashes each).
float gHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float gNoise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash2(i), gHash2(i + vec2(1, 0)), f.x), mix(gHash2(i + vec2(0, 1)), gHash2(i + vec2(1, 1)), f.x), f.y);
}
// The baked detail tile (grain, pebbles, cracks), read twice with random offsets that change across the
// ground and blended, so the tile never shows as a repeat (Inigo Quilez, "texture repetition", 3rd way).
// The two reads and their blend weight; pebbles are resolved per read, then blended (blending the
// pebble numbers first would bite pieces out of stones).
vec4 gA; vec4 gB; float gW;
float gHA = 0.0; float gHB = 0.0;
void gDetail(vec2 uv, float k) {
  vec2 ddx = dFdx(uv); vec2 ddy = dFdy(uv);
  float l = k * 8.0; float ia = floor(l); float f = fract(l);
  vec2 offa = sin(vec2(3.0, 7.0) * ia); vec2 offb = sin(vec2(3.0, 7.0) * (ia + 1.0));
  gA = textureGrad(groundDetail, uv + offa, ddx, ddy);
  gB = textureGrad(groundDetail, uv + offb, ddx, ddy);
  gHA = textureGrad(groundDetailHeight, uv + offa, ddx, ddy).r;
  gHB = textureGrad(groundDetailHeight, uv + offb, ddx, ddy).r;
  gW = smoothstep(0.2, 0.8, f - 0.1 * dot(gA - gB, vec4(1.0)));
}
// A pebble's colour: its baked shade, warmed or cooled by its own random number.
vec3 gStone(vec4 d) {
  return vec3(d.g * 2.0) * mix(vec3(0.94, 0.97, 1.03), vec3(1.07, 0.98, 0.88), fract(d.b * 7.0));
}
// The pebbles' colour multiplier where their number is under the amount (1 elsewhere).
vec3 gStones(float amount) {
  vec3 a = mix(vec3(1.0), gStone(gA), step(gA.b, amount));
  vec3 b = mix(vec3(1.0), gStone(gB), step(gB.b, amount));
  return mix(a, b, gW);
}
`;

/** GLSL run after the base map: tint, grain and pebbles up close, then the painted sand over it. */
export const GROUND_FRAGMENT_BODY = /* glsl */ `
{
  vec3 wp = vGroundWorld;
  float dist = length(wp - cameraPosition);
  float near = 1.0 - smoothstep(groundFade * 0.35, groundFade, dist);
  diffuseColor.rgb *= groundTint * groundBright;

  vec2 muv = (wp.xz + paintHalf) / (2.0 * paintHalf);
  float paint = (muv.x < 0.0 || muv.x > 1.0 || muv.y < 0.0 || muv.y > 1.0) ? 0.0 : texture2D(paintMask, muv).r * sandStrength;
  // A ragged edge: the noise eats into the soft brush rim so strokes never show as circles.
  paint = clamp(paint * 1.25 - 0.25 * gNoise2(wp.xz / 60.0) * (1.0 - paint), 0.0, 1.0);
  gPaint = paint;

  // The detail up close: projected from above, or from the side on steep faces.
  gA = vec4(0.5, 0.5, 1.0, 0.0); gB = gA; gW = 0.0; gHA = 0.0; gHB = 0.0;
  if (near > 0.0) {
    vec3 n = abs(vGroundNormal);
    vec2 puv = n.y > 0.55 ? wp.xz : (n.x > n.z ? wp.zy : wp.xy);
    gDetail(puv / (DETAIL_CELLS * groundPebbleSize), gNoise2(wp.xz / 700.0));
  }
  vec4 d = mix(gA, gB, gW);
  float grain = 0.8 + 0.4 * d.r;
  vec3 baseStones = gStones(groundPebbles);
  gNear = near;
  float baseCover = mix(gHA * step(gA.b, groundPebbles), gHB * step(gB.b, groundPebbles), gW) * step(0.001, near);
  gStoneCover = baseCover;
  // Pebbles are domes ~2 units high (0 at the rim, so no hard edge); the grain is a faint roughness.
  float baseDome = mix(gHA * step(gA.b, groundPebbles), gHB * step(gB.b, groundPebbles), gW);
  gHeight = baseDome * 2.0 + (grain - 1.0) * 0.8;

  if (paint > 0.001) {
    // Light, compacted dirt: broad soft patches, cracked into plates up close.
    float mottle = 0.88 + 0.12 * gNoise2(wp.xz / 900.0) + 0.08 * gNoise2(wp.xz / 160.0) - 0.06;
    vec3 dirt = sandColor * mottle;
    if (near > 0.0) {
      vec3 n = abs(vGroundNormal);
      vec2 puv = n.y > 0.55 ? wp.xz : (n.x > n.z ? wp.zy : wp.xy);
      gDetail(puv / (DETAIL_CELLS * groundPebbleSize * sandScale), gNoise2(wp.xz / 700.0) + 0.37);
      vec4 e = mix(gA, gB, gW);
      float crack = e.a * sandPits;
      float dirtCover = mix(gHA * step(gA.b, sandPebbles * 0.6), gHB * step(gB.b, sandPebbles * 0.6), gW);
      gStoneCover = mix(gStoneCover, dirtCover, paint);
      gCrack = crack * paint;
      float dirtDome = mix(gHA * step(gA.b, sandPebbles * 0.6), gHB * step(gB.b, sandPebbles * 0.6), gW);
      gHeight = mix(gHeight, dirtDome * 2.0 - crack * 2.5 + (e.r - 0.5) * 0.6, paint);
      // A crack is a dark line with a faint lifted lip either side (dried, curled edges).
      vec3 detailed = dirt * mix(1.0, 0.82 + 0.3 * e.r, 0.5) * (1.0 - 0.6 * crack) * (1.0 + 0.06 * sandPits * (1.0 - crack) * step(0.05, crack));
      detailed *= gStones(sandPebbles * 0.6);
      dirt = mix(dirt, detailed, near);
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, dirt, paint);
  }

  if (near > 0.0 && groundGrain > 0.0) {
    vec3 g = vec3(grain) * baseStones;
    diffuseColor.rgb *= mix(vec3(1.0), g, groundGrain * near * (1.0 - paint));
  }
}
`;

/* ───────────── The detail tile ───────────── */

/** Pixels across the tile, and pebble cells across it (a cell is one Pebble size across in the world). */
export const DETAIL_RES = 512;
export const DETAIL_CELLS = 48;

const hash2 = (x: number, y: number, seed: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * The detail tile, seamless: R grain (two octaves of value noise), G a pebble's shade (0.5 = none;
 * lit dome, dark rim), B that pebble's random number (1 = no pebble; a pebble shows where its number is
 * under the Pebbles setting, so the sliders still work), A cracks for the painted dirt (plates of dried,
 * compacted earth: the edges of a jittered cell pattern, wobbled, at two sizes).
 */
export function makeDetailTile(res = DETAIL_RES, cells = DETAIL_CELLS, heightOut?: Uint8Array): Uint8Array {
  const out = new Uint8Array(res * res * 4);
  const wrap = (v: number, n: number) => ((v % n) + n) % n;
  const valueNoise = (x: number, y: number, n: number, seed: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const v = (a: number, b: number) => hash2(wrap(a, n), wrap(b, n), seed);
    const top = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * fx;
    const bottom = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * fx;
    return top + (bottom - top) * fy;
  };
  const crackCells = Math.max(2, Math.round(cells / 8));
  for (let py = 0; py < res; py++) {
    for (let px = 0; px < res; px++) {
      const u = (px + 0.5) / res, v = (py + 0.5) / res;
      const grain = 0.6 * valueNoise(u * cells * 4, v * cells * 4, cells * 4, 1) + 0.4 * valueNoise(u * cells * 1.2, v * cells * 1.2, cells * 1.2, 2);
      // Pebbles: the nearest stone among the 3 x 3 cells around.
      const qx = u * cells, qy = v * cells;
      const cx = Math.floor(qx), cy = Math.floor(qy);
      let cover = 0, shade = 1, id = 1, dome = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = wrap(cx + dx, cells), gy = wrap(cy + dy, cells);
        const ox = cx + dx + 0.2 + 0.6 * hash2(gx, gy, 3), oy = cy + dy + 0.2 + 0.6 * hash2(gx, gy, 4);
        const r = 0.22 + 0.3 * hash2(gx, gy, 5);
        const d = Math.hypot(qx - ox, qy - oy) / r;
        if (d >= 1) continue;
        const c = 1 - Math.min(1, Math.max(0, (d - 0.7) / 0.3));
        if (c <= cover) continue;
        cover = c;
        const tone = 0.62 + 0.45 * hash2(gx, gy, 6);
        const rim = Math.min(1, Math.max(0, (d - 0.75) / 0.25));
        shade = 1 + c * (tone * (0.85 + 0.25 * (1 - d * d)) * (1 - 0.35 * rim) - 1);
        id = hash2(gx, gy, 7) * 0.98;
        dome = Math.sqrt(Math.max(0, 1 - d * d));
      }
      // Cracks: the edges between plates (second-nearest minus nearest cell centre), wobbled so they wander.
      const edge = (n: number, seed: number, width: number) => {
        const wob = 0.18;
        const wx = u * n + wob * (valueNoise(u * n * 3, v * n * 3, n * 3, seed + 20) - 0.5) * 2;
        const wy = v * n + wob * (valueNoise(u * n * 3, v * n * 3, n * 3, seed + 21) - 0.5) * 2;
        const kx = Math.floor(wx), ky = Math.floor(wy);
        let f1 = 9, f2 = 9;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const gx = wrap(kx + dx, n), gy = wrap(ky + dy, n);
          const d = Math.hypot(wx - (kx + dx + 0.1 + 0.8 * hash2(gx, gy, seed)), wy - (ky + dy + 0.1 + 0.8 * hash2(gx, gy, seed + 1)));
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
        const t = Math.min(1, (f2 - f1) / width);
        return 1 - t * t * (3 - 2 * t);
      };
      const pit = Math.max(edge(crackCells, 8, 0.07), 0.55 * edge(crackCells * 3, 12, 0.09));
      const o = (py * res + px) * 4;
      out[o] = Math.round(grain * 255);
      out[o + 1] = Math.round(Math.min(1, shade / 2) * 255);
      out[o + 2] = cover > 0.02 ? Math.round(id * 255) : 255;
      out[o + 3] = Math.round(pit * 255);
      if (heightOut) heightOut[py * res + px] = Math.round(dome * 255);
    }
  }
  return out;
}

let detailTexture: THREE.DataTexture | null = null;
let detailHeightTexture: THREE.DataTexture | null = null;
/** The tile's pebble domes (0 outside a pebble, 1 at its crown), for the relief. Made with the tile. */
export function detailHeightTexture_(): THREE.DataTexture {
  detailTileTexture();
  return detailHeightTexture!;
}
/** The tile on the GPU (made once, shared). */
export function detailTileTexture(): THREE.DataTexture {
  if (detailTexture) return detailTexture;
  const heights = new Uint8Array(DETAIL_RES * DETAIL_RES);
  const h = new THREE.DataTexture(heights, DETAIL_RES, DETAIL_RES, THREE.RedFormat, THREE.UnsignedByteType);
  const t = new THREE.DataTexture(makeDetailTile(DETAIL_RES, DETAIL_CELLS, heights), DETAIL_RES, DETAIL_RES, THREE.RGBAFormat, THREE.UnsignedByteType);
  h.wrapS = h.wrapT = THREE.RepeatWrapping;
  h.magFilter = THREE.LinearFilter;
  h.minFilter = THREE.LinearMipmapLinearFilter;
  h.generateMipmaps = true;
  h.needsUpdate = true;
  detailHeightTexture = h;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return detailTexture = t;
}

/** GLSL after the roughness is read: dark rock shines, painted dirt stays matte (a specular map from the texture). */
export const GROUND_ROUGHNESS_BODY = /* glsl */ `
{
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  // Pebbles catch the light; dark rock has a little sheen; painted dirt stays matte between them.
  float shineMask = max(gStoneCover * gNear, 0.5 * clamp(1.0 - lum * 2.2, 0.0, 1.0) * (1.0 - 0.85 * gPaint));
  roughnessFactor = clamp(groundRough - groundShine * shineMask, 0.06, 1.0);
  // Cracks are dull and dusty: no shine in them at all.
  roughnessFactor = mix(roughnessFactor, 1.0, clamp(gCrack * gNear * 1.5, 0.0, 1.0));
}
`;

/** GLSL after the normal is set up: pebbles stand up and cracks cut in (fading out with distance). */
export const GROUND_RELIEF_BODY = /* glsl */ `
{
  vec2 dh = vec2(dFdx(gHeight), dFdy(gHeight)) * groundBump * gNear;
  if (groundBump > 0.0) normal = gBump(-vViewPosition, normal, dh);
}
`;

/** GLSL after the lights: the baked sun shadows dim direct light only (the sky still fills them). */
export const GROUND_SHADOW_BODY = /* glsl */ `
{
  vec2 suv = (vGroundWorld.xz + paintHalf) / (2.0 * paintHalf);
  if (sunShadowOn > 0.5 && suv.x >= 0.0 && suv.x <= 1.0 && suv.y >= 0.0 && suv.y <= 1.0) {
    float vis = mix(1.0, texture2D(sunShadow, suv).r, sunShadowStrength);
    reflectedLight.directDiffuse *= vis;
    reflectedLight.directSpecular *= vis;
  }
}
`;

/** Inserts the ground shader into a MeshStandardMaterial's shaders (its onBeforeCompile). */
export function injectIslandGround(
  shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> },
  uniforms: Record<string, THREE.IUniform>,
): void {
  Object.assign(shader.uniforms, uniforms);
  const need = (source: string, anchor: string) => {
    if (!source.includes(anchor)) throw new Error(`island ground: shader anchor ${anchor} is missing (three.js changed?)`);
  };
  need(shader.vertexShader, '#include <common>');
  need(shader.vertexShader, '#include <project_vertex>');
  need(shader.fragmentShader, '#include <common>');
  need(shader.fragmentShader, '#include <map_fragment>');
  need(shader.fragmentShader, '#include <roughnessmap_fragment>');
  need(shader.fragmentShader, '#include <lights_fragment_end>');
  need(shader.fragmentShader, '#include <normal_fragment_maps>');
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;\nvarying vec3 vGroundNormal;')
    .replace('#include <project_vertex>', `#include <project_vertex>
  vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vGroundNormal = normalize(mat3(modelMatrix) * objectNormal);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n#define DETAIL_CELLS ${DETAIL_CELLS.toFixed(1)}\n${GROUND_FRAGMENT_HEADER}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${GROUND_FRAGMENT_BODY}`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${GROUND_ROUGHNESS_BODY}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GROUND_RELIEF_BODY}`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${GROUND_SHADOW_BODY}`);
}

/** The live ground of one island material: its settings, and the paint mask on the GPU. */
export class IslandGround {
  readonly mask = new Uint8Array(PAINT_RES * PAINT_RES);
  readonly maskTexture: THREE.DataTexture;
  readonly uniforms: Record<string, THREE.IUniform>;
  private settings: IslandGroundSettings = { ...DEFAULT_ISLAND_GROUND };
  /** The baked sun shadow map (0 shadow .. 255 sun), its size, and the sun it was baked for. */
  private shadow: { map: Uint8Array; res: number; sun: [number, number, number] } | null = null;
  private shadowTexture: THREE.DataTexture | null = null;

  constructor(material: THREE.MeshStandardMaterial) {
    this.maskTexture = new THREE.DataTexture(this.mask, PAINT_RES, PAINT_RES, THREE.RedFormat, THREE.UnsignedByteType);
    this.maskTexture.magFilter = THREE.LinearFilter;
    this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.needsUpdate = true;
    this.uniforms = {
      groundTint: { value: new THREE.Color(1, 1, 1) },
      groundBright: { value: 1 },
      groundGrain: { value: 0.5 },
      groundPebbleSize: { value: 9 },
      groundPebbles: { value: 0.35 },
      groundFade: { value: 6000 },
      paintMask: { value: this.maskTexture },
      paintHalf: { value: PAINT_HALF },
      sandColor: { value: new THREE.Color() },
      sandStrength: { value: 1 },
      sandPebbles: { value: 0.3 },
      sandPits: { value: 0.6 },
      sandScale: { value: 1 },
      groundDetail: { value: detailTileTexture() },
      groundDetailHeight: { value: detailHeightTexture_() },
      groundRough: { value: 0.95 },
      groundShine: { value: 0.5 },
      sunShadow: { value: null },
      sunShadowOn: { value: 0 },
      sunShadowStrength: { value: 0.8 },
      groundBump: { value: 0.6 },
    };
    material.onBeforeCompile = (shader) => injectIslandGround(shader, this.uniforms);
    material.customProgramCacheKey = () => 'island-ground';
    material.userData.islandGround = this;
    this.apply(DEFAULT_ISLAND_GROUND);
  }

  get(): IslandGroundSettings { return { ...this.settings }; }

  apply(settings: Partial<IslandGroundSettings>) {
    const s = this.settings = normalizeIslandGround({ ...this.settings, ...settings });
    const u = this.uniforms;
    (u.groundTint.value as THREE.Color).set(s.tint).convertSRGBToLinear();
    u.groundBright.value = s.brightness;
    u.groundGrain.value = s.grain;
    u.groundPebbleSize.value = s.pebbleSize;
    u.groundPebbles.value = s.pebbles;
    (u.sandColor.value as THREE.Color).set(s.sandColor).convertSRGBToLinear();
    u.sandStrength.value = s.sandStrength;
    u.sandPebbles.value = s.sandPebbles;
    u.sandPits.value = s.sandPits;
    u.sandScale.value = s.sandScale;
    u.groundRough.value = s.roughness;
    u.groundShine.value = s.shine;
    u.sunShadowStrength.value = s.shadowStrength;
    u.groundBump.value = s.bump;
  }

  /** Puts a baked shadow map on the terrain (null takes it off). */
  setShadow(shadow: { map: Uint8Array; res: number; sun: [number, number, number] } | null) {
    this.shadowTexture?.dispose();
    this.shadowTexture = null;
    this.shadow = shadow;
    if (shadow) {
      const t = new THREE.DataTexture(shadow.map, shadow.res, shadow.res, THREE.RedFormat, THREE.UnsignedByteType);
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
      this.shadowTexture = t;
    }
    this.uniforms.sunShadow.value = this.shadowTexture;
    this.uniforms.sunShadowOn.value = this.shadowTexture ? 1 : 0;
  }

  getShadow() { return this.shadow; }

  /** One brush dab; uploads the mask. */
  paint(x: number, z: number, radius: number, strength: number, erase: boolean): boolean {
    const touched = paintDab(this.mask, x, z, radius, strength, erase);
    if (!touched) return false;
    this.maskTexture.needsUpdate = true;
    return true;
  }

  setMask(data: Uint8Array) {
    if (data.length !== this.mask.length) return;
    this.mask.set(data);
    this.maskTexture.needsUpdate = true;
  }

  clearMask() { this.mask.fill(0); this.maskTexture.needsUpdate = true; }

  isPainted(): boolean { return this.mask.some((v) => v > 0); }
}

/* ───────────── Saving ───────────── */

export interface IslandGroundDoc {
  version: 1;
  settings: IslandGroundSettings;
  /** The mask as a PNG data URL (grey), or null when nothing is painted. */
  mask: string | null;
  bounds: { half: number; res: number };
  /** The baked sun shadows (a grey PNG over the same square), or none. */
  shadow?: { png: string; res: number; sun: [number, number, number] } | null;
}

export const ISLAND_GROUND_KEY = 'hm2-island-ground-v1';
export const islandGroundKey = (trackId: string) => trackId === 'serpentine' ? ISLAND_GROUND_KEY : `${ISLAND_GROUND_KEY}:${trackId}`;
export const islandGroundEndpoint = (trackId: string) => `/api/island-ground${trackId === 'serpentine' ? '' : `?track=${encodeURIComponent(trackId)}`}`;

/** Encodes the mask as a grey PNG (browser only). */
export function encodeMask(mask: Uint8Array, res = PAINT_RES, always = false): string | null {
  if (typeof document === 'undefined' || (!always && !mask.some((v) => v > 0))) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(res, res);
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]; const o = i * 4;
    img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Decodes a saved mask (browser only). */
export function decodeMask(url: string, res = PAINT_RES): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = res;
      const g = canvas.getContext('2d');
      if (!g) { resolve(null); return; }
      g.drawImage(image, 0, 0, res, res);
      const px = g.getImageData(0, 0, res, res).data;
      const mask = new Uint8Array(res * res);
      for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4];
      resolve(mask);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export function readGroundDoc(trackId: string): IslandGroundDoc | null {
  try {
    const raw = localStorage.getItem(islandGroundKey(trackId));
    if (!raw) return null;
    const doc = JSON.parse(raw) as IslandGroundDoc;
    return doc && doc.version === 1 ? { ...doc, settings: normalizeIslandGround(doc.settings) } : null;
  } catch { return null; }
}

/** Loads a track's ground into `ground`: the browser copy, else the disk copy. */
export async function loadGround(ground: IslandGround, trackId: string): Promise<void> {
  let doc = readGroundDoc(trackId);
  if (!doc && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(islandGroundEndpoint(trackId));
      if (res.ok) {
        const found = await res.json() as IslandGroundDoc | null;
        if (found && found.version === 1) doc = { ...found, settings: normalizeIslandGround(found.settings) };
      }
    } catch { /* no dev server: defaults */ }
  }
  if (!doc) return;
  ground.apply(doc.settings);
  if (doc.mask) {
    const mask = await decodeMask(doc.mask);
    if (mask) ground.setMask(mask);
  }
  if (doc.shadow?.png) {
    const map = await decodeMask(doc.shadow.png, doc.shadow.res);
    if (map) ground.setShadow({ map, res: doc.shadow.res, sun: doc.shadow.sun });
  }
}

/** Saves a track's ground to the browser and to disk. Returns false when the browser copy did not fit. */
export function saveGround(ground: IslandGround, trackId: string): boolean {
  const shadow = ground.getShadow();
  const doc: IslandGroundDoc = {
    version: 1, settings: ground.get(), mask: encodeMask(ground.mask), bounds: { half: PAINT_HALF, res: PAINT_RES },
    shadow: shadow ? { png: encodeMask(shadow.map, shadow.res, true) ?? '', res: shadow.res, sun: shadow.sun } : null,
  };
  const text = JSON.stringify(doc);
  let stored = true;
  try { localStorage.setItem(islandGroundKey(trackId), text); } catch { stored = false; }
  if (typeof fetch !== 'undefined') {
    fetch(islandGroundEndpoint(trackId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text }).catch(() => { /* no dev server */ });
  }
  return stored;
}
