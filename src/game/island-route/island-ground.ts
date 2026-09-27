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
  sandPits: number;
}

export const DEFAULT_ISLAND_GROUND: IslandGroundSettings = {
  tint: '#ffffff',
  brightness: 1,
  grain: 0.7,
  pebbleSize: 9,
  pebbles: 0.45,
  sandColor: '#cdc2a8',
  sandStrength: 1,
  sandPebbles: 0.3,
  sandPits: 0.5,
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
uniform sampler2D groundDetail;
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
// The baked detail tile (grain, pebbles, pits), read twice with random offsets that change across the
// ground and blended, so the tile never shows as a repeat (Inigo Quilez, "texture repetition", 3rd way).
// The two reads and their blend weight; pebbles are resolved per read, then blended (blending the
// pebble numbers first would bite pieces out of stones).
vec4 gA; vec4 gB; float gW;
void gDetail(vec2 uv, float k) {
  vec2 ddx = dFdx(uv); vec2 ddy = dFdy(uv);
  float l = k * 8.0; float ia = floor(l); float f = fract(l);
  vec2 offa = sin(vec2(3.0, 7.0) * ia); vec2 offb = sin(vec2(3.0, 7.0) * (ia + 1.0));
  gA = textureGrad(groundDetail, uv + offa, ddx, ddy);
  gB = textureGrad(groundDetail, uv + offb, ddx, ddy);
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

  // The detail up close: projected from above, or from the side on steep faces.
  gA = vec4(0.5, 0.5, 1.0, 0.0); gB = gA; gW = 0.0;
  if (near > 0.0) {
    vec3 n = abs(vGroundNormal);
    vec2 puv = n.y > 0.55 ? wp.xz : (n.x > n.z ? wp.zy : wp.xy);
    gDetail(puv / (DETAIL_CELLS * groundPebbleSize), gNoise2(wp.xz / 700.0));
  }
  vec4 d = mix(gA, gB, gW);
  float grain = 0.8 + 0.4 * d.r;

  if (paint > 0.001) {
    // Plain, mottled sand: broad soft patches, never ripples.
    float mottle = 0.9 + 0.1 * gNoise2(wp.xz / 900.0) + 0.06 * gNoise2(wp.xz / 180.0) - 0.05;
    vec3 sand = sandColor * mottle;
    vec3 detailed = sand * mix(1.0, grain, 0.6) * (1.0 - 0.35 * d.a * sandPits);
    detailed *= gStones(sandPebbles * 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(sand, detailed, near), paint);
  }

  if (near > 0.0 && groundGrain > 0.0) {
    vec3 g = vec3(grain) * gStones(groundPebbles);
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
 * under the Pebbles setting, so the sliders still work), A pits for the sand.
 */
export function makeDetailTile(res = DETAIL_RES, cells = DETAIL_CELLS): Uint8Array {
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
  const pitCells = cells * 2;
  for (let py = 0; py < res; py++) {
    for (let px = 0; px < res; px++) {
      const u = (px + 0.5) / res, v = (py + 0.5) / res;
      const grain = 0.6 * valueNoise(u * cells * 4, v * cells * 4, cells * 4, 1) + 0.4 * valueNoise(u * cells * 1.2, v * cells * 1.2, cells * 1.2, 2);
      // Pebbles: the nearest stone among the 3 x 3 cells around.
      const qx = u * cells, qy = v * cells;
      const cx = Math.floor(qx), cy = Math.floor(qy);
      let cover = 0, shade = 1, id = 1;
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
      }
      // Pits: small soft hollows.
      const rx = u * pitCells, ry = v * pitCells;
      const kx = Math.floor(rx), ky = Math.floor(ry);
      let pit = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = wrap(kx + dx, pitCells), gy = wrap(ky + dy, pitCells);
        const ox = kx + dx + hash2(gx, gy, 8), oy = ky + dy + hash2(gx, gy, 9);
        const d = Math.hypot(rx - ox, ry - oy) / (0.18 + 0.2 * hash2(gx, gy, 10));
        pit = Math.max(pit, 1 - Math.min(1, d));
      }
      const o = (py * res + px) * 4;
      out[o] = Math.round(grain * 255);
      out[o + 1] = Math.round(Math.min(1, shade / 2) * 255);
      out[o + 2] = cover > 0.02 ? Math.round(id * 255) : 255;
      out[o + 3] = Math.round(pit * pit * (3 - 2 * pit) * 255);
    }
  }
  return out;
}

let detailTexture: THREE.DataTexture | null = null;
/** The tile on the GPU (made once, shared). */
export function detailTileTexture(): THREE.DataTexture {
  if (detailTexture) return detailTexture;
  const t = new THREE.DataTexture(makeDetailTile(), DETAIL_RES, DETAIL_RES, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return detailTexture = t;
}

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
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;\nvarying vec3 vGroundNormal;')
    .replace('#include <project_vertex>', `#include <project_vertex>
  vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vGroundNormal = normalize(mat3(modelMatrix) * objectNormal);`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n#define DETAIL_CELLS ${DETAIL_CELLS.toFixed(1)}\n${GROUND_FRAGMENT_HEADER}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${GROUND_FRAGMENT_BODY}`);
}

/** The live ground of one island material: its settings, and the paint mask on the GPU. */
export class IslandGround {
  readonly mask = new Uint8Array(PAINT_RES * PAINT_RES);
  readonly maskTexture: THREE.DataTexture;
  readonly uniforms: Record<string, THREE.IUniform>;
  private settings: IslandGroundSettings = { ...DEFAULT_ISLAND_GROUND };

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
      sandPits: { value: 0.5 },
      groundDetail: { value: detailTileTexture() },
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
  }

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
}

export const ISLAND_GROUND_KEY = 'hm2-island-ground-v1';
export const islandGroundKey = (trackId: string) => trackId === 'serpentine' ? ISLAND_GROUND_KEY : `${ISLAND_GROUND_KEY}:${trackId}`;
export const islandGroundEndpoint = (trackId: string) => `/api/island-ground${trackId === 'serpentine' ? '' : `?track=${encodeURIComponent(trackId)}`}`;

/** Encodes the mask as a grey PNG (browser only). */
export function encodeMask(mask: Uint8Array): string | null {
  if (typeof document === 'undefined' || !mask.some((v) => v > 0)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PAINT_RES;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(PAINT_RES, PAINT_RES);
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]; const o = i * 4;
    img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Decodes a saved mask (browser only). */
export function decodeMask(url: string): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = PAINT_RES;
      const g = canvas.getContext('2d');
      if (!g) { resolve(null); return; }
      g.drawImage(image, 0, 0, PAINT_RES, PAINT_RES);
      const px = g.getImageData(0, 0, PAINT_RES, PAINT_RES).data;
      const mask = new Uint8Array(PAINT_RES * PAINT_RES);
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
}

/** Saves a track's ground to the browser and to disk. Returns false when the browser copy did not fit. */
export function saveGround(ground: IslandGround, trackId: string): boolean {
  const doc: IslandGroundDoc = { version: 1, settings: ground.get(), mask: encodeMask(ground.mask), bounds: { half: PAINT_HALF, res: PAINT_RES } };
  const text = JSON.stringify(doc);
  let stored = true;
  try { localStorage.setItem(islandGroundKey(trackId), text); } catch { stored = false; }
  if (typeof fetch !== 'undefined') {
    fetch(islandGroundEndpoint(trackId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text }).catch(() => { /* no dev server */ });
  }
  return stored;
}
