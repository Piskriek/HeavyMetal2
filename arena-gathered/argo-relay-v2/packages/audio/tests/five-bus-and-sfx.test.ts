import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStageBitDepthMirror,
  evaluateMixerBusState,
} from '../src/five-bus-mixer';
import { SYNTH_ACTION_SFX_TABLE } from '../../soundpack/src/action-sfx-table';

test('ducks World_SFX_Bus during VO and crushes Stage 0 World_SFX_Bus to 8 kHz', () => {
  const state = evaluateMixerBusState(true, false, { Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 });
  assert.equal(state.worldSfxGainDb, -12.5);
  assert.equal(computeStageBitDepthMirror({ Pxd: 0.05, Vtx: 0.05, Lx: 0.05, Aq: 0 }).sampleRateHz, 8000);
  assert.equal(Object.keys(SYNTH_ACTION_SFX_TABLE).length, 12);
});
