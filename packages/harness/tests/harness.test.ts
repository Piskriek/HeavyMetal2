/**
 * @hm/harness Wave 1 verification: the Spike 8 empirical assertions replayed through the
 * production TypeScript modules (sieve-mdl, port-hamiltonian, inception-loop), plus the
 * Symplectic-Thermodynamic CFL Trap passivity proof the spike documents in Movement 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAYLEY_PADE_OUT_LENGTH,
  CayleyPadeOut,
  ESCORT_ROVER_TUNING,
  ExternalInputIdx,
  SPIKE8_SCENARIO_INIT,
  SovereignInceptionLoop,
  StateIdx,
  createEscortRoverPreset,
  createSquadOverseerPreset,
  plantHamiltonianJ,
  runMdlSpectralSieve,
  stepCayleyPadeMidpoint,
  tikhonovRenormalizePrecision,
} from '../src/index';

// Deterministic xoshiro128** PRNG, seeded exactly as the Spike 8 benchmark (zero Math.random).
function makePrng(): Uint32Array {
  return new Uint32Array([0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344]);
}
function nextU32(s: Uint32Array): number {
  // Verbatim transcription of the Spike 8 generator (xor order and the final rotation of the
  // ORIGINAL s3 included) so the test replays the exact verified noise stream.
  const s0 = s[0]!, s1 = s[1]!, s2 = s[2]!, s3 = s[3]!;
  const r = Math.imul(((s1 * 5) << 7) | ((s1 * 5) >>> 25), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  s[2] = s[2]! ^ s0;
  s[3] = s[3]! ^ s1;
  s[1] = s[1]! ^ s2;
  s[0] = s[0]! ^ s3;
  s[2] = s[2]! ^ t;
  s[3] = ((s3 << 11) | (s3 >>> 21)) >>> 0;
  return r;
}
function nextGaussian(s: Uint32Array): number {
  const u1 = (nextU32(s) + 1.0) / 4294967297.0;
  const u2 = (nextU32(s) + 1.0) / 4294967297.0;
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

test('MDL spectral sieve isolates the two embedded harmonics and routes the noise floor', () => {
  const N = 256;
  const prng = makePrng();
  const raw = new Float32Array(N);
  const clean = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const t = n / N;
    const c = 0.80 * Math.sin(2.0 * Math.PI * 2.0 * t) + 0.30 * Math.cos(2.0 * Math.PI * 4.0 * t);
    clean[n] = c;
    raw[n] = c + 0.22 * nextGaussian(prng);
  }
  const pattern = new Float32Array(N);
  const residual = new Float32Array(N);
  const result = runMdlSpectralSieve(raw, pattern, residual);

  assert.equal(result.structuralModeCount, 2, `exactly 2 structural modes (got ${result.structuralModeCount})`);
  const structuralKs = result.modes.filter((m) => m.structural).map((m) => m.k);
  assert.deepEqual(structuralKs, [2, 4], 'the kept modes are the embedded k=2 and k=4 harmonics');

  let mse = 0.0;
  for (let n = 0; n < N; n++) {
    const e = pattern[n]! - clean[n]!;
    mse += e * e;
  }
  mse /= N;
  assert.ok(mse < 0.005, `structural reconstruction MSE ${mse.toFixed(5)} < 0.005`);
  assert.ok(Math.abs(result.residualStd - 0.22) < 0.04, `residual std ${result.residualStd.toFixed(4)} ≈ 0.22 injected σ`);

  // Reconstruction identity: pattern + residual recovers the stream to f32 rounding
  // (the residual is stored as f32 of an f64 difference, so bit-exactness cannot hold).
  for (let n = 0; n < N; n++) {
    assert.ok(Math.abs((pattern[n]! + residual[n]!) - raw[n]!) < 1e-6, `reconstruction at sample ${n}`);
  }
});

test('MDL sieve degenerate inputs: empty and constant streams keep zero structural modes', () => {
  const empty = new Float32Array(0);
  const r0 = runMdlSpectralSieve(empty, new Float32Array(0), new Float32Array(0));
  assert.equal(r0.structuralModeCount, 0);

  const flat = new Float32Array(64).fill(1.0);
  const p = new Float32Array(64);
  const n = new Float32Array(64);
  const r1 = runMdlSpectralSieve(flat, p, n);
  assert.equal(r1.structuralModeCount, 0, 'a DC-only stream has no k>=1 structural harmonics');
  assert.throws(() => runMdlSpectralSieve(flat, new Float32Array(8), n), RangeError);
});

test('Tikhonov renormalization is monotone, bounded by 4m/dt², and exact as dt -> 0', () => {
  const m = 2.0;
  const dt = 0.125; // 8 Hz S0 timestep
  const bound = (4.0 * m) / (dt * dt);
  let prev = 0.0;
  for (const pi of [0.02, 1.5, 30, 190.7, 1e6, 1e12]) {
    const piT = tikhonovRenormalizePrecision(pi, dt, m);
    assert.ok(piT > prev, 'monotone in Π');
    assert.ok(piT < bound, `Π̃=${piT} stays under 4m/Δt²=${bound}`);
    prev = piT;
  }
  assert.ok(Math.abs(tikhonovRenormalizePrecision(30, 1e-9, m) - 30) < 1e-6, 'Π̃ → Π as Δt → 0');
});

test('Cayley-Padé resolvent: exact energy accounting identity and passivity under the CFL trap', () => {
  const out = new Float64Array(CAYLEY_PADE_OUT_LENGTH);
  const m = 2.0, k = 8.0, r = 1.4;

  // Identity EXTERNAL_WORK = ΔH + DISSIPATED holds by construction to f64 roundoff.
  stepCayleyPadeMidpoint(m, k, r, 1.2, -0.4, 30.17, 2.4, 0.02, out);
  const identityResidual = Math.abs(
    out[CayleyPadeOut.EXTERNAL_WORK_J]!
    - ((out[CayleyPadeOut.H_NEXT_J]! - out[CayleyPadeOut.H_PREV_J]!) + out[CayleyPadeOut.DISSIPATED_J]!),
  );
  assert.ok(identityResidual < 1e-12, `accounting identity residual ${identityResidual}`);

  // The Symplectic-Thermodynamic CFL Trap: hyper-precision Π at the coarse 8 Hz S0
  // timestep. Explicit Euler/Verlet violates Δt·√(Π/m) ≤ 2 and detonates; the resolvent
  // must stay bounded for every Δt and Π (unconditional passivity).
  const dtCoarse = 0.125;
  const piHyper = 1e6;
  assert.ok(dtCoarse * Math.sqrt(piHyper / m) > 2.0, 'the scenario genuinely violates the explicit CFL limit');
  let qx = 1.0, px = 0.0;
  let maxAbsQ = 0.0;
  for (let i = 0; i < 2000; i++) {
    stepCayleyPadeMidpoint(m, k, r, qx, px, piHyper, 0.0, dtCoarse, out);
    qx = out[CayleyPadeOut.NEXT_QX]!;
    px = out[CayleyPadeOut.NEXT_PX]!;
    maxAbsQ = Math.max(maxAbsQ, Math.abs(qx));
  }
  assert.ok(Number.isFinite(qx) && Number.isFinite(px), 'no numerical detonation');
  assert.ok(maxAbsQ <= 1.0 + 1e-9, `|q| never exceeds its initial amplitude (max ${maxAbsQ})`);
  assert.ok(Math.abs(qx) < 1e-3, 'the damped stiff oscillator settles instead of injecting phantom energy');

  // With zero policy input the plant Hamiltonian is non-increasing step over step (passive).
  qx = 1.0; px = 0.0;
  let h = plantHamiltonianJ(qx, px, k, m);
  for (let i = 0; i < 500; i++) {
    stepCayleyPadeMidpoint(m, k, r, qx, px, 0.02, 0.0, 0.25, out);
    qx = out[CayleyPadeOut.NEXT_QX]!;
    px = out[CayleyPadeOut.NEXT_PX]!;
    const hNext = out[CayleyPadeOut.H_NEXT_J]!;
    assert.ok(hNext <= h + 1e-12, `H non-increasing without input (step ${i}: ${hNext} > ${h})`);
    h = hNext;
  }
});

test('Sovereign inception loop replays Spike 8 Steps B-D: trench, nociception, annealing, graduation', () => {
  const loop = new SovereignInceptionLoop(
    createEscortRoverPreset(),
    createSquadOverseerPreset(),
    ESCORT_ROVER_TUNING,
    SPIKE8_SCENARIO_INIT,
  );
  const s = loop.lowerNode.stateVector;
  const input = new Float32Array(4);
  input[ExternalInputIdx.TARGET_X] = 0.0;
  input[ExternalInputIdx.ACOUSTIC_DB] = 130.0;
  const DT = 0.02;

  // --- Step B: intentional cognitive distortion hardens an attractor trench ---
  for (let i = 0; i < 80; i++) loop.step(DT, input);
  const stepBPi = s[StateIdx.PI_PRIOR]!;
  const stepBStrain = s[StateIdx.E_STRAIN]!;
  assert.ok(stepBPi > 12.0, `distortion hyper-inflated prior precision (Π=${stepBPi.toFixed(2)} > 12)`);
  assert.ok(stepBStrain > 8.0, `over-control locked the plant in high strain (${stepBStrain.toFixed(2)} J > 8 J)`);
  assert.ok(loop.latchLogOdds >= 60, `Bayesian trench latch hardened (L=${loop.latchLogOdds} >= 60)`);

  // --- Step C: awareness expansion magnifies latent distortion (nociceptive spike) ---
  const preAwareness = s[StateIdx.A_AWARE]!;
  const preThermal = s[StateIdx.E_THERMAL]!;
  input[ExternalInputIdx.AWARENESS_GATE] = 1.0;
  for (let i = 0; i < 60; i++) loop.step(DT, input);
  const ceiling = loop.lowerNode.vesselPreset.relativeAwarenessCeiling;
  const stepCAware = s[StateIdx.A_AWARE]!;
  assert.ok(stepCAware > preAwareness * 2.5 && stepCAware <= ceiling,
    `awareness expanded within the vessel envelope (${stepCAware.toFixed(3)} <= ${ceiling})`);
  assert.ok(s[StateIdx.PI_PRIOR]! > stepBPi, `expanding awareness magnified latent distortion (Π=${s[StateIdx.PI_PRIOR]!.toFixed(2)})`);
  assert.ok(s[StateIdx.E_THERMAL]! > preThermal, 'nociceptive thermal rise');
  assert.ok(s[StateIdx.LAMBDA_FTLE]! > loop.lowerNode.vesselPreset.evaluator.maxFTLELimit,
    `Lyapunov divergence (λ=${s[StateIdx.LAMBDA_FTLE]!.toFixed(3)})`);

  // --- Step D: Higher-Self inception anneals, transmutes, conserves, graduates ---
  const reserveBefore = s[StateIdx.E_RESERVE]!;
  input[ExternalInputIdx.INCEPTION_GATE] = 1.0;
  let minPi = s[StateIdx.PI_PRIOR]!;
  let lastResult: ReturnType<SovereignInceptionLoop['step']> | undefined;
  for (let i = 0; i < 240; i++) {
    lastResult = loop.step(DT, input);
    if (s[StateIdx.PI_PRIOR]! < minPi) minPi = s[StateIdx.PI_PRIOR]!;
  }
  assert.ok(lastResult !== undefined);
  assert.ok(minPi < 1.0, `attentional circuit breaker annealed precision (minΠ=${minPi.toFixed(4)} < 1)`);
  assert.ok(s[StateIdx.E_STRAIN]! < 0.01, `trench dissolved, strain released (${s[StateIdx.E_STRAIN]!.toFixed(5)} J < 0.01 J)`);
  assert.ok(s[StateIdx.E_RESERVE]! > reserveBefore,
    `strain transmuted into syntropic reserve (${s[StateIdx.E_RESERVE]!.toFixed(3)} J > ${reserveBefore.toFixed(2)} J)`);
  assert.ok(loop.conservationResidualJ < 1e-5,
    `Audit A1 closed conservation (residual=${loop.conservationResidualJ.toExponential(2)} J)`);
  assert.equal(lastResult.passesConservation, true);
  assert.ok(s[StateIdx.H_COHERENCE]! >= 0.95, `global harmonic coherence (H=${s[StateIdx.H_COHERENCE]!.toFixed(4)})`);
  assert.equal(loop.lowerNode.graduationContract.isGraduated, true, 'G_ascent promoted Depth N -> Depth N+1');

  // Bidirectional channel contracts of the settled loop.
  assert.equal(lastResult.downwardPrior.contextMode, 'COMBAT_ESCORT');
  assert.equal(lastResult.downwardPrior.ethicalConstraintBitmask & 1, 1, 'PRESERVE_ALLIES bit set');
  // Accumulated thermal history keeps somatic urgency engaged, so the Higher Self holds a
  // low κ_calm, and the calm-flow ODE settles Π toward Π₀·κ — the spike's verified behavior.
  const kappa = lastResult.downwardPrior.calmFactorKappa;
  assert.ok(kappa > 0.0 && kappa < 1.0, `κ_calm stays a proper modulation factor (κ=${kappa.toFixed(3)})`);
  const settledPi = s[StateIdx.PI_PRIOR]!;
  const flowTargetPi = ESCORT_ROVER_TUNING.piBase * kappa;
  assert.ok(Math.abs(settledPi - flowTargetPi) < 0.35 * flowTargetPi + 0.05,
    `settled Π=${settledPi.toFixed(4)} tracks the calm-flow target Π₀·κ=${flowTargetPi.toFixed(4)}`);
  assert.ok(lastResult.upwardTelemetry.strainEnergyJ < 0.01, 'upward telemetry reports the released plant');
  assert.equal(lastResult.upwardTelemetry.timestampMs, loop.simulatedTimeSec * 1000.0);
  assert.ok(loop.higherSelfNode.syntropicBuffer.currentEscrowJoules >= 0.0, 'escrow never goes negative');
  assert.ok(loop.lowerNode.syntropicBuffer.currentReserveJoules === s[StateIdx.E_RESERVE]!, 'node buffer mirrors reserve');

  // Reflexive plant wrote the capture point and conformal knee altitude.
  assert.ok(Number.isFinite(s[StateIdx.XI_X]!) && Number.isFinite(s[StateIdx.H_IK]!));
  assert.ok(s[StateIdx.H_IK]! > 0.0 && s[StateIdx.H_IK]! <= ESCORT_ROVER_TUNING.limbL1M, 'knee altitude within limb length');
});

test('Sovereign inception loop is deterministic: two identical runs agree bit-for-bit', () => {
  const run = (): Float32Array => {
    const loop = new SovereignInceptionLoop(createEscortRoverPreset(), createSquadOverseerPreset());
    const input = new Float32Array([0.0, 130.0, 0.0, 0.0]);
    for (let i = 0; i < 80; i++) loop.step(0.02, input);
    input[ExternalInputIdx.AWARENESS_GATE] = 1.0;
    input[ExternalInputIdx.INCEPTION_GATE] = 1.0;
    for (let i = 0; i < 100; i++) loop.step(0.02, input);
    return loop.lowerNode.stateVector.slice();
  };
  const a = run();
  const b = run();
  for (let i = 0; i < 24; i++) {
    assert.equal(a[i]!, b[i]!, `state slot ${i} identical across runs`);
  }
});
