/**
 * @hm/navpath — EXACT any-angle shortest paths on a grid of blocked square cells.
 *
 * Model
 * -----
 * Cell (x, y) covers [x, x+1] x [y, y+1]; the exterior of the w x h grid counts
 * as blocked. A legal polyline may touch blocked cells' edges and corners, but
 * must never cross a blocked cell's interior and never run along an edge that
 * has blocked cells on both sides.
 *
 * Method
 * ------
 * In a polygonal domain, a Euclidean shortest path is a polygonal chain whose
 * interior vertices are reflex vertices of the free space (interior angle
 * > 180°). On a pinch-free grid those are exactly the grid vertices touched by
 * exactly one blocked cell (free angle 270°); every other vertex configuration
 * (0, 2 adjacent, 3 or 4 blocked cells — or the boundary, where the exterior
 * is blocked) is either straight, convex or untouchable, so a shortest path
 * never needs to bend there. Hence: build the visibility graph over those
 * corners once, connect the two query endpoints into it, and search it.
 * The graph optimum is attained by a legal polyline and equals the true
 * optimum; ties are broken deterministically (row-major vertex order, then
 * heap order by (distance, node id)).
 *
 * Segment legality is decided by an exact grid walk: between two consecutive
 * grid-line crossings the open sub-segment ("slab") lies strictly inside one
 * cell (which must be free) or, for axis-aligned segments lying on a grid
 * line, on one unit edge (then at least one adjacent cell must be free).
 * Passing exactly through a grid vertex is detected by cross-multiplication
 * (exact for integer and half-integer coordinates) and treated as touching a
 * corner, which is always allowed.
 *
 * Purity: no I/O, no time, no randomness, no imports, no globals — the same
 * input always yields the same output.
 */

export interface Grid {
  readonly w: number;
  readonly h: number;
  blocked(x: number, y: number): boolean;
}

export interface Path {
  /** Polyline points: points[0] is `from`, the last one is `to`. */
  points: [number, number][];
  /** Total Euclidean length: the sum of the polyline's segments. */
  length: number;
}

export interface Nav {
  path(from: readonly [number, number], to: readonly [number, number]): Path | null;
}

const INF = Number.POSITIVE_INFINITY;

export function navigator(grid: Grid): Nav {
  const w = grid.w | 0;
  const h = grid.h | 0;
  const blocked = new Uint8Array(Math.max(0, w * h));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid.blocked(x, y)) blocked[y * w + x] = 1;
    }
  }

  /** Is the cell (c, r) in-bounds and free? (The exterior counts as blocked.) */
  function cellFree(c: number, r: number): boolean {
    return c >= 0 && c < w && r >= 0 && r < h && blocked[r * w + c] === 0;
  }

  /**
   * Exact legality of the segment (x0,y0) -> (x1,y1): true iff it never enters
   * a blocked cell's interior and never runs along a doubly-blocked edge.
   */
  function visible(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;

    if (dx === 0) {
      if (dy === 0) return true;
      // Vertical segment.
      const sy = dy > 0 ? 1 : -1;
      const ay = Math.abs(dy);
      const onLine = x0 === Math.floor(x0); // runs along grid-line edges?
      const col = Math.floor(x0);
      const yLine = y0 === Math.floor(y0);
      let vj = yLine ? y0 + sy : sy > 0 ? Math.ceil(y0) : Math.floor(y0);
      let t = 0;
      for (;;) {
        let tc = Math.abs(vj - y0) / ay;
        let last = false;
        if (tc >= 1) {
          tc = 1;
          last = true;
        }
        const tm = (t + tc) * 0.5;
        const r = Math.floor(y0 + tm * dy);
        if (onLine) {
          // On the line x = x0: each traversed unit edge needs one free side.
          if (!cellFree(x0 - 1, r) && !cellFree(x0, r)) return false;
        } else if (!cellFree(col, r)) {
          return false;
        }
        if (last) return true;
        t = tc;
        vj += sy;
      }
    }

    if (dy === 0) {
      // Horizontal segment.
      const sx = dx > 0 ? 1 : -1;
      const ax = Math.abs(dx);
      const onLine = y0 === Math.floor(y0);
      const row = Math.floor(y0);
      const xLine = x0 === Math.floor(x0);
      let vi = xLine ? x0 + sx : sx > 0 ? Math.ceil(x0) : Math.floor(x0);
      let t = 0;
      for (;;) {
        let tc = Math.abs(vi - x0) / ax;
        let last = false;
        if (tc >= 1) {
          tc = 1;
          last = true;
        }
        const tm = (t + tc) * 0.5;
        const c = Math.floor(x0 + tm * dx);
        if (onLine) {
          // On the line y = y0: each traversed unit edge needs one free side.
          if (!cellFree(c, y0 - 1) && !cellFree(c, y0)) return false;
        } else if (!cellFree(c, row)) {
          return false;
        }
        if (last) return true;
        t = tc;
        vi += sx;
      }
    }

    // General segment: dx and dy both non-zero. Every slab lies strictly
    // inside one cell; vertex pass-throughs are exact ties and simply advance
    // both crossing families at once.
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const xLine = x0 === Math.floor(x0);
    const yLine = y0 === Math.floor(y0);
    let vi = xLine ? x0 + sx : sx > 0 ? Math.ceil(x0) : Math.floor(x0);
    let vj = yLine ? y0 + sy : sy > 0 ? Math.ceil(y0) : Math.floor(y0);
    let t = 0;
    for (;;) {
      const nx = Math.abs(vi - x0); // vertical crossing at t = nx / ax
      const ny = Math.abs(vj - y0); // horizontal crossing at t = ny / ay
      const cxp = nx * ay;
      const cyp = ny * ax;
      let tc: number;
      let crossX: boolean;
      let crossY: boolean;
      if (cxp === cyp) {
        tc = nx / ax; // exactly through the vertex (vi, vj): touch the corner
        crossX = true;
        crossY = true;
      } else if (cxp < cyp) {
        tc = nx / ax;
        crossX = true;
        crossY = false;
      } else {
        tc = ny / ay;
        crossX = false;
        crossY = true;
      }
      let last = false;
      if (tc >= 1) {
        tc = 1;
        last = true;
      }
      const tm = (t + tc) * 0.5;
      if (!cellFree(Math.floor(x0 + tm * dx), Math.floor(y0 + tm * dy))) return false;
      if (last) return true;
      t = tc;
      if (crossX) vi += sx;
      if (crossY) vj += sy;
    }
  }

  // --- Components of the free cells (4-connectivity; corner-touching adds no
  // extra connectivity on a pinch-free grid), for fast null answers. ---
  const n = w * h;
  const parent = new Int32Array(Math.max(0, n));
  for (let i = 0; i < n; i++) parent[i] = i;
  function find(a: number): number {
    let r = a;
    while (parent[r] !== r) r = parent[r]!;
    let cur = a;
    while (parent[cur] !== r) {
      const nxt = parent[cur]!;
      parent[cur] = r;
      cur = nxt;
    }
    return r;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (blocked[i] !== 0) continue;
      if (x > 0 && blocked[i - 1] === 0) union(i, i - 1);
      if (y > 0 && blocked[i - w] === 0) union(i, i - w);
    }
  }

  // --- Reflex corners: interior grid vertices touched by exactly one blocked
  // cell (free angle 270°). Row-major order for determinism. ---
  const cxList: number[] = [];
  const cyList: number[] = [];
  const compList: number[] = [];
  for (let j = 1; j < h; j++) {
    for (let i = 1; i < w; i++) {
      const sw = blocked[(j - 1) * w + (i - 1)]!;
      const se = blocked[(j - 1) * w + i]!;
      const nw = blocked[j * w + i - 1]!;
      const ne = blocked[j * w + i]!;
      if (sw + se + nw + ne !== 1) continue;
      cxList.push(i);
      cyList.push(j);
      const cellIndex =
        sw === 0
          ? (j - 1) * w + (i - 1)
          : se === 0
            ? (j - 1) * w + i
            : nw === 0
              ? j * w + (i - 1)
              : j * w + i;
      compList.push(find(cellIndex));
    }
  }
  const K = cxList.length;
  const cx = Float64Array.from(cxList);
  const cy = Float64Array.from(cyList);
  const cornerComp = Int32Array.from(compList);

  // --- Static visibility graph over the corners (undirected). ---
  let eu = new Int32Array(256);
  let ev = new Int32Array(256);
  let ew = new Float64Array(256);
  let E = 0;
  function addEdge(a: number, b: number, wgt: number): void {
    if (E === eu.length) {
      const cap = eu.length * 2;
      const nu = new Int32Array(cap);
      const nv = new Int32Array(cap);
      const nwgt = new Float64Array(cap);
      nu.set(eu);
      nv.set(ev);
      nwgt.set(ew);
      eu = nu;
      ev = nv;
      ew = nwgt;
    }
    eu[E] = a;
    ev[E] = b;
    ew[E] = wgt;
    E += 1;
  }
  for (let a = 0; a < K; a++) {
    const ax = cx[a]!;
    const ay = cy[a]!;
    for (let b = a + 1; b < K; b++) {
      const ddx = cx[b]! - ax;
      const ddy = cy[b]! - ay;
      if (visible(ax, ay, cx[b]!, cy[b]!)) addEdge(a, b, Math.sqrt(ddx * ddx + ddy * ddy));
    }
  }
  // Compress to CSR adjacency.
  const adjOff = new Int32Array(K + 1);
  for (let e = 0; e < E; e++) {
    const a = eu[e]! + 1;
    const b = ev[e]! + 1;
    adjOff[a] = adjOff[a]! + 1;
    adjOff[b] = adjOff[b]! + 1;
  }
  for (let i = 0; i < K; i++) adjOff[i + 1] = adjOff[i]! + adjOff[i + 1]!;
  const adjTo = new Int32Array(adjOff[K]!);
  const adjWeight = new Float64Array(adjOff[K]!);
  {
    const cursor = Int32Array.from(adjOff);
    for (let e = 0; e < E; e++) {
      const a = eu[e]!;
      const b = ev[e]!;
      const wgt = ew[e]!;
      const pa = cursor[a]!;
      adjTo[pa] = b;
      adjWeight[pa] = wgt;
      cursor[a] = pa + 1;
      const pb = cursor[b]!;
      adjTo[pb] = a;
      adjWeight[pb] = wgt;
      cursor[b] = pb + 1;
    }
  }

  /** Endpoints must lie in the closed grid and outside every blocked cell's interior. */
  function endpointOk(px: number, py: number): boolean {
    if (!(px >= 0 && px <= w && py >= 0 && py <= h)) return false;
    if (px !== Math.floor(px) && py !== Math.floor(py)) {
      return blocked[Math.floor(py) * w + Math.floor(px)] === 0;
    }
    return true; // on a grid line/vertex: never strictly inside a cell
  }

  /** Component id of an endpoint: any adjacent free cell (all agree, pinch-free). */
  function endpointComp(px: number, py: number): number {
    const xLine = px === Math.floor(px);
    const yLine = py === Math.floor(py);
    if (!xLine && !yLine) return find(Math.floor(py) * w + Math.floor(px));
    const c0 = xLine ? Math.max(0, px - 1) : Math.floor(px);
    const c1 = xLine ? Math.min(w - 1, px) : Math.floor(px);
    const r0 = yLine ? Math.max(0, py - 1) : Math.floor(py);
    const r1 = yLine ? Math.min(h - 1, py) : Math.floor(py);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (blocked[r * w + c] === 0) return find(r * w + c);
      }
    }
    return -1;
  }

  function path(from: readonly [number, number], to: readonly [number, number]): Path | null {
    const fx = from[0];
    const fy = from[1];
    const tx = to[0];
    const ty = to[1];
    if (!endpointOk(fx, fy) || !endpointOk(tx, ty)) return null;
    if (fx === tx && fy === ty) return { points: [[fx, fy]], length: 0 };
    const cf = endpointComp(fx, fy);
    const ct = endpointComp(tx, ty);
    if (cf < 0 || ct < 0 || cf !== ct) return null;
    if (visible(fx, fy, tx, ty)) {
      const ddx = tx - fx;
      const ddy = ty - fy;
      return { points: [[fx, fy], [tx, ty]], length: Math.sqrt(ddx * ddx + ddy * ddy) };
    }

    // A* over nodes {corners 0..K-1, from = K, to = K + 1}, Euclidean
    // heuristic towards `to` (admissible & consistent), deterministic
    // tie-breaking by (f, g, node id).
    const fromId = K;
    const toId = K + 1;
    const size = K + 2;
    const dist = new Float64Array(size);
    dist.fill(INF);
    const prev = new Int32Array(size);
    prev.fill(-1);
    const done = new Uint8Array(size);
    const heur = new Float64Array(size);
    for (let i = 0; i < K; i++) {
      const ddx = cx[i]! - tx;
      const ddy = cy[i]! - ty;
      heur[i] = Math.sqrt(ddx * ddx + ddy * ddy);
    }
    {
      const ddx = fx - tx;
      const ddy = fy - ty;
      heur[fromId] = Math.sqrt(ddx * ddx + ddy * ddy);
    }

    // Binary min-heap over (f, g, id).
    const heapF: number[] = [];
    const heapG: number[] = [];
    const heapV: number[] = [];
    const less = (i: number, j: number): boolean => {
      const fi = heapF[i]!;
      const fj = heapF[j]!;
      if (fi !== fj) return fi < fj;
      const gi = heapG[i]!;
      const gj = heapG[j]!;
      if (gi !== gj) return gi < gj;
      return heapV[i]! < heapV[j]!;
    };
    const swap = (i: number, j: number): void => {
      const tf = heapF[i]!;
      heapF[i] = heapF[j]!;
      heapF[j] = tf;
      const tg = heapG[i]!;
      heapG[i] = heapG[j]!;
      heapG[j] = tg;
      const tv = heapV[i]!;
      heapV[i] = heapV[j]!;
      heapV[j] = tv;
    };
    const push = (f: number, g: number, v: number): void => {
      heapF.push(f);
      heapG.push(g);
      heapV.push(v);
      let i = heapV.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(i, p)) break;
        swap(i, p);
        i = p;
      }
    };
    const pop = (): number => {
      const top = heapV[0]!;
      const lf = heapF.pop()!;
      const lg = heapG.pop()!;
      const lv = heapV.pop()!;
      if (heapV.length > 0) {
        heapF[0] = lf;
        heapG[0] = lg;
        heapV[0] = lv;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heapV.length && less(l, m)) m = l;
          if (r < heapV.length && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    };

    dist[fromId] = 0;
    push(heur[fromId]!, 0, fromId);
    while (heapV.length > 0) {
      const u = pop();
      if (done[u] === 1) continue;
      done[u] = 1;
      if (u === toId) break;
      const gu = dist[u]!;
      if (u === fromId) {
        // Connect `from` to every visible corner of its component.
        for (let v = 0; v < K; v++) {
          if (done[v] === 1 || cornerComp[v] !== cf) continue;
          const ddx = cx[v]! - fx;
          const ddy = cy[v]! - fy;
          if (!visible(fx, fy, cx[v]!, cy[v]!)) continue;
          const g2 = Math.sqrt(ddx * ddx + ddy * ddy);
          if (g2 < dist[v]!) {
            dist[v] = g2;
            prev[v] = u;
            push(g2 + heur[v]!, g2, v);
          }
        }
      } else {
        const ux = cx[u]!;
        const uy = cy[u]!;
        const end = adjOff[u + 1]!;
        for (let e = adjOff[u]!; e < end; e++) {
          const v = adjTo[e]!;
          if (done[v] === 1) continue;
          const g2 = gu + adjWeight[e]!;
          if (g2 < dist[v]!) {
            dist[v] = g2;
            prev[v] = u;
            push(g2 + heur[v]!, g2, v);
          }
        }
        // Possible final hop straight to `to`.
        if (done[toId] === 0 && visible(ux, uy, tx, ty)) {
          const ddx = tx - ux;
          const ddy = ty - uy;
          const g2 = gu + Math.sqrt(ddx * ddx + ddy * ddy);
          if (g2 < dist[toId]!) {
            dist[toId] = g2;
            prev[toId] = u;
            push(g2, g2, toId); // heur[toId] = 0
          }
        }
      }
    }
    const total = dist[toId]!;
    if (total === INF) return null;

    // Reconstruct, then measure the emitted polyline itself.
    const revCorners: number[] = [];
    let cur = prev[toId]!;
    while (cur !== fromId && cur >= 0) {
      revCorners.push(cur);
      cur = prev[cur]!;
    }
    const points: [number, number][] = [[fx, fy]];
    for (let i = revCorners.length - 1; i >= 0; i--) {
      points.push([cx[revCorners[i]!]!, cy[revCorners[i]!]!]);
    }
    points.push([tx, ty]);
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const ddx = b[0] - a[0];
      const ddy = b[1] - a[1];
      length += Math.sqrt(ddx * ddx + ddy * ddy);
    }
    return { points, length };
  }

  return { path };
}

export function shortestPath(
  grid: Grid,
  from: readonly [number, number],
  to: readonly [number, number],
): Path | null {
  return navigator(grid).path(from, to);
}
