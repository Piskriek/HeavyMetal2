// ============================================================================
// File: packages/treegen/src/stage56-lsystem-canopy.ts
// Fix: Fixed "export interface DeterministicTreeInstance" typo + guarded index reads
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export interface DeterministicTreeInstance {
  id: string;
  species: 'conifer-pine' | 'broadleaf-birch' | 'fern-cluster';
  x: number;
  y: number;
  z: number;
  scale: number;
  yawRad: number;
}

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function generateStage56CanopyInstances(
  s: FourFloats,
  gateX: number,
  gateZ: number,
  sampleHeightAt: (x: number, z: number) => number,
  waterLevelY = -1.2
): DeterministicTreeInstance[] {
  if (s.Lx < 0.72 || s.Aq < 0.60 || s.Vtx < 0.70) {
    return [];
  }

  const maturity = Math.min(1.0, (s.Lx - 0.70) / 0.25);
  const instances: DeterministicTreeInstance[] = [];
  const stepM = 14;

  for (let gx = -168; gx <= 168; gx += stepM) {
    for (let gz = -168; gz <= 168; gz += stepM) {
      const distFromGate = Math.hypot(gx - gateX, gz - gateZ);
      if (distFromGate < 26.0) continue;

      const h = hash2D(gx, gz);
      if (h > 0.38 * maturity) continue;

      const jitterX = gx + (hash2D(gx + 13, gz) - 0.5) * 8.0;
      const jitterZ = gz + (hash2D(gx, gz + 29) - 0.5) * 8.0;
      const groundY = sampleHeightAt(jitterX, jitterZ);

      if (groundY < waterLevelY + 0.25 || groundY > 14.0) continue;

      const species: DeterministicTreeInstance['species'] =
        groundY < waterLevelY + 1.8
          ? 'fern-cluster'
          : h < 0.18
          ? 'broadleaf-birch'
          : 'conifer-pine';

      instances.push({
        id: `tree_${gx}_${gz}`,
        species,
        x: Number(jitterX.toFixed(2)),
        y: Number(groundY.toFixed(2)),
        z: Number(jitterZ.toFixed(2)),
        scale: Number((0.65 + maturity * (0.45 + (h % 0.3))).toFixed(2)),
        yawRad: Number((h * Math.PI * 2.0).toFixed(3)),
      });
    }
  }

  return instances;
}
