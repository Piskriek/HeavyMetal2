import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrintSweepAndBounce } from '../src/print-sweep-and-bounce';
import { computeMachineEmissionRates } from '../../plume/src/machine-sockets';

test('sweeps wireframe print plane over 0.65s and enforces Rule 10 & DEC-04 wisp', () => {
  assert.equal(evaluatePrintSweepAndBounce(0.325, 0.0, 4.0).isPrinting, true);
  assert.equal(computeMachineEmissionRates('rock-drill', true, true, false, false).isGreyDustWisp, true);
  assert.equal(computeMachineEmissionRates('texture-mill', false, true, true, false).exhaustPlumeParticlesPerSec, 0);
});
