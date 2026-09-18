import type { CourseId, GameOptions, GameSnapshot } from './types';
import { TRACKS } from './courses';
import type { AirPickup } from './powerups';

export const HEIGHT = 620;
export const GROUND = 478;
export const START_X = 190;
export const START_Y = 325;
export const RADIUS = 31;

/**
 * World X is deliberately twice the race distance.  That leaves enough room for
 * the perspective camera to show the road, the canyon wall, and the next feature
 * without making the physics units awkwardly large.
 */
export const METERS_TO_WORLD = 2;
export const STAGE_1_DISTANCE = 12000;
export const STAGE_2_DISTANCE = 12000;
export const STAGE_3_DISTANCE = 12000;
export const TRACK_DISTANCE = STAGE_1_DISTANCE + STAGE_2_DISTANCE + STAGE_3_DISTANCE;
export const TRACK_LENGTH = TRACK_DISTANCE * METERS_TO_WORLD;
export const STAGE_1_END = START_X + STAGE_1_DISTANCE * METERS_TO_WORLD;
export const STAGE_2_START = STAGE_1_END;
export const STAGE_2_END = STAGE_2_START + STAGE_2_DISTANCE * METERS_TO_WORLD;
export const STAGE_3_START = STAGE_2_END;
/** The last downhill shelf ends at this wall; it is deliberately before the river lip. */
export const WATERFALL_WALL_DISTANCE = 11800;
export const WATERFALL_WALL_X = START_X + WATERFALL_WALL_DISTANCE * METERS_TO_WORLD;
export const WATERFALL_START_X = STAGE_2_START;
export const WATERFALL_EXIT_X = STAGE_3_START;
export const STADIUM_START_DISTANCE = 34500;
export const STADIUM_START = START_X + STADIUM_START_DISTANCE * METERS_TO_WORLD;
export const FINISH = START_X + TRACK_LENGTH;
export const GRAVITY = 2400;
export const CLIFF_GRAVITY_MULTIPLIER = 1.45;
export const CLIFF_ANGLE = 40 * Math.PI / 180;
export const LANE_COUNT = 4;
export const LANE_WIDTH = 240;
export const PLAYER_LANE = 2;
export const LANE = { near: -480, far: 480 };
export const laneZ = (lane: number) => LANE.far - LANE_WIDTH * (lane + 0.5);
export const closestLane = (z: number) => Math.max(0, Math.min(3, Math.round((LANE.far - z) / LANE_WIDTH - 0.5)));

export type TrackSection = 'stage1' | 'stage2' | 'stage3';
export type SurfaceType = 'normal' | 'wet_wood' | 'moss_rock';
export type WaterfallPhase = 'wall-impact' | 'river' | 'vertical-drop' | 'bottom-impact';
export type WaterfallFeatureKind = 'rock' | 'ramp' | 'tube';

export interface WaterfallFeature {
  id: number;
  kind: WaterfallFeatureKind;
  /** Normalised distance down the head-on waterfall, 0 at the lip and 1 at the rocks below. */
  depth: number;
  /** Normalised lateral position: -1 left, 0 centre, 1 right. */
  lateral: number;
  width: number;
  height: number;
  hitMask: number;
  hitAt: number;
}

export interface WaterfallRide {
  phase: WaterfallPhase;
  progress: number;
  depth: number;
  lateral: number;
  targetLateral: number;
  velocity: number;
  hitCount: number;
  impact: number;
  startedAt: number;
}

export interface WaterfallFrame {
  phase: WaterfallPhase;
  progress: number;
  depth: number;
  lateral: number;
  impact: number;
  hitCount: number;
}

export function trackSectionAt(x: number): TrackSection {
  if (x < STAGE_2_START) return 'stage1';
  if (x < STAGE_3_START) return 'stage2';
  return 'stage3';
}

export function surfaceTypeAt(x: number): SurfaceType {
  if (x < STAGE_2_START || x >= STAGE_3_START) return 'normal';
  // The upper shelves are timber berms; the lower foam run is slick mossy slate.
  return x < STAGE_2_START + 7800 ? 'wet_wood' : 'moss_rock';
}

/** A steep cliff face gets a controlled arcade gravity boost without changing all tracks. */
export function gravityScaleForSlope(slope: number) {
  return Math.abs(Math.atan(slope)) >= CLIFF_ANGLE ? CLIFF_GRAVITY_MULTIPLIER : 1;
}

export const obstacleZ = (obstacle: Pick<Obstacle, 'lane' | 'laneSpan'>) => {
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
  if (obstacle.kind === 'gap' || obstacle.kind === 'sign') {
    const bounds = obstacleBounds(obstacle);
    return z > bounds.near + 5 && z < bounds.far - 5;
  }
  if (obstacle.kind === 'blimp') {
    const bounds = obstacleBounds(obstacle);
    return z > bounds.near - 40 && z < bounds.far + 40;
  }
  const halfWidth = obstacle.kind === 'ramp' || obstacle.kind === 'loop' ? 66
    : obstacle.kind === 'boost' ? 45
      : obstacle.kind === 'fire-ring' ? 62
        : obstacle.kind === 'rock-bumper' || obstacle.kind === 'spiked-rock' || obstacle.kind === 'crate' || obstacle.kind === 'skull-box' ? 52 : 37;
  return Math.abs(z - obstacleZ(obstacle)) < halfWidth + padding;
}
export const TERRAIN = GROUND + 154;
export const GRANDSTAND = { z: 350, base: GROUND + 64, height: 217, foundation: TERRAIN, depth: 138 };
export const LAUNCHER = { x: START_X + 128, tipY: GROUND - 241, halfWidth: 91, baseRear: START_X - 95, baseFront: START_X + 165 };
export const AIM_ANCHOR = { x: LAUNCHER.x + 4, y: LAUNCHER.tipY - 7, maxDraw: 220, fullPowerDraw: 200 };

const SAMPLE_STEP = 16;
const elevations = {} as Record<CourseId, Float32Array>;
for (const id of Object.keys(TRACKS) as CourseId[]) {
  const profile = TRACKS[id].profile;
  const table = new Float32Array(Math.ceil((TRACK_LENGTH + 1024) / SAMPLE_STEP) + 1);
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

// A precomputed, monotone-enough odyssey profile keeps collision and drawing queries cheap.
export function courseY(x: number, course: CourseId = 'ridge') {
  const elevation = elevations[course];
  const sample = Math.max(0, Math.min(elevation.length - 1.001, (x - START_X) / SAMPLE_STEP));
  const i = Math.floor(sample);
  return GROUND + elevation[i] + (elevation[i + 1] - elevation[i]) * (sample - i);
}

export const courseSlope = (x: number, course: CourseId = 'ridge') => (courseY(x + 24, course) - courseY(x - 24, course)) / 48;
export const terrainY = (x: number, course: CourseId = 'ridge') => courseY(x, course) + 154;
export const launchVelocity = (power: number, speed: number) => speed / 0.16 * (0.45 + power * 0.55);
export const weightImpulse = (weight: number) => Math.max(0.68, Math.min(1.45, Math.sqrt(120 / weight)));

// TICKET-07: airborne ground-decal equations. Altitude is normalised against a
// ceiling sized for the tallest spring launches; the raw ratio drives both curves
// so extreme air keeps growing the circle while the opacity floor holds the mark visible.
export const AIRBORNE_CEILING = 340;
/** Radius = R_base x (1 + Z / Z_max x 1.8) — the rune circle grows with altitude. */
export const decalRadius = (altitude: number) => RADIUS * 1.1 * (1 + Math.max(0, altitude) / AIRBORNE_CEILING * 1.8);
/** Opacity = clamp(0.85 - Z / Z_max x 0.45, 0.25, 0.85) — it softens as the ball climbs. */
export const decalOpacity = (altitude: number) => Math.max(0.25, Math.min(0.85, 0.85 - Math.max(0, altitude) / AIRBORNE_CEILING * 0.45));

const SECTOR_ENDS = [1400, 5400, 10000, 13600, 18600, 23000, 24000, 26400, 30000, 33600, 37200, 42000, 46800, 52000, 60000, 69000];
export function sectorAt(x: number, course: CourseId = 'ridge') {
  const distance = x - START_X;
  const sectors = TRACKS[course].sectors;
  const index = SECTOR_ENDS.findIndex((end) => distance < end);
  return sectors[Math.min(index < 0 ? sectors.length - 1 : index, sectors.length - 1)];
}

export function loopGeometry(obstacle: Pick<Obstacle, 'x' | 'height'>, course: CourseId = 'ridge') {
  const radius = obstacle.height * 0.48;
  return { x: obstacle.x, y: courseY(obstacle.x, course) - radius - 8, radius, ballRadius: radius - RADIUS - 9, halfWidth: 58 };
}

export function rampSurface(obstacle: Pick<Obstacle, 'x' | 'width' | 'height'>, x: number, course: CourseId = 'ridge') {
  const t = Math.max(0, Math.min(1, (x - obstacle.x) / obstacle.width));
  return courseY(x, course) - Math.pow(t, 1.6) * obstacle.height;
}

export type ObstacleKind = 'ramp' | 'loop' | 'sheep' | 'tnt' | 'spring' | 'boost' | 'gap' | 'blimp' | 'sign'
  | 'rock-bumper' | 'spiked-rock' | 'fire-ring' | 'crate' | 'skull-box' | 'rock-wall' | 'mine-rail' | 'mine-split';

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
  variant?: 'crown' | 'spiked';
  ring?: 'spiked' | 'steel';
  section?: TrackSection;
  surface?: SurfaceType;
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
  fireUntil: number;
  waterfallPhase: WaterfallPhase | null;
  waterfallProgress: number;
  waterfallDepth: number;
  waterfallLateral: number;
  waterfallHits: number;
  launchOrigin: { x: number; y: number };
}

export interface SceneFrame {
  time: number;
  runTime: number;
  camera: number;
  cameraY: number;
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
  waterfall: WaterfallFrame | null;
  waterfallFeatures: WaterfallFeature[];
  snapshot: GameSnapshot;
  options: GameOptions;
  reducedMotion: boolean;
}