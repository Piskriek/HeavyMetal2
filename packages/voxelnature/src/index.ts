import { createModel, ellipsoid, get, line, set, weld, type Entry, type Model, type V3 } from '@hm/voxelart';

/**
 * Small voxel plants that fill an island so it looks lived in and matches the voxel goblin: a leafy bush, a clump of grass, a patch of flowers.
 * Each is deterministic (a fixed seed), one connected piece, standing on y = 0 with the pivot at the middle of its foot. Scale them with the
 * block size (metres per voxel) when placing; 0.1 to 0.18 suits an island.
 */
export interface NatureModel { id: string; name: string; doc: string; build: () => Model }

const mulberry = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const entry = (name: string, color: V3, roughness = 0.85, emissive = 0): Entry => ({ name, color, roughness, metalness: 0, emissive, alpha: 1 });

function buildBush(): Model {
  const palette = [
    entry('leaf-shade', [0.14, 0.32, 0.13]), entry('leaf-mid', [0.22, 0.47, 0.17]), entry('leaf-light', [0.37, 0.62, 0.23]), entry('leaf-tip', [0.52, 0.74, 0.3]),
    entry('berry', [0.82, 0.16, 0.2], 0.5), entry('twig', [0.36, 0.26, 0.15]), entry('leaf-deep', [0.1, 0.25, 0.12]), entry('leaf-warm', [0.45, 0.6, 0.2]),
  ];
  const m = createModel('bush', 'Leafy Bush', [15, 11, 15], [7, 0, 7], palette);
  const r = mulberry(7);
  const lobes: [V3, V3][] = [[[7, 4, 7], [5, 3.6, 5]], [[4, 3.4, 8], [3.6, 3, 3.8]], [[10, 3.4, 6], [3.8, 3.2, 3.6]], [[7, 3.2, 10], [3.8, 3, 3.6]], [[8, 6, 6], [3, 2.6, 3]]];
  for (const [c, rad] of lobes) ellipsoid(m, c, rad, 2);
  for (let z = 0; z < 15; z++) for (let y = 0; y < 11; y++) for (let x = 0; x < 15; x++) {
    if (!get(m, x, y, z)) continue;
    const roll = r();
    const open = !get(m, x, y + 1, z);
    set(m, x, y, z, y < 2 ? 7 : y < 4 ? (roll < 0.35 ? 1 : 2) : open ? (roll < 0.3 ? 4 : roll < 0.55 ? 8 : 3) : roll < 0.4 ? 2 : 3);
  }
  for (let i = 0; i < 9; i++) { const x = 2 + Math.floor(r() * 11), z = 2 + Math.floor(r() * 11); for (let y = 8; y >= 2; y--) if (get(m, x, y, z) && !get(m, x, y + 1, z)) { set(m, x, y, z, 5); break; } }
  set(m, 7, 0, 7, 6); set(m, 7, 1, 7, 6);
  return m;
}

function buildGrassClump(): Model {
  const palette = [entry('blade-base', [0.2, 0.4, 0.14]), entry('blade-mid', [0.32, 0.56, 0.2]), entry('blade-tip', [0.52, 0.74, 0.3]), entry('blade-dry', [0.7, 0.72, 0.34]), entry('soil', [0.34, 0.27, 0.16]), entry('blade-deep', [0.14, 0.3, 0.12]), entry('blade-light', [0.42, 0.66, 0.26]), entry('blade-gold', [0.78, 0.7, 0.3])];
  const m = createModel('grass-clump', 'Grass Clump', [11, 9, 11], [5, 0, 5], palette);
  const r = mulberry(11);
  for (let x = 3; x <= 7; x++) for (let z = 3; z <= 7; z++) if (Math.hypot(x - 5, z - 5) < 2.7) set(m, x, 0, z, 5);
  for (let i = 0; i < 17; i++) {
    const a = r() * Math.PI * 2, d = r() * 2.4;
    const bx = 5 + Math.cos(a) * d, bz = 5 + Math.sin(a) * d;
    const h = 4 + Math.floor(r() * 5);
    const lx = Math.cos(a) * (0.6 + r() * 1.4), lz = Math.sin(a) * (0.6 + r() * 1.4);
    const tip: V3 = [Math.round(bx + lx), h, Math.round(bz + lz)];
    line(m, [Math.round(bx), 1, Math.round(bz)], tip, 2, 1);
    set(m, tip[0], tip[1], tip[2], r() < 0.2 ? 4 : 3);
    set(m, Math.round(bx), 1, Math.round(bz), 1);
  }
  return m;
}

function buildFlowers(): Model {
  const palette = [entry('stem', [0.24, 0.5, 0.2]), entry('leaf', [0.3, 0.58, 0.22]), entry('petal-pink', [0.94, 0.42, 0.62], 0.6), entry('petal-yellow', [0.98, 0.82, 0.22], 0.6), entry('petal-white', [0.97, 0.96, 0.9], 0.6), entry('petal-orange', [0.96, 0.52, 0.18], 0.6), entry('centre', [0.9, 0.62, 0.1], 0.6), entry('soil', [0.34, 0.27, 0.16])];
  const m = createModel('flowers', 'Flower Patch', [11, 8, 11], [5, 0, 5], palette);
  const r = mulberry(23);
  for (let x = 2; x <= 8; x++) for (let z = 2; z <= 8; z++) if (Math.hypot(x - 5, z - 5) < 3.3) set(m, x, 0, z, 8);
  const heads = [3, 4, 5, 6, 4, 3];
  for (let i = 0; i < 8; i++) {
    const a = r() * Math.PI * 2, d = r() * 2.8;
    const x = Math.round(5 + Math.cos(a) * d), z = Math.round(5 + Math.sin(a) * d);
    const h = 3 + Math.floor(r() * 3);
    for (let y = 1; y < h; y++) set(m, x, y, z, 1);
    if (r() < 0.6) set(m, x + (r() < 0.5 ? 1 : -1), 2, z, 2);
    const petal = heads[Math.floor(r() * heads.length)]!;
    set(m, x, h, z, 7);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) set(m, x + dx, h, z + dz, petal);
    set(m, x, h + 1, z, petal);
  }
  return m;
}

export const NATURE_MODELS: readonly NatureModel[] = [
  { id: 'bush', name: 'Leafy Bush', doc: 'A round leafy bush with lighter tips and a few red berries.', build: () => weld(buildBush()) },
  { id: 'grass-clump', name: 'Grass Clump', doc: 'A tuft of grass blades leaning every way, darker at the foot.', build: () => weld(buildGrassClump()) },
  { id: 'flowers', name: 'Flower Patch', doc: 'A small patch of pink, yellow, white and orange flowers.', build: () => weld(buildFlowers()) },
];

/** Metres per voxel for each plant when it is placed on an island. */
export const NATURE_BLOCK: Readonly<Record<string, number>> = { bush: 0.17, 'grass-clump': 0.11, flowers: 0.1 };
