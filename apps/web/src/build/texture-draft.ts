import { sculptWay, type SculptDab, type Terrain } from '@hm/terrain';
import { stamp, type StampKind } from '@hm/terrainops';

/**
 * Texture mode (MASTER_PLAN 6.4): a surface's tile as something you edit with the hotbar. Paint's ways change its colours, Sculpt's ways its
 * height (so its bumps: the ground makes the normal from it), and Animate makes it move on the island. Every dab wraps round the tile's
 * edges, so an edit can never make a seam. Pure: the bench draws it and the island puts it on the ground.
 */
export interface TexDraft {
  readonly size: number;
  /** sRGB colour, RGBA (alpha unused). */
  readonly colour: Uint8ClampedArray;
  /** Height 0..1. */
  readonly height: Float32Array;
  /** Roughness 0..255. */
  readonly rough: Uint8ClampedArray;
  /** The tile as it was when you stepped in: the Eraser brings it back. */
  readonly base: { readonly colour: Uint8ClampedArray; readonly height: Float32Array };
  /** The height as a terrain (in "metres": HEIGHT_SCALE per unit of height) for Sculpt's ways. */
  readonly ground: Terrain;
}

/** Terrain units per unit of tile height: sculpt strengths are made for metres, a tile's height is 0..1. */
const HEIGHT_SCALE = 8;

/** A draft from a tile as the ground draws it (colour with the height in alpha; the PBR map's blue is the roughness). */
export function draftFromTile(colour: ArrayLike<number>, pbr: ArrayLike<number>, size: number): TexDraft {
  const n = size * size;
  const c = new Uint8ClampedArray(n * 4), h = new Float32Array(n), r = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    c[i * 4] = colour[i * 4]!; c[i * 4 + 1] = colour[i * 4 + 1]!; c[i * 4 + 2] = colour[i * 4 + 2]!; c[i * 4 + 3] = 255;
    h[i] = colour[i * 4 + 3]! / 255; r[i] = pbr[i * 4 + 2]!;
  }
  const ground: Terrain = { spec: { cols: size, rows: size, cell: 1, originX: 0, originZ: 0 }, heights: new Float32Array(n), surfaceA: new Uint8Array(n), surfaceB: new Uint8Array(n), blend: new Uint8Array(n) };
  for (let i = 0; i < n; i++) ground.heights[i] = h[i]! * HEIGHT_SCALE;
  return { size, colour: c, height: h, rough: r, base: { colour: c.slice(), height: h.slice() }, ground };
}

/** Texture mode's undo: the draft as it was before each stroke (the last 12), and the strokes undone (for redo). */
export interface DraftHistory { readonly undo: { colour: Uint8ClampedArray; height: Float32Array }[]; readonly redo: { colour: Uint8ClampedArray; height: Float32Array }[] }
export const newHistory = (): DraftHistory => ({ undo: [], redo: [] });
const snap = (d: TexDraft): { colour: Uint8ClampedArray; height: Float32Array } => ({ colour: d.colour.slice(), height: d.height.slice() });
function put(d: TexDraft, s: { colour: Uint8ClampedArray; height: Float32Array }): void {
  d.colour.set(s.colour); d.height.set(s.height);
  for (let i = 0; i < d.height.length; i++) d.ground.heights[i] = d.height[i]! * HEIGHT_SCALE;
}
/** Before a stroke: remember the draft (a new stroke forgets what was undone). */
export function rememberDraft(d: TexDraft, h: DraftHistory): void { h.undo.push(snap(d)); if (h.undo.length > 12) h.undo.shift(); h.redo.length = 0; }
/** Undo (or redo) one stroke; false when there is none. */
export function undoDraft(d: TexDraft, h: DraftHistory, redo = false): boolean {
  const from = redo ? h.redo : h.undo, to = redo ? h.undo : h.redo;
  const s = from.pop();
  if (!s) return false;
  to.push(snap(d));
  put(d, s);
  return true;
}

/** The draft as the ground's tile: colour (RGBA) and maps (R = height, G = roughness). */
export function draftToTile(d: TexDraft): { colour: Uint8Array; maps: Uint8Array } {
  const n = d.size * d.size, colour = new Uint8Array(n * 4), maps = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    colour[i * 4] = d.colour[i * 4]!; colour[i * 4 + 1] = d.colour[i * 4 + 1]!; colour[i * 4 + 2] = d.colour[i * 4 + 2]!; colour[i * 4 + 3] = 255;
    maps[i * 4] = Math.round(Math.min(1, Math.max(0, d.height[i]!)) * 255); maps[i * 4 + 1] = d.rough[i]!; maps[i * 4 + 3] = 255;
  }
  return { colour, maps };
}

/** Every copy of a dab that touches the tile (the dab itself and its wrapped neighbours across the edges). */
function wrapped(x: number, y: number, radius: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    const cx = x + ox, cy = y + oy;
    if (cx + radius >= 0 && cx - radius < size && cy + radius >= 0 && cy - radius < size) out.push([cx, cy]);
  }
  return out;
}
/** A small seeded random (mulberry32). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type TexPaintWay = 'brush' | 'spray' | 'fill' | 'gradient' | 'stamp' | 'pattern' | 'clone' | 'smudge' | 'eraser';

/** One dab of a way to paint at (x, y) in tile pixels. `rgb` is the palette's colour. Returns whether anything changed. */
export function paintDraft(d: TexDraft, way: TexPaintWay, x: number, y: number, radius: number, strength: number, rgb: readonly [number, number, number], seed: number): boolean {
  const { size, colour } = d;
  if (way === 'fill') {
    // the whole tile takes the colour, keeping its light and dark (a tint)
    const k = Math.min(1, strength);
    for (let i = 0; i < size * size; i++) {
      const lum = (colour[i * 4]! * 0.3 + colour[i * 4 + 1]! * 0.59 + colour[i * 4 + 2]! * 0.11) / 160;
      for (let c = 0; c < 3; c++) colour[i * 4 + c] = colour[i * 4 + c]! + (rgb[c]! * lum - colour[i * 4 + c]!) * k;
    }
    return true;
  }
  const rnd = rng(seed);
  const spots: [number, number, number][] = way === 'spray'
    ? Array.from({ length: 14 }, () => { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * radius; return [x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(1.5, radius * 0.12)] as [number, number, number]; })
    : [[x, y, radius]];
  const src = way === 'smudge' ? colour.slice() : null;
  let changed = false;
  for (const [sx, sy, sr] of spots) {
    for (const [cx, cy] of wrapped(sx, sy, sr, size)) {
      const x0 = Math.max(0, Math.floor(cx - sr)), x1 = Math.min(size - 1, Math.ceil(cx + sr));
      const y0 = Math.max(0, Math.floor(cy - sr)), y1 = Math.min(size - 1, Math.ceil(cy + sr));
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const dist = Math.hypot(px - cx, py - cy);
        if (dist >= sr) continue;
        const t = dist / sr, w = (way === 'brush' || way === 'smudge' || way === 'gradient' ? 1 - t * t * (3 - 2 * t) : 1) * Math.min(1, strength);
        const i = (py * size + px) * 4;
        if (way === 'eraser') {
          for (let c = 0; c < 3; c++) colour[i + c] = colour[i + c]! + (d.base.colour[i + c]! - colour[i + c]!) * w;
          d.height[i / 4] = d.height[i / 4]! + (d.base.height[i / 4]! - d.height[i / 4]!) * w;
          d.ground.heights[i / 4] = d.height[i / 4]! * HEIGHT_SCALE;
        } else if (way === 'smudge' && src) {
          // pull the colour from a little towards the middle of the dab
          const qx = Math.round(px + (cx - px) * 0.25), qy = Math.round(py + (cy - py) * 0.25);
          const j = ((((qy % size) + size) % size) * size + (((qx % size) + size) % size)) * 4;
          for (let c = 0; c < 3; c++) colour[i + c] = colour[i + c]! + (src[j + c]! - colour[i + c]!) * w * 0.6;
        } else {
          // the colour goes on with the tile's own light and dark showing through, so painted ground keeps its shapes
          const lum = 0.55 + 0.9 * ((colour[i]! * 0.3 + colour[i + 1]! * 0.59 + colour[i + 2]! * 0.11) / 255 - 0.4);
          for (let c = 0; c < 3; c++) colour[i + c] = colour[i + c]! + (Math.min(255, rgb[c]! * lum) - colour[i + c]!) * w;
        }
        changed = true;
      }
    }
  }
  return changed;
}

/** One dab of a way to sculpt the tile's height (the same ways as the island's ground), or a shape stamped. Returns whether anything changed. */
export function sculptDraft(d: TexDraft, way: SculptDab['way'] | 'stamp', x: number, y: number, radius: number, strength: number, invert: boolean, shape: StampKind = 'mound'): boolean {
  let changed = false;
  for (const [cx, cy] of wrapped(x, y, radius, d.size)) {
    if (way === 'stamp') changed = !!stamp(d.ground as never, invert && shape === 'mound' ? 'crater' : shape, [cx, cy], radius, { height: strength * 3, seed: 7, rotation: 0 }) || changed;
    else changed = !!sculptWay(d.ground, { way, x: cx, z: cy, radius, strength: way === 'smooth' || way === 'pinch' ? Math.min(1, strength * 1.5) : strength * 0.5, falloff: 'smooth', invert, seed: 9, ...(way === 'flatten' ? { target: d.ground.heights[Math.round(y) * d.size + Math.round(x)] ?? 0 } : {}) }) || changed;
  }
  if (changed) for (let i = 0; i < d.size * d.size; i++) d.height[i] = Math.min(1, Math.max(0, d.ground.heights[i]! / HEIGHT_SCALE));
  return changed;
}

/** The draft lit from the top left by its own height: how it reads on the ground (sRGB RGBA). */
export function litDraft(d: TexDraft, relief = 0.1): Uint8ClampedArray {
  const { size } = d, out = new Uint8ClampedArray(size * size * 4), k = relief * size * 0.5;
  const h = (x: number, y: number): number => d.height[(((y + size) % size) * size) + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * k, dy = (h(x, y + 1) - h(x, y - 1)) * k;
    const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), nx = -dx * inv, ny = -dy * inv, nz = inv;
    const lit = 0.3 * (0.55 + 0.45 * nz) + (0.7 / 0.64) * Math.max(0, nx * -0.54 + ny * -0.54 + nz * 0.64);
    const i = (y * size + x) * 4;
    out[i] = d.colour[i]! * lit; out[i + 1] = d.colour[i + 1]! * lit; out[i + 2] = d.colour[i + 2]! * lit; out[i + 3] = 255;
  }
  return out;
}

/** The colours a tile is mostly made of (for the palette in texture mode): a few picked across its brightness. */
export function draftColours(d: TexDraft, count = 8): [number, number, number][] {
  const n = d.size * d.size, idx = Array.from({ length: 512 }, (_, k) => Math.floor((k * 7919) % n));
  const lum = (i: number): number => d.colour[i * 4]! * 0.3 + d.colour[i * 4 + 1]! * 0.59 + d.colour[i * 4 + 2]! * 0.11;
  idx.sort((a, b) => lum(a) - lum(b));
  return Array.from({ length: count }, (_, k) => { const i = idx[Math.floor(((k + 0.5) / count) * idx.length)]!; return [d.colour[i * 4]!, d.colour[i * 4 + 1]!, d.colour[i * 4 + 2]!]; });
}

/** How a surface can move on the island (Animate in texture mode): flow x, y in tiles a second; pulse a second (negative: sway); pulse strength. */
export const TEX_ANIMS: readonly { readonly id: string; readonly name: string; readonly icon: string; readonly v: readonly [number, number, number, number] }[] = [
  { id: 'still', name: 'Still', icon: 'Square', v: [0, 0, 0, 0] },
  { id: 'flow', name: 'Flow', icon: 'Waves', v: [0.06, 0.02, 0, 0] },
  { id: 'river', name: 'Fast flow', icon: 'Wind', v: [0.25, 0.05, 0, 0] },
  { id: 'sway', name: 'Sway', icon: 'Repeat', v: [0.03, 0.03, -0.35, 0] },
  { id: 'pulse', name: 'Pulse', icon: 'HeartPulse', v: [0, 0, 0.6, 0.35] },
  { id: 'shimmer', name: 'Shimmer', icon: 'Sparkles', v: [0.02, 0.01, 2.2, 0.18] },
  { id: 'molten', name: 'Molten', icon: 'Flame', v: [0.015, 0.01, 0.35, 0.6] },
];
