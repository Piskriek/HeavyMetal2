import type { CourseId } from './types';
import {
  FINISH, STADIUM_START, START_X, STAGE_2_END, STAGE_2_START,
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
 * Section 2 is kept as a deterministic, independently testable layout pass.  The
 * physical road remains four lanes, while the staggered natural bumpers, wet shelves,
 * rings, and missing-rail gaps create the line choices of a switchback cascade.
 */
export function createStage2WaterfallSection(course: CourseId): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const add = (kind: ObstacleKind, meters: number, width: number, height: number, lane: number, laneSpan = 1, extra: Partial<Obstacle> = {}) => {
    obstacles.push(obstacle(kind, worldAt(meters), width, height, lane, laneSpan, { section: 'stage2', surface: surfaceTypeAt(worldAt(meters)), ...extra }));
  };
  const addBumper = (meters: number, lane: number, variant: 'crown' | 'spiked' = 'crown') => {
    add(variant === 'crown' ? 'rock-bumper' : 'spiked-rock', meters, 112, variant === 'crown' ? 86 : 96, lane, 1, { variant });
  };

  // Scrap Fall Crest: a broad launch sequence gives every racer a clean transition.
  for (let lane = 0; lane < 4; lane++) {
    add('boost', 11820, 130, 15, lane);
    add('ramp', 12010, 220, 142, lane);
  }
  add('spring', 12620, 82, 62, 1);
  add('spring', 12780, 82, 62, 3);

  // Upper banked switchbacks: alternating wall-side rocks and centre splitters.
  addBumper(13200, course === 'sheep' ? 0 : 1, 'crown');
  addBumper(13460, 2, 'spiked');
  add('rock-bumper', 13840, 108, 78, 1, 2, { variant: 'crown' });
  add('spring', 14020, 82, 62, 0);
  addBumper(14400, course === 'boomtown' ? 3 : 2, 'spiked');
  addBumper(14720, 0, 'crown');
  add('crate', 15080, 92, 84, 3);
  add('skull-box', 15320, 94, 88, 1);
  add('boost', 15540, 130, 15, 0);
  add('boost', 15540, 130, 15, 3);

  // Pinball Rockfield: springs and fire rings form an optional high line.
  add('spring', 16240, 82, 62, 1);
  add('spring', 16390, 82, 62, 2);
  add('fire-ring', 16680, 142, 130, 1, 1, { altitude: 136, ring: 'spiked' });
  addBumper(16920, 0, 'spiked');
  addBumper(17160, 3, 'crown');
  add('fire-ring', 17420, 142, 130, 3, 1, { altitude: 144, ring: 'steel' });
  add('rock-bumper', 17720, 106, 82, 1, 2, { variant: 'crown' });
  add('fire-ring', 18120, 142, 130, 2, 1, { altitude: 128, ring: 'spiked' });
  add('spring', 18350, 82, 62, 2);
  add('loop', 18710, 390, 350, 2, 1, { variant: 'crown' });
  add('fire-ring', 18790, 142, 130, 2, 1, { altitude: 210, ring: 'steel' });
  add('skull-box', 19120, 94, 88, 0);
  add('crate', 18880, 92, 84, 3);
  add('boost', 19120, 130, 15, 1);
  add('boost', 19120, 130, 15, 2);

  // Wet foam run: moss rock, rope-bridge shelves, and deliberately absent rails.
  addBumper(19680, 1, 'spiked');
  addBumper(20020, 3, 'crown');
  add('fire-ring', 20320, 142, 130, 0, 1, { altitude: 122, ring: 'steel' });
  add('spring', 20560, 82, 62, 0);
  add('gap', 21180, 168, 0, 0, 1);
  add('rock-bumper', 21520, 108, 80, 2, 1, { variant: 'crown' });
  add('skull-box', 21840, 94, 88, 1);
  add('gap', 22160, 168, 0, 3, 1);
  add('spring', 22420, 82, 62, 3);
  add('fire-ring', 22760, 142, 130, 3, 1, { altitude: 130, ring: 'spiked' });
  addBumper(23080, 0, 'crown');
  addBumper(23320, 2, 'spiked');
  add('boost', 23620, 130, 15, 0);
  add('boost', 23620, 130, 15, 1);
  add('boost', 23620, 130, 15, 2);
  add('boost', 23620, 130, 15, 3);
  add('spring', 23900, 82, 62, course === 'sheep' ? 1 : 2);

  // The last fire-ring/rock rhythm is intentionally just before the cavern maw.
  // It gives a successful Stage 2 run a readable climax before the next ticket's mine.
  return obstacles.filter((item) => item.x >= STAGE_2_START - 500 && item.x < STAGE_2_END).sort((a, b) => a.x - b.x);
}

function createStage3Approach(course: CourseId): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const add = (kind: ObstacleKind, meters: number, width: number, height: number, lane: number, laneSpan = 1) => {
    const x = worldAt(meters);
    obstacles.push(obstacle(kind, x, width, height, lane, laneSpan, { section: 'stage3', surface: 'normal' }));
  };
  for (let meters = 24600, section = 0; meters < 34000; meters += 2200, section++) {
    const lane = (section * 3 + (course === 'boomtown' ? 1 : 0)) % 4;
    add('boost', meters, 130, 15, lane);
    add(section % 2 ? 'loop' : 'ramp', meters + 300, section % 2 ? 360 : 210, section % 2 ? 310 : 120, (lane + 1) % 4);
    add(section % 3 === 0 ? 'skull-box' : 'crate', meters + 720, 92, 84, (lane + 2) % 4);
    if (section % 2 === 0) add('gap', meters + 1050, 160, 0, (lane + 3) % 4, 1);
    else add('spring', meters + 1090, 82, 62, (lane + 2) % 4);
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
  obstacles.push(...createStage3Approach(course));

  for (let lane = 0; lane < 4; lane++) { add('boost', STADIUM_START + 290, 130, 15, lane); add('boost', FINISH - 550, 135, 15, lane); }
  addBlimpSign(STADIUM_START + 800, 'parts', 325, 550);
  add('ramp', STADIUM_START + 1300, 190, 70, course === 'sheep' ? 2 : 0);
  addBlimp(STADIUM_START + 1600, 560);
  add(course === 'boomtown' ? 'tnt' : 'sheep', STADIUM_START + 1970, 65, 65, 3);
  return obstacles.sort((a, b) => a.x - b.x);
}