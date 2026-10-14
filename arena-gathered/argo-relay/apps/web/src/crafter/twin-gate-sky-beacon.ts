// ============================================================================
// File: apps/web/src/crafter/twin-gate-sky-beacon.ts
// Plan: Plan 12 (P1-HOUR-04 Twin Gate 80m Vertical Amber Sky Beacon for Orientation)
// ============================================================================

import * as THREE from 'three';
import type { FourFloats } from '../../../../packages/groundshader/src/stage-post.glsl';

export const GATE_BEACON_HEIGHT_M = 80.0;

/**
 * Pure helper computing the beacon opacity [0..0.45] from S = (Pxd, Vtx, Lx, Aq).
 * Prominent in dark Stage 0–2 (Lx < 0.65); fades to 0.08 in bright Stage 4 daylight.
 */
export function computeGateSkyBeaconOpacity(s: FourFloats, timeSec: number): number {
  const pulse = 0.88 + 0.12 * Math.sin(timeSec * 2.2);
  if (s.Lx < 0.60) {
    return Number((0.38 * pulse).toFixed(3));
  }
  const daylightFade = Math.max(0.08, 0.38 * (1.0 - (s.Lx - 0.60) / 0.35));
  return Number((daylightFade * pulse).toFixed(3));
}

export function createTwinGateSkyBeaconMesh(
  gateX = 0,
  gateLintelY = 3.2,
  gateZ = 0
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.18, 0.55, GATE_BEACON_HEIGHT_M, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffc13d,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'twin-gate-sky-beacon';
  mesh.position.set(gateX, gateLintelY + GATE_BEACON_HEIGHT_M * 0.5, gateZ);
  return mesh;
}
