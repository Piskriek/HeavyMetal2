import { decodeModel, encodeModel, type VoxelModel } from '@hm/voxel';

/**
 * Pointing at a placed thing's blocks (F2 paint a thing, F3 carve): the ray walked cell by cell through the thing's voxel grid in its own
 * space (moved, turned by its yaw, sized by its scale, its pivot at its origin), the first filled cell and the face it came in through.
 * A model is drawn with cell (x, y, z) spanning (x - pivot .. x + 1 - pivot) * scale, turned round y by yaw (three.js: x' = x cos + z sin,
 * z' = -x sin + z cos), then moved to the thing's position.
 */
export type V3 = [number, number, number];
export interface ThingPose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number }
export interface VoxelHit { readonly cell: V3; readonly normal: V3; readonly t: number }

const index = (m: VoxelModel, x: number, y: number, z: number): number => x + m.size[0] * (y + m.size[1] * z);
export const cellAt = (m: VoxelModel, x: number, y: number, z: number): number =>
  x < 0 || y < 0 || z < 0 || x >= m.size[0] || y >= m.size[1] || z >= m.size[2] ? 0 : m.cells[index(m, x, y, z)] ?? 0;

/** A world point in the model's cell coordinates. */
export function toCells(p: ThingPose, m: VoxelModel, w: V3): V3 {
  const a = (p.yaw * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = (w[0] - p.x) / p.scale, dy = (w[1] - p.y) / p.scale, dz = (w[2] - p.z) / p.scale;
  // the inverse turn
  return [dx * c - dz * s + m.pivot[0], dy + m.pivot[1], dx * s + dz * c + m.pivot[2]];
}
const dirToCells = (p: ThingPose, d: V3): V3 => {
  const a = (p.yaw * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [(d[0] * c - d[2] * s) / p.scale, d[1] / p.scale, (d[0] * s + d[2] * c) / p.scale];
};

/** The first filled cell along the ray (Amanatides and Woo), or null. */
export function hitModel(p: ThingPose, m: VoxelModel, origin: V3, dir: V3): VoxelHit | null {
  const o = toCells(p, m, origin), d = dirToCells(p, dir);
  // enter the grid's box first
  let tEnter = 0, tExit = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]!) < 1e-12) { if (o[k]! < 0 || o[k]! > m.size[k]!) return null; continue; }
    const t0 = (0 - o[k]!) / d[k]!, t1 = (m.size[k]! - o[k]!) / d[k]!;
    tEnter = Math.max(tEnter, Math.min(t0, t1)); tExit = Math.min(tExit, Math.max(t0, t1));
  }
  if (tEnter > tExit) return null;
  const start: V3 = [o[0] + d[0] * (tEnter + 1e-6), o[1] + d[1] * (tEnter + 1e-6), o[2] + d[2] * (tEnter + 1e-6)];
  const cell: V3 = [Math.min(m.size[0] - 1, Math.max(0, Math.floor(start[0]))), Math.min(m.size[1] - 1, Math.max(0, Math.floor(start[1]))), Math.min(m.size[2] - 1, Math.max(0, Math.floor(start[2])))];
  const step: V3 = [Math.sign(d[0]), Math.sign(d[1]), Math.sign(d[2])];
  const tMax: V3 = [0, 0, 0], tDelta: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    if (step[k] === 0) { tMax[k] = Infinity; tDelta[k] = Infinity; continue; }
    const edge = step[k]! > 0 ? cell[k]! + 1 : cell[k]!;
    tMax[k] = tEnter + (edge - start[k]!) / d[k]!;
    tDelta[k] = Math.abs(1 / d[k]!);
  }
  let normal: V3 = [0, 0, 0];
  // the face it came in through, for the first cell: the axis it entered on
  { let best = 0, k0 = 0; for (let k = 0; k < 3; k++) { if (Math.abs(d[k]!) < 1e-12) continue; const t0 = (0 - o[k]!) / d[k]!, t1 = (m.size[k]! - o[k]!) / d[k]!; const tk = Math.min(t0, t1); if (tk >= best) { best = tk; k0 = k; } } normal = [0, 0, 0]; normal[k0] = -step[k0]!; }
  for (let i = 0; i < m.size[0] + m.size[1] + m.size[2] + 3; i++) {
    if (cellAt(m, cell[0], cell[1], cell[2]) > 0) return { cell: [cell[0], cell[1], cell[2]], normal, t: tEnter };
    const k = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
    cell[k] += step[k]!;
    if (cell[k]! < 0 || cell[k]! >= m.size[k]!) return null;
    tEnter = tMax[k]!; tMax[k] += tDelta[k]!;
    normal = [0, 0, 0]; normal[k] = -step[k]!;
  }
  return null;
}

/** The nearest placed thing whose blocks the ray meets, with its model (decoded once per data string) and the hit. */
export function hitThings(things: readonly { readonly ref: string; readonly pose: ThingPose; readonly data: string }[], origin: V3, dir: V3, cache: Map<string, VoxelModel | null>):
  { ref: string; model: VoxelModel; hit: VoxelHit } | null {
  let best: { ref: string; model: VoxelModel; hit: VoxelHit; tw: number } | null = null;
  for (const t of things) {
    let m = cache.get(t.data);
    if (m === undefined) { m = decodeModel(t.data).model; cache.set(t.data, m); }
    if (!m) continue;
    const h = hitModel(t.pose, m, origin, dir);
    if (!h) continue;
    // the direction was scaled into cells with the point, so t is the same distance along the world ray
    const tw = h.t;
    if (!best || tw < best.tw) best = { ref: t.ref, model: m, hit: h, tw };
  }
  return best ? { ref: best.ref, model: best.model, hit: best.hit } : null;
}

/** The model with every cell of one material recoloured (its palette entry), as new data. `rgb` is 0..255; a palette keeps 0..1 (a model with more does not load). */
export function recolour(m: VoxelModel, material: number, rgb: V3): string {
  const unit = (c: number): number => Math.round(Math.min(1, Math.max(0, c / 255)) * 1000) / 1000;
  const palette = m.palette.map((p, i) => (i === material - 1 ? { ...p, color: [unit(rgb[0]), unit(rgb[1]), unit(rgb[2])] as V3 } : p));
  return encodeModel({ ...m, palette });
}

/** The model with a round hole dug (or a lump of clay added) at a cell, radius in cells, as new data; null if nothing changed. */
export function sculptBlocks(m: VoxelModel, at: V3, radius: number, add: boolean, material: number): string | null {
  const cells = m.cells.slice();
  let changed = 0;
  const r = Math.max(0.5, radius);
  for (let z = Math.floor(at[2] - r); z <= Math.ceil(at[2] + r); z++) for (let y = Math.floor(at[1] - r); y <= Math.ceil(at[1] + r); y++) for (let x = Math.floor(at[0] - r); x <= Math.ceil(at[0] + r); x++) {
    if (x < 0 || y < 0 || z < 0 || x >= m.size[0] || y >= m.size[1] || z >= m.size[2]) continue;
    if (Math.hypot(x + 0.5 - at[0], y + 0.5 - at[1], z + 0.5 - at[2]) > r) continue;
    const i = index(m, x, y, z);
    if (add ? cells[i] !== 0 : cells[i] === 0) continue;
    cells[i] = add ? material : 0;
    changed++;
  }
  return changed ? encodeModel({ ...m, cells }) : null;
}
