/**
 * ISLAND-ROUTE: island auto paint — one click dresses the whole island, then sliders tune it.
 *
 * A **recipe** is a stack of layers, painted bottom to top. Each layer is one surface and a set of
 * conditions read from the terrain (`island-terrain.ts`):
 *
 *   altitude   % of the peak (0 = the waterline)          slope    degrees from level
 *   shore      units from the waterline (+ inland)        road     units from the island road
 *   hollow     + likes hollows and creases, − likes ridges (at ~300 or ~1,100 units)
 *   facing     + likes slopes facing +z, − facing −z (moss on the shady side)
 *   noise      breaks the layer into patches: scale, how much, and whether it grows or thins
 *
 * Every band has soft edges, and the edges wobble with a shared noise so no band reads as a contour
 * line. A layer's coverage multiplies its conditions and its strength; painting it over the stack
 * shrinks what is under it by the same share (a layer at 60% over grass leaves grass at 40%). Each
 * texel keeps its two strongest surfaces and their balance — the mask format — and the ground shader's
 * height blend turns that balance into grass blades standing out of sand, sand in the cracks of rock.
 *
 * **Presets** are recipes tuned for this island. **Macros** are the friendly sliders on top: beach width,
 * greenery, rockiness, patchiness, road verges and a variation seed; they reshape the preset's layers by
 * role, so the same slider means the same thing in every preset. The advanced list edits layers directly.
 *
 * Deterministic: the same terrain and recipe paint the same bytes (asserted), so a save stores the recipe
 * (a few hundred bytes) and the island is repainted at load, behind the loading bar.
 *
 * Pure TypeScript: no three.js, no DOM — it runs in a worker (`island-autopaint.worker.ts`) and in tests.
 */
import type { IslandTerrain } from './island-terrain';
import {
  SURFACE_BEACH_GRASS, SURFACE_CORAL_SAND, SURFACE_CRYSTAL, SURFACE_DARK_ROCK, SURFACE_DRY_MUD, SURFACE_DUNES,
  SURFACE_GRANITE, SURFACE_MOSSY_ROCK, SURFACE_SAND, SURFACE_SHALLOWS, SURFACE_STRATA, SURFACE_WET_SAND,
} from '../surface/surface-table';

/** What a layer is, for the macros: the same slider reshapes every preset's layers of that role. */
export type LayerRole = 'base' | 'dune' | 'wet' | 'shallows' | 'grass' | 'moss' | 'cliff' | 'rock' | 'verge' | 'accent';

/** A soft band: full between `min` and `max`, fading over `soft` either side. */
export interface Band { readonly min: number; readonly max: number; readonly soft: number }

export interface IslandLayer {
  readonly key: string;
  readonly name: string;
  readonly role: LayerRole;
  readonly surface: number;
  readonly on: boolean;
  /** 0..1: the most this layer covers. */
  readonly strength: number;
  readonly altitude?: Band;
  readonly slope?: Band;
  readonly shore?: Band;
  readonly road?: Band;
  readonly hollow?: { readonly scale: 'small' | 'large'; readonly amount: number; readonly depth: number };
  readonly facing?: number;
  readonly noise?: { readonly scale: number; readonly amount: number; readonly bias: number; readonly seed: number };
}

export interface IslandMacros {
  /** Beach and shallows width, ×. */
  readonly beach: number;
  /** Grass and moss, ×. */
  readonly green: number;
  /** Rock: lower cliff angle and stronger rock, ×. */
  readonly rock: number;
  /** How broken up the patches are, ×. */
  readonly patchy: number;
  /** Road verge width, × (0 = none). */
  readonly verge: number;
  /** Variation: a new seed gives the same look with different patches. */
  readonly seed: number;
}

export const DEFAULT_MACROS: IslandMacros = Object.freeze({ beach: 1, green: 1, rock: 1, patchy: 1, verge: 1, seed: 0 });

export interface IslandRecipe {
  readonly version: 1;
  readonly preset: string;
  readonly macros: IslandMacros;
  readonly layers: readonly IslandLayer[];
  /** The tile each surface wears in this look: surface ID → texture library key (`island-texture-library.ts`). */
  readonly tiles?: Readonly<Record<string, string>>;
}

export interface IslandPreset {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly layers: readonly IslandLayer[];
  /** This look's own tiles, over the calm set every preset starts from (`CALM_TILES`). */
  readonly tiles?: Readonly<Record<number, string>>;
}

/**
 * The calm tile set every preset starts from (`src/assets/island-textures`): even, low-noise tiles that
 * read well across the whole island from the air. The painterly originals stay in the tile picker.
 */
const lib = (file: string) => `library/${file}`;
/** A tile of the pipeline-built Basalt Isle library (`public/textures/island-lib`): these carry PBR maps (real relief and shine). */
const pbr = (file: string) => `lib/${file}`;
export const CALM_TILES: Readonly<Record<number, string>> = Object.freeze({
  [SURFACE_SAND]: lib('sand-soft-packed-01.jpg'),
  [SURFACE_WET_SAND]: lib('wetsand-tideline-01.jpg'),
  [SURFACE_SHALLOWS]: lib('shallows-turquoise-01.jpg'),
  [SURFACE_DARK_ROCK]: lib('rock-smooth-basalt-01.jpg'),
  [SURFACE_BEACH_GRASS]: lib('grass-lush-meadow-01.jpg'),
  [SURFACE_CORAL_SAND]: lib('coral-subtle-fragments-01.jpg'),
  [SURFACE_GRANITE]: lib('cliff-granite-soft-01.jpg'),
  [SURFACE_MOSSY_ROCK]: lib('moss-patchy-stone-02.jpg'),
  [SURFACE_DRY_MUD]: lib('mud-dry-plates-01.jpg'),
  [SURFACE_DUNES]: lib('dunes-soft-ripples-01.jpg'),
  [SURFACE_STRATA]: lib('cliff-strata-layers-02.jpg'),
});

/* ───────────── Presets ───────────── */

const B = (min: number, max: number, soft: number): Band => ({ min, max, soft });
const INF = 1e9;
const L = (layer: Omit<IslandLayer, 'on'> & { on?: boolean }): IslandLayer => ({ on: true, ...layer });

/** The shoreline every preset shares: shallows under the water, a wet band at the waterline. */
const SHORE_LAYERS: readonly IslandLayer[] = [
  L({ key: 'shallows', name: 'Shallows', role: 'shallows', surface: SURFACE_SHALLOWS, strength: 1, shore: B(-2200, -120, 160) }),
  L({ key: 'wet', name: 'Wet sand', role: 'wet', surface: SURFACE_WET_SAND, strength: 1, shore: B(-260, 260, 160), noise: { scale: 900, amount: 0.35, bias: 0.3, seed: 11 } }),
];

const CLIFF_LAYERS = (angle: number, strata: number): IslandLayer[] => [
  L({ key: 'cliff', name: 'Granite cliffs', role: 'cliff', surface: SURFACE_GRANITE, strength: 1, slope: B(angle, 90, 5) }),
  L({ key: 'strata', name: 'Cliff strata', role: 'cliff', surface: SURFACE_STRATA, strength: strata, slope: B(angle + 4, 90, 6), altitude: B(18, 100, 8), noise: { scale: 2600, amount: 0.8, bias: 0, seed: 23 } }),
  L({ key: 'ridges', name: 'Dark rock ridges', role: 'rock', surface: SURFACE_DARK_ROCK, strength: 0.85, slope: B(angle - 6, 90, 6), hollow: { scale: 'small', amount: -0.9, depth: 60 } }),
];

export const ISLAND_PRESETS: readonly IslandPreset[] = Object.freeze<IslandPreset[]>([
  {
    id: 'tropical', name: 'Tropical isle',
    blurb: 'Golden beaches and turquoise shallows, beach grass on every gentle slope, moss in the damp creases, granite and strata on the cliffs.',
    layers: [
      L({ key: 'base', name: 'Packed sand', role: 'base', surface: SURFACE_SAND, strength: 1, shore: B(-120, INF, 80) }),
      L({ key: 'dunes', name: 'Rippled sand', role: 'dune', surface: SURFACE_DUNES, strength: 0.9, shore: B(150, 2600, 700), slope: B(0, 14, 5), noise: { scale: 2400, amount: 0.55, bias: 0.2, seed: 3 } }),
      ...SHORE_LAYERS,
      L({ key: 'coral', name: 'Coral sand', role: 'accent', surface: SURFACE_CORAL_SAND, strength: 0.85, shore: B(-500, 900, 250), noise: { scale: 1100, amount: 1, bias: -0.45, seed: 7 } }),
      L({ key: 'grass', name: 'Beach grass', role: 'grass', surface: SURFACE_BEACH_GRASS, strength: 1, shore: B(1100, INF, 600), slope: B(0, 26, 6), altitude: B(1, 88, 6), hollow: { scale: 'large', amount: 0.35, depth: 90 }, noise: { scale: 1800, amount: 0.6, bias: 0.3, seed: 5 } }),
      L({ key: 'mud', name: 'Dry mud flats', role: 'accent', surface: SURFACE_DRY_MUD, strength: 0.75, shore: B(2600, INF, 800), slope: B(0, 9, 4), hollow: { scale: 'large', amount: 0.7, depth: 80 }, noise: { scale: 2600, amount: 0.8, bias: -0.35, seed: 13 } }),
      L({ key: 'moss', name: 'Mossy rock', role: 'moss', surface: SURFACE_MOSSY_ROCK, strength: 0.9, slope: B(22, 44, 6), hollow: { scale: 'small', amount: 0.6, depth: 50 }, facing: 0.3 }),
      ...CLIFF_LAYERS(34, 0.75),
      L({ key: 'verge', name: 'Road verges', role: 'verge', surface: SURFACE_SAND, strength: 0.9, road: B(0, 240, 140), noise: { scale: 700, amount: 0.4, bias: 0.3, seed: 17 } }),
    ],
  },
  {
    id: 'lush', name: 'Lush green isle',
    blurb: 'Grass right down to a narrow beach, moss climbing every slope, bare stone only where it is too steep to hold on.',
    tiles: { [SURFACE_BEACH_GRASS]: lib('grass-mossy-lawn-04.jpg'), [SURFACE_MOSSY_ROCK]: lib('moss-carpet-01.jpg'), [SURFACE_DRY_MUD]: lib('mud-dark-earth-02.jpg') },
    layers: [
      L({ key: 'base', name: 'Packed sand', role: 'base', surface: SURFACE_SAND, strength: 1, shore: B(-120, INF, 80) }),
      ...SHORE_LAYERS,
      L({ key: 'grass', name: 'Beach grass', role: 'grass', surface: SURFACE_BEACH_GRASS, strength: 1, shore: B(550, INF, 350), slope: B(0, 34, 6), noise: { scale: 2200, amount: 0.3, bias: 0.6, seed: 5 } }),
      L({ key: 'mud', name: 'Dry mud paths', role: 'accent', surface: SURFACE_DRY_MUD, strength: 0.6, shore: B(1500, INF, 600), slope: B(0, 12, 4), noise: { scale: 1500, amount: 1, bias: -0.55, seed: 13 } }),
      L({ key: 'moss', name: 'Mossy rock', role: 'moss', surface: SURFACE_MOSSY_ROCK, strength: 1, slope: B(26, 52, 6), noise: { scale: 1800, amount: 0.35, bias: 0.4, seed: 19 } }),
      ...CLIFF_LAYERS(46, 0.4),
      L({ key: 'verge', name: 'Road verges', role: 'verge', surface: SURFACE_SAND, strength: 0.85, road: B(0, 200, 120), noise: { scale: 700, amount: 0.4, bias: 0.3, seed: 17 } }),
    ],
  },
  {
    id: 'dunes', name: 'Windswept dunes',
    blurb: 'Rippled sand everywhere the wind can reach, grass hiding in the hollows, stone ribs through the dunes.',
    tiles: { [SURFACE_DUNES]: lib('dunes-broad-swells-02.jpg'), [SURFACE_SAND]: lib('sand-wind-streaked-02.jpg'), [SURFACE_BEACH_GRASS]: lib('grass-sparse-sand-03.jpg'), [SURFACE_DARK_ROCK]: lib('rock-sandstone-slabs-03.jpg') },
    layers: [
      L({ key: 'base', name: 'Rippled sand', role: 'base', surface: SURFACE_DUNES, strength: 1, shore: B(-120, INF, 80) }),
      L({ key: 'packed', name: 'Packed sand', role: 'dune', surface: SURFACE_SAND, strength: 0.8, slope: B(8, 30, 6), noise: { scale: 1900, amount: 0.6, bias: 0, seed: 3 } }),
      ...SHORE_LAYERS,
      L({ key: 'grass', name: 'Grass in the hollows', role: 'grass', surface: SURFACE_BEACH_GRASS, strength: 0.95, shore: B(1600, INF, 700), slope: B(0, 20, 6), hollow: { scale: 'large', amount: 1, depth: 70 }, noise: { scale: 1300, amount: 0.7, bias: -0.1, seed: 5 } }),
      ...CLIFF_LAYERS(36, 1),
      L({ key: 'verge', name: 'Road verges', role: 'verge', surface: SURFACE_SAND, strength: 0.9, road: B(0, 260, 160), noise: { scale: 700, amount: 0.4, bias: 0.3, seed: 17 } }),
    ],
  },
  {
    id: 'coast', name: 'Rocky coast',
    blurb: 'Dark rock headlands dropping into the sea, strata cliffs above, coral in the shallows and tough grass in the sheltered dips.',
    tiles: { [SURFACE_DARK_ROCK]: lib('cliff-volcanic-03.jpg'), [SURFACE_WET_SAND]: lib('wetsand-glassy-02.jpg'), [SURFACE_CORAL_SAND]: lib('sand-pale-coral-03.jpg'), [SURFACE_BEACH_GRASS]: lib('grass-dry-golden-02.jpg'), [SURFACE_SHALLOWS]: lib('shallows-teal-caustics-02.jpg') },
    layers: [
      L({ key: 'base', name: 'Packed sand', role: 'base', surface: SURFACE_SAND, strength: 1, shore: B(-120, INF, 80) }),
      ...SHORE_LAYERS,
      L({ key: 'coral', name: 'Coral shallows', role: 'accent', surface: SURFACE_CORAL_SAND, strength: 0.9, shore: B(-1400, 200, 250), noise: { scale: 900, amount: 1, bias: -0.2, seed: 7 } }),
      L({ key: 'headland', name: 'Headland rock', role: 'rock', surface: SURFACE_DARK_ROCK, strength: 1, shore: B(-150, 2600, 700), hollow: { scale: 'large', amount: -0.9, depth: 70 }, noise: { scale: 1600, amount: 0.5, bias: 0.2, seed: 29 } }),
      L({ key: 'grass', name: 'Sheltered grass', role: 'grass', surface: SURFACE_BEACH_GRASS, strength: 0.9, shore: B(1400, INF, 600), slope: B(0, 22, 6), hollow: { scale: 'large', amount: 0.6, depth: 80 }, noise: { scale: 1600, amount: 0.6, bias: 0.05, seed: 5 } }),
      L({ key: 'moss', name: 'Mossy rock', role: 'moss', surface: SURFACE_MOSSY_ROCK, strength: 0.8, slope: B(20, 40, 6), hollow: { scale: 'small', amount: 0.7, depth: 50 }, facing: 0.4 }),
      ...CLIFF_LAYERS(28, 1),
      L({ key: 'verge', name: 'Road verges', role: 'verge', surface: SURFACE_SAND, strength: 0.9, road: B(0, 220, 140), noise: { scale: 700, amount: 0.4, bias: 0.3, seed: 17 } }),
    ],
  },
  {
    id: 'badlands', name: 'Sun-baked badlands',
    blurb: 'Cracked mud pans and packed sand, sun-bleached strata on every rise, a few tufts of grass holding on in the dips.',
    tiles: { [SURFACE_SAND]: lib('path-compacted-dirt-01.jpg'), [SURFACE_BEACH_GRASS]: lib('grass-dry-golden-02.jpg'), [SURFACE_DARK_ROCK]: lib('rock-sandstone-slabs-03.jpg'), [SURFACE_DUNES]: lib('dunes-broad-swells-02.jpg') },
    layers: [
      L({ key: 'base', name: 'Dry mud', role: 'base', surface: SURFACE_DRY_MUD, strength: 1, shore: B(-120, INF, 80) }),
      L({ key: 'packed', name: 'Packed sand', role: 'dune', surface: SURFACE_SAND, strength: 0.85, noise: { scale: 2000, amount: 0.9, bias: 0, seed: 3 } }),
      L({ key: 'dunes', name: 'Drifted sand', role: 'dune', surface: SURFACE_DUNES, strength: 0.8, slope: B(0, 10, 4), hollow: { scale: 'large', amount: 0.8, depth: 70 }, noise: { scale: 1500, amount: 0.6, bias: 0, seed: 9 } }),
      ...SHORE_LAYERS,
      L({ key: 'grass', name: 'Hardy tufts', role: 'grass', surface: SURFACE_BEACH_GRASS, strength: 0.7, shore: B(2000, INF, 700), slope: B(0, 16, 5), hollow: { scale: 'large', amount: 1, depth: 60 }, noise: { scale: 900, amount: 1, bias: -0.55, seed: 5 } }),
      L({ key: 'strata-rise', name: 'Strata on the rises', role: 'rock', surface: SURFACE_STRATA, strength: 0.9, slope: B(16, 90, 6), hollow: { scale: 'large', amount: -0.6, depth: 60 } }),
      ...CLIFF_LAYERS(30, 1),
      L({ key: 'verge', name: 'Road verges', role: 'verge', surface: SURFACE_SAND, strength: 0.9, road: B(0, 260, 160), noise: { scale: 700, amount: 0.4, bias: 0.3, seed: 17 } }),
    ],
  },
  {
    id: 'crystal', name: 'Crystal highlands',
    blurb: 'The tropical isle with its high ridges broken open: blue crystal seams on the peaks, moss thick below them.',
    tiles: { [SURFACE_MOSSY_ROCK]: lib('moss-carpet-01.jpg'), [SURFACE_GRANITE]: lib('cliff-limestone-04.jpg'), [SURFACE_BEACH_GRASS]: lib('grass-fern-groundcover-05.jpg') },
    layers: [
      L({ key: 'base', name: 'Packed sand', role: 'base', surface: SURFACE_SAND, strength: 1, shore: B(-120, INF, 80) }),
      L({ key: 'dunes', name: 'Rippled sand', role: 'dune', surface: SURFACE_DUNES, strength: 0.9, shore: B(150, 2400, 700), slope: B(0, 14, 5), noise: { scale: 2400, amount: 0.55, bias: 0.2, seed: 3 } }),
      ...SHORE_LAYERS,
      L({ key: 'grass', name: 'Beach grass', role: 'grass', surface: SURFACE_BEACH_GRASS, strength: 1, shore: B(1100, INF, 600), slope: B(0, 26, 6), altitude: B(1, 70, 8), hollow: { scale: 'large', amount: 0.35, depth: 90 }, noise: { scale: 1800, amount: 0.6, bias: 0.3, seed: 5 } }),
      L({ key: 'moss', name: 'Mossy rock', role: 'moss', surface: SURFACE_MOSSY_ROCK, strength: 1, slope: B(18, 46, 6), altitude: B(30, 100, 10), hollow: { scale: 'small', amount: 0.4, depth: 50 } }),
      ...CLIFF_LAYERS(36, 0.8),
      L({ key: 'crystal', name: 'Crystal seams', role: 'accent', surface: SURFACE_CRYSTAL, strength: 0.9, altitude: B(62, 100, 8), hollow: { scale: 'small', amount: -0.8, depth: 50 }, noise: { scale: 800, amount: 1, bias: -0.3, seed: 31 } }),
      L({ key: 'verge', name: 'Road verges', role: 'verge', surface: SURFACE_SAND, strength: 0.9, road: B(0, 240, 140), noise: { scale: 700, amount: 0.4, bias: 0.3, seed: 17 } }),
    ],
  },
  {
    id: 'basalt', name: 'Basalt Isle (PBR)',
    blurb: 'Black basalt headlands and ochre strata over pale rippled sand, mossy damp creases and tropical ground cover, every surface painted with PBR tiles from the art pipeline: real relief, real shine.',
    tiles: {
      [SURFACE_SAND]: pbr('dunes-rippled-tidal-sand-m282.webp'),
      [SURFACE_WET_SAND]: pbr('wetsand-wet-compact-sand-m281.webp'),
      [SURFACE_SHALLOWS]: pbr('shallows-shallow-tropical-water-m051.webp'),
      [SURFACE_DARK_ROCK]: pbr('rock-wet-coastal-basalt-m005.webp'),
      [SURFACE_BEACH_GRASS]: pbr('grass-tropical-grass-ground-m353.webp'),
      [SURFACE_CORAL_SAND]: pbr('coral-coral-limestone-m284.webp'),
      [SURFACE_GRANITE]: pbr('cliff-basalt-cliff-m001.webp'),
      [SURFACE_MOSSY_ROCK]: pbr('moss-tropical-moss-carpet-m300.webp'),
      [SURFACE_DRY_MUD]: pbr('mud-mud-and-puddle-edge-m011.webp'),
      [SURFACE_DUNES]: pbr('dunes-rippled-tidal-sand-m282.webp'),
      [SURFACE_STRATA]: pbr('strata-ochre-layered-cliff-m002.webp'),
    },
    layers: [
      L({ key: 'base', name: 'Rippled sand', role: 'base', surface: SURFACE_SAND, strength: 1, shore: B(-120, INF, 80) }),
      ...SHORE_LAYERS,
      L({ key: 'coral', name: 'Coral limestone', role: 'accent', surface: SURFACE_CORAL_SAND, strength: 0.8, shore: B(-500, 700, 250), noise: { scale: 1100, amount: 1, bias: -0.45, seed: 7 } }),
      L({ key: 'basalt', name: 'Basalt headlands', role: 'rock', surface: SURFACE_DARK_ROCK, strength: 1, shore: B(350, INF, 500), hollow: { scale: 'large', amount: -0.6, depth: 70 }, noise: { scale: 1900, amount: 0.7, bias: 0.15, seed: 29 } }),
      L({ key: 'grass', name: 'Tropical ground cover', role: 'grass', surface: SURFACE_BEACH_GRASS, strength: 0.95, shore: B(1500, INF, 600), slope: B(0, 22, 6), hollow: { scale: 'large', amount: 0.6, depth: 80 }, noise: { scale: 1600, amount: 0.6, bias: 0.05, seed: 5 } }),
      L({ key: 'mud', name: 'Wet loam', role: 'accent', surface: SURFACE_DRY_MUD, strength: 0.7, shore: B(2400, INF, 800), slope: B(0, 9, 4), hollow: { scale: 'large', amount: 0.7, depth: 80 }, noise: { scale: 2400, amount: 0.8, bias: -0.3, seed: 13 } }),
      L({ key: 'moss', name: 'Moss in the damp', role: 'moss', surface: SURFACE_MOSSY_ROCK, strength: 0.9, slope: B(20, 42, 6), hollow: { scale: 'small', amount: 0.7, depth: 50 }, facing: 0.4 }),
      ...CLIFF_LAYERS(30, 1),
      L({ key: 'verge', name: 'Road verges', role: 'verge', surface: SURFACE_SAND, strength: 0.9, road: B(0, 240, 140), noise: { scale: 700, amount: 0.4, bias: 0.3, seed: 17 } }),
    ],
  },
]);

export const islandPreset = (id: string) => ISLAND_PRESETS.find((p) => p.id === id);

/** A fresh recipe for a preset (macros at 1×). */
export function recipeFor(presetId: string, macros: Partial<IslandMacros> = {}): IslandRecipe {
  const preset = islandPreset(presetId) ?? ISLAND_PRESETS[0];
  const tiles: Record<string, string> = {};
  for (const [id, key] of Object.entries({ ...CALM_TILES, ...preset.tiles })) tiles[id] = key;
  return { version: 1, preset: preset.id, macros: { ...DEFAULT_MACROS, ...macros }, layers: preset.layers.map((l) => ({ ...l })), tiles };
}

/** Reads a saved recipe back, dropping anything malformed (a bad recipe paints nothing, never throws). */
export function normalizeRecipe(raw: unknown): IslandRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<IslandRecipe>;
  if (r.version !== 1 || !Array.isArray(r.layers)) return null;
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const m = (r.macros ?? {}) as Partial<IslandMacros>;
  const macros: IslandMacros = {
    beach: num(m.beach, 0, 4, 1), green: num(m.green, 0, 3, 1), rock: num(m.rock, 0, 3, 1),
    patchy: num(m.patchy, 0, 3, 1), verge: num(m.verge, 0, 4, 1), seed: Math.round(num(m.seed, 0, 1e6, 0)),
  };
  const layers = r.layers.filter((l): l is IslandLayer => !!l && typeof l === 'object' && typeof (l as IslandLayer).surface === 'number' && typeof (l as IslandLayer).key === 'string');
  const tiles: Record<string, string> = {};
  if (r.tiles && typeof r.tiles === 'object') for (const [id, key] of Object.entries(r.tiles)) if (typeof key === 'string') tiles[id] = key;
  return { version: 1, preset: typeof r.preset === 'string' ? r.preset : 'custom', macros, layers, tiles };
}

/* ───────────── Macros → effective layers ───────────── */

/** A band scaled about the waterline (open ends stay open). */
const scaleBand = (b: Band, k: number): Band => ({ min: b.min >= INF ? b.min : b.min * k, max: b.max >= INF ? b.max : b.max * k, soft: b.soft * k });

/** The layers as the macros shape them. */
export function effectiveLayers(recipe: IslandRecipe): IslandLayer[] {
  const m = recipe.macros;
  return recipe.layers.filter((l) => l.on).map((l) => {
    let out: IslandLayer = l;
    const noiseK = Math.min(3, Math.max(0, m.patchy));
    if (l.noise) out = { ...out, noise: { ...l.noise, amount: Math.min(1, l.noise.amount * noiseK), seed: l.noise.seed + m.seed * 101 } };
    switch (l.role) {
      case 'shallows': case 'wet': case 'dune':
        if (out.shore) out = { ...out, shore: scaleBand(out.shore, m.beach) };
        break;
      case 'grass': case 'moss': {
        const g = Math.max(0, m.green);
        out = { ...out, strength: Math.min(1, out.strength * g) };
        if (out.slope && l.role === 'grass') out = { ...out, slope: { ...out.slope, max: out.slope.max * (0.7 + 0.3 * Math.min(2, g)) } };
        // More beach pushes the grass inland.
        if (out.shore && out.shore.min > 0 && out.shore.min < INF) out = { ...out, shore: { ...out.shore, min: out.shore.min * m.beach } };
        break;
      }
      case 'cliff': case 'rock': {
        const k = Math.max(0.05, m.rock);
        out = { ...out, strength: Math.min(1, out.strength * Math.min(1.5, k)) };
        if (out.slope) out = { ...out, slope: { ...out.slope, min: out.slope.min / (0.6 + 0.4 * k) } };
        break;
      }
      case 'verge':
        if (out.road) out = { ...out, strength: m.verge <= 0.01 ? 0 : out.strength, road: { ...out.road, max: out.road.max * m.verge, soft: out.road.soft * Math.max(0.3, m.verge) } };
        break;
      default: break;
    }
    return out;
  }).filter((l) => l.strength > 0.001);
}

/* ───────────── Painting ───────────── */

const smooth = (e0: number, e1: number, x: number) => {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = x <= e0 ? 0 : x >= e1 ? 1 : (x - e0) / (e1 - e0);
  return t * t * (3 - 2 * t);
};

/*
 * Noise from a table: a 256² lattice of random values, looked up with smooth interpolation. Four reads
 * instead of four hashes, and the same everywhere (tests, worker, main thread). The lattice wraps every
 * 256 noise cells, which at the smallest patch size the panel offers (200 units) is 51,000 units — about
 * the island's width — and far beyond it at the usual sizes.
 */
const NOISE_N = 256;
const NOISE_TABLE = (() => {
  const t = new Float32Array(NOISE_N * NOISE_N);
  let s = 0x9e3779b9;
  for (let i = 0; i < t.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = s;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    t[i] = ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  }
  return t;
})();

function valueNoise(x: number, y: number): number {
  const xf = Math.floor(x), yf = Math.floor(y);
  let fx = x - xf, fy = y - yf;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const x0 = xf & (NOISE_N - 1), y0 = yf & (NOISE_N - 1);
  const x1 = (x0 + 1) & (NOISE_N - 1), y1 = (y0 + 1) & (NOISE_N - 1);
  const a = NOISE_TABLE[y0 * NOISE_N + x0], b = NOISE_TABLE[y0 * NOISE_N + x1];
  const c = NOISE_TABLE[y1 * NOISE_N + x0], d = NOISE_TABLE[y1 * NOISE_N + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Two octaves, 0..1. A seed shifts the lookup, so each layer's patches are its own. */
export function fbm2(x: number, y: number, seed: number): number {
  const ox = (seed * 71.3) % NOISE_N, oy = (seed * 37.9) % NOISE_N;
  return valueNoise(x + ox, y + oy) * 0.68 + valueNoise(x * 2.13 + oy + 17.3, y * 2.13 + ox - 4.1) * 0.32;
}

export interface PaintIslandResult {
  /** RGBA mask at the terrain's resolution: id0, id1, weight of id1, 0. */
  readonly mask: Uint8Array;
  /** Texels covered per surface ID (dominant), for the panel's readout. */
  readonly coverage: Record<number, number>;
  readonly ms: number;
}

/*
 * The layers, flattened into typed arrays for the inner loop (a cell visits every layer, a million cells
 * a paint; reading object fields of a dozen different shapes there is what made it slow).
 */
const F_ALT = 1, F_SLOPE = 2, F_SHORE = 4, F_ROAD = 8, F_HOLLOW = 16, F_FACING = 32, F_NOISE = 64;
const S = 21;
const BIG = INF / 2;

interface Compiled {
  readonly count: number;
  readonly surface: Int32Array;
  readonly strength: Float64Array;
  readonly flags: Int32Array;
  readonly p: Float64Array;
}

function compile(layers: readonly IslandLayer[]): Compiled {
  const n = layers.length;
  const surface = new Int32Array(n), strength = new Float64Array(n), flags = new Int32Array(n), p = new Float64Array(n * S);
  const put = (k: number, at: number, b: Band) => { p[k * S + at] = b.min; p[k * S + at + 1] = b.max >= BIG ? Infinity : b.max; p[k * S + at + 2] = Math.max(1e-6, b.soft); };
  layers.forEach((l, k) => {
    surface[k] = l.surface;
    strength[k] = Math.min(1, Math.max(0, l.strength));
    let f = 0;
    if (l.altitude) { f |= F_ALT; put(k, 0, l.altitude); }
    if (l.slope) { f |= F_SLOPE; put(k, 3, l.slope); }
    if (l.shore) { f |= F_SHORE; put(k, 6, l.shore); }
    if (l.road) { f |= F_ROAD; put(k, 9, l.road); }
    if (l.hollow && l.hollow.amount !== 0) {
      f |= F_HOLLOW;
      p[k * S + 12] = l.hollow.scale === 'large' ? 1 : 0;
      p[k * S + 13] = l.hollow.amount;
      p[k * S + 14] = 1 / Math.max(1, l.hollow.depth);
    }
    if (l.facing) { f |= F_FACING; p[k * S + 15] = l.facing; }
    if (l.noise && l.noise.amount > 0) {
      f |= F_NOISE;
      p[k * S + 16] = 1 / Math.max(50, l.noise.scale);
      p[k * S + 17] = Math.min(1, l.noise.amount);
      p[k * S + 18] = 0.5 - l.noise.bias * 0.4;
      p[k * S + 19] = l.noise.seed;
    }
    flags[k] = f;
  });
  return { count: n, surface, strength, flags, p };
}

/** A soft band's value at `v` (the band's numbers at `p[o..o+2]`). */
function bandAt(p: Float64Array, o: number, v: number): number {
  const min = p[o], max = p[o + 1], soft = p[o + 2];
  const lo = smooth(min - soft, min + soft, v);
  return max === Infinity ? lo : lo * (1 - smooth(max - soft, max + soft, v));
}

/**
 * Paints the recipe over the terrain. `onProgress(0..1)` every few rows. Cells off the model stay
 * unpainted (the sea covers them).
 */
export function paintIsland(terrain: IslandTerrain, recipe: IslandRecipe, onProgress?: (t: number) => void): PaintIslandResult {
  const t0 = Date.now();
  const { res, half, cell, peak } = terrain;
  const L = compile(effectiveLayers(recipe));
  const { surface, strength, flags, p } = L;
  const mask = new Uint8Array(res * res * 4);
  const coverage: Record<number, number> = {};
  const ids = new Int32Array(8), ws = new Float64Array(8);
  const wobbleSeed = 977 + recipe.macros.seed * 7;
  const peakK = peak > 0 ? 100 / peak : 0;
  const { height, slope: slopeMap, shore: shoreMap, road: roadMap, hollowSmall, hollowLarge, facing } = terrain;
  for (let y = 0; y < res; y++) {
    const wz = -half + (y + 0.5) * cell;
    for (let x = 0; x < res; x++) {
      const i = y * res + x;
      const h = height[i];
      if (h !== h) continue; // off the model
      const wx = -half + (x + 0.5) * cell;
      // One shared wobble so band edges meander instead of tracing contours.
      const wob = fbm2(wx / 900, wz / 900, wobbleSeed) - 0.5;
      const alt = h * peakK + wob * 3;
      const slope = slopeMap[i] + wob * 7;
      const shore = shoreMap[i] + wob * 260;
      const road = roadMap[i] + wob * 90;
      let n = 1; ids[0] = 0; ws[0] = 1; // start as the bare island
      for (let k = 0; k < L.count; k++) {
        const f = flags[k], o = k * S;
        let c = strength[k];
        if (f & F_ALT) { c *= bandAt(p, o, alt); if (c <= 0.002) continue; }
        if (f & F_SLOPE) { c *= bandAt(p, o + 3, slope); if (c <= 0.002) continue; }
        if (f & F_SHORE) { c *= bandAt(p, o + 6, shore); if (c <= 0.002) continue; }
        if (f & F_ROAD) { if (road === Infinity) continue; c *= bandAt(p, o + 9, road); if (c <= 0.002) continue; }
        if (f & F_HOLLOW) {
          const amount = p[o + 13];
          const v = (p[o + 12] ? hollowLarge[i] : hollowSmall[i]) * p[o + 14];
          const a = amount < 0 ? -amount : amount;
          c *= 1 - a + a * smooth(-0.3, 0.8, amount > 0 ? v : -v);
        }
        if (f & F_FACING) { const fa = p[o + 15]; c *= 1 - (fa < 0 ? -fa : fa) * 0.5 + fa * 0.5 * facing[i]; }
        if (f & F_NOISE) {
          const nv = fbm2(wx * p[o + 16], wz * p[o + 16], p[o + 19]);
          const th = p[o + 18], amount = p[o + 17];
          c *= 1 - amount + amount * smooth(th - 0.16, th + 0.16, nv);
        }
        if (c <= 0.002) continue;
        if (c > 1) c = 1;
        // Paint the layer over the stack: everything under it shrinks by its share.
        const sid = surface[k];
        let found = -1;
        for (let j = 0; j < n; j++) { ws[j] *= 1 - c; if (ids[j] === sid) found = j; }
        if (found >= 0) ws[found] += c;
        else if (n < 8) { ids[n] = sid; ws[n] = c; n++; }
        else { let lo = 0; for (let j = 1; j < n; j++) if (ws[j] < ws[lo]) lo = j; ids[lo] = sid; ws[lo] = c; }
      }
      // The two strongest, and their balance.
      let a = 0, b = -1;
      for (let j = 1; j < n; j++) {
        if (ws[j] > ws[a]) { b = a; a = j; } else if (b < 0 || ws[j] > ws[b]) b = j;
      }
      const out = i * 4;
      const wa = ws[a], wb = b >= 0 ? ws[b] : 0;
      if (b < 0 || wb < 0.02 * (wa + wb)) { mask[out] = ids[a]; mask[out + 1] = ids[a]; mask[out + 2] = 0; }
      else { mask[out] = ids[a]; mask[out + 1] = ids[b]; mask[out + 2] = Math.round((wb / (wa + wb)) * 255); }
      coverage[ids[a]] = (coverage[ids[a]] ?? 0) + 1;
    }
    if (onProgress && (y & 31) === 31) onProgress((y + 1) / res);
  }
  onProgress?.(1);
  return { mask, coverage, ms: Date.now() - t0 };
}

/** FNV-1a of a mask, for determinism checks. */
export function maskHash(mask: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < mask.length; i++) { h ^= mask[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/**
 * A mask `factor` times finer, blended rather than blocky: each fine texel gathers the surfaces of the
 * four coarse texels around it, weighted bilinearly by distance and by each surface's share, and keeps
 * the two strongest. Where a coarse texel's pair changes, the fine texels fade across instead of stepping.
 */
export function upsampleMask(src: Uint8Array, res: number, factor = 2): Uint8Array {
  const out = new Uint8Array(src.length * factor * factor);
  const fine = res * factor;
  const cid = new Int32Array(8), cw = new Float64Array(8);
  const co = new Int32Array(4), cb = new Float64Array(4);
  for (let y = 0; y < fine; y++) {
    const py = (y + 0.5) / factor - 0.5;
    const y0 = Math.max(0, Math.min(res - 1, Math.floor(py))), y1 = Math.min(res - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, py - y0));
    for (let x = 0; x < fine; x++) {
      const px = (x + 0.5) / factor - 0.5;
      const x0 = Math.max(0, Math.min(res - 1, Math.floor(px))), x1 = Math.min(res - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, px - x0));
      co[0] = (y0 * res + x0) * 4; cb[0] = (1 - tx) * (1 - ty);
      co[1] = (y0 * res + x1) * 4; cb[1] = tx * (1 - ty);
      co[2] = (y1 * res + x0) * 4; cb[2] = (1 - tx) * ty;
      co[3] = (y1 * res + x1) * 4; cb[3] = tx * ty;
      let n = 0;
      for (let k = 0; k < 4; k++) {
        const o = co[k], bw = cb[k];
        if (bw <= 0) continue;
        const a = src[o], b = src[o + 1];
        const wb = a === b ? 0 : src[o + 2] / 255;
        // Up to two (surface, weight) pairs per corner, merged into the candidates.
        for (let s = 0; s < 2; s++) {
          const id = s === 0 ? a : b;
          const w = s === 0 ? bw * (1 - wb) : bw * wb;
          if (w <= 0) continue;
          let j = 0;
          while (j < n && cid[j] !== id) j++;
          if (j < n) cw[j] += w;
          else { cid[n] = id; cw[n] = w; n++; }
        }
      }
      let ia = 0, ib = -1;
      for (let j = 1; j < n; j++) { if (cw[j] > cw[ia]) { ib = ia; ia = j; } else if (ib < 0 || cw[j] > cw[ib]) ib = j; }
      const o = (y * fine + x) * 4;
      if (ib < 0 || cw[ib] < 0.02 * (cw[ia] + cw[ib])) { out[o] = cid[ia]; out[o + 1] = cid[ia]; }
      else { out[o] = cid[ia]; out[o + 1] = cid[ib]; out[o + 2] = Math.round((cw[ib] / (cw[ia] + cw[ib])) * 255); }
    }
  }
  return out;
}
