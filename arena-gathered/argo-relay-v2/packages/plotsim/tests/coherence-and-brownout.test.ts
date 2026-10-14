import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePowerGridAndBrownout,
  stepSuitCoherence,
  TWIN_GATE_BASELINE_KW,
  TWIN_GATE_SAFE_DOME_RADIUS_M,
} from '../src/coherence-and-brownout';
import {
  ensureNonSoftLockGather,
  refineDirtToOre,
} from '../../substrate/src/unified-economy';

test('never drains coherence inside the 25m Twin Gate Safe Dome and recharges at 20%/s', () => {
  const res = stepSuitCoherence(
    60,
    2.0,
    { x: 18, y: 0, z: 0 },
    false,
    [{ id: 'gate', kind: 'twin-gate', x: 0, y: 0, z: 0, radiusM: TWIN_GATE_SAFE_DOME_RADIUS_M, isPowered: true }]
  );
  assert.equal(res.isInsideSafeDome, true);
  assert.equal(res.coherence0to100, 100);
});

test('runs starter machines at 100% on 100 kW Gate power and refines 2 Dirt -> 1 Ore', () => {
  const starterGrid = evaluatePowerGridAndBrownout(0, [
    { id: 'm1', kind: 'shape-press', enabled: true },
    { id: 'm2', kind: 'texture-mill', enabled: true },
    { id: 'm3', kind: 'rock-drill', enabled: true },
  ]);
  assert.equal(starterGrid.totalSupplyKw, TWIN_GATE_BASELINE_KW);
  assert.equal(starterGrid.isBrownout, false);

  const refined = refineDirtToOre({ dirt: 50, ore: 0, salvage: 0, anomalyCores: 0, blankCartridges: 0 }, 25);
  assert.equal(refined.oreGained, 25);
  assert.ok(ensureNonSoftLockGather({ dirt: 18, ore: 0, salvage: 0, anomalyCores: 0, blankCartridges: 0 }).ore >= 10);
});
