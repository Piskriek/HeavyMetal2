// ============================================================================
// File: apps/web/src/crafter/gate-beacon-and-moss-patina.ts
// Plans: P1-HOUR-04 (Gate Sky Beacon), P1-VFX-04 (Portal Gravity Dip),
//        P2-LOOP-06 (Lattice Cable Pulse Beads), P2-LAYOUT-06 (Stage 4-6 Moss Patina)
// ============================================================================

import * as THREE from 'three';
import type { FourFloats } from '../../../../packages/groundshader/src/stage-post.glsl';

/**
 * 1. P1-HOUR-04: Twin Gate 80m Vertical Amber Telemetry Sky Beacon (Stages 0–2)
 */
export function createTwinGateSkyBeaconMesh(): {
  mesh: THREE.Mesh;
  update: (s: FourFloats, timeSec: number) => void;
} {
  const geom = new THREE.CylinderGeometry(0.18, 0.55, 80.0, 12, 1, true);
  geom.translate(0, 40.0 + 3.2, 0); // Rises from top lintel of 3.2m Twin Gate
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffc13d,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);

  const update = (s: FourFloats, timeSec: number) => {
    // Prominent in Stages 0–2; fades to a subtle marker once full sky/landmarks bloom
    const fade = s.Lx < 0.65 ? 0.22 : 0.06;
    mat.opacity = fade * (0.85 + 0.15 * Math.sin(timeSec * 3.0));
  };

  return { mesh, update };
}

/**
 * 2. P1-VFX-04: Portal Threshold Gravity-Shift Camera Dip (9.81 m/s^2 <-> 1.62 m/s^2)
 */
export interface PortalCrossingDipState {
  crossedAtSec: number | null;
  toLowGravityMoon: boolean;
}

export function evaluatePortalGravityCameraDipY(
  state: PortalCrossingDipState,
  nowSec: number
): number {
  if (state.crossedAtSec === null) return 0.0;
  const elapsed = nowSec - state.crossedAtSec;
  if (elapsed < 0 || elapsed > 0.65) return 0.0;

  // Stepping onto Moon (1.62 m/s^2) gives a buoyant +6cm lift-and-settle;
  // Stepping into Earth Lab (9.81 m/s^2) gives a heavy -9cm compression dip.
  const amp = state.toLowGravityMoon ? 0.06 : -0.09;
  return amp * Math.sin((elapsed / 0.65) * Math.PI) * Math.exp(-elapsed * 3.5);
}

/**
 * 3. P2-LOOP-06: @hm/lattice Relay Pylon Catenary Cable Energy Pulse Beads (#ffffff)
 */
export class LatticeCablePulseBeads {
  public readonly instancedMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(private readonly maxBeads = 32) {
    const geom = new THREE.BoxGeometry(0.14, 0.14, 0.28);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.instancedMesh = new THREE.InstancedMesh(geom, mat, maxBeads);
  }

  public update(
    cableSegments: Array<{ start: THREE.Vector3; end: THREE.Vector3 }>,
    timeSec: number,
    satisfactionRatio0to1: number
  ): void {
    const count = Math.min(this.maxBeads, cableSegments.length);
    this.instancedMesh.count = count;
    const speed = 0.65 * Math.max(0.25, satisfactionRatio0to1);

    for (let i = 0; i < count; i++) {
      const seg = cableSegments[i];
      const u = (timeSec * speed + i * 0.23) % 1.0;
      const x = THREE.MathUtils.lerp(seg.start.x, seg.end.x, u);
      const z = THREE.MathUtils.lerp(seg.start.z, seg.end.z, u);
      // Catenary sag curve: 4 * sag * u * (1 - u)
      const sag = 0.45 * 4.0 * u * (1.0 - u);
      const y = THREE.MathUtils.lerp(seg.start.y, seg.end.y, u) - sag;

      this.dummy.position.set(x, y, z);
      this.dummy.lookAt(seg.end);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * 4. P2-LAYOUT-06: Stage 4–6 Top-Down World-Space Moss & Patina Weathering Overlay
 * Blends emerald moss (#3b6e38) onto upward-facing normals (worldNormal.y > 0.55) of machines/foundations
 * when Aq >= 0.65 and Lx >= 0.70 (12-sheet-field-machines.png bottom row).
 */
export function computeMossPatinaFactor(s: FourFloats): number {
  if (s.Aq < 0.60 || s.Lx < 0.65) return 0.0;
  const aqFactor = Math.min(1.0, (s.Aq - 0.60) / 0.30);
  const lxFactor = Math.min(1.0, (s.Lx - 0.65) / 0.25);
  return aqFactor * lxFactor * 0.55;
}
