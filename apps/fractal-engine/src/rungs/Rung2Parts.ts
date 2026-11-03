import * as THREE from 'three';
import type { IRungNode, DensityLevel, SovereignTelemetry } from './RungTypes';

export class Rung2Parts extends THREE.Group implements IRungNode {
  public readonly rungIndex: number = 2;
  public readonly density: DensityLevel = 'D2';
  public readonly rungName: string = 'Articulated Parts & Kinematic Joints';
  public readonly scaleRangeM: readonly [number, number] = [0.05, 1.2];

  private readonly wheels: THREE.Mesh[] = [];
  private readonly suspensionLimbs: THREE.Mesh[] = [];
  private materials: THREE.Material[] = [];

  constructor() {
    super();

    // 4 Hubs at standard @hm/rover wheelbase: track 1.6, wheelbase 2.2
    const hubOffsets: [number, number, number][] = [
      [-0.8, 0.35, 1.1],   // Front-Left
      [0.8, 0.35, 1.1],    // Front-Right
      [-0.8, 0.35, -1.1],  // Rear-Left
      [0.8, 0.35, -1.1],   // Rear-Right
    ];

    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 24);
    wheelGeo.rotateZ(Math.PI * 0.5);

    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 0.95,
    });
    this.materials.push(wheelMat);

    const suspensionMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.3,
      metalness: 0.8,
      transparent: true,
      opacity: 0.95,
    });
    this.materials.push(suspensionMat);

    hubOffsets.forEach(([hx, hy, hz]) => {
      // Wheel Mesh
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(hx, hy, hz);
      this.add(wheel);
      this.wheels.push(wheel);

      // Conformal G_{4,1} suspension strut
      const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12);
      const strut = new THREE.Mesh(strutGeo, suspensionMat);
      strut.position.set(hx * 0.75, hy + 0.15, hz);
      strut.rotation.z = hx > 0 ? 0.35 : -0.35;
      this.add(strut);
      this.suspensionLimbs.push(strut);
    });
  }

  public update(_time: number, dt: number, telemetry: SovereignTelemetry): void {
    // Wheel spin derived from momentum p_z
    const speed = telemetry.p[2] * 2.0;
    for (const wheel of this.wheels) {
      wheel.rotation.x += speed * dt;
    }

    // Suspension travel reacting to altitude h_IK from plant state
    const ikOffset = (telemetry.xi[2] - 0.70) * 0.2;
    for (const strut of this.suspensionLimbs) {
      strut.scale.set(1.0, Math.max(0.6, 1.0 + ikOffset), 1.0);
    }
  }

  public setTransitionAlpha(alpha: number, isDirectFocus: boolean): void {
    this.visible = alpha > 0.001;
    for (const mat of this.materials) {
      mat.opacity = (isDirectFocus ? 0.95 : 0.4) * alpha;
    }
  }
}

