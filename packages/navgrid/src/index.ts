export interface Heights {
  cols: number;
  rows: number;
  cell: number;
  originX: number;
  originZ: number;
  heights: Float32Array;
}

export interface Box {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface NavOptions {
  sea: number;
  maxStep: number;
  costs?: { x: number; z: number; radius: number; cost: number }[];
}

export interface NavGrid {
  cols: number;
  rows: number;
  walkable: Uint8Array;
  cost: Float32Array;
  h: Heights;
}

const stepLimits = new WeakMap<NavGrid, number>();

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

interface HeapEntry {
  index: number;
  g: number;
  f: number;
  order: number;
}

function precedes(a: HeapEntry, b: HeapEntry): boolean {
  if (a.f !== b.f) return a.f < b.f;
  if (a.g !== b.g) return a.g > b.g;
  return a.order < b.order;
}

class MinHeap {
  private readonly values: HeapEntry[] = [];

  get size(): number {
    return this.values.length;
  }

  push(value: HeapEntry): void {
    let index = this.values.length;
    this.values.push(value);

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.values[parentIndex];
      if (parent === undefined || !precedes(value, parent)) break;
      this.values[index] = parent;
      index = parentIndex;
    }

    this.values[index] = value;
  }

  pop(): HeapEntry | undefined {
    const root = this.values[0];
    if (root === undefined) return undefined;

    const last = this.values.pop();
    if (last === undefined) return undefined;
    if (this.values.length === 0) return root;

    let index = 0;
    while (true) {
      const leftIndex = index * 2 + 1;
      if (leftIndex >= this.values.length) break;

      let childIndex = leftIndex;
      const left = this.values[leftIndex];
      if (left === undefined) break;

      const rightIndex = leftIndex + 1;
      if (rightIndex < this.values.length) {
        const right = this.values[rightIndex];
        if (right !== undefined && precedes(right, left)) {
          childIndex = rightIndex;
        }
      }

      const child = this.values[childIndex];
      if (child === undefined || !precedes(child, last)) break;
      this.values[index] = child;
      index = childIndex;
    }

    this.values[index] = last;
    return root;
  }
}

function indexOf(g: NavGrid, c: number, r: number): number {
  return c + r * g.cols;
}

function isWalkable(g: NavGrid, c: number, r: number): boolean {
  if (!Number.isInteger(c) || !Number.isInteger(r)) return false;
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false;
  return g.walkable[indexOf(g, c, r)] === 1;
}

function nearestWalkable(
  g: NavGrid,
  c: number,
  r: number,
): [number, number] | null {
  const startC = Math.round(c);
  const startR = Math.round(r);

  if (isWalkable(g, startC, startR)) return [startC, startR];

  let best: [number, number] | null = null;
  let bestDistance = Infinity;

  for (let dr = -3; dr <= 3; dr += 1) {
    for (let dc = -3; dc <= 3; dc += 1) {
      const distance = dc * dc + dr * dr;
      if (distance > 9 || distance >= bestDistance) continue;

      const candidateC = startC + dc;
      const candidateR = startR + dr;
      if (!isWalkable(g, candidateC, candidateR)) continue;

      bestDistance = distance;
      best = [candidateC, candidateR];
    }
  }

  return best;
}

function canMove(
  g: NavGrid,
  c: number,
  r: number,
  dc: number,
  dr: number,
  maxStep: number,
): boolean {
  const nextC = c + dc;
  const nextR = r + dr;

  if (!isWalkable(g, nextC, nextR)) return false;

  if (
    dc !== 0 &&
    dr !== 0 &&
    (!isWalkable(g, c + dc, r) || !isWalkable(g, c, r + dr))
  ) {
    return false;
  }

  const fromHeight = g.h.heights[indexOf(g, c, r)];
  const toHeight = g.h.heights[indexOf(g, nextC, nextR)];
  if (fromHeight === undefined || toHeight === undefined) return false;

  return Math.abs(fromHeight - toHeight) <= maxStep;
}

function heuristic(c: number, r: number, goalC: number, goalR: number): number {
  const dx = Math.abs(goalC - c);
  const dr = Math.abs(goalR - r);
  const diagonal = Math.min(dx, dr);
  return Math.max(dx, dr) + (Math.SQRT2 - 1) * diagonal;
}

function tracePath(
  g: NavGrid,
  startIndex: number,
  goalIndex: number,
  previous: Int32Array,
): [number, number][] | null {
  const reversed: number[] = [];
  let current = goalIndex;

  while (current !== startIndex) {
    reversed.push(current);
    const parent = previous[current];
    if (parent === undefined || parent < 0 || reversed.length > previous.length) {
      return null;
    }
    current = parent;
  }

  reversed.push(startIndex);

  const path: [number, number][] = [];
  for (let i = reversed.length - 1; i >= 0; i -= 1) {
    const index = reversed[i];
    if (index !== undefined) {
      path.push([index % g.cols, Math.floor(index / g.cols)]);
    }
  }

  return path;
}

export function build(
  h: Heights,
  boxes: readonly Box[],
  o: NavOptions,
): NavGrid {
  const length = h.cols * h.rows;
  const walkable = new Uint8Array(length);
  const cost = new Float32Array(length);
  cost.fill(1);

  for (let r = 0; r < h.rows; r += 1) {
    for (let c = 0; c < h.cols; c += 1) {
      const index = c + r * h.cols;
      const height = h.heights[index];
      const x = h.originX + c * h.cell;
      const z = h.originZ + r * h.cell;
      let blocked = false;

      for (const box of boxes) {
        if (
          x >= box.minX &&
          x <= box.maxX &&
          z >= box.minZ &&
          z <= box.maxZ
        ) {
          blocked = true;
          break;
        }
      }

      walkable[index] =
        height !== undefined && height >= o.sea && !blocked ? 1 : 0;
    }
  }

  for (const area of o.costs ?? []) {
    if (!(area.cost >= 1) || !(area.radius >= 0)) continue;
    const radiusSquared = area.radius * area.radius;

    for (let r = 0; r < h.rows; r += 1) {
      for (let c = 0; c < h.cols; c += 1) {
        const x = h.originX + c * h.cell;
        const z = h.originZ + r * h.cell;
        const dx = x - area.x;
        const dz = z - area.z;

        if (dx * dx + dz * dz <= radiusSquared) {
          const index = c + r * h.cols;
          cost[index] = (cost[index] ?? 1) * area.cost;
        }
      }
    }
  }

  const grid: NavGrid = { cols: h.cols, rows: h.rows, walkable, cost, h };
  stepLimits.set(grid, o.maxStep);
  return grid;
}

/**
 * A* over the 8 neighbours. Diagonals require both side cells to be walkable.
 * Endpoints snap to the nearest walkable cell within 3 cells.
 */
export function findPath(
  g: NavGrid,
  from: [number, number],
  to: [number, number],
  maxNodes = 20000,
): [number, number][] | null {
  const start = nearestWalkable(g, from[0], from[1]);
  const goal = nearestWalkable(g, to[0], to[1]);
  if (start === null || goal === null) return null;

  const limit = Math.floor(maxNodes);
  if (Number.isNaN(limit) || limit <= 0) return null;

  const startIndex = indexOf(g, start[0], start[1]);
  const goalIndex = indexOf(g, goal[0], goal[1]);
  const size = g.cols * g.rows;
  const distances = new Float64Array(size);
  distances.fill(Infinity);
  const previous = new Int32Array(size);
  previous.fill(-1);
  const closed = new Uint8Array(size);
  const open = new MinHeap();
  const maxStep = stepLimits.get(g) ?? Infinity;
  let order = 0;
  let expanded = 0;

  distances[startIndex] = 0;
  open.push({
    index: startIndex,
    g: 0,
    f: heuristic(start[0], start[1], goal[0], goal[1]),
    order,
  });

  while (open.size > 0 && expanded < limit) {
    const current = open.pop();
    if (current === undefined) break;

    if (closed[current.index] === 1) continue;
    const knownDistance = distances[current.index];
    if (knownDistance === undefined || current.g !== knownDistance) continue;

    expanded += 1;
    closed[current.index] = 1;

    if (current.index === goalIndex) {
      return tracePath(g, startIndex, goalIndex, previous);
    }

    const c = current.index % g.cols;
    const r = Math.floor(current.index / g.cols);

    for (const [dc, dr] of DIRECTIONS) {
      if (!canMove(g, c, r, dc, dr, maxStep)) continue;

      const nextC = c + dc;
      const nextR = r + dr;
      const nextIndex = indexOf(g, nextC, nextR);
      if (closed[nextIndex] === 1) continue;

      const destinationCost = Math.max(1, g.cost[nextIndex] ?? 1);
      const distance = current.g + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1) * destinationCost;
      const oldDistance = distances[nextIndex] ?? Infinity;

      if (distance < oldDistance) {
        distances[nextIndex] = distance;
        previous[nextIndex] = current.index;
        order += 1;
        open.push({
          index: nextIndex,
          g: distance,
          f: distance + heuristic(nextC, nextR, goal[0], goal[1]),
          order,
        });
      }
    }
  }

  return null;
}

/** Convert world x, z to the nearest cell. */
export function cellOf(g: NavGrid, x: number, z: number): [number, number] {
  return [
    Math.round((x - g.h.originX) / g.h.cell),
    Math.round((z - g.h.originZ) / g.h.cell),
  ];
}

/** Convert a cell to its world-space centre. */
export function worldOf(g: NavGrid, c: number, r: number): [number, number] {
  return [g.h.originX + c * g.h.cell, g.h.originZ + r * g.h.cell];
}

function lineIsWalkable(
  g: NavGrid,
  from: [number, number],
  to: [number, number],
): boolean {
  const dc = to[0] - from[0];
  const dr = to[1] - from[1];
  const steps = Math.max(1, Math.ceil(Math.hypot(dc, dr) * 2));

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const c = Math.round(from[0] + dc * t);
    const r = Math.round(from[1] + dr * t);
    if (!isWalkable(g, c, r)) return false;
  }

  return true;
}

/** Remove points that can be skipped without crossing an unwalkable cell. */
export function smooth(
  g: NavGrid,
  path: [number, number][],
): [number, number][] {
  const first = path[0];
  if (first === undefined) return [];

  const result: [number, number][] = [[first[0], first[1]]];
  let anchor = 0;
  let candidate = 2;

  while (candidate < path.length) {
    const anchorPoint = path[anchor];
    const candidatePoint = path[candidate];
    if (anchorPoint === undefined || candidatePoint === undefined) break;

    if (lineIsWalkable(g, anchorPoint, candidatePoint)) {
      candidate += 1;
      continue;
    }

    const keptPoint = path[candidate - 1];
    if (keptPoint === undefined) break;

    result.push([keptPoint[0], keptPoint[1]]);
    anchor = candidate - 1;
    candidate = anchor + 2;
  }

  const last = path[path.length - 1];
  const previous = result[result.length - 1];
  if (
    last !== undefined &&
    (previous === undefined || previous[0] !== last[0] || previous[1] !== last[1])
  ) {
    result.push([last[0], last[1]]);
  }

  return result;
}

/** Return the walkable cells reachable from a walkable start cell. */
export function reachable(g: NavGrid, from: [number, number]): Set<number> {
  const result = new Set<number>();
  const c = Math.round(from[0]);
  const r = Math.round(from[1]);
  if (!isWalkable(g, c, r)) return result;

  const startIndex = indexOf(g, c, r);
  const queue: number[] = [startIndex];
  result.add(startIndex);
  const maxStep = stepLimits.get(g) ?? Infinity;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === undefined) continue;

    const currentC = current % g.cols;
    const currentR = Math.floor(current / g.cols);

    for (const [dc, dr] of DIRECTIONS) {
      if (!canMove(g, currentC, currentR, dc, dr, maxStep)) continue;

      const nextIndex = indexOf(g, currentC + dc, currentR + dr);
      if (result.has(nextIndex)) continue;

      result.add(nextIndex);
      queue.push(nextIndex);
    }
  }

  return result;
}