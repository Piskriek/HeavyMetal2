// The Resolution Crafter's moon: a crater field as a pure height function, and the low-poly surface a stage draws it as.
// Everything here is deterministic (seeded hashes, no randomness), so every player's moon is the same moon.

/** One crater: centre, radius, how deep its floor sits and how high its rim stands (metres). */
export interface Crater { readonly x: number; readonly z: number; readonly r: number; readonly depth: number; readonly rim: number }

/** The moon patch is SPAN metres across, centred on the chimney. */
export const SPAN = 128;

/** The big crater the chimney stands in. */
export const MAIN_CRATER: Crater = { x: 0, z: 0, r: 26, depth: 5, rim: 2.4 };

export function hash(i: number, j: number, seed: number): number {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise, 0..1. */
export function valueNoise(x: number, z: number, seed: number): number {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The smaller craters round the main one: placed by hash, kept clear of the main crater's floor. */
export const CRATERS: readonly Crater[] = (() => {
  const list: Crater[] = [MAIN_CRATER];
  for (let k = 0; list.length < 15 && k < 200; k++) {
    const x = (hash(k, 1, 77) - 0.5) * (SPAN - 16), z = (hash(k, 2, 77) - 0.5) * (SPAN - 16);
    const r = 3 + hash(k, 3, 77) * 9;
    if (Math.hypot(x, z) < MAIN_CRATER.r + r * 0.6) continue;
    if (list.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r + r) * 0.8)) continue;
    list.push({ x, z, r, depth: r * (0.16 + hash(k, 4, 77) * 0.1), rim: r * (0.07 + hash(k, 5, 77) * 0.05) });
  }
  return list;
})();

/** A crater's height change at distance d (in radii): a flat floor, a bowl wall, a rim, and nothing far away. */
export function craterProfile(c: Crater, distance: number): number {
  const d = distance / c.r;
  const bowl = -c.depth * (1 - smoothstep(0.32, 1.0, d));
  const rim = c.rim * Math.exp(-(((d - 1) / 0.24) ** 2));
  return bowl + rim;
}

/** The main crater's central peak (big craters have one): the chimney stands on it, above the lakes at every stage. */
export const PEAK = { height: 7.4, radius: 5.5 } as const;

/** The moon's true height (metres) at x, z: gentle rolling ground plus every crater. */
export function moonHeight(x: number, z: number): number {
  let h = 1.6 * (valueNoise(x / 34, z / 34, 11) - 0.5) + 0.6 * (valueNoise(x / 13, z / 13, 12) - 0.5);
  for (const c of CRATERS) {
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) > c.r * 2 || Math.abs(dz) > c.r * 2) continue;
    h += craterProfile(c, Math.sqrt(dx * dx + dz * dz));
  }
  return h + PEAK.height * Math.exp(-((x * x + z * z) / (PEAK.radius * PEAK.radius)));
}

/**
 * The surface drawn with facets `cell` metres wide: the true height at a cell lattice, flat triangles between (each cell split
 * along the same diagonal as the mesh, from its (1, 0) corner to its (0, 1) corner). A fine mesh whose points lie on these
 * triangles shows crisp low-poly facets; a cell of the mesh spacing or less is the true surface sampled at the mesh.
 */
export function facetedHeight(x: number, z: number, cell: number): number {
  const fx = x / cell, fz = z / cell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const h00 = moonHeight(i * cell, j * cell), h10 = moonHeight((i + 1) * cell, j * cell);
  const h01 = moonHeight(i * cell, (j + 1) * cell), h11 = moonHeight((i + 1) * cell, (j + 1) * cell);
  if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

/** A square grid mesh of the patch: `n` cells a side, so (n + 1)^2 points. */
export interface MoonGrid {
  readonly n: number;
  readonly spacing: number;
  /** x, z of each point (y is filled per stage). */
  readonly xz: Float32Array;
  /** Triangles, wound counter-clockwise seen from above, split along the (1, 0)-(0, 1) diagonal like facetedHeight. */
  readonly index: Uint32Array;
}

/** The grid for a spacing (1 m on Potato and Low, 0.5 m above). */
export function makeGrid(spacing: number): MoonGrid {
  const n = Math.round(SPAN / spacing), row = n + 1;
  const xz = new Float32Array(row * row * 2);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const k = (j * row + i) * 2;
    xz[k] = -SPAN / 2 + i * spacing; xz[k + 1] = -SPAN / 2 + j * spacing;
  }
  const index = new Uint32Array(n * n * 6);
  let t = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1; // a = (i, j), b = (i+1, j), c = (i, j+1), d = (i+1, j+1)
    // seen from above (+y) with x right and z down the screen, a -> c -> b turns counter-clockwise
    index[t++] = a; index[t++] = c; index[t++] = b;
    index[t++] = d; index[t++] = b; index[t++] = c;
  }
  return { n, spacing, xz, index };
}

/** Heights of every grid point for facets `cell` wide (the patch is centred on 0, so the facet lattice lines up with the grid). */
export function gridHeights(grid: MoonGrid, cell: number): Float32Array {
  const count = grid.xz.length / 2, out = new Float32Array(count);
  const faceted = cell > grid.spacing + 1e-6;
  for (let k = 0; k < count; k++) {
    const x = grid.xz[k * 2]!, z = grid.xz[k * 2 + 1]!;
    out[k] = faceted ? facetedHeight(x, z, cell) : moonHeight(x, z);
  }
  return out;
}

/** Smooth normals of a height grid (central differences; edges use one side). */
export function gridNormals(grid: MoonGrid, heights: Float32Array): Float32Array {
  const row = grid.n + 1, out = new Float32Array(row * row * 3), s = grid.spacing;
  for (let j = 0; j <= grid.n; j++) for (let i = 0; i <= grid.n; i++) {
    const h = (ii: number, jj: number) => heights[Math.max(0, Math.min(grid.n, jj)) * row + Math.max(0, Math.min(grid.n, ii))]!;
    const dx = (h(i + 1, j) - h(i - 1, j)) / ((Math.min(grid.n, i + 1) - Math.max(0, i - 1)) * s);
    const dz = (h(i, j + 1) - h(i, j - 1)) / ((Math.min(grid.n, j + 1) - Math.max(0, j - 1)) * s);
    const len = Math.sqrt(dx * dx + 1 + dz * dz), k = (j * row + i) * 3;
    out[k] = -dx / len; out[k + 1] = 1 / len; out[k + 2] = -dz / len;
  }
  return out;
}
