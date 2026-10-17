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

const FOOTPRINT_TABLE: Readonly<Record<MachineKind, Bounds3D>> = {
  drill: { minX: -1.1, minY: 0.0, minZ: -1.1, maxX: 1.1, maxY: 3.0, maxZ: 1.1 },
  mill: { minX: -1.3, minY: 0.0, minZ: -1.1, maxX: 1.3, maxY: 2.8, maxZ: 1.1 },
  press: { minX: -1.3, minY: 0.0, minZ: -1.2, maxX: 1.3, maxY: 3.0, maxZ: 1.2 },
  pylon: { minX: -0.45, minY: 0.0, minZ: -0.45, maxX: 0.45, maxY: 3.4, maxZ: 0.45 },
  power: { minX: -1.1, minY: 0.0, minZ: -1.0, maxX: 1.1, maxY: 2.6, maxZ: 1.0 },
  projector: { minX: -0.9, minY: 0.0, minZ: -0.9, maxX: 0.9, maxY: 3.5, maxZ: 0.9 },
  water: { minX: -1.5, minY: 0.0, minZ: -1.3, maxX: 1.5, maxY: 2.8, maxZ: 1.3 },
  'heavy-mill': { minX: -1.5, minY: 0.0, minZ: -1.3, maxX: 1.5, maxY: 3.6, maxZ: 1.3 },
  'heavy-press': { minX: -1.5, minY: 0.0, minZ: -1.4, maxX: 1.5, maxY: 3.8, maxZ: 1.4 },
  'heavy-projector': { minX: -1.1, minY: 0.0, minZ: -1.1, maxX: 1.1, maxY: 4.3, maxZ: 1.1 },
  'heavy-water': { minX: -1.7, minY: 0.0, minZ: -1.5, maxX: 1.7, maxY: 3.6, maxZ: 1.5 },
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
