// @ts-nocheck (agent-generated: strict cleanup pending; behaviour is covered by the tests)
// pbrgrass.ts
// Procedural PBR grass texture generator — pure math, no images, no imports.
// All output maps (albedo, normal, roughness, ao) are derived from one shared
// height field so they always agree with each other.

export interface Var {
  key: string;
  type: 'number' | 'color' | 'boolean' | 'enum';
  label: string;
  doc: string;
  tier: 'play' | 'build' | 'pro';
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group: string;
}

export type Params = Record<string, number | boolean | string>;

export interface GrassMaps {
  size: number;
  albedo: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  roughness: Uint8ClampedArray;
  ao: Uint8ClampedArray;
  height: Float32Array;
}

export interface Preset {
  id: string;
  name: string;
  doc: string;
  params: Params;
}

/* ------------------------------------------------------------------ */
/* Variable catalogue                                                  */
/* ------------------------------------------------------------------ */

export const GRASS_VARS: Var[] = [
  { key: 'bladeDensity', type: 'number', label: 'Blade Density', doc: 'Controls how many individual grass blades are packed into the tile.', tier: 'play', default: 0.62, min: 0, max: 1, step: 0.01, group: 'Blades' },
  { key: 'bladeLength', type: 'number', label: 'Blade Length', doc: 'Sets how tall grass blades grow as a fraction of the tile.', tier: 'play', default: 0.2, min: 0.04, max: 0.4, step: 0.01, group: 'Blades' },
  { key: 'bladeWidth', type: 'number', label: 'Blade Width', doc: 'Sets how wide each blade is at its base.', tier: 'build', default: 0.012, min: 0.004, max: 0.03, step: 0.001, group: 'Blades' },
  { key: 'bladeTaper', type: 'number', label: 'Blade Taper', doc: 'Controls how sharply blades narrow from base to tip.', tier: 'build', default: 0.7, min: 0, max: 1, step: 0.01, group: 'Blades' },
  { key: 'bladeBend', type: 'number', label: 'Blade Bend', doc: 'Adds a consistent curve to every blade, like gravity pulling them over.', tier: 'build', default: 0.2, min: -1, max: 1, step: 0.01, group: 'Blades' },
  { key: 'bendRandom', type: 'number', label: 'Bend Randomness', doc: 'Randomises how much each blade bends away from the average curve.', tier: 'pro', default: 0.4, min: 0, max: 1, step: 0.01, group: 'Blades' },
  { key: 'windDirection', type: 'number', label: 'Wind Direction', doc: 'Sets the compass angle in degrees that blades lean towards.', tier: 'build', default: 45, min: 0, max: 360, step: 1, group: 'Blades' },
  { key: 'windStrength', type: 'number', label: 'Wind Strength', doc: 'Controls how strongly a steady breeze sways and leans the blades.', tier: 'play', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Blades' },

  { key: 'clumpScale', type: 'number', label: 'Clump Scale', doc: 'Sets how many grass clumps fit across the tile.', tier: 'build', default: 6, min: 2, max: 16, step: 1, group: 'Clumps' },
  { key: 'clumpTightness', type: 'number', label: 'Clump Tightness', doc: 'Controls how strongly blades within a clump lean towards a shared direction.', tier: 'pro', default: 0.6, min: 0, max: 1, step: 0.01, group: 'Clumps' },
  { key: 'clumpGaps', type: 'number', label: 'Clump Gaps', doc: 'Controls how much bare space opens up between clumps.', tier: 'build', default: 0.35, min: 0, max: 1, step: 0.01, group: 'Clumps' },

  { key: 'soilAmount', type: 'number', label: 'Soil Amount', doc: 'Controls how much bare soil shows through the grass overall.', tier: 'play', default: 0.15, min: 0, max: 1, step: 0.01, group: 'Soil' },
  { key: 'soilColour', type: 'color', label: 'Soil Colour', doc: 'Sets the colour of the bare ground visible between blades.', tier: 'build', default: '#4a3626', group: 'Soil' },
  { key: 'soilMoisture', type: 'number', label: 'Soil Moisture', doc: 'Darkens the soil and makes the surface glossier when damp.', tier: 'build', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Soil' },
  { key: 'cloverAmount', type: 'number', label: 'Clover Amount', doc: 'Controls how many small clover patches grow among the grass.', tier: 'play', default: 0.05, min: 0, max: 1, step: 0.01, group: 'Soil' },
  { key: 'cloverColour', type: 'color', label: 'Clover Colour', doc: 'Sets the colour of clover leaves.', tier: 'build', default: '#2f8a3f', group: 'Soil' },
  { key: 'flowerAmount', type: 'number', label: 'Flower Amount', doc: 'Controls what fraction of clover patches sprout a tiny flower.', tier: 'build', default: 0.2, min: 0, max: 1, step: 0.01, group: 'Soil' },
  { key: 'flowerColour', type: 'color', label: 'Flower Colour', doc: 'Sets the colour of the tiny clover flowers.', tier: 'build', default: '#ffffff', group: 'Soil' },

  { key: 'tipColour', type: 'color', label: 'Tip Colour', doc: 'Sets the colour at the very tip of each grass blade.', tier: 'play', default: '#6ab84a', group: 'Colour' },
  { key: 'baseColour', type: 'color', label: 'Base Colour', doc: 'Sets the colour at the root of each grass blade.', tier: 'play', default: '#1f5c22', group: 'Colour' },
  { key: 'midColour', type: 'color', label: 'Mid Colour', doc: 'Sets the colour blended between the base and the tip.', tier: 'build', default: '#3f8f2d', group: 'Colour' },
  { key: 'colourVariation', type: 'number', label: 'Colour Variation', doc: 'Adds random per-blade hue shifts for natural looking variety.', tier: 'build', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Colour' },

  { key: 'deadFraction', type: 'number', label: 'Dead Fraction', doc: 'Controls what fraction of blades are dried out straw.', tier: 'play', default: 0.08, min: 0, max: 1, step: 0.01, group: 'Wear' },
  { key: 'deadColour', type: 'color', label: 'Dead Colour', doc: 'Sets the colour of dried out, dead grass blades.', tier: 'build', default: '#9c8a4a', group: 'Wear' },

  { key: 'reliefStrength', type: 'number', label: 'Relief Strength', doc: 'Controls how much the ground undulates beneath the grass and how strongly normals tilt.', tier: 'build', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Relief' },
  { key: 'aoStrength', type: 'number', label: 'Ambient Occlusion Strength', doc: 'Controls how dark crevices and dense low patches become.', tier: 'build', default: 0.6, min: 0, max: 1, step: 0.01, group: 'Relief' },
  { key: 'roughnessBase', type: 'number', label: 'Base Roughness', doc: 'Sets the default surface roughness of dry grass.', tier: 'build', default: 0.75, min: 0.2, max: 1, step: 0.01, group: 'Relief' },
  { key: 'roughnessWet', type: 'number', label: 'Wet Roughness', doc: 'Sets the surface roughness when the ground is fully wet.', tier: 'pro', default: 0.35, min: 0.2, max: 1, step: 0.01, group: 'Relief' },

  { key: 'macroScale', type: 'number', label: 'Macro Scale', doc: 'Sets how many large soft colour patches appear across the tile.', tier: 'build', default: 4, min: 2, max: 10, step: 1, group: 'Macro' },
  { key: 'macroStrength', type: 'number', label: 'Macro Strength', doc: 'Controls how strongly the large scale patches brighten or darken the colour.', tier: 'build', default: 0.4, min: 0, max: 1, step: 0.01, group: 'Macro' },
  { key: 'macroHue', type: 'number', label: 'Macro Hue Shift', doc: 'Controls how strongly the large scale patches shift colour temperature.', tier: 'pro', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Macro' },

  { key: 'detailScale', type: 'number', label: 'Detail Scale', doc: 'Sets the frequency of fine micro surface noise.', tier: 'pro', default: 20, min: 4, max: 64, step: 1, group: 'Detail' },
  { key: 'detailStrength', type: 'number', label: 'Detail Strength', doc: 'Controls how strongly fine micro noise roughens the surface height.', tier: 'pro', default: 0.4, min: 0, max: 1, step: 0.01, group: 'Detail' },
];

/* ------------------------------------------------------------------ */
/* Params helpers                                                      */
/* ------------------------------------------------------------------ */

export function defaults(): Params {
  const out: Params = {};
  for (const v of GRASS_VARS) out[v.key] = v.default;
  return out;
}

function clampNum(val: number, v: Var): number {
  let x = val;
  if (!Number.isFinite(x)) x = v.default as number;
  if (typeof v.min === 'number') x = Math.max(v.min, x);
  if (typeof v.max === 'number') x = Math.min(v.max, x);
  return x;
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeParams(p: unknown): Params {
  const src: Record<string, unknown> = (p && typeof p === 'object') ? (p as Record<string, unknown>) : {};
  const out: Params = {};
  for (const v of GRASS_VARS) {
    const raw = src[v.key];
    if (v.type === 'number') {
      const num = typeof raw === 'number' ? raw : Number(raw);
      out[v.key] = clampNum(Number.isFinite(num) ? num : (v.default as number), v);
    } else if (v.type === 'boolean') {
      out[v.key] = typeof raw === 'boolean' ? raw : (v.default as boolean);
    } else if (v.type === 'enum') {
      out[v.key] = (typeof raw === 'string' && v.options && v.options.includes(raw)) ? raw : (v.default as string);
    } else {
      out[v.key] = (typeof raw === 'string' && COLOR_RE.test(raw)) ? raw : (v.default as string);
    }
  }
  return out;
}

export function validateParams(p: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const src: Record<string, unknown> = (p && typeof p === 'object') ? (p as Record<string, unknown>) : {};
  for (const v of GRASS_VARS) {
    const raw = src[v.key];
    if (raw === undefined) { errors.push(`missing ${v.key}`); continue; }
    if (v.type === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        errors.push(`${v.key} is not a finite number`);
      } else {
        if (typeof v.min === 'number' && raw < v.min) errors.push(`${v.key} below min`);
        if (typeof v.max === 'number' && raw > v.max) errors.push(`${v.key} above max`);
      }
    } else if (v.type === 'boolean') {
      if (typeof raw !== 'boolean') errors.push(`${v.key} is not boolean`);
    } else if (v.type === 'enum') {
      if (typeof raw !== 'string' || !(v.options || []).includes(raw)) errors.push(`${v.key} invalid option`);
    } else {
      if (typeof raw !== 'string' || !COLOR_RE.test(raw)) errors.push(`${v.key} invalid colour`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function preset(id: string, name: string, doc: string, overrides: Partial<Record<string, number | boolean | string>>): Preset {
  const merged: Record<string, unknown> = { ...defaults(), ...overrides };
  return { id, name, doc, params: normalizeParams(merged) };
}

export const PRESETS: Preset[] = [
  preset('lush-meadow', 'Lush Meadow', 'Dense, vivid, well-watered meadow grass.', {
    bladeDensity: 0.85, bladeLength: 0.26, bladeWidth: 0.013, colourVariation: 0.35,
    baseColour: '#1f5c22', midColour: '#3f8f2d', tipColour: '#6ab84a', soilColour: '#4a3626',
    deadFraction: 0.04, cloverAmount: 0.06, flowerAmount: 0.25, cloverColour: '#2f7a3d',
    flowerColour: '#ffffff', soilMoisture: 0.45, windStrength: 0.3, reliefStrength: 0.5,
  }),
  preset('cut-lawn', 'Cut Lawn', 'Short, uniform, freshly mown lawn.', {
    bladeDensity: 0.95, bladeLength: 0.09, bladeWidth: 0.01, bladeTaper: 0.5, bendRandom: 0.15,
    clumpGaps: 0.1, baseColour: '#2d5f27', midColour: '#3f7a2f', tipColour: '#4f8f3a',
    soilColour: '#4a3626', deadFraction: 0.02, cloverAmount: 0.01, reliefStrength: 0.25, detailStrength: 0.2,
  }),
  preset('tropical-lawn', 'Tropical Lawn', 'Broad, saturated, humid tropical turf.', {
    bladeWidth: 0.02, bladeDensity: 0.8, baseColour: '#154d1f', midColour: '#1f8a3a', tipColour: '#39c45c',
    soilMoisture: 0.6, soilColour: '#3a2f20', flowerAmount: 0.3, cloverColour: '#2f9c4a', cloverAmount: 0.07,
  }),
  preset('dry-savanna', 'Dry Savanna', 'Sparse, sun-baked, mostly dead grass.', {
    bladeDensity: 0.45, bladeLength: 0.3, deadFraction: 0.55, baseColour: '#8a7a33', midColour: '#b7a048',
    tipColour: '#d8c468', soilColour: '#9c8255', soilMoisture: 0.05, roughnessBase: 0.85, soilAmount: 0.35,
    windStrength: 0.5, deadColour: '#8f7a40',
  }),
  preset('autumn-field', 'Autumn Field', 'Warm orange and brown fading grass.', {
    bladeDensity: 0.65, deadFraction: 0.3, baseColour: '#6b4a20', midColour: '#b06a2a', tipColour: '#d98f33',
    deadColour: '#8a5a28', soilColour: '#4a3220', colourVariation: 0.5, windStrength: 0.35,
  }),
  preset('mossy-forest-floor', 'Mossy Forest Floor', 'Dark, damp, shaded undergrowth.', {
    bladeDensity: 0.7, bladeLength: 0.12, baseColour: '#0e3d1e', midColour: '#1c5c2a', tipColour: '#2f7a3a',
    soilColour: '#2a2117', soilMoisture: 0.7, aoStrength: 0.8, roughnessBase: 0.9, roughnessWet: 0.3, macroStrength: 0.5,
  }),
  preset('wet-marsh', 'Wet Marsh Grass', 'Tall thin reeds in waterlogged ground.', {
    bladeDensity: 0.55, bladeLength: 0.33, bladeWidth: 0.008, baseColour: '#2a4a3a', midColour: '#3c6a4f',
    tipColour: '#5a8f6a', soilColour: '#2e2a22', soilMoisture: 0.85, roughnessWet: 0.2, roughnessBase: 0.55, windStrength: 0.25,
  }),
  preset('clover-lawn', 'Clover Lawn', 'A lawn overtaken by flowering clover.', {
    bladeDensity: 0.6, cloverAmount: 0.55, cloverColour: '#2f8a3f', flowerAmount: 0.4, flowerColour: '#ffffff',
    baseColour: '#2a5c28', midColour: '#3f7a35', tipColour: '#59974a', soilColour: '#4a3626',
  }),
  preset('windswept-dune', 'Windswept Dune Grass', 'Sparse pale grass bent by constant wind.', {
    bladeDensity: 0.35, bladeLength: 0.35, bladeBend: 0.6, bendRandom: 0.5, windStrength: 0.8, windDirection: 70,
    baseColour: '#8f864f', midColour: '#b8ac6a', tipColour: '#d9cf8f', soilColour: '#c9b685', soilMoisture: 0.05,
    clumpScale: 8, clumpGaps: 0.5,
  }),
  preset('stylised-flat', 'Stylised Flat', 'Low relief, high contrast cartoon grass for voxel games.', {
    reliefStrength: 0.15, detailStrength: 0.05, aoStrength: 0.25, bladeDensity: 0.7, bladeLength: 0.18,
    colourVariation: 0.1, baseColour: '#1a7a2e', midColour: '#2fae3f', tipColour: '#49d653', soilColour: '#6b4a2a',
    roughnessBase: 0.9, macroStrength: 0.1, deadFraction: 0.02,
  }),
];

/* ------------------------------------------------------------------ */
/* Deterministic math helpers                                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function (): number {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(x: number): number {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function hash2(ix: number, iy: number, seed: number): number {
  const h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
  return hash32(h);
}

function clamp(x: number, lo: number, hi: number): number { return x < lo ? lo : (x > hi ? hi : x); }
function clamp01(x: number): number { return clamp(x, 0, 1); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Periodic value noise: period is the number of lattice cells across `size`. */
function periodicNoise(x: number, y: number, size: number, period: number, seed: number): number {
  const per = Math.max(1, Math.floor(period));
  const cell = size / per;
  const gx = x / cell, gy = y / cell;
  const ix0 = Math.floor(gx), iy0 = Math.floor(gy);
  const fx = gx - ix0, fy = gy - iy0;
  const i0 = ((ix0 % per) + per) % per, i1 = ((ix0 + 1) % per + per) % per;
  const j0 = ((iy0 % per) + per) % per, j1 = ((iy0 + 1) % per + per) % per;
  const v00 = hash2(i0, j0, seed), v10 = hash2(i1, j0, seed);
  const v01 = hash2(i0, j1, seed), v11 = hash2(i1, j1, seed);
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sy;
}

interface WorleyRes { f1: number; angle: number }

/** Periodic Worley (cellular) noise using ghost cells so it tiles perfectly. */
function worley(x: number, y: number, size: number, period: number, seed: number): WorleyRes {
  const per = Math.max(1, Math.floor(period));
  const cell = size / per;
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  let best = Infinity, bestnx = 0, bestny = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ccx = cx + dx, ccy = cy + dy;
      const nx = ((ccx % per) + per) % per, ny = ((ccy % per) + per) % per;
      const jx = hash2(nx, ny, seed);
      const jy = hash2(nx, ny, seed + 97);
      const px = (ccx + jx) * cell;
      const py = (ccy + jy) * cell;
      const ddx = x - px, ddy = y - py;
      const d = ddx * ddx + ddy * ddy;
      if (d < best) { best = d; bestnx = nx; bestny = ny; }
    }
  }
  const f1 = Math.min(1, Math.sqrt(best) / cell);
  const angle = hash2(bestnx, bestny, seed + 13) * Math.PI * 2;
  return { f1, angle };
}

function parseColor(hex: string): [number, number, number] {
  const m = COLOR_RE.exec(hex);
  if (!m) return [0.5, 0.5, 0.5];
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/* ------------------------------------------------------------------ */
/* Shared image-space helpers                                          */
/* ------------------------------------------------------------------ */

export function computeNormals(height: Float32Array, size: number, strength: number): Uint8ClampedArray {
  const n = size;
  const out = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    const yu = ((y - 1) + n) % n, yd = (y + 1) % n;
    for (let x = 0; x < n; x++) {
      const xl = ((x - 1) + n) % n, xr = (x + 1) % n;
      const hl = height[y * n + xl]!, hr = height[y * n + xr]!;
      const hu = height[yu * n + x]!, hd = height[yd * n + x]!;
      const dzdx = (hr - hl) * 0.5 * strength;
      const dzdy = (hd - hu) * 0.5 * strength;
      let nx = -dzdx, ny = -dzdy, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const idx = (y * n + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }
  return out;
}

function boxBlurPeriodic(src: Float32Array, size: number, radius: number): Float32Array {
  const n = size, r = Math.max(1, Math.floor(radius));
  const tmp = new Float32Array(n * n);
  const out = new Float32Array(n * n);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < n; y++) {
    const row = y * n;
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) {
        const xx = ((x + k) % n + n) % n;
        s += src[row + xx]!;
      }
      tmp[row + x] = s * norm;
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      let s = 0;
      for (let k = -r; k <= r; k++) {
        const yy = ((y + k) % n + n) % n;
        s += tmp[yy * n + x]!;
      }
      out[y * n + x] = s * norm;
    }
  }
  return out;
}

/** Low-frequency periodic macro colour/brightness variation map, values 0..1. */
export function macroMap(params: Params, size: number, seed: number): Float32Array {
  const p = normalizeParams(params);
  const n = Math.max(2, Math.floor(size));
  const out = new Float32Array(n * n);
  const scale1 = Math.max(1, Math.round(p.macroScale as number));
  const scale2 = Math.max(1, Math.round((p.macroScale as number) * 2.63 + 1));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = periodicNoise(x, y, n, scale1, seed + 101);
      const b = periodicNoise(x, y, n, scale2, seed + 202);
      out[y * n + x] = clamp01(a * 0.6 + b * 0.4);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Main render                                                         */
/* ------------------------------------------------------------------ */

export function renderGrass(paramsIn: unknown, size: number, seed: number): GrassMaps {
  const p = normalizeParams(paramsIn);
  const n = Math.max(2, Math.floor(size));
  const N = n * n;
  const rng = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const num = (k: string): number => p[k] as number;
  const str = (k: string): string => p[k] as string;

  const soilColor = parseColor(str('soilColour'));
  const tipColor = parseColor(str('tipColour'));
  const baseColor = parseColor(str('baseColour'));
  const midColor = parseColor(str('midColour'));
  const deadColor = parseColor(str('deadColour'));
  const cloverColor = parseColor(str('cloverColour'));
  const flowerColor = parseColor(str('flowerColour'));

  const height = new Float32Array(N);
  const baseHeightMap = new Float32Array(N);
  const matT = new Float32Array(N);
  const coverage = new Float32Array(N);
  const deadMask = new Float32Array(N);
  const cloverMask = new Float32Array(N);
  const flowerMask = new Float32Array(N);
  const hueJitter = new Float32Array(N);

  const reliefStrength = num('reliefStrength');
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = y * n + x;
      const relief = periodicNoise(x, y, n, 3, seed + 11);
      const soiln = periodicNoise(x, y, n, 9, seed + 23);
      const h = 0.035 + relief * reliefStrength * 0.22 + soiln * 0.025;
      baseHeightMap[idx] = h;
      height[idx] = h;
    }
  }

  const clumpPeriod = Math.max(2, Math.round(num('clumpScale')));
  const clumpF1 = new Float32Array(N);
  const clumpAngle = new Float32Array(N);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = y * n + x;
      const w = worley(x, y, n, clumpPeriod, seed + 31);
      clumpF1[idx] = w.f1;
      clumpAngle[idx] = w.angle;
    }
  }

  function stampGrass(cx: number, cy: number, r: number, hTop: number, t: number, isDead: boolean, hueJ: number): void {
    const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1);
    const y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
    for (let yy = y0; yy <= y1; yy++) {
      const wy = ((yy % n) + n) % n;
      const rowBase = wy * n;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + 1.0) continue;
        const alpha = clamp01(1 - (d - (r - 0.6)) / 1.3);
        if (alpha <= 0.001) continue;
        const wx = ((xx % n) + n) % n;
        const idx = rowBase + wx;
        const base = baseHeightMap[idx]!;
        const candidate = base + (hTop - base) * alpha;
        if (candidate > height[idx]!) {
          height[idx] = candidate;
          if (alpha > coverage[idx]!) coverage[idx] = alpha;
          matT[idx] = t;
          deadMask[idx] = isDead ? 1 : 0;
          hueJitter[idx] = hueJ;
        }
      }
    }
  }

  function stampClover(cx: number, cy: number, r: number, isFlower: boolean): void {
    const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1);
    const y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
    for (let yy = y0; yy <= y1; yy++) {
      const wy = ((yy % n) + n) % n;
      const rowBase = wy * n;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx, dy = yy - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + 1) continue;
        const theta = Math.atan2(dy, dx);
        const lobe = 0.55 + 0.45 * Math.abs(Math.cos(1.5 * theta));
        const effR = r * lobe;
        if (d > effR) continue;
        const alpha = clamp01(1 - (d - (effR - 0.6)) / 1.2);
        if (alpha <= 0.001) continue;
        const wx = ((xx % n) + n) % n;
        const idx = rowBase + wx;
        const base = baseHeightMap[idx]!;
        const hTop = base + 0.03 * clamp01(1 - d / Math.max(0.001, effR));
        const candidate = base + (hTop - base) * alpha;
        if (candidate > height[idx]!) {
          height[idx] = candidate;
          if (alpha > coverage[idx]!) coverage[idx] = alpha;
          cloverMask[idx] = alpha;
          matT[idx] = 0.3;
          if (isFlower && d < r * 0.3) flowerMask[idx] = 1;
        }
      }
    }
  }

  const windRad = num('windDirection') * Math.PI / 180;
  const windStrength = num('windStrength');
  const bladeTaper = num('bladeTaper');
  const bladeBend = num('bladeBend');
  const bendRandom = num('bendRandom');
  const bladeLenP = num('bladeLength');
  const bladeWidP = num('bladeWidth');
  const clumpGaps = num('clumpGaps');
  const soilAmount = num('soilAmount');
  const clumpTightness = clamp01(num('clumpTightness'));
  const deadFraction = clamp01(num('deadFraction'));
  const cloverAmount = clamp01(num('cloverAmount'));
  const flowerAmount = clamp01(num('flowerAmount'));
  const colourVariation = num('colourVariation');

  const count = Math.max(1, Math.round(clamp01(num('bladeDensity')) * n * n * 0.06));
  for (let i = 0; i < count; i++) {
    const ox = rng() * n, oy = rng() * n;
    const ix0 = ((Math.floor(ox) % n) + n) % n, iy0 = ((Math.floor(oy) % n) + n) % n;
    const idx0 = iy0 * n + ix0;
    const cf1 = clumpF1[idx0]!;
    const lean = clumpAngle[idx0]!;
    const gapChance = clamp01(clumpGaps * cf1 * 0.9 + soilAmount * 0.55);
    if (rng() < gapChance) continue;
    const isDead = rng() < deadFraction;
    const isClover = !isDead && rng() < cloverAmount;
    const isFlower = isClover && rng() < flowerAmount;

    if (isClover) {
      const r = Math.max(1, n * 0.014 * (0.6 + 0.8 * rng()));
      stampClover(ox, oy, r, isFlower);
      continue;
    }

    const lenJ = 0.55 + 0.65 * rng();
    let length = bladeLenP * n * 0.55 * lenJ * (1 - 0.35 * cf1 * clumpTightness);
    if (isDead) length *= 0.75;
    length = Math.max(1.5, Math.min(n * 0.45, length));
    const widJ = 0.6 + 0.7 * rng();
    let halfW = bladeWidP * n * 1.8 * widJ;
    halfW = Math.max(0.6, Math.min(6, halfW));
    const dirJitter = (rng() - 0.5) * 0.8;
    const dir = windRad + dirJitter + Math.sin(lean) * 0.35 * clumpTightness;
    const bend = bladeBend + bendRandom * (rng() - 0.5) * 2;
    const hueJ = (rng() - 0.5) * colourVariation;
    const steps = Math.min(18, Math.max(5, Math.round(length / (halfW * 1.1 + 1))));
    const dirX = Math.cos(dir), dirY = Math.sin(dir);
    const perpX = Math.cos(dir + Math.PI / 2), perpY = Math.sin(dir + Math.PI / 2);
    const baseH = baseHeightMap[idx0]!;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const sway = Math.sin(t * Math.PI * 0.5) * windStrength * length * 0.6 + bend * length * t * t;
      const cx = ox + dirX * length * t + perpX * sway;
      const cy = oy + dirY * length * t + perpY * sway;
      const wT = Math.max(0.12, 1 - bladeTaper * t);
      const r = Math.max(0.5, halfW * wT);
      const hTop = baseH + bladeLenP * Math.pow(t, 0.85);
      stampGrass(cx, cy, r, hTop, t, isDead, hueJ);
    }
  }

  const detailPeriod = Math.max(2, Math.round(num('detailScale')));
  const detailStrength = num('detailStrength');
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = y * n + x;
      const d = periodicNoise(x, y, n, detailPeriod, seed + 77) - 0.5;
      height[idx] = clamp01(height[idx]! + d * detailStrength * 0.04);
    }
  }

  const macroArr = macroMap(p, n, seed + 500);
  const macroStrength = num('macroStrength');
  const macroHue = num('macroHue');

  const normalStrength = 8 + reliefStrength * 34;
  const normal = computeNormals(height, n, normalStrength);

  const blurRadius = Math.max(1, Math.round(n * 0.025));
  const blurred = boxBlurPeriodic(height, n, blurRadius);
  const aoStrength = clamp01(num('aoStrength'));
  const roughnessBase = num('roughnessBase');
  const roughnessWet = num('roughnessWet');
  const soilMoisture = clamp01(num('soilMoisture'));

  const albedo = new Uint8ClampedArray(N * 4);
  const roughness = new Uint8ClampedArray(N);
  const ao = new Uint8ClampedArray(N);

  for (let idx = 0; idx < N; idx++) {
    const h = height[idx]!;
    const cov = coverage[idx]!;
    const t = matT[idx]!;
    let col0: number, col1: number, col2: number;
    if (t < 0.5) {
      const tt = t * 2;
      col0 = lerp(baseColor[0], midColor[0], tt); col1 = lerp(baseColor[1], midColor[1], tt); col2 = lerp(baseColor[2], midColor[2], tt);
    } else {
      const tt = (t - 0.5) * 2;
      col0 = lerp(midColor[0], tipColor[0], tt); col1 = lerp(midColor[1], tipColor[1], tt); col2 = lerp(midColor[2], tipColor[2], tt);
    }
    col0 = lerp(soilColor[0], col0, cov); col1 = lerp(soilColor[1], col1, cov); col2 = lerp(soilColor[2], col2, cov);
    const dm = deadMask[idx]! * cov;
    col0 = lerp(col0, deadColor[0], dm); col1 = lerp(col1, deadColor[1], dm); col2 = lerp(col2, deadColor[2], dm);
    const cm = cloverMask[idx]!;
    col0 = lerp(col0, cloverColor[0], cm); col1 = lerp(col1, cloverColor[1], cm); col2 = lerp(col2, cloverColor[2], cm);
    const fm = flowerMask[idx]!;
    col0 = lerp(col0, flowerColor[0], fm); col1 = lerp(col1, flowerColor[1], fm); col2 = lerp(col2, flowerColor[2], fm);

    const hj = hueJitter[idx]!;
    col0 = clamp01(col0 + hj * 0.07); col1 = clamp01(col1 + hj * 0.035); col2 = clamp01(col2 - hj * 0.05);

    col0 *= (1 - soilMoisture * 0.12 * (1 - cov));
    col1 *= (1 - soilMoisture * 0.08 * (1 - cov));
    col2 *= (1 - soilMoisture * 0.04 * (1 - cov));

    const m = macroArr[idx]!;
    const macroB = 1 + (m - 0.5) * 2 * macroStrength * 0.35;
    col0 *= macroB * (1 + (m - 0.5) * macroHue * 0.25);
    col1 *= macroB;
    col2 *= macroB * (1 - (m - 0.5) * macroHue * 0.25);

    const bright = 0.5 + 0.5 * h;
    col0 *= bright; col1 *= bright; col2 *= bright;

    const cav = clamp01((blurred[idx]! - h) * 9);
    const denseDarken = cov * (1 - h) * 0.22;
    const aoVal = clamp(1 - aoStrength * cav - denseDarken, 0.15, 1.0);
    ao[idx] = Math.round(aoVal * 255);

    const aoMix = 0.55 + 0.45 * aoVal;
    col0 *= aoMix; col1 *= aoMix; col2 *= aoMix;

    const o4 = idx * 4;
    albedo[o4] = Math.round(clamp01(col0) * 255);
    albedo[o4 + 1] = Math.round(clamp01(col1) * 255);
    albedo[o4 + 2] = Math.round(clamp01(col2) * 255);
    albedo[o4 + 3] = 255;

    let rough = lerp(roughnessBase, roughnessWet, soilMoisture * (0.4 + 0.6 * cov));
    rough += deadMask[idx]! * cov * 0.15;
    rough += (1 - cov) * 0.04;
    rough = clamp(rough, 0.2, 1.0);
    roughness[idx] = Math.round(rough * 255);
  }

  return { size: n, albedo, normal, roughness, ao, height };
}

/* ------------------------------------------------------------------ */
/* Scoring utilities                                                    */
/* ------------------------------------------------------------------ */

/** 0 = no obvious repetition, 1 = tile looks like it repeats at half scale. */
export function repetitionScore(map: Float32Array, size: number): number {
  const n = size;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n * n; i++) {
    const v = map[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1e-6, max - min);
  const half = Math.floor(n / 2);
  let sum = 0, count = 0;
  for (let y = 0; y < n; y++) {
    const y2 = (y + half) % n;
    for (let x = 0; x < n; x++) {
      const x2 = (x + half) % n;
      sum += Math.abs(map[y * n + x]! - map[y2 * n + x2]!);
      count++;
    }
  }
  const meanDiff = count ? sum / count : 0;
  const norm = clamp01(meanDiff / (range * 0.5));
  return clamp01(1 - norm);
}

/** ~1 = seamless (edge statistics match interior statistics). Works for 1/3/4 channel maps. */
export function seamScore(rgba: Uint8ClampedArray, size: number): number {
  const n = size;
  const channels = Math.max(1, Math.round(rgba.length / (n * n)));
  let edgeSum = 0, edgeCount = 0, intSum = 0, intCount = 0;
  for (let y = 0; y < n; y++) {
    for (let c = 0; c < channels; c++) {
      const a = rgba[(y * n + (n - 1)) * channels + c]!;
      const b = rgba[(y * n + 0) * channels + c]!;
      edgeSum += Math.abs(a - b); edgeCount++;
    }
  }
  for (let x = 0; x < n; x++) {
    for (let c = 0; c < channels; c++) {
      const a = rgba[((n - 1) * n + x) * channels + c]!;
      const b = rgba[(0 * n + x) * channels + c]!;
      edgeSum += Math.abs(a - b); edgeCount++;
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n - 1; x++) {
      for (let c = 0; c < channels; c++) {
        const a = rgba[(y * n + x) * channels + c]!;
        const b = rgba[(y * n + x + 1) * channels + c]!;
        intSum += Math.abs(a - b); intCount++;
      }
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n - 1; y++) {
      for (let c = 0; c < channels; c++) {
        const a = rgba[(y * n + x) * channels + c]!;
        const b = rgba[((y + 1) * n + x) * channels + c]!;
        intSum += Math.abs(a - b); intCount++;
      }
    }
  }
  const edgeMean = edgeCount ? edgeSum / edgeCount : 0;
  const intMean = intCount ? intSum / intCount : 0;
  if (intMean < 1e-6) return edgeMean < 1e-6 ? 1 : 5;
  return edgeMean / intMean;
}

/* ------------------------------------------------------------------ */
/* GLSL companion code                                                  */
/* ------------------------------------------------------------------ */

export const GRASS_GLSL: string = `
// Stochastic hex-grid tiling + macro variation for tileable grass textures.
vec2 hexHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

// Blends 3 rotated/jittered samples of tex using contrast-preserving weights
// so a small tile never visibly repeats across a large ground plane.
vec4 sampleGrass(sampler2D tex, vec2 uv) {
  vec2 skewed = vec2(uv.x + uv.y * 0.5, uv.y * 0.8660254);
  vec2 cell = floor(skewed);
  vec2 frac = fract(skewed);
  vec2 id0 = cell;
  vec2 id1 = cell + vec2(1.0, 0.0);
  vec2 id2 = cell + vec2(0.0, 1.0);
  float w0 = 1.0 - frac.x - frac.y * 0.5;
  float w1 = frac.x - frac.y * 0.5;
  float w2 = frac.y;
  w0 = clamp(w0, 0.0, 1.0);
  w1 = clamp(w1, 0.0, 1.0);
  w2 = clamp(w2, 0.0, 1.0);
  float wsum = max(1e-5, w0 + w1 + w2);
  w0 /= wsum; w1 /= wsum; w2 /= wsum;

  vec2 j0 = hexHash(id0) - 0.5;
  vec2 j1 = hexHash(id1) - 0.5;
  vec2 j2 = hexHash(id2) - 0.5;

  vec4 c0 = texture(tex, uv + j0);
  vec4 c1 = texture(tex, uv + j1);
  vec4 c2 = texture(tex, uv + j2);

  vec4 mean = (c0 + c1 + c2) / 3.0;
  vec4 blended = c0 * w0 + c1 * w1 + c2 * w2;
  // preserve contrast: push the weighted blend away from the flat mean
  return mean + (blended - mean) * 1.4;
}

// Two un-aligned low frequency scales for believable large scale colour drift.
vec3 grassMacro(vec2 worldXZ) {
  vec2 a = worldXZ * 0.013;
  vec2 b = worldXZ * 0.057 + vec2(13.7, 4.2);
  float n1 = fract(sin(dot(floor(a), vec2(12.9898, 78.233))) * 43758.5453);
  float n2 = fract(sin(dot(floor(b), vec2(39.3468, 11.135))) * 24634.6345);
  float v = mix(n1, n2, 0.5);
  vec3 dry = vec3(0.55, 0.5, 0.28);
  vec3 lush = vec3(0.15, 0.4, 0.14);
  return mix(dry, lush, v);
}
`;