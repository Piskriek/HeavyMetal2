import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAct1WakeFrame,
  evaluateBreakerStripLightBanks,
  evaluateGateCoilIgnition,
  WAKE_SIT_UP_DURATION_SEC,
} from './lab-choreography';
import { BREACH_COLUMN_X_RATIO } from './lab-vista-pockets';

test('choreographs Act I wake, 3 strip-light banks, and 8 Gate coil pairs', () => {
  assert.equal(evaluateAct1WakeFrame(WAKE_SIT_UP_DURATION_SEC + 0.1).showHaddyGlitchPortrait, true);
  assert.equal(evaluateBreakerStripLightBanks(true, 2.0).allBanksLit, true);
  assert.equal(evaluateGateCoilIgnition(true, 3.6).portalStencilActive, true);
  assert.equal(BREACH_COLUMN_X_RATIO, -0.35);
});
