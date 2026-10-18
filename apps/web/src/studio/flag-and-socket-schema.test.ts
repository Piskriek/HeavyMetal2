// ============================================================================
// File: apps/web/src/studio/flag-and-socket-schema.test.ts
// Unit tests for flag-and-socket-schema.ts
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkFixFlags,
  evaluateLuminanceGate,
  checkSnappedSockets,
  LUM_FLOOR,
  LUM_RATIO,
} from './flag-and-socket-schema';

test('checkFixFlags: accepts valid flags and rejects unknown kinds/assets', () => {
  const assets = new Set(['drill', 'mill', 'hauler-body']);

  const valid = {
    drill: { fix: ['mirror-z', 'plain-back'], reach: 3, hold: false, lumOk: true },
    mill: { reach: 5, lumOk: true },
    'hauler-body': { fix: ['mirror-z'] },
  };

  const res = checkFixFlags(valid, assets);
  assert.equal(res.ok, true);
  assert.deepEqual(res.value?.['drill'], {
    fix: ['mirror-z', 'plain-back'],
    reach: 3,
    hold: false,
    lumOk: true,
  });

  // Rejects unknown asset id
  const unknownAsset = checkFixFlags({ unknown_item: { reach: 3 } }, assets);
  assert.equal(unknownAsset.ok, false);
  assert.match(unknownAsset.why!, /unknown asset id "unknown_item"/);

  // Rejects invalid fix kind
  const invalidFix = checkFixFlags({ drill: { fix: ['inverted-normals'] } }, assets);
  assert.equal(invalidFix.ok, false);
  assert.match(invalidFix.why!, /invalid fix kind/);

  // Rejects invalid reach
  const invalidReach = checkFixFlags({ drill: { reach: -1 } }, assets);
  assert.equal(invalidReach.ok, false);
  assert.match(invalidReach.why!, /reach for "drill" must be an integer/);

  // Rejects invalid types for hold or lumOk
  const invalidHold = checkFixFlags({ drill: { hold: 'yes' } }, assets);
  assert.equal(invalidHold.ok, false);
  assert.match(invalidHold.why!, /hold for "drill" must be a boolean/);
});

test('evaluateLuminanceGate: PASS when low >= 0.18 and ratio >= 0.85, FAIL otherwise', () => {
  assert.equal(LUM_FLOOR, 0.18);
  assert.equal(LUM_RATIO, 0.85);

  const passing = evaluateLuminanceGate(0.25, 0.28);
  assert.equal(passing.ok, true);
  assert.equal(passing.badge, 'PASS');
  assert.equal(passing.low, 0.25);
  assert.equal(passing.high, 0.28);
  assert.equal(passing.why, '');

  // Below floor (0.15 < 0.18)
  const belowFloor = evaluateLuminanceGate(0.15, 0.16);
  assert.equal(belowFloor.ok, false);
  assert.equal(belowFloor.badge, 'FAIL');
  assert.match(belowFloor.why, /under 0.18 floor/);

  // Darker ratio (low 0.20, high 0.30 -> ratio 0.67 < 0.85)
  const badRatio = evaluateLuminanceGate(0.20, 0.30);
  assert.equal(badRatio.ok, false);
  assert.equal(badRatio.badge, 'FAIL');
  assert.match(badRatio.why, /darker than high/);
});

test('checkSnappedSockets: validates hopper, exhaust, cable, and mount sockets', () => {
  const assets = new Set(['press', 'modular-scout']);

  const valid = {
    press: [
      { id: 'sock-1', name: 'Feed Hopper', type: 'hopper', at: [1.0, 0.5, -0.2], normal: [1, 0, 0] },
      { id: 'sock-2', name: 'Pixel Exhaust', type: 'exhaust', at: [0, 1.8, 0] },
    ],
    'modular-scout': [
      { id: 'sock-rear', name: 'Rear Mount', type: 'mount', at: [0, 0.4, -1.5] },
      { id: 'sock-cable', name: 'Power Cable', type: 'cable', at: [0.3, 0.2, 0.8], normal: [0, 1, 0] },
    ],
  };

  const res = checkSnappedSockets(valid, assets);
  assert.equal(res.ok, true);
  assert.equal(res.value?.['press']?.length, 2);
  assert.deepEqual(res.value?.['press']?.[0], {
    id: 'sock-1',
    name: 'Feed Hopper',
    type: 'hopper',
    at: [1.0, 0.5, -0.2],
    normal: [1, 0, 0],
  });

  // Rejects invalid socket type
  const badType = checkSnappedSockets(
    { press: [{ id: 's1', name: 'Bad', type: 'thruster', at: [0, 0, 0] }] },
    assets,
  );
  assert.equal(badType.ok, false);
  assert.match(badType.why!, /invalid type "thruster"/);

  // Rejects duplicate socket id
  const dupId = checkSnappedSockets(
    {
      press: [
        { id: 'dup', name: 'H1', type: 'hopper', at: [0, 0, 0] },
        { id: 'dup', name: 'H2', type: 'hopper', at: [1, 1, 1] },
      ],
    },
    assets,
  );
  assert.equal(dupId.ok, false);
  assert.match(dupId.why!, /duplicate socket id "dup"/);

  // Rejects non-vector coordinate
  const badCoord = checkSnappedSockets(
    { press: [{ id: 's1', name: 'Bad', type: 'hopper', at: [0, 0] }] },
    assets,
  );
  assert.equal(badCoord.ok, false);
  assert.match(badCoord.why!, /invalid \[x, y, z\] coordinate/);
});
