/**
 * IF-BAKER: Deterministic hemisphere AO + sun visibility baked to vertex colors.
 * Eliminates dynamic shadow costs on static geometry.
 */

import type { RawMesh } from '../assets/model-import';

export interface BakeOpts {
  rays: number; // hemisphere samples per vertex (8..64)
  maxDist: number; // occlusion radius in world units
  sunDir: [number, number, number]; // toward the sun, normalized
  ambient: number; // skylight weight 0..1
  sun: number; // direct weight 0..1
  ground: boolean; // implicit ground plane at min Y (contact shadows)
  sunTint: [number, number, number];
  skyTint: [number, number, number];
}

export const DEFAULT_BAKE_OPTS: BakeOpts = {
  rays: 16,
  maxDist: 400,
  sunDir: [0.577, 0.577, 0.577],
  ambient: 0.4,
  sun: 0.8,
  ground: true,
  sunTint: [1.0, 0.95, 0.85],
  skyTint: [0.75, 0.85, 1.0],
};

export interface BakeResult {
  colors: Float32Array; // RGB per vertex in [0, 1.25]
  rayCount: number;
  ms: number;
}

/**
 * Cosine-weighted Fibonacci hemisphere (z-up).
 * Deterministic: identical nRays produces identical sample directions.
 */
export function hemisphereDirs(nRays: number): Float32Array {
  const out = new Float32Array(nRays * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let k = 0; k < nRays; k++) {
    const r = Math.sqrt((k + 0.5) / nRays);
    const phi = k * golden;
    out[k * 3] = r * Math.cos(phi);
    out[k * 3 + 1] = r * Math.sin(phi);
    out[k * 3 + 2] = Math.sqrt(Math.max(0, 1 - r * r));
  }

  return out;
}

/**
 * Area-weighted normalized vertex normals.
 */
export function vertexNormals(mesh: RawMesh): Float32Array {
  const p = mesh.positions;
  const f = mesh.indices;
  const nrm = new Float32Array(p.length);

  for (let t = 0; t < f.length; t += 3) {
    const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;

    for (const i of [a, b, c]) {
      nrm[i] += nx;
      nrm[i + 1] += ny;
      nrm[i + 2] += nz;
    }
  }

  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l;
    nrm[i + 1] /= l;
    nrm[i + 2] /= l;
  }

  return nrm;
}

/** Möller–Trumbore distance along the ray to one triangle, or -1 when it misses. */
function rayTriangleT(tri: Float64Array, i: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
  const e1x = tri[i + 3], e1y = tri[i + 4], e1z = tri[i + 5];
  const e2x = tri[i + 6], e2y = tri[i + 7], e2z = tri[i + 8];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det;
  const tx = ox - tri[i], ty = oy - tri[i + 1], tz = oz - tri[i + 2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return -1;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}

/** Möller–Trumbore against one triangle (offset `i` into the packed array): true when hit within (1e-3, maxT). */
function hitsTriangle(tri: Float64Array, i: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): boolean {
  const e1x = tri[i + 3], e1y = tri[i + 4], e1z = tri[i + 5];
  const e2x = tri[i + 6], e2y = tri[i + 7], e2z = tri[i + 8];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return false;
  const inv = 1 / det;
  const tx = ox - tri[i], ty = oy - tri[i + 1], tz = oz - tri[i + 2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return false;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return false;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-3 && t < maxT;
}

/**
 * A uniform grid of the triangles, so a ray tests only the triangles in the cells it passes through
 * (Amanatides–Woo walk) instead of every triangle in the model: the same answers, thousands of times
 * fewer tests on a big model.
 */
export class TriangleGrid {
  readonly min: [number, number, number];
  readonly cell: number;
  readonly n: [number, number, number];
  /** Cell → its triangles (offsets into the packed array), as a CSR list. */
  private readonly start: Int32Array;
  private readonly items: Int32Array;
  /** Per triangle: the last ray that tested it (so a triangle in several cells is tested once). */
  private readonly stamp: Int32Array;
  private ray = 0;

  constructor(readonly tri: Float64Array) {
    const count = tri.length / 9;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tri.length; i += 9) {
      for (let a = 0; a < 3; a++) {
        const v0 = tri[i + a], v1 = v0 + tri[i + 3 + a], v2 = v0 + tri[i + 6 + a];
        lo[a] = Math.min(lo[a], v0, v1, v2); hi[a] = Math.max(hi[a], v0, v1, v2);
      }
    }
    if (!count) { lo.fill(0); hi.fill(1); }
    const size = [0, 1, 2].map((a) => Math.max(1e-6, hi[a] - lo[a]));
    // About two triangles per cell on average, at most 96 cells along an axis.
    const volume = size[0] * size[1] * size[2];
    let cell = Math.cbrt(volume / Math.max(1, count / 2));
    cell = Math.max(cell, Math.max(...size) / 96, 1e-6);
    this.cell = cell;
    this.min = [lo[0] - cell * 1e-3, lo[1] - cell * 1e-3, lo[2] - cell * 1e-3];
    this.n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((size[a] + cell * 2e-3) / cell))) as [number, number, number];
    const cells = this.n[0] * this.n[1] * this.n[2];
    const counts = new Int32Array(cells + 1);
    const each = (i: number, fn: (c: number) => void) => {
      const r = [0, 1, 2].map((a) => {
        const v0 = tri[i + a], v1 = v0 + tri[i + 3 + a], v2 = v0 + tri[i + 6 + a];
        return [this.idx(Math.min(v0, v1, v2), a), this.idx(Math.max(v0, v1, v2), a)];
      });
      for (let x = r[0][0]; x <= r[0][1]; x++) for (let y = r[1][0]; y <= r[1][1]; y++) for (let z = r[2][0]; z <= r[2][1]; z++) fn((x * this.n[1] + y) * this.n[2] + z);
    };
    for (let i = 0; i < tri.length; i += 9) each(i, (c) => { counts[c + 1]++; });
    for (let c = 0; c < cells; c++) counts[c + 1] += counts[c];
    this.start = counts;
    this.items = new Int32Array(counts[cells]);
    const fill = counts.slice(0, cells);
    for (let i = 0; i < tri.length; i += 9) each(i, (c) => { this.items[fill[c]++] = i; });
    this.stamp = new Int32Array(count).fill(-1);
  }

  private idx(v: number, axis: number): number {
    return Math.max(0, Math.min(this.n[axis] - 1, Math.floor((v - this.min[axis]) / this.cell)));
  }

  /** How far along the ray its first hit is (within maxT), or Infinity. */
  nearest(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): number {
    let best = Infinity;
    this.walk(ox, oy, oz, dx, dy, dz, maxT, (i) => {
      const t = rayTriangleT(this.tri, i, ox, oy, oz, dx, dy, dz);
      if (t > 1e-3 && t < maxT && t < best) best = t;
      return false;
    }, (cellExit) => best <= cellExit);
    return best;
  }

  /**
   * Walks the cells along the ray, calling `visit` for each triangle once (with the ray's exit distance
   * from that cell); `visit` returning true stops the walk. `doneAfterCell(exit)` is asked after each cell, once every triangle in it has been checked.
   */
  private walk(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number,
    visit: (i: number, cellExit: number) => boolean, doneAfterCell: (cellExit: number) => boolean): void {
    const o = [ox, oy, oz], d = [dx, dy, dz];
    let t0 = 0, t1 = maxT;
    for (let a = 0; a < 3; a++) {
      const lo = this.min[a], hi = this.min[a] + this.n[a] * this.cell;
      if (Math.abs(d[a]) < 1e-12) { if (o[a] < lo || o[a] > hi) return; continue; }
      let ta = (lo - o[a]) / d[a], tb = (hi - o[a]) / d[a];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return;
    }
    const ray = ++this.ray;
    const c = [0, 1, 2].map((a) => this.idx(o[a] + d[a] * t0, a));
    const step = [0, 0, 0], next = [Infinity, Infinity, Infinity], delta = [Infinity, Infinity, Infinity];
    for (let a = 0; a < 3; a++) {
      if (d[a] > 0) { step[a] = 1; next[a] = (this.min[a] + (c[a] + 1) * this.cell - o[a]) / d[a]; delta[a] = this.cell / d[a]; }
      else if (d[a] < 0) { step[a] = -1; next[a] = (this.min[a] + c[a] * this.cell - o[a]) / d[a]; delta[a] = -this.cell / d[a]; }
    }
    for (;;) {
      const exit = Math.min(next[0], next[1], next[2]);
      const cellIndex = (c[0] * this.n[1] + c[1]) * this.n[2] + c[2];
      for (let k = this.start[cellIndex]; k < this.start[cellIndex + 1]; k++) {
        const i = this.items[k];
        const id = i / 9;
        if (this.stamp[id] === ray) continue;
        this.stamp[id] = ray;
        if (visit(i, exit)) return;
      }
      if (doneAfterCell(exit)) return;
      const a = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
      if (next[a] > t1) return;
      c[a] += step[a];
      if (c[a] < 0 || c[a] >= this.n[a]) return;
      next[a] += delta[a];
    }
  }

  /** True when the ray hits a triangle within (1e-3, maxT). */
  occluded(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): boolean {
    const o = [ox, oy, oz], d = [dx, dy, dz];
    // Clip the ray to the grid's box.
    let t0 = 0, t1 = maxT;
    for (let a = 0; a < 3; a++) {
      const lo = this.min[a], hi = this.min[a] + this.n[a] * this.cell;
      if (Math.abs(d[a]) < 1e-12) { if (o[a] < lo || o[a] > hi) return false; continue; }
      let ta = (lo - o[a]) / d[a], tb = (hi - o[a]) / d[a];
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    const ray = ++this.ray;
    const cellOf = (a: number) => this.idx(o[a] + d[a] * t0, a);
    const c = [cellOf(0), cellOf(1), cellOf(2)];
    const step = [0, 0, 0], next = [Infinity, Infinity, Infinity], delta = [Infinity, Infinity, Infinity];
    for (let a = 0; a < 3; a++) {
      if (d[a] > 0) { step[a] = 1; next[a] = (this.min[a] + (c[a] + 1) * this.cell - o[a]) / d[a]; delta[a] = this.cell / d[a]; }
      else if (d[a] < 0) { step[a] = -1; next[a] = (this.min[a] + c[a] * this.cell - o[a]) / d[a]; delta[a] = -this.cell / d[a]; }
    }
    for (;;) {
      const cellIndex = (c[0] * this.n[1] + c[1]) * this.n[2] + c[2];
      for (let k = this.start[cellIndex]; k < this.start[cellIndex + 1]; k++) {
        const i = this.items[k];
        const id = i / 9;
        if (this.stamp[id] === ray) continue;
        this.stamp[id] = ray;
        if (hitsTriangle(this.tri, i, ox, oy, oz, dx, dy, dz, maxT)) return true;
      }
      const a = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
      if (next[a] > t1) return false;
      c[a] += step[a];
      if (c[a] < 0 || c[a] >= this.n[a]) return false;
      next[a] += delta[a];
    }
  }
}

/**
 * Möller–Trumbore ray-triangle intersection test, against every triangle (kept as the reference the
 * grid is tested against).
 */
export function occludedBrute(
  tri: Float64Array,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number,
): boolean {
  for (let i = 0; i < tri.length; i += 9) {
    const e1x = tri[i + 3], e1y = tri[i + 4], e1z = tri[i + 5];
    const e2x = tri[i + 6], e2y = tri[i + 7], e2z = tri[i + 8];

    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;

    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) continue;

    const inv = 1 / det;
    const tx = ox - tri[i], ty = oy - tri[i + 1], tz = oz - tri[i + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;

    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;

    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;

    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t > 1e-3 && t < maxT) return true;
  }

  return false;
}

/** `onProgress(done, total)` is called every few hundred vertices (the bake worker reports it). */
export function bakeVertexLighting(mesh: RawMesh, o: BakeOpts = DEFAULT_BAKE_OPTS, onProgress?: (done: number, total: number) => void): BakeResult {
  const t0 = performance.now();
  const p = mesh.positions;
  const f = mesh.indices;
  const n = p.length / 3;

  const tri = new Float64Array((f.length / 3) * 9);
  let minY = Infinity;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, p[i * 3 + 1]);
  }

  for (let t = 0, k = 0; t < f.length; t += 3, k += 9) {
    const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
    tri[k] = p[a];
    tri[k + 1] = p[a + 1];
    tri[k + 2] = p[a + 2];
    tri[k + 3] = p[b] - p[a];
    tri[k + 4] = p[b + 1] - p[a + 1];
    tri[k + 5] = p[b + 2] - p[a + 2];
    tri[k + 6] = p[c] - p[a];
    tri[k + 7] = p[c + 1] - p[a + 1];
    tri[k + 8] = p[c + 2] - p[a + 2];
  }

  const grid = new TriangleGrid(tri);
  const occluded = (_t: Float64Array, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number) =>
    grid.occluded(ox, oy, oz, dx, dy, dz, maxT);
  const nrm = vertexNormals(mesh);
  const dirs = hemisphereDirs(o.rays);
  const colors = new Float32Array(n * 3);
  const eps = 0.5;
  let rayCount = 0;

  const groundHit = (oy: number, dy: number) =>
    o.ground && dy < -1e-6 && (minY - 0.25 - oy) / dy < o.maxDist;

  for (let i = 0; i < n; i++) {
    if (onProgress && i % 512 === 0) onProgress(i, n);
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];

    // Orthonormal basis around n
    const ax = Math.abs(nx) > 0.9 ? 0 : 1;
    const ay = Math.abs(nx) > 0.9 ? 1 : 0;
    let tx = ay * nz, ty = -ax * nz, tz = ax * ny - ay * nx;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;

    const ox = p[i * 3] + nx * eps;
    const oy = p[i * 3 + 1] + ny * eps;
    const oz = p[i * 3 + 2] + nz * eps;

    let open = 0;
    for (let k = 0; k < o.rays; k++) {
      const a = dirs[k * 3], b = dirs[k * 3 + 1], c = dirs[k * 3 + 2];
      const dx = tx * a + bx * b + nx * c;
      const dy = ty * a + by * b + ny * c;
      const dz = tz * a + bz * b + nz * c;

      rayCount++;
      if (groundHit(oy, dy) || occluded(tri, ox, oy, oz, dx, dy, dz, o.maxDist)) continue;
      open++;
    }

    const ao = open / o.rays;
    const [lx, ly, lz] = o.sunDir;
    const ndl = Math.max(0, nx * lx + ny * ly + nz * lz);

    let vis = 0;
    if (ndl > 0) {
      rayCount++;
      vis = groundHit(oy, ly) || occluded(tri, ox, oy, oz, lx, ly, lz, 1e6) ? 0 : 1;
    }

    for (let ch = 0; ch < 3; ch++) {
      colors[i * 3 + ch] = Math.min(
        1.25,
        o.ambient * ao * o.skyTint[ch] + o.sun * ndl * vis * o.sunTint[ch],
      );
    }
  }

  return {
    colors,
    rayCount,
    ms: performance.now() - t0,
  };
}
