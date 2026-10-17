// ============================================================================
// File: apps/web/src/play/wrecks.test.ts
// Unit tests for settleWreck and wreckInteract (TICKET-07 Item F — VEH-03).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { settleWreck, wreckInteract } from './wreck-sites';

test('settleWreck tilts wreck trucks deterministically and buries their base so they never float', () => {
  const slopedHeight = (x: number, z: number): number => 0.15 * x - 0.1 * z;
  const truckMember = {
    model: 'wrecked-truck-cab-c',
    x: 20,
    z: -15,
    yaw: 0.8,
    tilt: 0,
    sink: 0,
    junk: false,
  };

  const p1 = settleWreck(truckMember, slopedHeight, 77);
  const p2 = settleWreck(truckMember, slopedHeight, 77);
  assert.deepEqual(p1, p2, 'settleWreck is deterministic');

  assert.ok(Math.abs(p1.pitch) > 0.05, `Expected non-zero pitch, got ${p1.pitch}`);
  assert.ok(Math.abs(p1.roll) > 0.05, `Expected non-zero roll, got ${p1.roll}`);
  assert.ok(p1.sink >= 0.38, `Expected buried sink >= 0.38m on slope, got ${p1.sink}`);
});

const VALID_LOGS = new Set(['LOG-05', 'LOG-06', 'LOG-07', 'LOG-08']);
test('wreckInteract returns hold-E salvage and valid lore-logs for wreck trucks and transponders', () => {
  const truck = wreckInteract({ model: 'wrecked-truck-cab-c' });
  assert.ok(truck.salvage, 'Wreck truck has hold-E salvage');
  assert.equal(truck.salvage.item, 'prim-chassis');
  assert.ok(truck.salvage.n > 0 && truck.salvage.secs > 0);
  assert.ok(truck.log && VALID_LOGS.has(truck.log), 'Wreck truck references a valid Bridge Incident Log');

  const van = wreckInteract({ model: 'wrecked-van-a' });
  assert.ok(van.salvage && van.log && VALID_LOGS.has(van.log));

  const transponder = wreckInteract({ model: 'battery-pack-a', transponder: 'transponder-01' });
  assert.equal(transponder.log, 'LOG-05');
  assert.ok(VALID_LOGS.has(transponder.log!));
});
