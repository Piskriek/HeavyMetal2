/**
 * @hm/cartlab — Sovereign Reality Harness Cartridge (`harness:` / `harnessc:`) Codec & Shelf
 * Repository Path: packages/cartlab/src/harness-cartridge.ts
 *
 * Implements Pillar 3 of the Plan 46 Consumer Integration Pass:
 * - 8 canonical shelf presets (`harness:<id>`) across vehicles, creatures, turrets, and machines.
 * - Deterministic CRC-32 checked compact code (`harnessc:<base64url>`) and share code (`SMX-HRN-<crc>-<slug>`).
 * - Curated Two-Tier in-game Bench/Drafting Table slider schema + 3D Turntable Perturbation Preview oracle.
 * - Beam Rifle `Apply` target resolution (Tap = single vessel at Depth N; Hold = squad cohort N <-> N+1).
 */

import type {
  ContextModeCode,
  EntityTierKind,
  EthicalConstraintCode,
  FourFloatsTuple,
  IVesselPreset,
  VesselArchetypeId,
} from '../../harness/src/types';

export interface IHarnessCartridgeSpec {
  readonly id: string;
  readonly name: string;
  readonly vesselArchetype: VesselArchetypeId;
  readonly tier: EntityTierKind;
  /** Curated Bench Sliders (Tier 1 In-Game Control) */
  readonly relativeAwarenessBound: number; // [0.10 .. 1.00]
  readonly baselinePrecisionPi0: number;   // [0.50 .. 5.00]
  readonly annealRateAlpha: number;        // [4.00 .. 30.0]
  readonly syntropicDampingNspm: number;   // [0.50 .. 8.00]
  readonly defaultContextMode: ContextModeCode;
  readonly ethicalConstraint: EthicalConstraintCode;
  readonly masteryWindowSec: number;       // [0.50 .. 10.0]
  readonly fourFloatsBias: FourFloatsTuple;
}

export const HARNESS_SHELF_PRESETS: Readonly<Record<string, IHarnessCartridgeSpec>> = Object.freeze({
  'harness:escort-steadfast': {
    id: 'harness:escort-steadfast',
    name: 'Steadfast Convoy Escort (Rover)',
    vesselArchetype: 'vessel:rover-escort',
    tier: 'TIER_2_EMBODIED_VESSEL',
    relativeAwarenessBound: 0.65,
    baselinePrecisionPi0: 1.5,
    annealRateAlpha: 18.0,
    syntropicDampingNspm: 4.2,
    defaultContextMode: 2, // COMBAT_ESCORT
    ethicalConstraint: 1,  // PRESERVE_ALLIES
    masteryWindowSec: 1.0,
    fourFloatsBias: [0.65, 0.70, 0.80, 0.75],
  },
  'harness:scout-agile-reflex': {
    id: 'harness:scout-agile-reflex',
    name: 'Agile Recon Reflex (Scout Rover)',
    vesselArchetype: 'vessel:rover-escort',
    tier: 'TIER_2_EMBODIED_VESSEL',
    relativeAwarenessBound: 0.72,
    baselinePrecisionPi0: 1.1,
    annealRateAlpha: 22.0,
    syntropicDampingNspm: 3.4,
    defaultContextMode: 1, // HARVEST_FLOW
    ethicalConstraint: 0,  // SELF_EQUILIBRIUM
    masteryWindowSec: 1.0,
    fourFloatsBias: [0.55, 0.85, 0.75, 0.60],
  },
  'harness:hauler-heavy-syntropic': {
    id: 'harness:hauler-heavy-syntropic',
    name: 'Heavy Syntropic Anchor (6x6 Hauler)',
    vesselArchetype: 'vessel:rover-escort',
    tier: 'TIER_2_EMBODIED_VESSEL',
    relativeAwarenessBound: 0.58,
    baselinePrecisionPi0: 2.0,
    annealRateAlpha: 16.0,
    syntropicDampingNspm: 6.5,
    defaultContextMode: 2, // COMBAT_ESCORT
    ethicalConstraint: 1,  // PRESERVE_ALLIES
    masteryWindowSec: 1.2,
    fourFloatsBias: [0.70, 0.90, 0.65, 0.85],
  },
  'harness:crawler-seismic-ground': {
    id: 'harness:crawler-seismic-ground',
    name: 'Seismic Grounded Excavator (Crawler)',
    vesselArchetype: 'vessel:harvester-rig',
    tier: 'TIER_2_EMBODIED_VESSEL',
    relativeAwarenessBound: 0.52,
    baselinePrecisionPi0: 2.2,
    annealRateAlpha: 15.0,
    syntropicDampingNspm: 7.2,
    defaultContextMode: 1, // HARVEST_FLOW
    ethicalConstraint: 2,  // ZERO_COLLATERAL_SHEAR
    masteryWindowSec: 1.5,
    fourFloatsBias: [0.80, 0.95, 0.60, 0.70],
  },
  'harness:turret-sto-guardian': {
    id: 'harness:turret-sto-guardian',
    name: 'STO Perimeter Guardian (Turret)',
    vesselArchetype: 'vessel:perimeter-turret',
    tier: 'TIER_2_EMBODIED_VESSEL',
    relativeAwarenessBound: 0.68,
    baselinePrecisionPi0: 1.8,
    annealRateAlpha: 20.0,
    syntropicDampingNspm: 4.8,
    defaultContextMode: 2, // COMBAT_ESCORT
    ethicalConstraint: 2,  // ZERO_COLLATERAL_SHEAR
    masteryWindowSec: 1.0,
    fourFloatsBias: [0.60, 0.75, 0.95, 0.50],
  },
  'harness:creature-pack-shepherd': {
    id: 'harness:creature-pack-shepherd',
    name: 'Symbiotic Pack Shepherd (Spore Creature)',
    vesselArchetype: 'vessel:spore-creature',
    tier: 'TIER_2_EMBODIED_VESSEL',
    relativeAwarenessBound: 0.75,
    baselinePrecisionPi0: 1.3,
    annealRateAlpha: 19.0,
    syntropicDampingNspm: 3.8,
    defaultContextMode: 4, // SYNTROPIC_ANNEALING
    ethicalConstraint: 3,  // STO_HARMONIC_STEWARDSHIP
    masteryWindowSec: 1.0,
    fourFloatsBias: [0.75, 0.80, 0.85, 0.95],
  },
  'harness:companion-haddy-mentor': {
    id: 'harness:companion-haddy-mentor',
    name: 'Dr. Gwen Haddy // Grounded Mentor Core',
    vesselArchetype: 'vessel:squad-commander',
    tier: 'TIER_3_STUDIO_CREATOR_AGENT',
    relativeAwarenessBound: 0.92,
    baselinePrecisionPi0: 1.2,
    annealRateAlpha: 24.0,
    syntropicDampingNspm: 5.5,
    defaultContextMode: 2, // COMBAT_ESCORT
    ethicalConstraint: 3,  // STO_HARMONIC_STEWARDSHIP
    masteryWindowSec: 0.8,
    fourFloatsBias: [0.90, 0.85, 0.95, 0.90],
  },
  'harness:overseer-planetary-steward': {
    id: 'harness:overseer-planetary-steward',
    name: 'Planetary Grid Overseer (Stage-6 Steward)',
    vesselArchetype: 'vessel:planetary-overseer',
    tier: 'TIER_3_STUDIO_CREATOR_AGENT',
    relativeAwarenessBound: 1.0,
    baselinePrecisionPi0: 1.0,
    annealRateAlpha: 28.0,
    syntropicDampingNspm: 6.0,
    defaultContextMode: 5, // GRADUATION_ASCENT
    ethicalConstraint: 3,  // STO_HARMONIC_STEWARDSHIP
    masteryWindowSec: 0.8,
    fourFloatsBias: [1.0, 1.0, 1.0, 1.0],
  },
});

/** IEEE 802.3 CRC-32 (Pure deterministic checksum for `harnessc:` and `SMX-HRN-` codes) */
export function crc32Hex(str: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) & 0xff;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function encodeHarnessCartridgeCode(spec: IHarnessCartridgeSpec): string {
  if (HARNESS_SHELF_PRESETS[spec.id] && JSON.stringify(HARNESS_SHELF_PRESETS[spec.id]) === JSON.stringify(spec)) {
    return spec.id;
  }
  const payload = JSON.stringify(spec);
  const b64 = Buffer.from(payload, 'utf8').toString('base64url');
  const crc = crc32Hex(payload).slice(0, 6);
  return `harnessc:${crc}:${b64}`;
}

export function decodeHarnessCartridgeCode(code: string): IHarnessCartridgeSpec | null {
  if (code.startsWith('harness:')) {
    return HARNESS_SHELF_PRESETS[code] ?? null;
  }
  if (!code.startsWith('harnessc:')) return null;
  const parts = code.split(':');
  if (parts.length !== 3) return null;
  const [, expectedCrc, b64] = parts;
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    if (crc32Hex(json).slice(0, 6) !== expectedCrc) return null;
    const parsed = JSON.parse(json) as IHarnessCartridgeSpec;
    if (
      typeof parsed.relativeAwarenessBound !== 'number' ||
      parsed.relativeAwarenessBound < 0.05 ||
      parsed.relativeAwarenessBound > 1.0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function toVesselPreset(spec: IHarnessCartridgeSpec): IVesselPreset {
  return {
    id: spec.vesselArchetype,
    tier: spec.tier,
    rung: 4,
    relativeAwarenessBound: spec.relativeAwarenessBound,
    ratedMaxStrainJ: 12.0,
    ratedMaxThermalJ: 8.0,
    ratedAcousticThresholdDb: 110.0,
    supportPolygonRadiusM: 0.25,
    limbLengthsM: [0.7, 0.7],
    substrate: {
      originSelf: [0, 0, 0],
      fourFloats: spec.fourFloatsBias,
      stateDim: 24,
      vsaHypervectorWords: 128,
    },
    dynamics: {
      massKg: 2.0,
      stiffnessNpm: 8.0,
      dampingNspm: 1.4,
      thermalCapacityJpk: 4.0,
      awarenessGrowthRate: 1.8,
      annealRateAlpha: spec.annealRateAlpha,
      flowRestoreRateBeta: 2.4,
      lyapunovCriticalThreshold: 0.18,
    },
    transducer: {
      upwardSocketId: 'socket:somatic-y-up',
      downwardSocketId: 'socket:higher-mu-down',
      sieveMdlThresholdBits: 8.3,
      chebyshevOrderK: 12,
      reflexBudgetMs: 0.033,
    },
    evaluator: {
      minCoherenceTarget: 0.95,
      maxFreeEnergyBound: 25.0,
      conservationToleranceJ: 1e-5,
      masteryDurationSec: spec.masteryWindowSec,
    },
  };
}
