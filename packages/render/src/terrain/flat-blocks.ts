import type { DirtyRectLike, TerrainLike } from './terrain-view';

/**
 * The flat (voxel) skin shows one colour per half-metre block, so which two surfaces a block mixes is the same for every pixel of it.
 * Working that out per pixel (gather four mask texels, wobble the border with noise, keep the two strongest) was the costliest part of
 * the ground shader on integrated graphics. It is baked here once per block on the CPU, and again only where a brush stroke changes the
 * mask; the shader reads one texel. Same algorithm as the PBR skin's per-pixel `islGather` in terrain-glsl.ts.
 */
export const FLAT_BLOCK = 0.5;
const MAX_BLOCKS = 2048;

/** Which world blocks the bake covers: block (x0 + u, z0 + v) is texel (u, v). */
export interface BlockGrid { readonly x0: number; readonly z0: number; readonly w: number; readonly h: number }

export function blockGridFor(spec: TerrainLike['spec']): BlockGrid {
  const x0 = Math.floor(spec.originX / FLAT_BLOCK), z0 = Math.floor(spec.originZ / FLAT_BLOCK);
  const x1 = Math.floor((spec.originX + (spec.cols - 1) * spec.cell) / FLAT_BLOCK);
  const z1 = Math.floor((spec.originZ + (spec.rows - 1) * spec.cell) / FLAT_BLOCK);
  return { x0, z0, w: Math.min(MAX_BLOCKS, x1 - x0 + 1), h: Math.min(MAX_BLOCKS, z1 - z0 + 1) };
}

const fract = (x: number): number => x - Math.floor(x);
function hash(x: number, y: number): number {
  let px = fract(x * 123.34), py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d; py += d;
  return fract(px * py);
}
/** Value noise, the same formula as `surfNoise` in the shader. */
export function surfNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy * (1 - ux) + (d - b) * ux * uy;
}

const ids = new Float64Array(8), ws = new Float64Array(8);
/**
 * The two strongest surfaces around node-space point (px, pz) (node c sits at px = c), and the second one's share.
 * Writes [a, b, share] into `out`.
 */
export function gatherSurfaces(t: TerrainLike, px: number, pz: number, out: Float64Array): void {
  const { cols, rows } = t.spec;
  const ix = Math.floor(px), iz = Math.floor(pz), fx = px - ix, fz = pz - iz;
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const ox = k & 1, oz = k >> 1;
    const c = Math.min(cols - 1, Math.max(0, ix + ox)), r = Math.min(rows - 1, Math.max(0, iz + oz));
    const i = r * cols + c;
    const bw = (ox ? fx : 1 - fx) * (oz ? fz : 1 - fz);
    const a = t.surfaceA[i]!, b = t.surfaceB[i]!, bl = t.blend[i]! / 255;
    for (let s = 0; s < 2; s++) {
      const id = s === 0 ? a : b;
      const w = a === b ? (s === 0 ? bw : 0) : s === 0 ? bw * (1 - bl) : bw * bl;
      if (w <= 0) continue;
      let j = 0;
      while (j < n && ids[j] !== id) j++;
      if (j < n) ws[j]! += w;
      else { ids[n] = id; ws[n] = w; n++; }
    }
  }
  if (n === 0) { out[0] = 0; out[1] = 0; out[2] = 0; return; }
  // the strongest, the earliest on a tie; then the strongest other one
  let ia = 0;
  for (let j = 1; j < n; j++) if (ws[j]! > ws[ia]!) ia = j;
  let ib = -1;
  for (let j = 0; j < n; j++) if (j !== ia && (ib < 0 || ws[j]! > ws[ib]!)) ib = j;
  out[0] = ids[ia]!;
  if (ib < 0) { out[1] = ids[ia]!; out[2] = 0; return; }
  out[1] = ids[ib]!;
  out[2] = ws[ib]! / Math.max(ws[ia]! + ws[ib]!, 1e-5);
}

/**
 * Bake the blocks inside the node rect `dirty` (all when null) into `out` (RGBA per block: surface a, surface b, share of b x 255).
 * Returns the block rows touched, so only those need uploading.
 */
export function bakeFlatBlocks(t: TerrainLike, grid: BlockGrid, out: Uint8Array, dirty: DirtyRectLike | null): { readonly v0: number; readonly v1: number } {
  const { cell, originX, originZ } = t.spec;
  // a block reads nodes up to one cell away and its border wobbles by up to 0.7 cells: widen the rect by two cells
  const toU = (c: number): number => Math.floor((originX + c * cell) / FLAT_BLOCK) - grid.x0;
  const toV = (r: number): number => Math.floor((originZ + r * cell) / FLAT_BLOCK) - grid.z0;
  const u0 = dirty ? Math.max(0, toU(dirty.c0 - 2)) : 0, u1 = dirty ? Math.min(grid.w - 1, toU(dirty.c1 + 2)) : grid.w - 1;
  const v0 = dirty ? Math.max(0, toV(dirty.r0 - 2)) : 0, v1 = dirty ? Math.min(grid.h - 1, toV(dirty.r1 + 2)) : grid.h - 1;
  const g = new Float64Array(3);
  for (let v = v0; v <= v1; v++) {
    const z = (grid.z0 + v) * FLAT_BLOCK + FLAT_BLOCK / 2;
    for (let u = u0; u <= u1; u++) {
      const x = (grid.x0 + u) * FLAT_BLOCK + FLAT_BLOCK / 2;
      const wx = (surfNoise(x / 9, z / 9) - 0.5) * 1.4, wz = (surfNoise(x / 9 + 19.7, z / 9 + 19.7) - 0.5) * 1.4;
      gatherSurfaces(t, (x - originX) / cell + wx, (z - originZ) / cell + wz, g);
      const o = (v * grid.w + u) * 4;
      out[o] = g[0]!; out[o + 1] = g[1]!; out[o + 2] = Math.round(g[2]! * 255); out[o + 3] = 255;
    }
  }
  return { v0, v1 };
}
