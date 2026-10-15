import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAD_SPEED_FULL_MPS, beadSpeed, plumeCount, plumeShare, spanPoint, spanSag } from './brownout-visual';

test('a plume pours at its machine\'s run rate: full at 100%, half at 50%, nothing at 0%', () => {
  assert.equal(plumeShare(1), 1);
  assert.equal(plumeShare(0.5), 0.5);
  assert.equal(plumeShare(0), 0);
  assert.equal(plumeCount(220, 1), 220);
  assert.equal(plumeCount(220, 0.5), 110);
  assert.equal(plumeCount(220, 0), 0);
});

test('the share rounds to tenths and clamps to 0..1, so the plume rebuilds only at a tenth\'s change', () => {
  assert.equal(plumeShare(0.44), 0.4);
  assert.equal(plumeShare(0.46), 0.5);
  assert.equal(plumeShare(1.7), 1);
  assert.equal(plumeShare(-0.2), 0);
  assert.equal(plumeShare(Number.NaN), 0);
});

test('a brownout dims the plume: a machine at 20% pours a fifth of its full pour', () => {
  const full = 220;
  assert.ok(plumeCount(full, 0.2) < plumeCount(full, 0.75));
  assert.equal(plumeCount(full, 0.2), 44);
});

test('the pylon beads slow with the grid and stop at 0%', () => {
  assert.equal(beadSpeed(1), BEAD_SPEED_FULL_MPS);
  assert.ok(Math.abs(beadSpeed(0.5) - BEAD_SPEED_FULL_MPS / 2) < 1e-12);
  assert.equal(beadSpeed(0), 0);
  assert.equal(beadSpeed(2), BEAD_SPEED_FULL_MPS, 'capped at full');
  assert.equal(beadSpeed(Number.NaN), 0);
});

test('a bead rides the same sagged curve as the cable: ends on the tops and sags in the middle', () => {
  const a = { x: 0, y: 6, z: 0 };
  const b = { x: 30, y: 6, z: 40 };
  const sag = spanSag(50);
  const start = spanPoint(a, b, sag, 0);
  const end = spanPoint(a, b, sag, 1);
  assert.deepEqual(start, a);
  assert.ok(Math.abs(end.x - b.x) < 1e-12 && Math.abs(end.y - b.y) < 1e-12 && Math.abs(end.z - b.z) < 1e-12);
  const mid = spanPoint(a, b, sag, 0.5);
  assert.ok(Math.abs(mid.y - (6 - sag)) < 1e-12, 'the midpoint hangs by sag');
  assert.equal(spanSag(2), 0.4, 'a short span still has a 0.4 m sag');
});
