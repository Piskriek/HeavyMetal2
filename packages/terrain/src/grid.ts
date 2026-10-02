/**
 * Terrain data: a height grid plus a two-surface paint mask per node, brushes, a compact encoding for presets and a
 * procedural island. Pure and deterministic (integer hash noise, no trig/random): the same seed gives the same island everywhere.
 * Triangulation matches the physics heightfield: each cell's diagonal runs from node (c,r) to (c+1,r+1).
 */
export interface TerrainSpec { readonly cols: number; readonly rows: number; readonly cell: number; readonly originX: number; readonly originZ: number }
export interface Terrain {
  readonly spec: TerrainSpec;
  /** rows*cols, index r*cols+c; node (c,r) is at x = originX + c*cell, z = originZ + r*cell. */
  readonly heights: Float32Array;
  readonly surfaceA: Uint8Array;
  readonly surfaceB: Uint8Array;
  /** Weight of surface B, 0..255. */
  readonly blend: Uint8Array;
}
export interface DirtyRect { c0: number; r0: number; c1: number; r1: number }
export type BrushKind = 'raise' | 'lower' | 'smooth' | 'flatten' | 'paint';
export interface Brush {
  readonly kind: BrushKind; readonly x: number; readonly z: number; readonly radius: number; readonly strength: number;
  readonly falloff: 'smooth' | 'linear' | 'flat'; readonly surface?: number; readonly target?: number;
}
export interface HeightfieldData { cols: number; rows: number; cell: number; heights: number[]; position: [number, number, number] }

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function createTerrain(spec: TerrainSpec, fill?: { height?: number; surface?: number }): Terrain {
  if (!Number.isInteger(spec.cols) || !Number.isInteger(spec.rows) || spec.cols < 2 || spec.rows < 2) throw new Error('terrain: cols and rows must be integers >= 2');
  if (!(spec.cell > 0)) throw new Error('terrain: cell must be > 0');
  const n = spec.cols * spec.rows;
  const surface = fill?.surface ?? 0;
  const t = { spec: { ...spec }, heights: new Float32Array(n), surfaceA: new Uint8Array(n), surfaceB: new Uint8Array(n), blend: new Uint8Array(n) };
  if (fill?.height) t.heights.fill(fill.height);
  if (surface) { t.surfaceA.fill(surface); t.surfaceB.fill(surface); }
  return t;
}

export function cloneTerrain(t: Terrain): Terrain {
  return { spec: { ...t.spec }, heights: t.heights.slice(), surfaceA: t.surfaceA.slice(), surfaceB: t.surfaceB.slice(), blend: t.blend.slice() };
}

interface CellPos { c: number; r: number; u: number; v: number }
function locate(t: Terrain, x: number, z: number): CellPos {
  const { cols, rows, cell, originX, originZ } = t.spec;
  const fx = clamp((x - originX) / cell, 0, cols - 1), fz = clamp((z - originZ) / cell, 0, rows - 1);
  const c = Math.min(cols - 2, Math.floor(fx)), r = Math.min(rows - 2, Math.floor(fz));
  return { c, r, u: fx - c, v: fz - r };
}

export function heightAt(t: Terrain, x: number, z: number): number {
  const { cols } = t.spec;
  const { c, r, u, v } = locate(t, x, z);
  const i = r * cols + c;
  const ha = t.heights[i]!, hb = t.heights[i + 1]!, hc = t.heights[i + cols]!, hd = t.heights[i + cols + 1]!;
  return u >= v ? ha + u * (hb - ha) + v * (hd - hb) : ha + v * (hc - ha) + u * (hd - hc);
}

export function normalAt(t: Terrain, x: number, z: number): [number, number, number] {
  const { cols, cell } = t.spec;
  const { c, r, u, v } = locate(t, x, z);
  const i = r * cols + c;
  const ha = t.heights[i]!, hb = t.heights[i + 1]!, hc = t.heights[i + cols]!, hd = t.heights[i + cols + 1]!;
  // triangle (a,d,b) when u >= v, else (a,c,d); both counter-clockwise from above so the normal points up
  const [ux, uy, uz, vx, vy, vz] = u >= v
    ? [cell, hd - ha, cell, cell, hb - ha, 0]
    : [0, hc - ha, cell, cell, hd - ha, cell];
  const nx = uy! * vz! - uz! * vy!, ny = uz! * vx! - ux! * vz!, nz = ux! * vy! - uy! * vx!;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

export function normalYAtCell(t: Terrain, c: number, r: number): number {
  const { cols, rows, cell } = t.spec;
  const h = (cc: number, rr: number): number => t.heights[clamp(rr, 0, rows - 1) * cols + clamp(cc, 0, cols - 1)]!;
  const dx = (h(c + 1, r) - h(c - 1, r)) / (2 * cell), dz = (h(c, r + 1) - h(c, r - 1)) / (2 * cell);
  return 1 / Math.hypot(dx, 1, dz);
}

const weight = (kind: Brush['falloff'], d: number, radius: number): number => {
  if (d >= radius) return 0;
  const t = d / radius;
  return kind === 'smooth' ? 1 - (3 * t * t - 2 * t * t * t) : kind === 'linear' ? 1 - t : 1;
};

function paintNode(t: Terrain, i: number, surface: number, k: number): void {
  const a = t.surfaceA[i]!, b = t.surfaceB[i]!;
  let wB = t.blend[i]! / 255;
  let A = a, B = b;
  if (surface === a) wB = wB * (1 - k);
  else if (surface === b) wB = wB + (1 - wB) * k;
  else if (wB < 0.5) { B = surface; wB = k; }
  else { A = b; B = surface; wB = k; }
  let blend = Math.round(wB * 255);
  if (blend === 0) B = A;
  if (blend >= 255) { A = B; blend = 0; }
  if (A === B) blend = 0;
  t.surfaceA[i] = A; t.surfaceB[i] = B; t.blend[i] = blend;
}

export function applyBrush(t: Terrain, b: Brush): DirtyRect | null {
  const { cols, rows, cell, originX, originZ } = t.spec;
  if (!(b.radius > 0)) return null;
  const c0 = Math.max(0, Math.floor((b.x - b.radius - originX) / cell)), c1 = Math.min(cols - 1, Math.ceil((b.x + b.radius - originX) / cell));
  const r0 = Math.max(0, Math.floor((b.z - b.radius - originZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((b.z + b.radius - originZ) / cell));
  const src = b.kind === 'smooth' ? t.heights.slice() : t.heights;
  let rect: DirtyRect | null = null;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d = Math.hypot(originX + c * cell - b.x, originZ + r * cell - b.z);
      if (d >= b.radius) continue;
      const w = weight(b.falloff, d, b.radius);
      const i = r * cols + c;
      rect = rect ? { c0: Math.min(rect.c0, c), r0: Math.min(rect.r0, r), c1: Math.max(rect.c1, c), r1: Math.max(rect.r1, r) } : { c0: c, r0: r, c1: c, r1: r };
      const k = clamp(b.strength * w, 0, 1);
      switch (b.kind) {
        case 'raise': t.heights[i] = t.heights[i]! + b.strength * w; break;
        case 'lower': t.heights[i] = t.heights[i]! - b.strength * w; break;
        case 'flatten': t.heights[i] = t.heights[i]! + ((b.target ?? 0) - t.heights[i]!) * k; break;
        case 'smooth': {
          let sum = 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const cc = c + dc, rr = r + dr;
            sum += cc < 0 || cc >= cols || rr < 0 || rr >= rows ? src[i]! : src[rr * cols + cc]!;
          }
          t.heights[i] = t.heights[i]! + (sum / 8 - src[i]!) * k;
          break;
        }
        case 'paint': if (k > 0 && b.surface !== undefined) paintNode(t, i, b.surface, k); break;
      }
    }
  }
  return rect;
}

export function applyStroke(t: Terrain, b: Brush, from: { x: number; z: number }, to: { x: number; z: number }, spacing: number): DirtyRect | null {
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  const points: { x: number; z: number }[] = [];
  if (spacing > 0 && dist > 0) {
    const n = Math.floor(dist / spacing + 1e-9);
    for (let i = 0; i <= n; i++) points.push({ x: from.x + ((to.x - from.x) * i * spacing) / dist, z: from.z + ((to.z - from.z) * i * spacing) / dist });
    if (dist - n * spacing > 1e-9) points.push({ x: to.x, z: to.z });
  } else {
    points.push({ x: from.x, z: from.z });
    if (dist > 0) points.push({ x: to.x, z: to.z });
  }
  let rect: DirtyRect | null = null;
  for (const p of points) {
    const d = applyBrush(t, { ...b, x: p.x, z: p.z });
    if (d) rect = rect ? { c0: Math.min(rect.c0, d.c0), r0: Math.min(rect.r0, d.r0), c1: Math.max(rect.c1, d.c1), r1: Math.max(rect.r1, d.r1) } : d;
  }
  return rect;
}

export function toHeightfield(t: Terrain): HeightfieldData {
  return { cols: t.spec.cols, rows: t.spec.rows, cell: t.spec.cell, heights: Array.from(t.heights), position: [t.spec.originX, 0, t.spec.originZ] };
}
