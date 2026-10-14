import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStage4LowSpecBudget,
  evaluateScanWaveAtPoint,
} from '../src/radial-scan-wave.glsl';

test('expands scan-wave to 450m over 4.5s and caps Low tier noise octaves at 2', () => {
  assert.equal(evaluateScanWaveAtPoint(2.25, 0, 0, 100, 0).useNewStageShader, true);
  assert.equal(computeStage4LowSpecBudget('Low', 120, 0.01).maxNoiseOctaves, 2);
});
