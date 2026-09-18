import type { GameAssets } from './assets';
import { GameAudio } from './audio';
import { RangeRenderer } from './renderer';
import { chaseLerp, clampCameraTarget } from './projection';
import { createRacers, raceOrder, type Racer } from './racers';
import {
  AIM_ANCHOR, FINISH, GROUND, GRAVITY, HEIGHT, LANE, LANE_COUNT, PLAYER_LANE,
  RADIUS, STADIUM_START, START_X, START_Y, STAGE_2_START, STAGE_3_START, TRACK_DISTANCE,
  WATERFALL_EXIT_X, WATERFALL_START_X, WATERFALL_WALL_X, closestLane, courseY, courseSlope, gravityScaleForSlope,
  laneZ, launchVelocity, loopGeometry, obstacleZ, occupiesLane, rampSurface, sectorAt, surfaceTypeAt, weightImpulse,
  type AirSheep, type Obstacle, type Particle, type RacerFrame, type WaterfallFeature, type WaterfallFrame,
} from './scene';
import { INITIAL_SNAPSHOT, type GameOptions, type GameSnapshot, type GameStatus, type RacerStanding, type RunRecord } from './types';
import type { RaceConfig } from './session';
import { createTrackLayout, createWaterfallDropLayout } from './track-layout';
import { POWERUPS, SHIELD_DURATION, createAirPickups, hopTiming, pickupIntercept, pickupY, type AirPickup } from './powerups';

const TAU = Math.PI * 2;
const STEP = 1 / 120;
const BUCKET = 512;
const EMPTY: Obstacle[] = [];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const randomAt = (id: number, time: number) => { const value = Math.sin(id * 91.37 + Math.floor(time * 3) * 17.23) * 13791.73; return value - Math.floor(value); };

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
  private waterfallFeatures: WaterfallFeature[] = [];
  private waterfallCamera: WaterfallFrame | null = null;
  private pickups: AirPickup[] = [];
  private readonly pickupBuckets = new Map<number, AirPickup[]>();
  private pickupCount = 0;
  private shieldBlocks = 0;
  private readonly pickupCandidates = new Set<AirPickup>();
  private readonly buckets = new Map<number, Obstacle[]>();
  private particles: Particle[] = [];
  private airSheep: AirSheep[] = [];
  private trail: { x: number; y: number; z: number }[] = [];
  private trailSample = 0;
  private snapshot: GameSnapshot = { ...INITIAL_SNAPSHOT, status: 'ready' };
  private lastSnapshot: GameSnapshot | null = null;
  private standingsKey = '';

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
  private get customPhysics() { return !this.config || this.config.customPhysics; }
  get status(): GameStatus { return this.snapshot.status; }
  get inputEnabled() { return this.controlsEnabled; }
  set inputEnabled(value: boolean) { this.controlsEnabled = value; this.lastFrame = 0; this.invalidate(); }

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
    this.racers = createRacers(this.config);
    if (this.customPhysics) { this.player.weight = this.options.ballWeight; this.player.launchSpeed = this.options.launchSpeed; }
    else this.options = { ...this.options, course: this.config!.course, launchSpeed: this.player.launchSpeed, ballWeight: this.player.weight };
    this.renderRacers = this.racers.map((racer) => ({ ...racer }));
    this.camera = this.cameraY = this.runTime = 0;
    this.accumulator = this.lastFrame = this.lastRender = 0;
    this.topSpeed = this.shake = 0;
    this.isDragging = false;
    this.counts = { sheep: 0, explosions: 0, loops: 0, bumps: 0 };
    this.waterfallCamera = null;
    this.waterfallFeatures = [];
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
    this.lastFrame = this.accumulator = 0;
    this.isDragging = false;
    this.canvas.style.cursor = '';
    this.audio.play('launch');
    this.say('FOUR GOBLINS. ZERO RIGHT OF WAY.'); this.notify();
  };

  changeLane = (direction: number) => {
    const racer = this.player;
    if (this.status !== 'flying' || racer.falling || racer.loopRide || racer.finished || this.runTime < racer.steerLockedUntil) return;
    this.setLane(racer, racer.targetLane + Math.sign(direction));
    this.refreshSnapshot(); this.notify();
  };

  private setLane(racer: Racer, lane: number) {
    const next = clamp(Math.round(lane), 0, LANE_COUNT - 1);
    if (next === racer.targetLane) return;
    racer.targetLane = next; racer.lastLaneChange = this.runTime;
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

  private canHop(racer: Racer) {
    return !racer.falling && !racer.loopRide && !racer.waterfall && !racer.finished && this.runTime - racer.lastHopAt >= 0.25
      && (racer.grounded || this.runTime - racer.lastGroundedAt < 0.085);
  }

  jump = () => {};

  private performHop(racer: Racer) {
    racer.vy = racer.vx * this.surfaceAt(racer.x, racer.z).slope - 290 * weightImpulse(racer.weight) * racer.hopFactor;
    racer.grounded = false; racer.lastHopAt = this.runTime;
    racer.lastGroundedAt = racer.bufferedJump = -100;
    this.emit(racer.x, racer.y + RADIUS, racer.z, 5, '#dbc294', 85);
    if (!racer.id) { this.snapshot.hopReady = false; this.audio.play('hop'); this.notify(); }
  }

  bounce = () => {
    if (this.status === 'ready') { this.launch(); return; }
    if (this.status === 'flying') this.performBounce(this.player);
  };

  private performBounce(racer: Racer) {
    if (!racer.bounces || racer.falling || racer.loopRide || racer.waterfall || racer.finished) return;
    racer.bounces--; racer.vy = -760 * weightImpulse(racer.weight) * racer.hopFactor;
    racer.vx = Math.max(320, racer.vx + 65 * weightImpulse(racer.weight));
    racer.grounded = false; racer.lastGroundedAt = -100;
    this.emit(racer.x, racer.y + RADIUS, racer.z, 10, '#a7dec1', 160);
    if (!racer.id) { this.audio.play('bounce'); this.say('GRAVITY IS A SUGGESTION.'); this.refreshSnapshot(); this.notify(); }
  }

  boost = () => { if (this.status === 'flying') this.performBoost(this.player); };

  private performBoost(racer: Racer) {
    if (!racer.boosts || racer.falling || racer.waterfall || racer.finished) return;
    const impulse = 430 * weightImpulse(racer.weight) * racer.boostFactor;
    racer.boosts--; racer.lastBoostAt = this.runTime;
    if (racer.loopRide) racer.loopRide.speed = Math.min(racer.maximumSpeed, racer.loopRide.speed + impulse);
    racer.vx = Math.min(racer.maximumSpeed, racer.vx + impulse);
    if (racer.grounded) racer.vy = this.surfaceAt(racer.x, racer.z).slope * racer.vx;
    this.emit(racer.x - RADIUS, racer.y, racer.z, 12, racer.color, 210);
    if (!racer.id) { this.audio.play('boost'); this.say('MORE SPEED. LESS THINKING.'); this.shake = 2; this.refreshSnapshot(); this.notify(); }
  }

  togglePause = () => {
    if (this.status === 'flying') this.snapshot.status = 'paused';
    else if (this.status === 'paused') this.snapshot.status = 'flying';
    this.accumulator = this.lastFrame = 0; this.notify();
  };
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
    this.obstacles = createTrackLayout(this.options.course);
    this.waterfallFeatures = createWaterfallDropLayout(this.options.course);
    this.buckets.clear(); this.pickupBuckets.clear();
    for (const obstacle of this.obstacles) {
      const left = obstacle.kind === 'loop' ? obstacle.x - obstacle.width / 2 : obstacle.x;
      const right = obstacle.kind === 'loop' ? obstacle.x + obstacle.width / 2 : obstacle.x + obstacle.width;
      for (let key = Math.floor((left - RADIUS * 2) / BUCKET); key <= Math.floor((right + RADIUS * 2) / BUCKET); key++) {
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(obstacle); else this.buckets.set(key, [obstacle]);
      }
    }
    this.pickups = createAirPickups(this.options.course, this.obstacles);
    for (const pickup of this.pickups) {
      for (let key = Math.floor((pickup.x - 65) / BUCKET); key <= Math.floor((pickup.x + 65) / BUCKET); key++) {
        const bucket = this.pickupBuckets.get(key);
        if (bucket) bucket.push(pickup); else this.pickupBuckets.set(key, [pickup]);
      }
    }
  }

  private nearby(x: number) { return this.buckets.get(Math.floor(x / BUCKET)) ?? EMPTY; }
  private inGap(x: number, z: number) { return this.nearby(x).some((o) => o.kind === 'gap' && x > o.x && x < o.x + o.width && occupiesLane(o, z, 0)); }
  private surfaceAt(x: number, z: number) {
    let y = this.y(x); let slope = this.slope(x); let ramp: Obstacle | null = null;
    let surface = surfaceTypeAt(x);
    for (const o of this.nearby(x)) if (o.kind === 'ramp' && x >= o.x && x <= o.x + o.width && occupiesLane(o, z, 5)) {
      y = rampSurface(o, x, this.options.course); slope -= 1.6 * o.height / o.width * Math.pow((x - o.x) / o.width, 0.6); ramp = o;
      surface = o.surface ?? surface;
    }
    return { y, slope, ramp, surface };
  }

  private inCliffSection(x: number) { return x >= STAGE_2_START && x < STAGE_3_START; }
  private gravityAt(x: number, slope = this.slope(x)) {
    return GRAVITY * (this.inCliffSection(x) ? Math.max(1.45, gravityScaleForSlope(slope)) : gravityScaleForSlope(slope));
  }

  private coordinates(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return this.renderer.view.unproject((event.clientX - rect.left) / rect.width * this.renderer.view.width,
      (event.clientY - rect.top) / rect.height * HEIGHT, this.player.z);
  }
  private pointerDown = (event: PointerEvent) => {
    if (!this.inputEnabled || this.status !== 'ready' || !event.isPrimary || event.button !== 0) return;
    const point = this.coordinates(event);
    if (Math.hypot(point.x - this.player.x, point.y - this.player.y) > RADIUS * 1.75) return;
    this.audio.unlock(); this.isDragging = true;
    this.grabOffset = { x: this.player.x - point.x, y: this.player.y - point.y };
    this.canvas.setPointerCapture(event.pointerId); this.canvas.focus({ preventScroll: true }); this.invalidate();
  };
  private pointerMove = (event: PointerEvent) => {
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
      if (this.status === 'flying') {
        this.accumulator = Math.min(0.1, this.accumulator + dt);
        while (this.accumulator >= STEP && this.status === 'flying') {
          for (const racer of this.racers) {
            racer.previous.x = racer.x; racer.previous.y = racer.y;
            racer.previous.z = racer.z; racer.previous.rotation = racer.rotation;
          }
          this.stepRace(STEP); this.accumulator -= STEP;
        }
      }
      this.updateParticles(dt);
      if (this.time > this.noticeUntil) this.snapshot.notice = '';
    }
    const alpha = this.status === 'flying' ? clamp(this.accumulator / STEP, 0, 1) : 1;
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i]; const rendered = this.renderRacers[i];
      rendered.x = racer.previous.x + (racer.x - racer.previous.x) * alpha;
      rendered.y = racer.previous.y + (racer.y - racer.previous.y) * alpha;
      rendered.z = racer.previous.z + (racer.z - racer.previous.z) * alpha;
      rendered.rotation = racer.previous.rotation + (racer.rotation - racer.previous.rotation) * alpha;
      rendered.vx = racer.vx; rendered.vy = racer.vy; rendered.lane = racer.targetLane;
      rendered.falling = racer.falling; rendered.finished = racer.finished; rendered.bumpAt = racer.bumpAt;
      rendered.immuneUntil = racer.immuneUntil; rendered.launchOrigin = racer.launchOrigin;
      rendered.shieldUntil = racer.shieldUntil; rendered.shieldHitAt = racer.shieldHitAt; rendered.pickupAt = racer.pickupAt; rendered.fireUntil = racer.fireUntil;
      rendered.waterfallPhase = racer.waterfallPhase; rendered.waterfallProgress = racer.waterfallProgress;
      rendered.waterfallDepth = racer.waterfallDepth; rendered.waterfallLateral = racer.waterfallLateral; rendered.waterfallHits = racer.waterfallHits;
    }
    const player = this.player; const rendered = this.renderRacers[0];
    if (this.status === 'flying' && this.inputEnabled) {
      const view = this.renderer.view;
      if (player.waterfall) {
        // The waterfall renderer is deliberately camera-locked and head-on. Keep
        // the world camera parked at the lip so the handoff back to the mine rail
        // network has no sideways snap when the bottom impact releases the racer.
        const target = clampCameraTarget(view.followOffset(WATERFALL_START_X, 0));
        this.camera = chaseLerp(this.camera, target, 12, dt);
        this.cameraY = chaseLerp(this.cameraY, 0, 12, dt);
      } else {
        const focus = player.loopRide?.obstacle.x ?? rendered.x;
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
    }
    this.drift += (this.pointerDrift - this.drift) * Math.min(1, dt * 2);
    const active = this.status === 'flying' || this.isDragging;
    const due = active || this.needsRender || !this.lastRender || now - this.lastRender >= 1000 / 30 - 0.5;
    if (due && (this.status !== 'paused' || this.needsRender)) {
      const interval = this.lastRender ? now - this.lastRender : 16.67;
      this.lastRender = now; this.needsRender = false;
      if (this.status === 'flying' && now - this.trailSample > 16) {
        this.trailSample = now; this.trail.push({ x: rendered.x, y: rendered.y, z: rendered.z });
        if (this.trail.length > 9) this.trail.shift();
      }
      this.renderer.render({ time: this.time, runTime: this.runTime, camera: this.camera, cameraY: this.cameraY,
        drift: this.drift, shake: this.shake, rotation: rendered.rotation, dragging: this.isDragging,
        launchOrigin: player.launchOrigin, ball: rendered, racers: this.renderRacers, loopRide: player.loopRide,
        obstacles: this.obstacles, pickups: this.pickups, particles: this.particles, sheep: this.airSheep, trail: this.trail,
        waterfall: this.waterfallCamera, waterfallFeatures: this.waterfallFeatures,
        snapshot: this.snapshot, options: this.options, reducedMotion: this.reducedMotion }, interval);
    }
    if (now - this.lastNotify > 100) this.notify(false);
    const ambient = this.status === 'ready' && !this.reducedMotion || this.particles.length > 0 || this.airSheep.length > 0;
    if (this.needsRender || this.inputEnabled && this.status !== 'paused' && (active || ambient)) this.schedule();
  };

  private enterWaterfall(racer: Racer) {
    if (racer.waterfall || racer.finished) return;
    const lateral = clamp(-racer.z / (LANE.far + 70), -0.78, 0.78);
    racer.waterfall = {
      phase: 'wall-impact', progress: 0, depth: 0, lateral, targetLateral: lateral,
      velocity: 0, hitCount: 0, impact: 1, startedAt: this.runTime,
    };
    racer.waterfallPhase = 'wall-impact'; racer.waterfallProgress = 0;
    racer.waterfallDepth = 0; racer.waterfallLateral = lateral; racer.waterfallHits = 0;
    racer.x = WATERFALL_WALL_X; racer.y = this.y(WATERFALL_WALL_X) - RADIUS;
    racer.z = -lateral * (LANE.far + 70); racer.vx = 0; racer.vy = 0; racer.vz = 0;
    racer.grounded = false; racer.loopRide = null; racer.falling = false;
    this.emit(WATERFALL_WALL_X, racer.y - 95, racer.z, 26, '#d2b582', 230);
    if (!racer.id) {
      this.shake = 7;
      this.snapshot.score += 120;
      this.audio.play('bump');
      this.say('THE WALL WON. TAKE THE WATERFALL.');
    }
  }

  private hitWaterfallFeature(racer: Racer, feature: WaterfallFeature) {
    const ride = racer.waterfall;
    if (!ride || (feature.hitMask & (1 << racer.id)) || this.runTime - feature.hitAt < 0.08) return;
    const lateralDistance = Math.abs(ride.lateral - feature.lateral);
    if (lateralDistance > feature.width * 0.62 + 0.085) return;
    feature.hitMask |= 1 << racer.id;
    feature.hitAt = this.runTime;
    ride.hitCount++;
    racer.waterfallHits = ride.hitCount;
    const side = ride.lateral >= feature.lateral ? 1 : -1;
    const strength = feature.kind === 'rock' ? 0.26 : feature.kind === 'tube' ? 0.34 : 0.2;
    ride.lateral = clamp(ride.lateral + side * strength, -0.84, 0.84);
    ride.targetLateral = clamp(ride.lateral + side * (feature.kind === 'tube' ? 0.16 : 0.1), -0.84, 0.84);
    racer.vz = side * (feature.kind === 'rock' ? 1.55 : feature.kind === 'tube' ? 2.2 : 1.15);
    ride.velocity *= feature.kind === 'rock' ? 0.54 : feature.kind === 'tube' ? 0.43 : 0.7;
    ride.impact = 1;
    this.emit(racer.x, racer.y, racer.z, feature.kind === 'rock' ? 15 : 10, feature.kind === 'tube' ? '#8be7e0' : '#d9c49b', 180);
    if (!racer.id) {
      this.snapshot.score += feature.kind === 'rock' ? 95 : feature.kind === 'tube' ? 140 : 70;
      this.shake = feature.kind === 'rock' ? 3.8 : 2.2;
      this.audio.play(feature.kind === 'tube' ? 'boost' : 'bump');
      this.say(feature.kind === 'tube' ? 'TUBE SHOT! AIM FOR THE NEXT REBOUND.' : feature.kind === 'ramp' ? 'RAMP REBOUND! KEEP IT PINNED.' : 'ROCK SPLIT! LEFT OR RIGHT.');
    }
  }

  private leaveWaterfall(racer: Racer) {
    const exitX = WATERFALL_EXIT_X + 100;
    racer.x = exitX; racer.z = clamp(-racer.waterfallLateral * (LANE.far + 70), LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
    const surface = this.surfaceAt(racer.x, racer.z);
    racer.y = surface.y - RADIUS; racer.vx = Math.max(390, racer.launchSpeed / 0.16 * 0.82);
    racer.vy = surface.slope * racer.vx; racer.vz = 0; racer.grounded = true;
    racer.waterfall = null; racer.waterfallPhase = null; racer.waterfallProgress = 0;
    racer.waterfallDepth = 0; racer.waterfallLateral = 0; racer.waterfallHits = 0;
    racer.lastGroundedAt = this.runTime; racer.recoveryUntil = this.runTime + 0.35;
    if (!racer.id) { this.say('BOTTOM ROCKS. WELCOME TO THE MINE TUNNELS.'); this.audio.play('land'); this.shake = 4; }
  }

  private stepWaterfall(racer: Racer, dt: number) {
    const ride = racer.waterfall;
    if (!ride) return;
    const phaseDuration = ride.phase === 'wall-impact' ? 0.78 : ride.phase === 'river' ? 1.08 : ride.phase === 'bottom-impact' ? 0.82 : 1;
    ride.progress += dt / phaseDuration;
    ride.impact = Math.max(0, ride.impact - dt * (ride.phase === 'wall-impact' ? 1.8 : 2.8));
    racer.waterfallPhase = ride.phase; racer.waterfallProgress = clamp(ride.progress, 0, 1);
    if (ride.phase === 'wall-impact') {
      racer.x = WATERFALL_WALL_X; racer.y = this.y(WATERFALL_WALL_X) - RADIUS;
      if (ride.progress >= 1) { ride.phase = 'river'; ride.progress = 0; ride.velocity = 0.11; }
    } else if (ride.phase === 'river') {
      const t = clamp(ride.progress, 0, 1);
      racer.x = WATERFALL_WALL_X + (WATERFALL_START_X - WATERFALL_WALL_X) * t;
      racer.y = this.y(racer.x) - RADIUS - 28 - Math.sin(t * Math.PI) * 24;
      ride.lateral += (ride.targetLateral - ride.lateral) * Math.min(1, dt * 3);
      racer.z = -ride.lateral * (LANE.far + 70); racer.vz = 0;
      if (ride.progress >= 1) { ride.phase = 'vertical-drop'; ride.progress = 0; ride.velocity = 0.135; ride.impact = 0; }
    } else if (ride.phase === 'vertical-drop') {
      const target = clamp(-laneZ(racer.targetLane) / (LANE.far + 70), -0.82, 0.82);
      const lateralAcceleration = (target - ride.lateral) * 8.5 - racer.vz * 4.6;
      racer.vz = clamp(racer.vz + lateralAcceleration * dt, -3.5, 3.5);
      ride.lateral = clamp(ride.lateral + racer.vz * dt, -0.86, 0.86);
      ride.targetLateral = target;
      ride.velocity = Math.min(0.205, ride.velocity + dt * 0.006);
      const previousDepth = ride.depth;
      ride.depth = clamp(ride.depth + ride.velocity * dt, 0, 1);
      ride.progress = ride.depth;
      racer.x = WATERFALL_START_X + (WATERFALL_EXIT_X - WATERFALL_START_X) * ride.depth;
      racer.y = GROUND + ride.depth * 720;
      racer.z = -ride.lateral * (LANE.far + 70);
      for (const feature of this.waterfallFeatures) {
        if (previousDepth < feature.depth && ride.depth >= feature.depth) this.hitWaterfallFeature(racer, feature);
      }
      if (ride.depth >= 1) { ride.phase = 'bottom-impact'; ride.progress = 0; ride.impact = 1; }
    } else if (ride.phase === 'bottom-impact') {
      racer.x = WATERFALL_EXIT_X; racer.y = this.y(WATERFALL_EXIT_X) - RADIUS - Math.max(0, 1 - ride.progress) * 90;
      racer.z = -ride.lateral * (LANE.far + 70);
      if (ride.progress >= 1) this.leaveWaterfall(racer);
    }
    racer.waterfallDepth = ride.depth; racer.waterfallLateral = ride.lateral; racer.waterfallHits = ride.hitCount;
    racer.rotation += dt * (ride.phase === 'vertical-drop' ? 16 : 7);
    racer.distance = Math.max(racer.distance, clamp((racer.x - START_X) / 2, 0, TRACK_DISTANCE));
    if (racer.waterfall) {
      racer.vx = ride.phase === 'vertical-drop' ? ride.velocity * (WATERFALL_EXIT_X - WATERFALL_START_X) : 0;
      racer.vy = ride.phase === 'vertical-drop' ? ride.velocity * 720 : 0;
    }
  }

  private updateWaterfallFrame() {
    const ride = this.player.waterfall;
    this.waterfallCamera = ride ? {
      phase: ride.phase, progress: clamp(ride.progress, 0, 1), depth: ride.depth,
      lateral: ride.lateral, impact: ride.impact, hitCount: ride.hitCount,
    } : null;
  }

  private stepRace(dt: number) {
    this.runTime += dt;
    for (const racer of this.racers) {
      if (racer.finished) continue;
      if (racer.id && this.runTime >= racer.nextDecision) this.driveCPU(racer);
      this.stepRacer(racer, dt);
    }
    this.resolveBumps();
    this.resolvePickups();
    this.updateWaterfallFrame();
    this.refreshSnapshot();
    if (this.player.finished) {
      this.snapshot.settling = true;
      this.snapshot.finishWait = Math.max(0, Math.ceil(10 - (this.runTime - this.player.finishTime!)));
      if (this.racers.every((racer) => racer.finished) || this.snapshot.finishWait === 0) this.finish(true);
    }
    else if (this.runTime > 300) this.finish(false);
  }

  private driveCPU(racer: Racer) {
    const difficulty = this.config?.difficulty ?? 'racer';
    const reaction = difficulty === 'rookie' ? 0.43 : difficulty === 'veteran' ? 0.13 : 0.19;
    racer.nextDecision = this.runTime + reaction + racer.id * 0.023;
    if (racer.falling || racer.loopRide || racer.waterfall || racer.finished || this.runTime < racer.steerLockedUntil) return;
    const lookAhead = clamp(racer.vx * (difficulty === 'rookie' ? 0.54 : difficulty === 'veteran' ? 0.92 : 0.75), 360, 1350);
    const current = racer.targetLane;
    let bestLane = current; let bestScore = -Infinity;
    const seen = new Set<Obstacle>();
    const supplies = new Set<AirPickup>();
    for (let key = Math.floor(racer.x / BUCKET); key <= Math.floor((racer.x + lookAhead) / BUCKET); key++) {
      for (const obstacle of this.buckets.get(key) ?? EMPTY) seen.add(obstacle);
      for (const pickup of this.pickupBuckets.get(key) ?? []) if (pickup.collectedBy === null) supplies.add(pickup);
    }
    for (let lane = Math.max(0, current - 1); lane <= Math.min(3, current + 1); lane++) {
      let score = lane === current ? 1.1 : -0.25;
      for (const obstacle of seen) {
        const distance = obstacle.x - racer.x;
        if (distance < -obstacle.width || distance > lookAhead || !occupiesLane(obstacle, laneZ(lane), 0)) continue;
        if (obstacle.kind === 'gap') score -= distance < racer.vx * 0.45 ? 13 : 7;
        else if (!racer.visited.has(obstacle) && !(obstacle.hit && (obstacle.kind === 'tnt' || obstacle.kind === 'sheep'))) {
          const proximity = 1 - clamp(distance / lookAhead, 0, 1);
          score += (obstacle.kind === 'boost' ? 6 : obstacle.kind === 'fire-ring' ? 4.6 : obstacle.kind === 'tnt' ? 3 : obstacle.kind === 'spring' ? 2.5
            : obstacle.kind === 'rock-bumper' || obstacle.kind === 'spiked-rock' ? -1.8 : obstacle.kind === 'crate' || obstacle.kind === 'skull-box' ? -1.2
              : obstacle.kind === 'sheep' ? -0.8 : 0.4) * proximity;
        }
      }
      for (const pickup of supplies) {
        const distance = pickup.x - racer.x;
        if (pickup.lane !== lane || distance < 45 || distance > lookAhead) continue;
        const needed = pickup.kind === 'shield' ? racer.shieldUntil <= this.runTime : pickup.kind === 'fuel' ? racer.boosts < 2 : racer.bounces < 3;
        score += (needed ? 4.8 : 0.8) * (1 - distance / lookAhead) * (this.y(pickup.x) - pickup.y > 160 ? 0.35 : 1);
      }
      for (const other of this.racers) {
        if (other.id === racer.id || other.finished || other.falling) continue;
        if (Math.abs(other.x - racer.x) < 125 && Math.abs(other.z - laneZ(lane)) < 90) {
          score += racer.weight > other.weight * 1.05 && randomAt(racer.id, this.runTime) > 0.43 ? 3.8 : -2.8;
        }
      }
      if (score > bestScore) { bestScore = score; bestLane = lane; }
    }
    if (this.runTime - racer.lastLaneChange > (difficulty === 'rookie' ? 0.9 : difficulty === 'veteran' ? 0.48 : 0.66)) this.setLane(racer, bestLane);
    const soon = racer.x + racer.vx * 0.22;
    if (this.canHop(racer) && (this.inGap(soon, racer.z) || this.inGap(soon, laneZ(racer.targetLane)))) this.performHop(racer);
    if (this.canHop(racer) && racer.bounces) {
      for (const obstacle of seen) {
        if (obstacle.kind !== 'fire-ring' || obstacle.lane !== racer.targetLane || obstacle.x < racer.x + 90 || obstacle.x > racer.x + racer.vx * 0.46) continue;
        this.performBounce(racer);
        break;
      }
    }
    if (this.canHop(racer)) {
      const timing = hopTiming(racer.vx, 290 * weightImpulse(racer.weight) * racer.hopFactor);
      for (const pickup of supplies) {
        const distance = pickup.x - racer.x;
        if (Math.abs(racer.z - pickup.z) < 52 && this.y(pickup.x) - pickup.y < 145 && distance > timing - 65 && distance < timing + 65 && !this.inGap(pickup.x, racer.z)) {
          this.performHop(racer); break;
        }
      }
    }
    if (!racer.grounded && racer.bounces && this.inGap(racer.x + racer.vx * 0.1, racer.z)
      && racer.y > this.y(racer.x) - 105 && racer.vy > 90) this.performBounce(racer);
    if (racer.boosts && this.runTime - racer.lastBoostAt > (difficulty === 'rookie' ? 5.5 : difficulty === 'veteran' ? 2.8 : 3.4) && this.runTime > 1.6
      && (racer.vx < racer.launchSpeed / 0.16 * 0.92 || racer.x < this.player.x - 85)) this.performBoost(racer);
  }

  private stepRacer(racer: Racer, dt: number) {
    const oldX = racer.x;
    if (racer.waterfall) {
      this.stepWaterfall(racer, dt);
      return;
    }
    if (racer.falling) {
      racer.fallingFor += dt; racer.vy += this.gravityAt(racer.x) * (this.inCliffSection(racer.x) ? 1.1 : 1) * dt;
      racer.x += racer.vx * dt * 0.45; racer.y += racer.vy * dt; racer.rotation += 9 * dt;
      if (racer.fallingFor > 0.72) this.recover(racer);
      return;
    }
    if (!racer.loopRide) {
      const steeringSurface = surfaceTypeAt(racer.x);
      const lateralTraction = steeringSurface === 'wet_wood' ? 0.6 : steeringSurface === 'moss_rock' ? 0.72 : 1;
      const response = (this.runTime < racer.steerLockedUntil ? 7 : 33) * racer.handling * lateralTraction;
      const steering = (laneZ(racer.targetLane) - racer.z) * response - racer.vz * 9.5 * Math.sqrt(racer.handling) * lateralTraction;
      racer.vz = clamp(racer.vz + steering * dt, -650 * racer.handling, 650 * racer.handling);
      const previousZ = racer.z;
      racer.z = clamp(racer.z + racer.vz * dt, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
      if (racer.z === previousZ && Math.abs(racer.vz) > 1) racer.vz *= -0.25;
      racer.lane = closestLane(racer.z);
    }
    const dragFactor = 120 / racer.weight;
    if (racer.loopRide) {
      const ride = racer.loopRide; const loop = loopGeometry(ride.obstacle, this.options.course);
      racer.z += (obstacleZ(ride.obstacle) - racer.z) * Math.min(1, dt * 16); racer.vz = 0;
      if (ride.entryProgress < 1) {
        ride.entryProgress = Math.min(1, ride.entryProgress + dt * 7);
        const t = ride.entryProgress; const ease = t * t * (3 - 2 * t);
        const x = loop.x + Math.sin(ride.entryAngle) * loop.ballRadius;
        const y = loop.y + Math.cos(ride.entryAngle) * loop.ballRadius + this.y(x) - this.y(loop.x);
        racer.x = ride.entry.x + (x - ride.entry.x) * ease; racer.y = ride.entry.y + (y - ride.entry.y) * ease;
      } else {
        ride.angle += Math.min(ride.speed, 760) / loop.ballRadius * dt;
        racer.x = loop.x + Math.sin(ride.angle) * loop.ballRadius;
        racer.y = loop.y + Math.cos(ride.angle) * loop.ballRadius + this.y(racer.x) - this.y(loop.x);
      }
      racer.rotation += Math.min(ride.speed, 760) / RADIUS * dt;
      if (ride.angle >= ride.exitAngle) {
        racer.x = loop.x + 3; racer.y = loop.y + loop.ballRadius + this.y(racer.x) - this.y(loop.x);
        racer.vx = Math.min(racer.maximumSpeed, ride.speed * 1.08); racer.vy = this.slope(racer.x) * racer.vx;
        racer.loopRide = null; racer.grounded = false;
        if (!racer.id) { this.snapshot.score += 350; this.counts.loops++; this.say('A WELL-ROUNDED BAD IDEA.'); this.audio.play('loop'); }
      }
    } else {
      if (racer.bufferedJump >= this.runTime && this.canHop(racer)) this.performHop(racer);
      const before = this.surfaceAt(racer.x, racer.z);
      if (racer.grounded && !this.inGap(racer.x, racer.z)) {
        const downhill = this.gravityAt(racer.x, before.slope) * before.slope / (1 + before.slope * before.slope) / 1.4;
        const resistance = 7 + racer.vx * 0.025 * Math.sqrt(dragFactor) + racer.vx * racer.vx * 0.000009 * dragFactor;
        racer.vx = Math.max(0, racer.vx + (downhill - resistance) * dt);
        racer.vy = before.slope * racer.vx; racer.x += racer.vx * dt;
        if (this.inGap(racer.x, racer.z)) { racer.grounded = false; racer.y += racer.vy * dt; }
        else {
          const surface = this.surfaceAt(racer.x, racer.z);
          racer.y = surface.y - RADIUS; racer.vy = surface.slope * racer.vx; racer.lastGroundedAt = this.runTime;
          if (surface.ramp && !racer.visited.has(surface.ramp) && (racer.x - surface.ramp.x) / surface.ramp.width > 0.94) {
            racer.vy -= 155 * weightImpulse(racer.weight); racer.y -= 2; racer.grounded = false;
            racer.visited.add(surface.ramp);
            if (!racer.id) { this.snapshot.score += 75; this.audio.play('launch'); }
          }
        }
      } else {
        racer.grounded = false;
        const airDrag = this.inCliffSection(racer.x) ? 0.007 : 0.009;
        racer.vx *= Math.exp(-airDrag * dragFactor * dt);
        racer.vy += this.gravityAt(racer.x) * dt; racer.x += racer.vx * dt; racer.y += racer.vy * dt;
      }
      for (const obstacle of this.nearby(racer.x)) {
        const repeatableRock = obstacle.kind === 'rock-bumper' || obstacle.kind === 'spiked-rock';
        if ((!repeatableRock && racer.visited.has(obstacle)) || obstacle.kind === 'gap' || obstacle.kind === 'ramp'
          || obstacle.kind === 'rock-wall' || obstacle.kind === 'mine-rail' || obstacle.kind === 'mine-split'
          || (obstacle.section === 'stage2' && obstacle.x >= WATERFALL_WALL_X) || !occupiesLane(obstacle, racer.z)) continue;
        if ((obstacle.kind === 'tnt' || obstacle.kind === 'sheep' || obstacle.kind === 'blimp' || obstacle.kind === 'sign') && obstacle.hit) continue;
        if (repeatableRock) {
          this.hitRock(racer, obstacle);
          continue;
        }
        if (obstacle.kind === 'fire-ring') {
          const center = obstacle.x + obstacle.width / 2;
          const ringY = this.y(center) - (obstacle.altitude ?? 130);
          const ringRadius = obstacle.width * 0.42;
          if (Math.abs(racer.x - center) < ringRadius + RADIUS && Math.hypot(racer.x - center, racer.y - ringY) < ringRadius + RADIUS) {
            this.hitObstacle(racer, obstacle);
          }
          continue;
        }
        if (obstacle.kind === 'loop') {
          const loop = loopGeometry(obstacle, this.options.course); const dx = racer.x - loop.x;
          const dy = racer.y - (this.y(racer.x) - this.y(loop.x)) - loop.y;
          if (Math.abs(dx) <= loop.radius + RADIUS && Math.abs(Math.hypot(dx, dy) - loop.ballRadius) < RADIUS * 1.12 && racer.vx > 245) {
            const angle = (Math.atan2(dx, dy) + TAU) % TAU;
            racer.visited.add(obstacle); racer.grounded = false; racer.targetLane = obstacle.lane ?? PLAYER_LANE;
            const loopSpan = obstacle.section === 'stage2' ? TAU : TAU * 0.65;
            racer.loopRide = { obstacle, angle, entryAngle: angle, exitAngle: angle + loopSpan,
              speed: Math.max(650, racer.vx), entry: { x: racer.x, y: racer.y }, entryProgress: 0 };
            if (!racer.id) { this.say('HOLD ON TO YOUR GOBLIN.'); this.audio.play('boost'); }
            break;
          }
        } else {
          const center = obstacle.x + obstacle.width / 2; const base = this.y(center);
          if (obstacle.kind === 'blimp' || obstacle.kind === 'sign') {
            const alt = obstacle.altitude ?? (obstacle.kind === 'blimp' ? 540 : 315);
            const obsBottom = base - alt + 20;
            const obsTop = base - alt - obstacle.height - 20;
            if (Math.abs(racer.x - center) < obstacle.width / 2 + RADIUS && racer.y + RADIUS > obsTop && racer.y - RADIUS < obsBottom) {
              this.hitObstacle(racer, obstacle);
            }
          } else {
            if (Math.abs(racer.x - center) < obstacle.width / 2 + RADIUS && racer.y + RADIUS > base - obstacle.height && racer.y - RADIUS < base + 10) this.hitObstacle(racer, obstacle);
          }
        }
      }
      const surface = this.surfaceAt(racer.x, racer.z); const gap = this.inGap(racer.x, racer.z);
      if (gap && racer.y > this.y(racer.x) + RADIUS + 8) { racer.falling = true; racer.fallingFor = 0; racer.grounded = false; }
      const normalSpeed = racer.vy - surface.slope * racer.vx;
      if (!gap && !racer.falling && !racer.loopRide && !racer.grounded && racer.y + RADIUS >= surface.y && normalSpeed >= 0) {
        racer.y = surface.y - RADIUS;
        const restitution = clamp(0.28 * Math.sqrt(dragFactor), 0.17, 0.38);
        if (normalSpeed > 260) {
          racer.vy = surface.slope * racer.vx - normalSpeed * restitution;
          this.emit(racer.x, surface.y, racer.z, 3, '#b8a77b', 70);
          if (!racer.id) {
            this.audio.play('land');
            if (normalSpeed > 360) this.shake = Math.min(4.5, normalSpeed / 160);
          }
        } else { racer.grounded = true; racer.lastGroundedAt = this.runTime; racer.vy = surface.slope * racer.vx; }
      }
      racer.rotation += (racer.x - oldX) * (racer.grounded ? Math.sqrt(1 + surface.slope * surface.slope) : 1) / RADIUS;
    }
    racer.vx = clamp(racer.vx, 0, racer.maximumSpeed);
    racer.distance = Math.max(racer.distance, clamp((racer.x - START_X) / 2, 0, TRACK_DISTANCE));
    racer.stoppedFor = racer.vx < 40 && !racer.loopRide ? racer.stoppedFor + dt : 0;
    if (racer.x >= WATERFALL_WALL_X && racer.x < WATERFALL_START_X && oldX < WATERFALL_START_X && !racer.falling && !racer.waterfall) {
      this.enterWaterfall(racer);
      return;
    }
    if (racer.x >= FINISH && !racer.falling) {
      racer.finishTime = this.runTime - dt + dt * clamp((FINISH - oldX) / Math.max(1, racer.x - oldX), 0, 1);
      racer.finished = true; racer.distance = TRACK_DISTANCE; racer.x = FINISH + 12; racer.vx = racer.vy = racer.vz = 0;
      if (racer.id) racer.y = this.y(racer.x) - RADIUS;
    } else if (racer.y > this.y(racer.x) + 360 || racer.stoppedFor > 3) this.recover(racer);
  }

  private recover(racer: Racer) {
    racer.x = Math.max(START_X + 440, racer.x - 200);
    let lane = racer.targetLane;
    for (let i = 0; i < 4; i++) {
      const candidate = (lane + i) % 4;
      if (!this.inGap(racer.x, laneZ(candidate)) && !this.inGap(racer.x + 110, laneZ(candidate))) { lane = candidate; break; }
    }
    racer.targetLane = racer.lane = lane; racer.z = laneZ(lane); racer.vz = 0;
    racer.y = this.surfaceAt(racer.x, racer.z).y - RADIUS;
    racer.vx = 390; racer.vy = this.slope(racer.x) * racer.vx;
    racer.falling = false; racer.grounded = true; racer.loopRide = null;
    racer.fallingFor = racer.stoppedFor = 0; racer.immuneUntil = this.runTime + 1.5;
    racer.recoveryUntil = this.runTime + 1; racer.steerLockedUntil = this.runTime + 0.15;
    racer.boosts = Math.max(1, racer.boosts);
    racer.shieldUntil = -100;
    Object.assign(racer.previous, { x: racer.x, y: racer.y, z: racer.z, rotation: racer.rotation });
    if (!racer.id) { this.snapshot.score = Math.max(0, this.snapshot.score - 100); this.trail.length = 0; this.say('PIT CREW TO THE RESCUE. KEEP RACING.'); }
  }

  private resolveBumps() {
    for (let i = 0; i < this.racers.length - 1; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i]; const b = this.racers[j];
      if (a.finished || b.finished || a.falling || b.falling || a.loopRide || b.loopRide || a.waterfall || b.waterfall
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
      if (!shieldA) this.shove(a, -side, kick * Math.min(1.65, b.weight / a.weight));
      if (!shieldB) this.shove(b, side, kick * Math.min(1.65, a.weight / b.weight));
      const x = (a.x + b.x) / 2; const z = (a.z + b.z) / 2;
      this.emit(x, (a.y + b.y) / 2, z, 10, '#ffe0a0', 140);
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

  private resolvePickups() {
    this.pickupCandidates.clear();
    for (const racer of this.racers) {
      if (racer.falling || racer.finished || racer.loopRide || racer.waterfall) continue;
      const first = Math.floor(Math.min(racer.previous.x, racer.x) / BUCKET);
      const last = Math.floor(Math.max(racer.previous.x, racer.x) / BUCKET);
      for (let key = first; key <= last; key++) for (const pickup of this.pickupBuckets.get(key) ?? []) {
        if (pickup.collectedBy === null) this.pickupCandidates.add(pickup);
      }
    }
    for (const pickup of this.pickupCandidates) {
      let winner: Racer | null = null;
      let earliest = Infinity;
      const y = pickupY(pickup, this.runTime, this.reducedMotion);
      for (const racer of this.racers) {
        if (racer.falling || racer.finished || racer.loopRide || racer.waterfall || Math.abs(racer.z - pickup.z) > 110 || Math.abs(racer.x - pickup.x) > 160) continue;
        const time = pickupIntercept(racer.previous, racer, pickup, y);
        if (time !== null && time < earliest) { earliest = time; winner = racer; }
      }
      if (winner) this.collectPickup(winner, pickup);
    }
  }

  private collectPickup(racer: Racer, pickup: AirPickup) {
    pickup.collectedBy = racer.id;
    pickup.collectedAt = this.runTime;
    racer.pickupAt = this.runTime;
    let notice = '';
    if (pickup.kind === 'fuel') {
      const full = racer.boosts >= 2;
      racer.boosts = Math.min(2, racer.boosts + 1);
      racer.vx = Math.min(racer.maximumSpeed, racer.vx + 115 * weightImpulse(racer.weight) * racer.boostFactor);
      if (racer.grounded) racer.vy = this.surfaceAt(racer.x, racer.z).slope * racer.vx;
      notice = full ? 'FUEL SURGE. BOOST TANK ALREADY FULL.' : 'ROCKET FUEL! +1 BOOST';
    } else if (pickup.kind === 'shield') {
      racer.shieldUntil = this.runTime + SHIELD_DURATION;
      notice = 'SKYWARD SHIELD! ONE SHOVE. SIX SECONDS.';
    } else {
      const full = racer.bounces >= 3;
      racer.bounces = Math.min(3, racer.bounces + 1);
      notice = full ? 'AIR BOUNCES FULL. +75 CHAOS.' : 'AIR SPRING! +1 AIR BOUNCE';
    }
    this.emit(pickup.x, pickup.y, pickup.z, 13, POWERUPS[pickup.kind].color, 120);
    if (!racer.id) {
      this.pickupCount++; this.snapshot.score += 75;
      this.snapshot.lastPickup = pickup.kind;
      this.snapshot.pickupNoticeUntil = this.runTime + 2.5;
      this.audio.play('pickup'); this.say(notice);
    }
  }

  private hitRock(racer: Racer, obstacle: Obstacle) {
    const bit = 1 << racer.id;
    if ((obstacle.hitMask ?? 0) & bit && this.time - obstacle.hitAt < 0.16) return;
    const centerX = obstacle.x + obstacle.width / 2;
    const centerZ = obstacleZ(obstacle);
    const base = this.y(centerX);
    const centerY = base - obstacle.height * 0.52;
    const radius = obstacle.width * 0.43;
    const dx = racer.x - centerX;
    const dz = (racer.z - centerZ) * 0.72;
    const distance = Math.hypot(dx, dz);
    if (distance > radius + RADIUS || Math.abs(racer.y - centerY) > radius + RADIUS) return;
    const planar = distance || 1;
    const nx = dx / planar;
    const nz = dz / planar;
    const normalSpeed = racer.vx * nx + racer.vz * nz;
    const restitution = obstacle.kind === 'rock-bumper' ? 1.45 : 0.92;
    if (normalSpeed < 0) {
      racer.vx -= (1 + restitution) * normalSpeed * nx;
      racer.vz -= (1 + restitution) * normalSpeed * nz / 0.72;
    }
    const push = radius + RADIUS - distance + 2;
    racer.x += nx * push; racer.z = clamp(racer.z + nz * push / 0.72, LANE.near + RADIUS + 6, LANE.far - RADIUS - 6);
    racer.vx = clamp(Math.max(150, racer.vx + (obstacle.kind === 'rock-bumper' ? 70 : 25)), 0, racer.maximumSpeed);
    racer.vz = clamp(racer.vz, -720, 720);
    racer.grounded = false; racer.lastGroundedAt = -100;
    obstacle.hitAt = this.time; obstacle.hitMask = (obstacle.hitMask ?? 0) | bit;
    this.emit(centerX, centerY, centerZ, obstacle.kind === 'rock-bumper' ? 12 : 18, obstacle.kind === 'rock-bumper' ? '#c7b18a' : '#d7d0b4', obstacle.kind === 'rock-bumper' ? 135 : 180);
    if (!racer.id) {
      this.snapshot.score += obstacle.kind === 'rock-bumper' ? 90 : 45;
      this.shake = obstacle.kind === 'spiked-rock' ? 4.5 : 2.4;
      this.audio.play('bump');
      this.say(obstacle.kind === 'rock-bumper' ? 'CROWN BUMPER! KEEP THE MOMENTUM.' : 'SPIKED ROCK! PICK A CLEANER LINE.');
    }
  }

  private hitObstacle(racer: Racer, obstacle: Obstacle) {
    racer.visited.add(obstacle); obstacle.hitAt = this.time; obstacle.hitMask = (obstacle.hitMask ?? 0) | (1 << racer.id);
    const impulse = weightImpulse(racer.weight);
    const x = obstacle.x + obstacle.width / 2; const y = this.y(x); const z = obstacleZ(obstacle);
    if (obstacle.kind !== 'boost') racer.lastGroundedAt = -100;
    switch (obstacle.kind) {
      case 'boost':
        racer.vx += 400 * impulse * racer.boostFactor;
        if (racer.grounded) racer.vy = this.surfaceAt(racer.x, racer.z).slope * racer.vx;
        racer.boosts = Math.min(2, racer.boosts + 1); this.emit(x, y - 6, z, 8, '#ffbd6a', 135);
        if (!racer.id) { this.snapshot.score += 100; this.audio.play('boost'); this.say('THROTTLE REFILLED. TRY NOT TO SHARE.'); }
        break;
      case 'spring':
        racer.vy = -660 * impulse * racer.hopFactor; racer.vx += 90 * impulse; racer.grounded = false;
        racer.bounces = Math.min(3, racer.bounces + 1); this.emit(x, y - 24, z, 10, '#a1e1bd', 160);
        if (!racer.id) { this.snapshot.score += 100; this.audio.play('bounce'); this.say('SPRING BREAK! +1 BOUNCE'); }
        break;
      case 'fire-ring':
        // +50 km/h in the HUD's 0.16 velocity-to-km/h conversion.
        racer.vx = Math.min(racer.maximumSpeed, racer.vx + 312.5 * impulse);
        racer.fireUntil = this.runTime + 1.35;
        racer.immuneUntil = Math.max(racer.immuneUntil, this.runTime + 0.72);
        this.emit(x, y - (obstacle.altitude ?? 130), z, 22, '#ff8b3d', 240);
        this.emit(x, y - (obstacle.altitude ?? 130), z, 10, '#ffe0a0', 155);
        if (!racer.id) {
          this.snapshot.score += 250;
          this.shake = 3.2;
          this.audio.play('boost');
          this.say('FIRE RING! HYPER-SPEED ENGAGED.');
        }
        break;
      case 'crate':
        racer.vx = Math.min(racer.maximumSpeed, racer.vx + 45 * impulse);
        racer.vy -= 100 * impulse; racer.grounded = false;
        this.emit(x, y - 35, z, 8, '#c38b51', 100);
        if (!racer.id) { this.snapshot.score += 40; this.audio.play('bump'); this.say('TIMBER IN THE FAST LINE.'); }
        break;
      case 'skull-box':
        racer.vx = Math.max(130, racer.vx * 0.72);
        racer.vy -= 155 * impulse; racer.vz += (racer.z <= z ? -1 : 1) * 180;
        racer.grounded = false;
        this.emit(x, y - 38, z, 13, '#c7d0ad', 125);
        if (!racer.id) { this.snapshot.score += 80; this.shake = 2.6; this.audio.play('bump'); this.say('SKULL BOX! THE SHORTCUT BIT BACK.'); }
        break;
      case 'tnt':
        obstacle.hit = true; racer.vx += 300 * impulse; racer.vy = -450 * impulse; racer.grounded = false;
        this.emit(x, y - 30, z, 25, '#ffb25e', 245);
        if (!racer.id) { this.snapshot.score += 200; this.counts.explosions++; this.shake = 9; this.audio.play('boom'); this.say('THAT WAS PROBABLY LOAD-BEARING.'); }
        break;
      case 'sheep':
        obstacle.hit = true; racer.vx += 75 * impulse; racer.vy = -290 * impulse; racer.grounded = false;
        this.airSheep.push({ x, y: y - 40, z, vx: racer.vx * 0.51, vy: -520, rotation: 0, life: 3.1 });
        this.emit(x, y - 35, z, 8, '#e9e1c6', 115);
        if (!racer.id) { this.snapshot.score += 125; this.counts.sheep++; this.audio.play('sheep'); this.say('BAA-D DECISIONS.'); }
        break;
      case 'blimp':
        obstacle.hit = true;
        racer.vy = Math.max(950, 1200 * impulse);
        racer.vx = Math.max(120, racer.vx * 0.72);
        racer.grounded = false;
        this.emit(x, y - (obstacle.altitude ?? 540), z, 35, '#ff4400', 320);
        this.emit(x, y - (obstacle.altitude ?? 540), z, 20, '#ffbb00', 250);
        this.emit(x, y - (obstacle.altitude ?? 540), z, 20, '#333333', 180);
        for (const o of this.nearby(x)) {
          if (o.kind === 'sign' && !o.hit && Math.abs((o.x + o.width / 2) - x) < 90) {
            o.hit = true;
            o.hitAt = this.time;
          }
        }
        if (!racer.id) {
          this.snapshot.score += 250;
          this.counts.explosions++;
          this.shake = 6.0;
          this.audio.play('boom');
          this.say('AIRSPACE RESTRICTED! DOWN YOU GO!');
        }
        break;
      case 'sign':
        obstacle.hit = true;
        racer.vx = Math.max(90, racer.vx * 0.52);
        racer.vy = Math.max(90, racer.vy + 140);
        const signY = y - (obstacle.altitude ?? 315);
        this.emit(x, signY, z, 24, '#8b5a2b', 210);
        this.emit(x, signY, z, 16, '#c29a64', 170);
        this.emit(x, signY, z, 12, '#ffffff', 130);
        if (!racer.id) {
          this.snapshot.score += 150;
          this.shake = 3.2;
          this.audio.play('land');
          this.say('WATCH THE ROAD SIGNS! SPEED REDUCED.');
        }
        break;
      default: break;
    }
  }

  private refreshSnapshot() {
    const player = this.player;
    this.snapshot.distance = Math.round(player.distance); this.snapshot.progress = player.distance / TRACK_DISTANCE;
    this.snapshot.speed = player.finished ? 0 : Math.round((player.loopRide ? Math.min(760, player.loopRide.speed) : Math.hypot(player.vx, player.vy)) * 0.16);
    this.snapshot.inLoop = !!player.loopRide; this.snapshot.falling = player.falling || !!player.waterfall;
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
    this.renderer.destroy(); this.audio.destroy(); this.buckets.clear(); this.pickupBuckets.clear(); this.pickupCandidates.clear();
  }
}