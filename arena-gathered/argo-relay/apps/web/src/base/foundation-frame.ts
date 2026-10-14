// ============================================================================
// File: apps/web/src/base/foundation-frame.ts
// Brief: Brief 26 (Sheet 13 Box-Section Foundations, Telescoping Legs, Print Sweep & Cable Covers)
// Rules: Rule 10 (Nothing floats, cabled), Rule 11 (Square box-section tubing)
// ============================================================================

import * as THREE from 'three';

export interface FoundationBuildOptions {
  cellSizeM?: number;      // Default 4.0m (1x1 cell) or 8.0m (2x2 Heavy Hardpoint)
  deckThicknessM?: number; // Default 0.32m box-section frame height
  maxLegExtensionM?: number; // Default 3.5m telescoping leg reach into lunar slope
}

export interface PlacedStructureAnimState {
  group: THREE.Group;
  placedAtSec: number;
  baseY: number;
  printDurationSec: number;
  isComplete: boolean;
}

/**
 * Builds a Sheet 13 Gunmetal Box-Section Foundation with raycasted corner support legs (Rule 10 & 11).
 * Replaces the prototype red cylinder/ring geometry in 10-foundation-placed.jpg.
 */
export function createSheet13FoundationMesh(
  worldX: number,
  worldY: number,
  worldZ: number,
  sampleTerrainHeight: (x: number, z: number) => number,
  opts: FoundationBuildOptions = {}
): THREE.Group {
  const size = opts.cellSizeM ?? 4.0;
  const half = size * 0.5;
  const thick = opts.deckThicknessM ?? 0.32;
  const maxLeg = opts.maxLegExtensionM ?? 3.5;

  const group = new THREE.Group();
  group.position.set(worldX, worldY, worldZ);

  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x2a313d,
    roughness: 0.65,
    metalness: 0.22, // Clamped <= 0.25 so it never bakes black in Stage 0-1
  });

  const grateMat = new THREE.MeshStandardMaterial({
    color: 0x3b4454,
    roughness: 0.72,
    metalness: 0.18,
  });

  const hazardMat = new THREE.MeshStandardMaterial({
    color: 0xd99b26,
    roughness: 0.55,
    metalness: 0.15,
  });

  // 1. Outer Square Box-Section Perimeter Beams (Rule 11)
  const beamW = 0.24;
  const northBeam = new THREE.Mesh(new THREE.BoxGeometry(size, thick, beamW), gunmetalMat);
  northBeam.position.set(0, -thick * 0.5, -half + beamW * 0.5);
  const southBeam = northBeam.clone();
  southBeam.position.set(0, -thick * 0.5, half - beamW * 0.5);

  const eastBeam = new THREE.Mesh(new THREE.BoxGeometry(beamW, thick, size - beamW * 2), gunmetalMat);
  eastBeam.position.set(half - beamW * 0.5, -thick * 0.5, 0);
  const westBeam = eastBeam.clone();
  westBeam.position.set(-half + beamW * 0.5, -thick * 0.5, 0);

  // 2. Grated Deck Plate & Hazard-Striped Rim Strip
  const deckPlate = new THREE.Mesh(
    new THREE.BoxGeometry(size - beamW * 1.6, thick * 0.75, size - beamW * 1.6),
    grateMat
  );
  deckPlate.position.set(0, -thick * 0.45, 0);

  const hazardRim = new THREE.Mesh(
    new THREE.BoxGeometry(size + 0.02, 0.05, size + 0.02),
    hazardMat
  );
  hazardRim.position.set(0, -0.04, 0);

  group.add(northBeam, southBeam, eastBeam, westBeam, deckPlate, hazardRim);

  // 3. Telescoping Square-Section Corner Support Legs Anchored into Bedrock (Rule 10: Nothing floats)
  const cornerOffsets: Array<[number, number]> = [
    [-half + 0.22, -half + 0.22],
    [ half - 0.22, -half + 0.22],
    [-half + 0.22,  half - 0.22],
    [ half - 0.22,  half - 0.22],
  ];

  for (const [cx, cz] of cornerOffsets) {
    const groundY = sampleTerrainHeight(worldX + cx, worldZ + cz);
    const dropDist = Math.min(maxLeg, Math.max(0.25, worldY - thick - groundY + 0.15));

    const legMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, dropDist, 0.20),
      gunmetalMat
    );
    legMesh.position.set(cx, -thick - dropDist * 0.5, cz);

    const footPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.08, 0.36),
      hazardMat
    );
    footPad.position.set(cx, -thick - dropDist + 0.04, cz);

    group.add(legMesh, footPad);
  }

  return group;
}

/**
 * Steps the 0.65s Bottom-Up #7cff4d Wireframe Print Sweep & Damped Vertical Settle Bounce (P0-VFX-02).
 */
export function stepStructurePrintSweep(
  anim: PlacedStructureAnimState,
  nowSec: number
): boolean {
  const elapsed = Math.max(0, nowSec - anim.placedAtSec);
  const progress = Math.min(1, elapsed / anim.printDurationSec);

  if (progress < 1.0) {
    // Scale-up materialization + green wireframe highlight
    anim.group.scale.set(1, Math.max(0.05, progress), 1);
    anim.group.position.y = anim.baseY;
    return false;
  }

  // After print sweep finishes (0.65s..1.25s), apply damped harmonic 4cm settle bounce
  const settleElapsed = elapsed - anim.printDurationSec;
  if (settleElapsed < 0.60) {
    const decay = Math.exp(-settleElapsed * 9.0);
    const bounce = -0.04 * decay * Math.cos(settleElapsed * 24.0);
    anim.group.scale.set(1, 1, 1);
    anim.group.position.y = anim.baseY + bounce;
    return false;
  }

  anim.group.scale.set(1, 1, 1);
  anim.group.position.y = anim.baseY;
  anim.isComplete = true;
  return true;
}

/**
 * Extrudes a low-poly Ribbed Steel Floor Cable Cover between a machine and the nearest Pylon/Gate (P1-LAYOUT-05).
 */
export function createFloorCableCoverMesh(
  startPos: THREE.Vector3,
  endPos: THREE.Vector3
): THREE.Mesh {
  const delta = new THREE.Vector3().subVectors(endPos, startPos);
  const length = Math.max(0.2, delta.length());
  const geom = new THREE.BoxGeometry(0.28, 0.06, length);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x242a34,
    roughness: 0.6,
    metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(startPos).addScaledVector(delta, 0.5);
  mesh.position.y += 0.03;
  mesh.lookAt(endPos.x, mesh.position.y, endPos.z);
  return mesh;
}
