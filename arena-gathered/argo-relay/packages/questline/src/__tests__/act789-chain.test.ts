// ============================================================================
// File: packages/questline/src/__tests__/act789-chain.test.ts
// Plan: Plan 26 Unit Tests for Acts VII–IX Quest Chain
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  ACT789_STEPS,
  evaluateLateCampaignStep,
  type LateCampaignStepId,
  type LateCampaignWorldSnapshot,
} from '../act789-chain';

describe('Acts VII–IX Campaign Quest Chain (Plan 26)', () => {
  it('progresses deterministically from A7-01 through A9-03 and launches the Credits Video', () => {
    expect(Object.keys(ACT789_STEPS)).toHaveLength(9);

    const snap: LateCampaignWorldSnapshot = {
      floats: { Pxd: 0.5, Vtx: 0.5, Lx: 0.5, Aq: 0.2 },
      activePowerUnits: 0,
      activeRelayPylons: 0,
      activeWaterMakers: 0,
      hasBuiltScoutRover: false,
      activePerimeterTurrets: 0,
      activeHeavyTerraformers: 0,
      unlockedLogIds: [],
      hasSplicedGoldenMaster: false,
      hasSlottedGoldenMasterInTable: false,
      hasPulledMasterSyncLever: false,
      windowHealCompleted: false,
    };

    let step: LateCampaignStepId = 'A7-01';

    // Step A7-01 -> A7-02
    snap.activePowerUnits = 1;
    snap.activeRelayPylons = 2;
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A7-02');

    // Step A7-02 -> A7-03
    snap.activeWaterMakers = 1;
    snap.floats.Aq = 0.42;
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A7-03');

    // Step A7-03 -> A8-01
    snap.hasBuiltScoutRover = true;
    snap.activePerimeterTurrets = 1;
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A8-01');

    // Step A8-01 -> A8-02
    snap.activeHeavyTerraformers = 1;
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A8-02');

    // Step A8-02 -> A8-03
    snap.unlockedLogIds.push('LOG-08');
    snap.hasSplicedGoldenMaster = true;
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A8-03');

    // Step A8-03 -> A9-01
    snap.floats = { Pxd: 0.75, Vtx: 0.72, Lx: 0.74, Aq: 0.71 };
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A9-01');

    // Step A9-01 -> A9-02
    snap.floats = { Pxd: 0.90, Vtx: 0.88, Lx: 0.92, Aq: 0.86 };
    snap.hasSlottedGoldenMasterInTable = true;
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A9-02');

    // Step A9-02 -> A9-03
    snap.hasPulledMasterSyncLever = true;
    step = evaluateLateCampaignStep(step, snap).nextStep;
    expect(step).toBe('A9-03');

    // Step A9-03 -> CAMPAIGN-COMPLETE + triggerCreditsVideo
    snap.windowHealCompleted = true;
    const finale = evaluateLateCampaignStep(step, snap);
    expect(finale.nextStep).toBe('CAMPAIGN-COMPLETE');
    expect(finale.triggerCreditsVideo).toBe(true);
  });
});
