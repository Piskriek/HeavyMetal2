import type { CourseId } from './types';
import {
  FINISH, STADIUM_START, START_X, STAGE_2_START,
  surfaceTypeAt, trackSectionAt, type Obstacle, type ObstacleKind,
} from './scene';

const worldAt = (meters: number) => START_X + meters * 2;

function obstacle(kind: ObstacleKind, x: number, width: number, height: number, lane: number, laneSpan = 1, extra: Partial<Obstacle> = {}): Obstacle {
  return {
    kind, x, width, height, lane, laneSpan, hit: false, hitAt: -100, hitMask: 0,
    section: trackSectionAt(x), surface: surfaceTypeAt(x), ...extra,
  };
}

/**
 * Section 2 is a purpose-built transition: the downhill terminates at a solid
 * granite wall, then the whole field enters the head-on waterfall simulation.
 * The actual pinball pieces are normalised waterfall features (rather than flat
 * road obstacles) so the camera can stay locked to the falling ball.
 */
export function createStage2WaterfallSection(course: CourseId): Obstacle[] {
  const transition: Obstacle[] = [];
  const add = (kind: ObstacleKind, meters: number, width: number, height: number, lane: number, laneSpan = 1, extra: Partial<Obstacle> = {}) => {
    const x = worldAt(meters);
    transition.push(obstacle(kind, x, width, height, lane, laneSpan, {
      section: 'stage2', surface: surfaceTypeAt(x), ...extra,
    }));
  };
  for (let lane = 0; lane < 4; lane++) {
    add('boost', 11620, 132, 15, lane);
    add('ramp', 11740, 220, 126, lane);
  }
  add('rock-wall', 11800, 380, 360, -1, 4, { variant: course === 'boomtown' ? 'spiked' : 'crown' });

  // Keep the authored Section 2 contract explicit in the world data as well as
  // in the camera-space feature list. These are the pinball pieces the ride
  // passes through after the wall; the waterfall renderer owns their appearance
  // once the player is in the drop, so they never become a second flat road.
  const pinballKinds: ObstacleKind[] = ['rock-bumper', 'spiked-rock', 'spring', 'fire-ring', 'loop', 'gap'];
  for (let index = 0; index < 42; index++) {
    const kind = pinballKinds[index % pinballKinds.length];
    const meters = 12020 + index * 270;
    const lane = (index * 3 + (course === 'sheep' ? 1 : 0)) % 4;
    const extra: Partial<Obstacle> = kind === 'fire-ring'
      ? { altitude: 150 + (index % 3) * 24, ring: index % 2 ? 'spiked' : 'steel' }
      : kind === 'gap'
        ? { laneSpan: 2 }
        : kind === 'loop'
          ? { laneSpan: 1 }
          : { variant: index % 2 ? 'spiked' : 'crown' };
    add(kind, meters, kind === 'loop' ? 360 : kind === 'gap' ? 160 : kind === 'fire-ring' ? 210 : 120,
      kind === 'loop' ? 310 : kind === 'gap' ? 0 : kind === 'fire-ring' ? 24 : kind === 'spring' ? 62 : 100,
      kind === 'fire-ring' || kind === 'gap' ? lane : lane, kind === 'gap' ? 2 : 1, extra);
  }
  return transition.sort((a, b) => a.x - b.x);
}

/**
 * Deterministic pinball hardware floating in the waterfall.  The input is a
 * normalised camera-space layout: it is rendered head-on and resolved in the
 * waterfall physics pass, not projected onto the old horizontal road.
 */
export function createWaterfallDropLayout(course: CourseId): import('./scene').WaterfallFeature[] {
  const courseOffset = course === 'boomtown' ? 0.09 : course === 'sheep' ? -0.07 : 0;
  const kinds = ['rock', 'rock', 'ramp', 'tube', 'rock', 'ramp', 'tube', 'rock', 'rock', 'tube', 'ramp', 'rock'] as const;
  const depths = [0.08, 0.16, 0.245, 0.32, 0.405, 0.49, 0.575, 0.66, 0.745, 0.82, 0.895, 0.965];
  const laterals = [-0.54, 0.42, -0.12, 0.58, -0.68, 0.2, -0.38, 0.62, -0.18, 0.44, -0.55, 0.08];
  return kinds.map((kind, id) => ({
    id,
    kind,
    depth: depths[id],
    lateral: Math.max(-0.78, Math.min(0.78, laterals[id] + courseOffset)),
    width: kind === 'rock' ? 0.16 + (id % 3) * 0.035 : kind === 'tube' ? 0.21 : 0.25,
    height: kind === 'rock' ? 0.16 + (id % 2) * 0.08 : kind === 'tube' ? 0.28 : 0.12,
    hitMask: 0,
    hitAt: -100,
  }));
}

export function createStage3MineSection(course: CourseId): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const add = (kind: ObstacleKind, meters: number, width: number, height: number, lane: number, laneSpan = 1, extra: Partial<Obstacle> = {}) => {
    const x = worldAt(meters);
    obstacles.push(obstacle(kind, x, width, height, lane, laneSpan, { section: 'stage3', surface: 'normal', ...extra }));
  };
  for (let meters = 24400, section = 0; meters < 34000; meters += 1900, section++) {
    add('mine-rail', meters, 900, 80, -1, 4, { variant: section % 2 ? 'spiked' : 'crown' });
    add('mine-split', meters + 420, 620, 180, -1, 4, { variant: section % 2 ? 'spiked' : 'crown' });
    const lane = (section * 3 + (course === 'boomtown' ? 1 : 0)) % 4;
    add('boost', meters + 40, 130, 15, lane);
    add(section % 2 ? 'loop' : 'ramp', meters + 700, section % 2 ? 360 : 210, section % 2 ? 310 : 120, (lane + 1) % 4);
    add(section % 3 === 0 ? 'skull-box' : 'crate', meters + 1040, 92, 84, (lane + 2) % 4);
    if (section % 2 === 0) add('gap', meters + 1320, 160, 0, (lane + 3) % 4, 1);
    else add('spring', meters + 1340, 82, 62, (lane + 2) % 4);
  }
  return obstacles;
}

export function createTrackLayout(course: CourseId): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const add = (kind: ObstacleKind, x: number, width: number, height: number, lane: number, laneSpan = 1) =>
    obstacles.push(obstacle(kind, x, width, height, lane, laneSpan));
  const addSign = (x: number, signType: 'sheep' | 'tnt' | 'parts', altitude = 320) =>
    obstacles.push(obstacle('sign', x, 360, 150, -1, 4, { signType, altitude }));
  const addBlimp = (x: number, altitude = 545) =>
    obstacles.push(obstacle('blimp', x, 230, 115, -1, 4, { altitude }));
  const addBlimpSign = (x: number, signType: 'sheep' | 'tnt' | 'parts', signAlt = 320, blimpAlt = 545) => {
    addBlimp(x + 65, blimpAlt);
    addSign(x, signType, signAlt);
  };

  // Stage 1 retains the original rhythm, ending at the Scrap Fall Crest rather
  // than sending the field straight into the old stadium after 12 km.
  for (let lane = 0; lane < 4; lane++) { add('ramp', 510, 190, 76, lane); add('boost', 770, 116, 15, lane); }
  addBlimpSign(980, course === 'sheep' ? 'sheep' : course === 'boomtown' ? 'tnt' : 'parts', 320, 545);
  add('sheep', 1160, 62, 59, course === 'sheep' ? 2 : 0);
  add('loop', 1370, 375, 322, course === 'boomtown' ? 3 : 2);
  add('spring', 1670, 82, 56, 1);
  addBlimp(1850, 540);
  if (course === 'boomtown') add('tnt', 1210, 65, 70, 1);

  const step = course === 'boomtown' ? 2420 : course === 'sheep' ? 2160 : 2300;
  for (let x = 2400, section = 0; x < STAGE_2_START - 2600; x += step, section++) {
    const lane = (section * (course === 'sheep' ? 3 : 1)) % 4;
    const signType: 'sheep' | 'tnt' | 'parts' = section % 3 === 0 ? 'sheep' : section % 3 === 1 ? 'tnt' : 'parts';

    if (course === 'ridge') {
      add('boost', x + 30, 130, 15, lane);
      add('ramp', x + 325, 205, section % 2 ? 90 : 112, (lane + 1) % 4);
      addBlimpSign(x + 620, signType, 330, 555);
      add('sheep', x + 860, 62, 59, (lane + 2) % 4);
      add('spring', x + 1070, 82, 56, lane);
      if (section % 2 === 0) addBlimp(x + 1320, 550);
      add('gap', x + 1450, 160, 0, section % 3, 2);
      if (section % 3 === 0) add('loop', x + 1880, 375, 322, (lane + 3) % 4);
      else add('boost', x + 1850, 135, 15, (lane + 2) % 4);
      if (section % 2 === 0) add('tnt', x + 710, 65, 70, (lane + 3) % 4);
    } else if (course === 'boomtown') {
      add('boost', x + 55, 135, 15, (lane + 2) % 4);
      add('tnt', x + 295, 65, 70, lane); add('tnt', x + 430, 65, 70, (lane + 1) % 4);
      add('ramp', x + 700, 210, 125, (lane + 2) % 4);
      addBlimpSign(x + 980, section % 2 === 0 ? 'tnt' : 'parts', 335, 560);
      add('gap', x + 1120, 192, 0, section % 3, 2);
      if (section % 2 === 1) addBlimp(x + 1380, 560);
      add('tnt', x + 1520, 65, 70, (lane + 3) % 4);
      add('spring', x + 1750, 82, 56, lane);
      if (section % 3 === 1) add('loop', x + 2120, 355, 300, (lane + 1) % 4);
      else add('boost', x + 2110, 130, 15, (lane + 3) % 4);
    } else {
      add('sheep', x + 135, 66, 62, lane); add('sheep', x + 265, 62, 59, (lane + 2) % 4);
      add('ramp', x + 500, 185, 80, (lane + 1) % 4);
      addBlimpSign(x + 720, section % 2 === 0 ? 'sheep' : 'parts', 320, 545);
      add('spring', x + 890, 82, 56, (lane + 3) % 4);
      add('gap', x + 1190, 132, 0, lane, 1);
      if (section % 3 === 1) addBlimp(x + 1400, 530);
      add('sheep', x + 1530, 62, 59, (lane + 1) % 4);
      add('boost', x + 1740, 130, 15, lane);
      if (section % 4 === 2) add('loop', x + 1940, 340, 288, (lane + 2) % 4);
    }
  }

  obstacles.push(...createStage2WaterfallSection(course));
  obstacles.push(...createStage3MineSection(course));

  for (let lane = 0; lane < 4; lane++) { add('boost', STADIUM_START + 290, 130, 15, lane); add('boost', FINISH - 550, 135, 15, lane); }
  addBlimpSign(STADIUM_START + 800, 'parts', 325, 550);
  add('ramp', STADIUM_START + 1300, 190, 70, course === 'sheep' ? 2 : 0);
  addBlimp(STADIUM_START + 1600, 560);
  add(course === 'boomtown' ? 'tnt' : 'sheep', STADIUM_START + 1970, 65, 65, 3);
  return obstacles.sort((a, b) => a.x - b.x);
}