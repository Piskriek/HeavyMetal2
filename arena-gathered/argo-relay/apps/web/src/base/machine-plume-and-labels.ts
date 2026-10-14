// ============================================================================
// File: apps/web/src/base/machine-plume-and-labels.ts
// Briefs: Brief 25 (P0-UI-03 Raycast Label Culling) + Brief 29 (P1-VFX-03 Hopper vs Plume)
// Decisions: DEC-04 (Rock Drill faint grey dust wisp) & Rule 10 (Off spews nothing)
// ============================================================================

import * as THREE from 'three';

export interface MachineSocketLayout {
  machineType: string;
  feedHopperOffset: [number, number, number];  // Dark inert ore drops IN here
  exhaustVentOffset: [number, number, number]; // Bright square pixels rise OUT here
  plumeColorHex: number;
  plumeMaxHeightM: number;
  isUnrefinedDustWisp?: boolean; // True for Rock Drill (DEC-04)
}

export const CANONICAL_MACHINE_SOCKETS: Record<string, MachineSocketLayout> = {
  'rock-drill': {
    machineType: 'rock-drill',
    feedHopperOffset: [0.0, 0.4, 1.1],   // Front discharge tray
    exhaustVentOffset: [0.0, 2.3, -0.9], // Rear stack faint grey dust-mote wisp (DEC-04)
    plumeColorHex: 0x8a929e,
    plumeMaxHeightM: 2.2,
    isUnrefinedDustWisp: true,
  },
  'texture-mill': {
    machineType: 'texture-mill',
    feedHopperOffset: [-0.9, 1.1, 0.6],
    exhaustVentOffset: [0.4, 2.8, -0.6],
    plumeColorHex: 0xff3d8a, // Pxd Pink
    plumeMaxHeightM: 11.0,
  },
  'shape-press': {
    machineType: 'shape-press',
    feedHopperOffset: [0.8, 1.0, 0.7],
    exhaustVentOffset: [0.0, 3.1, -0.5],
    plumeColorHex: 0x7cff4d, // Vtx Green
    plumeMaxHeightM: 11.0,
  },
  'light-projector': {
    machineType: 'light-projector',
    feedHopperOffset: [0.0, 0.9, 0.9],
    exhaustVentOffset: [0.0, 3.4, 0.0],
    plumeColorHex: 0xffc13d, // Lx Amber
    plumeMaxHeightM: 14.0,
  },
  'water-maker': {
    machineType: 'water-maker',
    feedHopperOffset: [-0.8, 1.0, 0.8],
    exhaustVentOffset: [0.0, 2.9, -0.8], // Top-rear condenser vent
    plumeColorHex: 0x3dc8ff, // Aq Cyan
    plumeMaxHeightM: 10.5,
  },
};

/**
 * Rule 10 Enforcement: "A machine that is off spews nothing."
 * Returns the exact emission rate multiplier (0.0 when off/unfed, 0.25..1.0 during brownout, 2.5x with cartridge).
 */
export function computeMachinePlumeEmissionRate(
  isPoweredAndRunning: boolean,
  gridSatisfactionRatio0to1: number,
  hasSlottedCartridge: boolean
): number {
  if (!isPoweredAndRunning || gridSatisfactionRatio0to1 <= 0.001) {
    return 0.0;
  }
  const cartBoost = hasSlottedCartridge ? 1.65 : 1.0;
  return gridSatisfactionRatio0to1 * cartBoost;
}

/**
 * P0-UI-03 (Fixes 08-first-machine.jpg floating text clutter):
 * Floating 3D text labels over machines are hidden unless the player is within 14m AND aiming within 8 degrees
 * (or holding the Alt key for Tactical Telemetry View).
 */
export function shouldShowMachineWorldLabel(
  cameraPos: THREE.Vector3,
  cameraForwardUnit: THREE.Vector3,
  machinePos: THREE.Vector3,
  isAltTelemetryKeyHeld = false,
  maxDistanceM = 14.0,
  maxConeAngleDeg = 8.0
): boolean {
  if (isAltTelemetryKeyHeld) return true;

  const toMachine = new THREE.Vector3().subVectors(machinePos, cameraPos);
  const dist = toMachine.length();
  if (dist > maxDistanceM || dist < 0.001) return false;

  toMachine.divideScalar(dist);
  const dot = cameraForwardUnit.dot(toMachine);
  const minCos = Math.cos(THREE.MathUtils.degToRad(maxConeAngleDeg));
  return dot >= minCos;
}
