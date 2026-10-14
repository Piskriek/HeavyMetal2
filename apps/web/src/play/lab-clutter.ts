// The lab's clutter (TASK-23c): fifteen props in the corners and along the walls of the lab (lab frame: x right, y up, z towards
// the start, north = -z). A salvage prop is cleared with a held E: it dissolves, and its salvage goes into the pack (the base's
// `salvage` command). Two fixtures stay, re-readable and never cleared: the old monitor and the one server rack (the owner's decision).
// Pure data and geometry, so the layout is checked by a test.
import type { Stack } from '@hm/lattice';

export type ClutterRole = 'salvage' | 'fixture';

export interface ClutterItem {
  /** The save key (a cleared salvage prop is never given again). */
  readonly id: string;
  /** The name the prompt uses. */
  readonly label: string;
  /** The generated model (registry id). */
  readonly model: string;
  /** Centre of the footprint, lab metres (the model's origin is at its base centre). */
  readonly x: number;
  readonly z: number;
  /** Turn about y, radians (0 faces +z). */
  readonly yaw: number;
  /** The footprint before the turn (along the model's x and z) and the height, metres. */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly role: ClutterRole;
  /** The Bridge Incident Log this prop holds (LOG-01 to LOG-08), when it has one. */
  readonly log?: string;
}

export const CLUTTER: readonly ClutterItem[] = [
  // fixtures: the observation desk's monitor in the east corner, the telemetry bay's rack by the power wall's north end
  { id: 'old-monitor', label: 'old monitor', model: 'old-monitor', x: 7.68, z: -8.6, yaw: -Math.PI / 2, w: 0.42, d: 0.43, h: 0.5, role: 'fixture', log: 'LOG-01' },
  { id: 'server-rack', label: 'server rack', model: 'server-rack', x: -4.6, z: -6.0, yaw: 0, w: 1.02, d: 0.95, h: 2.0, role: 'fixture', log: 'LOG-02' },
  // the east wall, right bay, and the floor by the armory and the combiner
  { id: 'filing-cabinet', label: 'filing cabinet', model: 'filing-cabinet', x: 7.55, z: -1.6, yaw: -Math.PI / 2, w: 0.66, d: 0.66, h: 1.3, role: 'salvage', log: 'LOG-03' },
  { id: 'sample-case', label: 'sample case', model: 'sample-case', x: 6.85, z: -0.85, yaw: 0.35, w: 0.49, d: 0.5, h: 0.45, role: 'salvage', log: 'LOG-04' },
  { id: 'crate-large', label: 'large crate', model: 'crate-large', x: 4.5, z: -2.7, yaw: 0.1, w: 1.27, d: 1.22, h: 1.2, role: 'salvage' },
  { id: 'cardboard-stack', label: 'cardboard stack', model: 'cardboard-stack', x: 6.2, z: -2.55, yaw: -0.2, w: 0.58, d: 0.6, h: 0.9, role: 'salvage' },
  { id: 'workbench-old', label: 'old workbench', model: 'workbench-old-a', x: 5.5, z: -0.95, yaw: 0, w: 1.36, d: 1.22, h: 1.0, role: 'salvage' },
  // the north-east corner, clear of the window
  { id: 'gas-cabinet', label: 'gas cabinet', model: 'gas-cabinet-c', x: 5.5, z: -7.0, yaw: 0, w: 0.7, d: 0.62, h: 0.7, role: 'salvage' },
  { id: 'crate-small', label: 'small crate', model: 'crate-small', x: 6.55, z: -6.2, yaw: 0.6, w: 0.52, d: 0.51, h: 0.5, role: 'salvage' },
  { id: 'coolant-can', label: 'coolant can', model: 'coolant-can', x: 6.55, z: -4.95, yaw: 0, w: 0.47, d: 0.47, h: 0.5, role: 'salvage' },
  // the south wall, her corner and the south-west corner (their backs to the wall, facing into the room)
  { id: 'shelving-closed', label: 'closed shelving', model: 'shelving-closed-b', x: -6.45, z: 2.55, yaw: Math.PI, w: 2.06, d: 0.67, h: 2.2, role: 'salvage' },
  { id: 'locker', label: 'locker', model: 'locker', x: -4.6, z: 2.45, yaw: Math.PI, w: 0.86, d: 0.8, h: 1.9, role: 'salvage' },
  { id: 'specimen-freezer', label: 'specimen freezer', model: 'specimen-freezer-a', x: 4.25, z: 2.5, yaw: Math.PI, w: 0.74, d: 0.77, h: 0.8, role: 'salvage' },
  { id: 'tool-cabinet', label: 'tool cabinet', model: 'tool-cabinet-a', x: 3.15, z: 2.45, yaw: Math.PI, w: 1.32, d: 0.83, h: 1.8, role: 'salvage' },
  { id: 'toolbox', label: 'toolbox', model: 'toolbox', x: 2.05, z: 2.6, yaw: 0, w: 0.39, d: 0.39, h: 0.35, role: 'salvage' },
];

/** The lab's clutter models, once each (the preload's list). */
export const CLUTTER_MODELS: readonly string[] = [...new Set(CLUTTER.map((c) => c.model))];

/** The prop's footprint as an axis-aligned box after its turn: the rotated footprint's bounds, [min x, min z, max x, max z]. */
export function clutterFootprint(c: ClutterItem): readonly [number, number, number, number] {
  const cos = Math.abs(Math.cos(c.yaw)), sin = Math.abs(Math.sin(c.yaw));
  const hw = (c.w * cos + c.d * sin) / 2, hd = (c.w * sin + c.d * cos) / 2;
  return [c.x - hw, c.z - hd, c.x + hw, c.z + hd];
}

const PRIMITIVES: readonly string[] = ['prim-beam', 'prim-column', 'prim-chassis', 'prim-cube'];

/**
 * What a salvage prop gives, scaled to its size: ore from its volume (one to ten), and one primitive for a medium prop or two for a
 * large one (the primitive is chosen by the prop's place in the list, so it is the same every time). A fixture gives nothing.
 */
export function salvageFor(c: ClutterItem): readonly Stack[] {
  if (c.role !== 'salvage') return [];
  const vol = c.w * c.d * c.h;
  const ore = Math.max(1, Math.min(10, Math.round(vol * 6)));
  const index = CLUTTER.indexOf(c);
  const prims = vol < 0.2 ? 0 : vol < 0.8 ? 1 : 2;
  const out: Stack[] = [{ item: 'ore', n: ore }];
  for (let k = 0; k < prims; k++) out.push({ item: PRIMITIVES[(index + k) % PRIMITIVES.length]!, n: 1 });
  return out;
}

/** The clutter by id. */
export function clutterById(id: string): ClutterItem | null {
  return CLUTTER.find((c) => c.id === id) ?? null;
}
