#!/usr/bin/env node
// wow_anticheat.mjs - Syntropic Kinematic & Behavioral Anti-Cheat Engine v3
// Bridges World of Warcraft Client Telemetry with the 4-Node Triad Holon
// Implements rigorous mathematical verifiers:
// 1. Kinematic Spline Divergence (Speedhack & Teleport Detection with Full Speed & Pair Checking)
// 2. Neuromuscular Latency Verification (Human Reaction Bounds vs Robotic Injection)
// 3. True Shannon Entropy & Sequential Transition Analysis of Cast Intervals
// 4. Grounded Density Verification (D1..D7) with Zero False Certainty on Missing Data
//
// Epistemic Invariants:
// - Empty sessions or missing metrics strictly return INSUFFICIENT_EVIDENCE (confidence 0.0)
// - D1, D5, D6 require genuine non-empty validation pipelines, otherwise unverified
// - Reaction times classify observed event elapsed intervals, not courtroom guilt
// - True Shannon Entropy H = -sum(p_i * log2(p_i)) over active rotation window [200ms, 3500ms]
// - Clear distinction: divergence metric is an empirical spline prediction-error proxy, not atomic FTLE

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Unified thresholds
export const ROBOTIC_INJECTION_THRESHOLD_MS = 60.0;  // Physiologically impossible for human visual reaction
export const PREDICTIVE_THRESHOLD_MS = 130.0;        // Anticipation/prediction threshold
export const HUMAN_MIN_REACTION_MS = 130.0;          // Verified neuromuscular reflex threshold
export const MAX_ALLOWED_GROUND_SPEED = 16.0;        // Max valid yards/sec (mounted + buffs)
export const MAX_ALLOWED_FLIGHT_SPEED = 35.0;        // Max valid yards/sec flight
export const FTLE_NOMINAL_LIMIT = 0.010;             // Smooth kinematic spline bound

/**
 * Computes Kinematic Trajectory Divergence across position trajectory samples.
 * Validates speed on ALL samples and checks displacement velocity across all adjacent pairs.
 * @param {Array<{t: number, x: number, y: number, z?: number, speed?: number}>} samples
 * @param {object} options
 * @returns {{ftle: number|null, anomaly: boolean, status: string, basis: string}}
 */
export function evaluateKinematicFTLE(samples, { maxSpeed = MAX_ALLOWED_GROUND_SPEED } = {}) {
  if (!Array.isArray(samples) || samples.length < 3) {
    return {
      ftle: null,
      anomaly: false,
      status: 'insufficient_data',
      basis: `Insufficient trajectory samples for kinematic evaluation (got ${samples?.length ?? 0}, need >= 3).`
    };
  }

  // Validate that all required numeric coordinates exist and are finite
  const validSamples = samples.filter(p =>
    p && typeof p.t === 'number' && Number.isFinite(p.t) &&
    typeof p.x === 'number' && Number.isFinite(p.x) &&
    typeof p.y === 'number' && Number.isFinite(p.y)
  );

  if (validSamples.length < 3) {
    return {
      ftle: null,
      anomaly: false,
      status: 'insufficient_valid_samples',
      basis: `Only ${validSamples.length} of ${samples.length} samples contained valid finite coordinates (need >= 3).`
    };
  }

  let totalDivergence = 0;
  let count = 0;
  let speedViolationCount = 0;

  // 1. Check reported speed across ALL samples (including first and last)
  for (const p of validSamples) {
    if (typeof p.speed === 'number' && Number.isFinite(p.speed) && p.speed > maxSpeed) {
      speedViolationCount++;
    }
  }

  // 2. Check implied displacement velocity across ALL adjacent sample pairs
  for (let i = 1; i < validSamples.length; i++) {
    const p0 = validSamples[i - 1];
    const p1 = validSamples[i];
    const dt = (p1.t - p0.t) / 1000.0;
    if (dt > 0) {
      const stepDist = Math.hypot(p1.x - p0.x, p1.y - p0.y, (p1.z ?? 0) - (p0.z ?? 0));
      if (stepDist / dt > maxSpeed) {
        speedViolationCount++;
      }
    }
  }

  // 3. Compute spline prediction-error divergence proxy across consecutive triplets
  for (let i = 1; i < validSamples.length - 1; i++) {
    const p0 = validSamples[i - 1];
    const p1 = validSamples[i];
    const p2 = validSamples[i + 1];

    const dt1 = (p1.t - p0.t) / 1000.0;
    const dt2 = (p2.t - p1.t) / 1000.0;
    if (dt1 <= 0 || dt2 <= 0) continue;

    // Expected displacement based on p0 -> p1 velocity
    const vx = (p1.x - p0.x) / dt1;
    const vy = (p1.y - p0.y) / dt1;
    const vz = ((p1.z ?? 0) - (p0.z ?? 0)) / dt1;

    const expectedX = p1.x + vx * dt2;
    const expectedY = p1.y + vy * dt2;
    const expectedZ = (p1.z ?? 0) + vz * dt2;

    const dev = Math.hypot(p2.x - expectedX, p2.y - expectedY, (p2.z ?? 0) - expectedZ);
    const epsilon0 = 0.10; // Resolution scale in yards

    const localFtle = (1.0 / dt2) * Math.log(1.0 + (dev / epsilon0)) * 0.01;
    if (Number.isFinite(localFtle)) {
      totalDivergence += localFtle;
      count++;
    }
  }

  if (count === 0) {
    return {
      ftle: null,
      anomaly: false,
      status: 'insufficient_valid_samples',
      basis: 'No consecutive positive-duration time steps found in trajectory.'
    };
  }

  const averageFtle = +(totalDivergence / count).toFixed(4);
  const isAnomaly = averageFtle > FTLE_NOMINAL_LIMIT || speedViolationCount > 0;

  return {
    ftle: averageFtle,
    anomaly: isAnomaly,
    speedViolations: speedViolationCount,
    status: isAnomaly ? 'kinematic_anomaly_detected' : 'conforming_physical_spline',
    sampleCount: count,
    basis: `Evaluated ${count} position steps: trajectory divergence heuristic proxy is ${averageFtle} (Limit: ${FTLE_NOMINAL_LIMIT}). Speed violations: ${speedViolationCount}. Trajectory is ${isAnomaly ? 'kinematically deviant (speedhack/teleport signature)' : 'smooth continuous physical spline'}. Note: divergence metric is an empirical spline prediction-error proxy.`
  };
}

/**
 * Evaluates interrupt reaction times against human cognitive thresholds.
 * Strictly respects confirmedInterrupt flag when present.
 * @param {Array<{castId?: string, spellName?: string, reactionTimeMs: number, confirmedInterrupt?: boolean}>} events
 * @returns {{verdict: string, minReactionMs: number|null, inhumanKicksCount: number, predictiveCount: number, reflexCount: number, status: string, basis: string}}
 */
export function evaluateReactionTime(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      verdict: 'untested',
      status: 'no_data',
      minReactionMs: null,
      inhumanKicksCount: 0,
      predictiveCount: 0,
      reflexCount: 0,
      basis: 'No interrupt events recorded in session.'
    };
  }

  // Filter valid events: strictly reject confirmedInterrupt === false, require valid finite numeric reactionTimeMs >= 0
  const valid = events.filter(ev =>
    ev &&
    ev.confirmedInterrupt !== false &&
    typeof ev.reactionTimeMs === 'number' &&
    Number.isFinite(ev.reactionTimeMs) &&
    ev.reactionTimeMs >= 0
  );

  if (valid.length === 0) {
    return {
      verdict: 'untested',
      status: 'invalid_data',
      minReactionMs: null,
      inhumanKicksCount: 0,
      predictiveCount: 0,
      reflexCount: 0,
      basis: 'Events present but none were confirmed interrupts with valid numeric reactionTimeMs.'
    };
  }

  let minReaction = Infinity;
  let inhumanCount = 0;
  let predictiveCount = 0;
  let reflexCount = 0;

  for (const ev of valid) {
    if (ev.reactionTimeMs < minReaction) minReaction = ev.reactionTimeMs;
    if (ev.reactionTimeMs < ROBOTIC_INJECTION_THRESHOLD_MS) {
      inhumanCount++;
    } else if (ev.reactionTimeMs < PREDICTIVE_THRESHOLD_MS) {
      predictiveCount++;
    } else {
      reflexCount++;
    }
  }

  let verdict = 'human_reflex';
  let status = 'neuromuscular_limits_verified';

  if (inhumanCount > 0) {
    verdict = 'robotic_injection';
    status = 'robotic_injection_detected';
  } else if (predictiveCount > 0) {
    verdict = 'predictive_cadence';
    status = 'predictive_timing_observed';
  }

  return {
    verdict,
    status,
    minReactionMs: +minReaction.toFixed(1),
    inhumanKicksCount: inhumanCount,
    predictiveCount,
    reflexCount,
    totalValidEvents: valid.length,
    basis: `Observed ${valid.length} confirmed interrupts (min ${minReaction.toFixed(1)}ms): ${reflexCount} in typical reflex window (>=${PREDICTIVE_THRESHOLD_MS}ms), ${predictiveCount} in predictive/pre-cast window (${ROBOTIC_INJECTION_THRESHOLD_MS}-${PREDICTIVE_THRESHOLD_MS}ms), ${inhumanCount} below robotic threshold (<${ROBOTIC_INJECTION_THRESHOLD_MS}ms). Note: classifies observed combat-log elapsed intervals, not courtroom proof.`
  };
}

/**
 * Computes true Shannon Entropy H = -sum(p_i * log2(p_i)) over active rotation intervals [200ms, 3500ms].
 * Intervals outside this window (e.g. pauses between pulls) are filtered out, avoiding overflow bin collapse.
 * Also computes lag-1 sequential transition entropy to catch repeating deterministic sequences (e.g. [1s, 1.5s, 1s, 1.5s]).
 * @param {Array<number>} intervalsMs Array of inter-cast intervals in milliseconds
 * @param {number} binWidthMs Bin width for interval discretization (default 50ms)
 * @returns {{entropyBits: number|null, sequentialEntropyBits: number|null, isBottingPattern: boolean|null, status: string, basis: string}}
 */
export function evaluateShannonEntropy(intervalsMs, binWidthMs = 50) {
  if (!Array.isArray(intervalsMs) || intervalsMs.length < 5) {
    return {
      entropyBits: null,
      sequentialEntropyBits: null,
      isBottingPattern: null,
      status: 'insufficient_data',
      basis: `Insufficient interval data for Shannon entropy (got ${intervalsMs?.length ?? 0}, need >= 5).`
    };
  }

  // Active rotation window: 200ms to 3500ms (excludes out-of-combat long pauses and sub-frame zero bugs)
  const MIN_INTERVAL_MS = 200;
  const MAX_INTERVAL_MS = 3500;
  const valid = intervalsMs.filter(dt => typeof dt === 'number' && Number.isFinite(dt) && dt >= MIN_INTERVAL_MS && dt <= MAX_INTERVAL_MS);

  if (valid.length < 5) {
    return {
      entropyBits: null,
      sequentialEntropyBits: null,
      isBottingPattern: null,
      status: 'insufficient_valid_data',
      basis: `Only ${valid.length} of ${intervalsMs.length} intervals fell within active rotation window [${MIN_INTERVAL_MS}ms, ${MAX_INTERVAL_MS}ms].`
    };
  }

  // 1. Histogram Shannon Entropy
  const numBins = Math.ceil((MAX_INTERVAL_MS - MIN_INTERVAL_MS) / binWidthMs);
  const bins = new Array(numBins).fill(0);

  for (const dt of valid) {
    const binIdx = Math.min(numBins - 1, Math.floor((dt - MIN_INTERVAL_MS) / binWidthMs));
    bins[binIdx]++;
  }

  let H = 0;
  const N = valid.length;
  for (const count of bins) {
    if (count > 0) {
      const p = count / N;
      H -= p * Math.log2(p);
    }
  }
  H = +H.toFixed(3);

  // 2. Lag-1 Conditional Transition Entropy: H(X_t | X_t-1)
  // Evaluates predictability given the previous interval state to catch repeating macros
  const transitions = new Map();
  const fromCounts = new Map();
  for (let i = 1; i < valid.length; i++) {
    const b0 = Math.min(numBins - 1, Math.floor((valid[i - 1] - MIN_INTERVAL_MS) / binWidthMs));
    const b1 = Math.min(numBins - 1, Math.floor((valid[i] - MIN_INTERVAL_MS) / binWidthMs));
    fromCounts.set(b0, (fromCounts.get(b0) || 0) + 1);
    const map = transitions.get(b0) || new Map();
    map.set(b1, (map.get(b1) || 0) + 1);
    transitions.set(b0, map);
  }

  let revisitedCount = 0;
  let condH = 0;
  for (const [from, map] of transitions.entries()) {
    const count = fromCounts.get(from);
    if (count >= 2) {
      let stateH = 0;
      for (const c of map.values()) {
        const p = c / count;
        stateH -= p * Math.log2(p);
      }
      condH += count * stateH;
      revisitedCount += count;
    }
  }

  const conditionalEntropy = revisitedCount >= 4 ? +(condH / revisitedCount).toFixed(3) : null;

  // Botting pattern criteria:
  // 1. Static interval spam: H < 0.80 bits
  // 2. Deterministic cyclic loop: revisitedCount >= 4 and conditionalEntropy < 0.10 bits
  const isDeterministicLoop = conditionalEntropy !== null && conditionalEntropy < 0.10 && revisitedCount >= 4;
  const isBot = H < 0.80 || isDeterministicLoop;

  return {
    entropyBits: H,
    conditionalEntropyBits: conditionalEntropy,
    binWidthMs,
    sampleCount: N,
    isBottingPattern: isBot,
    status: isBot ? 'deterministic_botting_pattern' : 'organic_human_cadence',
    basis: `Shannon entropy H = ${H} bits (conditional transition H_cond = ${conditionalEntropy ?? 'n/a'} bits) across ${valid.length} rotation intervals. Cadence is ${isBot ? 'synthetic deterministic automation' : 'organic human cognitive flow'}. Note: characterizes interval variability, not absolute human attribution.`
  };
}

/**
 * Validates hardware scan-code telemetry (D1)
 */
export function validateHardwareScanCodes(hardwareEvents) {
  if (!Array.isArray(hardwareEvents) || hardwareEvents.length === 0) {
    return { status: 'unverified', basis: 'No raw hardware scan-code telemetry provided in session data.' };
  }
  const valid = hardwareEvents.filter(e => e && typeof e.scanCode !== 'undefined');
  if (valid.length === 0) {
    return { status: 'unverified', basis: 'Hardware events provided but none contain valid scanCode fields.' };
  }
  const syntheticCount = valid.filter(e => e.isVirtual === true || e.isInjected === true).length;
  return {
    status: syntheticCount > 0 ? 'synthetic_injection_detected' : 'verified_physical_driver',
    syntheticCount,
    sampleCount: valid.length,
    basis: `Inspected ${valid.length} hardware input events: ${syntheticCount} flagged as synthetic/virtual driver injection.`
  };
}

/**
 * Validates terrain collision envelope (D5)
 */
export function validateTerrainCollision(trajectory, terrainMesh) {
  if (!terrainMesh || !Array.isArray(terrainMesh.bounds) || terrainMesh.bounds.length === 0) {
    return { status: 'unverified', basis: 'No map terrain collision bounds provided in session data.' };
  }
  if (!Array.isArray(trajectory) || trajectory.length === 0) {
    return { status: 'unverified', basis: 'No trajectory points provided to test against terrain bounds.' };
  }
  let outOfBoundsCount = 0;
  for (const p of trajectory) {
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      const b = terrainMesh.bounds; // [minX, maxX, minY, maxY]
      if (p.x < b[0] || p.x > b[1] || p.y < b[2] || p.y > b[3]) {
        outOfBoundsCount++;
      }
    }
  }
  return {
    status: outOfBoundsCount > 0 ? 'terrain_bounds_violated' : 'within_terrain_envelope',
    outOfBoundsCount,
    basis: `Checked ${trajectory.length} points against terrain bounds: ${outOfBoundsCount} out-of-bounds positions.`
  };
}

/**
 * Validates multi-unit raid combat log synchronization (D6)
 */
export function validateRaidCombatLogSync(raidCombatLogEvents) {
  if (!Array.isArray(raidCombatLogEvents) || raidCombatLogEvents.length < 2) {
    return { status: 'unverified', basis: 'No multi-unit party/raid cross-synchronization log provided.' };
  }
  let clockDesyncCount = 0;
  for (let i = 1; i < raidCombatLogEvents.length; i++) {
    if (raidCombatLogEvents[i].timestamp < raidCombatLogEvents[i - 1].timestamp) {
      clockDesyncCount++;
    }
  }
  return {
    status: clockDesyncCount > 0 ? 'clock_desync_detected' : 'log_chronology_verified',
    clockDesyncCount,
    basis: `Checked ${raidCombatLogEvents.length} cross-unit log events: ${clockDesyncCount} chronologically inverted sequences.`
  };
}

/**
 * Conducts a full 7-Density Syntropic Session Audit with strict evidentiary standards.
 * Never reports verified on missing or unperformed checks.
 */
export function auditWoWSession({
  trajectory = [],
  interrupts = [],
  castIntervals = [],
  hardwareScanCodes = null,
  terrainCollisionBounds = null,
  raidCombatLogSync = null,
  character = 'Player',
  realm = 'Azeroth'
} = {}) {
  const ftleResult = evaluateKinematicFTLE(trajectory);
  const reactionResult = evaluateReactionTime(interrupts);
  const entropyResult = evaluateShannonEntropy(castIntervals);
  const d1Result = validateHardwareScanCodes(hardwareScanCodes);
  const d5Result = validateTerrainCollision(trajectory, terrainCollisionBounds);
  const d6Result = validateRaidCombatLogSync(raidCombatLogSync);

  // Strict evidence scoring: only count checks that actually completed and produced valid measurements
  let evidenceScore = 0;
  const totalChecks = 3; // Core 3: Kinematics, Reaction Latency, Entropy

  const ftleEvaluated = ftleResult.status === 'conforming_physical_spline' || ftleResult.status === 'kinematic_anomaly_detected';
  const reactionEvaluated = reactionResult.status === 'neuromuscular_limits_verified' || reactionResult.status === 'robotic_injection_detected' || reactionResult.status === 'predictive_timing_observed';
  const entropyEvaluated = entropyResult.status === 'organic_human_cadence' || entropyResult.status === 'deterministic_botting_pattern';

  if (ftleEvaluated) evidenceScore++;
  if (reactionEvaluated) evidenceScore++;
  if (entropyEvaluated) evidenceScore++;

  const hasSufficientEvidence = evidenceScore > 0;
  const confidence = hasSufficientEvidence ? +(evidenceScore / totalChecks * 0.95).toFixed(3) : 0.0;

  let overallVerdict = 'INSUFFICIENT_EVIDENCE';
  if (hasSufficientEvidence) {
    const anomaly = ftleResult.anomaly ||
      reactionResult.verdict === 'robotic_injection' ||
      entropyResult.isBottingPattern === true ||
      d1Result.status === 'synthetic_injection_detected' ||
      d5Result.status === 'terrain_bounds_violated';

    overallVerdict = anomaly ? 'ANOMALY_DETECTED' : 'VERIFIED_HUMAN_FLOW';
  }

  const densityReview = [
    { rung: 'D1', name: 'Atoms & Hardware Substrate', status: d1Result.status, assessment: d1Result.basis },
    { rung: 'D2', name: 'Kinematic Parts & Trajectories', status: ftleResult.status, assessment: ftleResult.basis },
    { rung: 'D3', name: 'Vessel & Somatics', status: reactionResult.status, assessment: reactionResult.basis },
    { rung: 'D4', name: 'Assembly & Rotation Cadence', status: entropyResult.status, assessment: entropyResult.basis },
    { rung: 'D5', name: 'Biome & World Terrain Mesh', status: d5Result.status, assessment: d5Result.basis },
    { rung: 'D6', name: 'Space & Global Raid Stream', status: d6Result.status, assessment: d6Result.basis },
    {
      rung: 'D7',
      name: 'Gateway of Intelligent Infinity',
      status: hasSufficientEvidence ? (overallVerdict === 'ANOMALY_DETECTED' ? 'invariant_breached' : 'syntropic_balance_preserved') : 'untested',
      assessment: hasSufficientEvidence
        ? (overallVerdict === 'ANOMALY_DETECTED' ? 'Syntropic invariant breached: synthetic automation detected. Transparently report findings.' : 'Syntropic balance preserved: zero architectural distortion. Player operates in verified flow.')
        : 'Insufficient evidence to establish syntropic status.'
    }
  ];

  return {
    schema: 'wow-syntropic-audit-v3',
    character,
    realm,
    audited_at: new Date().toISOString(),
    overall_verdict: overallVerdict,
    confidence,
    evidence_score: `${evidenceScore}/${totalChecks}`,
    metrics: {
      lyapunovFTLE: ftleResult.ftle,
      kinematicAnomaly: ftleResult.anomaly,
      minReactionMs: reactionResult.minReactionMs,
      inhumanKicks: reactionResult.inhumanKicksCount,
      predictiveCount: reactionResult.predictiveCount,
      reflexCount: reactionResult.reflexCount,
      shannonEntropyBits: entropyResult.entropyBits,
      conditionalEntropyBits: entropyResult.conditionalEntropyBits,
      sequentialEntropyBits: entropyResult.conditionalEntropyBits,
      rotationBotting: entropyResult.isBottingPattern
    },
    density_review: densityReview
  };
}

async function main() {
  console.log('====================================================');
  console.log('WORLD OF WARCRAFT SYNTROPIC WARDEN & AUDIT ENGINE v3');
  console.log('====================================================\n');

  console.log('[Scenario 1: Empty Session]');
  const empty = auditWoWSession();
  console.log(`  Verdict: ${empty.overall_verdict} (Confidence: ${empty.confidence}, Evidence: ${empty.evidence_score})\n`);

  console.log('[Scenario 2: Malformed / Invalid Session (Identical timestamps + zero intervals)]');
  const malformed = auditWoWSession({
    trajectory: [{ t: 100, x: 1, y: 1 }, { t: 100, x: 1, y: 1 }, { t: 100, x: 1, y: 1 }],
    castIntervals: [0, 0, 0, 0, 0]
  });
  console.log(`  Verdict: ${malformed.overall_verdict} (Confidence: ${malformed.confidence}, Evidence: ${malformed.evidence_score})\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(console.error);
}
