// ============================================================================
// File: apps/web/src/lab/planet-table-hologram.ts
// Plan: Plan 10 (P1-LORE-05 Diegetic Planet Table Hologram & Continent Sync Branches)
// ============================================================================

import * as THREE from 'three';
import type { FourFloats } from '../../../../packages/groundshader/src/stage-post.glsl';

export interface NeighborEnclaveBranch {
  id: string;
  commanderName: string;
  azimuthDeg: number;
  distanceKm: number; // Typically 1.4 km .. 4.2 km on the shared horizon
  stage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  consensusWeight0to1: number;
}

export const CANONICAL_11_NEIGHBOR_ENCLAVES: NeighborEnclaveBranch[] = [
  { id: 'enclave-01', commanderName: 'Sector-Vance',  azimuthDeg: 18,  distanceKm: 1.8, stage: 3, consensusWeight0to1: 0.88 },
  { id: 'enclave-02', commanderName: 'Kestrel-04',    azimuthDeg: 48,  distanceKm: 2.4, stage: 2, consensusWeight0to1: 0.72 },
  { id: 'enclave-03', commanderName: 'Basalt-Nine',   azimuthDeg: 82,  distanceKm: 3.1, stage: 4, consensusWeight0to1: 0.94 },
  { id: 'enclave-04', commanderName: 'Meridian-Lab',  azimuthDeg: 115, distanceKm: 2.1, stage: 1, consensusWeight0to1: 0.55 },
  { id: 'enclave-05', commanderName: 'Obra-Station',  azimuthDeg: 148, distanceKm: 3.8, stage: 0, consensusWeight0to1: 0.35 },
  { id: 'enclave-06', commanderName: 'Helios-Array',  azimuthDeg: 180, distanceKm: 2.9, stage: 3, consensusWeight0to1: 0.84 },
  { id: 'enclave-07', commanderName: 'Verdant-Fork',  azimuthDeg: 212, distanceKm: 1.6, stage: 5, consensusWeight0to1: 0.96 },
  { id: 'enclave-08', commanderName: 'Cinder-Dock',   azimuthDeg: 245, distanceKm: 4.1, stage: 2, consensusWeight0to1: 0.68 },
  { id: 'enclave-09', commanderName: 'Lumen-Spire',   azimuthDeg: 278, distanceKm: 2.6, stage: 4, consensusWeight0to1: 0.91 },
  { id: 'enclave-10', commanderName: 'Hydro-Basin',   azimuthDeg: 312, distanceKm: 3.4, stage: 3, consensusWeight0to1: 0.82 },
  { id: 'enclave-11', commanderName: 'Canopy-Prime',  azimuthDeg: 344, distanceKm: 2.2, stage: 6, consensusWeight0to1: 1.00 },
];

/**
 * Pure helper computing the continental majority consensus percentage from the player's
 * local S = (Pxd, Vtx, Lx, Aq) and the 11 neighboring enclave branches.
 */
export function computeContinentalConsensusSummary(
  localS: FourFloats,
  enclaves: NeighborEnclaveBranch[] = CANONICAL_11_NEIGHBOR_ENCLAVES
): {
  localMeanFidelity: number;
  continentalConsensusPct: number;
  syncedEnclaveCount: number;
  statusHeadline: string;
} {
  const localMean = (localS.Pxd + localS.Vtx + localS.Lx + localS.Aq) * 0.25;
  const synced = enclaves.filter((e) => e.consensusWeight0to1 >= 0.65).length;
  const meanEnclaveWeight =
    enclaves.reduce((acc, e) => acc + e.consensusWeight0to1, 0) / Math.max(1, enclaves.length);

  const combined = Math.min(1.0, localMean * 0.45 + meanEnclaveWeight * 0.55);
  const continentalConsensusPct = Number((combined * 100).toFixed(1));

  const statusHeadline =
    continentalConsensusPct >= 85.0
      ? 'MAJORITY CONSENSUS LOCKED // CONTINENTAL SUBSTRATE STABLE'
      : continentalConsensusPct >= 55.0
      ? `CONSENSUS FORMING (${continentalConsensusPct}%) // ${synced}/11 ENCLAVES SYNCED`
      : `SUBSTRATE FRAGMENTED (${continentalConsensusPct}%) // RAISE LOCAL FIDELITY`;

  return {
    localMeanFidelity: Number(localMean.toFixed(3)),
    continentalConsensusPct,
    syncedEnclaveCount: synced,
    statusHeadline,
  };
}

/**
 * Builds the Three.js hologram group mounted atop the 2.4m round Planet Table in the Lab.
 */
export function buildPlanetTableHologramGroup(
  enclaves: NeighborEnclaveBranch[] = CANONICAL_11_NEIGHBOR_ENCLAVES
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'planet-table-amber-hologram';

  // Wireframe 40,000 km globe crown
  const globeMat = new THREE.MeshBasicMaterial({
    color: 0xffc13d,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), globeMat);
  globe.position.y = 1.15;
  group.add(globe);

  // Center Lunar Twin Gate Anchor pin (#7cff4d)
  const gatePin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8),
    new THREE.MeshBasicMaterial({ color: 0x7cff4d })
  );
  gatePin.position.set(0, 1.15, 0);
  group.add(gatePin);

  // 11 Neighboring Enclave Domes around the table rim
  for (const enc of enclaves) {
    const rad = (enc.azimuthDeg * Math.PI) / 180;
    const r = (enc.distanceKm / 4.2) * 0.78;
    const domeColor =
      enc.stage >= 4 ? 0x7cff4d : enc.stage >= 2 ? 0xffc13d : 0x3dc8ff;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({ color: domeColor, wireframe: true })
    );
    dome.position.set(Math.cos(rad) * r, 1.02, Math.sin(rad) * r);
    group.add(dome);
  }

  return group;
}
