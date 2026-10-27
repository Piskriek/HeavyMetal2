/**
 * @file inception-loop.ts
 * @module @hm/harness
 * @description Bidirectional Inception Loop with Phase-Locked Syntropic Escrow Gate and
 * Graduation Operator G_ascent (Plan 46, Movement 2 §2.1.3–§2.1.4).
 *
 * Depth N (the embodied vessel) streams raw somatic telemetry upward (y_up) while Depth N+1
 * (its Higher Self) absorbs destructive energy spikes into syntropic escrow through passive
 * port coupling (R_syntropic) and modulates generative priors downward (μ_down). Trapped
 * strain is released back as exploration reserve only once the lower agent genuinely anneals
 * its precision (Π → 0) and reduces variational free energy (dF/dt < 0):
 *
 *   g_escrow(Π, dF/dt) = exp(−Π/Π₀) · σ(−dF/dt)
 *
 * Sustained global harmonic coherence H_system ≥ 0.95 over the mastery window fires the
 * Graduation Operator G_ascent: Depth N → Depth N+1.
 *
 * Every state transition is a continuous differential expression — ZERO imperative governor
 * clamps (Audit A3, RULES 8a). The only bounds are numerical-domain floors: the precision
 * positive-definiteness floor (Π ≥ piFloorMin, required for Tikhonov renormalization and the
 * log-precision entropy term) and the Int8 latch quantization range [−127, 127].
 *
 * The step math is the verified Spike 8 `stepSovereignHarness`, transcribed expression for
 * expression; constants are lifted into {@link IHarnessTuning} with the verified values as
 * {@link ESCORT_ROVER_TUNING}. Pure deterministic typed-array math: no Date.now, no
 * Math.random, no I/O. Timestamps are simulated time.
 */

import {
  StateIdx,
  type IBidirectionalInceptionLoop,
  type IInceptionNode,
  type IPriorModulationDownward,
  type ITelemetryUpward,
  type IVesselPreset,
} from './types.js';
import {
  CAYLEY_PADE_OUT_LENGTH,
  CayleyPadeOut,
  plantHamiltonianJ,
  stepCayleyPadeMidpoint,
  stepReflexivePlant,
} from './port-hamiltonian.js';

/** Slot layout of the `externalInput` Float32Array passed to {@link SovereignInceptionLoop.step}. */
export enum ExternalInputIdx {
  /** True escort trajectory target q* on the x axis [m]. */
  TARGET_X = 0,
  /** Incident acoustic flux [dB] (130 dB = gunfire on the flatbed, full scale). */
  ACOUSTIC_DB = 1,
  /** Awareness-expansion gate: > 0.5 enables dA/dt > 0 toward the vessel ceiling. */
  AWARENESS_GATE = 2,
  /** Higher-Self inception gate: > 0.5 couples R_syntropic and μ_down modulation. */
  INCEPTION_GATE = 3,
}

/** Required length of the external input vector. */
export const EXTERNAL_INPUT_LENGTH = 4;

/** Bit 0 of {@link IPriorModulationDownward.ethicalConstraintBitmask}: PRESERVE_ALLIES. */
export const ETHICAL_PRESERVE_ALLIES = 1 << 0;

/** C^∞ logistic sigmoid with an argument guard against floating-point overflow (never a state clamp). */
export function smoothSigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-Math.max(-40.0, Math.min(40.0, x))));
}

/**
 * Continuous-dynamics tuning of one vessel archetype. Every constant is a coefficient of a
 * differential expression in the step; none is a behavioral clamp. Values in
 * {@link ESCORT_ROVER_TUNING} are the Spike 8 verified set.
 */
export interface IHarnessTuning {
  /** Calm-flow baseline precision Π₀ the breaker anneals toward. */
  readonly piBase: number;
  /** Positive-definiteness floor of Π (domain requirement of Π̃ and ln Π, not a governor). */
  readonly piFloorMin: number;
  /** Annealing sink gain α_anneal on breaker activation. */
  readonly annealAlpha: number;
  /** Calm-flow restoring gain β_flow toward Π₀·κ_calm. */
  readonly flowBeta: number;
  /** Breaker sigmoid slope on (λ_FTLE − λ_crit). */
  readonly breakerSlope: number;
  /** Awareness expansion rate toward the vessel ceiling [1/s]. */
  readonly awarenessExpansionRate: number;
  /** Distortion drive gain γ_distort on squared mirror discrepancy. */
  readonly distortionDriveGain: number;
  /** Awareness coupling c_A amplifying distortion drive. */
  readonly awarenessCouplingCa: number;
  /** FTLE estimator relaxation rate [1/s]. */
  readonly ftleRelaxRate: number;
  /** Free-running FTLE target gain on strain rate (no Higher Self). */
  readonly ftleFreeStrainRateGain: number;
  /** Free-running FTLE target bias (no Higher Self). */
  readonly ftleFreeBias: number;
  /** Incepted FTLE target gain on strain energy. */
  readonly ftleInceptStrainGain: number;
  /** Incepted FTLE target gain on prior precision. */
  readonly ftleInceptPrecisionGain: number;
  /** Incepted FTLE target bias. */
  readonly ftleInceptBias: number;
  /** Generative prior learning gain. */
  readonly priorLearningGain: number;
  /** Precision damping of the prior learning rate: rate = gain / (1 + damp·Π). */
  readonly priorLearningPrecisionDamp: number;
  /** Precision above which the Bayesian latch engages (trench hardening). */
  readonly latchEngagePrecision: number;
  /** Latch log-odds engage rate per unit precision [1/s]. */
  readonly latchEngageGain: number;
  /** Latch log-odds anneal rate under breaker activation [1/s]. */
  readonly latchAnnealGain: number;
  /** Latch log-odds passive decay bias [1/s]. */
  readonly latchDecayBias: number;
  /** Passive syntropic coupling impedance R_syntropic the Higher Self presents [N·s/m]. */
  readonly syntropicImpedanceNspm: number;
  /** Escrow release rate κ_rel [1/s]; stable while κ_rel·Δt < 1. */
  readonly escrowReleaseRate: number;
  /** Slope of σ(−dF/dt) in the escrow gate. */
  readonly escrowFreeEnergySlope: number;
  /** Acoustic full-scale reference [dB]. */
  readonly acousticFullScaleDb: number;
  /** Fraction of acoustic/urgency influence the calm factor κ can attenuate. */
  readonly calmAttenuation: number;
  /** Somatic urgency sigmoid bias on (strain + thermal). */
  readonly somaticUrgencyBias: number;
  /** Slip-speed telemetry gain on |v| (tire-contact traction-loss proxy). */
  readonly slipTelemetryGain: number;
  /** Coherence penalty weight on trajectory misalignment. */
  readonly coherenceAlignWeight: number;
  /** Coherence penalty weight on precision excess. */
  readonly coherencePrecisionWeight: number;
  /** Normalization scale of precision excess in the coherence metric. */
  readonly coherencePrecisionScale: number;
  /** Two-bone limb lengths of the reflexive plant [m]. */
  readonly limbL1M: number;
  readonly limbL2M: number;
  /** Center-of-mass height z_c of the capture-point pendulum [m]. */
  readonly comHeightM: number;
  /** Gravitational acceleration [m/s²]. */
  readonly gravityMps2: number;
  /** Audit A1 closed-conservation tolerance [J]. */
  readonly conservationToleranceJ: number;
}

/** Spike 8 verified tuning of the Depth-2 Embodied Escort Rover. */
export const ESCORT_ROVER_TUNING: IHarnessTuning = {
  piBase: 1.5,
  piFloorMin: 0.02,
  annealAlpha: 18.0,
  flowBeta: 2.4,
  breakerSlope: 18.0,
  awarenessExpansionRate: 1.8,
  distortionDriveGain: 16.0,
  awarenessCouplingCa: 2.5,
  ftleRelaxRate: 4.0,
  ftleFreeStrainRateGain: 0.45,
  ftleFreeBias: 0.12,
  ftleInceptStrainGain: 0.35,
  ftleInceptPrecisionGain: 0.15,
  ftleInceptBias: -0.10,
  priorLearningGain: 3.6,
  priorLearningPrecisionDamp: 0.35,
  latchEngagePrecision: 4.0,
  latchEngageGain: 5.5,
  latchAnnealGain: 45.0,
  latchDecayBias: 12.0,
  syntropicImpedanceNspm: 4.2,
  escrowReleaseRate: 4.5,
  escrowFreeEnergySlope: 2.0,
  acousticFullScaleDb: 130.0,
  calmAttenuation: 0.85,
  somaticUrgencyBias: 1.2,
  slipTelemetryGain: 0.25,
  coherenceAlignWeight: 1.8,
  coherencePrecisionWeight: 0.9,
  coherencePrecisionScale: 15.0,
  limbL1M: 0.70,
  limbL2M: 0.70,
  comHeightM: 1.0,
  gravityMps2: 9.81,
  conservationToleranceJ: 1e-5,
};

/** Initial conditions of the loop's lower node (defaults are the Spike 8 scenario). */
export interface IInceptionLoopInit {
  /** The vessel's intrinsic (possibly distorted) prior attractor bias μ_PXD(0) [m]. */
  readonly distortedPriorBiasM: number;
  /** Initial syntropic exploration reserve E_reserve(0) [J]. */
  readonly initialReserveJ: number;
  /** Initial active awareness A(0) ∈ [0, ceiling]. */
  readonly initialAwareness: number;
  /** Initial global coherence H_system(0) ∈ [0, 1]. */
  readonly initialCoherence: number;
}

/** Spike 8 Step B initial conditions: a panic-distorted escort bias of 2.4 m. */
export const SPIKE8_SCENARIO_INIT: IInceptionLoopInit = {
  distortedPriorBiasM: 2.40,
  initialReserveJ: 5.0,
  initialAwareness: 0.12,
  initialCoherence: 0.50,
};

/**
 * Depth-2 Embodied Escort Rover vessel preset (Tier 2), matching the Spike 8 plant.
 * Load-bearing in Wave 1: substrate.massKg, dynamics.stiffnessMatrix[0],
 * dynamics.dampingMatrix[0], relativeAwarenessCeiling, and the full evaluator block.
 * The remaining fields complete the A2 four-fold signature as declared physical spec for the
 * multi-DOF waves (inertia from a 2 kg body of 0.25 m support radius; J/R are the canonical
 * 1-DOF (q, p) port matrices).
 */
export function createEscortRoverPreset(): IVesselPreset {
  return {
    id: 'vessel:escort-rover-depth2',
    tier: 2,
    relativeAwarenessCeiling: 0.65,
    substrate: {
      massKg: 2.0,
      inertiaTensorDiag: [0.125, 0.125, 0.125],
      supportPolygonArea: Math.PI * 0.25 * 0.25,
      acousticDampingCoeff: 0.12,
    },
    dynamics: {
      stiffnessMatrix: new Float32Array([8.0]),
      dampingMatrix: new Float32Array([1.4]),
      portHamiltonianJ: new Float32Array([0, 1, -1, 0]),
      portHamiltonianR: new Float32Array([0, 0, 0, 1.4]),
      maxTolerableStrainJ: 25.0,
    },
    transducer: {
      sensoryBandwidthHz: 50.0,
      noiseFloorStd: 0.22,
      telemetryQuantizationBits: 8,
    },
    evaluator: {
      targetCoherenceThreshold: 0.95,
      maxFTLELimit: 0.18,
      masteryWindowSec: 1.0,
    },
  };
}

/**
 * Depth-3 Squad Overseer vessel preset (Tier 3, the Higher Self). It owns no plant of its
 * own in Wave 1 (zero stiffness/damping): it participates purely as the passive syntropic
 * port impedance and the μ_down prior modulator.
 */
export function createSquadOverseerPreset(): IVesselPreset {
  return {
    id: 'vessel:squad-overseer-depth3',
    tier: 3,
    relativeAwarenessCeiling: 0.95,
    substrate: {
      massKg: 120.0,
      inertiaTensorDiag: [18.0, 22.0, 18.0],
      supportPolygonArea: 1.44,
      acousticDampingCoeff: 0.45,
    },
    dynamics: {
      stiffnessMatrix: new Float32Array([0.0]),
      dampingMatrix: new Float32Array([0.0]),
      portHamiltonianJ: new Float32Array([0, 1, -1, 0]),
      portHamiltonianR: new Float32Array([0, 0, 0, 0]),
      maxTolerableStrainJ: 400.0,
    },
    transducer: {
      sensoryBandwidthHz: 10.0,
      noiseFloorStd: 0.0,
      telemetryQuantizationBits: 32,
    },
    evaluator: {
      targetCoherenceThreshold: 0.95,
      maxFTLELimit: 0.18,
      masteryWindowSec: 1.0,
    },
  };
}

/** Float64 accounting slots (Audit A1 energy ledger, kept in double precision). */
const enumAccounting = { ESCROW: 0, ABSORBED: 1, RELEASED: 2, EXT_WORK: 3 } as const;

/**
 * The Sovereign Bidirectional Inception Loop between a Depth-N vessel and its Depth-N+1
 * Higher Self. Deterministic given its constructor arguments and the per-step inputs.
 */
export class SovereignInceptionLoop implements IBidirectionalInceptionLoop {
  readonly lowerNode: IInceptionNode;
  readonly higherSelfNode: IInceptionNode;

  private readonly tuning: IHarnessTuning;
  /** The vessel's intrinsic prior attractor when no Higher Self modulates it [m]. */
  private readonly selfBiasM: number;
  private readonly initialReserveJ: number;
  /** [escrowJ, absorbedJ, releasedJ, externalWorkJ] — double-precision energy ledger. */
  private readonly accounting = new Float64Array(4);
  /** Int8 Bayesian transition latch (trench log-odds) with sub-LSB accumulator. */
  private readonly latchArena = new Int8Array(1);
  private latchAccumulator = 0.0;
  /** Scratch for the Cayley-Padé resolvent (zero per-step allocation). */
  private readonly cpScratch = new Float64Array(CAYLEY_PADE_OUT_LENGTH);
  /** μ_down channel state (persists between steps; deltaE reads the previous step's κ). */
  private downwardContextMode: IPriorModulationDownward['contextMode'] = 'IDLE';
  private downwardEthicalBitmask = 0;
  private downwardTargetX = 0.0;
  private downwardCalmKappa = 1.0;
  private simTimeSec = 0.0;

  /** Diagnostics of the latest step (read-only views for HUD telemetry and audits). */
  private lastTrenchDepthJ = 0.0;
  private lastFreeEnergyNats = 0.0;
  private lastBreakerActivation = 0.0;
  private lastConservationResidualJ = 0.0;

  constructor(
    lowerPreset: IVesselPreset,
    higherPreset: IVesselPreset,
    tuning: IHarnessTuning = ESCORT_ROVER_TUNING,
    init: IInceptionLoopInit = SPIKE8_SCENARIO_INIT,
  ) {
    this.tuning = tuning;
    this.selfBiasM = init.distortedPriorBiasM;
    this.initialReserveJ = init.initialReserveJ;

    const lowerState = new Float32Array(24);
    lowerState[StateIdx.E_RESERVE] = init.initialReserveJ;
    lowerState[StateIdx.MU_PXD] = init.distortedPriorBiasM;
    lowerState[StateIdx.PI_KIN] = tuning.piBase;
    lowerState[StateIdx.PI_THERM] = 1.0;
    lowerState[StateIdx.PI_ACOUST] = 1.0;
    lowerState[StateIdx.PI_PRIOR] = tuning.piBase;
    lowerState[StateIdx.A_AWARE] = init.initialAwareness;
    lowerState[StateIdx.H_COHERENCE] = init.initialCoherence;

    const higherState = new Float32Array(24);
    higherState[StateIdx.A_AWARE] = higherPreset.relativeAwarenessCeiling;
    higherState[StateIdx.H_COHERENCE] = 1.0;

    this.lowerNode = {
      depth: 2,
      vesselPreset: lowerPreset,
      stateVector: lowerState,
      syntropicBuffer: {
        capacityJoules: 50.0,
        currentEscrowJoules: 0.0,
        currentReserveJoules: init.initialReserveJ,
        regenerativeImpedance: 0.0,
      },
      graduationContract: {
        requiredCoherence: lowerPreset.evaluator.targetCoherenceThreshold,
        masteryWindowSec: lowerPreset.evaluator.masteryWindowSec,
        consecutiveCoherentTimeSec: 0.0,
        isGraduated: false,
      },
    };
    this.higherSelfNode = {
      depth: 3,
      vesselPreset: higherPreset,
      stateVector: higherState,
      syntropicBuffer: {
        capacityJoules: 250.0,
        currentEscrowJoules: 0.0,
        currentReserveJoules: 0.0,
        regenerativeImpedance: tuning.syntropicImpedanceNspm,
      },
      graduationContract: {
        requiredCoherence: higherPreset.evaluator.targetCoherenceThreshold,
        masteryWindowSec: higherPreset.evaluator.masteryWindowSec,
        consecutiveCoherentTimeSec: 0.0,
        isGraduated: false,
      },
    };
  }

  /** Int8 Bayesian trench latch log-odds L ∈ [−127, 127]. */
  get latchLogOdds(): number {
    return this.latchArena[0]!;
  }

  /** |accounted − external work| of the latest step [J] (Audit A1). */
  get conservationResidualJ(): number {
    return this.lastConservationResidualJ;
  }

  /** Attractor trench depth U(q') around the intrinsic bias of the latest step [J]. */
  get trenchDepthJ(): number {
    return this.lastTrenchDepthJ;
  }

  /** Variational free energy F of the latest step [nats]. */
  get freeEnergyNats(): number {
    return this.lastFreeEnergyNats;
  }

  /** Attentional circuit breaker activation σ ∈ [0, 1] of the latest step. */
  get breakerActivation(): number {
    return this.lastBreakerActivation;
  }

  /** Accumulated simulated time [s] (deterministic; no wall clock). */
  get simulatedTimeSec(): number {
    return this.simTimeSec;
  }

  /**
   * Advances the loop by one timestep. `externalInput` layout is {@link ExternalInputIdx}.
   * The transition is the Spike 8 `stepSovereignHarness`, expression for expression.
   */
  step(dtSec: number, externalInput: Float32Array): {
    readonly upwardTelemetry: ITelemetryUpward;
    readonly downwardPrior: IPriorModulationDownward;
    readonly passesConservation: boolean;
  } {
    if (externalInput.length < EXTERNAL_INPUT_LENGTH) {
      throw new RangeError(`externalInput must hold ${EXTERNAL_INPUT_LENGTH} slots`);
    }
    const t = this.tuning;
    const s = this.lowerNode.stateVector;
    const preset = this.lowerNode.vesselPreset;
    const dt = dtSec;

    const targetTrueX = externalInput[ExternalInputIdx.TARGET_X]!;
    const acousticDbFlux = externalInput[ExternalInputIdx.ACOUSTIC_DB]!;
    const awarenessOn = externalInput[ExternalInputIdx.AWARENESS_GATE]! > 0.5;
    const inceptionOn = externalInput[ExternalInputIdx.INCEPTION_GATE]! > 0.5;

    const m = preset.substrate.massKg;
    const kSpring = preset.dynamics.stiffnessMatrix[0]!;
    const rSyntropic = inceptionOn ? t.syntropicImpedanceNspm : 0.0;
    const rDamp = preset.dynamics.dampingMatrix[0]! + rSyntropic;

    // 1. Awareness Expansion (dA/dt > 0 bounded smoothly by the vessel's awareness ceiling)
    const aMax = preset.relativeAwarenessCeiling;
    if (awarenessOn) {
      const dAdt = t.awarenessExpansionRate * (aMax - s[StateIdx.A_AWARE]!);
      s[StateIdx.A_AWARE] = s[StateIdx.A_AWARE]! + dAdt * dt;
    }
    const A = s[StateIdx.A_AWARE]!;

    // 2. The Cybernetic Mirror R: reflects internal prior bias back, scaled by awareness A(t).
    //    deltaE reads the PREVIOUS step's calm factor κ — the downward channel has one step
    //    of causal latency, as in the verified spike.
    const qx = s[StateIdx.QX]!;
    const px = s[StateIdx.PX]!;
    const muPrior = s[StateIdx.MU_PXD]!;
    const mirrorDiscrepancy = (qx - targetTrueX) + A * (muPrior - targetTrueX);
    const deltaE = mirrorDiscrepancy * mirrorDiscrepancy
      + (acousticDbFlux / t.acousticFullScaleDb) * (1.0 - this.downwardCalmKappa * t.calmAttenuation);

    // 3. Upward Somatic Telemetry y_up (Depth N -> Depth N+1), captured pre-step.
    const currentStrain = 0.5 * kSpring * qx * qx;
    const teleStrainJ = currentStrain;
    const teleThermalJ = s[StateIdx.E_THERMAL]!;
    const teleAcoustic = acousticDbFlux / t.acousticFullScaleDb;
    const teleSlipMps = Math.abs(px / m) * t.slipTelemetryGain;

    // 4. Downward Contextual Prior Modulation mu_down (Depth N+1 Higher Self -> Depth N)
    if (inceptionOn) {
      this.downwardContextMode = 'COMBAT_ESCORT';
      this.downwardEthicalBitmask = ETHICAL_PRESERVE_ALLIES;
      this.downwardTargetX = targetTrueX;
      const somaticUrgency = smoothSigmoid(teleStrainJ + teleThermalJ - t.somaticUrgencyBias);
      this.downwardCalmKappa = 1.0 - t.calmAttenuation * somaticUrgency;
    }

    // 5. Finite-Time Lyapunov Exponent (FTLE) & Continuous Differential Precision Dynamics
    const lambdaCrit = preset.evaluator.maxFTLELimit;
    const strainRate = Math.abs((qx - muPrior) * (px / m)) + A * currentStrain;
    const ftleTarget = inceptionOn
      ? (t.ftleInceptStrainGain * currentStrain + t.ftleInceptPrecisionGain * s[StateIdx.PI_PRIOR]! + t.ftleInceptBias)
      : (strainRate * t.ftleFreeStrainRateGain + t.ftleFreeBias);
    s[StateIdx.LAMBDA_FTLE] = s[StateIdx.LAMBDA_FTLE]! + t.ftleRelaxRate * (ftleTarget - s[StateIdx.LAMBDA_FTLE]!) * dt;

    const breakerActivation = inceptionOn
      ? smoothSigmoid((s[StateIdx.LAMBDA_FTLE]! - lambdaCrit) * t.breakerSlope)
      : 0.0;

    const distortionDrive = (!inceptionOn)
      ? t.distortionDriveGain * deltaE * (1.0 + t.awarenessCouplingCa * A)
      : 0.0;
    const annealSink = t.annealAlpha * breakerActivation * s[StateIdx.PI_PRIOR]!;
    const flowRestore = t.flowBeta * (1.0 - breakerActivation) * (t.piBase * this.downwardCalmKappa - s[StateIdx.PI_PRIOR]!);

    s[StateIdx.PI_PRIOR] = Math.max(t.piFloorMin, s[StateIdx.PI_PRIOR]! + (distortionDrive - annealSink + flowRestore) * dt);
    const piPrior = s[StateIdx.PI_PRIOR]!;

    // Bayesian transition latch L in [-127, 127] with sub-LSB accumulator (trench hardening).
    const latchRate = piPrior > t.latchEngagePrecision
      ? (t.latchEngageGain * piPrior)
      : (-t.latchAnnealGain * breakerActivation - t.latchDecayBias);
    this.latchAccumulator = Math.max(-127.0, Math.min(127.0, this.latchAccumulator + latchRate * dt));
    this.latchArena[0] = Math.round(this.latchAccumulator);

    // Generative prior mu_PXD update toward the effective attractor.
    const priorLearningRate = t.priorLearningGain / (1.0 + t.priorLearningPrecisionDamp * piPrior);
    const effectiveTarget = inceptionOn ? this.downwardTargetX : this.selfBiasM;
    s[StateIdx.MU_PXD] = s[StateIdx.MU_PXD]! + priorLearningRate * (effectiveTarget - s[StateIdx.MU_PXD]!) * dt;

    // 6. Port-Hamiltonian plant: unconditionally passive Cayley-Padé midpoint resolvent.
    const cp = this.cpScratch;
    stepCayleyPadeMidpoint(m, kSpring, rDamp, qx, px, piPrior, s[StateIdx.MU_PXD]!, dt, cp);
    const nextQx = cp[CayleyPadeOut.NEXT_QX]!;
    const nextPx = cp[CayleyPadeOut.NEXT_PX]!;
    const dissipatedEnergy = cp[CayleyPadeOut.DISSIPATED_J]!;
    this.accounting[enumAccounting.EXT_WORK] = this.accounting[enumAccounting.EXT_WORK]! + cp[CayleyPadeOut.EXTERNAL_WORK_J]!;

    // Syntropic buffering B_syntropic: the Higher Self harvests its impedance share of the
    // dissipation stream into escrow; the remainder is irreversible thermal rise.
    const harvestEfficiency = inceptionOn ? (rSyntropic / rDamp) : 0.0;
    const harvestedSyntropicJ = dissipatedEnergy * harvestEfficiency;
    const thermalIncrementJ = dissipatedEnergy * (1.0 - harvestEfficiency);

    s[StateIdx.E_THERMAL] = s[StateIdx.E_THERMAL]! + thermalIncrementJ;
    this.accounting[enumAccounting.ESCROW] = this.accounting[enumAccounting.ESCROW]! + harvestedSyntropicJ;
    this.accounting[enumAccounting.ABSORBED] = this.accounting[enumAccounting.ABSORBED]! + harvestedSyntropicJ;

    // Phase-Locked Syntropic Escrow Gate: released only under genuine annealing (Pi -> 0)
    // and falling free energy (dF/dt < 0).
    const muUpdated = s[StateIdx.MU_PXD]!;
    const freeEnergyF = 0.5 * piPrior * (nextQx - muUpdated) * (nextQx - muUpdated) - 0.5 * Math.log(piPrior + 1e-6);
    const prevF = s[StateIdx.D_DISTORT]!;
    const dFdt = (freeEnergyF - prevF) / dt;
    const escrowReleaseGate = Math.exp(-piPrior / t.piBase) * smoothSigmoid(-dFdt * t.escrowFreeEnergySlope);
    const releasedToReserveJ = this.accounting[enumAccounting.ESCROW]! * escrowReleaseGate * t.escrowReleaseRate * dt;
    this.accounting[enumAccounting.ESCROW] = this.accounting[enumAccounting.ESCROW]! - releasedToReserveJ;
    this.accounting[enumAccounting.RELEASED] = this.accounting[enumAccounting.RELEASED]! + releasedToReserveJ;
    s[StateIdx.E_RESERVE] = s[StateIdx.E_RESERVE]! + releasedToReserveJ;

    s[StateIdx.QX] = nextQx;
    s[StateIdx.PX] = nextPx;
    s[StateIdx.E_STRAIN] = 0.5 * kSpring * nextQx * nextQx;

    this.lastTrenchDepthJ = 0.5 * piPrior * (nextQx - this.selfBiasM) * (nextQx - this.selfBiasM);
    this.lastFreeEnergyNats = freeEnergyF;
    this.lastBreakerActivation = breakerActivation;
    s[StateIdx.D_DISTORT] = freeEnergyF;

    stepReflexivePlant(s, m, t.limbL1M, t.limbL2M, t.comHeightM, t.gravityMps2);

    // Global Harmonic Coherence H_system in [0, 1].
    const alignError = Math.abs(nextQx - targetTrueX) + Math.abs(s[StateIdx.MU_PXD]! - targetTrueX);
    const precisionExcess = Math.max(0.0, piPrior - t.piBase) / t.coherencePrecisionScale;
    s[StateIdx.H_COHERENCE] = 1.0 / (1.0 + t.coherenceAlignWeight * alignError + t.coherencePrecisionWeight * precisionExcess);

    // Graduation Operator G_ascent: sustained coherence over the mastery window promotes
    // Depth N -> Depth N+1. Graduation, once earned, is permanent.
    const contract = this.lowerNode.graduationContract;
    if (s[StateIdx.H_COHERENCE]! >= contract.requiredCoherence) {
      contract.consecutiveCoherentTimeSec += dt;
      if (contract.consecutiveCoherentTimeSec >= contract.masteryWindowSec) {
        contract.isGraduated = true;
      }
    } else {
      contract.consecutiveCoherentTimeSec = 0.0;
    }

    // Audit A1: closed-loop energy conservation. Plant + thermal + escrow + released reserve
    // must equal the accumulated external policy work, in double precision.
    const currentPlantH = plantHamiltonianJ(s[StateIdx.QX]!, s[StateIdx.PX]!, kSpring, m);
    const totalAccountedEnergy = currentPlantH + s[StateIdx.E_THERMAL]!
      + this.accounting[enumAccounting.ESCROW]!
      + (s[StateIdx.E_RESERVE]! - this.initialReserveJ);
    this.lastConservationResidualJ = Math.abs(totalAccountedEnergy - this.accounting[enumAccounting.EXT_WORK]!);

    // Mirror the ledger into the node buffers (the IInceptionNode public view).
    this.higherSelfNode.syntropicBuffer.currentEscrowJoules = this.accounting[enumAccounting.ESCROW]!;
    this.lowerNode.syntropicBuffer.currentReserveJoules = s[StateIdx.E_RESERVE]!;

    this.simTimeSec += dt;

    return {
      upwardTelemetry: {
        strainEnergyJ: teleStrainJ,
        thermalEnergyJ: teleThermalJ,
        normalizedAcousticFlux: teleAcoustic,
        slipSpeedMps: teleSlipMps,
        timestampMs: this.simTimeSec * 1000.0,
      },
      downwardPrior: {
        contextMode: this.downwardContextMode,
        ethicalConstraintBitmask: this.downwardEthicalBitmask,
        attractorTargetPos: [this.downwardTargetX, 0.0, 0.0],
        calmFactorKappa: this.downwardCalmKappa,
      },
      passesConservation: this.lastConservationResidualJ < t.conservationToleranceJ,
    };
  }
}
