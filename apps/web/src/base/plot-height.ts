// ============================================================================
// File: apps/web/src/base/plot-height.ts
// Plan 36 Phase 1 (co-op, same terrain on both sides): the ground height a base
// is built on, as a pure function of the plot's seed and its saved sculpt text.
//
// The RUN room (apps/web/src/rooms/OutpostRoom.ts) and every client must run
// `apply` against the same heights, or the world hashes part. The play screen
// builds on `plot-ground.ts`'s heightAt; this module copies that formula:
//   height(x, z) = terrain.height(x, z) - drop(x, z) + editHeight(x, z)
// with the sculpt edit read from the same 256-cell field the beam save holds.
//
// Pure: no DOM, no Date, no Math.random, no I/O. The constants below are copies of
// play/plot-ground.ts (BOULDER_SPAN, PAINT_CELLS, the origin); they are not
// imported from there because plot-ground.ts is in Flash's F-09 work in progress.
// TODO (POL-111): plot-ground.ts should import these from here, so the two cannot drift.
// ============================================================================

import { createTerrain } from '@hm/plotterrain';
import { decodeField, heightAt as brushHeightAt, type Field } from '@hm/terrainbrush';
import { drop } from '../crafter/planet';

/** The plot's seed in the play screen (play-scene.ts creates the plot ground with `seed: 7`). */
export const OUTPOST_PLOT_SEED = 7;

/** Copied from play/plot-ground.ts: the sculpt field covers a square of this span round the gate. */
const BOULDER_SPAN = 320;
/** Copied from play/plot-ground.ts: the paint and sculpt grid. */
const PAINT_CELLS = 256;
const PAINT_CELL = BOULDER_SPAN / PAINT_CELLS;
const PAINT_ORIGIN = -BOULDER_SPAN / 2;

export interface PlotHeightOptions {
  /** The plot's terrain seed. */
  readonly seed: number;
  /** The sculpt field as text (encodeField, from the beam save). Absent or unreadable means no edits. */
  readonly sculpt?: string;
}

/**
 * The sculpt field, when the text holds a field of this plot's grid and any cut or raise. Mirrors
 * plot-ground.ts's importField: a field of another size or cell is refused and the ground stays as made.
 */
function sculptField(text: string | undefined): Field | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  const field = decodeField(text);
  if (field === null || field.size !== PAINT_CELLS || Math.abs(field.cell - PAINT_CELL) > 1e-6) return null;
  return field.delta.some((d) => d !== 0) ? field : null;
}

/**
 * The ground's height at (x, z) in planet metres, the planet's curve included, for a plot with this seed and sculpt.
 * Deterministic: the same seed and text give the same function on every machine.
 */
export function plotHeightAt(o: PlotHeightOptions): (x: number, z: number) => number {
  const terrain = createTerrain({ seed: o.seed });
  const field = sculptField(o.sculpt);
  const editHeight = (x: number, z: number): number =>
    field === null ? 0 : brushHeightAt(field, () => 0, x - PAINT_ORIGIN, z - PAINT_ORIGIN);
  return (x: number, z: number): number => terrain.height(x, z) - drop(x, z) + editHeight(x, z);
}
