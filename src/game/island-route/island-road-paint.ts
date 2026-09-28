/**
 * ISLAND-ROUTE: auto paint on the island's road, drawn by the island ground.
 *
 * On the island there is no road ribbon to paint: the road is part of the terrain model. So the road's
 * paint lives in two layers the ground shader never has to know apart:
 *
 * 1. **The road mask** (`RoadMask`, 16 columns across × one row per 60 units along the island route),
 *    painted by the auto-paint rules exactly as on any other course: carriageway, shoulders, corner
 *    scree, ruts, patches, stage theme. Its job records ride with it, so the paint can be re-run.
 * 2. **The projection**: that mask laid onto the ground's top-down square along `islandTrackSpace()`.
 *    Walking the road in 20-unit steps along and across, each ground texel takes the road texel nearest
 *    its centre. Where the course passes over itself (a bridge, a platform track), the terrain under
 *    the road point must be within `ROAD_HEIGHT_TOLERANCE` of the road, or the pixel is left alone —
 *    the same rule the prototype's road fill used, so a deck never paints the valley under it.
 *
 * The ground shows `compose(hand, projection)`: the hand-painted texel with the road laid over it,
 * using the same "raise the share, never past it" law as the rules, so an unpainted road texel leaves
 * the brush's paint showing and re-projecting never darkens anything twice. The projection is derived
 * data (rebuilt in a few milliseconds from the road mask), so undoing an auto pass is just undo on the
 * road mask, then a re-projection.
 *
 * Pure TypeScript: no three.js, no DOM.
 */
import type { TrackSpaceMap } from '../track-space';
import type { RoadMask } from '../surface/road-mask';

/** How far the terrain may be from the road point (world units) for the paint to land on it. */
export const ROAD_HEIGHT_TOLERANCE = 400;
/** Step along and across the road while projecting (world units; a ground texel is ~47). */
export const ROAD_PROJECT_STEP = 20;

/** A projected road texel: id0 | id1 << 8 | weight << 16. */
export type PackedTexel = number;
export const packTexel = (id0: number, id1: number, weight: number): PackedTexel => id0 | (id1 << 8) | (weight << 16);

export interface GroundSquare {
  /** Texels across the square. */
  readonly res: number;
  /** Half the square's side, world units, centred on the origin. */
  readonly half: number;
}

/**
 * Where the road lies on the ground square, whatever is painted on it: for each ground texel the road
 * runs over (and whose terrain meets the road), the road-mask row and column nearest its centre. The
 * expensive part (a frame and a terrain height per 20-unit step), done once per route and terrain;
 * laying a paint job down is then one lookup per texel (`projectFootprint`).
 */
export interface RoadFootprint {
  /** Ground texel indices, and the road texel (row, column) each one shows. */
  readonly index: Int32Array;
  readonly row: Int32Array;
  readonly col: Uint8Array;
  /** The road-mask shape it was built for. */
  readonly across: number;
  readonly rows: number;
}

export function buildRoadFootprint(
  road: Pick<RoadMask, 'across' | 'rows' | 'length' | 'rowAt'>,
  map: TrackSpaceMap,
  heightAt: (x: number, z: number) => number | null,
  square: GroundSquare,
  opts: { tolerance?: number; step?: number } = {},
): RoadFootprint {
  const tol = opts.tolerance ?? ROAD_HEIGHT_TOLERANCE;
  const step = opts.step ?? ROAD_PROJECT_STEP;
  const perTexel = (2 * square.half) / square.res;
  const best = new Map<number, { d: number; row: number; col: number }>();
  const length = Math.min(map.length, road.length);
  for (let s = 0; s <= length; s += step) {
    const row = Math.min(road.rows - 1, Math.max(0, Math.floor(road.rowAt(s))));
    const f = map.frameAt(s);
    const half = f.halfWidth;
    for (let lat = -half + step / 2; lat < half; lat += step) {
      const x = f.pos.x + f.right.x * lat;
      const y = f.pos.y + f.right.y * lat;
      const z = f.pos.z + f.right.z * lat;
      const px = (x + square.half) / perTexel, pz = (z + square.half) / perTexel;
      const ix = Math.floor(px), iz = Math.floor(pz);
      if (ix < 0 || iz < 0 || ix >= square.res || iz >= square.res) continue;
      const index = iz * square.res + ix;
      const d = (px - ix - 0.5) ** 2 + (pz - iz - 0.5) ** 2;
      const prev = best.get(index);
      if (prev && prev.d <= d) continue;
      const ground = heightAt(x, z);
      if (ground === null || Math.abs(ground - y) > tol) continue;
      const u = (lat / half + 1) / 2;
      best.set(index, { d, row, col: Math.min(road.across - 1, Math.max(0, Math.floor(u * road.across))) });
    }
  }
  const index = new Int32Array(best.size), rows = new Int32Array(best.size), col = new Uint8Array(best.size);
  let k = 0;
  for (const [i, b] of best) { index[k] = i; rows[k] = b.row; col[k] = b.col; k++; }
  return { index, row: rows, col, across: road.across, rows: road.rows };
}

/** A road mask laid down along its footprint: texel index → packed road texel, painted texels only. */
export function projectFootprint(road: RoadMask, fp: RoadFootprint): Map<number, PackedTexel> {
  const out = new Map<number, PackedTexel>();
  if (road.across !== fp.across || road.rows !== fp.rows) return out;
  const d = road.mask.data;
  for (let k = 0; k < fp.index.length; k++) {
    const o = road.mask.index(fp.col[k], fp.row[k]);
    if (d[o] === 0 && d[o + 1] === 0) continue;
    out.set(fp.index[k], packTexel(d[o], d[o + 1], d[o + 2]));
  }
  return out;
}

/**
 * The road mask laid onto the ground square in one go (footprint + lay-down): texel index → packed road
 * texel. Only painted road texels are kept, so an unpainted road projects to an empty map.
 */
export function projectRoadMask(
  road: RoadMask,
  map: TrackSpaceMap,
  heightAt: (x: number, z: number) => number | null,
  square: GroundSquare,
  opts: { tolerance?: number; step?: number } = {},
): Map<number, PackedTexel> {
  return projectFootprint(road, buildRoadFootprint(road, map, heightAt, square, opts));
}

/**
 * Raise `surface`'s share of the texel at byte offset `i` to `t` (0‥1), never past it. The law the
 * auto-paint rules use (`paint-rules.ts` `writeTexel`), on a bare byte array.
 */
function raiseShare(data: Uint8Array, i: number, surface: number, t: number): void {
  const id0 = data[i], id1 = data[i + 1], w = data[i + 2];
  const target = Math.round(t * 255);
  if (target <= 0) return;
  if (target >= 255) { data[i] = surface; data[i + 1] = surface; data[i + 2] = 0; return; }
  const share = id0 === id1 ? (id0 === surface ? 255 : 0) : (id0 === surface ? 255 - w : 0) + (id1 === surface ? w : 0);
  if (share >= target) return;
  if (id0 === id1 || id1 === surface) { data[i + 1] = surface; data[i + 2] = target; }
  else if (id0 === surface) data[i + 2] = 255 - target;
  else if (w < 128) { data[i + 1] = surface; data[i + 2] = target; }
  else { data[i] = surface; data[i + 2] = 255 - target; }
}

/**
 * One ground texel as shown: the hand-painted bytes at `i` (copied into `out`), with the projected road
 * texel laid over them. Surface 0 in the road texel is "nothing painted here" and leaves the hand paint.
 */
export function composeTexel(hand: Uint8Array, out: Uint8Array, i: number, road: PackedTexel | undefined): void {
  out[i] = hand[i]; out[i + 1] = hand[i + 1]; out[i + 2] = hand[i + 2]; out[i + 3] = hand[i + 3];
  if (road === undefined) return;
  const id0 = road & 255, id1 = (road >> 8) & 255, w = (road >> 16) & 255;
  if (id0 === id1) { if (id0 !== 0) raiseShare(out, i, id0, 1); return; }
  if (id0 !== 0) raiseShare(out, i, id0, (255 - w) / 255);
  if (id1 !== 0) raiseShare(out, i, id1, w / 255);
}
