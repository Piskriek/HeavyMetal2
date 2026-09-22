# HEAVY METAL GP 2 — CODEBASE CONTEXT PATCH
# For CLI AI Planning &amp; Implementation
# Generated: 2026-09-22T10:19:00+02:00
#
# This file contains the full implementation plan and all relevant source files
# needed to implement the mass-racer qualifying system, deformable rolling physics,
# track builder extensions (powerups &amp; invisible walls), and quad-sphere ball geometry.
#
# CRITICAL: The user's track decorations file (backups/props/track-props-latest.json)
# contains 237 hand-placed props and MUST NOT be corrupted or overwritten.

================================================================================
## PROJECT OVERVIEW
================================================================================

Heavy Metal GP 2 is a goblin marble racing game built with:
- React 19 + TypeScript + Vite 7
- Three.js 0.186 for 3D rendering
- TailwindCSS 4
- Custom 2D physics engine with 120Hz fixed timestep
- 3D track builder with prop placement, decals, ramps, slingshots
- 4-racer local multiplayer (slingshot launch then downhill race then loops then stadium)

The game world is a 15km downhill track divided into 4 sections:
1. Alpine Downhill (x: 0-24,000) - pine valleys, loops, ramps, sheep
2. Canyon Zigzag and Pinball Chasm (x: 25,600-48,000) - water rocks, breakable bridges, spinners
3. Subterranean Mine (x: 48,000-68,400) - lava loops, cauldrons, rail tunnels
4. Stadium Breakthrough (x: 68,400+) - waterfall curtain, finish line

The 2D physics engine maps to 3D via a precomputed spline (TrackData samples).
The 2D coordinate system uses (x, y) where x=distance along track, y=altitude.
The 3D coordinate system maps these to (x, y, z) in world space via spline samples.

================================================================================
## PROJECT STRUCTURE
================================================================================

c:\MarbleGp\
  package.json                    - React+Vite+Three.js+TailwindCSS
  backups/props/
    track-props-latest.json       - 237 user-placed decorations (94KB) DO NOT CORRUPT
    track-props-default.json      - Default props backup
    user_safety_backup/           - Cold storage snapshots
  public/
    art/balls/                    - iron-ball.png, springsteel-ball.png, siege-ball.png
    art/sheets/balls/             - High-res source PNGs (1254x1254)
    art/props/alpha/              - All prop PNGs with alpha
    textures/                     - dirt, cliff, cave, lava, wood, grass, etc.
  src/
    App.tsx                       - Root React app
    main.tsx                      - Entry point
    index.css, hud.css, etc.      - Stylesheets
    components/
      TrackBuilderUI.tsx            114KB - Full track builder UI
      RaceControls.tsx              HUD during race
      NewGameSetup.tsx              Race setup screen
      BallTuning.tsx                Ball physics tuning panel
      ... (16 component files)
    screens/
      RaceScreen.tsx                Main race screen orchestrator
    game/
      engine.ts                     56KB - Core physics engine (120Hz)
      scene.ts                      Constants and interfaces (Obstacle, LoopRide, RacerFrame, SceneFrame)
      racers.ts                     Racer interface and createRacers() factory
      types.ts                      GameStatus, GameSnapshot, GameOptions, RACER_DEFINITIONS
      track-layout.ts               Procedural obstacle placement for each course
      powerups.ts                   AirPickup system (fuel, shield, bounce)
      renderer-3d.ts                80KB - Three.js 3D renderer, track geometry, racer meshes, camera
      renderer.ts                   Thin wrapper delegating to Renderer3D
      track-builder-3d.ts           100KB - Full 3D track builder (prop placement, ramps, decals, slingshots)
      courses.ts                    Course definitions (ridge, boomtown, sheep), lighting profiles
      loadouts.ts                   Rider/Capsule definitions and stats
      session.ts                    RaceConfig, RaceSession, tournament management
      geometry.ts                   3D geometry helpers
      environment.ts                World environment (trees, terrain, water)
      track-geometry-3d.ts          3D track mesh generation
      track-3d-data.ts              TrackData spline samples
      ... (34 game files total)

================================================================================
## IMPLEMENTATION PLAN SUMMARY
================================================================================

### 1. Solo Slingshot Launch and First-Loop Qualifying Staging
- Support huge numbers of balls (20-100) with limited starting area
- Each player starts SOLO at the slingshot (other balls hidden)
- Pre-loop section has a ramp jump with risk/reward random powerup
- Time recorded when entering First Loop - joins race pool
- Players sorted by qualifying time into pole positions
- Staging lobby shows leaderboard, waits for all ready
- 3-2-1 countdown - staggered loop exit preserving entry velocity
- Full marble-on-marble collisions enabled post-loop exit

### 2. Low-Compute Collision Mesh Deformation and Dynamic Rolling Physics
- Visual GPU vertex denting via shader displacement (1-3 impact craters per marble)
- O(1) CPU eccentricity model: wobble torque, rhythmic hopping, dent drag
- Dent saturation cap (28% of radius max, 3 concurrent dents)
- Powerup repair mechanic (hitting Shield/Fuel pops out 50% of dents)

### 3. Track Builder: Placeable Powerups and Invisible Collision Walls
- New prop types: powerup_boost, powerup_shield, powerup_bounce, powerup_mystery
- New prop type: invisible_collision_wall (semi-transparent red plane in editor)
- Show/hide toggle button for invisible walls in editor (shortcut H)
- Walls modeled as thick OBBs with swept-ray CCD collision (no tunneling)
- Walls invisible during actual races

### 4. Quad-Sphere Ball Geometry and UV Snapshot Export
- Replace THREE.SphereGeometry(RADIUS, 24, 16) with Normalized Cube Sphere
- 6-face cube projection - sphere normalization with uniform texel density
- UV unwrap as 3x2 grid layout (no polar pinching)
- One-click "Export UV Template PNG" button (2048x2048)

### Key Design Decisions
- Exit interval: dt_exit = dt_safe + min(0.25s, dT_qual * 0.25)
- Up to 4 racers can exit simultaneously across parallel lanes
- Loop holding pattern: aesthetic centrifuge orbit inside the loop structure
- Collision scaling: 1D track-distance sweep - O(N) expected time
- Auto-tow timeout: if stuck for 3.5s, repositioned or given penalty time
- All new PlacedProp fields are optional (backward compatible with 237 existing props)

### Files to Modify
- scene.ts - Add RacePhase, QualifyingEntry types, LOOP_1_X constant
- engine.ts - Solo start state, loop gatekeeper, qualifying pool, countdown, staggered exit, invisible wall collision, powerup collection from placed props, deformation physics in resolveBumps
- racers.ts - Add qualifyingTime, polePosition, entrySpeed, deformation fields
- types.ts - Add new GameStatus values, qualifying snapshot fields
- track-builder-3d.ts - Add powerup and invisible wall prop definitions, toggle visibility
- renderer-3d.ts - Replace SphereGeometry with quad-sphere, connect deformation shader
- TrackBuilderUI.tsx - Add show/hide walls toggle, powerup/barrier filter chips

### Files to Create
- sphere-deformation.ts - GPU vertex shader injection, physical eccentricity model
- quad-sphere.ts - Normalized Cube Sphere generator, UV snapshot exporter
- QualifyingStagingModal.tsx - Staging overlay with leaderboard, ready button, countdown

================================================================================
## SOURCE FILE: package.json
================================================================================

{
  "name": "react-vite-tailwind",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "clsx": "2.1.1",
    "framer-motion": "^13.4.0",
    "lucide-react": "^1.46.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "tailwind-merge": "3.4.0",
    "three": "^0.186.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.1.17",
    "@types/node": "22.19.17",
    "@types/react": "19.2.7",
    "@types/react-dom": "19.2.3",
    "@types/three": "^0.186.0",
    "@vitejs/plugin-react": "5.1.1",
    "tailwindcss": "4.1.17",
    "tsx": "^4.23.13",
    "typescript": "5.9.3",
    "vite": "7.3.2",
    "vite-plugin-singlefile": "2.3.0"
  }
}

================================================================================
## SOURCE FILE: src/game/types.ts (FULL - 160 lines)
================================================================================

import type { Loadout } from './loadouts';
import type { Difficulty, RaceMode } from './session';
import type { PowerupKind } from './powerups';

export type GameStatus = 'loading' | 'ready' | 'flying' | 'paused' | 'finished';
export type CourseId = 'ridge' | 'boomtown' | 'sheep';
export type GraphicsMode = 'auto' | 'performance' | 'quality';
export type CameraMode = 'third_person' | 'follow_ball' | 'fixed';

export const RACER_DEFINITIONS = [
  { id: 0, name: 'YOU', color: '#f0a15b', homeLane: 2, weight: 120, pace: 1 },
  { id: 1, name: 'GRUB', color: '#87d7ba', homeLane: 0, weight: 155, pace: 0.99 },
  { id: 2, name: 'NIX', color: '#b7a0e8', homeLane: 1, weight: 85, pace: 1.015 },
  { id: 3, name: 'RIVET', color: '#e4cc77', homeLane: 3, weight: 125, pace: 1.005 },
] as const;

export interface RacerStanding {
  id: number; name: string; color: string; position: number;
  distance: number; lane: number; finished: boolean; recovering: boolean;
  finishTime: number | null; loadout?: Loadout;
}

export interface GameOptions {
  sound: boolean; screenShake: boolean; downrange: boolean; parallax: boolean;
  aimAssist: boolean; cameraMode: CameraMode; course: CourseId;
  graphics: GraphicsMode; launchSpeed: number; ballWeight: number;
  masterVolume: number; menuMotion: boolean; reducedMotion: boolean;
  highContrast: boolean;
}

export interface RunRecord {
  id: string; distance: number; topSpeed: number; score: number;
  sheep: number; explosions: number; loops: number; course: CourseId;
  date: string; completed: boolean; trackLength?: number; weight?: number;
  launchSpeed?: number; position?: number; bumps?: number; raceTime?: number;
  opponents?: RacerStanding[]; sessionId?: string;
  mode?: RaceMode | 'practice'; round?: number; loadout?: Loadout;
  difficulty?: Difficulty; pickups?: number; shieldsUsed?: number;
}

export interface GameSnapshot {
  status: GameStatus; distance: number; speed: number;
  power: number; angle: number; bounces: number; boosts: number;
  inLoop: boolean; falling: boolean; hopReady: boolean; grounded: boolean;
  grade: number; sector: string; score: number; notice: string;
  progress: number; position: number; lane: number; targetLane: number;
  laneLocked: boolean; bumps: number; raceTime: number;
  racers: RacerStanding[]; settling: boolean; finishWait: number;
  pickups: number; shieldSeconds: number;
  lastPickup: PowerupKind | null; pickupNoticeUntil: number;
}

export const INITIAL_SNAPSHOT: GameSnapshot = {
  status: 'loading', distance: 0, speed: 0, power: 0.8, angle: 36,
  bounces: 3, boosts: 2, inLoop: false, falling: false, hopReady: false,
  grounded: false, grade: 0, sector: 'THE LAUNCH RIDGE', score: 0, notice: '',
  progress: 0, position: 1, lane: 2, targetLane: 2, laneLocked: false,
  bumps: 0, raceTime: 0,
  racers: RACER_DEFINITIONS.map((racer, index) => ({
    ...racer, position: index + 1, distance: 0, lane: racer.homeLane,
    finished: false, recovering: false, finishTime: null
  })),
  settling: false, finishWait: 0, pickups: 0, shieldSeconds: 0,
  lastPickup: null, pickupNoticeUntil: 0,
};

export const COURSES = [
  { id: 'ridge', name: 'Rustbucket Ridge', subtitle: 'Pine valleys. Flowing dirt. Questionable shortcuts.', number: '01' },
  { id: 'boomtown', name: 'Boomtown Run', subtitle: 'Copper canyons. Steep drops. Extra dynamite.', number: '02' },
  { id: 'sheep', name: 'Woolly Wasteland', subtitle: 'Open pastures. Airborne prizes. Angry locals.', number: '03' },
];

export const DEFAULT_OPTIONS: GameOptions = {
  sound: false, screenShake: true, downrange: true, parallax: true,
  aimAssist: true, cameraMode: 'third_person', course: 'ridge',
  graphics: 'auto', launchSpeed: 160, ballWeight: 120, masterVolume: 65,
  menuMotion: true, reducedMotion: false, highContrast: false,
};

================================================================================
## SOURCE FILE: src/game/scene.ts (FULL - 245 lines)
================================================================================

import type { CourseId, GameOptions, GameSnapshot } from './types';
import { TRACKS } from './courses';
import type { AirPickup } from './powerups';

export const HEIGHT = 620;
export const GROUND = 478;
export const START_X = 190;
export const START_Y = 325;
export const RADIUS = 31;
export const TRACK_DISTANCE = 36000;
export const TRACK_LENGTH = TRACK_DISTANCE * 2;
export const FINISH = START_X + TRACK_LENGTH;
export const STADIUM_START = START_X + 68400;
export const SECTION_LIP_START = START_X + 24000;
export const SECTION_LIP_END = START_X + 25600;
export const SECTION_2_START = START_X + 25600;
export const SECTION_2_END = START_X + 48000;
export const SECTION_3_START = START_X + 48000;
export const SECTION_3_END = START_X + 68400;
export const SECTION_BREAKTHROUGH = START_X + 68400;
export const GRAVITY = 2400;
export const LANE_COUNT = 4;
export const LANE_WIDTH = 240;
export const PLAYER_LANE = 2;
export const LANE = { near: -480, far: 480 };
export const laneZ = (lane: number) => LANE.far - LANE_WIDTH * (lane + 0.5);
export const closestLane = (z: number) => Math.max(0, Math.min(3, Math.round((LANE.far - z) / LANE_WIDTH - 0.5)));

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
  if (obstacle.kind === 'gap' || obstacle.kind === 'sign' || obstacle.kind === 'rock_gate'
    || obstacle.kind === 'break_bridge' || obstacle.kind === 'waterfall_splash') {
    const bounds = obstacleBounds(obstacle);
    return z > bounds.near + 5 && z < bounds.far - 5;
  }
  if (obstacle.kind === 'blimp') {
    const bounds = obstacleBounds(obstacle);
    return z > bounds.near - 40 && z < bounds.far + 40;
  }
  const halfWidth = obstacle.kind === 'ramp' || obstacle.kind === 'loop' || obstacle.kind === 'lava_loop'
    ? 66 : obstacle.kind === 'boost' ? 45 : obstacle.kind === 'water_rock' ? 55 : 37;
  return Math.abs(z - obstacleZ(obstacle)) < halfWidth + padding;
}

export const TERRAIN = GROUND + 154;
export const GRANDSTAND = { z: 350, base: GROUND + 64, height: 217, foundation: TERRAIN, depth: 138 };
export const LAUNCHER = { x: START_X + 128, tipY: GROUND - 241, halfWidth: 91, baseRear: START_X - 95, baseFront: START_X + 165 };
export const AIM_ANCHOR = { x: LAUNCHER.x + 4, y: LAUNCHER.tipY - 7, maxDraw: 220, fullPowerDraw: 200 };

// Hermite-interpolated elevation profile sampled every 16px
// courseY(x, course) returns the ground Y at position x
// courseSlope(x, course) returns the slope at position x
export function courseY(x: number, course: CourseId = 'ridge') { /* ... hermite interpolation ... */ }
export const courseSlope = (x: number, course: CourseId = 'ridge') => (courseY(x + 24, course) - courseY(x - 24, course)) / 48;
export const terrainY = (x: number, course: CourseId = 'ridge') => courseY(x, course) + 154;
export const launchVelocity = (power: number, speed: number) => speed / 0.16 * (0.45 + power * 0.55);
export const weightImpulse = (weight: number) => Math.max(0.68, Math.min(1.45, Math.sqrt(120 / weight)));

export function loopGeometry(obstacle: Pick<Obstacle, 'x' | 'height'>, course: CourseId = 'ridge') {
  const radius = obstacle.height * 0.48;
  return { x: obstacle.x, y: courseY(obstacle.x, course) - radius - 8, radius, ballRadius: radius - RADIUS - 9, halfWidth: 58 };
}

export function rampSurface(obstacle: Pick<Obstacle, 'x' | 'width' | 'height'>, x: number, course: CourseId = 'ridge') {
  const t = Math.max(0, Math.min(1, (x - obstacle.x) / obstacle.width));
  return courseY(x, course) - Math.pow(t, 1.6) * obstacle.height;
}

export type ObstacleKind =
  | 'ramp' | 'loop' | 'sheep' | 'tnt' | 'spring' | 'boost' | 'gap' | 'blimp'
  | 'sign' | 'water_rock' | 'break_bridge' | 'lane_tube' | 'pinball_spinner'
  | 'rock_gate' | 'cave_torch' | 'stalactite' | 'waterfall_splash'
  | 'roller_rails' | 'cauldron' | 'lava_loop';

export interface Obstacle {
  kind: ObstacleKind; x: number; width: number; height: number;
  hit: boolean; hitAt: number; lane?: number; laneSpan?: number;
  hitMask?: number; altitude?: number; signType?: 'sheep' | 'tnt' | 'parts';
  broken?: boolean; health?: number; variant?: string;
  spinAngle?: number; deflectPower?: number;
}

export interface Particle { x: number; y: number; z: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; }
export interface AirSheep { x: number; y: number; z: number; vx: number; vy: number; rotation: number; life: number; }

export interface LoopRide {
  obstacle: Obstacle; angle: number; entryAngle: number; exitAngle: number;
  speed: number; entry: { x: number; y: number }; entryProgress: number;
}

export interface RacerFrame {
  id: number; name: string; color: string; homeLane: number;
  lane: number; x: number; y: number; z: number; vx: number; vy: number;
  rotation: number; falling: boolean; grounded?: boolean; distance?: number;
  finished: boolean; bumpAt: number; immuneUntil: number;
  shieldUntil: number; shieldHitAt: number; pickupAt: number;
  launchOrigin: { x: number; y: number };
}

export interface SceneFrame {
  time: number; runTime: number; camera: number; cameraY: number;
  drift: number; shake: number; rotation: number; dragging: boolean;
  launchOrigin: { x: number; y: number };
  ball: { x: number; y: number; z: number; vx: number; vy: number };
  racers: RacerFrame[]; loopRide: LoopRide | null;
  obstacles: Obstacle[]; pickups: AirPickup[];
  particles: Particle[]; sheep: AirSheep[];
  trail: { x: number; y: number; z: number }[];
  snapshot: GameSnapshot; options: GameOptions; reducedMotion: boolean;
}

================================================================================
## SOURCE FILE: src/game/racers.ts (FULL - 67 lines)
================================================================================

import { laneZ, START_X, START_Y, type LoopRide, type Obstacle, type RacerFrame } from './scene';
import { RACER_DEFINITIONS } from './types';
import { DEFAULT_LOADOUT, loadoutStats, riderById, type Loadout } from './loadouts';
import type { RaceConfig } from './session';

export interface Racer extends RacerFrame {
  vz: number; targetLane: number; weight: number; pace: number;
  loadout: Loadout; launchSpeed: number; handling: number;
  boostFactor: number; hopFactor: number; bumpRecovery: number;
  maximumSpeed: number; grounded: boolean;
  lastGroundedAt: number; lastHopAt: number; bufferedJump: number;
  fallingFor: number; stoppedFor: number; recoveryUntil: number;
  steerLockedUntil: number; nextDecision: number;
  lastBoostAt: number; lastLaneChange: number;
  loopRide: LoopRide | null; finishTime: number | null;
  distance: number; bounces: number; boosts: number;
  visited: Set<Obstacle>;
  previous: { x: number; y: number; z: number; rotation: number };
}

export function createRacers(config?: RaceConfig): Racer[] {
  return RACER_DEFINITIONS.map((definition) => {
    const loadout = config?.roster[definition.id] ?? DEFAULT_LOADOUT;
    const stats = loadoutStats(loadout);
    return {
      ...definition, x: START_X, y: START_Y, z: laneZ(definition.homeLane),
      vx: 0, vy: 0, vz: 0,
      name: config ? riderById(loadout.rider).name.toUpperCase() : definition.name,
      loadout, weight: stats.weight, pace: 1,
      launchSpeed: stats.launchSpeed, handling: stats.handling,
      boostFactor: stats.boostFactor, hopFactor: stats.hopFactor,
      bumpRecovery: stats.bumpRecovery, maximumSpeed: stats.maximumSpeed,
      lane: definition.homeLane, targetLane: definition.homeLane, rotation: 0,
      falling: false, finished: false, grounded: false, bumpAt: -100,
      immuneUntil: -100, launchOrigin: { x: START_X, y: START_Y },
      shieldUntil: -100, shieldHitAt: -100, pickupAt: -100,
      lastGroundedAt: -100, lastHopAt: -100, bufferedJump: -100,
      fallingFor: 0, stoppedFor: 0, recoveryUntil: -100, steerLockedUntil: -100,
      nextDecision: 0.35 + definition.id * 0.11, lastBoostAt: -100, lastLaneChange: -100,
      loopRide: null, finishTime: null, distance: 0, bounces: 3, boosts: 2,
      visited: new Set<Obstacle>(),
      previous: { x: START_X, y: START_Y, z: laneZ(definition.homeLane), rotation: 0 },
    };
  });
}

export function raceOrder(a: Racer, b: Racer) {
  if (a.finishTime !== null || b.finishTime !== null) {
    return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
  }
  return b.x - a.x || a.id - b.id;
}

================================================================================
## SOURCE FILE: src/game/engine.ts (FULL - 1014 lines)
================================================================================

import type { GameAssets } from './assets';
import { GameAudio } from './audio';
import { RangeRenderer } from './renderer';
import { chaseLerp, clampCameraTarget } from './projection';
import { createRacers, raceOrder, type Racer } from './racers';
import {
  AIM_ANCHOR, FINISH, GROUND, GRAVITY, HEIGHT, LANE, LANE_COUNT, PLAYER_LANE,
  RADIUS, STADIUM_START, START_X, START_Y, TRACK_DISTANCE, closestLane, courseY, courseSlope,
  laneZ, launchVelocity, loopGeometry, obstacleZ, occupiesLane, rampSurface, sectorAt, weightImpulse,
  type AirSheep, type Obstacle, type Particle, type RacerFrame,
} from './scene';
import { INITIAL_SNAPSHOT, type GameOptions, type GameSnapshot, type GameStatus, type RacerStanding, type RunRecord } from './types';
import type { RaceConfig } from './session';
import { createTrackLayout } from './track-layout';
import { POWERUPS, SHIELD_DURATION, createAirPickups, hopTiming, pickupIntercept, pickupY, type AirPickup } from './powerups';

const TAU = Math.PI * 2;
const STEP = 1 / 120;
const BUCKET = 512;
const EMPTY: Obstacle[] = [];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export class GameEngine {
  private readonly renderer: RangeRenderer;
  private readonly audio = new GameAudio();
  private frameId = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private needsRender = true;
  private visible = true;
  private destroyed = false;
  private controlsEnabled = true;
  private time = 0;
  private runTime = 0;
  private camera = 0;
  private cameraY = 0;
  private pointerDrift = 0;
  private drift = 0;
  private shake = 0;
  private isDragging = false;
  private grabOffset = { x: 0, y: 0 };
  private topSpeed = 0;
  private noticeUntil = 0;
  private counts = { sheep: 0, explosions: 0, loops: 0, bumps: 0 };
  private racers = createRacers();
  private renderRacers: RacerFrame[] = [];
  private readonly collisionTimes = new Float64Array(16).fill(-100);
  private obstacles: Obstacle[] = [];
  private pickups: AirPickup[] = [];
  private readonly pickupBuckets = new Map<number, AirPickup[]>();
  private readonly buckets = new Map<number, Obstacle[]>();
  private particles: Particle[] = [];
  private snapshot: GameSnapshot = { ...INITIAL_SNAPSHOT, status: 'ready' };
  private pausedForBuild = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    assets: GameAssets,
    private options: GameOptions,
    private readonly onUpdate: (snapshot: GameSnapshot) => void,
    private readonly onFinish: (record: RunRecord) => void,
    private readonly config?: RaceConfig,
  ) {
    this.renderer = new RangeRenderer(canvas, assets, config?.course ?? options.course);
    this.audio.setEnabled(options.sound);
    this.reset();
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerCancel);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  private get player() { return this.racers[0]; }
  private y(x: number) { return courseY(x, this.options.course); }
  private slope(x: number) { return courseSlope(x, this.options.course); }
  get status(): GameStatus { return this.snapshot.status; }
  get trackBuilder() { return this.renderer.trackBuilder; }

  reset = () => {
    this.snapshot = { ...INITIAL_SNAPSHOT, status: 'ready' };
    this.racers = createRacers(this.config);
    this.renderRacers = this.racers.map((racer) => ({ ...racer }));
    this.camera = this.cameraY = this.runTime = 0;
    this.makeTrack();
    this.notify(); this.invalidate();
  };

  teleport = (targetX: number) => {
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i];
      racer.x = targetX + (i - 1.5) * 45;
      racer.targetLane = racer.homeLane ?? (i % 4);
      racer.lane = racer.targetLane;
      racer.z = laneZ(racer.lane);
      racer.y = this.surfaceAt(racer.x, racer.z).y - RADIUS;
      racer.vx = 480;
      racer.vy = this.slope(racer.x) * racer.vx;
      racer.grounded = true; racer.falling = false; racer.finished = false;
      racer.loopRide = null;
    }
    this.snapshot.status = 'flying';
    this.invalidate(); this.notify();
  };

  // LAUNCH: All 4 racers launch simultaneously from slingshot
  launch = () => {
    if (this.status !== 'ready') return;
    for (const racer of this.racers) {
      const velocity = launchVelocity(this.snapshot.power, racer.launchSpeed);
      const angle = clamp(this.snapshot.angle + (racer.id ? (racer.id - 2) * 1.2 : 0), 12, 68) * Math.PI / 180;
      racer.launchOrigin = { x: racer.x, y: racer.y };
      racer.vx = Math.cos(angle) * velocity * racer.pace;
      racer.vy = -Math.sin(angle) * velocity * racer.pace;
      racer.previous = { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation };
      this.emit(racer.x, racer.y, racer.z, 7, racer.color, 100);
    }
    this.snapshot.status = 'flying';
    this.isDragging = false;
    this.audio.play('launch');
    this.say('FOUR GOBLINS. ZERO RIGHT OF WAY.'); this.notify();
  };

  changeLane = (direction: number) => {
    const racer = this.player;
    if (this.status !== 'flying' || racer.falling || racer.loopRide || racer.finished) return;
    this.setLane(racer, racer.targetLane + Math.sign(direction));
  };

  private surfaceAt(x: number, z: number) {
    let y = this.y(x); let slope = this.slope(x); let ramp: Obstacle | null = null;
    for (const o of this.nearby(x)) if (o.kind === 'ramp' && x >= o.x && x <= o.x + o.width && occupiesLane(o, z, 5)) {
      y = rampSurface(o, x, this.options.course); slope -= 1.6 * o.height / o.width * Math.pow((x - o.x) / o.width, 0.6); ramp = o;
    }
    return { y, slope, ramp };
  }

  private makeTrack() {
    this.obstacles = createTrackLayout(this.options.course);
    this.buckets.clear(); this.pickupBuckets.clear();
    for (const obstacle of this.obstacles) {
      // Spatial bucket assignment for fast lookup
    }
    this.pickups = createAirPickups(this.options.course, this.obstacles);
    // Pickup bucket assignment
  }

  private nearby(x: number) { return this.buckets.get(Math.floor(x / BUCKET)) ?? EMPTY; }
  private inGap(x: number, z: number) { return this.nearby(x).some((o) => o.kind === 'gap' && x > o.x && x < o.x + o.width && occupiesLane(o, z, 0)); }

  // MAIN FRAME LOOP (requestAnimationFrame)
  private frame = (now: number) => {
    const dt = Math.min(this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60, 0.1);
    if (this.status === 'flying' && !this.pausedForBuild) {
      this.accumulator = Math.min(0.1, this.accumulator + dt);
      while (this.accumulator >= STEP && this.status === 'flying') {
        for (const racer of this.racers) {
          racer.previous.x = racer.x; racer.previous.y = racer.y;
          racer.previous.z = racer.z; racer.previous.rotation = racer.rotation;
        }
        this.stepRace(STEP); this.accumulator -= STEP;
      }
    }
    // Interpolate render positions
    const alpha = this.status === 'flying' ? clamp(this.accumulator / STEP, 0, 1) : 1;
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i]; const rendered = this.renderRacers[i];
      rendered.x = racer.previous.x + (racer.x - racer.previous.x) * alpha;
      rendered.y = racer.previous.y + (racer.y - racer.previous.y) * alpha;
      rendered.z = racer.previous.z + (racer.z - racer.previous.z) * alpha;
      // ... copy all render state
    }
    // Build SceneFrame and call renderer
  };

  // MAIN PHYSICS STEP at 120Hz
  private stepRace(dt: number) {
    this.runTime += dt;
    for (const racer of this.racers) {
      if (racer.finished) continue;
      if (racer.id && this.runTime >= racer.nextDecision) this.driveCPU(racer);
      this.stepRacer(racer, dt);
    }
    this.resolveBumps();
    this.resolvePickups();
    this.refreshSnapshot();
    if (this.player.finished) {
      this.snapshot.settling = true;
      this.snapshot.finishWait = Math.max(0, Math.ceil(10 - (this.runTime - this.player.finishTime!)));
      if (this.racers.every((racer) => racer.finished) || this.snapshot.finishWait === 0) this.finish(true);
    }
    else if (this.runTime > 300) this.finish(false);
  }

  // CPU AI DRIVER
  private driveCPU(racer: Racer) {
    // Lane scoring: avoid gaps, seek boosts/ramps/loops, avoid/bump other racers
    // Hop over gaps, bounce over chasms, boost when slow
    // Difficulty-based reaction times (rookie 0.43s, racer 0.19s, veteran 0.13s)
  }

  // PER-RACER PHYSICS STEP
  private stepRacer(racer: Racer, dt: number) {
    const oldX = racer.x;

    // FALLING STATE
    if (racer.falling) {
      racer.fallingFor += dt; racer.vy += GRAVITY * dt;
      racer.x += racer.vx * dt * 0.45; racer.y += racer.vy * dt;
      if (racer.fallingFor > 0.72) this.recover(racer);
      return;
    }

    // LANE STEERING (when not in a loop)
    if (!racer.loopRide) {
      const isWet = racer.x >= 24000 && racer.x <= 48000;
      const response = (this.runTime < racer.steerLockedUntil ? 7 : (isWet ? 20 : 33)) * racer.handling;
      const steering = (laneZ(racer.targetLane) - racer.z) * response - racer.vz * (isWet ? 6.2 : 9.5) * Math.sqrt(racer.handling);
      racer.vz = clamp(racer.vz + steering * dt, -650 * racer.handling, 650 * racer.handling);
      racer.z = clamp(racer.z + racer.vz * dt, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
      racer.lane = closestLane(racer.z);
    }

    const dragFactor = 120 / racer.weight;
    const stageGravity = (racer.x >= 24000 && racer.x <= 48000 ? GRAVITY * 1.45 : GRAVITY);

    // LOOP RIDE (circular orbit)
    if (racer.loopRide) {
      const ride = racer.loopRide;
      const loop = loopGeometry(ride.obstacle, this.options.course);
      // Snap Z to loop center
      racer.z += (obstacleZ(ride.obstacle) - racer.z) * Math.min(1, dt * 16);
      racer.vz = 0;

      if (ride.entryProgress < 1) {
        // Smooth entry interpolation
        ride.entryProgress = Math.min(1, ride.entryProgress + dt * 7);
        const t = ride.entryProgress; const ease = t * t * (3 - 2 * t);
        // Lerp from entry point to loop circle position
      } else {
        // Circular motion: angle += speed / ballRadius * dt
        ride.angle += Math.min(ride.speed, 760) / loop.ballRadius * dt;
        racer.x = loop.x + Math.sin(ride.angle) * loop.ballRadius;
        racer.y = loop.y + Math.cos(ride.angle) * loop.ballRadius + this.y(racer.x) - this.y(loop.x);
      }

      // EXIT CONDITION
      if (ride.angle >= ride.exitAngle) {
        racer.x = loop.x + 3;
        racer.y = loop.y + loop.ballRadius + this.y(racer.x) - this.y(loop.x);
        racer.vx = Math.min(racer.maximumSpeed, ride.speed * 1.08);
        racer.vy = this.slope(racer.x) * racer.vx;
        racer.loopRide = null; racer.grounded = false;
      }
    } else {
      // GROUND PHYSICS
      if (racer.grounded && !this.inGap(racer.x, racer.z)) {
        const before = this.surfaceAt(racer.x, racer.z);
        const downhill = stageGravity * before.slope / (1 + before.slope * before.slope) / 1.4;
        const resistance = 7 + racer.vx * 0.025 * Math.sqrt(dragFactor) + racer.vx * racer.vx * 0.000009 * dragFactor;
        racer.vx = Math.max(0, racer.vx + (downhill - resistance) * dt);
        racer.vy = before.slope * racer.vx; racer.x += racer.vx * dt;
        // Ramp launch detection...
      } else {
        // AIRBORNE: parabolic trajectory
        racer.vx *= Math.exp(-0.009 * dragFactor * dt);
        racer.vy += stageGravity * dt;
        racer.x += racer.vx * dt; racer.y += racer.vy * dt;
      }

      // OBSTACLE DETECTION
      for (const obstacle of this.nearby(racer.x)) {
        if (racer.visited.has(obstacle) || obstacle.kind === 'gap' || obstacle.kind === 'ramp') continue;
        if (!occupiesLane(obstacle, racer.z)) continue;

        if (obstacle.kind === 'loop') {
          const loop = loopGeometry(obstacle, this.options.course);
          const dx = racer.x - loop.x;
          const dy = racer.y - (this.y(racer.x) - this.y(loop.x)) - loop.y;
          if (Math.abs(dx) <= loop.radius + RADIUS
            && Math.abs(Math.hypot(dx, dy) - loop.ballRadius) < RADIUS * 1.12
            && racer.vx > 245) {
            // ENTER LOOP
            const angle = (Math.atan2(dx, dy) + TAU) % TAU;
            racer.visited.add(obstacle);
            racer.grounded = false;
            racer.targetLane = obstacle.lane ?? PLAYER_LANE;
            racer.loopRide = {
              obstacle, angle, entryAngle: angle,
              exitAngle: Math.ceil((angle + TAU * 0.65) / TAU) * TAU,
              speed: Math.max(650, racer.vx),
              entry: { x: racer.x, y: racer.y }, entryProgress: 0
            };
            break;
          }
        } else {
          // Other obstacle collision (boost, tnt, sheep, spring, etc.)
          this.hitObstacle(racer, obstacle);
        }
      }

      // Landing detection, falling detection...
    }

    // Distance and finish tracking
    racer.vx = clamp(racer.vx, 0, racer.maximumSpeed);
    racer.distance = Math.max(racer.distance, clamp((racer.x - START_X) / 2, 0, TRACK_DISTANCE));
    if (racer.x >= FINISH && !racer.falling) {
      racer.finishTime = this.runTime;
      racer.finished = true; racer.distance = TRACK_DISTANCE;
    }
    // Lava plunge recovery at Section 3 (48000-68400)
    // Stuck/timeout recovery
  }

  // MARBLE-ON-MARBLE COLLISIONS (currently O(N^2), N=4)
  private resolveBumps() {
    for (let i = 0; i < this.racers.length - 1; i++)
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i]; const b = this.racers[j];
        if (a.finished || b.finished || a.falling || b.falling
          || a.loopRide || b.loopRide
          || this.runTime < a.immuneUntil || this.runTime < b.immuneUntil) continue;
        const dx = b.x - a.x; const dz = b.z - a.z; const dy = b.y - a.y;
        const diameter = RADIUS * 2 + 4;
        const distance = Math.hypot(dx, dz, dy);
        if (distance >= diameter || Math.abs(dy) > RADIUS * 1.55) continue;

        // Penetration resolution
        const planar = Math.hypot(dx, dz) || 1;
        const nx = dx / planar; const nz = dz / planar;
        const sum = a.weight + b.weight;
        const penetration = (diameter - distance + 1) * 0.55;
        a.x -= nx * penetration * b.weight / sum;
        b.x += nx * penetration * a.weight / sum;
        a.z -= nz * penetration * b.weight / sum;
        b.z += nz * penetration * a.weight / sum;

        // Cooldown check (0.38s between same pair)
        const pair = i * 4 + j;
        if (this.runTime - this.collisionTimes[pair] < 0.38) continue;
        this.collisionTimes[pair] = this.runTime;

        // Shield absorption
        const shieldA = this.absorbShield(a);
        const shieldB = this.absorbShield(b);

        // Impulse-based velocity exchange
        const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (relative < 0) {
          const impulse = -(1.38 * relative) / (1 / a.weight + 1 / b.weight);
          if (!shieldA) a.vx = clamp(a.vx - impulse * nx / a.weight, 100, a.maximumSpeed);
          if (!shieldB) b.vx = clamp(b.vx + impulse * nx / b.weight, 100, b.maximumSpeed);
        }

        // Lateral shove
        this.shove(a, -side, kick * Math.min(1.65, b.weight / a.weight));
        this.shove(b, side, kick * Math.min(1.65, a.weight / b.weight));

        // Particles, audio, score
        this.emit(x, (a.y + b.y) / 2, z, 10, '#ffe0a0', 140);
      }
  }

  private recover(racer: Racer) {
    racer.x = Math.max(START_X + 440, racer.x - 200);
    // Find safe lane, set grounded, give 390 speed, immunity 1.5s
  }

  private hitObstacle(racer: Racer, obstacle: Obstacle) {
    switch (obstacle.kind) {
      case 'boost': // +400 speed, +1 boost charge
      case 'spring': // -660 vy launch, +1 bounce
      case 'tnt': // Explosion: +300 speed, -450 vy, particles
      case 'sheep': // Launched: +75 speed, -290 vy, flying sheep
      case 'blimp': // Slammed down: +950 vy, -28% speed
      case 'sign': // Hit sign: -48% speed, minor launch
      case 'water_rock': // Deflected: lateral vz kick, -18% speed
      case 'break_bridge': // Break if vx > 450
      case 'pinball_spinner': // Random lateral kick
      case 'cauldron': // Lava boost: +250 speed, -140 vy
      case 'roller_rails': // +90 speed
      case 'waterfall_splash': // Particles only
    }
  }

  private refreshSnapshot() {
    // Update: distance, speed, inLoop, falling, grounded, hopReady, bounces, boosts
    // grade, sector, score, position, lane, raceTime, pickups, shieldSeconds
    // standings (sorted by raceOrder)
  }

  private finish(completed: boolean) {
    this.snapshot.status = 'finished';
    // Build RunRecord with all race stats
    this.onFinish(record);
  }

  destroy() {
    this.destroyed = true;
    this.renderer.destroy(); this.audio.destroy();
  }
}

================================================================================
## SOURCE FILE: src/game/track-layout.ts (FULL - 228 lines)
================================================================================

import type { CourseId } from './types';
import { FINISH, STADIUM_START, SECTION_LIP_START, SECTION_2_START, SECTION_2_END,
  SECTION_3_START, SECTION_3_END, type Obstacle, type ObstacleKind } from './scene';

export function createTrackLayout(course: CourseId): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const add = (kind: ObstacleKind, x: number, width: number, height: number,
    lane: number, laneSpan = 1, extra: Partial<Obstacle> = {}) =>
    obstacles.push({ kind, x, width, height, lane, laneSpan, hit: false, hitAt: -100, hitMask: 0, ...extra });

  // SECTION 1: ALPINE DOWNHILL (x: 0 - 24,000)
  // Starting ramps and boosts for all 4 lanes
  for (let lane = 0; lane < 4; lane++) {
    add('ramp', 510, 190, 76, lane);
    add('boost', 770, 116, 15, lane);
  }
  // Signs and blimps
  addBlimpSign(980, course === 'sheep' ? 'sheep' : course === 'boomtown' ? 'tnt' : 'parts', 320, 545);
  add('sheep', 1160, 62, 59, course === 'sheep' ? 2 : 0);

  // *** FIRST LOOP — THIS IS THE QUALIFYING GATEKEEPER ***
  add('loop', 1370, 375, 322, course === 'boomtown' ? 3 : 2);

  add('spring', 1670, 82, 56, 1);
  // ... repeating obstacle patterns every ~2300px through Section 1

  // SECTION 2: CANYON ZIGZAG (x: 25,600 - 48,000)
  // water_rocks, break_bridges, pinball_spinners, boosts, waterfall_splashes

  // SECTION 3: SUBTERRANEAN MINE (x: 48,000 - 68,400)
  // roller_rails, cave_torches, cauldrons, lava_loops, rock_gates

  // STADIUM and FINISH (x: 68,400+)
  // Final boosts, ramps, finish gantry

  return obstacles.sort((a, b) => a.x - b.x);
}

================================================================================
## SOURCE FILE: src/game/powerups.ts (FULL - 101 lines)
================================================================================

export type PowerupKind = 'fuel' | 'shield' | 'bounce';
export interface AirPickup {
  id: number; kind: PowerupKind;
  x: number; y: number; z: number; lane: number;
  collectedBy: number | null; collectedAt: number;
}
export const POWERUPS = {
  fuel: { name: 'Rocket Fuel', label: '+1 boost', color: '#ffc46f' },
  shield: { name: 'Skyward Shield', label: '1 hit / 6 sec', color: '#8cceff' },
  bounce: { name: 'Air Spring', label: '+1 air bounce', color: '#a7e2ba' },
} as const;
export const SHIELD_DURATION = 6;
export const PICKUP_RADIUS = 23;

export function createAirPickups(course: CourseId, obstacles: Obstacle[]): AirPickup[] {
  // Places pickups: after ramps, after springs, every ~2150px, at stadium entry
  // Avoids placing inside loops
}

export function pickupY(pickup: AirPickup, time: number, reducedMotion: boolean) {
  return pickup.y + (reducedMotion ? 0 : Math.sin(time * 1.9 + pickup.id * 0.7) * 4);
}

export function pickupIntercept(from, to, pickup, y) {
  // Swept sphere intersection test for powerup collection
}

================================================================================
## SOURCE FILE: src/game/renderer-3d.ts (KEY SECTIONS ONLY - full file is 1898 lines)
================================================================================

// RACER MESH CREATION (line 1585-1631):
function createRacerMeshes(scene: THREE.Scene, assets: GameAssets): Racer3DMesh[] {
  const out: Racer3DMesh[] = [];
  const sphereGeo = new THREE.SphereGeometry(RADIUS, 24, 16);  // <-- REPLACE WITH QUAD-SPHERE
  const shadowGeo = new THREE.PlaneGeometry(RADIUS * 2.2, RADIUS * 2.2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const shieldGeo = new THREE.SphereGeometry(RADIUS * 1.35, 16, 12);
  const shieldMat = new THREE.MeshBasicMaterial({ color: 0x44ddff, transparent: true, opacity: 0.45, wireframe: true });
  const colors = [0xff7700, 0x33cc66, 0x3399ff, 0xcc33ff];

  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group();
    let mat: THREE.Material;
    if (assets.raceBalls?.[i]) {
      const canvas = assets.raceBalls[i] as HTMLCanvasElement;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.2 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.3, metalness: 0.2 });
    }
    const sphere = new THREE.Mesh(sphereGeo, mat);
    sphere.castShadow = true;
    group.add(sphere);
    // Shadow plane, shield wireframe...
    scene.add(group);
    out.push({ group, sphere, shadow, shield });
  }
  return out;
}

// RENDER METHOD (line 1789-1848):
render(frame: SceneFrame, intervalMs = 16.67) {
  // 1. Update racers along 3D spline
  for (let i = 0; i < frame.racers.length; i++) {
    const racer = frame.racers[i];
    const mesh = this.racers3D[i];
    const dist = racer.distance ?? clamp((racer.x - 190) / 2, 0, TRACK_DISTANCE);
    const d = this.trackDistFromDistance(dist);
    const sample = this.track.sampleAt(d);
    const lateral = (racer.z / 480) * (sample.halfWidth - RADIUS * 1.2);
    const ramp3DElev = this.get3DRampElevation(d, lateral);
    const altitude = Math.max(engineElev, airborneElev, ramp3DElev);
    const pos = sample.pos.clone()
      .addScaledVector(sample.right, lateral)
      .addScaledVector(sample.up, RADIUS + altitude);
    mesh.group.position.copy(pos);
    mesh.sphere.rotation.x += (racer.vx * dt) / RADIUS;
  }
  // 2. Camera, 3. Texture scrolls, 4. WebGL render
}

// 3D RAMP ELEVATION (line 1854-1890):
private get3DRampElevation(d: number, lateral: number): number {
  const ramps = this.trackBuilder.getPlacedRamps();
  // For each placed ramp prop: calculate track distance, check lateral overlap,
  // compute smooth rise or airborne jump arc elevation
}

================================================================================
## SOURCE FILE: src/game/track-builder-3d.ts (KEY SECTIONS - full file is 2351 lines)
================================================================================

export type PropCategory = 'foliage' | 'trackside' | 'cavern_mine' | 'stadium' | 'decals' | 'goblins';

export interface PropDefinition {
  type: string; name: string; category: PropCategory; url: string;
  defaultWidth: number; defaultHeight: number;
  defaultAltitude?: number; alignBottom?: boolean;
  isRamp?: boolean; isDecal?: boolean; is3DModel?: boolean; isSlingshot?: boolean;
}

export interface PlacedProp {
  id: string; type: string; name: string;
  x: number; y: number; z: number;
  rotY: number; rotZ?: number; rotX?: number;
  quaternion?: [number, number, number, number];
  scale: number; alignToTrack: boolean; trackDist?: number;
  cameraFacing?: boolean; flipX?: boolean; isDecal?: boolean;
  groupId?: string; lit?: boolean;
}

export const PROP_DEFINITIONS: PropDefinition[] = [
  // FOLIAGE: pines, boulders, pastures, mushrooms, ferns (~15 props)
  // TRACKSIDE: slingshot_3d_launcher (is3DModel, isSlingshot), timber_ramp (isRamp),
  //   rock_springboard (isRamp), lanterns, signs, bridges, scaffolds, arches (~30 props)
  // CAVERN_MINE: mine gates, ore carts, TNT kegs, crucibles, etc (~15 props)
  // STADIUM: spectator stands, finish banners (~5 props)
  // DECALS: surface decals (isDecal=true) (~10 props)
  // GOBLINS: character props (~5 props)
];

// KEY METHODS:
// getPlacedRamps(): readonly PlacedProp[] — returns placed ramp props for physics
// saveProps() — JSON to localStorage with backup history
// loadProps() — from localStorage with fallback
// getSelectedProps() — current selection for editing
// toggleAtmosphereLighting(propId, lit) — per-prop lighting toggle

================================================================================
## SOURCE FILE: src/game/courses.ts (KEY SECTIONS)
================================================================================

export interface CourseLighting {
  skyboxUrl: string; fogColor: string; ambientLight: string;
  sunbeamIntensity: number; sunColor: string; trackTint?: string;
}

export interface CourseDefinition {
  id: CourseId; biome: 'forest' | 'canyon' | 'meadow';
  region: string; character: string; description: string; stadium: string;
  profile: readonly (readonly [number, number])[];  // Elevation control points
  sectors: readonly string[];
  palette: { sky, horizon, distant, middle, foreground, dirt, dirtLight, bank, soil, shoulder, chalk, grass, accent, haze };
  lighting: CourseLighting;
}

// Courses: ridge (Copperwood Valley), boomtown (Coppervein Canyon), sheep (Bramble Meadows)

================================================================================
## SOURCE FILE: src/game/renderer.ts (FULL - 49 lines)
================================================================================

// Thin wrapper delegating to Renderer3D
export class RangeRenderer {
  readonly view = new RangeCamera();
  private readonly renderer3d: Renderer3D;
  constructor(canvas, assets, course) { this.renderer3d = new Renderer3D(canvas, assets, course); }
  get trackBuilder() { return this.renderer3d.trackBuilder; }
  get renderer3D() { return this.renderer3d; }
  render(frame, intervalMs) { this.renderer3d.render(frame, intervalMs); }
  destroy() { this.renderer3d.destroy(); }
}

================================================================================
## SOURCE FILE: src/game/session.ts (KEY TYPES)
================================================================================

export type RaceMode = 'quick' | 'tournament';
export type Difficulty = 'rookie' | 'racer' | 'veteran';
export interface RaceSetup { mode: RaceMode; course: CourseId; loadout: Loadout; difficulty: Difficulty; customPhysics: boolean; }
export interface RaceConfig extends RaceSetup { sessionId: string; round: number; totalRounds: number; roster: Loadout[]; }

================================================================================
## SOURCE FILE: src/game/loadouts.ts (KEY TYPES)
================================================================================

export type RiderId = 'rivet' | 'nix' | 'grub' | 'sprocket';
export type CapsuleId = 'iron' | 'springsteel' | 'siege';
export interface Loadout { rider: RiderId; capsule: CapsuleId }
// 4 riders: Rivet (balanced), Nix (agile), Grub (heavy), Sprocket (explosive)
// 3 capsules: Rustbucket (balanced), Springsteel (light/agile), Siegebreaker (heavy)
// loadoutStats(loadout) => { weight, launchSpeed, handling, boostFactor, hopFactor, bumpRecovery, maximumSpeed }

================================================================================
## FIRST LOOP LOCATION (Qualifying Gatekeeper)
================================================================================

From track-layout.ts line 81:
  add('loop', 1370, 375, 322, course === 'boomtown' ? 3 : 2);

This creates the first loop obstacle at:
- x = 1370 (2D coordinate, about 590m from start)
- width = 375, height = 322
- Lane 2 (ridge/sheep) or Lane 3 (boomtown)
- loopGeometry gives: radius = 322 * 0.48 = 154.6, ballRadius = 154.6 - 31 - 9 = 114.6

Loop entry detection (engine.ts line 593-603):
- Triggers when vx > 245 and ball is within loop radius
- Records entry angle, stores entry speed as max(650, racer.vx)
- Exit angle = ceil((entryAngle + TAU*0.65) / TAU) * TAU (about 234 degrees of rotation)
- On exit: vx = min(maximumSpeed, speed * 1.08), vy = slope * vx

================================================================================
## USER PLACED PROPS SAMPLE (track-props-latest.json, 237 props)
================================================================================

{
  "course": "ridge",
  "timestamp": 1790060522733,
  "count": 237,
  "updatedAt": "2026-09-22T07:02:02.733Z",
  "props": [
    {
      "id": "prop_1790020259486_aj8o",
      "type": "prop_52_arch_pillar_stone",
      "name": "Archway Stone Pillar",
      "x": -598, "y": 17847, "z": -511,
      "rotY": -0.0336, "rotX": 0, "rotZ": 0,
      "scale": 0.75, "alignToTrack": true, "trackDist": 2000,
      "cameraFacing": false, "flipX": true, "isDecal": false
    }
    // ... 236 more props
  ]
}

================================================================================
## KEY PHYSICS CONSTANTS REFERENCE
================================================================================

RADIUS = 31                           Ball radius in 2D units
GRAVITY = 2400                        px/s squared
STEP = 1/120                          Physics timestep (120Hz)
START_X = 190, START_Y = 325          Slingshot position
TRACK_DISTANCE = 36,000               Half of TRACK_LENGTH = 72,000
FINISH = START_X + TRACK_LENGTH       = 72,190
LANE_WIDTH = 240, LANE_COUNT = 4
LANE = { near: -480, far: 480 }      Z range for 4 lanes
maximumSpeed                          Varies per loadout (~1200-1600)
launchVelocity = speed/0.16 * (0.45 + power*0.55)
Loop entry requires vx > 245
Collision diameter = RADIUS * 2 + 4 = 66
Collision cooldown per pair = 0.38s
Shield duration = 6s
Recovery immunity = 1.5s

================================================================================
## END OF CONTEXT PATCH
================================================================================
