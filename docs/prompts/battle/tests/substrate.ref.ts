export type Kind = 'dither' | 'fold' | 'chroma' | 'spire';
export const ITEM = { dither: 'pxd-mono', chroma: 'pxd-chroma', fold: 'vtx-rough', spire: 'vtx-fine' } as const;
export const MAX = { dither: 60, fold: 60, chroma: 120, spire: 120 }, RATE = { dither: 1.5, fold: 1.5, chroma: 1, spire: 1 }, G0 = 1 / 600, CELL = 20;
export interface Node { readonly id: number; readonly kind: Kind; readonly x: number; readonly z: number; readonly reserve: number; readonly carry: number }
export interface Field { readonly v: 1; readonly seed: number; readonly time: number; readonly nodes: readonly Node[] }
export interface Stack { readonly item: string; readonly n: number }
export function hash(seed: number, i: number, j: number, k: number): number { let h = (seed ^ Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0; return h / 4294967296; }
const st = (s: number) => Math.max(0, Math.min(6, Math.round(s)));
export function generate(seed: number, radius: number, stage: number): Field {
  const s = st(stage), nodes: Node[] = [], n = Math.ceil(radius / CELL);
  for (let ci = -n; ci <= n; ci++) for (let cj = -n; cj <= n; cj++) {
    if (Math.hypot(ci * CELL, cj * CELL) > radius - 10) continue;
    if (hash(seed, ci, cj, 0) >= 0.18 + 0.04 * s) continue;
    const px = hash(seed, ci, cj, 3) < 0.5, up = hash(seed, ci, cj, 4) < Math.max(0, (s - 1) * 0.15);
    const kind: Kind = px ? (up ? 'chroma' : 'dither') : (up ? 'spire' : 'fold');
    nodes.push({ id: (ci + 1000) * 2001 + (cj + 1000), kind, x: ci * CELL + (hash(seed, ci, cj, 1) - 0.5) * 12, z: cj * CELL + (hash(seed, ci, cj, 2) - 0.5) * 12, reserve: MAX[kind], carry: 0 });
  }
  nodes.sort((a, b) => a.id - b.id);
  return { v: 1, seed, time: 0, nodes };
}
export function regen(f: Field, radius: number, stage: number): Field {
  const g = generate(f.seed, radius, stage), old = new Map(f.nodes.map((n) => [n.id, n]));
  return { ...g, time: f.time, nodes: g.nodes.map((n) => { const o = old.get(n.id); return o ? { ...n, reserve: (o.reserve / MAX[o.kind]) * MAX[n.kind], carry: o.carry } : n; }) };
}
export function advance(f: Field, dt: number, stage: number, beam: { id: number; power: number } | null): { field: Field; items: Stack[] } {
  if (!(dt > 0) || !Number.isFinite(dt)) return { field: f, items: [] };
  const gr = G0 * (1 + st(stage) / 2); let items: Stack[] = [];
  const nodes = f.nodes.map((n) => {
    const M = MAX[n.kind];
    if (beam && n.id === beam.id) {
      const p = Math.max(0, Math.min(4, Number.isFinite(beam.power) ? beam.power : 0)), k = RATE[n.kind] * p;
      if (k <= 0) return n;
      const R1 = Math.max(0, (n.reserve + M) * Math.exp((-k * dt) / (2 * M)) - M), h = n.reserve - R1;
      const cnt = Math.floor(n.carry + h + 1e-9); const carry = Math.min(Math.max(n.carry + h - cnt, 0), 1 - 1e-12);
      if (cnt > 0) items = [{ item: ITEM[n.kind], n: cnt }];
      return { ...n, reserve: R1, carry };
    }
    return { ...n, reserve: M - (M - n.reserve) * Math.exp(-gr * dt) };
  });
  return { field: { ...f, time: f.time + dt, nodes }, items };
}
