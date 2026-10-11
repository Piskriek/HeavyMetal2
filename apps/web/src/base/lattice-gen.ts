/**
 * TASK-10b: which lattice pieces render their visible mesh from a generated model (assets/gen/<id>.glb).
 * Pure data: the node tests read it without the asset loader.
 */
import type { Kind } from '@hm/structure';

/** Lattice kind -> generated asset id. Ramps, stairs and roofs use the same ids as the kit pieces. */
export const LATTICE_GEN_IDS: Readonly<Partial<Record<Kind, string>>> = {
  foundation: 'foundation',
  wall: 'wall',
  pillar: 'pillar',
  floor: 'floor',
  ramp: 'ramp',
  stairs: 'stairs',
  airlock: 'airlock',
  hardpoint: 'hardpoint',
  roof: 'roof-pitched',
  lowRoof: 'roof-low',
  roofOuter: 'roof-corner-outer',
  roofInner: 'roof-corner-inner',
  ridgeCap: 'ridge-cap',
  gable: 'gable',
  halfWall: 'half-wall',
  windowWall: 'window-wall',
  doorframe: 'doorframe',
  door: 'door-leaf',
};

/**
 * Kinds whose generated mesh misses the procedural box by more than 2% on an axis (lattice-gen.test.ts measures it).
 * They keep the procedural mesh until the asset is re-fitted. The test fails when this list and the measurement disagree.
 */
export const LATTICE_GEN_HELD: readonly Kind[] = ['ramp', 'hardpoint', 'windowWall', 'door'];

/** Largest skirt (m) the generated foundation fits: its ribs reach 1 m below the slab. */
export const LATTICE_GEN_FOUNDATION_SKIRT = 1;

/**
 * The generated id this lattice piece renders with, or null when it stays procedural.
 * A foundation whose skirt is deeper than the fitted one stays procedural: its ribs would stop above the ground.
 */
export function latticeGenId(kind: Kind, skirt = 0): string | null {
  if (LATTICE_GEN_HELD.includes(kind)) return null;
  if (kind === 'foundation' && skirt > LATTICE_GEN_FOUNDATION_SKIRT + 1e-6) return null;
  return LATTICE_GEN_IDS[kind] ?? null;
}

/** Every generated id the lattice can render with, for the loading bar's preload. */
export function latticeGenAssets(): string[] {
  const ids = new Set<string>();
  for (const kind of Object.keys(LATTICE_GEN_IDS) as Kind[]) {
    const id = latticeGenId(kind);
    if (id) ids.add(id);
  }
  return [...ids];
}
