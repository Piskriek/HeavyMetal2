/**
 * ROUTE-1: forks. A course is a chain of sections along engine x; a forked section has two or more
 * branches, all spanning the same engine-x range (split → merge), so progress, standings and every
 * speed stay one number. What differs per branch is what is on it: obstacles and pickups carry an
 * optional `route` tag, and a racer only meets the things on the branch it chose.
 *
 * The law, as for lanes (docs/LANE_NETWORK.md): **no graph is exactly the old game**, and a graph
 * with nothing tagged steps every racer identically too (`routed()` returns the very same context
 * object); the only thing a graph adds by itself is that the engine stops racers on different
 * branches from touching (tests/route-graph.test.ts). Pure TypeScript, deterministic: the branch is
 * chosen from the racer's lateral position at the split, never from randomness.
 */
import { LANE_Z_RANGE } from '../track-space';
import { createRng } from '../rng';

export interface RouteBranch {
  readonly id: string;
  /** What the player sees at the split and on the strip map. */
  readonly name: string;
}

export interface RouteSection {
  readonly id: string;
  /** Engine x where the road divides. */
  readonly x0: number;
  /** Engine x where the branches meet again. */
  readonly x1: number;
  /** Left to right as seen at the split: branch i takes the i-th lateral band. */
  readonly branches: readonly RouteBranch[];
}

export interface RouteGraph {
  /** Forked sections, in ascending x, never overlapping. Unforked stretches need no entry. */
  readonly sections: readonly RouteSection[];
}

/** Which branch a piece of content belongs to. Untagged content is on every branch. */
export interface RouteTag {
  readonly section: string;
  readonly branch: string;
}

/** A racer's choices so far: section id → branch id. */
export type RacerRoute = Readonly<Record<string, string>>;

/** This race's layout: the branches open per section (absent = all), and each open branch's lane variant. */
export interface RouteLayout {
  readonly open?: Readonly<Record<string, readonly string[]>>;
  /** section → branch → lane-network variant (0 … LANE_VARIANTS − 1): narrow, wide, weave. */
  readonly lanes?: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** Authored lane-network variants per branch (ISLAND-ROUTE authors three: narrow, wide, weave). */
export const LANE_VARIANTS = 3;
/** Mixed into the race seed so the layout stream never shares draws with any other stream. */
const LAYOUT_SALT = 0x2f0a7e1b;

/**
 * ROUTE-2: the race seed's layout. Deterministic: the same seed always opens the same branches with
 * the same lane variants, so a race replays exactly and can be shared. Two-branch forks are usually
 * both open (70 %), otherwise one is forced; wider forks are all open 40 % of the time, lose one branch
 * 45 %, and force a single branch 15 %. At least one branch is always open.
 */
export function layoutForSeed(graph: RouteGraph, seed: number): RouteLayout {
  const rng = createRng((seed ^ LAYOUT_SALT) | 0);
  const open: Record<string, readonly string[]> = {};
  const lanes: Record<string, Record<string, number>> = {};
  for (const section of graph.sections) {
    const ids = section.branches.map((b) => b.id);
    const roll = rng.next();
    let chosen: string[];
    if (ids.length === 2) {
      chosen = roll < 0.7 ? ids : [ids[rng.nextInt(2)]];
    } else if (roll < 0.4) {
      chosen = ids;
    } else if (roll < 0.85) {
      const drop = rng.nextInt(ids.length);
      chosen = ids.filter((_, i) => i !== drop);
    } else {
      chosen = [ids[rng.nextInt(ids.length)]];
    }
    open[section.id] = chosen;
    lanes[section.id] = Object.fromEntries(chosen.map((id) => [id, rng.nextInt(LANE_VARIANTS)]));
  }
  return { open, lanes };
}

/** True when a branch is shut in this layout (its gate is down). */
export function branchClosed(section: RouteSection, branchId: string, layout?: RouteLayout | null): boolean {
  return !openBranches(section, layout).some((b) => b.id === branchId);
}

export class RouteGraphError extends Error {}

/** Throws on overlapping, unordered, empty or duplicate sections, so a bad graph fails at load. */
export function validateRouteGraph(graph: RouteGraph): void {
  const ids = new Set<string>();
  let lastEnd = -Infinity;
  for (const section of graph.sections) {
    if (ids.has(section.id)) throw new RouteGraphError(`Section ${section.id} appears twice`);
    ids.add(section.id);
    if (!(section.x1 > section.x0)) throw new RouteGraphError(`Section ${section.id} ends before it starts`);
    if (section.x0 < lastEnd) throw new RouteGraphError(`Section ${section.id} overlaps the one before it`);
    if (section.branches.length < 2) throw new RouteGraphError(`Section ${section.id} needs at least two branches`);
    const branchIds = new Set(section.branches.map((b) => b.id));
    if (branchIds.size !== section.branches.length) throw new RouteGraphError(`Section ${section.id} repeats a branch`);
    lastEnd = section.x1;
  }
}

/** The forked section at engine x, or null on a shared stretch. */
export function sectionAt(graph: RouteGraph | null | undefined, x: number): RouteSection | null {
  if (!graph) return null;
  for (const section of graph.sections) if (x >= section.x0 && x < section.x1) return section;
  return null;
}

/** The open branches of a section, in their left-to-right order. */
export function openBranches(section: RouteSection, layout?: RouteLayout | null): readonly RouteBranch[] {
  const open = layout?.open?.[section.id];
  if (!open) return section.branches;
  const list = section.branches.filter((b) => open.includes(b.id));
  return list.length ? list : section.branches;
}

/**
 * The branch a racer at lateral `z` takes: the road's width is shared equally among the open
 * branches, left (−z) to right (+z). The edge between two bands goes to the right-hand branch.
 */
export function chooseBranch(section: RouteSection, z: number, layout?: RouteLayout | null): string {
  const open = openBranches(section, layout);
  const t = (Math.max(-LANE_Z_RANGE, Math.min(LANE_Z_RANGE, z)) + LANE_Z_RANGE) / (2 * LANE_Z_RANGE);
  return open[Math.min(open.length - 1, Math.floor(t * open.length))].id;
}

/** True when content with this tag exists for a racer on this route. */
export function onRoute(tag: RouteTag | undefined, route: RacerRoute | undefined): boolean {
  return !tag || route?.[tag.section] === tag.branch;
}

/**
 * Commits a racer's branch when it reaches a split. Returns the new route (a new object only when
 * something changed, so a caller can cheaply tell), or the old one.
 */
export function advanceRoute(
  route: RacerRoute | undefined,
  x: number,
  z: number,
  graph: RouteGraph | null | undefined,
  layout?: RouteLayout | null,
): RacerRoute | undefined {
  const section = sectionAt(graph, x);
  if (!section || route?.[section.id]) return route;
  return { ...route, [section.id]: chooseBranch(section, z, layout) };
}

/** True when two racers at these positions are on the same road (a fork keeps them apart). */
export function sameRoad(
  a: { x: number; route?: RacerRoute },
  b: { x: number; route?: RacerRoute },
  graph: RouteGraph | null | undefined,
): boolean {
  if (!graph) return true;
  const sa = sectionAt(graph, a.x);
  const sb = sectionAt(graph, b.x);
  if (!sa && !sb) return true;
  if (sa !== sb) return false;
  return a.route?.[sa!.id] === b.route?.[sa!.id];
}

/** A stable key for a route, used to cache per-route world views. */
export function routeKey(route: RacerRoute | undefined): string {
  if (!route) return '';
  return Object.keys(route).sort().map((k) => `${k}=${route[k]}`).join('&');
}
