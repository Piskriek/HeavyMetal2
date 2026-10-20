// ============================================================================
// File: packages/bridgekit/tests/game-detector.test.ts
// TICKET-27 unit tests covering POL-13, the 4-Rung Wreck Restoration Ladder, and POL-23
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectRunningBridgeGames,
  evaluateWreckRestorationRung,
  ANOMALY_CRYSTAL_CLUSTERS,
} from '../src/game-detector';

test('POL-13: detectRunningBridgeGames identifies running engines and unlocks their bridged .smx cartridges', () => {
  const res = detectRunningBridgeGames([
    'System Idle Process',
    'UnrealEditor.exe',
    'javaw.exe -Xmx4G net.minecraft.client.main.Main',
  ]);
  assert.equal(res.connected, true);
  assert.equal(res.detectedGames.length, 2);
  assert.deepEqual(res.unlockedCartridges, [
    'bridge:unreal-lumen',
    'bridge:minecraft-voxel',
  ]);

  const empty = detectRunningBridgeGames(['explorer.exe', 'chrome.exe']);
  assert.equal(empty.connected, false);
  assert.equal(empty.detectedGames.length, 0);
});

test('OWNER_ASKS (2026-10-12): evaluateWreckRestorationRung steps from Broken Junk (0) -> Low (1) -> RUN.world HD (2) -> Meshy Max (3)', () => {
  const unsealed = evaluateWreckRestorationRung({ leakSealed: false, beamSecondsApplied: 10 });
  assert.equal(unsealed.rung, 0);
  assert.equal(unsealed.spec.tierName, 'broken-junk');

  const sealed = evaluateWreckRestorationRung({ leakSealed: true, beamSecondsApplied: 0 });
  assert.equal(sealed.rung, 1);
  assert.equal(sealed.spec.tierName, 'standard-low');

  const runworldTier = evaluateWreckRestorationRung({ leakSealed: true, beamSecondsApplied: 2.5 });
  assert.equal(runworldTier.rung, 2);
  assert.equal(runworldTier.spec.tierName, 'runworld-hd');

  const meshyMax = evaluateWreckRestorationRung({ leakSealed: true, beamSecondsApplied: 5.0 });
  assert.equal(meshyMax.rung, 3);
  assert.equal(meshyMax.spec.tierName, 'meshy-max');
  assert.equal(meshyMax.fullyRestored, true);
});

test('POL-23: ANOMALY_CRYSTAL_CLUSTERS defines 3-shard square-faceted crystal clusters for all 4 metrics', () => {
  for (const key of ['pxd', 'vtx', 'lx', 'aq'] as const) {
    assert.equal(ANOMALY_CRYSTAL_CLUSTERS[key].length, 3);
  }
});
