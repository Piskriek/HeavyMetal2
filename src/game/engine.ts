import type { GameAssets } from './assets';
import { GameAudio } from './audio';
import { RangeRenderer } from './renderer';
import { chaseLerp, clampCameraTarget } from './projection';
import { createRacers, raceOrder, type Racer } from './racers';
import { PLAYER_ID } from './roster';
import { scaledDt, snapTimeScale, type TimeScale } from './time-scale';
import { builderRampObstacles } from './sim/builder-ramps';
import { SPLIT_TIMEOUT_S, simulateSplitTicks } from './sim/split-times';
import { withoutLoopRides } from './sim/decor-loops';
import { ROPE_PAYOUT_S } from './sim/rope';
import { compileRampSurfaces, getTrackSpace } from './track-space';
import {
  BALL_DRAW_RADIUS, FINISH, GROUND, RADIUS, STADIUM_START, START_X,
  TRACK_DISTANCE, closestLane, courseY, courseSlope, sectorAt,
  type Obstacle, type RacerFrame,
} from './scene';
import { INITIAL_SNAPSHOT, type GameOptions, type GameSnapshot, type GameStatus, type RacerStanding, type RunRecord, type StartMode } from './types';
import type { RaceConfig } from './session';
import { createTrackLayout } from './track-layout';
import {
  DEFAULT_SEGMENT_PROVIDER, createQualifyingGate, evaluateCrossing, segmentAtX, segmentForStep,
} from './qualifying/gate';
import {
  QUALIFYING_GATE_ALTITUDE_TOLERANCE, QUALIFYING_GATE_ID, type QualifyingGate,
} from './contracts/qualifying';
import { createAirPickups, layoutPickupsForNetwork, type AirPickup } from './powerups';
import { LANE_Z_LIMIT, adjacentPath, adoptNearestPaths, assignNearestPaths, sampleLane, startNodeOf, type LaneNetwork } from './lane-network';
import { loadLaneNetwork, readLaneStorage, validateLaneDocument, type LaneStorageDocument } from './lane-storage';
// T04: the simulation now lives in `src/game/sim`, shared with isolated qualifying attempts.
// The engine keeps rendering, input, bumps, particles and the HUD; it asks the sim to step.
import { FIXED_STEP } from './contracts/timing';
import { validateCommand, type CommandGate, type CommandVerdict, type GameCommand } from './contracts/commands';
import type { HeatPhase } from './contracts/heat';
import { MERGE_GATE_HALF_WIDTH, MERGE_LINEUP, MERGE_RELEASE_VX, MergePool, releaseOccupancy } from './merge/pool';
import {
  PASSAGE_CENTRE_Z, PASSAGE_GHOST_TAIL_S, insidePassage,
  passageExitX, passageMouthX,
} from './qualifying/passage';
import { LEGACY_RECOVERY, type RacerStepContext, type SimFx } from './sim/context';
import { createSimWorld, type SimWorld } from './sim/world';
import {
  canHop as canHopSim, performBoost as performBoostSim, performBounce as performBounceSim,
  stepRacer as stepRacerSim,
} from './sim/racer-physics';
import { driveCpu, setLane as setLaneSim, type CpuContext } from './sim/cpu-driver';
import { resolvePickups as resolvePickupsSim } from './sim/pickups';
// M01 · T1: the goblin push start. The engine owns the clock and the surface query; the ramp math
// lives in a pure module so a headless test can reproduce the launch without a canvas.
import { DEFAULT_PUSH_SEED, PUSH_TICKS, applyPushTick, pushRampVx, startPushVelocity } from './sim/start-push';
import { fillCockpitState, yokeSteer, type CockpitState } from './cockpit';
import { EffectQueue } from './effects/events';

const STEP = FIXED_STEP;

/**
 * M9: the race's gameplay randomness, a hash of (seed, tick, racer id) in [0, 1). Stable for a given
 * moment and racer, independent of how many other draws happened first.
 */
export function raceRandom01(seed: number, tick: number, racerId: number): number {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((tick | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= Math.imul((racerId | 0) + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** M9: the heat phase a live-race status belongs to, for the T01 command gate. */
export function heatPhaseOf(status: GameStatus): HeatPhase {
  switch (status) {
    case 'ready': return 'staging';
    case 'pushing': case 'checkpoint': case 'countdown': return 'release';
    case 'finished': return 'results';
    default: return 'racing'; // flying, paused
  }
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/**
 * The statuses in which the simulation keeps stepping.
 *
 * The pool's own two are in here on purpose (M01 · T2): while the field is queued the physics still
 * has to run — held riders glide into their slot and released riders ride the ring — and it is
 * `stepRace` that drives the pool's own clock, so a status that stops stepping would stop the merge
 * from ever finishing.
 */
export function statusSimulates(status: GameStatus): boolean {
  return status === 'flying' || status === 'pushing' || status === 'checkpoint' || status === 'countdown';
}

export class GameEngine {
  private readonly renderer: RangeRenderer;
  private readonly audio = new GameAudio();
  private frameId = 0;
  private lastFrame = 0;
  private lastRender = 0;
  private lastNotify = 0;
  private accumulator = 0;
  private needsRender = true;
  private visible = true;
  private destroyed = false;
  private controlsEnabled = true;
  private readonly systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private get reducedMotion() { return this.systemReducedMotion || this.options.reducedMotion; }
  private time = 0;
  /** Slow motion (test drive): simulated seconds per real second. The physics step never changes. */
  private timeScale: TimeScale = 1;
  private runTime = 0;
  private camera = 0;
  private cameraY = 0;
  private drift = 0;
  private shake = 0;
  private topSpeed = 0;
  private noticeUntil = 0;
  private counts = { sheep: 0, explosions: 0, loops: 0, bumps: 0 };
  private racers = createRacers();
  private renderRacers: RacerFrame[] = [];
  private readonly collisionTimes = new Map<number, number>();
  /** True once the player reaches the first split passage; rivals join at the merge gate. */
  private splitReached = false;
  /** Rivals' first-split ticks (headless, computed at reset): how they queue in the pool. */
  private rivalSplits = new Map<number, number | null>();
  /** True once the rivals have been queued behind (or ahead of) the player at the split. */
  private rivalsQueued = false;
  /** Last steering press for the cockpit yoke: direction (−1 left, +1 right) and when (this.time). */
  private steerPress = 0;
  private steerPressAt = -100;
  private obstacles: Obstacle[] = [];
  private pickups: AirPickup[] = [];
  private pickupCount = 0;
  private shieldBlocks = 0;
  private readonly pickupCandidates = new Set<AirPickup>();
  /** Spatial index and surface queries, shared with the headless qualifying attempts. */
  private readonly world: SimWorld;
  private readonly simFx: SimFx;
  private readonly simCtx: RacerStepContext;
  private readonly cpuCtx: CpuContext;
  private snapshot: GameSnapshot = { ...INITIAL_SNAPSHOT, status: 'ready' };
  private lastSnapshot: GameSnapshot | null = null;
  private standingsKey = '';

  /** M01 · T5 — typed effect events for the render runtime. Written by the sim and by the engine. */
  private readonly effects = new EffectQueue();
  /** Physics ticks since the run began. Effects are stamped with it so a replay lines up. */
  private tick = 0;

  /** M01 · T1: push cursor (0 while not pushing) and the per-racer targets for this run. */
  private pushTick = 0;
  private pushTargets: number[] = [];
  /**
   * M01 · T2 — the first-loop merge pool. Built on the first gate crossing, driven from `stepRace`
   * and retired once every rider has been released. The legacy checkpoint (a fixed x at 17000 with a
   * `setInterval` countdown and teleporting release) is gone: the pool replaces it entirely.
   */
  private merge: MergePool | null = null;
  private mergeGate: QualifyingGate | null = null;
  /** The last rider the pool released, for the occupancy check on the next one. */
  private mergeLastReleased: number | null = null;
  /** True once the pool has released everyone: the merge happens once per run, and only once. */
  private mergeDone = false;
  /**
   * M01 · T6 (IF-LANES) — the authored lane network this course runs on, or `null` for the legacy
   * lanes. Loaded once per course from `lane-storage`; the builder's "test drive" can replace it
   * through `setLaneNetwork`. With `null` the physics is bit-identical to the legacy game.
   */
  private laneNetwork: LaneNetwork | null = null;
  /**
   * The status a pause was taken from, so resuming puts the game back where it was. Pausing during
   * the pool has to come back to the pool: a resumed field that jumped straight to `flying` would
   * leave the queued riders held with nothing left to release them.
   */
  private pausedFrom: GameStatus | null = null;

  // Solo test mode: only the player marble
  private soloMode = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    assets: GameAssets,
    private options: GameOptions,
    private readonly onUpdate: (snapshot: GameSnapshot) => void,
    private readonly onFinish: (record: RunRecord) => void,
    private readonly config?: RaceConfig,
  ) {
    this.renderer = new RangeRenderer(canvas, assets, config?.course ?? options.course);
    this.racers = createRacers(config);
    this.renderer.setRacerCount(this.racers.length);
    this.audio.setEnabled(options.sound);
    this.audio.setVolume(options.masterVolume);
    const engine = this;
    this.world = createSimWorld(config?.course ?? options.course);
    this.laneNetwork = loadLaneNetwork(config?.course ?? options.course);
    this.simFx = {
      // The legacy 2D particles, flying sheep and ball trail are not drawn by the 3D renderer: the sim
      // still reports them (the parity recordings read them), and the painted `effect` queue below is
      // what the player sees.
      emit: () => {},
      effect: (kind, x, y, z, scale, racerId) => engine.effects.push(kind, x, y, z, scale, racerId, engine.tick),
      airSheep: () => {},
      say: (text) => engine.say(text),
      audio: (cue) => engine.audio.play(cue),
      // Chaos points never go below zero; the legacy recovery was the only negative delta.
      score: (delta) => { engine.snapshot.score = Math.max(0, engine.snapshot.score + delta); },
      shake: (amount) => { engine.shake = amount; },
      tally: (kind) => { engine.counts[kind]++; },
      refreshHud: () => { engine.refreshSnapshot(); engine.notify(); },
      notifyHud: () => { engine.notify(); },
      setHopReady: (ready) => { engine.snapshot.hopReady = ready; },
      clearTrail: () => {},
      pickupCollected: (kind) => {
        engine.pickupCount++;
        engine.snapshot.lastPickup = kind;
        engine.snapshot.pickupNoticeUntil = engine.runTime + 2.5;
      },
    };
    this.simCtx = {
      world: this.world,
      fx: this.simFx,
      // The race keeps the legacy timed recovery, bit for bit (see sim/context.ts).
      recovery: LEGACY_RECOVERY,
      // M9: seeded, not Math.random: the same seed and the same inputs give the same race.
      random: (racerId = 0) => raceRandom01(engine.pushSeed, engine.tick, racerId),
      get runTime() { return engine.runTime; },
      get wallTime() { return engine.time; },
      // M01 · T6: read live, so the builder's "test drive" can swap the network without rebuilding
      // the context, and so a course with no authored network stays exactly the legacy game.
      get laneNetwork() { return engine.laneNetwork; },
    };
    this.cpuCtx = {
      get step() { return engine.simCtx; },
      get difficulty() { return engine.config?.difficulty ?? 'racer'; },
      get others() { return engine.racers; },
      get paceTargetX() { return engine.player.x; },
      stagger: (racer) => racer.id * 0.023,
    };
    this.reset();
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  private get player() { return this.racers[0]; }
  /**
   * M01 · T1: how the field leaves the grid. The goblin push is the only start (M5 retired the
   * slingshot); the frozen parity and qualifying sims keep their own copies of the old one.
   */
  get startMode(): StartMode { return 'push'; }
  private get pushSeed(): number { return this.config?.seed ?? DEFAULT_PUSH_SEED; }
  private y(x: number) { return courseY(x, this.options.course); }
  private slope(x: number) { return courseSlope(x, this.options.course); }
  private get customPhysics() { return !this.config || this.config.customPhysics; }
  get status(): GameStatus { return this.snapshot.status; }
  get inputEnabled() { return this.controlsEnabled; }
  set inputEnabled(value: boolean) { this.controlsEnabled = value; this.lastFrame = 0; this.invalidate(); }
  get view() { return this.renderer.view; }
  get trackRenderer() { return this.renderer; }
  get trackBuilder() { return this.renderer.trackBuilder; }
  getTrackY(x: number) { return this.y(x); }
  get trackObstacles(): Obstacle[] { return this.obstacles; }
  private pausedForBuild = false;
  get isBuildPaused() { return this.pausedForBuild; }
  /** Slow motion for the test drive: one of TIME_SCALES (anything else snaps to the nearest). */
  setTimeScale(scale: number) { this.timeScale = snapTimeScale(scale); }
  getTimeScale(): TimeScale { return this.timeScale; }

  /** Switch camera live (cockpit / chase / fixed) without rebuilding the race. */
  setCameraMode(mode: GameOptions['cameraMode']) {
    if (this.options.cameraMode === mode) return;
    this.options = { ...this.options, cameraMode: mode };
    this.invalidate();
  }

  setBuildPaused(paused: boolean) {
    this.pausedForBuild = paused;
    this.accumulator = this.lastFrame = 0;
    this.invalidate();
  }
  setTrackObstacles(newObstacles: Obstacle[]) {
    this.obstacles = newObstacles;
    this.world.configure(this.options.course, this.obstacles, this.pickups);
    this.invalidate();
  }
  requestRender() { this.invalidate(); }

  resize(width: number, height: number) {
    this.renderer.resize(width, height);
    this.renderer.view.configure(this.renderer.view.width, this.camera, this.options.downrange, this.cameraY);
    this.invalidate();
  }

  setOptions(options: GameOptions) {
    const change = !this.config && options.course !== this.options.course;
    const speedChanged = this.customPhysics && options.launchSpeed !== this.options.launchSpeed;
    this.options = this.config ? { ...options, course: this.config.course, launchSpeed: this.customPhysics ? options.launchSpeed : this.player.launchSpeed, ballWeight: this.customPhysics ? options.ballWeight : this.player.weight } : options;
    if (this.customPhysics) { this.player.weight = options.ballWeight; this.player.launchSpeed = options.launchSpeed; }
    this.audio.setEnabled(options.sound);
    this.audio.setVolume(options.masterVolume);
    if (change) this.reset();
    else if (speedChanged && (this.status === 'flying' || this.status === 'paused')) {
      const player = this.player;
      const speed = options.launchSpeed / 0.16;
      if (player.loopRide) player.loopRide.speed = speed;
      if (player.grounded) {
        const slope = this.surfaceAt(player.x, player.z).slope;
        player.vx = speed / Math.sqrt(1 + slope * slope); player.vy = player.vx * slope;
      } else {
        const ratio = speed / Math.max(1, Math.hypot(player.vx, player.vy));
        player.vx *= ratio; player.vy *= ratio;
      }
      if (this.status === 'flying') this.snapshot.speed = options.launchSpeed;
      this.notify();
    }
    this.invalidate();
  }

  reset = () => {
    this.snapshot = { ...INITIAL_SNAPSHOT, status: 'ready' };
    this.pushTick = 0;
    this.pushTargets = [];
    this.tick = 0;
    this.effects.reset();
    this.merge = null;
    this.mergeGate = null;
    this.mergeDone = false;
    this.mergeLastReleased = null;
    this.pausedFrom = null;
    this.splitReached = false;
    this.collisionTimes.clear();
    this.racers = createRacers(this.config);
    this.renderer.setRacerCount(this.racers.length);
    if (this.laneNetwork) this.assignPaths();
    // Solo mode: keep only the player, remove all AI racers
    if (this.soloMode) {
      const player = this.racers.find(r => r.isPlayer) ?? this.racers[0];
      this.racers = [player];
    }
    this.placeOnStartNodes();
    // Everyone begins resting on the pad. Racers are created un-grounded, and the renderer measures an
    // un-grounded ball's height from the old slingshot ground, ~210 units below the pad: without this
    // the whole grid hovered at the start.
    for (const racer of this.racers) { racer.grounded = true; racer.y = this.y(racer.x) - RADIUS; }
    if (this.customPhysics) { this.player.weight = this.options.ballWeight; this.player.launchSpeed = this.options.launchSpeed; }
    else this.options = { ...this.options, course: this.config!.course, launchSpeed: this.player.launchSpeed, ballWeight: this.player.weight };
    this.renderRacers = this.racers.map((racer) => ({ ...racer }));
    this.camera = this.cameraY = this.runTime = 0;
    this.accumulator = this.lastFrame = this.lastRender = 0;
    this.topSpeed = this.shake = 0;
    this.counts = { sheep: 0, explosions: 0, loops: 0, bumps: 0 };
    this.pickupCount = this.shieldBlocks = 0;
    this.snapshot.sector = sectorAt(START_X, this.options.course);
    this.snapshot.notice = 'SOLO FIRST SPLIT — RIVALS JOIN AT MERGE GATE';
    this.canvas.style.cursor = '';
    this.renderer.view.configure(this.renderer.view.width, 0, this.options.downrange, 0);
    this.makeTrack();
    this.rivalsQueued = false;
    this.rivalSplits = this.racers.length > 1
      ? simulateSplitTicks(this.racers.filter((racer) => racer.id !== PLAYER_ID), {
        course: this.options.course, obstacles: this.obstacles, pickups: this.pickups,
        network: this.laneNetwork, gateX: this.mergeGateFor().x, pushSeed: this.pushSeed,
      })
      : new Map();
    this.standingsKey = '';
    this.notify(); this.invalidate();
  };

  /**
   * M01 · T1 — begin the run.
   *
   * Every racer is standing on the pad; the starter goblin shoves the whole field at once and the
   * downhill does the rest.
   */
  start = () => {
    if (this.status !== 'ready') return;
    this.pushTick = 0;
    this.pushTargets = this.racers.map((racer) => startPushVelocity(racer.pace, this.pushSeed, racer.id));
    for (const racer of this.racers) {
      racer.previous = { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation };
      racer.launchOrigin = { x: racer.x, y: racer.y };
    }
    this.effects.push('dust', this.player.x, this.player.y, this.player.z, 1.6, this.player.id, this.tick);
    this.snapshot.status = 'pushing';
    this.snapshot.speed = 0;
    this.snapshot.notice = 'SOLO FIRST SPLIT — RIVALS JOIN AT MERGE GATE';
    this.audio.play('push');
    this.notify(); this.invalidate();
  };

  /**
   * One push tick: the ramp owns vx (and locks vy/vz), and the pad owns the height. No obstacle is
   * scanned here — the pad is empty by construction (`createTrackLayout({ skipBeforeX })`), which is
   * also what keeps the layout fingerprint past the gate byte-identical.
   */
  private stepPush(dt: number) {
    this.runTime += dt;
    this.pushTick += 1;
    // Solo first split: only the player marble starts from the pad
    applyPushTick(this.player, this.pushTick, this.pushTargets[0] ?? 240);
    this.player.x += this.player.vx * dt;
    this.player.y = this.y(this.player.x) - RADIUS;
    this.player.grounded = true;
    this.player.rotation += this.player.vx * dt / RADIUS;
    this.refreshSnapshot();
    if (this.pushTick >= PUSH_TICKS) this.snapshot.status = 'flying';
  }

  /** The next ramp speed for a racer at tick `k` — exposed for the start-zone harness. */
  static pushVelocityAt(target: number, k: number) { return pushRampVx(target, k); }

  /**
   * M01 · T4 — fill the cockpit channel for this frame.
   *
   * One reused object, no allocation: the HUD's rAF loop calls this and writes CSS. Everything is
   * read from the same state the physics stepped — `steer` comes from the player's own `vz`, so the
   * yoke leads the lane change rather than replaying it, and the speed is the HUD's own km/h.
   */
  getCockpitState(state: CockpitState): CockpitState {
    // The mapping itself lives in `cockpit.ts` (pure, and asserted against literals in
    // tests/cockpit-channel.test.ts); this method's only job is to hand it live telemetry — the
    // snapshot the physics just stepped, and the player's own last steering press for the yoke.
    return fillCockpitState(state, this.snapshot, yokeSteer(this.steerPress, this.steerPressAt, this.time));
  }

  changeLane = (direction: number) => {
    const racer = this.player;
    // The yoke answers every press, even one the race refuses (inside the loop, mid-hit).
    if (this.status === 'flying' || this.status === 'pushing') { this.steerPress = Math.sign(direction); this.steerPressAt = this.time; }
    if (this.status !== 'flying' || racer.falling || racer.loopRide || racer.finished || this.runTime < racer.steerLockedUntil) return;
    // A (changeLane(-1)) steps to lane + 1, i.e. toward −z, which is screen-left in both cameras.
    const step = -Math.sign(direction) as -1 | 1;
    // Steering yourself takes up the rope's slack: after a knock you can drive straight back to a lane
    // instead of drifting until the rope reels you in.
    // (Only the slack phase is cut short — the reel-in still plays — so tapping a key can't shrug off a hit.)
    if (racer.ropeSince !== undefined && this.runTime - racer.ropeSince < ROPE_PAYOUT_S) racer.ropeSince = this.runTime - ROPE_PAYOUT_S;
    const network = this.laneNetwork;
    // M01 · T6: on an authored network a lane change is a *path* change, at this x. With no network
    // (or no path) it is the legacy lane change, unchanged.
    if (network && racer.pathId) {
      const next = adjacentPath(network, racer.pathId, racer.x, step);
      if (next) {
        racer.pathId = next;
        const sample = sampleLane(network, next, racer.x);
        if (sample) {
          racer.targetLane = closestLane(sample.z);
          racer.lastLaneChange = this.runTime;
        }
      }
    } else {
      this.setLane(racer, racer.targetLane - Math.sign(direction));
    }
    this.refreshSnapshot(); this.notify();
  };

  private setLane(racer: Racer, lane: number) { setLaneSim(racer, lane, this.runTime); }

  /**
   * M01 · T6 — the authored network this race is running on, or `null` for the legacy lanes.
   * `setLaneNetwork` is the builder's "test drive": the next run (and the current context, which
   * reads it live) uses the network that was just authored.
   */
  get lanePaths(): LaneNetwork | null { return this.laneNetwork; }
  setLaneNetwork(network: LaneNetwork | null) {
    this.laneNetwork = network;
    if (network) {
      this.assignPaths();
      // The pickups follow the road: the builder's "Test drive" hands over a document that may move
      // every lane, so the powerups are re-laid on it here rather than left where the old road was.
      this.pickups = layoutPickupsForNetwork(this.pickups, network);
      this.world.configure(this.options.course, this.obstacles, this.pickups);
    }
  }

  /**
   * Adopts a racer who is not on a path yet. The grid sits at x = 190 and an authored network may
   * begin further down the hill (or a racer may be put back by the crew outside every path's x
   * range), so this runs each tick and costs one scan per *unassigned* racer.
   */
  private adoptPaths() {
    adoptNearestPaths(this.racers, this.laneNetwork);
  }

  /**
   * Before the start, every racer sits on the first node of the path they were given, resting on the
   * road (grid rows keep their spacing behind it). Without this the ball waited at the legacy grid
   * spot, which is off the road — in the air — whenever the authored start node has been moved.
   */
  private placeOnStartNodes() {
    const network = this.laneNetwork;
    if (!network) return;
    for (const racer of this.racers) {
      const node = startNodeOf(network, racer.pathId);
      if (!node) continue;
      racer.x = node.x + (racer.x - START_X);
      racer.z = node.z;
      racer.y = this.y(racer.x) - RADIUS;
      racer.vx = racer.vy = racer.vz = 0;
      racer.previous = { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation };
      racer.launchOrigin = { x: racer.x, y: racer.y };
    }
  }

  /** Puts every racer on the path nearest to them at this moment. */
  private assignPaths() {
    assignNearestPaths(this.racers, this.laneNetwork);
  }

  /** The stored document, for the builder. Never throws: an unreadable store is simply empty. */
  laneDocument(): LaneStorageDocument {
    return readLaneStorage() ?? { version: 1, savedAt: new Date(0).toISOString(), networks: {} };
  }

  /** True when the stored document would validate — the builder's Save button asks this. */
  laneDocumentValid(document_: LaneStorageDocument): boolean {
    return validateLaneDocument(document_).length === 0;
  }

  private canHop(racer: Racer) { return canHopSim(racer, this.runTime); }

  /**
   * Can a pause be taken right now? Racing, and — since M01 · T2 — the first-loop pool as well: a
   * queued player who has to look away should be able to stop the clock without the merge getting
   * ahead of them. The push is deliberately not pausable (it is 0.4 s of the starter goblin's work).
   */
  private get pausable(): boolean {
    const status = this.status;
    return status === 'flying' || status === 'checkpoint' || status === 'countdown';
  }

  jump = () => {};

  /** M9: the T01 gate the player's commands are validated against. */
  commandGate(): CommandGate {
    return { status: this.status, phase: heatPhaseOf(this.status), inputEnabled: this.inputEnabled, racerId: PLAYER_ID, startMode: 'push' };
  }

  /**
   * M9: the one door player input comes through (keyboard, touch, gamepad). The command is checked
   * against the T01 gate first; a refused command changes nothing and comes back with its reason.
   */
  dispatch(command: GameCommand): CommandVerdict {
    const verdict = validateCommand(command, this.commandGate());
    if (!verdict.ok) return verdict;
    switch (command.type) {
      case 'steer': this.changeLane(command.direction); break;
      case 'bounce': this.bounce(); break;
      case 'boost': this.boost(); break;
      case 'start': this.start(); break;
      case 'ready': this.ready(); break;
      case 'toggle-pause': this.togglePause(); break;
      default: break; // the live race has no player-facing handler for the rest
    }
    return verdict;
  }

  bounce = () => {
    // Space on the grid starts the run (the goblin push).
    if (this.status === 'ready') { this.start(); return; }
    if (this.status === 'flying') this.performBounce(this.player);
  };

  private performBounce(racer: Racer) { performBounceSim(racer, this.simCtx); }

  boost = () => { if (this.status === 'flying') this.performBoost(this.player); };

  private performBoost(racer: Racer) { performBoostSim(racer, this.simCtx); }

  togglePause = () => {
    if (this.status === 'paused') {
      this.snapshot.status = this.pausedFrom ?? 'flying';
      this.pausedFrom = null;
    } else if (this.pausable) {
      this.pausedFrom = this.status;
      this.snapshot.status = 'paused';
    }
    this.accumulator = this.lastFrame = 0; this.notify();
  };

  setSoloMode(solo: boolean) {
    this.soloMode = solo;
  }

  get isSoloMode() { return this.soloMode; }

  /**
   * M01 · T2 / T1d — the sorting-loop merge pool (IF-MERGE).
   *
   * The plane is the **mouth of the track's own 360° geometry loop** — the giant loop, with the granite
   * tunnel portal standing at its mouth — not a ring decoration's outer reach (`passageMouthX`). The
   * containment is still the whole corridor: everyone queues, whatever lane they crossed in, or they
   * would bypass the order entirely. The altitude band is the qualifying gate's own, so a rider who
   * leaves the ground short of the mouth is held at the plane (the `hold` snap) rather than flying
   * through the order.
   */
  private mergeGateFor(): QualifyingGate {
    if (!this.mergeGate) {
      const x = passageMouthX();
      // Built from the contract, not from an obstacle: the plane is geometry (T1d), so a document with
      // no rings on it still has a sorting plane. The tolerance is the qualifying gate's own, and the
      // containment is the whole corridor — a rider in the outermost lane queues like everyone else.
      this.mergeGate = {
        id: QUALIFYING_GATE_ID,
        x,
        z: PASSAGE_CENTRE_Z,
        halfWidth: MERGE_GATE_HALF_WIDTH,
        altitude: 0,
        altitudeTolerance: QUALIFYING_GATE_ALTITUDE_TOLERANCE,
        segment: segmentAtX(x),
      };
    }
    return this.mergeGate;
  }

  /** The pool, if it is still doing something. Drives the overlay and the HUD's countdown. */
  get mergePool(): MergePool | null {
    return this.merge && this.merge.phase !== 'done' ? this.merge : null;
  }

  /** True while the first-loop pool owns the race status. */
  get inMerge(): boolean { return this.mergePool !== null; }

  /**
   * The player readies up: Space, Enter or the overlay's READY button. Refused outside the pool and
   * when they have already readied — the pool answers, and the refusal is a no-op, not an error.
   */
  ready = () => {
    const pool = this.merge;
    if (!pool || pool.phase === 'done') return;
    const result = pool.ready(this.player.id, this.tick);
    if (result.ok) {
      this.snapshot.notice = 'READY. WAITING FOR THE REST OF THEM.';
      this.audio.play('pickup');
      this.refreshMergeSnapshot();
      this.notify();
      this.invalidate();
    }
  };

  /** One tick of the pool: crossing detection, holds, the state machine and the ordered release. */
  private stepMerge() {
    if (this.mergeDone) return;
    const gate = this.mergeGateFor();
    const world = this.world;

    // 1. Does anyone cross the gate plane on this tick? The swept validation from gate.ts decides
    //    (forward motion, plane crossing inside the tick, altitude band, segment identity). The pool
    //    itself is built by the first crossing, so a race that never reaches the loop never pays for
    //    a pool it does not use.
    for (const racer of this.racers) {
      if (racer.mergeHeld || racer.finished) continue;
      if (this.merge?.entries.some((entry) => entry.racerId === racer.id)) continue;
      const from = racer.previous;
      if (!(from.x < gate.x && racer.x >= gate.x)) continue;
      const segment = segmentForStep(
        DEFAULT_SEGMENT_PROVIDER,
        { x: from.x, loop: null },
        { x: racer.x, loop: racer.loopRide?.obstacle ?? null },
      );
      const outcome = evaluateCrossing(world, gate, from, racer, segment);
      if (!outcome.ok) continue;
      if (!this.merge) {
        this.merge = new MergePool({
          gateX: gate.x,
          loopZ: gate.z,
          racerIds: this.racers.map((candidate) => candidate.id),
          playerId: this.player.id,
        });
        this.onMergeNotice('SORTING LOOP AHEAD. EVERYONE QUEUES. HOLD YOUR LINE.');
      }
      const entered = this.merge.enter(racer.id, this.tick, outcome.fraction, gate.x);
      if (!entered.ok) continue;
      this.hold(racer, entered.value.slotZ);
      if (racer.id === PLAYER_ID) this.queueRivals(this.merge);
    }

    const pool = this.merge;
    if (!pool) return;
    if (pool.phase === 'done') {
      this.mergeDone = true;
      this.merge = null;
      this.mergeLastReleased = null;
      this.applyMergeStatus();
      this.refreshMergeSnapshot();
      return;
    }

    // 2. The next few riders to go slide over to the loop's lane (held riders are intangible, so they
    //    can line up there together); everyone else waits in their slot. Lining up only the very next
    //    rider made every release wait for a fresh slide across the road.
    const next = pool.next;
    let upcoming = 0;
    for (const entry of pool.entries) {
      if (entry.releaseTick !== null) continue;
      const racer = this.racersById.get(entry.racerId);
      if (!racer) continue;
      racer.mergeSlotZ = upcoming < MERGE_LINEUP ? pool.loopZ : entry.slotZ;
      upcoming += 1;
    }

    // 3. Advance the state machine. The occupancy input is the previous release's own progress.
    const previousRacer = this.mergeLastReleased === null
      ? null
      : this.racers.find((racer) => racer.id === this.mergeLastReleased) ?? null;
    const candidate = next ? this.racers.find((racer) => racer.id === next.racerId) ?? null : null;
    const released = pool.step(this.tick, {
      // Release spacing is a distance behind the rider ahead (MERGE_RELEASE_SPACING), expressed on the
      // pool's own scale where 0.25 means "clear". It used to be a quarter of the whole geometry loop,
      // ~1.45 s per rider: a 100-ball field took minutes to leave the pool.
      previousProgress: previousRacer ? releaseOccupancy(previousRacer.x, gate.x) : 1,
      candidateAligned: candidate !== null
        && Math.abs(candidate.z - pool.loopZ) <= 6
        && Math.abs(candidate.vz) <= 30,
      expected: this.racers.filter((racer) => !racer.finished).length,
    });
    for (const racerId of released) {
      const racer = this.racers.find((candidateRacer) => candidateRacer.id === racerId);
      if (!racer) continue;
      this.release(racer);
      this.mergeLastReleased = racerId;
    }

    // 3b. The barrel carries the field, single file. A released rider inside the 360° geometry loop runs
    //     the tube at exactly the release speed, on the ribbon, with nothing able to stop them: no gaps,
    //     no falls, no recovery, and no closing the gap on the rider ahead. That is what makes the exit
    //     order the entry order by construction rather than by hope — measured without it, a recovery
    //     inside the barrel pulls a rider 198 units back and a later rider passes them. (The riders are
    //     intangible in there too: a barrel is not two dimensions, so two racers at one engine x are not
    //     in contact in the world.) A racer riding one of the course's own rings keeps that ride — the
    //     ring owns its arc and its speed floor — and the carrier takes over when they come off it.
    for (const racer of this.racers) {
      if (!racer.mergeGhost || racer.loopRide !== null || !insidePassage(racer.x)) continue;
      racer.vx = MERGE_RELEASE_VX;
      racer.vy = 0;
      racer.falling = false;
      racer.grounded = true;
      racer.y = this.world.y(racer.x) - RADIUS;
    }

    // 4. The ghost tail: contact racing resumes once a released rider is **clear of the geometry
    //    loop** — there is no ring ride to key on any more, because the sorting plane is the loop's
    //    own mouth (T1d). The cap keeps a rider stopped inside the barrel from staying a ghost for
    //    ever, and the player is excluded from contact while intangible as before.
    for (const racer of this.racers) {
      if (!racer.mergeGhost) continue;
      if (this.runTime < racer.mergeGhostUntil) continue;
      // Ghost until the rider is fully out of the giant loop — never cut short inside it (the old
      // time cap could drop a slow rider back into contact mid-barrel). A rider somehow sent back
      // behind the mouth (a recovery) is not in the barrel either, so the ghost ends there too.
      if (racer.x >= passageExitX() || racer.x < this.mergeGateFor().x - 1) {
        racer.mergeGhost = false;
      }
    }

    this.applyMergeStatus();
    this.refreshMergeSnapshot();
  }

  /**
   * The player has reached the split: every rival joins the pool with the split time their own
   * (headless) run set, so the queue — and the release order — is the field sorted by split time,
   * and the overlay shows every rider's time. Rivals are ready at once; the player's ready starts it.
   */
  private queueRivals(pool: MergePool) {
    if (this.rivalsQueued) return;
    this.rivalsQueued = true;
    const fallback = this.tick + Math.round(SPLIT_TIMEOUT_S * 120);
    for (const racer of this.racers) {
      if (racer.id === PLAYER_ID || racer.finished) continue;
      const split = this.rivalSplits.get(racer.id) ?? fallback + racer.id;
      const tick = Math.floor(split);
      const entered = pool.enter(racer.id, tick, split - tick, pool.gateX);
      if (!entered.ok) continue;
      racer.z = entered.value.slotZ;
      this.hold(racer, entered.value.slotZ, false);
      racer.previous = { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation };
      pool.ready(racer.id, this.tick);
    }
    // Slots are handed out by rank, which only settles once everyone is in.
    for (const entry of pool.entries) {
      const racer = this.racersById.get(entry.racerId);
      if (racer && racer.id !== PLAYER_ID) { racer.mergeSlotZ = entry.slotZ; racer.z = entry.slotZ; racer.previous.z = racer.z; }
    }
  }

  private get racersById(): Map<number, Racer> {
    if (this.racerIndex.size !== this.racers.length || this.racerIndexOf !== this.racers) {
      this.racerIndex = new Map(this.racers.map((racer) => [racer.id, racer]));
      this.racerIndexOf = this.racers;
    }
    return this.racerIndex;
  }
  private racerIndex = new Map<number, Racer>();
  private racerIndexOf: Racer[] | null = null;

  /** Freezes a rider at the gate plane and points them at their pool slot. */
  private hold(racer: Racer, slotZ: number, dust = true) {
    racer.mergeHeld = true;
    racer.mergeGhost = false;
    racer.mergeSlotZ = slotZ;
    racer.x = this.mergeGateFor().x;
    racer.vx = 0; racer.vy = 0; racer.vz = 0;
    racer.falling = false; racer.grounded = true;
    racer.y = this.world.y(racer.x) - RADIUS;
    if (dust) this.effects.push('dust', racer.x, racer.y, racer.z, 1.2, racer.id, this.tick);
  }

  /**
   * Lets a rider go: a common speed for everyone (D9), and intangible into the loop.
   *
   * The lane is pinned to the mouth's own centre — the sorting plane is the mouth of the geometry loop
   * (T1d), and the tunnel portal stands across the corridor there, so a rider released anywhere but the
   * centre would fly the arch. The intangibility runs from here to the loop's exit (`passageExitX`),
   * with a cap: inside a barrel, two racers at the same engine x are not in contact in the world, and
   * the ordering law needs them not to be.
   */
  private release(racer: Racer) {
    racer.mergeHeld = false;
    racer.mergeGhost = true;
    racer.vx = MERGE_RELEASE_VX; racer.vy = 0; racer.vz = 0;
    racer.grounded = false; racer.falling = false;
    racer.steerLockedUntil = -100;
    racer.lastGroundedAt = this.runTime;
    racer.loopExitTime = -100;
    racer.mergeGhostUntil = this.runTime + PASSAGE_GHOST_TAIL_S;
    racer.targetLane = closestLane(PASSAGE_CENTRE_Z);
    this.effects.push('dust', racer.x, racer.y, racer.z, 1.4, racer.id, this.tick);
    if (racer.id === this.player.id) { this.audio.play('boost'); this.say('GO! HOLD THE LINE INTO THE LOOP.'); }
  }

  private onMergeNotice(text: string) {
    this.snapshot.notice = text;
    this.noticeUntil = this.time + 2.4;
    this.audio.play('pickup');
  }

  /** The pool owns the game status while it is doing something: pooled, then counting down. */
  private applyMergeStatus() {
    const pool = this.merge;
    if (!pool) return;
    if (this.snapshot.status === 'paused' || this.snapshot.status === 'finished') return;
    if (pool.phase === 'done') {
      if (this.snapshot.status === 'checkpoint' || this.snapshot.status === 'countdown') this.snapshot.status = 'flying';
      return;
    }
    // Once the player is out of the pool they are racing, even while the rest of the field is still
    // being let go behind them. Holding 'countdown' until the *last* rider left (≈35 s with 100 balls)
    // refused every lane change, boost and bounce for that whole stretch.
    if (pool.phase === 'releasing' && pool.entries.some((entry) => entry.isPlayer && entry.releaseTick !== null)) {
      if (this.snapshot.status === 'checkpoint' || this.snapshot.status === 'countdown') this.snapshot.status = 'flying';
      return;
    }
    this.snapshot.status = pool.phase === 'open' || pool.phase === 'closed' ? 'checkpoint' : 'countdown';
  }

  /** One reused object per frame: the overlay reads this and allocates nothing. */
  private refreshMergeSnapshot() {
    const pool = this.merge;
    if (!pool || pool.phase === 'done') { this.snapshot.merge = undefined; return; }
    const previous = this.snapshot.merge;
    const entries = pool.entries.map((entry) => {
      const racer = this.racers.find((candidate) => candidate.id === entry.racerId);
      return {
        id: entry.racerId,
        name: racer?.name ?? `RACER ${entry.racerId}`,
        color: racer?.color ?? '#ffffff',
        isPlayer: entry.isPlayer,
        position: entry.rank + 1,
        entryTime: Math.round(entry.entryTime * 100) / 100,
        ready: entry.readyTick !== null,
        released: entry.releaseTick !== null,
        // A fresh array: the pool's own entry record stays private to the pool.
        flags: [...entry.flags],
      };
    });
    // Reuse the array and the entry objects when nothing changed, so a steady pool is allocation-free.
    const same = previous !== undefined
      && previous.entries.length === entries.length
      && previous.entries.every((entry, index) => {
        const nextEntry = entries[index];
        return entry.id === nextEntry.id && entry.ready === nextEntry.ready
          && entry.released === nextEntry.released && entry.position === nextEntry.position;
      });
    this.snapshot.merge = {
      phase: pool.phase,
      entries: same ? previous!.entries : entries,
      countdownLabel: pool.countdownLabel(this.tick),
      playerReady: pool.entries.some((entry) => entry.isPlayer && entry.readyTick !== null),
      holdTicks: pool.holdTicks(),
    };
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) {
      if (this.pausable) this.togglePause();
      cancelAnimationFrame(this.frameId); this.frameId = 0;
    } else { this.lastFrame = 0; this.invalidate(); }
  }
  private schedule() { if (!this.destroyed && !this.frameId && this.visible && !document.hidden) this.frameId = requestAnimationFrame(this.frame); }
  private invalidate() { this.needsRender = true; this.schedule(); }
  private visibilityChanged = () => {
    this.lastFrame = this.lastRender = this.accumulator = 0;
    if (document.hidden) {
      if (this.pausable) this.togglePause();
      cancelAnimationFrame(this.frameId); this.frameId = 0;
    } else this.invalidate();
  };

  private makeTrack() {
    // M01 · T1: in push mode the start pad and the whole run-up to the first loop are empty. The
    // filter only removes a prefix — the layout itself has no RNG — so every obstacle from the
    // gate on keeps its exact identity (asserted by tests/start-zone.test.ts).
    const built = createTrackLayout(this.options.course);
    // The push run-up runs from the start zone's own boundary to the **mouth of the geometry loop**
    // (T1d), with the descent's rings kept and the jump line under the plane removed (T1c — see
    // `TrackLayoutOptions.keepLoopsFromX`).
    const startZoneEndX = createQualifyingGate(this.options.course, built).x;
    this.obstacles = createTrackLayout(this.options.course, {
      skipBeforeX: passageMouthX(),
      keepLoopsFromX: startZoneEndX,
    });
    // M01 · T6/T7: with an authored network the pickups are laid out on *it*, not on the legacy four
    // lanes — otherwise a pickup can hang beside the drivable road where nobody can reach it.
    this.pickups = layoutPickupsForNetwork(
      createAirPickups(this.options.course, this.obstacles),
      this.laneNetwork,
    );
    // Builder-placed ramps are physics too: without this the renderer lifted the ball up the ramp
    // and dropped it back on the road at the crest, which read as the run being reset.
    const placed = this.builderRamps();
    if (placed.length) this.obstacles = [...this.obstacles, ...placed].sort((a, b) => a.x - b.x);
    // The course's loops are decorations: the ball rolls past them. Riding their rings grabbed the
    // ball on the opening descent (the hang-up at the start) and, on ridge, inside the giant loop
    // (the stop-and-hop). The pickups were laid out above with the loops in place, so they are unchanged.
    this.obstacles = withoutLoopRides(this.obstacles);
    this.world.configure(this.options.course, this.obstacles, this.pickups);
  }

  /** The builder's placed ramp props as engine ramp obstacles (none when no builder is attached). */
  private builderRamps() {
    const builder = this.renderer?.trackBuilder;
    if (!builder || typeof builder.getPlacedRamps !== 'function') return [];
    const map = getTrackSpace();
    const ramps = builder.getPlacedRamps();
    if (!ramps.length) return [];
    const compiled = compileRampSurfaces(map, ramps.map((r) => ({ id: r.id, x: r.x, y: r.y, z: r.z, rotY: r.rotY, scale: r.scale, trackDist: r.trackDist })));
    return builderRampObstacles(map, compiled.surfaces);
  }

  private surfaceAt(x: number, z: number) { return this.world.surfaceAt(x, z); }

  private frame = (now: number) => {
    this.frameId = 0;
    if (this.destroyed || !this.visible || document.hidden) return;
    const realDt = Math.min(this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60, 0.1);
    this.lastFrame = now;
    // Everything the race does (physics, particles, the notice timer, shake decay) runs on game time,
    // so slow motion slows all of it together. Rendering still happens every real frame.
    const dt = scaledDt(realDt, this.timeScale);
    if (this.status !== 'paused' && this.inputEnabled) {
      this.time += dt; this.shake *= Math.exp(-9 * dt);
      const simulating = statusSimulates(this.status);
      if (simulating && !this.pausedForBuild) {
        this.accumulator = Math.min(0.1, this.accumulator + dt);
        while (this.accumulator >= STEP && statusSimulates(this.status) && !this.pausedForBuild) {
          for (const racer of this.racers) {
            racer.previous.x = racer.x; racer.previous.y = racer.y;
            racer.previous.z = racer.z; racer.previous.rotation = racer.rotation;
          }
          this.tick += 1;
          if (this.status === 'pushing') this.stepPush(STEP); else this.stepRace(STEP);
          this.accumulator -= STEP;
        }
      }
      if (this.time > this.noticeUntil) this.snapshot.notice = '';
    }
    const alpha = statusSimulates(this.status) ? clamp(this.accumulator / STEP, 0, 1) : 1;
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i]; const rendered = this.renderRacers[i];
      // A rival waiting for the player's solo first split is simply not drawn (it used to be parked
      // at x = −999999, which the 3D placement clamps to the start line, high in the sky).
      rendered.hidden = !this.splitReached && racer.id !== PLAYER_ID;
      if (rendered.hidden) continue;
      rendered.x = racer.previous.x + (racer.x - racer.previous.x) * alpha;
      rendered.y = racer.previous.y + (racer.y - racer.previous.y) * alpha;
      rendered.z = racer.previous.z + (racer.z - racer.previous.z) * alpha;
      rendered.rotation = racer.previous.rotation + (racer.rotation - racer.previous.rotation) * alpha;
      // M01 · T3 (IF-GYRO): the roll phase is sampled, not interpolated — a shell that snaps to a
      // slightly stale phase is invisible, while interpolating it would need a second wrapped field.
      rendered.rollPhase = racer.rollPhase;
      rendered.vx = racer.vx; rendered.vy = racer.vy; rendered.vz = racer.vz; rendered.lane = racer.targetLane;
      rendered.falling = racer.falling; rendered.grounded = racer.grounded; rendered.distance = racer.distance;
      rendered.finished = racer.finished; rendered.bumpAt = racer.bumpAt;
      rendered.immuneUntil = racer.immuneUntil; rendered.launchOrigin = racer.launchOrigin;
      rendered.shieldUntil = racer.shieldUntil; rendered.shieldHitAt = racer.shieldHitAt; rendered.pickupAt = racer.pickupAt;
      rendered.ramTellUntil = racer.ramTellUntil;
    }
    const player = this.player; const rendered = this.renderRacers[0];
    // M01 · T1: the shove moves the whole field, so the legacy camera state tracks it too — the ball
    // is already sliding down the descent by the time the push hands over to 'flying'.
    if (statusSimulates(this.status) && this.inputEnabled && !this.pausedForBuild) {
      const focus = player.loopRide?.obstacle.x ?? rendered.x;
      const view = this.renderer.view;
      // TICKET-07 ball-chase camera: a tight exponential follow (lerp(camX, ballX, dt * 6))
      // keeps the ball framed; the fixed course camera pans slower with a longer look-ahead
      // for the classic broad overview, letting the ball wander (the edge pointer covers it).
      const follow = this.options.cameraMode === 'follow_ball';
      const target = clampCameraTarget(view.followOffset(focus + (follow ? 0 : view.width * 0.06), rendered.z));
      this.camera = chaseLerp(this.camera, target, follow ? 6 : 2.4, dt);
      // Camera Y tracks the terrain, and in follow mode pans up softly on big air so the
      // ball stays framed through hops, springs, and catapult launches.
      const altitude = Math.max(0, this.y(rendered.x) - RADIUS - rendered.y);
      const airPan = follow ? clamp(altitude - 96, 0, 320) * 0.34 : 0;
      this.cameraY = chaseLerp(this.cameraY, this.y(focus + player.vx * 0.09) - GROUND - airPan, follow ? 10 : 7, dt);
    }
    const active = (statusSimulates(this.status) && !this.pausedForBuild) ;
    const due = active || this.needsRender || !this.lastRender || now - this.lastRender >= 1000 / 30 - 0.5;
    if (due && (this.status !== 'paused' || this.needsRender)) {
      const interval = this.lastRender ? now - this.lastRender : 16.67;
      this.lastRender = now; this.needsRender = false;
      this.renderer.render({ time: this.time, runTime: this.runTime, camera: this.camera, cameraY: this.cameraY,
        drift: this.drift, shake: this.shake, rotation: rendered.rotation, dragging: false,
        launchOrigin: player.launchOrigin, ball: rendered, racers: this.renderRacers, loopRide: player.loopRide,
        obstacles: this.obstacles, pickups: this.pickups,
        snapshot: this.snapshot, options: this.options, reducedMotion: this.reducedMotion,
        effects: this.effects, laneNetwork: this.laneNetwork }, interval);
    }
    if (now - this.lastNotify > 100) this.notify(false);
    const ambient = this.status === 'ready' && !this.reducedMotion;
    // While the pool holds the field the overlay is DOM, but the riders are still moving behind it,
    // so the loop keeps its own frames coming rather than waiting for a redraw request.
    const poolActive = this.status === 'checkpoint' || this.status === 'countdown';
    if (this.needsRender || poolActive || this.inputEnabled && this.status !== 'paused' && (active || ambient || this.pausedForBuild)) this.schedule();
  };

  private stepRace(dt: number) {
    // M01 · T2: while the first-loop pool is filling or counting down, the race clock is stopped for
    // the whole field — nobody is racing, so nobody's timers should run. Released riders race again
    // as soon as the pool reaches the release phase.
    const pool = this.merge;
    const clockStopped = pool !== null && pool.phase !== 'done' && pool.phase !== 'releasing';
    if (!clockStopped) this.runTime += dt;

    if (!this.splitReached && this.player.x >= passageMouthX()) {
      this.splitReached = true;
      this.say('FIRST SPLIT COMPLETE! RIVALS JOIN THE RUN!');
    }

    this.adoptPaths();
    for (const racer of this.racers) {
      if (racer.finished) continue;
      // Solo first split: the rivals are not on the course yet. Their own split was run headlessly at
      // reset; they join the pool, in split-time order, the moment the player reaches it.
      if (!this.splitReached && racer.id !== PLAYER_ID) continue;
      // A held rider is out of the race: no CPU decisions, and the physics only glides their slot.
      if (racer.mergeHeld) { stepRacerSim(racer, this.simCtx, dt); continue; }
      // A race lets the CPU see the whole field and rubber-band against the player; an isolated
      // qualifying attempt passes neither (see sim/cpu-driver.ts).
      if (racer.id && this.runTime >= racer.nextDecision) driveCpu(racer, this.cpuCtx);
      stepRacerSim(racer, this.simCtx, dt);
    }
    this.stepMerge();
    this.resolveBumps();
    resolvePickupsSim(this.racers, this.simCtx, { reducedMotion: this.reducedMotion, candidates: this.pickupCandidates });
    this.refreshSnapshot();
    if (this.player.finished) {
      this.snapshot.settling = true;
      this.snapshot.finishWait = Math.max(0, Math.ceil(10 - (this.runTime - this.player.finishTime!)));
      if (this.racers.every((racer) => racer.finished) || this.snapshot.finishWait === 0) this.finish(true);
    }
    else if (this.runTime > 300) this.finish(false);
  }

  private resolveBumps() {
    for (let i = 0; i < this.racers.length - 1; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i]; const b = this.racers[j];
      // M01 · T2: a held rider is not in the race yet and a ghost has just left the loop — neither
      // can be touched, which is what keeps the ordered release from being spoiled by contact.
      if (a.finished || b.finished || a.falling || b.falling || a.loopRide || b.loopRide
        || a.mergeHeld || b.mergeHeld || a.mergeGhost || b.mergeGhost
        // Nobody touches anybody inside the giant loop, pooled or not.
        || insidePassage(a.x) || insidePassage(b.x)
        || (!this.splitReached && (a.id !== PLAYER_ID || b.id !== PLAYER_ID))
        || this.runTime < a.immuneUntil || this.runTime < b.immuneUntil) continue;
      // Balls touch at the size they are drawn (BALL_DRAW_RADIUS = 2 × the road-physics RADIUS).
      // Cheap rejects first: with 100 balls the all-pairs Math.hypot cost ~0.45 ms a tick; squared
      // distances behind an x test make the same check ~20× cheaper with identical results.
      const diameter = BALL_DRAW_RADIUS * 2 + 4;
      const dx = b.x - a.x;
      if (dx >= diameter || dx <= -diameter) continue;
      const dz = b.z - a.z; const dy = b.y - a.y;
      const distanceSq = dx * dx + dz * dz + dy * dy;
      if (distanceSq >= diameter * diameter || Math.abs(dy) > BALL_DRAW_RADIUS * 1.55) continue;
      const distance = Math.sqrt(distanceSq);
      const planar = Math.hypot(dx, dz) || 1;
      const nx = dx / planar; const nz = dz / planar;
      const sum = a.weight + b.weight;
      const penetration = (diameter - distance + 1) * 0.55;
      a.x -= nx * penetration * b.weight / sum; b.x += nx * penetration * a.weight / sum;
      a.z -= nz * penetration * b.weight / sum; b.z += nz * penetration * a.weight / sum;
      a.z = clamp(a.z, -LANE_Z_LIMIT, LANE_Z_LIMIT);
      b.z = clamp(b.z, -LANE_Z_LIMIT, LANE_Z_LIMIT);
      const pair = (i << 10) | j;
      const lastCollision = this.collisionTimes.get(pair) ?? -100;
      if (this.runTime - lastCollision < 0.38) continue;
      this.collisionTimes.set(pair, this.runTime);
      const shieldA = this.absorbShield(a);
      const shieldB = this.absorbShield(b);
      const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (relative < 0) {
        const impulse = -(0.8 * relative) / (1 / a.weight + 1 / b.weight);
        if (!shieldA) a.vx = clamp(a.vx - impulse * nx * 0.25 / a.weight, a.vx * 0.92, a.maximumSpeed);
        if (!shieldB) b.vx = clamp(b.vx + impulse * nx * 0.25 / b.weight, b.vx * 0.92, b.maximumSpeed);
      }
      // A rear-end hit also has a sideways component: heavy capsules shove the
      // lighter target toward an adjacent lane, rather than stacking in place.
      let side = Math.abs(dz) > 8 ? Math.sign(dz) : (closestLane(b.z) === 0 ? -1 : closestLane(b.z) === 3 ? 1 : ((i + j) % 2 ? 1 : -1));
      if (!side) side = 1;
      const closing = Math.min(380, Math.abs(a.vx - b.vx) + Math.abs(a.vz - b.vz));
      const kick = 220 + closing * 0.18;
      
      // Heavy impacts cause more dramatic lane changes
      const isHeavyImpact = closing > 200 || Math.abs(a.vx - b.vx) > 150;
      const kickMultiplier = isHeavyImpact ? 2.0 : 1;
      
      if (!shieldA) {
        this.shove(a, -side, kick * kickMultiplier * Math.min(1.5, b.weight / a.weight));
        a.rollRate += (side > 0 ? -1 : 1) * 16;
      }
      if (!shieldB) {
        this.shove(b, side, kick * kickMultiplier * Math.min(1.5, a.weight / b.weight));
        b.rollRate += (side > 0 ? 1 : -1) * 16;
      }
      
      const x = (a.x + b.x) / 2; const z = (a.z + b.z) / 2;
      const y = (a.y + b.y) / 2;
      
      // M01 · T5: every collision is an impact; a heavy one also throws sparks and smoke.
      this.effects.push('impact', x, y, z, isHeavyImpact ? 1.4 : 0.8, a.id ? a.id : b.id, this.tick);
      this.effects.push('sparks', x, y, z, isHeavyImpact ? 1.2 : 0.6, a.id ? a.id : b.id, this.tick);
      if (isHeavyImpact) this.effects.push('smoke', x, y, z, 0.8, a.id ? a.id : b.id, this.tick);
      
      if (isHeavyImpact) {
        // Screen shake and audio for heavy impacts
        if (!a.id || !b.id) { // Only if player is involved
          this.shake = Math.min(15, closing * 0.05);
          this.audio.play('bump');
        }
      }
      if (!a.id || !b.id) {
        if ((!a.id && shieldA) || (!b.id && shieldB)) { this.audio.play('shield'); this.say('SKYWARD SHIELD ABSORBED THE SHOVE.'); }
        else if ((!a.id && shieldB) || (!b.id && shieldA)) {
          this.audio.play('shield'); this.shake = 2;
          this.say(`${a.id ? a.name : b.name}'S SHIELD HELD. FIND ANOTHER LINE.`);
        }
        else {
          this.counts.bumps++; this.snapshot.score += 50; this.shake = 4;
          this.audio.play('bump'); this.say(`MAKE ROOM! ${a.id ? a.name : b.name} GOT A NUDGE.`);
        }
      }
    }
  }

  private shove(racer: Racer, direction: number, speed: number) {
    // A hit shoots the ball's lane rope out (sim/rope.ts): it keeps its own lane/path — a bump never
    // re-assigns it to the neighbouring one — takes the sideways speed, may be knocked as far as the
    // road edge, and is then reeled back in.
    racer.vz = clamp(racer.vz + direction * speed, -650, 650);
    racer.z = clamp(racer.z + direction * 5, -LANE_Z_LIMIT, LANE_Z_LIMIT);
    racer.ropeSince = this.runTime;
    racer.steerLockedUntil = this.runTime + 0.28 * racer.bumpRecovery; racer.bumpAt = this.runTime;
    racer.lastLaneChange = this.runTime;
  }

  private absorbShield(racer: Racer) {
    if (racer.shieldUntil <= this.runTime) return false;
    racer.shieldUntil = -100;
    racer.shieldHitAt = this.runTime;
    racer.immuneUntil = Math.max(racer.immuneUntil, this.runTime + 0.3);
    // Painted sibling: the shield holding is a *hit that did not land*, which is the impact read.
    this.effects.push('impact', racer.x, racer.y, racer.z, 0.7, racer.id, this.tick);
    if (!racer.id) this.shieldBlocks++;
    return true;
  }

  private refreshSnapshot() {
    const player = this.player;
    this.snapshot.distance = Math.round(player.distance); this.snapshot.progress = player.distance / TRACK_DISTANCE;
    this.snapshot.speed = player.finished ? 0 : Math.round((player.loopRide ? Math.min(760, player.loopRide.speed) : Math.hypot(player.vx, player.vy)) * 0.16);
    this.snapshot.inLoop = !!player.loopRide; this.snapshot.falling = player.falling;
    this.snapshot.grounded = player.grounded; this.snapshot.hopReady = this.canHop(player);
    this.snapshot.bounces = player.bounces; this.snapshot.boosts = player.boosts;
    this.snapshot.grade = Math.round(this.slope(player.x) * 100);
    this.snapshot.lane = closestLane(player.z); this.snapshot.targetLane = player.targetLane;
    this.snapshot.laneLocked = this.runTime < player.steerLockedUntil;
    this.snapshot.bumps = this.counts.bumps; this.snapshot.raceTime = Math.floor(this.runTime * 10) / 10;
    let position = 1;
    for (const racer of this.racers) if (racer.id && raceOrder(racer, player) < 0) position++;
    this.snapshot.position = position;
    const sector = sectorAt(START_X + player.distance * 2, this.options.course);
    if (sector !== this.snapshot.sector && player.x >= STADIUM_START) { this.say('FINAL STRAIGHT. NO MORE MANNERS.'); this.audio.play('finish'); }
    this.snapshot.sector = sector; this.topSpeed = Math.max(this.topSpeed, this.snapshot.speed);
    this.snapshot.pickups = this.pickupCount;
    this.snapshot.shieldSeconds = Math.max(0, Math.ceil((player.shieldUntil - this.runTime) * 10) / 10);
  }

  private standings(): RacerStanding[] {
    return [...this.racers].sort(raceOrder).map((racer, index) => ({
      id: racer.id, name: racer.name, color: racer.color, position: index + 1,
      distance: Math.round(clamp((racer.x - START_X) / 2, 0, TRACK_DISTANCE)), lane: closestLane(racer.z),
      finished: racer.finished, recovering: racer.falling || this.runTime < racer.recoveryUntil, finishTime: racer.finishTime,
      loadout: { ...racer.loadout },
    }));
  }

  private finish(completed: boolean) {
    if (this.status !== 'flying') return;
    this.snapshot.status = 'finished'; this.snapshot.speed = 0; this.snapshot.hopReady = false;
    this.snapshot.settling = false; this.snapshot.finishWait = 0;
    if (completed) {
      this.snapshot.distance = TRACK_DISTANCE; this.snapshot.progress = 1;
      this.snapshot.score += 3000 + (4 - this.snapshot.position) * 500;
      // The finish burst is the one moment of a run that must never be invisible: an explosion-sized
      // painted burst over the flag, with smoke under it.
      this.effects.push('explosion', this.player.x, this.y(FINISH) - 140, this.player.z, 2.2, this.player.id, this.tick);
      this.effects.push('smoke', this.player.x, this.y(FINISH) - 140, this.player.z, 1.4, this.player.id, this.tick);
    }
    this.audio.play('finish');
    const { sheep, explosions, loops, bumps } = this.counts;
    this.onFinish({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, distance: this.snapshot.distance, topSpeed: this.topSpeed,
      score: this.snapshot.score + this.snapshot.distance, sheep, explosions, loops, bumps,
      course: this.options.course, date: new Date().toISOString(), completed, trackLength: TRACK_DISTANCE,
      weight: this.options.ballWeight, launchSpeed: this.options.launchSpeed, position: this.snapshot.position,
      raceTime: this.player.finishTime ?? this.runTime, opponents: this.standings(),
      sessionId: this.config?.sessionId, mode: this.config?.customPhysics ? 'practice' : this.config?.mode,
      round: this.config?.round, loadout: this.config?.loadout, difficulty: this.config?.difficulty,
      pickups: this.pickupCount, shieldsUsed: this.shieldBlocks });
    this.notify();
  }

  private say(text: string) { this.snapshot.notice = text; this.noticeUntil = this.time + 2; }
  private notify(force = true) {
    const now = performance.now();
    if (!force && now - this.lastNotify < 100) { this.invalidate(); return; }
    const standings = this.standings();
    const key = standings.map((r) => `${r.id}:${r.distance}:${r.lane}:${r.finished}:${r.recovering}`).join('|');
    if (key !== this.standingsKey) { this.snapshot.racers = standings; this.standingsKey = key; }
    const keys = Object.keys(this.snapshot) as (keyof GameSnapshot)[];
    if (this.lastSnapshot && keys.every((key) => this.snapshot[key] === this.lastSnapshot?.[key])) return;
    this.lastNotify = now; this.lastSnapshot = { ...this.snapshot }; this.onUpdate({ ...this.snapshot }); this.invalidate();
  }
  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.frameId);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.renderer.destroy(); this.audio.destroy(); this.pickupCandidates.clear();
  }
}