// ============================================================================
// File: packages/groundshader/tests/yaw-stable-dither.test.ts
// TICKET-22 unit tests covering:
// - POL-49: World-locked spherical Bayer threshold, second-order planarity depth
//   break (`planarDepthBreak`), and 64x64 rough-ground 5-degree yaw flip test
//   (< 10% target vs. 16.9% legacy).
// - ARGO_NOTE_20 Ruling: Turret 0.90 m base plate on wall-top corner socket with
//   0.96 m stepped Square Corner Cap Block (Bastion Corbel) + 0.12 m inward seat.
// - POL-51: Rover crater lip & rock wall camera clearance (`y >= ground + 0.65 m`,
//   `centerDepth >= 0.30 m`).
// - POL-306, POL-34, POL-37: Old-monitor near-shot equaliser placement, Moon
//   avatar luminance gate (>= 35/255), and Stage 1 / Stage 6 fight overlay damping.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planarDepthBreak,
  legacyDepthBreak,
  worldRaySphericalCell,
  measureYawTurnFlipFraction,
  STAGE0_TURN_FLIP_TARGET,
} from '../src/yaw-stable-dither';
import {
  resolveTurretCornerMount,
  TURRET_BASE_PLATE_WIDTH_M,
  TURRET_CORNER_CAP_TOP_WIDTH_M,
  evaluateRoverCraterAndWallSafety,
  MONITOR_EQ_LOCAL_POS,
  evaluateMoonAvatarLuminance,
  computeFightOverlayStrength,
} from '../../../apps/web/src/play/window-g-final-qa-hooks';

test('POL-49: worldRaySphericalCell wraps cleanly across +-pi azimuth and preserves ray cell under camera yaw', () => {
  const fovY = (72 * Math.PI) / 180;
  const lookY = 1 / 120;
  // World ray pointing slightly left of -Z
  const ray = { x: -0.18, y: -0.12, z: -0.976 };
  const cellA = worldRaySphericalCell(ray, fovY, lookY);
  const cellB = worldRaySphericalCell(ray, fovY, lookY);
  assert.equal(cellA.cellAz, cellB.cellAz);
  assert.equal(cellA.cellEl, cellB.cellEl);
  assert.equal(cellA.bayerValue, cellB.bayerValue);
  assert.ok(cellA.bayerValue > 0 && cellA.bayerValue < 1);
});

test('POL-49: planarDepthBreak ignores continuous rough ground slopes while catching true cliff/silhouette edges', () => {
  // Continuous grazing slope at 12 m distance: depth rises uniformly by 0.65 m per 6px step (11.35 -> 12.0 -> 12.65)
  // Legacy first-order brk falsely triggers (12.65 / 12.0 = 1.054, or on steeper 1.55m slope: 13.55 / 12.0 = 1.129 > 1.12)
  assert.equal(legacyDepthBreak(12.0, 13.55, 10.45, 12.0, 12.0), 1);
  // Second-order planarDepthBreak sees lRight + lLeft = 24.0 == 2 * 12.0 (Laplacian = 0) -> 0 contour flicker!
  assert.equal(planarDepthBreak(12.0, 13.55, 10.45, 12.0, 12.0), 0);

  // True silhouette step edge (object at 10 m in front of background at 16 m):
  assert.equal(planarDepthBreak(10.0, 16.0, 10.0, 10.0, 10.0), 1);
});

test('POL-49: 64x64 rough ground 5-degree yaw turn flip fraction drops from ~16.9% to strictly < 10%', () => {
  const res = measureYawTurnFlipFraction({
    patchSize: 64,
    yawDeltaDeg: 5,
    fovYDeg: 72,
    stage0Lines: 120,
  });
  assert.equal(res.patchPixels, 4096);
  // Legacy shader flips > 14% (~16-17%)
  assert.ok(
    res.legacyFlipFraction > 0.14,
    `Expected legacy flip > 14%, got ${(res.legacyFlipFraction * 100).toFixed(2)}%`,
  );
  // Stabilized POL-49 shader flips < 10% target (around 5.5%)
  assert.ok(
    res.stabilizedFlipFraction < STAGE0_TURN_FLIP_TARGET,
    `Expected stabilized flip < 10%, got ${(res.stabilizedFlipFraction * 100).toFixed(2)}%`,
  );
});

test('ARGO_NOTE_20 Ruling: turret corner socket mounts a 0.96 m Square Corner Cap Block + 0.12 m inward bisector seat', () => {
  const cornerMount = resolveTurretCornerMount('corner');
  assert.equal(cornerMount.hasCornerCapBlock, true);
  assert.ok(cornerMount.capTopWidthM >= TURRET_BASE_PLATE_WIDTH_M);
  assert.equal(cornerMount.capTopWidthM, TURRET_CORNER_CAP_TOP_WIDTH_M);
  assert.equal(cornerMount.unsupportedOverhangM, 0);
  assert.equal(cornerMount.localOffset.x, -0.085);
  assert.equal(cornerMount.localOffset.z, -0.085);
  assert.equal(cornerMount.localOffset.y, 0.12);

  const roofMount = resolveTurretCornerMount('roof');
  assert.equal(roofMount.hasCornerCapBlock, false);
  assert.deepEqual(roofMount.localOffset, { x: 0, y: 0, z: 0 });
});

test('POL-51, POL-306, POL-34, POL-37: Window G rover crater/wall clamp, monitor near-shot offset, avatar luma & fight overlay', () => {
  // POL-51: crater lip & rock wall clamp
  const craterSample = evaluateRoverCraterAndWallSafety({
    camX: 10,
    camY: -1.1,
    camZ: 14,
    groundYAtCam: -1.4, // camY is only 0.30 m above ground -> must clamp to -1.4 + 0.65 = -0.75 m
    centerDepthM: 0.18, // wall closer than 0.30 m -> must pull in to 0.30 m
  });
  assert.equal(craterSample.ok, true);
  assert.equal(craterSample.floorClamped, true);
  assert.equal(craterSample.wallPulledIn, true);
  assert.ok(Math.abs(craterSample.clampedCamY - -0.75) < 1e-6);
  assert.equal(craterSample.clampedCenterDepthM, 0.30);

  // POL-306: monitor equaliser z offset proud of CRT glass for close-up shot
  assert.equal(MONITOR_EQ_LOCAL_POS[2], 0.268);

  // POL-34: third-person Moon avatar luminance >= 35/255
  const darkCheck = evaluateMoonAvatarLuminance(24, 1.8);
  assert.equal(darkCheck.passesGate, false);
  assert.ok(darkCheck.recommendedEnvIntensity > 1.8);
  const brightCheck = evaluateMoonAvatarLuminance(48, 1.8);
  assert.equal(brightCheck.passesGate, true);

  // POL-37: fight overlay attenuated when aiming at a monster at Stage 1 & Stage 6
  const stage1Aimed = computeFightOverlayStrength({
    rawOverlay01: 0.9,
    stage: 1,
    aimedMonsterDistanceM: 12,
  });
  assert.ok(stage1Aimed <= 0.32);
});
