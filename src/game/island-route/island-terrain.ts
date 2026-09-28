/**
 * ISLAND-ROUTE: what the island's ground is like at every spot — the numbers island auto paint reads.
 *
 * The island model is low-poly (~7,500 triangles, ~1,100 units a side) with soft normals, so reading
 * slope from the faces would paint triangles. Instead the model is rasterised top-down into a grid
 * (1024 across the ground square, ~94 units a cell) with its *vertex normals* interpolated across each
 * face, which is how the model is lit, so slope bands follow the shading the eye sees. From that grid:
 *
 *   height     world y of the surface (NaN off the model)
 *   slope      degrees from level (smooth normals)
 *   facing     the normal's z (+1 faces +z, −1 faces −z), for "moss on the shady side"
 *   hollow     how far the ground sits below its surroundings, at ~300 and ~1,100 units (a blurred
 *              height minus the height: + in a hollow or crease, − on a ridge or knoll)
 *   shore      distance from the waterline (y = 0) in world units: + inland, − out to sea
 *   road       distance from the island road's surface (0 on it), when a road footprint is given
 *
 * Pure numbers: no three.js, no DOM. Fast (tens of milliseconds): a scan-line raster, box blurs from a
 * summed-area table, and two-pass chamfer distances.
 */

export interface TerrainTriangles {
  /** World positions, 3 per vertex, 3 vertices per triangle (non-indexed). */
  readonly positions: Float32Array;
  /** World normals, matching `positions`. */
  readonly normals: Float32Array;
}

export interface IslandTerrain {
  readonly res: number;
  /** Half the ground square's side (world units, centred on the origin). */
  readonly half: number;
  /** World units per cell. */
  readonly cell: number;
  readonly height: Float32Array;
  readonly slope: Float32Array;
  readonly facing: Float32Array;
  readonly hollowSmall: Float32Array;
  readonly hollowLarge: Float32Array;
  readonly shore: Float32Array;
  readonly road: Float32Array;
  /** Highest point, for altitude as a percentage (0 = sea, 100 = peak). */
  readonly peak: number;
}

export const TERRAIN_RES = 1024;
const SMALL_RADIUS = 3; // cells: ~280 units
const LARGE_RADIUS = 12; // cells: ~1,100 units

/**
 * The island rasterised and analysed. `roadCells` (optional) are indices into a grid of `roadRes`
 * across the same square that the road covers (the island road footprint); without it `road` is +∞.
 */
export function analyseIslandTerrain(
  tris: TerrainTriangles,
  opts: { half: number; res?: number; roadCells?: ArrayLike<number>; roadRes?: number },
): IslandTerrain {
  const res = opts.res ?? TERRAIN_RES;
  const half = opts.half;
  const cell = (2 * half) / res;
  const n = res * res;
  const height = new Float32Array(n).fill(NaN);
  const nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n);
  rasterise(tris, res, half, height, nx, ny, nz);
  fillHoles(height, nx, ny, nz, res);

  const slope = new Float32Array(n);
  const facing = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const len = Math.hypot(nx[i], ny[i], nz[i]) || 1;
    const up = Math.max(-1, Math.min(1, ny[i] / len));
    slope[i] = Number.isNaN(height[i]) ? 0 : (Math.acos(Math.abs(up)) * 180) / Math.PI;
    facing[i] = nz[i] / len;
    if (height[i] > peak) peak = height[i];
  }

  // Hollows: blurred height minus height. Off the model the "ground" is the sea floor at 0.
  const ground = new Float32Array(n);
  for (let i = 0; i < n; i++) ground[i] = Number.isNaN(height[i]) ? 0 : height[i];
  const hollowSmall = boxBlur(ground, res, SMALL_RADIUS);
  const hollowLarge = boxBlur(ground, res, LARGE_RADIUS);
  for (let i = 0; i < n; i++) { hollowSmall[i] -= ground[i]; hollowLarge[i] -= ground[i]; }

  // Shore: distance to the other side of the waterline, signed (+ on land).
  const land = new Uint8Array(n);
  for (let i = 0; i < n; i++) land[i] = height[i] > 0 ? 1 : 0;
  const toSea = chamfer(land, res, 0); // distance from each land cell to the nearest sea cell
  const toLand = chamfer(land, res, 1); // distance from each sea cell to the nearest land cell
  const shore = new Float32Array(n);
  for (let i = 0; i < n; i++) shore[i] = land[i] ? toSea[i] * cell : -toLand[i] * cell;

  const road = new Float32Array(n).fill(Infinity);
  if (opts.roadCells && opts.roadRes) {
    const seed = new Uint8Array(n);
    const k = opts.roadRes / res;
    for (let j = 0; j < opts.roadCells.length; j++) {
      const idx = opts.roadCells[j];
      const x = Math.floor((idx % opts.roadRes) / k), y = Math.floor(Math.floor(idx / opts.roadRes) / k);
      if (x >= 0 && y >= 0 && x < res && y < res) seed[y * res + x] = 1;
    }
    const d = chamfer(seed, res, 0, true);
    for (let i = 0; i < n; i++) road[i] = d[i] * cell;
  }

  return { res, half, cell, height, slope, facing, hollowSmall, hollowLarge, shore, road, peak };
}

/** Top-down scan of every triangle into the grid: the highest surface wins, normals interpolated. */
function rasterise(tris: TerrainTriangles, res: number, half: number, height: Float32Array, nx: Float32Array, ny: Float32Array, nz: Float32Array) {
  const p = tris.positions, q = tris.normals;
  const toCell = res / (2 * half);
  for (let t = 0; t + 8 < p.length; t += 9) {
    const ax = (p[t] + half) * toCell - 0.5, az = (p[t + 2] + half) * toCell - 0.5;
    const bx = (p[t + 3] + half) * toCell - 0.5, bz = (p[t + 5] + half) * toCell - 0.5;
    const cx = (p[t + 6] + half) * toCell - 0.5, cz = (p[t + 8] + half) * toCell - 0.5;
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), x1 = Math.min(res - 1, Math.floor(Math.max(ax, bx, cx)));
    const z0 = Math.max(0, Math.ceil(Math.min(az, bz, cz))), z1 = Math.min(res - 1, Math.floor(Math.max(az, bz, cz)));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const y = w0 * p[t + 1] + w1 * p[t + 4] + w2 * p[t + 7];
        const i = z * res + x;
        const cur = height[i];
        if (!Number.isNaN(cur) && y <= cur) continue;
        height[i] = y;
        nx[i] = w0 * q[t] + w1 * q[t + 3] + w2 * q[t + 6];
        ny[i] = w0 * q[t + 1] + w1 * q[t + 4] + w2 * q[t + 7];
        nz[i] = w0 * q[t + 2] + w1 * q[t + 5] + w2 * q[t + 8];
      }
    }
  }
}

/** Cells a sliver triangle skipped: filled from their filled neighbours (two passes are plenty). */
function fillHoles(height: Float32Array, nx: Float32Array, ny: Float32Array, nz: Float32Array, res: number) {
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < res - 1; y++) {
      for (let x = 1; x < res - 1; x++) {
        const i = y * res + x;
        if (!Number.isNaN(height[i])) continue;
        let sum = 0, count = 0, sx = 0, sy = 0, sz = 0;
        for (const j of [i - 1, i + 1, i - res, i + res]) {
          if (Number.isNaN(height[j])) continue;
          sum += height[j]; sx += nx[j]; sy += ny[j]; sz += nz[j]; count++;
        }
        // Only a real hole (surrounded on 3+ sides), never the model's outer edge growing outwards.
        if (count >= 3) { height[i] = sum / count; nx[i] = sx / count; ny[i] = sy / count; nz[i] = sz / count; }
      }
    }
  }
}

/** Mean over a (2r+1)² box, from a summed-area table (edges clamp). */
export function boxBlur(src: Float32Array, res: number, r: number): Float32Array {
  const w = res + 1;
  const sat = new Float64Array(w * w);
  for (let y = 0; y < res; y++) {
    let row = 0;
    for (let x = 0; x < res; x++) {
      row += src[y * res + x];
      sat[(y + 1) * w + x + 1] = sat[y * w + x + 1] + row;
    }
  }
  const out = new Float32Array(res * res);
  for (let y = 0; y < res; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(res, y + r + 1);
    for (let x = 0; x < res; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(res, x + r + 1);
      const sum = sat[y1 * w + x1] - sat[y0 * w + x1] - sat[y1 * w + x0] + sat[y0 * w + x0];
      out[y * res + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/**
 * Two-pass chamfer distance, in cells, to the nearest target cell. Targets are the cells where
 * `mask === inside`, or with `seeds = true` the cells where `mask === 1`.
 */
export function chamfer(mask: Uint8Array, res: number, inside: 0 | 1, seeds = false): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(res * res);
  for (let i = 0; i < d.length; i++) {
    const target = seeds ? mask[i] === 1 : mask[i] === inside;
    d[i] = target ? 0 : INF;
  }
  const D = 1, E = Math.SQRT2;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const i = y * res + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + D);
      if (y > 0) {
        v = Math.min(v, d[i - res] + D);
        if (x > 0) v = Math.min(v, d[i - res - 1] + E);
        if (x < res - 1) v = Math.min(v, d[i - res + 1] + E);
      }
      d[i] = v;
    }
  }
  for (let y = res - 1; y >= 0; y--) {
    for (let x = res - 1; x >= 0; x--) {
      const i = y * res + x;
      let v = d[i];
      if (x < res - 1) v = Math.min(v, d[i + 1] + D);
      if (y < res - 1) {
        v = Math.min(v, d[i + res] + D);
        if (x < res - 1) v = Math.min(v, d[i + res + 1] + E);
        if (x > 0) v = Math.min(v, d[i + res - 1] + E);
      }
      d[i] = v;
    }
  }
  return d;
}
