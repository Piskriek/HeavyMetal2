// ============================================================================
// File: apps/web/src/play/monster-rules.test.ts
// Unit tests for monster-rules.ts (spawnPolicy, beamDamage, and POL-37 fightOverlayParamsForStage).
// Imports ONLY modules in ticket10-context.json.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beamDamage,
  fightOverlayParamsForStage,
  maxMobsPerLeak,
  spawnPolicy,
} from './monster-rules';

test('POL-37: fightOverlayParamsForStage tunes down remapStrength and ring opacity at Stage 1 vs Stage 6', () => {
  const s1 = fightOverlayParamsForStage(1);
  const s6 = fightOverlayParamsForStage(6);

  assert.equal(s1.remapStrength, 0.12, 'Stage 1 lowers remapStrength to prevent pink posterisation smear');
  assert.equal(s6.remapStrength, 0.20, 'Stage 6 uses canonical 0.20 remapStrength');
  assert.ok(s1.ringMaxOpacity < s6.ringMaxOpacity);
  assert.ok(s1.burstCount < s6.burstCount);
});

test('spawnPolicy and beamDamage respect proximity, seal state, and distance falloff', () => {
  assert.equal(spawnPolicy({ sealed: true, kinds: ['charger'] }, 10, 2, 0), 0);
  assert.equal(spawnPolicy({ sealed: false, dormant: true, kinds: ['charger'] }, 10, 2, 0), 0);
  assert.ok(spawnPolicy({ sealed: false, kinds: ['charger'] }, 20, 2, 0) > 0);
  assert.equal(spawnPolicy({ sealed: false, kinds: ['charger'] }, 55, 2, 0), 0);
  assert.ok(maxMobsPerLeak(6) > maxMobsPerLeak(0));

  assert.equal(beamDamage('seal', 1, 10, true), 0);
  assert.ok(beamDamage('extract', 1, 5, false) > beamDamage('extract', 1, 20, false));
});
