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
  | { readonly kind: 'procedural'; readonly generator: 'asphalt' | 'gravel' | 'concrete' };

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

/** Slots the atlas/shader currently supports; the mask format itself allows 256. */
export const SURFACE_SLOTS = 16;

export const SURFACE_TABLE: readonly SurfaceDefinition[] = Object.freeze([
  { id: SURFACE_DIRT, name: 'Dirt (base road)', source: { kind: 'texture', texKey: 'dirt' }, roughness: 0.95, wetResponse: 0.6, grip: 1, rollingResistance: 1, dustFX: 1, tireSound: 'dirt' },
  { id: SURFACE_ASPHALT, name: 'Asphalt', source: { kind: 'procedural', generator: 'asphalt' }, roughness: 0.72, wetResponse: 1, grip: 1.18, rollingResistance: 0.55, dustFX: 0.1, tireSound: 'tarmac' },
  { id: SURFACE_COBBLE, name: 'Cobblestone', source: { kind: 'texture', texKey: 'cobble' }, roughness: 0.85, wetResponse: 0.9, grip: 1.05, rollingResistance: 0.85, dustFX: 0.25, tireSound: 'rock' },
  { id: SURFACE_PLANK, name: 'Timber planks', source: { kind: 'texture', texKey: 'wood' }, roughness: 0.8, wetResponse: 0.8, grip: 0.92, rollingResistance: 0.7, dustFX: 0.05, tireSound: 'plank' },
  { id: SURFACE_IRON, name: 'Iron plate', source: { kind: 'texture', texKey: 'iron' }, roughness: 0.55, wetResponse: 1, grip: 0.85, rollingResistance: 0.5, dustFX: 0, tireSound: 'metal' },
  { id: SURFACE_GRAVEL, name: 'Gravel (shoulder)', source: { kind: 'procedural', generator: 'gravel' }, roughness: 0.98, wetResponse: 0.4, grip: 0.82, rollingResistance: 1.45, dustFX: 1, tireSound: 'gravel' },
  { id: SURFACE_GRASS, name: 'Grass', source: { kind: 'texture', texKey: 'grass' }, roughness: 0.97, wetResponse: 0.5, grip: 0.7, rollingResistance: 1.8, dustFX: 0.3, tireSound: 'grass' },
  { id: SURFACE_ROCK, name: 'Cliff rock', source: { kind: 'texture', texKey: 'cliff' }, roughness: 0.92, wetResponse: 0.7, grip: 0.95, rollingResistance: 1.1, dustFX: 0.4, tireSound: 'rock' },
  { id: SURFACE_CAVEROCK, name: 'Cave rock', source: { kind: 'texture', texKey: 'cave' }, roughness: 0.9, wetResponse: 0.7, grip: 0.9, rollingResistance: 1.15, dustFX: 0.5, tireSound: 'rock' },
  { id: SURFACE_CONCRETE, name: 'Concrete', source: { kind: 'procedural', generator: 'concrete' }, roughness: 0.78, wetResponse: 0.9, grip: 1.1, rollingResistance: 0.6, dustFX: 0.15, tireSound: 'tarmac' },
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
