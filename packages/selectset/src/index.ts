/**
 * Screen-space selection maths for a small 3D editor.
 *
 * Everything here works on already-projected data: `centre` and `bounds` are
 * screen pixels, `depth` is metres from the camera. Nothing mutates its inputs,
 * every returned id list follows the order of `items` and contains no
 * duplicates, and locked items are invisible to every function in this module.
 */

/** A point on screen, in pixels. */
export type Pt = [number, number];

export interface Item {
  /** Stable identity, unique within a scene snapshot. */
  id: string;
  /** Projected centre, in screen pixels. */
  centre: Pt;
  /** Screen bounds: minX, minY, maxX, maxY. */
  bounds: [number, number, number, number];
  /** Metres from the camera; smaller is nearer. */
  depth: number;
  /** Object kind, e.g. 'prop', 'light', 'character', 'trigger'. */
  kind: string;
  /** Items sharing a group select together. */
  group?: string;
  /** Locked items are never selected by any function here. */
  locked?: boolean;
}

export interface Query {
  /** Keep only this kind; 'all' or undefined means any kind. */
  filter?: string;
  /** Drop items deeper (farther) than this many metres. */
  maxDepth?: number;
}

export type Combine = 'replace' | 'add' | 'subtract' | 'toggle';

const ANY_KIND = 'all';

/** The lock/query gate every selectable item has to pass. */
function usable(item: Item, q?: Query): boolean {
  if (item.locked === true) return false;
  const filter = q?.filter;
  if (filter !== undefined && filter !== ANY_KIND && item.kind !== filter) return false;
  const maxDepth = q?.maxDepth;
  if (maxDepth !== undefined && item.depth > maxDepth) return false;
  return true;
}

/** Normalise two corner points into minX, minY, maxX, maxY. */
function rectOf(a: Pt, b: Pt): [number, number, number, number] {
  const minX = a[0] < b[0] ? a[0] : b[0];
  const minY = a[1] < b[1] ? a[1] : b[1];
  const maxX = a[0] < b[0] ? b[0] : a[0];
  const maxY = a[1] < b[1] ? b[1] : a[1];
  return [minX, minY, maxX, maxY];
}

function findById(items: readonly Item[], id: string): Item | undefined {
  for (const item of items) {
    if (item.id === id) return item;
  }
  return undefined;
}

/** First occurrence wins; order of the input is preserved. */
function unique(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Items in the rectangle a..b (any corner order).
 * 'enclosed': the whole bounds inside; 'touch': the bounds overlap it (edges count).
 */
export function boxSelect(
  items: readonly Item[],
  a: Pt,
  b: Pt,
  mode: 'enclosed' | 'touch',
  q?: Query,
): string[] {
  const rect = rectOf(a, b);
  const out: string[] = [];
  for (const item of items) {
    if (!usable(item, q)) continue;
    const bd = item.bounds;
    const hit =
      mode === 'enclosed'
        ? bd[0] >= rect[0] && bd[1] >= rect[1] && bd[2] <= rect[2] && bd[3] <= rect[3]
        : bd[0] <= rect[2] && bd[2] >= rect[0] && bd[1] <= rect[3] && bd[3] >= rect[1];
    if (hit) out.push(item.id);
  }
  return out;
}

/** Even-odd (crossing number) containment test. Fewer than three vertices: false. */
export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  const px = p[0];
  const py = p[1];
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const cur = poly[i];
    const prev = poly[j];
    if (cur === undefined || prev === undefined) continue;
    const xi = cur[0];
    const yi = cur[1];
    const xj = prev[0];
    const yj = prev[1];
    // The `yi > py !== yj > py` guard also rules out yi === yj, so no zero divide.
    if (!(yi > py !== yj > py)) continue;
    const xAt = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (px < xAt) inside = !inside;
  }
  return inside;
}

/** Items whose centre is inside the polygon (even-odd rule). */
export function lassoSelect(items: readonly Item[], poly: readonly Pt[], q?: Query): string[] {
  const out: string[] = [];
  if (poly.length < 3) return out;
  for (const item of items) {
    if (!usable(item, q)) continue;
    if (pointInPolygon(item.centre, poly)) out.push(item.id);
  }
  return out;
}

/**
 * The item under a click: the nearest (smallest depth) whose bounds contain the
 * point (edges count), passing the query; null if none. Ties go to the item
 * that comes first in `items`.
 */
export function pickAt(items: readonly Item[], p: Pt, q?: Query): string | null {
  let best: Item | null = null;
  for (const item of items) {
    if (!usable(item, q)) continue;
    const bd = item.bounds;
    const px = p[0];
    const py = p[1];
    if (px < bd[0] || px > bd[2] || py < bd[1] || py > bd[3]) continue;
    if (best === null || item.depth < best.depth) best = item;
  }
  return best === null ? null : best.id;
}

/**
 * Any selected member of a group brings in its whole group (unlocked members
 * only). Ids without a group stand for themselves. Order follows `items`.
 */
export function expandGroups(ids: readonly string[], items: readonly Item[]): string[] {
  const seeds = new Set<string>();
  const groups = new Set<string>();
  for (const id of ids) {
    if (seeds.has(id)) continue;
    const item = findById(items, id);
    if (item === undefined || item.locked === true) continue;
    seeds.add(id);
    const group = item.group;
    if (group !== undefined) groups.add(group);
  }
  const out: string[] = [];
  for (const item of items) {
    if (item.locked === true) continue;
    if (!seeds.has(item.id)) {
      const group = item.group;
      if (group === undefined || !groups.has(group)) continue;
    }
    out.push(item.id);
  }
  return out;
}

/**
 * replace: picked; add: current then new picked; subtract: current minus
 * picked; toggle: current minus picked-that-were-in, plus picked-that-were-not
 * (current order first, then new ones in picked order).
 */
export function combine(
  current: readonly string[],
  picked: readonly string[],
  how: Combine,
): string[] {
  const cur = unique(current);
  if (how === 'replace') return unique(picked);
  if (how === 'subtract') {
    const gone = new Set<string>(picked);
    return cur.filter((id) => !gone.has(id));
  }
  if (how === 'add') {
    const have = new Set<string>(cur);
    const extra = unique(picked).filter((id) => !have.has(id));
    return cur.concat(extra);
  }
  // toggle: keep the current ones that were not picked, then append the new ones.
  const pickedSet = new Set<string>(picked);
  const kept = cur.filter((id) => !pickedSet.has(id));
  const curSet = new Set<string>(cur);
  const added = unique(picked).filter((id) => !curSet.has(id));
  return kept.concat(added);
}

/**
 * Every unlocked item of the same kind (or the same group) as `id`, in items
 * order (including itself). An unknown id, or an ungrouped target when grouping
 * by 'group', yields an empty list.
 */
export function selectSimilar(items: readonly Item[], id: string, by: 'kind' | 'group'): string[] {
  const target = findById(items, id);
  if (target === undefined) return [];
  const key = by === 'kind' ? target.kind : target.group;
  if (key === undefined) return [];
  const out: string[] = [];
  for (const item of items) {
    if (item.locked === true) continue;
    const other = by === 'kind' ? item.kind : item.group;
    if (other !== key) continue;
    out.push(item.id);
  }
  return out;
}