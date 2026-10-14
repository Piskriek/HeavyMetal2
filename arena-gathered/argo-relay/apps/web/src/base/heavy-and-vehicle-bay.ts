// ============================================================================
// File: apps/web/src/base/heavy-and-vehicle-bay.ts
// Brief: Brief 32 (Sheet 17 Heavy Terraformers, Sheet 19 Vehicle Gantry & Sheet 20 Turret)
// Rules: Rule 10 (Nothing floats), Rule 11 (Square tubing, round barrel), Rule 16 (Sockets)
// ============================================================================

import * as THREE from 'three';

export type HeavyTerraformerType = 'heavy-shape' | 'heavy-light' | 'heavy-water';

export interface HeavyTerraformerSpec {
  id: HeavyTerraformerType;
  sheetNumber: number;
  requiredHardpointSizeM: number; // Strictly 8.0m (2x2 foundation cells)
  powerDrawKw: number;
  floatMultiplier: number;        // 4.0x standard field unit output
  primaryMetric: 'Vtx' | 'Lx' | 'Aq';
  plumeColorHex: number;
}

export const SHEET17_HEAVY_TERRAFORMERS: Record<HeavyTerraformerType, HeavyTerraformerSpec> = {
  'heavy-shape': {
    id: 'heavy-shape',
    sheetNumber: 28,
    requiredHardpointSizeM: 8.0,
    powerDrawKw: 18.0,
    floatMultiplier: 4.0,
    primaryMetric: 'Vtx',
    plumeColorHex: 0x7cff4d,
  },
  'heavy-light': {
    id: 'heavy-light',
    sheetNumber: 29,
    requiredHardpointSizeM: 8.0,
    powerDrawKw: 20.0,
    floatMultiplier: 4.0,
    primaryMetric: 'Lx',
    plumeColorHex: 0xffc13d,
  },
  'heavy-water': {
    id: 'heavy-water',
    sheetNumber: 30,
    requiredHardpointSizeM: 8.0,
    powerDrawKw: 22.0,
    floatMultiplier: 4.0,
    primaryMetric: 'Aq',
    plumeColorHex: 0x3dc8ff,
  },
};

export interface VehicleCargoSocketSpec {
  vehicleType: 'modular-scout' | 'heavy-crawler';
  rearSocketsLocalPos: Array<[number, number, number]>; // Rule 16 rear bed sockets
  yokeSocketLocalPos: [number, number, number];        // Empty cab square [-u-] yoke socket (Rule 12)
  aerialRaycastStartLocalPos: [number, number, number];// Top shell aerial raycast origin (P0-VEH-03)
}

export const VEHICLE_MODULAR_SOCKETS: Record<'modular-scout' | 'heavy-crawler', VehicleCargoSocketSpec> = {
  'modular-scout': {
    vehicleType: 'modular-scout',
    rearSocketsLocalPos: [[0.0, 0.85, -1.35]], // 1 rear socket for Linked Ore Bin or Coherence Beacon
    yokeSocketLocalPos: [0.0, 0.92, 0.55],
    aerialRaycastStartLocalPos: [-0.45, 2.2, -0.85],
  },
  'heavy-crawler': {
    vehicleType: 'heavy-crawler',
    rearSocketsLocalPos: [
      [-0.75, 1.15, -1.6],
      [ 0.75, 1.15, -1.6],
      [ 0.0,  1.25, -2.5], // Rearmost socket can mount a mobile 2 kW Perimeter Turret
    ],
    yokeSocketLocalPos: [0.0, 1.35, 1.25],
    aerialRaycastStartLocalPos: [-0.70, 2.8, -0.95],
  },
};

/**
 * Raycasts the modular vehicle's aerial onto the top rear shell so it never floats (Rule 10 & P0-VEH-03).
 */
export function snapVehicleAerialToShell(
  chassisMesh: THREE.Object3D,
  aerialMesh: THREE.Object3D,
  spec: VehicleCargoSocketSpec
): void {
  const raycaster = new THREE.Raycaster();
  const worldStart = chassisMesh.localToWorld(
    new THREE.Vector3(...spec.aerialRaycastStartLocalPos)
  );
  raycaster.set(worldStart, new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObject(chassisMesh, true);
  if (hits.length > 0) {
    const localHit = chassisMesh.worldToLocal(hits[0].point.clone());
    aerialMesh.position.copy(localHit);
  } else {
    aerialMesh.position.set(
      spec.aerialRaycastStartLocalPos[0],
      spec.aerialRaycastStartLocalPos[1] - 0.65,
      spec.aerialRaycastStartLocalPos[2]
    );
  }
}

/**
 * Builds the Sheet 20 Automated Perimeter Defense Turret (2 kW draw, square receiver + round barrel per Rule 11)
 * with a visible #ffc13d targeting sightline laser.
 */
export function createPerimeterTurretRig(): {
  group: THREE.Group;
  headPivot: THREE.Group;
  laserLine: THREE.Line;
  aimAtWorldTarget: (targetWorldPos: THREE.Vector3 | null) => void;
} {
  const group = new THREE.Group();
  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x2b323f,
    roughness: 0.6,
    metalness: 0.22,
  });

  // Square-section tripod plinth (Rule 11)
  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), gunmetal);
  basePlinth.position.y = 0.275;
  group.add(basePlinth);

  // Rotating square-section receiver head + round barrel (Rule 11: round only for gun barrels)
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.72;
  const receiverBox = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.68), gunmetal);
  const roundBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.75, 12),
    gunmetal
  );
  roundBarrel.rotation.x = Math.PI * 0.5;
  roundBarrel.position.set(0, 0, 0.55);
  headPivot.add(receiverBox, roundBarrel);
  group.add(headPivot);

  // #ffc13d Targeting Laser Sightline
  const laserGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0.9),
    new THREE.Vector3(0, 0, 12.0),
  ]);
  const laserMat = new THREE.LineBasicMaterial({ color: 0xffc13d, transparent: true, opacity: 0.85 });
  const laserLine = new THREE.Line(laserGeom, laserMat);
  laserLine.visible = false;
  headPivot.add(laserLine);

  const aimAtWorldTarget = (targetWorldPos: THREE.Vector3 | null) => {
    if (!targetWorldPos) {
      laserLine.visible = false;
      return;
    }
    headPivot.lookAt(targetWorldPos);
    const dist = headPivot.getWorldPosition(new THREE.Vector3()).distanceTo(targetWorldPos);
    const positions = laserLine.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(1, 0, 0, Math.min(35.0, dist));
    positions.needsUpdate = true;
    laserLine.visible = true;
  };

  return { group, headPivot, laserLine, aimAtWorldTarget };
}
