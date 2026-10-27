/**
 * @hm/mobsim — Rover Escort & Squad Overseer SovereignInceptionLoop Consumer Binding
 * Repository Path: packages/mobsim/src/rover-harness-binding.ts
 *
 * Binds @hm/harness (StateIdx, IVesselPreset, IHarnessTuning, the Cayley-Padé midpoint
 * resolvent) to the physical Rover Escort controller in @hm/mobsim (Plan 47, Pillar 1).
 *
 * INVARIANTS (RULES 8a — ZERO ARCHITECTURAL LIES):
 * 1. Zero imperative steering clamps (`if (panic) steer = 0` is strictly forbidden).
 * 2. Steering torque, wheel traction slip recovery, and escort line maintenance emerge 100%
 *    from the coupled Port-Hamiltonian + Active Inference differential equations driven by
 *    upward somatic telemetry y_up and downward Higher-Self prior modulation mu_down.
 * 3. Zero closures and zero heap allocations on the steady-state tick path: every mutable
 *    buffer (state vector, telemetry, ledger, latch, mastery timer, resolvent scratch) is
 *    owned by the caller and passed in.
 * 4. The plant integrator is the canonical `stepCayleyPadeMidpoint` from @hm/harness, not a
 *    local copy — one source of integrator truth.
 */

import {
  CayleyPadeOut,
  StateIdx,
  smoothSigmoid,
  stepCayleyPadeMidpoint,
  type IHarnessTuning,
  type IVesselPreset,
} from '@hm/harness';
import type { ContextModeCode, EthicalConstraintCode } from '@hm/cartlab';

export interface IRoverPhysicalInput {
  /** Desired escort lane lateral offset [m] (e.g. 0.0 for centerline escort) */
  readonly escortLineTargetX: number;
  /** Desired escort forward speed [m/s] */
  readonly escortSpeedTargetMps: number;
  /** Flatbed/ambient acoustic concussion level [dB] (e.g. 130 dB heavy gunfire) */
  readonly flatbedGunfireDb: number;
  /** Whether acoustic source is allied gunners on the rover flatbed (known to Depth N+1) */
  readonly gunfireIsFriendlyAllies: boolean;
  /** Surface friction coefficient mu_tire in [0.1, 1.0] (Lunar regolith ~0.45, Earth asphalt ~0.85) */
  readonly surfaceGripMu: number;
  /** External lateral blast/recoil impulse force [N] */
  readonly lateralImpulseN: number;
}

export interface IRoverActuatorOutput {
  /** Front wheel steering angle delta_steer [rad] in [-maxSteer, +maxSteer] via smooth tanh saturation */
  steerAngleRad: number;
  /** All-wheel drive traction torque [N*m] modulated by traction slip & released syntropic reserve */
  driveTorqueNm: number;
  /** Active suspension syntropic damping coefficient [N*s/m] */
  activeSuspensionDampingNspm: number;
  /** Current lateral deviation from escort line [m] */
  lateralErrorM: number;
  /** Current wheel traction slip ratio in [0, 1] */
  tractionSlipRatio: number;
  /** Whether Depth N has graduated to Higher Self stewardship (G_ascent) */
  graduatedToSquadLeader: boolean;
}

/**
 * Derives the harness's physical input vector from the REAL driven-rover somatics (plan 47
 * live wiring): the lateral jolt is the measured change in sideways velocity (skids, landings,
 * collisions), the concussion channel carries the scene's actual impact-audio level, and the
 * surface grip follows the world's gravity (Lunar regolith 0.45 under ~1.62 m/s², Earth
 * asphalt 0.85 under ~9.81 m/s²). Pure; no invented inputs.
 */
export function deriveRoverHarnessInput(
  lateralVelMps: number,
  prevLateralVelMps: number,
  dtSec: number,
  vesselMassKg: number,
  gravityMps2: number,
  concussionDb: number,
  escortSpeedMps: number,
): IRoverPhysicalInput {
  return {
    escortLineTargetX: 0.0,
    escortSpeedTargetMps: escortSpeedMps,
    flatbedGunfireDb: concussionDb,
    gunfireIsFriendlyAllies: true,
    surfaceGripMu: gravityMps2 > 5.0 ? 0.85 : 0.45,
    lateralImpulseN: (vesselMassKg * (lateralVelMps - prevLateralVelMps)) / Math.max(1e-6, dtSec),
  };
}

/**
 * Pure, zero-allocation tick binding the SovereignInceptionLoop state (Float32Array(24))
 * to the Rover Escort's physical steering, traction, and formation actuators.
 *
 * - Depth N (Rover Vessel): feels 130 dB flatbed gunfire as a lateral evasion prior
 *   perturbation (`x_panic = +2.40 m`), tire slip, and suspension strain.
 * - Depth N+1 (Squad Overseer Higher Self): reads y_up, recognizes friendly gunners on the
 *   flatbed (`gunfireIsFriendlyAllies`), sets mu_down (`COMBAT_ESCORT = 2`,
 *   `PRESERVE_ALLIES = 1`, `kappa_calm`), and couples passive regenerative impedance
 *   `r_syntropic` to absorb chassis recoil into `syntropicBuffer` while teaching Depth N to
 *   hold the escort line.
 *
 * Buffer contracts: `upwardTelemetry` Float32Array(4) [strain J, thermal J, acoustic norm,
 * traction slip]; `syntropicBuffer` Float64Array(4) [escrow J, absorbed J, released J,
 * external work J]; `cpScratch` Float64Array(CAYLEY_PADE_OUT_LENGTH) resolvent scratch.
 */
export function stepRoverEscortHarness(
  stateVec: Float32Array,
  upwardTelemetry: Float32Array,
  syntropicBuffer: Float64Array,
  latchState: Int8Array,
  latchAccumRef: Float32Array,
  masteryTimerRef: Float32Array,
  cpScratch: Float64Array,
  vessel: IVesselPreset,
  tuning: IHarnessTuning,
  input: IRoverPhysicalInput,
  dt: number,
  enableHigherSelfBridge: boolean,
  outActuator: IRoverActuatorOutput,
): void {
  const m = vessel.substrate.massKg;
  const kSpring = vessel.dynamics.stiffnessMatrix[0]!;
  const rBase = vessel.dynamics.dampingMatrix[0]!;
  const piBase = tuning.piBase;

  // 1. Expand vessel-bounded awareness A(t) -> relativeAwarenessCeiling
  const aMax = vessel.relativeAwarenessCeiling;
  stateVec[StateIdx.A_AWARE] =
    stateVec[StateIdx.A_AWARE]! + tuning.awarenessExpansionRate * (aMax - stateVec[StateIdx.A_AWARE]!) * dt;
  const A = stateVec[StateIdx.A_AWARE]!;

  const qx = stateVec[StateIdx.QX]!;
  const px = stateVec[StateIdx.PX]! + input.lateralImpulseN * dt;
  const vx = px / m;

  // 2. Compute tire traction slip ratio from lateral force vs surface grip envelope
  const lateralForceMag = Math.abs(kSpring * qx + rBase * vx);
  const maxTireGripForce = m * 9.81 * Math.max(0.1, input.surfaceGripMu);
  const tractionLoss = smoothSigmoid((lateralForceMag - maxTireGripForce) * 0.25);

  // 3. Upward Somatic Telemetry y_up (Depth N -> Depth N+1)
  const currentStrain = 0.5 * kSpring * qx * qx;
  const acousticNorm = input.flatbedGunfireDb / tuning.acousticFullScaleDb;
  upwardTelemetry[0] = currentStrain;
  upwardTelemetry[1] = stateVec[StateIdx.E_THERMAL]!;
  upwardTelemetry[2] = acousticNorm;
  upwardTelemetry[3] = tractionLoss;

  // 4. Downward Contextual Prior Modulation mu_down (Depth N+1 -> Depth N)
  const isAlliedEscort = enableHigherSelfBridge && input.gunfireIsFriendlyAllies;
  const contextMode: ContextModeCode = isAlliedEscort ? 2 /* COMBAT_ESCORT */ : 0;
  const ethicalConstraint: EthicalConstraintCode = isAlliedEscort ? 1 /* PRESERVE_ALLIES */ : 0;

  const somaticUrgency = smoothSigmoid(upwardTelemetry[0]! + upwardTelemetry[1]! + 2.0 * tractionLoss - 1.0);
  const precisionCalmFactor = isAlliedEscort ? 1.0 - tuning.calmAttenuation * somaticUrgency : 1.0;

  // Uninformed rover interprets 130 dB gunfire as hostile flank threat and targets panic swerve (+2.40 m);
  // Higher-Self informed rover integrates downward attractor target (input.escortLineTargetX)
  const panicSwerveOffset = 2.40 * Math.min(1.5, acousticNorm);
  const effectivePriorTarget = isAlliedEscort
    ? input.escortLineTargetX
    : input.escortLineTargetX + panicSwerveOffset;

  // 5. Cybernetic Mirror R & Differential Precision Annealing (Zero Imperative Clamps)
  const muPrior = stateVec[StateIdx.MU_PXD]!;
  const mirrorDiscrepancy = (qx - input.escortLineTargetX) + A * (muPrior - input.escortLineTargetX);
  const deltaE =
    mirrorDiscrepancy * mirrorDiscrepancy +
    acousticNorm * (1.0 - (isAlliedEscort ? precisionCalmFactor * tuning.calmAttenuation : 0.0));

  const strainRate = Math.abs((qx - muPrior) * vx) + A * currentStrain;
  const ftleTarget = isAlliedEscort
    ? tuning.ftleInceptStrainGain * currentStrain +
      tuning.ftleInceptPrecisionGain * stateVec[StateIdx.PI_PRIOR]! +
      tuning.ftleInceptBias
    : strainRate * tuning.ftleFreeStrainRateGain + tuning.ftleFreeBias;
  stateVec[StateIdx.LAMBDA_FTLE] =
    stateVec[StateIdx.LAMBDA_FTLE]! + tuning.ftleRelaxRate * (ftleTarget - stateVec[StateIdx.LAMBDA_FTLE]!) * dt;

  const breakerActivation = isAlliedEscort
    ? smoothSigmoid((stateVec[StateIdx.LAMBDA_FTLE]! - vessel.evaluator.maxFTLELimit) * tuning.breakerSlope)
    : 0.0;

  const distortionDrive = !isAlliedEscort
    ? tuning.distortionDriveGain * deltaE * (1.0 + tuning.awarenessCouplingCa * A)
    : 0.0;
  const annealSink = tuning.annealAlpha * breakerActivation * stateVec[StateIdx.PI_PRIOR]!;
  const flowRestore =
    tuning.flowBeta * (1.0 - breakerActivation) * (piBase * precisionCalmFactor - stateVec[StateIdx.PI_PRIOR]!);

  stateVec[StateIdx.PI_PRIOR] = Math.max(
    tuning.piFloorMin,
    stateVec[StateIdx.PI_PRIOR]! + (distortionDrive - annealSink + flowRestore) * dt,
  );
  const piPrior = stateVec[StateIdx.PI_PRIOR]!;

  // Bayesian transition latch L_ij in [-127, 127] with sub-LSB accumulator
  const latchRate =
    piPrior > tuning.latchEngagePrecision
      ? tuning.latchEngageGain * piPrior
      : -tuning.latchAnnealGain * breakerActivation - tuning.latchDecayBias;
  latchAccumRef[0] = Math.max(-127.0, Math.min(127.0, latchAccumRef[0]! + latchRate * dt));
  latchState[0] = Math.round(latchAccumRef[0]!);

  // Continuous generative prior update
  const priorLearningRate = tuning.priorLearningGain / (1.0 + tuning.priorLearningPrecisionDamp * piPrior);
  stateVec[StateIdx.MU_PXD] =
    stateVec[StateIdx.MU_PXD]! + priorLearningRate * (effectivePriorTarget - stateVec[StateIdx.MU_PXD]!) * dt;

  // 6. Port-Hamiltonian plant: the canonical unconditionally passive Cayley-Padé midpoint
  //    resolvent, with the Higher Self's passive syntropic impedance coupled into R.
  const rSyntropic = isAlliedEscort
    ? tuning.syntropicImpedanceNspm * (0.5 + 0.5 * Number(contextMode === 2 && ethicalConstraint === 1))
    : 0.0;
  const rDamp = rBase + rSyntropic;
  stepCayleyPadeMidpoint(m, kSpring, rDamp, qx, px, piPrior, stateVec[StateIdx.MU_PXD]!, dt, cpScratch);
  const nextQx = cpScratch[CayleyPadeOut.NEXT_QX]!;
  const nextPx = cpScratch[CayleyPadeOut.NEXT_PX]!;
  const midVel = cpScratch[CayleyPadeOut.MID_VELOCITY]!;
  const piTilde = cpScratch[CayleyPadeOut.PI_TILDE]!;
  const uPolicyForce = cpScratch[CayleyPadeOut.POLICY_FORCE]!;
  const dissipatedEnergy = cpScratch[CayleyPadeOut.DISSIPATED_J]!;
  syntropicBuffer[3] = syntropicBuffer[3]! + cpScratch[CayleyPadeOut.EXTERNAL_WORK_J]!;

  const harvestEfficiency = isAlliedEscort ? rSyntropic / rDamp : 0.0;
  const harvestedJ = dissipatedEnergy * harvestEfficiency;
  const thermalJ = dissipatedEnergy * (1.0 - harvestEfficiency);

  stateVec[StateIdx.E_THERMAL] = stateVec[StateIdx.E_THERMAL]! + thermalJ;
  syntropicBuffer[0] = syntropicBuffer[0]! + harvestedJ; // Escrow J
  syntropicBuffer[1] = syntropicBuffer[1]! + harvestedJ; // Total absorbed shock J

  // Phase-Locked Syntropic Escrow Gate
  const muUpdated = stateVec[StateIdx.MU_PXD]!;
  const freeEnergyF =
    0.5 * piPrior * (nextQx - muUpdated) * (nextQx - muUpdated) - 0.5 * Math.log(piPrior + 1e-6);
  const dFdt = (freeEnergyF - stateVec[StateIdx.D_DISTORT]!) / dt;
  const escrowGate = Math.exp(-piPrior / piBase) * smoothSigmoid(-dFdt * tuning.escrowFreeEnergySlope);
  const releasedJ = syntropicBuffer[0]! * escrowGate * tuning.escrowReleaseRate * dt;
  syntropicBuffer[0] = syntropicBuffer[0]! - releasedJ;
  syntropicBuffer[2] = syntropicBuffer[2]! + releasedJ;
  stateVec[StateIdx.E_RESERVE] = stateVec[StateIdx.E_RESERVE]! + releasedJ;

  stateVec[StateIdx.QX] = nextQx;
  stateVec[StateIdx.PX] = nextPx;
  stateVec[StateIdx.E_STRAIN] = 0.5 * kSpring * nextQx * nextQx;
  stateVec[StateIdx.D_DISTORT] = freeEnergyF;

  // Reflexive Capture Point xi & Conformal G_{4,1} Knee/Wishbone IK
  const omega0 = Math.sqrt(tuning.gravityMps2 / tuning.comHeightM);
  stateVec[StateIdx.XI_X] = nextQx + nextPx / m / omega0;
  stateVec[StateIdx.XI_Z] = stateVec[StateIdx.QZ]! + input.escortSpeedTargetMps / omega0;
  const l1 = tuning.limbL1M;
  const l2 = tuning.limbL2M;
  const dReach = Math.min((l1 + l2) * 0.995, Math.hypot(stateVec[StateIdx.XI_X]!, tuning.comHeightM, 0.0));
  const aSec = (l1 * l1 - l2 * l2 + dReach * dReach) / (2.0 * dReach);
  stateVec[StateIdx.H_IK] = Math.sqrt(Math.max(0.0, l1 * l1 - aSec * aSec));

  // Global 7-Ray Coherence H_system & Graduation G_ascent
  const alignError =
    Math.abs(nextQx - input.escortLineTargetX) + Math.abs(stateVec[StateIdx.MU_PXD]! - input.escortLineTargetX);
  const precisionExcess = Math.max(0.0, piPrior - piBase) / tuning.coherencePrecisionScale;
  stateVec[StateIdx.H_COHERENCE] =
    1.0 / (1.0 + tuning.coherenceAlignWeight * alignError + tuning.coherencePrecisionWeight * precisionExcess);

  if (stateVec[StateIdx.H_COHERENCE]! >= vessel.evaluator.targetCoherenceThreshold) {
    masteryTimerRef[0] = masteryTimerRef[0]! + dt;
  } else {
    masteryTimerRef[0] = 0.0;
  }
  const graduated = masteryTimerRef[0]! >= vessel.evaluator.masteryWindowSec;

  // 7. Physical Rover Actuator Mapping (Steering Angle, Traction Torque, Suspension Damping)
  const totalStiffness = kSpring + piTilde;
  const desiredLateralAccel = (-totalStiffness * nextQx + uPolicyForce - rDamp * midVel) / m;
  outActuator.steerAngleRad = 0.65 * Math.tanh(desiredLateralAccel * 0.18);
  outActuator.driveTorqueNm =
    m * input.escortSpeedTargetMps * 14.0 * (1.0 - 0.55 * tractionLoss) + releasedJ * 8.0;
  outActuator.activeSuspensionDampingNspm = rDamp;
  outActuator.lateralErrorM = Math.abs(nextQx - input.escortLineTargetX);
  outActuator.tractionSlipRatio = tractionLoss;
  outActuator.graduatedToSquadLeader = graduated;
}
