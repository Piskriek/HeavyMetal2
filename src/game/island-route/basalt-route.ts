/**
 * ISLAND-ROUTE: Basalt Isle's roads, from the goblin's shack on the summit to the lagoon arena.
 *
 * The race shape is the owner's (docs/ISLAND_PLAN.md §0): the prologue "Late for the race" (two turns
 * and a jump into the crater), the Maw (the sorting pool at engine x 8304, where the field is held and
 * fired out in arrival order), the veins (a braid of forks that split and rejoin, the first one three
 * ways), the Drain (one vortex funnel to sea level) and the finish at the lagoon arena.
 *
 * Everything is authored as anchors pinned to engine x (the track-space knots) with shared stretches or
 * forks between them. A fork's branches all start on the split anchor and end on the merge anchor, and
 * share a short straight lead and tail, so the spline around the anchors is identical in every branch's
 * map and a racer never jumps when the view changes map at a split or a merge. Forks list their
 * branches left to right as seen at the split (outer, sea side, first).
 */
import type { CenterlineWaypoint, TrackKnot, TrackStageId } from '../track-space';
import type { RouteGraph } from '../sim/route';
import { polar, sweep, wiggle, wp, type PolarPoint } from './geometry';

export interface IslandAnchor {
  readonly label: string;
  /** Engine x this point is pinned to. */
  readonly x: number;
  readonly at: PolarPoint;
  readonly stage: TrackStageId;
}

export interface IslandBranch {
  readonly id: string;
  readonly name: string;
  /** The waypoints between the fork's shared lead and tail. */
  readonly points: readonly CenterlineWaypoint[];
}

export type IslandSegment =
  | { readonly kind: 'road'; readonly points: readonly CenterlineWaypoint[] }
  | {
    readonly kind: 'fork';
    readonly id: string;
    readonly name: string;
    /** Shared first point after the split and last point before the merge (straight stubs). */
    readonly lead: CenterlineWaypoint;
    readonly tail: CenterlineWaypoint;
    readonly branches: readonly IslandBranch[];
  };

const A = (label: string, x: number, theta: number, r: number, y: number, stage: TrackStageId): IslandAnchor =>
  ({ label, x, at: { theta, r, y }, stage });

/** A point `ahead` units along the circle from an anchor (used for the fork stubs). */
const along = (p: PolarPoint, ahead: number, dy: number, stage: TrackStageId, label?: string) =>
  wp({ theta: p.theta + (ahead / p.r) * (180 / Math.PI), r: p.r, y: p.y + dy }, stage, label);
const back = (p: PolarPoint, behind: number, dy: number, stage: TrackStageId, label?: string) => along(p, -behind, dy, stage, label);

/** A tight clockwise spiral round a centre off the volcano's axis (the Drain). */
function vortex(
  centre: PolarPoint, startDeg: number, turns: number, r0: number, r1: number, y0: number, y1: number, n: number,
  stage: TrackStageId,
): CenterlineWaypoint[] {
  const c = polar(centre);
  const out: CenterlineWaypoint[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = (startDeg + 360 * turns * t) * (Math.PI / 180);
    const r = r0 + (r1 - r0) * t;
    out.push({ x: c.x + r * Math.sin(a), y: y0 + (y1 - y0) * t, z: c.z - r * Math.cos(a), stage });
  }
  return out;
}

/* -----------------------------------------------------------------------------
   THE ANCHORS (engine x, where on the island, how high)
   -------------------------------------------------------------------------- */
const START = A('start', 190, -68, 4400, 21500, 'alpine');
const MAW = A('maw', 8304, 150, 2900, 18200, 'alpine');
const RIM_S = A('rim:split', 10400, 186, 7200, 16000, 'alpine');
const RIM_M = A('rim:merge', 18000, 300, 8600, 13600, 'alpine');
const SPI_S = A('spiral:split', 19200, 318, 9200, 13100, 'alpine');
const SPI_M = A('spiral:merge', 24400, 380, 11000, 10600, 'alpine');
const TUB_S = A('tube:split', 25400, 390, 11400, 10200, 'cavern');
const TUB_M = A('tube:merge', 31400, 455, 12800, 8000, 'mine');
const CHA_S = A('chamber:split', 32400, 465, 13200, 7700, 'mine');
const CHA_M = A('chamber:merge', 37400, 510, 14600, 6400, 'mine');
const CLF_S = A('cliff:split', 41400, 538, 17500, 5600, 'zigzag');
const CLF_M = A('cliff:merge', 47400, 585, 19000, 4300, 'zigzag');
const CRS_S = A('cross:split', 48400, 592, 19400, 4150, 'zigzag');
const CRS_M = A('cross:merge', 53400, 625, 21000, 3500, 'zigzag');
const ARC_S = A('arch:split', 54400, 632, 21400, 3350, 'zigzag');
const ARC_M = A('arch:merge', 59400, 660, 23500, 2700, 'zigzag');
const STK_S = A('stacks:split', 60400, 666, 23900, 2600, 'zigzag');
const STK_M = A('stacks:merge', 64400, 686, 25000, 2300, 'zigzag');
// The finish line is past the Drain's lip, on the way into the arena.
const FINISH = A('finish', 72190, 703, 30500, 150, 'stadium');

/** The Drain's funnel sits on the north coast; its spiral ends at the lagoon arena's gate. */
const DRAIN = { theta: 700, r: 27800, y: 0 } as const;

const anchorWp = (a: IslandAnchor) => wp(a.at, a.stage, a.label);

/* -----------------------------------------------------------------------------
   THE ROUTE, IN ORDER
   -------------------------------------------------------------------------- */
function fork(
  id: string, name: string, s: IslandAnchor, m: IslandAnchor, stage: TrackStageId,
  branches: readonly IslandBranch[],
): IslandSegment {
  const stub = 700;
  const lead = along(s.at, stub, -stub * 0.08, s.stage, `${id}:lead`);
  const tail = back(m.at, stub, stub * 0.08, stage);
  return { kind: 'fork', id, name, lead, tail, branches };
}

/** A branch's points from the fork's lead to its tail: a sweep through its own middle. */
function branch(
  id: string, name: string, s: IslandAnchor, m: IslandAnchor,
  middle: (from: PolarPoint, to: PolarPoint) => CenterlineWaypoint[],
): IslandBranch {
  const stub = 700;
  const from: PolarPoint = { theta: s.at.theta + (stub / s.at.r) * (180 / Math.PI), r: s.at.r, y: s.at.y - stub * 0.08 };
  const to: PolarPoint = { theta: m.at.theta - (stub / m.at.r) * (180 / Math.PI), r: m.at.r, y: m.at.y + stub * 0.08 };
  // The middle's last point would sit on the tail, which the fork adds itself.
  return { id, name, points: middle(from, to).slice(0, -1) };
}

/** Through a polar point on the way from `from` to `to`. */
const via = (mid: PolarPoint, n1: number, n2: number, stage: TrackStageId) =>
  (from: PolarPoint, to: PolarPoint) => [...sweep(from, mid, n1, stage), ...sweep(mid, to, n2, stage)];

export const ISLAND_ANCHORS: readonly IslandAnchor[] = [
  START, MAW, RIM_S, RIM_M, SPI_S, SPI_M, TUB_S, TUB_M, CHA_S, CHA_M, CLF_S, CLF_M, CRS_S, CRS_M,
  ARC_S, ARC_M, STK_S, STK_M, FINISH,
];

/** Segment i runs from anchor i to anchor i + 1. */
export const ISLAND_SEGMENTS: readonly IslandSegment[] = [
  // Prologue: "Late for the race". Out of the shack along the summit crag, a right-hander, a
  // left-hander, then over the crater rim and down onto the crater floor to the Maw's crown.
  { kind: 'road', points: [
    along(START.at, 900, 0, 'alpine', 'startRamp'),
    along(START.at, 1800, -20, 'alpine', 'launchEdge'),
    ...sweep({ theta: START.at.theta + 23, r: 4400, y: 21480 }, { theta: -20, r: 5600, y: 21050 }, 4, 'alpine'),
    ...sweep({ theta: -20, r: 5600, y: 21050 }, { theta: 12, r: 4300, y: 20500 }, 4, 'alpine'),
    wp({ theta: 22, r: 3900, y: 20350 }, 'alpine', 'rimJump'),
    ...sweep({ theta: 22, r: 3900, y: 20350 }, { theta: 70, r: 2300, y: 18700 }, 4, 'alpine'),
    ...sweep({ theta: 70, r: 2300, y: 18700 }, { theta: 138, r: 2500, y: 18300 }, 4, 'alpine'),
  ] },
  // The Maw fires the field out of its mouth, down the chute and onto the first slope.
  { kind: 'road', points: [
    wp({ theta: 156, r: 3700, y: 18000 }, 'alpine', 'mawMouth'),
    ...sweep({ theta: 156, r: 3700, y: 18000 }, { theta: 178, r: 6300, y: 16300 }, 4, 'alpine'),
  ] },
  // The first split: two good roads and a longer one that earns its time.
  fork('rim', 'The Caldera', RIM_S, RIM_M, 'alpine', [
    branch('long', 'The Long Way', RIM_S, RIM_M, via({ theta: 243, r: 11600, y: 14900 }, 6, 6, 'alpine')),
    branch('rim', 'Rim Road', RIM_S, RIM_M,
      (from, to) => wiggle(from, to, 10, 700, 2, 'alpine')),
    branch('ledge', 'Lava Ledge', RIM_S, RIM_M, via({ theta: 243, r: 6300, y: 14700 }, 5, 5, 'alpine')),
  ]),
  { kind: 'road', points: sweep(RIM_M.at, { theta: 310, r: 8900, y: 13350 }, 2, 'alpine') },
  // Obsidian Spiral: switchbacks down the flank, or the straight basalt slide.
  fork('spiral', 'Obsidian Spiral', SPI_S, SPI_M, 'alpine', [
    branch('hairpins', 'Switchbacks', SPI_S, SPI_M,
      (from, to) => wiggle({ ...from, r: from.r + 300 }, to, 14, 1000, 3, 'alpine')),
    branch('slide', 'Basalt Slide', SPI_S, SPI_M, via({ theta: 349, r: 9500, y: 11900 }, 3, 3, 'alpine')),
  ]),
  { kind: 'road', points: [
    ...sweep(SPI_M.at, { theta: 386, r: 11250, y: 10400 }, 1, 'alpine'),
    wp({ theta: 389, r: 11380, y: 10250 }, 'cavern', 'caveEnter'),
  ] },
  // Into the mountain: the lava tube, or the side vent over the lava river.
  fork('tube', 'The Lava Tube', TUB_S, TUB_M, 'cavern', [
    branch('vent', 'Side Vent', TUB_S, TUB_M, via({ theta: 422, r: 13600, y: 9000 }, 5, 5, 'cavern')),
    branch('tube', 'Main Tube', TUB_S, TUB_M, via({ theta: 422, r: 11700, y: 9150 }, 5, 5, 'cavern')),
  ]),
  { kind: 'road', points: sweep(TUB_M.at, { theta: 460, r: 13000, y: 7850 }, 2, 'mine') },
  // The deep chambers: the lava bridge, or the crumbling ledge.
  fork('chamber', 'The Chambers', CHA_S, CHA_M, 'mine', [
    branch('bridge', 'Lava Bridge', CHA_S, CHA_M, via({ theta: 487, r: 14900, y: 7100 }, 4, 4, 'mine')),
    branch('crumble', 'Crumbling Ledge', CHA_S, CHA_M, via({ theta: 487, r: 13300, y: 6900 }, 4, 4, 'mine')),
  ]),
  // Waterfall Breakthrough: out behind the big waterfall and down its face (every branch meets here).
  { kind: 'road', points: [
    wp({ theta: 514, r: 15100, y: 6300 }, 'breakthrough', 'caveExit'),
    ...wiggle({ theta: 514, r: 15100, y: 6300 }, { theta: 532, r: 17100, y: 5700 }, 8, 900, 1.5, 'breakthrough'),
  ] },
  // Cliff Road: timber trestles on the edge, or a ledge cut into the cliff face.
  fork('cliff', 'Cliff Road', CLF_S, CLF_M, 'zigzag', [
    branch('trestle', 'Cliff Trestles', CLF_S, CLF_M, via({ theta: 561, r: 19500, y: 5000 }, 5, 5, 'zigzag')),
    branch('face', 'Cliff-Face Ledge', CLF_S, CLF_M, via({ theta: 561, r: 17700, y: 4600 }, 5, 5, 'zigzag')),
  ]),
  { kind: 'road', points: sweep(CLF_M.at, { theta: 589, r: 19200, y: 4220 }, 1, 'zigzag') },
  // The crossing: the high road swings inward over the low road on a bridge, the low road ducks under.
  fork('cross', 'The Crossing', CRS_S, CRS_M, 'zigzag', [
    branch('high', 'High Bridge', CRS_S, CRS_M, (from, to) => [
      ...sweep(from, { theta: 603, r: 20700, y: 4250 }, 3, 'zigzag'),
      ...sweep({ theta: 603, r: 20700, y: 4250 }, { theta: 610, r: 19300, y: 4700 }, 2, 'zigzag'),
      ...sweep({ theta: 610, r: 19300, y: 4700 }, to, 4, 'zigzag'),
    ]),
    branch('low', 'Low Road', CRS_S, CRS_M, (from, to) => [
      ...sweep(from, { theta: 603, r: 18900, y: 3900 }, 3, 'zigzag'),
      ...sweep({ theta: 603, r: 18900, y: 3900 }, { theta: 611, r: 21300, y: 3700 }, 2, 'zigzag'),
      ...sweep({ theta: 611, r: 21300, y: 3700 }, to, 4, 'zigzag'),
    ]),
  ]),
  { kind: 'road', points: sweep(CRS_M.at, { theta: 628, r: 21200, y: 3420 }, 1, 'zigzag') },
  // The headland: round the outside of the sea arch, or through the sea cave under it.
  fork('arch', 'The Sea Arch', ARC_S, ARC_M, 'zigzag', [
    branch('outside', 'Round the Arch', ARC_S, ARC_M, via({ theta: 646, r: 24900, y: 3100 }, 4, 4, 'zigzag')),
    branch('cave', 'Sea Cave', ARC_S, ARC_M, via({ theta: 646, r: 22000, y: 2500 }, 4, 4, 'zigzag')),
  ]),
  { kind: 'road', points: sweep(ARC_M.at, { theta: 663, r: 23700, y: 2650 }, 1, 'zigzag') },
  // Sea Stack Slalom: the beach shelf among the stacks, or the cliff-top path above them.
  fork('stacks', 'Sea Stack Slalom', STK_S, STK_M, 'zigzag', [
    branch('shelf', 'Beach Shelf', STK_S, STK_M,
      (from, to) => wiggle({ ...from, r: from.r + 400 }, { ...to, r: to.r + 300 }, 8, 900, 2, 'zigzag')),
    branch('clifftop', 'Cliff-Top Path', STK_S, STK_M, via({ theta: 676, r: 24000, y: 2550 }, 3, 3, 'zigzag')),
  ]),
  // The Drain: every road pours into one lane, a basalt vortex spiralling down to sea level; its lip
  // fires the field through the arena gate.
  { kind: 'road', points: [
    ...sweep(STK_M.at, { theta: 694, r: 25300, y: 2200 }, 2, 'canyon'),
    wp({ theta: 696, r: 25300, y: 2150 }, 'canyon', 'canyonStart'),
    ...vortex(DRAIN, 205, 1.25, 2600, 900, 2100, 380, 20, 'canyon'),
    wp({ theta: 702, r: 29500, y: 260 }, 'stadium', 'drainLip'),
  ] },
];

/**
 * The shack's yard behind the start line: the road runs back to the shack door, so the chase camera
 * has road behind the grid (the classic course keeps 1,100 units there too).
 */
export const ISLAND_PRELUDE: readonly CenterlineWaypoint[] = [
  back(START.at, 1400, 0, 'alpine', 'shack'),
  back(START.at, 700, 0, 'alpine'),
];

/** Finish at the arena gate, then the run-out onto the lagoon bowl (visual only). */
export const ISLAND_RUNOUT: readonly CenterlineWaypoint[] = [
  wp({ theta: 704, r: 31500, y: 60 }, 'stadium', 'arena'),
  wp({ theta: 705, r: 32600, y: 0 }, 'stadium', 'end'),
];

/** The race's forks, as the engine's route graph. */
export const ISLAND_ROUTE_GRAPH: RouteGraph = {
  sections: ISLAND_SEGMENTS.flatMap((segment, i) => segment.kind !== 'fork' ? [] : [{
    id: segment.id,
    x0: ISLAND_ANCHORS[i].x,
    x1: ISLAND_ANCHORS[i + 1].x,
    branches: segment.branches.map((b) => ({ id: b.id, name: b.name })),
  }]),
};

/** Which branch each fork takes; absent = the first (outer) branch. */
export type BranchChoice = Readonly<Record<string, string>>;

/** The full centreline for a choice of branches, and its knots. */
export function islandCenterline(choice: BranchChoice = {}): { waypoints: CenterlineWaypoint[]; knots: TrackKnot[] } {
  const waypoints: CenterlineWaypoint[] = [...ISLAND_PRELUDE];
  ISLAND_SEGMENTS.forEach((segment, i) => {
    waypoints.push(anchorWp(ISLAND_ANCHORS[i]));
    if (segment.kind === 'road') {
      waypoints.push(...segment.points);
    } else {
      const chosen = segment.branches.find((b) => b.id === choice[segment.id]) ?? segment.branches[0];
      waypoints.push(segment.lead, ...chosen.points, segment.tail);
    }
  });
  waypoints.push(anchorWp(ISLAND_ANCHORS[ISLAND_ANCHORS.length - 1]), ...ISLAND_RUNOUT);
  const knots = ISLAND_ANCHORS.map((a) => ({ label: a.label, x: a.x }));
  return { waypoints, knots };
}
