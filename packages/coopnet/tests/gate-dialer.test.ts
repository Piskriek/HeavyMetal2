// ============================================================================
// File: packages/coopnet/tests/gate-dialer.test.ts
// TICKET-26 unit tests covering POL-16, POL-84, and friend plot rearrangement
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClaimedSectorReadout,
  normalizeGateDialCode,
  beginGateDial,
  stepGateDial,
  rearrangeFriendsAdjacentToSlot,
  GATE_CHEVRON_COUNT,
} from '../src/gate-dialer';

test('POL-84: formatClaimedSectorReadout produces SECTOR #NN with distance and compass octant', () => {
  const r = formatClaimedSectorReadout(4, { x: 160, z: -160 });
  assert.ok(r);
  assert.equal(r.slot, 4);
  assert.equal(r.compassOctant, 'NE');
  assert.equal(r.label, 'SECTOR #04 // 226 m NE');
  assert.equal(formatClaimedSectorReadout(null, { x: 0, z: 0 }), null);
});

test('POL-16: 6-chevron Gate Dialing locks 1 coil every 0.45 s and completes at 2.70 s', () => {
  assert.equal(normalizeGateDialCode('ab12cd'), 'AB12CD');
  assert.equal(normalizeGateDialCode('bad'), null);

  let st = beginGateDial('smx404');
  assert.equal(st.status, 'dialing');
  assert.equal(st.chevronsLocked, 0);

  st = stepGateDial(st, 1.0);
  assert.equal(st.chevronsLocked, 2);
  assert.equal(st.status, 'dialing');

  st = stepGateDial(st, 2.0);
  assert.equal(st.chevronsLocked, GATE_CHEVRON_COUNT);
  assert.equal(st.status, 'locked');
});

test('POL-16: rearrangeFriendsAdjacentToSlot assigns friends to the closest contiguous neighbour slots', () => {
  const map = rearrangeFriendsAdjacentToSlot(4, [9, 12, 1, 17], ['friend-alpha', 'friend-beta', 'friend-gamma']);
  assert.equal(map.get('friend-alpha'), 9);
  assert.equal(map.get('friend-beta'), 12);
  assert.equal(map.get('friend-gamma'), 1);
});
