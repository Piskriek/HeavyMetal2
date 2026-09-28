/**
 * SHIPPED COURSES: the owner's island, as the game ships it.
 *
 * Everything the owner builds in the 3D Map Editor (island tracks: props, finish lines, sculpts; ground
 * paint; lane edits; the sky, sea and clouds) is saved in the owner's own browser. A new player would
 * see an empty island. "Publish island to the game" (builder → File) writes all of it to
 * `public/courses/island.json`; the game loads that file at boot and the island's readers fall back to
 * it wherever the player has nothing of their own:
 *
 *  - island tracks list: the player's own tracks, then any shipped track they do not have;
 *  - a track's props / ground paint: the player's save, else the shipped copy;
 *  - the island lanes: the player's edit, else the shipped lanes, else the built-in groove lanes;
 *  - sky, sea and clouds: the player's settings, else the shipped look.
 *
 * Read-only and in memory: never copied into player storage (RUN.world's cloud saves cap a value at
 * ~1 MB and a bucket at 10 MB; ground paint alone can be large), and a new game version's course
 * reaches every player who has not edited it.
 */
import { asset } from '../platform/asset';

export const SHIPPED_COURSES_URL = '/courses/island.json';
export const SHIPPED_COURSES_VERSION = 1;

export interface ShippedTrack {
  id: string;
  name: string;
  /** Placed props (PlacedProp[]), as the island props store saves them. */
  props: unknown[];
  /** The island ground document for this track (paint, road paint, settings), if any. */
  ground?: unknown;
}

export interface ShippedCourses {
  version: number;
  publishedAt: string;
  /** The track a new player starts on. */
  active: string;
  tracks: ShippedTrack[];
  /** The island's lane network (LaneNetwork), when the owner edited it. */
  lanes?: unknown;
  /** The owner's sky / sea / clouds (SkySettings), the default look. */
  sky?: unknown;
}

let shipped: ShippedCourses | null = null;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A published file → the shape above, or null when it is not one. */
export function parseShippedCourses(raw: unknown): ShippedCourses | null {
  if (!isObj(raw) || raw.version !== SHIPPED_COURSES_VERSION || !Array.isArray(raw.tracks)) return null;
  const tracks = raw.tracks.filter((t): t is ShippedTrack => isObj(t) && typeof t.id === 'string' && !!t.id && typeof t.name === 'string' && Array.isArray(t.props));
  if (!tracks.length) return null;
  return {
    version: SHIPPED_COURSES_VERSION,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : '',
    active: typeof raw.active === 'string' && tracks.some((t) => t.id === raw.active) ? raw.active : tracks[0]!.id,
    tracks,
    ...(raw.lanes !== undefined ? { lanes: raw.lanes } : {}),
    ...(raw.sky !== undefined ? { sky: raw.sky } : {}),
  };
}

/** The shipped island, once loaded (null: none published, or not loaded). */
export const shippedCourses = (): ShippedCourses | null => shipped;
export const shippedTrack = (id: string): ShippedTrack | null => shipped?.tracks.find((t) => t.id === id) ?? null;

/** Tests, and a builder that just published: set (or clear) the shipped island directly. */
export function setShippedCourses(doc: ShippedCourses | null): void { shipped = doc; }

/** Loads the published island at boot. A missing or broken file means none: never an error. */
export async function loadShippedCourses(fetcher: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch): Promise<ShippedCourses | null> {
  if (!fetcher) return null;
  try {
    const res = await fetcher(asset(SHIPPED_COURSES_URL), { cache: 'no-cache' });
    shipped = res.ok ? parseShippedCourses(await res.json()) : null;
  } catch {
    shipped = null;
  }
  return shipped;
}
