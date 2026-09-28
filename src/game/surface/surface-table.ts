/**
 * NewRoads · Phase 1.1 / Phase 4 — the surface palette and its gameplay table.
 *
 * A painted surface is a **material ID** (0–255), never a colour or a texture handle. The mask
 * (`surface-mask.ts`) stores two IDs and a blend weight per texel; the shader (`road-surface-paint.ts`)
 * turns an ID into pixels with `sampleSurface(id)`; the physics turns the same ID into grip and
 * rolling resistance with `SURFACE_TABLE[id]`. Because the ID survives from brush to wheel, a baked
 * texture is never the source of truth (plan §3.2, §4).
 *
 * **Surface 0 is the road as it is today.** An unpainted texel is `{0, 0, 0, 0}` and renders nothing
 * (the overlay is transparent there), so every existing course is pixel-identical until someone paints.
 *
 * Pure TypeScript: no three.js, no DOM. Importable from a node test.
 */

/** How a surface gets its pixels: a painted tile the renderer already loads, or a tile generated once on a canvas. */
export type SurfaceSource =
  | { readonly kind: 'texture'; readonly texKey: 'dirt' | 'cobble' | 'wood' | 'iron' | 'grass' | 'cliff' | 'cave' }
  | { readonly kind: 'procedural'; readonly generator: 'asphalt' | 'gravel' | 'concrete' | 'cracked' }
  /** An island surface: a tile of the island surface array (`island-route/island-surfaces.ts`), island ground only. */
  | { readonly kind: 'island' };

export interface SurfaceDefinition {
  readonly id: number;
  readonly name: string;
  readonly source: SurfaceSource;
  /** Base roughness of the dry surface (0 mirror … 1 chalk). */
  readonly roughness: number;
  /** How strongly rain darkens/glosses this surface (asphalt 1, gravel drains ~0.4). */
  readonly wetResponse: number;
  /** Multiplier on tyre grip; 1 = the legacy dirt road. */
  readonly grip: number;
  /** Multiplier on `ROLLING_RESISTANCE_COEFFICIENT`; 1 = the legacy dirt road. */
  readonly rollingResistance: number;
  /** Dust particle intensity (0–1); the effect renderer scales its dust burst by this. */
  readonly dustFX: number;
  /** Which tyre loop the audio picks. */
  readonly tireSound: 'dirt' | 'tarmac' | 'gravel' | 'plank' | 'metal' | 'grass' | 'rock';
  /** A flat colour for palettes and swatches (the tile itself is in the atlas). */
  readonly swatch: string;
}

export const SURFACE_DIRT = 0;
export const SURFACE_ASPHALT = 1;
export const SURFACE_COBBLE = 2;
export const SURFACE_PLANK = 3;
export const SURFACE_IRON = 4;
export const SURFACE_GRAVEL = 5;
export const SURFACE_GRASS = 6;
export const SURFACE_ROCK = 7;
export const SURFACE_CAVEROCK = 8;
export const SURFACE_CONCRETE = 9;
/**
 * The island's own light, compacted, cracked dirt (the old "painted dirt" brush). On the island ground its
 * pixels come from the ground shader's procedural dirt, tuned in the Island panel; elsewhere the atlas
 * holds a plain stand-in tile.
 */
export const SURFACE_CRACKED = 10;
/*
 * The island surface set (Scrapwind Isle tiles, `public/textures/island`). Drawn by the island ground from
 * its own texture array with height-based blending; the road ribbon's atlas shows them as flat swatches.
 */
export const SURFACE_SAND = 11;
export const SURFACE_WET_SAND = 12;
export const SURFACE_SHALLOWS = 13;
export const SURFACE_DARK_ROCK = 14;
export const SURFACE_OLD_PLANKS = 15;
export const SURFACE_RIVETED_IRON = 16;
export const SURFACE_CRYSTAL = 17;
export const SURFACE_BEACH_GRASS = 18;
export const SURFACE_CORAL_SAND = 19;
export const SURFACE_GRANITE = 20;
export const SURFACE_MOSSY_ROCK = 21;
export const SURFACE_DRY_MUD = 22;
export const SURFACE_DUNES = 23;
export const SURFACE_STRATA = 24;
/** Paints the island's own texture back over auto paint (the brush's "Island" swatch). */
export const SURFACE_BARE = 25;

/** IDs with a parameter slot (roughness, wet response); the mask format itself allows 256. */
export const SURFACE_SLOTS = 32;
/** IDs the road ribbon's 4×4 atlas has cells for. */
export const ATLAS_SURFACES = 16;

export const SURFACE_TABLE: readonly SurfaceDefinition[] = Object.freeze([
  { id: SURFACE_DIRT, name: 'Dirt (base road)', source: { kind: 'texture', texKey: 'dirt' }, roughness: 0.95, wetResponse: 0.6, grip: 1, rollingResistance: 1, dustFX: 1, tireSound: 'dirt', swatch: '#6f5436' },
  { id: SURFACE_ASPHALT, name: 'Asphalt', source: { kind: 'procedural', generator: 'asphalt' }, roughness: 0.72, wetResponse: 1, grip: 1.18, rollingResistance: 0.55, dustFX: 0.1, tireSound: 'tarmac', swatch: '#34353a' },
  { id: SURFACE_COBBLE, name: 'Cobblestone', source: { kind: 'texture', texKey: 'cobble' }, roughness: 0.85, wetResponse: 0.9, grip: 1.05, rollingResistance: 0.85, dustFX: 0.25, tireSound: 'rock', swatch: '#7a7167' },
  { id: SURFACE_PLANK, name: 'Timber planks', source: { kind: 'texture', texKey: 'wood' }, roughness: 0.8, wetResponse: 0.8, grip: 0.92, rollingResistance: 0.7, dustFX: 0.05, tireSound: 'plank', swatch: '#7a4f2c' },
  { id: SURFACE_IRON, name: 'Iron plate', source: { kind: 'texture', texKey: 'iron' }, roughness: 0.55, wetResponse: 1, grip: 0.85, rollingResistance: 0.5, dustFX: 0, tireSound: 'metal', swatch: '#6b6357' },
  { id: SURFACE_GRAVEL, name: 'Gravel (shoulder)', source: { kind: 'procedural', generator: 'gravel' }, roughness: 0.98, wetResponse: 0.4, grip: 0.82, rollingResistance: 1.45, dustFX: 1, tireSound: 'gravel', swatch: '#8b8172' },
  { id: SURFACE_GRASS, name: 'Grass', source: { kind: 'texture', texKey: 'grass' }, roughness: 0.97, wetResponse: 0.5, grip: 0.7, rollingResistance: 1.8, dustFX: 0.3, tireSound: 'grass', swatch: '#4d7a33' },
  { id: SURFACE_ROCK, name: 'Cliff rock', source: { kind: 'texture', texKey: 'cliff' }, roughness: 0.92, wetResponse: 0.7, grip: 0.95, rollingResistance: 1.1, dustFX: 0.4, tireSound: 'rock', swatch: '#6d6a66' },
  { id: SURFACE_CAVEROCK, name: 'Cave rock', source: { kind: 'texture', texKey: 'cave' }, roughness: 0.9, wetResponse: 0.7, grip: 0.9, rollingResistance: 1.15, dustFX: 0.5, tireSound: 'rock', swatch: '#4f4a44' },
  { id: SURFACE_CONCRETE, name: 'Concrete', source: { kind: 'procedural', generator: 'concrete' }, roughness: 0.78, wetResponse: 0.9, grip: 1.1, rollingResistance: 0.6, dustFX: 0.15, tireSound: 'tarmac', swatch: '#9c9a93' },
  { id: SURFACE_CRACKED, name: 'Cracked dirt', source: { kind: 'procedural', generator: 'cracked' }, roughness: 0.96, wetResponse: 0.6, grip: 0.95, rollingResistance: 1.1, dustFX: 0.9, tireSound: 'dirt', swatch: '#c8b99c' },
  { id: SURFACE_SAND, name: 'Packed sand', source: { kind: 'island' }, roughness: 0.93, wetResponse: 0.6, grip: 1, rollingResistance: 1.05, dustFX: 0.9, tireSound: 'dirt', swatch: '#b98a3e' },
  { id: SURFACE_WET_SAND, name: 'Wet sand', source: { kind: 'island' }, roughness: 0.62, wetResponse: 1, grip: 0.9, rollingResistance: 1.25, dustFX: 0.1, tireSound: 'dirt', swatch: '#8a6a3c' },
  { id: SURFACE_SHALLOWS, name: 'Shallows', source: { kind: 'island' }, roughness: 0.15, wetResponse: 1, grip: 0.7, rollingResistance: 2.2, dustFX: 0, tireSound: 'dirt', swatch: '#2f9a9a' },
  { id: SURFACE_DARK_ROCK, name: 'Dark rock', source: { kind: 'island' }, roughness: 0.85, wetResponse: 0.7, grip: 0.95, rollingResistance: 0.9, dustFX: 0.3, tireSound: 'rock', swatch: '#4a3a30' },
  { id: SURFACE_OLD_PLANKS, name: 'Old planks', source: { kind: 'island' }, roughness: 0.82, wetResponse: 0.8, grip: 0.92, rollingResistance: 0.7, dustFX: 0.05, tireSound: 'plank', swatch: '#7a5634' },
  { id: SURFACE_RIVETED_IRON, name: 'Riveted iron', source: { kind: 'island' }, roughness: 0.5, wetResponse: 1, grip: 0.85, rollingResistance: 0.5, dustFX: 0, tireSound: 'metal', swatch: '#6a6258' },
  { id: SURFACE_CRYSTAL, name: 'Crystal', source: { kind: 'island' }, roughness: 0.25, wetResponse: 0.9, grip: 0.8, rollingResistance: 0.45, dustFX: 0, tireSound: 'rock', swatch: '#2c3f7a' },
  { id: SURFACE_BEACH_GRASS, name: 'Beach grass', source: { kind: 'island' }, roughness: 0.97, wetResponse: 0.5, grip: 0.75, rollingResistance: 1.6, dustFX: 0.3, tireSound: 'grass', swatch: '#6f9a2e' },
  { id: SURFACE_CORAL_SAND, name: 'Coral sand', source: { kind: 'island' }, roughness: 0.95, wetResponse: 0.6, grip: 0.88, rollingResistance: 1.3, dustFX: 0.5, tireSound: 'gravel', swatch: '#c9a049' },
  { id: SURFACE_GRANITE, name: 'Granite cliff', source: { kind: 'island' }, roughness: 0.88, wetResponse: 0.7, grip: 0.95, rollingResistance: 1, dustFX: 0.3, tireSound: 'rock', swatch: '#7c7a86' },
  { id: SURFACE_MOSSY_ROCK, name: 'Mossy rock', source: { kind: 'island' }, roughness: 0.9, wetResponse: 0.6, grip: 0.8, rollingResistance: 1.2, dustFX: 0.2, tireSound: 'rock', swatch: '#4c5a2a' },
  { id: SURFACE_DRY_MUD, name: 'Dry mud', source: { kind: 'island' }, roughness: 0.95, wetResponse: 0.6, grip: 1, rollingResistance: 1, dustFX: 0.8, tireSound: 'dirt', swatch: '#8f6830' },
  { id: SURFACE_DUNES, name: 'Rippled sand', source: { kind: 'island' }, roughness: 0.95, wetResponse: 0.5, grip: 0.9, rollingResistance: 1.35, dustFX: 1, tireSound: 'dirt', swatch: '#d6ad4f' },
  { id: SURFACE_STRATA, name: 'Cliff strata', source: { kind: 'island' }, roughness: 0.9, wetResponse: 0.7, grip: 0.95, rollingResistance: 1, dustFX: 0.3, tireSound: 'rock', swatch: '#86745a' },
  { id: SURFACE_BARE, name: 'Island', source: { kind: 'island' }, roughness: 0.95, wetResponse: 0.6, grip: 1, rollingResistance: 1, dustFX: 1, tireSound: 'dirt', swatch: '#8a7a5a' },
]);

/** The table row for an ID; unknown IDs fall back to the base road so a corrupt mask can never crash physics. */
export function surfaceDefinition(id: number): SurfaceDefinition {
  return SURFACE_TABLE[id] ?? SURFACE_TABLE[SURFACE_DIRT];
}

/** Grip multiplier for an ID (Phase 4 hook). */
export const surfaceGrip = (id: number) => surfaceDefinition(id).grip;
/** Rolling-resistance multiplier for an ID (Phase 4 hook; see `applyRollingEffects`). */
export const surfaceRollingResistance = (id: number) => surfaceDefinition(id).rollingResistance;

/**
 * Lane-marking flags (mask byte 3, plan §2.3). Bit tests only, so the shader can read them with
 * `mod(floor(f / 2^k), 2)` on WebGL1 where there are no bitwise operators.
 */
export const MARK_NONE = 0;
export const MARK_LANE_DASHES = 1; // dashed dividers between the four lanes
export const MARK_CENTRE_DOUBLE = 2; // solid double line down the middle
export const MARK_EDGE_LINES = 4; // solid line along each shoulder
export const MARK_CYCLE: readonly number[] = Object.freeze([
  MARK_NONE,
  MARK_LANE_DASHES,
  MARK_LANE_DASHES | MARK_EDGE_LINES,
  MARK_CENTRE_DOUBLE | MARK_EDGE_LINES,
  MARK_LANE_DASHES | MARK_CENTRE_DOUBLE | MARK_EDGE_LINES,
]);
