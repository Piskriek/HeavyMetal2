import type { GameAssets } from './assets';
import { ArenaEnvironment } from './environment';
import { buildModelAtlas, createBoostTexture, type ModelAtlas, type ModelName } from './model-atlas';
import { RangeCamera, edgeAnchor } from './projection';
import { CanvasLayer, RenderBudget } from './performance';
import {
  FINISH, GROUND, GRAVITY, HEIGHT, LANE, LANE_WIDTH, LAUNCHER, RADIUS,
  closestLane, courseY, courseSlope, decalOpacity, decalRadius, laneZ, launchVelocity, loopGeometry,
  obstacleZ, occupiesLane, rampSurface, type Obstacle, type RacerFrame, type SceneFrame,
} from './scene';
import { RACER_DEFINITIONS, type CourseId } from './types';
import { POWERUPS, pickupY, type AirPickup } from './powerups';
import { polygon, texturedQuad, type Quad } from './texture';

const TAU = Math.PI * 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
interface DrawItem { depth: number; draw: () => void }

export class RangeRenderer {
  readonly view = new RangeCamera();
  private readonly context: CanvasRenderingContext2D;
  private readonly environment: ArenaEnvironment;
  private readonly models: ModelAtlas;
  private readonly boostTile = createBoostTexture();
  private readonly budget = new RenderBudget();
  private readonly sceneryLayer = new CanvasLayer();
  private readonly foregroundLayer = new CanvasLayer();
  private readonly glows = new Map<string, HTMLCanvasElement>();
  private readonly commands: DrawItem[] = [];
  private readonly visibleObstacles: Obstacle[] = [];
  private readonly visiblePickups: AirPickup[] = [];
  private readonly balls: CanvasImageSource[];
  private cssWidth = 1440;
  private cssHeight = HEIGHT;
  private scale = 1;
  private lastCamera = Infinity;
  private lastCameraY = Infinity;
  private courseRevision = 0;
  private lastObstacles: Obstacle[] | null = null;
  private pendingResize = false;
  private frame!: SceneFrame;
  private hintPosition = '';
  private aiming = false;
  private metrics = { started: 0, frames: 0, work: 0 };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly assets: GameAssets, course: CourseId = 'ridge') {
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) throw new Error('Your browser does not support canvas.');
    this.context = context;
    this.models = buildModelAtlas(assets);
    this.environment = new ArenaEnvironment(context, this.view, assets, course);
    this.balls = RACER_DEFINITIONS.map((racer) => {
      if (assets.raceBalls?.[racer.id]) return assets.raceBalls[racer.id];
      const image = document.createElement('canvas'); image.width = image.height = 160;
      const paint = image.getContext('2d')!;
      paint.drawImage(assets.ball.image, 5, 5, 150, 150);
      if (racer.id) {
        paint.globalCompositeOperation = 'source-atop'; paint.globalAlpha = 0.19;
        paint.fillStyle = racer.color; paint.fillRect(0, 0, 160, 160);
        paint.globalAlpha = 1; paint.globalCompositeOperation = 'source-over';
      }
      paint.strokeStyle = racer.color; paint.lineWidth = 5;
      paint.beginPath(); paint.arc(80, 80, 63, 0.22, 1.35); paint.stroke();
      return image;
    });
    for (const color of ['#040c07', '#ffae59', '#ffe1ac', '#ffc16c', '#95dbb7', '#333d2d']) this.radial(color);
  }

  resize(width: number, height: number) {
    this.cssWidth = Math.max(1, width); this.cssHeight = Math.max(1, height);
    this.budget.configure(this.cssWidth, this.cssHeight, this.frame?.options.graphics ?? 'auto');
    this.resizeBuffer();
    this.view.configure(width / height * HEIGHT, this.view.offset, this.frame?.options.downrange ?? true);
  }

  private resizeBuffer() {
    const width = Math.max(1, Math.round(this.cssWidth * this.budget.density));
    const height = Math.max(1, Math.round(this.cssHeight * this.budget.density));
    if (width !== this.canvas.width || height !== this.canvas.height) {
      this.canvas.width = width; this.canvas.height = height;
      this.sceneryLayer.invalidate(); this.foregroundLayer.invalidate();
    }
    this.scale = height / HEIGHT; this.pendingResize = false;
  }

  get lowDetail() { return this.budget.lowDetail; }

  loopExitPosition(obstacle: Obstacle) {
    const loop = loopGeometry(obstacle, this.frame?.options.course ?? 'ridge');
    return { x: loop.x, y: loop.y + loop.ballRadius };
  }

  render(frame: SceneFrame, intervalMs = 16.67) {
    const start = performance.now();
    if (intervalMs > 500) this.metrics = { started: start, frames: 0, work: 0 };
    const changed = frame.options.graphics !== this.frame?.options.graphics;
    this.frame = frame;
    this.budget.configure(this.cssWidth, this.cssHeight, frame.options.graphics);
    if (this.pendingResize || changed) this.resizeBuffer();
    this.view.configure(this.view.width, frame.camera, frame.options.downrange, frame.cameraY);
    if (frame.waterfall) {
      this.renderWaterfall();
      this.lastCamera = frame.camera; this.lastCameraY = frame.cameraY;
      return;
    }
    if (frame.obstacles !== this.lastObstacles) { this.courseRevision++; this.lastObstacles = frame.obstacles; }
    this.environment.begin(frame, this.lowDetail);
    this.updateHint();
    const range = this.view.visibleSpan(LANE.near - 100, LANE.far + 100, 320);
    this.visibleObstacles.length = 0;
    for (const obstacle of frame.obstacles) {
      if (obstacle.x - obstacle.width > range.end) break;
      if (obstacle.x + obstacle.width >= range.start) this.visibleObstacles.push(obstacle);
    }
    this.visiblePickups.length = 0;
    for (const pickup of frame.pickups) {
      if (pickup.x > range.end) break;
      if (pickup.x >= range.start && (pickup.collectedBy === null || frame.runTime - pickup.collectedAt < 0.45)) this.visiblePickups.push(pickup);
    }
    const context = this.context;
    context.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'low';
    this.environment.drawLandscape();
    context.save();
    if (frame.options.screenShake && !frame.reducedMotion && frame.snapshot.status === 'flying' && frame.shake > 0.1) {
      context.translate(Math.sin(frame.time * 91) * frame.shake * 0.24, Math.cos(frame.time * 73) * frame.shake * 0.2);
    }
    const still = Math.abs(frame.camera - this.lastCamera) < 0.001 && Math.abs(frame.cameraY - this.lastCameraY) < 0.001;
    const key = `${this.view.revision}:${this.courseRevision}:${frame.camera.toFixed(3)}:${frame.cameraY.toFixed(3)}:${this.lowDetail}`;
    const scenery = () => { this.environment.drawTerrain(); this.environment.drawGrandstands(); this.environment.drawTrack(); this.environment.drawMineOverlay(); };
    if (still) this.sceneryLayer.draw(context, this.view.width, HEIGHT, this.scale, key, (target) => this.environment.withContext(target, scenery));
    else scenery();
    this.drawGroundEffects();
    this.renderGroundShadowAndHighlight();
    this.drawActors();
    this.drawTrajectory();
    this.environment.drawTracksideLights();
    if (still) this.foregroundLayer.draw(context, this.view.width, HEIGHT, this.scale, key, (target) => this.environment.withContext(target, () => this.environment.drawForeground()));
    else this.environment.drawForeground();
    context.restore();
    this.drawAltitudeIndicator();
    this.drawOffScreenIndicator();
    this.lastCamera = frame.camera; this.lastCameraY = frame.cameraY;
    const work = performance.now() - start;
    if (this.budget.sample(work, start, frame.snapshot.status === 'flying')) this.pendingResize = true;
    this.metrics.started ||= start; this.metrics.frames++; this.metrics.work += work;
    if (start - this.metrics.started > 1500) {
      this.canvas.dataset.renderFps = (this.metrics.frames * 1000 / (start - this.metrics.started)).toFixed(1);
      this.canvas.dataset.renderCpuMs = (this.metrics.work / this.metrics.frames).toFixed(2);
      this.canvas.dataset.renderResolution = `${this.canvas.width}x${this.canvas.height}`;
      this.canvas.dataset.renderer = 'prebaked-atlas';
      this.metrics = { started: start, frames: 0, work: 0 };
    }
  }

  private renderWaterfall() {
    const frame = this.frame;
    const waterfall = frame.waterfall;
    if (!waterfall) return;
    const context = this.context;
    context.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillStyle = '#02070a'; context.fillRect(0, 0, this.view.width, HEIGHT);

    const backdrop = this.assets.waterfallHeadon?.image;
    if (backdrop) {
      const sourceW = backdrop.naturalWidth || this.assets.waterfallHeadon.width;
      const sourceH = backdrop.naturalHeight || this.assets.waterfallHeadon.height;
      const cover = Math.max(this.view.width / sourceW, HEIGHT / sourceH);
      const drawW = sourceW * cover;
      const drawH = sourceH * cover;
      const sway = frame.reducedMotion ? 0 : Math.sin(frame.time * 0.32) * 8;
      context.save(); context.globalAlpha = waterfall.phase === 'wall-impact' ? 0.82 : 1;
      context.drawImage(backdrop, (this.view.width - drawW) / 2 + sway, (HEIGHT - drawH) / 2, drawW, drawH);
      context.restore();
    }

    // The generated art supplies the deep cliff silhouette; these gradients push
    // the edges toward black so the eye stays on the head-on water column.
    const sideFade = context.createLinearGradient(0, 0, this.view.width, 0);
    sideFade.addColorStop(0, '#010407e8'); sideFade.addColorStop(0.16, '#01040718');
    sideFade.addColorStop(0.5, '#00000000'); sideFade.addColorStop(0.84, '#01040718'); sideFade.addColorStop(1, '#010407e8');
    context.fillStyle = sideFade; context.fillRect(0, 0, this.view.width, HEIGHT);
    const lowerFade = context.createLinearGradient(0, HEIGHT * 0.58, 0, HEIGHT);
    lowerFade.addColorStop(0, '#05171a00'); lowerFade.addColorStop(1, '#020609c9');
    context.fillStyle = lowerFade; context.fillRect(0, HEIGHT * 0.56, this.view.width, HEIGHT * 0.44);

    const center = this.view.width * 0.5;
    const top = 62;
    const bottom = HEIGHT - 94;
    const waterWidth = Math.min(this.view.width * 0.52, 730);
    const waterLeft = center - waterWidth / 2;
    const flow = frame.reducedMotion ? 0 : frame.time * 180;
    // White-blue flow ribbons remain animated even if the source backdrop is
    // static, making the river visibly run toward the camera.
    context.save(); context.globalAlpha = waterfall.phase === 'wall-impact' ? 0.38 : 0.7;
    for (let i = 0; i < (this.lowDetail ? 9 : 18); i++) {
      const x = waterLeft + (i * 83 + Math.sin(i * 3.1) * 25) % Math.max(40, waterWidth);
      const start = top + (i * 37) % 120;
      const length = 160 + (i % 5) * 58;
      context.strokeStyle = i % 3 ? '#a6eff1a8' : '#e4ffffbc';
      context.lineWidth = (1.5 + i % 3) * (0.7 + waterfall.depth * 0.35);
      context.beginPath();
      context.moveTo(x + Math.sin(flow * 0.004 + i) * 8, start);
      context.bezierCurveTo(x - 22, start + length * 0.34, x + 28, start + length * 0.68, x + Math.sin(flow * 0.006 + i) * 14, start + length);
      context.stroke();
    }
    context.restore();

    for (const feature of frame.waterfallFeatures) {
      const y = top + feature.depth * (bottom - top);
      const x = center + feature.lateral * waterWidth * 0.42;
      const hitAge = frame.runTime - feature.hitAt;
      this.drawWaterfallFeature(feature, x, y, waterWidth, hitAge);
    }

    if (waterfall.phase === 'wall-impact') this.drawHeadOnWall(waterfall.impact);
    if (waterfall.phase === 'river') this.drawRiverLip(waterfall.progress);
    if (waterfall.phase === 'bottom-impact') this.drawBottomRocks(waterfall.impact);

    // Every racer gets a head-on marker during the shared drop. The player is
    // painted last and larger, so the camera lock reads even in a crowded fall.
    const fallingRacers = frame.racers.filter((racer) => racer.waterfallPhase !== null);
    for (const racer of fallingRacers) {
      const depth = racer.waterfallPhase === 'wall-impact' ? 0.02
        : racer.waterfallPhase === 'river' ? 0.035 + racer.waterfallProgress * 0.04 : racer.waterfallDepth;
      const x = center + racer.waterfallLateral * waterWidth * 0.42;
      const y = top + depth * (bottom - top);
      this.drawWaterfallBall(racer, x, y, racer.id === 0 ? 42 : 31);
    }

    const vignette = context.createRadialGradient(center, HEIGHT * 0.44, 80, center, HEIGHT * 0.45, Math.max(this.view.width, HEIGHT) * 0.7);
    vignette.addColorStop(0, '#00000000'); vignette.addColorStop(0.72, '#00000022'); vignette.addColorStop(1, '#000000c8');
    context.fillStyle = vignette; context.fillRect(0, 0, this.view.width, HEIGHT);

    context.fillStyle = '#e8fff4'; context.font = '900 20px "Barlow Condensed", sans-serif';
    context.textAlign = 'left'; context.fillText('WATERFALL // PINBALL DROP', 28, 38);
    context.fillStyle = '#94e6df'; context.font = '700 11px "Space Mono", monospace';
    const phase = waterfall.phase === 'wall-impact' ? 'ROCK WALL IMPACT' : waterfall.phase === 'river' ? 'RIVER LIP' : waterfall.phase === 'bottom-impact' ? 'BOTTOM ROCKS' : 'VERTICAL DROP';
    context.fillText(phase, 30, HEIGHT - 33);
    context.textAlign = 'right'; context.fillText(`${Math.round(waterfall.depth * 100)}% DESCENT  /  ${waterfall.hitCount} REBOUND${waterfall.hitCount === 1 ? '' : 'S'}`, this.view.width - 28, HEIGHT - 33);
    context.textAlign = 'left';
    context.fillStyle = '#bceee8'; context.font = '700 10px "Space Mono", monospace';
    context.fillText('← A / D →  STEER THE FALL', 30, 57);
    const barWidth = Math.min(330, this.view.width * 0.3);
    context.fillStyle = '#031012aa'; context.fillRect(center - barWidth / 2, 24, barWidth, 5);
    context.fillStyle = '#78e0d6'; context.fillRect(center - barWidth / 2, 24, barWidth * clamp(waterfall.depth, 0, 1), 5);
  }

  private drawWaterfallFeature(feature: SceneFrame['waterfallFeatures'][number], x: number, y: number, waterWidth: number, hitAge: number) {
    const context = this.context;
    const depthScale = 0.72 + feature.depth * 0.4;
    const width = feature.width * waterWidth * depthScale;
    const height = Math.max(18, feature.height * 210 * depthScale);
    const hit = hitAge >= 0 && hitAge < 0.5;
    context.save();
    if (hit) { this.glow(x, y, width * 0.9, feature.kind === 'tube' ? '#76e5dd' : '#ffd08a', (1 - hitAge / 0.5) * 0.25); }
    if (feature.kind === 'rock') {
      context.translate(x, y);
      context.fillStyle = '#101b1b'; context.strokeStyle = '#8ca49b'; context.lineWidth = 3;
      context.beginPath(); context.moveTo(-width * 0.52, height * 0.34); context.lineTo(-width * 0.35, -height * 0.46); context.lineTo(width * 0.05, -height * 0.62); context.lineTo(width * 0.52, -height * 0.2); context.lineTo(width * 0.42, height * 0.43); context.lineTo(0, height * 0.58); context.closePath(); context.fill(); context.stroke();
      context.fillStyle = '#6f8b80'; context.globalAlpha = 0.58; context.beginPath(); context.moveTo(-width * 0.28, -height * 0.32); context.lineTo(width * 0.02, -height * 0.48); context.lineTo(width * 0.29, -height * 0.16); context.lineTo(-width * 0.02, -height * 0.1); context.closePath(); context.fill();
    } else if (feature.kind === 'ramp') {
      const side = feature.lateral < 0 ? -1 : 1;
      context.translate(x, y); context.rotate(side * 0.16);
      context.fillStyle = '#3b2c24'; context.strokeStyle = '#e7bb78'; context.lineWidth = 3;
      context.beginPath(); context.moveTo(-width * 0.52, height * 0.44); context.lineTo(width * 0.51, height * 0.44); context.lineTo(width * 0.28, -height * 0.52); context.lineTo(-width * 0.36, -height * 0.32); context.closePath(); context.fill(); context.stroke();
      context.strokeStyle = '#8fe6d9'; context.lineWidth = 2; context.beginPath(); context.moveTo(-width * 0.32, height * 0.22); context.lineTo(width * 0.3, height * 0.22); context.stroke();
    } else {
      const side = feature.lateral < 0 ? -1 : 1;
      context.translate(x, y); context.rotate(side * 0.28);
      context.strokeStyle = '#d2b06d'; context.lineWidth = Math.max(10, width * 0.16); context.lineCap = 'round';
      context.beginPath(); context.arc(0, 0, width * 0.48, Math.PI * (side < 0 ? 0.7 : 0.3), Math.PI * (side < 0 ? 1.75 : 1.3)); context.stroke();
      context.strokeStyle = '#58b9b3'; context.lineWidth = Math.max(4, width * 0.055); context.beginPath(); context.arc(0, 0, width * 0.48, Math.PI * (side < 0 ? 0.7 : 0.3), Math.PI * (side < 0 ? 1.75 : 1.3)); context.stroke();
    }
    context.restore();
  }

  private drawWaterfallBall(racer: RacerFrame, x: number, y: number, radius: number) {
    const context = this.context;
    this.glow(x + radius * 0.25, y - radius * 0.35, radius * 1.6, racer.color, racer.id === 0 ? 0.2 : 0.1);
    context.save(); context.translate(x, y); context.rotate(racer.rotation);
    context.drawImage(this.balls[racer.id], -radius, -radius, radius * 2, radius * 2);
    context.restore();
    if (racer.id === 0) {
      context.strokeStyle = '#ffe0a1'; context.lineWidth = 2; context.beginPath(); context.arc(x, y, radius + 7, 0, TAU); context.stroke();
    }
  }

  private drawHeadOnWall(impact: number) {
    const context = this.context;
    const h = 114 + impact * 16;
    context.save(); context.translate(this.view.width / 2, HEIGHT - 42);
    context.fillStyle = '#121a18'; context.strokeStyle = '#b99b6b'; context.lineWidth = 4;
    context.beginPath(); context.moveTo(-this.view.width * 0.56, 42); context.lineTo(-this.view.width * 0.5, -h * 0.66); context.lineTo(-this.view.width * 0.3, -h); context.lineTo(this.view.width * 0.32, -h * 0.94); context.lineTo(this.view.width * 0.52, -h * 0.58); context.lineTo(this.view.width * 0.56, 42); context.closePath(); context.fill(); context.stroke();
    context.strokeStyle = '#263934'; context.lineWidth = 2;
    for (let i = -4; i <= 4; i++) { context.beginPath(); context.moveTo(i * 82, -h * 0.6); context.lineTo(i * 62 + Math.sin(i) * 24, 24); context.stroke(); }
    context.restore();
  }

  private drawRiverLip(progress: number) {
    const context = this.context;
    const y = HEIGHT * 0.7 + progress * 28;
    context.fillStyle = '#b9f5e6a0'; context.beginPath(); context.ellipse(this.view.width / 2, y, this.view.width * 0.34, 46, 0, 0, TAU); context.fill();
    context.strokeStyle = '#e4fff2cc'; context.lineWidth = 3; context.beginPath(); context.ellipse(this.view.width / 2, y, this.view.width * 0.34, 46, 0, 0, TAU); context.stroke();
  }

  private drawBottomRocks(impact: number) {
    const context = this.context;
    context.save(); context.globalAlpha = 0.72 + impact * 0.28;
    context.fillStyle = '#172421'; context.strokeStyle = '#9eb5a0'; context.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const x = (i + 0.5) * this.view.width / 7;
      const r = 36 + (i % 3) * 17;
      context.beginPath(); context.ellipse(x, HEIGHT - 45 - (i % 2) * 12, r, r * 0.58, (i - 3) * 0.18, 0, TAU); context.fill(); context.stroke();
    }
    context.restore();
  }

  private updateHint() {
    if (this.frame.snapshot.status === 'ready') {
      const point = this.p(this.frame.ball.x, this.frame.ball.y, this.frame.ball.z);
      const position = `${point.x}:${point.y}:${this.view.width}`;
      if (position !== this.hintPosition) {
        this.canvas.parentElement?.style.setProperty('--launch-x', `${point.x / this.view.width * 100}%`);
        this.canvas.parentElement?.style.setProperty('--launch-y', `${point.y / HEIGHT * 100}%`);
        this.hintPosition = position;
      }
    }
    if (this.aiming !== this.frame.dragging) {
      this.aiming = this.frame.dragging;
      if (this.canvas.parentElement) this.canvas.parentElement.dataset.aiming = String(this.aiming);
    }
  }

  private p(x: number, y: number, z = 0) { return this.view.project(x, y, z); }
  private y(x: number) { return courseY(x, this.frame.options.course); }
  private slope(x: number) { return courseSlope(x, this.frame.options.course); }
  private queue(x: number, z: number, draw: () => void) { this.commands.push({ depth: this.view.depthAt(x, z), draw }); }
  private inGap(x: number, z: number) { return this.visibleObstacles.some((o) => o.kind === 'gap' && x > o.x && x < o.x + o.width && occupiesLane(o, z, 0)); }

  private surface(x: number, z: number) {
    let y = this.y(x);
    for (const o of this.visibleObstacles) if (o.kind === 'ramp' && x >= o.x && x <= o.x + o.width && occupiesLane(o, z, 5)) y = Math.min(y, rampSurface(o, x, this.frame.options.course));
    return y;
  }

  private groundQuad(x: number, end: number, near: number, far: number, height = 0): Quad {
    return [this.p(x, this.y(x) + height, far), this.p(end, this.y(end) + height, far), this.p(end, this.y(end) + height, near), this.p(x, this.y(x) + height, near)];
  }

  private contact(x: number, radius: number, color: string, opacity: number, z = 0, y = this.y(x)) {
    if (this.inGap(x, z)) return;
    const p = this.p(x, y - 0.6, z);
    const a = this.p(x + radius, y + this.slope(x) * radius - 0.6, z);
    const b = this.p(x, y - 0.6, z + radius * 0.67);
    const context = this.context;
    context.save(); context.globalAlpha = opacity;
    context.transform(a.x - p.x, a.y - p.y, b.x - p.x, b.y - p.y, p.x, p.y);
    context.drawImage(this.radial(color), -1, -1, 2, 2); context.restore();
  }

  private drawGroundEffects() {
    for (const obstacle of this.visibleObstacles) {
      if (obstacle.kind === 'gap') continue;
      const x = obstacle.kind === 'loop' ? obstacle.x : obstacle.x + obstacle.width / 2;
      const z = obstacleZ(obstacle);
      if ((obstacle.kind === 'tnt' || obstacle.kind === 'sheep') && obstacle.hit) {
        if (obstacle.kind === 'tnt') this.contact(x, 69, '#040c07', 0.5, z);
        continue;
      }
      this.contact(x, obstacle.kind === 'loop' ? 128 : obstacle.width * 0.54, '#040c07', 0.33, z);
      if (obstacle.kind === 'boost' || obstacle.kind === 'spring') this.contact(x, obstacle.width, obstacle.kind === 'boost' ? '#ffae59' : '#95dbb7', 0.18, z);
    }
    for (const racer of this.frame.racers) {
      if (this.frame.camera < 1000) this.contact(LAUNCHER.x - 59, 149, '#040c07', 0.35, laneZ(racer.homeLane));
      const y = this.surface(racer.x, racer.z);
      const point = this.p(racer.x, y, racer.z);
      if (racer.y <= y + 15 && point.x > -90 && point.x < this.view.width + 90) {
        const altitude = Math.max(0, y - RADIUS - racer.y);
        this.contact(racer.x, 34 + altitude * 0.028, '#040c07', Math.max(0.08, 0.48 - altitude / 720), racer.z, y);
      }
    }
    for (const pickup of this.visiblePickups) if (pickup.collectedBy === null) {
      this.contact(pickup.x, 24, POWERUPS[pickup.kind].color, 0.11, pickup.z);
    }
  }

  /**
   * TICKET-07: magical rune circle + softened drop shadow projected onto the track
   * directly beneath the airborne player ball, so the landing lane is always readable.
   */
  private renderGroundShadowAndHighlight() {
    const { status } = this.frame.snapshot;
    if (status !== 'flying' && status !== 'paused') return;
    const ball = this.frame.ball;
    const ground = this.surface(ball.x, ball.z);
    const altitude = ground - RADIUS - ball.y;
    if (altitude <= 2) return;
    const point = this.p(ball.x, ground - 0.6, ball.z);
    if (point.x < -170 || point.x > this.view.width + 170 || point.y < -90 || point.y > HEIGHT + 60) return;
    const radius = decalRadius(altitude);
    const opacity = decalOpacity(altitude);
    const gap = this.inGap(ball.x, ball.z);
    const context = this.context;
    // Soft ambient-occlusion shadow, squashed onto the deck; it never floats over a gap.
    if (!gap) this.contact(ball.x, radius * 0.72, '#040c07', opacity * 0.5, ball.z, ground);
    const color = gap ? '#ff7a52' : '#ffc16c';
    // Rune circle drawn in the ground plane via a slope-aware basis (unit space = one radius).
    const a = this.p(ball.x + radius, ground + this.slope(ball.x) * radius - 0.6, ball.z);
    const b = this.p(ball.x, ground - 0.6, ball.z + radius * 0.67);
    context.save();
    context.translate(point.x, point.y);
    context.transform(a.x - point.x, a.y - point.y, b.x - point.x, b.y - point.y, 0, 0);
    context.strokeStyle = color;
    context.lineWidth = 0.085;
    context.beginPath(); context.arc(0, 0, 1, 0, TAU); context.stroke();
    context.globalAlpha = opacity * 0.72;
    context.lineWidth = 0.042;
    context.beginPath(); context.arc(0, 0, 0.62, 0, TAU); context.stroke();
    // Goblin gear markings: radial teeth plus two chevrons that read as "land here".
    context.lineWidth = 0.05;
    for (let tooth = 0; tooth < 12; tooth++) {
      const angle = tooth * TAU / 12 + (tooth % 2 ? 0.12 : -0.12);
      context.beginPath();
      context.moveTo(Math.cos(angle) * 0.76, Math.sin(angle) * 0.76);
      context.lineTo(Math.cos(angle) * 0.93, Math.sin(angle) * 0.93);
      context.stroke();
    }
    context.lineWidth = 0.055;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(side * 0.3, -0.2); context.lineTo(side * 0.16, 0); context.lineTo(side * 0.3, 0.2);
      context.stroke();
    }
    context.restore();
    this.glow(point.x, point.y, radius * point.scale * 1.12, gap ? '#ffae59' : '#ffe1ac', opacity * 0.13);
    // Lane boundary illumination: light the edges of the lane band under the ball so
    // mid-air A/D steering can line up the landing before touchdown.
    const lane = closestLane(ball.z);
    for (const edge of [laneZ(lane) - LANE_WIDTH / 2 + 6, laneZ(lane) + LANE_WIDTH / 2 - 6]) {
      const strip = this.groundQuad(ball.x - 150, ball.x + 150, edge - 4, edge + 4, -2);
      polygon(context, strip);
      context.fillStyle = gap ? `rgba(255, 122, 82, ${opacity * 0.4})` : `rgba(255, 214, 140, ${opacity * 0.34})`;
      context.fill();
    }
  }

  private queueModel(name: ModelName, x: number, width = 1, height = 1, z = 0) {
    const model = this.models[this.frame.options.downrange ? 'range' : 'side'][name];
    const point = this.p(x, this.y(x), z);
    const shear = this.slope(x) / (this.frame.options.downrange ? Math.cos(20 * Math.PI / 180) : 1);
    const factor = point.scale / model.referenceScale;
    for (const layer of model.layers) this.queue(x, z + layer.depth, () => {
      const context = this.context;
      context.save();
      context.transform(factor * width, factor * width * shear, 0, factor * height, point.x, point.y);
      context.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height);
      context.restore();
    });
  }

  private drawActors() {
    this.commands.length = 0;
    for (const obstacle of this.visibleObstacles) {
      if (obstacle.kind === 'gap') continue;
      const z = obstacleZ(obstacle);
      if (obstacle.kind === 'loop') this.queueModel('loop', obstacle.x, obstacle.height / 322, obstacle.height / 322, z);
      else if (obstacle.kind === 'ramp') this.queueModel('ramp', obstacle.x + obstacle.width / 2, obstacle.width / 190, obstacle.height / 113, z);
      else this.queue(obstacle.x + obstacle.width / 2, z, () => this.drawObstacle(obstacle));
    }
    for (const pickup of this.visiblePickups) this.queue(pickup.x, pickup.z, () => this.drawPickup(pickup));
    if (this.frame.camera < 1000) for (const racer of this.frame.racers) {
      this.queueModel('sling', LAUNCHER.x, 1, 1, laneZ(racer.homeLane));
      this.queueBands(racer);
    }
    const finish = this.p(FINISH, this.y(FINISH));
    if (finish.x > -500 && finish.x < this.view.width + 500) this.queue(FINISH, LANE.near - 24, () => this.drawFinish());
    for (const racer of this.frame.racers) {
      const point = this.p(racer.x, racer.y, racer.z);
      if (point.x < -100 || point.x > this.view.width + 100) continue;
      this.queue(racer.x, racer.z - 1, () => { if (!racer.id) this.drawTrail(); this.drawBall(racer); });
    }
    for (const sheep of this.frame.sheep) {
      const p = this.p(sheep.x, sheep.y, sheep.z - 9);
      if (p.x < -90 || p.x > this.view.width + 90) continue;
      this.queue(sheep.x, sheep.z - 9, () => {
        this.context.save(); this.context.translate(p.x, p.y); this.context.rotate(sheep.rotation);
        this.context.drawImage(this.assets.sheep.image, -33 * p.scale, -30 * p.scale, 66 * p.scale, 62 * p.scale); this.context.restore();
      });
    }
    const stride = this.lowDetail ? 2 : 1;
    for (let i = 0; i < this.frame.particles.length; i += stride) {
      const particle = this.frame.particles[i];
      const p = this.p(particle.x, particle.y, particle.z);
      if (p.x < -10 || p.x > this.view.width + 10 || p.y > HEIGHT) continue;
      this.queue(particle.x, particle.z - 1, () => {
        this.context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        this.context.fillStyle = particle.color;
        this.context.fillRect(p.x, p.y, Math.max(1, particle.size * p.scale * 0.65), Math.max(1, particle.size * p.scale * 0.65));
        this.context.globalAlpha = 1;
      });
    }
    this.commands.sort((a, b) => b.depth - a.depth);
    for (const command of this.commands) command.draw();
  }

  private queueBands(racer: RacerFrame) {
    const ready = this.frame.snapshot.status === 'ready';
    const time = this.frame.runTime;
    const snap = 1 - Math.pow(1 - clamp(time / 0.12, 0, 1), 3);
    const recoil = time < 0.8 ? Math.sin(time * 30) * Math.exp(-time * 7) * 16 : 0;
    const origin = racer.launchOrigin;
    const ball = ready ? racer : { x: origin.x + (LAUNCHER.x - 12 + recoil - origin.x) * snap, y: origin.y + (LAUNCHER.tipY + 15 - origin.y) * snap };
    const z = laneZ(racer.homeLane);
    for (const side of [-1, 1]) {
      const a = this.p(LAUNCHER.x - 6, LAUNCHER.tipY, z + side * LAUNCHER.halfWidth);
      const b = this.p(ball.x - 12, ball.y + 7, z + side * 12);
      this.queue((LAUNCHER.x + ball.x) / 2, z + side * 62, () => {
        const context = this.context;
        context.lineCap = 'round'; context.lineWidth = 6 * a.scale; context.strokeStyle = '#41291a';
        context.beginPath(); context.moveTo(a.x, a.y); context.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 4, b.x, b.y); context.stroke();
        context.lineWidth = 3 * a.scale; context.strokeStyle = side < 0 ? '#bd965b' : '#816644'; context.stroke();
      });
    }
    if (ready) this.queue(ball.x, z - 18, () => {
      const point = this.p(ball.x, ball.y, z);
      this.context.strokeStyle = '#64472b'; this.context.lineWidth = 7 * point.scale;
      this.context.beginPath(); this.context.arc(point.x, point.y, 33 * point.scale, 2.1, 3.8); this.context.stroke();
    });
  }

  private drawPickup(pickup: AirPickup) {
    const y = pickupY(pickup, this.frame.runTime, this.frame.reducedMotion);
    const point = this.p(pickup.x, y, pickup.z);
    if (point.x < -90 || point.x > this.view.width + 90 || point.y < -70 || point.y > HEIGHT + 40) return;
    const context = this.context;
    const definition = POWERUPS[pickup.kind];
    if (pickup.collectedBy !== null) {
      const age = this.frame.runTime - pickup.collectedAt;
      const opacity = Math.max(0, 1 - age / 0.45);
      context.save(); context.globalAlpha = opacity; context.strokeStyle = definition.color; context.lineWidth = 2 * point.scale;
      context.beginPath(); context.arc(point.x, point.y, (24 + age * 65) * point.scale, 0, TAU); context.stroke(); context.restore();
      return;
    }
    this.glow(point.x, point.y, 53 * point.scale, definition.color, 0.13);
    const image = this.assets.pickupSprites?.[pickup.kind];
    if (image) context.drawImage(image, point.x - 34 * point.scale, point.y - 34 * point.scale, 68 * point.scale, 68 * point.scale);
    else {
      context.strokeStyle = definition.color; context.lineWidth = 3 * point.scale;
      context.beginPath(); context.arc(point.x, point.y, 23 * point.scale, 0, TAU); context.stroke();
    }
    context.fillStyle = '#eee9c9';
    const sparkle = this.frame.reducedMotion ? 0 : Math.sin(this.frame.runTime * 2 + pickup.id) * 3;
    context.fillRect(point.x - 22 * point.scale, point.y - (27 + sparkle) * point.scale, 2 * point.scale, 2 * point.scale);
  }

  private drawSign(obstacle: Obstacle) {
    const context = this.context;
    const { x } = obstacle;
    const centerX = x + obstacle.width / 2;
    const baseY = this.y(centerX);
    const altitude = obstacle.altitude ?? 315;

    // Select sprite
    const sprite = obstacle.signType === 'tnt' ? this.assets.signTnt
      : obstacle.signType === 'parts' ? this.assets.signParts
      : this.assets.signSheep;

    const img = sprite.image;
    const imgW = img.naturalWidth || sprite.width;
    const imgH = img.naturalHeight || sprite.height;
    const aspect = imgW / imgH;

    // Maintain true aspect ratio - never stretch!
    const height = Math.max(120, Math.min(170, obstacle.height || 145));
    const spanZ = height * aspect;
    const zCenter = obstacleZ(obstacle);
    const signFarZ = zCenter + spanZ / 2;
    const signNearZ = zCenter - spanZ / 2;

    // Blimp hover bobbing in sync with overhead blimp
    const hover = this.frame.reducedMotion ? 0 : Math.sin(this.frame.runTime * 1.8 + centerX * 0.02) * 12;

    const yBottom = baseY - altitude + hover;
    const yTop = yBottom - height;

    // Thickness in 3D along X axis for perceived volumetric depth
    const thickness = 16;
    const xFront = centerX - thickness / 2;
    const xBack = centerX + thickness / 2;

    // Find overhead blimp to attach ropes to
    const blimp = this.visibleObstacles.find((o) => o.kind === 'blimp' && Math.abs((o.x + o.width / 2) - centerX) < 80);
    const blimpAlt = blimp?.altitude ?? (altitude + height + 50);
    const blimpX = blimp ? blimp.x + blimp.width / 2 : centerX;
    // Gondola position at the bottom of the blimp
    const gondolaY = baseY - blimpAlt + hover + 42;

    const gondolaFar = this.p(blimpX, gondolaY, zCenter + spanZ * 0.28);
    const gondolaNear = this.p(blimpX, gondolaY, zCenter - spanZ * 0.28);
    const signFarEye = this.p(xFront, yTop, signFarZ - 16);
    const signNearEye = this.p(xFront, yTop, signNearZ + 16);

    const avgScale = (signFarEye.scale + signNearEye.scale) / 2;

    if (!obstacle.hit) {
      // 3D Slab Thickness: 8 projected corners of the billboard
      const f0 = this.p(xFront, yTop, signFarZ);
      const f1 = this.p(xFront, yTop, signNearZ);
      const f2 = this.p(xFront, yBottom, signNearZ);
      const f3 = this.p(xFront, yBottom, signFarZ);

      const b0 = this.p(xBack, yTop, signFarZ);
      const b1 = this.p(xBack, yTop, signNearZ);
      const b2 = this.p(xBack, yBottom, signNearZ);
      const b3 = this.p(xBack, yBottom, signFarZ);

      // Back face (dark rustic wood planks)
      polygon(context, [b0, b1, b2, b3]);
      context.fillStyle = '#1c1007';
      context.fill();
      context.strokeStyle = '#2b180a';
      context.lineWidth = 1.5 * avgScale;
      context.stroke();

      // Top thickness face (illuminated by overhead sky light)
      polygon(context, [f0, f1, b1, b0]);
      context.fillStyle = '#54361e';
      context.fill();

      // Front rim highlight bevel along top edge
      context.strokeStyle = '#7d5030';
      context.lineWidth = 1.8 * avgScale;
      context.beginPath();
      context.moveTo(f0.x, f0.y);
      context.lineTo(f1.x, f1.y);
      context.stroke();

      // Back rim shadow line
      context.strokeStyle = '#321c0d';
      context.lineWidth = 1.2 * avgScale;
      context.beginPath();
      context.moveTo(b0.x, b0.y);
      context.lineTo(b1.x, b1.y);
      context.stroke();

      // Near side thickness face (visible from camera yaw angle)
      polygon(context, [f1, f2, b2, b1]);
      context.fillStyle = '#352012';
      context.fill();
      context.strokeStyle = '#201309';
      context.lineWidth = 1.2 * avgScale;
      context.stroke();

      // Bottom thickness face (deep underside shadow)
      polygon(context, [f3, f2, b2, b3]);
      context.fillStyle = '#120904';
      context.fill();

      // Front face with crisp unstretched billboard artwork
      texturedQuad(context, img, { x: 0, y: 0, width: imgW, height: imgH }, [f0, f1, f2, f3]);

      // Subtle solid wooden border around front face
      context.strokeStyle = '#271509';
      context.lineWidth = 2.2 * avgScale;
      polygon(context, [f0, f1, f2, f3]);
      context.stroke();

      // Draw short twisted suspension ropes from blimp gondola down to billboard
      context.save();

      // Far rope
      context.strokeStyle = '#180d05';
      context.lineWidth = 4 * signFarEye.scale;
      context.beginPath();
      context.moveTo(gondolaFar.x, gondolaFar.y);
      context.lineTo(signFarEye.x, signFarEye.y);
      context.stroke();

      context.strokeStyle = '#6e4722';
      context.lineWidth = 2.4 * signFarEye.scale;
      context.beginPath();
      context.moveTo(gondolaFar.x, gondolaFar.y);
      context.lineTo(signFarEye.x, signFarEye.y);
      context.stroke();

      context.strokeStyle = '#a67c48';
      context.lineWidth = 1.2 * signFarEye.scale;
      context.setLineDash([3 * signFarEye.scale, 3 * signFarEye.scale]);
      context.beginPath();
      context.moveTo(gondolaFar.x, gondolaFar.y);
      context.lineTo(signFarEye.x, signFarEye.y);
      context.stroke();
      context.setLineDash([]);

      // Near rope
      context.strokeStyle = '#180d05';
      context.lineWidth = 4.5 * signNearEye.scale;
      context.beginPath();
      context.moveTo(gondolaNear.x, gondolaNear.y);
      context.lineTo(signNearEye.x, signNearEye.y);
      context.stroke();

      context.strokeStyle = '#6e4722';
      context.lineWidth = 2.6 * signNearEye.scale;
      context.beginPath();
      context.moveTo(gondolaNear.x, gondolaNear.y);
      context.lineTo(signNearEye.x, signNearEye.y);
      context.stroke();

      context.strokeStyle = '#a67c48';
      context.lineWidth = 1.3 * signNearEye.scale;
      context.setLineDash([3 * signNearEye.scale, 3 * signNearEye.scale]);
      context.beginPath();
      context.moveTo(gondolaNear.x, gondolaNear.y);
      context.lineTo(signNearEye.x, signNearEye.y);
      context.stroke();
      context.setLineDash([]);

      // Heavy forged iron mounting brackets and eyelets on top rim of the sign
      for (const eye of [signFarEye, signNearEye]) {
        // Vertical iron mounting strap bolted to the timber face
        context.fillStyle = '#222222';
        context.fillRect(eye.x - 3.5 * eye.scale, eye.y - 2 * eye.scale, 7 * eye.scale, 14 * eye.scale);
        context.strokeStyle = '#444444';
        context.lineWidth = 1 * eye.scale;
        context.strokeRect(eye.x - 3.5 * eye.scale, eye.y - 2 * eye.scale, 7 * eye.scale, 14 * eye.scale);

        // Mounting rivets
        context.fillStyle = '#888888';
        context.beginPath();
        context.arc(eye.x, eye.y + 4 * eye.scale, 1.2 * eye.scale, 0, TAU);
        context.arc(eye.x, eye.y + 9 * eye.scale, 1.2 * eye.scale, 0, TAU);
        context.fill();

        // Eyelet ring where rope enters
        context.fillStyle = '#181818';
        context.beginPath();
        context.arc(eye.x, eye.y - 2 * eye.scale, 4.2 * eye.scale, 0, TAU);
        context.fill();
        context.strokeStyle = '#555555';
        context.lineWidth = 1.5 * eye.scale;
        context.stroke();
      }
      context.restore();
    } else {
      // 3D Shatter / break animation!
      const age = this.frame.time - obstacle.hitAt;
      if (age > 3.0) return;
      const fade = Math.max(0, 1 - Math.max(0, age - 1.8) / 1.2);
      const halfW = Math.floor(imgW / 2);
      const zMid = (signFarZ + signNearZ) / 2;

      context.save();
      context.globalAlpha = fade;

      // Draw severed rope ends dangling from blimp gondola
      context.strokeStyle = '#754d24';
      context.lineWidth = 2.5 * avgScale;
      context.beginPath();
      context.moveTo(gondolaFar.x, gondolaFar.y);
      context.lineTo(gondolaFar.x + Math.sin(age * 12) * 5 * avgScale, gondolaFar.y + 14 * avgScale);
      context.moveTo(gondolaNear.x, gondolaNear.y);
      context.lineTo(gondolaNear.x - Math.sin(age * 12) * 6 * avgScale, gondolaNear.y + 16 * avgScale);
      context.stroke();

      // Piece 1: Left half (Far side) tumbling in 3D
      const lDx = age * 180;
      const lDz = age * 60;
      const lDy = age * 30 + age * age * 420;
      const lp0 = this.p(xFront + lDx, yTop + lDy, signFarZ + lDz);
      const lp1 = this.p(xFront + lDx + age * 25, yTop + lDy - age * 20, zMid + lDz * 0.3);
      const lp2 = this.p(xFront + lDx + age * 25, yBottom + lDy - age * 20, zMid + lDz * 0.3);
      const lp3 = this.p(xFront + lDx, yBottom + lDy, signFarZ + lDz);

      // Left piece thickness backing
      const lb0 = this.p(xBack + lDx, yTop + lDy, signFarZ + lDz);
      const lb1 = this.p(xBack + lDx + age * 25, yTop + lDy - age * 20, zMid + lDz * 0.3);
      polygon(context, [lp0, lp1, lb1, lb0]);
      context.fillStyle = '#4c301c'; context.fill();

      texturedQuad(context, img, { x: 0, y: 0, width: halfW, height: imgH }, [lp0, lp1, lp2, lp3]);

      // Piece 2: Right half (Near side) tumbling in 3D
      const rDx = age * 210;
      const rDz = -age * 70;
      const rDy = age * 40 + age * age * 450;
      const rp0 = this.p(xFront + rDx - age * 25, yTop + rDy - age * 15, zMid + rDz * 0.3);
      const rp1 = this.p(xFront + rDx, yTop + rDy, signNearZ + rDz);
      const rp2 = this.p(xFront + rDx, yBottom + rDy, signNearZ + rDz);
      const rp3 = this.p(xFront + rDx - age * 25, yBottom + rDy - age * 15, zMid + rDz * 0.3);

      // Right piece thickness backing
      const rb0 = this.p(xBack + rDx - age * 25, yTop + rDy - age * 15, zMid + rDz * 0.3);
      const rb1 = this.p(xBack + rDx, yTop + rDy, signNearZ + rDz);
      polygon(context, [rp0, rp1, rb1, rb0]);
      context.fillStyle = '#4c301c'; context.fill();

      texturedQuad(context, img, { x: halfW, y: 0, width: halfW, height: imgH }, [rp0, rp1, rp2, rp3]);

      // Wood splinter debris in 3D
      for (let i = 0; i < 8; i++) {
        const px = centerX + age * (130 + (i % 3) * 60);
        const py = yBottom - 25 + (i % 2 === 0 ? -1 : 1) * 20 + (age * 15 + age * age * 340);
        const pz = zMid + Math.sin(i * 2.1) * (180 + age * 130);
        const p = this.p(px, py, pz);
        context.save();
        context.translate(p.x, p.y);
        context.rotate(age * (i % 2 === 0 ? 6 : -6) + i);
        context.fillStyle = i % 2 === 0 ? '#8b5a2b' : '#c29a64';
        context.fillRect(-7 * p.scale, -3.5 * p.scale, 14 * p.scale, 7 * p.scale);
        context.restore();
      }

      context.restore();

      if (age < 0.35) {
        const midP = this.p(centerX, (yTop + yBottom) / 2, zMid);
        this.glow(midP.x, midP.y, 75 * midP.scale, '#ffe6b3', (1 - age / 0.35) * 0.85);
      }
    }
  }

  private drawBlimp(obstacle: Obstacle) {
    const context = this.context;
    const { x, width, height } = obstacle;
    const centerX = x + width / 2;
    const baseY = this.y(centerX);
    const altitude = obstacle.altitude ?? 540;
    const zCenter = obstacleZ(obstacle);

    // Ground contact shadow under the floating blimp
    this.contact(centerX, 80, '#040c07', 0.22, zCenter);

    if (!obstacle.hit) {
      const hover = this.frame.reducedMotion ? 0 : Math.sin(this.frame.runTime * 1.8 + centerX * 0.02) * 12;
      const pitch = this.frame.reducedMotion ? 0 : Math.cos(this.frame.runTime * 1.4 + centerX * 0.02) * 0.03;
      const point = this.p(centerX, baseY - altitude + hover, zCenter);
      const drawW = width * point.scale;
      const drawH = height * point.scale;

      context.save();
      context.translate(point.x, point.y);
      context.rotate(pitch);
      context.drawImage(this.assets.blimp.image, -drawW / 2, -drawH / 2, drawW, drawH);

      // Warning blinking beacon light
      const beaconOn = (this.frame.runTime * 3) % 1 > 0.45;
      if (beaconOn) {
        context.fillStyle = '#ff2200';
        context.beginPath();
        context.arc(drawW * 0.05, -drawH * 0.38, 4 * point.scale, 0, TAU);
        context.fill();
      }
      context.restore();

      if (beaconOn) {
        this.glow(point.x + drawW * 0.05, point.y - drawH * 0.38, 14 * point.scale, '#ff3300', 0.5);
      }
    } else {
      const age = this.frame.time - obstacle.hitAt;
      if (age > 2.8) return;
      const dropY = (age * 40 + age * age * 460);
      const point = this.p(centerX + age * 80, baseY - altitude + dropY, zCenter);
      const drawW = width * point.scale;
      const drawH = height * point.scale;
      const fade = Math.max(0, 1 - age / 2.6);

      // Fiery explosion ball during initial blast
      if (age < 0.65) {
        const blastFactor = 1 - age / 0.65;
        this.glow(point.x, point.y, (130 + age * 160) * point.scale, '#ff3300', blastFactor * 0.9);
        this.glow(point.x, point.y, (90 + age * 120) * point.scale, '#ffaa00', blastFactor * 0.95);
        this.glow(point.x, point.y, (50 + age * 80) * point.scale, '#ffffff', blastFactor * 0.9);
      }

      // Burning blimp plummeting
      context.save();
      context.globalAlpha = fade;
      context.translate(point.x, point.y);
      context.rotate(age * 1.5);
      context.drawImage(this.assets.blimp.image, -drawW / 2, -drawH / 2, drawW, drawH);
      context.fillStyle = 'rgba(20, 10, 5, 0.65)';
      context.beginPath();
      context.arc(0, 0, drawW * 0.4, 0, TAU);
      context.fill();
      context.restore();

      // Trailing smoke puffs
      for (let i = 0; i < 4; i++) {
        const puffAge = Math.max(0, age - i * 0.12);
        if (puffAge > 0 && puffAge < 1.2) {
          const sx = point.x - puffAge * 65 * point.scale + Math.sin(i * 3) * 15 * point.scale;
          const sy = point.y - puffAge * 45 * point.scale - (i * 12 * point.scale);
          this.glow(sx, sy, (25 + puffAge * 45) * point.scale, '#222222', (1 - puffAge / 1.2) * 0.4);
        }
      }
    }
  }

  private drawFireRing(obstacle: Obstacle) {
    const centerX = obstacle.x + obstacle.width / 2;
    const point = this.p(centerX, this.y(centerX) - (obstacle.altitude ?? 130), obstacleZ(obstacle));
    const radius = obstacle.width * 0.42 * point.scale;
    const pulse = this.frame.reducedMotion ? 0.6 : 0.78 + Math.sin(this.frame.time * 8 + centerX * 0.01) * 0.18;
    const context = this.context;
    this.glow(point.x, point.y, radius * 1.8, obstacle.ring === 'steel' ? '#ff8e45' : '#ffbd55', 0.2 * pulse);
    context.save(); context.translate(point.x, point.y); context.globalAlpha = pulse;
    context.strokeStyle = '#24140d'; context.lineWidth = Math.max(4, radius * 0.24);
    context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.stroke();
    context.strokeStyle = obstacle.ring === 'steel' ? '#d7d0bf' : '#f0a14e'; context.lineWidth = Math.max(2, radius * 0.13);
    context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.stroke();
    context.strokeStyle = '#fff1b1'; context.lineWidth = Math.max(1, radius * 0.045);
    context.beginPath(); context.arc(0, 0, radius * 0.82, -0.9, 1.2); context.stroke();
    for (let i = 0; i < 7; i++) {
      const angle = i * TAU / 7 + this.frame.time * 0.35;
      const x = Math.cos(angle) * radius * 0.93;
      const y = Math.sin(angle) * radius * 0.93;
      context.fillStyle = i % 2 ? '#ff6335' : '#ffd27a';
      context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.cos(angle) * 8 * point.scale, y + Math.sin(angle) * 8 * point.scale);
      context.lineTo(x - Math.sin(angle) * 4 * point.scale, y + Math.cos(angle) * 4 * point.scale); context.closePath(); context.fill();
    }
    context.restore();
  }

  private drawBumper(obstacle: Obstacle) {
    const centerX = obstacle.x + obstacle.width / 2;
    const point = this.p(centerX, this.y(centerX), obstacleZ(obstacle));
    const sprite = obstacle.kind === 'spiked-rock' || obstacle.variant === 'spiked' ? this.assets.bumperSpiked : this.assets.bumperCrown;
    const drawW = obstacle.width * point.scale;
    const drawH = Math.min(obstacle.height * 1.22, drawW * sprite.height / sprite.width);
    this.glow(point.x, point.y - drawH * 0.42, drawW * 0.72, obstacle.kind === 'spiked-rock' ? '#ff6543' : '#ffd27a', obstacle.kind === 'spiked-rock' ? 0.09 : 0.12);
    this.context.save(); this.context.translate(point.x, point.y);
    this.context.rotate(Math.atan(this.slope(centerX)) * 0.22);
    this.context.drawImage(sprite.image, -drawW * 0.5, -drawH * 0.91, drawW, drawH);
    this.context.restore();
  }

  private drawObstacle(obstacle: Obstacle) {
    const { kind, x, width, height } = obstacle;
    if (kind === 'ramp' || kind === 'loop' || kind === 'gap') return;
    if (kind === 'fire-ring') {
      this.drawFireRing(obstacle);
      return;
    }
    if (kind === 'rock-bumper' || kind === 'spiked-rock') {
      this.drawBumper(obstacle);
      return;
    }
    if (kind === 'rock-wall') {
      this.drawRockWall(obstacle);
      return;
    }
    if (kind === 'mine-rail' || kind === 'mine-split') {
      this.drawMineObstacle(obstacle);
      return;
    }
    if (kind === 'sign') {
      this.drawSign(obstacle);
      return;
    }
    if (kind === 'blimp') {
      this.drawBlimp(obstacle);
      return;
    }
    if ((kind === 'tnt' || kind === 'sheep') && obstacle.hit) {
      if (kind === 'tnt') this.drawExplosion(obstacle);
      return;
    }
    if (kind === 'boost') {
      const z = obstacleZ(obstacle);
      const quad = this.groundQuad(x, x + width, z - 45, z + 45, -4);
      this.context.save(); this.context.globalAlpha = (obstacle.hitMask ?? 0) & 1 ? 0.68 : 1;
      texturedQuad(this.context, this.boostTile, { x: 0, y: 0, width: 256, height: 128 }, quad);
      this.context.restore();
      return;
    }
    const point = this.p(x + width / 2, this.y(x + width / 2), obstacleZ(obstacle));
    const sprite = kind === 'skull-box' ? this.assets.skullBox
      : kind === 'spring' ? this.assets.springPart
        : kind === 'crate' ? this.assets.crate
          : kind === 'sheep' ? this.assets.sheep
            : this.assets.tnt;
    let h = Math.min(height * 1.12, width * sprite.height / sprite.width);
    if (kind === 'spring' && this.frame.time - obstacle.hitAt < 0.4) h *= 1 - Math.sin((this.frame.time - obstacle.hitAt) / 0.4 * Math.PI) * 0.36;
    this.context.save(); this.context.translate(point.x, point.y);
    this.context.rotate(Math.atan(this.slope(x) - (this.frame.options.downrange ? 0.11 : 0)) * 0.38);
    this.context.drawImage(sprite.image, -width * point.scale / 2, -h * point.scale * 0.95, width * point.scale, h * point.scale);
    this.context.restore();
    if (kind === 'tnt') this.glow(point.x + 7 * point.scale, point.y - h * point.scale * 0.9, 12 * point.scale, '#ffc16c', 0.3);
  }

  private drawRockWall(obstacle: Obstacle) {
    const context = this.context;
    const x = obstacle.x + obstacle.width / 2;
    const y = this.y(x);
    const near = this.p(x, y + 28, LANE.near - 34);
    const far = this.p(x, y + 28, LANE.far + 34);
    const nearTop = this.p(x, y - obstacle.height, LANE.near - 34);
    const farTop = this.p(x, y - obstacle.height, LANE.far + 34);
    polygon(context, [farTop, nearTop, near, far]);
    const gradient = context.createLinearGradient(0, Math.min(nearTop.y, farTop.y), 0, Math.max(near.y, far.y));
    gradient.addColorStop(0, obstacle.variant === 'spiked' ? '#5e3d2d' : '#3b4b45');
    gradient.addColorStop(0.5, '#202c2a'); gradient.addColorStop(1, '#0b1212');
    context.fillStyle = gradient; context.fill();
    context.strokeStyle = '#aa8a5c'; context.lineWidth = Math.max(2, 4 * near.scale); context.stroke();
    context.strokeStyle = '#6c7e72'; context.lineWidth = Math.max(1, 1.5 * near.scale);
    for (let i = -5; i <= 5; i++) {
      const a = this.p(x, y - obstacle.height * (0.18 + (i + 5) % 3 * 0.2), laneZ(Math.max(0, Math.min(3, i + 2))));
      const b = this.p(x, y + 10, a.depth > 0 ? LANE.far + 15 : LANE.near - 15);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    const title = this.p(x, y - obstacle.height - 20, 0);
    context.textAlign = 'center'; context.font = `900 ${Math.max(12, 20 * title.scale)}px "Barlow Condensed", sans-serif`;
    context.fillStyle = '#f1d29a'; context.fillText('NO EXIT', title.x, title.y); context.textAlign = 'left';
  }

  private drawMineObstacle(obstacle: Obstacle) {
    const context = this.context;
    const x = obstacle.x;
    const end = obstacle.x + obstacle.width;
    const z = obstacle.kind === 'mine-rail' ? LANE.near + 62 : laneZ(1);
    const railColor = obstacle.kind === 'mine-rail' ? '#b9a66e' : '#7cd3c4';
    for (const offset of obstacle.kind === 'mine-rail' ? [-34, 34] : [-185, 185]) {
      const a = this.p(x, this.y(x) - 5, z + offset);
      const b = this.p(end, this.y(end) - 5, z + offset);
      context.strokeStyle = '#101615'; context.lineWidth = 9 * a.scale; context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
      context.strokeStyle = railColor; context.lineWidth = 3 * a.scale; context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    for (let tie = x; tie < end; tie += 86) {
      const a = this.p(tie, this.y(tie) - 3, z - 64);
      const b = this.p(tie, this.y(tie) - 3, z + 64);
      context.strokeStyle = '#4b3928'; context.lineWidth = Math.max(2, 5 * a.scale); context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    if (obstacle.kind === 'mine-split') {
      const branch = this.p(x + obstacle.width * 0.44, this.y(x + obstacle.width * 0.44) - 8, laneZ(3));
      context.strokeStyle = '#8de3d3'; context.lineWidth = 4 * branch.scale;
      context.beginPath(); context.moveTo(branch.x, branch.y); context.lineTo(branch.x - 90 * branch.scale, branch.y - 66 * branch.scale); context.stroke();
      context.fillStyle = '#d8b56f'; context.beginPath(); context.arc(branch.x, branch.y, 8 * branch.scale, 0, TAU); context.fill();
    }
  }

  private drawBall(ball: RacerFrame) {
    if (ball.y - RADIUS > this.y(ball.x) && !this.inGap(ball.x, ball.z)) return;
    const p = this.p(ball.x, ball.y, ball.z);
    const context = this.context;
    const ready = this.frame.snapshot.status === 'ready';
    if (!ready && ball.fireUntil > this.frame.runTime) {
      const age = Math.max(0, ball.fireUntil - this.frame.runTime);
      this.glow(p.x - 27 * p.scale, p.y + 9 * p.scale, 36 * p.scale, '#ff6335', 0.16);
      context.save(); context.translate(p.x, p.y); context.rotate(ball.rotation);
      for (let i = 0; i < 4; i++) {
        const flame = 15 + i * 5 + Math.sin(this.frame.time * 18 + i) * 3;
        context.fillStyle = i % 2 ? '#ff713b' : '#ffd27a';
        context.globalAlpha = Math.min(0.9, age * 1.4) * (1 - i * 0.12);
        context.beginPath(); context.moveTo(-27 * p.scale - i * 4 * p.scale, 0); context.quadraticCurveTo(-42 * p.scale - i * 4 * p.scale, -flame * p.scale, -58 * p.scale - i * 5 * p.scale, 0); context.quadraticCurveTo(-42 * p.scale - i * 4 * p.scale, flame * p.scale, -27 * p.scale - i * 4 * p.scale, 0); context.fill();
      }
      context.restore();
    }
    if (ball.shieldUntil > this.frame.runTime) {
      context.strokeStyle = '#8cceffd9'; context.lineWidth = 2 * p.scale;
      context.beginPath(); context.arc(p.x, p.y, 44 * p.scale, 0, TAU); context.stroke();
      this.glow(p.x, p.y, 61 * p.scale, POWERUPS.shield.color, 0.075);
      const icon = this.assets.pickupSprites?.shield;
      if (icon) context.drawImage(icon, p.x + 24 * p.scale, p.y - 40 * p.scale, 23 * p.scale, 23 * p.scale);
    }
    if (ready && !ball.id) {
      this.glow(p.x, p.y, 62 * p.scale, ball.color, 0.14);
      context.strokeStyle = this.frame.dragging ? '#ffd797' : '#e5ba7180'; context.lineWidth = 1;
      context.setLineDash([3, 6]); context.lineDashOffset = -this.frame.time * 6;
      context.beginPath(); context.arc(p.x, p.y, 42 * p.scale, 0, TAU); context.stroke(); context.setLineDash([]);
    }
    context.save(); context.translate(p.x, p.y);
    if (this.frame.runTime < ball.immuneUntil) context.globalAlpha = 0.65;
    // Rotate the actual capsule, not just a highlight drawn over an upright sprite.
    context.rotate(ready ? 0 : ball.rotation);
    context.drawImage(this.balls[ball.id], -38 * p.scale, -38 * p.scale, 76 * p.scale, 76 * p.scale);
    context.restore();
    this.glow(p.x + 13 * p.scale, p.y - 19 * p.scale, 10 * p.scale, '#ffe1ac', 0.07);
    const bump = this.frame.runTime - ball.bumpAt;
    if (bump >= 0 && bump < 0.4) {
      context.strokeStyle = `rgba(255, 221, 152, ${(1 - bump / 0.4) * 0.7})`;
      context.lineWidth = 2 * p.scale; context.beginPath(); context.arc(p.x, p.y, (38 + bump * 26) * p.scale, 0, TAU); context.stroke();
    }
    const absorbed = this.frame.runTime - ball.shieldHitAt;
    if (absorbed >= 0 && absorbed < 0.4) {
      context.strokeStyle = `rgba(140, 206, 255, ${(1 - absorbed / 0.4) * 0.8})`; context.lineWidth = 2 * p.scale;
      context.beginPath(); context.arc(p.x, p.y, (44 + absorbed * 60) * p.scale, 0, TAU); context.stroke();
    }
    if (p.y > 121 && p.y < HEIGHT - 22) {
      context.textAlign = 'center'; context.font = `700 ${Math.max(8, 10 * p.scale)}px "Space Mono", monospace`;
      context.fillStyle = ball.color;
      context.fillText(ball.finished ? `${ball.name} / FINISHED` : ball.id ? ball.name : 'YOU', p.x, p.y - 49 * p.scale);
      if (!ball.id) { polygon(context, [{ x: p.x - 4, y: p.y - 44 * p.scale }, { x: p.x + 4, y: p.y - 44 * p.scale }, { x: p.x, y: p.y - 39 * p.scale }]); context.fill(); }
      context.textAlign = 'left';
    }
  }

  private drawTrajectory() {
    if (this.frame.snapshot.status !== 'ready' || !this.frame.options.aimAssist) return;
    const velocity = launchVelocity(this.frame.snapshot.power, this.frame.options.launchSpeed);
    const angle = this.frame.snapshot.angle * Math.PI / 180;
    for (let i = 1; i <= 24; i++) {
      const t = i * 0.054;
      const x = this.frame.ball.x + Math.cos(angle) * velocity * t;
      const y = this.frame.ball.y - Math.sin(angle) * velocity * t + GRAVITY * t * t / 2;
      if (y > this.surface(x, this.frame.ball.z) - RADIUS && t > 0.15) break;
      const p = this.p(x, y, this.frame.ball.z);
      this.context.fillStyle = `rgba(255, 224, 157, ${(1 - i / 28) * 0.7})`;
      this.context.beginPath(); this.context.arc(p.x, p.y, 2.3 * p.scale, 0, TAU); this.context.fill();
    }
  }

  private drawTrail() {
    if (this.frame.snapshot.status !== 'flying' || this.frame.reducedMotion || this.frame.loopRide || this.frame.snapshot.falling) return;
    const context = this.context;
    context.save(); context.lineCap = 'round';
    const trail = this.frame.trail;
    for (let i = 1; i < trail.length; i++) {
      const a = this.p(trail[i - 1].x, trail[i - 1].y, trail[i - 1].z); const b = this.p(trail[i].x, trail[i].y, trail[i].z);
      context.strokeStyle = `rgba(248, 190, 116, ${i / trail.length * 0.13})`;
      context.lineWidth = 7 * b.scale * i / trail.length;
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    context.restore();
  }

  private radial(color: string) {
    let image = this.glows.get(color);
    if (!image) {
      image = document.createElement('canvas'); image.width = image.height = 64;
      const context = image.getContext('2d')!;
      const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32);
      gradient.addColorStop(0, color); gradient.addColorStop(0.28, `${color}aa`); gradient.addColorStop(1, `${color}00`);
      context.fillStyle = gradient; context.fillRect(0, 0, 64, 64); this.glows.set(color, image);
    }
    return image;
  }

  private glow(x: number, y: number, radius: number, color: string, alpha: number) {
    if (alpha <= 0 || radius <= 0) return;
    this.context.save(); this.context.globalAlpha = alpha;
    this.context.drawImage(this.radial(color), x - radius, y - radius, radius * 2, radius * 2); this.context.restore();
  }

  private drawExplosion(obstacle: Obstacle) {
    const age = this.frame.time - obstacle.hitAt;
    if (age >= 1.2) return;
    const p = this.p(obstacle.x + obstacle.width / 2, this.y(obstacle.x) - 36, obstacleZ(obstacle));
    if (age < 0.42) this.glow(p.x, p.y, (90 + age * 120) * p.scale, '#ffae59', (1 - age / 0.42) * 0.8);
    for (let i = 0; i < (this.lowDetail ? 2 : 4); i++) this.glow(p.x + Math.sin(i * 2.3) * age * 37 * p.scale, p.y - age * 54 * p.scale, (18 + age * 32) * p.scale, '#333d2d', (1 - age / 1.2) * 0.32);
  }

  private drawFinish() {
    const context = this.context;
    const y = this.y(FINISH);
    for (const z of [LANE.near - 26, LANE.far + 26]) {
      const base = this.p(FINISH, y + 154, z); const top = this.p(FINISH, y - 233, z);
      context.strokeStyle = '#493d27'; context.lineWidth = 13 * top.scale;
      context.beginPath(); context.moveTo(base.x, base.y); context.lineTo(top.x, top.y); context.stroke();
      context.strokeStyle = '#b19a665e'; context.lineWidth = 2 * top.scale; context.stroke();
    }
    const span = LANE.far - LANE.near + 52;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 24; col++) {
      const z = LANE.near - 26 + col * span / 24; const top = y - 233 + row * 16;
      const points = [this.p(FINISH, top, z), this.p(FINISH, top, z + span / 24), this.p(FINISH, top + 16, z + span / 24), this.p(FINISH, top + 16, z)];
      polygon(context, points); context.fillStyle = (row + col) % 2 ? '#eee1b7' : '#253729'; context.fill();
    }
    const p = this.p(FINISH, y - 252);
    context.font = `800 ${23 * p.scale}px "Barlow Condensed", sans-serif`; context.textAlign = 'center'; context.fillStyle = '#f1c986'; context.fillText('FINISH', p.x, p.y); context.textAlign = 'left';
  }

  private drawAltitudeIndicator() {
    if (this.frame.snapshot.status !== 'flying') return;
    const p = this.p(this.frame.ball.x, this.frame.ball.y, this.frame.ball.z);
    if (p.y > 96) return;
    const x = clamp(p.x, 35, this.view.width - 35);
    polygon(this.context, [{ x, y: 105 }, { x: x - 5, y: 115 }, { x: x + 5, y: 115 }]);
    this.context.fillStyle = '#efc989'; this.context.fill();
    this.context.textAlign = 'center'; this.context.font = '8px "Space Mono", monospace'; this.context.fillText('STILL FLYING', x, 129); this.context.textAlign = 'left';
  }

  /**
   * TICKET-07: ornate edge pointer shown whenever the player's ball leaves the
   * viewport. A pulsing orange badge with the racer's portrait is clamped to the
   * screen rim and a chevron keeps aiming at the real ball position.
   */
  private drawOffScreenIndicator() {
    if (this.frame.snapshot.status !== 'flying') return;
    const ball = this.frame.ball;
    const p = this.p(ball.x, ball.y, ball.z);
    const margin = 50;
    if (p.x > -4 && p.x < this.view.width + 4 && p.y > -4 && p.y < HEIGHT + 4) return;
    const anchor = edgeAnchor(p.x, p.y, this.view.width, HEIGHT, margin);
    const context = this.context;
    const color = RACER_DEFINITIONS[0].color;
    const pulse = this.frame.reducedMotion ? 0.5 : (Math.sin(this.frame.runTime * 5.4) + 1) / 2;
    this.glow(anchor.x, anchor.y, 54 + pulse * 14, color, 0.15 + pulse * 0.1);
    // Badge disc with the player's miniature portrait.
    context.save();
    context.translate(anchor.x, anchor.y);
    context.fillStyle = '#241505ee'; context.strokeStyle = '#f1c986'; context.lineWidth = 3;
    context.beginPath(); context.arc(0, 0, 26, 0, TAU); context.fill(); context.stroke();
    context.strokeStyle = `${color}aa`; context.lineWidth = 1;
    context.beginPath(); context.arc(0, 0, 30, 0, TAU); context.stroke();
    context.save();
    context.beginPath(); context.arc(0, 0, 21, 0, TAU); context.clip();
    // TICKET-04: the badge shows the rider's portrait; the ball rolls on its own.
    context.drawImage(this.assets.playerBadge ?? this.balls[0], -21, -21, 42, 42);
    context.restore();
    context.restore();
    // Directional chevron on the rim, aimed at the real ball position.
    context.save();
    context.translate(anchor.x, anchor.y);
    context.rotate(anchor.angle);
    polygon(context, [{ x: 29, y: -13 }, { x: 48, y: 0 }, { x: 29, y: 13 }, { x: 36, y: 0 }]);
    context.fillStyle = color; context.fill();
    context.strokeStyle = '#7c3f12'; context.lineWidth = 1.5; context.stroke();
    context.restore();
    // Distance readout (+45m past the rim) or an altitude callout for vertical exits.
    let label = '^ AIRBORNE';
    if (anchor.side) {
      const edgeWorldX = this.view.unproject(anchor.side > 0 ? this.view.width - margin : margin, GROUND, ball.z).x;
      label = `${anchor.side > 0 ? '+' : '-'}${Math.round(Math.abs(ball.x - edgeWorldX) / 2)}m`;
    } else if (!anchor.above) label = 'AIRBORNE';
    const textX = clamp(anchor.x - Math.cos(anchor.angle) * 48, 34, this.view.width - 34);
    const textY = clamp(anchor.y - Math.sin(anchor.angle) * 48 + 4, 14, HEIGHT - 8);
    context.font = '700 12px "Space Mono", monospace'; context.textAlign = 'center';
    context.fillStyle = '#241505cc'; context.fillText(label, textX + 1, textY + 1);
    context.fillStyle = '#ffd9a0'; context.fillText(label, textX, textY);
    context.textAlign = 'left';
  }

  destroy() {
    this.sceneryLayer.destroy(); this.foregroundLayer.destroy(); this.environment.destroy(); this.glows.clear();
    this.boostTile.width = 1;
  }
}