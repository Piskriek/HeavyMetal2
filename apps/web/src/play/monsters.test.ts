// ============================================================================
// File: apps/web/src/play/monsters.test.ts
// Unit tests for spawnPolicy and beamDamage in apps/web/src/play/monster-rules.ts (re-exported by monsters.ts)
// (TICKET-07 Items B & C — MC-01, MC-03).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { beamDamage, maxMobsPerLeak, spawnPolicy } from './monster-rules';

test('spawnPolicy spawns defenders on open leaks within 40 m up to per-leak cap and stops when sealed', () => {
  const openLeak = { sealed: false, dormant: false, kinds: ['charger' as const] };
  const sealedLeak = { sealed: true, dormant: false, kinds: ['charger' as const] };
  const dormantLeak = { sealed: false, dormant: true, kinds: [] as const };

  // Within 40 m on open leak with 0 active spawns > 0
  const n1 = spawnPolicy(openLeak, 25, 1, 0);
  assert.ok(n1 > 0, `Expected spawn count > 0 at 25 m, got ${n1}`);

  // Beyond 40 m returns 0
  assert.equal(spawnPolicy(openLeak, 45, 1, 0), 0);

  // At or above per-leak cap returns 0
  const cap = maxMobsPerLeak(1);
  assert.equal(spawnPolicy(openLeak, 15, 1, cap), 0);
  assert.equal(spawnPolicy(openLeak, 15, 1, cap + 2), 0);

  // Sealed or dormant leaks always return 0
  assert.equal(spawnPolicy(sealedLeak, 10, 2, 0), 0);
  assert.equal(spawnPolicy(dormantLeak, 10, 2, 0), 0);
});

test('beamDamage deals chip damage in extract mode and zero in seal, apply, or sculpt', () => {
  const dmgClose = beamDamage('extract', 0.5, 5, false);
  const dmgFar = beamDamage('extract', 0.5, 22, false);
  assert.ok(dmgClose > 0 && dmgFar > 0);
  assert.ok(dmgClose > dmgFar, 'Closer targets take slightly more chip damage');

  // Out of SEAL_REACH (25 m) deals 0
  assert.equal(beamDamage('extract', 0.5, 30, false), 0);

  // Sealing or non-extract modes deal 0 damage
  assert.equal(beamDamage('extract', 0.5, 10, true), 0);
  assert.equal(beamDamage('seal', 0.5, 10, false), 0);
  assert.equal(beamDamage('apply', 0.5, 10, false), 0);
  assert.equal(beamDamage('sculpt', 0.5, 10, false), 0);
});
