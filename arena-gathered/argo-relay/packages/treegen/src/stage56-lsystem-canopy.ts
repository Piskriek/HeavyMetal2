// ============================================================================
// File: packages/treegen/src/stage56-lsystem-canopy.ts
// Plans: Plan 01 & Plan 26 (@hm/treegen Stage 5-6 L-System Canopy & @hm/fauna Spawner)
// Purity: 100% pure deterministic placement & growth evaluation.
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export type FloraSpecies = 'fern-cluster' | 'pioneer-birch' | 'lush-conifer';

export interface DeterministicTreeInstance {
  id: string;
  species: FloraSpecies;
  x: number;
  y: number;
  z: number;
  growthScale0to1: number;
  yawRad: number;
  lodLevel: 'low' | 'mid' | 'high';
}

export interface GrazingFaunaInstance {
  id: string;
  archetype: 'meadow-strider' | 'canopy-glider';
  x: number;
  y: number;
  z: number;
  headingRad: number;
}

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Generates deterministic tree instances on a 12m grid cell around the plot
 * when min(Pxd, Vtx, Lx, Aq) >= 0.68 (Stages 5–6).
 */
export function evaluatePlotCanopyCell(
  cellX: number,
  cellZ: number,
  terrainY: number,
  waterSurfaceY: number,
  s: FourFloats
): interfaceDeterministicTreeInstance | null {
  const minFloat = Math.min(s.Pxd, s.Vtx, s.Lx, s.Aq);
  if (minFloat < 0.68) return null;

  const worldX = cellX * 12.0;
  const worldZ = cellZ * 12.0;
  const distFromGate = Math.hypot(worldX, worldZ);

  // Keep 20m around the Twin Gate pad clear of trees and skip underwater cells
  if (distFromGate < 20.0 || terrainY <= waterSurfaceY + 0.15) {
    return null;
  }

  const h = hash2D(cellX, cellZ);
  if (h > 0.58) return null; // 58% cell occupancy for natural glades

  const jitterX = (hash2D(cellX + 17, cellZ) - 0.5) * 8.0;
  const jitterZ = (hash2D(cellX, cellZ + 31) - 0.5) * 8.0;

  const species: FloraSpecies =
    h < 0.22 ? 'lush-conifer' : h < 0.42 ? 'pioneer-birch' : 'fern-cluster';

  const growthScale0to1 = Math.min(1.0, (minFloat - 0.68) / 0.22);
  const lodLevel = minFloat >= 0.85 ? 'high' : minFloat >= 0.76 ? 'mid' : 'low';

  return {
    id: `tree_${cellX}_${cellZ}`,
    species,
    x: Number((worldX + jitterX).toFixed(2)),
    y: Number(terrainY.toFixed(2)),
    z: Number((worldZ + jitterZ).toFixed(2)),
    growthScale0to1: Number(growthScale0to1.toFixed(3)),
    yawRad: Number((h * Math.PI * 2.0).toFixed(3)),
    lodLevel,
  };
}

/**
 * Spawns peaceful grazing fauna (@hm/fauna) once Stage 6 (minFloat >= 0.85) is reached.
 */
export function evaluateStage6FaunaHerds(
  s: FourFloats,
  timeSec: number
): GrazingFaunaInstance[] {
  const minFloat = Math.min(s.Pxd, s.Vtx, s.Lx, s.Aq);
  if (minFloat < 0.85) return [];

  const herds: GrazingFaunaInstance[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = timeSec * 0.08 + (i * Math.PI) / 3.0;
    const radius = i % 2 === 0 ? 48.0 : 82.0;
    herds.push({
      id: `fauna_${i}`,
      archetype: i % 3 === 0 ? 'canopy-glider' : 'meadow-strider',
      x: Number((Math.cos(angle) * radius).toFixed(2)),
      y: i % 3 === 0 ? 12.5 : 0.0,
      z: Number((Math.sin(angle) * radius).toFixed(2)),
      headingRad: Number((angle + Math.PI * 0.5).toFixed(3)),
    });
  }
  return herds;
}
