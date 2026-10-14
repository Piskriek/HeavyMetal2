// ============================================================================
// File: packages/questline/src/act789-chain.ts
// Fix: 100% pure @hm/questline module (DOM helper moved out to apps/web/src/shell/custom-label-dom-patcher.ts)
// ============================================================================

import type { FourFloats } from '../../groundshader/src/stage-post.glsl';

export interface Act789QuestStep {
  id: 'A7-01' | 'A7-02' | 'A8-01' | 'A8-02' | 'A9-01';
  act: 7 | 8 | 9;
  title: string;
  objectiveText: string;
  haddyVoiceId: string;
  isComplete: (state: Act789ProgressInput) => boolean;
}

export interface Act789ProgressInput {
  powerUnitsBuilt: number;
  lightProjectorsRunning: number;
  waterMakersRunning: number;
  splicedCoresCreated: number;
  consensusBranchSubmitted: boolean;
  localS: FourFloats;
}

export const ACT_789_QUEST_CHAIN: Act789QuestStep[] = [
  {
    id: 'A7-01',
    act: 7,
    title: 'Expand the Lunar Grid',
    objectiveText:
      'Construct a field Power Unit (+250 kW) to support high-flux emitters without brownout.',
    haddyVoiceId: 'BARK-05-BROWNOUT',
    isComplete: (st) => st.powerUnitsBuilt >= 1,
  },
  {
    id: 'A7-02',
    act: 7,
    title: 'Ignite the Sky & Flood the Basin',
    objectiveText:
      'Run a Light Projector and Water Maker until Lx >= 0.65 and Aq >= 0.40 (Stage 3 Hydrology).',
    haddyVoiceId: 'BARK-03-STAGE3-WATER',
    isComplete: (st) =>
      st.lightProjectorsRunning >= 1 &&
      st.waterMakersRunning >= 1 &&
      st.localS.Lx >= 0.65 &&
      st.localS.Aq >= 0.4,
  },
  {
    id: 'A8-01',
    act: 8,
    title: 'Substrate Synthesis',
    objectiveText:
      'Use the Lab Preset Combiner (#b46bff) to fuse two cartridges or synthesize a peaceful Anomaly Core.',
    haddyVoiceId: 'BARK-08-PEACEFUL-CORE',
    isComplete: (st) => st.splicedCoresCreated >= 1,
  },
  {
    id: 'A8-02',
    act: 8,
    title: 'Full PBR Biosphere (Stage 4–6)',
    objectiveText:
      'Raise all four floats S = (Pxd, Vtx, Lx, Aq) above 0.85 to bloom L-system forests and grazing fauna.',
    haddyVoiceId: 'BARK-10-STAGE6-HERO',
    isComplete: (st) =>
      st.localS.Pxd >= 0.85 &&
      st.localS.Vtx >= 0.85 &&
      st.localS.Lx >= 0.85 &&
      st.localS.Aq >= 0.75,
  },
  {
    id: 'A9-01',
    act: 9,
    title: 'Majority Consensus Reality',
    objectiveText:
      'Inspect the Planet Table hologram and commit your stabilized plot branch to the planetary lattice.',
    haddyVoiceId: 'BARK-04-NEIGHBOR-DOME',
    isComplete: (st) => st.consensusBranchSubmitted,
  },
];

export interface CustomResourceLabels {
  dirtLabel: string;
  oreLabel: string;
}

export function formatCustomSchemaDiffToast(
  key: 'dirt' | 'ore',
  newValue: string
): {
  toastHeadline: string;
  sanitizedLabel: string;
} {
  const sanitized = newValue.trim().slice(0, 24) || (key === 'dirt' ? 'Dirt' : 'Ore');
  return {
    toastHeadline: `SUBSTRATE PATCH APPLIED // 14 HUD REFERENCES UPDATED ("${sanitized}")`,
    sanitizedLabel: sanitized,
  };
}
