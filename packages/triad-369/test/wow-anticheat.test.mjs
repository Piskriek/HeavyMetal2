import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateKinematicFTLE,
  evaluateReactionTime,
  evaluateShannonEntropy,
  auditWoWSession
} from '../src/wow_anticheat.mjs';

test('Kinematic FTLE detects speedhack and teleport divergence while passing smooth trajectories', () => {
  const smoothTrajectory = [
    { t: 0, x: 100.0, y: 200.0, z: 0, speed: 7.0 },
    { t: 100, x: 100.7, y: 200.0, z: 0, speed: 7.0 },
    { t: 200, x: 101.4, y: 200.0, z: 0, speed: 7.0 },
    { t: 300, x: 102.1, y: 200.0, z: 0, speed: 7.0 }
  ];
  const smoothRes = evaluateKinematicFTLE(smoothTrajectory);
  assert.equal(smoothRes.anomaly, false);
  assert.equal(smoothRes.status, 'conforming_physical_spline');
  assert.ok(smoothRes.ftle <= 0.010);

  // Speedhack sample (exceeds max speed on last sample)
  const speedhackTrajectory = [
    { t: 0, x: 100.0, y: 200.0, z: 0, speed: 7.0 },
    { t: 100, x: 100.7, y: 200.0, z: 0, speed: 7.0 },
    { t: 200, x: 180.0, y: 350.0, z: 0, speed: 1000.0 }
  ];
  const hackRes = evaluateKinematicFTLE(speedhackTrajectory);
  assert.equal(hackRes.anomaly, true);
  assert.equal(hackRes.status, 'kinematic_anomaly_detected');
  assert.ok(hackRes.speedViolations > 0);
});

test('Neuromuscular reaction evaluation distinguishes human response from robotic auto-kick', () => {
  const humanInterrupt = [{ castId: '1', spellName: 'Kick', reactionTimeMs: 240.0, confirmedInterrupt: true }];
  const humanRes = evaluateReactionTime(humanInterrupt);
  assert.equal(humanRes.verdict, 'human_reflex');
  assert.equal(humanRes.inhumanKicksCount, 0);
  assert.equal(humanRes.reflexCount, 1);

  const botInterrupt = [{ castId: '2', spellName: 'Kick', reactionTimeMs: 22.0, confirmedInterrupt: true }];
  const botRes = evaluateReactionTime(botInterrupt);
  assert.equal(botRes.verdict, 'robotic_injection');
  assert.equal(botRes.inhumanKicksCount, 1);

  // Invalid data does not receive human_reflex
  const invalidRes = evaluateReactionTime([{ castId: '3', reactionTimeMs: 'invalid' }]);
  assert.equal(invalidRes.verdict, 'untested');
  assert.equal(invalidRes.status, 'invalid_data');

  // confirmedInterrupt: false is ignored
  const unconfirmedRes = evaluateReactionTime([{ reactionTimeMs: 40.0, confirmedInterrupt: false }]);
  assert.equal(unconfirmedRes.verdict, 'untested');
  assert.equal(unconfirmedRes.status, 'invalid_data');

  // Mix of 80ms and 200ms returns predictive_cadence (not contradicted by human_reflex)
  const mixedRes = evaluateReactionTime([
    { reactionTimeMs: 80.0, confirmedInterrupt: true },
    { reactionTimeMs: 200.0, confirmedInterrupt: true }
  ]);
  assert.equal(mixedRes.verdict, 'predictive_cadence');
  assert.equal(mixedRes.status, 'predictive_timing_observed');
  assert.equal(mixedRes.predictiveCount, 1);
  assert.equal(mixedRes.reflexCount, 1);
  assert.equal(mixedRes.inhumanKicksCount, 0);
});

test('True Shannon entropy evaluation flags zero-variance rotation botting while approving organic play', () => {
  const organicIntervals = [1200, 1450, 1100, 1600, 1350, 1500, 1250, 1800, 1400, 1550];
  const organicRes = evaluateShannonEntropy(organicIntervals);
  assert.equal(organicRes.isBottingPattern, false);
  assert.ok(organicRes.entropyBits >= 0.80);

  const botIntervals = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000];
  const botRes = evaluateShannonEntropy(botIntervals);
  assert.equal(botRes.isBottingPattern, true);
  assert.equal(botRes.entropyBits, 0);

  // Overflow intervals [3000, 4000, 5000, 6000, 7000] do not collapse into false botting
  const longPauses = [3000, 4000, 5000, 6000, 7000];
  const pauseRes = evaluateShannonEntropy(longPauses);
  assert.equal(pauseRes.status, 'insufficient_valid_data');
  assert.equal(pauseRes.isBottingPattern, null);

  // Repeating macro pattern [1000, 1500, 1000, 1500...] caught by conditional transition entropy
  const macroPattern = [1000, 1500, 1000, 1500, 1000, 1500, 1000, 1500, 1000, 1500];
  const macroRes = evaluateShannonEntropy(macroPattern);
  assert.equal(macroRes.isBottingPattern, true);
  assert.ok(macroRes.conditionalEntropyBits < 0.10);
});

test('Empty or missing session data returns INSUFFICIENT_EVIDENCE with zero confidence', () => {
  const empty = auditWoWSession();
  assert.equal(empty.overall_verdict, 'INSUFFICIENT_EVIDENCE');
  assert.equal(empty.confidence, 0.0);
  assert.equal(empty.density_review[0].status, 'unverified');
  assert.equal(empty.density_review[4].status, 'unverified');
  assert.equal(empty.density_review[5].status, 'unverified');
});

test('Invalid WoW inputs (identical timestamps, zero intervals) return INSUFFICIENT_EVIDENCE with zero confidence', () => {
  const malformed = auditWoWSession({
    trajectory: [
      { t: 100, x: 1, y: 1 },
      { t: 100, x: 1, y: 1 },
      { t: 100, x: 1, y: 1 }
    ],
    castIntervals: [0, 0, 0, 0, 0]
  });
  assert.equal(malformed.overall_verdict, 'INSUFFICIENT_EVIDENCE');
  assert.equal(malformed.confidence, 0.0);
  assert.equal(malformed.evidence_score, '0/3');
});

test('7-Density Session Audit compiles complete evaluation across D1..D7 with evidence score', () => {
  const session = auditWoWSession({
    trajectory: [
      { t: 0, x: 10, y: 10, speed: 7 },
      { t: 100, x: 10.7, y: 10, speed: 7 },
      { t: 200, x: 11.4, y: 10, speed: 7 }
    ],
    interrupts: [{ castId: 'k1', spellName: 'Pummel', reactionTimeMs: 195.0, confirmedInterrupt: true }],
    castIntervals: [1100, 1300, 1250, 1400, 1150, 1500, 1350, 1200]
  });

  assert.equal(session.overall_verdict, 'VERIFIED_HUMAN_FLOW');
  assert.ok(session.confidence > 0.8);
  assert.equal(session.density_review.length, 7);
  assert.equal(session.density_review[1].status, 'conforming_physical_spline');
  assert.equal(session.density_review[2].status, 'neuromuscular_limits_verified');
});
