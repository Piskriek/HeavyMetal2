import { applyBrush, createTerrain, paintNode, type DirtyRect, type Terrain } from './grid';

/**
 * Ways to paint the ground (docs/HOTBAR.md, Paint): the hotbar holds these; the surface they put down comes from the palette. Each is one
 * dab at a point; the island calls it along a stroke. Pure and deterministic (a seed for the scattered ones), so the same function paints the
 * island and draws a tool's preview on a small copy of the ground you are looking at.
 */
export type PaintWay = 'brush' | 'spray' | 'fill' | 'gradient' | 'stamp' | 'pattern' | 'clone' | 'smudge' | 'eraser';
export const PAINT_WAYS: readonly PaintWay[] = ['brush', 'spray', 'fill', 'gradient', 'stamp', 'pattern', 'clone', 'smudge', 'eraser'];

export interface PaintDab {
  readonly way: PaintWay;
  readonly x: number; readonly z: number;
  readonly radius: number;
  /** 0..1 */
  readonly strength: number;
  readonly falloff: 'smooth' | 'linear' | 'flat';
  /** The palette's surface. */
  readonly surface: number;
  /** Scatter and shape noise. */
  readonly seed: number;
  /** Stamp: the shape pressed. */
  readonly shape?: 'blob' | 'square' | 'star' | 'ring';
  /** Pattern: what repeats. */
  readonly pattern?: 'checker' | 'stripes' | 'dots';
  /** Clone: where to copy from, as an offset in metres from the dab. */
  readonly from?: { readonly dx: number; readonly dz: number };
  /** Fill: most cells one fill may change. */
  readonly maxCells?: number;
  /** Eraser: what the world would grow here, by height and steepness (1 = flat); null keeps the cell. */
  readonly natural?: (height: number, flatness: number) => number | null;
}

const grow = (rect: DirtyRect | null, c: number, r: number): DirtyRect => (rect ? { c0: Math.min(rect.c0, c), r0: Math.min(rect.r0, r), c1: Math.max(rect.c1, c), r1: Math.max(rect.r1, r) } : { c0: c, r0: r, c1: c, r1: r });
const union = (a: DirtyRect | null, b: DirtyRect | null): DirtyRect | null => (!a ? b : !b ? a : { c0: Math.min(a.c0, b.c0), r0: Math.min(a.r0, b.r0), c1: Math.max(a.c1, b.c1), r1: Math.max(a.r1, b.r1) });
/** A small seeded random (mulberry32). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Visit every node within the dab's radius: (column, row, index, distance). */
function eachNode(t: Terrain, d: PaintDab, fn: (c: number, r: number, i: number, dist: number) => void): DirtyRect | null {
  const { cols, rows, cell, originX, originZ } = t.spec;
  const c0 = Math.max(0, Math.floor((d.x - d.radius - originX) / cell)), c1 = Math.min(cols - 1, Math.ceil((d.x + d.radius - originX) / cell));
  const r0 = Math.max(0, Math.floor((d.z - d.radius - originZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((d.z + d.radius - originZ) / cell));
  let rect: DirtyRect | null = null;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const dist = Math.hypot(originX + c * cell - d.x, originZ + r * cell - d.z);
    if (dist >= d.radius) continue;
    fn(c, r, r * cols + c, dist);
    rect = grow(rect, c, r);
  }
  return rect;
}
/** Is (dx, dz), relative to the dab's centre, inside the stamped shape? */
function inShape(shape: NonNullable<PaintDab['shape']>, dx: number, dz: number, radius: number, seed: number): boolean {
  const d = Math.hypot(dx, dz) / radius, a = Math.atan2(dz, dx);
  switch (shape) {
    case 'square': return Math.max(Math.abs(dx), Math.abs(dz)) < radius * 0.75;
    case 'ring': return d > 0.62 && d < 0.95;
    case 'star': { const k = Math.cos(5 * a) * 0.5 + 0.5; return d < 0.45 + 0.5 * k; }
    case 'blob': default: { const wob = Math.sin(a * 3 + seed) * 0.16 + Math.sin(a * 5 + seed * 1.7) * 0.1; return d < 0.78 + wob; }
  }
}

/** One dab of a way to paint. Returns the nodes it changed. */
export function paintWay(t: Terrain, d: PaintDab): DirtyRect | null {
  if (!(d.radius > 0)) return null;
  const { cols, rows, cell, originX, originZ } = t.spec;
  switch (d.way) {
    case 'brush':
      return applyBrush(t, { kind: 'paint', x: d.x, z: d.z, radius: d.radius, strength: d.strength, falloff: d.falloff, surface: d.surface });
    case 'gradient':
      // a long soft edge: the surface fades in from the rim to the centre (a blend, not a hard border)
      return applyBrush(t, { kind: 'paint', x: d.x, z: d.z, radius: d.radius, strength: Math.min(1, d.strength) * 0.6, falloff: 'linear', surface: d.surface });
    case 'spray': {
      const rand = rng(d.seed);
      let rect: DirtyRect | null = null;
      const n = Math.max(3, Math.round(4 + d.radius * 1.5));
      for (let k = 0; k < n; k++) {
        const ang = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * d.radius;
        rect = union(rect, applyBrush(t, { kind: 'paint', x: d.x + Math.cos(ang) * rr, z: d.z + Math.sin(ang) * rr, radius: Math.max(cell * 0.75, d.radius * 0.18), strength: d.strength, falloff: 'flat', surface: d.surface }));
      }
      return rect;
    }
    case 'stamp': {
      const shape = d.shape ?? 'blob';
      return eachNode(t, d, (c, r, i) => { if (inShape(shape, originX + c * cell - d.x, originZ + r * cell - d.z, d.radius, d.seed % 97)) paintNode(t, i, d.surface, 1); });
    }
    case 'pattern': {
      const p = d.pattern ?? 'checker';
      const on = (c: number, r: number): boolean => (p === 'stripes' ? ((c >> 1) & 1) === 0 : p === 'dots' ? c % 4 === 0 && r % 4 === 0 : (((c >> 1) + (r >> 1)) & 1) === 0);
      return eachNode(t, d, (c, r, i) => { if (on(c, r)) paintNode(t, i, d.surface, 1); });
    }
    case 'clone': {
      const dc = Math.round((d.from?.dx ?? 0) / cell), dr = Math.round((d.from?.dz ?? 0) / cell);
      if (dc === 0 && dr === 0) return null;
      const a = t.surfaceA.slice(), b = t.surfaceB.slice(), w = t.blend.slice();
      return eachNode(t, d, (c, r, i) => {
        const sc = c + dc, sr = r + dr;
        if (sc < 0 || sr < 0 || sc >= cols || sr >= rows) return;
        const s = sr * cols + sc;
        t.surfaceA[i] = a[s]!; t.surfaceB[i] = b[s]!; t.blend[i] = w[s]!;
      });
    }
    case 'smudge': {
      // each node takes on the surface most of its neighbours have: borders mix and soften
      const a = t.surfaceA.slice();
      return eachNode(t, d, (c, r, i) => {
        const count = new Map<number, number>();
        for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) { if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue; const s = a[rr * cols + cc]!; count.set(s, (count.get(s) ?? 0) + 1); }
        let best = a[i]!, n = 0;
        for (const [s, k] of count) if (k > n) { best = s; n = k; }
        if (best !== a[i]) paintNode(t, i, best, Math.min(1, d.strength));
      });
    }
    case 'eraser': {
      if (!d.natural) return null;
      return eachNode(t, d, (c, r, i) => {
        const h = t.heights[i]!;
        const hx = (t.heights[r * cols + Math.min(cols - 1, c + 1)]! - t.heights[r * cols + Math.max(0, c - 1)]!) / (2 * cell);
        const hz = (t.heights[Math.min(rows - 1, r + 1) * cols + c]! - t.heights[Math.max(0, r - 1) * cols + c]!) / (2 * cell);
        const s = d.natural!(h, 1 / Math.hypot(hx, 1, hz));
        if (s !== null) paintNode(t, i, s, 1);
      });
    }
    case 'fill': {
      // the connected patch of the surface under the dab, up to maxCells
      const c = Math.round((d.x - originX) / cell), r = Math.round((d.z - originZ) / cell);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
      const start = r * cols + c, match = t.surfaceA[start]!;
      if (match === d.surface && t.blend[start] === 0) return null;
      const max = d.maxCells ?? 6000;
      const seen = new Uint8Array(cols * rows);
      const queue = [start];
      seen[start] = 1;
      let rect: DirtyRect | null = null, done = 0, head = 0;
      while (head < queue.length && done < max) {
        const i = queue[head++]!;
        const ci = i % cols, ri = (i - ci) / cols;
        paintNode(t, i, d.surface, 1); done++;
        rect = grow(rect, ci, ri);
        for (const [nc, nr] of [[ci + 1, ri], [ci - 1, ri], [ci, ri + 1], [ci, ri - 1]] as const) {
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const j = nr * cols + nc;
          if (seen[j] || t.surfaceA[j] !== match) continue;
          seen[j] = 1; queue.push(j);
        }
      }
      return rect;
    }
  }
}

/** A small copy of the ground round a point (n × n nodes): a tool's preview runs on it without touching the island. */
export function cropTerrain(t: Terrain, x: number, z: number, n: number): Terrain {
  const { cols, rows, cell, originX, originZ } = t.spec;
  const c0 = Math.max(0, Math.min(cols - n, Math.round((x - originX) / cell) - (n >> 1)));
  const r0 = Math.max(0, Math.min(rows - n, Math.round((z - originZ) / cell) - (n >> 1)));
  const w = Math.min(n, cols), h = Math.min(n, rows);
  const out = createTerrain({ cols: w, rows: h, cell, originX: originX + c0 * cell, originZ: originZ + r0 * cell });
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = (r0 + r) * cols + (c0 + c), j = r * w + c;
    out.heights[j] = t.heights[i]!; out.surfaceA[j] = t.surfaceA[i]!; out.surfaceB[j] = t.surfaceB[i]!; out.blend[j] = t.blend[i]!;
  }
  return out;
}
