// Reference @hm/navpath (validates the hidden suite and the brief's numbers; not sent). Visibility graph over
// {from, to, convex corners} with Dijkstra: exact, O(V^2 * cells) per query, fine for checking.
export interface Grid { readonly w: number; readonly h: number; blocked(x: number, y: number): boolean }
type P = readonly [number, number];
const EPS = 1e-9;
const isBlocked = (g: Grid, x: number, y: number): boolean => x < 0 || y < 0 || x >= g.w || y >= g.h || g.blocked(x, y);

function crossesOpen(a: P, b: P, x: number, y: number): boolean {
  let t0 = 0, t1 = 1;
  for (const [s, e, lo, hi] of [[a[0], b[0], x, x + 1], [a[1], b[1], y, y + 1]] as const) {
    const d = e - s;
    if (Math.abs(d) < EPS) { if (!(s > lo + EPS && s < hi - EPS)) return false; continue; }
    const u = (lo - s) / d, v = (hi - s) / d;
    t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
  }
  return t1 - t0 > EPS;
}

function segOk(g: Grid, a: P, b: P): boolean {
  for (const axis of [0, 1] as const) {
    const o = 1 - axis;
    if (Math.abs(a[o] - b[o]) < EPS && Math.abs(a[o] - Math.round(a[o])) < EPS) {
      const line = Math.round(a[o]), lo = Math.min(a[axis], b[axis]), hi = Math.max(a[axis], b[axis]);
      for (let c = Math.floor(lo); c < Math.ceil(hi); c++) {
        if (Math.min(hi, c + 1) - Math.max(lo, c) <= EPS) continue;
        const s1 = axis === 0 ? isBlocked(g, c, line) : isBlocked(g, line, c), s2 = axis === 0 ? isBlocked(g, c, line - 1) : isBlocked(g, line - 1, c);
        if (s1 && s2) return false;
      }
      return true;
    }
  }
  for (let x = Math.floor(Math.min(a[0], b[0])); x < Math.ceil(Math.max(a[0], b[0])); x++)
    for (let y = Math.floor(Math.min(a[1], b[1])); y < Math.ceil(Math.max(a[1], b[1])); y++)
      if (isBlocked(g, x, y) && crossesOpen(a, b, x, y)) return false;
  return true;
}

export function shortestPath(g: Grid, from: P, to: P): { points: [number, number][]; length: number } | null {
  if (isBlocked(g, Math.floor(from[0]), Math.floor(from[1])) || isBlocked(g, Math.floor(to[0]), Math.floor(to[1]))) return null;
  const nodes: P[] = [from, to];
  for (let x = 0; x <= g.w; x++) for (let y = 0; y <= g.h; y++) {
    const n = [isBlocked(g, x - 1, y - 1), isBlocked(g, x, y - 1), isBlocked(g, x - 1, y), isBlocked(g, x, y)].filter(Boolean).length;
    if (n === 1) nodes.push([x, y]);
  }
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i]! < Infinity && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0) return null;
    if (u === 1) break;
    done[u] = true;
    for (let v = 0; v < nodes.length; v++) {
      if (done[v]) continue;
      const a = nodes[u]!, b = nodes[v]!, d = dist[u]! + Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d < dist[v]! - 1e-12 && segOk(g, a, b)) { dist[v] = d; prev[v] = u; }
    }
  }
  const points: [number, number][] = [];
  for (let i = 1; i >= 0; i = prev[i]!) points.unshift([nodes[i]![0], nodes[i]![1]]);
  return { points, length: dist[1]! };
}
