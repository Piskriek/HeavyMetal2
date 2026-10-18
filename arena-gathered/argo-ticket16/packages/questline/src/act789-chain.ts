// ============================================================================
// File: packages/questline/src/act789-chain.ts
// TASK-35 / TICKET-16: Pure Act VII–IX Campaign Step Definitions, Predicates,
// 12 kW Brownout & 0% Sync Recall Bark Triggers (POL-57), and 11-Enclave
// Continental Consensus Math (POL-70).
// Rules: Rule 1 (Four floats), Rule 2 (100% pure: no DOM, no Date.now(), no Math.random()),
//        Rule 23 (Peaceful Aggression: 'off' | 'calm' parity with combat).
// ============================================================================

export interface FourFloats {
  readonly Pxd: number;
  readonly Vtx: number;
  readonly Lx: number;
  readonly Aq: number;
}

export type Act789StepId =
  | 'A7-01'
  | 'A7-02'
  | 'A7-03'
  | 'A8-01'
  | 'A8-02'
  | 'A8-03'
  | 'A9-01'
  | 'A9-02'
  | 'A9-03';

export type AggressionMode = 'off' | 'calm' | 'normal' | 'fierce';

/** The Twin Gate's baseline power feed in kilowatts (Brief 26 / Brief 35). */
export const GATE_BASELINE_KW = 12.0;
/** Number of distant neighbor enclave domes visible on the 4.2 km lunar horizon (POL-70). */
export const NEIGHBOR_ENCLAVE_COUNT = 11;
/** Distance in metres from the plot centre to the horizon enclave ring (Brief 35). */
export const HORIZON_DOME_DISTANCE_M = 4200.0;
/** Continental consensus fraction required to unlock the Planet Table commit lever (A9-02). */
export const CONSENSUS_LOCK_THRESHOLD = 0.85;
/** Duration in seconds of the Lab observation window golden-hour heal before CreditsDirector.start() (A9-03). */
export const FINALE_WINDOW_HEAL_DURATION_S = 12.0;

export interface Act789ProgressInput {
  readonly powerUnitsBuilt: number;
  readonly relayPylonsBuilt?: number;
  readonly lightProjectorsRunning: number;
  readonly waterMakersRunning: number;
  readonly wreckTranspondersSalvaged?: number;
  readonly splicedCoresCreated: number;
  readonly riftsSealed?: number;
  readonly wavesCleared?: number;
  readonly aggression?: AggressionMode;
  readonly horizonDomesInspected?: boolean;
  readonly consensusBranchSubmitted: boolean;
  readonly finaleWindowHealed?: boolean;
  readonly localS: FourFloats;
}

export interface Act789QuestStep {
  readonly id: Act789StepId;
  readonly act: 7 | 8 | 9;
  readonly title: string;
  readonly objectiveText: string;
  readonly haddyVoiceId: Act789StepId;
  readonly triggerEvent: string;
  readonly isComplete: (state: Act789ProgressInput) => boolean;
}

/** Pure helper checking whether Stage 4+ Full PBR Biosphere thresholds hold on all four floats. */
export function isBiosphereCoherent(s: FourFloats): boolean {
  return s.Pxd >= 0.85 && s.Vtx >= 0.85 && s.Lx >= 0.85 && s.Aq >= 0.75;
}

/**
 * Pure peaceful + combat parity check for A8-02 (Rule 23):
 * Players on `Aggression: 'off' | 'calm'` complete A8-02 by sealing a rift OR synthesizing at least 1 core,
 * while combat players can either seal a rift OR clear a sapper/brute wave.
 */
export function isAct8RiftOrWaveComplete(state: Act789ProgressInput): boolean {
  const rifts = state.riftsSealed ?? 0;
  const waves = state.wavesCleared ?? 0;
  if (rifts >= 1 || waves >= 1) return true;
  if ((state.aggression === 'off' || state.aggression === 'calm') && state.splicedCoresCreated >= 1) {
    return true;
  }
  return false;
}

export const ACT_789_QUEST_CHAIN: readonly Act789QuestStep[] = Object.freeze([
  {
    id: 'A7-01',
    act: 7,
    title: 'Break the 12 kW Ceiling',
    objectiveText:
      'Build a field Power Unit and wire a Relay Pylon after the Gate’s 12 kW feed browns out.',
    haddyVoiceId: 'A7-01',
    triggerEvent: 'act7:power-unit',
    isComplete: (st) => st.powerUnitsBuilt >= 1 && (st.relayPylonsBuilt ?? 1) >= 1,
  },
  {
    id: 'A7-02',
    act: 7,
    title: 'Ignite the Sky & Flood the Basin',
    objectiveText:
      'Run a Light Projector and Water Maker until Lx >= 0.65 and Aq >= 0.40 (Stage 3 Hydrology).',
    haddyVoiceId: 'A7-02',
    triggerEvent: 'act7:hydro-basin',
    isComplete: (st) =>
      st.lightProjectorsRunning >= 1 &&
      st.waterMakersRunning >= 1 &&
      st.localS.Lx >= 0.65 &&
      st.localS.Aq >= 0.4,
  },
  {
    id: 'A7-03',
    act: 7,
    title: 'The Crater Rim Transponders',
    objectiveText:
      'Drive the Scout Rover to the perimeter wrecks and salvage 3 Lunar Wreck Transponders.',
    haddyVoiceId: 'A7-03',
    triggerEvent: 'act7:wreck-transponders',
    isComplete: (st) => (st.wreckTranspondersSalvaged ?? 0) >= 3,
  },
  {
    id: 'A8-01',
    act: 8,
    title: 'Substrate Synthesis',
    objectiveText:
      'Use the Lab Preset Combiner (#b46bff) to fuse a dual-metric cartridge or peaceful Anomaly Core.',
    haddyVoiceId: 'A8-01',
    triggerEvent: 'act8:combiner-splice',
    isComplete: (st) => st.splicedCoresCreated >= 1,
  },
  {
    id: 'A8-02',
    act: 8,
    title: 'Hold the Line or Seal the Rift',
    objectiveText:
      'Seal an active perimeter rift with the Beam Tool or suppress a perimeter wave with a turret or weapon.',
    haddyVoiceId: 'A8-02',
    triggerEvent: 'act8:rift-or-wave',
    isComplete: isAct8RiftOrWaveComplete,
  },
  {
    id: 'A8-03',
    act: 8,
    title: 'Full PBR Biosphere',
    objectiveText:
      'Raise all four floats to Stage 4+ (Pxd >= 0.85, Vtx >= 0.85, Lx >= 0.85, Aq >= 0.75) to bloom forests.',
    haddyVoiceId: 'A8-03',
    triggerEvent: 'act8:biosphere',
    isComplete: (st) => isBiosphereCoherent(st.localS),
  },
  {
    id: 'A9-01',
    act: 9,
    title: 'Eleven Lights on the Horizon',
    objectiveText:
      'Spot the 11 neighbor enclave domes glowing on the 4.2 km lunar horizon and return to the Lab.',
    haddyVoiceId: 'A9-01',
    triggerEvent: 'act9:horizon-domes',
    isComplete: (st) =>
      isBiosphereCoherent(st.localS) && (st.horizonDomesInspected ?? st.consensusBranchSubmitted),
  },
  {
    id: 'A9-02',
    act: 9,
    title: 'Majority Consensus (85%+)',
    objectiveText:
      'Press E on the Lab Planet Table once continental consensus reaches >= 85% to commit your branch.',
    haddyVoiceId: 'A9-02',
    triggerEvent: 'act9:consensus-commit',
    isComplete: (st) => st.consensusBranchSubmitted,
  },
  {
    id: 'A9-03',
    act: 9,
    title: 'See You, Sector Four',
    objectiveText:
      'Watch the Lab observation window heal into golden hour as "Four Floats" (144 BPM) begins.',
    haddyVoiceId: 'A9-03',
    triggerEvent: 'act9:finale-handoff',
    isComplete: (st) => Boolean(st.finaleWindowHealed && st.consensusBranchSubmitted),
  },
]);

// ----------------------------------------------------------------------------
// POL-57: Pure Triggers for 0% Sync Recall & 12 kW Gate Brownout Barks
// ----------------------------------------------------------------------------

export interface Pol57BarkCheck {
  readonly shouldPlayRecallBark: boolean;
  readonly shouldPlayBrownoutBark: boolean;
  readonly recallLineId: 'BARK-RECALL';
  readonly brownoutLineId: 'BARK-BROWNOUT';
}

export function evaluatePol57Barks(input: {
  readonly sync0to100: number;
  readonly wasRecalledToLab: boolean;
  readonly demandKw: number;
  readonly capacityKw: number;
}): Pol57BarkCheck {
  const safeCap = Math.max(GATE_BASELINE_KW, input.capacityKw);
  return {
    shouldPlayRecallBark: input.wasRecalledToLab || input.sync0to100 <= 0,
    shouldPlayBrownoutBark: input.demandKw > safeCap && input.demandKw > GATE_BASELINE_KW,
    recallLineId: 'BARK-RECALL',
    brownoutLineId: 'BARK-BROWNOUT',
  };
}

// ----------------------------------------------------------------------------
// POL-70: Pure 11-Enclave Continental Consensus & Horizon Dome Math
// ----------------------------------------------------------------------------

export interface HorizonEnclaveSpec {
  readonly index: number;
  readonly sectorLabel: string;
  readonly azimuthRad: number;
  readonly distanceM: number;
  readonly x: number;
  readonly z: number;
  readonly dominantMetric: 'Pxd' | 'Vtx' | 'Lx' | 'Aq';
  readonly accentHex: string;
  readonly readiness0to1: number;
  readonly lit: boolean;
}

const METRIC_ORDER: readonly ('Pxd' | 'Vtx' | 'Lx' | 'Aq')[] = ['Pxd', 'Vtx', 'Lx', 'Aq'];
const METRIC_HEX: Readonly<Record<'Pxd' | 'Vtx' | 'Lx' | 'Aq', string>> = {
  Pxd: '#ff3d8a',
  Vtx: '#7cff4d',
  Lx: '#ffc13d',
  Aq: '#3dc8ff',
};

/**
 * Computes the 11 neighbor enclave domes on the 4.2 km lunar horizon and the
 * Continental Consensus fraction (0..1, locking at >= 0.85 when all 4 floats hit Stage 4+).
 */
export function evaluateContinentalConsensus(localS: FourFloats): {
  readonly consensus0to1: number;
  readonly consensusPct: number;
  readonly isReadyToCommit: boolean;
  readonly litDomeCount: number;
  readonly domes: readonly HorizonEnclaveSpec[];
} {
  const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  const p = clamp01(localS.Pxd);
  const v = clamp01(localS.Vtx);
  const l = clamp01(localS.Lx);
  const a = clamp01(localS.Aq);
  const meanS = (p + v + l + a) / 4;

  // When the player reaches Stage 4 biosphere coherence (Pxd,Vtx,Lx >= 0.85, Aq >= 0.75 -> mean >= 0.825),
  // continental consensus across the 12-enclave ring reaches >= 85.0%.
  const biocoherent = isBiosphereCoherent(localS);
  const rawConsensus = biocoherent ? Math.max(0.86, meanS * 1.02) : meanS * 0.96;
  const consensus0to1 = Number(Math.min(1, rawConsensus).toFixed(4));
  const consensusPct = Number((consensus0to1 * 100).toFixed(1));

  const domes: HorizonEnclaveSpec[] = [];
  let litDomeCount = 0;

  for (let i = 0; i < NEIGHBOR_ENCLAVE_COUNT; i++) {
    const azimuthRad = Number(((i * Math.PI * 2) / NEIGHBOR_ENCLAVE_COUNT + 0.18).toFixed(4));
    const x = Number((Math.cos(azimuthRad) * HORIZON_DOME_DISTANCE_M).toFixed(2));
    const z = Number((Math.sin(azimuthRad) * HORIZON_DOME_DISTANCE_M).toFixed(2));
    const dominantMetric = METRIC_ORDER[i % 4]!;
    const threshold = 0.25 + (i / NEIGHBOR_ENCLAVE_COUNT) * 0.52;
    const readiness0to1 = Number(clamp01((meanS - threshold * 0.4) / 0.6).toFixed(3));
    const lit = meanS >= 0.45 || biocoherent;
    if (lit) litDomeCount++;

    domes.push({
      index: i + 1,
      sectorLabel: i + 1 === 4 ? 'SECTOR #04 (VANCE)' : `SECTOR #${String(i + 1).padStart(2, '0')}`,
      azimuthRad,
      distanceM: HORIZON_DOME_DISTANCE_M,
      x,
      z,
      dominantMetric,
      accentHex: biocoherent ? '#b46bff' : METRIC_HEX[dominantMetric],
      readiness0to1,
      lit,
    });
  }

  return {
    consensus0to1,
    consensusPct,
    isReadyToCommit: consensus0to1 >= CONSENSUS_LOCK_THRESHOLD && biocoherent,
    litDomeCount,
    domes,
  };
}

export interface CustomResourceLabels {
  readonly dirtLabel: string;
  readonly oreLabel: string;
}

export function formatCustomSchemaDiffToast(
  key: 'dirt' | 'ore',
  newValue: string,
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
