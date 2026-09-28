/**
 * NewRoads · Phase 1.1 / 1.3 / 5 — the material-ID + weight mask, and the brush that edits it.
 *
 *   mask texel = { id0: u8, id1: u8, weight: u8 (blend id0 → id1), flags: u8 }
 *
 * Why this and not an RGBA splat (plan §1.1): 256 surfaces at the cost of two, only ever two surface
 * samples per pixel, and the dominant ID is a byte the physics can read on the CPU (§4). The cost is a
 * hard two-way blend per texel; the brush's feathering hides it.
 *
 * This file is the CPU half. It owns the bytes, stamps brushes into them, tracks the dirty rectangle
 * the GPU upload needs, snapshots rectangles for undo (§5: dirty-rect snapshots, never full copies) and
 * round-trips itself through a run-length + base64 string small enough to embed in a save (§3.1).
 *
 * Pure TypeScript: no three.js, no DOM. `tests/surface-mask.test.ts` asserts the brush laws headlessly.
 */

export const MASK_CHANNELS = 4;

export interface MaskRect {
  readonly x0: number;
  readonly y0: number;
  /** Exclusive. */
  readonly x1: number;
  /** Exclusive. */
  readonly y1: number;
}

export interface MaskTexel {
  id0: number;
  id1: number;
  weight: number;
  flags: number;
}

export interface BrushStroke {
  /** Centre, in texel units (fractional). */
  readonly cx: number;
  readonly cy: number;
  /** Radius in texels. */
  readonly radius: number;
  /** 0 = fully feathered, 1 = hard edge. */
  readonly hardness: number;
  /** Strength per stamp, 0–1. */
  readonly opacity: number;
  /** The surface being painted. Painting surface 0 is the eraser. */
  readonly surface: number;
  /** Columns the brush must not touch (road shoulders, §2.2) unless the caller overrides. */
  readonly lockedColumns?: ReadonlySet<number>;
  /** Anisotropic brushes for the 8-wide road mask: scale the y radius (along the road) separately. */
  readonly aspect?: number;
}

/** A rectangle of texels saved before a stroke, restored by undo. */
export interface MaskSnapshot {
  readonly rect: MaskRect;
  readonly bytes: Uint8Array;
}

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class SurfaceMask {
  readonly data: Uint8Array;
  private dirty: MaskRect | null = null;

  constructor(readonly width: number, readonly height: number, data?: Uint8Array) {
    if (!(width > 0) || !(height > 0) || !Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error(`[surface-mask] invalid size ${width}×${height}`);
    }
    const size = width * height * MASK_CHANNELS;
    if (data && data.length !== size) throw new Error(`[surface-mask] data has ${data.length} bytes, expected ${size}`);
    this.data = data ?? new Uint8Array(size);
  }

  /** Byte offset of a texel. */
  index(x: number, y: number): number {
    return (y * this.width + x) * MASK_CHANNELS;
  }

  get(x: number, y: number, out: MaskTexel = { id0: 0, id1: 0, weight: 0, flags: 0 }): MaskTexel {
    const i = this.index(x, y);
    out.id0 = this.data[i]; out.id1 = this.data[i + 1]; out.weight = this.data[i + 2]; out.flags = this.data[i + 3];
    return out;
  }

  set(x: number, y: number, t: Readonly<MaskTexel>): void {
    const i = this.index(x, y);
    this.data[i] = t.id0; this.data[i + 1] = t.id1; this.data[i + 2] = t.weight; this.data[i + 3] = t.flags;
    this.touch(x, y);
  }

  /**
   * The surface the physics feels at a texel: whichever of the two IDs holds more than half the blend.
   * O(1), no allocation — a wheel contact can call this every step (plan §4).
   */
  dominantId(x: number, y: number): number {
    const i = this.index(x, y);
    return this.data[i + 2] < 128 ? this.data[i] : this.data[i + 1];
  }

  /** Whether a texel has anything painted on it at all (an all-zero texel renders the untouched road). */
  isPainted(x: number, y: number): boolean {
    const i = this.index(x, y);
    return this.data[i] !== 0 || this.data[i + 1] !== 0;
  }

  setFlags(x: number, y: number, flags: number): void {
    this.data[this.index(x, y) + 3] = flags & 0xff;
    this.touch(x, y);
  }

  // ---------------------------------------------------------------------------
  // Brush
  // ---------------------------------------------------------------------------

  /**
   * The rule per texel (plan §1.3), applied with strength `a = opacity · falloff`:
   *  - painting S where `id1 == S` → raise weight;
   *  - painting S where `id0 == S` → lower weight;
   *  - otherwise S replaces the **weaker** slot and starts at strength `a`.
   * Returns the rectangle it touched (also merged into the dirty rect), or null if nothing changed.
   */
  stamp(stroke: BrushStroke): MaskRect | null {
    const aspect = stroke.aspect ?? 1;
    const rx = Math.max(0.5, stroke.radius);
    const ry = Math.max(0.5, stroke.radius * aspect);
    const x0 = clampInt(Math.floor(stroke.cx - rx), 0, this.width);
    const x1 = clampInt(Math.ceil(stroke.cx + rx) + 1, 0, this.width);
    const y0 = clampInt(Math.floor(stroke.cy - ry), 0, this.height);
    const y1 = clampInt(Math.ceil(stroke.cy + ry) + 1, 0, this.height);
    if (x1 <= x0 || y1 <= y0) return null;
    const hardness = clamp01(stroke.hardness);
    const opacity = clamp01(stroke.opacity);
    const surface = stroke.surface & 0xff;
    let touched = false;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (stroke.lockedColumns?.has(x)) continue;
        // Normalised distance from the brush centre to the texel centre.
        const dx = (x + 0.5 - stroke.cx) / rx;
        const dy = (y + 0.5 - stroke.cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        // Feather: flat inside `hardness`, smooth to zero at the rim.
        const t = hardness >= 1 ? 0 : clamp01((d - hardness) / (1 - hardness));
        const falloff = 1 - t * t * (3 - 2 * t);
        const a = opacity * falloff;
        if (a <= 0) continue;
        if (this.applyToTexel(x, y, surface, a)) touched = true;
      }
    }
    if (!touched) return null;
    const rect = { x0, y0, x1, y1 };
    this.mergeDirty(rect);
    return rect;
  }

  /** The per-texel law, exposed so the test can pin it without a brush geometry in the way. */
  applyToTexel(x: number, y: number, surface: number, strength: number): boolean {
    const i = this.index(x, y);
    const id0 = this.data[i];
    const id1 = this.data[i + 1];
    const w = this.data[i + 2];
    const delta = Math.round(strength * 255);
    if (delta <= 0) return false;
    if (id0 === id1) {
      // A solid texel (both slots the same, weight irrelevant). Painting the same surface is a no-op;
      // painting another opens the second slot for it.
      if (id0 === surface) return false;
      this.data[i + 1] = surface;
      this.data[i + 2] = Math.min(255, delta);
      return true;
    }
    if (id1 === surface) {
      const next = Math.min(255, w + delta);
      if (next === w) return false;
      this.data[i + 2] = next;
      return true;
    }
    if (id0 === surface) {
      const next = Math.max(0, w - delta);
      if (next === w) return false;
      this.data[i + 2] = next;
      return true;
    }
    // Neither slot holds S: it takes the weaker one. Weight measures id1's presence, so id1 is the
    // weaker slot below 128 and id0 above it.
    if (w < 128) {
      this.data[i + 1] = surface;
      this.data[i + 2] = Math.min(255, delta);
    } else {
      this.data[i] = surface;
      this.data[i + 2] = Math.max(0, 255 - delta);
    }
    return true;
  }

  /** Fill a rectangle solidly with one surface (used for the shoulder default and for tests). */
  fill(rect: MaskRect, surface: number, flags?: number): void {
    const x0 = clampInt(rect.x0, 0, this.width), x1 = clampInt(rect.x1, 0, this.width);
    const y0 = clampInt(rect.y0, 0, this.height), y1 = clampInt(rect.y1, 0, this.height);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = this.index(x, y);
        this.data[i] = surface; this.data[i + 1] = surface; this.data[i + 2] = 0;
        if (flags !== undefined) this.data[i + 3] = flags & 0xff;
      }
    }
    if (x1 > x0 && y1 > y0) this.mergeDirty({ x0, y0, x1, y1 });
  }

  // ---------------------------------------------------------------------------
  // Dirty tracking (the GPU upload reads this) and undo snapshots
  // ---------------------------------------------------------------------------

  /** The rectangle changed since the last call, and clears it. */
  takeDirty(): MaskRect | null {
    const rect = this.dirty;
    this.dirty = null;
    return rect;
  }

  peekDirty(): MaskRect | null { return this.dirty; }

  private touch(x: number, y: number) { this.mergeDirty({ x0: x, y0: y, x1: x + 1, y1: y + 1 }); }

  private mergeDirty(rect: MaskRect) {
    const d = this.dirty;
    this.dirty = d
      ? { x0: Math.min(d.x0, rect.x0), y0: Math.min(d.y0, rect.y0), x1: Math.max(d.x1, rect.x1), y1: Math.max(d.y1, rect.y1) }
      : rect;
  }

  /** Copy a rectangle out (before a stroke) so undo can put it back. Cost is the rectangle, not the mask. */
  snapshot(rect: MaskRect): MaskSnapshot {
    const x0 = clampInt(rect.x0, 0, this.width), x1 = clampInt(rect.x1, 0, this.width);
    const y0 = clampInt(rect.y0, 0, this.height), y1 = clampInt(rect.y1, 0, this.height);
    const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
    const bytes = new Uint8Array(w * h * MASK_CHANNELS);
    for (let y = 0; y < h; y++) {
      const src = this.index(x0, y0 + y);
      bytes.set(this.data.subarray(src, src + w * MASK_CHANNELS), y * w * MASK_CHANNELS);
    }
    return { rect: { x0, y0, x1, y1 }, bytes };
  }

  restore(snap: MaskSnapshot): void {
    const { x0, y0, x1, y1 } = snap.rect;
    const w = x1 - x0, h = y1 - y0;
    for (let y = 0; y < h; y++) {
      this.data.set(snap.bytes.subarray(y * w * MASK_CHANNELS, (y + 1) * w * MASK_CHANNELS), this.index(x0, y0 + y));
    }
    if (w > 0 && h > 0) this.mergeDirty(snap.rect);
  }

  // ---------------------------------------------------------------------------
  // Persistence: run-length over texels, then base64. A 16×2000 road mask that is mostly one surface
  // serialises to a few hundred bytes; a busy one to a few KB. Either embeds in a JSON save.
  // ---------------------------------------------------------------------------

  /** FNV-1a over the bytes, hex. Names a mask by content (sidecar keys, "did anything change" checks). */
  hash(): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < this.data.length; i++) {
      h ^= this.data[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  encode(): string {
    const d = this.data;
    const out: number[] = [];
    const texels = this.width * this.height;
    let i = 0;
    while (i < texels) {
      const o = i * MASK_CHANNELS;
      let run = 1;
      while (i + run < texels && run < 255) {
        const p = (i + run) * MASK_CHANNELS;
        if (d[p] !== d[o] || d[p + 1] !== d[o + 1] || d[p + 2] !== d[o + 2] || d[p + 3] !== d[o + 3]) break;
        run++;
      }
      out.push(run, d[o], d[o + 1], d[o + 2], d[o + 3]);
      i += run;
    }
    return bytesToBase64(Uint8Array.from(out));
  }

  static decode(width: number, height: number, encoded: string): SurfaceMask {
    const mask = new SurfaceMask(width, height);
    const bytes = base64ToBytes(encoded);
    const texels = width * height;
    let i = 0;
    for (let p = 0; p + 4 < bytes.length && i < texels; p += 5) {
      const run = bytes[p];
      for (let k = 0; k < run && i < texels; k++, i++) {
        const o = i * MASK_CHANNELS;
        mask.data[o] = bytes[p + 1]; mask.data[o + 1] = bytes[p + 2]; mask.data[o + 2] = bytes[p + 3]; mask.data[o + 3] = bytes[p + 4];
      }
    }
    if (i !== texels) throw new Error(`[surface-mask] encoded stream covers ${i} of ${texels} texels`);
    return mask;
  }
}

/* -----------------------------------------------------------------------------
   base64 that works in the browser and in a node test without Buffer typings
   -------------------------------------------------------------------------- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += b === undefined ? '=' : B64[(n >> 6) & 63];
    out += c === undefined ? '=' : B64[n & 63];
  }
  return out;
}

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12)
      | ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6)
      | (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    out.push((n >> 16) & 255);
    if (i + 2 < clean.length) out.push((n >> 8) & 255);
    if (i + 3 < clean.length) out.push(n & 255);
  }
  return Uint8Array.from(out);
}
