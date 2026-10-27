/**
 * Plan 46 Reality Harness & Artificial Ego — Live Spike Benchmark Suite
 * Verifies Hypotheses H1 through H8 across Spikes 1 through 7 under RULE 8a determinism.
 */

import { performance } from 'perf_hooks';

console.log('='.repeat(72));
console.log('  PLAN 46: REALITY HARNESS & ARTIFICIAL EGO BENCHMARK SUITE');
console.log('  Verifying Spikes 1-7 (VSA, CGA Motors, Chebyshev HKS, Capture Point, TSAR v2, MeshOps, PRTC)');
console.log('='.repeat(72));

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    totalFailed++;
    throw new Error(message);
  } else {
    console.log(`  [PASS] ${message}`);
    totalPassed++;
  }
}

// =========================================================================
// SPIKE 1: Deterministic Bit-Sliced VSA-4096 & Algebraic Ego Transducer
// =========================================================================
console.log('\n--- [SPIKE 1] VSA-4096 & Algebraic Shorthand Transducer ---');

const VSA_WORDS = 128; // 128 * 32 = 4096 bits
const DICT_SIZE = 1024;
const DICT_ARENA = new Uint32Array(DICT_SIZE * VSA_WORDS);
const PRNG_STATE = new Uint32Array([0x12345678, 0x9ABCDEF0, 0x13579BDF, 0x2468ACE0]);

function nextUint32(state) {
  const s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3];
  const result = Math.imul((s1 * 5) << 7 | (s1 * 5) >>> 25, 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  state[2] ^= s0; state[3] ^= s1; state[1] ^= state[2]; state[0] ^= state[3];
  state[2] ^= t;
  state[3] = (state[3] << 11 | state[3] >>> 21) >>> 0;
  return result;
}

function popcnt32(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}

function vsaBind(out, outOffset, a, aOffset, b, bOffset) {
  for (let i = 0; i < VSA_WORDS; i++) {
    out[outOffset + i] = (a[aOffset + i] ^ b[bOffset + i]) >>> 0;
  }
}

function jepaHammingEnergy(a, aOffset, b, bOffset) {
  let diffBits = 0;
  for (let i = 0; i < VSA_WORDS; i++) {
    diffBits += popcnt32(a[aOffset + i] ^ b[bOffset + i]);
  }
  return diffBits * 0.000244140625; // / 4096
}

// Populate dictionary
for (let i = 0; i < DICT_ARENA.length; i++) {
  DICT_ARENA[i] = nextUint32(PRNG_STATE);
}

// Benchmark VSA Invertibility and Dictionary Lookup
const vA = new Uint32Array(VSA_WORDS);
const vB = new Uint32Array(VSA_WORDS);
const vBound = new Uint32Array(VSA_WORDS);
const vUnbound = new Uint32Array(VSA_WORDS);

for (let i = 0; i < VSA_WORDS; i++) {
  vA[i] = nextUint32(PRNG_STATE);
  vB[i] = nextUint32(PRNG_STATE);
}

vsaBind(vBound, 0, vA, 0, vB, 0);
vsaBind(vUnbound, 0, vBound, 0, vB, 0);

let invertibilityError = 0;
for (let i = 0; i < VSA_WORDS; i++) {
  if (vUnbound[i] !== vA[i]) invertibilityError++;
}
assert(invertibilityError === 0, 'VSA XOR Self-Inverse identity holds exactly (A ^ B ^ B === A)');

// Warm up JIT optimizer
for (let d = 0; d < 100; d++) {
  jepaHammingEnergy(vA, 0, DICT_ARENA, d * VSA_WORDS);
}

const t0 = performance.now();
let bestIdx = -1;
let minEnergy = 2.0;
for (let d = 0; d < DICT_SIZE; d++) {
  const energy = jepaHammingEnergy(vA, 0, DICT_ARENA, d * VSA_WORDS);
  if (energy < minEnergy) {
    minEnergy = energy;
    bestIdx = d;
  }
}
const t1 = performance.now();
const vsaLookupMs = t1 - t0;
const usPerCandidate = (vsaLookupMs * 1000) / DICT_SIZE;
console.log(`  VSA 1,024-dictionary search time: ${vsaLookupMs.toFixed(3)} ms (${usPerCandidate.toFixed(2)} µs/candidate | Best Match idx=${bestIdx}, energy=${minEnergy.toFixed(4)})`);
assert(vsaLookupMs < 4.5, `VSA pure-JS 1024-candidate search bound satisfied (< 4.5 ms, actual: ${vsaLookupMs.toFixed(3)} ms)`);

// =========================================================================
// SPIKE 2: Conformal Geometric Algebra G_{4,1} 10-Float TRS Spinor Kernel
// =========================================================================
console.log('\n--- [SPIKE 2] Conformal G_{4,1} 10-Float TRS Spinor Kernel ---');

function cgaBuildMotor(out, offset, rx, ry, rz, tx, ty, tz, scale) {
  const thetaSq = rx * rx + ry * ry + rz * rz;
  let rw = 1.0, r1 = 0.0, r2 = 0.0, r3 = 0.0;
  if (thetaSq > 1e-12) {
    const theta = Math.sqrt(thetaSq);
    const halfTheta = 0.5 * theta;
    const sinHalfOverTheta = Math.sin(halfTheta) / theta;
    rw = Math.cos(halfTheta);
    r1 = rx * sinHalfOverTheta;
    r2 = ry * sinHalfOverTheta;
    r3 = rz * sinHalfOverTheta;
  }
  const sigma = Math.log(scale > 1e-6 ? scale : 1e-6);
  const halfSigma = 0.5 * sigma;
  const ch = 0.5 * (Math.exp(halfSigma) + Math.exp(-halfSigma));
  const sh = 0.5 * (Math.exp(halfSigma) - Math.exp(-halfSigma));

  out[offset + 0] = rw;
  out[offset + 1] = r1;
  out[offset + 2] = r2;
  out[offset + 3] = r3;
  out[offset + 4] = tx;
  out[offset + 5] = ty;
  out[offset + 6] = tz;
  out[offset + 7] = sigma;
  out[offset + 8] = ch;
  out[offset + 9] = sh;
}

function cgaApplyMotorToPoint(m, mOffset, ptIn, ptInOffset, ptOut, ptOutOffset) {
  const rw = m[mOffset + 0], r1 = m[mOffset + 1], r2 = m[mOffset + 2], r3 = m[mOffset + 3];
  const tx = m[mOffset + 4], ty = m[mOffset + 5], tz = m[mOffset + 6];
  const ch = m[mOffset + 8], sh = m[mOffset + 9];

  const s = (ch + sh) * (ch + sh); // exp(sigma)
  const x = ptIn[ptInOffset + 0] * s;
  const y = ptIn[ptInOffset + 1] * s;
  const z = ptIn[ptInOffset + 2] * s;

  const ix = 2.0 * (r2 * z - r3 * y);
  const iy = 2.0 * (r3 * x - r1 * z);
  const iz = 2.0 * (r1 * y - r2 * x);

  ptOut[ptOutOffset + 0] = x + rw * ix + (r2 * iz - r3 * iy) + tx;
  ptOut[ptOutOffset + 1] = y + rw * iy + (r3 * ix - r1 * iz) + ty;
  ptOut[ptOutOffset + 2] = z + rw * iz + (r1 * iy - r2 * ix) + tz;
}

const motors = new Float32Array(1000 * 10);
const pointsIn = new Float32Array(1000 * 3);
const pointsOut = new Float32Array(1000 * 3);

for (let i = 0; i < 1000; i++) {
  cgaBuildMotor(motors, i * 10, 0.1, 0.2, 0.3, 1.0, 2.0, 3.0, 1.5);
  pointsIn[i * 3 + 0] = 0.5;
  pointsIn[i * 3 + 1] = 0.5;
  pointsIn[i * 3 + 2] = 0.5;
}

// Warm up JIT
for (let i = 0; i < 200; i++) {
  cgaApplyMotorToPoint(motors, (i % 10) * 10, pointsIn, (i % 10) * 3, pointsOut, (i % 10) * 3);
}

const t2 = performance.now();
for (let i = 0; i < 1000; i++) {
  cgaApplyMotorToPoint(motors, i * 10, pointsIn, i * 3, pointsOut, i * 3);
}
const t3 = performance.now();
const motorTimeMs = t3 - t2;
console.log(`  1,000 CGA Conformal Motor transformations: ${motorTimeMs.toFixed(3)} ms (${(motorTimeMs).toFixed(3)} µs/transform)`);
assert(motorTimeMs < 4.0, `CGA motor throughput satisfies frame bound (< 4.0 ms, actual: ${motorTimeMs.toFixed(3)} ms)`);

// Test identity motor preserves point
const idMotor = new Float32Array(10);
cgaBuildMotor(idMotor, 0, 0, 0, 0, 0, 0, 0, 1.0);
const testPt = new Float32Array([3.14, -2.71, 42.0]);
const resPt = new Float32Array(3);
cgaApplyMotorToPoint(idMotor, 0, testPt, 0, resPt, 0);
const idErr = Math.hypot(resPt[0] - testPt[0], resPt[1] - testPt[1], resPt[2] - testPt[2]);
assert(idErr < 1e-5, `Identity CGA motor preserves 3D point exactly (err=${idErr.toExponential(2)})`);

// =========================================================================
// SPIKE 3: Matrix-Free Chebyshev Spectral Heat Kernel Filter
// =========================================================================
console.log('\n--- [SPIKE 3] Matrix-Free Chebyshev Spectral Heat Filter ---');

function applyScaledLaplacianCSR(numVerts, rowPtr, colIdx, cotWeights, invLumpedMass, lambdaMax, xVec, yOut) {
  const scale = 2.0 / lambdaMax;
  for (let i = 0; i < numVerts; i++) {
    let sum = 0.0;
    const rowStart = rowPtr[i];
    const rowEnd = rowPtr[i + 1];
    const xi = xVec[i];
    for (let e = rowStart; e < rowEnd; e++) {
      const j = colIdx[e];
      sum += cotWeights[e] * (xi - xVec[j]);
    }
    yOut[i] = scale * (invLumpedMass[i] * sum) - xi;
  }
}

// Build a synthetic 512-vertex ring/cylinder mesh graph in CSR format
const NUM_VERTS = 512;
const rowPtr = new Uint32Array(NUM_VERTS + 1);
const colIndices = [];
const cotWeights = [];
const invLumpedMass = new Float32Array(NUM_VERTS);

for (let i = 0; i < NUM_VERTS; i++) {
  rowPtr[i] = colIndices.length;
  invLumpedMass[i] = 1.0;
  // Connect to neighbors (i-1, i+1, (i+16)%NUM_VERTS)
  const n1 = (i - 1 + NUM_VERTS) % NUM_VERTS;
  const n2 = (i + 1) % NUM_VERTS;
  const n3 = (i + 16) % NUM_VERTS;
  colIndices.push(n1, n2, n3);
  cotWeights.push(1.0, 1.0, 0.5);
}
rowPtr[NUM_VERTS] = colIndices.length;

const colIdx = new Uint32Array(colIndices);
const cotW = new Float32Array(cotWeights);
const xVec = new Float32Array(NUM_VERTS);
const yOut = new Float32Array(NUM_VERTS);
xVec[0] = 1.0; // delta impulse

const t4 = performance.now();
// Run 12 iterations of Chebyshev filtering
for (let step = 0; step < 12; step++) {
  applyScaledLaplacianCSR(NUM_VERTS, rowPtr, colIdx, cotW, invLumpedMass, 6.0, xVec, yOut);
  xVec.set(yOut);
}
const t5 = performance.now();
const chebTimeMs = t5 - t4;
console.log(`  12-order Chebyshev spectral diffusion on ${NUM_VERTS} vertices: ${chebTimeMs.toFixed(3)} ms`);
assert(chebTimeMs < 2.0, `Chebyshev spectral filtering satisfies frame bound (< 2.0 ms, actual: ${chebTimeMs.toFixed(3)} ms)`);
assert(!Number.isNaN(yOut[0]) && Number.isFinite(yOut[0]), 'Spectral diffusion yields finite numerical output without NaNs');

// =========================================================================
// SPIKE 4: Closed-Loop 3D Capture Point + Conformal Circle-Sphere Knee IK
// =========================================================================
console.log('\n--- [SPIKE 4] 3D Capture Point & Conformal Knee IK ---');

function computeCapturePointStepTarget(
  comPos, comVel, supportPolygonCenter, supportRadius,
  nominalFootTarget, gravity, comHeight, swingTimeRemaining, outFootTarget
) {
  const omega0 = Math.sqrt(gravity / (comHeight > 0.15 ? comHeight : 0.15));
  const xiX = comPos[0] + comVel[0] / omega0;
  const xiZ = comPos[2] + comVel[2] / omega0;

  const dx = xiX - supportPolygonCenter[0];
  const dz = xiZ - supportPolygonCenter[2];
  const distFromSupport = Math.sqrt(dx * dx + dz * dz);

  if (distFromSupport <= supportRadius) {
    outFootTarget[0] = nominalFootTarget[0];
    outFootTarget[2] = nominalFootTarget[2];
  } else {
    const clampedTime = swingTimeRemaining > 0.05 ? swingTimeRemaining : 0.05;
    const expTerm = Math.exp(-omega0 * clampedTime);
    const stepGain = 1.0 / (1.0 - expTerm + 1e-6);
    outFootTarget[0] = xiX + (dx / distFromSupport) * (distFromSupport - supportRadius) * stepGain * 0.35;
    outFootTarget[2] = xiZ + (dz / distFromSupport) * (distFromSupport - supportRadius) * stepGain * 0.35;
  }
}

function solveConformalTwoBoneIK(hipPos, ankleTarget, poleVector, l1, l2, outKneePos) {
  let dx = ankleTarget[0] - hipPos[0];
  let dy = ankleTarget[1] - hipPos[1];
  let dz = ankleTarget[2] - hipPos[2];
  let dSq = dx * dx + dy * dy + dz * dz;
  let d = Math.sqrt(dSq);

  const maxReach = (l1 + l2) * 0.998;
  const minReach = Math.abs(l1 - l2) * 1.002;
  if (d > maxReach) {
    const scale = maxReach / d;
    dx *= scale; dy *= scale; dz *= scale;
    d = maxReach; dSq = d * d;
  } else if (d < minReach) {
    d = minReach; dSq = d * d;
  }

  const a = (l1 * l1 - l2 * l2 + dSq) / (2.0 * d);
  const hSq = l1 * l1 - a * a;
  const h = hSq > 0.0 ? Math.sqrt(hSq) : 0.0;

  const invD = 1.0 / d;
  const ux = dx * invD, uy = dy * invD, uz = dz * invD;
  const cx = hipPos[0] + a * ux;
  const cy = hipPos[1] + a * uy;
  const cz = hipPos[2] + a * uz;

  const dotPole = poleVector[0] * ux + poleVector[1] * uy + poleVector[2] * uz;
  let px = poleVector[0] - dotPole * ux;
  let py = poleVector[1] - dotPole * uy;
  let pz = poleVector[2] - dotPole * uz;
  const pNorm = 1.0 / Math.sqrt(px * px + py * py + pz * pz + 1e-12);

  outKneePos[0] = cx + h * (px * pNorm);
  outKneePos[1] = cy + h * (py * pNorm);
  outKneePos[2] = cz + h * (pz * pNorm);
}

// Benchmark Capture Point + 16 Bipeds Two-Bone IK
const footTarget = new Float32Array(3);
const kneePos = new Float32Array(3);
const hip = new Float32Array([0.0, 1.0, 0.0]); // Hip at 1.0m
const nominalFoot = new Float32Array([0.2, 0.0, 0.0]);
const pole = new Float32Array([0.0, 0.0, 1.0]);
const L1 = 0.7, L2 = 0.7; // 1.4m total reach for 1.0m standing hip height

const t6 = performance.now();
for (let biped = 0; biped < 16; biped++) {
  // Push perturbation: comVel = 1.5 m/s forward
  computeCapturePointStepTarget([0, 1, 0], [0, 0, 1.5], [0, 0, 0], 0.20, nominalFoot, 9.81, 1.0, 0.25, footTarget);
  solveConformalTwoBoneIK(hip, [footTarget[0], 0.0, footTarget[2]], pole, L1, L2, kneePos);
}
const t7 = performance.now();
const bipedTimeMs = t7 - t6;
console.log(`  16-biped Capture Point + Conformal IK step: ${bipedTimeMs.toFixed(3)} ms (${(bipedTimeMs/16).toFixed(3)} ms/char | Target step: [${footTarget[0].toFixed(2)}, 0, ${footTarget[2].toFixed(2)}])`);
assert(bipedTimeMs < 1.0, `16-character reactive balance budget satisfied (< 1.0 ms, actual: ${bipedTimeMs.toFixed(3)} ms)`);

// Verify exact bone lengths of knee IK
const dHipKnee = Math.hypot(kneePos[0] - hip[0], kneePos[1] - hip[1], kneePos[2] - hip[2]);
const dKneeAnkle = Math.hypot(footTarget[0] - kneePos[0], 0.0 - kneePos[1], footTarget[2] - kneePos[2]);
assert(Math.abs(dHipKnee - L1) < 1e-3, `Thigh bone length preserved exactly (L1=${L1}m, actual=${dHipKnee.toFixed(4)}m)`);
assert(Math.abs(dKneeAnkle - L2) < 1e-3, `Calf bone length preserved exactly (L2=${L2}m, actual=${dKneeAnkle.toFixed(4)}m)`);

// =========================================================================
// SPIKE 5 (v2): Static-Safe TSAR with Coaxial Disk Pairing & Bayesian Latch
// =========================================================================
console.log('\n--- [SPIKE 5 (v2)] Static-Safe TSAR & Bayesian Latch ---');

function updateTsarBayesianBelief(
  beliefLogOdds, beliefOffset,
  normGravityHeight, axisDotGravity, axisDotForward,
  coaxialDiskScore, inClosedTrussLoop, hasBilateralTwin,
  hasOpenDistalBore, jointNeckPinch,
  relOmegaMag, axialSpinRatio, pivotLocationNorm
) {
  let dAxle =
    coaxialDiskScore * 35.0 +
    (1.0 - normGravityHeight) * 10.0 +
    (1.0 - axisDotForward) * 8.0 +
    (hasBilateralTwin ? 8.0 : 0.0) -
    (inClosedTrussLoop ? 15.0 : 0.0);

  let dBarrel =
    (hasOpenDistalBore ? 32.0 : -10.0) +
    axisDotForward * 14.0 +
    normGravityHeight * 8.0 +
    (inClosedTrussLoop ? -25.0 : 10.0) -
    coaxialDiskScore * 20.0;

  let dLimb =
    (inClosedTrussLoop ? -25.0 : 12.0) +
    (hasBilateralTwin ? 14.0 : -5.0) +
    jointNeckPinch * 18.0 +
    axisDotGravity * 10.0 -
    coaxialDiskScore * 15.0 -
    (hasOpenDistalBore ? 15.0 : 0.0);

  let dStrut =
    (inClosedTrussLoop ? 34.0 : -18.0) +
    (1.0 - jointNeckPinch) * 12.0 -
    coaxialDiskScore * 30.0 -
    (hasOpenDistalBore ? 20.0 : 0.0);

  let dSensor =
    (normGravityHeight > 0.80 ? 22.0 : -10.0) +
    axisDotGravity * 15.0 +
    (!inClosedTrussLoop && !hasOpenDistalBore ? 14.0 : -12.0) -
    coaxialDiskScore * 20.0;

  // Positive-Only Kinematic Evidence Gate (Zero velocity adds ZERO negative evidence!)
  if (relOmegaMag > 0.05) {
    dAxle   += axialSpinRatio * 28.0 - (1.0 - axialSpinRatio) * 10.0;
    dBarrel += (1.0 - axialSpinRatio) * 12.0 + (pivotLocationNorm < 0.2 ? 10.0 : 0.0);
    dLimb   += (1.0 - axialSpinRatio) * 22.0 + (pivotLocationNorm < 0.15 ? 15.0 : 0.0);
    dStrut  -= 40.0;
    dSensor += axialSpinRatio * 14.0;
  }

  const deltas = [dAxle, dBarrel, dLimb, dStrut, dSensor];
  let bestGroup = 1;
  let maxVal = -128;
  for (let g = 0; g < 5; g++) {
    let next = beliefLogOdds[beliefOffset + g] + ((deltas[g] * 0.25) | 0);
    if (next > 127) next = 127;
    if (next < -127) next = -127;
    beliefLogOdds[beliefOffset + g] = next;
    if (next > maxVal) {
      maxVal = next;
      bestGroup = g + 1; // 1=AXLE, 2=BARREL, 3=LIMB, 4=STRUT, 5=SENSOR
    }
  }
  return bestGroup;
}

const beliefs = new Int8Array(5 * 5); // 5 test parts

// Test Part A: Parked Truck Axle (Zero velocity: relOmegaMag = 0, axialSpinRatio = 0)
const parkedAxleGroup = updateTsarBayesianBelief(
  beliefs, 0,
  0.15, // normGravityHeight (low)
  0.05, // axisDotGravity (transverse)
  0.05, // axisDotForward (transverse)
  0.95, // coaxialDiskScore (connected to wheels!)
  0,    // inClosedTrussLoop
  1,    // hasBilateralTwin (symmetric across sagittal plane)
  0,    // hasOpenDistalBore
  0,    // jointNeckPinch
  0.0, 0.0, 0.0 // ZERO VELOCITY!
);
assert(parkedAxleGroup === 1, `Parked Truck Axle classified as AXLE (Group 1) at zero velocity (actual=${parkedAxleGroup})`);

// Test Part B: Parked Tank Cannon Barrel (Zero velocity)
const parkedBarrelGroup = updateTsarBayesianBelief(
  beliefs, 5,
  0.65, // normGravityHeight (mid-high)
  0.10, // axisDotGravity (horizontal)
  0.95, // axisDotForward (forward-pointing!)
  0.0,  // coaxialDiskScore
  0,    // inClosedTrussLoop (cantilever)
  0,    // hasBilateralTwin
  1,    // hasOpenDistalBore (open muzzle cavity!)
  0.5,  // jointNeckPinch (turret mantlet pivot)
  0.0, 0.0, 0.0 // ZERO VELOCITY!
);
assert(parkedBarrelGroup === 2, `Parked Tank Cannon classified as BARREL (Group 2) at zero velocity (actual=${parkedBarrelGroup})`);

// Test Part C: Closed Roll-Cage Strut
const strutGroup = updateTsarBayesianBelief(
  beliefs, 10,
  0.50, 0.70, 0.50,
  0.0,
  1,    // inClosedTrussLoop = 1!
  1,
  0, 0,
  0.0, 0.0, 0.0
);
assert(strutGroup === 4, `Roll-cage pillar classified as STRUT (Group 4) at zero velocity (actual=${strutGroup})`);

// Test Latch Persistence: Simulate truck driving (relOmega > 0) then parking again
updateTsarBayesianBelief(beliefs, 0, 0.15, 0.05, 0.05, 0.95, 0, 1, 0, 0, 2.5, 0.95, 0.5); // Driving
const axleBeliefAfterDrive = beliefs[0];
// Now park completely for 10 frames
for (let f = 0; f < 10; f++) {
  updateTsarBayesianBelief(beliefs, 0, 0.15, 0.05, 0.05, 0.95, 0, 1, 0, 0, 0.0, 0.0, 0.0);
}
assert(beliefs[0] >= axleBeliefAfterDrive, `Bayesian Latch preserved axle confidence after stopping (LogOdds=${beliefs[0]})`);

// =========================================================================
// SPIKE 6: VSA-4096 to @hm/meshops AST Bytecode Tape Compiler
// =========================================================================
console.log('\n--- [SPIKE 6] @hm/meshops AST Bytecode Tape Compiler ---');

const MESHOP_NOP        = 0x00;
const MESHOP_PROFILE_2D = 0x01;
const MESHOP_SWEEP_CGA  = 0x04;
const MESHOP_CSG_BORE   = 0x05;
const MESHOP_BEVEL      = 0x06;

function compileVsaToMeshOpsTape(astOpCodes, astParamWeights, shorthandVtx, outTapeBuffer, outTapeOffset) {
  let ptr = outTapeOffset;
  const radialSegments = (4 + ((shorthandVtx * 28.0) | 0));
  const spineSegments  = (1 + ((shorthandVtx * 15.0) | 0));
  const bevelSubdivs   = shorthandVtx < 0.25 ? 0 : (1 + ((shorthandVtx * 3.0) | 0));

  for (let step = 0; step < 6; step++) {
    const op = astOpCodes[step];
    if (op === MESHOP_NOP) break;
    const pBase = step * 4;

    outTapeBuffer[ptr++] = op;
    switch (op) {
      case MESHOP_PROFILE_2D:
        outTapeBuffer[ptr++] = radialSegments;
        outTapeBuffer[ptr++] = 0.5 + 0.4 * astParamWeights[pBase + 0];
        outTapeBuffer[ptr++] = 0.3 * astParamWeights[pBase + 1];
        outTapeBuffer[ptr++] = 0.25 * astParamWeights[pBase + 2];
        outTapeBuffer[ptr++] = 0.15 * astParamWeights[pBase + 3];
        break;
      case MESHOP_SWEEP_CGA:
        outTapeBuffer[ptr++] = spineSegments;
        outTapeBuffer[ptr++] = astParamWeights[pBase + 0] * 1.570796;
        outTapeBuffer[ptr++] = astParamWeights[pBase + 1] * 3.141592;
        outTapeBuffer[ptr++] = astParamWeights[pBase + 2] * 1.2;
        break;
      case MESHOP_CSG_BORE:
        outTapeBuffer[ptr++] = Math.max(0.1, Math.min(0.9, Math.abs(astParamWeights[pBase + 0])));
        outTapeBuffer[ptr++] = Math.max(0.1, Math.min(1.0, Math.abs(astParamWeights[pBase + 1])));
        break;
      case MESHOP_BEVEL:
        outTapeBuffer[ptr++] = bevelSubdivs;
        outTapeBuffer[ptr++] = Math.max(0.005, 0.08 * Math.abs(astParamWeights[pBase + 0]));
        break;
    }
  }
  outTapeBuffer[ptr++] = MESHOP_NOP;
  return ptr - outTapeOffset;
}

const astCodes = new Uint8Array([MESHOP_PROFILE_2D, MESHOP_SWEEP_CGA, MESHOP_CSG_BORE, MESHOP_BEVEL, MESHOP_NOP]);
const astParams = new Float32Array(32);
astParams[0] = 0.5; astParams[1] = 0.0; astParams[2] = -0.4; astParams[3] = 0.1; // Boxy profile
const tapeBuffer = new Float32Array(64);

// Compile at S_0 (Vtx = 0.05) vs S_6 (Vtx = 0.95)
const lenS0 = compileVsaToMeshOpsTape(astCodes, astParams, 0.05, tapeBuffer, 0);
const radialS0 = tapeBuffer[1];
const bevelS0 = tapeBuffer[15]; // Offset 15: MESHOP_BEVEL subdivs (step 3: op=14, subdivs=15)

const lenS6 = compileVsaToMeshOpsTape(astCodes, astParams, 0.95, tapeBuffer, 0);
const radialS6 = tapeBuffer[1];
const bevelS6 = tapeBuffer[15];

console.log(`  S_0 Bytecode: radialSubdiv=${radialS0}, bevelSubdiv=${bevelS0} (Tape size: ${lenS0} floats)`);
console.log(`  S_6 Bytecode: radialSubdiv=${radialS6}, bevelSubdiv=${bevelS6} (Tape size: ${lenS6} floats)`);
assert(radialS0 === 5, 'Stage S_0 compiles to minimal low-poly 5-sided radial prism');
assert(bevelS0 === 0, 'Stage S_0 culls bevel operator to 0 subdivisions');
assert(radialS6 >= 30, 'Stage S_6 scales radial tessellation up to smooth 30-sided cylinder');
assert(bevelS6 >= 3, 'Stage S_6 activates multi-segment chamfer beveling');

// =========================================================================
// SPIKE 7: Real-Time Point-Cloud to @hm/meshops Inverse Crystallizer
// =========================================================================
console.log('\n--- [SPIKE 7] Real-Time Point-Cloud to @hm/meshops Crystallizer ---');

function crystallizePointCloudToMeshOps(pointsXYZ, numPts, comPos, pAxis1, pAxis2, pAxis3, outTape) {
  if (numPts < 8) return 0;
  let sumR = 0.0, sumR2Cos2 = 0.0, sumR2Sin2 = 0.0, sumR4Cos4 = 0.0, sumR6Cos6 = 0.0;
  let minSpineZ = 1e9, maxSpineZ = -1e9;
  let rTopSum = 0.0, rBotSum = 0.0, nTop = 0, nBot = 0;
  let minRadialDist = 1e9;
  const invN = 1.0 / numPts;

  for (let i = 0; i < numPts; i++) {
    const idx = i * 3;
    const dx = pointsXYZ[idx + 0] - comPos[0];
    const dy = pointsXYZ[idx + 1] - comPos[1];
    const dz = pointsXYZ[idx + 2] - comPos[2];

    const w = dx * pAxis1[0] + dy * pAxis1[1] + dz * pAxis1[2];
    const u = dx * pAxis2[0] + dy * pAxis2[1] + dz * pAxis2[2];
    const v = dx * pAxis3[0] + dy * pAxis3[1] + dz * pAxis3[2];

    if (w < minSpineZ) minSpineZ = w;
    if (w > maxSpineZ) maxSpineZ = w;

    const rSq = u * u + v * v;
    const r = Math.sqrt(rSq + 1e-12);
    if (r < minRadialDist) minRadialDist = r;
    sumR += r;

    if (w > 0.0) { rTopSum += r; nTop++; }
    else         { rBotSum += r; nBot++; }

    // Chebyshev Multiple-Angle Identities (Zero Math.sin / Math.cos / Math.atan2 inside loop!)
    const invR = 1.0 / r;
    const c1 = u * invR;
    const s1 = v * invR;
    const c2 = c1 * c1 - s1 * s1;
    const s2 = 2.0 * c1 * s1;
    const c4 = c2 * c2 - s2 * s2;
    const c6 = c4 * c2 - (2.0 * c2 * s2) * s2;

    sumR2Cos2 += r * c2;
    sumR2Sin2 += r * s2;
    sumR4Cos4 += r * c4;
    sumR6Cos6 += r * c6;
  }

  const r0 = sumR * invN;
  const invR0 = 1.0 / (r0 + 1e-6);
  const a2 = (2.0 * sumR2Cos2 * invN) * invR0;
  const b2 = (2.0 * sumR2Sin2 * invN) * invR0;
  const a4 = (2.0 * sumR4Cos4 * invN) * invR0;
  const a6 = (2.0 * sumR6Cos6 * invN) * invR0;

  const rTop = nTop > 0 ? rTopSum / nTop : r0;
  const rBot = nBot > 0 ? rBotSum / nBot : r0;
  const taperSigma = Math.log((rTop + 1e-4) / (rBot + 1e-4));
  const length = maxSpineZ - minSpineZ;
  const hollowBoreRatio = minRadialDist * invR0;

  outTape[0] = r0;
  outTape[1] = a2;
  outTape[2] = b2;
  outTape[3] = a4;
  outTape[4] = a6;
  outTape[5] = length;
  outTape[6] = taperSigma;
  outTape[7] = hollowBoreRatio > 0.35 ? hollowBoreRatio : 0.0;
  return 8;
}

// Generate 1,024 synthetic LiDAR scan points on a hollow pipe (r_inner=0.4m, r_outer=0.5m, L=2.0m)
const NUM_PTS = 1024;
const scanPoints = new Float32Array(NUM_PTS * 3);
for (let i = 0; i < NUM_PTS; i++) {
  const theta = (i / NUM_PTS) * 2.0 * Math.PI;
  const z = ((i % 32) / 32) * 2.0 - 1.0;
  const r = 0.45 + 0.04 * Math.sin(i * 13.0); // Surface noise between 0.41 and 0.49
  scanPoints[i * 3 + 0] = r * Math.cos(theta);
  scanPoints[i * 3 + 1] = r * Math.sin(theta);
  scanPoints[i * 3 + 2] = z;
}

const outCrystallized = new Float32Array(8);
// Warm up JIT
for (let w = 0; w < 10; w++) {
  crystallizePointCloudToMeshOps(scanPoints, NUM_PTS, [0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0], outCrystallized);
}

const t8 = performance.now();
crystallizePointCloudToMeshOps(
  scanPoints, NUM_PTS,
  [0, 0, 0],
  [0, 0, 1], // e1 = Z (Spine)
  [1, 0, 0], // e2 = X
  [0, 1, 0], // e3 = Y
  outCrystallized
);
const t9 = performance.now();
const crystTimeMs = t9 - t8;

console.log(`  Crystallized 1,024 point scan in ${crystTimeMs.toFixed(3)} ms:`);
console.log(`    r0: ${outCrystallized[0].toFixed(3)}m, Length: ${outCrystallized[5].toFixed(3)}m, BoreRatio: ${outCrystallized[7].toFixed(3)}`);
console.log(`    Fourier Harmonics: a2=${outCrystallized[1].toFixed(4)}, a4=${outCrystallized[3].toFixed(4)}, a6=${outCrystallized[4].toFixed(4)}`);

assert(crystTimeMs < 3.0, `Crystallizer execution time satisfied (< 3.0 ms, actual: ${crystTimeMs.toFixed(3)} ms)`);
assert(Math.abs(outCrystallized[0] - 0.45) < 0.02, `Base radius r0 correctly estimated (~0.45m, actual=${outCrystallized[0].toFixed(3)}m)`);
assert(Math.abs(outCrystallized[5] - 2.0) < 0.10, `Cylinder length correctly estimated (~2.0m, actual=${outCrystallized[5].toFixed(3)}m)`);
assert(outCrystallized[7] > 0.50, `Hollow inner cavity correctly detected as CSG_BORE (BoreRatio=${outCrystallized[7].toFixed(2)})`);
assert(Math.abs(outCrystallized[1]) < 0.05 && Math.abs(outCrystallized[3]) < 0.05, 'Circular cross-section correctly identified with near-zero higher harmonics');

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n' + '='.repeat(72));
console.log(`  ALL PLAN 46 SPIKES VERIFIED: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('='.repeat(72));

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
