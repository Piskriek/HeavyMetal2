/**
 * IF-COLLISION-TERRAIN: Rasterizes a 'terrain'-role mesh into a track-space heightfield patch.
 * Coordinates: X = down-track (engine x), Z = lateral (engine z, ±480), Y = height / elevation.
 */

import type { RawMesh } from '../assets/model-import';

export const PATCH_CELL_X = 20; // engine x-units
export const PATCH_CELL_Z = 24; // lateral z-units
export const FLOOR_MAX_DEG = 50; // steeper ⇒ wall (not drivable)
export const HEIGHT_QUANT = 8; // heights stored to 1/8 unit ⇒ bit-stable hash
export const LAYER_EPS = 0.5;

export const F_COVERED = 1;
export const F_WALL = 2;
export const F_OVERHANG = 4;
export const F_FILLED = 8;
export const F_OUTSIDE = 16;
export const F_LEDGE = 32;
export const STEP_MAX = 24; // ≈ 0.77·RADIUS: taller steps are walls to a grounded marble

export interface Patch {
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  cellX: number;
  cellZ: number;
  heights: Float32Array; // NaN = not drivable (falls through to baseline surface)
  slopeX: Float32Array; // dh/dx
  slopeZ: Float32Array; // dh/dz (lateral bank angle)
  flags: Uint8Array;
  hash: string;
  stats: {
    covered: number;
    walls: number;
    overhangs: number;
    filled: number;
    outside: number;
    ledges: number;
    trisUsed: number;
    trisDropped: number;
    ms: number;
  };
}

export function patchHash(heights: Float32Array, flags: Uint8Array): string {
  let h = 0x811c9dc5;
  const mix = (b: number) => {
    h ^= b & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  };

  for (let k = 0; k < heights.length; k++) {
    const q = Number.isNaN(heights[k]) ? -2147483648 : Math.round(heights[k] * HEIGHT_QUANT) | 0;
    mix(q);
    mix(q >>> 8);
    mix(q >>> 16);
    mix(q >>> 24);
    mix(flags[k]);
  }

  return h.toString(16).padStart(8, '0');
}

export function compilePatch(
  mesh: RawMesh,
  opts: { fillHoles: boolean; floorMaxDeg?: number; corridor?: number },
): Patch {
  const t0 = performance.now();
  const p = mesh.positions;
  const f = mesh.indices;
  const corridor = opts.corridor ?? 480;
  const cosFloor = Math.cos(((opts.floorMaxDeg ?? FLOOR_MAX_DEG) * Math.PI) / 180);

  let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    mnx = Math.min(mnx, p[i]);
    mxx = Math.max(mxx, p[i]);
    mnz = Math.min(mnz, p[i + 2]);
    mxz = Math.max(mxz, p[i + 2]);
  }

  const x0 = Math.floor(mnx / PATCH_CELL_X) * PATCH_CELL_X;
  const z0 = Math.floor(mnz / PATCH_CELL_Z) * PATCH_CELL_Z;
  const nx = Math.max(1, Math.ceil((mxx - x0) / PATCH_CELL_X));
  const nz = Math.max(1, Math.ceil((mxz - z0) / PATCH_CELL_Z));
  const N = nx * nz;

  const hits: number[][] = Array.from({ length: N }, () => []);
  const topSteep = new Uint8Array(N);
  const topY = new Float64Array(N).fill(-Infinity);
  let trisUsed = 0, trisDropped = 0;

  for (let t = 0; t < f.length; t += 3) {
    const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
    const ax = p[a], ay = p[a + 1], az = p[a + 2];
    const bx = p[b], by = p[b + 1], bz = p[b + 2];
    const cx = p[c], cy = p[c + 1], cz = p[c + 2];

    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); // 2D signed area
    if (Math.abs(d) < 1e-9) {
      trisDropped++;
      continue;
    }
    trisUsed++;

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;

    // Normal tilt angle check: winding-independent because of Math.abs(nY)
    const steep = Math.abs(nY) / (Math.hypot(nX, nY, nZ) || 1) < cosFloor;

    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / PATCH_CELL_X));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - x0) / PATCH_CELL_X));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / PATCH_CELL_Z));
    const j1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - z0) / PATCH_CELL_Z));

    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const px = x0 + (i + 0.5) * PATCH_CELL_X;
        const pz = z0 + (j + 0.5) * PATCH_CELL_Z;
        const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d;
        const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
        const l3 = 1 - l1 - l2;

        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;

        const y = l1 * ay + l2 * by + l3 * cy;
        const k = i * nz + j;
        hits[k].push(y);
        if (y > topY[k]) {
          topY[k] = y;
          topSteep[k] = steep ? 1 : 0;
        }
      }
    }
  }

  const heights = new Float32Array(N).fill(NaN);
  const flags = new Uint8Array(N);
  let covered = 0, walls = 0, overhangs = 0, outside = 0;

  for (let k = 0; k < N; k++) {
    const pz = z0 + ((k % nz) + 0.5) * PATCH_CELL_Z;
    if (Math.abs(pz) > corridor - 37) {
      if (hits[k].length) {
        flags[k] |= F_OUTSIDE;
        outside++;
      }
      continue;
    }
    if (!hits[k].length) continue;

    const ys = [...hits[k]].sort((a, b) => b - a);
    let layers = 1;
    for (let q = 1; q < ys.length; q++) {
      if (ys[q - 1] - ys[q] > LAYER_EPS) layers++;
    }
    if (layers >= 3) {
      flags[k] |= F_OVERHANG;
      overhangs++;
    }
    if (topSteep[k]) {
      flags[k] |= F_WALL;
      walls++;
      continue;
    }

    heights[k] = Math.round(topY[k] * HEIGHT_QUANT) / HEIGHT_QUANT;
    flags[k] |= F_COVERED;
    covered++;
  }

  // Hole filling
  let filled = 0;
  if (opts.fillHoles) {
    const snapshot = Float32Array.from(heights);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const k = i * nz + j;
        if (!Number.isNaN(snapshot[k]) || (flags[k] & (F_WALL | F_OUTSIDE))) continue;

        let cnt = 0, sum = 0;
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if (!di && !dj) continue;
            const ii = i + di, jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
            const v = snapshot[ii * nz + jj];
            if (!Number.isNaN(v)) {
              cnt++;
              sum += v;
            }
          }
        }
        if (cnt >= 6) {
          heights[k] = Math.round((sum / cnt) * HEIGHT_QUANT) / HEIGHT_QUANT;
          flags[k] |= F_FILLED | F_COVERED;
          filled++;
        }
      }
    }
  }

  // Ledge detection
  let ledges = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const k = i * nz + j;
      const hh = heights[k];
      if (Number.isNaN(hh)) continue;

      const nb = [
        [i - 1, j],
        [i + 1, j],
        [i, j - 1],
        [i, j + 1],
      ].map(([a, b]) =>
        a < 0 || b < 0 || a >= nx || b >= nz || Number.isNaN(heights[a * nz + b])
          ? 0
          : heights[a * nz + b],
      );

      if (nb.some((v) => hh - v > STEP_MAX)) {
        flags[k] |= F_LEDGE;
        ledges++;
      }
    }
  }

  // Finite difference slopes
  const slopeX = new Float32Array(N);
  const slopeZ = new Float32Array(N);
  const at = (i: number, j: number) =>
    i < 0 || j < 0 || i >= nx || j >= nz ? NaN : heights[i * nz + j];

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const k = i * nz + j;
      if (Number.isNaN(heights[k])) continue;
      const h = heights[k];
      const xl = at(i - 1, j), xr = at(i + 1, j);
      const zl = at(i, j - 1), zr = at(i, j + 1);

      slopeX[k] =
        !Number.isNaN(xl) && !Number.isNaN(xr)
          ? (xr - xl) / (2 * PATCH_CELL_X)
          : !Number.isNaN(xr)
          ? (xr - h) / PATCH_CELL_X
          : !Number.isNaN(xl)
          ? (h - xl) / PATCH_CELL_X
          : 0;

      slopeZ[k] =
        !Number.isNaN(zl) && !Number.isNaN(zr)
          ? (zr - zl) / (2 * PATCH_CELL_Z)
          : !Number.isNaN(zr)
          ? (zr - h) / PATCH_CELL_Z
          : !Number.isNaN(zl)
          ? (h - zl) / PATCH_CELL_Z
          : 0;
    }
  }

  return {
    x0,
    z0,
    nx,
    nz,
    cellX: PATCH_CELL_X,
    cellZ: PATCH_CELL_Z,
    heights,
    slopeX,
    slopeZ,
    flags,
    hash: patchHash(heights, flags),
    stats: {
      covered,
      walls,
      overhangs,
      filled,
      outside,
      ledges,
      trisUsed,
      trisDropped,
      ms: performance.now() - t0,
    },
  };
}

/**
 * Surface height query used by physics simulation: returns patch height if covered,
 * otherwise falls back to baseline track course surface.
 */
export function surfaceAtPatch(
  patch: Patch,
  x: number,
  z: number,
  baseline: number,
): { y: number; fromPatch: boolean; slopeX: number; slopeZ: number } {
  const i = Math.floor((x - patch.x0) / patch.cellX);
  const j = Math.floor((z - patch.z0) / patch.cellZ);

  if (i < 0 || j < 0 || i >= patch.nx || j >= patch.nz) {
    return { y: baseline, fromPatch: false, slopeX: 0, slopeZ: 0 };
  }

  const k = i * patch.nz + j;
  const hgt = patch.heights[k];

  if (Number.isNaN(hgt) || hgt < baseline) {
    return { y: baseline, fromPatch: false, slopeX: 0, slopeZ: 0 };
  }

  return {
    y: hgt,
    fromPatch: true,
    slopeX: patch.slopeX[k],
    slopeZ: patch.slopeZ[k],
  };
}
