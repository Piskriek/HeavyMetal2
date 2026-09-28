import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  constrainedDelta,
  snapTo,
  snapAngle,
  pivotOf,
  rotatePointAboutPivot,
  scalePointAboutPivot,
  type GizmoFrame,
  type SnapConfig,
} from '../src/game/builder/gizmo-math';

describe('IF-GIZMO: Pure Gizmo Math & Snapping', () => {
  const worldFrame: GizmoFrame = {
    origin: new THREE.Vector3(0, 0, 0),
    axes: [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ],
  };

  it('AC-1: constrained delta is parallel to constraint axis and a multiple of grid', () => {
    const raw = new THREE.Vector3(23.4, 56.7, 89.1);
    const snap: SnapConfig = { grid: 10, angleDeg: 15, scaleStep: 0.1, surface: false, centerline: false };
    const pivot = new THREE.Vector3(100, 100, 100);

    const deltaX = constrainedDelta(raw, worldFrame, 'x', 'world', snap, pivot);
    assert.equal(deltaX.y, 0);
    assert.equal(deltaX.z, 0);
    assert.equal((pivot.x + deltaX.x) % 10, 0, 'Pivot + delta must be multiple of 10');

    const deltaY = constrainedDelta(raw, worldFrame, 'y', 'world', snap, pivot);
    assert.equal(deltaY.x, 0);
    assert.equal(deltaY.z, 0);
    assert.equal((pivot.y + deltaY.y) % 10, 0);
  });

  it('AC-2: world + grid 50 snaps absolute pivot to multiple of 50', () => {
    const pivot = new THREE.Vector3(112, 237, 349);
    const raw = new THREE.Vector3(14, 21, -33);
    const snap: SnapConfig = { grid: 50, angleDeg: 0, scaleStep: 0, surface: false, centerline: false };

    const delta = constrainedDelta(raw, worldFrame, 'xyz', 'world', snap, pivot);
    const finalPivot = pivot.clone().add(delta);

    assert.equal(finalPivot.x % 50, 0);
    assert.equal(finalPivot.y % 50, 0);
    assert.equal(finalPivot.z % 50, 0);
    assert.equal(finalPivot.x, 150);
    assert.equal(finalPivot.y, 250);
    assert.equal(finalPivot.z, 300);
  });

  it('AC-3: 360 degree rotation in 24 snapped 15-degree steps is drift-free', () => {
    const pivot = { x: 500, z: 500 };
    let point = { x: 500, z: 700 }; // 200 units away along Z
    const stepRad = (15 * Math.PI) / 180;

    for (let step = 0; step < 24; step++) {
      point = rotatePointAboutPivot(point, pivot, stepRad);
    }

    assert.ok(Math.abs(point.x - 500) < 1e-6, `Expected x=500, got ${point.x}`);
    assert.ok(Math.abs(point.z - 700) < 1e-6, `Expected z=700, got ${point.z}`);
  });

  it('scales point correctly about pivot', () => {
    const pivot = { x: 100, y: 100, z: 100 };
    const point = { x: 150, y: 120, z: 200 };
    const scaled = scalePointAboutPivot(point, pivot, 2.0);

    assert.equal(scaled.x, 200);
    assert.equal(scaled.y, 140);
    assert.equal(scaled.z, 300);
  });

  it('computes centroid and bounds pivots accurately', () => {
    const items = [
      { x: 0, y: 0, z: 0, scale: 1 },
      { x: 100, y: 50, z: 200, scale: 1 },
    ];

    const centroid = pivotOf(items, 'centroid');
    assert.equal(centroid.x, 50);
    assert.equal(centroid.y, 25);
    assert.equal(centroid.z, 100);

    const bounds = pivotOf(items, 'bounds');
    assert.equal(bounds.x, 50);
    assert.equal(bounds.y, 25);
    assert.equal(bounds.z, 100);
  });
});
