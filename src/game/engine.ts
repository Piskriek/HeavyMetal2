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
import { createQualifyingGate } from './qualifying/gate';
import { POWERUPS, createAirPickups, type AirPickup } from './powerups';
// T04: the simulation now lives in `src/game/sim`, shared with isolated qualifying attempts.
// The engine keeps rendering, input, bumps, particles and the HUD; it asks the sim to step.
import { FIXED_STEP } from './contracts/timing';
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

const TAU = Math.PI * 2;
const STEP = FIXED_STEP;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

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

  // Checkpoint system: freeze at first loop entrance
  private checkpointTriggered = false;
  /** M01 · T1: push cursor (0 while not pushing) and the per-racer targets for this run. */
  private pushTick = 0;
  private pushTargets: number[] = [];
  private checkpointX = 17000; // After Granite Tunnel Portal (trackDist ~16999)
  private frozenVelocities: { vx: number; vy: number; vz: number }[] = [];
  private countdownTimer = 0;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

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
    this.simFx = {
      emit: (x, y, z, count, color, speed) => engine.emit(x, y, z, count, color, speed),
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
    this.checkpointTriggered = false;
    this.pushTick = 0;
    this.pushTargets = [];
    this.frozenVelocities = [];
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
    this.racers = createRacers(this.config);
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
    this.setLane(racer, racer.targetLane - Math.sign(direction));
    this.refreshSnapshot(); this.notify();
  };

  private setLane(racer: Racer, lane: number) { setLaneSim(racer, lane, this.runTime); }

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
    if (this.status === 'flying') this.snapshot.status = 'paused';
    else if (this.status === 'paused') this.snapshot.status = 'flying';
    this.accumulator = this.lastFrame = 0; this.notify();
  };

  setSoloMode(solo: boolean) {
    this.soloMode = solo;
  }

  get isSoloMode() { return this.soloMode; }

  /** Trigger checkpoint: freeze all racers and show standings */
  private triggerCheckpoint() {
    if (this.checkpointTriggered) return;
    this.checkpointTriggered = true;
    this.snapshot.status = 'checkpoint';

    // If in solo mode, restore the full field of racers at the checkpoint
    if (this.soloMode && this.racers.length === 1) {
      const player = this.racers[0];
      const allRacers = createRacers(this.config);
      
      // Position AI racers near the checkpoint based on their "simulated" progress
      // Player is at the checkpoint, AI racers are staggered behind
      for (let i = 0; i < allRacers.length; i++) {
        const racer = allRacers[i];
        if (racer.isPlayer) {
          // Keep player at current position
          racer.x = player.x;
          racer.y = player.y;
          racer.z = player.z;
          racer.vx = player.vx;
          racer.vy = player.vy;
          racer.vz = player.vz;
          racer.lane = player.lane;
          racer.targetLane = player.targetLane;
          racer.distance = player.distance;
        } else {
          // AI racers staggered behind the player
          const offset = (i + 1) * 50; // 50 units apart
          racer.x = player.x - offset;
          racer.y = player.y;
          racer.z = player.z;
          racer.vx = player.vx * 0.9; // Slightly slower
          racer.vy = 0;
          racer.vz = 0;
          racer.lane = i % 4; // Distribute across lanes
          racer.targetLane = racer.lane;
          racer.distance = racer.x - START_X;
        }
      }
      
      this.racers = allRacers;
      this.renderRacers = allRacers.map(r => ({ ...r }));
      this.renderer.setRacerCount(allRacers.length);
    }

    // Save all velocities for staggered release
    this.frozenVelocities = this.racers.map(r => ({
      vx: r.vx, vy: r.vy, vz: r.vz
    }));

    // Freeze all racers
    for (const racer of this.racers) {
      racer.vx = 0;
      racer.vy = 0;
      racer.vz = 0;
    }

    // Build checkpoint standings (sorted by distance)
    const standings = [...this.racers]
      .sort((a, b) => b.x - a.x)
      .map((racer, index) => ({
        id: racer.id,
        name: racer.name,
        color: racer.color,
        position: index + 1,
        distance: Math.round((racer.x - START_X) / 2),
        raceTime: Math.round(this.runTime * 10) / 10,
        speed: Math.round(Math.hypot(this.frozenVelocities[racer.id].vx, this.frozenVelocities[racer.id].vy) * 0.16),
        loadout: { ...racer.loadout },
        isPlayer: racer.isPlayer,
      }));

    this.snapshot.checkpointStandings = standings;
    this.accumulator = 0;
    this.notify();
  }

  /** Called by UI when player clicks "Ready Up" */
  readyUp() {
    if (this.snapshot.status !== 'checkpoint') return;
    this.snapshot.status = 'countdown';
    this.countdownTimer = 3;
    this.snapshot.countdownNumber = 3;
    this.notify();

    // Start countdown interval
    this.countdownInterval = setInterval(() => {
      this.countdownTimer--;
      if (this.countdownTimer > 0) {
        this.snapshot.countdownNumber = this.countdownTimer;
        this.notify();
      } else {
        // Release racers in staggered order
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        this.snapshot.countdownNumber = 0;
        this.releaseFromCheckpoint();
      }
    }, 1000);
  }

  /** Release all racers from checkpoint with staggered timing and proper spacing */
  private releaseFromCheckpoint() {
    // Sort by position (1st place first, then 2nd, etc.)
    const sorted = [...this.racers].sort((a, b) => b.x - a.x);
    
    // Position racers with proper spacing to avoid overlap
    const spacing = RADIUS * 3; // 3x radius spacing between balls
    sorted.forEach((racer, index) => {
      // Stagger X positions so they don't overlap
      if (index > 0) {
        racer.x = sorted[0].x - (index * spacing);
        racer.distance = racer.x - START_X;
      }
    });
    
    // Restore velocities in order with staggered timing
    sorted.forEach((racer, index) => {
      const saved = this.frozenVelocities[racer.id];
      setTimeout(() => {
        racer.vx = saved.vx;
        racer.vy = saved.vy;
        racer.vz = saved.vz;
      }, index * 300); // 300ms stagger between each racer
    });

    this.snapshot.status = 'flying';
    this.snapshot.checkpointStandings = undefined;
    this.snapshot.countdownNumber = undefined;
    this.frozenVelocities = [];
    this.lastFrame = 0;
    this.accumulator = 0;
    this.notify();
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) {
      if (this.status === 'flying') this.togglePause();
      cancelAnimationFrame(this.frameId); this.frameId = 0;
    } else { this.lastFrame = 0; this.invalidate(); }
  }
  private schedule() { if (!this.destroyed && !this.frameId && this.visible && !document.hidden) this.frameId = requestAnimationFrame(this.frame); }
  private invalidate() { this.needsRender = true; this.schedule(); }
  private visibilityChanged = () => {
    this.lastFrame = this.lastRender = this.accumulator = 0;
    if (document.hidden) {
      if (this.status === 'flying') this.togglePause();
      cancelAnimationFrame(this.frameId); this.frameId = 0;
    } else this.invalidate();
  };

  private makeTrack() {
    // M01 · T1: in push mode the start pad and the whole run-up to the first loop are empty. The
    // filter only removes a prefix — the layout itself has no RNG — so every obstacle from the
    // gate on keeps its exact identity (asserted by tests/start-zone.test.ts).
    const built = createTrackLayout(this.options.course);
    this.obstacles = this.startMode === 'push'
      ? createTrackLayout(this.options.course, { skipBeforeX: createQualifyingGate(this.options.course, built).x })
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
      const simulating = this.status === 'flying' || this.status === 'pushing';
      if (simulating && !this.pausedForBuild) {
        this.accumulator = Math.min(0.1, this.accumulator + dt);
        while (this.accumulator >= STEP && (this.status === 'flying' || this.status === 'pushing') && !this.pausedForBuild) {
          for (const racer of this.racers) {
            racer.previous.x = racer.x; racer.previous.y = racer.y;
            racer.previous.z = racer.z; racer.previous.rotation = racer.rotation;
          }
          if (this.status === 'pushing') this.stepPush(STEP); else this.stepRace(STEP);
          this.accumulator -= STEP;
        }
      }
      this.updateParticles(dt);
      if (this.time > this.noticeUntil) this.snapshot.notice = '';
    }
    const alpha = this.status === 'flying' || this.status === 'pushing' ? clamp(this.accumulator / STEP, 0, 1) : 1;
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i]; const rendered = this.renderRacers[i];
      rendered.x = racer.previous.x + (racer.x - racer.previous.x) * alpha;
      rendered.y = racer.previous.y + (racer.y - racer.previous.y) * alpha;
      rendered.z = racer.previous.z + (racer.z - racer.previous.z) * alpha;
      rendered.rotation = racer.previous.rotation + (racer.rotation - racer.previous.rotation) * alpha;
      rendered.vx = racer.vx; rendered.vy = racer.vy; rendered.lane = racer.targetLane;
      rendered.falling = racer.falling; rendered.grounded = racer.grounded; rendered.distance = racer.distance;
      rendered.finished = racer.finished; rendered.bumpAt = racer.bumpAt;
      rendered.immuneUntil = racer.immuneUntil; rendered.launchOrigin = racer.launchOrigin;
      rendered.shieldUntil = racer.shieldUntil; rendered.shieldHitAt = racer.shieldHitAt; rendered.pickupAt = racer.pickupAt;
    }
    const player = this.player; const rendered = this.renderRacers[0];
    // M01 · T1: the shove moves the whole field, so the legacy camera state tracks it too — the ball
    // is already sliding down the descent by the time the push hands over to 'flying'.
    if ((this.status === 'flying' || this.status === 'pushing') && this.inputEnabled && !this.pausedForBuild) {
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
    const active = ((this.status === 'flying' || this.status === 'pushing') && !this.pausedForBuild) || this.isDragging;
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
        snapshot: this.snapshot, options: this.options, reducedMotion: this.reducedMotion }, interval);
    }
    if (now - this.lastNotify > 100) this.notify(false);
    const ambient = this.status === 'ready' && !this.reducedMotion || this.particles.length > 0 || this.airSheep.length > 0;
    const checkpointActive = this.status === 'checkpoint' || this.status === 'countdown';
    if (this.needsRender || checkpointActive || this.inputEnabled && this.status !== 'paused' && (active || ambient || this.pausedForBuild)) this.schedule();
  };

  private stepRace(dt: number) {
    this.runTime += dt;

    // Checkpoint detection: trigger when PLAYER reaches the checkpoint
    // Freeze all balls immediately, then show the overlay
    if (!this.checkpointTriggered && this.player.x >= this.checkpointX) {
      this.triggerCheckpoint();
      return;
    }

    for (const racer of this.racers) {
      if (racer.finished) continue;
      // A race lets the CPU see the whole field and rubber-band against the player; an isolated
      // qualifying attempt passes neither (see sim/cpu-driver.ts).
      if (racer.id && this.runTime >= racer.nextDecision) driveCpu(racer, this.cpuCtx);
      stepRacerSim(racer, this.simCtx, dt);
    }
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
      if (a.finished || b.finished || a.falling || b.falling || a.loopRide || b.loopRide
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
    if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.canvas.removeEventListener('pointerdown', this.pointerDown); this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp); this.canvas.removeEventListener('pointercancel', this.pointerCancel); this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.renderer.destroy(); this.audio.destroy(); this.pickupCandidates.clear();
  }
}