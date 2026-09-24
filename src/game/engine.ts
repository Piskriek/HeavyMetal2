import type { GameAssets } from './assets';
import { GameAudio } from './audio';
import { RangeRenderer } from './renderer';
import { chaseLerp, clampCameraTarget } from './projection';
import { createRacers, raceOrder, type Racer } from './racers';
import {
  AIM_ANCHOR, FINISH, GROUND, HEIGHT, LANE, RADIUS, STADIUM_START, START_X, START_Y,
  TRACK_DISTANCE, closestLane, courseY, courseSlope, launchVelocity, sectorAt,
  type AirSheep, type Obstacle, type Particle, type RacerFrame,
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
import { POWERUPS, createAirPickups, type AirPickup } from './powerups';
import { adjacentPath, adoptNearestPaths, assignNearestPaths, sampleLane, type LaneNetwork } from './lane-network';
import { loadLaneNetwork, readLaneStorage, validateLaneDocument, type LaneStorageDocument } from './lane-storage';
// T04: the simulation now lives in `src/game/sim`, shared with isolated qualifying attempts.
// The engine keeps rendering, input, bumps, particles and the HUD; it asks the sim to step.
import { FIXED_STEP } from './contracts/timing';
import { MERGE_GATE_HALF_WIDTH, MERGE_RELEASE_VX, MergePool } from './merge/pool';
import {
  PASSAGE_CENTRE_Z, PASSAGE_GHOST_CAP_S, PASSAGE_GHOST_TAIL_S, insidePassage,
  passageExitX, passageMouthX, passageProgress,
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
import { steerFrom, type CockpitState } from './cockpit';
import { EffectQueue } from './effects/events';

const TAU = Math.PI * 2;
const STEP = FIXED_STEP;
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
  private pickupCount = 0;
  private shieldBlocks = 0;
  private readonly pickupCandidates = new Set<AirPickup>();
  /** Spatial index and surface queries, shared with the headless qualifying attempts. */
  private readonly world: SimWorld;
  private readonly simFx: SimFx;
  private readonly simCtx: RacerStepContext;
  private readonly cpuCtx: CpuContext;
  private particles: Particle[] = [];
  private airSheep: AirSheep[] = [];
  private trail: { x: number; y: number; z: number }[] = [];
  private trailSample = 0;
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
    this.audio.setEnabled(options.sound);
    this.audio.setVolume(options.masterVolume);
    const engine = this;
    this.world = createSimWorld(config?.course ?? options.course);
    this.laneNetwork = loadLaneNetwork(config?.course ?? options.course);
    this.simFx = {
      emit: (x, y, z, count, color, speed) => engine.emit(x, y, z, count, color, speed),
      effect: (kind, x, y, z, scale, racerId) => engine.effects.push(kind, x, y, z, scale, racerId, engine.tick),
      airSheep: (spawn) => { engine.airSheep.push({ x: spawn.x, y: spawn.y, z: spawn.z, vx: spawn.vx, vy: spawn.vy, rotation: 0, life: 3.1 }); },
      say: (text) => engine.say(text),
      audio: (cue) => engine.audio.play(cue),
      // Chaos points never go below zero; the legacy recovery was the only negative delta.
      score: (delta) => { engine.snapshot.score = Math.max(0, engine.snapshot.score + delta); },
      shake: (amount) => { engine.shake = amount; },
      tally: (kind) => { engine.counts[kind]++; },
      refreshHud: () => { engine.refreshSnapshot(); engine.notify(); },
      notifyHud: () => { engine.notify(); },
      setHopReady: (ready) => { engine.snapshot.hopReady = ready; },
      clearTrail: () => { engine.trail.length = 0; },
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
      random: () => Math.random(),
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
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerCancel);
    canvas.addEventListener('pointerleave', this.pointerLeave);
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  private get player() { return this.racers[0]; }
  /**
   * M01 · T1: how the field leaves the grid. `'push'` is the default (the goblin shove on the pad);
   * `'sling'` keeps the legacy drag-aim/slingshot path so the regression suite can A/B it.
   */
  get startMode(): StartMode { return this.options.startMode === 'sling' ? 'sling' : 'push'; }
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
    if (this.laneNetwork) this.assignPaths();
    // Solo mode: keep only the player, remove all AI racers
    if (this.soloMode) {
      const player = this.racers.find(r => r.isPlayer) ?? this.racers[0];
      this.racers = [player];
    }
    if (this.customPhysics) { this.player.weight = this.options.ballWeight; this.player.launchSpeed = this.options.launchSpeed; }
    else this.options = { ...this.options, course: this.config!.course, launchSpeed: this.player.launchSpeed, ballWeight: this.player.weight };
    this.renderRacers = this.racers.map((racer) => ({ ...racer }));
    this.camera = this.cameraY = this.runTime = 0;
    this.accumulator = this.lastFrame = this.lastRender = 0;
    this.topSpeed = this.shake = 0;
    this.isDragging = false;
    this.counts = { sheep: 0, explosions: 0, loops: 0, bumps: 0 };
    this.pickupCount = this.shieldBlocks = 0;
    this.snapshot.sector = sectorAt(START_X, this.options.course);
    this.collisionTimes.fill(-100);
    this.particles.length = this.airSheep.length = this.trail.length = 0;
    this.canvas.style.cursor = '';
    this.renderer.view.configure(this.renderer.view.width, 0, this.options.downrange, 0);
    this.makeTrack();
    this.standingsKey = '';
    this.notify(); this.invalidate();
  };

  /**
   * M01 · T1 — begin the run.
   *
   * In push mode every racer is standing on the pad; the starter goblin shoves the whole field at
   * once and the downhill does the rest. In sling mode this is exactly the legacy `launch()`.
   */
  start = () => {
    if (this.status !== 'ready') return;
    if (this.startMode === 'sling') { this.launch(); return; }
    this.pushTick = 0;
    this.pushTargets = this.racers.map((racer) => startPushVelocity(racer.pace, this.pushSeed, racer.id));
    for (const racer of this.racers) {
      racer.previous = { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation };
      racer.launchOrigin = { x: racer.x, y: racer.y };
    }
    for (const racer of this.racers) this.effects.push('dust', racer.x, racer.y, racer.z, 1.6, racer.id, this.tick);
    this.snapshot.status = 'pushing';
    this.snapshot.speed = 0;
    this.snapshot.notice = 'THE STARTER GOBLIN SHOVES THE WHOLE GRID.';
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
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i];
      applyPushTick(racer, this.pushTick, this.pushTargets[i]);
      racer.x += racer.vx * dt;
      racer.y = this.y(racer.x) - RADIUS;
      racer.rotation += racer.vx * dt / RADIUS;
    }
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
    const player = this.player;
    state.steer = steerFrom(player.vz, player.handling);
    state.speedKmh = this.snapshot.speed;
    state.boostCharges = this.snapshot.boosts;
    state.bounceCharges = this.snapshot.bounces;
    state.shieldSeconds = this.snapshot.shieldSeconds;
    state.gradePct = this.snapshot.grade;
    state.grounded = this.snapshot.grounded;
    state.inLoop = this.snapshot.inLoop;
    state.status = this.snapshot.status;
    state.position = this.snapshot.position;
    state.raceTime = this.snapshot.raceTime;
    state.pushing = this.snapshot.status === 'pushing';
    // M01 · T2: the cockpit's own countdown read-out is the pool's, and it says POOL while queued.
    state.countdownLabel = this.snapshot.merge?.countdownLabel
      ?? (this.snapshot.status === 'checkpoint' ? 'POOL' : null);
    return state;
  }

  /**
   * The slingshot. M01 · T1 retires it from input in push mode, but the method stays: it is the
   * legacy start (and the sling-mode start), and `retry(true)` / a pointer release still land here.
   * In push mode it routes to `start()` so no code path can slingshot a grid that has no slingshot.
   */
  launch = () => {
    if (this.startMode === 'push') { this.start(); return; }
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
    this.lastFrame = this.accumulator = 0;
    this.isDragging = false;
    this.canvas.style.cursor = '';
    this.audio.play('launch');
    this.say('FOUR GOBLINS. ZERO RIGHT OF WAY.'); this.notify();
  };

  changeLane = (direction: number) => {
    const racer = this.player;
    if (this.status !== 'flying' || racer.falling || racer.loopRide || racer.finished || this.runTime < racer.steerLockedUntil) return;
    // Invert direction: A (left) should decrease lane number, D (right) should increase
    const step = -Math.sign(direction) as -1 | 1;
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
    if (network) this.assignPaths();
  }

  /**
   * Adopts a racer who is not on a path yet. The grid sits at x = 190 and an authored network may
   * begin further down the hill (or a racer may be put back by the crew outside every path's x
   * range), so this runs each tick and costs one scan per *unassigned* racer.
   */
  private adoptPaths() {
    adoptNearestPaths(this.racers, this.laneNetwork);
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

  adjustAim = (powerDelta: number, angleDelta: number) => {
    if (this.status !== 'ready' || this.isDragging) return;
    this.snapshot.power = clamp(this.snapshot.power + powerDelta, 0.18, 1);
    this.snapshot.angle = clamp(this.snapshot.angle + angleDelta, 12, 68);
    const angle = this.snapshot.angle * Math.PI / 180;
    this.player.x = AIM_ANCHOR.x - Math.cos(angle) * this.snapshot.power * AIM_ANCHOR.fullPowerDraw;
    this.player.y = AIM_ANCHOR.y + Math.sin(angle) * this.snapshot.power * AIM_ANCHOR.fullPowerDraw;
    this.notify();
  };

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

  bounce = () => {
    // Space on the grid starts the run (the push, or the legacy sling).
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

    // 2. The rider who is next to go slides over to the loop's lane; everyone else waits in their slot.
    const next = pool.next;
    for (const entry of pool.entries) {
      if (entry.releaseTick !== null) continue;
      const racer = this.racers.find((candidate) => candidate.id === entry.racerId);
      if (!racer) continue;
      racer.mergeSlotZ = entry === next ? pool.loopZ : entry.slotZ;
    }

    // 3. Advance the state machine. The occupancy input is the previous release's own progress.
    const previousRacer = this.mergeLastReleased === null
      ? null
      : this.racers.find((racer) => racer.id === this.mergeLastReleased) ?? null;
    const candidate = next ? this.racers.find((racer) => racer.id === next.racerId) ?? null : null;
    const released = pool.step(this.tick, {
      previousProgress: previousRacer ? passageProgress(previousRacer.x) : 1,
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
      if (racer.x >= passageExitX() || this.runTime >= racer.mergeGhostUntil + PASSAGE_GHOST_CAP_S) {
        racer.mergeGhost = false;
      }
    }

    this.applyMergeStatus();
    this.refreshMergeSnapshot();
  }

  /** Freezes a rider at the gate plane and points them at their pool slot. */
  private hold(racer: Racer, slotZ: number) {
    racer.mergeHeld = true;
    racer.mergeGhost = false;
    racer.mergeSlotZ = slotZ;
    racer.x = this.mergeGateFor().x;
    racer.vx = 0; racer.vy = 0; racer.vz = 0;
    racer.falling = false; racer.grounded = true;
    racer.y = this.world.y(racer.x) - RADIUS;
    this.effects.push('dust', racer.x, racer.y, racer.z, 1.2, racer.id, this.tick);
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
    this.obstacles = this.startMode === 'push'
      ? createTrackLayout(this.options.course, {
        skipBeforeX: passageMouthX(),
        keepLoopsFromX: startZoneEndX,
      })
      : built;
    this.pickups = createAirPickups(this.options.course, this.obstacles);
    this.world.configure(this.options.course, this.obstacles, this.pickups);
  }

  private inGap(x: number, z: number) { return this.world.inGap(x, z); }
  private surfaceAt(x: number, z: number) { return this.world.surfaceAt(x, z); }

  private coordinates(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return this.renderer.view.unproject((event.clientX - rect.left) / rect.width * this.renderer.view.width,
      (event.clientY - rect.top) / rect.height * HEIGHT, this.player.z);
  }
  private pointerDown = (event: PointerEvent) => {
    if (this.startMode === 'push') return; // the slingshot handle does not exist in push mode
    if (!this.inputEnabled || this.status !== 'ready' || !event.isPrimary || event.button !== 0) return;
    const point = this.coordinates(event);
    if (Math.hypot(point.x - this.player.x, point.y - this.player.y) > RADIUS * 1.75) return;
    this.audio.unlock(); this.isDragging = true;
    this.grabOffset = { x: this.player.x - point.x, y: this.player.y - point.y };
    this.canvas.setPointerCapture(event.pointerId); this.canvas.focus({ preventScroll: true }); this.invalidate();
  };
  private pointerMove = (event: PointerEvent) => {
    if (this.startMode === 'push') return; // no aim cursor, no drag
    if (!this.inputEnabled) return;
    const point = this.coordinates(event); const rect = this.canvas.getBoundingClientRect();
    this.pointerDrift = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
    if (this.status === 'ready') this.canvas.style.cursor = this.isDragging ? 'grabbing' : Math.hypot(point.x - this.player.x, point.y - this.player.y) < 55 ? 'grab' : 'default';
    if (!this.isDragging) return;
    const dx = Math.max(16, AIM_ANCHOR.x - point.x - this.grabOffset.x);
    const dy = Math.max(6, point.y + this.grabOffset.y - AIM_ANCHOR.y);
    const distance = clamp(Math.hypot(dx, dy), 36, AIM_ANCHOR.maxDraw);
    this.snapshot.power = clamp(distance / AIM_ANCHOR.fullPowerDraw, 0.18, 1);
    this.snapshot.angle = clamp(Math.atan2(dy, dx) * 180 / Math.PI, 12, 68);
    const angle = this.snapshot.angle * Math.PI / 180;
    this.player.x = AIM_ANCHOR.x - Math.cos(angle) * distance; this.player.y = AIM_ANCHOR.y + Math.sin(angle) * distance;
    this.notify(false);
  };
  private pointerUp = (event: PointerEvent) => {
    if (!this.isDragging) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.launch();
  };
  private pointerCancel = () => {
    if (this.isDragging) {
      this.isDragging = false; this.player.x = START_X; this.player.y = START_Y;
      this.snapshot.power = 0.8; this.snapshot.angle = 36; this.notify(); this.invalidate();
    }
  };
  private pointerLeave = () => { this.pointerDrift = 0; if (!this.isDragging) this.canvas.style.cursor = ''; };

  private frame = (now: number) => {
    this.frameId = 0;
    if (this.destroyed || !this.visible || document.hidden) return;
    const dt = Math.min(this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60, 0.1);
    this.lastFrame = now;
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
      this.updateParticles(dt);
      if (this.time > this.noticeUntil) this.snapshot.notice = '';
    }
    const alpha = statusSimulates(this.status) ? clamp(this.accumulator / STEP, 0, 1) : 1;
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i]; const rendered = this.renderRacers[i];
      rendered.x = racer.previous.x + (racer.x - racer.previous.x) * alpha;
      rendered.y = racer.previous.y + (racer.y - racer.previous.y) * alpha;
      rendered.z = racer.previous.z + (racer.z - racer.previous.z) * alpha;
      rendered.rotation = racer.previous.rotation + (racer.rotation - racer.previous.rotation) * alpha;
      // M01 · T3 (IF-GYRO): the roll phase is sampled, not interpolated — a shell that snaps to a
      // slightly stale phase is invisible, while interpolating it would need a second wrapped field.
      rendered.rollPhase = racer.rollPhase;
      rendered.vx = racer.vx; rendered.vy = racer.vy; rendered.lane = racer.targetLane;
      rendered.falling = racer.falling; rendered.grounded = racer.grounded; rendered.distance = racer.distance;
      rendered.finished = racer.finished; rendered.bumpAt = racer.bumpAt;
      rendered.immuneUntil = racer.immuneUntil; rendered.launchOrigin = racer.launchOrigin;
      rendered.shieldUntil = racer.shieldUntil; rendered.shieldHitAt = racer.shieldHitAt; rendered.pickupAt = racer.pickupAt;
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
    this.drift += (this.pointerDrift - this.drift) * Math.min(1, dt * 2);
    const active = (statusSimulates(this.status) && !this.pausedForBuild) || this.isDragging;
    const due = active || this.needsRender || !this.lastRender || now - this.lastRender >= 1000 / 30 - 0.5;
    if (due && (this.status !== 'paused' || this.needsRender)) {
      const interval = this.lastRender ? now - this.lastRender : 16.67;
      this.lastRender = now; this.needsRender = false;
      if (this.status === 'flying' && !this.pausedForBuild && now - this.trailSample > 16) {
        this.trailSample = now; this.trail.push({ x: rendered.x, y: rendered.y, z: rendered.z });
        if (this.trail.length > 9) this.trail.shift();
      }
      this.renderer.render({ time: this.time, runTime: this.runTime, camera: this.camera, cameraY: this.cameraY,
        drift: this.drift, shake: this.shake, rotation: rendered.rotation, dragging: this.isDragging,
        launchOrigin: player.launchOrigin, ball: rendered, racers: this.renderRacers, loopRide: player.loopRide,
        obstacles: this.obstacles, pickups: this.pickups, particles: this.particles, sheep: this.airSheep, trail: this.trail,
        snapshot: this.snapshot, options: this.options, reducedMotion: this.reducedMotion,
        effects: this.effects }, interval);
    }
    if (now - this.lastNotify > 100) this.notify(false);
    const ambient = this.status === 'ready' && !this.reducedMotion || this.particles.length > 0 || this.airSheep.length > 0;
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

    this.adoptPaths();
    for (const racer of this.racers) {
      if (racer.finished) continue;
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
        || this.runTime < a.immuneUntil || this.runTime < b.immuneUntil) continue;
      const dx = b.x - a.x; const dz = b.z - a.z; const dy = b.y - a.y;
      const diameter = RADIUS * 2 + 4;
      const distance = Math.hypot(dx, dz, dy);
      if (distance >= diameter || Math.abs(dy) > RADIUS * 1.55) continue;
      const planar = Math.hypot(dx, dz) || 1;
      const nx = dx / planar; const nz = dz / planar;
      const sum = a.weight + b.weight;
      const penetration = (diameter - distance + 1) * 0.55;
      a.x -= nx * penetration * b.weight / sum; b.x += nx * penetration * a.weight / sum;
      a.z -= nz * penetration * b.weight / sum; b.z += nz * penetration * a.weight / sum;
      a.z = clamp(a.z, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
      b.z = clamp(b.z, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
      const pair = i * 4 + j;
      if (this.runTime - this.collisionTimes[pair] < 0.38) continue;
      this.collisionTimes[pair] = this.runTime;
      const shieldA = this.absorbShield(a);
      const shieldB = this.absorbShield(b);
      const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (relative < 0) {
        const impulse = -(1.38 * relative) / (1 / a.weight + 1 / b.weight);
        if (!shieldA) a.vx = clamp(a.vx - impulse * nx / a.weight, 100, a.maximumSpeed);
        if (!shieldB) b.vx = clamp(b.vx + impulse * nx / b.weight, 100, b.maximumSpeed);
      }
      // A rear-end hit also has a sideways component: heavy capsules shove the
      // lighter target toward an adjacent lane, rather than stacking in place.
      let side = Math.abs(dz) > 8 ? Math.sign(dz) : (closestLane(b.z) === 0 ? -1 : closestLane(b.z) === 3 ? 1 : ((i + j) % 2 ? 1 : -1));
      if (!side) side = 1;
      const closing = Math.min(380, Math.abs(a.vx - b.vx) + Math.abs(a.vz - b.vz));
      const kick = 270 + closing * 0.22;
      
      // Heavy impacts cause more dramatic lane changes
      const isHeavyImpact = closing > 200 || Math.abs(a.vx - b.vx) > 150;
      const kickMultiplier = isHeavyImpact ? 2.5 : 1;
      
      if (!shieldA) this.shove(a, -side, kick * kickMultiplier * Math.min(1.65, b.weight / a.weight));
      if (!shieldB) this.shove(b, side, kick * kickMultiplier * Math.min(1.65, a.weight / b.weight));
      
      const x = (a.x + b.x) / 2; const z = (a.z + b.z) / 2;
      const y = (a.y + b.y) / 2;
      
      // More dramatic particle effects for collisions
      const particleCount = isHeavyImpact ? 25 : 12;
      const particleSpeed = isHeavyImpact ? 280 : 140;
      const particleColor = isHeavyImpact ? '#ffaa00' : '#ffe0a0';
      
      this.emit(x, y, z, particleCount, particleColor, particleSpeed);
      // M01 · T5: every collision is an impact; a heavy one also throws sparks and smoke.
      this.effects.push('impact', x, y, z, isHeavyImpact ? 1.4 : 0.8, a.id ? a.id : b.id, this.tick);
      this.effects.push('sparks', x, y, z, isHeavyImpact ? 1.2 : 0.6, a.id ? a.id : b.id, this.tick);
      if (isHeavyImpact) this.effects.push('smoke', x, y, z, 0.8, a.id ? a.id : b.id, this.tick);
      
      // Add sparks for heavy impacts
      if (isHeavyImpact) {
        this.emit(x, y, z, 8, '#ffff00', 350); // Bright yellow sparks
        this.emit(x, y, z, 5, '#ff6600', 200); // Orange fire
        
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
    const lane = closestLane(racer.z);
    // M01 · T6: a shove off an authored path moves to the neighbouring *path* on that side, and
    // stays where it is when there is none. `direction > 0` pushes toward larger z, which is the
    // `-1` side of the lane convention `adjacentPath` speaks.
    const network = this.laneNetwork;
    if (network && racer.pathId) {
      const next = adjacentPath(network, racer.pathId, racer.x, -Math.sign(direction) as -1 | 1);
      if (next) racer.pathId = next;
    }
    racer.targetLane = clamp(lane - Math.sign(direction), 0, 3);
    racer.vz = clamp(racer.vz + direction * speed, -650, 650);
    racer.z = clamp(racer.z + direction * 5, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
    racer.steerLockedUntil = this.runTime + 0.28 * racer.bumpRecovery; racer.bumpAt = this.runTime;
    racer.lastLaneChange = this.runTime;
  }

  private absorbShield(racer: Racer) {
    if (racer.shieldUntil <= this.runTime) return false;
    racer.shieldUntil = -100;
    racer.shieldHitAt = this.runTime;
    racer.immuneUntil = Math.max(racer.immuneUntil, this.runTime + 0.3);
    this.emit(racer.x, racer.y, racer.z, 9, POWERUPS.shield.color, 155);
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
      this.emit(this.player.x, this.y(FINISH) - 140, this.player.z, 42, this.player.color, 250);
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
  private emit(x: number, y: number, z: number, count: number, color: string, speed: number) {
    if (Math.abs(x - this.player.x) > this.renderer.view.width + 650) return;
    if (this.renderer.lowDetail) count = Math.ceil(count * 0.65);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU; const v = speed * (0.2 + Math.random() * 0.8); const life = 0.35 + Math.random() * 0.6;
      this.particles.push({ x, y, z, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 50, life, maxLife: life, size: 2 + Math.random() * 4, color });
    }
    if (this.particles.length > 160) this.particles.splice(0, this.particles.length - 160);
  }
  private updateParticles(dt: number) {
    let alive = 0;
    for (const particle of this.particles) if (particle.life > dt) {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 310 * dt; particle.life -= dt;
      this.particles[alive++] = particle;
    }
    this.particles.length = alive; alive = 0;
    for (const sheep of this.airSheep) if (sheep.life > dt) {
      sheep.x += sheep.vx * dt; sheep.y += sheep.vy * dt; sheep.vy += 570 * dt; sheep.rotation += dt * 3; sheep.life -= dt;
      const ground = this.y(sheep.x);
      if (sheep.y > ground - 36 && !this.inGap(sheep.x, sheep.z)) { sheep.y = ground - 36; sheep.vy = -Math.abs(sheep.vy) * 0.4; sheep.vx *= 0.74; }
      this.airSheep[alive++] = sheep;
    }
    this.airSheep.length = alive;
  }
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
    this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp); this.canvas.removeEventListener('pointercancel', this.pointerCancel); this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.renderer.destroy(); this.audio.destroy(); this.pickupCandidates.clear();
  }
}