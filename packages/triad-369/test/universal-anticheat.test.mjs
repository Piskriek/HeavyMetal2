import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGtaVehicleHamiltonian,
  evaluateAimAngularKinematics,
  normalizeShortestAngleDeg,
  runUniversalAudit
} from '../src/universal_anticheat.mjs';

test('GTA 6 Vehicle Hamiltonian detects impossible acceleration power spikes', () => {
  // Realistic acceleration (30m/s to 32m/s in 500ms)
  const legalVehicle = [
    { t: 0, speedMps: 30.0, z: 10.0 },
    { t: 500, speedMps: 32.0, z: 10.0 }
  ];
  const legalRes = evaluateGtaVehicleHamiltonian(legalVehicle);
  assert.equal(legalRes.verdict, 'CONFORMING_PHYSICS');
  assert.equal(legalRes.status, 'power_within_engine_limits');
  assert.equal(legalRes.energyAnomalies, 0);

  // Speedhack (30m/s to 70m/s in 100ms)
  const hackVehicle = [
    { t: 0, speedMps: 30.0, z: 10.0 },
    { t: 100, speedMps: 70.0, z: 10.0 }
  ];
  const hackRes = evaluateGtaVehicleHamiltonian(hackVehicle);
  assert.equal(hackRes.verdict, 'ANOMALY_DETECTED');
  assert.equal(hackRes.status, 'vehicle_handling_or_speed_injection');
  assert.ok(hackRes.energyAnomalies > 0);
});

test('Aim kinematics detects 1-tick aimbot snap while passing smooth steering', () => {
  const smoothAim = [
    { t: 0, yaw: 10.0, pitch: 0.0 },
    { t: 50, yaw: 12.0, pitch: 0.5 },
    { t: 100, yaw: 14.0, pitch: 1.0 }
  ];
  const smoothRes = evaluateAimAngularKinematics(smoothAim);
  assert.equal(smoothRes.verdict, 'ORGANIC_HUMAN_AIM');
  assert.equal(smoothRes.instantLockCount, 0);

  // Instant snap: 45 degree yaw jump in 10ms
  const snapAim = [
    { t: 0, yaw: 10.0, pitch: 0.0 },
    { t: 10, yaw: 55.0, pitch: 20.0 }
  ];
  const snapRes = evaluateAimAngularKinematics(snapAim);
  assert.equal(snapRes.verdict, 'AIMBOT_SNAP_DETECTED');
  assert.ok(snapRes.instantLockCount > 0);
});

test('FPS yaw wrap normalizes shortest arc without false aimbot snap', () => {
  // Turning from 179° to -179° in 10ms is a 2° turn across the wrap boundary, NOT a 358° snap
  assert.equal(normalizeShortestAngleDeg(-179 - 179), 2);
  assert.equal(normalizeShortestAngleDeg(179 - (-179)), -2);

  const wrapAim = [
    { t: 0, yaw: 179.0, pitch: 0.0 },
    { t: 10, yaw: -179.0, pitch: 0.5 }
  ];
  const res = evaluateAimAngularKinematics(wrapAim);
  assert.equal(res.verdict, 'ORGANIC_HUMAN_AIM');
  assert.equal(res.instantLockCount, 0);
  assert.ok(res.maxAngularSpeedDegPerSec < 1000.0);
});

test('Universal audit gates empty sessions with INSUFFICIENT_EVIDENCE and zero confidence', () => {
  for (const prof of ['wow', 'gta6', 'fps']) {
    const emptyAudit = runUniversalAudit({ profile: prof, sessionData: {} });
    assert.equal(emptyAudit.overall_verdict, 'INSUFFICIENT_EVIDENCE');
    assert.equal(emptyAudit.confidence, 0.0);
  }
});

test('Universal audit runs across GTA 6 and FPS profiles with valid data', () => {
  const gtaAudit = runUniversalAudit({
    profile: 'gta6',
    sessionData: {
      vehicleTelemetry: [
        { t: 0, speedMps: 20, z: 5 },
        { t: 500, speedMps: 22, z: 5 }
      ],
      aimVectors: [
        { t: 0, yaw: 0, pitch: 0 },
        { t: 50, yaw: 1, pitch: 0 }
      ]
    }
  });
  assert.equal(gtaAudit.profile, 'gta6');
  assert.equal(gtaAudit.overall_verdict, 'VERIFIED_LEGAL_PHYSICS');
  assert.ok(gtaAudit.confidence > 0.5);

  const fpsAudit = runUniversalAudit({
    profile: 'fps',
    sessionData: {
      aimVectors: [
        { t: 0, yaw: 0, pitch: 0 },
        { t: 50, yaw: 2, pitch: 0.5 }
      ],
      triggerEvents: [{ reactionTimeMs: 190 }]
    }
  });
  assert.equal(fpsAudit.profile, 'fps');
  assert.equal(fpsAudit.overall_verdict, 'VERIFIED_HUMAN_AIM');
  assert.ok(fpsAudit.confidence > 0.5);
});
