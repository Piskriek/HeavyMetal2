/**
 * ISLAND-ROUTE: the island terrain's ground shader.
 *
 * The island's own texture is 2048 pixels across ~94,000 world units (about 45 units a pixel), so up
 * close it is soft. Two things fix that, both computed from the world position, so nothing tiles and
 * no repeat can show:
 *
 * - **Grain**: fine noise and tiny pebbles multiplied into the base colour, fading out with distance
 *   (from afar the base texture has enough detail of its own).
 * - **Painted surfaces**: a layered surface mask over the island (the NewRoads format: two surface IDs
 *   and a blend weight per texel, `surface/surface-mask.ts`). ID 0 is the island as it is; the island's
 *   own cracked dirt (`SURFACE_CRACKED`) is drawn procedurally here, tuned by the dirt sliders; every
 *   other ID is a tile of the island surface set (`island-surfaces.ts`), height-blended with its
 *   neighbour (`island-surface-shader.ts`). Three layers make the mask the GPU shows, bottom to top:
 *   island auto paint (a recipe painted over the terrain, `island-autopaint.ts`), the brush, and the
 *   island road's auto paint laid along the route (`island-road-paint.ts`).
 *
 * The owner tunes both in build mode (Primitives or Custom 3D: click the terrain). The settings and the
 * mask are saved per island track, in the browser and on disk (backups/island/), and are keyed by
 * world position, so they survive a re-exported island model.
 */
import * as THREE from 'three';
import { SurfaceMask, type MaskRect, type MaskSnapshot } from '../surface/surface-mask';
import { SURFACE_SAMPLING_GLSL } from '../surface/surface-shader';
import { SURFACE_BARE, SURFACE_CRACKED } from '../surface/surface-table';
import { RoadMask, type RoadMaskDoc } from '../surface/road-mask';
import { AutoPaint, jobsFromDoc, jobsToDoc, trackPaintField } from '../surface/auto-paint';
import { islandTrackSpace } from './island-space';
import { buildRoadFootprint, composeLayers, projectFootprint, type PackedTexel, type RoadFootprint } from './island-road-paint';
import { ISLAND_LAYER_OF, ISLAND_SURFACES, ISLAND_TEXTURE_DIR, IslandSurfaceArray } from './island-surfaces';
import { libraryTexture } from './island-texture-library';
import { ISLAND_SURFACE_GLSL } from './island-surface-shader';
import { TERRAIN_RES, analyseIslandTerrain, type IslandTerrain, type TerrainTriangles } from './island-terrain';
import { normalizeRecipe, paintIsland, upsampleMask, type IslandRecipe, type PaintIslandResult } from './island-autopaint';

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
  /** How softly painted surfaces fade into each other (0 = crisp, height-led; 1 = long, soft fades). */
  blendSoft: number;
  /** Every surface tile's size, × (bigger reads calmer). */
  tileScale: number;
  /** A surface's tile swapped for a library one: surface ID → library key (`island-texture-library.ts`). */
  textures: Record<string, string>;
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
  blendSoft: 0.6,
  tileScale: 1.2,
  textures: {},
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
    blendSoft: clamp(r.blendSoft, 0, 1, d.blendSoft),
    tileScale: clamp(r.tileScale, 0.4, 4, d.tileScale),
    textures: r.textures && typeof r.textures === 'object'
      ? Object.fromEntries(Object.entries(r.textures as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'))
      : {},
  };
}

/* ───────────── The paint mask ───────────── */

/** The painted square: centred on the island, a little wider than the model (world units). */
export const PAINT_HALF = 48000;
/** Mask texels across (about 47 world units a texel; each surface's own detail comes from its tile). */
export const PAINT_RES = 2048;

/** World (x, z) to mask pixel (fractional). */
export function paintPixel(x: number, z: number): { u: number; v: number } {
  return { u: ((x + PAINT_HALF) / (2 * PAINT_HALF)) * PAINT_RES, v: ((z + PAINT_HALF) / (2 * PAINT_HALF)) * PAINT_RES };
}

/**
 * Paints `surface` (or, erasing, the bare island: surface 0) as one soft round dab into the layered mask.
 * `radius` in world units, `strength` 0..1 per dab. Returns the touched texel rectangle, or null when the
 * dab is off the mask or changed nothing.
 */
export function paintDab(mask: SurfaceMask, x: number, z: number, radius: number, strength: number, surface: number, erase: boolean): MaskRect | null {
  const { u, v } = paintPixel(x, z);
  const r = (radius / (2 * PAINT_HALF)) * PAINT_RES;
  return mask.stamp({ cx: u, cy: v, radius: Math.max(0.75, r), hardness: 0.15, opacity: strength, surface: erase ? 0 : surface });
}

/**
 * Old saves (version 1) kept one grey coverage mask of painted dirt. It becomes the cracked-dirt surface,
 * which renders the way that mask always did.
 */
export function migrateDirtCoverage(coverage: Uint8Array, mask: SurfaceMask): void {
  const n = Math.min(coverage.length, mask.width * mask.height);
  for (let i = 0; i < n; i++) {
    const c = coverage[i];
    const o = i * 4;
    if (c === 0) { mask.data[o] = 0; mask.data[o + 1] = 0; mask.data[o + 2] = 0; }
    else if (c === 255) { mask.data[o] = SURFACE_CRACKED; mask.data[o + 1] = SURFACE_CRACKED; mask.data[o + 2] = 0; }
    else { mask.data[o] = 0; mask.data[o + 1] = SURFACE_CRACKED; mask.data[o + 2] = c; }
    mask.data[o + 3] = 0;
  }
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
uniform float paintRes;
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
// How much of this pixel is an island surface tile (not bare island, not cracked dirt), its roughness,
// and how wet the waterline makes it.
float gAtlas = 0.0;
float gAtlasRough = 1.0;
float gWet = 0.0;
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
${SURFACE_SAMPLING_GLSL}
${ISLAND_SURFACE_GLSL}
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

  // The layered mask: (id0, id1, weight) at this pixel. ID 0 (and SURF_BARE) is the bare island,
  // SURF_CRACKED the procedural dirt below, an island surface a tile of the array (drawn after it).
  vec2 muv = (wp.xz + paintHalf) / (2.0 * paintHalf);
  // Tiles are projected from above, or from the side on steep faces (as the pebble detail is), so a
  // cliff painted with rock does not smear into streaks.
  vec3 dwx = dFdx(wp);
  vec3 dwy = dFdy(wp);
  // Read at a gently warped position (about a texel), so borders meander instead of following the grid.
  vec2 mwarp = vec2(gNoise2(wp.xz / 170.0), gNoise2(wp.xz / 170.0 + 19.7)) - 0.5;
  vec3 sm = (muv.x < 0.0 || muv.x > 1.0 || muv.y < 0.0 || muv.y > 1.0) ? vec3(0.0) : islGather(paintMask, vec2(paintRes), muv * paintRes + mwarp * 1.4);
  bool sSolid = surfIs(sm.x, sm.y);
  float shareA = sSolid ? 1.0 : 1.0 - sm.z;
  float shareB = sSolid ? 0.0 : sm.z;
  float shareCracked = (surfIs(sm.x, SURF_CRACKED) ? shareA : 0.0) + (surfIs(sm.y, SURF_CRACKED) ? shareB : 0.0);
  float isl0 = islLayer(sm.x);
  float isl1 = islLayer(sm.y);
  float shareAtlas = (isl0 >= 0.0 ? shareA : 0.0) + (isl1 >= 0.0 ? shareB : 0.0);
  float rag = gNoise2(wp.xz / 60.0);
  float paint = shareCracked * sandStrength;
  // A ragged edge: the noise eats into the soft brush rim so strokes never show as circles.
  paint = clamp(paint * 1.25 - 0.25 * rag * (1.0 - paint), 0.0, 1.0);
  gPaint = max(paint, shareAtlas);

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

  if (shareAtlas > 0.002) {
    // The island tiles in this texel: a slot holding bare island or cracked dirt defers to the other.
    float l0 = isl0, l1 = isl1, lw = sSolid ? 0.0 : sm.z;
    if (l0 < 0.0) { l0 = l1; lw = 1.0; }
    if (l1 < 0.0) { l1 = l0; lw = 0.0; }
    vec4 tile = islTriplanar(l0, l1, lw, wp, normalize(vGroundNormal), dwx, dwy);
    // Broad, soft mottling so a big fill never reads as one flat print.
    tile.rgb *= 0.9 + 0.2 * gNoise2(wp.xz / 1400.0 + 3.7);
    // The rim against the bare island or dirt is decided by height too: the paint ends along the tile's
    // own shapes (a clump of grass, the edge of a rock), not along a soft circle.
    float under = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) * 1.6;
    float rimK = mix(4.5, 1.15, islSoft);
    float cover = shareAtlas >= 0.999 ? 1.0 : clamp((shareAtlas - 0.5) * rimK + (tile.a - under) * mix(0.9, 0.35, islSoft) + 0.5, 0.0, 1.0) * smoothstep(0.0, 0.05, shareAtlas);
    diffuseColor.rgb = mix(diffuseColor.rgb, tile.rgb * groundTint * groundBright, cover);
    gAtlas = cover;
    gAtlasRough = islRough(l0, l1, lw);
    // The tile's height lifts the relief, so light and shine catch grass blades and rock edges.
    gHeight = mix(gHeight, tile.a * 5.0, cover);
  }

  // The waterline: every surface darkens and glosses as it nears the sea.
  gWet = 1.0 - smoothstep(25.0, 240.0, wp.y);
  diffuseColor.rgb *= 1.0 - 0.3 * gWet;

  if (near > 0.0 && groundGrain > 0.0) {
    vec3 g = vec3(grain) * baseStones;
    diffuseColor.rgb *= mix(vec3(1.0), g, groundGrain * near * clamp(1.0 - paint - 0.6 * gAtlas, 0.0, 1.0));
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
  // Island surfaces bring their own roughness (wet sand is glossier than grass), and the waterline wets them.
  roughnessFactor = mix(roughnessFactor, gAtlasRough, gAtlas);
  roughnessFactor = mix(roughnessFactor, 0.32, gWet * 0.85);
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
    .replace('#include <common>', `#include <common>\n#define DETAIL_CELLS ${DETAIL_CELLS.toFixed(1)}\n#define SURF_CRACKED ${SURFACE_CRACKED.toFixed(1)}\n#define SURF_BARE ${SURFACE_BARE.toFixed(1)}\n${GROUND_FRAGMENT_HEADER}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${GROUND_FRAGMENT_BODY}`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${GROUND_ROUGHNESS_BODY}`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GROUND_RELIEF_BODY}`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${GROUND_SHADOW_BODY}`);
}

/** Brush undo keeps whole 64 × 64 tiles of the hand mask, snapshotted the first time a stroke touches one. */
const UNDO_TILE = 64;
const UNDO_DEPTH = 12;

/**
 * The live ground of one island material: its settings, the paint, and the paint on the GPU.
 *
 * `hand` is what the brush paints (and what old dirt saves migrate into); `view` is what the GPU shows:
 * the island auto paint (a 1024² mask painted from a recipe, in a worker), the brush over it, the island
 * road's auto paint over both (`island-road-paint.ts`). Only changed rows are uploaded.
 */
export class IslandGround {
  readonly hand = new SurfaceMask(PAINT_RES, PAINT_RES);
  readonly view = new SurfaceMask(PAINT_RES, PAINT_RES);
  readonly maskTexture: THREE.DataTexture;
  readonly uniforms: Record<string, THREE.IUniform>;
  /** The island surface tiles (null in node tests). */
  readonly surfaces: IslandSurfaceArray | null;
  /** 0..1 while the island is being auto-painted, null when idle (the panel's progress bar). */
  onAutoProgress: ((t: number | null) => void) | null = null;
  /** How the last island auto paint went, for the panel's readout. */
  lastAuto: { ms: number; coverage: Record<number, number> } | null = null;
  /** Runs after any paint change worth saving (the builder schedules the save). */
  onPainted: (() => void) | null = null;
  /** Runs after an auto pass on the road (saving only: the panel redraws itself; defaults to onPainted). */
  onRoadPainted: (() => void) | null = null;
  private settings: IslandGroundSettings = { ...DEFAULT_ISLAND_GROUND };
  /** The baked sun shadow map (0 shadow .. 255 sun), its size, and the sun it was baked for. */
  private shadow: { map: Uint8Array; res: number; sun: [number, number, number] } | null = null;
  private shadowTexture: THREE.DataTexture | null = null;
  /** The shadow map as saved (a PNG), encoded once per bake rather than on every save. */
  private shadowPng: string | null = null;
  /** The island road's own mask and its auto-paint runner, made on first use (the route map is not free). */
  private road: { mask: RoadMask; auto: AutoPaint } | null = null;
  private projection = new Map<number, PackedTexel>();
  /** Where the island road lies on the ground (built once per terrain: the costly part of a projection). */
  private footprint: RoadFootprint | null = null;
  private strokeTiles: Map<number, MaskSnapshot> | null = null;
  /** Library tiles still loading (swapped by the settings). */
  private textureLoads: Promise<void> = Promise.resolve();
  private undoStack: MaskSnapshot[][] = [];
  /** Island auto paint: the recipe, its mask (PAINT_RES², smoothly upsampled, under the brush), and the terrain it reads. */
  private autoRecipe: IslandRecipe | null = null;
  private autoMask: Uint8Array | null = null;
  private terrainMap: IslandTerrain | null = null;
  private autoWorker: Worker | null = null;
  private autoRunning: Promise<void> | null = null;
  /** A recipe asked for while one was painting (the latest wins; undefined = none). */
  private autoPending: IslandRecipe | null | undefined = undefined;
  private autoBusy: number | null = null;
  private autoId = 0;
  private autoWaiters: (() => void)[] = [];

  constructor(material: THREE.MeshStandardMaterial) {
    this.maskTexture = new THREE.DataTexture(this.view.data, PAINT_RES, PAINT_RES, THREE.RGBAFormat, THREE.UnsignedByteType);
    // IDs are never interpolated: the sampler reads four texels and blends the weights itself.
    this.maskTexture.magFilter = THREE.NearestFilter;
    this.maskTexture.minFilter = THREE.NearestFilter;
    this.maskTexture.generateMipmaps = false;
    this.maskTexture.needsUpdate = true;
    this.surfaces = typeof document !== 'undefined' ? new IslandSurfaceArray() : null;
    this.uniforms = {
      groundTint: { value: new THREE.Color(1, 1, 1) },
      groundBright: { value: 1 },
      groundGrain: { value: 0.5 },
      groundPebbleSize: { value: 9 },
      groundPebbles: { value: 0.35 },
      groundFade: { value: 6000 },
      paintMask: { value: this.maskTexture },
      paintHalf: { value: PAINT_HALF },
      paintRes: { value: PAINT_RES },
      islSurfaces: { value: this.surfaces?.texture ?? null },
      islLayerOf: { value: Float32Array.from(ISLAND_LAYER_OF) },
      islParams: { value: this.surfaces?.params ?? [] },
      islSoft: { value: 0.6 },
      islScale: { value: 1.2 },
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
    material.customProgramCacheKey = () => 'island-ground-surfaces';
    material.userData.islandGround = this;
    this.apply(DEFAULT_ISLAND_GROUND);
  }

  /** Resolves once every island surface tile is loaded; the loading bar waits on it. */
  whenReady(): Promise<void> { return this.surfaces ? Promise.all([this.surfaces.ready, this.textureLoads]).then(() => undefined) : Promise.resolve(); }

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
    u.islSoft.value = s.blendSoft;
    u.islScale.value = s.tileScale;
    this.swapTextures(s.textures);
  }

  /** Loads any surface tiles the settings swap (and puts back the originals of those no longer swapped). */
  private swapTextures(textures: Record<string, string>) {
    const surfaces = this.surfaces;
    if (!surfaces) return;
    const jobs: Promise<boolean>[] = [];
    ISLAND_SURFACES.forEach((surface, layer) => {
      const url = libraryTexture(textures[surface.id])?.url ?? ISLAND_TEXTURE_DIR + surface.file;
      if (surfaces.urlOf(layer) !== url) jobs.push(surfaces.setLayerImage(layer, url));
    });
    if (jobs.length) this.textureLoads = Promise.all([this.textureLoads, ...jobs]).then(() => undefined);
  }

  /** Puts a baked shadow map on the terrain (null takes it off). */
  setShadow(shadow: { map: Uint8Array; res: number; sun: [number, number, number] } | null) {
    this.shadowTexture?.dispose();
    this.shadowTexture = null;
    this.shadow = shadow;
    this.shadowPng = null;
    if (shadow) {
      const t = new THREE.DataTexture(shadow.map, shadow.res, shadow.res, THREE.RedFormat, THREE.UnsignedByteType);
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
      this.shadowTexture = t;
    }
    this.uniforms.sunShadow.value = this.shadowTexture;
    this.uniforms.sunShadowOn.value = this.shadowTexture ? 1 : 0;
  }

  getShadow() { return this.shadow; }

  /** The shadow map as a PNG for the save (browser only), encoded the first time it is asked for. */
  shadowPngForSave(): string | null {
    if (!this.shadow) return null;
    if (this.shadowPng === null) this.shadowPng = encodeMask(this.shadow.map, this.shadow.res, true) ?? '';
    return this.shadowPng;
  }

  /* ───────────── The brush ───────────── */

  /** A stroke starts: everything it paints undoes as one step. */
  beginStroke() { this.strokeTiles = new Map(); }

  /** One brush dab of `surface` (erasing: back to the bare island); uploads the rows it changed. */
  paint(x: number, z: number, radius: number, strength: number, erase: boolean, surface = SURFACE_CRACKED): boolean {
    const { u, v } = paintPixel(x, z);
    const r = Math.max(0.75, (radius / (2 * PAINT_HALF)) * PAINT_RES);
    this.saveTiles({ x0: Math.floor(u - r), y0: Math.floor(v - r), x1: Math.ceil(u + r) + 1, y1: Math.ceil(v + r) + 1 });
    const touched = paintDab(this.hand, x, z, radius, strength, surface, erase);
    this.hand.takeDirty();
    if (!touched) return false;
    this.recompose(touched);
    return true;
  }

  endStroke() {
    const tiles = this.strokeTiles;
    this.strokeTiles = null;
    if (!tiles || tiles.size === 0) return;
    this.undoStack.push(Array.from(tiles.values()));
    if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
    this.onPainted?.();
  }

  canUndo(): boolean { return this.undoStack.length > 0; }

  /** Undoes the last brush stroke (or clear). Auto passes undo on the road's own runner (`autoPaint.undo`). */
  undo(): boolean {
    const tiles = this.undoStack.pop();
    if (!tiles) return false;
    for (const snap of tiles) { this.hand.restore(snap); this.recompose(snap.rect); }
    this.hand.takeDirty();
    this.onPainted?.();
    return true;
  }

  /** Removes all brush paint (one undo step). The road's auto paint stays; it has its own reset. */
  clearHand() {
    this.beginStroke();
    this.saveTiles({ x0: 0, y0: 0, x1: PAINT_RES, y1: PAINT_RES });
    this.hand.data.fill(0);
    this.recompose({ x0: 0, y0: 0, x1: PAINT_RES, y1: PAINT_RES });
    this.endStroke();
  }

  /** Replaces the brush paint (a loaded save); not undoable. */
  setHand(data: Uint8Array) {
    if (data.length !== this.hand.data.length) return;
    this.hand.data.set(data);
    this.undoStack = [];
    this.recompose({ x0: 0, y0: 0, x1: PAINT_RES, y1: PAINT_RES });
  }

  /** Back to an unpainted island: brush paint, road paint and history all gone (another track opened). */
  reset() {
    this.hand.data.fill(0);
    this.undoStack = [];
    this.road = null;
    this.projection = new Map();
    this.autoRecipe = null;
    this.autoMask = null;
    this.autoPending = undefined;
    this.lastAuto = null;
    this.recompose({ x0: 0, y0: 0, x1: PAINT_RES, y1: PAINT_RES });
  }

  isPainted(): boolean {
    const d = this.hand.data;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== 0 || d[i + 1] !== 0) return true;
    return false;
  }

  /* ───────────── Island auto paint ───────────── */

  /** What the island's ground is like everywhere (null until the island model has loaded). */
  get terrain(): IslandTerrain | null { return this.terrainMap; }

  /** The recipe the island is auto-painted with, or null. */
  getAutoRecipe(): IslandRecipe | null { return this.autoRecipe; }

  /** 0..1 while the island is being auto-painted, null when idle. */
  get autoProgress(): number | null { return this.autoBusy; }

  /**
   * Reads the island's shape (the model's triangles, world space) for auto paint, after the road
   * footprint (`setHeightField`) so distance-from-road is known; starts any paint waiting for it.
   */
  setTerrain(tris: TerrainTriangles) {
    const fp = this.footprint;
    this.terrainMap = analyseIslandTerrain(tris, { half: PAINT_HALF, res: TERRAIN_RES, roadCells: fp?.index, roadRes: PAINT_RES });
    this.autoWorker?.postMessage({ type: 'terrain', terrain: this.terrainMap });
    if (this.autoRecipe) void this.paintAuto(this.autoRecipe);
  }

  /**
   * Paints the island from `recipe` (null takes the auto paint off) in a worker, reporting progress, then
   * shows it and saves. Asking again while painting queues the newest recipe (a dragged slider paints
   * its last value, not every value). Resolves once the island shows the paint.
   */
  paintAuto(recipe: IslandRecipe | null): Promise<void> {
    this.autoRecipe = recipe;
    if (this.autoRunning) { this.autoPending = recipe; return this.whenAutoPainted(); }
    if (!recipe) {
      this.autoMask = null;
      this.lastAuto = null;
      this.recompose({ x0: 0, y0: 0, x1: PAINT_RES, y1: PAINT_RES });
      this.onPainted?.();
      this.flushAutoWaiters();
      return Promise.resolve();
    }
    if (!this.terrainMap) return this.whenAutoPainted(); // painted as soon as the model has loaded
    const run = this.runAuto(recipe).catch((error) => console.warn('[island auto paint]', error));
    this.autoRunning = run.finally(() => {
      this.autoRunning = null;
      const next = this.autoPending;
      this.autoPending = undefined;
      if (next !== undefined) void this.paintAuto(next);
      else { this.setBusy(null); this.flushAutoWaiters(); }
    });
    return this.whenAutoPainted();
  }

  /** Resolves when no island auto paint is pending (at once when there is none to do). */
  whenAutoPainted(): Promise<void> {
    const idle = !this.autoRunning && (!this.autoRecipe || !this.terrainMap || !!this.autoMask);
    return idle ? Promise.resolve() : new Promise((resolve) => this.autoWaiters.push(resolve));
  }

  hasAutoPaint(): boolean { return !!this.autoMask; }

  private flushAutoWaiters() { const w = this.autoWaiters.splice(0); for (const r of w) r(); }

  private setBusy(t: number | null) { this.autoBusy = t; this.onAutoProgress?.(t); }

  private async runAuto(recipe: IslandRecipe): Promise<void> {
    const terrain = this.terrainMap;
    if (!terrain) return;
    this.setBusy(0);
    const result = await this.paintOffThread(terrain, recipe);
    if (this.autoRecipe !== recipe && this.autoPending !== undefined) return; // superseded
    this.autoMask = result.mask;
    this.lastAuto = { ms: result.ms, coverage: result.coverage };
    this.setBusy(1);
    this.recompose({ x0: 0, y0: 0, x1: PAINT_RES, y1: PAINT_RES });
    this.onPainted?.();
  }

  /** The paint in a worker when there is one (the page keeps running), else here. */
  private paintOffThread(terrain: IslandTerrain, recipe: IslandRecipe): Promise<PaintIslandResult> {
    if (!this.autoWorker && typeof Worker !== 'undefined') {
      try {
        this.autoWorker = new Worker(new URL('./island-autopaint-worker.ts', import.meta.url), { type: 'module' });
        this.autoWorker.postMessage({ type: 'terrain', terrain });
      } catch { this.autoWorker = null; }
    }
    const worker = this.autoWorker;
    const here = (progress?: (t: number) => void): PaintIslandResult => {
      const r = paintIsland(terrain, recipe, progress);
      return { ...r, mask: upsampleMask(r.mask, terrain.res, PAINT_RES / terrain.res) };
    };
    if (!worker) return Promise.resolve(here((t) => this.setBusy(t)));
    const id = ++this.autoId;
    return new Promise((resolve) => {
      const done = (result: PaintIslandResult) => { worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError); resolve(result); };
      const onMessage = (event: MessageEvent) => {
        const m = event.data as { id: number; progress?: number; error?: string } & Partial<PaintIslandResult>;
        if (m.id !== id) return;
        if (typeof m.progress === 'number') { this.setBusy(m.progress * 0.95); return; }
        if (m.error || !m.mask) { done(here()); return; }
        done({ mask: m.mask, coverage: m.coverage ?? {}, ms: m.ms ?? 0 });
      };
      // A worker that cannot start (an old browser, a blocked script) paints here instead.
      const onError = () => { this.autoWorker?.terminate(); this.autoWorker = null; done(here()); };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ type: 'paint', id, recipe, upsample: PAINT_RES / terrain.res });
    });
  }

  /* ───────────── The road ───────────── */

  /** The auto-paint runner over the island road's mask (made on first use). */
  get autoPaint(): AutoPaint { return this.roadPaint().auto; }

  /** Whether the island road has any auto paint or recorded passes. */
  hasRoadPaint(): boolean { return !!this.road && (this.road.auto.jobs.length > 0 || this.projection.size > 0); }

  /** The terrain's height (highest surface under a point), so road paint never lands under a bridge. */
  setHeightField(heightAt: ((x: number, z: number) => number | null) | null) {
    // Built here, while the island loads behind its bar, so the first auto-paint click is instant.
    const map = islandTrackSpace();
    this.footprint = heightAt ? buildRoadFootprint(new RoadMask(map.length), map, heightAt, { res: PAINT_RES, half: PAINT_HALF }) : null;
    this.reproject();
  }

  /** Loads a saved road mask; when it no longer fits the route (the road changed), re-runs its recorded passes. */
  loadRoad(doc: unknown) {
    const map = islandTrackSpace();
    const mask = RoadMask.fromDoc(doc, map.length);
    const jobs = jobsFromDoc(mask ? mask.jobs : (doc as { jobs?: unknown } | null)?.jobs);
    const road = this.makeRoad(mask ?? new RoadMask(map.length));
    road.auto.jobs.push(...(mask ? jobs : []));
    this.road = road;
    if (!mask && jobs.length) road.auto.replay(jobs);
    this.reproject();
  }

  /** The road's mask as a document (with its passes), or null when the road was never auto-painted. */
  roadDoc(trackId: string) {
    if (!this.road) return null;
    const { mask, auto } = this.road;
    mask.jobs = jobsToDoc(auto.jobs) as Record<string, unknown>[];
    let painted = mask.jobs.length > 0;
    for (let row = 0; row < mask.rows && !painted; row++) for (let c = 0; c < mask.across && !painted; c++) painted = mask.mask.isPainted(c, row);
    return painted ? mask.toDoc(trackId) : null;
  }

  private roadPaint() {
    if (!this.road) this.road = this.makeRoad(new RoadMask(islandTrackSpace().length));
    return this.road;
  }

  private makeRoad(mask: RoadMask) {
    const road = { mask, auto: null as unknown as AutoPaint };
    road.auto = new AutoPaint(trackPaintField(mask, islandTrackSpace()), () => {
      if (this.road === road) { this.reproject(); (this.onRoadPainted ?? this.onPainted)?.(); }
    });
    return road;
  }

  /** Lays the road mask onto the ground again and uploads the texels that changed. */
  private reproject() {
    const next = this.road && this.footprint ? projectFootprint(this.road.mask, this.footprint) : new Map<number, PackedTexel>();
    const prev = this.projection;
    this.projection = next;
    let x0 = PAINT_RES, y0 = PAINT_RES, x1 = -1, y1 = -1;
    const auto = this.autoMask;
    const touch = (index: number) => {
      const x = index % PAINT_RES, y = (index - x) / PAINT_RES;
      composeLayers(auto, index * 4, this.hand.data, this.view.data, index * 4, next.get(index));
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    };
    // Only the texels whose road paint changed: a pass near the camera uploads a patch, not the island.
    for (const [index, packed] of next) if (prev.get(index) !== packed) touch(index);
    for (const index of prev.keys()) if (!next.has(index)) touch(index);
    if (x1 >= x0) this.upload({ x0, y0, x1: x1 + 1, y1: y1 + 1 });
  }

  /* ───────────── Masks → GPU ───────────── */

  private recompose(rect: MaskRect) {
    const x0 = Math.max(0, rect.x0), y0 = Math.max(0, rect.y0);
    const x1 = Math.min(PAINT_RES, rect.x1), y1 = Math.min(PAINT_RES, rect.y1);
    if (x1 <= x0 || y1 <= y0) return;
    const road = this.projection.size ? this.projection : null;
    const auto = this.autoMask;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const index = y * PAINT_RES + x;
        composeLayers(auto, index * 4, this.hand.data, this.view.data, index * 4, road?.get(index));
      }
    }
    this.upload({ x0, y0, x1, y1 });
  }

  /** Queues the rows of `rect` for upload (the whole texture when that is most of it). */
  private upload(rect: MaskRect) {
    const t = this.maskTexture;
    if (rect.y1 - rect.y0 > PAINT_RES / 2) t.clearUpdateRanges();
    else {
      const width = (rect.x1 - rect.x0) * 4;
      for (let y = rect.y0; y < rect.y1; y++) t.addUpdateRange((y * PAINT_RES + rect.x0) * 4, width);
    }
    t.needsUpdate = true;
  }

  private saveTiles(rect: MaskRect) {
    if (!this.strokeTiles) return;
    const tx0 = Math.max(0, Math.floor(rect.x0 / UNDO_TILE)), ty0 = Math.max(0, Math.floor(rect.y0 / UNDO_TILE));
    const tx1 = Math.min(PAINT_RES / UNDO_TILE - 1, Math.floor((rect.x1 - 1) / UNDO_TILE));
    const ty1 = Math.min(PAINT_RES / UNDO_TILE - 1, Math.floor((rect.y1 - 1) / UNDO_TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = ty * (PAINT_RES / UNDO_TILE) + tx;
        if (this.strokeTiles.has(key)) continue;
        this.strokeTiles.set(key, this.hand.snapshot({ x0: tx * UNDO_TILE, y0: ty * UNDO_TILE, x1: (tx + 1) * UNDO_TILE, y1: (ty + 1) * UNDO_TILE }));
      }
    }
  }
}

/* ───────────── Saving ───────────── */

/**
 * Version 2: the layered mask (run-length + base64, `SurfaceMask.encode`) and the island road's auto
 * paint (a road-mask document with its passes). Version 1 held one grey PNG of painted dirt; it still
 * loads, as cracked dirt.
 */
export interface IslandGroundDoc {
  version: 1 | 2;
  settings: IslandGroundSettings;
  /** v2: the brush paint, encoded; v1: a grey PNG data URL of dirt. Null when nothing is painted. */
  mask: string | null;
  /** v2: the island road's auto paint, or none. */
  road?: RoadMaskDoc | null;
  /** v2: the island auto paint recipe (repainted at load, behind the loading bar), or none. */
  auto?: IslandRecipe | null;
  bounds: { half: number; res: number };
  /** The baked sun shadows (a grey PNG over the same square), or none. */
  shadow?: { png: string; res: number; sun: [number, number, number] } | null;
}

export const ISLAND_GROUND_KEY = 'hm2-island-ground-v1';
export const islandGroundKey = (trackId: string) => trackId === 'serpentine' ? ISLAND_GROUND_KEY : `${ISLAND_GROUND_KEY}:${trackId}`;
export const islandGroundEndpoint = (trackId: string) => `/api/island-ground${trackId === 'serpentine' ? '' : `?track=${encodeURIComponent(trackId)}`}`;

/** Encodes a grey map (the sun shadows) as a PNG (browser only). */
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

/** Decodes a saved grey map (browser only). */
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

const isGroundDoc = (doc: unknown): doc is IslandGroundDoc =>
  !!doc && typeof doc === 'object' && ((doc as IslandGroundDoc).version === 1 || (doc as IslandGroundDoc).version === 2);

export function readGroundDoc(trackId: string): IslandGroundDoc | null {
  try {
    const raw = localStorage.getItem(islandGroundKey(trackId));
    if (!raw) return null;
    const doc = JSON.parse(raw) as unknown;
    return isGroundDoc(doc) ? { ...doc, settings: normalizeIslandGround(doc.settings) } : null;
  } catch { return null; }
}

/** The brush paint from either version of the document (browser only for v1's PNG). */
export async function decodeGroundPaint(doc: IslandGroundDoc): Promise<Uint8Array | null> {
  if (!doc.mask) return null;
  if (doc.version === 2) {
    try { return SurfaceMask.decode(PAINT_RES, PAINT_RES, doc.mask).data; } catch { return null; }
  }
  const coverage = await decodeMask(doc.mask);
  if (!coverage) return null;
  const mask = new SurfaceMask(PAINT_RES, PAINT_RES);
  migrateDirtCoverage(coverage, mask);
  return mask.data;
}

/** Loads a track's ground into `ground`: the browser copy, else the disk copy. */
export async function loadGround(ground: IslandGround, trackId: string): Promise<void> {
  let doc = readGroundDoc(trackId);
  if (!doc && typeof fetch !== 'undefined') {
    try {
      const res = await fetch(islandGroundEndpoint(trackId));
      if (res.ok) {
        const found = await res.json() as unknown;
        if (isGroundDoc(found)) doc = { ...found, settings: normalizeIslandGround(found.settings) };
      }
    } catch { /* no dev server: defaults */ }
  }
  if (!doc) return;
  ground.apply(doc.settings);
  const paint = await decodeGroundPaint(doc);
  if (paint) ground.setHand(paint);
  if (doc.version === 2 && doc.road) ground.loadRoad(doc.road);
  // The island auto paint is repainted from its recipe (as soon as the terrain is known).
  const recipe = doc.version === 2 ? normalizeRecipe(doc.auto) : null;
  if (recipe) void ground.paintAuto(recipe);
  if (doc.shadow?.png) {
    const map = await decodeMask(doc.shadow.png, doc.shadow.res);
    if (map) ground.setShadow({ map, res: doc.shadow.res, sun: doc.shadow.sun });
  }
}

/** Saves a track's ground to the browser and to disk. Returns false when the browser copy did not fit. */
export function saveGround(ground: IslandGround, trackId: string): boolean {
  const shadow = ground.getShadow();
  const doc: IslandGroundDoc = {
    version: 2, settings: ground.get(), mask: ground.isPainted() ? ground.hand.encode() : null,
    road: ground.roadDoc(trackId), auto: ground.getAutoRecipe(), bounds: { half: PAINT_HALF, res: PAINT_RES },
    shadow: shadow ? { png: ground.shadowPngForSave() ?? '', res: shadow.res, sun: shadow.sun } : null,
  };
  const text = JSON.stringify(doc);
  let stored = true;
  try { localStorage.setItem(islandGroundKey(trackId), text); } catch { stored = false; }
  if (typeof fetch !== 'undefined') {
    fetch(islandGroundEndpoint(trackId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text }).catch(() => { /* no dev server */ });
  }
  return stored;
}
