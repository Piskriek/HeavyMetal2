/**
 * Plan 47 Pillar 1 verification through the PRODUCTION TypeScript binding (the standalone
 * scripts/test-harness-consumer-integration.js verifies the same scenario in plain JS; this
 * suite proves the aligned @hm/mobsim + @hm/harness code path reproduces it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAYLEY_PADE_OUT_LENGTH,
  ESCORT_ROVER_TUNING,
  StateIdx,
  createEscortRoverPreset,
} from '@hm/harness';
import { stepRoverEscortHarness, type IRoverActuatorOutput, type IRoverPhysicalInput } from '../src/rover-harness-binding';

function makeScenario() {
  const stateVec = new Float32Array(24);
  stateVec[StateIdx.E_RESERVE] = 5.0;
  stateVec[StateIdx.MU_PXD] = 2.40; // panic-distorted evasion prior (+2.40 m)
  stateVec[StateIdx.PI_PRIOR] = 1.5;
  stateVec[StateIdx.A_AWARE] = 0.12;
  return {
    stateVec,
    upwardTel: new Float32Array(4),
    syntropicBuf: new Float64Array(4),
    latchArr: new Int8Array(1),
    latchAccum: new Float32Array(1),
    masteryTimer: new Float32Array(1),
    cpScratch: new Float64Array(CAYLEY_PADE_OUT_LENGTH),
    vessel: createEscortRoverPreset(),
    actuator: {
      steerAngleRad: 0,
      driveTorqueNm: 0,
      activeSuspensionDampingNspm: 0,
      lateralErrorM: 0,
      tractionSlipRatio: 0,
      graduatedToSquadLeader: false,
    } as IRoverActuatorOutput,
  };
}

const INPUT: IRoverPhysicalInput = {
  escortLineTargetX: 0.0,
  escortSpeedTargetMps: 6.0,
  flatbedGunfireDb: 130.0,
  gunfireIsFriendlyAllies: true,
  surfaceGripMu: 0.55,
  lateralImpulseN: 0.0,
};

test('unbuffered rover panics under 130 dB gunfire: trench lock, swerve, severe tire slip', () => {
  const s = makeScenario();
  for (let i = 0; i < 140; i++) {
    stepRoverEscortHarness(
      s.stateVec, s.upwardTel, s.syntropicBuf, s.latchArr, s.latchAccum, s.masteryTimer,
      s.cpScratch, s.vessel, ESCORT_ROVER_TUNING, INPUT, 0.02, false, s.actuator,
    );
  }
  assert.ok(s.actuator.lateralErrorM > 1.8,
    `unbuffered rover swerves off the escort line (err=${s.actuator.lateralErrorM.toFixed(3)} m > 1.8 m)`);
  assert.ok(s.actuator.tractionSlipRatio > 0.6,
    `panic swerve induces severe tire slip (${s.actuator.tractionSlipRatio.toFixed(3)} > 0.60)`);
  assert.ok(s.stateVec[StateIdx.PI_PRIOR]! > 10.0,
    `prior precision hyper-inflates (Π=${s.stateVec[StateIdx.PI_PRIOR]!.toFixed(2)} > 10)`);
  assert.equal(s.latchArr[0]!, 127, 'Bayesian trench latch saturates at +127');
  assert.equal(s.actuator.graduatedToSquadLeader, false);
});

test('Higher-Self bridge anneals the trench: escort line, slip recovery, reserve, graduation', () => {
  const s = makeScenario();
  for (let i = 0; i < 140; i++) {
    stepRoverEscortHarness(
      s.stateVec, s.upwardTel, s.syntropicBuf, s.latchArr, s.latchAccum, s.masteryTimer,
      s.cpScratch, s.vessel, ESCORT_ROVER_TUNING, INPUT, 0.02, false, s.actuator,
    );
  }
  const reserveBeforeBridge = s.stateVec[StateIdx.E_RESERVE]!;
  for (let i = 0; i < 240; i++) {
    stepRoverEscortHarness(
      s.stateVec, s.upwardTel, s.syntropicBuf, s.latchArr, s.latchAccum, s.masteryTimer,
      s.cpScratch, s.vessel, ESCORT_ROVER_TUNING, INPUT, 0.02, true, s.actuator,
    );
  }
  assert.ok(s.actuator.lateralErrorM < 0.01,
    `mu_down + B_syntropic restore the escort line (err=${s.actuator.lateralErrorM.toFixed(4)} m < 0.01 m)`);
  assert.ok(s.actuator.tractionSlipRatio < 0.15,
    `tire slip recovered through syntropic suspension damping (${s.actuator.tractionSlipRatio.toFixed(4)} < 0.15)`);
  assert.ok(s.stateVec[StateIdx.E_RESERVE]! > reserveBeforeBridge,
    `chassis recoil transmuted into exploration reserve (${s.stateVec[StateIdx.E_RESERVE]!.toFixed(2)} J)`);
  assert.ok(s.stateVec[StateIdx.H_COHERENCE]! >= 0.95,
    `global coherence reached (H=${s.stateVec[StateIdx.H_COHERENCE]!.toFixed(4)})`);
  assert.equal(s.actuator.graduatedToSquadLeader, true, 'G_ascent graduation fires after the mastery window');
  assert.ok(s.actuator.activeSuspensionDampingNspm > s.vessel.dynamics.dampingMatrix[0]!,
    'active suspension carries the coupled syntropic impedance');
  // The energy ledger stays physical: escrow never negative, absorbed >= released.
  assert.ok(s.syntropicBuf[0]! >= 0.0 && s.syntropicBuf[1]! >= s.syntropicBuf[2]!);
});

test('steering saturates smoothly through tanh — no imperative clamp discontinuity', () => {
  const s = makeScenario();
  let maxAbsSteer = 0.0;
  for (let i = 0; i < 380; i++) {
    stepRoverEscortHarness(
      s.stateVec, s.upwardTel, s.syntropicBuf, s.latchArr, s.latchAccum, s.masteryTimer,
      s.cpScratch, s.vessel, ESCORT_ROVER_TUNING, INPUT, 0.02, i >= 140, s.actuator,
    );
    maxAbsSteer = Math.max(maxAbsSteer, Math.abs(s.actuator.steerAngleRad));
    assert.ok(Number.isFinite(s.actuator.steerAngleRad));
  }
  assert.ok(maxAbsSteer <= 0.65, `|steer| stays inside the 0.65 rad tanh envelope (max=${maxAbsSteer.toFixed(3)})`);
});
