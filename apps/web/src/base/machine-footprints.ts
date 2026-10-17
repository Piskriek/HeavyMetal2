// ============================================================================
// File: apps/web/src/base/machine-footprints.ts
// Local-space AABB footprints for every field MachineKind (TICKET-01 Part F),
// fed into planetStatic via boxesToWorld([machineFootprint(kind)], matrixWorld).
// The table is a Record over MachineKind, so a new kind cannot ship without a footprint.
// Heavy kinds stand on the 0.78 m ring of play/machine-props.ts (RING_TOP_Y): their box is the base box, wider and taller.
// Zero THREE imports; 100% strict (noUncheckedIndexedAccess) compliant.
// ============================================================================

import type { MachineKind } from '@hm/plotsim';
import type { Box } from './kit-pieces';
import { packBoxBounds, type Bounds3D } from '../play/static-colliders';
import { machineSize } from './machine-inspect';

/** The heavy ring's top (play/machine-props.ts RING_TOP_Y), repeated here so this file stays free of THREE. */
const RING_TOP = 0.78;
const HEAVY: ReadonlySet<MachineKind> = new Set<MachineKind>(['heavy-mill', 'heavy-press', 'heavy-projector', 'heavy-water']);

/** The box a machine of this kind blocks: its machineSize footprint (the same numbers the prop is scaled to), grounded. */
function footprintOf(kind: MachineKind): Bounds3D {
  const s = machineSize(kind);
  const top = HEAVY.has(kind) ? RING_TOP + s.h : s.h;
  return { minX: -s.w / 2, minY: 0, minZ: -s.d / 2, maxX: s.w / 2, maxY: top, maxZ: s.d / 2 };
}

const FOOTPRINT_TABLE: Readonly<Record<MachineKind, Bounds3D>> = {
  drill: footprintOf('drill'),
  mill: footprintOf('mill'),
  press: footprintOf('press'),
  pylon: footprintOf('pylon'),
  power: footprintOf('power'),
  projector: footprintOf('projector'),
  water: footprintOf('water'),
  'heavy-mill': footprintOf('heavy-mill'),
  'heavy-press': footprintOf('heavy-press'),
  'heavy-projector': footprintOf('heavy-projector'),
  'heavy-water': footprintOf('heavy-water'),
};

/**
 * Returns one local-space collider Box for the given field machine kind.
 */
export function machineFootprint(kind: MachineKind): Box {
  const b = FOOTPRINT_TABLE[kind];
  return packBoxBounds(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
}

/** Every kind with a footprint (the test checks this list against the plot's kinds). */
export function machineFootprintKinds(): readonly MachineKind[] {
  return Object.keys(FOOTPRINT_TABLE) as MachineKind[];
}
