// ============================================================================
// File: packages/hudmath/tests/toast-queue-and-compass.test.ts
// TICKET-18 Rest unit tests covering POL-35, POL-44, POL-45, POL-46
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createToastQueueState,
  enqueueToast,
  setTitleCardUp,
  tickToastQueue,
  computeDrivingDriftBadge,
  computeLeakCompassBearings,
  isInsideGateSafeDome,
  computeBuildDrawerLayout,
  BUILD_DRAWER_BOTTOM_PX,
} from '../src/toast-queue-and-compass';

test('POL-35: title card holds every toast banner until the title card fades', () => {
  let st = createToastQueueState(true);
  st = enqueueToast(st, { id: 't1', kind: 'salvage', text: '+4 ORE SALVAGED' });
  st = enqueueToast(st, { id: 't2', kind: 'cannot-place', text: 'CANNOT PLACE: UNEVEN GROUND' });
  st = enqueueToast(st, { id: 't3', kind: 'recipe', text: 'UNLOCKED: SOLAR ARRAY' });

  // While title card is up, no toast is shown and ticking does not expire held toasts
  assert.equal(st.active, null);
  assert.equal(st.queue.length, 3);
  st = tickToastQueue(st, 5000);
  assert.equal(st.queue.length, 3);

  // When title card fades, highest-priority toast (CANNOT PLACE) pops first, followed by the rest
  st = setTitleCardUp(st, false);
  assert.equal(st.active?.id, 't2');
  assert.equal(st.queue.length, 2);

  st = tickToastQueue(st, 2000);
  assert.equal(st.active?.id, 't3');
  st = tickToastQueue(st, 3000);
  assert.equal(st.active?.id, 't1');
});

test('POL-44: computeDrivingDriftBadge detects slip angles >= 12 degrees at driving speeds', () => {
  // Moving straight ahead along +Z (yaw = 0) at 10 m/s (36 km/h) -> no drift
  const straight = computeDrivingDriftBadge(0, 10, 0);
  assert.equal(straight.speedKmh, 36);
  assert.equal(straight.drifting, false);
  assert.equal(straight.label, null);

  // Sliding sideways at 30 deg slip angle at 10 m/s -> DRIFT 30°
  const angleRad = (30 * Math.PI) / 180;
  const drifting = computeDrivingDriftBadge(Math.sin(angleRad) * 10, Math.cos(angleRad) * 10, 0);
  assert.equal(drifting.drifting, true);
  assert.equal(drifting.driftDeg, 30);
  assert.equal(drifting.label, 'DRIFT 30°');
});

test('POL-44: computeLeakCompassBearings and isInsideGateSafeDome', () => {
  const bearings = computeLeakCompassBearings(0, 0, 0, [
    { site: 1, x: 0, z: -40, sealed: false },  // dead ahead (north = -z)
    { site: 2, x: 30, z: 0, sealed: false },   // 90 deg right (+x)
    { site: 3, x: -20, z: -20, sealed: true }, // sealed -> excluded
  ]);
  assert.equal(bearings.length, 2);
  assert.equal(bearings[0]!.site, 2);
  assert.equal(Math.round(bearings[0]!.relativeDeg), 90);
  assert.equal(bearings[1]!.site, 1);
  assert.equal(Math.round(bearings[1]!.relativeDeg), 0);

  // Inside 25 m Gate dome hides suit sync
  assert.equal(isInsideGateSafeDome(10, -12, { x: 0, z: 0 }), true);
  assert.equal(isInsideGateSafeDome(26, 0, { x: 0, z: 0 }), false);
});

test('POL-45 & POL-46: computeBuildDrawerLayout caps width at 528 px on 1024 px screens and keeps bottom at 104 px', () => {
  const at1024 = computeBuildDrawerLayout(1024);
  assert.equal(at1024.maxWidthPx, 528);
  assert.equal(at1024.bottomPx, 104);
  assert.equal(BUILD_DRAWER_BOTTOM_PX, 104);
  assert.equal(at1024.cardsScrollHorizontally, true);

  const at1440 = computeBuildDrawerLayout(1440);
  assert.equal(at1440.maxWidthPx, 944);
  assert.equal(at1440.bottomPx, 104);
  assert.equal(at1440.cardsScrollHorizontally, false);
});
