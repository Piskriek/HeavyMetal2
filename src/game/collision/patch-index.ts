/**
 * IF-COLLISION-TERRAIN: Patch spatial index and combined surface query.
 * Combines baseline track height with all overlapping heightfield patches.
 */

import { type Patch, surfaceAtPatch } from './terrain-patch';

export interface SurfaceResult {
  y: number;
  fromPatch: boolean;
  slopeX: number;
  slopeZ: number;
}

export class PatchIndex {
  private patches: Patch[] = [];

  constructor(patches: Patch[] = []) {
    this.patches = [...patches];
  }

  setPatches(patches: Patch[]): void {
    this.patches = [...patches];
  }

  getPatches(): readonly Patch[] {
    return this.patches;
  }

  surfaceAt(x: number, z: number, baseline: number): SurfaceResult {
    let bestY = baseline;
    let fromPatch = false;
    let bestSlopeX = 0;
    let bestSlopeZ = 0;

    for (const patch of this.patches) {
      // Fast AABB pre-check
      const minX = patch.x0;
      const maxX = patch.x0 + patch.nx * patch.cellX;
      const minZ = patch.z0;
      const maxZ = patch.z0 + patch.nz * patch.cellZ;

      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;

      const hit = surfaceAtPatch(patch, x, z, baseline);
      if (hit.fromPatch && hit.y > bestY) {
        bestY = hit.y;
        fromPatch = true;
        bestSlopeX = hit.slopeX;
        bestSlopeZ = hit.slopeZ;
      }
    }

    return {
      y: bestY,
      fromPatch,
      slopeX: bestSlopeX,
      slopeZ: bestSlopeZ,
    };
  }
}

export function surfaceWithPatches(
  patches: readonly Patch[],
  x: number,
  z: number,
  baseline: number,
): SurfaceResult {
  let bestY = baseline;
  let fromPatch = false;
  let bestSlopeX = 0;
  let bestSlopeZ = 0;

  for (const patch of patches) {
    const minX = patch.x0;
    const maxX = patch.x0 + patch.nx * patch.cellX;
    const minZ = patch.z0;
    const maxZ = patch.z0 + patch.nz * patch.cellZ;

    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;

    const hit = surfaceAtPatch(patch, x, z, baseline);
    if (hit.fromPatch && hit.y > bestY) {
      bestY = hit.y;
      fromPatch = true;
      bestSlopeX = hit.slopeX;
      bestSlopeZ = hit.slopeZ;
    }
  }

  return {
    y: bestY,
    fromPatch,
    slopeX: bestSlopeX,
    slopeZ: bestSlopeZ,
  };
}
