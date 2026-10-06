// The planet round your plot: the plains out to a far horizon, the plots other players have already terraformed, and where
// the boulders lie. Pure and deterministic (seeded hashes), so everyone sees the same planet.
// Until the shared planet lands (STATUS SM8), the neighbours here are a fixed sample: they show a new player what a
// finished plot looks like from across the plains.
import type { Stage } from '@hm/fidelity';
import { craterProfile, hash, moonHeight, valueNoise, type Crater } from './moon';

/** The planet's radius (metres): the ground falls away by d^2 / 2R, so from 14 m up the horizon is about 580 m off. */
export const PLANET_RADIUS = 12000;
/** Your plot: the round piece of the planet your chimney terraforms. */
export const PLOT_RADIUS = 56;
/** The band inside a plot's rim where it fades back into the plains (metres). */
export const PLOT_EDGE = 12;
/** How far the plains are drawn (metres). */
export const FAR = 4200;

/** How far the ground has fallen below the flat plane at x, z. */
export function drop(x: number, z: number): number {
  return (x * x + z * z) / (2 * PLANET_RADIUS);
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Another player's plot. */
export interface Plot {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly cartridge: string;
  readonly stage: Stage;
}

// Placed by hand: most of them across the plains in front of the first view, a few behind; near ones small enough to see
// whole, far ones big enough to show over the horizon. Angles are from +x towards +z.
const SPECS: readonly [string, number, number, number, string, Stage][] = [
  ['Kea', 226, 240, 60, 'emerald_canopy', 6],
  ['Moss', 196, 520, 70, 'spore_meadow', 5],
  ['Tui', 250, 640, 64, 'solar_fern_glade', 6],
  ['Rangi', 210, 1050, 90, 'coral_atoll', 6],
  ['Pip', 238, 1500, 110, 'emerald_canopy', 5],
  ['Wren', 176, 1900, 120, 'solar_fern_glade', 6],
  ['Ora', 268, 2300, 120, 'spore_meadow', 6],
  ['Nix', 150, 860, 60, 'prismata_grass', 4],
  ['Hemi', 300, 420, 50, 'prismata_grass', 3],
  ['Sol', 40, 700, 70, 'coral_atoll', 6],
  ['Ivy', 100, 1300, 100, 'emerald_canopy', 6],
];

export const NEIGHBOURS: readonly Plot[] = SPECS.map(([name, deg, dist, r, cartridge, stage]) => ({
  name, r, cartridge, stage, x: Math.cos((deg * Math.PI) / 180) * dist, z: Math.sin((deg * Math.PI) / 180) * dist,
}));

/** Ridges: 1 on a crest, falling away to both sides (folded noise). */
function ridged(x: number, z: number, seed: number): number {
  let sum = 0, amp = 0.55, f = 1;
  for (let o = 0; o < 3; o++) { sum += amp * (1 - Math.abs(valueNoise(x * f, z * f, seed + o) * 2 - 1)) ** 2; amp *= 0.5; f *= 2.1; }
  return sum;
}

/** The old craters of the plains: at most one per 520 m cell, kept off your plot. */
const CELL = 520;
function bigCrater(i: number, j: number): Crater | null {
  if (hash(i, j, 31) < 0.45) return null;
  const x = (i + 0.2 + hash(i, j, 32) * 0.6) * CELL, z = (j + 0.2 + hash(i, j, 33) * 0.6) * CELL;
  const r = 40 + hash(i, j, 34) ** 2 * 150;
  if (Math.hypot(x, z) < r + PLOT_RADIUS + 120) return null;
  return { x, z, r, depth: r * 0.18, rim: r * 0.07 };
}

/** The plains' height at x, z (metres), before neighbours level their plots. Your plot's own moon is in the middle. */
export function plainsHeight(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  let h = moonHeight(x, z);
  const w = smoothstep(80, 300, d);
  if (w <= 0) return h;
  // broad swells and the old craters
  h += w * (16 * (valueNoise(x / 460, z / 460, 21) - 0.5) + 5 * (valueNoise(x / 140, z / 140, 22) - 0.5));
  const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    const c = bigCrater(i, j);
    if (!c) continue;
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) < c.r * 2 && Math.abs(dz) < c.r * 2) h += w * craterProfile(c, Math.sqrt(dx * dx + dz * dz));
  }
  // ranges far off: they stand over the horizon
  const m = smoothstep(1300, 3200, d);
  if (m > 0) h += m * 320 * ridged(x / 1100, z / 1100, 41);
  return h;
}

/** Where a neighbour levelled its plot. */
const PLOT_BASE: readonly number[] = NEIGHBOURS.map((p) => plainsHeight(p.x, p.z));

/** The planet's height at x, z: the plains, with every neighbour's plot levelled (gently: a quarter of the swell stays). */
export function planetHeight(x: number, z: number): number {
  let h = plainsHeight(x, z);
  for (let k = 0; k < NEIGHBOURS.length; k++) {
    const p = NEIGHBOURS[k]!, dx = x - p.x, dz = z - p.z;
    if (Math.abs(dx) > p.r + 50 || Math.abs(dz) > p.r + 50) continue;
    const level = 1 - smoothstep(p.r, p.r + 50, Math.sqrt(dx * dx + dz * dz));
    const base = PLOT_BASE[k]!;
    h += (base + (h - base) * 0.25 - h) * level;
  }
  return h;
}

/** The plains in rings round your plot: fine near it, coarse at the horizon. */
export interface Ring {
  /** x, z of each point. */
  readonly xz: Float32Array;
  readonly index: Uint32Array;
}

/** A ring from `inner` to `outer` metres: `around` points round, `out` steps outwards, spaced so each step grows by the same factor. */
export function makeRing(inner: number, outer: number, around: number, out: number): Ring {
  const row = around + 1, xz = new Float32Array(row * (out + 1) * 2);
  for (let i = 0; i <= out; i++) {
    const r = inner * Math.pow(outer / inner, i / out);
    for (let k = 0; k <= around; k++) {
      const a = (k / around) * Math.PI * 2, n = (i * row + k) * 2;
      xz[n] = Math.cos(a) * r; xz[n + 1] = Math.sin(a) * r;
    }
  }
  const index = new Uint32Array(around * out * 6);
  let t = 0;
  for (let i = 0; i < out; i++) for (let k = 0; k < around; k++) {
    const a = i * row + k, b = a + 1, c = a + row, d = c + 1;
    // a -> b -> c faces up (+y): b is a step round towards +z, c a step out
    index[t++] = a; index[t++] = b; index[t++] = c;
    index[t++] = b; index[t++] = d; index[t++] = c;
  }
  return { xz, index };
}

/** A disc round a neighbour's plot (the plot and its fade into the plains), the same layout as a ring with a tiny hole. */
export function makeDisc(p: Plot): Ring {
  const ring = makeRing(0.6, p.r + 34, 72, 40);
  const xz = ring.xz.slice();
  for (let n = 0; n < xz.length; n += 2) { xz[n] = xz[n]! + p.x; xz[n + 1] = xz[n + 1]! + p.z; }
  return { xz, index: ring.index };
}

/** A height lookup on a square grid (bilinear), for the many samples sunlight needs. */
export interface HeightGrid { readonly half: number; readonly n: number; readonly heights: Float32Array }

export function heightGrid(height: (x: number, z: number) => number, half: number, n: number): HeightGrid {
  const heights = new Float32Array((n + 1) * (n + 1)), step = (half * 2) / n;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = -half + i * step, z = -half + j * step;
    heights[j * (n + 1) + i] = height(x, z) - drop(x, z);
  }
  return { half, n, heights };
}

/** The curved ground's height from a grid (with the fall-away already in), or null off the grid. */
export function sampleGrid(g: HeightGrid, x: number, z: number): number | null {
  const fx = ((x + g.half) / (g.half * 2)) * g.n, fz = ((z + g.half) / (g.half * 2)) * g.n;
  if (fx < 0 || fz < 0 || fx >= g.n || fz >= g.n) return null;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, row = g.n + 1;
  const a = g.heights[j * row + i]!, b = g.heights[j * row + i + 1]!, c = g.heights[(j + 1) * row + i]!, d = g.heights[(j + 1) * row + i + 1]!;
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/**
 * How much sun reaches a point on the curved ground (0 in shadow, 1 lit): march towards the sun and find the highest
 * thing in the way, as an angle above the sun's. The penumbra is soft: the sun is a disc, not a point.
 */
export function sunlight(grids: readonly HeightGrid[], x: number, z: number, y: number, sun: readonly [number, number, number]): number {
  const flat = Math.hypot(sun[0], sun[2]), dx = sun[0] / flat, dz = sun[2] / flat, rise = sun[1] / flat;
  let worst = -1;
  for (let s = 1.5; s < 1600; s *= 1.16) {
    const px = x + dx * s, pz = z + dz * s;
    let h: number | null = null;
    for (const g of grids) { h = sampleGrid(g, px, pz); if (h !== null) break; }
    if (h === null) break;
    // how far above the sun's ray the ground stands, as a slope
    worst = Math.max(worst, (h - y) / s - rise);
  }
  return 1 - smoothstep(-0.02, 0.03, worst);
}

/** A boulder lying on the planet: where, how big, which shape, which way round. */
export interface Boulder { readonly x: number; readonly z: number; readonly size: number; readonly shape: number; readonly turn: number; readonly tilt: number }

/** The boulders: scattered on your plot (off the chimney's peak and the crater floor) and over the plains, none on a neighbour's plot. */
export const BOULDERS: readonly Boulder[] = (() => {
  const list: Boulder[] = [];
  for (let k = 0; list.length < 420 && k < 4000; k++) {
    // a third close in, the rest spread out to the far plains (denser near: you see those)
    const near = k % 3 === 0;
    const a = hash(k, 1, 91) * Math.PI * 2, u = hash(k, 2, 91);
    const d = near ? 14 + u * 60 : 70 + u * u * 1400;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x, z) < 12) continue;
    if (NEIGHBOURS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 40)) continue;
    // most are stones, a few are big; out on the plains they are bigger (so they read from afar)
    const big = hash(k, 3, 91) ** 6;
    const size = (0.35 + big * 3.2) * (1 + smoothstep(100, 1200, d) * 1.8);
    list.push({ x, z, size, shape: Math.floor(hash(k, 4, 91) * 3), turn: hash(k, 5, 91) * Math.PI * 2, tilt: (hash(k, 6, 91) - 0.5) * 0.5 });
  }
  return list;
})();
