/**
 * @hm/kitspec 4d Trim Palette, `@hm/matstack` Smart Material First Shelf & Planet Environment Map Spec (TICKET-40 v4 / Plan 41).
 *
 * Fixes & Rulings (`OPUS_NOTE_41` v3 & `OPUS_NOTE_42` / `41-layered-materials.md`):
 *  1. Keep `hull-steel` meaning steel (`#5a636e` gunmetal steel / `#8a929a` brushed steel / `#eab308` hazard band)
 *     and `accent-hardware` meaning dark hardware (`#363d45` fastener slate / `#c87d44` copper bus / `#22c55e` status),
 *     while adding dedicated Concept Sheet 12 palette IDs `khaki-paint` (`#b8b2a2`) and `hopper-slate` (`#4a525a`)
 *     until all kits retire the trim palette in favour of `mat:` presets.
 *  2. Strict TypeScript `Object.freeze<TrimBandSpec[]>([...])` on all band arrays (`OPUS_NOTE_41` Item 7).
 *  3. Support `lx:<kelvin>:<intensity>:<pattern>[:<hex>]` emissive lamp & cartridge-slot materials via `isLxMaterial`.
 *  4. Re-export the `@hm/matstack` shelves (`SURFACE_SHELF`, `MASK_SHELF`, `LAYER_SHELF`, `FIRST_MATSTACK_SHELF`)
 *     without `flattenMeshFaces` (since `@hm/matstack` `index.ts` provides `flattenMesh`).
 */
import type { PlacedPart } from '@hm/kitspec';
import type {
  LayerSpec,
  MaskSpec,
  MaterialSpec,
  SurfaceSpec,
} from '@hm/matstack';

export type KitTrimMaterialId = 'hull-steel' | 'accent-hardware' | 'khaki-paint' | 'hopper-slate';
export type HullSteelBandId = 'gunmetal-body' | 'brushed-trim' | 'hazard-band';
export type AccentHardwareBandId = 'anodized-fastener' | 'copper-bus' | 'metric-status';
export type KhakiPaintBandId = 'khaki-body' | 'khaki-trim' | 'khaki-hazard';
export type HopperSlateBandId = 'hopper-iron' | 'ore-dark' | 'slate-trim';
export type KitTrimBandId =
  | HullSteelBandId
  | AccentHardwareBandId
  | KhakiPaintBandId
  | HopperSlateBandId;

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
  label: 'Structural Hull Steel / Brushed Trim / Hazard Band',
  baseHex: '#6c7580',
  metalness: 0.72,
  roughness: 0.42,
  bands: Object.freeze<TrimBandSpec[]>([
    {
      id: 'gunmetal-body',
      label: 'Structural Hull Steel',
      hex: '#6c7580',
      metalness: 0.72,
      roughness: 0.44,
      uvBand: [0.0, 0.55] as const,
    },
    {
      id: 'brushed-trim',
      label: 'Light Brushed Steel Trim',
      hex: '#8a929a',
      metalness: 0.82,
      roughness: 0.34,
      uvBand: [0.55, 0.82] as const,
    },
    {
      id: 'hazard-band',
      label: 'Hazard Amber-Yellow Stripe',
      hex: '#eab308',
      metalness: 0.0,
      roughness: 0.48,
      uvBand: [0.82, 1.0] as const,
    },
  ]),
});

export const ACCENT_HARDWARE_MATERIAL: KitTrimMaterialSpec = Object.freeze({
  id: 'accent-hardware',
  label: 'Anodized Fastener Slate / Copper Bus / Metric Status',
  baseHex: '#4a525a',
  metalness: 0.68,
  roughness: 0.44,
  bands: Object.freeze<TrimBandSpec[]>([
    {
      id: 'anodized-fastener',
      label: 'Anodized Fastener & Grille Slate',
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
      metalness: 0.0,
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

export const KIT_PRESET_MATERIAL_IDS: readonly KitTrimMaterialId[] = Object.freeze([
  'hull-steel',
  'accent-hardware',
]);


/** Canonical `mat:` layered Smart Material preset IDs (Plan 41 §4.9 / `OPUS_NOTE_42` item 3). */
export const MAT_PRESET_SKINS = Object.freeze({
  khakiBody: 'mat:field-worn-hazard',
  brushedTrim: 'mat:workshop-steel',
  darkHopper: 'mat:rust-bucket',
  hazardStripe: 'mat:hazard-chevron',
  copperBus: 'mat:old-copper',
  rubberSeal: 'mat:rubber-seal',
  slattedGrille: 'mat:slatted-grille-steel',
  crushedOre: 'mat:crushed-ore-bed',
} as const);

/** Canonical `lx:<kelvin>:<intensity>:<pattern>[:<hex>]` emissive lamp & slot materials (Plan 39 / `OPUS_NOTE_41` v3 item 4). */
export const LX_LIGHT_MATERIALS = Object.freeze({
  millStatusLamp: 'lx:3200:1.6:steady:ff4d3d',
  doorStatusLamp: 'lx:3500:1.4:steady:ffc13d',
  powerStatusLamp: 'lx:4200:1.4:steady:7cff4d',
  cartridgeSlotPink: 'lx:6500:1.2:steady:ff4fd8',
} as const);

/** Backward-compatible alias for callers importing VAULT_KIT_SKINS. */
export const VAULT_KIT_SKINS = Object.freeze({
  warmBody: MAT_PRESET_SKINS.khakiBody,
  brushedTrim: MAT_PRESET_SKINS.brushedTrim,
  hazardStripe: MAT_PRESET_SKINS.hazardStripe,
  copperCoil: MAT_PRESET_SKINS.copperBus,
  darkRubber: MAT_PRESET_SKINS.rubberSeal,
} as const);

// ------------------------------------------------------------------ 1. SURFACES (Plan 41 §4.9)

export const BASE_SURFACE_SHELF: Readonly<Record<string, SurfaceSpec>> = Object.freeze({
  'bare-steel': {
    name: 'Bare steel',
    colour: '#8a929a',
    metal: 0.88,
    rough: 0.42,
    specular: 0.5,
    tile: { tile: 'brushed-metal', scale: 0.5, bump: 0.15, roughVar: 0.12, colourVar: 0.06 },
  },
  'brushed-stainless': {
    name: 'Brushed stainless',
    colour: '#b4bcc4',
    metal: 0.92,
    rough: 0.34,
    specular: 0.5,
    tile: { tile: 'brushed-metal', scale: 0.35, bump: 0.12, roughVar: 0.1, colourVar: 0.05 },
    aniso: { amount: 0.65, axis: 'u' },
  },
  'galvanised': {
    name: 'Galvanised',
    colour: '#9ca4ac',
    ramp: [
      { at: 0.0, colour: '#788088' },
      { at: 0.5, colour: '#a4acb4' },
      { at: 1.0, colour: '#c2cad2' },
    ],
    metal: 0.82,
    rough: 0.48,
    specular: 0.5,
    tile: { tile: 'cells', scale: 0.18, bump: 0.08, roughVar: 0.18, colourVar: 0.14 },
  },
  'cast-iron': {
    name: 'Cast iron',
    colour: '#4a525a',
    metal: 0.78,
    rough: 0.64,
    specular: 0.5,
    tile: { tile: 'cast-iron', scale: 0.4, bump: 0.28, roughVar: 0.16, colourVar: 0.08 },
    detail: { tile: 'pits', scale: 0.08, bump: 0.35, roughVar: 0.2 },
  },
  'anodised-aluminium': {
    name: 'Anodised aluminium',
    colour: 'paint1',
    metal: 0.76,
    rough: 0.36,
    specular: 0.5,
    tile: { tile: 'fine-grain', scale: 0.25, bump: 0.06, roughVar: 0.08, colourVar: 0.04 },
  },
  'copper': {
    name: 'Copper and brass',
    colour: '#c87d4b',
    metal: 0.92,
    rough: 0.32,
    specular: 0.5,
    tile: { tile: 'brushed-metal', scale: 0.4, bump: 0.1, roughVar: 0.1, colourVar: 0.06 },
  },
  'powder-coat': {
    name: 'Powder coat',
    colour: 'paint1',
    metal: 0.0,
    rough: 0.54,
    specular: 0.5,
    detail: { tile: 'orange-peel', scale: 0.06, bump: 0.18, roughVar: 0.12 },
  },
  'enamel': {
    name: 'Enamel',
    colour: 'paint1',
    metal: 0.0,
    rough: 0.28,
    specular: 0.55,
    coat: { amount: 0.85, rough: 0.08 },
  },
  'hazard-paint': {
    name: 'Hazard paint',
    colour: 'paint2',
    ramp: [
      { at: 0.0, colour: '#1f2328' },
      { at: 0.48, colour: '#1f2328' },
      { at: 0.52, colour: '#eab308' },
      { at: 1.0, colour: '#eab308' },
    ],
    metal: 0.0,
    rough: 0.46,
    specular: 0.5,
    tile: { tile: 'stripes', scale: 0.24, bump: 0.05, roughVar: 0.06, colourVar: 0.0 },
  },
  'rubber': {
    name: 'Rubber',
    colour: '#2d333b',
    metal: 0.0,
    rough: 0.86,
    specular: 0.35,
    tile: { tile: 'rubber-grain', scale: 0.2, bump: 0.22, roughVar: 0.1, colourVar: 0.04 },
  },
  'concrete': {
    name: 'Concrete',
    colour: '#26292e',
    metal: 0.0,
    rough: 0.92,
    specular: 0.3,
    tile: { tile: 'concrete', scale: 0.8, bump: 0.38, roughVar: 0.16, colourVar: 0.12 },
    detail: { tile: 'pits', scale: 0.12, bump: 0.25, roughVar: 0.14 },
  },
  'carbon-fibre': {
    name: 'Carbon fibre',
    colour: '#22262b',
    metal: 0.0,
    rough: 0.36,
    specular: 0.55,
    tile: { tile: 'carbon-weave', scale: 0.08, bump: 0.2, roughVar: 0.18, colourVar: 0.12 },
    coat: { amount: 0.9, rough: 0.06 },
    aniso: { amount: 0.45, axis: 'u' },
  },
  'ceramic-insulator': {
    name: 'Ceramic insulator',
    colour: '#d8d4cc',
    metal: 0.0,
    rough: 0.24,
    specular: 0.6,
    coat: { amount: 0.92, rough: 0.05 },
  },
  'lab-composite': {
    name: 'Lab composite',
    colour: 'paint1',
    metal: 0.0,
    rough: 0.4,
    specular: 0.5,
    tile: { tile: 'hex-micro', scale: 0.16, bump: 0.1, roughVar: 0.08, colourVar: 0.04 },
    coat: { amount: 0.35, rough: 0.18 },
  },
});

export const WEATHERING_SURFACE_SHELF: Readonly<Record<string, SurfaceSpec>> = Object.freeze({
  'rust': {
    name: 'Rust',
    colour: '#7a3e22',
    ramp: [
      { at: 0.0, colour: '#4a2212' },
      { at: 0.5, colour: '#7a3e22' },
      { at: 1.0, colour: '#b85d28' },
    ],
    metal: 0.04,
    rough: 0.88,
    specular: 0.35,
    tile: { tile: 'cells', scale: 0.35, bump: 0.42, roughVar: 0.18, colourVar: 0.2 },
    detail: { tile: 'pits', scale: 0.09, bump: 0.35, roughVar: 0.15 },
  },
  'heavy-scale': {
    name: 'Heavy scale',
    colour: '#3d281e',
    ramp: [
      { at: 0.0, colour: '#2a1c16' },
      { at: 0.6, colour: '#4d3022' },
      { at: 1.0, colour: '#72442b' },
    ],
    metal: 0.12,
    rough: 0.92,
    specular: 0.3,
    tile: { tile: 'flake-scale', scale: 0.28, bump: 0.65, roughVar: 0.22, colourVar: 0.18 },
  },
  'verdigris': {
    name: 'Verdigris',
    colour: '#4e8c7a',
    ramp: [
      { at: 0.0, colour: '#2f594d' },
      { at: 0.5, colour: '#4e8c7a' },
      { at: 1.0, colour: '#78b8a4' },
    ],
    metal: 0.05,
    rough: 0.82,
    specular: 0.4,
    tile: { tile: 'cells', scale: 0.3, bump: 0.28, roughVar: 0.16, colourVar: 0.15 },
  },
  'grime': {
    name: 'Grime',
    colour: '#38342e',
    metal: 0.0,
    rough: 0.86,
    specular: 0.3,
    tile: { tile: 'grime-clouds', scale: 0.55, bump: 0.12, roughVar: 0.16, colourVar: 0.14 },
  },
  'dust': {
    name: 'Dust',
    colour: '#9c9282',
    metal: 0.0,
    rough: 0.92,
    specular: 0.25,
    fuzz: { amount: 0.65, colour: '#b8ae9e' },
  },
  'regolith': {
    name: 'Regolith',
    colour: '#948e84',
    metal: 0.0,
    rough: 0.94,
    specular: 0.22,
    tile: { tile: 'regolith-grain', scale: 0.4, bump: 0.2, roughVar: 0.1, colourVar: 0.08 },
    fuzz: { amount: 0.78, colour: '#b2aba0' },
  },
  'soot': {
    name: 'Soot',
    colour: '#1c1e22',
    metal: 0.0,
    rough: 0.95,
    specular: 0.2,
    fuzz: { amount: 0.4, colour: '#2a2d32' },
  },
  'oil': {
    name: 'Oil',
    colour: '#1e1b18',
    metal: 0.0,
    rough: 0.14,
    specular: 0.65,
    coat: { amount: 0.95, rough: 0.06 },
    film: { amount: 0.35, thickness: 480 },
  },
  'heat-tint': {
    name: 'Heat tint',
    colour: '#8a7258',
    metal: 0.85,
    rough: 0.36,
    specular: 0.5,
    film: { amount: 0.82, thickness: 520 },
  },
  'moss': {
    name: 'Moss',
    colour: '#466832',
    ramp: [
      { at: 0.0, colour: '#2d4720' },
      { at: 0.5, colour: '#466832' },
      { at: 1.0, colour: '#688f48' },
    ],
    metal: 0.0,
    rough: 0.92,
    specular: 0.25,
    tile: { tile: 'moss-clump', scale: 0.25, bump: 0.48, roughVar: 0.14, colourVar: 0.18 },
    fuzz: { amount: 0.85, colour: '#6e964c' },
  },
  'frost': {
    name: 'Frost',
    colour: '#dce8f2',
    metal: 0.0,
    rough: 0.62,
    specular: 0.6,
    tile: { tile: 'frost-crystal', scale: 0.22, bump: 0.3, roughVar: 0.2, colourVar: 0.1 },
    fuzz: { amount: 0.55, colour: '#eef6fc' },
  },
  'mud': {
    name: 'Mud',
    colour: '#4a3b2c',
    metal: 0.0,
    rough: 0.72,
    specular: 0.42,
    tile: { tile: 'mud-splatter', scale: 0.45, bump: 0.38, roughVar: 0.22, colourVar: 0.14 },
    coat: { amount: 0.3, rough: 0.24 },
  },
  'limescale': {
    name: 'Limescale',
    colour: '#c8c4b8',
    metal: 0.0,
    rough: 0.84,
    specular: 0.35,
    tile: { tile: 'mineral-crust', scale: 0.3, bump: 0.34, roughVar: 0.16, colourVar: 0.12 },
  },
  'scorch': {
    name: 'Scorch',
    colour: '#24201e',
    metal: 0.05,
    rough: 0.88,
    specular: 0.25,
    tile: { tile: 'scorch-burn', scale: 0.5, bump: 0.24, roughVar: 0.18, colourVar: 0.16 },
  },
  'bright-metal': {
    name: 'Bright metal',
    colour: '#b8c0c8',
    metal: 0.94,
    rough: 0.28,
    specular: 0.5,
    tile: { tile: 'scratches', scale: 0.3, bump: 0.14, roughVar: 0.12, colourVar: 0.06 },
  },
});

export const SURFACE_SHELF: Readonly<Record<string, SurfaceSpec>> = Object.freeze({
  ...BASE_SURFACE_SHELF,
  ...WEATHERING_SURFACE_SHELF,
});

// ------------------------------------------------------------------ 2. MASKS (Plan 41 §4.9)

export const MASK_SHELF: Readonly<Record<string, MaskSpec>> = Object.freeze({
  'everywhere': {
    name: 'Everywhere',
    inputs: [{ kind: 'all', blend: 'normal', opacity: 1.0, invert: false }],
    balance: 0.0,
    contrast: 0.0,
    invert: false,
  },
  'edge-chips': {
    name: 'Edge chips',
    inputs: [
      { kind: 'edge', width: 0.028, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'cells', scale: 0.22, seed: 11, blend: 'multiply', opacity: 0.55, invert: false },
    ],
    balance: 0.28,
    contrast: 0.72,
    invert: false,
  },
  'worn-edges': {
    name: 'Worn edges',
    inputs: [
      { kind: 'edge', width: 0.042, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.35, seed: 23, blend: 'multiply', opacity: 0.38, invert: false },
    ],
    balance: 0.22,
    contrast: 0.52,
    invert: false,
  },
  'crevices': {
    name: 'Crevices',
    inputs: [
      { kind: 'cavity', width: 0.048, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.4, seed: 37, blend: 'multiply', opacity: 0.35, invert: false },
    ],
    balance: 0.24,
    contrast: 0.56,
    invert: false,
  },
  'tops': {
    name: 'Tops',
    inputs: [
      { kind: 'up', angle: 52, soft: 24, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.6, seed: 41, blend: 'multiply', opacity: 0.32, invert: false },
    ],
    balance: 0.2,
    contrast: 0.42,
    invert: false,
  },
  'undersides': {
    name: 'Undersides',
    inputs: [
      { kind: 'down', angle: 55, soft: 25, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'clouds', scale: 0.5, seed: 53, blend: 'multiply', opacity: 0.35, invert: false },
    ],
    balance: 0.2,
    contrast: 0.48,
    invert: false,
  },
  'splash-zone': {
    name: 'Splash zone',
    inputs: [
      { kind: 'ground', height: 0.65, soft: 0.35, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'speckle', scale: 0.35, seed: 67, blend: 'multiply', opacity: 0.45, invert: false },
    ],
    balance: 0.25,
    contrast: 0.55,
    invert: false,
  },
  'drips': {
    name: 'Drips',
    inputs: [
      { kind: 'streaks', scale: 0.28, stretch: 4.5, seed: 79, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'cavity', width: 0.045, blend: 'add', opacity: 0.45, invert: false },
    ],
    balance: 0.18,
    contrast: 0.62,
    invert: false,
  },
  'patches': {
    name: 'Patches',
    inputs: [
      { kind: 'noise', noise: 'clouds', scale: 0.65, seed: 83, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'noise', noise: 'cells', scale: 0.28, seed: 89, blend: 'multiply', opacity: 0.45, invert: false },
    ],
    balance: 0.24,
    contrast: 0.68,
    invert: false,
  },
  'pitting': {
    name: 'Pitting',
    inputs: [
      { kind: 'noise', noise: 'cells', scale: 0.18, seed: 97, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'cavity', width: 0.045, blend: 'add', opacity: 0.55, invert: false },
    ],
    balance: 0.26,
    contrast: 0.74,
    invert: false,
  },
  'scratches': {
    name: 'Scratches',
    inputs: [
      { kind: 'noise', noise: 'scratches', scale: 0.32, seed: 103, blend: 'normal', opacity: 1.0, invert: false },
      { kind: 'edge', width: 0.048, blend: 'add', opacity: 0.5, invert: false },
    ],
    balance: 0.22,
    contrast: 0.76,
    invert: false,
  },
});

// ------------------------------------------------------------------ 3. LAYERS (Plan 41 §4.9)

export const LAYER_SHELF: Readonly<Record<string, LayerSpec>> = Object.freeze({
  'edge-wear': {
    name: 'Edge wear',
    surface: SURFACE_SHELF['bright-metal']!,
    mask: MASK_SHELF['worn-edges']!,
    opacity: 0.88,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat'],
    heightBlend: 0.2,
    weathering: true,
    visible: true,
  },
  'paint-chips': {
    name: 'Paint chips',
    surface: SURFACE_SHELF['bare-steel']!,
    mask: MASK_SHELF['edge-chips']!,
    opacity: 0.92,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat'],
    heightBlend: 0.35,
    weathering: true,
    visible: true,
  },
  'rust-bloom': {
    name: 'Rust bloom',
    surface: SURFACE_SHELF['rust']!,
    mask: MASK_SHELF['pitting']!,
    opacity: 0.82,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.55,
    weathering: true,
    visible: true,
  },
  'rust-streaks': {
    name: 'Rust streaks',
    surface: SURFACE_SHELF['rust']!,
    mask: MASK_SHELF['drips']!,
    opacity: 0.76,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.4,
    weathering: true,
    visible: true,
  },
  'heavy-rust': {
    name: 'Heavy rust',
    surface: SURFACE_SHELF['heavy-scale']!,
    mask: MASK_SHELF['patches']!,
    opacity: 0.9,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.65,
    weathering: true,
    visible: true,
  },
  'dirt': {
    name: 'Dirt',
    surface: SURFACE_SHELF['mud']!,
    mask: MASK_SHELF['splash-zone']!,
    opacity: 0.8,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.45,
    weathering: true,
    visible: true,
  },
  'grime': {
    name: 'Grime',
    surface: SURFACE_SHELF['grime']!,
    mask: MASK_SHELF['crevices']!,
    opacity: 0.78,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.3,
    weathering: true,
    visible: true,
  },
  'dust': {
    name: 'Dust',
    surface: SURFACE_SHELF['dust']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.72,
    writes: ['colour', 'metal', 'rough', 'specular', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.15,
    weathering: true,
    visible: true,
  },
  'moon-dust': {
    name: 'Moon dust',
    surface: SURFACE_SHELF['regolith']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.84,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.25,
    weathering: true,
    visible: true,
  },
  'oil-leaks': {
    name: 'Oil leaks',
    surface: SURFACE_SHELF['oil']!,
    mask: MASK_SHELF['drips']!,
    opacity: 0.78,
    writes: ['colour', 'rough', 'specular', 'coat', 'film'],
    heightBlend: 0.15,
    weathering: true,
    visible: true,
  },
  'soot': {
    name: 'Soot',
    surface: SURFACE_SHELF['soot']!,
    mask: MASK_SHELF['undersides']!,
    opacity: 0.82,
    writes: ['colour', 'metal', 'rough', 'specular', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.2,
    weathering: true,
    visible: true,
  },
  'heat-tint': {
    name: 'Heat tint',
    surface: SURFACE_SHELF['heat-tint']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.8,
    writes: ['colour', 'rough', 'film'],
    heightBlend: 0.0,
    weathering: true,
    visible: true,
  },
  'verdigris': {
    name: 'Verdigris',
    surface: SURFACE_SHELF['verdigris']!,
    mask: MASK_SHELF['crevices']!,
    opacity: 0.84,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'aniso'],
    heightBlend: 0.45,
    weathering: true,
    visible: true,
  },
  'moss': {
    name: 'Moss',
    surface: SURFACE_SHELF['moss']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.88,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.55,
    weathering: true,
    visible: true,
  },
  'frost': {
    name: 'Frost',
    surface: SURFACE_SHELF['frost']!,
    mask: MASK_SHELF['tops']!,
    opacity: 0.86,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso'],
    heightBlend: 0.4,
    weathering: true,
    visible: true,
  },
  'scratches': {
    name: 'Scratches',
    surface: SURFACE_SHELF['bright-metal']!,
    mask: MASK_SHELF['scratches']!,
    opacity: 0.85,
    writes: ['colour', 'metal', 'rough', 'specular', 'height', 'coat'],
    heightBlend: 0.25,
    weathering: true,
    visible: true,
  },
});

// ------------------------------------------------------------------ 4. MATERIALS (Plan 41 §4.9)

const FIELD_WORN_HAZARD: MaterialSpec = {
  name: 'Field-worn hazard',
  base: SURFACE_SHELF['powder-coat']!,
  paint: ['#b8b2a2', '#eab308'],
  layers: [
    LAYER_SHELF['grime']!,
    LAYER_SHELF['rust-bloom']!,
    LAYER_SHELF['dirt']!,
    LAYER_SHELF['paint-chips']!,
    LAYER_SHELF['edge-wear']!,
  ],
  age: 0.48,
};

const WORKSHOP_STEEL: MaterialSpec = {
  name: 'Workshop steel',
  base: SURFACE_SHELF['bare-steel']!,
  paint: ['#8a929a', '#eab308'],
  layers: [
    LAYER_SHELF['grime']!,
    LAYER_SHELF['oil-leaks']!,
    LAYER_SHELF['scratches']!,
    LAYER_SHELF['edge-wear']!,
  ],
  age: 0.42,
};

const RUST_BUCKET: MaterialSpec = {
  name: 'Rust bucket',
  base: SURFACE_SHELF['cast-iron']!,
  paint: ['#4a525a', '#b85d28'],
  layers: [
    LAYER_SHELF['grime']!,
    LAYER_SHELF['rust-bloom']!,
    LAYER_SHELF['rust-streaks']!,
    LAYER_SHELF['heavy-rust']!,
    LAYER_SHELF['edge-wear']!,
  ],
  age: 0.68,
};

const OLD_COPPER: MaterialSpec = {
  name: 'Old copper',
  base: SURFACE_SHELF['copper']!,
  paint: ['#c87d4b', '#4e8c7a'],
  layers: [
    LAYER_SHELF['grime']!,
    LAYER_SHELF['verdigris']!,
    LAYER_SHELF['scratches']!,
    LAYER_SHELF['edge-wear']!,
  ],
  age: 0.5,
};

/**
 * The First Shelf of `@hm/matstack` Smart Materials (`MaterialSpec`), covering all 12 Plan 41 §4.9
 * materials plus the 4 machine-detail presets and backward-compatible aliases.
 */
export const FIRST_MATSTACK_SHELF: Readonly<Record<string, MaterialSpec>> = Object.freeze({
  'mat:lab-fresh': {
    name: 'Lab fresh',
    base: SURFACE_SHELF['lab-composite']!,
    paint: ['#e2e6ec', '#3dc8ff'],
    layers: [LAYER_SHELF['grime']!, LAYER_SHELF['edge-wear']!],
    age: 0.15,
  },
  'mat:workshop-steel': WORKSHOP_STEEL,
  'mat:field-worn-hazard': FIELD_WORN_HAZARD,
  'mat:moon-dusted': {
    name: 'Moon-dusted',
    base: SURFACE_SHELF['powder-coat']!,
    paint: ['#b8b2a2', '#3dc8ff'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['moon-dust']!,
      LAYER_SHELF['scratches']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.58,
  },
  'mat:rust-bucket': RUST_BUCKET,
  'mat:furnace': {
    name: 'Furnace',
    base: SURFACE_SHELF['cast-iron']!,
    paint: ['#3c4248', '#ff5a1f'],
    layers: [
      LAYER_SHELF['heat-tint']!,
      LAYER_SHELF['soot']!,
      LAYER_SHELF['heavy-rust']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.62,
  },
  'mat:old-copper': OLD_COPPER,
  'mat:oily-engine': {
    name: 'Oily engine',
    base: SURFACE_SHELF['cast-iron']!,
    paint: ['#4a525a', '#eab308'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['soot']!,
      LAYER_SHELF['oil-leaks']!,
      LAYER_SHELF['scratches']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.55,
  },
  'mat:overgrown-relic': {
    name: 'Overgrown relic',
    base: SURFACE_SHELF['powder-coat']!,
    paint: ['#8f9688', '#688f48'],
    layers: [
      LAYER_SHELF['rust-bloom']!,
      LAYER_SHELF['heavy-rust']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['moss']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.76,
  },
  'mat:frozen-rig': {
    name: 'Frozen rig',
    base: SURFACE_SHELF['enamel']!,
    paint: ['#6c889c', '#dce8f2'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['frost']!,
      LAYER_SHELF['paint-chips']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.64,
  },
  'mat:brushed-lab-steel': {
    name: 'Brushed lab steel',
    base: SURFACE_SHELF['brushed-stainless']!,
    paint: ['#b4bcc4', '#3dc8ff'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['scratches']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.28,
  },
  'mat:carbon-racer': {
    name: 'Carbon racer',
    base: SURFACE_SHELF['carbon-fibre']!,
    paint: ['#22262b', '#ff3d8a'],
    layers: [
      LAYER_SHELF['dust']!,
      LAYER_SHELF['scratches']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.22,
  },
  'mat:hazard-chevron': {
    name: 'Hazard chevron',
    base: SURFACE_SHELF['hazard-paint']!,
    paint: ['#b8b2a2', '#eab308'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['paint-chips']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.45,
  },
  'mat:rubber-seal': {
    name: 'Rubber seal',
    base: SURFACE_SHELF['rubber']!,
    paint: ['#2d333b', '#948e84'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['moon-dust']!,
    ],
    age: 0.4,
  },
  'mat:slatted-grille-steel': {
    name: 'Slatted grille steel',
    base: SURFACE_SHELF['galvanised']!,
    paint: ['#788088', '#38342e'],
    layers: [
      LAYER_SHELF['grime']!,
      LAYER_SHELF['soot']!,
      LAYER_SHELF['rust-bloom']!,
      LAYER_SHELF['edge-wear']!,
    ],
    age: 0.52,
  },
  'mat:crushed-ore-bed': {
    name: 'Crushed ore bed',
    base: SURFACE_SHELF['concrete']!,
    paint: ['#26292e', '#4a3b2c'],
    layers: [
      LAYER_SHELF['heavy-rust']!,
      LAYER_SHELF['dirt']!,
      LAYER_SHELF['moon-dust']!,
    ],
    age: 0.7,
  },
  // Aliases for earlier slot keys
  'mat:khaki-painted-steel': FIELD_WORN_HAZARD,
  'mat:brushed-structural-steel': WORKSHOP_STEEL,
  'mat:dark-hopper-iron': RUST_BUCKET,
  'mat:copper-bus-bar': OLD_COPPER,
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

const LX_MATERIAL_RE = /^lx:\d+(?:\.\d+)?:\d+(?:\.\d+)?:[a-z]+(?::[0-9a-fA-F]{6})?$/;

export function isKitTrimMaterial(material: string): material is KitTrimMaterialId {
  return (
    material === 'hull-steel' ||
    material === 'accent-hardware' ||
    material === 'khaki-paint' ||
    material === 'hopper-slate'
  );
}

export function isMatPresetSkin(material: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIRST_MATSTACK_SHELF, material);
}

export function isLxMaterial(material: string): boolean {
  return LX_MATERIAL_RE.test(material);
}

export function isKitOrVaultMaterial(material: string): boolean {
  return isKitTrimMaterial(material) || isMatPresetSkin(material) || isLxMaterial(material);
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

/** Builds a deterministic 64x64 RGBA buffer for a `KitTrimMaterialSpec` (diagonal hazard stripes in hazard bands). */
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
      if (band.id === 'hazard-band' || band.id === 'khaki-hazard') {
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
