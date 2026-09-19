import type { CourseId, GameOptions, GameSnapshot } from './types';
import { TRACKS } from './courses';
import type { AirPickup } from './powerups';
import {
  AIM_ANCHOR, GRAVITY, GRANDSTAND, GROUND, HEIGHT, LANE, LANE_COUNT, LANE_WIDTH, LAUNCHER,
  PLAYER_LANE, RADIUS, START_X, START_Y, TERRAIN, closestLane, laneZ, weightImpulse,
} from './track-geometry';
import { SECTION_TWO, STAGE_TWO_SECTORS, stageTwoProfile } from './stage-two';

// The world frame and lane geometry live in `track-geometry.ts` (a leaf module) so
// Section 2 can share them without a circular import; they are re-exported here for the
// rest of the game.
export {
  AIM_ANCHOR, GRAVITY, GRANDSTAND, GROUND, HEIGHT, LANE, LANE_COUNT, LANE_WIDTH, LAUNCHER,
  PLAYER_LANE, RADIUS, START_X, START_Y, TERRAIN, closestLane, laneZ, weightImpulse,
};

/**
 * TICKET-08: the grand circuit is a three-stage odyssey. Stage 1 (0 – 12,000 m) is the
 * alpine downhill, Stage 2 (12,000 m – 24,000 m) is the Waterfall Cliff Zigzag and
 * Pinball Chasm implemented by `stage-two.ts`, and Stage 3 (24,000 m – 36,000 m) is
 * TICKET-09's subterranean mine. This ticket lands Stage 2 and a provisional finish line
 * inside the Drowned Maw; TICKET-09 moves `FINISH` out to 36,000 m.
 */
export const TRACK_DISTANCE = 24000;
export const TRACK_LENGTH = TRACK_DISTANCE * 2;
export const FINISH = START_X + TRACK_LENGTH;
/** Provisional: the maw's approach. The stadium itself returns with TICKET-09. */
export const STADIUM_START = START_X + 22500 * 2;
export const obstacleZ = (obstacle: Pick<Obstacle, 'lane' | 'laneSpan'> & { z?: number }) => {
  // TICKET-08: staggered pinball pegs carry their own z; everything else derives it.
  if (obstacle.z !== undefined) return obstacle.z;
  if (obstacle.lane === -1) return 0;
  const lane = obstacle.lane ?? PLAYER_LANE;
  return (laneZ(lane) + laneZ(Math.min(3, lane + (obstacle.laneSpan ?? 1) - 1))) / 2;
};
export function obstacleBounds(obstacle: Pick<Obstacle, 'lane' | 'laneSpan'>) {
  if (obstacle.lane === -1) return LANE;
  const first = obstacle.lane ?? PLAYER_LANE;
  const last = Math.min(3, first + (obstacle.laneSpan ?? 1) - 1);
  return { near: laneZ(last) - LANE_WIDTH / 2, far: laneZ(first) + LANE_WIDTH / 2 };
}
export function occupiesLane(obstacle: Obstacle, z: number, padding = RADIUS * 0.7) {
  if (obstacle.kind === 'gap' || obstacle.kind === 'sign' || obstacle.kind === 'switchback') {
    const bounds = obstacleBounds(obstacle);
    return z > bounds.near + 5 && z < bounds.far - 5;
  }
  if (obstacle.kind === 'blimp') {
    const bounds = obstacleBounds(obstacle);
    return z > bounds.near - 40 && z < bounds.far + 40;
  }
  // TICKET-08 props are round: their own radius, not a lane half-width, defines contact.
  if (obstacle.kind === 'peg' || obstacle.kind === 'rock') return Math.abs(z - obstacleZ(obstacle)) < (obstacle.radius ?? 40) + padding;
  if (obstacle.kind === 'ring') return Math.abs(z - obstacleZ(obstacle)) < (obstacle.radius ?? 66);
  const halfWidth = obstacle.kind === 'ramp' || obstacle.kind === 'loop' ? 66 : obstacle.kind === 'boost' ? 45 : 37;
  return Math.abs(z - obstacleZ(obstacle)) < halfWidth + padding;
}

type Profile = readonly (readonly [number, number])[];

const SAMPLE_STEP = 16;
const elevations = {} as Record<CourseId, Float32Array>;

/** Same monotone Hermite curve the sample table uses, evaluated straight off the points. */
function sampleProfile(profile: Profile, x: number) {
  const slopes = profile.slice(0, -1).map((point, i) => (profile[i + 1][1] - point[1]) / (profile[i + 1][0] - point[0]));
  const tangents = profile.map((_, i) => !i || i === profile.length - 1 || !slopes[i - 1] || !slopes[i] ? 0 : 2 / (1 / slopes[i - 1] + 1 / slopes[i]));
  let section = 0;
  while (section < profile.length - 2 && x > profile[section + 1][0]) section++;
  const a = profile[section]; const b = profile[section + 1]; const span = b[0] - a[0];
  const t = Math.max(0, Math.min(1, (x - a[0]) / span)); const t2 = t * t; const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * span * tangents[section]
    + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * span * tangents[section + 1];
}

/**
 * TICKET-08: each course's Stage 1 alpine profile is spliced to its Section 2 descent at
 * the Scrap Fall Crest (11,800 m), so a single monotone hill table covers the whole
 * 24 km circuit. The crest keeps the exact Stage 1 elevation it had before this ticket,
 * which is what makes the handover seamless: the join is a shared point, not a blend.
 */
export const STAGE_TWO_SPLICE = SECTION_TWO.crest * 2 + START_X;
const TABLE_END = FINISH + 6000;
for (const id of Object.keys(TRACKS) as CourseId[]) {
  const stageOne = TRACKS[id].profile;
  // The slope of the Stage 1 segment that contains the crest: Section 2 opens with the
  // same grade, which is what stops the join from re-grading Stage 1's last descent.
  let joinSlope = 0.18;
  for (let i = 0; i < stageOne.length - 1; i++) {
    if (STAGE_TWO_SPLICE >= stageOne[i][0] && STAGE_TWO_SPLICE < stageOne[i + 1][0]) {
      joinSlope = (stageOne[i + 1][1] - stageOne[i][1]) / (stageOne[i + 1][0] - stageOne[i][0]);
      break;
    }
  }
  const profile: [number, number][] = [
    ...stageOne.filter(([px]) => px < STAGE_TWO_SPLICE).map(([px, py]): [number, number] => [px, py]),
    ...stageTwoProfile(sampleProfile(stageOne, STAGE_TWO_SPLICE), id, joinSlope),
  ];
  const table = new Float32Array(Math.ceil((TABLE_END - START_X) / SAMPLE_STEP) + 1);
  const slopes = profile.slice(0, -1).map((point, i) => (profile[i + 1][1] - point[1]) / (profile[i + 1][0] - point[0]));
  const tangents = profile.map((_, i) => !i || i === profile.length - 1 || !slopes[i - 1] || !slopes[i] ? 0 : 2 / (1 / slopes[i - 1] + 1 / slopes[i]));
  for (let i = 0, section = 0; i < table.length; i++) {
    const x = i * SAMPLE_STEP;
    while (section < profile.length - 2 && x > profile[section + 1][0]) section++;
    const a = profile[section]; const b = profile[section + 1]; const span = b[0] - a[0];
    const t = Math.max(0, Math.min(1, (x - a[0]) / span)); const t2 = t * t; const t3 = t2 * t;
    table[i] = (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * span * tangents[section]
      + (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * span * tangents[section + 1];
  }
  elevations[id] = table;
}

// A precomputed, monotone hill profile keeps collision and drawing queries cheap.
export function courseY(x: number, course: CourseId = 'ridge') {
  const elevation = elevations[course];
  const sample = Math.max(0, Math.min(elevation.length - 1.001, (x - START_X) / SAMPLE_STEP));
  const i = Math.floor(sample);
  return GROUND + elevation[i] + (elevation[i + 1] - elevation[i]) * (sample - i);
}

export const courseSlope = (x: number, course: CourseId = 'ridge') => (courseY(x + 24, course) - courseY(x - 24, course)) / 48;
export const terrainY = (x: number, course: CourseId = 'ridge') => courseY(x, course) + 154;
export const launchVelocity = (power: number, speed: number) => speed / 0.16 * (0.45 + power * 0.55);

// TICKET-07: airborne ground-decal equations. Altitude is normalised against a
// ceiling sized for the tallest spring launches; the raw ratio drives both curves
// so extreme air keeps growing the circle while the opacity floor holds the mark visible.
export const AIRBORNE_CEILING = 340;
/** Radius = R_base x (1 + Z / Z_max x 1.8) — the rune circle grows with altitude. */
export const decalRadius = (altitude: number) => RADIUS * 1.1 * (1 + Math.max(0, altitude) / AIRBORNE_CEILING * 1.8);
/** Opacity = clamp(0.85 - Z / Z_max x 0.45, 0.25, 0.85) — it softens as the ball climbs. */
export const decalOpacity = (altitude: number) => Math.max(0.25, Math.min(0.85, 0.85 - Math.max(0, altitude) / AIRBORNE_CEILING * 0.45));

/**
 * TICKET-08: sector boundaries. The first six are Stage 1's original alpine splits; the
 * rest subdivide Section 2 (see STAGE_TWO_SECTORS). Sectors only report; physics and
 * rendering never branch on them.
 */
const SECTOR_ENDS = [1400, 5400, 10000, 13600, 18600, 23000,
  SECTION_TWO.cascade * 2, SECTION_TWO.switchbacks * 2, SECTION_TWO.rockfield * 2, 21660 * 2, 22600 * 2];

export function sectorAt(x: number, course: CourseId = 'ridge') {
  const distance = x - START_X;
  const sectors = [...TRACKS[course].sectors, ...STAGE_TWO_SECTORS];
  const index = SECTOR_ENDS.findIndex((end) => distance < end);
  return sectors[index < 0 ? sectors.length - 1 : index];
}

export function loopGeometry(obstacle: Pick<Obstacle, 'x' | 'height'>, course: CourseId = 'ridge') {
  const radius = obstacle.height * 0.48;
  return { x: obstacle.x, y: courseY(obstacle.x, course) - radius - 8, radius, ballRadius: radius - RADIUS - 9, halfWidth: 58 };
}

export function rampSurface(obstacle: Pick<Obstacle, 'x' | 'width' | 'height'>, x: number, course: CourseId = 'ridge') {
  const t = Math.max(0, Math.min(1, (x - obstacle.x) / obstacle.width));
  return courseY(x, course) - Math.pow(t, 1.6) * obstacle.height;
}

export type ObstacleKind =
  | 'ramp' | 'loop' | 'sheep' | 'tnt' | 'spring' | 'boost' | 'gap' | 'blimp' | 'sign'
  /** TICKET-08 Section 2 props. */
  | 'peg' | 'rock' | 'ring' | 'switchback' | 'crate' | 'skull';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  width: number;
  height: number;
  hit: boolean;
  hitAt: number;
  lane?: number;
  laneSpan?: number;
  hitMask?: number;
  altitude?: number;
  signType?: 'sheep' | 'tnt' | 'parts';
  /** TICKET-08: explicit lateral position for props that straddle lane boundaries. */
  z?: number;
  /** TICKET-08: circular collider radius for pegs, rocks and boost rings. */
  radius?: number;
  pegType?: 'crown' | 'spiked';
  ringType?: 'spiked' | 'steel';
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface AirSheep {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rotation: number;
  life: number;
}

export interface LoopRide {
  obstacle: Obstacle;
  angle: number;
  entryAngle: number;
  exitAngle: number;
  speed: number;
  entry: { x: number; y: number };
  entryProgress: number;
}

export interface RacerFrame {
  id: number;
  name: string;
  color: string;
  homeLane: number;
  lane: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rotation: number;
  falling: boolean;
  finished: boolean;
  bumpAt: number;
  immuneUntil: number;
  shieldUntil: number;
  shieldHitAt: number;
  pickupAt: number;
  /** TICKET-08: timestamp of the last fire-ring pass (flame trail + hoop flare). */
  ringAt: number;
  launchOrigin: { x: number; y: number };
}

export interface SceneFrame {
  time: number;
  runTime: number;
  camera: number;
  cameraY: number;
  /** TICKET-08: extra downward tilt for steep Section 2 descents (0 on Stage 1). */
  cameraPitch: number;
  drift: number;
  shake: number;
  rotation: number;
  dragging: boolean;
  launchOrigin: { x: number; y: number };
  ball: { x: number; y: number; z: number; vx: number; vy: number };
  racers: RacerFrame[];
  loopRide: LoopRide | null;
  obstacles: Obstacle[];
  pickups: AirPickup[];
  particles: Particle[];
  sheep: AirSheep[];
  trail: { x: number; y: number; z: number }[];
  snapshot: GameSnapshot;
  options: GameOptions;
  reducedMotion: boolean;
}