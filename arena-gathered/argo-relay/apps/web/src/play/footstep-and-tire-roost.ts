// ============================================================================
// File: apps/web/src/play/footstep-and-tire-roost.ts
// Plan: Plan 17 (P2-VFX-05 Stage-Reactive Footstep & Rover Tire Roost Particles)
// Budget: Single pre-allocated InstancedMesh ring buffer (0 GC allocations/frame)
// ============================================================================

import * as THREE from 'three';
import type { FourFloats } from '../../../../packages/groundshader/src/stage-post.glsl';

interface RoostParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ageSec: number;
  maxLifeSec: number;
  scale: number;
}

export class StageReactiveRoostPool {
  public readonly instancedMesh: THREE.InstancedMesh;
  private readonly slots: RoostParticleSlot[] = [];
  private cursor = 0;
  private readonly dummy = new THREE.Object3D();
  private readonly tempColor = new THREE.Color();

  constructor(private readonly poolSize = 128) {
    const geom = new THREE.BoxGeometry(0.10, 0.10, 0.10);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.instancedMesh = new THREE.InstancedMesh(geom, mat, poolSize);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < poolSize; i++) {
      this.slots.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        ageSec: 0,
        maxLifeSec: 0.6,
        scale: 1,
      });
    }
  }

  public spawnBurst(
    originX: number,
    originY: number,
    originZ: number,
    s: FourFloats,
    inWater = false,
    count = 6
  ): void {
    const hex = inWater
      ? 0x3dc8ff // Hydro splash
      : s.Pxd < 0.20
      ? 0xe8eef5 // Stage 0 1-bit pixel
      : s.Aq >= 0.65 && s.Lx >= 0.75
      ? 0x569448 // Stage 5-6 meadow turf fleck
      : 0x7a6e5d; // Stage 1-3 regolith dust

    this.tempColor.setHex(hex);

    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.poolSize;
      const slot = this.slots[idx];
      slot.active = true;
      slot.x = originX + (Math.random() - 0.5) * 0.35;
      slot.y = originY + 0.08;
      slot.z = originZ + (Math.random() - 0.5) * 0.35;
      slot.vx = (Math.random() - 0.5) * 1.8;
      slot.vy = 1.2 + Math.random() * 1.6;
      slot.vz = (Math.random() - 0.5) * 1.8;
      slot.ageSec = 0;
      slot.maxLifeSec = 0.45 + Math.random() * 0.35;
      slot.scale = 0.8 + Math.random() * 0.6;
      this.instancedMesh.setColorAt(idx, this.tempColor);
    }
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  public step(dtSec: number, gravityMps2 = 1.62): void {
    for (let i = 0; i < this.poolSize; i++) {
      const slot = this.slots[i];
      if (!slot.active) {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      slot.ageSec += dtSec;
      if (slot.ageSec >= slot.maxLifeSec) {
        slot.active = false;
        continue;
      }

      slot.vy -= gravityMps2 * dtSec;
      slot.x += slot.vx * dtSec;
      slot.y += slot.vy * dtSec;
      slot.z += slot.vz * dtSec;

      const lifeLeft = 1.0 - slot.ageSec / slot.maxLifeSec;
      this.dummy.position.set(slot.x, slot.y, slot.z);
      this.dummy.scale.setScalar(slot.scale * lifeLeft);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
