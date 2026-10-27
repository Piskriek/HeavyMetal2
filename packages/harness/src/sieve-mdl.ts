/**
 * @file sieve-mdl.ts
 * @module @hm/harness
 * @description Information-Theoretic Rissanen MDL Spectral Sieve (Plan 46, Movement 2 §2.1.5).
 *
 * Separates a noisy sensory stream into:
 *  - structural kinematic/geometric modes (routed to `@hm/meshops` / `@hm/kinematic`), and
 *  - high-entropy surface micro-relief residual (routed to `@hm/matstack`).
 *
 * A Fourier mode k is kept as structure iff its Minimum Description Length coding gain
 * exceeds the Rissanen penalty for the parameters it costs to encode:
 *
 *   ΔL(k) = (N/2)·ln(1 + E_k / E_res) − (params/2)·ln(N) > 0
 *
 * with `params = 3` per sinusoid (amplitude, phase, frequency index).
 *
 * Pure deterministic typed-array math under RULES 8a: no Date.now, no Math.random, no I/O,
 * and no allocation in the hot path beyond the caller-visible mode report.
 */

/** Tunable parameters of the MDL sieve. All fields are dimensionless. */
export interface IMdlSieveOptions {
  /** Highest Fourier harmonic index evaluated (k = 1..maxModeIndex). Clamped to Nyquist. */
  readonly maxModeIndex: number;
  /** Free parameters charged per sinusoidal mode in the Rissanen penalty (amplitude, phase, frequency). */
  readonly parametersPerMode: number;
}

/** Defaults matching the verified Spike 8 Step A benchmark (16 modes, 3-parameter penalty). */
export const DEFAULT_MDL_SIEVE_OPTIONS: IMdlSieveOptions = {
  maxModeIndex: 16,
  parametersPerMode: 3,
};

/** Per-mode report of one evaluated Fourier harmonic. */
export interface IMdlModeReport {
  /** Harmonic index k (cycles over the full window). */
  readonly k: number;
  /** Real part of the un-normalized DFT projection Σ s[n]·cos(ωn). */
  readonly re: number;
  /** Imaginary part of the un-normalized DFT projection −Σ s[n]·sin(ωn). */
  readonly im: number;
  /** Mode energy E_k = (2/N)·(re² + im²). */
  readonly energy: number;
  /** MDL coding gain (N/2)·ln(1 + E_k / E_res) in nats. */
  readonly codingGainNats: number;
  /** True iff the coding gain exceeded the Rissanen penalty and the mode was kept as structure. */
  readonly structural: boolean;
}

/** Summary of one sieve pass over a sensory stream. */
export interface IMdlSieveResult {
  /** Number of modes classified as structural geometry/kinematics. */
  readonly structuralModeCount: number;
  /** Report for every evaluated harmonic k = 1..maxModeIndex. */
  readonly modes: readonly IMdlModeReport[];
  /** Rissanen penalty threshold (params/2)·ln(N) in nats. */
  readonly mdlThresholdNats: number;
  /** Mean squared amplitude of the residual routed to `@hm/matstack`. */
  readonly residualVariance: number;
  /** Standard deviation of the residual (√residualVariance). */
  readonly residualStd: number;
}

/**
 * Runs the Rissanen MDL spectral sieve over `stream`.
 *
 * Writes the reconstructed structural pattern into `outStructural` and the residual
 * surface noise (stream − pattern) into `outResidual`. Both output buffers must be the
 * same length as `stream`; they are fully overwritten.
 *
 * The math is the verified Spike 8 Step A implementation, expression for expression:
 * direct per-mode DFT projection, coding gain 0.5·N·ln(1 + E_k/max(1e-9, E_total − E_k)),
 * threshold (params/2)·ln(N).
 */
export function runMdlSpectralSieve(
  stream: Float32Array,
  outStructural: Float32Array,
  outResidual: Float32Array,
  options: IMdlSieveOptions = DEFAULT_MDL_SIEVE_OPTIONS,
): IMdlSieveResult {
  const N = stream.length;
  if (outStructural.length !== N || outResidual.length !== N) {
    throw new RangeError(`MDL sieve output buffers must match stream length ${N}`);
  }
  if (N < 2) {
    outStructural.fill(0.0);
    outResidual.set(stream);
    return {
      structuralModeCount: 0,
      modes: [],
      mdlThresholdNats: 0,
      residualVariance: 0,
      residualStd: 0,
    };
  }

  let totalEnergy = 0.0;
  for (let i = 0; i < N; i++) totalEnergy += stream[i]! * stream[i]!;
  const mdlThresholdNats = 0.5 * options.parametersPerMode * Math.log(N);

  outStructural.fill(0.0);
  const nyquistLimit = Math.floor((N - 1) / 2);
  const highestMode = Math.min(options.maxModeIndex, nyquistLimit);
  const modes: IMdlModeReport[] = [];
  let structuralModeCount = 0;

  for (let k = 1; k <= highestMode; k++) {
    let re = 0.0, im = 0.0;
    const omega = (2.0 * Math.PI * k) / N;
    for (let n = 0; n < N; n++) {
      re += stream[n]! * Math.cos(omega * n);
      im -= stream[n]! * Math.sin(omega * n);
    }
    const modeEnergy = (2.0 / N) * (re * re + im * im);
    const codingGainNats = 0.5 * N * Math.log(1.0 + modeEnergy / Math.max(1e-9, totalEnergy - modeEnergy));
    const structural = codingGainNats > mdlThresholdNats;

    if (structural) {
      structuralModeCount++;
      const scale = 2.0 / N;
      for (let n = 0; n < N; n++) {
        outStructural[n] = outStructural[n]! + scale * (re * Math.cos(omega * n) - im * Math.sin(omega * n));
      }
    }
    modes.push({ k, re, im, energy: modeEnergy, codingGainNats, structural });
  }

  let residualVariance = 0.0;
  for (let n = 0; n < N; n++) {
    const noise = stream[n]! - outStructural[n]!;
    outResidual[n] = noise;
    residualVariance += noise * noise;
  }
  residualVariance /= N;

  return {
    structuralModeCount,
    modes,
    mdlThresholdNats,
    residualVariance,
    residualStd: Math.sqrt(residualVariance),
  };
}
