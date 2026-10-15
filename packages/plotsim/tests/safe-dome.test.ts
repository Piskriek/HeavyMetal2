import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOME_REFILL_PER_SEC,
  GATE_DOME_RADIUS_M,
  OUTSIDE_DRAIN_SECONDS,
  POWERED_DOME_RADIUS_M,
  WARN_LEVEL,
  inSafeDome,
  isWarnLevel,
  outsideDrainPerSec,
  poweredPylonDomes,
  safeDomes,
  type DomeMachine,
  type DomeSource,
} from '../src/safe-dome';

const gate = { x: 0, z: 0 };
const pylon = (id: number, x: number, z: number, on = true, kind = 'pylon'): DomeMachine => ({ id, kind, x, z, on });

test('the dome numbers: 25 m at the gate, 15 m at a pylon or the shelter, 20% a second in, 90 s out', () => {
  assert.equal(GATE_DOME_RADIUS_M, 25);
  assert.equal(POWERED_DOME_RADIUS_M, 15);
  assert.equal(DOME_REFILL_PER_SEC, 0.2);
  assert.equal(OUTSIDE_DRAIN_SECONDS, 90);
  assert.ok(Math.abs(outsideDrainPerSec() * OUTSIDE_DRAIN_SECONDS - 1) < 1e-12, 'a full buffer lasts 90 s');
  assert.equal(WARN_LEVEL, 0.3);
});

test('inside the gate dome, outside it, and on its edge', () => {
  const domes = safeDomes(gate, [], new Set(), null);
  assert.equal(inSafeDome({ x: 0, z: 0 }, domes), true);
  assert.equal(inSafeDome({ x: 24.9, z: 0 }, domes), true);
  assert.equal(inSafeDome({ x: 25, z: 0 }, domes), true, 'the edge counts as inside');
  assert.equal(inSafeDome({ x: 25.1, z: 0 }, domes), false);
  assert.equal(inSafeDome({ x: 17.7, z: 17.7 }, domes), false, 'the diagonal is 25.03 m: outside');
  assert.equal(inSafeDome({ x: 17.6, z: 17.6 }, domes), true, 'the diagonal at 24.9 m: inside');
});

test('a relay pylon has a 15 m dome only while it is switched on and wired to the grid', () => {
  const machines = [pylon(7, 60, 0), pylon(8, 0, 60, false), pylon(9, -60, 0), pylon(10, 0, -60)];
  const wired = new Set([7, 8]);
  const far = { x: 60 + 14, z: 0 };
  const domes = safeDomes(gate, machines, wired, null);
  assert.equal(inSafeDome(far, domes), true, 'a powered pylon shelters 14 m away');
  assert.equal(inSafeDome({ x: 60 + 15.5, z: 0 }, domes), false, 'and not 15.5 m away');
  assert.equal(inSafeDome({ x: 0, z: 60 + 5 }, domes), false, 'a switched-off pylon has no dome');
  assert.equal(inSafeDome({ x: -60 + 5, z: 0 }, domes), false, 'a pylon off the grid has no dome');
  assert.equal(inSafeDome({ x: 0, z: -60 + 5 }, domes), false, 'an unwired pylon has no dome');
});

test('a pylon dome counts only pylons, not other machines', () => {
  const machines = [pylon(1, 30, 0, true, 'mill')];
  const wired = new Set([1]);
  assert.deepEqual(poweredPylonDomes(machines, wired), []);
});

test('the starter shelter is a 15 m dome of its own', () => {
  const shelter = { x: -100, z: 40 };
  const domes = safeDomes(gate, [], new Set(), shelter);
  assert.equal(inSafeDome({ x: -100, z: 54 }, domes), true);
  assert.equal(inSafeDome({ x: -100, z: 56 }, domes), false);
});

test('the dome set is the gate plus every live pylon dome plus the shelter', () => {
  const domes: DomeSource[] = safeDomes(gate, [pylon(1, 50, 0), pylon(2, 0, 50)], new Set([1, 2]), { x: 0, z: -90 });
  assert.equal(domes.length, 4);
  assert.deepEqual(domes.map((d) => d.radius), [25, 15, 15, 15]);
});

test('the warning starts at 30% and not above it', () => {
  assert.equal(isWarnLevel(0.31), false);
  assert.equal(isWarnLevel(0.3), true);
  assert.equal(isWarnLevel(0.05), true);
  assert.equal(isWarnLevel(0), true);
});
