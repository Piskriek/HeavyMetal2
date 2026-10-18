// ============================================================================
// File: packages/leaksim/src/wall-pathfinder.test.ts
// Unit tests for wall-pathfinder.ts and leaksim integration (POL-32 & POL-33).
// Imports ONLY modules in ticket10-context.json.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boltBlockedBySolids,
  createWorld,
  findPathAroundWalls,
  navFromSolids,
  nextWaypointAroundWalls,
  placeMob,
  segmentHitsSolid,
  step,
  type Solid,
} from './index';

test('POL-33: segmentHitsSolid and boltBlockedBySolids stop spitter bolts on oriented walls', () => {
  // A 4 m wall centred at (5, 0) running along Z (hu = 0.15 along X, hv = 2.5 along Z)
  const wall: Solid = { x: 5, z: 0, ux: 1, uz: 0, hu: 0.15, hv: 2.5 };

  // Bolt flying from (0, 0) to (10, 0) hits the wall near x = 4.77
  const hit = segmentHitsSolid(0, 0, 10, 0, wall, 0.08);
  assert.equal(hit.hit, true);
  assert.ok(hit.t > 0.45 && hit.t < 0.5);
  assert.ok(Math.abs(hit.x - (5 - 0.15 - 0.08)) < 1e-4);

  // Bolt flying around the wall at z = 4.0 misses it
  const miss = boltBlockedBySolids(0, 4, 10, 4, [wall], 0.08);
  assert.equal(miss.blocked, false);

  // In leaksim step(), a spitter bolt aimed through a wall breaks on the wall and never hits the player behind it
  let w = createWorld(42);
  w = {
    ...w,
    bolts: [
      {
        id: 99,
        from: 1,
        x: 2,
        z: 0,
        vx: 12,
        vz: 0,
        life: 2.0,
        damage: 10,
      },
    ],
  };
  const res = step(w, {
    dt: 0.5, // travels from x=2 to x=8, crossing wall at x=5
    stage: 1,
    aggression: 'normal',
    player: { x: 8, z: 0, alive: true },
    machines: [],
    safe: [],
    sealing: null,
    solids: [wall],
  });
  assert.equal(res.world.bolts.length, 0, 'bolt broke on the wall');
  assert.equal(res.events.some((e) => e.t === 'hitPlayer'), false, 'player behind wall took no hit');
});

test('POL-32: findPathAroundWalls and leaksim step() route ground monsters around a wall instead of stalling', () => {
  // Wall blocking x = 0 from z = -4 to z = +4
  const wall: Solid = { x: 0, z: 0, ux: 1, uz: 0, hu: 0.25, hv: 4.0 };
  const nav = navFromSolids([wall], { x: 0, z: 0 }, 16, 0.5, 0.6);

  const path = findPathAroundWalls(nav, { x: -4, z: 0 }, { x: 4, z: 0 });
  assert.ok(path.length >= 2, 'path routes around the wall end');
  assert.ok(Math.abs(path[0]!.z) > 3.5, `first waypoint detours past wall end (z=${path[0]!.z})`);

  const wp = nextWaypointAroundWalls({ x: -3, z: 0 }, { x: 4, z: 0 }, [wall], 0.8, nav);
  assert.ok(Math.abs(wp.z) > 2.0, 'next waypoint steers toward open end of wall');

  // Step a charger from (-2.5, 0) chasing player at (5, 0) behind the wall
  let w = createWorld(7);
  w = placeMob(w, 'charger', { x: -2.5, z: 0 });
  for (let i = 0; i < 40; i++) {
    w = step(w, {
      dt: 0.1,
      stage: 1,
      aggression: 'normal',
      player: { x: 5, z: 0, alive: true },
      machines: [],
      safe: [],
      sealing: null,
      solids: [wall],
      nav,
    }).world;
  }
  const mob = w.mobs[0]!;
  assert.ok(mob.x > 0, `charger routed around wall at x=0 and reached x=${mob.x.toFixed(2)}`);
});
