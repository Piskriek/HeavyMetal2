import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_HUD_QUEUE,
  FIDELITY_HOLD_MS,
  TITLE_HOLD_MS,
  assertZeroHudZoneOverlap,
  boxesInReticleClearZone,
  computeHudVisibilityState,
  enqueueHudBanner,
  fidelitySkinFor,
  shouldRenderMachineBillboard,
  startFidelityTrack,
  stepFidelityTrack,
  visibleHudBanners,
  type HudBanner,
  type HudZoneBox,
} from './hud-zones-logic';

// The canonical 1280 x 720 layout, as the game draws it (the zone boxes are measured from the live DOM in the e2e gate).
const CANONICAL: HudZoneBox[] = [
  { zone: 'top-left', left: 24, top: 24, right: 364, bottom: 140 },
  { zone: 'top-centre', left: 490, top: 20, right: 790, bottom: 64 },
  { zone: 'title', left: 440, top: 72, right: 840, bottom: 136 },
  { zone: 'top-right', left: 1016, top: 24, right: 1256, bottom: 148 },
  { zone: 'centre', left: 600, top: 396, right: 680, bottom: 420 }, // CANNOT PLACE, 36 px under the reticle at (640, 360)
  { zone: 'subtitle', left: 300, top: 552, right: 980, bottom: 612 },
  { zone: 'bottom-centre', left: 230, top: 492, right: 1050, bottom: 548 }, // the build drawer above the hotbar (open)
  { zone: 'bottom-left', left: 24, top: 600, right: 284, bottom: 696 },
  { zone: 'bottom-right', left: 1000, top: 560, right: 1256, bottom: 696 },
];

test('suppresses CANNOT PLACE and delays subtitles while Stage 0 title card is active', () => {
  const arrivalState = computeHudVisibilityState({
    nowMs: 1000,
    titleCardText: 'STAGE 0 // LUNAR SUBSTRATE',
    titleCardExpiresAtMs: 3500,
    isBuildDrawerOpen: false,
    isPlacingStructure: false,
    canPlaceCurrentGhost: false,
    activeSubtitleText: 'Watch your step on the regolith.',
    subtitleReadyAtMs: 0,
    coherence0to100: 100,
    isInsideSafeDomeOrLab: true,
    isDrivingRover: false,
  });

  assert.equal(arrivalState.showTitleCard, true);
  assert.equal(arrivalState.showCannotPlaceWarning, false);
  assert.equal(arrivalState.showSubtitleBanner, false);
  assert.equal(arrivalState.showCoherenceGauge, false);
});

test('CANNOT PLACE needs a placing ghost that cannot stand; the subtitle yields to the open build drawer', () => {
  const base = {
    nowMs: 9000,
    titleCardText: null,
    titleCardExpiresAtMs: 0,
    isBuildDrawerOpen: false,
    isPlacingStructure: true,
    canPlaceCurrentGhost: false,
    activeSubtitleText: 'Line.',
    subtitleReadyAtMs: 0,
    coherence0to100: 80,
    isInsideSafeDomeOrLab: false,
    isDrivingRover: false,
  };
  assert.equal(computeHudVisibilityState(base).showCannotPlaceWarning, true);
  assert.equal(computeHudVisibilityState({ ...base, isPlacingStructure: false }).showCannotPlaceWarning, false);
  assert.equal(computeHudVisibilityState({ ...base, canPlaceCurrentGhost: true }).showCannotPlaceWarning, false);
  assert.equal(computeHudVisibilityState(base).showSubtitleBanner, true);
  assert.equal(computeHudVisibilityState({ ...base, isBuildDrawerOpen: true }).showSubtitleBanner, false);
  assert.equal(computeHudVisibilityState({ ...base, subtitleReadyAtMs: 9500 }).showSubtitleBanner, false);
});

test('driving swaps the suit gauge for the rover telemetry', () => {
  const driving = computeHudVisibilityState({
    nowMs: 0, titleCardText: null, titleCardExpiresAtMs: 0, isBuildDrawerOpen: false, isPlacingStructure: false,
    canPlaceCurrentGhost: true, activeSubtitleText: null, subtitleReadyAtMs: 0, coherence0to100: 100,
    isInsideSafeDomeOrLab: false, isDrivingRover: true,
  });
  assert.equal(driving.showRoverTelemetry, true);
  assert.equal(driving.showCoherenceGauge, false);
});

test('the canonical nine-zone layout has zero overlap between every pair of zone boxes', () => {
  assert.deepEqual(assertZeroHudZoneOverlap(CANONICAL), []);
  // and the gate really catches a collision
  const clash = [...CANONICAL, { zone: 'top-right', left: 300, top: 560, right: 400, bottom: 600 }];
  const found = assertZeroHudZoneOverlap(clash);
  assert.ok(found.some((o) => o.a === 'subtitle' || o.b === 'subtitle'));
});

test('no zone box reaches into the reticle clear zone (a 48 px square on the crosshair)', () => {
  assert.deepEqual(boxesInReticleClearZone(CANONICAL, 640, 360), []);
  const prompt = { zone: 'centre', left: 600, top: 370, right: 680, bottom: 390 }; // 10 px under the reticle: too close
  assert.equal(boxesInReticleClearZone([prompt], 640, 360).length, 1);
});

test('machine labels show within 14 m and 8 degrees, or always with Alt', () => {
  assert.equal(shouldRenderMachineBillboard(8.0, 4.5, false), true);
  assert.equal(shouldRenderMachineBillboard(8.0, 22.0, false), false);
  assert.equal(shouldRenderMachineBillboard(20.0, 6.0, false), false); // aimed 20 degrees away: hidden at close range
  assert.equal(shouldRenderMachineBillboard(20.0, 20.0, true), true); // Alt: the tactical view
});

const banner = (id: string, slot: HudBanner['slot'], durationMs = 1000): HudBanner => ({ id, slot, text: id, durationMs });

test('the queue plays one banner per slot, in order', () => {
  let q = enqueueHudBanner(EMPTY_HUD_QUEUE, banner('a', 'toast', 1000), 0);
  q = enqueueHudBanner(q, banner('b', 'toast', 1000), 0);
  assert.deepEqual(visibleHudBanners(q, 0).map((b) => b.banner.id), ['a']);
  assert.deepEqual(visibleHudBanners(q, 999).map((b) => b.banner.id), ['a']);
  q = enqueueHudBanner(q, banner('c', 'toast'), 1000); // b starts when a expires
  assert.deepEqual(visibleHudBanners(q, 1000).map((b) => b.banner.id), ['b']);
});

test('a title card holds the subtitle and toasts for its 3 s, then they run', () => {
  let q = enqueueHudBanner(EMPTY_HUD_QUEUE, banner('STAGE 0', 'title', TITLE_HOLD_MS), 0);
  q = enqueueHudBanner(q, banner('Haddy line', 'subtitle', 4000), 100);
  q = enqueueHudBanner(q, banner('pickup', 'toast', 500), 100);
  assert.deepEqual(visibleHudBanners(q, 2000).map((b) => b.banner.id), ['STAGE 0']);
  assert.deepEqual(visibleHudBanners(q, 2999).map((b) => b.banner.id), ['STAGE 0']);
  // the title expires at 3000: the subtitle and the toast start together, one per slot
  const after = visibleHudBanners(q, 3000).map((b) => b.banner.id);
  assert.deepEqual(after.sort(), ['Haddy line', 'pickup']);
  assert.equal(after.length, 2);
});

test('a queued title card waits its turn and does not cut a live one short', () => {
  let q = enqueueHudBanner(EMPTY_HUD_QUEUE, banner('STAGE 1', 'title', TITLE_HOLD_MS), 0);
  q = enqueueHudBanner(q, banner('STAGE 2', 'title', TITLE_HOLD_MS), 500);
  assert.deepEqual(visibleHudBanners(q, 2000).map((b) => b.banner.id), ['STAGE 1']);
  assert.deepEqual(visibleHudBanners(q, 3000).map((b) => b.banner.id), ['STAGE 2']);
});

test('the fidelity skin follows the plot stage, with the shielded lab rule', () => {
  const at = (stage: number, machinesOnPlot = 0) =>
    fidelitySkinFor({ stage, machinesOnPlot, inShieldedLab: false, labPowerOn: false });
  assert.equal(at(0, 0), '0a'); // arrival, nothing built
  assert.equal(at(0, 1), '0b'); // from the first machine
  assert.equal(at(1), '1');
  assert.equal(at(2), '2');
  assert.equal(at(3), '3');
  assert.equal(at(4), '4-6');
  assert.equal(at(6), '4-6');
  assert.equal(fidelitySkinFor({ stage: 0, machinesOnPlot: 0, inShieldedLab: true, labPowerOn: false }), '3');
  assert.equal(fidelitySkinFor({ stage: 0, machinesOnPlot: 0, inShieldedLab: true, labPowerOn: true }), '4-6');
});

test('crossing a stage boundary flips the skin only after it has held 0.5 s', () => {
  let t = startFidelityTrack('0b', 0);
  t = stepFidelityTrack(t, '1', 100);
  assert.equal(t.skin, '0b');
  assert.equal(t.flipped, false);
  t = stepFidelityTrack(t, '1', 100 + FIDELITY_HOLD_MS - 1);
  assert.equal(t.skin, '0b');
  t = stepFidelityTrack(t, '1', 100 + FIDELITY_HOLD_MS);
  assert.equal(t.skin, '1');
  assert.equal(t.flipped, true);
  // a candidate that flickers back never flips
  let u = startFidelityTrack('1', 0);
  u = stepFidelityTrack(u, '2', 10);
  u = stepFidelityTrack(u, '1', 200);
  u = stepFidelityTrack(u, '2', 600);
  assert.equal(u.skin, '1');
});
