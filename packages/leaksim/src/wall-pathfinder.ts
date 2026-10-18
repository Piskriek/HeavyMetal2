// ============================================================================
// File: packages/leaksim/src/wall-pathfinder.ts
// TICKET-10 (Brief 30 / POL-32 & POL-33):
// - Deterministic 8-connected A* pathfinder & string-pulled waypoint selector
//   around navgrid walls and oriented Solid footprints (POL-32).
// - Exact segment-versus-oriented-box (OBB / AABB in local frame) bolt blocker
//   so spitter/flyer bolts stop on built walls (POL-33).
// Pure TypeScript: zero DOM, zero timers, zero external dependencies.
// ============================================================================

import type { P, Solid } from './index';

/**
 * Structural navigation grid matching `Nav` from `apps/web/src/base/navgrid.ts`.
 */
export interface NavGrid {
  readonly originX: number;
  readonly originZ: number;
  readonly cell: number;
  readonly grid: {
    readonly w: number;
    readonly h: number;
    blocked(gx: number, gz: number): boolean;
  };
}

export interface BoltHit {
  readonly blocked: boolean;
  /** Parametric hit distance along segment A -> B in [0, 1] (1 when unblocked). */
  readonly t: number;
  readonly x: number;
  readonly z: number;
  readonly solidIndex: number;
}

/**
 * Tests whether line segment A(ax, az) -> B(bx, bz) intersects an oriented box `solid`
 * inflated by `boltRadius` (POL-33).
 * Uses exact Liang-Barsky slab clipping in the solid's local (u, v) frame.
 */
export function segmentHitsSolid(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  solid: Solid,
  boltRadius = 0.08,
): { readonly hit: boolean; readonly t: number; readonly x: number; readonly z: number } {
  const r = Math.max(0, boltRadius);
  const hu = solid.hu + r;
  const hv = solid.hv + r;

  // Transform A and B into solid's local (u, v) frame
  const dax = ax - solid.x;
  const daz = az - solid.z;
  const u0 = dax * solid.ux + daz * solid.uz;
  const v0 = -dax * solid.uz + daz * solid.ux;

  const dbx = bx - solid.x;
  const dbz = bz - solid.z;
  const u1 = dbx * solid.ux + dbz * solid.uz;
  const v1 = -dbx * solid.uz + dbz * solid.ux;

  const du = u1 - u0;
  const dv = v1 - v0;

  let tMin = 0;
  let tMax = 1;

  // Slab check on u in [-hu, +hu]
  if (Math.abs(du) < 1e-9) {
    if (u0 < -hu || u0 > hu) {
      return { hit: false, t: 1, x: bx, z: bz };
    }
  } else {
    const invU = 1 / du;
    let t1 = (-hu - u0) * invU;
    let t2 = (hu - u0) * invU;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) {
      return { hit: false, t: 1, x: bx, z: bz };
    }
  }

  // Slab check on v in [-hv, +hv]
  if (Math.abs(dv) < 1e-9) {
    if (v0 < -hv || v0 > hv) {
      return { hit: false, t: 1, x: bx, z: bz };
    }
  } else {
    const invV = 1 / dv;
    let t1 = (-hv - v0) * invV;
    let t2 = (hv - v0) * invV;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) {
      return { hit: false, t: 1, x: bx, z: bz };
    }
  }

  const tHit = Math.max(0, Math.min(1, tMin));
  return {
    hit: true,
    t: tHit,
    x: ax + (bx - ax) * tHit,
    z: az + (bz - az) * tHit,
  };
}

/**
 * Checks a bolt segment A -> B against all built footprints `solids` (POL-33).
 * Returns the earliest impact along the segment.
 */
export function boltBlockedBySolids(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  solids: readonly Solid[],
  boltRadius = 0.08,
): BoltHit {
  let bestT = 1;
  let bestX = bx;
  let bestZ = bz;
  let bestIdx = -1;

  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!s) continue;
    const res = segmentHitsSolid(ax, az, bx, bz, s, boltRadius);
    if (res.hit && res.t <= bestT) {
      bestT = res.t;
      bestX = res.x;
      bestZ = res.z;
      bestIdx = i;
    }
  }

  return {
    blocked: bestIdx >= 0,
    t: bestT,
    x: bestX,
    z: bestZ,
    solidIndex: bestIdx,
  };
}

/**
 * Builds a deterministic `NavGrid` directly from `solids` around `center` when the caller
 * did not supply a pre-rasterised `NavGrid` (closing diagonal corner pinches just like `navFor`).
 */
export function navFromSolids(
  solids: readonly Solid[],
  center: P,
  radius = 32,
  cell = 0.5,
  agentRadius = 0.45,
): NavGrid {
  const w = Math.max(4, Math.ceil((2 * radius) / cell));
  const h = w;
  const originX = center.x - radius;
  const originZ = center.z - radius;
  const cells = new Uint8Array(w * h);
  const half = cell * 0.5;

  for (let sIdx = 0; sIdx < solids.length; sIdx++) {
    const s = solids[sIdx];
    if (!s) continue;
    const hu = s.hu + agentRadius;
    const hv = s.hv + agentRadius;
    const ax0 = s.ux;
    const ax1 = s.uz;
    const az0 = -s.uz;
    const az1 = s.ux;
    const ex = hu * Math.abs(ax0) + hv * Math.abs(az0);
    const ez = hu * Math.abs(ax1) + hv * Math.abs(az1);

    const g0 = Math.max(0, Math.floor((s.x - ex - originX) / cell));
    const g1 = Math.min(w - 1, Math.floor((s.x + ex - originX) / cell));
    const k0 = Math.max(0, Math.floor((s.z - ez - originZ) / cell));
    const k1 = Math.min(h - 1, Math.floor((s.z + ez - originZ) / cell));

    for (let gz = k0; gz <= k1; gz++) {
      for (let gx = g0; gx <= g1; gx++) {
        const cx = originX + (gx + 0.5) * cell - s.x;
        const cz = originZ + (gz + 0.5) * cell - s.z;
        if (Math.abs(cx) >= half + ex - 1e-9 || Math.abs(cz) >= half + ez - 1e-9) continue;
        const pa = Math.abs(cx * ax0 + cz * ax1);
        const ra = half * (Math.abs(ax0) + Math.abs(ax1));
        const pb = Math.abs(cx * az0 + cz * az1);
        const rb = half * (Math.abs(az0) + Math.abs(az1));
        if (pa >= hu + ra - 1e-9 || pb >= hv + rb - 1e-9) continue;
        cells[gz * w + gx] = 1;
      }
    }
  }

  // Close diagonal pinches so agents never clip diagonally through corner-touching wall cells
  for (let changed = true; changed; ) {
    changed = false;
    for (let gz = 0; gz + 1 < h; gz++) {
      for (let gx = 0; gx + 1 < w; gx++) {
        const a = cells[gz * w + gx];
        const b = cells[gz * w + gx + 1];
        const c = cells[(gz + 1) * w + gx];
        const d = cells[(gz + 1) * w + gx + 1];
        if ((a && d && !b && !c) || (b && c && !a && !d)) {
          cells[gz * w + gx + (a ? 1 : 0)] = 1;
          changed = true;
        }
      }
    }
  }

  return {
    originX,
    originZ,
    cell,
    grid: {
      w,
      h,
      blocked: (gx, gz) => gx < 0 || gz < 0 || gx >= w || gz >= h || cells[gz * w + gx] === 1,
    },
  };
}

function worldToCell(nav: NavGrid, p: P): { readonly gx: number; readonly gz: number } {
  const { w, h } = nav.grid;
  const gx = Math.max(0, Math.min(w - 1, Math.floor((p.x - nav.originX) / nav.cell)));
  const gz = Math.max(0, Math.min(h - 1, Math.floor((p.z - nav.originZ) / nav.cell)));
  return { gx, gz };
}

function cellToWorld(nav: NavGrid, gx: number, gz: number): P {
  return {
    x: nav.originX + (gx + 0.5) * nav.cell,
    z: nav.originZ + (gz + 0.5) * nav.cell,
  };
}

function findNearestOpenCell(
  nav: NavGrid,
  startGx: number,
  startGz: number,
  maxRing = 12,
): { readonly gx: number; readonly gz: number } | null {
  const { w, h } = nav.grid;
  if (!nav.grid.blocked(startGx, startGz)) {
    return { gx: startGx, gz: startGz };
  }
  for (let r = 1; r <= maxRing; r++) {
    let bestGx = -1;
    let bestGz = -1;
    let bestDistSq = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const nx = startGx + dx;
        const nz = startGz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        if (nav.grid.blocked(nx, nz)) continue;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestGx = nx;
          bestGz = nz;
        }
      }
    }
    if (bestGx >= 0) return { gx: bestGx, gz: bestGz };
  }
  return null;
}

/**
 * Checks whether the straight line between grid cells (x0, z0) and (x1, z1) is completely unblocked in `nav`.
 */
export function gridLineClear(nav: NavGrid, x0: number, z0: number, x1: number, z1: number): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const steps = Math.max(Math.abs(dx), Math.abs(dz)) * 2;
  if (steps === 0) return !nav.grid.blocked(x0, z0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const gx = Math.round(x0 + dx * t);
    const gz = Math.round(z0 + dz * t);
    if (nav.grid.blocked(gx, gz)) return false;
  }
  return true;
}

const DIRS_8: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

function octileHeuristic(gx: number, gz: number, tx: number, tz: number): number {
  const dx = Math.abs(tx - gx);
  const dz = Math.abs(tz - gz);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

/**
 * Deterministic 8-connected A* pathfinder with line-of-sight string-pulling on `NavGrid` (POL-32).
 * Returns world-space waypoints from `from` to `to` (excluding `from`, ending at `to` or the closest reachable point).
 */
export function findPathAroundWalls(
  nav: NavGrid,
  from: P,
  to: P,
  maxExpanded = 2048,
): readonly P[] {
  const { w, h } = nav.grid;
  const total = w * h;
  if (total <= 0) return [to];

  const rawStart = worldToCell(nav, from);
  const rawGoal = worldToCell(nav, to);

  const start = findNearestOpenCell(nav, rawStart.gx, rawStart.gz);
  const goal = findNearestOpenCell(nav, rawGoal.gx, rawGoal.gz);
  if (!start || !goal) return [to];

  if (start.gx === goal.gx && start.gz === goal.gz) {
    return [to];
  }

  // Fast path: if grid line-of-sight is already open, go straight to goal
  if (gridLineClear(nav, start.gx, start.gz, goal.gx, goal.gz)) {
    return [
      goal.gx === rawGoal.gx && goal.gz === rawGoal.gz
        ? to
        : cellToWorld(nav, goal.gx, goal.gz),
    ];
  }

  const gScore = new Float64Array(total);
  gScore.fill(Number.POSITIVE_INFINITY);
  const fScore = new Float64Array(total);
  fScore.fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const closed = new Uint8Array(total);

  // Binary min-heap of cell indices ordered by (fScore, cellIndex) for strict determinism
  const heap: number[] = [];
  const inHeap = new Uint8Array(total);

  const less = (a: number, b: number): boolean => {
    const fa = fScore[a]!;
    const fb = fScore[b]!;
    return Math.abs(fa - fb) > 1e-9 ? fa < fb : a < b;
  };

  const pushHeap = (idx: number): void => {
    heap.push(idx);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(heap[i]!, heap[p]!)) {
        const tmp = heap[i]!;
        heap[i] = heap[p]!;
        heap[p] = tmp;
        i = p;
      } else {
        break;
      }
    }
  };

  const popHeap = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const n = heap.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < n && less(heap[l]!, heap[smallest]!)) smallest = l;
        if (r < n && less(heap[r]!, heap[smallest]!)) smallest = r;
        if (smallest !== i) {
          const tmp = heap[i]!;
          heap[i] = heap[smallest]!;
          heap[smallest] = tmp;
          i = smallest;
        } else {
          break;
        }
      }
    }
    return top;
  };

  const startIdx = start.gz * w + start.gx;
  const goalIdx = goal.gz * w + goal.gx;

  gScore[startIdx] = 0;
  fScore[startIdx] = octileHeuristic(start.gx, start.gz, goal.gx, goal.gz);
  pushHeap(startIdx);
  inHeap[startIdx] = 1;

  let bestIdx = startIdx;
  let bestH = fScore[startIdx]!;
  let expanded = 0;

  while (heap.length > 0 && expanded < maxExpanded) {
    const current = popHeap();
    inHeap[current] = 0;
    if (closed[current]) continue;
    closed[current] = 1;
    expanded++;

    if (current === goalIdx) {
      bestIdx = current;
      break;
    }

    const cx = current % w;
    const cz = (current - cx) / w;
    const curH = octileHeuristic(cx, cz, goal.gx, goal.gz);
    if (curH < bestH - 1e-6) {
      bestH = curH;
      bestIdx = current;
    }

    const curG = gScore[current]!;
    for (let d = 0; d < DIRS_8.length; d++) {
      const [dx, dz, stepCost] = DIRS_8[d]!;
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const nIdx = nz * w + nx;
      if (closed[nIdx] || nav.grid.blocked(nx, nz)) continue;

      // Prevent diagonal corner cutting
      if (dx !== 0 && dz !== 0) {
        if (nav.grid.blocked(cx + dx, cz) || nav.grid.blocked(cx, cz + dz)) {
          continue;
        }
      }

      const tentativeG = curG + stepCost;
      if (tentativeG + 1e-9 < gScore[nIdx]!) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + octileHeuristic(nx, nz, goal.gx, goal.gz);
        if (!inHeap[nIdx]) {
          pushHeap(nIdx);
          inHeap[nIdx] = 1;
        }
      }
    }
  }

  if (bestIdx === startIdx) {
    return [to];
  }

  // Reconstruct grid path
  const rawCells: { readonly gx: number; readonly gz: number }[] = [];
  let cur = bestIdx;
  while (cur !== -1 && cur !== startIdx) {
    const gx = cur % w;
    const gz = (cur - gx) / w;
    rawCells.push({ gx, gz });
    cur = cameFrom[cur]!;
  }
  rawCells.reverse();

  // String-pull (smooth) the grid path so walkers head straight toward the furthest visible corner
  const smoothed: P[] = [];
  let anchorGx = start.gx;
  let anchorGz = start.gz;
  let idx = 0;

  while (idx < rawCells.length) {
    let furthest = idx;
    for (let probe = rawCells.length - 1; probe > idx; probe--) {
      const cand = rawCells[probe]!;
      if (gridLineClear(nav, anchorGx, anchorGz, cand.gx, cand.gz)) {
        furthest = probe;
        break;
      }
    }
    const chosen = rawCells[furthest]!;
    if (
      furthest === rawCells.length - 1 &&
      bestIdx === goalIdx &&
      goal.gx === rawGoal.gx &&
      goal.gz === rawGoal.gz
    ) {
      smoothed.push(to);
    } else {
      smoothed.push(cellToWorld(nav, chosen.gx, chosen.gz));
    }
    anchorGx = chosen.gx;
    anchorGz = chosen.gz;
    idx = furthest + 1;
  }

  return smoothed.length > 0 ? smoothed : [to];
}

/**
 * Returns the immediate next waypoint `{ x, z }` for a ground monster of `radius`
 * routing from `from` toward `to` around `nav` and `solids` (POL-32).
 */
export function nextWaypointAroundWalls(
  from: P,
  to: P,
  solids: readonly Solid[],
  radius = 0.7,
  nav?: NavGrid,
): P {
  // Fast check: if the straight line is clear of all inflated solids, walk straight to `to`
  const direct = boltBlockedBySolids(from.x, from.z, to.x, to.z, solids, radius + 0.05);
  if (!direct.blocked && !nav) {
    return to;
  }
  if (!direct.blocked && nav) {
    const c0 = worldToCell(nav, from);
    const c1 = worldToCell(nav, to);
    if (gridLineClear(nav, c0.gx, c0.gz, c1.gx, c1.gz)) {
      return to;
    }
  }

  const mid: P = { x: (from.x + to.x) * 0.5, z: (from.z + to.z) * 0.5 };
  const span = Math.max(24, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) * 0.75) + 8);
  const activeNav = nav ?? navFromSolids(solids, mid, span, 0.5, radius * 0.65);
  const path = findPathAroundWalls(activeNav, from, to);
  for (let i = 0; i < path.length; i++) {
    const wp = path[i]!;
    if (Math.hypot(wp.x - from.x, wp.z - from.z) > 0.2) {
      return wp;
    }
  }
  return path[path.length - 1] ?? to;
}
