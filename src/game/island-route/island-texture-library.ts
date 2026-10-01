/**
 * ISLAND-ROUTE: every tile an island surface can wear. The 14 originals (`public/textures/island`), plus
 * whatever is dropped into `src/assets/island-textures/` — found at build time, no list to keep — plus
 * the Basalt Isle library in `public/textures/island-lib/` (256 px WebP tiles built from the image
 * agent's material sheets by the art pipeline, listed in `island-lib-index.generated.ts`). A file
 * named `<kind>-<anything>.jpg` (e.g. `grass-lush-meadow-03.jpg`) is offered first for the surfaces of
 * that kind; every tile is offered for every surface.
 *
 * The owner swaps a surface's tile by clicking its thumbnail in the Island panel; the choice is saved
 * with the island ground (`IslandGroundSettings.textures`) and loaded behind the loading bar.
 */
import {
  SURFACE_BEACH_GRASS, SURFACE_CORAL_SAND, SURFACE_CRYSTAL, SURFACE_DARK_ROCK, SURFACE_DRY_MUD, SURFACE_DUNES,
  SURFACE_GRANITE, SURFACE_MOSSY_ROCK, SURFACE_OLD_PLANKS, SURFACE_RIVETED_IRON, SURFACE_SAND, SURFACE_SHALLOWS,
  SURFACE_STRATA, SURFACE_WET_SAND,
} from '../surface/surface-table';
import { ISLAND_LIB } from './island-lib-index.generated';
import { ISLAND_SURFACES, ISLAND_TEXTURE_DIR } from './island-surfaces';

/** Where the library's tiles are served from. In `public/` on purpose: `src/assets` is inlined into the RUN single-file build. */
export const ISLAND_LIB_DIR = '/textures/island-lib/';
/** The packed PBR maps of the library's sheet tiles (same file names): R/G tangent normal, B roughness. */
export const ISLAND_LIB_PBR_DIR = '/textures/island-lib-pbr/';

export interface LibraryTexture {
  /** Stable key saved with the ground: `original/<file>` or `library/<file>`. */
  readonly key: string;
  readonly url: string;
  /** The file name's first word (sand, grass, rock...). */
  readonly kind: string;
  /** Readable name from the file name. */
  readonly name: string;
  /** The tile's packed PBR maps (normal xy + roughness), when it has them. */
  readonly pbr?: string;
}

/** Which file-name kinds suit each surface (offered first when swapping its tile). */
export const KINDS_FOR_SURFACE: Readonly<Record<number, readonly string[]>> = {
  [SURFACE_SAND]: ['sand', 'path'],
  [SURFACE_WET_SAND]: ['wetsand', 'sand'],
  [SURFACE_SHALLOWS]: ['shallows', 'water'],
  [SURFACE_DARK_ROCK]: ['rock'],
  [SURFACE_OLD_PLANKS]: ['planks', 'wood'],
  [SURFACE_RIVETED_IRON]: ['iron', 'metal'],
  [SURFACE_CRYSTAL]: ['crystal'],
  [SURFACE_BEACH_GRASS]: ['grass', 'forest'],
  [SURFACE_CORAL_SAND]: ['coral', 'sand'],
  [SURFACE_GRANITE]: ['cliff', 'rock'],
  [SURFACE_MOSSY_ROCK]: ['moss', 'rock'],
  [SURFACE_DRY_MUD]: ['mud', 'path', 'litter'],
  [SURFACE_DUNES]: ['dunes', 'sand'],
  [SURFACE_STRATA]: ['cliff', 'strata', 'rock'],
};

const nameOf = (file: string) => file.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const kindOf = (file: string) => file.toLowerCase().split(/[-_.]/)[0] ?? '';

/** The originals, one per surface. */
const ORIGINALS: LibraryTexture[] = ISLAND_SURFACES.map((s) => ({
  key: `original/${s.file}`, url: ISLAND_TEXTURE_DIR + s.file, kind: kindOf(s.file), name: `${nameOf(s.file)} (original)`,
}));

/** Tiles dropped into src/assets/island-textures (Vite finds them; none in a node test). */
const DROPPED: LibraryTexture[] = (() => {
  let files: Record<string, string>;
  // Vite rewrites this call at build time; outside Vite (node tests) there is no glob and no library.
  try { files = import.meta.glob('../../assets/island-textures/*.{jpg,jpeg,png,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>; }
  catch { return []; }
  return Object.entries(files).map(([path, url]) => {
    const file = path.split('/').pop() ?? path;
    return { key: `library/${file}`, url, kind: kindOf(file), name: nameOf(file) };
  }).sort((a, b) => a.key.localeCompare(b.key));
})();

/** The Basalt Isle library (public/textures/island-lib): the name carries the sheet's id and says when a tile is provisional. */
const LIB: LibraryTexture[] = ISLAND_LIB.map((e) => ({
  key: `lib/${e.file}`, url: ISLAND_LIB_DIR + e.file, kind: e.kind, name: e.name,
  // every tile made from a sheet (id m###) has maps; the salvaged old-repo tiles (gp##) do not
  pbr: /-m\d{3}\.webp$/.test(e.file) ? ISLAND_LIB_PBR_DIR + e.file : undefined,
}));

/** The game's own ground textures (public/textures), usable on the island too. */
const GAME: LibraryTexture[] = ([
  ['dirt.png', 'path'], ['grass.png', 'grass'], ['cliff.png', 'cliff'], ['caverock.png', 'rock'], ['cobble.png', 'path'],
  ['wood.png', 'planks'], ['iron.png', 'iron'], ['water.png', 'shallows'], ['lava.png', 'lava'], ['bark.png', 'bark'],
] as const).map(([file, kind]) => ({ key: `game/${file}`, url: `/textures/${file}`, kind, name: `${nameOf(file)} (game)` }));

export const ISLAND_TEXTURE_LIBRARY: readonly LibraryTexture[] = Object.freeze([...ORIGINALS, ...DROPPED, ...LIB, ...GAME]);

export const libraryTexture = (key: string | undefined) => (key ? ISLAND_TEXTURE_LIBRARY.find((t) => t.key === key) : undefined);

/** The tiles to offer for a surface: its own kinds first, then everything else. */
export function texturesFor(surface: number): { suggested: LibraryTexture[]; others: LibraryTexture[] } {
  const kinds = KINDS_FOR_SURFACE[surface] ?? [];
  const original = ISLAND_SURFACES.find((s) => s.id === surface);
  const suggested: LibraryTexture[] = [], others: LibraryTexture[] = [];
  for (const t of ISLAND_TEXTURE_LIBRARY) {
    if ((original && t.key === `original/${original.file}`) || kinds.includes(t.kind)) suggested.push(t);
    else others.push(t);
  }
  return { suggested, others };
}
