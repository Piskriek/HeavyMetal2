// ============================================================================
// File: packages/beamkit/src/hybrid-cartridge-modes.ts
// TICKET-21 (P2-VEH-06 — Beam Rifle Hybrid Cartridge Modes):
// When a spliced Weapon+Tool hybrid cartridge from the Preset Combiner is
// slotted into the Extraction Beam Rifle's port, it unlocks two specialized
// wide-area hybrid modes:
// 1. 'scatter-excavator' (Weapon Scatter + Sculpt Carve): wide-cone excavation
//    stroke (`radius = 5.55 m`, `strength = 1.65`) that blasts out regolith
//    and harvests ore across a 1.85x radius cone.
// 2. 'color-spewer' (Weapon Scatter + Apply Paint): rapid wide-radius terrain
//    paint (`radius = 6.6 m`, `strength = 2.4`) that floods cells with the
//    spliced preset's material palette.
// ============================================================================

export type HybridCartridgeKind = 'scatter-excavator' | 'color-spewer';

export interface HybridCartridgeSpec {
  readonly kind: HybridCartridgeKind;
  readonly id: string;
  readonly name: string;
  readonly radiusMultiplier: number;
  readonly strengthMultiplier: number;
  /** Underlying preset id painted in 'color-spewer' mode. */
  readonly paintPreset: string;
  readonly beamHex: string;
}

export const HYBRID_CARTRIDGES: Readonly<Record<HybridCartridgeKind, HybridCartridgeSpec>> = {
  'scatter-excavator': {
    kind: 'scatter-excavator',
    id: 'hybrid:scatter-excavator',
    name: 'Scatter Excavator (Hybrid Carve)',
    radiusMultiplier: 1.85,
    strengthMultiplier: 1.65,
    paintPreset: 'scree',
    beamHex: '#7cff4d',
  },
  'color-spewer': {
    kind: 'color-spewer',
    id: 'hybrid:color-spewer',
    name: 'Color Spewer (Hybrid Paint)',
    radiusMultiplier: 2.2,
    strengthMultiplier: 2.4,
    paintPreset: 'moss',
    beamHex: '#ff3d8a',
  },
};

/**
 * Inspects a cartridge ID in the Beam Rifle's port and returns its `HybridCartridgeSpec`
 * if it is a spliced Weapon+Tool hybrid (`hybrid:scatter-excavator`, `scatter-excavator`,
 * `hybrid:color-spewer`, or `color-spewer:<preset>`), or `null` for standard cartridges.
 */
export function resolveHybridCartridge(cartridge: string | null | undefined): HybridCartridgeSpec | null {
  if (typeof cartridge !== 'string' || !cartridge.trim()) return null;
  const clean = cartridge.trim().toLowerCase();
  if (clean === 'hybrid:scatter-excavator' || clean === 'scatter-excavator') {
    return HYBRID_CARTRIDGES['scatter-excavator'];
  }
  if (clean === 'hybrid:color-spewer' || clean === 'color-spewer') {
    return HYBRID_CARTRIDGES['color-spewer'];
  }
  if (clean.startsWith('hybrid:color-spewer:') || clean.startsWith('color-spewer:')) {
    const preset = cartridge.trim().split(':').pop()?.trim() || 'moss';
    return {
      ...HYBRID_CARTRIDGES['color-spewer'],
      paintPreset: preset,
    };
  }
  return null;
}

export function isHybridCartridge(cartridge: string | null | undefined): boolean {
  return resolveHybridCartridge(cartridge) !== null;
}
