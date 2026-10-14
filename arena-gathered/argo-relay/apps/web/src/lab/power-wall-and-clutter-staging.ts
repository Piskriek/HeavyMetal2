// ============================================================================
// File: apps/web/src/lab/power-wall-and-clutter-staging.ts
// Plan: Plan 13 (P0-LAYOUT-02 Lab Power Chain Copper Bus Bars & Clutter Staging)
// Rules: Rule 10 (Grounded + Cabled), Rule 11 (Square sections), Rule 16 (Sockets)
// ============================================================================

import * as THREE from 'three';

export interface PowerChainNodeSpec {
  id:
    | 'capacitor-bank'
    | 'breaker-panel'
    | 'relay-cabinet-1'
    | 'relay-cabinet-2'
    | 'relay-cabinet-3'
    | 'relay-cabinet-4'
    | 'control-box-pair';
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  hasCopperBusBars?: boolean;
  hasAmberTopBeacon?: boolean;
}

export interface LabClutterPlacementSpec {
  id: string;
  assetId:
    | 'crate-large'
    | 'crate-small'
    | 'cardboard-stack'
    | 'filing-cabinet'
    | 'server-rack'
    | 'locker'
    | 'toolbox'
    | 'coolant-can'
    | 'sample-case'
    | 'old-monitor';
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  canDissolveForSalvage: boolean;
  salvageYield: number;
  forensicLogId?: string;
}

/**
 * Strictly ordered left-to-right Power Chain along the back-right wall (z = -6.4m)
 * per 07-sheet-lab-power-and-machines.png.
 */
export const CANONICAL_POWER_CHAIN_NODES: PowerChainNodeSpec[] = [
  { id: 'capacitor-bank',  x: 1.4, y: 0.0, z: -6.4, yawDeg: 0, hasCopperBusBars: true },
  { id: 'breaker-panel',   x: 3.1, y: 0.0, z: -6.4, yawDeg: 0 },
  { id: 'relay-cabinet-1', x: 4.4, y: 0.0, z: -6.4, yawDeg: 0, hasAmberTopBeacon: true },
  { id: 'relay-cabinet-2', x: 5.4, y: 0.0, z: -6.4, yawDeg: 0, hasAmberTopBeacon: true },
  { id: 'relay-cabinet-3', x: 6.4, y: 0.0, z: -6.4, yawDeg: 0, hasAmberTopBeacon: true },
  { id: 'relay-cabinet-4', x: 7.4, y: 0.0, z: -6.4, yawDeg: 0, hasAmberTopBeacon: true },
  { id: 'control-box-pair', x: 8.3, y: 1.1, z: -6.4, yawDeg: 0 },
];

/**
 * All 10 packed Lab clutter props arranged in functional zones (18m x 14m floor plan).
 * old-monitor and server-rack are permanent inspectable fixtures; the other 8 dissolve on Hold [E].
 */
export const CANONICAL_LAB_CLUTTER_PLACEMENTS: LabClutterPlacementSpec[] = [
  // Back-Left Observation Window Telemetry Desk (Permanent Lore Fixtures)
  {
    id: 'clutter-old-monitor',
    assetId: 'old-monitor',
    x: -5.8,
    y: 0.9,
    z: -6.1,
    yawDeg: 14,
    canDissolveForSalvage: false,
    salvageYield: 0,
    forensicLogId: 'LOG-01',
  },
  {
    id: 'clutter-server-rack',
    assetId: 'server-rack',
    x: -7.6,
    y: 0.0,
    z: -6.2,
    yawDeg: 0,
    canDissolveForSalvage: false,
    salvageYield: 0,
    forensicLogId: 'LOG-02',
  },
  // Dissolvable Clutter Props (Hold [E] yields Salvage + clears right-wall expansion slots)
  {
    id: 'clutter-filing-cabinet',
    assetId: 'filing-cabinet',
    x: -4.2,
    y: 0.0,
    z: -6.3,
    yawDeg: 0,
    canDissolveForSalvage: true,
    salvageYield: 4,
    forensicLogId: 'LOG-03',
  },
  {
    id: 'clutter-sample-case',
    assetId: 'sample-case',
    x: 6.8,
    y: 0.95,
    z: 1.2,
    yawDeg: -22,
    canDissolveForSalvage: true,
    salvageYield: 5,
    forensicLogId: 'LOG-04',
  },
  {
    id: 'clutter-crate-large',
    assetId: 'crate-large',
    x: 7.4,
    y: 0.0,
    z: 3.4,
    yawDeg: 18,
    canDissolveForSalvage: true,
    salvageYield: 6,
  },
  {
    id: 'clutter-crate-small',
    assetId: 'crate-small',
    x: 6.5,
    y: 0.0,
    z: 4.1,
    yawDeg: -12,
    canDissolveForSalvage: true,
    salvageYield: 3,
  },
  {
    id: 'clutter-cardboard-stack',
    assetId: 'cardboard-stack',
    x: 7.6,
    y: 0.0,
    z: 4.8,
    yawDeg: 35,
    canDissolveForSalvage: true,
    salvageYield: 2,
  },
  {
    id: 'clutter-locker',
    assetId: 'locker',
    x: -8.2,
    y: 0.0,
    z: 2.6,
    yawDeg: 90,
    canDissolveForSalvage: true,
    salvageYield: 5,
  },
  {
    id: 'clutter-toolbox',
    assetId: 'toolbox',
    x: 7.1,
    y: 0.92,
    z: -1.4,
    yawDeg: -40,
    canDissolveForSalvage: true,
    salvageYield: 4,
  },
  {
    id: 'clutter-coolant-can',
    assetId: 'coolant-can',
    x: 6.9,
    y: 0.0,
    z: -2.8,
    yawDeg: 8,
    canDissolveForSalvage: true,
    salvageYield: 4,
  },
];

/**
 * Builds the copper bus-bar bridge + 4 amber Relay Cabinet top beacons for LabScene.ts.
 */
export function buildPowerWallBusBarsAndBeacons(): {
  group: THREE.Group;
  beaconMeshes: THREE.Mesh[];
} {
  const group = new THREE.Group();
  group.name = 'lab-power-wall-details';
  const beaconMeshes: THREE.Mesh[] = [];

  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xd97b43,
    roughness: 0.35,
    metalness: 0.22,
  });

  // 3 heavy rectangular copper bus-bars linking the 6 capacitor cylinders on the steel skid
  for (let row = 0; row < 3; row++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 0.08), copperMat);
    bar.position.set(1.4, 1.65 + row * 0.14, -6.15);
    group.add(bar);
  }

  // 4 Amber top beacons atop relay-cabinet-1..4
  for (const node of CANONICAL_POWER_CHAIN_NODES) {
    if (!node.hasAmberTopBeacon) continue;
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffc13d,
      emissive: 0xffc13d,
      emissiveIntensity: 0.0, // Ignites when Lab breaker is thrown
      roughness: 0.3,
      metalness: 0.1,
    });
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), beaconMat);
    beacon.position.set(node.x, 2.28, node.z + 0.15);
    group.add(beacon);
    beaconMeshes.push(beacon);
  }

  return { group, beaconMeshes };
}
