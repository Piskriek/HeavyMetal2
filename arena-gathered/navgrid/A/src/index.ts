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

/** @internal */
interface NavGridExt extends NavGrid {
  maxStep: number;
}

const SQRT2 = 1.4142135623730951;
const DX = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
const DY = [-1, -1, -1, 0, 0, 1, 1, 1] as const;
const DISTS = [SQRT2, 1, SQRT2, 1, 1, SQRT2, 1, SQRT2] as const;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function octDist(c1: number, r1: number, c2: number, r2: number): number {
  const dx = Math.abs(c1 - c2);
  const dy = Math.abs(r1 - r2);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

/* ─── Indexed binary min-heap with decrease-key ─── */

class MinHeap {
  private arr: number[] = [];
  private pos: Int32Array;
  private _size = 0;

  constructor(capacity: number) {
    this.pos = new Int32Array(capacity).fill(-1);
  }

  get size(): number {
    return this._size;
  }

  has(node: number): boolean {
    return this.pos[node]! >= 0;
  }

  push(node: number, fs: Float32Array): void {
    const i = this._size;
    this.arr.push(node);
    this._size++;
    this.pos[node] = i;
    this.siftUp(i, fs);
  }

  pop(fs: Float32Array): number {
    const top = this.arr[0]!;
    this.pos[top] = -1;
    this._size--;
    if (this._size > 0) {
      const last = this.arr.pop()!;
      this.arr[0] = last;
      this.pos[last] = 0;
      this.siftDown(0, fs);
    } else {
      this.arr.pop();
    }
    return top;
  }

  decreaseKey(node: number, fs: Float32Array): void {
    this.siftUp(this.pos[node]!, fs);
  }

  private siftUp(i: number, fs: Float32Array): void {
    while (i > 0) {
      const pi = (i - 1) >> 1;
      if (fs[this.arr[pi]!]! <= fs[this.arr[i]!]!) break;
      this.swap(pi, i);
      i = pi;
    }
  }

  private siftDown(i: number, fs: Float32Array): void {
    for (;;) {
      let m = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < this._size && fs[this.arr[l]!]! < fs[this.arr[m]!]!) m = l;
      if (r < this._size && fs[this.arr[r]!]! < fs[this.arr[m]!]!) m = r;
      if (m === i) break;
      this.swap(m, i);
      i = m;
    }
  }

  private swap(a: number, b: number): void {
    const va = this.arr[a]!;
    const vb = this.arr[b]!;
    this.arr[a] = vb;
    this.arr[b] = va;
    this.pos[va] = b;
    this.pos[vb] = a;
  }
}

/* ─── Public API ─── */

export function build(h: Heights, boxes: readonly Box[], o: NavOptions): NavGrid {
  const { cols, rows, cell, originX, originZ, heights } = h;
  const n = cols * rows;
  const walkable = new Uint8Array(n);
  const cost = new Float32Array(n);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const ht = heights[idx]!;
      if (ht < o.sea) continue;
      const cx = originX + c * cell;
      const cz = originZ + r * cell;
      let blocked = false;
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i]!;
        if (cx >= b.minX && cx <= b.maxX && cz >= b.minZ && cz <= b.maxZ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      walkable[idx] = 1;
      cost[idx] = 1;
    }
  }

  if (o.costs) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (!walkable[idx]!) continue;
        const cx = originX + c * cell;
        const cz = originZ + r * cell;
        for (let i = 0; i < o.costs.length; i++) {
          const ca = o.costs[i]!;
          const dx = cx - ca.x;
          const dz = cz - ca.z;
          if (dx * dx + dz * dz <= ca.radius * ca.radius) {
            cost[idx] = cost[idx]! * ca.cost;
          }
        }
      }
    }
  }

  const grid: NavGridExt = { cols, rows, walkable, cost, h, maxStep: o.maxStep };
  return grid;
}

function snap(
  g: NavGrid,
  c: number,
  r: number,
  radius: number,
): [number, number] | null {
  const { cols, rows, walkable } = g;
  if (
    c >= 0 && c < cols && r >= 0 && r < rows &&
    walkable[r * cols + c]!
  ) {
    return [c, r];
  }
  for (let d = 1; d <= radius; d++) {
    for (let dc = -d; dc <= d; dc++) {
      for (let dr = -d; dr <= d; dr++) {
        if (Math.abs(dc) !== d && Math.abs(dr) !== d) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (
          nc >= 0 && nc < cols && nr >= 0 && nr < rows &&
          walkable[nr * cols + nc]!
        ) {
          return [nc, nr];
        }
      }
    }
  }
  return null;
}

export function findPath(
  g: NavGrid,
  from: [number, number],
  to: [number, number],
  maxNodes: number = 20000,
): [number, number][] | null {
  const { cols, rows, walkable, cost, h } = g;
  const maxStep = (g as NavGridExt).maxStep;

  const s = snap(g, from[0], from[1], 3);
  const t = snap(g, to[0], to[1], 3);
  if (!s || !t) return null;

  const [sc, sr] = s;
  const [gc, gr] = t;
  const si = sr * cols + sc;
  const gi = gr * cols + gc;
  if (si === gi) return [[sc, sr]];

  const gs = new Float32Array(cols * rows).fill(Infinity);
  const fs = new Float32Array(cols * rows).fill(Infinity);
  const cameFrom = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);

  gs[si] = 0;
  fs[si] = octDist(sc, sr, gc, gr);

  const heap = new MinHeap(cols * rows);
  heap.push(si, fs);

  let expansions = 0;

  while (heap.size > 0 && expansions < maxNodes) {
    const cur = heap.pop(fs);

    if (cur === gi) {
      const path: [number, number][] = [];
      let n: number = cur;
      while (n !== -1) {
        const c = n % cols;
        path.push([c, (n - c) / cols]);
        n = cameFrom[n]!;
      }
      path.reverse();
      return path;
    }

    if (closed[cur]!) continue;
    closed[cur] = 1;
    expansions++;

    const cc = cur % cols;
    const cr = (cur - cc) / cols;
    const cht = h.heights[cur]!;

    for (let i = 0; i < 8; i++) {
      const nc = cc + DX[i]!;
      const nr = cr + DY[i]!;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (closed[ni]!) continue;
      if (!walkable[ni]!) continue;

      if (DX[i]! !== 0 && DY[i]! !== 0) {
        const s1 = cr * cols + (cc + DX[i]!);
        const s2 = (cr + DY[i]!) * cols + cc;
        if (!walkable[s1]! || !walkable[s2]!) continue;
      }

      const nht = h.heights[ni]!;
      if (Math.abs(nht - cht) > maxStep) continue;

      const ng = gs[cur]! + DISTS[i]! * cost[ni]!;
      if (ng < gs[ni]!) {
        gs[ni] = ng;
        fs[ni] = ng + octDist(nc, nr, gc, gr);
        cameFrom[ni] = cur;
        if (heap.has(ni)) heap.decreaseKey(ni, fs);
        else heap.push(ni, fs);
      }
    }
  }

  return null;
}

export function cellOf(g: NavGrid, x: number, z: number): [number, number] {
  const c = Math.floor((x - g.h.originX) / g.h.cell);
  const r = Math.floor((z - g.h.originZ) / g.h.cell);
  return [clamp(c, 0, g.cols - 1), clamp(r, 0, g.rows - 1)];
}

export function worldOf(g: NavGrid, c: number, r: number): [number, number] {
  return [g.h.originX + c * g.h.cell, g.h.originZ + r * g.h.cell];
}

export function smooth(
  g: NavGrid,
  path: [number, number][],
): [number, number][] {
  if (path.length <= 1)
    return path.map((p) => [p[0]!, p[1]!] as [number, number]);

  const out: [number, number][] = [[path[0]![0]!, path[0]![1]!]];
  let last = 0;

  for (let i = 2; i < path.length; i++) {
    if (!clearLine(g, path[last]!, path[i]!)) {
      out.push([path[i - 1]![0]!, path[i - 1]![1]!]);
      last = i - 1;
    }
  }

  out.push([path[path.length - 1]![0]!, path[path.length - 1]![1]!]);
  return out;
}

function clearLine(
  g: NavGrid,
  a: [number, number],
  b: [number, number],
): boolean {
  const { cols, rows, walkable } = g;
  const dc = b[0] - a[0];
  const dr = b[1] - a[1];
  const len = Math.sqrt(dc * dc + dr * dr);
  const steps = Math.max(1, Math.ceil(len * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = Math.floor(a[0] + dc * t + 0.5);
    const r = Math.floor(a[1] + dr * t + 0.5);
    if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
    if (!walkable[r * cols + c]!) return false;
  }
  return true;
}

export function reachable(g: NavGrid, from: [number, number]): Set<number> {
  const { cols, rows, walkable, h } = g;
  const maxStep = (g as NavGridExt).maxStep;
  const result = new Set<number>();

  const sc = from[0];
  const sr = from[1];
  if (sc < 0 || sc >= cols || sr < 0 || sr >= rows) return result;
  const si = sr * cols + sc;
  if (!walkable[si]!) return result;

  result.add(si);
  const q: number[] = [si];
  let head = 0;

  while (head < q.length) {
    const idx = q[head++]!;
    const c = idx % cols;
    const r = (idx - c) / cols;
    const ht = h.heights[idx]!;

    for (let i = 0; i < 8; i++) {
      const nc = c + DX[i]!;
      const nr = r + DY[i]!;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (result.has(ni)) continue;
      if (!walkable[ni]!) continue;

      if (DX[i]! !== 0 && DY[i]! !== 0) {
        const s1 = r * cols + (c + DX[i]!);
        const s2 = (r + DY[i]!) * cols + c;
        if (!walkable[s1]! || !walkable[s2]!) continue;
      }

      if (Math.abs(h.heights[ni]! - ht) > maxStep) continue;

      result.add(ni);
      q.push(ni);
    }
  }

  return result;
}