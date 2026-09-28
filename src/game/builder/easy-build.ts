/**
 * Easy Build: build a track by walking down the road. A cursor sits somewhere along the course (a
 * share, 0 at the start line to 1 at the end); a piece picked from the toolbar drops at the cursor on
 * a spot (left, middle or right of the road, or the roadside), facing down the road, and the cursor
 * walks on a stretch so the next piece goes further down. The editor does the lining up; the player
 * only picks what comes next.
 *
 * Pure: poses come from a TrackSpaceMap, so the tests run it on the plain track.
 */
import { engineDistanceFromX, lateralFromLaneZ, type TrackSpaceMap } from '../track-space';
import { FINISH, START_X } from '../scene';
import { FINISH_LINE_TYPE, START_LINE_TYPE } from '../race-marks';
import { KIT_MODELS, KIT_PREFIX, kitThumbUrl } from '../models/kit-catalog';
import type { PlacedProp } from './prop-catalog';

export type RoadSpot = 'left' | 'middle' | 'right' | 'roadside';
export const ROAD_SPOTS: readonly RoadSpot[] = ['left', 'middle', 'right', 'roadside'];

/** How many stretches the road is walked in (the step of . and ,). */
export const EASY_STRETCHES = 48;
export const STRETCH = 1 / EASY_STRETCHES;

export type EasyShelfId = 'race' | 'stunts' | 'roadside' | 'nature' | 'rocks';

export interface EasyItem {
  type: string;
  name: string;
  thumb: string;
  /** Where it goes when the player has not chosen: race pieces on the road, scenery beside it. */
  spot: RoadSpot;
}

export interface EasyShelf {
  id: EasyShelfId;
  label: string;
  hint: string;
  items: readonly EasyItem[];
}

const kit = (id: string, spot: RoadSpot): EasyItem => {
  const model = KIT_MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`easy-build: no kit model ${id}`);
  return { type: `${KIT_PREFIX}${id}`, name: model.name, thumb: kitThumbUrl(id), spot };
};

export const EASY_SHELVES: readonly EasyShelf[] = [
  {
    id: 'race', label: 'Race', hint: 'Start, finish, boosts and trouble on the road',
    items: [
      kit('start-line', 'middle'), kit('finish-line', 'middle'), kit('boost-pad', 'middle'), kit('spring-pad', 'middle'),
      kit('powerup-fuel', 'middle'), kit('powerup-shield', 'middle'), kit('powerup-bounce', 'middle'), kit('tnt-crate', 'left'), kit('sheep', 'right'),
    ],
  },
  {
    id: 'stunts', label: 'Stunts', hint: 'Ramps, loops and big air',
    items: [
      kit('jump-ramp', 'middle'), kit('stunt-launch-ramp', 'middle'), kit('stunt-cliff-ramp', 'middle'), kit('stunt-landing-deck', 'middle'),
      kit('stunt-half-pipe', 'middle'), kit('stunt-loop-ramp', 'middle'), kit('stunt-corkscrew', 'middle'), kit('stunt-double-loop-ramps', 'middle'),
      kit('stunt-giant-loop', 'middle'), kit('stunt-hoop-tunnel', 'middle'), kit('stunt-waterfall-portal', 'middle'),
    ],
  },
  {
    id: 'roadside', label: 'Roadside', hint: 'Walls, rails, bridges and caves along the road',
    items: [
      kit('railing-wall', 'roadside'), kit('stone-wall', 'roadside'), kit('iron-crate', 'roadside'), kit('arch-bridge', 'middle'),
      kit('boardwalk-bridge', 'middle'), kit('basalt-cave', 'middle'), kit('waterfall-cave', 'middle'), kit('cliff-block', 'roadside'),
      kit('stunt-scaffold-tower', 'roadside'),
    ],
  },
  {
    id: 'nature', label: 'Nature', hint: 'Palms, bushes and grass beside the road',
    items: [
      kit('palm-tall', 'roadside'), kit('palm-leaning', 'roadside'), kit('palm-cluster', 'roadside'), kit('bush-leafy', 'roadside'),
      kit('fern-clump', 'roadside'), kit('grass-tussock', 'roadside'), kit('dry-shrub', 'roadside'), kit('agave', 'roadside'), kit('driftwood', 'roadside'),
    ],
  },
  {
    id: 'rocks', label: 'Rocks', hint: 'Boulders, spires and sea stacks',
    items: [
      kit('rock-boulder-rough', 'roadside'), kit('rock-slab', 'roadside'), kit('rock-pile', 'roadside'), kit('rock-basalt-columns', 'roadside'),
      kit('rock-spire', 'roadside'), kit('sea-rock-mossy', 'roadside'), kit('sea-stack-tall', 'roadside'), kit('sea-arch', 'roadside'),
    ],
  },
];

export const easyShelf = (id: EasyShelfId) => EASY_SHELVES.find((s) => s.id === id) ?? EASY_SHELVES[0];
export const easyItem = (type: string) => EASY_SHELVES.flatMap((s) => s.items).find((i) => i.type === type);

export const clampShare = (share: number) => Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));
export const engineXOfShare = (share: number) => START_X + clampShare(share) * (FINISH - START_X);
export const shareOfEngineX = (x: number) => clampShare((x - START_X) / (FINISH - START_X));

/** The stretch the cursor is in (1-based) and the next / previous stretch's share. */
export const stretchOf = (share: number) => Math.min(EASY_STRETCHES, Math.floor(clampShare(share) * EASY_STRETCHES) + 1);
export const stepShare = (share: number, dir: 1 | -1) => clampShare(Math.round(clampShare(share) * EASY_STRETCHES + dir) / EASY_STRETCHES);

/** Lateral lane position of a road spot (engine laneZ, −480 left … +480 right). */
const SPOT_LANE_Z: Record<Exclude<RoadSpot, 'roadside'>, number> = { left: -300, middle: 0, right: 300 };

export interface RoadPose {
  x: number; y: number; z: number;
  rotY: number;
  /** Arc length along the track map (the builder's trackDist). */
  trackDist: number;
  /** The road's half width there. */
  halfWidth: number;
  /** The road's heading and right, for the camera and the cursor. */
  forward: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
}

/**
 * Where a piece at `share` on `spot` stands. Roadside is past the road edge by `clearance` (half the
 * piece plus a margin), on `side` (−1 left, +1 right). y is the road's height there: the builder
 * drops it onto the ground under it.
 */
export function roadPose(space: TrackSpaceMap, share: number, spot: RoadSpot, side: 1 | -1 = 1, clearance = 300): RoadPose {
  const distance = engineDistanceFromX(engineXOfShare(share));
  const s = space.trackDistFromEngineDistance(distance);
  const frame = space.frameAt(s);
  const lateral = spot === 'roadside'
    ? side * (frame.halfWidth + clearance)
    : lateralFromLaneZ(space, frame.dist, SPOT_LANE_Z[spot]);
  const flat = Math.hypot(frame.tangent.x, frame.tangent.z) || 1;
  return {
    x: frame.pos.x + frame.right.x * lateral,
    y: frame.pos.y + frame.right.y * lateral,
    z: frame.pos.z + frame.right.z * lateral,
    rotY: Math.atan2(frame.tangent.x, frame.tangent.z),
    trackDist: frame.dist,
    halfWidth: frame.halfWidth,
    forward: { x: frame.tangent.x / flat, y: 0, z: frame.tangent.z / flat },
    right: { x: frame.right.x, y: frame.right.y, z: frame.right.z },
  };
}

/** The camera for a stretch: behind and above the cursor, looking down the road. */
export function chaseCamera(pose: RoadPose, back = 2200, up = 1500, ahead = 700): { eye: { x: number; y: number; z: number }; yaw: number; pitch: number } {
  const eye = { x: pose.x - pose.forward.x * back, y: pose.y + up, z: pose.z - pose.forward.z * back };
  const target = { x: pose.x + pose.forward.x * ahead, y: pose.y, z: pose.z + pose.forward.z * ahead };
  const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
  return { eye, yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** What a track still needs, in the order a new builder should do it. */
export interface ChecklistStep { id: 'start' | 'finish' | 'stunt' | 'race' | 'scenery'; label: string; done: boolean }

export function trackChecklist(props: readonly PlacedProp[]): ChecklistStep[] {
  const shown = props.filter((p) => p.visible !== false);
  const has = (shelf: EasyShelfId, except: string[] = []) =>
    shown.some((p) => !except.includes(p.type) && easyShelf(shelf).items.some((i) => i.type === p.type));
  return [
    { id: 'start', label: 'A start line', done: shown.some((p) => p.type === START_LINE_TYPE) },
    { id: 'finish', label: 'A finish line', done: shown.some((p) => p.type === FINISH_LINE_TYPE) },
    { id: 'stunt', label: 'Something to jump', done: has('stunts') },
    { id: 'race', label: 'A boost or a hazard', done: has('race', [START_LINE_TYPE, FINISH_LINE_TYPE]) },
    { id: 'scenery', label: 'Dress the roadside', done: has('roadside') || has('nature') || has('rocks') },
  ];
}

/** The next roadside side after one was used: pieces alternate left, right, left… */
export const nextSide = (side: 1 | -1): 1 | -1 => (side === 1 ? -1 : 1);
