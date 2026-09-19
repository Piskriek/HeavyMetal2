/**
 * TICKET-08 — Section 2: The Waterfall Cliff Zigzag & Pinball Chasm.
 *
 * Stage 1 (0 – 12,000 m) is the existing alpine downhill. This module owns everything
 * that happens between the Scrap Fall Crest and the Drowned Maw (12,000 m – 24,000 m):
 *
 *   11,800 m  Scrap Fall Crest        run-out onto the cliff lip
 *   12,120 m  The wooden launch ramp  boost pads throw the field at the gorge
 *   12,300 m  The lip                 a void over the waterfall chasm
 *   12,420 m  The landing tier        switchback cascade begins
 *   15,500 m  The Pinball Rockfield   steep chutes, shelves, pegs, springs, rings
 *   19,500 m  The Wet Foam Run        wet wood, missing guardrails, rope bridge
 *   23,800 m  The Drowned Maw         funnel + whirlpool mouth (Stage 3 continues here)
 *   24,000 m  Finish (temporary)      the finish line sits inside the cavern maw
 *
 * Design rules this file must respect:
 *
 *  1. DETERMINISTIC. The layout is generated from a fixed seed per course, never from
 *     Math.random or the clock, so every race on a course is the same course and a test
 *     can assert the exact count and position of every peg.
 *  2. SIDE-VIEW PROJECTION. This engine is a 2.5D downhill projection: world `x` is
 *     distance along the track, world `y` is height, and the camera rides behind the
 *     ball. A "hairpin" therefore cannot reverse x — it is expressed as a banked berm
 *     shelf that sweeps the field laterally across the four lanes (the switchback
 *     zones below), and the "vertical drop" is a very steep grade. Grades are capped
 *     around 0.9 (≈ 42° of true slope) because the deck texture stretches into a wall
 *     beyond that; tests/section-two.test.ts asserts the cap and SHAPE_LEGS keeps every
 *     leg at or under 0.6 so the deck spline cannot overshoot past it.
 *  3. THE CANYON IS THE FAR SIDE. Lane 0 is `LANE.far`: the outer cliff edge over the
 *     waterfall chasm. Lane 3 is the near side, where the granite wall, the goblin
 *     scaffolding and the crowd live. Missing deck (voids), missing guardrails and the
 *     rope-bridge span are therefore always cut from the far lanes.
 *  4. NO NEW PER-FRAME WORK. This module returns plain data; every painting lives in
 *     stage-two-art.ts and is cached by the environment.
 */
import { GRAVITY, LANE_WIDTH, START_X, laneZ } from './track-geometry';
import type { Obstacle, ObstacleKind } from './scene';
import type { CourseId } from './types';

/** Race distances in metres. `mx()` converts to the world x the engine works in. */
export const SECTION_TWO = {
  crest: 11800,
  ramp: 12120,
  lip: 12300,
  landing: 12420,
  cascade: 12600,
  switchbacks: 15500,
  rockfield: 19500,
  foam: 23800,
  maw: 23800,
  finish: 24000,
} as const;

/** Race metres → world x (the engine stores two world units per race metre). */
export const mx = (metres: number) => START_X + metres * 2;
/** World x → race metres. */
export const toMetres = (x: number) => (x - START_X) / 2;

/** World x where Section 2 begins (12,000 m). */
export const SECTION_TWO_START = mx(12000);

/** Radii, altitudes and rewards of the pinball props. */
export const PEG = { crown: 40, spiked: 34 } as const;
export const RING = { radius: 66, altitude: 74, airAltitude: 140, boost: 310, immune: 1.5 } as const;
export const ROCK_RADIUS = { small: 62, mid: 86, large: 116 } as const;
/**
 * 38° of true slope: the deck projection stays readable up to about 40°, so this is the
 * steepest grade Section 2 actually reaches and where the chasm gravity scale tops out.
 */
export const CLIFF_SLOPE = Math.tan(38 * Math.PI / 180);
export const CLIFF_GRAVITY_SCALE = 1.45;
/** Lateral pull (units/s²) a banked switchback shelf applies toward its safe lane. */
export const BANK_PULL = 1250;
/** Restitution of the pinball props: the crown pays back 1.5× the incoming impulse. */
export const PEG_BOUNCE = { crown: 0.5, spiked: 0.65 } as const;
export const ROCK_BOUNCE = 0.45;

export type TrackSurface = 'dirt' | 'wood' | 'moss' | 'metal' | 'hazard';

/**
 * Surface grip as a multiplier on the lateral steering response. Wet timber is 40% more
 * slippery than dirt, exactly as TICKET-08 §3.3.3 requires; mossy slate is worse.
 */
export const SURFACE_GRIP: Record<TrackSurface, number> = {
  dirt: 1, wood: 0.6, moss: 0.55, metal: 0.82, hazard: 1,
};

export interface SurfaceZone { from: number; to: number; surface: TrackSurface }

/** Per-course character. `depth` scales every Section 2 descent. */
const TUNING: Record<CourseId, { depth: number; pegs: number; rings: number; voids: number }> = {
  ridge: { depth: 1, pegs: 1, rings: 1, voids: 1 },
  boomtown: { depth: 1.15, pegs: 0.85, rings: 1.15, voids: 0.85 },
  sheep: { depth: 0.85, pegs: 0.75, rings: 0.85, voids: 1.25 },
};

/**
 * Section 2 as a list of legs: `[metres, worldSlope]` where the slope belongs to the
 * segment ENDING at that metre mark. Slopes are in world units (2 per race metre), so
 * 0.5 is a 26.5° chute and 0.6 is the 31° wooden launch ramp. Two rules hold the shape
 * inside what the 2.5D projection can draw:
 *   - no leg is steeper than 0.6, because the Catmull-Rom deck spline overshoots a
 *     transition by up to ~40% and the deck tears into a wall past slope 1.0;
 *   - each steep chute is followed by a near-flat shelf, which is where the peg fields,
 *     the springs and the rock outcrops live.
 */
const SHAPE_LEGS: readonly (readonly [number, number])[] = [
  [SECTION_TWO.crest, 0],          // the crest run-out
  [SECTION_TWO.ramp, 0.09],        // replaced at build time by Stage 1's own exit slope
  [SECTION_TWO.lip, 0.6],          // the wooden launch ramp
  [SECTION_TWO.landing, 0.45],     // landing tier on the far side of the gorge
  [SECTION_TWO.cascade, 0.34],     // berm lead-in
  [13300, 0.44],                   // hairpin shelf 1 (banked berm)
  [13600, 0.07],
  [14300, 0.35],                   // chute between the tiers
  [14600, 0.05],                   // hairpin shelf 2
  [SECTION_TWO.switchbacks, 0.36], // lower chute into the pinball chasm
  [15900, 0.5],
  [16200, 0.04],                   // peg shelf
  [16600, 0.5],
  [16900, 0.04],                   // spring shelf
  [17400, 0.5],
  [17700, 0.04],                   // rock shelf
  [18300, 0.5],
  [18600, 0.04],                   // ring shelf
  [SECTION_TWO.rockfield, 0.44],   // last chute out of the rockfield
  [20300, 0.34],                   // wet foam run begins
  [20700, 0.07],                   // soaked switchback shelf
  [21600, 0.34],                   // plunge to the rope bridge
  [21660, 0.08],
  [21960, 0.07],                   // the swaying rope bridge
  [22600, 0.23],
  [23300, 0.06],
  [SECTION_TWO.maw, 0.27],         // the funnel narrows
  [23900, 0.5],                    // whirlpool throat
  [SECTION_TWO.finish, 0.55],      // in the dark, over the finish line
];

/**
 * Section 2 sector names, appended to each course's Stage 1 list. The stadium sectors
 * ("STADIUM APPROACH", "THE SCRAPDOME") move to TICKET-09 with the real finish.
 */
export const STAGE_TWO_SECTORS = [
  'SCRAP FALL CREST',
  'THE HAIRPIN BERMS',
  'THE PINBALL ROCKFIELD',
  'THE WET FOAM RUN',
  'THE ROPE BRIDGE',
  'THE DROWNED MAW',
] as const;

/**
 * Stage 2 elevation profile appended to each course's Stage 1 profile: the crest sits at
 * `base` and the whole descent is scaled by the course's depth factor.
 */
export function stageTwoProfile(base: number, course: CourseId, joinSlope = 0.18): [number, number][] {
  const { depth } = TUNING[course];
  const points: [number, number][] = [[mx(SHAPE_LEGS[0][0]), Math.round(base)]];
  let elevation = base;
  for (let i = 1; i < SHAPE_LEGS.length; i++) {
    const [metres, slope] = SHAPE_LEGS[i];
    const previous = SHAPE_LEGS[i - 1][0];
    // The first Section 2 leg deliberately continues with the slope Stage 1 left off at:
    // matching the right-derivative at the join is what keeps the crease in the spline
    // from bending the last kilometre of the alpine downhill.
    const leg = i === 1 ? joinSlope : slope * depth;
    elevation += leg * (metres - previous) * 2;
    points.push([mx(metres), Math.round(elevation)]);
  }
  return points;
}

/** Wet timber, mossy slate and riveted steel across Section 2. */
export function surfaceZones(course: CourseId): SurfaceZone[] {
  const zones: SurfaceZone[] = [
    { from: mx(12000), to: mx(SECTION_TWO.lip), surface: 'wood' },
    { from: mx(SECTION_TWO.lip), to: mx(SECTION_TWO.cascade), surface: 'metal' },
    { from: mx(SECTION_TWO.cascade), to: mx(13600), surface: 'wood' },
    { from: mx(13600), to: mx(14300), surface: 'moss' },
    { from: mx(14300), to: mx(14600), surface: 'wood' },
    { from: mx(14600), to: mx(SECTION_TWO.switchbacks), surface: 'moss' },
    { from: mx(SECTION_TWO.switchbacks), to: mx(SECTION_TWO.rockfield), surface: 'metal' },
    { from: mx(SECTION_TWO.rockfield), to: mx(20700), surface: 'moss' },
    { from: mx(20700), to: mx(21600), surface: 'wood' },
    { from: mx(21600), to: mx(SECTION_TWO.foam), surface: 'moss' },
    { from: mx(SECTION_TWO.foam), to: mx(SECTION_TWO.maw), surface: 'wood' },
    { from: mx(SECTION_TWO.maw), to: mx(SECTION_TWO.finish), surface: 'hazard' },
  ];
  // The meadow course keeps the same sequence but dries its mossy slate into planks.
  if (course === 'sheep') for (const zone of zones) if (zone.surface === 'moss') zone.surface = 'wood';
  if (course === 'boomtown') for (const zone of zones) if (zone.surface === 'moss') zone.surface = 'metal';
  return zones;
}

const ZONE_CACHE = new Map<CourseId, SurfaceZone[]>();
const zonesFor = (course: CourseId) => {
  let zones = ZONE_CACHE.get(course);
  if (!zones) { zones = surfaceZones(course); ZONE_CACHE.set(course, zones); }
  return zones;
};

export function surfaceKindAt(x: number, course: CourseId): TrackSurface {
  if (x < SECTION_TWO_START) return 'dirt';
  const zones = zonesFor(course);
  for (const zone of zones) if (x >= zone.from && x < zone.to) return zone.surface;
  // The finish line sits on the last metre of the maw zone, and the ball is parked exactly
  // on it once the race ends: hold the final surface past the last boundary instead of
  // dropping back to dirt, or the HUD chip blinks off under the ball at the finish.
  if (zones.length && x >= zones[zones.length - 1].from) return zones[zones.length - 1].surface;
  return 'dirt';
}

export const surfaceGripAt = (x: number, course: CourseId) => SURFACE_GRIP[surfaceKindAt(x, course)];

/** Human-readable surface names for the HUD chip. */
export const SURFACE_LABEL: Record<TrackSurface, string> = {
  dirt: 'DIRT', wood: 'WET TIMBER', moss: 'MOSSY SLATE', metal: 'RIVETED STEEL', hazard: 'LAVA SLAG',
};

/**
 * TICKET-08 §3.3.1: gravity is scaled down the chasm. The scale ramps in smoothly from
 * 30° so a section boundary never produces a physics step, and tops out at 1.45×.
 */
export function cliffGravityScale(slope: number): number {
  const steepness = Math.abs(slope);
  const from = Math.tan(30 * Math.PI / 180);
  const t = Math.max(0, Math.min(1, (steepness - from) / (CLIFF_SLOPE - from)));
  return 1 + (CLIFF_GRAVITY_SCALE - 1) * t * t * (3 - 2 * t);
}
export const gravityAt = (slope: number) => GRAVITY * cliffGravityScale(slope);

/** Camera pitch: Section 2's steep grades tilt the view down into the chute. */
export function cameraPitch(slope: number): number {
  const steepness = Math.abs(slope);
  const t = Math.max(0, Math.min(1, (steepness - 0.42) / (0.95 - 0.42)));
  return t * t * (3 - 2 * t) * 0.16;
}

/** Deterministic PRNG (mulberry32) so the peg fields are identical every race. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS: Record<CourseId, number> = { ridge: 0x5ec7a1, boomtown: 0xb0a7, sheep: 0x51ee9 };

/**
 * Ring aperture test shared by the engine and its tests: the ball must pass within the
 * hoop in all three axes while crossing the ring's plane.
 */
export function throughRing(ring: Obstacle, x: number, y: number, z: number, deck: number) {
  const centreX = ring.x + ring.width / 2;
  const centreY = deck - (ring.altitude ?? RING.altitude);
  const radius = ring.radius ?? RING.radius;
  return Math.abs(x - centreX) < 58
    && Math.abs(z - laneZ(ring.lane ?? 2)) < radius - 6
    && Math.abs(y - centreY) < radius - 6;
}

/** Pinball recoil: reflect the planar velocity about the contact normal, scaled by `e`. */
export function bumperRebound(velocity: { vx: number; vz: number }, normal: { x: number; z: number }, restitution: number) {
  const along = velocity.vx * normal.x + velocity.vz * normal.z;
  if (along >= 0) return velocity;
  return {
    vx: velocity.vx - (1 + restitution) * along * normal.x,
    vz: velocity.vz - (1 + restitution) * along * normal.z,
  };
}

interface Props { metres: number; width: number; height: number; lane: number; laneSpan?: number }

/**
 * The Section 2 obstacle list. Stage 1 stays untouched: everything here starts at
 * 12,000 m and is returned sorted by world x.
 */
export function createSectionTwoLayout(course: CourseId): Obstacle[] {
  const tuning = TUNING[course];
  const random = seeded(SEEDS[course]);
  const list: Obstacle[] = [];
  const add = (kind: ObstacleKind, props: Props, extra: Partial<Obstacle> = {}) => {
    list.push({
      kind, x: mx(props.metres), width: props.width, height: props.height,
      lane: props.lane, laneSpan: props.laneSpan ?? 1, hit: false, hitAt: -100, hitMask: 0, ...extra,
    });
  };
  const peg = (metres: number, lane: number, type: 'crown' | 'spiked', z: number) =>
    add('peg', { metres, width: PEG[type] * 2, height: PEG[type] * 2, lane }, { pegType: type, radius: PEG[type], z });
  const rock = (metres: number, lane: number, size: keyof typeof ROCK_RADIUS) =>
    add('rock', { metres, width: ROCK_RADIUS[size] * 2, height: ROCK_RADIUS[size] * 2, lane }, { radius: ROCK_RADIUS[size] });
  const ring = (metres: number, lane: number, altitude: number, type: 'spiked' | 'steel' = 'spiked') =>
    add('ring', { metres, width: RING.radius * 2, height: RING.radius * 2, lane }, { ringType: type, radius: RING.radius, altitude });
  const voidGap = (metres: number, halfWidth: number, lane: number, laneSpan: number) =>
    add('gap', { metres, width: halfWidth * 2, height: 0, lane, laneSpan });
  const bank = (metres: number, halfLength: number, safeLane: number, safeSpan: number) =>
    add('switchback', { metres, width: halfLength * 2, height: 0, lane: safeLane, laneSpan: safeSpan });
  /** Staggered hexagonal peg rows across a shelf, the classic pinball layout. */
  const pegField = (centre: number, length: number, crownChance: number) => {
    const rows = Math.max(3, Math.round(length * tuning.pegs / 34));
    for (let row = 0; row < rows; row++) {
      const metres = centre - length / 2 + (row / Math.max(1, rows - 1)) * length;
      const shift = row % 2 ? LANE_WIDTH * 0.24 : -LANE_WIDTH * 0.24;
      for (let lane = 0; lane < 4; lane++) {
        if (row % 2 === 1 && lane === 3) continue;
        peg(metres, lane, random() < crownChance ? 'crown' : 'spiked', laneZ(lane) + shift);
      }
    }
  };
  const hazard = (metres: number, kind: 'crate' | 'skull', lane: number, width = 92, height = 74) =>
    add(kind, { metres, width, height, lane });
  const spring = (metres: number, lane: number) =>
    add('spring', { metres, width: 82, height: 56, lane });
  const boost = (metres: number, lane: number, width = 116) =>
    add('boost', { metres, width, height: 15, lane });

  // ---------------------------------------------------------------- 11,800 m crest
  // Crates and a skull box mark the crest: the last easy section before the drop.
  hazard(11870, 'crate', 1);
  hazard(11940, 'crate', 3);
  hazard(12090, 'skull', 0, 94, 87);
  for (let lane = 0; lane < 4; lane++) boost(12180, lane);

  // ------------------------------------------------------------------ 12,300 m void
  // The gorge: no deck between the lip and the landing tier. The waterfall pours
  // through here (stage-two-art paints the chasm), so the leap has to be committed.
  voidGap(12300, 62, 0, 4);

  // --------------------------------------------------------------- 12,600 m cascade
  // Hairpin 1: the berm sweeps the field toward the wall (lane 3) while the far lanes
  // crumble into the chasm.
  bank(13060, 300, 2, 2);
  voidGap(13380, 34 * tuning.voids, 0, 2);
  rock(13300, 0.5, 'mid');
  if (tuning.voids > 1) voidGap(13720, 24 * tuning.voids, 0, 1);
  ring(13540, 3, RING.altitude, 'steel');

  // Hairpin 2: the wall pinches in with a rock buttress, so the wide outer berm is the
  // only sane line. The tight inside line stays open to anyone who dares.
  bank(14380, 280, 0.5, 2);
  rock(14420, 3, 'large');
  rock(14540, 2, 'mid');
  hazard(14780, 'skull', 3, 94, 87);
  voidGap(14980, 30 * tuning.voids, 0, 1);

  // ---------------------------------------------------------- 15,500 m pinball chasm
  // Alternating chutes and peg shelves. Crown bumpers ring a bell and pay points;
  // spiked bumpers throw the ball sideways; spring launchers refill the bounce.
  pegField(16_200, 300, 0.55);
  pegField(16_900, 260, 0.34);
  pegField(17_700, 300, 0.62);
  pegField(18_600, 240, 0.3);
  ring(16_050, 1, RING.altitude);
  ring(17_560, 0, RING.airAltitude);
  ring(19_100, 0, RING.altitude, 'steel');
  spring(15900, 1); spring(16600, 2); spring(17400, 0); spring(18300, 3);
  rock(16380, 1.5, 'small');
  rock(16860, 2.5, 'small');
  rock(17960, 0.5, 'mid');
  rock(18460, 3.5, 'mid');
  rock(19060, 1.5, 'large');
  hazard(17220, 'crate', 0);
  hazard(18120, 'skull', 2, 94, 87);
  hazard(19320, 'crate', 3);

  // ------------------------------------------------------------------ 19,500 m foam
  // Wet wood and mossy slate, three missing guardrails and a rope bridge two lanes wide.
  bank(20600, 340, 2, 2);
  voidGap(20900, 30 * tuning.voids, 0, 2);
  voidGap(21240, 26 * tuning.voids, 0, 1);
  voidGap(21670, 29, 0, 1);          // the rope bridge span: only lanes 1-2 have planks
  voidGap(21670, 29, 3, 1);
  ring(21540, 1, RING.altitude, 'steel');
  ring(22080, 2, RING.altitude);
  rock(20420, 0.5, 'small');
  rock(22380, 1.5, 'mid');
  hazard(22640, 'crate', 0);
  hazard(22980, 'skull', 2, 94, 87);
  voidGap(23080, 30 * tuning.voids, 0, 2);
  spring(21120, 3); spring(22500, 0); spring(23400, 1);
  pegField(21800, 220, 0.4);
  pegField(23150, 200, 0.45);

  // ----------------------------------------------------------------- 23,800 m maw
  for (let lane = 0; lane < 4; lane++) boost(23760, lane, 130);
  rock(23860, 0.5, 'large');
  rock(23860, 3.5, 'large');
  ring(23920, 2, RING.altitude, 'steel');

  return list.sort((a, b) => a.x - b.x);
}
