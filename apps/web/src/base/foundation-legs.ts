/**
 * The foundation frame's corner legs (TASK-26; sheet 13, rule 10: nothing floats). Pure: no three.js, no clock.
 *
 * A foundation is a 4 m deck. Its underside sits at `pos.y - FRAME_DECK_DEPTH_M`. Under each corner a square-section leg runs from
 * the deck's underside down to the ground there. On flat ground a corner needs no leg. On a slope the low corners get legs,
 * up to FRAME_LEG_MAX_M each. The legs stand on the terrain: each foot sits on the ground under its corner.
 */

/** The deck's depth: its top is the piece's height, its underside is this far below. */
export const FRAME_DECK_DEPTH_M = 0.5;
/** A corner leg is centred this far in from the deck's edge. */
export const FRAME_CORNER_INSET_M = 0.22;
/** The deck's side, metres (one cell). */
export const FRAME_CELL_M = 4;
/** The longest leg: the steepest slope a foundation may stand on (the same 3 m as the placement rule's skirt). */
export const FRAME_LEG_MAX_M = 3;
/** A leg shorter than this is not drawn: the ground is at the deck's underside. */
export const FRAME_LEG_MIN_M = 0.02;

/** The four corner centres, in the piece's frame (centred on the cell: the kit's pivot puts it there). */
export const FRAME_CORNERS: readonly (readonly [number, number])[] = [
  [-FRAME_CELL_M / 2 + FRAME_CORNER_INSET_M, -FRAME_CELL_M / 2 + FRAME_CORNER_INSET_M],
  [FRAME_CELL_M / 2 - FRAME_CORNER_INSET_M, -FRAME_CELL_M / 2 + FRAME_CORNER_INSET_M],
  [-FRAME_CELL_M / 2 + FRAME_CORNER_INSET_M, FRAME_CELL_M / 2 - FRAME_CORNER_INSET_M],
  [FRAME_CELL_M / 2 - FRAME_CORNER_INSET_M, FRAME_CELL_M / 2 - FRAME_CORNER_INSET_M],
];

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FrameLeg {
  /** 0..3: the index into FRAME_CORNERS. */
  readonly corner: number;
  /** The foot's world x and z. */
  readonly x: number;
  readonly z: number;
  /** The terrain height under the corner, world y. */
  readonly groundY: number;
  /** The leg's foot, world y: the deck's underside less the length (equal to groundY unless clamped). */
  readonly footY: number;
  /** The leg's length: from the deck's underside down to the foot. Between FRAME_LEG_MIN_M and FRAME_LEG_MAX_M. */
  readonly length: number;
  /** True when the ground is further below than the longest leg reaches: the foot then stops short of the ground (the placement rule should refuse the spot). */
  readonly clamped: boolean;
}

/** World x and z of a point in the piece's frame, for a piece turned by `yaw` (the same turn as makeRotationY(yaw)). */
export function frameToWorld(pos: Point3, yaw: number, u: number, v: number): { readonly x: number; readonly z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: pos.x + u * c + v * s, z: pos.z - u * s + v * c };
}

/**
 * The legs a foundation at `pos`, turned by `yaw`, needs on this ground. `groundAt(x, z)` is the terrain height.
 * Corners whose ground is at or above the deck's underside get no leg.
 */
export function planFrameLegs(pos: Point3, yaw: number, groundAt: (x: number, z: number) => number): FrameLeg[] {
  const deckUnderside = pos.y - FRAME_DECK_DEPTH_M;
  const legs: FrameLeg[] = [];
  FRAME_CORNERS.forEach(([u, v], corner) => {
    const w = frameToWorld(pos, yaw, u, v);
    const footY = groundAt(w.x, w.z);
    const wanted = deckUnderside - footY;
    if (wanted < FRAME_LEG_MIN_M) return;
    const length = Math.min(FRAME_LEG_MAX_M, wanted);
    legs.push({ corner, x: w.x, z: w.z, groundY: footY, footY: deckUnderside - length, length, clamped: wanted > FRAME_LEG_MAX_M + 1e-9 });
  });
  return legs;
}
