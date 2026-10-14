// ============================================================================
// File: apps/web/src/crafter/plume-point-lights.ts
// Fix: Guarded all index reads for noUncheckedIndexedAccess
// ============================================================================

import * as THREE from 'three';

export interface ActivePlumeEmitter {
  id: string;
  x: number;
  y: number;
  z: number;
  colorHex: number;
  isRunning: boolean;
}

export const MAX_POOLED_PLUME_LIGHTS = 6;
export const PLUME_LIGHT_DISTANCE_M = 14.0;

export function selectNearestActivePlumeLights(
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  graphicsTier: 'Low' | 'Mid' | 'High' | 'Ultra',
  emitters: ActivePlumeEmitter[]
): ActivePlumeEmitter[] {
  if (graphicsTier === 'Low' || graphicsTier === 'Mid') {
    return [];
  }

  return emitters
    .filter((e) => e.isRunning)
    .map((e) => ({
      emitter: e,
      distSq:
        (e.x - cameraX) ** 2 + (e.y - cameraY) ** 2 + (e.z - cameraZ) ** 2,
    }))
    .sort((a, b) => a.distSq - b.distSq)
    .slice(0, MAX_POOLED_PLUME_LIGHTS)
    .map((item) => item.emitter);
}

export class PlumePointLightPool {
  private readonly lights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < MAX_POOLED_PLUME_LIGHTS; i++) {
      const light = new THREE.PointLight(0xff3d8a, 0, PLUME_LIGHT_DISTANCE_M, 2.0);
      light.visible = false;
      scene.add(light);
      this.lights.push(light);
    }
  }

  public update(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    graphicsTier: 'Low' | 'Mid' | 'High' | 'Ultra',
    emitters: ActivePlumeEmitter[]
  ): void {
    const selected = selectNearestActivePlumeLights(
      cameraX,
      cameraY,
      cameraZ,
      graphicsTier,
      emitters
    );

    for (let i = 0; i < MAX_POOLED_PLUME_LIGHTS; i++) {
      const light = this.lights[i];
      if (!light) continue;
      const target = selected[i];
      if (!target) {
        light.visible = false;
        light.intensity = 0;
        continue;
      }
      light.visible = true;
      light.color.setHex(target.colorHex);
      light.intensity = 1.65;
      light.position.set(target.x, target.y + 1.2, target.z);
    }
  }
}
