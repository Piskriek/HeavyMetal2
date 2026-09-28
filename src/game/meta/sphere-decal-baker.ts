/**
 * Equirectangular ball baker (Deliverable 2).
 * Target in game repo: `src/game/ball/sphere-baker.ts` (+ `sphere-baker.worker.ts` wrapper).
 *
 * Conventions (MUST match the renderer):
 *  - Texture is W×H with W = 2H (512×256 field LOD, 1024×512 garage / own racer).
 *  - u ∈ [0,1) wraps the ROLLING circumference. v = 1 is the +X axle pole, v = 0 the −X axle pole.
 *  - The renderer rotates `SphereGeometry` with `rotateZ(-π/2)` so the geometry's pinched poles sit
 *    on the axle, UNDER the brass bearing caps. The rolling equator therefore receives uniform texel
 *    density and continuous stripes; polar pinch is physically hidden.
 *  - Canvas row 0 = v = 1 (Three.js `flipY = true` default).
 *
 * All sampling is inverse-mapped (output texel → surface direction → decal-local coords), so every
 * texel is written exactly once per layer: no holes, no stretching, deterministic byte output.
 */
import type { BaseMaterialDef, BaseMaterialId, CustomBallConfig, DecalBlendMode, DecalProjection, DecalStamp, HexColor } from './interfaces';

export interface RgbaImage { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }
type Vec3 = readonly [number, number, number];

const TAU = Math.PI * 2;

/* ───────────── Coordinate maps ───────────── */

/** Texel centre → (u, v). */
export const texelToUv = (x: number, y: number, w: number, h: number) => [(x + 0.5) / w, 1 - (y + 0.5) / h] as const;

/** (u, v) → unit direction in TEXTURE frame (pole = +Y, like un-rotated SphereGeometry). */
export function uvToDir(u: number, v: number): Vec3 {
  const phi = u * TAU;
  const theta = (1 - v) * Math.PI; // polar angle from +Y pole
  const s = Math.sin(theta);
  return [-Math.cos(phi) * s, Math.cos(theta), Math.sin(phi) * s];
}

/** Latitude in radians, 0 at the rolling equator. */
export const vToLat = (v: number) => (v - 0.5) * Math.PI;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Orthonormal tangent frame at (u, v), rotated by `rotation` around the normal. */
export function tangentFrame(u: number, v: number, rotation: number) {
  const c = uvToDir(u, v);
  const phi = u * TAU;
  const east: Vec3 = [Math.sin(phi), 0, Math.cos(phi)];     // ∂dir/∂φ, normalized (well-defined even at poles)
  const north = cross(c, east);                             // toward the +Y (v=1) pole
  const cr = Math.cos(rotation), sr = Math.sin(rotation);
  const e: Vec3 = [cr * east[0] + sr * north[0], cr * east[1] + sr * north[1], cr * east[2] + sr * north[2]];
  const n: Vec3 = [-sr * east[0] + cr * north[0], -sr * east[1] + cr * north[1], -sr * east[2] + cr * north[2]];
  return { c, e, n };
}

/**
 * Gnomonic (tangent-plane) projection: surface direction d → decal-local (s, t) ∈ [0,1]² or null.
 * α = scale·π/2 is the angular half-width. Exact on a sphere: no cos(lat) fudge is needed for the
 * sampling itself; cos(lat) only appears when computing the texel bounding box (see `stampBounds`).
 */
export function gnomonic(d: Vec3, frame: ReturnType<typeof tangentFrame>, halfTan: number): readonly [number, number] | null {
  const dc = dot(d, frame.c);
  if (dc <= 0.05) return null; // back hemisphere / grazing: reject (also prevents divide blow-up)
  const x = dot(d, frame.e) / dc;
  const y = dot(d, frame.n) / dc;
  const s = x / (2 * halfTan) + 0.5;
  const t = 0.5 - y / (2 * halfTan);
  return s < 0 || s > 1 || t < 0 || t > 1 ? null : [s, t];
}

/** Texel rows/cols worth visiting for a stamp. Columns widen by 1/cos(lat) near the poles (the “polar compensation”). */
export function stampBounds(stamp: DecalStamp, _w: number, h: number) {
  const alpha = Math.min(Math.PI / 2 - 0.01, stamp.scale * (Math.PI / 2));
  const reach = Math.atan(Math.tan(alpha) * Math.SQRT2); // rotated-square corner
  const lat0 = vToLat(stamp.v);
  const latMin = Math.max(-Math.PI / 2, lat0 - reach), latMax = Math.min(Math.PI / 2, lat0 + reach);
  const yMin = Math.max(0, Math.floor((0.5 - latMax / Math.PI) * h) - 1);
  const yMax = Math.min(h - 1, Math.ceil((0.5 - latMin / Math.PI) * h) + 1);
  const worstCos = Math.cos(Math.max(Math.abs(latMin), Math.abs(latMax)));
  const touchesPole = latMax >= Math.PI / 2 - 1e-3 || latMin <= -Math.PI / 2 + 1e-3 || worstCos < 1e-3;
  const halfSpanU = touchesPole ? 0.5 : Math.min(0.5, reach / worstCos / TAU);
  return { yMin, yMax, u0: stamp.u - halfSpanU, u1: stamp.u + halfSpanU, fullRow: halfSpanU >= 0.5, halfTan: Math.tan(alpha) };
}

/* ───────────── Sampling & blending ───────────── */

/** A texel index inside [0, n): wrapped or clamped. Module-level so the hot loop creates no closures. */
function clampTap(i: number, n: number, wrap: boolean): number {
  return wrap ? ((i % n) + n) % n : i < 0 ? 0 : i >= n ? n - 1 : i;
}

export function sampleBilinear(img: RgbaImage, s: number, t: number, wrapS = false, out: [number, number, number, number] = [0, 0, 0, 0]): [number, number, number, number] {
  const W = img.width, H = img.height, data = img.data;
  const fx = s * W - 0.5, fy = t * H - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const ax = fx - x0, ay = fy - y0;
  const xa = clampTap(x0, W, wrapS), xb = clampTap(x0 + 1, W, wrapS), ya = clampTap(y0, H, false) * W, yb = clampTap(y0 + 1, H, false) * W;
  const i00 = (ya + xa) * 4, i10 = (ya + xb) * 4, i01 = (yb + xa) * 4, i11 = (yb + xb) * 4;
  const w00 = (1 - ax) * (1 - ay), w10 = ax * (1 - ay), w01 = (1 - ax) * ay, w11 = ax * ay;
  for (let k = 0; k < 4; k++) out[k] = data[i00 + k] * w00 + data[i10 + k] * w10 + data[i01 + k] * w01 + data[i11 + k] * w11;
  return out;
}
const TAP: [number, number, number, number] = [0, 0, 0, 0];

export function hexToRgb(hex: HexColor): [number, number, number] {
  const n = parseInt(hex.slice(1).padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blendChannel(dst: number, src: number, mode: DecalBlendMode) {
  const a = dst / 255, b = src / 255;
  switch (mode) {
    case 'normal': return src;
    case 'multiply': return a * b * 255;
    case 'overlay': return (a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b)) * 255;
  }
}

function writeBlend(out: Uint8ClampedArray, i: number, rgba: readonly number[], opacity: number, mode: DecalBlendMode, tint: [number, number, number] | null) {
  const alpha = (rgba[3] / 255) * opacity;
  if (alpha <= 0.002) return;
  for (let k = 0; k < 3; k++) {
    const src = tint ? (rgba[k] / 255) * tint[k] : rgba[k];
    const mixed = blendChannel(out[i + k], src, mode);
    out[i + k] = out[i + k] + (mixed - out[i + k]) * alpha;
  }
  out[i + 3] = 255; // ball texture is always opaque
}

/* ───────────── Base material (3D noise → seamless across the u seam and at the poles) ───────────── */

function hash3(x: number, y: number, z: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(seed, 144665)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise3(p: Vec3, seed: number) {
  const [x, y, z] = p;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const ux = sm(fx), uy = sm(fy), uz = sm(fz);
  let acc = 0;
  for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const w = (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
    acc += hash3(xi + dx, yi + dy, zi + dz, seed) * w;
  }
  return acc;
}

export const BASE_MATERIALS: Readonly<Record<BaseMaterialId, BaseMaterialDef>> = {
  'scrap-iron': { id: 'scrap-iron', name: 'Scrap Iron', unlock: { kind: 'default' }, bakedAmbient: 0.18,
    palette: [{ at: 0, color: '#2b2622' }, { at: 0.55, color: '#4a4540' }, { at: 0.8, color: '#6e4a2e' }, { at: 1, color: '#9a5a2a' }],
    noise: { kind: 'pitted', frequency: 9, octaves: 3, contrast: 1.2 } },
  'galvanized-brass': { id: 'galvanized-brass', name: 'Galvanized Brass', unlock: { kind: 'shop', price: 1200 as never }, bakedAmbient: 0.12,
    palette: [{ at: 0, color: '#6e4d17' }, { at: 0.5, color: '#b88a35' }, { at: 1, color: '#f0cf7a' }],
    noise: { kind: 'brushed', frequency: 40, octaves: 2, contrast: 0.6, anisotropy: 'u' } },
  damascus: { id: 'damascus', name: 'Damascus Springsteel', unlock: { kind: 'shop', price: 2500 as never }, bakedAmbient: 0.14,
    palette: [{ at: 0, color: '#1e2226' }, { at: 0.45, color: '#5d656d' }, { at: 0.55, color: '#aeb6bd' }, { at: 1, color: '#e3e8ec' }],
    noise: { kind: 'folded-wave', frequency: 6, octaves: 3, contrast: 1.6 } },
  'scorched-obsidian': { id: 'scorched-obsidian', name: 'Scorched Obsidian', unlock: { kind: 'shop', price: 4000 as never }, bakedAmbient: 0.2,
    palette: [{ at: 0, color: '#0c0b0d' }, { at: 0.7, color: '#232026' }, { at: 1, color: '#3a3440' }],
    noise: { kind: 'fissure', frequency: 7, octaves: 4, contrast: 1.4 },
    emissive: { color: '#ff5a1a', threshold: 0.93, intensity: 1.4 } },
  'boiler-copper': { id: 'boiler-copper', name: 'Boiler Copper', unlock: { kind: 'shop', price: 1800 as never }, bakedAmbient: 0.14,
    palette: [{ at: 0, color: '#3d8f82' }, { at: 0.35, color: '#6fb7a4' }, { at: 0.5, color: '#9c5a32' }, { at: 1, color: '#e08a55' }],
    noise: { kind: 'patina', frequency: 8, octaves: 3, contrast: 1.1 } },
};

function paletteAt(def: BaseMaterialDef, t: number): [number, number, number] {
  const stops = def.palette;
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i].at) {
      const a = stops[i - 1], b = stops[i];
      const f = (x - a.at) / Math.max(1e-6, b.at - a.at);
      const ca = hexToRgb(a.color), cb = hexToRgb(b.color);
      return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
    }
  }
  return hexToRgb(stops[stops.length - 1].color);
}

function baseField(def: BaseMaterialDef, d: Vec3, u: number, v: number, seed: number) {
  const f = def.noise.frequency / Math.PI;
  let amp = 1, sum = 0, norm = 0;
  for (let o = 0; o < def.noise.octaves; o++) {
    const m = f * 2 ** o;
    sum += valueNoise3([d[0] * m, d[1] * m, d[2] * m], seed + o) * amp;
    norm += amp; amp *= 0.5;
  }
  let n = sum / norm;
  switch (def.noise.kind) {
    case 'brushed': n = 0.5 + 0.5 * Math.sin(v * Math.PI * def.noise.frequency + n * 3) * 0.3 + (n - 0.5) * 0.7; break;
    case 'folded-wave': n = 0.5 + 0.5 * Math.sin((u * TAU + n * 6) * 3 + v * 20); break;
    case 'fissure': n = 1 - Math.abs(n - 0.5) * 2; break;
    case 'patina': n = n > 0.52 ? 0.25 * n : 0.5 + n; break;
    case 'pitted': n = n < 0.3 ? n * 0.4 : n; break;
  }
  return 0.5 + (n - 0.5) * def.noise.contrast;
}

/* ───────────── Public bake API ───────────── */

export interface DecalSource { readonly projection: DecalProjection; readonly image: RgbaImage }

export interface BakeResult { readonly albedo: RgbaImage; readonly emissive: RgbaImage | null; readonly bakeKey: string }

/** Baked base layers by (base, accent, width): the noise pass is the slow part of a bake. */
const BASE_LAYER_CACHE = new Map<string, { albedo: Uint8ClampedArray; emissive: Uint8ClampedArray | null }>();
const BASE_LAYER_CACHE_MAX = 8;

export function bakeBall(config: CustomBallConfig, decals: ReadonlyMap<string, DecalSource>, width = 512): BakeResult {
  const w = width, h = width / 2;
  const albedo = new Uint8ClampedArray(w * h * 4);
  const def = BASE_MATERIALS[config.base];
  const emissive = def.emissive ? new Uint8ClampedArray(w * h * 4) : null;
  // Seed depends on the finish only → the base layer is shareable/cacheable per (base, accent);
  // edits that touch decals never re-run the expensive noise pass.
  const seed = config.base.split('').reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) | 0, 7);
  const accent = hexToRgb(config.accentColor);

  // 1) Base metal + baked ambient lift + equatorial accent pin-line (replaces the old 2D rim stroke).
  //    It depends only on (base, accent, width), so it is cached: a decal edit re-stamps decals only.
  const baseKey = `${config.base}|${config.accentColor}|${w}`;
  const cached = BASE_LAYER_CACHE.get(baseKey);
  if (cached) {
    albedo.set(cached.albedo);
    if (emissive && cached.emissive) emissive.set(cached.emissive);
  } else {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [u, v] = texelToUv(x, y, w, h);
      const d = uvToDir(u, v);
      const t = baseField(def, d, u, v, seed);
      const rgb = paletteAt(def, t);
      const lift = def.bakedAmbient * 255;
      const i = (y * w + x) * 4;
      const pin = Math.abs(v - 0.5) < 0.012 ? 1 : Math.abs(Math.abs(v - 0.5) - 0.3) < 0.006 ? 0.6 : 0;
      for (let k = 0; k < 3; k++) albedo[i + k] = rgb[k] * (1 - pin) + accent[k] * pin + lift * (1 - rgb[k] / 255);
      albedo[i + 3] = 255;
      if (emissive && def.emissive && t > def.emissive.threshold) {
        const e = hexToRgb(def.emissive.color);
        const s = Math.min(1, (t - def.emissive.threshold) / (1 - def.emissive.threshold)) * def.emissive.intensity;
        emissive[i] = e[0] * s; emissive[i + 1] = e[1] * s; emissive[i + 2] = e[2] * s; emissive[i + 3] = 255;
      }
    }
  }

  BASE_LAYER_CACHE.set(baseKey, { albedo: albedo.slice(), emissive: emissive ? emissive.slice() : null });
  if (BASE_LAYER_CACHE.size > BASE_LAYER_CACHE_MAX) BASE_LAYER_CACHE.delete(BASE_LAYER_CACHE.keys().next().value!);
  }

  // 2) Decals, back → front.
  for (const stamp of config.decals) {
    const src = decals.get(stamp.textureId);
    if (!src) continue;
    const tint = stamp.tintColor ? hexToRgb(stamp.tintColor) : null;
    if (src.projection === 'band') { bakeBand(albedo, w, h, stamp, src.image, tint); continue; }
    const frame = tangentFrame(stamp.u, stamp.v, stamp.rotation);
    const b = stampBounds(stamp, w, h);
    for (let y = b.yMin; y <= b.yMax; y++) {
      const xs = b.fullRow ? [0, w - 1] : [Math.floor(b.u0 * w), Math.ceil(b.u1 * w)];
      for (let xr = xs[0]; xr <= xs[1]; xr++) {
        const x = ((xr % w) + w) % w; // wrap across the u seam
        const [u, v] = texelToUv(x, y, w, h);
        const st = gnomonic(uvToDir(u, v), frame, b.halfTan);
        if (!st) continue;
        const s = stamp.mirrorU ? 1 - st[0] : st[0];
        writeBlend(albedo, (y * w + x) * 4, sampleBilinear(src.image, s, st[1], false, TAP), stamp.opacity, stamp.blendMode, tint);
      }
    }
  }
  return { albedo: { width: w, height: h, data: albedo }, emissive: emissive ? { width: w, height: h, data: emissive } : null, bakeKey: config.bakeKey };
}

/** Constant-latitude ring. `scale` = half-height in latitude fraction; repeats are integral → seam-free. */
function bakeBand(out: Uint8ClampedArray, w: number, h: number, stamp: DecalStamp, img: RgbaImage, tint: [number, number, number] | null) {
  const halfV = stamp.scale * 0.5;
  // Whole repeats around the ring, chosen so one repeat keeps the artwork's aspect ratio: the
  // ring is `w` texels around and `2·halfV·h` texels tall.
  const bandTexels = Math.max(1, 2 * halfV * h);
  const aspect = img.height > 0 ? img.width / img.height : 1;
  const repeats = Math.max(1, Math.round(w / (bandTexels * aspect)));
  const yMin = Math.max(0, Math.floor((1 - (stamp.v + halfV)) * h));
  const yMax = Math.min(h - 1, Math.ceil((1 - (stamp.v - halfV)) * h));
  for (let y = yMin; y <= yMax; y++) {
    const v = 1 - (y + 0.5) / h;
    const t = (stamp.v + halfV - v) / (2 * halfV);
    if (t < 0 || t > 1) continue;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      // Integral `repeats` + wrap-around sampling ⇒ the ring closes on itself with no seam,
      // including for a negative turn (the modulo is lifted back into [0, 1)).
      const s = (((u * repeats + stamp.rotation / TAU) % 1) + 1) % 1;
      writeBlend(out, (y * w + x) * 4, sampleBilinear(img, s, t, true, TAP), stamp.opacity, stamp.blendMode, tint);
    }
  }
}

/** Stable bake key: FNV-1a over a canonical JSON of the cosmetic config (sans bakeKey). */
export function computeBakeKey(config: Omit<CustomBallConfig, 'bakeKey'>): string {
  const canonical = JSON.stringify([config.version, config.base, config.accentColor, config.capFinish,
    config.decals.map((d) => [d.textureId, +d.u.toFixed(4), +d.v.toFixed(4), +d.scale.toFixed(4), +d.rotation.toFixed(4), +d.opacity.toFixed(3), d.tintColor, d.blendMode, !!d.mirrorU, d.number ?? null])]);
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) { h ^= canonical.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `ball-v1-${h.toString(36)}`;
}
