/**
 * @hm/coverage — deterministic ground-cover simulation for a terraformed plot.
 *
 * Five layers (dust, moss, grass, leaves, vines) creep over a square grid from
 * seeds (water edges, machines, trees) as the plot's stage rises.
 *
 * Pure functions only: no DOM, no Date, no Math.random, no imports, no mutation
 * of any input. The same inputs always give the same cover on every client.
 */

export type Layer = 'dust' | 'moss' | 'grass' | 'leaves' | 'vines';

export const LAYERS: readonly Layer[] = ['dust', 'moss', 'grass', 'leaves', 'vines'];

/** The stage at which each layer starts growing. */
export const OPENS: Readonly<Record<Layer, number>> = {
  dust: 1,
  moss: 3,
  grass: 4,
  leaves: 5,
  vines: 5,
};

/** Growth per second at suitability 1. */
export const RATE: Readonly<Record<Layer, number>> = {
  dust: 0.05,
  moss: 0.02,
  grass: 0.03,
  leaves: 0.02,
  vines: 0.01,
};

export interface Cell {
  readonly slope: number;
  readonly wet: number;
  readonly rock: number;
}

export interface Seed {
  readonly x: number;
  readonly z: number;
  readonly layer: Layer;
  readonly strength: number;
}

export interface CoverEnv {
  readonly size: number;
  readonly cells: readonly Cell[];
  readonly seeds: readonly Seed[];
  readonly stage: number;
  readonly seed: number;
}

export interface CoverState {
  readonly v: 1;
  readonly size: number;
  readonly time: number;
  readonly weights: Readonly<Record<Layer, readonly number[]>>;
}

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number): number => (v <= 0 || !Number.isFinite(v) ? 0 : v >= 1 ? 1 : v) + 0;

const layerIndex = (layer: Layer): number => {
  for (let i = 0; i < LAYERS.length; i++) if (LAYERS[i] === layer) return i;
  return 0;
};

/** A 32-bit integer hash of four integers; the mix is FNV-1a then a final avalanche. */
function hash4(a: number, b: number, c: number, d: number): number {
  let h = 2166136261 >>> 0;
  h = Math.imul(h ^ (a | 0), 16777619) >>> 0;
  h = Math.imul(h ^ (b | 0), 16777619) >>> 0;
  h = Math.imul(h ^ (c | 0), 16777619) >>> 0;
  h = Math.imul(h ^ (d | 0), 16777619) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic noise in [0, 1) for a cell and layer. */
const noiseAt = (seed: number, x: number, z: number, li: number): number =>
  hash4(seed, x, z, li) / 4294967296;

/** A cell's ragged spread threshold for a layer: 0.2 + 0.2 * noise. */
const thresholdAt = (seed: number, x: number, z: number, li: number): number =>
  0.2 + 0.2 * noiseAt(seed, x, z, li);

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

/** An empty cover: every weight zero. */
export function newCover(size: number): CoverState {
  const n = Number.isFinite(size) && size > 0 ? Math.floor(size) : 0;
  const cells = n * n;
  const make = (): readonly number[] => {
    const a: number[] = new Array<number>(cells);
    for (let i = 0; i < cells; i++) a[i] = 0;
    return a;
  };
  return {
    v: 1,
    size: n,
    time: 0,
    weights: { dust: make(), moss: make(), grass: make(), leaves: make(), vines: make() },
  };
}

/** How well a layer suits a cell, 0..1. */
export function suitability(c: Cell, layer: Layer): number {
  const slope = clamp01(c.slope);
  const wet = clamp01(c.wet);
  const rock = clamp01(c.rock);
  switch (layer) {
    case 'dust':
      return clamp01((1 - wet) * (1 - slope));
    case 'moss':
      return clamp01(wet * (1 - 0.5 * slope));
    case 'grass':
      return clamp01(Math.sqrt(wet) * (1 - slope) * (1 - rock));
    case 'leaves':
      return clamp01(1 - slope);
    case 'vines':
      return clamp01(slope * (0.5 + 0.5 * rock));
  }
}

const OTHERS: readonly Layer[] = ['moss', 'grass', 'leaves', 'vines'];

/** Advance the cover by dt seconds. Never mutates its arguments. */
export function step(s: CoverState, env: CoverEnv, dt: number): CoverState {
  const size = s.size;
  if (env.size !== size) {
    throw new Error(`coverage: env.size ${env.size} does not match state size ${size}`);
  }
  if (env.cells.length !== size * size) {
    throw new Error(`coverage: env.cells has ${env.cells.length} cells, expected ${size * size}`);
  }
  const n = size * size;
  const dts = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const seedNoise = Number.isFinite(env.seed) ? Math.floor(env.seed) : 0;
  const stage = Number.isFinite(env.stage) ? env.stage : 0;

  /* which cells sit inside a seed of each layer */
  const seeded: Uint8Array[] = LAYERS.map(() => new Uint8Array(n));
  for (const sd of env.seeds) {
    const li = layerIndex(sd.layer);
    const mask = seeded[li];
    if (mask === undefined) continue;
    const str = Number.isFinite(sd.strength) ? sd.strength : 0;
    if (str < 0 || !Number.isFinite(sd.x) || !Number.isFinite(sd.z)) continue;
    const x0 = Math.max(0, Math.floor(sd.x - str - 1));
    const x1 = Math.min(size - 1, Math.ceil(sd.x + str));
    const z0 = Math.max(0, Math.floor(sd.z - str - 1));
    const z1 = Math.min(size - 1, Math.ceil(sd.z + str));
    const rr = str * str;
    for (let z = z0; z <= z1; z++) {
      const dz = z + 0.5 - sd.z;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - sd.x;
        if (dx * dx + dz * dz <= rr) mask[z * size + x] = 1;
      }
    }
  }

  /* growth for each layer, all read from the weights at the start of the step */
  const growth: Float64Array[] = [];
  for (let li = 0; li < LAYERS.length; li++) {
    const layer = LAYERS[li] ?? 'dust';
    const g = new Float64Array(n);
    growth.push(g);
    if (dts <= 0 || stage < OPENS[layer]) continue;
    const w = s.weights[layer];
    const mask = seeded[li] ?? new Uint8Array(n);
    const rate = RATE[layer];

    /* each cell's ragged threshold, once per step */
    const thr = new Float64Array(n);
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) thr[z * size + x] = thresholdAt(seedNoise, x, z, li);
    }

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const i = z * size + x;
        let reached = mask[i] === 1;
        if (!reached) {
          if (x > 0 && (w[i - 1] ?? 0) >= (thr[i - 1] ?? 1)) reached = true;
          else if (x + 1 < size && (w[i + 1] ?? 0) >= (thr[i + 1] ?? 1)) reached = true;
          else if (z > 0 && (w[i - size] ?? 0) >= (thr[i - size] ?? 1)) reached = true;
          else if (z + 1 < size && (w[i + size] ?? 0) >= (thr[i + size] ?? 1)) reached = true;
        }
        if (!reached) continue;
        const cell = env.cells[i];
        if (cell === undefined) continue;
        g[i] = dts * rate * suitability(cell, layer);
      }
    }
  }

  /* apply everything at once */
  const dustOld = s.weights.dust;
  const dustNew: number[] = new Array<number>(n);
  const out: number[][] = OTHERS.map(() => new Array<number>(n));
  const dustGrowth = growth[layerIndex('dust')] ?? new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < OTHERS.length; k++) {
      const layer = OTHERS[k] ?? 'moss';
      const g = growth[layerIndex(layer)] ?? new Float64Array(n);
      const v = clamp01((s.weights[layer][i] ?? 0) + (g[i] ?? 0));
      (out[k] ?? [])[i] = v;
      sum += v;
    }
    if (sum > 1) {
      const k = 1 / sum;
      let rescaled = 0;
      for (let j = 0; j < OTHERS.length; j++) {
        const col = out[j];
        if (col === undefined) continue;
        const v = clamp01((col[i] ?? 0) * k);
        col[i] = v;
        rescaled += v;
      }
      sum = rescaled;
    }
    const room = sum >= 1 ? 0 : 1 - sum;
    const d = (dustOld[i] ?? 0) + (dustGrowth[i] ?? 0);
    dustNew[i] = clamp01(d < room ? d : room);
  }

  const pick = (layer: Layer): readonly number[] => {
    const k = OTHERS.indexOf(layer);
    return out[k] ?? [];
  };

  return {
    v: 1,
    size,
    time: s.time + dts + 0,
    weights: {
      dust: dustNew,
      moss: pick('moss'),
      grass: pick('grass'),
      leaves: pick('leaves'),
      vines: pick('vines'),
    },
  };
}

/** One byte per cell, ready for a texture upload. */
export function bake(s: CoverState, layer: Layer): Uint8Array {
  const w = s.weights[layer];
  const out = new Uint8Array(w.length);
  for (let i = 0; i < w.length; i++) out[i] = Math.round(clamp01(w[i] ?? 0) * 255);
  return out;
}

/* ------------------------------------------------------------------ */
/* loading                                                             */
/* ------------------------------------------------------------------ */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readWeights(v: unknown, cells: number): readonly number[] | null {
  if (!Array.isArray(v) || v.length !== cells) return null;
  const out: number[] = new Array<number>(cells);
  for (let i = 0; i < cells; i++) {
    const w: unknown = v[i];
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0 || w > 1) return null;
    out[i] = w + 0;
  }
  return out;
}

/** Parse a saved cover; null for anything that is not a sound state. */
export function loadCover(json: unknown): CoverState | null {
  if (!isRecord(json)) return null;
  if (json['v'] !== 1) return null;

  const size = json['size'];
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 0) return null;

  const time = json['time'];
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) return null;

  const weights = json['weights'];
  if (!isRecord(weights)) return null;

  const cells = size * size;
  const dust = readWeights(weights['dust'], cells);
  const moss = readWeights(weights['moss'], cells);
  const grass = readWeights(weights['grass'], cells);
  const leaves = readWeights(weights['leaves'], cells);
  const vines = readWeights(weights['vines'], cells);
  if (dust === null || moss === null || grass === null || leaves === null || vines === null) return null;

  return { v: 1, size: size + 0, time: time + 0, weights: { dust, moss, grass, leaves, vines } };
}
