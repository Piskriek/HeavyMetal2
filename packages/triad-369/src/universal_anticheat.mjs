#!/usr/bin/env node
// universal_anticheat.mjs - Universal Syntropic Invariant Verifier (SIV)
// Multi-Game Kinematic & Behavioral Anti-Cheat Framework
// Supported Game Profiles:
// 1. "wow"    - World of Warcraft / MMORPG (Spline Divergence, GCD Shannon Entropy, Auto-Kick Reaction)
// 2. "gta6"   - Grand Theft Auto VI / FiveM / Open-World (Vehicle Hamiltonian Power, Speed Limits, Aim Snapping)
// 3. "fps"    - Tactical Shooters (CS2, Valorant, Apex) (Aim Angular Kinematics, Shortest-Angle Shortest-Path, Triggerbot Latency)
//
// Grounded in:
// - Zero kernel-level spyware / rootkits
// - Deterministic physics & information theory invariants
// - Zero false certainty on missing data: empty sessions return INSUFFICIENT_EVIDENCE (confidence 0.0)
// - Full 7-Density Transparency (D1..D7)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateKinematicFTLE, evaluateReactionTime, evaluateShannonEntropy, auditWoWSession } from './wow_anticheat.mjs';

/**
 * Universal Game Profile Definitions
 */
export const GAME_PROFILES = {
  wow: {
    name: 'World of Warcraft / MMORPG',
    maxSpeedUnitsPerSec: 16.0,   // Ground speed yards/sec
    ftleLimit: 0.010,
    minNeuromuscularReactionMs: 130.0,
    shannonEntropyMinBits: 0.80,
    kinematicDomain: 'player_movement_and_gcd'
  },
  gta6: {
    name: 'Grand Theft Auto VI / FiveM Vehicle & Pedestrian',
    maxVehicleSpeedMps: 120.0,   // ~270 mph top hypercar speed
    maxPedestrianSpeedMps: 11.0, // Human sprint ~24 mph
    ftleLimit: 0.015,
    maxEnginePowerWatts: 600000, // 600 kW theoretical hypercar power budget
    maxAngularJerkDegPerSec3: 50000.0, // Inhuman aim snap threshold
    kinematicDomain: 'vehicle_power_budget_and_aim_splines'
  },
  fps: {
    name: 'Tactical Shooter (CS2 / Valorant / Apex)',
    maxMovementSpeedUnits: 250.0,
    ftleLimit: 0.008,
    minTriggerbotReactionMs: 120.0,
    minAimSnapTicks: 3,         // Instantaneous 1-tick lock indicates memory write
    kinematicDomain: 'camera_angular_kinematics_and_tremor'
  }
};

/**
 * Normalizes an angle difference to the shortest arc [-180, 180] degrees.
 * Prevents false aimbot snap flags across the 180/-180 degree boundary.
 * @param {number} deltaDeg Raw angle difference in degrees
 * @returns {number} Normalized angle difference in [-180, 180] degrees
 */
export function normalizeShortestAngleDeg(deltaDeg) {
  if (!Number.isFinite(deltaDeg)) return 0;
  return (((deltaDeg + 180) % 360 + 360) % 360) - 180;
}

/**
 * Evaluates GTA 6 Vehicle Physics Energy & Power Limits.
 * Analyzes mechanical work rate: P = d(0.5*m*v^2 + m*g*h) / dt
 * Bounded by theoretical engine power output without collisions or external forces.
 * @param {Array<{t: number, speedMps?: number, z?: number, collisionOccurred?: boolean}>} vehicleTelemetry
 * @param {number} vehicleMassKg
 * @param {number} maxEnginePowerWatts
 * @returns {{verdict: string, status: string, maxPowerObservedWatts: number|null, energyAnomalies: number, basis: string}}
 */
export function evaluateGtaVehicleHamiltonian(vehicleTelemetry, vehicleMassKg = 1500, maxEnginePowerWatts = 600000) {
  if (!Array.isArray(vehicleTelemetry) || vehicleTelemetry.length < 2) {
    return {
      verdict: 'untested',
      status: 'insufficient_data',
      maxPowerObservedWatts: null,
      energyAnomalies: 0,
      basis: `Insufficient vehicle telemetry samples (got ${vehicleTelemetry?.length ?? 0}, need >= 2).`
    };
  }

  let maxPowerObserved = 0;
  let energyAnomalies = 0;
  let validSteps = 0;

  for (let i = 1; i < vehicleTelemetry.length; i++) {
    const s0 = vehicleTelemetry[i - 1];
    const s1 = vehicleTelemetry[i];

    if (!s0 || !s1 || typeof s0.t !== 'number' || typeof s1.t !== 'number') continue;
    const dt = (s1.t - s0.t) / 1000.0;
    if (dt <= 0 || !Number.isFinite(dt)) continue;

    const v0 = (typeof s0.speedMps === 'number' && Number.isFinite(s0.speedMps)) ? s0.speedMps : 0;
    const v1 = (typeof s1.speedMps === 'number' && Number.isFinite(s1.speedMps)) ? s1.speedMps : 0;
    const h0 = (typeof s0.z === 'number' && Number.isFinite(s0.z)) ? s0.z : 0;
    const h1 = (typeof s1.z === 'number' && Number.isFinite(s1.z)) ? s1.z : 0;

    const deltaKinetic = 0.5 * vehicleMassKg * (v1**2 - v0**2);
    const deltaPotential = vehicleMassKg * 9.81 * (h1 - h0);
    const deltaTotalJoules = deltaKinetic + deltaPotential;

    const impliedPowerWatts = deltaTotalJoules / dt;
    if (impliedPowerWatts > maxPowerObserved) maxPowerObserved = impliedPowerWatts;

    // Power exceeds max theoretical engine output without collision/gravity boost:
    if (impliedPowerWatts > maxEnginePowerWatts * 1.5 && !s1.collisionOccurred) {
      energyAnomalies++;
    }
    validSteps++;
  }

  if (validSteps === 0) {
    return {
      verdict: 'untested',
      status: 'insufficient_valid_steps',
      maxPowerObservedWatts: null,
      energyAnomalies: 0,
      basis: 'No consecutive positive-duration time steps found in vehicle telemetry.'
    };
  }

  const isCheat = energyAnomalies > 0;
  return {
    verdict: isCheat ? 'ANOMALY_DETECTED' : 'CONFORMING_PHYSICS',
    maxPowerObservedWatts: Math.round(maxPowerObserved),
    energyAnomalies,
    status: isCheat ? 'vehicle_handling_or_speed_injection' : 'power_within_engine_limits',
    sampleCount: validSteps,
    basis: `Max implied vehicle mechanical power: ${Math.round(maxPowerObserved / 1000)} kW (Limit: ${Math.round(maxEnginePowerWatts / 1000)} kW). ${energyAnomalies} power spikes detected.`
  };
}

/**
 * Evaluates FPS / GTA 6 Aim Snapping Angular Kinematics.
 * Detects 1-tick instant aimlocks (aimbots) while properly normalizing yaw wrapping at circular boundaries.
 * @param {Array<{t: number, yaw: number, pitch: number}>} aimVectors
 * @returns {{verdict: string, status: string, maxAngularSpeedDegPerSec: number|null, instantLockCount: number, basis: string}}
 */
export function evaluateAimAngularKinematics(aimVectors) {
  if (!Array.isArray(aimVectors) || aimVectors.length < 2) {
    return {
      verdict: 'untested',
      status: 'insufficient_data',
      maxAngularSpeedDegPerSec: null,
      instantLockCount: 0,
      basis: `Insufficient aim vector samples (got ${aimVectors?.length ?? 0}, need >= 2).`
    };
  }

  let maxAngularSpeedDegPerSec = 0;
  let instantLockCount = 0;
  let validSteps = 0;

  for (let i = 1; i < aimVectors.length; i++) {
    const a0 = aimVectors[i - 1];
    const a1 = aimVectors[i];

    if (!a0 || !a1 || typeof a0.t !== 'number' || typeof a1.t !== 'number') continue;
    if (typeof a0.yaw !== 'number' || typeof a1.yaw !== 'number' || typeof a0.pitch !== 'number' || typeof a1.pitch !== 'number') continue;

    const dt = (a1.t - a0.t) / 1000.0;
    if (dt <= 0 || !Number.isFinite(dt)) continue;

    // Normalize shortest angle difference in [-180, 180] degrees
    const deltaYaw = Math.abs(normalizeShortestAngleDeg(a1.yaw - a0.yaw));
    const deltaPitch = Math.abs(a1.pitch - a0.pitch);
    const angularDistDeg = Math.hypot(deltaYaw, deltaPitch);

    const angularSpeed = angularDistDeg / dt;
    if (angularSpeed > maxAngularSpeedDegPerSec) maxAngularSpeedDegPerSec = angularSpeed;

    // Aimbot snap: massive angular change (> 35 degrees) in a single frame (<= 20ms)
    if (angularDistDeg > 35.0 && dt <= 0.020) {
      instantLockCount++;
    }
    validSteps++;
  }

  if (validSteps === 0) {
    return {
      verdict: 'untested',
      status: 'insufficient_valid_steps',
      maxAngularSpeedDegPerSec: null,
      instantLockCount: 0,
      basis: 'No consecutive positive-duration time steps found in aim vectors.'
    };
  }

  const isAimbot = instantLockCount > 0;
  return {
    verdict: isAimbot ? 'AIMBOT_SNAP_DETECTED' : 'ORGANIC_HUMAN_AIM',
    maxAngularSpeedDegPerSec: +maxAngularSpeedDegPerSec.toFixed(1),
    instantLockCount,
    status: isAimbot ? 'discontinuous_angular_teleport' : 'smooth_human_steering',
    sampleCount: validSteps,
    basis: `Max angular velocity: ${maxAngularSpeedDegPerSec.toFixed(1)} deg/s. Discontinuous 1-frame snaps: ${instantLockCount}.`
  };
}

/**
 * Unified Multi-Game Audit Entry Point.
 * Strictly gates verdicts on valid evidence: empty sessions return INSUFFICIENT_EVIDENCE with confidence 0.0.
 * @param {object} params
 * @param {string} params.profile 'wow' | 'gta6' | 'fps'
 * @param {object} params.sessionData
 * @returns {object}
 */
export function runUniversalAudit({ profile = 'wow', sessionData = {} } = {}) {
  const cfg = GAME_PROFILES[profile] || GAME_PROFILES.wow;

  if (profile === 'gta6') {
    const vehicleRes = evaluateGtaVehicleHamiltonian(
      sessionData.vehicleTelemetry,
      sessionData.vehicleMassKg ?? 1500,
      cfg.maxEnginePowerWatts
    );
    const aimRes = evaluateAimAngularKinematics(sessionData.aimVectors);

    const vehicleEvaluated = vehicleRes.status === 'power_within_engine_limits' || vehicleRes.status === 'vehicle_handling_or_speed_injection';
    const aimEvaluated = aimRes.status === 'smooth_human_steering' || aimRes.status === 'discontinuous_angular_teleport';
    const evidenceCount = (vehicleEvaluated ? 1 : 0) + (aimEvaluated ? 1 : 0);
    const hasEvidence = evidenceCount > 0;

    let overallVerdict = 'INSUFFICIENT_EVIDENCE';
    let confidence = 0.0;
    if (hasEvidence) {
      const isAnomaly = vehicleRes.verdict === 'ANOMALY_DETECTED' || aimRes.verdict === 'AIMBOT_SNAP_DETECTED';
      overallVerdict = isAnomaly ? 'ANOMALY_DETECTED' : 'VERIFIED_LEGAL_PHYSICS';
      confidence = +(evidenceCount / 2 * 0.95).toFixed(3);
    }

    return {
      schema: 'syntropic-universal-audit-v2',
      profile: 'gta6',
      gameName: cfg.name,
      overall_verdict: overallVerdict,
      confidence,
      evidence_score: `${evidenceCount}/2`,
      vehicle_hamiltonian: vehicleRes,
      aim_kinematics: aimRes,
      audited_at: new Date().toISOString()
    };
  }

  if (profile === 'fps') {
    const aimRes = evaluateAimAngularKinematics(sessionData.aimVectors);
    const triggerRes = evaluateReactionTime(sessionData.triggerEvents);

    const aimEvaluated = aimRes.status === 'smooth_human_steering' || aimRes.status === 'discontinuous_angular_teleport';
    const triggerEvaluated = triggerRes.status === 'neuromuscular_limits_verified' || triggerRes.status === 'robotic_injection_detected' || triggerRes.status === 'predictive_timing_observed';
    const evidenceCount = (aimEvaluated ? 1 : 0) + (triggerEvaluated ? 1 : 0);
    const hasEvidence = evidenceCount > 0;

    let overallVerdict = 'INSUFFICIENT_EVIDENCE';
    let confidence = 0.0;
    if (hasEvidence) {
      const isAnomaly = aimRes.verdict === 'AIMBOT_SNAP_DETECTED' || triggerRes.verdict === 'robotic_injection';
      overallVerdict = isAnomaly ? 'ANOMALY_DETECTED' : 'VERIFIED_HUMAN_AIM';
      confidence = +(evidenceCount / 2 * 0.95).toFixed(3);
    }

    return {
      schema: 'syntropic-universal-audit-v2',
      profile: 'fps',
      gameName: cfg.name,
      overall_verdict: overallVerdict,
      confidence,
      evidence_score: `${evidenceCount}/2`,
      aim_kinematics: aimRes,
      trigger_latency: triggerRes,
      audited_at: new Date().toISOString()
    };
  }

  // Default: WoW Profile (Delegates to complete 7-Density audit)
  const wowAudit = auditWoWSession({
    trajectory: sessionData.trajectory,
    interrupts: sessionData.interrupts,
    castIntervals: sessionData.castIntervals,
    hardwareScanCodes: sessionData.hardwareScanCodes,
    terrainCollisionBounds: sessionData.terrainCollisionBounds,
    raidCombatLogSync: sessionData.raidCombatLogSync,
    character: sessionData.character ?? 'Player',
    realm: sessionData.realm ?? 'Azeroth'
  });

  return {
    schema: 'syntropic-universal-audit-v2',
    profile: 'wow',
    gameName: cfg.name,
    overall_verdict: wowAudit.overall_verdict,
    confidence: wowAudit.confidence,
    evidence_score: wowAudit.evidence_score,
    metrics: wowAudit.metrics,
    density_review: wowAudit.density_review,
    audited_at: new Date().toISOString()
  };
}

async function main() {
  console.log('================================================================');
  console.log('UNIVERSAL SYNTROPIC INVARIANT VERIFIER (SIV) v2');
  console.log('Multi-Game Kinematic & Behavioral Anti-Cheat Framework');
  console.log('Profiles: World of Warcraft | GTA 6 / FiveM | Tactical Shooters');
  console.log('================================================================\n');

  console.log('[Scenario 1: Empty Sessions (Zero False Certainty)]');
  for (const prof of ['wow', 'gta6', 'fps']) {
    const res = runUniversalAudit({ profile: prof, sessionData: {} });
    console.log(`  Profile [${prof}]: Verdict=${res.overall_verdict}, Confidence=${res.confidence}, Evidence=${res.evidence_score}`);
  }
  console.log();

  console.log('[Scenario 2: GTA 6 Legal vs Injected Handling]');
  const gtaAudit = runUniversalAudit({
    profile: 'gta6',
    sessionData: {
      vehicleTelemetry: [
        { t: 0, speedMps: 30, z: 10 },
        { t: 100, speedMps: 45, z: 10 },
        { t: 200, speedMps: 60, z: 10 }
      ],
      aimVectors: [
        { t: 0, yaw: 10.0, pitch: 0.0 },
        { t: 50, yaw: 12.0, pitch: 0.5 },
        { t: 100, yaw: 14.5, pitch: 0.8 }
      ]
    }
  });
  console.log(`GTA 6 Verdict: ${gtaAudit.overall_verdict} (Confidence: ${gtaAudit.confidence})`);
  console.log(`• Vehicle Power: ${gtaAudit.vehicle_hamiltonian.basis}`);
  console.log(`• Aim Kinematics: ${gtaAudit.aim_kinematics.basis}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(console.error);
}
