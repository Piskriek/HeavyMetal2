/**
 * Where the sculpt beam may not cut (TASK-21d): the gate's pad and the apron round it, every placed piece, structure and machine on
 * the plot, and a band round the edge of the editable field, so a cut never reaches the field's own edge (where the edits stop).
 * Pure: no DOM, no clock, no random. Coordinates are the planet's, in metres.
 */

export interface KeepOutZone {
  readonly x: number;
  readonly z: number;
  /** The zone's radius in metres. */
  readonly r: number;
}

/** A point on the planet, in metres. */
export interface Point {
  readonly x: number;
  readonly z: number;
}

/** The gate's pad is 3.8 m by 2.5 m; its apron is a circle of this radius round the gate. */
export const GATE_APRON = 5;
/** A structure's origin, as a fallback for a structure with no pieces yet: the widest is a 2 by 2 foundation pad, about 8 m across. */
export const STRUCTURE_REACH = 8;
/**
 * A placed piece, from its cell's centre: a cell is 4 m (the structure's CELL), so its corner is 2.83 m from the centre, and the
 * structure reads the ground up to 3 m beyond the piece (its SKIRT) for its support. A cut inside that is a cut under the piece.
 */
export const PIECE_REACH = 4 * Math.SQRT1_2 + 3;
/** A machine's footprint, from its centre (the field machines are about 3 m across). */
export const MACHINE_REACH = 4;
/** The editable field is the square of this half width round the gate (the paint field is 320 m across). */
export const FIELD_HALF = 160;
/** The outer band of the field, in metres, that no cut reaches. */
export const PLOT_EDGE = 8;

/**
 * The zones for the gate, the structures (their origins), the pieces (their cell centres) and the machines (their centres). Every
 * piece gets its own zone, so a long structure is kept out along its whole length, not only near its origin.
 */
export function keepOutZones(o: {
  readonly gate: Point;
  readonly structures: readonly Point[];
  readonly pieces: readonly Point[];
  readonly machines: readonly Point[];
}): KeepOutZone[] {
  return [
    { x: o.gate.x, z: o.gate.z, r: GATE_APRON },
    ...o.structures.map((p): KeepOutZone => ({ x: p.x, z: p.z, r: STRUCTURE_REACH })),
    ...o.pieces.map((p): KeepOutZone => ({ x: p.x, z: p.z, r: PIECE_REACH })),
    ...o.machines.map((p): KeepOutZone => ({ x: p.x, z: p.z, r: MACHINE_REACH })),
  ];
}

/**
 * Whether a cut at (x, z) is kept out: inside a zone, or outside the field's inner square (the outer band, and everything beyond
 * the field). A broken coordinate is kept out.
 */
export function keptOut(zones: readonly KeepOutZone[], x: number, z: number, half = FIELD_HALF, edge = PLOT_EDGE): boolean {
  if (!(Math.abs(x) < half - edge && Math.abs(z) < half - edge)) return true;
  for (const zone of zones) {
    const dx = x - zone.x;
    const dz = z - zone.z;
    if (dx * dx + dz * dz < zone.r * zone.r) return true;
  }
  return false;
}
