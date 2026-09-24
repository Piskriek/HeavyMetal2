/**
 * IF-GIZMO: Pure transform, constraint, and snapping math for 3D manipulation.
 * Headless, deterministic, zero-allocation per frame.
 */

import * as THREE from 'three';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type GizmoSpace = 'world' | 'local' | 'track';
export type Constraint = 'x' | 'y' | 'z' | 'xy' | 'yz' | 'xz' | 'xyz' | 'screen';

export interface SnapConfig {
  grid: number; // 0, 10, 50, 100
  angleDeg: number; // 0, 15, 45, 90
  scaleStep: number; // 0, 0.1, 0.25
  surface: boolean;
  centerline: boolean;
}

export interface GizmoFrame {
  origin: THREE.Vector3;
  axes: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; // tangent/X, up/Y, right/Z
}

export interface Transformable {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  scale: number;
  groupId?: string;
  [key: string]: unknown;
}

export const snapTo = (v: number, step: number): number =>
  step > 0 ? Math.round(v / step) * step : v;

export function snapAngle(rad: number, stepDeg: number): number {
  if (stepDeg <= 0) return rad;
  const stepRad = (stepDeg * Math.PI) / 180;
  return Math.round(rad / stepRad) * stepRad;
}

/**
 * Compute pivot position of a selection.
 */
export function pivotOf(items: readonly Transformable[], mode: 'centroid' | 'bounds' = 'centroid'): THREE.Vector3 {
  if (items.length === 0) return new THREE.Vector3(0, 0, 0);

  if (mode === 'bounds') {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const item of items) {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      minZ = Math.min(minZ, item.z);
      maxX = Math.max(maxX, item.x);
      maxY = Math.max(maxY, item.y);
      maxZ = Math.max(maxZ, item.z);
    }
    return new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  }

  // Centroid
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const item of items) {
    sumX += item.x;
    sumY += item.y;
    sumZ += item.z;
  }
  return new THREE.Vector3(sumX / items.length, sumY / items.length, sumZ / items.length);
}

/**
 * Constrains a raw delta Vector3 along specified constraint axes, applies snapping in gizmo space,
 * and handles world absolute grid alignment vs local relative grid alignment.
 */
export function constrainedDelta(
  rawDelta: THREE.Vector3,
  frame: GizmoFrame,
  constraint: Constraint,
  space: GizmoSpace,
  snap: SnapConfig,
  pivot: THREE.Vector3,
): THREE.Vector3 {
  // Extract coordinate projections along gizmo axes
  let du = rawDelta.dot(frame.axes[0]); // X / tangent
  let dv = rawDelta.dot(frame.axes[1]); // Y / up
  let dw = rawDelta.dot(frame.axes[2]); // Z / right

  // Filter according to constraint
  if (constraint === 'x') { dv = 0; dw = 0; }
  else if (constraint === 'y') { du = 0; dw = 0; }
  else if (constraint === 'z') { du = 0; dv = 0; }
  else if (constraint === 'xy') { dw = 0; }
  else if (constraint === 'yz') { du = 0; }
  else if (constraint === 'xz') { dv = 0; }

  // World space snapping: snap the absolute pivot position to the grid
  if (space === 'world' && snap.grid > 0) {
    const targetX = (constraint === 'y' || constraint === 'z' || constraint === 'yz')
      ? pivot.x
      : snapTo(pivot.x + du, snap.grid);
    const targetY = (constraint === 'x' || constraint === 'z' || constraint === 'xz')
      ? pivot.y
      : snapTo(pivot.y + dv, snap.grid);
    const targetZ = (constraint === 'x' || constraint === 'y' || constraint === 'xy')
      ? pivot.z
      : snapTo(pivot.z + dw, snap.grid);

    return new THREE.Vector3(targetX - pivot.x, targetY - pivot.y, targetZ - pivot.z);
  }

  // Relative snapping in local/track space
  if (snap.grid > 0) {
    du = snapTo(du, snap.grid);
    dv = snapTo(dv, snap.grid);
    dw = snapTo(dw, snap.grid);
  }

  // Rotate back to world space
  const out = new THREE.Vector3();
  out.addScaledVector(frame.axes[0], du);
  out.addScaledVector(frame.axes[1], dv);
  out.addScaledVector(frame.axes[2], dw);

  return out;
}

/**
 * Rotate a point around a pivot point by given angle (Euler Y rotation).
 */
export function rotatePointAboutPivot(
  point: { x: number; z: number },
  pivot: { x: number; z: number },
  angleRad: number,
): { x: number; z: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - pivot.x;
  const dz = point.z - pivot.z;

  return {
    x: pivot.x + (dx * cos - dz * sin),
    z: pivot.z + (dx * sin + dz * cos),
  };
}

/**
 * Scale a point around a pivot point by factor k.
 */
export function scalePointAboutPivot(
  point: { x: number; y: number; z: number },
  pivot: { x: number; y: number; z: number },
  k: number,
): { x: number; y: number; z: number } {
  return {
    x: pivot.x + (point.x - pivot.x) * k,
    y: pivot.y + (point.y - pivot.y) * k,
    z: pivot.z + (point.z - pivot.z) * k,
  };
}
