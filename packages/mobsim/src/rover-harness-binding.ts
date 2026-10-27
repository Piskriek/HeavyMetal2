/**
 * @hm/mobsim — Rover Escort & Squad Overseer SovereignInceptionLoop Consumer Binding
 * Repository Path: packages/mobsim/src/rover-harness-binding.ts
 *
 * Binds @hm/harness (StateIdx, IVesselPreset, ITelemetryUpward, IPriorModulationDownward,
 * ISyntropicBuffer, IGraduationContract) to the physical Rover Escort controller in @hm/mobsim.
 *
 * INVARIANTS (RULES 8a — ZERO ARCHITECTURAL LIES):
 * 1. Zero imperative steering clamps (`if (panic) steer = 0` is strictly forbidden).
 * 2. Steering torque, wheel traction slip recovery, and escort line maintenance emerge 100%
 *    from the coupled Port-Hamiltonian + Active Inference differential equations driven by
 *    upward somatic telemetry y_up and downward Higher-Self prior modulation mu_down.
 * 3. Zero closures, zero heap allocations on the steady-state tick path.
 */

import {
  StateIdx,
  type ContextModeCode,
  type EthicalConstraintCode,
  type IVesselPreset,
} from '../../harness/src/types';

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
  /** All-wheel drive traction torque [N*m] modulated by Capture Point slip & syntropic damping */
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

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-Math.max(-40.0, Math.min(40.0, x))));
}

/**
 * Pure, zero-allocation tick binding `SovereignInceptionLoop` state (Float32Array(24))
 * to the Rover Escort's physical steering, traction, and formation actuators.
 *
 * - Depth N (Rover Vessel, A_relative = 0.65): Feels 130 dB flatbed gunfire as a lateral
 *   evasion prior perturbation (`x_panic = +2.40 m`), tire slip, and suspension strain.
 * - Depth N+1 (Squad Overseer Higher Self, A_relative = 0.92): Reads y_up, recognizes friendly
 *   gunners on the flatbed (`gunfireIsFriendlyAllies`), sets mu_down (`COMBAT_ESCORT = 2`,
 *   `PRESERVE_ALLIES = 1`, `kappa_calm`), and couples passive regenerative impedance `r_syntropic`
 *   to absorb chassis recoil into `syntropicBuffer` while teaching Depth N to hold the escort line.
 */
export function stepRoverEscortHarness(
  stateVec: Float32Array,
  upwardTelemetry: Float32Array,
  syntropicBuffer: Float64Array,
  latchState: Int8Array,
  latchAccumRef: Float32Array,
  masteryTimerRef: Float32Array,
  vessel: IVesselPreset,
  input: IRoverPhysicalInput,
  dt: number,
  enableHigherSelfBridge: boolean,
  outActuator: IRoverActuatorOutput,
): void {
  const m = vessel.dynamics.massKg;
  const kSpring = vessel.dynamics.stiffnessNpm;
  const rBase = vessel.dynamics.dampingNspm;
  const piBase = 1.5;

  // 1. Expand vessel-bounded awareness A(t) -> A_relative
  const aMax = vessel.relativeAwarenessBound;
  stateVec[StateIdx.A_AWARE] += vessel.dynamics.awarenessGrowthRate * (aMax - stateVec[StateIdx.A_AWARE]) * dt;
  const A = stateVec[StateIdx.A_AWARE];

  const qx = stateVec[StateIdx.Q_X];
  const px = stateVec[StateIdx.P_X] + input.lateralImpulseN * dt;
  const vx = px / m;

  // 2. Compute tire traction slip ratio from lateral momentum vs surface grip envelope
  const lateralForceMag = Math.abs(kSpring * qx + rBase * vx);
  const maxTireGripForce = m * 9.81 * Math.max(0.1, input.surfaceGripMu);
  const tractionLoss = sigmoid((lateralForceMag - maxTireGripForce) * 0.25);

  // 3. Upward Somatic Telemetry y_up (Depth N -> Depth N+1)
  const currentStrain = 0.5 * kSpring * qx * qx;
  const acousticNorm = input.flatbedGunfireDb / 130.0;
  upwardTelemetry[0] = currentStrain;
  upwardTelemetry[1] = stateVec[StateIdx.E_THERMAL];
  upwardTelemetry[2] = acousticNorm;
  upwardTelemetry[3] = tractionLoss;

  // 4. Downward Contextual Prior Modulation mu_down (Depth N+1 -> Depth N)
  const isAlliedEscort = enableHigherSelfBridge && input.gunfireIsFriendlyAllies;
  const contextMode: ContextModeCode = isAlliedEscort ? 2 /* COMBAT_ESCORT */ : 0;
  const ethicalConstraint: EthicalConstraintCode = isAlliedEscort ? 1 /* PRESERVE_ALLIES */ : 0;

  const somaticUrgency = sigmoid(upwardTelemetry[0] + upwardTelemetry[1] + 2.0 * tractionLoss - 1.0);
  const precisionCalmFactor = isAlliedEscort ? (1.0 - 0.85 * somaticUrgency) : 1.0;

  // Uninformed rover interprets 130 dB gunfire as hostile flank threat and targets panic swerve (+2.40 m);
  // Higher-Self informed rover integrates downward attractor target (input.escortLineTargetX)
  const panicSwerveOffset = 2.40 * Math.min(1.5, acousticNorm);
  const effectivePriorTarget = isAlliedEscort
    ? input.escortLineTargetX
    : input.escortLineTargetX + panicSwerveOffset;

  // 5. Cybernetic Mirror R & Differential Precision Annealing (Zero Imperative Clamps)
  const muPrior = stateVec[StateIdx.MU_PXD];
  const mirrorDiscrepancy = (qx - input.escortLineTargetX) + A * (muPrior - input.escortLineTargetX);
  const deltaE =
    mirrorDiscrepancy * mirrorDiscrepancy +
    acousticNorm * (1.0 - (isAlliedEscort ? precisionCalmFactor * 0.85 : 0.0));

  const strainRate = Math.abs((qx - muPrior) * vx) + A * currentStrain;
  const ftleTarget = isAlliedEscort
    ? 0.35 * currentStrain + 0.15 * stateVec[StateIdx.PI_PRIOR] - 0.10
    : strainRate * 0.45 + 0.12;
  stateVec[StateIdx.LAMBDA_FTLE] += 4.0 * (ftleTarget - stateVec[StateIdx.LAMBDA_FTLE]) * dt;

  const breakerActivation = isAlliedEscort
    ? sigmoid((stateVec[StateIdx.LAMBDA_FTLE] - vessel.dynamics.lyapunovCriticalThreshold) * 18.0)
    : 0.0;

  const distortionDrive = !isAlliedEscort ? 16.0 * deltaE * (1.0 + 2.5 * A) : 0.0;
  const annealSink = vessel.dynamics.annealRateAlpha * breakerActivation * stateVec[StateIdx.PI_PRIOR];
  const flowRestore =
    vessel.dynamics.flowRestoreRateBeta *
    (1.0 - breakerActivation) *
    (piBase * precisionCalmFactor - stateVec[StateIdx.PI_PRIOR]);

  stateVec[StateIdx.PI_PRIOR] = Math.max(
    0.02,
    stateVec[StateIdx.PI_PRIOR] + (distortionDrive - annealSink + flowRestore) * dt,
  );
  const piPrior = stateVec[StateIdx.PI_PRIOR];

  // Bayesian transition latch L_ij in [-127, 127]
  const latchRate = piPrior > 4.0 ? 5.5 * piPrior : -45.0 * breakerActivation - 12.0;
  latchAccumRef[0] = Math.max(-127.0, Math.min(127.0, latchAccumRef[0] + latchRate * dt));
  latchState[0] = Math.round(latchAccumRef[0]);

  // Continuous generative prior update
  const priorLearningRate = 3.6 / (1.0 + 0.35 * piPrior);
  stateVec[StateIdx.MU_PXD] += priorLearningRate * (effectivePriorTarget - stateVec[StateIdx.MU_PXD]) * dt;

  // 6. Port-Hamiltonian Cayley-Pade Symplectic Plant + Syntropic Buffering B_syntropic
  const rSyntropic = isAlliedEscort ? 4.2 * (0.5 + 0.5 * Number(contextMode === 2 && ethicalConstraint === 1)) : 0.0;
  const rDamp = rBase + rSyntropic;
  const piTilde = piPrior / (1.0 + 0.25 * dt * dt * (piPrior / m));
  const totalStiffness = kSpring + piTilde;
  const uPolicyForce = piTilde * stateVec[StateIdx.MU_PXD];

  const denom = 1.0 + 0.5 * dt * (rDamp / m) + 0.25 * dt * dt * (totalStiffness / m);
  const midVel = (vx + 0.5 * dt * ((-totalStiffness * qx + uPolicyForce) / m)) / denom;
  const nextQx = qx + dt * midVel;
  const nextPx = m * midVel + 0.5 * dt * (-totalStiffness * nextQx - rDamp * midVel + uPolicyForce);

  const prevPlantH = 0.5 * kSpring * qx * qx + 0.5 * (px * px) / m;
  const nextPlantH = 0.5 * kSpring * nextQx * nextQx + 0.5 * (nextPx * nextPx) / m;
  const dissipatedEnergy = rDamp * midVel * midVel * dt;
  const externalWork = nextPlantH - prevPlantH + dissipatedEnergy;
  syntropicBuffer[3] += externalWork;

  const harvestEfficiency = isAlliedEscort ? rSyntropic / rDamp : 0.0;
  const harvestedJ = dissipatedEnergy * harvestEfficiency;
  const thermalJ = dissipatedEnergy * (1.0 - harvestEfficiency);

  stateVec[StateIdx.E_THERMAL] += thermalJ;
  syntropicBuffer[0] += harvestedJ; // Escrow J
  syntropicBuffer[1] += harvestedJ; // Total absorbed shock J

  const freeEnergyF =
    0.5 * piPrior * (nextQx - stateVec[StateIdx.MU_PXD]) * (nextQx - stateVec[StateIdx.MU_PXD]) -
    0.5 * Math.log(piPrior + 1e-6);
  const dFdt = (freeEnergyF - stateVec[StateIdx.D_DISTORT]) / dt;
  const escrowGate = Math.exp(-piPrior / piBase) * sigmoid(-dFdt * 2.0);
  const releasedJ = syntropicBuffer[0] * escrowGate * 4.5 * dt;
  syntropicBuffer[0] -= releasedJ;
  syntropicBuffer[2] += releasedJ;
  stateVec[StateIdx.E_RESERVE] += releasedJ;

  stateVec[StateIdx.Q_X] = nextQx;
  stateVec[StateIdx.P_X] = nextPx;
  stateVec[StateIdx.E_STRAIN] = 0.5 * kSpring * nextQx * nextQx;
  stateVec[StateIdx.D_DISTORT] = freeEnergyF;

  // Reflexive Capture Point xi & Conformal G_{4,1} Knee/Wishbone IK
  const omega0 = Math.sqrt(9.81 / 1.0);
  stateVec[StateIdx.XI_X] = nextQx + (nextPx / m) / omega0;
  stateVec[StateIdx.XI_Z] = stateVec[StateIdx.Q_Z] + input.escortSpeedTargetMps / omega0;
  const l1 = vessel.limbLengthsM[0];
  const l2 = vessel.limbLengthsM[1];
  const dReach = Math.min((l1 + l2) * 0.995, Math.hypot(stateVec[StateIdx.XI_X], 1.0, 0.0));
  const aSec = (l1 * l1 - l2 * l2 + dReach * dReach) / (2.0 * dReach);
  stateVec[StateIdx.IK_H] = Math.sqrt(Math.max(0.0, l1 * l1 - aSec * aSec));

  // Global 7-Ray Coherence H_system & Graduation G_ascent
  const alignError =
    Math.abs(nextQx - input.escortLineTargetX) + Math.abs(stateVec[StateIdx.MU_PXD] - input.escortLineTargetX);
  const precisionExcess = Math.max(0.0, piPrior - piBase) / 15.0;
  stateVec[StateIdx.H_COHERENCE] = 1.0 / (1.0 + 1.8 * alignError + 0.9 * precisionExcess);

  if (stateVec[StateIdx.H_COHERENCE] >= vessel.evaluator.minCoherenceTarget) {
    masteryTimerRef[0] += dt;
  } else {
    masteryTimerRef[0] = 0.0;
  }
  const graduated = masteryTimerRef[0] >= vessel.evaluator.masteryDurationSec;

  // 7. Physical Rover Actuator Mapping (Steering Angle, Traction Torque, Suspension Damping)
  const desiredLateralAccel = (-totalStiffness * nextQx + uPolicyForce - rDamp * midVel) / m;
  outActuator.steerAngleRad = 0.65 * Math.tanh(desiredLateralAccel * 0.18);
  outActuator.driveTorqueNm =
    m * input.escortSpeedTargetMps * 14.0 * (1.0 - 0.55 * tractionLoss) + releasedJ * 8.0;
  outActuator.activeSuspensionDampingNspm = rDamp;
  outActuator.lateralErrorM = Math.abs(nextQx - input.escortLineTargetX);
  outActuator.tractionSlipRatio = tractionLoss;
  outActuator.graduatedToSquadLeader = graduated;
}
