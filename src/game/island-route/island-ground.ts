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
varying vec3 vGroundWorld;

float gHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 gHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float gNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// Pebbles: one round stone in some cells of a jittered grid. Returns (cover 0..1, tone, rim, dome).
vec4 gPebbles(vec3 p, float size, float amount) {
  vec3 q = p / size;
  vec3 i = floor(q);
  vec4 best = vec4(0.0, 0.5, 0.0, 0.0);
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 c = i + vec3(float(x), float(y), float(z));
    vec3 h = gHash3(c);
    if (h.x > amount) continue;
    vec3 centre = c + 0.2 + 0.6 * gHash3(c + 17.0);
    float r = 0.25 + 0.3 * h.y;
    float d = length(q - centre) / r;
    if (d < 1.0) {
      float cover = 1.0 - smoothstep(0.7, 1.0, d);
      if (cover > best.x) best = vec4(cover, h.z, smoothstep(0.75, 1.0, d), 1.0 - d * d);
    }
  }
  return best;
}
// A pebble's colour as a multiplier of the ground it lies on: darker grey, brown or a little paler,
// lit on its dome and dark at its rim.
vec3 gStone(vec4 s) {
  vec3 c = s.y < 0.45 ? mix(vec3(0.62, 0.64, 0.68), vec3(0.8, 0.81, 0.83), s.y / 0.45)
         : s.y < 0.8 ? mix(vec3(0.66, 0.58, 0.5), vec3(0.85, 0.76, 0.66), (s.y - 0.45) / 0.35)
         : mix(vec3(1.02, 1.0, 0.97), vec3(1.12, 1.1, 1.06), (s.y - 0.8) / 0.2);
  return c * (0.85 + 0.25 * s.w) * (1.0 - 0.35 * s.z);
}
// Pits: small soft hollows in the sand (no ripples).
float gPits(vec3 p, float size) {
  vec3 q = p / size;
  vec3 i = floor(q);
  float pit = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 c = i + vec3(float(x), float(y), float(z));
    vec3 centre = c + gHash3(c + 5.0);
    float d = length(q - centre) / (0.18 + 0.2 * gHash(c + 9.0));
    pit = max(pit, 1.0 - smoothstep(0.0, 1.0, d));
  }
  return pit;
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
  paint = clamp(paint * 1.25 - 0.25 * gNoise(wp / 60.0) * (1.0 - paint), 0.0, 1.0);

  if (paint > 0.001) {
    // Plain, mottled sand: broad soft patches, never ripples.
    float mottle = 0.9 + 0.1 * gNoise(wp / 900.0) + 0.06 * gNoise(wp / 180.0) - 0.05;
    vec3 sand = sandColor * mottle;
    if (near > 0.0) {
      float fine = 0.88 + 0.24 * gNoise(wp / 2.5);
      float pits = gPits(wp, 7.0) * sandPits;
      vec4 stones = gPebbles(wp + 311.0, groundPebbleSize * 0.8, sandPebbles * 0.6);
      vec3 grained = sand * fine * (1.0 - 0.35 * pits);
      vec3 detailed = mix(grained, sand * gStone(stones), stones.x);
      sand = mix(sand, detailed, near);
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, sand, paint);
  }

  if (near > 0.0 && groundGrain > 0.0) {
    float grain = 0.8 + 0.25 * gNoise(wp / 3.0) + 0.15 * gNoise(wp / 11.0) - 0.075;
    vec4 stones = gPebbles(wp, groundPebbleSize, groundPebbles);
    // Stones sit on the terrain in its own colour family.
    vec3 g = mix(vec3(grain), gStone(stones), stones.x);
    diffuseColor.rgb *= mix(vec3(1.0), g, groundGrain * near * (1.0 - paint));
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
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGroundWorld;')
    .replace('#include <project_vertex>', `#include <project_vertex>
  vGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${GROUND_FRAGMENT_HEADER}`)
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
      groundFade: { value: 7000 },
      paintMask: { value: this.maskTexture },
      paintHalf: { value: PAINT_HALF },
      sandColor: { value: new THREE.Color() },
      sandStrength: { value: 1 },
      sandPebbles: { value: 0.3 },
      sandPits: { value: 0.5 },
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
