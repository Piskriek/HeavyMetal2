/**
 * NewRoads · Phase 2.2 — the road's mask is 1D-ish.
 *
 * The road ribbon has authored coordinates already: arc-length `s` along the centreline and a lateral
 * fraction `u` across it (0 = left edge, 1 = right edge). So its mask is `ROAD_MASK_ACROSS` texels wide
 * and one row per `ROAD_MASK_STEP` world units of `s`. The whole mountain (~2 000 rows) is ~130 KB in
 * memory and a few KB serialised, which is why a road gets a **one-time paint job stored on the
 * instance** and never a bake (plan §2.2, §3.2).
 *
 * The plan's 8-wide profile is `[shoulder | lane | lane | shoulder]` for a two-lane road. This track
 * has four 240-unit lanes, so the profile is 16 wide: one shoulder texel each side and 14 texels for
 * the four lanes (3.5 each). Same idea, wider road.
 *
 * Coordinates only; nothing here knows about three.js or the DOM. `road-surface-paint.ts` turns this
 * into pixels, `surface-storage.ts` puts it in a save.
 */
import { MASK_CHANNELS, SurfaceMask, type BrushStroke, type MaskRect } from './surface-mask';
import { MARK_NONE, SURFACE_GRAVEL } from './surface-table';

/** Texels across the ribbon. Column 0 and the last column are the shoulders. */
export const ROAD_MASK_ACROSS = 16;
/** World units of arc-length per row (a quarter lane; the track-space sample spacing is 50). */
export const ROAD_MASK_STEP = 60;
/** The surface the shoulders wear unless the painter holds the override modifier. */
export const ROAD_SHOULDER_SURFACE = SURFACE_GRAVEL;

export const ROAD_MASK_DOC_VERSION = 1;

/** What a road mask looks like inside a save (plan §3.1: medium object → embedded). */
export interface RoadMaskDoc {
  readonly version: typeof ROAD_MASK_DOC_VERSION;
  readonly kind: 'road';
  readonly courseId: string;
  readonly across: number;
  readonly step: number;
  /** Track length the mask was built for; a mask for a different length is rejected, not stretched. */
  readonly length: number;
  readonly hash: string;
  readonly rle: string;
  /**
   * Auto-paint pass records (see `auto-paint.ts`): which rule made this paint, with what numbers, over
   * which span. The mask is still the thing that renders; this is what makes the paint re-runnable.
   * Unknown to the v2 track document, so it round-trips without a schema change.
   */
  readonly jobs?: readonly Record<string, unknown>[];
}

export class RoadMask {
  readonly mask: SurfaceMask;
  readonly rows: number;
  readonly shoulderColumns: ReadonlySet<number>;

  constructor(
    /** Arc-length of the track this mask covers (`getTrackSpace().length`). */
    readonly length: number,
    readonly across: number = ROAD_MASK_ACROSS,
    readonly step: number = ROAD_MASK_STEP,
    mask?: SurfaceMask,
  ) {
    if (!(length > 0) || !(step > 0)) throw new Error(`[road-mask] length ${length} / step ${step}`);
    this.rows = Math.ceil(length / step) + 1;
    this.mask = mask ?? new SurfaceMask(across, this.rows);
    if (this.mask.width !== across || this.mask.height !== this.rows) {
      throw new Error(`[road-mask] mask is ${this.mask.width}×${this.mask.height}, road needs ${across}×${this.rows}`);
    }
    this.shoulderColumns = new Set([0, across - 1]);
  }

  /**
   * Auto-paint pass records that produced (or could re-produce) this mask. Owned by `AutoPaint`,
   * stored here so it rides through the save, and never interpreted by the mask itself.
   */
  jobs: Record<string, unknown>[] = [];

  // ---------------------------------------------------------------------------
  // Coordinates
  // ---------------------------------------------------------------------------

  /** Row (fractional) for an arc-length. */
  rowAt(s: number): number { return Math.max(0, Math.min(this.rows - 1e-6, s / this.step)); }
  /** Column (fractional) for a lateral fraction 0..1. */
  columnAt(u: number): number { return Math.max(0, Math.min(this.across - 1e-6, u * this.across)); }
  /** Arc-length at the centre of a row. */
  sOfRow(row: number): number { return (row + 0.5) * this.step; }

  /** Lateral fraction 0..1 from a lateral offset in world units and the local half-width. */
  static lateralFraction(lateral: number, halfWidth: number): number {
    return halfWidth > 0 ? Math.max(0, Math.min(1, 0.5 + lateral / (2 * halfWidth))) : 0.5;
  }

  // ---------------------------------------------------------------------------
  // Physics (plan §4): one index, no search
  // ---------------------------------------------------------------------------

  /** The dominant surface ID under a contact at arc-length `s`, lateral fraction `u`. */
  surfaceIdAt(s: number, u: number): number {
    return this.mask.dominantId(Math.floor(this.columnAt(u)), Math.floor(this.rowAt(s)));
  }

  /** The marking flags at `s` (flags are written per row, so any column will do). */
  markingAt(s: number): number {
    return this.mask.get(Math.floor(this.across / 2), Math.floor(this.rowAt(s))).flags;
  }

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  /**
   * A brush stamp in road coordinates. `radius` is in world units along the road; across, the same
   * world radius is converted with the local half-width so the brush is round on the ground even though
   * the texels are not square (a row is 60 units, a column is halfWidth/8).
   */
  paint(s: number, u: number, opts: {
    radius: number; hardness: number; opacity: number; surface: number; halfWidth: number; overrideShoulders?: boolean;
  }): MaskRect | null {
    const columnsPerUnit = this.across / Math.max(1, 2 * opts.halfWidth);
    const rowsPerUnit = 1 / this.step;
    const radiusRows = Math.max(0.5, opts.radius * rowsPerUnit);
    const radiusCols = Math.max(0.5, opts.radius * columnsPerUnit);
    const stroke: BrushStroke = {
      cx: this.columnAt(u), cy: this.rowAt(s),
      radius: radiusCols, aspect: radiusRows / radiusCols,
      hardness: opts.hardness, opacity: opts.opacity, surface: opts.surface,
      lockedColumns: opts.overrideShoulders ? undefined : this.shoulderColumns,
    };
    return this.mask.stamp(stroke);
  }

  /** The texel rectangle a `paint` call with these arguments can touch — snapshot it *before* the stamp for undo. */
  strokeRect(s: number, u: number, radius: number, halfWidth: number): MaskRect {
    const cols = radius * this.across / Math.max(1, 2 * halfWidth);
    const rows = radius / this.step;
    const cx = this.columnAt(u), cy = this.rowAt(s);
    return {
      x0: Math.max(0, Math.floor(cx - cols) - 1), x1: Math.min(this.across, Math.ceil(cx + cols) + 2),
      y0: Math.max(0, Math.floor(cy - rows) - 1), y1: Math.min(this.rows, Math.ceil(cy + rows) + 2),
    };
  }

  /** Lay the default shoulder surface along a span of the road (both edges). */
  fillShoulders(s0 = 0, s1 = this.length, surface = ROAD_SHOULDER_SURFACE): void {
    const y0 = Math.floor(this.rowAt(s0)), y1 = Math.ceil(this.rowAt(s1)) + 1;
    this.mask.fill({ x0: 0, y0, x1: 1, y1 }, surface);
    this.mask.fill({ x0: this.across - 1, y0, x1: this.across, y1 }, surface);
  }

  /** Set the lane-marking flags for every texel between two arc-lengths (plan §2.3 per-segment byte). */
  setMarking(s0: number, s1: number, flags: number): MaskRect {
    const y0 = Math.floor(this.rowAt(Math.min(s0, s1))), y1 = Math.min(this.rows, Math.ceil(this.rowAt(Math.max(s0, s1))) + 1);
    for (let y = y0; y < y1; y++) for (let x = 0; x < this.across; x++) this.mask.setFlags(x, y, flags);
    return { x0: 0, y0, x1: this.across, y1 };
  }

  clear(): void {
    this.mask.fill({ x0: 0, y0: 0, x1: this.across, y1: this.rows }, 0, MARK_NONE);
  }

  /** Bytes the GPU texture wraps (the same array for the life of the mask; uploads read it in place). */
  get bytes(): Uint8Array { return this.mask.data; }
  get byteLength(): number { return this.across * this.rows * MASK_CHANNELS; }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  toDoc(courseId: string): RoadMaskDoc {
    return {
      version: ROAD_MASK_DOC_VERSION, kind: 'road', courseId,
      across: this.across, step: this.step, length: this.length,
      hash: this.mask.hash(), rle: this.mask.encode(),
      ...(this.jobs.length ? { jobs: this.jobs.slice() } : {}),
    };
  }

  /**
   * Rebuild from a save. Refuses (returns null) rather than guessing when the document was written for
   * a different track length or profile — a stretched mask would put asphalt on the wrong corner.
   */
  static fromDoc(doc: unknown, expectedLength: number): RoadMask | null {
    if (!doc || typeof doc !== 'object') return null;
    const d = doc as Partial<RoadMaskDoc>;
    if (d.version !== ROAD_MASK_DOC_VERSION || d.kind !== 'road') return null;
    if (typeof d.across !== 'number' || typeof d.step !== 'number' || typeof d.length !== 'number' || typeof d.rle !== 'string') return null;
    if (Math.abs(d.length - expectedLength) > d.step) return null;
    const rows = Math.ceil(d.length / d.step) + 1;
    try {
      const mask = SurfaceMask.decode(d.across, rows, d.rle);
      if (typeof d.hash === 'string' && d.hash !== mask.hash()) return null;
      const road = new RoadMask(d.length, d.across, d.step, mask);
      // Carry the auto-paint records through, tolerating anything that is not a record we understand.
      if (Array.isArray(d.jobs)) road.jobs = d.jobs.filter((j): j is Record<string, unknown> => !!j && typeof j === 'object').slice();
      return road;
    } catch {
      return null;
    }
  }
}
