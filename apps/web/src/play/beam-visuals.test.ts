import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BEAM_COLOURS } from '@hm/beamkit';
import {
  STREAM_COUNT,
  beamFlicker,
  coreRadiusAt,
  createBeamVisuals,
  ringColourOf,
  streamChunk,
  streamPosition,
} from './beam-visuals';

test('the ring is coloured by mode, and Seal\'s amber takes over while sealing', () => {
  assert.equal(ringColourOf('extract', false), '#3dc8ff');
  assert.equal(ringColourOf('apply', false), '#ff3d8a');
  assert.equal(ringColourOf('sculpt', false), '#7cff4d');
  assert.equal(ringColourOf('sculpt', true), '#ffc13d');
  assert.equal(ringColourOf('extract', true), BEAM_COLOURS.seal);
});

test('a stream chunk runs from the hit (u 0) to the muzzle (u 1), and fades at both ends', () => {
  for (let i = 0; i < STREAM_COUNT; i++) {
    for (const t of [0, 0.37, 2.5, 11.1]) {
      const c = streamChunk(i, STREAM_COUNT, t);
      assert.ok(c.u >= 0 && c.u < 1, `u in [0, 1) (${c.u})`);
      assert.ok(c.radius > 0.04 && c.radius <= 0.31, `the spiral narrows toward the barrel (${c.radius})`);
      assert.ok(c.scale >= 0 && c.scale <= 0.12, `a chunk is 8 to 12 centimetres (${c.scale})`);
    }
  }
  assert.equal(streamChunk(0, STREAM_COUNT, 0).u, 0);
  const hidden = streamChunk(0, STREAM_COUNT, 0);
  assert.equal(hidden.scale, 0, 'a chunk at the hit is hidden while it fades in');
  const mid = streamChunk(0, STREAM_COUNT, 0.5 / 0.55);
  assert.ok(mid.scale > 0.03, `a chunk mid-way is drawn (${mid.scale})`);
});

test('the sixteen chunks are spread along the stream, not stacked on one point', () => {
  const us = new Set<string>();
  for (let i = 0; i < STREAM_COUNT; i++) us.add(streamChunk(i, STREAM_COUNT, 3).u.toFixed(4));
  assert.equal(us.size, STREAM_COUNT);
});

test('a chunk at u 0 sits on the hit point\'s ring; a chunk near the muzzle is near the muzzle', () => {
  const hit = new THREE.Vector3(0, 0, -20), muzzle = new THREE.Vector3(0, 0.1, -1);
  const out = new THREE.Vector3();
  streamPosition(hit, muzzle, { u: 0, radius: 0.2, angle: 0, scale: 0.05 }, out);
  assert.ok(out.distanceTo(hit) <= 0.2 + 1e-6, `at the hit, within its radius (${out.distanceTo(hit)})`);
  streamPosition(hit, muzzle, { u: 0.999, radius: 0.05, angle: 1, scale: 0.05 }, out);
  assert.ok(out.distanceTo(muzzle) < 0.1, `at the end, close to the muzzle (${out.distanceTo(muzzle)})`);
  const degenerate = streamPosition(hit, hit.clone(), { u: 0.5, radius: 0.2, angle: 0, scale: 0.05 }, out);
  assert.ok(degenerate.distanceTo(hit) < 1e-9, 'a zero-length line puts the chunk on the hit');
});

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
