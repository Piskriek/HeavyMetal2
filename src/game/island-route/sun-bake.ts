/**
 * ISLAND-ROUTE: the sun bake. A shadow map over the island, seen from above: for each texel, the ground
 * under it (the terrain only, so the ground beneath a bridge or ramp is what gets the shadow), then a few
 * rays toward the sun (a small sun disc, for soft edges) against the terrain *and* every placed model.
 * The fraction that reach the sun is the texel's sunlight, 0 (shadow) .. 1 (full sun). The ground shader
 * dims only direct light with it, so shadows keep their sky light.
 *
 * Pure: triangles in, a Uint8Array out. Runs in a worker (sun-bake-worker.ts) behind the bake window.
 */
import { TriangleGrid } from '../bake/vertex-baker';

export interface SunBakeInput {
  /** World triangles, packed as the vertex baker packs them: origin, edge 1, edge 2 (9 numbers each). */
  terrain: Float64Array;
  /** The placed models' world triangles (they cast shadows; the map is not drawn on them). */
  casters: Float64Array;
  /** Towards the sun (normalised). */
  sunDir: [number, number, number];
  /** The square the map covers: centred on the island, `half` world units each way. */
  half: number;
  res: number;
  /** Rays per texel toward the sun disc (1 = hard shadows). */
  samples?: number;
}

/** Concatenates packed triangle arrays. */
function joinTriangles(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length + b.length);
  out.set(a); out.set(b, a.length);
  return out;
}

export function bakeSunShadows(input: SunBakeInput, onProgress?: (done: number, total: number) => void): Uint8Array {
  const { res, half } = input;
  const samples = Math.max(1, input.samples ?? 4);
  const ground = new TriangleGrid(input.terrain);
  const all = new TriangleGrid(input.casters.length ? joinTriangles(input.terrain, input.casters) : input.terrain);
  const [sx, sy, sz] = input.sunDir;
  // A small disc of directions around the sun (0.8° across) for soft, natural shadow edges.
  const ux = Math.abs(sy) < 0.9 ? 0 : 1, uy = Math.abs(sy) < 0.9 ? 1 : 0;
  let ax = uy * sz, ay = -ux * sz, az = ux * sy - uy * sx;
  const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
  const bx = sy * az - sz * ay, by = sz * ax - sx * az, bz = sx * ay - sy * ax;
  const spread = Math.tan((0.8 * Math.PI) / 180);
  const dirs: number[][] = [];
  for (let k = 0; k < samples; k++) {
    const angle = (k / samples) * Math.PI * 2 + 0.4, r = samples === 1 ? 0 : spread * Math.sqrt((k + 0.5) / samples);
    const dx = sx + (ax * Math.cos(angle) + bx * Math.sin(angle)) * r;
    const dy = sy + (ay * Math.cos(angle) + by * Math.sin(angle)) * r;
    const dz = sz + (az * Math.cos(angle) + bz * Math.sin(angle)) * r;
    const l = Math.hypot(dx, dy, dz); dirs.push([dx / l, dy / l, dz / l]);
  }
  const top = 1e6;
  const texel = (2 * half) / res;
  // Lift off the surface before tracing to the sun, so a texel never shadows itself.
  const lift = Math.max(2, texel * 0.02);
  const out = new Uint8Array(res * res).fill(255);
  for (let py = 0; py < res; py++) {
    if (onProgress && py % 8 === 0) onProgress(py, res);
    for (let px = 0; px < res; px++) {
      const x = -half + (px + 0.5) * texel, z = -half + (py + 0.5) * texel;
      const t = ground.nearest(x, top, z, 0, -1, 0, top * 2);
      if (!Number.isFinite(t)) continue;
      const y = top - t + lift;
      let lit = 0;
      for (const d of dirs) if (!all.occluded(x, y, z, d[0], d[1], d[2], 1e6)) lit++;
      out[py * res + px] = Math.round((lit / samples) * 255);
    }
  }
  onProgress?.(res, res);
  return out;
}
