// ============================================================================
// File: apps/web/src/base/plot-height.ts
// Plan 36 Phase 1 & 2 (co-op, same terrain on both sides + POL-111 & POL-112):
// The ground height a base is built on, as a pure function of the plot's seed,
// its saved sculpt text, and the Moon Twin Gate's footing pad.
//
// Pure: no DOM, no Date, no Math.random, no I/O.
// Exports BOULDER_SPAN, PAINT_CELLS, PAINT_CELL, PAINT_ORIGIN so plot-ground.ts
// and plot-height.ts share one source of truth (POL-111), and includes the
// Moon Twin Gate footing pad (|lx| < 1.9, |lz| < 1.25 -> gateHeight + 0.25 m)
// so OutpostRoom and PlayScene.heightAt agree on every point (POL-112).
// ============================================================================

import { createTerrain } from '@hm/plotterrain';
import { decodeField, heightAt as brushHeightAt, type Field } from '@hm/terrainbrush';
import { drop } from '../crafter/planet';

/** The plot's seed in the play screen (play-scene.ts creates the plot ground with `seed: 7`). */
export const OUTPOST_PLOT_SEED = 7;

/** Shared terrain constants (POL-111): the sculpt field covers a square of this span round the gate. */
export const BOULDER_SPAN = 320;
/** Shared paint and sculpt grid resolution (POL-111). */
export const PAINT_CELLS = 256;
export const PAINT_CELL = BOULDER_SPAN / PAINT_CELLS;
export const PAINT_ORIGIN = -BOULDER_SPAN / 2;

/** Moon Twin Gate footing pad bounds & lift in metres (POL-112: matches play-scene.ts groundAt). */
export const GATE_PAD_HALF_X = 1.9;
export const GATE_PAD_HALF_Z = 1.25;
export const GATE_PAD_LIFT = 0.25;

export interface GatePadSpec {
  readonly x?: number;
  readonly z?: number;
  readonly yaw?: number;
  /** Default true: includes the +0.25 m footing pad around the Moon Twin Gate (POL-112). */
  readonly enabled?: boolean;
}

export interface PlotHeightOptions {
  /** The plot's terrain seed. */
  readonly seed: number;
  /** The sculpt field as text (encodeField, from the beam save). Absent or unreadable means no edits. */
  readonly sculpt?: string;
  /** Optional Moon Twin Gate pose for the footing pad (defaults to origin (0, 0), yaw 0, enabled: true). */
  readonly gate?: GatePadSpec | false;
}

/**
 * Returns true when world point `(x, z)` lies strictly inside the Moon Twin Gate's
 * rectangular footing pad (`|localX| < 1.9` and `|localZ| < 1.25`, POL-112).
 */
export function isInsideGatePad(
  x: number,
  z: number,
  gate?: { readonly x?: number; readonly z?: number; readonly yaw?: number },
): boolean {
  const gx = gate?.x ?? 0;
  const gz = gate?.z ?? 0;
  const yaw = gate?.yaw ?? 0;
  const dx = x - gx;
  const dz = z - gz;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) < GATE_PAD_HALF_X && Math.abs(lz) < GATE_PAD_HALF_Z;
}

/**
 * The sculpt field, when the text holds a field of this plot's grid and any cut or raise. Mirrors
 * plot-ground.ts's importField: a field of another size or cell is refused and the ground stays as made.
 */
export function parseSculptField(text: string | undefined): Field | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  const field = decodeField(text);
  if (field === null || field.size !== PAINT_CELLS || Math.abs(field.cell - PAINT_CELL) > 1e-6) return null;
  return field.delta.some((d) => d !== 0) ? field : null;
}

/**
 * The ground's height at (x, z) in planet metres, including the planet's curve, the sculpt field,
 * and the Moon Twin Gate's footing pad (`padTop = rawHeightAt(gateX, gateZ) + 0.25` inside
 * `|lx| < 1.9, |lz| < 1.25`, POL-112).
 * Deterministic: the same seed and text give the same function on every machine.
 */
export function plotHeightAt(o: PlotHeightOptions): (x: number, z: number) => number {
  const terrain = createTerrain({ seed: o.seed });
  const field = parseSculptField(o.sculpt);
  const editHeight = (x: number, z: number): number =>
    field === null ? 0 : brushHeightAt(field, () => 0, x - PAINT_ORIGIN, z - PAINT_ORIGIN);
  const rawHeight = (x: number, z: number): number =>
    terrain.height(x, z) - drop(x, z) + editHeight(x, z);

  if (o.gate === false || (o.gate && o.gate.enabled === false)) {
    return rawHeight;
  }

  const gx = o.gate?.x ?? 0;
  const gz = o.gate?.z ?? 0;
  const gyaw = o.gate?.yaw ?? 0;
  const padTop = rawHeight(gx, gz) + GATE_PAD_LIFT;

  return (x: number, z: number): number => {
    if (isInsideGatePad(x, z, { x: gx, z: gz, yaw: gyaw })) {
      return padTop;
    }
    return rawHeight(x, z);
  };
}
