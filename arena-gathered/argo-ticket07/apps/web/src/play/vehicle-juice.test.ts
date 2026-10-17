// ============================================================================
// File: apps/web/src/play/vehicle-juice.test.ts
// Unit tests for boostedInput, tireTracks, wheelRoost, and printGantry (TICKET-07 Item E).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOST_THROTTLE_SCALE,
  boostedInput,
  printGantry,
  tireTracks,
  wheelRoost,
} from './vehicle-juice';

test('boostedInput scales throttle while draining energy and recharges when released', () => {
  const base = { throttle: 1, steer: -0.25, brake: false };

  const active = boostedInput(base, true, 1.0, 0.5);
  assert.equal(active.boosting, true);
  assert.ok(Math.abs(active.throttle - BOOST_THROTTLE_SCALE) < 1e-6);
  assert.ok(active.energy < 1.0 && active.energy > 0.5);

  // Depleted boost energy cannot boost
  const empty = boostedInput(base, true, 0, 0.5);
  assert.equal(empty.boosting, false);
  assert.equal(empty.throttle, 1);

  // Releasing boost recharges energy
  const recharged = boostedInput(base, false, 0.4, 0.5);
  assert.equal(recharged.boosting, false);
  assert.equal(recharged.throttle, 1);
  assert.ok(recharged.energy > 0.4);
});

test('tireTracks builds a capped ring buffer on @hm/decals and fades marks with age', () => {
  const tracks = tireTracks({ maxMarks: 8, maxAge: 2.0, heightAt: () => 0 });
  for (let i = 0; i < 10; i++) {
    tracks.add({ x: i * 0.5, y: 0, z: 0 }, [0, 1, 0], 0.45, 0);
  }
  assert.equal(tracks.count(), 8, 'Ring buffer caps at maxMarks');

  const initialOpacity = tracks.marks()[0]!.opacity;
  tracks.update(1.0);
  assert.equal(tracks.count(), 8);
  assert.ok(tracks.marks()[0]!.opacity < initialOpacity, 'Marks fade with age');

  tracks.update(1.5);
  assert.equal(tracks.count(), 0, 'Expired marks are removed');
  tracks.dispose();
});

test('wheelRoost emits deterministic dust particles via @hm/particles when moving or slipping', () => {
  const roost = wheelRoost({ maxParticles: 64, seed: 42 });
  assert.equal(roost.count(), 0);

  // Stationary with no slip emits nothing
  roost.emit({ x: 0, y: 0, z: 0 }, 0, 0);
  assert.equal(roost.count(), 0);

  // Moving/slipping wheel kicks up dust
  roost.emit({ x: 2, y: 0, z: -3 }, 9.5, 0.4);
  assert.ok(roost.count() > 0);

  roost.update(0.2);
  assert.ok(roost.count() > 0);
  roost.update(2.0);
  assert.equal(roost.count(), 0);
  roost.dispose();
});

test('printGantry sweeps across fabricator pad and fires onDone callback', () => {
  const gantry = printGantry({ x: 10, y: 0, z: -5, duration: 1.0 });
  let finished = false;
  gantry.play(() => {
    finished = true;
  });
  assert.equal(gantry.isPlaying(), true);

  gantry.update(0.5);
  assert.ok(Math.abs(gantry.progress() - 0.5) < 1e-6);
  assert.equal(finished, false);

  gantry.update(0.6);
  assert.equal(gantry.isPlaying(), false);
  assert.equal(finished, true);
  gantry.dispose();
});
