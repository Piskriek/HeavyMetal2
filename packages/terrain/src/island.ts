import { createTerrain, normalYAtCell, type Terrain, type TerrainSpec } from './grid';

export interface IslandOptions {
  readonly surfaces: { readonly seabed: number; readonly sand: number; readonly grass: number; readonly rock: number; readonly cliff: number };
  /** Fraction of the half-extent that is island (default 0.8). */
  readonly radius?: number;
  readonly height?: number;
  readonly roughness?: number;
  readonly seaDepth?: number;
}

const smooth = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c); };

/** Integer hash of a lattice point and seed to [0, 1): no floating point trig, identical on every engine. */
function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function fbm(x: number, z: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < 5; o++) { sum += amp * valueNoise(x * freq, z * freq, seed + o * 101); norm += amp; amp *= 0.5; freq *= 2; }
  return sum / norm;
}

/** An island in the sea: heights from radial falloff + fbm, then surfaces by height and slope in a second pass. */
export function generateIsland(spec: TerrainSpec, seed: number, o: IslandOptions): Terrain {
  const t = createTerrain(spec);
  const { cols, rows, cell, originX, originZ } = spec;
  const radius = o.radius ?? 0.8, height = o.height ?? 12, roughness = o.roughness ?? 6, seaDepth = o.seaDepth ?? 20;
  const width = (cols - 1) * cell, depth = (rows - 1) * cell;
  const cx = originX + width / 2, cz = originZ + depth / 2;
  const reach = radius * 0.5 * Math.min(width, depth);
  const wavelength = 40;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = originX + c * cell, z = originZ + r * cell;
      const d = Math.hypot(x - cx, z - cz) / reach;
      const mask = Math.pow(1 - smooth(Math.min(d, 1)), 1.3);
      const n = fbm(x / wavelength, z / wavelength, seed);
      t.heights[r * cols + c] = height * mask + (n - 0.5) * roughness * mask - seaDepth * Math.max(0, d - 1);
    }
  }
  const s = o.surfaces;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c, h = t.heights[i]!;
      let A: number, B: number, w = 0;
      if (h < -0.5) { A = B = s.seabed; }
      else {
        if (h < 0) { A = s.sand; B = s.seabed; w = Math.min(1, -h / 0.5); }
        else if (h <= 0.5) { A = B = s.sand; }
        else if (h < 1) { A = s.sand; B = s.grass; w = (h - 0.5) / 0.5; }
        else { A = B = s.grass; }
        const ny = normalYAtCell(t, c, r);
        if (ny < 0.35) { A = B = s.cliff; w = 0; }
        else if (ny < 0.6) { B = A; A = s.rock; w = Math.max(0, Math.min(1, (ny - 0.35) / 0.25)); }
      }
      t.surfaceA[i] = A; t.surfaceB[i] = B;
      t.blend[i] = A === B ? 0 : Math.min(254, Math.max(1, Math.round(w * 255)));
    }
  }
  return t;
}
