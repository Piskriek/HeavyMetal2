// ============================================================================
// File: packages/questline/tests/charm-and-act789.test.ts
// Purpose: node:test unit suite for TICKET-16 (Acts VII–IX predicates,
//          campaign-chain.ts rows, narrator IDs A7-01..A9-03 + POL-57 barks,
//          and POL-70 11-enclave continental consensus math)
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_789_QUEST_CHAIN,
  CONSENSUS_LOCK_THRESHOLD,
  evaluateContinentalConsensus,
  evaluatePol57Barks,
  formatCustomSchemaDiffToast,
  GATE_BASELINE_KW,
  HORIZON_DOME_DISTANCE_M,
  isAct8RiftOrWaveComplete,
  isBiosphereCoherent,
  NEIGHBOR_ENCLAVE_COUNT,
} from '../src/act789-chain';
import {
  advanceChain,
  bump,
  CHAIN_START,
  CHAIN_STEPS,
  chainProblems,
  COUNT,
  gateReason,
  placedKey,
  stepDone,
  syncChain,
} from '../../../apps/web/src/base/campaign-chain';
import {
  FIDELITY_LINE_IDS,
  FIDELITY_TRIGGERS,
  fidelityRules,
} from '../../narrator/src/fidelity';
import { createNarrator, step as stepNarrator, trigger as triggerNarrator } from '../../narrator/src/index';

test('completes all 9 Acts VII–IX pure predicates (A7-01..A9-03) with peaceful and combat parity', () => {
  const toast = formatCustomSchemaDiffToast('dirt', ' Cheese ');
  assert.equal(toast.sanitizedLabel, 'Cheese');
  assert.equal(ACT_789_QUEST_CHAIN.length, 9);
  assert.deepEqual(
    ACT_789_QUEST_CHAIN.map((s) => s.id),
    ['A7-01', 'A7-02', 'A7-03', 'A8-01', 'A8-02', 'A8-03', 'A9-01', 'A9-02', 'A9-03'],
  );

  const fullState = {
    powerUnitsBuilt: 1,
    relayPylonsBuilt: 2,
    lightProjectorsRunning: 1,
    waterMakersRunning: 1,
    wreckTranspondersSalvaged: 3,
    splicedCoresCreated: 1,
    riftsSealed: 0,
    wavesCleared: 0,
    aggression: 'off' as const,
    horizonDomesInspected: true,
    consensusBranchSubmitted: true,
    finaleWindowHealed: true,
    localS: { Pxd: 0.9, Vtx: 0.9, Lx: 0.9, Aq: 0.85 },
  };

  for (const step of ACT_789_QUEST_CHAIN) {
    assert.equal(step.isComplete(fullState), true, `Expected ${step.id} to hold`);
  }

  // Verify combat vs peaceful parity on A8-02
  assert.equal(
    isAct8RiftOrWaveComplete({ ...fullState, riftsSealed: 0, wavesCleared: 1, aggression: 'normal' }),
    true,
  );
  assert.equal(
    isAct8RiftOrWaveComplete({ ...fullState, riftsSealed: 0, wavesCleared: 0, splicedCoresCreated: 0, aggression: 'normal' }),
    false,
  );
  assert.equal(isBiosphereCoherent(fullState.localS), true);
});

test('computes POL-70 11-enclave horizon domes at 4.2 km and locks Continental Consensus at >= 85%', () => {
  const low = evaluateContinentalConsensus({ Pxd: 0.2, Vtx: 0.2, Lx: 0.2, Aq: 0.1 });
  assert.equal(low.domes.length, NEIGHBOR_ENCLAVE_COUNT);
  assert.equal(NEIGHBOR_ENCLAVE_COUNT, 11);
  assert.equal(low.isReadyToCommit, false);
  for (const d of low.domes) {
    assert.equal(d.distanceM, HORIZON_DOME_DISTANCE_M);
    assert.ok(Math.abs(Math.hypot(d.x, d.z) - 4200) < 0.5);
  }
  assert.equal(low.domes[3]?.sectorLabel, 'SECTOR #04 (VANCE)');

  const high = evaluateContinentalConsensus({ Pxd: 0.88, Vtx: 0.87, Lx: 0.9, Aq: 0.8 });
  assert.ok(high.consensus0to1 >= CONSENSUS_LOCK_THRESHOLD);
  assert.ok(high.consensusPct >= 85.0);
  assert.equal(high.isReadyToCommit, true);
  assert.equal(high.litDomeCount, 11);
});

test('validates A7-01..A9-03 rows in campaign-chain.ts with zero chainProblems()', () => {
  assert.deepEqual(chainProblems(), []);
  const ids = CHAIN_STEPS.map((s) => s.id);
  for (const id of ['A7-01', 'A7-02', 'A7-03', 'A8-01', 'A8-02', 'A8-03', 'A9-01', 'A9-02', 'A9-03']) {
    assert.ok(ids.includes(id), `Expected CHAIN_STEPS to include ${id}`);
  }

  // Advance through Acts IV, V, VII, VIII, IX
  let c = CHAIN_START;
  for (const [k, v] of [
    [COUNT.drillsRunning, 1],
    [COUNT.toolPickup, 1],
    [COUNT.dormantSealed, 1],
    [COUNT.minedBeam, 50],
    [COUNT.milled, 10],
    [COUNT.studioOpen, 1],
    [COUNT.stage, 6],
    [placedKey('foundation'), 1],
    [COUNT.installedFabricator, 1],
    [COUNT.printedScout, 1],
    [COUNT.drivenM, 200],
    [placedKey('weaponBench'), 1],
    [COUNT.forged, 2],
    [COUNT.equipSidearm, 1],
    [COUNT.fitted, 2],
    [COUNT.harvestPxd, 1],
    [COUNT.drafted, 1],
    [placedKey('bin'), 1],
    [placedKey('airlock'), 1],
    [placedKey('lifeSupport'), 1],
    [placedKey('powerUnit'), 1],
    [placedKey('relayPylon'), 1],
    [COUNT.hydroBasinLit, 1],
    [COUNT.wreckTransponders, 3],
    [COUNT.splicedCores, 1],
    [COUNT.riftOrWaveCleared, 1],
    [COUNT.biosphereStage4, 1],
    [COUNT.horizonDomesSeen, 1],
    [COUNT.consensusCommitted, 1],
    [COUNT.finaleWindowHealed, 1],
  ] as const) {
    c = bump(c, k, v);
  }
  c = syncChain(c, {
    stage: 4,
    drillsRunning: 1,
    machineKinds: ['fabricator'],
    vehicleKinds: ['scout'],
    sidearm: true,
    itemIds: ['bp:cube'],
    hydroBasinLit: true,
    wreckTransponders: 3,
    splicedCores: 1,
    riftOrWaveCleared: true,
    biosphereStage4: true,
    horizonDomesSeen: true,
    consensusCommitted: true,
    finaleWindowHealed: true,
  });
  c = advanceChain(c);

  for (const id of ['A7-01', 'A7-02', 'A7-03', 'A8-01', 'A8-02', 'A8-03', 'A9-01', 'A9-02', 'A9-03']) {
    assert.equal(stepDone(c, id), true, `Expected step ${id} to be done`);
  }
  assert.equal(gateReason('combiner', c, 4), null);
  assert.equal(gateReason('heavyTerraformers', c, 4), null);
  assert.equal(gateReason('consensusTable', c, 4), null);
  assert.equal(gateReason('freeplay', c, 4), null);
});

test('registers hyphenated A7-01..A9-03 and POL-57 barks in packages/narrator/src/fidelity.ts', () => {
  const idRegex = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/;
  const expectedNewIds = [
    'A7-01',
    'A7-02',
    'A7-03',
    'A8-01',
    'A8-02',
    'A8-03',
    'A9-01',
    'A9-02',
    'A9-03',
    'BARK-RECALL',
    'BARK-BROWNOUT',
  ];

  for (const id of expectedNewIds) {
    assert.ok(FIDELITY_LINE_IDS.includes(id), `Missing ${id} in FIDELITY_LINE_IDS`);
    assert.ok(idRegex.test(id), `Line ID ${id} does not match runworld-voice.mjs regex`);
  }

  // Check POL-57 bark helper
  assert.equal(GATE_BASELINE_KW, 12);
  const barkState = evaluatePol57Barks({
    sync0to100: 0,
    wasRecalledToLab: true,
    demandKw: 16,
    capacityKw: 12,
  });
  assert.equal(barkState.shouldPlayRecallBark, true);
  assert.equal(barkState.shouldPlayBrownoutBark, true);

  // Verify narrator rules queue BARK-RECALL and BARK-BROWNOUT on their events
  const rules = fidelityRules({ 'BARK-RECALL': 4.2, 'BARK-BROWNOUT': 4.8 });
  let nState = createNarrator();
  nState = triggerNarrator(rules, nState, 'sync:recall');
  const stepped1 = stepNarrator(rules, nState, 0.1);
  assert.equal(stepped1.start, 'BARK-RECALL');
  assert.ok(FIDELITY_TRIGGERS['act9:finale-handoff']?.includes('A9-03'));
});
