/**
 * Plan 47 Pillar 2 verification: the HUD view-model projection renders the trench-locked
 * and graduated states exactly as the blueprint's widget table specifies.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { StateIdx } from '@hm/harness';
import { computeHarnessHudViewModel } from './harness-telemetry-hud';

function lockedState(): Float32Array {
  const s = new Float32Array(24);
  s[StateIdx.QX] = 2.347;
  s[StateIdx.MU_PXD] = 2.40;
  s[StateIdx.PI_PRIOR] = 282.24;
  s[StateIdx.A_AWARE] = 0.65;
  s[StateIdx.LAMBDA_FTLE] = 5.4;
  s[StateIdx.H_COHERENCE] = 0.12;
  s[StateIdx.E_RESERVE] = 5.0;
  return s;
}

function healedState(): Float32Array {
  const s = new Float32Array(24);
  s[StateIdx.QX] = 0.0031;
  s[StateIdx.MU_PXD] = 0.0;
  s[StateIdx.PI_PRIOR] = 0.21;
  s[StateIdx.A_AWARE] = 0.65;
  s[StateIdx.LAMBDA_FTLE] = 0.05;
  s[StateIdx.H_COHERENCE] = 0.9945;
  s[StateIdx.E_RESERVE] = 22.42;
  return s;
}

test('trench-locked rover renders the magenta alert with saturated latch and phase divergence', () => {
  const vm = computeHarnessHudViewModel(lockedState(), new Float64Array([3.2, 17.4, 0, 0]), 127, 0.0, 1.0, 0.65);
  assert.equal(vm.trenchColorHex, '#ff3d8a');
  assert.equal(vm.latchLogOdds, 127);
  assert.ok(vm.trenchDepthNorm === 1.0, 'deep trench saturates the well depth');
  assert.ok(vm.mirrorErrorNorm > 0.8 && vm.phaseLockDeg > 144, `phase divergence (${vm.phaseLockDeg}°)`);
  assert.ok(vm.scanlineGlitchOpacity > 0.68 && vm.scanlineGlitchOpacity <= 0.85);
  assert.ok(vm.escrowGateOpenRatio < 0.01, 'escrow gate sealed while Π is hyper-inflated');
  assert.equal(vm.graduatedRay7AuraActive, false);
  assert.equal(vm.auraHex, '#3dc8ff');
  assert.match(vm.svgWellPathD, /^M 0 6 L \d+ 6 Q \d+ \d+ \d+ 6 L 120 6$/);
});

test('healed, graduated rover blooms the Ray-7 violet aura with open escrow gate', () => {
  const vm = computeHarnessHudViewModel(healedState(), new Float64Array([0.02, 17.4, 17.3, 0]), -127, 1.64, 1.0, 0.65);
  assert.equal(vm.trenchColorHex, '#3dc8ff');
  assert.equal(vm.auraHex, '#b84dff');
  assert.equal(vm.graduatedRay7AuraActive, true);
  assert.equal(vm.masteryProgressRatio, 1.0);
  assert.ok(vm.escrowGateOpenRatio > 0.85, `gate open as Π → 0 (${vm.escrowGateOpenRatio.toFixed(3)})`);
  assert.ok(vm.mirrorErrorNorm < 0.01 && vm.phaseLockDeg === 0, 'reticle rings phase-locked');
  assert.equal(vm.explorationReserveJ, healedState()[StateIdx.E_RESERVE]!);
  // awareness is stored in f32; the ratio lands within one f32 ulp of full scale
  assert.ok(vm.awarenessRatio > 0.999 && vm.awarenessRatio <= 1.0, String(vm.awarenessRatio));
});

test('aura shifts to emerald in the 0.90 ≤ H < graduation band', () => {
  const s = healedState();
  s[StateIdx.H_COHERENCE] = 0.92;
  const vm = computeHarnessHudViewModel(s, new Float64Array(4), 0, 0.3, 1.0, 0.65);
  assert.equal(vm.auraHex, '#3eff8b');
  assert.equal(vm.graduatedRay7AuraActive, false);
});
