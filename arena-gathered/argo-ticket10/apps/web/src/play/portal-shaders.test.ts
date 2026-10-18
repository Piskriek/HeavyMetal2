// ============================================================================
// File: apps/web/src/play/portal-shaders.test.ts
// Unit tests for Brief 30 / P1-LIGHT-04 & POL-52:
// - 6 m leading stage-wave band position and metric colour (#ff3d8a, #7cff4d, #ffc13d, #3dc8ff)
// - 30 m, 1 s local machine activation wave radius and strength
// - 350 m scan ring fade-out (POL-52)
// Imports ONLY modules in ticket10-context.json.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_MACHINE_WAVE_DURATION_S,
  LOCAL_MACHINE_WAVE_MAX_R_M,
  localMachineWaveAt,
  POST_FRAGMENT,
  SCAN_RING_MAX_R_M,
  scanRingFadeAt,
  STAGE_WAVE_BAND_WIDTH_M,
  stageWaveBandAt,
  WAVE_METRIC_RGB,
  waveBandColourFor,
} from './portal-shaders';

test('P1-LIGHT-04: waveBandColourFor maps the four metrics to their canonical colours and stageWaveBandAt spans 6 m', () => {
  assert.deepEqual(waveBandColourFor('pxd'), WAVE_METRIC_RGB.pxd);
  assert.deepEqual(waveBandColourFor('vtx'), WAVE_METRIC_RGB.vtx);
  assert.deepEqual(waveBandColourFor('lx'), WAVE_METRIC_RGB.lx);
  assert.deepEqual(waveBandColourFor('aq'), WAVE_METRIC_RGB.aq);
  assert.equal(STAGE_WAVE_BAND_WIDTH_M, 6.0);

  // At waveRadius = 50 m, a point at 50 m is at peak band intensity (1.0), and 44 m is at the trailing edge (0.0)
  const atFront = stageWaveBandAt(50, 50, 'vtx');
  assert.equal(atFront.inside, true);
  assert.equal(atFront.bandFactor, 1);
  assert.deepEqual(atFront.colour, WAVE_METRIC_RGB.vtx);

  const midBand = stageWaveBandAt(47, 50, 'vtx');
  assert.ok(midBand.bandFactor > 0.4 && midBand.bandFactor < 0.6);

  const behindBand = stageWaveBandAt(40, 50, 'vtx');
  assert.equal(behindBand.inside, true);
  assert.equal(behindBand.bandFactor, 0);

  assert.ok(POST_FRAGMENT.includes('uWaveBandColour'), 'POST_FRAGMENT declares uWaveBandColour');
  assert.ok(POST_FRAGMENT.includes('uLocalWaveR'), 'POST_FRAGMENT declares uLocalWaveR');
});

test('P1-LIGHT-04: localMachineWaveAt sweeps from 0 m to 30 m over 1.0 s and then deactivates', () => {
  assert.equal(LOCAL_MACHINE_WAVE_MAX_R_M, 30.0);
  assert.equal(LOCAL_MACHINE_WAVE_DURATION_S, 1.0);

  const start = localMachineWaveAt(0, 'lx');
  assert.equal(start.active, true);
  assert.equal(start.radiusM, 0);
  assert.equal(start.strength, 1);

  const half = localMachineWaveAt(0.5, 'lx');
  assert.equal(half.active, true);
  assert.ok(half.radiusM > 20 && half.radiusM < 25, `expected ~22.5 m at 0.5 s, got ${half.radiusM}`);
  assert.equal(half.strength, 0.5);

  const done = localMachineWaveAt(1.0, 'lx');
  assert.equal(done.active, false);
  assert.equal(done.strength, 0);
});

test('POL-52: scanRingFadeAt holds at 1.0 inside the plot and fades smoothly to 0.0 at 350 m', () => {
  assert.equal(SCAN_RING_MAX_R_M, 350.0);
  assert.equal(scanRingFadeAt(100), 1);
  assert.equal(scanRingFadeAt(310), 1);
  const mid = scanRingFadeAt(330);
  assert.ok(mid > 0.4 && mid < 0.6);
  assert.equal(scanRingFadeAt(350), 0);
  assert.equal(scanRingFadeAt(400), 0);
});
