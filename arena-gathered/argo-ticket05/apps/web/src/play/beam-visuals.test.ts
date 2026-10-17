// ============================================================================
// File: apps/web/src/play/beam-visuals.test.ts
// Unit tests for setCore, beamFlicker, coreRadiusAt, ringColourOf, and streamChunk
// in apps/web/src/play/beam-visuals.ts (TICKET-05 Item E).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  beamFlicker,
  coreRadiusAt,
  createBeamVisuals,
  ringColourOf,
  streamChunk,
  streamPosition,
} from './beam-visuals';

test('beamFlicker and coreRadiusAt are deterministic and taper from muzzle to hit', () => {
  const f1 = beamFlicker(1.25);
  const f2 = beamFlicker(1.25);
  assert.equal(f1, f2);
  assert.ok(f1 >= 0.8 && f1 <= 1.2);

  const rMuzzle = coreRadiusAt(0, 0.5);
  const rMid = coreRadiusAt(0.5, 0.5);
  const rHit = coreRadiusAt(1, 0.5);
  assert.ok(rMuzzle < rMid && rMid < rHit, 'Beam core widens from muzzle (u=0) to hit (u=1)');
});

test('createBeamVisuals.setCore positions tapered core from muzzle to hit and colours by mode', () => {
  const scene = new THREE.Scene();
  const disposed: unknown[] = [];
  const visuals = createBeamVisuals(scene, (x) => {
    disposed.push(x);
    return x;
  });

  assert.equal(visuals.coreShown(), false);
  assert.equal(visuals.coreColour(), null);

  const muzzle = new THREE.Vector3(0, 1.5, 0);
  const hit = new THREE.Vector3(0, 0, -6);

  visuals.setCore(muzzle, hit, 'extract', 0.4);
  assert.equal(visuals.coreShown(), true);
  assert.equal(visuals.coreColour(), ringColourOf('extract', false));

  const outer = scene.getObjectByName('beam-core-outer') as THREE.Mesh;
  const hotspot = scene.getObjectByName('beam-core-hotspot') as THREE.Mesh;
  assert.ok(outer && outer.visible);
  assert.ok(hotspot && hotspot.visible);
  assert.ok(Math.abs(hotspot.position.z + 6) < 1e-6);

  // Switch to sculpt mode
  visuals.setCore(muzzle, hit, 'sculpt', 0.8);
  assert.equal(visuals.coreColour(), ringColourOf('sculpt', false));

  // Null hides core and hotspot
  visuals.setCore(null, hit, 'sculpt', 1.0);
  assert.equal(visuals.coreShown(), false);
  assert.equal(visuals.coreColour(), null);

  // Existing stream math still works alongside core
  const chunk = streamChunk(2, 16, 0.5);
  const out = new THREE.Vector3();
  streamPosition(hit, muzzle, chunk, out);
  assert.ok(Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z));

  visuals.dispose();
});
