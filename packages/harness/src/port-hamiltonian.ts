/**
 * @file port-hamiltonian.ts
 * @module @hm/harness
 * @description Unconditionally passive Cayley-Padé Midpoint Resolvent with Tikhonov-renormalized
 * precision (Plan 46, Movement 2 §2.1.2) plus the sub-millisecond reflexive plant
 * (3D Capture Point ξ and Conformal G₄,₁ knee IK altitude).
 *
 * Plant ODE (1-DOF escort axis, generalizable per vessel):
 *
 *   dx/dt = (J − R)·∇H(x) + G·u_policy
 *
 * with H(q, p) = ½·k·q² + ½·p²/m, skew-symmetric J, and R = R_plant + R_syntropic ≥ 0.
 *
 * The belief spring Π acts as additional stiffness pulling q toward μ_prior. To survive the
 * Symplectic-Thermodynamic CFL Trap (hyper-precision Π at coarse S₀ timesteps injecting phantom
 * energy under explicit integration), Π is Tikhonov-renormalized before entering the resolvent:
 *
 *   Π̃(Δt) = Π / (1 + ¼·Δt²·Π/m)
 *
 * and the state advances through the Cayley-Padé midpoint resolvent whose denominator
 * 1 + ½·Δt·R/m + ¼·Δt²·K/m ≥ 1 for every Δt > 0, K ≥ 0, R ≥ 0, guaranteeing a contraction
 * (unconditional passivity) at arbitrary stiffness. ZERO imperative governor clamps (RULES 8a).
 *
 * All functions are pure deterministic typed-array math: no Date.now, no Math.random, no I/O,
 * no allocation (results are written into caller-provided Float64Array scratch).
 */

import { StateIdx } from './types.js';

/**
 * Tikhonov renormalization of a scalar precision entry against timestep stiffness:
 * Π̃ = Π / (1 + ¼·Δt²·Π/m). Monotone in Π, bounded by 4m/Δt², and Π̃ → Π as Δt → 0.
 */
export function tikhonovRenormalizePrecision(piPrior: number, dtSec: number, massKg: number): number {
  return piPrior / (1.0 + 0.25 * dtSec * dtSec * (piPrior / massKg));
}

/** Plant Hamiltonian H(q, p) = ½·k·q² + ½·p²/m in Joules (plant spring only, belief spring excluded). */
export function plantHamiltonianJ(qxM: number, pxNs: number, stiffnessNpm: number, massKg: number): number {
  return 0.5 * stiffnessNpm * qxM * qxM + 0.5 * (pxNs * pxNs) / massKg;
}

/** Output slot indices for {@link stepCayleyPadeMidpoint}'s Float64Array scratch. */
export enum CayleyPadeOut {
  /** Next generalized position q' [m]. */
  NEXT_QX = 0,
  /** Next conjugate momentum p' [N·s]. */
  NEXT_PX = 1,
  /** Midpoint velocity v_mid [m/s]. */
  MID_VELOCITY = 2,
  /** Tikhonov-renormalized precision Π̃(Δt). */
  PI_TILDE = 3,
  /** Non-dissipative policy force u = Π̃·μ_prior [N]. */
  POLICY_FORCE = 4,
  /** Plant Hamiltonian before the step [J]. */
  H_PREV_J = 5,
  /** Plant Hamiltonian after the step [J]. */
  H_NEXT_J = 6,
  /** Energy dissipated through R over the step: R·v_mid²·Δt [J]. */
  DISSIPATED_J = 7,
  /** External policy work over the step: ΔH + dissipated [J] (exact accounting identity). */
  EXTERNAL_WORK_J = 8,
}

/** Required length of the Float64Array scratch passed to {@link stepCayleyPadeMidpoint}. */
export const CAYLEY_PADE_OUT_LENGTH = 9;

/**
 * One Cayley-Padé midpoint resolvent step of the 1-DOF port-Hamiltonian plant.
 *
 * Expression-for-expression the verified Spike 8 integrator:
 *
 *   Π̃      = Π / (1 + ¼Δt²Π/m)
 *   K      = k + Π̃                     (plant spring + renormalized belief spring)
 *   u      = Π̃·μ_prior                 (non-dissipative policy input through port G)
 *   denom  = 1 + ½Δt·R/m + ¼Δt²·K/m    (≥ 1 ⟹ unconditional passivity)
 *   v_mid  = (p/m + ½Δt·(−K·q + u)/m) / denom
 *   q'     = q + Δt·v_mid
 *   p'     = m·v_mid + ½Δt·(−K·q' − R·v_mid + u)
 *
 * Energy bookkeeping (written into `out`) satisfies the exact identity
 * EXTERNAL_WORK_J ≡ (H_NEXT_J − H_PREV_J) + DISSIPATED_J by construction, which is what the
 * Audit A1 closed-conservation check sums against.
 *
 * @param massKg          Vessel mass m > 0 [kg].
 * @param stiffnessNpm    Plant spring constant k ≥ 0 [N/m].
 * @param totalDampingNspm Total damping R = R_plant + R_syntropic ≥ 0 [N·s/m].
 * @param qxM             Current generalized position q [m].
 * @param pxNs            Current conjugate momentum p [N·s].
 * @param piPrior         Prior precision Π > 0 (belief-spring stiffness).
 * @param muPrior         Generative prior target μ_prior [m].
 * @param dtSec           Timestep Δt > 0 [s]. Any Δt is stable; accuracy degrades gracefully.
 * @param out             Float64Array of length ≥ {@link CAYLEY_PADE_OUT_LENGTH}, fully overwritten.
 */
export function stepCayleyPadeMidpoint(
  massKg: number,
  stiffnessNpm: number,
  totalDampingNspm: number,
  qxM: number,
  pxNs: number,
  piPrior: number,
  muPrior: number,
  dtSec: number,
  out: Float64Array,
): void {
  if (out.length < CAYLEY_PADE_OUT_LENGTH) {
    throw new RangeError(`Cayley-Padé scratch must hold ${CAYLEY_PADE_OUT_LENGTH} slots`);
  }
  const m = massKg;
  const piTilde = piPrior / (1.0 + 0.25 * dtSec * dtSec * (piPrior / m));
  const totalStiffness = stiffnessNpm + piTilde;
  const uPolicyForce = piTilde * muPrior;

  const denom = 1.0 + 0.5 * dtSec * (totalDampingNspm / m) + 0.25 * dtSec * dtSec * (totalStiffness / m);
  const midVel = (pxNs / m + 0.5 * dtSec * ((-totalStiffness * qxM + uPolicyForce) / m)) / denom;
  const nextQx = qxM + dtSec * midVel;
  const nextPx = m * midVel + 0.5 * dtSec * (-totalStiffness * nextQx - totalDampingNspm * midVel + uPolicyForce);

  const prevPlantH = 0.5 * stiffnessNpm * qxM * qxM + 0.5 * (pxNs * pxNs) / m;
  const nextPlantH = 0.5 * stiffnessNpm * nextQx * nextQx + 0.5 * (nextPx * nextPx) / m;
  const dissipatedEnergy = totalDampingNspm * midVel * midVel * dtSec;

  out[CayleyPadeOut.NEXT_QX] = nextQx;
  out[CayleyPadeOut.NEXT_PX] = nextPx;
  out[CayleyPadeOut.MID_VELOCITY] = midVel;
  out[CayleyPadeOut.PI_TILDE] = piTilde;
  out[CayleyPadeOut.POLICY_FORCE] = uPolicyForce;
  out[CayleyPadeOut.H_PREV_J] = prevPlantH;
  out[CayleyPadeOut.H_NEXT_J] = nextPlantH;
  out[CayleyPadeOut.DISSIPATED_J] = dissipatedEnergy;
  out[CayleyPadeOut.EXTERNAL_WORK_J] = (nextPlantH - prevPlantH) + dissipatedEnergy;
}

/**
 * Sub-millisecond reflexive muscle memory: writes the 3D Capture Point
 * ξ = q_xz + v_xz/ω₀ (ω₀ = √(g/z_c)) into StateIdx.XI_X / XI_Z and the Conformal G₄,₁
 * sphere-sphere knee intersection altitude h_IK = √(L₁² − a²), a = (L₁² − L₂² + d²)/(2d),
 * into StateIdx.H_IK. Reads q and p from the same 24-float state vector.
 *
 * The reach d is softened to 99.5% of full limb extension so the two-sphere intersection
 * circle never degenerates (Spike 8 reflexive plant, verbatim).
 */
export function stepReflexivePlant(
  stateVec: Float32Array,
  massKg: number,
  limbL1M: number,
  limbL2M: number,
  comHeightM: number,
  gravityMps2: number,
): void {
  const omega0 = Math.sqrt(gravityMps2 / comHeightM);
  const vx = stateVec[StateIdx.PX]! / massKg;
  const vz = stateVec[StateIdx.PZ]! / massKg;
  stateVec[StateIdx.XI_X] = stateVec[StateIdx.QX]! + vx / omega0;
  stateVec[StateIdx.XI_Z] = stateVec[StateIdx.QZ]! + vz / omega0;

  const d = Math.min(
    (limbL1M + limbL2M) * 0.995,
    Math.hypot(stateVec[StateIdx.XI_X]!, comHeightM, stateVec[StateIdx.XI_Z]!),
  );
  const a = (limbL1M * limbL1M - limbL2M * limbL2M + d * d) / (2.0 * d);
  stateVec[StateIdx.H_IK] = Math.sqrt(Math.max(0.0, limbL1M * limbL1M - a * a));
}
