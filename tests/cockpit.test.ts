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
  needleAngle, steerFrom, yokeAngleDeg, CLUSTER_ASPECT,
} from '../src/game/cockpit';
import { DEFAULT_OPTIONS, type GameOptions } from '../src/game/types';
import { laneZ, PLAYER_LANE } from '../src/game/scene';

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
  // steerLeft (A) is changeLane(-1), which the engine turns into lane + 1, i.e. toward −z: a
  // negative vz. That is screen-left in both cameras, so it must be an anticlockwise yoke.
  assert.ok(laneZ(PLAYER_LANE + 1) < laneZ(PLAYER_LANE), 'A moves the ball toward −z');
  assert.equal(steerFrom(-VZ_MAX, 1), -1, 'steering left (−vz) turns the yoke anticlockwise');
  assert.equal(steerFrom(VZ_MAX, 1), 1);
  assert.equal(steerFrom(-VZ_MAX * 4, 1), -1, 'the clamp holds past the limit');
  assert.equal(steerFrom(320, 0.5), 0.9846153846153847, 'handling scales the same way the physics does');
  assert.equal(yokeAngleDeg(steerFrom(-VZ_MAX, 1)), -YOKE_MAX_DEG);
  assert.equal(yokeAngleDeg(steerFrom(VZ_MAX, 1)), YOKE_MAX_DEG);
  assert.equal(yokeAngleDeg(Number.NaN), 0);
  assert.equal(Object.is(yokeAngleDeg(0), -0), false, 'zero steering is +0, so CSS never sees -0deg');
});

test('layout: the painted aperture is the frozen D3 rectangle at every viewport', () => {
  // D3 froze x 7..93 %, y 6..62 % of the viewport; the bezel is warped onto exactly that, so the
  // measured fractions and the decision must agree to within a pixel of rounding.
  assert.ok(Math.abs(APERTURE_FRACTION.x - 0.07) < 0.002, `x ${APERTURE_FRACTION.x}`);
  assert.ok(Math.abs(APERTURE_FRACTION.y - 0.06) < 0.002, `y ${APERTURE_FRACTION.y}`);
  assert.ok(Math.abs((APERTURE_FRACTION.w + APERTURE_FRACTION.x) - 0.93) < 0.003, 'right edge');
  assert.ok(Math.abs((APERTURE_FRACTION.h + APERTURE_FRACTION.y) - 0.783) < 0.005, 'bottom edge');
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
    'boostAge', 'boostCharges', 'bounceCharges', 'countdownLabel', 'gapPlace', 'gapSeconds', 'gapTrend', 'gradePct', 'grounded', 'impact', 'impactSide', 'inLoop',
    'position', 'pushing', 'raceTime', 'shieldSeconds', 'speedKmh', 'status', 'steer',
  ]);
  assert.equal(state.steer, 0);
  assert.equal(state.pushing, false);
  assert.equal(Object.is(state.steer, -0), false);
});

test('every cockpit image exists, at the size the manifest promises', () => {
  assert.equal(COCKPIT_ART_PATHS.length, 25,
    '25 images: bezel, yoke, arm, starter, pool goblin, strip, 2 clusters, 2 dials, grime, 2 cracks, 2 needles, speed lines, 9 trinkets');
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
  // M01 · T2: the pool goblin is cut by the same code, so it is square in the same way.
  const poolGoblin = pngSize(publicFile(COCKPIT_ART.poolGoblin));
  assert.equal(poolGoblin.w, poolGoblin.h, 'the pool goblin sheet is square (2x2)');
  assert.equal(poolGoblin.w, COCKPIT_MANIFEST.poolGoblin.sheet);
  assert.equal(COCKPIT_MANIFEST.poolGoblin.picks.length, 4, 'four poses, one per cell');
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

test('layout: the gauge plates hang from the window bottom at every screen shape (no gap, no overlap)', () => {
  for (const [w, h] of [[1280, 720], [1920, 1080], [1440, 1080], [2560, 1080], [3840, 2160], [1024, 768]] as const) {
    const layout = cockpitLayout(w, h);
    const windowBottom = layout.aperture.y + layout.aperture.h;
    for (const side of ['left', 'right'] as const) {
      const c = layout.clusters[side];
      const gap = c.y - windowBottom;
      assert.ok(gap >= -4 && gap <= 1, `${w}×${h} ${side}: gap ${gap.toFixed(1)} px`);
      const bottom = c.y + c.w * CLUSTER_ASPECT[side];
      assert.ok(bottom <= h + 1, `${w}×${h} ${side}: plate stays on screen (${bottom.toFixed(1)})`);
      assert.ok(c.w <= w * 0.3 + 1e-9, `${w}×${h} ${side}: plate width capped`);
    }
    assert.ok(layout.clusters.left.x + layout.clusters.left.w < layout.clusters.right.x, `${w}×${h}: plates do not meet`);
    // At 16:9 the plates also reach the screen bottom (the band is filled).
    if (Math.abs(w / h - 16 / 9) < 0.01) {
      for (const side of ['left', 'right'] as const) {
        const c = layout.clusters[side];
        assert.ok(Math.abs(c.y + c.w * CLUSTER_ASPECT[side] - h) <= 2, `${w}×${h} ${side}: reaches the bottom`);
      }
    }
    for (const deg of [-YOKE_MAX_DEG, 0, YOKE_MAX_DEG]) {
      const arms = armsAt(layout, deg);
      for (const arm of [arms.left, arms.right]) assert.ok(arm.shoulder.y > h, `${w}×${h}: the arm runs off the bottom`);
    }
  }
});

test('the bezel backup no longer ships in public/', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  assert.equal(existsSync(join(root, 'public/art/cockpit/cockpit-bezel.backup.png')), false);
});

// P3: the arms flinch on a hit, pump on a boost and brace in the air, without the hands ever
// leaving the grips.
test('P3: every gesture keeps both hands on the grips and moves only the shoulders', async () => {
  const { driverGesture } = await import('../src/game/cockpit');
  const anchor = COCKPIT_MANIFEST.arm.gripFraction;
  const layout = cockpitLayout(1920, 1080);
  const rest = armsAt(layout, 0);
  for (const gesture of ['flinch', 'boost_pump', 'air_brace'] as const) {
    for (const t of [0, 0.13, 0.5]) {
      const arms = armsAt(layout, yokeAngleDeg(0.4), gesture, 1, t);
      const grips = gripPoints(layout, yokeAngleDeg(0.4));
      for (const [pose, grip] of [[arms.left, grips.left], [arms.right, grips.right]] as const) {
        assert.ok(Math.abs(pose.x + anchor.x * pose.w - grip.x) < 0.5 && Math.abs(pose.y + anchor.y * pose.h - grip.y) < 0.5, `${gesture}: hand on grip`);
        assert.ok(pose.shoulder.y > layout.h, `${gesture}: the shoulder stays off-screen`);
      }
    }
  }
  const flinch = armsAt(layout, 0, 'flinch', 1);
  assert.ok(flinch.left.shoulder.x < rest.left.shoulder.x && flinch.right.shoulder.x > rest.right.shoulder.x, 'a flinch flares the elbows out');
  assert.ok(flinch.left.shoulder.y > rest.left.shoulder.y, 'and pulls the arms back');
  const pump = armsAt(layout, 0, 'boost_pump', 1);
  assert.ok(pump.left.shoulder.y < rest.left.shoulder.y, 'a boost pushes the arms forward');
  const brace = armsAt(layout, 0, 'air_brace', 1);
  assert.ok(brace.left.shoulder.x > rest.left.shoulder.x, 'airtime locks the arms in');
  assert.deepEqual(armsAt(layout, 0, 'flinch', 0), rest, 'no intensity, no gesture');

  const base = { impact: 0, boostAge: 1e9, grounded: true, inLoop: false, status: 'flying' as const };
  assert.deepEqual(driverGesture({ ...base, impact: 0.8 }, false), { gesture: 'flinch', intensity: 0.8 });
  assert.equal(driverGesture({ ...base, boostAge: 0.15 }, false).gesture, 'boost_pump');
  assert.equal(driverGesture({ ...base, boostAge: 0.9 }, false).gesture, 'normal', 'the pump is over by 0.6 s');
  assert.equal(driverGesture({ ...base, grounded: false }, false).gesture, 'air_brace');
  assert.equal(driverGesture({ ...base, grounded: false, inLoop: true }, false).gesture, 'normal');
  assert.deepEqual(driverGesture({ ...base, impact: 1 }, true), { gesture: 'normal', intensity: 0 }, 'reduced motion: still arms');
});

// P2 & WIRE-3: glass in the cockpit window, and a spiderweb crack on a big hit that holds and then fades.
test('P2 & WIRE-3: a crack holds for 2 s, fades over 1.5 s, and is rotated toward impact side', async () => {
  const { CRACK_FADE_S, CRACK_HOLD_S, crackOpacity, crackTransform } = await import('../src/game/cockpit');
  assert.equal(crackOpacity(0), 1);
  assert.equal(crackOpacity(CRACK_HOLD_S - 0.01), 1);
  assert.ok(crackOpacity(CRACK_HOLD_S + CRACK_FADE_S / 2) > 0.4 && crackOpacity(CRACK_HOLD_S + CRACK_FADE_S / 2) < 0.6);
  assert.equal(crackOpacity(CRACK_HOLD_S + CRACK_FADE_S), 0);
  assert.equal(crackOpacity(-1), 0);

  const w = 1600; const h = 780;
  const rightHit = crackTransform(7, 1, w, h);
  const leftHit = crackTransform(7, -1, w, h);
  assert.ok(rightHit.x > w * 0.6, 'from the right, positioned on the right');
  assert.ok(rightHit.rotDeg > 0, 'from the right, rotated toward right');
  assert.ok(leftHit.x < w * 0.4, 'from the left, positioned on the left');
  assert.ok(leftHit.rotDeg < 0, 'from the left, rotated toward left');
  assert.match(rightHit.file, /cockpit-glass-crack-[12]\.png$/);

  const hud = readFileSync(new URL('../src/components/CockpitHud.tsx', import.meta.url), 'utf8');
  assert.match(hud, /if \(!reducedMotion && state\.impact >= CRACK_THRESHOLD && state\.impact > cracks\.lastImpact \+ 0\.15\)/, 'only a new big hit cracks, and never under reduced motion');
  assert.match(hud, /className="cockpit-glass"/);
  assert.ok(hud.indexOf('className="cockpit-glass"') < hud.indexOf('className="cockpit-bezel"'), 'the glass is behind the bezel');
});

test('WIRE-3: speed lines appear above ~80% top speed and never under reduced motion', async () => {
  const { speedLinesOpacity, SPEED_MAX, SPEED_LINES_THRESHOLD } = await import('../src/game/cockpit');
  assert.equal(speedLinesOpacity(0, false), 0);
  assert.equal(speedLinesOpacity(SPEED_MAX * 0.79, false), 0);
  assert.equal(speedLinesOpacity(SPEED_MAX * SPEED_LINES_THRESHOLD, false), 0);
  assert.ok(speedLinesOpacity(SPEED_MAX * 0.9, false) > 0.4 && speedLinesOpacity(SPEED_MAX * 0.9, false) < 0.6);
  assert.equal(speedLinesOpacity(SPEED_MAX, false), 1);
  assert.equal(speedLinesOpacity(SPEED_MAX, true), 0, 'reduced motion disables speed lines');
});

test('WIRE-3: no SVG path or line art left in the cockpit (glass, cracks and needles are painted PNGs)', () => {
  const hud = readFileSync(new URL('../src/components/CockpitHud.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(hud, /<svg[^>]*className="cockpit-glass"/);
  assert.doesNotMatch(hud, /<svg[^>]*className="cockpit-needle"/);
  assert.doesNotMatch(hud, /<line\b/);
  assert.doesNotMatch(hud, /<path\b/);
  assert.match(hud, /className="cockpit-glass"/);
  assert.match(hud, /className="cockpit-glass-grime"/);
  assert.match(hud, /className="cockpit-glass-crack"/);
  assert.match(hud, /className="cockpit-speed-lines"/);
  assert.match(hud, /cockpit-needle-img/);
});
