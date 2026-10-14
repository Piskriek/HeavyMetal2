import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertZeroHudZoneOverlap,
  computeHudVisibilityState,
  shouldRenderMachineBillboard,
  type HudZoneBox,
} from '../src/nine-zone-budget';

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

test('verifies zero pixel overlap across canonical 9-zone bounding boxes', () => {
  const canonicalBoxes: HudZoneBox[] = [
    { zone: 'top-left', left: 24, top: 24, right: 364, bottom: 140 },
    { zone: 'top-center', left: 490, top: 20, right: 790, bottom: 64 },
    { zone: 'title-card', left: 440, top: 72, right: 840, bottom: 136 },
    { zone: 'top-right', left: 1016, top: 24, right: 1256, bottom: 148 },
    { zone: 'center-reticle', left: 500, top: 340, right: 780, bottom: 430 },
    { zone: 'subtitle', left: 300, top: 552, right: 980, bottom: 612 },
    { zone: 'build-ribbon', left: 230, top: 492, right: 1050, bottom: 548 },
    { zone: 'hotbar', left: 340, top: 636, right: 940, bottom: 700 },
  ];

  assert.deepEqual(assertZeroHudZoneOverlap(canonicalBoxes), []);
  assert.equal(shouldRenderMachineBillboard(8.0, 4.5, false), true);
  assert.equal(shouldRenderMachineBillboard(8.0, 22.0, false), false);
});
