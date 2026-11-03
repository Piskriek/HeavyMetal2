import * as THREE from 'three';
import type { IRungNode, DensityLevel, SovereignTelemetry } from './RungTypes';

export class Rung1Atoms extends THREE.Group implements IRungNode {
  public readonly rungIndex: number = 1;
  public readonly density: DensityLevel = 'D1';
  public readonly rungName: string = 'Substrate & The Four Floats';
  public readonly scaleRangeM: readonly [number, number] = [0.001, 0.08];

  private readonly atomCloud: THREE.InstancedMesh;
  private readonly latticeGrid: THREE.LineSegments;
  private readonly dummy: THREE.Object3D = new THREE.Object3D();
  private readonly atomCount: number = 125; // 5x5x5 micro lattice
  private materials: THREE.Material[] = [];

  constructor() {
    super();

    // 1. Instanced Substrate Atoms
    const atomGeo = new THREE.SphereGeometry(0.003, 12, 12);
    const atomMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.9,
      transparent: true,
      opacity: 0.95,
    });
    this.atomCloud = new THREE.InstancedMesh(atomGeo, atomMat, this.atomCount);
    this.atomCloud.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initial lattice arrangement
    const spacing = 0.012;
    let idx = 0;
    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        for (let z = -2; z <= 2; z++) {
          this.dummy.position.set(x * spacing, y * spacing + 0.04, z * spacing);
          this.dummy.updateMatrix();
          this.atomCloud.setMatrixAt(idx, this.dummy.matrix);

          // Color by Four Floats quadrant
          const color = new THREE.Color();
          if (x > 0 && z > 0) color.setHex(0xef4444); // Pxd
          else if (x <= 0 && z > 0) color.setHex(0x10b981); // Vtx
          else if (x > 0 && z <= 0) color.setHex(0xfacc15); // Lx
          else color.setHex(0x3b82f6); // Aq
          this.atomCloud.setColorAt(idx, color);
          idx++;
        }
      }
    }
    this.atomCloud.instanceMatrix.needsUpdate = true;
    if (this.atomCloud.instanceColor) this.atomCloud.instanceColor.needsUpdate = true;

    this.add(this.atomCloud);
    this.materials.push(atomMat);

    // 2. Micro-Lattice Wireframe Grid
    const gridGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const wireGeo = new THREE.WireframeGeometry(gridGeo);
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.5,
    });
    this.latticeGrid = new THREE.LineSegments(wireGeo, gridMat);
    this.latticeGrid.position.set(0, 0.04, 0);
    this.add(this.latticeGrid);
    this.materials.push(gridMat);
  }

  public update(time: number, _dt: number, telemetry: SovereignTelemetry): void {
    // Thermal vibration of atom instances
    const thermalAmp = 0.001 * (0.5 + Math.min(2.0, telemetry.thermalJoules * 0.2));
    const spacing = 0.012;
    let idx = 0;

    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        for (let z = -2; z <= 2; z++) {
          const jitterX = Math.sin(time * 30.0 + idx) * thermalAmp;
          const jitterY = Math.cos(time * 32.0 + idx * 0.7) * thermalAmp;
          const jitterZ = Math.sin(time * 28.0 + idx * 1.3) * thermalAmp;

          this.dummy.position.set(
            x * spacing + jitterX,
            y * spacing + 0.04 + jitterY,
            z * spacing + jitterZ
          );
          this.dummy.updateMatrix();
          this.atomCloud.setMatrixAt(idx, this.dummy.matrix);
          idx++;
        }
      }
    }
    this.atomCloud.instanceMatrix.needsUpdate = true;
  }

  public setTransitionAlpha(alpha: number, isDirectFocus: boolean): void {
    this.visible = alpha > 0.001;
    for (const mat of this.materials) {
      mat.opacity = (isDirectFocus ? 0.95 : 0.4) * alpha;
    }
  }
}

