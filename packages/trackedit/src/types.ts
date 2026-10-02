/**
 * Core value types for `trackedit` — the pure model behind a track drawing tool.
 *
 * Everything here is plain data: no DOM, no globals, no clock, no randomness.
 * All operations in this package are pure / immutable and deterministic, so a
 * draft can be serialised, diffed, undone and replayed safely.
 */

/** A point on the ground plane, in metres: `[x, z]`. */
export type Vec2 = readonly [number, number];

/** A user-placed control point. */
export interface ControlPoint {
  x: number;
  z: number;
  /** Local road width override in metres (falls back to `TrackDraft.width`). */
  width?: number;
}

/** The editable track being drawn. */
export interface TrackDraft {
  points: readonly ControlPoint[];
  closed: boolean;
  /** Default road width in metres. */
  width: number;
}

/** Result of picking against a draft (control points first, then segments). */
export interface Hit {
  kind: 'point' | 'segment' | 'none';
  /** Point index, or the start index of the segment; `-1` for `none`. */
  index: number;
  distance: number;
  /** Parameter along the hit segment, `0..1`. */
  t?: number;
}

/** Validation / measurement report for a draft. */
export interface Analysis {
  valid: boolean;
  issues: string[];
  length: number;
  /** Smallest turn radius on the centreline in metres; `Infinity` for a straight line. */
  minRadius: number;
  /** Centreline indices whose turn radius is below the road width. */
  tightAt: number[];
  selfIntersects: boolean;
  bbox: { minX: number; minZ: number; maxX: number; maxZ: number };
}
