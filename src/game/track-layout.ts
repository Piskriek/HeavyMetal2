import type { CourseId } from './types';
import {
  FINISH,
  STADIUM_START,
  SECTION_LIP_START,
  SECTION_2_START,
  SECTION_2_END,
  SECTION_3_START,
  SECTION_3_END,
  type Obstacle,
  type ObstacleKind,
} from './scene';

/**
 * M01 · T1: the start pad and the whole run-up to the first loop stay empty in push mode. The
 * layout has no RNG (measured: `tests/start-zone.test.ts` fingerprints it), so removing a prefix
 * cannot move any obstacle that remains — the post-gate fingerprint is byte-identical.
 */
export interface TrackLayoutOptions {
  /** Drop every obstacle whose `x` is below this (exclusive). */
  readonly skipBeforeX?: number;
  /**
   * M01 · T1c — the run-up the field actually rides: with `skipBeforeX` set to the sorting gate,
   * loops at or after this `x` are kept anyway.
   *
   * Sorting the field at the geometry loop's mouth (`qualifying/passage.ts`) cannot simply trim
   * every obstacle below the new gate: what lies under it is the jump line, and riders are airborne
   * over it — measured, all four riders arrive at ridge's second loop 155–823 units up, outside the
   * gate's altitude band, so they would fly over the sort plane and the pool would wait out its whole
   * backstop. Keeping the loops below the gate and nothing else is what works: every rider rides the
   * descent on the ground and takes each loop in turn, and the measured sorting times become
   * 7.5–12.3 s instead of 1.93 s.
   */
  readonly keepLoopsFromX?: number;
}

export function createTrackLayout(course: CourseId, options: TrackLayoutOptions = {}): Obstacle[] {
  // ISLAND-ROUTE, first version: Basalt Isle races Rustbucket Ridge's obstacles (and profile) on its own roads.
  if (course === 'basalt') return createTrackLayout('ridge', options);
  const obstacles: Obstacle[] = [];
  const add = (
    kind: ObstacleKind,
    x: number,
    width: number,
    height: number,
    lane: number,
    laneSpan = 1,
    extra: Partial<Obstacle> = {}
  ) =>
    obstacles.push({
      kind,
      x,
      width,
      height,
      lane,
      laneSpan,
      hit: false,
      hitAt: -100,
      ...extra,
    });

  const addSign = (x: number, signType: 'sheep' | 'tnt' | 'parts', altitude = 320) =>
    obstacles.push({
      kind: 'sign',
      signType,
      x,
      width: 360,
      height: 150,
      lane: -1,
      laneSpan: 4,
      altitude,
      hit: false,
      hitAt: -100,
    });

  const addBlimp = (x: number, altitude = 545) =>
    obstacles.push({
      kind: 'blimp',
      x,
      width: 230,
      height: 115,
      lane: -1,
      laneSpan: 4,
      altitude,
      hit: false,
      hitAt: -100,
    });

  const addBlimpSign = (x: number, signType: 'sheep' | 'tnt' | 'parts', signAlt = 320, blimpAlt = 545) => {
    addBlimp(x + 65, blimpAlt);
    addSign(x, signType, signAlt);
  };

  // =========================================================================
  // SECTION 1: THE ALPINE DOWNHILL (0m – 12,000m / x: 0 to 24,000)
  // =========================================================================
  for (let lane = 0; lane < 4; lane++) {
    add('ramp', 510, 190, 76, lane);
    add('boost', 770, 116, 15, lane);
  }
  addBlimpSign(980, course === 'sheep' ? 'sheep' : course === 'boomtown' ? 'tnt' : 'parts', 320, 545);
  add('sheep', 1160, 62, 59, course === 'sheep' ? 2 : 0);
  add('loop', 1370, 375, 322, course === 'boomtown' ? 3 : 2);
  add('spring', 1670, 82, 56, 1);
  addBlimp(1850, 540);
  if (course === 'boomtown') add('tnt', 1210, 65, 70, 1);

  const step1 = course === 'boomtown' ? 2420 : course === 'sheep' ? 2160 : 2300;
  for (let x = 2400, section = 0; x < SECTION_LIP_START - 1800; x += step1, section++) {
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
      add('tnt', x + 295, 65, 70, lane);
      add('tnt', x + 430, 65, 70, (lane + 1) % 4);
      add('ramp', x + 700, 210, 125, (lane + 2) % 4);
      addBlimpSign(x + 980, section % 2 === 0 ? 'tnt' : 'parts', 335, 560);
      add('gap', x + 1120, 192, 0, section % 3, 2);
      if (section % 2 === 1) addBlimp(x + 1380, 560);
      add('tnt', x + 1520, 65, 70, (lane + 3) % 4);
      add('spring', x + 1750, 82, 56, lane);
      if (section % 3 === 1) add('loop', x + 2120, 355, 300, (lane + 1) % 4);
      else add('boost', x + 2110, 130, 15, (lane + 3) % 4);
    } else {
      add('sheep', x + 135, 66, 62, lane);
      add('sheep', x + 265, 62, 59, (lane + 2) % 4);
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

  // =========================================================================
  // TRANSITION 1 -> 2: THE CANYON LIP TURN (x: 24,000 to 25,600)
  // =========================================================================
  addSign(SECTION_LIP_START - 200, 'parts', 320);
  for (let lane = 0; lane < 4; lane++) {
    add('boost', SECTION_LIP_START + 200, 140, 15, lane);
  }
  // Rushing river impact spray where waterfall meets the track
  add('waterfall_splash', SECTION_LIP_START + 450, 480, 160, -1, 4);
  // Rock deflectors guiding into the 90° right turn
  add('water_rock', SECTION_LIP_START + 700, 110, 110, 0, 1, { deflectPower: 1.4 });
  add('water_rock', SECTION_LIP_START + 950, 110, 110, 3, 1, { deflectPower: 1.4 });
  // Canyon lip launch ramps over the abyss
  for (let lane = 0; lane < 4; lane++) {
    add('ramp', SECTION_LIP_START + 1200, 220, 110, lane);
  }

  // =========================================================================
  // SECTION 2: WATERFALL CLIFF ZIGZAG & PINBALL CHASM (x: 25,600 to 48,000)
  // =========================================================================
  const step2 = 2800;
  for (let x = SECTION_2_START + 400, i = 0; x < SECTION_2_END - 2000; x += step2, i++) {
    const lane = (i * 2) % 4;
    // Rock deflectors in alternating lanes
    add('water_rock', x + 200, 120, 120, lane, 1, { deflectPower: 1.35 });
    add('water_rock', x + 650, 110, 110, (lane + 2) % 4, 1, { deflectPower: 1.35 });

    // Breakable wooden bridges over chasm drops
    if (i % 2 === 0) {
      add('break_bridge', x + 1050, 320, 40, -1, 4, { health: 1, broken: false });
      add('waterfall_splash', x + 1150, 360, 140, -1, 4);
    } else {
      add('gap', x + 1050, 200, 0, (lane + 1) % 4, 2);
      add('spring', x + 850, 85, 58, (lane + 1) % 4);
    }

    // Pinball spinners & boost pads
    add('pinball_spinner', x + 1600, 90, 90, (lane + 3) % 4, 1, { spinAngle: 0 });
    add('boost', x + 1950, 130, 15, lane);
    add('waterfall_splash', x + 2300, 320, 120, (lane + 2) % 4, 2);
  }

  // =========================================================================
  // TRANSITION 2 -> 3: SPLASHDOWN POOL & CAVERN MAW (x: 48,000 to 50,400)
  // =========================================================================
  add('waterfall_splash', SECTION_3_START + 200, 520, 180, -1, 4);
  add('waterfall_splash', SECTION_3_START + 500, 520, 180, -1, 4);
  // 3D Carnival rock gate archway entering the subterranean mine
  add('rock_gate', SECTION_3_START + 1100, 480, 320, -1, 4, { variant: 'mine-gate' });
  add('rock_gate', SECTION_3_START + 1800, 480, 320, -1, 4, { variant: 'mine-gate-b' });

  // =========================================================================
  // SECTION 3: SUBTERRANEAN ROLLER COASTER MINE (x: 50,400 to 68,400)
  // =========================================================================
  const step3 = 3000;
  for (let x = SECTION_3_START + 2400, j = 0; x < SECTION_3_END - 2000; x += step3, j++) {
    const lane = j % 4;
    // Minecart rails & switches
    add('roller_rails', x + 100, 300, 30, lane, 1);
    add('cave_torch', x + 250, 60, 120, -1, 4);

    // Swinging molten cauldrons
    if (j % 2 === 0) {
      add('cauldron', x + 700, 140, 140, (lane + 1) % 4, 2);
    } else {
      add('tnt', x + 650, 70, 75, (lane + 2) % 4);
    }

    // 360° Lava Loops
    if (j % 2 === 1) {
      add('lava_loop', x + 1300, 380, 330, (lane + 1) % 4);
      add('lava_loop', x + 1300, 380, 330, (lane + 3) % 4);
    } else {
      add('ramp', x + 1250, 210, 110, lane);
      add('boost', x + 1550, 130, 15, lane);
    }

    // Tunnel frames framing the ride
    add('rock_gate', x + 2100, 460, 300, -1, 4, { variant: j % 2 ? 'rock-tunnel-frame-a' : 'rock-tunnel-frame-b' });
    add('boost', x + 2600, 130, 15, (lane + 2) % 4);
  }

  // =========================================================================
  // TRANSITION 3 -> FINISH: WATERFALL BREAKTHROUGH & STADIUM (x: 68,400 to 72,000)
  // =========================================================================
  // Rocket incline boost into waterfall curtain
  for (let lane = 0; lane < 4; lane++) {
    add('boost', SECTION_3_END + 200, 140, 15, lane);
  }
  // Breakthrough waterfall curtain
  add('waterfall_splash', SECTION_3_END + 700, 520, 220, -1, 4, { variant: 'waterfall-curtain' });
  for (let lane = 0; lane < 4; lane++) {
    add('ramp', SECTION_3_END + 1100, 200, 80, lane);
    add('boost', STADIUM_START + 1200, 130, 15, lane);
    add('boost', FINISH - 600, 140, 15, lane);
  }
  // Grand finish line gantry
  add('rock_gate', FINISH - 100, 520, 340, -1, 4, { variant: 'stadium-gantry' });

  const sorted = obstacles.sort((a, b) => a.x - b.x);
  const skipBeforeX = options.skipBeforeX;
  if (skipBeforeX === undefined) return sorted;
  const keepLoopsFromX = options.keepLoopsFromX;
  return sorted.filter((obstacle) => obstacle.x >= skipBeforeX
    || (keepLoopsFromX !== undefined && obstacle.kind === 'loop' && obstacle.x >= keepLoopsFromX));
}
