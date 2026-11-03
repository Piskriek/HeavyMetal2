import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateKinematicFTLE, evaluateReactionTime, evaluateApmEntropy, auditWoWSession } from '../src/wow_anticheat.mjs';

test('Kinematic FTLE detects speedhack / teleport divergence while passing smooth trajectories', () => {
  const smoothTrajectory = [
    { t: 0, x: 100.0, y: 200.0, z: 0, speed: 7.0 },
    { t: 100, x: 100.7, y: 200.0, z: 0, speed: 7.0 },
    { t: 200, x: 101.4, y: 200.0, z: 0, speed: 7.0 },
    { t: 300, x: 102.1, y: 200.0, z: 0, speed: 7.0 }
  ];
  const smoothRes = evaluateKinematicFTLE(smoothTrajectory);
  assert.equal(smoothRes.anomaly, false);
  assert.ok(smoothRes.ftle <= 0.025);

  const speedhackTrajectory = [
    { t: 0, x: 100.0, y: 200.0, z: 0, speed: 7.0 },
    { t: 100, x: 100.7, y: 200.0, z: 0, speed: 7.0 },
    { t: 200, x: 180.0, y: 350.0, z: 0, speed: 45.0 } // Sudden teleport / speedhack
  ];
  const hackRes = evaluateKinematicFTLE(speedhackTrajectory);
  assert.equal(hackRes.anomaly, true);
  assert.ok(hackRes.ftle > 0.05);
});

test('Neuromuscular reaction evaluation distinguishes human response from robotic auto-kick', () => {
  const humanInterrupt = [{ castId: '1', spellName: 'Kick', reactionTimeMs: 240.0 }];
  const humanRes = evaluateReactionTime(humanInterrupt);
  assert.equal(humanRes.verdict, 'human_reflex');
  assert.equal(humanRes.inhumanKicksCount, 0);

  const botInterrupt = [{ castId: '2', spellName: 'Kick', reactionTimeMs: 22.0 }];
  const botRes = evaluateReactionTime(botInterrupt);
  assert.equal(botRes.verdict, 'robotic_injection');
  assert.equal(botRes.inhumanKicksCount, 1);
});

test('APM entropy evaluation flags zero-variance rotation botting while approving organic play', () => {
  const organicIntervals = [1200, 1450, 1100, 1600, 1350, 1500, 1250, 1800];
  const organicRes = evaluateApmEntropy(organicIntervals);
  assert.equal(organicRes.isBottingPattern, false);
  assert.ok(organicRes.entropy > 0.5);

  const botIntervals = [1000, 1000, 1000, 1000, 1000, 1000, 1000];
  const botRes = evaluateApmEntropy(botIntervals);
  assert.equal(botRes.isBottingPattern, true);
  assert.equal(botRes.entropy, 0);
});

test('7-Density Session Audit compiles complete evaluation across D1..D7 with zero lies', () => {
  const session = auditWoWSession({
    trajectory: [
      { t: 0, x: 10, y: 10, speed: 7 },
      { t: 100, x: 10.7, y: 10, speed: 7 },
      { t: 200, x: 11.4, y: 10, speed: 7 }
    ],
    interrupts: [{ castId: 'k1', spellName: 'Pummel', reactionTimeMs: 195.0 }],
    castIntervals: [1100, 1300, 1250, 1400, 1150, 1500],
    character: 'SyntropicWarrior'
  });

  assert.equal(session.overall_verdict, 'VERIFIED_HUMAN_FLOW');
  assert.equal(session.density_review.length, 7);
  assert.equal(session.density_review[0].rung, 'D1');
  assert.equal(session.density_review[6].rung, 'D7');
});
