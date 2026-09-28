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

/**
 * Möller–Trumbore ray-triangle intersection test.
 */
function occluded(
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

export function bakeVertexLighting(mesh: RawMesh, o: BakeOpts = DEFAULT_BAKE_OPTS): BakeResult {
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

  const nrm = vertexNormals(mesh);
  const dirs = hemisphereDirs(o.rays);
  const colors = new Float32Array(n * 3);
  const eps = 0.5;
  let rayCount = 0;

  const groundHit = (oy: number, dy: number) =>
    o.ground && dy < -1e-6 && (minY - 0.25 - oy) / dy < o.maxDist;

  for (let i = 0; i < n; i++) {
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
