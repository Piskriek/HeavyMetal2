/**
 * @hm/kitspec 4d Concept Sheet 12 Palette, `mat:` Smart Material Shelf & Planet Environment Map Spec (TICKET-40 v3).
 *
 * Fixes from `OPUS_NOTE_41` & `OPUS_NOTE_42`:
 *  1. Concept Sheet 12 Light Khaki-Beige & Industrial Slate Palette (No Near-Black):
 *     - `hull-steel`: Base `#b8b2a2` (Warm Khaki-Beige painted steel, matching Concept Sheet 12 & `consolemill`
 *       `warmBase = 0xc9c2b4`), Brushed Steel Trim `#8a929a`, and Hazard Amber-Yellow Stripe `#eab308`.
 *     - `accent-hardware`: Base `#4a525a` (Medium-Dark Industrial Slate for hoppers, grilles, and fasteners —
 *       never near-black `#1c2026`), Copper Bus-Bar `#c87d44`, and Metric Status `#22c55e`.
 *  2. Strict TypeScript `Object.freeze<TrimBandSpec[]>([...])` on band arrays (`OPUS_NOTE_41` Item 7).
 *  3. Layered Smart Material Shelf (`mat:<preset id>`, Plan 41 / `@hm/matstack`):
 *     - Defines the 8 canonical `mat:` presets (`MAT_PRESET_SKINS` and `FIRST_MATSTACK_SHELF`) so every
 *       `mat:` material and `slotMaterials` entry in `kit-modules.ts` and `kit-mill-v2.ts` resolves to a
 *       concrete layered material definition with base coat + edge wear + cavity grime + optional rust/moss.
 */
import type { PlacedPart } from '@hm/kitspec';

export type KitTrimMaterialId = 'hull-steel' | 'accent-hardware';
export type HullSteelBandId = 'gunmetal-body' | 'brushed-trim' | 'hazard-band';
export type AccentHardwareBandId = 'anodized-fastener' | 'copper-bus' | 'metric-status';
export type KitTrimBandId = HullSteelBandId | AccentHardwareBandId;

export interface TrimBandSpec {
  readonly id: KitTrimBandId;
  readonly label: string;
  readonly hex: string;
  readonly metalness: number;
  readonly roughness: number;
  readonly emissiveHex?: string;
  readonly emissiveIntensity?: number;
  /** Vertical UV band [v0, v1] in the shared 64x64 trim texture (0..1). */
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
  label: 'Sheet-12 Khaki Body / Brushed Trim / Hazard Band',
  baseHex: '#b8b2a2',
  metalness: 0.28,
  roughness: 0.56,
  bands: Object.freeze<TrimBandSpec[]>([
    {
      id: 'gunmetal-body',
      label: 'Warm Khaki-Beige Painted Housing',
      hex: '#b8b2a2',
      metalness: 0.22,
      roughness: 0.58,
      uvBand: [0.0, 0.55] as const,
    },
    {
      id: 'brushed-trim',
      label: 'Light Brushed Steel Trim',
      hex: '#8a929a',
      metalness: 0.78,
      roughness: 0.36,
      uvBand: [0.55, 0.82] as const,
    },
    {
      id: 'hazard-band',
      label: 'Hazard Amber-Yellow Stripe',
      hex: '#eab308',
      metalness: 0.18,
      roughness: 0.52,
      uvBand: [0.82, 1.0] as const,
    },
  ]),
});

export const ACCENT_HARDWARE_MATERIAL: KitTrimMaterialSpec = Object.freeze({
  id: 'accent-hardware',
  label: 'Sheet-12 Hopper Slate / Copper Bus / Metric Status',
  baseHex: '#4a525a',
  metalness: 0.68,
  roughness: 0.44,
  bands: Object.freeze<TrimBandSpec[]>([
    {
      id: 'anodized-fastener',
      label: 'Industrial Hopper & Fastener Slate',
      hex: '#4a525a',
      metalness: 0.68,
      roughness: 0.46,
      uvBand: [0.0, 0.5] as const,
    },
    {
      id: 'copper-bus',
      label: 'Copper Bus-Bar Conductive Strip',
      hex: '#c87d44',
      metalness: 0.92,
      roughness: 0.32,
      uvBand: [0.5, 0.8] as const,
    },
    {
      id: 'metric-status',
      label: 'Emissive Metric Status Channel',
      hex: '#22c55e',
      metalness: 0.15,
      roughness: 0.3,
      emissiveHex: '#7cff4d',
      emissiveIntensity: 0.95,
      uvBand: [0.8, 1.0] as const,
    },
  ]),
});

export const KIT_TRIM_PALETTE: Readonly<Record<KitTrimMaterialId, KitTrimMaterialSpec>> = Object.freeze({
  'hull-steel': HULL_STEEL_MATERIAL,
  'accent-hardware': ACCENT_HARDWARE_MATERIAL,
});

export const KIT_TRIM_MATERIAL_IDS: readonly KitTrimMaterialId[] = Object.freeze([
  'hull-steel',
  'accent-hardware',
]);

/** Canonical `mat:` layered Smart Material preset IDs (Plan 41 / `@hm/matstack`, TICKET-40 v3). */
export const MAT_PRESET_SKINS = Object.freeze({
  khakiBody: 'mat:khaki-painted-steel',
  brushedTrim: 'mat:brushed-structural-steel',
  darkHopper: 'mat:dark-hopper-iron',
  hazardStripe: 'mat:hazard-chevron',
  copperBus: 'mat:copper-bus-bar',
  rubberSeal: 'mat:rubber-seal',
  slattedGrille: 'mat:slatted-grille-steel',
  crushedOre: 'mat:crushed-ore-bed',
} as const);

/** Backward-compatible alias for callers importing VAULT_KIT_SKINS. */
export const VAULT_KIT_SKINS = Object.freeze({
  warmBody: MAT_PRESET_SKINS.khakiBody,
  brushedTrim: MAT_PRESET_SKINS.brushedTrim,
  hazardStripe: MAT_PRESET_SKINS.hazardStripe,
  copperCoil: MAT_PRESET_SKINS.copperBus,
  darkRubber: MAT_PRESET_SKINS.rubberSeal,
} as const);

export interface MatLayerSpec {
  readonly id: string;
  readonly kind: 'base' | 'edge-wear' | 'cavity-dirt' | 'rust' | 'dust' | 'moss' | 'stripes';
  readonly hex: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly maskStrength: number;
  readonly scale?: number;
}

export interface MatStackPresetSpec {
  readonly id: string;
  readonly label: string;
  readonly baseHex: string;
  readonly layers: readonly MatLayerSpec[];
}

/** The first shelf of Substance-style layered Smart Material presets (`@hm/matstack`). */
export const FIRST_MATSTACK_SHELF: Readonly<Record<string, MatStackPresetSpec>> = Object.freeze({
  'mat:khaki-painted-steel': {
    id: 'mat:khaki-painted-steel',
    label: 'Sheet-12 Khaki Painted Steel (Edge Chipping + Cavity Grime)',
    baseHex: '#b8b2a2',
    layers: [
      { id: 'coat', kind: 'base', hex: '#b8b2a2', roughness: 0.58, metalness: 0.18, maskStrength: 1.0 },
      { id: 'wear', kind: 'edge-wear', hex: '#d4cfc2', roughness: 0.36, metalness: 0.72, maskStrength: 0.42 },
      { id: 'dirt', kind: 'cavity-dirt', hex: '#5c584e', roughness: 0.84, metalness: 0.08, maskStrength: 0.38 },
      { id: 'dust', kind: 'dust', hex: '#9e9788', roughness: 0.88, metalness: 0.04, maskStrength: 0.22 },
    ],
  },
  'mat:brushed-structural-steel': {
    id: 'mat:brushed-structural-steel',
    label: 'Brushed Structural Steel (Machined Edges + Oil Seam)',
    baseHex: '#8a929a',
    layers: [
      { id: 'steel', kind: 'base', hex: '#8a929a', roughness: 0.38, metalness: 0.82, maskStrength: 1.0 },
      { id: 'edge', kind: 'edge-wear', hex: '#b4bcc4', roughness: 0.26, metalness: 0.92, maskStrength: 0.48 },
      { id: 'seam', kind: 'cavity-dirt', hex: '#3d434a', roughness: 0.72, metalness: 0.35, maskStrength: 0.4 },
    ],
  },
  'mat:dark-hopper-iron': {
    id: 'mat:dark-hopper-iron',
    label: 'Heavy Hopper Cast Iron (Abrasion Scratches + Ore Dust)',
    baseHex: '#4a525a',
    layers: [
      { id: 'iron', kind: 'base', hex: '#4a525a', roughness: 0.52, metalness: 0.68, maskStrength: 1.0 },
      { id: 'wear', kind: 'edge-wear', hex: '#7c858e', roughness: 0.34, metalness: 0.85, maskStrength: 0.5 },
      { id: 'rust', kind: 'rust', hex: '#6e4730', roughness: 0.82, metalness: 0.12, maskStrength: 0.24 },
      { id: 'dust', kind: 'dust', hex: '#827b6d', roughness: 0.9, metalness: 0.05, maskStrength: 0.3 },
    ],
  },
  'mat:hazard-chevron': {
    id: 'mat:hazard-chevron',
    label: 'Hazard Chevron Paint (Scuffed Edges + Grime)',
    baseHex: '#eab308',
    layers: [
      { id: 'yellow', kind: 'base', hex: '#eab308', roughness: 0.5, metalness: 0.15, maskStrength: 1.0 },
      { id: 'stripes', kind: 'stripes', hex: '#1f2328', roughness: 0.62, metalness: 0.1, maskStrength: 0.5, scale: 8 },
      { id: 'scuff', kind: 'edge-wear', hex: '#8a929a', roughness: 0.4, metalness: 0.75, maskStrength: 0.35 },
    ],
  },
  'mat:copper-bus-bar': {
    id: 'mat:copper-bus-bar',
    label: 'Conductive Copper Bus-Bar (Polished Contact + Patina)',
    baseHex: '#c87d44',
    layers: [
      { id: 'copper', kind: 'base', hex: '#c87d44', roughness: 0.3, metalness: 0.94, maskStrength: 1.0 },
      { id: 'polish', kind: 'edge-wear', hex: '#e49b62', roughness: 0.2, metalness: 0.98, maskStrength: 0.45 },
      { id: 'patina', kind: 'cavity-dirt', hex: '#4d6b5d', roughness: 0.76, metalness: 0.2, maskStrength: 0.22 },
    ],
  },
  'mat:rubber-seal': {
    id: 'mat:rubber-seal',
    label: 'Vulcanised Rubber Seal & Conduit Jacket',
    baseHex: '#2c3036',
    layers: [
      { id: 'rubber', kind: 'base', hex: '#2c3036', roughness: 0.88, metalness: 0.06, maskStrength: 1.0 },
      { id: 'chalk', kind: 'dust', hex: '#636870', roughness: 0.92, metalness: 0.04, maskStrength: 0.28 },
    ],
  },
  'mat:slatted-grille-steel': {
    id: 'mat:slatted-grille-steel',
    label: 'Galvanised Louvred Grille Steel (Soot Recess + Bright Fins)',
    baseHex: '#737b84',
    layers: [
      { id: 'galv', kind: 'base', hex: '#737b84', roughness: 0.44, metalness: 0.76, maskStrength: 1.0 },
      { id: 'fins', kind: 'edge-wear', hex: '#a3abb4', roughness: 0.3, metalness: 0.88, maskStrength: 0.52 },
      { id: 'soot', kind: 'cavity-dirt', hex: '#2a2e33', roughness: 0.86, metalness: 0.1, maskStrength: 0.46 },
    ],
  },
  'mat:crushed-ore-bed': {
    id: 'mat:crushed-ore-bed',
    label: 'Crushed Regolith & Ore Shards',
    baseHex: '#58544c',
    layers: [
      { id: 'ore', kind: 'base', hex: '#58544c', roughness: 0.92, metalness: 0.08, maskStrength: 1.0 },
      { id: 'glint', kind: 'edge-wear', hex: '#8c8578', roughness: 0.64, metalness: 0.32, maskStrength: 0.36 },
    ],
  },
});

export const SLOT_TRIM_BAND: Readonly<Record<string, KitTrimBandId>> = Object.freeze({
  body: 'gunmetal-body',
  plate: 'gunmetal-body',
  steel: 'gunmetal-body',
  shell: 'gunmetal-body',
  trough: 'gunmetal-body',
  hood: 'gunmetal-body',
  housing: 'gunmetal-body',
  stiles: 'gunmetal-body',
  frame: 'brushed-trim',
  trim: 'brushed-trim',
  flange: 'brushed-trim',
  caps: 'brushed-trim',
  cheeks: 'brushed-trim',
  strap: 'brushed-trim',
  rim: 'brushed-trim',
  rungs: 'brushed-trim',
  hazard: 'hazard-band',
  band: 'hazard-band',
  grip: 'hazard-band',
  metal: 'anodized-fastener',
  bolts: 'anodized-fastener',
  slats: 'anodized-fastener',
  pin: 'anodized-fastener',
  liner: 'anodized-fastener',
  throat: 'anodized-fastener',
  cable: 'anodized-fastener',
  tyre: 'anodized-fastener',
  tread: 'anodized-fastener',
  duct: 'copper-bus',
  pipe: 'copper-bus',
  copper: 'copper-bus',
  ribs: 'copper-bus',
  clips: 'copper-bus',
  gland: 'copper-bus',
  lens: 'metric-status',
  status: 'metric-status',
});

export function isKitTrimMaterial(material: string): material is KitTrimMaterialId {
  return material === 'hull-steel' || material === 'accent-hardware';
}

export function isMatPresetSkin(material: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIRST_MATSTACK_SHELF, material);
}

export function isKitOrVaultMaterial(material: string): boolean {
  return isKitTrimMaterial(material) || isMatPresetSkin(material);
}

/** Remaps an arbitrary box-projected UV pair `(u, v)` into the horizontal `[v0, v1]` band of a trim sheet. */
export function remapUvToTrimBand(
  u: number,
  v: number,
  uvBand: readonly [number, number],
  margin = 0.015,
): [number, number] {
  const vf = v - Math.floor(v);
  const lo = uvBand[0] + margin;
  const hi = uvBand[1] - margin;
  return [u, lo + vf * Math.max(0.01, hi - lo)];
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Builds a deterministic 64x64 RGBA buffer for a `KitTrimMaterialSpec` (diagonal hazard stripes in `hazard-band`). */
export function buildTrimTextureRgba(spec: KitTrimMaterialSpec, width = 64, height = 64): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const band =
      spec.bands.find((b) => v >= b.uvBand[0] && v <= b.uvBand[1]) ??
      spec.bands[spec.bands.length - 1]!;
    const [r, g, b] = parseHexRgb(band.hex);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (band.id === 'hazard-band') {
        const stripe = (x + y) % 16 < 8;
        out[idx] = stripe ? r : 34;
        out[idx + 1] = stripe ? g : 38;
        out[idx + 2] = stripe ? b : 44;
        out[idx + 3] = 255;
      } else {
        const grain = ((x * 7 + y * 13) % 9) - 4;
        out[idx] = Math.max(0, Math.min(255, r + grain));
        out[idx + 1] = Math.max(0, Math.min(255, g + grain));
        out[idx + 2] = Math.max(0, Math.min(255, b + grain));
        out[idx + 3] = 255;
      }
    }
  }
  return out;
}

export interface StageEnvGradient {
  readonly stage: number;
  readonly zenithHex: string;
  readonly horizonHex: string;
  readonly groundHex: string;
  readonly envIntensity: number;
}

export const STAGE_ENV_GRADIENTS: readonly StageEnvGradient[] = Object.freeze([
  { stage: 0, zenithHex: '#28303d', horizonHex: '#64748b', groundHex: '#475569', envIntensity: 0.85 },
  { stage: 1, zenithHex: '#2e3846', horizonHex: '#78879c', groundHex: '#525e6e', envIntensity: 0.9 },
  { stage: 2, zenithHex: '#334155', horizonHex: '#94a3b8', groundHex: '#5b6778', envIntensity: 0.95 },
  { stage: 3, zenithHex: '#3b526b', horizonHex: '#cbd5e1', groundHex: '#64748b', envIntensity: 1.0 },
  { stage: 4, zenithHex: '#3b82f6', horizonHex: '#bae6fd', groundHex: '#5c6b57', envIntensity: 1.05 },
  { stage: 5, zenithHex: '#2563eb', horizonHex: '#e0f2fe', groundHex: '#4d6b38', envIntensity: 1.1 },
  { stage: 6, zenithHex: '#1d4ed8', horizonHex: '#f0f9ff', groundHex: '#42632b', envIntensity: 1.15 },
]);

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
