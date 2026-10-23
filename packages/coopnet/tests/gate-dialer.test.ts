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
  resolveMovedGatePose,
  canDialPlotGate,
  selectRandomOpenGate,
  isEarthSandboxUnlocked,
  type PublishedGateListing,
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

test('Plan 42: resolveMovedGatePose validates plot radius and computes arrival pad in front of gate', () => {
  const moved = resolveMovedGatePose({ x: 120, y: 4.5, z: -80, yaw: 0 });
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.gatePose, { x: 120, y: 4.5, z: -80, yaw: 0 });
  assert.deepEqual(moved.arrivalPad, { x: 120, y: 4.5, z: -76.5, yaw: 0 });

  const outOfBounds = resolveMovedGatePose({ x: 500, y: 0, z: 200, yaw: 0 });
  assert.equal(outOfBounds.ok, false);
  assert.equal(outOfBounds.reason, 'out-of-plot-bounds');
});

test('Plan 42: canDialPlotGate and selectRandomOpenGate respect open, code-only, and closed gate states', () => {
  const directory: PublishedGateListing[] = [
    { code: 'MOON01', ownerId: 'p1', world: 'moon', stage: 3, access: 'open' },
    { code: 'MOON02', ownerId: 'p2', world: 'moon', stage: 5, access: 'closed' },
    { code: 'MOON03', ownerId: 'p3', world: 'moon', stage: 4, access: 'code-only' },
    { code: 'ERTH01', ownerId: 'p4', world: 'earth', stage: 6, access: 'open' },
  ];

  // Closed gates reject non-owners, allow owner
  assert.equal(canDialPlotGate(directory[1]!, 'byCode', 'stranger'), false);
  assert.equal(canDialPlotGate(directory[1]!, 'byCode', 'p2'), true);

  // Code-only gates allow direct code dial, reject random explorer dial
  assert.equal(canDialPlotGate(directory[2]!, 'byCode', 'stranger'), true);
  assert.equal(canDialPlotGate(directory[2]!, 'random', 'stranger'), false);

  // Random explorer dialer picks only open gates and avoids recently visited until exhausted
  const pick1 = selectRandomOpenGate(directory, 42, {
    explorerId: 'explorer-1',
    recentlyVisited: ['MOON01'],
  });
  assert.ok(pick1);
  assert.equal(pick1.code, 'ERTH01');

  // Once all open gates are in recentlyVisited, it cycles back through the open pool
  const pick2 = selectRandomOpenGate(directory, 7, {
    explorerId: 'explorer-1',
    recentlyVisited: ['MOON01', 'ERTH01'],
  });
  assert.ok(pick2);
  assert.ok(pick2.code === 'MOON01' || pick2.code === 'ERTH01');
});

test('Plan 42: isEarthSandboxUnlocked unlocks Earth plot building once all 6 fidelity stages are reached', () => {
  assert.equal(isEarthSandboxUnlocked(0), false);
  assert.equal(isEarthSandboxUnlocked(5), false);
  assert.equal(isEarthSandboxUnlocked(6), true);
});
