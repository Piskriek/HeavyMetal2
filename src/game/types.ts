import type { Loadout } from './loadouts';
import type { Difficulty, RaceMode } from './session';
import type { PowerupKind } from './powerups';

export type GameStatus = 'loading' | 'ready' | 'flying' | 'paused' | 'finished';
export type CourseId = 'ridge' | 'boomtown' | 'sheep';
export type GraphicsMode = 'auto' | 'performance' | 'quality';
/** TICKET-07: chase the player's ball, or hold the classic broad course view. */
export type CameraMode = 'follow_ball' | 'fixed';

export const RACER_DEFINITIONS = [
  { id: 0, name: 'YOU', color: '#f0a15b', homeLane: 2, weight: 120, pace: 1 },
  { id: 1, name: 'GRUB', color: '#87d7ba', homeLane: 0, weight: 155, pace: 0.99 },
  { id: 2, name: 'NIX', color: '#b7a0e8', homeLane: 1, weight: 85, pace: 1.015 },
  { id: 3, name: 'RIVET', color: '#e4cc77', homeLane: 3, weight: 125, pace: 1.005 },
] as const;

export interface RacerStanding {
  id: number;
  name: string;
  color: string;
  position: number;
  distance: number;
  lane: number;
  finished: boolean;
  recovering: boolean;
  finishTime: number | null;
  loadout?: Loadout;
}

export interface GameOptions {
  sound: boolean;
  screenShake: boolean;
  downrange: boolean;
  parallax: boolean;
  aimAssist: boolean;
  cameraMode: CameraMode;
  course: CourseId;
  graphics: GraphicsMode;
  launchSpeed: number;
  ballWeight: number;
  masterVolume: number;
  menuMotion: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface RunRecord {
  id: string;
  distance: number;
  topSpeed: number;
  score: number;
  sheep: number;
  explosions: number;
  loops: number;
  course: CourseId;
  date: string;
  completed: boolean;
  trackLength?: number;
  weight?: number;
  launchSpeed?: number;
  position?: number;
  bumps?: number;
  raceTime?: number;
  opponents?: RacerStanding[];
  sessionId?: string;
  mode?: RaceMode | 'practice';
  round?: number;
  loadout?: Loadout;
  difficulty?: Difficulty;
  pickups?: number;
  shieldsUsed?: number;
}

/** TICKET-08: the deck surface the player is currently on, shown in the HUD. */
export type SurfaceLabel = 'DIRT' | 'WET TIMBER' | 'MOSSY SLATE' | 'RIVETED STEEL' | 'LAVA SLAG';

export interface GameSnapshot {
  status: GameStatus;
  /** TICKET-08: Section 2 surfaces change the grip, so the HUD names them. */
  surface: SurfaceLabel;
  distance: number;
  speed: number;
  power: number;
  angle: number;
  bounces: number;
  boosts: number;
  inLoop: boolean;
  falling: boolean;
  hopReady: boolean;
  grounded: boolean;
  grade: number;
  sector: string;
  score: number;
  notice: string;
  progress: number;
  position: number;
  lane: number;
  targetLane: number;
  laneLocked: boolean;
  bumps: number;
  raceTime: number;
  racers: RacerStanding[];
  settling: boolean;
  finishWait: number;
  pickups: number;
  shieldSeconds: number;
  lastPickup: PowerupKind | null;
  pickupNoticeUntil: number;
}

export const INITIAL_SNAPSHOT: GameSnapshot = {
  status: 'loading',
  surface: 'DIRT',
  distance: 0,
  speed: 0,
  power: 0.8,
  angle: 36,
  bounces: 3,
  boosts: 2,
  inLoop: false,
  falling: false,
  hopReady: false,
  grounded: false,
  grade: 0,
  sector: 'THE LAUNCH RIDGE',
  score: 0,
  notice: '',
  progress: 0,
  position: 1,
  lane: 2,
  targetLane: 2,
  laneLocked: false,
  bumps: 0,
  raceTime: 0,
  racers: RACER_DEFINITIONS.map((racer, index) => ({ ...racer, position: index + 1, distance: 0, lane: racer.homeLane, finished: false, recovering: false, finishTime: null })),
  settling: false,
  finishWait: 0,
  pickups: 0,
  shieldSeconds: 0,
  lastPickup: null,
  pickupNoticeUntil: 0,
};

export const COURSES: { id: CourseId; name: string; subtitle: string; number: string }[] = [
  { id: 'ridge', name: 'Rustbucket Ridge', subtitle: 'Pine valleys. Flowing dirt. Questionable shortcuts.', number: '01' },
  { id: 'boomtown', name: 'Boomtown Run', subtitle: 'Copper canyons. Steep drops. Extra dynamite.', number: '02' },
  { id: 'sheep', name: 'Woolly Wasteland', subtitle: 'Open pastures. Airborne prizes. Angry locals.', number: '03' },
];

export const DEFAULT_OPTIONS: GameOptions = {
  sound: false,
  screenShake: true,
  downrange: true,
  parallax: true,
  aimAssist: true,
  cameraMode: 'follow_ball',
  course: 'ridge',
  graphics: 'auto',
  launchSpeed: 160,
  ballWeight: 120,
  masterVolume: 65,
  menuMotion: true,
  reducedMotion: false,
  highContrast: false,
};