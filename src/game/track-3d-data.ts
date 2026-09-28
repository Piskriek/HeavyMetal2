/**
 * 3D Track Data — extracted from Arena AI's Three.js fly-through.
 *
 * Coordinate system (Arena AI / Three.js world):
 *   x = lateral (left/right)
 *   y = vertical (up is +y)
 *   z = down-track (forward is +z in alpine, then turns)
 *
 * Our engine coordinate mapping:
 *   Arena x → our z (cross-track lateral)
 *   Arena y → our -altitude (flip for screen coords)
 *   Arena z → our x (down-track distance)
 */

export type Stage3D =
  | 'alpine'
  | 'canyon'
  | 'zigzag'
  | 'cavern'
  | 'mine'
  | 'breakthrough'
  | 'stadium';

export interface Waypoint3D {
  x: number;
  y: number;
  z: number;
  stage: Stage3D;
  label?: string;
}

export interface LoopDef3D {
  entryX: number;
  entryY: number;
  entryZ: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
  radius: number;
  shift: number;
  stage: Stage3D;
  label: string;
}

/* ---------------------------------------------------------------------------
   CONSTANTS
   -------------------------------------------------------------------------- */
export const LANE_WIDTH_3D = 240;
export const TRACK_HALF_WIDTH_3D = LANE_WIDTH_3D * 2; // 480 → 960 wide

export const LAVA_Y = -7200;
export const VALLEY_Y = -3500;
export const ARENA_FLOOR_Y = -210;

/** The hollow mountain that contains the mine (stages 4–6). */
export const CAVE_BOUNDS = {
  xMin: -47500,
  xMax: -12500,
  zMin: 26000,
  zMax: 44000,
  floorY: -9000,
  ceilY: 4000,
  topY: 4600,
};

/** Alpine terrain heightfield footprint. */
export const ALPINE_BOUNDS = {
  x0: -16000,
  x1: 14000,
  z0: -14000,
  z1: 25000,
};

export const TERRAIN_DROP = 100;
export const RIVER_X = -7000;

/* ---------------------------------------------------------------------------
   WAYPOINTS — the 3D centerline spline control points
   -------------------------------------------------------------------------- */
export const WAYPOINTS: Waypoint3D[] = [
  // ---- 1. ALPINE DOWNHILL ----
  { x: 0, y: 18000, z: -2400, stage: 'alpine', label: 'start' },
  { x: 0, y: 18000, z: -1000, stage: 'alpine', label: 'startRamp' },
  { x: 0, y: 17950, z: 400, stage: 'alpine', label: 'launchEdge' },
  { x: 500, y: 17550, z: 3000, stage: 'alpine' },
  { x: 1600, y: 17000, z: 5600, stage: 'alpine', label: 'ramp1' },
  { x: 1000, y: 16450, z: 8200, stage: 'alpine' },
  { x: -700, y: 15950, z: 10800, stage: 'alpine' },
  { x: -1200, y: 15450, z: 13200, stage: 'alpine' },
  { x: -1200, y: 15250, z: 14200, stage: 'alpine' },
  // (alpine loop waypoints are generated procedurally — 12 points around the circle)
  { x: -2300, y: 14950, z: 16400, stage: 'alpine' },
  { x: -1800, y: 14650, z: 18400, stage: 'alpine', label: 'ramp2' },
  { x: -800, y: 14250, z: 20600, stage: 'alpine' },
  { x: -200, y: 13850, z: 22800, stage: 'alpine' },
  { x: -300, y: 13650, z: 24300, stage: 'alpine', label: 'alpineEnd' },

  // ---- 2. CANYON LIP ----
  { x: -700, y: 13500, z: 25300, stage: 'canyon', label: 'canyonStart' },
  { x: -1500, y: 13350, z: 26100, stage: 'canyon', label: 'canyonApex' },
  { x: -2500, y: 13250, z: 26500, stage: 'canyon' },
  { x: -3600, y: 13150, z: 26600, stage: 'canyon' },

  // ---- 3. WATERFALL CLIFF ZIGZAG ----
  { x: -6100, y: 11850, z: 26650, stage: 'zigzag', label: 'zigzagStart' },
  { x: -8600, y: 10550, z: 26700, stage: 'zigzag' },
  { x: -10000, y: 10250, z: 27300, stage: 'zigzag' },
  { x: -10500, y: 10000, z: 27900, stage: 'zigzag', label: 'hairpin1' },
  { x: -10000, y: 9750, z: 28500, stage: 'zigzag' },
  { x: -8600, y: 9450, z: 29100, stage: 'zigzag', label: 'bridge1a' },
  { x: -6100, y: 8150, z: 29200, stage: 'zigzag', label: 'bridge1b' },
  { x: -3600, y: 6850, z: 29200, stage: 'zigzag' },
  { x: -2200, y: 6550, z: 29800, stage: 'zigzag' },
  { x: -1700, y: 6300, z: 30400, stage: 'zigzag', label: 'hairpin2' },
  { x: -2200, y: 6050, z: 31000, stage: 'zigzag' },
  { x: -3600, y: 5750, z: 31700, stage: 'zigzag' },
  { x: -6100, y: 4450, z: 31800, stage: 'zigzag', label: 'boulders' },
  { x: -8600, y: 3150, z: 31800, stage: 'zigzag' },
  { x: -10000, y: 2850, z: 32400, stage: 'zigzag' },
  { x: -10500, y: 2600, z: 33000, stage: 'zigzag', label: 'hairpin3' },
  { x: -10000, y: 2350, z: 33600, stage: 'zigzag' },
  { x: -8600, y: 2050, z: 34300, stage: 'zigzag', label: 'bridge2a' },
  { x: -6100, y: 750, z: 34400, stage: 'zigzag', label: 'bridge2b' },
  { x: -3600, y: -550, z: 34400, stage: 'zigzag' },
  { x: -2200, y: -850, z: 35000, stage: 'zigzag' },
  { x: -1700, y: -1100, z: 35600, stage: 'zigzag', label: 'hairpin4' },
  { x: -2200, y: -1350, z: 36200, stage: 'zigzag' },
  { x: -3600, y: -1650, z: 36900, stage: 'zigzag' },
  { x: -6100, y: -2200, z: 37000, stage: 'zigzag' },

  // ---- 4. CAVERN ENTRANCE ----
  { x: -8500, y: -2700, z: 37000, stage: 'cavern', label: 'cavernStart' },
  { x: -10500, y: -3000, z: 37000, stage: 'cavern' },
  { x: -12500, y: -3300, z: 37000, stage: 'cavern', label: 'caveEnter' },
  { x: -14500, y: -3600, z: 37050, stage: 'cavern' },

  // ---- 5. MINE ROLLER COASTER ----
  { x: -17000, y: -4200, z: 37300, stage: 'mine', label: 'mineStart' },
  { x: -19500, y: -3300, z: 37800, stage: 'mine' },
  { x: -21500, y: -4700, z: 37400, stage: 'mine' },
  { x: -23300, y: -4400, z: 36900, stage: 'mine' },
  // (lava loop 1 waypoints generated procedurally)
  { x: -26500, y: -4700, z: 35500, stage: 'mine' },
  { x: -29000, y: -3700, z: 35700, stage: 'mine' },
  { x: -31500, y: -5300, z: 36200, stage: 'mine' },
  { x: -34000, y: -4800, z: 36600, stage: 'mine' },
  { x: -35700, y: -5000, z: 36700, stage: 'mine' },
  // (lava loop 2 waypoints generated procedurally)
  { x: -39000, y: -5500, z: 35500, stage: 'mine' },
  { x: -41000, y: -5900, z: 35600, stage: 'mine' },
  { x: -43000, y: -5600, z: 35400, stage: 'mine' },

  // ---- 6. WATERFALL BREAKTHROUGH ----
  { x: -44300, y: -5100, z: 35200, stage: 'breakthrough', label: 'breakStart' },
  { x: -45300, y: -3700, z: 35100, stage: 'breakthrough' },
  { x: -46200, y: -2200, z: 35000, stage: 'breakthrough' },
  { x: -47000, y: -600, z: 35000, stage: 'breakthrough' },
  { x: -47500, y: -150, z: 35000, stage: 'breakthrough', label: 'caveExit' },

  // ---- 7. STADIUM FINISH ----
  { x: -48300, y: -80, z: 35000, stage: 'stadium', label: 'stadiumStart' },
  { x: -49500, y: 0, z: 35000, stage: 'stadium' },
  { x: -51500, y: 0, z: 35000, stage: 'stadium', label: 'grandstand' },
  { x: -53200, y: 0, z: 35000, stage: 'stadium', label: 'finish' },
  { x: -54300, y: 0, z: 35000, stage: 'stadium', label: 'end' },
];

/* ---------------------------------------------------------------------------
   LOOP DEFINITIONS — 360° vertical loops
   -------------------------------------------------------------------------- */
export const LOOP_DEFS: LoopDef3D[] = [
  {
    entryX: -1200, entryY: 15150, entryZ: 15200,
    forwardX: 0, forwardY: 0, forwardZ: 1,
    radius: 1400, shift: 1100,
    stage: 'alpine', label: 'alpineLoop',
  },
  {
    entryX: -24700, entryY: -4500, entryZ: 36800,
    forwardX: -1, forwardY: 0, forwardZ: 0,
    radius: 1600, shift: 1100,
    stage: 'mine', label: 'lavaLoop1',
  },
  {
    entryX: -37100, entryY: -5100, entryZ: 36700,
    forwardX: -1, forwardY: 0, forwardZ: 0,
    radius: 1500, shift: 1100,
    stage: 'mine', label: 'lavaLoop2',
  },
];

/* ---------------------------------------------------------------------------
   BRIDGE LABELS — plank bridge segments spanning ravines
   -------------------------------------------------------------------------- */
export const BRIDGE_LABELS = [
  { start: 'bridge1a', end: 'bridge1b' },
  { start: 'bridge2a', end: 'bridge2b' },
];

/* ---------------------------------------------------------------------------
   DISTANT MOUNTAIN PEAKS — for the world backdrop
   -------------------------------------------------------------------------- */
export const DISTANT_PEAKS: { x: number; z: number; radius: number; height: number }[] = [
  { x: 30000, z: 5000, radius: 14000, height: 15000 },
  { x: 34000, z: 30000, radius: 12000, height: 12000 },
  { x: 26000, z: 55000, radius: 15000, height: 14000 },
  { x: 0, z: 70000, radius: 18000, height: 16000 },
  { x: -30000, z: 68000, radius: 14000, height: 13000 },
  { x: -62000, z: 60000, radius: 16000, height: 15000 },
  { x: -80000, z: 35000, radius: 15000, height: 17000 },
  { x: -75000, z: 5000, radius: 14000, height: 14000 },
  { x: -50000, z: -15000, radius: 16000, height: 15000 },
  { x: -25000, z: -25000, radius: 14000, height: 12000 },
  { x: 12000, z: 82000, radius: 13000, height: 11000 },
  { x: -88000, z: 50000, radius: 12000, height: 11000 },
];

/* ---------------------------------------------------------------------------
   TEXTURE KEYS — mapping to the Blizzard-style textures in public/art/tracks/
   -------------------------------------------------------------------------- */
export type TrackTexKey =
  | 'dirt'
  | 'cliff'
  | 'grass'
  | 'lava'
  | 'caverock'
  | 'cobble'
  | 'wood'
  | 'iron'
  | 'bark'
  | 'water';

export const TRACK_TEXTURES: Record<TrackTexKey, string> = {
  dirt: 'art/tracks/tex-dirt.png',
  cliff: 'art/tracks/tex-cliff.png',
  grass: 'art/tracks/tex-grass.png',
  lava: 'art/tracks/tex-lava.png',
  caverock: 'art/tracks/tex-caverock.png',
  cobble: 'art/tracks/tex-cobble.png',
  wood: 'art/tracks/tex-wood.png',
  iron: 'art/tracks/tex-iron.png',
  bark: 'art/tracks/tex-bark.png',
  water: 'art/tracks/tex-water.png',
};

/** Stage → which texture is used for the track surface at that stage. */
export const STAGE_SURFACE_TEXTURE: Record<Stage3D, TrackTexKey> = {
  alpine: 'dirt',
  canyon: 'dirt',
  zigzag: 'dirt',
  cavern: 'caverock',
  mine: 'wood',
  breakthrough: 'caverock',
  stadium: 'cobble',
};

/** Stage → which texture is used for the walls/banks flanking the track. */
export const STAGE_WALL_TEXTURE: Record<Stage3D, TrackTexKey> = {
  alpine: 'grass',
  canyon: 'cliff',
  zigzag: 'cliff',
  cavern: 'caverock',
  mine: 'caverock',
  breakthrough: 'caverock',
  stadium: 'cobble',
};
