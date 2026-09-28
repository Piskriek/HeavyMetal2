/**
 * ISLAND-ROUTE: every tile an island surface can wear. The 14 originals (`public/textures/island`), plus
 * whatever is dropped into `src/assets/island-textures/` — found at build time, no list to keep. A file
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
import { ISLAND_SURFACES, ISLAND_TEXTURE_DIR } from './island-surfaces';

export interface LibraryTexture {
  /** Stable key saved with the ground: `original/<file>` or `library/<file>`. */
  readonly key: string;
  readonly url: string;
  /** The file name's first word (sand, grass, rock...). */
  readonly kind: string;
  /** Readable name from the file name. */
  readonly name: string;
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
  [SURFACE_BEACH_GRASS]: ['grass'],
  [SURFACE_CORAL_SAND]: ['coral', 'sand'],
  [SURFACE_GRANITE]: ['cliff', 'rock'],
  [SURFACE_MOSSY_ROCK]: ['moss', 'rock'],
  [SURFACE_DRY_MUD]: ['mud', 'path'],
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
  const glob = (import.meta as unknown as { glob?: (p: string, o: object) => Record<string, string> }).glob;
  if (typeof glob !== 'function') return [];
  const files = import.meta.glob('../../assets/island-textures/*.{jpg,jpeg,png,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
  return Object.entries(files).map(([path, url]) => {
    const file = path.split('/').pop() ?? path;
    return { key: `library/${file}`, url, kind: kindOf(file), name: nameOf(file) };
  }).sort((a, b) => a.key.localeCompare(b.key));
})();

export const ISLAND_TEXTURE_LIBRARY: readonly LibraryTexture[] = Object.freeze([...ORIGINALS, ...DROPPED]);

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
