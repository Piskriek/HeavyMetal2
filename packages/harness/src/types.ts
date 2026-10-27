/**
 * @file types.ts
 * @module @hm/harness
 * @description Zero-closure, pure typed array data contracts for the Sovereign Reality Harness.
 * Governed by RULES 8a (Zero Architectural Lies).
 */

/**
 * Four Floats tuple representing (Pxd, Vtx, Lx, Aq)
 */
export type FourFloatsTuple = [pxd: number, vtx: number, lx: number, aq: number];

/**
 * World fidelity render stage identifier
 */
export type FidelityStageId = 'S0a' | 'S0b' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6';

/**
 * Indices for the 24-float flat state vector
 */
export enum StateIdx {
  QX = 0, QY = 1, QZ = 2,
  PX = 3, PY = 4, PZ = 5,
  XI_X = 6, XI_Z = 7, H_IK = 8,
  E_STRAIN = 9, E_THERMAL = 10, E_RESERVE = 11,
  MU_PXD = 12, MU_VTX = 13, MU_LX = 14, MU_AQ = 15,
  PI_KIN = 16, PI_THERM = 17, PI_ACOUST = 18, PI_PRIOR = 19,
  A_AWARE = 20, D_DISTORT = 21, LAMBDA_FTLE = 22, H_COHERENCE = 23
}

export interface ISubstrateSpec {
  readonly massKg: number;
  readonly inertiaTensorDiag: readonly [number, number, number];
  readonly supportPolygonArea: number;
  readonly acousticDampingCoeff: number;
}

export interface IDynamicsSpec {
  readonly stiffnessMatrix: Float32Array;
  readonly dampingMatrix: Float32Array;
  readonly portHamiltonianJ: Float32Array;
  readonly portHamiltonianR: Float32Array;
  readonly maxTolerableStrainJ: number;
}

export interface ITransducerSpec {
  readonly sensoryBandwidthHz: number;
  readonly noiseFloorStd: number;
  readonly telemetryQuantizationBits: number;
}

export interface IEvaluatorSpec {
  readonly targetCoherenceThreshold: number;
  readonly maxFTLELimit: number;
  readonly masteryWindowSec: number;
}

export interface IVesselPreset {
  readonly id: string;
  readonly tier: 1 | 2 | 3;
  readonly relativeAwarenessCeiling: number;
  readonly substrate: ISubstrateSpec;
  readonly dynamics: IDynamicsSpec;
  readonly transducer: ITransducerSpec;
  readonly evaluator: IEvaluatorSpec;
}

export interface ITelemetryUpward {
  readonly strainEnergyJ: number;
  readonly thermalEnergyJ: number;
  readonly normalizedAcousticFlux: number;
  readonly slipSpeedMps: number;
  readonly timestampMs: number;
}

export interface IPriorModulationDownward {
  readonly contextMode: 'IDLE' | 'PATROL' | 'COMBAT_ESCORT' | 'RECOVERY';
  readonly ethicalConstraintBitmask: number;
  readonly attractorTargetPos: readonly [number, number, number];
  readonly calmFactorKappa: number;
}

export interface ISyntropicBuffer {
  readonly capacityJoules: number;
  currentEscrowJoules: number;
  currentReserveJoules: number;
  readonly regenerativeImpedance: number;
}

export interface IGraduationContract {
  readonly requiredCoherence: number;
  readonly masteryWindowSec: number;
  consecutiveCoherentTimeSec: number;
  isGraduated: boolean;
}

export interface IInceptionNode {
  readonly depth: number;
  readonly vesselPreset: IVesselPreset;
  readonly stateVector: Float32Array;
  readonly syntropicBuffer: ISyntropicBuffer;
  readonly graduationContract: IGraduationContract;
}

export interface IBidirectionalInceptionLoop {
  readonly lowerNode: IInceptionNode;
  readonly higherSelfNode: IInceptionNode;
  step(dtSec: number, externalInput: Float32Array): {
    readonly upwardTelemetry: ITelemetryUpward;
    readonly downwardPrior: IPriorModulationDownward;
    readonly passesConservation: boolean;
  };
}

export interface IRecursiveMemoryKernel {
  readonly activePersona: 'preset:persona-creative-anima' | 'preset:persona-precise-masculine' | 'preset:persona-neutral-observer';
  readonly stateVectorHex: string;
  readonly vsaChecksum4096: Uint32Array;
  compress(state: Float32Array): string;
  wake(hexPayload: string): Float32Array;
}
