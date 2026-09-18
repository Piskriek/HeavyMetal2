import type { CourseId } from './types';
import { FINISH, STADIUM_START, type Obstacle, type ObstacleKind } from './scene';

export function createTrackLayout(course: CourseId): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const add = (kind: ObstacleKind, x: number, width: number, height: number, lane: number, laneSpan = 1) =>
    obstacles.push({ kind, x, width, height, lane, laneSpan, hit: false, hitAt: -100, hitMask: 0 });
  const addSign = (x: number, signType: 'sheep' | 'tnt' | 'parts', altitude = 320) =>
    obstacles.push({ kind: 'sign', signType, x, width: 360, height: 150, lane: -1, laneSpan: 4, altitude, hit: false, hitAt: -100, hitMask: 0 });
  const addBlimp = (x: number, altitude = 545) =>
    obstacles.push({ kind: 'blimp', x, width: 230, height: 115, lane: -1, laneSpan: 4, altitude, hit: false, hitAt: -100, hitMask: 0 });
  const addBlimpSign = (x: number, signType: 'sheep' | 'tnt' | 'parts', signAlt = 320, blimpAlt = 545) => {
    // Blimp (width 230) centered over sign (width 360): (x + 180) - 115 = x + 65
    addBlimp(x + 65, blimpAlt);
    addSign(x, signType, signAlt);
  };

  for (let lane = 0; lane < 4; lane++) { add('ramp', 510, 190, 76, lane); add('boost', 770, 116, 15, lane); }
  addBlimpSign(980, course === 'sheep' ? 'sheep' : course === 'boomtown' ? 'tnt' : 'parts', 320, 545);
  add('sheep', 1160, 62, 59, course === 'sheep' ? 2 : 0);
  add('loop', 1370, 375, 322, course === 'boomtown' ? 3 : 2);
  add('spring', 1670, 82, 56, 1);
  addBlimp(1850, 540);
  if (course === 'boomtown') add('tnt', 1210, 65, 70, 1);

  const step = course === 'boomtown' ? 2420 : course === 'sheep' ? 2160 : 2300;
  for (let x = 2400, section = 0; x < STADIUM_START - 2400; x += step, section++) {
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

  for (let lane = 0; lane < 4; lane++) { add('boost', STADIUM_START + 290, 130, 15, lane); add('boost', FINISH - 550, 135, 15, lane); }
  addBlimpSign(STADIUM_START + 800, 'parts', 325, 550);
  add('ramp', STADIUM_START + 1300, 190, 70, course === 'sheep' ? 2 : 0);
  addBlimp(STADIUM_START + 1600, 560);
  add(course === 'boomtown' ? 'tnt' : 'sheep', STADIUM_START + 1970, 65, 65, 3);
  return obstacles.sort((a, b) => a.x - b.x);
}