/**
 * @hm/kitspec 4d Trim-Sheet Palette (ARGO_NOTE_34 §4d, TICKET-39; Concept Sheet 12 via plan 41).
 *
 * Every kit preset draws with at most two shared materials:
 *  1. `hull-steel`: Gunmetal industrial body (#2b3138), brushed steel trim (#5a6572),
 *     and hazard amber-yellow stripe band (#eab308).
 *  2. `accent-hardware`: Dark anodized fastener steel (#1c2026), copper bus-bar conductive
 *     strip (#d97736), and emissive metric status channel.
 *
 * Two more Sheet-12 IDs are in the palette for machines that paint their housings and pour ore
 * through a cast-iron hopper — `khaki-paint` (#b8b2a2, a dielectric, so `metalness` 0) and
 * `hopper-slate` (#3e454d, cast iron, dark ore, rim steel). They are palette entries, not an
 * invitation: a preset still picks at most two, so `mergeBuckets(placed)` produces at most
 * 2 materials x 3 ranks = 6 static draw calls per assembled machine or vehicle. The extra pair
 * exists so a kit can wear a painted housing without pretending paint is steel.
 */
import type { PlacedPart } from '@hm/kitspec';

export type KitTrimMaterialId = 'hull-steel' | 'accent-hardware' | 'khaki-paint' | 'hopper-slate';

export interface TrimBandSpec {
  readonly id: string;
  readonly label: string;
  readonly hex: string;
  readonly metalness: number;
  readonly roughness: number;
  readonly emissiveHex?: string;
  readonly emissiveIntensity?: number;
  /** Vertical UV band [v0, v1] in the shared trim sheet (0..1). */
  readonly uvBand: readonly [number, number];
}

export interface KitTrimMaterialSpec {
  readonly id: KitTrimMaterialId;
  readonly label: string;
  readonly baseHex: string;
  readonly metalness: number;
  readonly roughness: number;
  readonly bands: readonly TrimBandSpec[];
}

export const HULL_STEEL_MATERIAL: KitTrimMaterialSpec = Object.freeze({
  id: 'hull-steel',
  label: 'Hull Steel (Body / Brushed Trim / Hazard Band)',
  baseHex: '#2b3138',
  metalness: 0.88,
  roughness: 0.46,
  bands: Object.freeze([
    {
      id: 'gunmetal-body',
      label: 'Gunmetal Industrial Body',
      hex: '#2b3138',
      metalness: 0.88,
      roughness: 0.48,
      uvBand: [0.0, 0.55] as const,
    },
    {
      id: 'brushed-trim',
      label: 'Brushed Steel Trim',
      hex: '#5a6572',
      metalness: 0.94,
      roughness: 0.34,
      uvBand: [0.55, 0.82] as const,
    },
    {
      id: 'hazard-band',
      label: 'Hazard Amber-Yellow Stripe',
      hex: '#eab308',
      metalness: 0.24,
      roughness: 0.52,
      uvBand: [0.82, 1.0] as const,
    },
  ]),
});

export const ACCENT_HARDWARE_MATERIAL: KitTrimMaterialSpec = Object.freeze({
  id: 'accent-hardware',
  label: 'Accent Hardware (Fasteners / Copper Bus / Metric Status)',
  baseHex: '#1c2026',
  metalness: 0.92,
  roughness: 0.38,
  bands: Object.freeze([
    {
      id: 'anodized-fastener',
      label: 'Dark Anodized Fastener Steel',
      hex: '#1c2026',
      metalness: 0.9,
      roughness: 0.42,
      uvBand: [0.0, 0.5] as const,
    },
    {
      id: 'copper-bus',
      label: 'Copper Bus-Bar Conductive Strip',
      hex: '#d97736',
      metalness: 0.98,
      roughness: 0.28,
      uvBand: [0.5, 0.8] as const,
    },
    {
      id: 'metric-status',
      label: 'Emissive Metric Status Channel',
      hex: '#14181f',
      metalness: 0.15,
      roughness: 0.3,
      emissiveHex: '#7cff4d',
      emissiveIntensity: 0.95,
      uvBand: [0.8, 1.0] as const,
    },
  ]),
});

export const KHAKI_PAINT_MATERIAL: KitTrimMaterialSpec = Object.freeze({
  id: 'khaki-paint',
  label: 'Sheet-12 Warm Khaki-Beige Dielectric Paint',
  baseHex: '#b8b2a2',
  metalness: 0.0,
  roughness: 0.56,
  bands: Object.freeze<TrimBandSpec[]>([
    {
      id: 'khaki-body',
      label: 'Warm Khaki-Beige Painted Housing',
      hex: '#b8b2a2',
      metalness: 0.0,
      roughness: 0.56,
      uvBand: [0.0, 0.55] as const,
    },
    {
      id: 'khaki-trim',
      label: 'Weathered Olive-Grey Trim',
      hex: '#8f8b7c',
      metalness: 0.0,
      roughness: 0.62,
      uvBand: [0.55, 0.82] as const,
    },
    {
      id: 'khaki-hazard',
      label: 'Hazard Amber-Yellow Stripe',
      hex: '#eab308',
      metalness: 0.0,
      roughness: 0.48,
      uvBand: [0.82, 1.0] as const,
    },
  ]),
});

export const HOPPER_SLATE_MATERIAL: KitTrimMaterialSpec = Object.freeze({
  id: 'hopper-slate',
  label: 'Sheet-12 Dark Cast-Iron Hopper & Crushed Ore Bed',
  baseHex: '#3e454d',
  metalness: 0.58,
  roughness: 0.64,
  bands: Object.freeze<TrimBandSpec[]>([
    {
      id: 'hopper-iron',
      label: 'Cast-Iron Hopper Funnel',
      hex: '#3e454d',
      metalness: 0.64,
      roughness: 0.6,
      uvBand: [0.0, 0.5] as const,
    },
    {
      id: 'ore-dark',
      label: 'Crushed Dark Ore Lumps',
      hex: '#26292e',
      metalness: 0.08,
      roughness: 0.92,
      uvBand: [0.5, 0.8] as const,
    },
    {
      id: 'slate-trim',
      label: 'Hopper Rim Steel',
      hex: '#6c7580',
      metalness: 0.76,
      roughness: 0.4,
      uvBand: [0.8, 1.0] as const,
    },
  ]),
});

export const KIT_TRIM_PALETTE: Readonly<Record<KitTrimMaterialId, KitTrimMaterialSpec>> = Object.freeze({
  'hull-steel': HULL_STEEL_MATERIAL,
  'accent-hardware': ACCENT_HARDWARE_MATERIAL,
  'khaki-paint': KHAKI_PAINT_MATERIAL,
  'hopper-slate': HOPPER_SLATE_MATERIAL,
});

export const KIT_TRIM_MATERIAL_IDS: readonly KitTrimMaterialId[] = Object.freeze([
  'hull-steel',
  'accent-hardware',
  'khaki-paint',
  'hopper-slate',
]);

/** The two IDs a machine's body may use — the pair the draw-call budget was set with (at most two a preset). */
export const KIT_PRESET_MATERIAL_IDS: readonly KitTrimMaterialId[] = Object.freeze(['hull-steel', 'accent-hardware']);

export function isKitTrimMaterial(material: string): material is KitTrimMaterialId {
  return (KIT_TRIM_MATERIAL_IDS as readonly string[]).includes(material);
}

/** Unique material IDs referenced by a flattened preset (including any slotMaterials). */
export function presetMaterials(placed: readonly PlacedPart[]): Set<string> {
  const out = new Set<string>();
  for (const p of placed) {
    out.add(p.material);
    if (p.slotMaterials) {
      for (const m of Object.values(p.slotMaterials)) out.add(m);
    }
  }
  return out;
}
