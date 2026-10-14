// ============================================================================
// File: apps/web/src/crafter/plume-point-lights.ts
// Closes: POL-02 & POL-03 (P2-LIGHT-06 High/Ultra Pooled Plume Ground Glow)
// Rules: Rule 20 (Zero cost on Low spec) & Rule 21 (Toggled on High/Ultra)
// ============================================================================

import * as THREE from 'three';
import type { GraphicsQualityTier } from '../../../../packages/groundshader/src/radial-scan-wave';

export interface ActivePlumeLightSource {
  id: string;
  x: number;
  y: number;
  z: number;
  colorHex: number;
  isRunning: boolean;
}

export class PooledPlumePointLights {
  public readonly group = new THREE.Group();
  private readonly lights: THREE.PointLight[] = [];

  constructor(private readonly poolSize = 4) {
    for (let i = 0; i < poolSize; i++) {
      const light = new THREE.PointLight(0xff3d8a, 0.0, 14.0, 2.0);
      light.castShadow = false;
      light.visible = false;
      this.lights.push(light);
      this.group.add(light);
    }
  }

  public update(
    tier: GraphicsQualityTier,
    cameraPos: THREE.Vector3,
    plumes: ActivePlumeLightSource[],
    timeSec: number
  ): void {
    // Rule 20 & Rule 21: Strictly disabled on Low/Medium so GTX 950M hits 60 FPS
    if (tier === 'low' || tier === 'medium') {
      for (const light of this.lights) {
        light.visible = false;
        light.intensity = 0.0;
      }
      return;
    }

    const active = plumes
      .filter((p) => p.isRunning)
      .map((p) => ({
        ...p,
        dist: Math.hypot(p.x - cameraPos.x, p.y - cameraPos.y, p.z - cameraPos.z),
      }))
      .filter((p) => p.dist <= 40.0)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, this.poolSize);

    for (let i = 0; i < this.poolSize; i++) {
      const light = this.lights[i];
      const src = active[i];
      if (!src) {
        light.visible = false;
        light.intensity = 0.0;
        continue;
      }
      light.visible = true;
      light.color.setHex(src.colorHex);
      // Hover 1.8m above exhaust stack to cast bounce glow onto surrounding grass & housing
      light.position.set(src.x, src.y + 1.8 + Math.sin(timeSec * 2.4 + i) * 0.25, src.z);
      light.intensity = 1.35 * (0.9 + 0.1 * Math.sin(timeSec * 4.0 + i));
    }
  }
}
