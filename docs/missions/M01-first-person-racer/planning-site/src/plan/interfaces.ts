import type { FrozenInterface } from './types';

export const INTERFACES: FrozenInterface[] = [
  {
    id: 'IF-START',
    file: 'src/game/sim/start-push.ts',
    ticket: 'T1',
    summary: 'Push start: pure, seeded, tick-driven.',
    code: `export const PUSH_TICKS = 48;            // ticks @120 Hz (0.4 s)
export const PUSH_BASE_VX = 360;         // engine x-units/s
export const PUSH_SPREAD = 0.04;         // total spread width (±2%)
export type StartMode = 'push' | 'sling';

/** Deterministic [0,1) hash; no Math.random. */
export function hash01(seed: number, racerId: number): number;

/** Target down-track speed after the push. Unit: engine x-units/s. */
export function startPushVelocity(pace: number, seed: number, racerId: number): number;

/** vx for push tick k (1..PUSH_TICKS); k outside range → ContractError('push_tick_range'). */
export function pushRampVx(target: number, k: number): number;

/** Mutates only racer.vx/vy/vz/grounded; called from stepRace while status==='pushing'. */
export function applyPushTick(racer: Racer, k: number, target: number): void;`,
  },
  {
    id: 'IF-MERGE',
    file: 'src/game/merge/pool.ts',
    ticket: 'T2',
    summary: 'First-loop merge pool: pure state machine, stepped once per physics tick.',
    code: `export const BOT_READY_BASE_TICKS = 90;
export const BOT_READY_RANK_TICKS = 30;
export const POOL_MAX_WAIT_TICKS = 1200;
export const PLAYER_AUTO_READY_TICKS = 1800;
export const COUNTDOWN_TICKS = 360;
export const RELEASE_GAP_TICKS = 42;
export const RELEASE_RETRY_TICKS = 6;
export const RELEASE_MAX_RETRIES = 8;
export const MERGE_RELEASE_VX = 700;      // engine x-units/s
export const MERGE_GHOST_TAIL_S = 0.75;   // seconds after loop exit

export type MergePhase = 'open' | 'closed' | 'countdown' | 'releasing' | 'done';
export type MergeFlag = 'late' | 'autoReady' | 'forced' | 'delayed';

export interface MergeEntry {
  racerId: number;
  isPlayer: boolean;
  entryTick: number;      // integer physics tick of the gate crossing
  entryTime: number;      // seconds, sub-tick: (tick + crossingFraction) / 120
  crossX: number;         // engine x where the rider is held
  slotZ: number;          // lateral z target: laneZ(rank % 4)
  readyTick: number | null;
  releaseTick: number | null;
  flags: MergeFlag[];
}

export interface MergeOccupancy {
  /** loopRide progress 0..1 of the previously released rider, or 1 once it has exited. */
  previousProgress: number;
}

export type MergeResult<T> = { ok: true; value: T } | { ok: false; reason:
  'not_open' | 'duplicate_entry' | 'unknown_racer' | 'not_held' | 'already_ready' };

export class MergePool {
  constructor(opts: { gateX: number; racerIds: readonly number[]; playerId: number });
  readonly phase: MergePhase;
  readonly entries: readonly MergeEntry[];   // sorted by (entryTime, racerId)
  enter(racerId: number, tick: number, crossingFraction: number, crossX: number): MergeResult<MergeEntry>;
  ready(racerId: number, tick: number): MergeResult<MergeEntry>;
  /** Advance to 'tick'. Returns racerIds released on this tick (0 or 1). */
  step(tick: number, occupancy: MergeOccupancy): readonly number[];
  countdownLabel(tick: number): '3' | '2' | '1' | 'GO!' | null;
  holdTicks(): number;                       // subtracted from raceTime
}

/** Pure ordering used by tests: ascending entryTime, then racerId. */
export function mergeOrder(entries: readonly MergeEntry[]): number[];`,
  },
  {
    id: 'IF-FP',
    file: 'src/game/first-person.ts',
    ticket: 'T3',
    summary: 'Camera composition: world → view numbers, no THREE objects mutated.',
    code: `export const FP_EYE_HEIGHT = 24;      // world units along gyro up
export const FP_EYE_FORWARD = 6;     // world units along gyro forward
export const FP_LOOK_AHEAD = 520;    // spline units (s)
export const FP_FOV = 74;            // degrees, vertical
export const FP_NEAR = 4;
export const FP_FAR = 60000;
export const FP_UP_SMOOTH_RATE = 8;  // 1/s, visual only

export type Vec3 = readonly [number, number, number];   // world space

export interface GyroFrame { forward: Vec3; up: Vec3; right: Vec3 }  // orthonormal, world

export interface FirstPersonInput {
  ballCentre: Vec3;               // world, from placementFromEngine
  gyro: GyroFrame;                // from gyroPose()
  lookPoint: Vec3;                // world: sampleAt(s + FP_LOOK_AHEAD).pos + up·140
  previousUp: Vec3 | null;        // last frame's smoothed up (renderer-held)
  dt: number;                     // render seconds, clamped to [0, 0.1]
  falling: boolean;
}

export interface FirstPersonFrame {
  position: Vec3; forward: Vec3; up: Vec3;
  fov: number; near: number; far: number;
  degenerate: boolean;            // guard engaged this frame
}

export function firstPersonFrame(input: FirstPersonInput): FirstPersonFrame;`,
  },
  {
    id: 'IF-GYRO',
    file: 'src/game/gyro-ball.ts',
    ticket: 'T3',
    summary: 'Gyro ball: sim-owned roll phase plus the pure pose used by the renderer.',
    code: `export const CAP_THETA = 0.62;          // rad, cap angular radius
export const CAP_RADIUS_SCALE = 1.04;
export const AIR_ROLL_DECAY = 0.6;      // 1/s

/** Called inside stepRacer at 120 Hz. Returns new {rollPhase, rollRate}. */
export function advanceRoll(
  state: { rollPhase: number; rollRate: number },
  motion: { vx: number; vz: number; grounded: boolean; inLoop: boolean },
  dt: number,
): { rollPhase: number; rollRate: number };

export type Quat = readonly [number, number, number, number];  // x,y,z,w

export interface GyroPose {
  core: Quat;     // frame basis ∘ rotation(−rollPhase) about frame.right
  gyro: Quat;     // frame basis only: caps + goblin + camera (level)
}

export function gyroPose(rollPhase: number, frame: GyroFrame): GyroPose;

/** Loop: up = normalize(loopCentre − ballCentre). Fall: return lastGrounded. */
export function gyroFrameFor(sample: GyroFrame, loop: { centre: Vec3 } | null,
  ballCentre: Vec3, falling: boolean, lastGrounded: GyroFrame): GyroFrame;`,
  },
  {
    id: 'IF-COCKPIT',
    file: 'src/game/cockpit.ts',
    ticket: 'T4',
    summary: 'Per-frame cockpit channel plus the pure layout, yoke and arm math.',
    code: `export const YOKE_MAX_DEG = 38;
export const VZ_MAX = 650;              // matches the steering clamp (×handling)

export interface CockpitState {         // one reused object, filled by the engine, read by the UI
  steer: number;          // −1..1, + = clockwise (toward lane 3 / −z)
  speedKmh: number;       // hypot(vx,vy)·0.16
  boostCharges: number; bounceCharges: number; shieldSeconds: number;
  gradePct: number; grounded: boolean; inLoop: boolean;
  status: GameStatus; countdownLabel: string | null;
}

export function steerFrom(vz: number, handling: number): number;   // clamp(−vz/(650·h), −1, 1)
export function yokeAngleDeg(steer: number): number;               // steer · 38
export function needleAngle(value: number, min: number, max: number, sweepDeg: number): number;

export interface Rect { x: number; y: number; w: number; h: number }  // CSS px
export interface CockpitLayout {
  aperture: Rect & { radius: number };
  horizonY: number;
  yokeHub: { x: number; y: number }; yokeScale: number;
  shoulderL: { x: number; y: number }; shoulderR: { x: number; y: number };  // y > viewport h
}
export function cockpitLayout(w: number, h: number): CockpitLayout;

export interface ArmPose { x: number; y: number; rotDeg: number; length: number }
export function armPose(layout: CockpitLayout, yokeDeg: number): { left: ArmPose; right: ArmPose };`,
  },
  {
    id: 'IF-FX',
    file: 'src/game/effects/events.ts + src/game/effects/pool.ts',
    ticket: 'T5',
    summary: 'Typed effect events (sim) and a fixed billboard pool (render).',
    code: `export type EffectKind = 'explosion' | 'impact' | 'dust' | 'smoke' | 'sparks';
export const EFFECT_QUEUE = 128;
export const BILLBOARD_POOL = 64;
export const EFFECT_CULL_DISTANCE = 6000;   // world units

export interface EffectEvent {
  seq: number;            // monotonically increasing
  tick: number;           // physics tick emitted
  kind: EffectKind;
  x: number; y: number; z: number;   // ENGINE space (mapped by renderer via placementFromEngine)
  scale: number;          // 0.25..3
  racerId: number | null;
}

export class EffectQueue {                 // sim side, zero allocation after construction
  push(kind: EffectKind, x: number, y: number, z: number, scale: number, racerId: number | null, tick: number): void;
  readSince(cursor: number, out: EffectEvent[]): number;  // returns new cursor
  readonly overflow: number;
}

export interface EffectSpec {
  sheet: string | 'procedural-puff' | 'points';
  frames: number; fps: number; size: number;  // world units
  life: number;           // seconds
  count: number;          // billboards per event
  rise: number;           // world units/s along up
  tint: number;           // 0xRRGGBB
}
export const EFFECT_SPECS: Readonly<Record<EffectKind, EffectSpec>>;

export class BillboardPool {
  constructor(size: number);
  spawn(spec: EffectSpec, t: number): number | null;   // index or null when full (counted)
  update(t: number, reducedMotion: boolean): void;       // frame, opacity, scale
  readonly live: number; readonly dropped: number;
}`,
  },
  {
    id: 'IF-LANES',
    file: 'src/game/lane-network.ts',
    ticket: 'T6',
    summary: 'Lane network: schema, validation, sampling, topology, OOB.',
    code: `export const LANE_NETWORK_VERSION = 1;
export type LaneNodeKind = 'normal' | 'merge' | 'split' | 'oob';

export interface LaneNode {
  id: string;
  x: number;              // ENGINE x (START_X..FINISH)
  z: number;              // ENGINE lateral z, |z| ≤ 443
  kind: LaneNodeKind;
  [key: string]: unknown; // unknown fields survive round trips
}
export interface LanePath {
  id: string; name: string;
  nodeIds: string[];      // ≥ 2, strictly increasing x
  halfWidth: number;      // z-units, 40..240, default 120
  [key: string]: unknown;
}
export interface LaneNetwork {
  version: 1; course: CourseId;
  nodes: LaneNode[]; paths: LanePath[];
}

export type LaneRefusal =
  | { code: 'duplicate_id'; id: string }
  | { code: 'unknown_node'; pathId: string; nodeId: string }
  | { code: 'too_few_nodes'; pathId: string }
  | { code: 'non_monotone'; pathId: string; nodeId: string }
  | { code: 'out_of_corridor'; nodeId: string }
  | { code: 'kind_mismatch'; nodeId: string; expected: LaneNodeKind }
  | { code: 'bad_half_width'; pathId: string };

export function validateLaneNetwork(doc: unknown):
  { ok: true; network: LaneNetwork } | { ok: false; errors: LaneRefusal[] };

export function inferKind(network: LaneNetwork, nodeId: string): LaneNodeKind | 'orphan';
export function sampleLane(net: LaneNetwork, pathId: string, x: number): { z: number; halfWidth: number } | null;
export function corridorAt(net: LaneNetwork, x: number): { zMin: number; zMax: number } | null;
export function adjacentPath(net: LaneNetwork, pathId: string, x: number, dir: -1 | 1): string | null;
export function successorPath(net: LaneNetwork, pathId: string, z: number, bias: -1 | 0 | 1): string | null;
export function oobCrossed(net: LaneNetwork, pathId: string, prevX: number, x: number): string | null;

/** THE integration point (D12). network null ⇒ bit-identical legacy behaviour. */
export function resolveLaneTarget(
  racer: { targetLane: number; pathId: string | null; x: number },
  network: LaneNetwork | null,
): { targetZ: number; zMin: number; zMax: number };`,
  },
  {
    id: 'IF-LANESTORE',
    file: 'src/game/lane-storage.ts',
    ticket: 'T6',
    summary: 'Versioned storage, mirroring track-storage.ts.',
    code: `export const LANE_STORAGE_VERSION = 1;
export const LANE_STORAGE_KEY = 'hm2-lane-paths-v1';
export const LANE_BACKUP_KEY = 'hm2-lane-paths-v1-backup';

export interface LaneStorageDocument {
  version: 1; savedAt: string;
  networks: Partial<Record<CourseId, LaneNetwork>>;
}
export type LaneWriteResult =
  | { ok: true } | { ok: false; reason: 'invalid'; errors: LaneRefusal[] }
  | { ok: false; reason: 'quotaExceeded' };

export function readLaneStorage(store: Storage): LaneStorageDocument | null;
export function writeLaneStorage(store: Storage, doc: LaneStorageDocument): LaneWriteResult; // backup first
export function restoreLaneBackup(store: Storage): LaneStorageDocument | null;
export function exportLaneNetworks(doc: LaneStorageDocument): string;
export function importLaneNetworks(json: string): { ok: true; doc: LaneStorageDocument } | { ok: false; errors: LaneRefusal[] };`,
  },
  {
    id: 'IF-BUILDER',
    file: 'src/game/lane-path-tool.ts (owned by TrackBuilder3D)',
    ticket: 'T7',
    summary: 'Builder lane tool: pure edit commands and a thin THREE gizmo layer.',
    code: `export type LaneEdit =
  | { op: 'addPath'; at: { x: number; z: number }[] }
  | { op: 'moveNode'; nodeId: string; x: number; z: number }
  | { op: 'insertNode'; pathId: string; x: number; z: number }
  | { op: 'deleteNode'; nodeId: string }
  | { op: 'setKind'; nodeId: string; kind: LaneNodeKind }
  | { op: 'split'; nodeId: string; to: { x: number; z: number } }
  | { op: 'merge'; fromPathId: string; intoNodeId: string }
  | { op: 'markOob'; pathId: string };

/** Pure: never mutates input; illegal edits refused with a reason. */
export function applyLaneEdit(net: LaneNetwork, edit: LaneEdit):
  { ok: true; network: LaneNetwork } | { ok: false; reason: string };

export const SNAP_Z_LANES = [360, 120, -120, -360];  // snap radius 30 z-units
export const SNAP_X_GRID = 50;                        // engine x-units
export function snapNode(x: number, z: number, opts: { lanes: boolean; grid: boolean }): { x: number; z: number };

// TrackBuilder3D additions
//   laneTool: { active: boolean; selectedNodeId: string | null }
//   setLaneToolActive(on), pickLaneNode(clientX, clientY, canvas): string | null
//   dragLaneNode(nodeId, clientX, clientY, canvas), applyLaneEdit(edit) → pushes undo
//   getLaneNetwork(course), onLaneChange(cb)`,
  },
];
