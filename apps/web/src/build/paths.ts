import { carve, centreline, type Vec2 } from '@hm/splineroad';
import { hydraulic, thermal } from '@hm/erosion';
import type { DirtyRect, Terrain } from '@hm/terrain';

/**
 * Roads, rivers and rain on the ground (the Terrain tab, F10): what each does to a terrain, as new heights and the rectangle that changed
 * (the island applies them as one undo step). A road is level along its length and gets a dirt surface; a river cuts a channel that never
 * runs uphill and gets a mud bed; rain wears gullies round a point and washes soil into the hollows.
 */
export const ROAD_SURFACE = 16; // soil
export const RIVER_SURFACE = 9; // mud

const distToLine = (line: readonly Vec2[], x: number, z: number): number => {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, b = line[i]!;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
    const u = L > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)) : 0;
    best = Math.min(best, Math.hypot(x - (a[0] + u * dx), z - (a[1] + u * dz)));
  }
  return best;
};

/** A road or a river along the points: new heights, the cells to paint, and the rectangle that changed (null: nothing would change). */
export function carvePath(t: Terrain, points: readonly Vec2[], kind: 'road' | 'river', width: number): { heights: Float32Array; paint: number[]; rect: DirtyRect } | null {
  const s = t.spec;
  const out = carve({ cols: s.cols, rows: s.rows, cell: s.cell, originX: s.originX, originZ: s.originZ, heights: t.heights },
    { points: [...points], width, shoulder: width * 0.75, depth: kind === 'river' ? 1.2 : 0, kind, smooth: true });
  if (!out.rect) return null;
  // the surface: every sample within the road's half width
  const line = centreline([...points], true, s.cell / 2);
  const paint: number[] = [];
  for (let r = out.rect.r0; r <= out.rect.r1; r++) for (let c = out.rect.c0; c <= out.rect.c1; c++) {
    if (distToLine(line, s.originX + c * s.cell, s.originZ + r * s.cell) <= width / 2) paint.push(r * s.cols + c);
  }
  return { heights: out.heights, paint, rect: out.rect };
}

/** The path as it will be drawn while you click its points (for the overlay). */
export const pathPreview = (points: readonly Vec2[]): Vec2[] => (points.length < 2 ? [...points] : centreline([...points], true, 0.5));

/** Rain round (x, z): `radius` metres, `strength` 0..1. New heights (blended into the ground towards the edge) and the rectangle. */
export function rainOn(t: Terrain, x: number, z: number, radius: number, strength: number, seed: number): { heights: Float32Array; rect: DirtyRect } | null {
  const s = t.spec;
  const c0 = Math.max(0, Math.floor((x - radius - s.originX) / s.cell)), c1 = Math.min(s.cols - 1, Math.ceil((x + radius - s.originX) / s.cell));
  const r0 = Math.max(0, Math.floor((z - radius - s.originZ) / s.cell)), r1 = Math.min(s.rows - 1, Math.ceil((z + radius - s.originZ) / s.cell));
  const wc = c1 - c0 + 1, wr = r1 - r0 + 1;
  if (wc < 3 || wr < 3) return null;
  const win = new Float32Array(wc * wr);
  for (let r = 0; r < wr; r++) for (let c = 0; c < wc; c++) win[c + r * wc] = t.heights[(r0 + r) * s.cols + c0 + c]!;
  const field = { cols: wc, rows: wr, cell: s.cell, heights: win };
  const slumped = thermal(field, 8, 0.9 * s.cell, 0.5);
  const washed = hydraulic({ ...field, heights: slumped }, Math.round(wc * wr * (0.2 + 0.8 * Math.max(0, Math.min(1, strength)))), seed);
  const out = t.heights.slice();
  for (let r = 0; r < wr; r++) for (let c = 0; c < wc; c++) {
    const px = s.originX + (c0 + c) * s.cell, pz = s.originZ + (r0 + r) * s.cell;
    const d = Math.hypot(px - x, pz - z) / radius;
    if (d >= 1) continue;
    const w = d < 0.5 ? 1 : 1 - (d - 0.5) / 0.5; // full in the middle, fading out over the outer half
    const i = (r0 + r) * s.cols + c0 + c;
    out[i] = t.heights[i]! + (washed[c + r * wc]! - t.heights[i]!) * w * w * (3 - 2 * w);
  }
  return { heights: out, rect: { c0, r0, c1, r1 } };
}
