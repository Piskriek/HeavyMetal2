// ============================================================================
// File: packages/assembler/src/companion-drone-splicer.ts
// Plans: P2-MON-06 (Bio-Spliced Companion Drones) & P2-VEH-06 (Weapon-Tool Hybrids)
// Purity: 100% pure deterministic functions for @hm/assembler.
// ============================================================================

export type CompanionDroneRole = 'harvester' | 'defender';

export interface SplicedCompanionDrone {
  id: string;
  name: string;
  role: CompanionDroneRole;
  patrolRadiusM: number;
  oreGatherPerMin: number;
  sapperClearDps: number;
  accentHex: number;
}

export type WeaponHybridMode = 'scatter-excavator' | 'color-spewer';

export interface WeaponToolHybridSpec {
  id: WeaponHybridMode;
  name: string;
  coneAngleDeg: number;
  brushRadiusMultiplier: number;
   usableFromRoverCab: boolean;
  accentHex: number;
}

export const WEAPON_TOOL_HYBRIDS: Record<WeaponHybridMode, WeaponToolHybridSpec> = {
  'scatter-excavator': {
    id: 'scatter-excavator',
    name: 'Scatter Excavator Cartridge (.smx)',
    coneAngleDeg: 28.0,
    brushRadiusMultiplier: 2.4,
    usableFromRoverCab: true,
    accentHex: 0x7cff4d, // Vtx Green
  },
  'color-spewer': {
    id: 'color-spewer',
    name: 'Chromatic Spewer Cartridge (.smx)',
    coneAngleDeg: 35.0,
    brushRadiusMultiplier: 3.0,
    usableFromRoverCab: true,
    accentHex: 0xff3d8a, // Pxd Pink
  },
};

/**
 * Splices 1 Anomaly Core + 1 Machine Cartridge inside the #b46bff Preset Combiner (P2-MON-06).
 */
export function spliceCompanionDrone(
  anomalyCoreCount: number,
  cartridgeMetric: 'Pxd' | 'Vtx' | 'Lx' | 'Aq' | 'Mix',
  droneIndex = 1
): { drone: SplicedCompanionDrone; remainingCores: number } | null {
  if (anomalyCoreCount < 1) return null;

  const isDefender = cartridgeMetric === 'Lx' || cartridgeMetric === 'Mix';
  const role: CompanionDroneRole = isDefender ? 'defender' : 'harvester';

  return {
    remainingCores: anomalyCoreCount - 1,
    drone: {
      id: `drone-${role}-${droneIndex}`,
      name: isDefender ? 'S-Space Perimeter Sentinel' : 'Regolith Auto-Harvester Drone',
      role,
      patrolRadiusM: 40.0,
      oreGatherPerMin: isDefender ? 4 : 18,
      sapperClearDps: isDefender ? 35 : 10,
      accentHex: isDefender ? 0xffc13d : 0xb46bff,
    },
  };
}
