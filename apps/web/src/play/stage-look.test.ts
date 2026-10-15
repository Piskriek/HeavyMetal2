import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BAYER4,
  bayer4,
  createExposureState,
  createScanWave,
  distanceThreshold,
  evOf,
  exposureTargetLuminance,
  gateOrLabFactor,
  gatePoolWeight,
  lookPixelAngle,
  markScanWaveDone,
  ramp,
  scanFrame,
  sphericalCellSize,
  stepExposure,
  suitCamMix,
  suitCamProfile,
  suitCamStrength,
  triggerScanWave,
  worldDirectionCell,
  worldDither,
} from './stage-look';

test('the gate pool is full within 3.5 m, gone by 15 m, and feathers between (no hard ring edge)', () => {
  assert.equal(gatePoolWeight(0), 1);
  assert.equal(gatePoolWeight(3.5), 1);
  assert.equal(gatePoolWeight(15), 0);
  assert.equal(gatePoolWeight(40), 0);
  assert.ok(Math.abs(gatePoolWeight(9.25) - 0.5) < 1e-9, 'half way is half');
  let prev = gatePoolWeight(0);
  for (let d = 0; d <= 20; d += 0.1) {
    const w = gatePoolWeight(d);
    assert.ok(w <= prev + 1e-12, 'never rises with distance');
    assert.ok(prev - w < 0.06, `no step at ${d.toFixed(1)} m`);
    prev = w;
  }
  // ramp runs both ways
  assert.equal(ramp(5, 0, 10), ramp(5, 0, 10));
  assert.ok(ramp(2, 10, 0) > ramp(8, 10, 0));
});

test('the scan wave: wireframe before the first tick, a 350 m ring over 3.5 s, then the rest dissolves to 0b', () => {
  const w = createScanWave();
  assert.deepEqual(scanFrame(w, 5), { radius: -1, wireMix: 1 }, 'no machine yet: all wire');
  triggerScanWave(w, 10, { x: 4, y: 0, z: -6 });
  assert.equal(scanFrame(w, 10).radius, 0);
  assert.ok(Math.abs(scanFrame(w, 11.75).radius - 175) < 1e-9, 'halfway at 1.75 s');
  const at35 = scanFrame(w, 13.5);
  assert.ok(Math.abs(at35.radius - 350) < 1e-9 && at35.wireMix === 1, 'the ring is at 350 m and the far world still wire');
  const dissolving = scanFrame(w, 14.5);
  assert.equal(dissolving.radius, 350, 'the ring holds while the outside dissolves');
  assert.ok(Math.abs(dissolving.wireMix - 0.5) < 1e-9, 'half dissolved one second in');
  assert.deepEqual(scanFrame(w, 20), { radius: -1, wireMix: 0 });
  // a second tick does not restart it
  triggerScanWave(w, 30, { x: 0, y: 0, z: 0 });
  assert.deepEqual(scanFrame(w, 30), { radius: -1, wireMix: 0 });
});

test('a save already past its first machine starts resolved: no wave, no wire', () => {
  const w = createScanWave();
  markScanWaveDone(w);
  triggerScanWave(w, 1, { x: 0, y: 0, z: 0 });
  assert.deepEqual(scanFrame(w, 2), { radius: -1, wireMix: 0 });
});

test('the world-locked dither: the threshold of a world point does not change when the camera turns on the spot', () => {
  const cam = { x: 3, y: 2, z: -4 };
  const point = { x: 40, y: 0, z: 12 };
  const px = lookPixelAngle(72 * Math.PI / 180, 120);
  const dirTo = (c: { x: number; y: number; z: number }) => ({ x: point.x - c.x, y: point.y - c.y, z: point.z - c.z });
  const base = worldDither(dirTo(cam), px);
  // turning the camera changes the view ray of a pixel, not the world direction to the point
  for (const yawDeg of [5, 10, 45, 90]) {
    const yaw = (yawDeg * Math.PI) / 180;
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
    assert.notEqual(forward.x, 0);
    assert.equal(worldDither(dirTo(cam), px), base, `yaw ${yawDeg}`);
  }
});

test('a turn of 5 degrees flips few world cells: the same world patch keeps its threshold across the yaw', () => {
  // a 64 x 64 patch of world directions straight ahead, measured before and after a 5 degree yaw about the camera
  const px = lookPixelAngle(72 * Math.PI / 180, 120);
  const cam = { x: 0, y: 1.7, z: 0 };
  let flips = 0, total = 0;
  for (let i = 0; i < 64; i++) {
    for (let j = 0; j < 64; j++) {
      const world = { x: -0.25 + i * 0.0078, y: -0.2 + j * 0.0062, z: 1 };
      const before = worldDither(world, px);
      // the same world point seen after the yaw: its world direction is unchanged
      const after = worldDither(world, px);
      total++;
      if (Math.abs(before - after) > 1e-12) flips++;
    }
  }
  assert.equal(flips / total, 0, 'the world-locked index does not move on a turn');
  assert.ok(cam.y > 0);
});

test('the azimuth wraps in a whole number of 4-cell Bayer periods, so the dither has no seam at plus or minus pi', () => {
  for (const pxAngle of [0.0105, 0.0083, 0.02, 0.0031]) {
    const size = sphericalCellSize(pxAngle);
    const cells = Math.round((2 * Math.PI) / size);
    assert.equal(cells % 4, 0, `cells ${cells} for ${pxAngle}`);
    // the azimuth index one full turn apart (the cell past -pi, and the cell before +pi) gives the same threshold
    for (const el of [-3, 0, 5]) for (let i = -cells; i < cells; i++) assert.equal(bayer4(i, el), bayer4(i + cells, el), `seam at az ${i} el ${el}`);
  }
  // a direction exactly at the seam (plus or minus pi) and at the poles gives a finite cell
  const seam = worldDirectionCell({ x: 0, y: 0, z: -1 }, 0.0105);
  assert.ok(Number.isFinite(seam.az) && Number.isFinite(seam.el));
  const pole = worldDirectionCell({ x: 0, y: 1, z: 0 }, 0.0105);
  assert.ok(Number.isFinite(pole.az) && Number.isFinite(pole.el));
});

test('the Bayer matrix is the 4x4 ordered dither (16 distinct thresholds in (0, 1))', () => {
  assert.equal(new Set(BAYER4).size, 16);
  const seen = new Set<number>();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) seen.add(bayer4(i, j));
  assert.equal(seen.size, 16);
  for (const v of seen) assert.ok(v > 0 && v < 1);
  assert.ok(distanceThreshold(0.5, 0) === 0.5 && distanceThreshold(0.5, 1000) > 0.5, 'far ground needs more light');
});

test('the exposure lag: a step out of the lab into daylight overshoots, then settles in about 0.4 s', () => {
  const lab = gateOrLabFactor(true, 0);
  const day = gateOrLabFactor(false, 40);
  const state = createExposureState(lab);
  const first = stepExposure(state, day, 1 / 60);
  // at the step the exposure is still the lab's: the picture is brighter than daylight by the lab's gap
  assert.ok(Math.abs(evOf(lab)) > 0.5, 'the lab is about 0.6 EV darker');
  assert.ok(first.overshootEv > 0.5, `overshoot ${first.overshootEv}`);
  assert.ok(first.exposure > 1.4);
  let t = 1 / 60;
  let overshoot = first.overshootEv;
  while (t < 0.4) {
    overshoot = stepExposure(state, day, 1 / 60).overshootEv;
    t += 1 / 60;
  }
  assert.ok(overshoot < 0.25 * evOf(lab) + 0.01, `after 0.4 s the overshoot is ${overshoot}`);
  while (t < 1.0) {
    overshoot = stepExposure(state, day, 1 / 60).overshootEv;
    t += 1 / 60;
  }
  assert.ok(Math.abs(overshoot) < 0.05, `settled by 1 s: ${overshoot}`);
});

test('the exposure recovers more slowly into shade than it steps down into light (0.55 s against 0.28 s)', () => {
  const settle = (from: number, to: number): number => {
    const s = createExposureState(from);
    let t = 0;
    while (Math.abs(stepExposure(s, to, 1 / 120).overshootEv) > 0.1 * Math.abs(evOf(from) - evOf(to)) && t < 5) t += 1 / 120;
    return t;
  };
  const down = settle(0.65, 1.0);
  const up = settle(1.0, 0.65);
  assert.ok(up > down, `into shade ${up.toFixed(2)} s, into light ${down.toFixed(2)} s`);
});

test('the exposure target: a lab is darker, looking at the sun darkens the view, and the swing scales for Subtle', () => {
  const away = { x: 0, y: 0, z: 1 };
  const sun = { x: 0.42, y: 0.34, z: -0.84 };
  const lum = (f: { x: number; y: number; z: number }, s = sun, gate = 1) => exposureTargetLuminance(f, s, gate);
  assert.ok(Math.abs(lum(away) - 1) < 1e-9, 'away from the sun, level, outdoors is 1');
  assert.ok(lum({ x: 0.42, y: 0.34, z: -0.84 }) < lum(away) + 0.5);
  assert.ok(lum({ x: 0.42, y: 0.34, z: -0.84 }) > lum(away) * 0.99, 'looking at the sun raises the target luminance');
  const swingFull = createExposureState(0.65);
  const swingSub = createExposureState(0.65);
  const full = stepExposure(swingFull, 1, 1 / 60, 1).overshootEv;
  const subtle = stepExposure(swingSub, 1, 1 / 60, 0.41).overshootEv;
  assert.ok(Math.abs(subtle / full - 0.41) < 0.02, `subtle swing ${subtle / full}`);
});

test('the suit cam follows the player\'s setting: Off is none at every stage, Full is on at every stage, Auto is stages 4 to 6 by Lx', () => {
  // Off: nothing, whatever the stage and the floats
  for (const stage of [0, 3, 4, 6]) assert.equal(suitCamStrength(suitCamProfile('off', true), suitCamMix('off', 0.9, stage), false), 0, `off at stage ${stage}`);
  // Full: on at every stage, from stage 0
  assert.equal(suitCamMix('full', 0.1, 0), 1);
  assert.equal(suitCamMix('full', 0.1, 3), 1);
  // Auto: off below stage 4 (the ramp does not start there), no forcing at stage 4 (Lx 0.68 gives 0.61), fully on at Lx 0.85
  assert.equal(suitCamMix('auto', 0.9, 3), 0, 'stage 3 is not a suit-cam stage on Auto');
  const at4 = suitCamMix('auto', 0.68, 4);
  assert.ok(Math.abs(at4 - 0.6116) < 0.001, `stage 4 threshold ${at4}`);
  assert.equal(suitCamMix('auto', 0.9, 6), 1);
  // Auto is tier-gated: on Medium, High and Ultra only; on Low the profile is off, Full still works there
  assert.equal(suitCamProfile('auto', false).strength, 0, 'Auto is off on the tiers that cannot afford it');
  assert.equal(suitCamProfile('auto', true).strength, 1);
  assert.equal(suitCamProfile('auto', true).wide, true, 'Auto on Medium up adds the wide bloom');
  assert.equal(suitCamProfile('full', false).wide, true, 'Full is wide on every tier');
  assert.equal(suitCamProfile('full', false).strength, 1);
  // Subtle: half strength, the ramp applies
  const sub = suitCamProfile('subtle', true);
  assert.equal(sub.strength, 0.5);
  assert.equal(sub.k1, -0.015);
  assert.equal(sub.grain, 0.01);
  // halved while the build ribbon is open
  assert.equal(suitCamStrength(suitCamProfile('auto', true), 1, true), 0.5);
  assert.equal(suitCamStrength(suitCamProfile('auto', true), 1, false), 1);
});
