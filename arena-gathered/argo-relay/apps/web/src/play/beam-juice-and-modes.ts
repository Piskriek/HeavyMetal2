// ============================================================================
// File: apps/web/src/play/beam-juice-and-modes.ts
// Brief: Brief 29 (P0-LIGHT-01 De-Metalling + Rim Rig, P0-VFX-01 Spiral Stream & Mode Coils)
// Rules: Rifle stays 1.0x real size; Astro wears armoured suit.
// ============================================================================

import * as THREE from 'three';

export type BeamToolMode = 'extract' | 'apply' | 'sculpt' | 'seal';

export function getBeamModeHex(mode: BeamToolMode): number {
  switch (mode) {
    case 'extract': return 0x3dc8ff; // Aq Cyan
    case 'apply':   return 0xff3d8a; // Pxd Pink
    case 'sculpt':  return 0x7cff4d; // Vtx Green
    case 'seal':    return 0xffc13d; // Lx Amber
  }
}

/**
 * Clamps material.metalness <= 0.25 on Astro's armoured suit and the real-size (1.0x) Beam Rifle
 * so they never bake or render black when scene.environment is absent in Stages 0–2 (P0-LIGHT-01).
 */
export function enforceArmouredSuitAndRifleReadability(
  rootObject: THREE.Object3D,
  attachFillLights = true
): void {
  rootObject.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (typeof std.metalness === 'number') {
        std.metalness = Math.min(std.metalness, 0.25);
        std.roughness = Math.max(std.roughness ?? 0.5, 0.38);
        std.needsUpdate = true;
      }
    }
  });

  if (attachFillLights && !rootObject.getObjectByName('astro-readability-rig')) {
    const rig = new THREE.Group();
    rig.name = 'astro-readability-rig';

    const hemi = new THREE.HemisphereLight(0x8fa8c8, 0x3d352e, 0.68);
    const rimLight = new THREE.DirectionalLight(0xdce8f8, 0.55);
    rimLight.position.set(-1.5, 2.2, -2.0);

    rig.add(hemi, rimLight);
    rootObject.add(rig);
  }
}

/**
 * Pooled 16-Instance Spiral Voxel Stream + Projected Ground Brush Ring Decal (P0-VFX-01)
 */
export class BeamExtractionJuiceVfx {
  public readonly group: THREE.Group;
  public readonly brushRingMesh: THREE.Mesh;
  public readonly chunkInstancedMesh: THREE.InstancedMesh;
  private readonly chunkCount = 16;
  private readonly dummy = new THREE.Object3D();

  constructor() {
    this.group = new THREE.Group();

    // 1. Projected Ground Brush Ring Decal
    const ringGeom = new THREE.RingGeometry(0.88, 1.0, 32);
    ringGeom.rotateX(-Math.PI * 0.5);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3dc8ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.brushRingMesh = new THREE.Mesh(ringGeom, ringMat);
    this.brushRingMesh.visible = false;
    this.group.add(this.brushRingMesh);

    // 2. 16-Instance Spiral Voxel Chunk Vacuum Stream
    const boxGeom = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x6e7888,
      roughness: 0.7,
      metalness: 0.15,
    });
    this.chunkInstancedMesh = new THREE.InstancedMesh(boxGeom, boxMat, this.chunkCount);
    this.chunkInstancedMesh.visible = false;
    this.group.add(this.chunkInstancedMesh);
  }

  public update(
    isFiring: boolean,
    mode: BeamToolMode,
    muzzleWorldPos: THREE.Vector3,
    hitWorldPos: THREE.Vector3 | null,
    brushRadiusM: number,
    timeSec: number
  ): void {
    if (!hitWorldPos) {
      this.brushRingMesh.visible = false;
      this.chunkInstancedMesh.visible = false;
      return;
    }

    const modeColor = getBeamModeHex(mode);
    (this.brushRingMesh.material as THREE.MeshBasicMaterial).color.setHex(modeColor);
    this.brushRingMesh.visible = true;
    this.brushRingMesh.position.set(hitWorldPos.x, hitWorldPos.y + 0.04, hitWorldPos.z);
    this.brushRingMesh.scale.setScalar(Math.max(0.5, brushRadiusM));

    if (!isFiring || mode !== 'extract') {
      this.chunkInstancedMesh.visible = false;
      return;
    }

    this.chunkInstancedMesh.visible = true;
    for (let i = 0; i < this.chunkCount; i++) {
      // Spiral parameter t goes from 0.0 (ground crater) to 1.0 (rifle muzzle)
      const t = ((timeSec * 2.4 + i / this.chunkCount) % 1.0);
      const spiralRadius = (1.0 - t) * t * 0.65;
      const angle = t * 14.0 + i * 1.2;

      const x = THREE.MathUtils.lerp(hitWorldPos.x, muzzleWorldPos.x, t) + Math.cos(angle) * spiralRadius;
      const y = THREE.MathUtils.lerp(hitWorldPos.y, muzzleWorldPos.y, t) + Math.sin(angle) * spiralRadius + Math.sin(t * Math.PI) * 0.35;
      const z = THREE.MathUtils.lerp(hitWorldPos.z, muzzleWorldPos.z, t);

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(timeSec * 6 + i, timeSec * 4 + i, 0);
      const s = 1.0 - t * 0.55;
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.chunkInstancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.chunkInstancedMesh.instanceMatrix.needsUpdate = true;
  }
}
