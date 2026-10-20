// ============================================================================
// File: packages/groundshader/tests/blob47-autotile.test.ts
// TICKET-25 unit tests covering POL-05, POL-50, POL-52, POL-53, and POL-60
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOB_47_MASKS,
  MASK_TO_BLOB47_INDEX,
  blob47IndexForMask,
  evaluateBlob47SubtileBlend,
  MODULAR_SCOUT_SOCKETS,
  WATERMAKER_HARDPOINT_FIT,
  computeScanRingHorizonFade,
  computeSuitCamEvOvershoot,
  computeSafeDomeGroundBand,
} from '../src/blob47-autotile';

test('POL-05: 8-neighbour Moore bitmask reduces all 256 states to the exact 47 canonical Wang/Blob tiles', () => {
  assert.equal(BLOB_47_MASKS.length, 47);
  assert.equal(MASK_TO_BLOB47_INDEX.length, 256);
  // Isolated cell (mask 0) -> index 0; diagonal-only bits (e.g. NE=2 without N and E) also collapse to index 0
  assert.equal(blob47IndexForMask(0), 0);
  assert.equal(blob47IndexForMask(2), 0);
  // Full 8-neighbour interior cell (255) -> index 46, and centre blend weight is 1.0
  assert.equal(blob47IndexForMask(255), 46);
  assert.equal(evaluateBlob47SubtileBlend(255, 0.5, 0.5), 1);
  assert.equal(evaluateBlob47SubtileBlend(255, 0.95, 0.95), 1);
  // Isolated cell feathers to 0 at edges and is 1 at centre
  assert.equal(evaluateBlob47SubtileBlend(0, 0.5, 0.5), 1);
  assert.equal(evaluateBlob47SubtileBlend(0, 0.0, 0.5), 0);
});

test('POL-50: MODULAR_SCOUT_SOCKETS defines square-u-yoke and whip aerial, and Watermaker fits inside 8m hardpoint', () => {
  assert.equal(MODULAR_SCOUT_SOCKETS.steeringYokeShape, 'square-u-yoke');
  assert.ok(MODULAR_SCOUT_SOCKETS.aerialHeightM > 1.0);
  assert.equal(WATERMAKER_HARDPOINT_FIT.fitsInside8mHardpoint, true);
});

test('POL-52: computeScanRingHorizonFade fades ring opacity to 0 at 350 m and resolves far world', () => {
  const at250 = computeScanRingHorizonFade(250);
  assert.equal(at250.ringOpacity, 1);
  const at350 = computeScanRingHorizonFade(350);
  assert.equal(at350.ringOpacity, 0);
  assert.ok(at350.farWorldResolved01 > 0.2);
});

test('POL-53 & POL-60: suit-cam EV step starts at +0.85 EV, settles < 0.15 EV at 0.4 s, and dome band peaks on radius', () => {
  assert.equal(computeSuitCamEvOvershoot(0), 0.85);
  const at04 = computeSuitCamEvOvershoot(0.4);
  assert.ok(at04 <= 0.15 && at04 >= 0.12, `Expected ~0.144 EV at 0.4s, got ${at04}`);
  assert.ok(computeSuitCamEvOvershoot(1.0) < 0.02);

  assert.equal(computeSafeDomeGroundBand(25.0, 25.0), 1);
  assert.equal(computeSafeDomeGroundBand(27.0, 25.0), 0);
});
