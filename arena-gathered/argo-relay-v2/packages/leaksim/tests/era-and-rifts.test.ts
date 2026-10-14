import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNonDestructiveSapperDebuff,
  enforceGateSafeDomeRepulsion,
  resolveLeakWaveEra,
} from '../src/era-escalation-and-rifts';

test('stages monster eras across S0..S4 and enforces non-destructive sappers', () => {
  assert.equal(resolveLeakWaveEra({ Pxd: 0.1, Vtx: 0.1, Lx: 0.05, Aq: 0 }, 'normal').era, 'era-1993-2d-sprite');
  assert.equal(enforceGateSafeDomeRepulsion(10, 0, 0, 0, 25).wasRepelled, true);
  assert.equal(applyNonDestructiveSapperDebuff(100, 2).structureHpAfter, 100);
});
