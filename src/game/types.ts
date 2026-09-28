import type { Loadout } from './loadouts';
import type { Difficulty, RaceMode } from './session';
import type { PowerupKind } from './powerups';

export type GameStatus = 'loading' | 'ready' | 'pushing' | 'flying' | 'paused' | 'finished' | 'checkpoint' | 'countdown';
export type CourseId = 'ridge' | 'boomtown' | 'sheep';
export type GraphicsMode = 'auto' | 'performance' | 'quality';
/**
 * TICKET-07 + M01 · T3: the driver's own view through the cockpit window (`first_person`, the
 * default since the cockpit landed), the tight chase that sits above and slightly back from the
 * ball, or the classic wide broadcast view.
 */
export type CameraMode = 'first_person' | 'follow_ball' | 'fixed' | 'third_person';
/**
 * M01 · T1: how the field leaves the grid. `push` is the goblin shove on the start pad (the
 * default); `sling` keeps the legacy slingshot path reachable for parity runs and for the
 * builder's test drive.
 */
export type StartMode = 'push' | 'sling';

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
  /** P11: place at the first split (the pool's queue by split time); absent before the split. */
  splitPosition?: number;
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
  /**
   * M01 · T1: how the field leaves the grid. Optional so every stored option set and every test
   * option literal written before the push start keeps working; anything other than `'sling'` is
   * read as the push default.
   */
  startMode?: StartMode;
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
  /** T02: how many racers started this round; legacy records default to 4. */
  fieldSize?: number;
  /**
   * T02: present only when `opponents` was reduced for storage under the explicit
   * summary policy (save.ts). A short `opponents` list without this marker is invalid
   * and is rejected — standings are never silently discarded.
   */
  opponentsSummary?: OpponentsSummary;
}

/** Versioned truncation marker for persisted results (see docs/T02_ROSTER_AND_SCALE.md). */
export interface OpponentsSummary {
  /** Summary policy version that produced the truncated list. */
  policy: number;
  /** Full field size the round was raced with. */
  totalField: number;
  /** How many rows were kept (always includes the local player). */
  kept: number;
}

export interface GameSnapshot {
  status: GameStatus;
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
  /**
   * H9: the rider directly ahead of the player: their place, the gap in seconds at the player's
   * speed (or time behind them once they have finished), and whether it is shrinking. Null when
   * nobody is ahead, and during the solo first split.
   */
  gapAhead?: GapAhead | null;
  /**
   * M01 · T2 — the first-loop pool, while it is doing something. Present from the first gate
   * crossing until the last rider is released, then removed (the overlay is driven by it).
   */
  merge?: MergeSnapshot;
}

/** H9: see `GameSnapshot.gapAhead`. */
export interface GapAhead {
  place: number;
  seconds: number;
  name: string;
  trend: 'closing' | 'steady' | 'falling';
}

/** One rider in the pool queue, as the overlay shows them. */
export interface MergeEntryView {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  /** Place in the queue, 1-based for display: 1 is the rider who arrived first. */
  position: number;
  /** Seconds from the start of the run to the gate crossing. */
  entryTime: number;
  ready: boolean;
  released: boolean;
  flags: string[];
}

export interface MergeSnapshot {
  phase: 'open' | 'closed' | 'countdown' | 'releasing';
  entries: MergeEntryView[];
  /** '3' | '2' | '1' | 'GO!' while the countdown runs, else null. */
  countdownLabel: string | null;
  /** True once the player has readied (by key, button or the automatic ready). */
  playerReady: boolean;
  /** Physics ticks the field has spent queued, for the HUD's "held" note. */
  holdTicks: number;
}

export const INITIAL_SNAPSHOT: GameSnapshot = {
  status: 'loading',
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
  merge: undefined,
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
  // M01 · T3: the game is built for the cockpit; the chase and the broadcast views are options.
  cameraMode: 'first_person',
  course: 'ridge',
  graphics: 'auto',
  launchSpeed: 160,
  ballWeight: 120,
  masterVolume: 65,
  menuMotion: true,
  reducedMotion: false,
  highContrast: false,
  // M01 · T1: a normal run starts with the goblin push on the pad, not on the sling.
  startMode: 'push',
};