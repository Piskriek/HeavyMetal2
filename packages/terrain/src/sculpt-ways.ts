import { applyBrush, type DirtyRect, type Terrain } from './grid';

/**
 * Ways to sculpt the ground (docs/HOTBAR.md, Sculpt): the brushes sculptors use most (ZBrush, Blender, Unity terrain), each one dab at a
 * point; the island calls it along a stroke. Shapes to press (hill, crater, plateau ...) are the palette's, pressed by Stamp (terrainops).
 * Pure and deterministic, so the same function sculpts the island and draws a tool's preview on a small copy of the ground.
 */
export type SculptWay = 'raise' | 'lower' | 'smooth' | 'flatten' | 'grab' | 'clay' | 'crease' | 'terrace' | 'noise' | 'pinch' | 'erode';
export const SCULPT_WAYS: readonly SculptWay[] = ['raise', 'lower', 'smooth', 'flatten', 'grab', 'clay', 'crease', 'terrace', 'noise', 'pinch', 'erode'];

export interface SculptDab {
  readonly way: SculptWay;
  readonly x: number; readonly z: number;
  readonly radius: number;
  /** 0..1 (Terrace: the step height, 1 = 2 m). */
  readonly strength: number;
  readonly falloff: 'smooth' | 'linear' | 'flat';
  /** The other way (right button): Raise lowers, Crease builds a ridge, Clay scrapes. */
  readonly invert?: boolean;
  /** Flatten: the height to level to (where the press began). */
  readonly target?: number;
  /** Grab: where the press began, the ground as it was then, and how far the pointer has moved since. */
  readonly grab?: { readonly x: number; readonly z: number; readonly base: Float32Array; readonly dx: number; readonly dz: number };
  /** Roughen: a seed for the noise. */
  readonly seed?: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const weight = (kind: SculptDab['falloff'], d: number, radius: number): number => {
  if (d >= radius) return 0;
  const t = d / radius;
  return kind === 'smooth' ? 1 - (3 * t * t - 2 * t * t * t) : kind === 'linear' ? 1 - t : 1;
};
const grow = (rect: DirtyRect | null, c: number, r: number): DirtyRect => (rect ? { c0: Math.min(rect.c0, c), r0: Math.min(rect.r0, r), c1: Math.max(rect.c1, c), r1: Math.max(rect.r1, r) } : { c0: c, r0: r, c1: c, r1: r });
/** Integer hash noise in 0..1 (the same on every machine). */
function hashNoise(c: number, r: number, seed: number): number {
  let h = (Math.imul(c | 0, 374761393) + Math.imul(r | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Bilinear height of a snapshot at a world point (clamped to the grid). */
function sampleAt(t: Terrain, heights: Float32Array, x: number, z: number): number {
  const { cols, rows, cell, originX, originZ } = t.spec;
  const fx = clamp((x - originX) / cell, 0, cols - 1), fz = clamp((z - originZ) / cell, 0, rows - 1);
  const c = Math.min(cols - 2, Math.floor(fx)), r = Math.min(rows - 2, Math.floor(fz)), u = fx - c, v = fz - r;
  const i = r * cols + c;
  const a = heights[i]!, b = heights[i + 1]!, d = heights[i + cols]!, e = heights[i + cols + 1]!;
  return (a + (b - a) * u) * (1 - v) + (d + (e - d) * u) * v;
}

/** One dab of a way to sculpt. Returns the nodes it changed (null: none). */
export function sculptWay(t: Terrain, d: SculptDab): DirtyRect | null {
  if (!(d.radius > 0)) return null;
  switch (d.way) {
    case 'raise': case 'lower': {
      const up = (d.way === 'raise') !== !!d.invert;
      return applyBrush(t, { kind: up ? 'raise' : 'lower', x: d.x, z: d.z, radius: d.radius, strength: d.strength, falloff: d.falloff });
    }
    case 'smooth': return applyBrush(t, { kind: 'smooth', x: d.x, z: d.z, radius: d.radius, strength: d.strength, falloff: d.falloff });
    case 'flatten': return applyBrush(t, { kind: 'flatten', x: d.x, z: d.z, radius: d.radius, strength: d.strength, falloff: d.falloff, target: d.target ?? 0 });
  }
  const { cols, rows, cell, originX, originZ } = t.spec;
  // Grab works round where the press began; the others round the dab
  const cx = d.way === 'grab' && d.grab ? d.grab.x : d.x, cz = d.way === 'grab' && d.grab ? d.grab.z : d.z;
  const c0 = Math.max(0, Math.floor((cx - d.radius - originX) / cell)), c1 = Math.min(cols - 1, Math.ceil((cx + d.radius - originX) / cell));
  const r0 = Math.max(0, Math.floor((cz - d.radius - originZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((cz + d.radius - originZ) / cell));
  const src = t.heights.slice();
  // Clay and Pinch work against the average height under the brush
  let avg = 0, n = 0;
  if (d.way === 'clay' || d.way === 'pinch') {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (Math.hypot(originX + c * cell - cx, originZ + r * cell - cz) < d.radius) { avg += src[r * cols + c]!; n++; }
    avg = n ? avg / n : 0;
  }
  const at = (c: number, r: number): number => src[clamp(r, 0, rows - 1) * cols + clamp(c, 0, cols - 1)]!;
  let rect: DirtyRect | null = null;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const px = originX + c * cell, pz = originZ + r * cell, dist = Math.hypot(px - cx, pz - cz);
      if (dist >= d.radius) continue;
      const w = weight(d.falloff, dist, d.radius), i = r * cols + c, h = src[i]!;
      let next = h;
      switch (d.way) {
        case 'grab': {
          // the ground under the press follows the pointer: each node takes the height from where the drag came from
          if (!d.grab) break;
          next = sampleAt(t, d.grab.base, px - d.grab.dx * w, pz - d.grab.dz * w);
          break;
        }
        case 'clay': {
          // builds up in flat layers: raises only up to a plane a little above the ground under the brush (scrapes down to it inverted)
          const plane = avg + (d.invert ? -1 : 1) * d.strength * 0.6;
          const k = clamp(d.strength * w, 0, 1) * 0.5;
          next = d.invert ? h + (Math.min(h, plane) - h) * k : h + (Math.max(h, plane) - h) * k;
          break;
        }
        case 'crease': {
          // a sharp cut (or ridge): a narrow V along the brush's middle
          const tt = dist / d.radius, v = Math.pow(1 - tt, 3);
          next = h + (d.invert ? 1 : -1) * d.strength * 0.8 * v;
          break;
        }
        case 'terrace': {
          // steps: every height snaps toward the nearest step
          const step = Math.max(0.25, d.strength * 2);
          const level = Math.round(h / step) * step;
          next = h + (level - h) * clamp(w * 0.6, 0, 1);
          break;
        }
        case 'noise': {
          const k = (hashNoise(c, r, d.seed ?? 1) - 0.5) * 2 * 0.5 + (hashNoise(c >> 1, r >> 1, (d.seed ?? 1) + 7) - 0.5);
          next = h + k * d.strength * 0.35 * w;
          break;
        }
        case 'pinch': {
          // sharpen: away from the neighbours' average (the opposite of Smooth), so ridges and edges get crisp
          const local = (at(c - 1, r) + at(c + 1, r) + at(c, r - 1) + at(c, r + 1)) / 4;
          next = h + (h - local) * clamp(d.strength * w, 0, 1) * (d.invert ? -1 : 1);
          break;
        }
        case 'erode': {
          // settling: where the ground is steeper than it can stand, it slides down to its lowest neighbour
          const talus = cell * 0.8;
          let low = h, lc = c, lr = r;
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nh = at(c + dc, r + dr); if (nh < low) { low = nh; lc = c + dc; lr = r + dr; } }
          const excess = h - low - talus;
          if (excess > 0 && (lc !== c || lr !== r)) {
            const move = excess * 0.5 * clamp(d.strength * w, 0, 1);
            next = h - move;
            const j = clamp(lr, 0, rows - 1) * cols + clamp(lc, 0, cols - 1);
            t.heights[j] = t.heights[j]! + move;
            rect = grow(rect, lc, lr);
          }
          break;
        }
      }
      if (next !== h) { t.heights[i] = next; rect = grow(rect, c, r); }
    }
  }
  return rect;
}

/** The same dab mirrored across the line x = `mirrorX` (Symmetry, Pro), as one call: both halves change together. */
export function mirroredDab(d: SculptDab, mirrorX: number): SculptDab {
  const grab = d.grab ? { ...d.grab, x: 2 * mirrorX - d.grab.x, dx: -d.grab.dx } : undefined;
  return { ...d, x: 2 * mirrorX - d.x, ...(grab ? { grab } : {}) };
}
