/**
 * M01 · T4 — the cockpit channel, layout and rig, as pure numbers.
 *
 * Run with: `node --import tsx --test tests/cockpit.test.ts` (also registered in scripts/check.mjs).
 *
 * There is no WebGL in this sandbox, so the cockpit's correctness is expressed as arithmetic and as
 * facts about the finished PNGs: the dials must map their range onto the sweep the painted face
 * prints, the hands must stay on the yoke grips at every angle, the shoulders must leave the bottom
 * of the screen, the painted aperture must match the frozen D3 rectangle, and every art file the
 * HUD loads must exist and decode as a 2×2 sprite sheet where it is supposed to be one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  APERTURE_FRACTION, BOB_MAX_PX, COCKPIT_ART, COCKPIT_ART_PATHS, COCKPIT_MANIFEST,
  ARM_FIST_TO_SLEEVE, VZ_MAX, YOKE_MAX_DEG, armsAt, cockpitBob, cockpitLayout, createCockpitState, gripPoints,
  needleAngle, steerFrom, yokeAngleDeg,
} from '../src/game/cockpit';
import { DEFAULT_OPTIONS, type GameOptions } from '../src/game/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicFile = (url: string) => join(root, 'public', url.replace(/^\//, ''));
/** PNG header: the width and height live in the IHDR chunk at bytes 16..24. */
function pngSize(path: string) {
  const buffer = readFileSync(path);
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${path} must be a PNG`);
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

test('needle mapping: the ends are the sweep ends, and values clamp outside the range', () => {
  assert.equal(needleAngle(0, 0, 360, 240), -120);
  assert.equal(needleAngle(360, 0, 360, 240), 120);
  assert.equal(needleAngle(180, 0, 360, 240), 0);
  assert.equal(needleAngle(-50, 0, 360, 240), -120, 'below the range clamps');
  assert.equal(needleAngle(5000, 0, 360, 240), 120, 'above the range clamps');
  assert.equal(needleAngle(Number.NaN, 0, 360, 240), 0, 'NaN cannot rotate a needle');
  // Symmetric ranges (the inclinometer and the small dials) put zero at the top.
  assert.equal(needleAngle(0, -30, 30, 220), 0);
  assert.equal(needleAngle(-30, -30, 30, 220), -110);
});

test('steer and yoke law: full lock is ±38°, and the sign matches the lane axis', () => {
  assert.equal(steerFrom(0, 1), 0);
  assert.equal(steerFrom(-VZ_MAX, 1), 1, '‑z is the far lanes, so it steers clockwise');
  assert.equal(steerFrom(VZ_MAX, 1), -1);
  assert.equal(steerFrom(-VZ_MAX * 4, 1), 1, 'the clamp holds past the limit');
  assert.equal(steerFrom(320, 0.5), -0.9846153846153847, 'handling scales the same way the physics does');
  assert.equal(yokeAngleDeg(steerFrom(-VZ_MAX, 1)), YOKE_MAX_DEG);
  assert.equal(yokeAngleDeg(steerFrom(VZ_MAX, 1)), -YOKE_MAX_DEG);
  assert.equal(yokeAngleDeg(Number.NaN), 0);
  assert.equal(Object.is(yokeAngleDeg(0), -0), false, 'zero steering is +0, so CSS never sees -0deg');
});

test('layout: the painted aperture is the frozen D3 rectangle at every viewport', () => {
  // D3 froze x 7..93 %, y 6..62 % of the viewport; the bezel is warped onto exactly that, so the
  // measured fractions and the decision must agree to within a pixel of rounding.
  assert.ok(Math.abs(APERTURE_FRACTION.x - 0.07) < 0.002, `x ${APERTURE_FRACTION.x}`);
  assert.ok(Math.abs(APERTURE_FRACTION.y - 0.06) < 0.002, `y ${APERTURE_FRACTION.y}`);
  assert.ok(Math.abs((APERTURE_FRACTION.w + APERTURE_FRACTION.x) - 0.93) < 0.003, 'right edge');
  assert.ok(Math.abs((APERTURE_FRACTION.h + APERTURE_FRACTION.y) - 0.62) < 0.003, 'bottom edge');
  for (const [w, h] of [[1280, 720], [1920, 1080], [3840, 2160]] as const) {
    const layout = cockpitLayout(w, h);
    assert.ok(layout.aperture.x > 0 && layout.aperture.y > 0, 'the aperture is inside the viewport');
    assert.ok(layout.aperture.x + layout.aperture.w < w, `${w}: right edge inside`);
    assert.ok(layout.aperture.y + layout.aperture.h < h, `${w}: bottom edge inside`);
    assert.equal(layout.horizonY, layout.aperture.y + layout.aperture.h / 2, 'the horizon is the aperture centre');
    assert.ok(layout.yoke.hub.y > layout.aperture.y + layout.aperture.h, `${w}: the yoke sits under the window`);
    assert.ok(layout.yoke.hub.y < h, `${w}: the yoke hub is on screen`);
    assert.ok(layout.clusters.left.w > 0 && layout.clusters.right.x > layout.clusters.left.x, `${w}: clusters`);
  }
});

test('the hands stay on the grips, and both arms leave through the bottom edge', () => {
  const anchor = COCKPIT_MANIFEST.arm.gripFraction;
  for (const [w, h] of [[1280, 720], [1920, 1080], [3840, 2160]] as const) {
    const layout = cockpitLayout(w, h);
    for (let steer = -1; steer <= 1.0001; steer += 0.25) {
      const yokeDeg = yokeAngleDeg(steer);
      const grips = gripPoints(layout, yokeDeg);
      const arms = armsAt(layout, yokeDeg);
      for (const [side, pose] of [['left', arms.left], ['right', arms.right]] as const) {
        // The hand is the CSS rotation origin, so it lands on the grip exactly — at any angle.
        const handX = pose.x + anchor.x * pose.w;
        const handY = pose.y + anchor.y * pose.h;
        assert.ok(Math.abs(handX - pose.grip.x) < 0.5, `${w}x${h} ${side} @${yokeDeg.toFixed(0)}°: hand x ${handX.toFixed(2)} vs grip ${pose.grip.x.toFixed(2)}`);
        assert.ok(Math.abs(handY - pose.grip.y) < 0.5, `${w}x${h} ${side} @${yokeDeg.toFixed(0)}°: hand y`);
        assert.ok(Math.abs(pose.grip.x - (side === 'left' ? grips.left.x : grips.right.x)) < 1e-9, 'the grip is the yoke grip');
        // The shoulder is below the viewport, so the arm cannot end in mid-air on screen.
        assert.ok(pose.shoulder.y > h, `${w}x${h} ${side}: shoulder y ${pose.shoulder.y} must be below ${h}`);
        // And the painted sleeve is long enough to reach it (measured from the finished PNG: the
        // limb runs from the fist to 95.9 % of the sprite height).
        const drawn = pose.h * (ARM_FIST_TO_SLEEVE);
        assert.ok(drawn >= Math.hypot(pose.shoulder.x - pose.grip.x, pose.shoulder.y - pose.grip.y) - 2,
          `${w}x${h} ${side}: the sleeve is shorter than the arm`);
        assert.ok(pose.w > 0 && pose.h > 0 && Number.isFinite(pose.rotDeg), `${w}x${h} ${side}: finite pose`);
      }
      // Full lock rotates the grips by the yoke angle, not by a re-derived one.
      assert.ok(Math.abs(arms.left.rotDeg - arms.right.rotDeg) > 0.01, 'the two arms are not parallel');
    }
  }
  // Mirroring is a CSS concern: both poses come from one image, so the flag must be explicit.
  const layout = cockpitLayout(1920, 1080);
  const arms = armsAt(layout, 0);
  assert.equal(arms.left.mirrored, true, 'the left arm mirrors the one painted arm');
  assert.equal(arms.right.mirrored, false);
});

test('bob is speed-driven, grounded-only, and gone under reduced motion', () => {
  let peak = 0;
  for (let t = 0; t < 2; t += 0.01) peak = Math.max(peak, Math.abs(cockpitBob(360, true, false, t)));
  assert.ok(peak <= BOB_MAX_PX + 1e-9, `bob peaked at ${peak}`);
  assert.ok(peak > BOB_MAX_PX * 0.9, 'the bob actually reaches its amplitude at top speed');
  assert.equal(cockpitBob(360, true, true, 1.234), 0, 'reduced motion disables the bob');
  assert.equal(cockpitBob(360, false, false, 1.234), 0, 'airtime is not vibration');
  assert.equal(cockpitBob(0, true, false, 1.234), 0, 'a stopped ball does not bob');
});

test('the channel starts clean and carries the field names the HUD reads', () => {
  const state = createCockpitState();
  assert.deepEqual(Object.keys(state).sort(), [
    'boostCharges', 'bounceCharges', 'countdownLabel', 'gradePct', 'grounded', 'inLoop',
    'position', 'pushing', 'raceTime', 'shieldSeconds', 'speedKmh', 'status', 'steer',
  ]);
  assert.equal(state.steer, 0);
  assert.equal(state.pushing, false);
  assert.equal(Object.is(state.steer, -0), false);
});

test('every cockpit image exists, at the size the manifest promises', () => {
  assert.equal(COCKPIT_ART_PATHS.length, 9, 'nine images: bezel, yoke, arm, starter, strip, 2 clusters, 2 dials');
  for (const url of COCKPIT_ART_PATHS) {
    const path = publicFile(url);
    assert.ok(existsSync(path), `${url} must exist`);
    const { w, h } = pngSize(path);
    assert.ok(w > 32 && h > 32, `${url} must be real art (${w}x${h})`);
  }
  const bezel = pngSize(publicFile(COCKPIT_ART.bezel));
  assert.deepEqual(bezel, { w: COCKPIT_MANIFEST.bezel.w, h: COCKPIT_MANIFEST.bezel.h }, 'the bezel is the measured size');
  const yoke = pngSize(publicFile(COCKPIT_ART.yoke));
  assert.deepEqual(yoke, { w: COCKPIT_MANIFEST.yoke.w, h: COCKPIT_MANIFEST.yoke.h });
  const starter = pngSize(publicFile(COCKPIT_ART.starter));
  assert.equal(starter.w, starter.h, 'the starter sheet is square (2x2)');
  assert.equal(starter.w, COCKPIT_MANIFEST.starter.sheet);
  // The dial holes the generator left in each plate must be measured, two per cluster.
  for (const cluster of COCKPIT_MANIFEST.clusters) {
    assert.equal(cluster.dials.length, 2, `${cluster.file}: two dial holes`);
    for (const dial of cluster.dials) {
      assert.ok(dial.r > 20 && dial.cx > dial.r && dial.cy > 0, `${cluster.file}: dial geometry`);
      assert.ok(dial.cx + dial.r < cluster.w + 1 && dial.cy + dial.r < cluster.h + 1, `${cluster.file}: the hole is inside the plate`);
    }
  }
});

test('the cockpit is a camera mode, and it is the default', () => {
  const mode: GameOptions['cameraMode'] = 'first_person';
  assert.equal(DEFAULT_OPTIONS.cameraMode, mode, 'the game opens in the cockpit');
});
