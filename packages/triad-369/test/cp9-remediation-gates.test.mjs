import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateKinematicFTLE,
  evaluateReactionTime,
  evaluateShannonEntropy,
  validateHardwareScanCodes,
  validateTerrainCollision,
  validateRaidCombatLogSync,
  auditWoWSession
} from '../src/wow_anticheat.mjs';
import {
  evaluateGtaVehicleHamiltonian,
  evaluateAimAngularKinematics,
  normalizeShortestAngleDeg,
  runUniversalAudit
} from '../src/universal_anticheat.mjs';
import {
  parseLuaSource,
  normalizeSavedVariables,
  auditSavedVariablesFile
} from '../src/wow_adapter.mjs';

// GATE 1: FIX-P1-01
test('FIX-P1-01: Universal entry point gates empty sessions with INSUFFICIENT_EVIDENCE & zero confidence', () => {
  for (const profile of ['wow', 'gta6', 'fps']) {
    const res = runUniversalAudit({ profile, sessionData: {} });
    assert.equal(res.overall_verdict, 'INSUFFICIENT_EVIDENCE', `Failed for profile ${profile}`);
    assert.equal(res.confidence, 0.0, `Confidence must be 0.0 for empty ${profile} session`);
  }
});

// GATE 2: FIX-P1-02
test('FIX-P1-02: Invalid WoW inputs (identical timestamps, zero intervals) return 0/3 evidence score & INSUFFICIENT_EVIDENCE', () => {
  const malformed = auditWoWSession({
    trajectory: [
      { t: 100, x: 1.0, y: 1.0 },
      { t: 100, x: 1.0, y: 1.0 },
      { t: 100, x: 1.0, y: 1.0 }
    ],
    castIntervals: [0, 0, 0, 0, 0]
  });
  assert.equal(malformed.overall_verdict, 'INSUFFICIENT_EVIDENCE');
  assert.equal(malformed.confidence, 0.0);
  assert.equal(malformed.evidence_score, '0/3');
});

// GATE 3: FIX-P1-03
test('FIX-P1-03: D1, D5, D6 honesty pipelines default to unverified and D7 to untested when unperformed', () => {
  const emptyReview = auditWoWSession();
  const d1 = emptyReview.density_review.find(r => r.rung === 'D1');
  const d5 = emptyReview.density_review.find(r => r.rung === 'D5');
  const d6 = emptyReview.density_review.find(r => r.rung === 'D6');
  const d7 = emptyReview.density_review.find(r => r.rung === 'D7');

  assert.equal(d1.status, 'unverified');
  assert.equal(d5.status, 'unverified');
  assert.equal(d6.status, 'unverified');
  assert.equal(d7.status, 'untested');

  // Passing empty arrays must still remain unverified
  assert.equal(validateHardwareScanCodes([]).status, 'unverified');
  assert.equal(validateTerrainCollision([], { bounds: [0, 100, 0, 100] }).status, 'unverified');
  assert.equal(validateRaidCombatLogSync([]).status, 'unverified');
});

// GATE 4: FIX-P1-04
test('FIX-P1-04: Opt-in gate stops all telemetry collection & SavedVariables updates when optIn = false', () => {
  const optedOutLua = `
FidelityWoW_Config = { ["enabled"] = true, ["optIn"] = false }
FidelityWoW_Export = { ["castIntervals"] = { 1200, 1300 } }
`;
  const res = auditSavedVariablesFile(optedOutLua);
  assert.equal(res.overall_verdict, 'OPT_IN_REQUIRED');
  assert.equal(res.confidence, 0.0);
  assert.equal(res.evidence_score, '0/3');
});

// GATE 5: FIX-P1-05
test('FIX-P1-05: FPS aim kinematics shortest-arc angle wrapping eliminates false 358° aimbot snap on 179° to -179° turn', () => {
  assert.equal(normalizeShortestAngleDeg(-179 - 179), 2);
  assert.equal(normalizeShortestAngleDeg(179 - (-179)), -2);

  const wrapAim = [
    { t: 0, yaw: 179.0, pitch: 0.0 },
    { t: 10, yaw: -179.0, pitch: 0.5 }
  ];
  const aimRes = evaluateAimAngularKinematics(wrapAim);
  assert.equal(aimRes.verdict, 'ORGANIC_HUMAN_AIM');
  assert.equal(aimRes.status, 'smooth_human_steering');
  assert.equal(aimRes.instantLockCount, 0);
});

// GATE 6: FIX-P1-06
test('FIX-P1-06: Rotation entropy window clamps out-of-combat pauses and conditional entropy catches deterministic loops', () => {
  // Long pauses outside [200ms, 3500ms] do not collapse into false bot accusations
  const longPauses = [3000, 4000, 5000, 6000, 7000];
  const pauseRes = evaluateShannonEntropy(longPauses);
  assert.equal(pauseRes.status, 'insufficient_valid_data');
  assert.equal(pauseRes.isBottingPattern, null);

  // Alternating deterministic macro [1000, 1500, 1000, 1500...] caught by conditional transition entropy
  const macroPattern = [1000, 1500, 1000, 1500, 1000, 1500, 1000, 1500, 1000, 1500];
  const macroRes = evaluateShannonEntropy(macroPattern);
  assert.equal(macroRes.isBottingPattern, true);
  assert.equal(macroRes.status, 'deterministic_botting_pattern');
  assert.ok(macroRes.conditionalEntropyBits < 0.10);
});

// GATE 7: FIX-P1-07
test('FIX-P1-07: WoW adapter Lua parser normalizes trajectory and separates movement state changes from coordinates', () => {
  const luaSample = `
FidelityWoW_Config = { ["enabled"] = true, ["optIn"] = true }
FidelityWoW_Telemetry = { ["character"] = "Thrall", ["realm"] = "Orgrimmar" }
FidelityWoW_Export = {
    ["trajectories"] = {
        { ["t"] = 100, ["state"] = "START", ["speed"] = 7.0 },
        { ["t"] = 200, ["x"] = 50.0, ["y"] = 60.0, ["speed"] = 7.0 },
        { ["t"] = 300, ["x"] = 50.7, ["y"] = 60.0, ["speed"] = 7.0 },
        { ["t"] = 400, ["x"] = 51.4, ["y"] = 60.0, ["speed"] = 7.0 },
        { ["t"] = 500, ["state"] = "STOP", ["speed"] = 0.0 },
    },
    ["interrupts"] = {
        { ["reactionTimeMs"] = 195.0, ["confirmedInterrupt"] = true, ["spellName"] = "Wind Shear" }
    },
    ["castIntervals"] = { 1100, 1300, 1250, 1400, 1350 }
}
`;
  const parsed = parseLuaSource(luaSample);
  const normalized = normalizeSavedVariables(parsed);

  assert.equal(normalized.isOptedIn, true);
  // Coordinates isolated into trajectory (3 points)
  assert.equal(normalized.sessionData.trajectory.length, 3);
  // State changes isolated into movementEvents (2 events)
  assert.equal(normalized.movementEvents.length, 2);
  assert.equal(normalized.movementEvents[0].state, 'START');
  assert.equal(normalized.movementEvents[1].state, 'STOP');

  // Normalized [0..1] map coordinates without scale metadata return insufficient_scale_metadata
  const unscaledLua = `
FidelityWoW_Config = { ["optIn"] = true }
FidelityWoW_Export = {
    ["trajectory"] = {
        { ["t"] = 100, ["x"] = 0.451, ["y"] = 0.523 },
        { ["t"] = 200, ["x"] = 0.452, ["y"] = 0.523 },
        { ["t"] = 300, ["x"] = 0.453, ["y"] = 0.523 }
    }
}
`;
  const unscaledParsed = parseLuaSource(unscaledLua);
  const unscaledNorm = normalizeSavedVariables(unscaledParsed);
  assert.equal(unscaledNorm.sessionData.trajectory[0].scaleStatus, 'insufficient_scale_metadata');
  const ftleUnscaled = evaluateKinematicFTLE(unscaledNorm.sessionData.trajectory);
  assert.equal(ftleUnscaled.status, 'insufficient_scale_metadata');

  // When map scale is supplied (e.g. 1000 yards zone size), converts to yards
  const scaledNorm = normalizeSavedVariables(unscaledParsed, { mapScaleYards: 1000 });
  assert.equal(scaledNorm.sessionData.trajectory[0].scaleStatus, 'converted_to_yards');
  assert.equal(scaledNorm.sessionData.trajectory[0].x, 451);
  const ftleScaled = evaluateKinematicFTLE(scaledNorm.sessionData.trajectory);
  assert.equal(ftleScaled.status, 'conforming_physical_spline');
});

// GATE 8: FIX-P2-08
test('FIX-P2-08: Reaction evaluation excludes confirmedInterrupt: false and distinguishes reflex from predictive cadence', () => {
  // unconfirmed interrupt is ignored
  const unconfirmed = evaluateReactionTime([{ reactionTimeMs: 40.0, confirmedInterrupt: false }]);
  assert.equal(unconfirmed.verdict, 'untested');
  assert.equal(unconfirmed.status, 'invalid_data');

  // Mix of 80ms and 200ms returns predictive_cadence without contradiction
  const mixed = evaluateReactionTime([
    { reactionTimeMs: 80.0, confirmedInterrupt: true },
    { reactionTimeMs: 200.0, confirmedInterrupt: true }
  ]);
  assert.equal(mixed.verdict, 'predictive_cadence');
  assert.equal(mixed.status, 'predictive_timing_observed');
  assert.equal(mixed.predictiveCount, 1);
  assert.equal(mixed.reflexCount, 1);
  assert.equal(mixed.inhumanKicksCount, 0);
});

// GATE 9: FIX-P2-09
test('FIX-P2-09: Empirical invariant labels report kinematic spline conformance & engine power limits', () => {
  // WoW spline prediction error heuristic proxy
  const smooth = [
    { t: 0, x: 100, y: 100, speed: 7 },
    { t: 100, x: 100.7, y: 100, speed: 7 },
    { t: 200, x: 101.4, y: 100, speed: 7 }
  ];
  const ftleRes = evaluateKinematicFTLE(smooth);
  assert.equal(ftleRes.status, 'conforming_physical_spline');
  assert.ok(ftleRes.basis.includes('spline prediction-error'));

  // GTA vehicle power limits: accelerating from 30 to 32 m/s within engine capacity
  const vehicle = [
    { t: 0, speedMps: 30.0, z: 10.0 },
    { t: 500, speedMps: 32.0, z: 10.0 }
  ];
  const gtaRes = evaluateGtaVehicleHamiltonian(vehicle);
  assert.equal(gtaRes.status, 'power_within_engine_limits');
  assert.equal(gtaRes.verdict, 'CONFORMING_PHYSICS');

  // GTA unpowered energy gain: +93,000 J gain with throttle = 0 fails conservation of energy
  const unpoweredSpike = [
    { t: 0, speedMps: 0.0, z: 0.0, throttle: 0 },
    { t: 1000, speedMps: 11.135, z: 0.0, throttle: 0 } // 0.5 * 1500 * (11.135^2) ≈ 93,000 J
  ];
  const unpoweredRes = evaluateGtaVehicleHamiltonian(unpoweredSpike, 1500, 600000);
  assert.equal(unpoweredRes.verdict, 'ANOMALY_DETECTED');
  assert.equal(unpoweredRes.status, 'vehicle_handling_or_speed_injection');
  assert.ok(unpoweredRes.energyAnomalies > 0);
});

