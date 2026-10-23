/**
 * @hm/kitspec 4d Trim-Sheet Palette, Vault Material Skins & Planet Environment Map Spec (TICKET-40).
 *
 * Rulings (ARGO_NOTE_40):
 *  1. Trim Bands + Vault Skins:
 *     - Base kit materials `hull-steel` and `accent-hardware` each carry a 64x64 procedural banded
 *       trim texture (3 vertical V-bands, with diagonal yellow/black hazard chevrons in the top band
 *       of `hull-steel`), and `remapUvToTrimBand()` maps 1 m box UVs into the slot's assigned V-band
 *       with zero extra draw calls.
 *     - Hero body and trim slots can also wear `vault:<preset id>` Texture Mill materials
 *       (e.g. `vault:painted-iron`, `vault:brushed-steel`, `vault:copper-coil`), evaluated on Medium/High.
 *  2. Planet Environment Map (Lifting the 0.35 Metalness Cap):
 *     - `STAGE_ENV_GRADIENTS` defines a lightweight 64x32 equirectangular sky/horizon/ground gradient
 *       per Stage (0..6) for `THREE.PMREMGenerator`, costing < 16 KB VRAM and allowing true PBR metals
 *       (`metalness` up to 0.94) on the planet without drawing black.
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

export const KIT_TRIM_PALETTE: Readonly<Record<KitTrimMaterialId, KitTrimMaterialSpec>> = Object.freeze({
  'hull-steel': HULL_STEEL_MATERIAL,
  'accent-hardware': ACCENT_HARDWARE_MATERIAL,
});

export const KIT_TRIM_MATERIAL_IDS: readonly KitTrimMaterialId[] = Object.freeze([
  'hull-steel',
  'accent-hardware',
]);

/** Canonical `@hm/vault` material skins used on from-scratch kit machines (TICKET-40 §5). */
export const VAULT_KIT_SKINS = Object.freeze({
  warmBody: 'vault:painted-iron',
  brushedTrim: 'vault:brushed-steel',
  hazardStripe: 'vault:hazard-stripe',
  copperCoil: 'vault:copper-coil',
  darkRubber: 'vault:dark-rubber',
} as const);

/** Default slot-to-band mapping so 1 m box UVs map into the 64x64 banded trim texture without adding draw calls. */
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

export function isVaultMaterialSkin(material: string): boolean {
  return material.startsWith('vault:') && material.length > 6;
}

export function isKitOrVaultMaterial(material: string): boolean {
  return isKitTrimMaterial(material) || isVaultMaterialSkin(material);
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
        out[idx] = stripe ? r : 20;
        out[idx + 1] = stripe ? g : 22;
        out[idx + 2] = stripe ? b : 26;
        out[idx + 3] = 255;
      } else {
        // Subtle deterministic brushed grain (+/- 4/255)
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

/**
 * Lightweight 64x32 equirectangular sky/horizon/ground gradient per Stage (0..6) for the planet's
 * `THREE.PMREMGenerator` environment map, so true PBR metals (`metalness` up to 0.94) reflect the
 * stage sky and horizon instead of drawing black (ARGO_NOTE_40 palette question 2).
 */
export interface StageEnvGradient {
  readonly stage: number;
  readonly zenithHex: string;
  readonly horizonHex: string;
  readonly groundHex: string;
  readonly envIntensity: number;
}

export const STAGE_ENV_GRADIENTS: readonly StageEnvGradient[] = Object.freeze([
  { stage: 0, zenithHex: '#181c24', horizonHex: '#4b5563', groundHex: '#272b33', envIntensity: 0.75 },
  { stage: 1, zenithHex: '#1e2430', horizonHex: '#64748b', groundHex: '#333942', envIntensity: 0.8 },
  { stage: 2, zenithHex: '#283548', horizonHex: '#7c8ea6', groundHex: '#3f4652', envIntensity: 0.85 },
  { stage: 3, zenithHex: '#334e68', horizonHex: '#9fb3c8', groundHex: '#4a5568', envIntensity: 0.9 },
  { stage: 4, zenithHex: '#3b82f6', horizonHex: '#bae6fd', groundHex: '#4b5e47', envIntensity: 0.95 },
  { stage: 5, zenithHex: '#2563eb', horizonHex: '#e0f2fe', groundHex: '#3f6212', envIntensity: 1.0 },
  { stage: 6, zenithHex: '#1d4ed8', horizonHex: '#f0f9ff', groundHex: '#365314', envIntensity: 1.05 },
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
