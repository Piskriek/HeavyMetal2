// ============================================================================
// File: apps/web/src/crafter/gate-beacon-and-moss-patina.ts
// Fix: Guarded all index reads for noUncheckedIndexedAccess
// ============================================================================

import * as THREE from 'three';
import type { FourFloats } from '../../../../packages/groundshader/src/stage-post.glsl';

export function createTwinGateSkyBeacon(): {
  mesh: THREE.Mesh;
  updateForStage: (s: FourFloats, elapsedSec: number) => void;
} {
  const geo = new THREE.CylinderGeometry(0.18, 0.42, 80.0, 12, 1, true);
  geo.translate(0, 40.0, 0);

  const posAttr = geo.attributes['position'];
  const count = posAttr ? posAttr.count : 0;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = posAttr ? posAttr.getY(i) : 0;
    const fade = Math.max(0, 1.0 - y / 80.0);
    colors[i * 3] = 1.0 * fade;
    colors[i * 3 + 1] = 0.757 * fade;
    colors[i * 3 + 2] = 0.239 * fade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'twin-gate-sky-beacon';

  const updateForStage = (s: FourFloats, elapsedSec: number) => {
    const stageFade = 1.0 - Math.min(0.75, Math.max(0, (s.Lx - 0.5) * 1.5));
    const pulse = 0.88 + 0.12 * Math.sin(elapsedSec * 2.4);
    mat.opacity = 0.42 * stageFade * pulse;
  };

  return { mesh, updateForStage };
}

export function computeMachineMossPatinaWeight(s: FourFloats): number {
  const aqFactor = Math.max(0, Math.min(1, (s.Aq - 0.65) / 0.25));
  const lxFactor = Math.max(0, Math.min(1, (s.Lx - 0.65) / 0.25));
  return Number((aqFactor * lxFactor * 0.65).toFixed(3));
}
