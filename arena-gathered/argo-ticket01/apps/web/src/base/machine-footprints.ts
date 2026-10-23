// ============================================================================
// File: apps/web/src/base/machine-footprints.ts
// Local-space AABB footprints for all field machine kinds (TICKET-01 Part F),
// fed into planetStatic via boxesToWorld([machineFootprint(kind)], matrixWorld).
// Zero THREE imports; 100% strict (noUncheckedIndexedAccess) compliant.
// ============================================================================

import type { Box } from './kit-pieces';
import type { MachineKind } from './machine-props';
import { packBoxBounds, type Bounds3D } from '../play/static-colliders';

const DEFAULT_FOOTPRINT: Bounds3D = {
  minX: -1.1,
  minY: 0.0,
  minZ: -1.1,
  maxX: 1.1,
  maxY: 2.6,
  maxZ: 1.1,
};

const FOOTPRINT_TABLE: Record<string, Bounds3D> = {
  // Canonical Sheet 12 1x1 cell (4m x 4m pad) field machines & aliases
  rockDrill: { minX: -1.1, minY: 0.0, minZ: -1.1, maxX: 1.1, maxY: 3.0, maxZ: 1.1 },
  drill: { minX: -1.1, minY: 0.0, minZ: -1.1, maxX: 1.1, maxY: 3.0, maxZ: 1.1 },
  textureMill: { minX: -1.3, minY: 0.0, minZ: -1.1, maxX: 1.3, maxY: 2.8, maxZ: 1.1 },
  mill: { minX: -1.3, minY: 0.0, minZ: -1.1, maxX: 1.3, maxY: 2.8, maxZ: 1.1 },
  shapePress: { minX: -1.3, minY: 0.0, minZ: -1.2, maxX: 1.3, maxY: 3.0, maxZ: 1.2 },
  press: { minX: -1.3, minY: 0.0, minZ: -1.2, maxX: 1.3, maxY: 3.0, maxZ: 1.2 },
  lightTower: { minX: -0.9, minY: 0.0, minZ: -0.9, maxX: 0.9, maxY: 3.5, maxZ: 0.9 },
  lightProjector: { minX: -0.9, minY: 0.0, minZ: -0.9, maxX: 0.9, maxY: 3.5, maxZ: 0.9 },
  waterGen: { minX: -1.5, minY: 0.0, minZ: -1.3, maxX: 1.5, maxY: 2.8, maxZ: 1.3 },
  waterMaker: { minX: -1.5, minY: 0.0, minZ: -1.3, maxX: 1.5, maxY: 2.8, maxZ: 1.3 },
  powerCell: { minX: -1.1, minY: 0.0, minZ: -1.0, maxX: 1.1, maxY: 2.6, maxZ: 1.0 },
  powerUnit: { minX: -1.1, minY: 0.0, minZ: -1.0, maxX: 1.1, maxY: 2.6, maxZ: 1.0 },
  relayPylon: { minX: -0.45, minY: 0.0, minZ: -0.45, maxX: 0.45, maxY: 3.4, maxZ: 0.45 },
  pylon: { minX: -0.45, minY: 0.0, minZ: -0.45, maxX: 0.45, maxY: 3.4, maxZ: 0.45 },
  presetMixer: { minX: -1.2, minY: 0.0, minZ: -1.0, maxX: 1.2, maxY: 2.6, maxZ: 1.0 },
  mixer: { minX: -1.2, minY: 0.0, minZ: -1.0, maxX: 1.2, maxY: 2.6, maxZ: 1.0 },
  weaponBench: { minX: -1.0, minY: 0.0, minZ: -0.6, maxX: 1.0, maxY: 1.4, maxZ: 0.6 },
  bench: { minX: -1.0, minY: 0.0, minZ: -0.6, maxX: 1.0, maxY: 1.4, maxZ: 0.6 },
  workbench: { minX: -1.0, minY: 0.0, minZ: -0.6, maxX: 1.0, maxY: 1.4, maxZ: 0.6 },
  vehicleBay: { minX: -2.0, minY: 0.0, minZ: -2.0, maxX: 2.0, maxY: 3.2, maxZ: 2.0 },
  vehicleFabricator: { minX: -2.0, minY: 0.0, minZ: -2.0, maxX: 2.0, maxY: 3.2, maxZ: 2.0 },
  turret: { minX: -0.8, minY: 0.0, minZ: -0.8, maxX: 0.8, maxY: 2.2, maxZ: 0.8 },
};

/**
 * Returns one local-space collider Box for the given field machine kind.
 */
export function machineFootprint(kind: MachineKind): Box {
  const key = String(kind);
  const b = FOOTPRINT_TABLE[key] ?? DEFAULT_FOOTPRINT;
  return packBoxBounds(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
}
