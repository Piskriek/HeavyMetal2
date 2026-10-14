// ============================================================================
// File: packages/questline/src/act789-chain.ts
// Plan: Plan 26 (Acts VII–IX Late-Game Campaign Chain: A7-01 through A9-03)
// Purity: 100% pure deterministic state machine for @hm/questline.
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export type LateCampaignStepId =
  | 'A7-01'
  | 'A7-02'
  | 'A7-03'
  | 'A8-01'
  | 'A8-02'
  | 'A8-03'
  | 'A9-01'
  | 'A9-02'
  | 'A9-03'
  | 'CAMPAIGN-COMPLETE';

export interface LateCampaignStepSpec {
  id: LateCampaignStepId;
  actNumber: 7 | 8 | 9;
  title: string;
  hudInstruction: string;
  keyHintPill: string;
  voiceId: string;
}

export const ACT789_STEPS: Record<Exclude<LateCampaignStepId, 'CAMPAIGN-COMPLETE'>, LateCampaignStepSpec> = {
  'A7-01': {
    id: 'A7-01',
    actNumber: 7,
    title: 'ACT VII // BEYOND TWELVE KILOWATTS',
    hudInstruction: 'Place a dedicated Power Unit (+36 kW) and string Relay Pylons toward the eastern hydro basin.',
    keyHintPill: '[B] Build -> Machines -> [6] Power Unit',
    voiceId: 'A7-01',
  },
  'A7-02': {
    id: 'A7-02',
    actNumber: 7,
    title: 'ACT VII // BASIN CONDENSATION',
    hudInstruction: 'Place a Water Maker (1x1) near the eastern depression and raise Aquatic Level (Aq) to 0.40.',
    keyHintPill: '[B] Build -> Machines -> [5] Water Maker',
    voiceId: 'A7-02',
  },
  'A7-03': {
    id: 'A7-03',
    actNumber: 7,
    title: 'ACT VII // WHEELS & PERIMETER',
    hudInstruction: 'Construct a Vehicle Fabricator, print a Modular Scout Rover, and mount a 2 kW Perimeter Turret.',
    keyHintPill: '[B] Build -> Heavy -> [1] Vehicle Fabricator',
    voiceId: 'A7-03',
  },
  'A8-01': {
    id: 'A8-01',
    actNumber: 8,
    title: 'ACT VIII // HEAVY HARDPOINTS',
    hudInstruction: 'Snap an 8m (2x2) Heavy Pad together and bring a Sheet 17 Heavy Terraformer online.',
    keyHintPill: '[B] Build -> Heavy -> [2/3/4] Heavy Terraformer',
    voiceId: 'A8-01',
  },
  'A8-02': {
    id: 'A8-02',
    actNumber: 8,
    title: 'ACT VIII // VANCE RIDGE & THE COMBINER',
    hudInstruction: 'Recover LOG-08 at North-West Wreck Site Gamma and splice the Golden Master .smx in the Lab Preset Combiner.',
    keyHintPill: 'Drive to NW Ridge -> Hold [E] on Transponder',
    voiceId: 'A8-02',
  },
  'A8-03': {
    id: 'A8-03',
    actNumber: 8,
    title: 'ACT VIII // COVERAGE CREEP',
    hudInstruction: 'Push all four floats above 0.70 so moss, clover, and soil normals lock onto the crater.',
    keyHintPill: 'Slot Fused Cartridges to Boost Plumes 2.5x',
    voiceId: 'A8-03',
  },
  'A9-01': {
    id: 'A9-01',
    actNumber: 9,
    title: 'ACT IX // FULL OPTICAL COHERENCE',
    hudInstruction: 'Reach Stage 6 (all four floats >= 0.85), return to the Lab, and slot the Golden Master into the Planet Table.',
    keyHintPill: 'Walk to Lab Planet Table -> Press [E]',
    voiceId: 'A9-01',
  },
  'A9-02': {
    id: 'A9-02',
    actNumber: 9,
    title: 'ACT IX // COMMITTING THE CONSENSUS BRANCH',
    hudInstruction: 'Pull the Master Sync Lever on the Operator Console and watch the observation window.',
    keyHintPill: 'Operator Console -> Press [E] Master Sync',
    voiceId: 'A9-02',
  },
  'A9-03': {
    id: 'A9-03',
    actNumber: 9,
    title: 'ACT IX // WELCOME HOME TO SECTOR FOUR',
    hudInstruction: 'Earth Window Breach healed. Launching "Four Floats" (v4b @ 144 BPM) credits sequence...',
    keyHintPill: '[Esc] Return to Sandbox Anytime',
    voiceId: 'A9-03',
  },
};

export interface LateCampaignWorldSnapshot {
  floats: FourFloats;
  activePowerUnits: number;
  activeRelayPylons: number;
  activeWaterMakers: number;
  hasBuiltScoutRover: boolean;
  activePerimeterTurrets: number;
  activeHeavyTerraformers: number;
  unlockedLogIds: string[];
  hasSplicedGoldenMaster: boolean;
  hasSlottedGoldenMasterInTable: boolean;
  hasPulledMasterSyncLever: boolean;
  windowHealCompleted: boolean;
}

/**
 * Pure deterministic step evaluator: given current step and world snapshot, returns next step and whether it advanced.
 */
export function evaluateLateCampaignStep(
  currentStep: LateCampaignStepId,
  snap: LateCampaignWorldSnapshot
): { nextStep: LateCampaignStepId; advanced: boolean; triggerCreditsVideo: boolean } {
  switch (currentStep) {
    case 'A7-01':
      if (snap.activePowerUnits >= 1 && snap.activeRelayPylons >= 1) {
        return { nextStep: 'A7-02', advanced: true, triggerCreditsVideo: false };
      }
      break;

    case 'A7-02':
      if (snap.activeWaterMakers >= 1 && snap.floats.Aq >= 0.40) {
        return { nextStep: 'A7-03', advanced: true, triggerCreditsVideo: false };
      }
      break;

    case 'A7-03':
      if (snap.hasBuiltScoutRover && snap.activePerimeterTurrets >= 1) {
        return { nextStep: 'A8-01', advanced: true, triggerCreditsVideo: false };
      }
      break;

    case 'A8-01':
      if (snap.activeHeavyTerraformers >= 1) {
        return { nextStep: 'A8-02', advanced: true, triggerCreditsVideo: false };
      }
      break;

    case 'A8-02':
      if (snap.unlockedLogIds.includes('LOG-08') && snap.hasSplicedGoldenMaster) {
        return { nextStep: 'A8-03', advanced: true, triggerCreditsVideo: false };
      }
      break;

    case 'A8-03': {
      const minFloat = Math.min(snap.floats.Pxd, snap.floats.Vtx, snap.floats.Lx, snap.floats.Aq);
      if (minFloat >= 0.70) {
        return { nextStep: 'A9-01', advanced: true, triggerCreditsVideo: false };
      }
      break;
    }

    case 'A9-01': {
      const minFloat = Math.min(snap.floats.Pxd, snap.floats.Vtx, snap.floats.Lx, snap.floats.Aq);
      if (minFloat >= 0.85 && snap.hasSlottedGoldenMasterInTable) {
        return { nextStep: 'A9-02', advanced: true, triggerCreditsVideo: false };
      }
      break;
    }

    case 'A9-02':
      if (snap.hasPulledMasterSyncLever) {
        return { nextStep: 'A9-03', advanced: true, triggerCreditsVideo: false };
      }
      break;

    case 'A9-03':
      if (snap.windowHealCompleted) {
        return { nextStep: 'CAMPAIGN-COMPLETE', advanced: true, triggerCreditsVideo: true };
      }
      break;

    case 'CAMPAIGN-COMPLETE':
      return { nextStep: 'CAMPAIGN-COMPLETE', advanced: false, triggerCreditsVideo: false };
  }

  return { nextStep: currentStep, advanced: false, triggerCreditsVideo: false };
}
