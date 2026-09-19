import type { GameAssets, Sprite } from './assets';
import type { RangeCamera } from './projection';
import { FINISH, HEIGHT, LANE, LANE_COUNT, LANE_WIDTH, STADIUM_START, START_X, courseY, laneZ, obstacleBounds, occupiesLane, terrainY, type Obstacle, type SceneFrame } from './scene';
import { polygon, texturedQuad, type Quad } from './texture';
import { TRACKS } from './courses';
import { buildCourseArt, type CourseArt } from './world-art';
import type { CourseId } from './types';

const TAU = Math.PI * 2;
const mod = (x: number, n: number) => ((x % n) + n) % n;

export class ArenaEnvironment {
  private frame!: SceneFrame;
  private gaps: Obstacle[] = [];
  private lastObstacles: Obstacle[] | null = null;
  private lowDetail = false;
  private deck: HTMLCanvasElement;
  private wall: HTMLCanvasElement;
  private art: CourseArt;
  private readonly stadium = document.createElement('canvas');
  private readonly torch = document.createElement('canvas');

  constructor(private context: CanvasRenderingContext2D, private readonly view: RangeCamera, private readonly assets: GameAssets, private course: CourseId = 'ridge') {
    this.art = buildCourseArt(course, assets);
    this.deck = this.art.dirt;
    this.wall = this.art.bank;
    this.makeStadium();
    this.makeTorch();
  }

  begin(frame: SceneFrame, lowDetail = false) {
    this.frame = frame;
    this.lowDetail = lowDetail;
    if (this.course !== frame.options.course) {
      this.course = frame.options.course;
      this.art = buildCourseArt(this.course, this.assets); this.deck = this.art.dirt; this.wall = this.art.bank;
      this.makeStadium();
    }
    if (frame.obstacles !== this.lastObstacles) {
      this.lastObstacles = frame.obstacles;
      this.gaps = frame.obstacles.filter((obstacle) => obstacle.kind === 'gap');
    }
  }

  withContext(context: CanvasRenderingContext2D, paint: () => void) {
    const previous = this.context;
    this.context = context;
    try { paint(); } finally { this.context = previous; }
  }

  private p(x: number, y: number, z = 0) { return this.view.project(x, y, z); }
  private y(x: number) { return courseY(x, this.course); }
  private terrain(x: number) { return terrainY(x, this.course); }
  private get palette() { return TRACKS[this.course].palette; }

  private quad(x: number, end: number, near: number, far: number, height = 0): Quad {
    return [this.p(x, this.y(x) + height, far), this.p(end, this.y(end) + height, far),
      this.p(end, this.y(end) + height, near), this.p(x, this.y(x) + height, near)];
  }

  private fill(points: Quad, color: string | CanvasGradient) {
    polygon(this.context, points); this.context.fillStyle = color; this.context.fill();
  }

  private inGap(x: number, z = LANE.near + 16) {
    for (const gap of this.gaps) {
      if (gap.x > x) break;
      if (x < gap.x + gap.width && occupiesLane(gap, z, 0)) return true;
    }
    return false;
  }

  /**
   * TICKET-06: Multi-layered parallax background composite.
   *  - Layer 1 (far sky): 2048x1024 painted skybox, scrolls at 0.05x — nearly stationary.
   *  - Layer 2 (distant mountains / silhouettes): transparent silhouette layer, 0.15x.
   *  - Sunbeam / god-ray overlay tinted to the course's lighting profile.
   *  - Blimps (Layer 3 midground) are drawn in drawBlimps at ~0.2x.
   * Horizontal tiling uses modulo repetition with no seams or pop-in.
   */
  drawLandscape() {
    const context = this.context;
    const lighting = TRACKS[this.course].lighting;
    const parallax = this.frame.options.parallax;

    // ---- Section 3: Subterranean Cavern Atmosphere (48000..68400) ----
    if (this.frame.camera >= 48000 && this.frame.camera < 68400) {
      // Dark cavern vault ceiling with warm volcanic glow from below
      const cavernGrad = context.createLinearGradient(0, 0, 0, HEIGHT);
      cavernGrad.addColorStop(0, '#0a080e');
      cavernGrad.addColorStop(0.5, '#16101c');
      cavernGrad.addColorStop(1, '#2c1208');
      context.fillStyle = cavernGrad;
      context.fillRect(0, 0, this.view.width, HEIGHT);

      // Searing magma uplight glow
      const lavaGlow = context.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT);
      lavaGlow.addColorStop(0, '#ff3b0000');
      lavaGlow.addColorStop(1, '#ff440055');
      context.fillStyle = lavaGlow;
      context.fillRect(0, HEIGHT * 0.6, this.view.width, HEIGHT * 0.4);
      return;
    }

    // ---- Section 2: Waterfall Canyon Chasm Atmosphere (24000..48000) ----
    if (this.frame.camera >= 24000 && this.frame.camera < 48000) {
      const canyonGrad = context.createLinearGradient(0, 0, 0, HEIGHT);
      canyonGrad.addColorStop(0, '#102028');
      canyonGrad.addColorStop(0.6, '#183844');
      canyonGrad.addColorStop(1, '#2c5364');
      context.fillStyle = canyonGrad;
      context.fillRect(0, 0, this.view.width, HEIGHT);

      // Frothing waterfall mist rising from below
      const mistGrad = context.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT);
      mistGrad.addColorStop(0, '#8ec5fc00');
      mistGrad.addColorStop(1, '#e0c3fc44');
      context.fillStyle = mistGrad;
      context.fillRect(0, HEIGHT * 0.55, this.view.width, HEIGHT * 0.45);
      return;
    }

    // ---- Section 1 & Stadium: Alpine Open Sky ----
    const skyImage = this.art.skyboxImage ?? this.art.sky;
    this.drawTiledLayer(skyImage, HEIGHT + 55, this.frame.camera * (parallax ? 0.05 : 0.15) + this.frame.drift * 0.1, -35);

    // ---- Atmospheric fog tint at horizon for mood ----
    const fogGrad = context.createLinearGradient(0, HEIGHT * 0.35, 0, HEIGHT * 0.7);
    fogGrad.addColorStop(0, `${lighting.fogColor}00`);
    fogGrad.addColorStop(1, `${lighting.fogColor}22`);
    context.fillStyle = fogGrad;
    context.fillRect(0, HEIGHT * 0.35, this.view.width, HEIGHT * 0.35);

    // ---- Sunbeam / god-ray overlay ----
    if (lighting.sunbeamIntensity > 0) {
      this.drawTiledLayerTransparent(this.art.sunbeams, HEIGHT + 55, this.frame.camera * (parallax ? 0.03 : 0.1), -20);
    }

    // ---- Vignette-style ambient light tint (top) ----
    const topTint = context.createLinearGradient(0, 0, 0, 120);
    topTint.addColorStop(0, `${lighting.ambientLight}40`);
    topTint.addColorStop(1, `${lighting.ambientLight}00`);
    context.fillStyle = topTint;
    context.fillRect(0, 0, this.view.width, 120);

    this.drawBlimps();
  }

  /**
   * TICKET-06: Tile an image across the viewport with a given horizontal offset and
   * draw height. Handles horizontal wrapping with a flip on alternating tiles to hide
   * seams (mirrored tiling).
   */
  private drawTiledLayer(image: CanvasImageSource, height: number, offset: number, yOffset: number) {
    const context = this.context;
    const sourceW = (image as HTMLImageElement).naturalWidth ?? (image as HTMLCanvasElement).width;
    const sourceH = (image as HTMLImageElement).naturalHeight ?? (image as HTMLCanvasElement).height;
    const width = sourceW / sourceH * height;
    const start = Math.floor(offset / width) - 1;
    for (let i = start; i < start + Math.ceil(this.view.width / width) + 4; i++) {
      const x = i * width - offset;
      context.save();
      if (Math.abs(i) % 2) { context.translate(x + width, 0); context.scale(-1, 1); context.drawImage(image, 0, yOffset, width + 1, height); }
      else context.drawImage(image, x, yOffset, width + 1, height);
      context.restore();
    }
  }

  /**
   * TICKET-06: Same as drawTiledLayer but for transparent layers (silhouettes, sunbeams).
   * Does not clear background beneath; relies on the source image alpha.
   */
  private drawTiledLayerTransparent(image: HTMLCanvasElement, height: number, offset: number, yOffset: number) {
    const context = this.context;
    const sourceW = image.width;
    const sourceH = image.height;
    const width = sourceW / sourceH * height;
    const start = Math.floor(offset / width) - 1;
    for (let i = start; i < start + Math.ceil(this.view.width / width) + 4; i++) {
      const x = i * width - offset;
      context.save();
      if (Math.abs(i) % 2) { context.translate(x + width, 0); context.scale(-1, 1); context.drawImage(image, 0, yOffset, width + 1, height); }
      else context.drawImage(image, x, yOffset, width + 1, height);
      context.restore();
    }
  }

  private drawBlimps() {
    if (this.frame.camera >= 24000 && this.frame.camera <= 68400) return;
    const context = this.context;
    const spacing = 1450;
    const movement = this.frame.reducedMotion ? 0 : this.frame.time * 7;
    const offset = this.frame.camera * (this.frame.options.parallax ? 0.4 : 0.5) - movement;
    const first = Math.floor((offset - 950) / spacing) - 1;
    for (let index = first; index < first + Math.ceil(this.view.width / spacing) + 3; index++) {
      const x = 950 + index * spacing - offset;
      const w = Math.abs(index) % 2 ? 196 : 270;
      if (x < -w - 40 || x > this.view.width + 40) continue;
      const y = 100 + Math.abs(index % 3) * 27 + (this.frame.reducedMotion ? 0 : Math.sin(this.frame.time * 0.35 + index) * 4);
      const blimp = this.art.blimp;
      context.save(); context.globalAlpha = 0.66;
      context.drawImage(blimp, x, y, w, w * blimp.height / blimp.width); context.restore();
    }
  }

  drawTerrain() {
    const range = this.view.visibleSpan(LANE.near - 850, LANE.far + 1500, 250);
    const step = 256;
    const understory = this.course === 'boomtown' ? '#18120d' : this.course === 'sheep' ? '#1f2b15' : '#111c14';
    for (let x = Math.floor(range.start / step) * step; x < range.end; x += step) {
      const stadium = x >= STADIUM_START;
      this.fill(this.quad(x, x + step, LANE.near - 850, LANE.far + 1500, 153), stadium ? this.palette.grass : this.palette.soil);
      // Rich shaded undergrowth mulch directly beneath the midground tree wall
      if (!stadium) {
        this.fill(this.quad(x, x + step, LANE.far + 340, LANE.far + 820, 153), understory);
      }
      this.fill(this.quad(x, x + step, LANE.far + 6, LANE.far + 380, 153), this.palette.shoulder);
    }
  }

  private crowdStrip(sprite: Sprite, z: number, baseOffset: number, height: number, alpha: number, start?: number, end?: number) {
    const width = height * sprite.width / sprite.height;
    const range = this.view.visibleSpan(z, z, 330);
    const a = Math.max(range.start, start ?? -Infinity);
    const b = Math.min(range.end, end ?? Infinity);
    if (a >= b) return;
    const stride = width / 4;
    this.context.save(); this.context.globalAlpha = alpha;
    for (let tile = Math.floor(a / width); tile <= Math.floor(b / width); tile++) for (let slice = 0; slice < 4; slice++) {
      const x = tile * width + slice * stride;
      const right = x + stride;
      if (right < a || x > b) continue;
      const drawX = Math.max(x, start ?? -Infinity);
      const drawRight = Math.min(right, end ?? Infinity);
      if (drawX >= drawRight) continue;
      const bottom = this.y(drawX) + baseOffset;
      const bottomRight = this.y(drawRight) + baseOffset;
      const quad: Quad = [this.p(drawX, bottom - height, z), this.p(drawRight, bottomRight - height, z), this.p(drawRight, bottomRight, z), this.p(drawX, bottom, z)];
      if (quad.every((p) => p.y > HEIGHT + 180) || quad.every((p) => p.y < -220)) continue;
      texturedQuad(this.context, sprite.image, {
        x: slice * sprite.width / 4 + (drawX - x) / stride * sprite.width / 4,
        y: 0, width: (drawRight - drawX) / stride * sprite.width / 4, height: sprite.height,
      }, quad);
    }
    this.context.restore();
  }

  drawGrandstands() {
    const z = LANE.far + 240;
    const range = this.view.visibleSpan(z - 25, z + 30, 330);
    this.drawStadium();
    this.drawWaterfallRiver();
    this.drawLavaChamber();
    this.drawTreeWall();
    this.drawLandmarks();
    this.drawLipTransitionCutouts();
    this.drawWaterfallCliffStage();
    this.drawCavernMawStage();
    this.drawMineCoasterStage();
    this.drawBreakthroughStage();
    const step = 256;
    for (let x = Math.floor(range.start / step) * step; x < range.end; x += step) {
      if (x >= 24000 && x <= 68400) continue; // Section 2 & 3 have bespoke cliff & mine spectator sets
      const y = this.y(x);
      const ny = this.y(x + step);
      this.fill([this.p(x, y + 67, z), this.p(x + step, ny + 67, z), this.p(x + step, ny + 155, z), this.p(x, y + 155, z)], '#2a301d');
      const context = this.context;
      context.strokeStyle = '#655b365e'; context.lineWidth = 4 * this.p(x, y).scale;
      const a = this.p(x + 16, y + 146, z - 1); const b = this.p(x + step - 12, ny + 72, z - 1);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    this.crowdStrip(this.assets.grandstand, z, 68, 200, 0.86, 0, 24000);
    this.crowdStrip(this.assets.grandstand, z, 68, 200, 0.86, STADIUM_START, FINISH + 2000);
    this.drawFence(LANE.far + 65, 142, 114);
  }

  private drawLipTransitionCutouts() {
    const parts = this.assets.trackParts;
    if (!parts) return;
    const cam = this.view.offset;
    if (cam < 22500 || cam > 27000) return;

    const context = this.context;
    if (parts.rockArchWide) {
      const p = this.p(24100, this.y(24100), 0);
      const w = 1100 * p.scale;
      const h = 750 * p.scale;
      context.drawImage(parts.rockArchWide.image, p.x - w / 2, p.y - h * 0.96, w, h);
    }
    if (parts.rockBoulderA) {
      const p = this.p(24350, this.y(24350) + 20, LANE.far + 80);
      const w = 480 * p.scale;
      const h = 420 * p.scale;
      context.drawImage(parts.rockBoulderA.image, p.x - w / 2, p.y - h * 0.95, w, h);
    }
    if (parts.rockBoulderB) {
      const p = this.p(24500, this.y(24500) + 30, LANE.near - 80);
      const w = 460 * p.scale;
      const h = 400 * p.scale;
      context.drawImage(parts.rockBoulderB.image, p.x - w / 2, p.y - h * 0.95, w, h);
    }
    if (parts.rockTunnelFrameA) {
      const p = this.p(25200, this.y(25200), 0);
      const w = 1050 * p.scale;
      const h = 800 * p.scale;
      context.drawImage(parts.rockTunnelFrameA.image, p.x - w / 2, p.y - h * 0.98, w, h);
    }
  }

  private drawWaterfallCliffStage() {
    const parts = this.assets.trackParts;
    if (!parts) return;
    const range = this.view.visibleSpan(LANE.near - 350, LANE.far + 350, 400);
    const start = Math.max(24800, range.start);
    const end = Math.min(48200, range.end);
    if (start >= end) return;

    const context = this.context;
    const step = 950;
    for (let x = Math.floor(start / step) * step; x < end; x += step) {
      const y = this.y(x);
      const idx = Math.abs(Math.floor(x / step));

      if (parts.cliffScaffolding) {
        const pLeft = this.p(x, y - 40, LANE.far + 140);
        const sw = 360 * pLeft.scale;
        const sh = 420 * pLeft.scale;
        context.drawImage(parts.cliffScaffolding.image, pLeft.x - sw / 2, pLeft.y - sh * 0.95, sw, sh);

        const bleacher = idx % 2 === 0 ? parts.goblinBleacherA : parts.goblinBleacherB;
        if (bleacher) {
          const bw = 240 * pLeft.scale;
          const bh = 150 * pLeft.scale;
          context.drawImage(bleacher.image, pLeft.x - bw / 2, pLeft.y - sh * 0.65, bw, bh);
        }
      }

      if (parts.rockPlatformSpire) {
        const pRight = this.p(x + 450, this.y(x + 450) - 20, LANE.near - 140);
        const sw = 340 * pRight.scale;
        const sh = 460 * pRight.scale;
        context.drawImage(parts.rockPlatformSpire.image, pRight.x - sw / 2, pRight.y - sh * 0.95, sw, sh);

        const bleacherRight = idx % 2 === 0 ? parts.goblinBleacherC : parts.goblinBleacherD;
        if (bleacherRight) {
          const bw = 220 * pRight.scale;
          const bh = 140 * pRight.scale;
          context.drawImage(bleacherRight.image, pRight.x - bw / 2, pRight.y - sh * 0.55, bw, bh);
        }
      }
    }
  }

  private drawCavernMawStage() {
    const parts = this.assets.trackParts;
    if (!parts) return;
    const cam = this.view.offset;
    if (cam < 46500 || cam > 51500) return;

    const context = this.context;
    if (parts.tunnelMouthStone) {
      const p = this.p(48200, this.y(48200), 0);
      const w = 1200 * p.scale;
      const h = 850 * p.scale;
      context.drawImage(parts.tunnelMouthStone.image, p.x - w / 2, p.y - h * 0.98, w, h);
    }
    if (parts.rockCeilingCutout) {
      const p = this.p(48600, this.y(48600) - 280, 0);
      const w = 980 * p.scale;
      const h = 420 * p.scale;
      context.drawImage(parts.rockCeilingCutout.image, p.x - w / 2, p.y, w, h);
    }
  }

  private drawMineCoasterStage() {
    const parts = this.assets.trackParts;
    if (!parts) return;
    const range = this.view.visibleSpan(LANE.near - 300, LANE.far + 300, 350);
    const start = Math.max(50500, range.start);
    const end = Math.min(68000, range.end);
    if (start >= end) return;

    const context = this.context;
    const step = 1100;
    for (let x = Math.floor(start / step) * step; x < end; x += step) {
      const y = this.y(x);
      const idx = Math.abs(Math.floor(x / step));

      if (parts.wallTimberBraced) {
        const pWall = this.p(x, y - 60, LANE.far + 180);
        const w = 450 * pWall.scale;
        const h = 380 * pWall.scale;
        context.drawImage(parts.wallTimberBraced.image, pWall.x - w / 2, pWall.y - h * 0.95, w, h);
      }

      if (parts.oreBucket && idx % 2 === 1) {
        const pBucket = this.p(x + 300, y - 320, 0);
        const bw = 160 * pBucket.scale;
        const bh = 180 * pBucket.scale;
        context.drawImage(parts.oreBucket.image, pBucket.x - bw / 2, pBucket.y - bh / 2, bw, bh);
      }

      const bleacher = idx % 2 === 0 ? parts.goblinBleacherE : parts.goblinBleacherC;
      if (bleacher) {
        const pBleach = this.p(x + 550, y - 50, LANE.near - 150);
        const bw = 240 * pBleach.scale;
        const bh = 150 * pBleach.scale;
        context.drawImage(bleacher.image, pBleach.x - bw / 2, pBleach.y - bh * 0.85, bw, bh);
      }
    }
  }

  private drawBreakthroughStage() {
    const parts = this.assets.trackParts;
    if (!parts) return;
    const cam = this.view.offset;
    if (cam < 67000 || cam > 72000) return;

    const context = this.context;
    if (parts.waterfallCurtain) {
      const p = this.p(68400, this.y(68400), 0);
      const w = 1150 * p.scale;
      const h = 820 * p.scale;
      context.drawImage(parts.waterfallCurtain.image, p.x - w / 2, p.y - h * 0.98, w, h);
    }
    if (parts.stadiumGantry) {
      const p1 = this.p(69200, this.y(69200), 0);
      const w1 = 980 * p1.scale;
      const h1 = 580 * p1.scale;
      context.drawImage(parts.stadiumGantry.image, p1.x - w1 / 2, p1.y - h1 * 0.98, w1, h1);
    }
  }

  private drawWaterfallRiver() {
    const sheet = this.assets.trackParts?.waterfallSheet;
    if (!sheet) return;
    const z = LANE.far + 420;
    const range = this.view.visibleSpan(z, z, 400);
    const start = Math.max(23600, range.start);
    const end = Math.min(48500, range.end);
    if (start >= end) return;

    const context = this.context;
    const scrollY = (this.frame.time * 750) % 1024;
    const splashA = this.assets.trackParts?.waterfallSplash;
    const splashB = this.assets.trackParts?.waterfallSplashB;
    const splash = Math.floor(this.frame.time * 9) % 2 === 0 ? splashA : splashB;

    const step = 512;
    for (let x = Math.floor(start / step) * step; x < end; x += step) {
      const right = x + step;
      const y = this.y(x);
      const ny = this.y(right);
      const height = 650;
      const quad: Quad = [
        this.p(x, y - height, z),
        this.p(right, ny - height, z),
        this.p(right, ny + 90, z),
        this.p(x, y + 90, z),
      ];
      texturedQuad(context, sheet.image, { x: 0, y: scrollY, width: 512, height: 1024 }, quad);

      if (splash) {
        const point = this.p(x + step / 2, y + 40, z - 40);
        const sw = 280 * point.scale;
        const sh = 280 * point.scale;
        context.drawImage(splash.image, point.x - sw / 2, point.y - sh * 0.85, sw, sh);
      }
    }
  }

  private drawLavaChamber() {
    const lavaA = this.assets.trackParts?.lavaSheet;
    const lavaB = this.assets.trackParts?.lavaSheetB;
    const lavaC = this.assets.trackParts?.lavaSheetC;
    const lava = Math.floor(this.frame.time * 2) % 3 === 0 ? lavaA : Math.floor(this.frame.time * 2) % 3 === 1 ? lavaB : lavaC;
    if (!lava) return;
    const z = LANE.near - 80;
    const range = this.view.visibleSpan(z, z, 350);
    const start = Math.max(53000, range.start);
    const end = Math.min(67000, range.end);
    if (start >= end) return;
    const step = 512;
    for (let x = Math.floor(start / step) * step; x < end; x += step) {
      const right = x + step;
      const y = this.y(x) + 320;
      const ny = this.y(right) + 320;
      const quad: Quad = [
        this.p(x, y, LANE.far + 300),
        this.p(right, ny, LANE.far + 300),
        this.p(right, ny + 200, LANE.near - 300),
        this.p(x, y + 200, LANE.near - 300),
      ];
      texturedQuad(this.context, lava.image, { x: 0, y: 0, width: 512, height: 512 }, quad);
    }
  }

  /**
   * TICKET-06.2: Midground Environmental Depth Layer — Dense Wall of Trees & Theme Scenery.
   * Eliminates the bare ground void behind the spectator crowd and racetrack wall by rendering
   * two overlapping 3D depth tiers anchored to track elevation with height/flip variations.
   * Section 1 only (0..24000m).
   */
  private drawTreeWall() {
    const context = this.context;
    const sprite = this.course === 'boomtown'
      ? this.assets.treeWallBoomtown
      : this.course === 'sheep'
        ? this.assets.treeWallSheep
        : this.assets.treeWallPines;

    if (!sprite || !sprite.image) return;

    const tiers = [
      { z: LANE.far + 580, step: 240, baseHeight: 530, alpha: 0.82, offset: 120 },
      { z: LANE.far + 390, step: 175, baseHeight: 470, alpha: 0.98, offset: 0 },
    ];

    for (const tier of tiers) {
      const z = tier.z;
      const range = this.view.visibleSpan(z, z, 350);
      const start = Math.floor((range.start - tier.offset) / tier.step) * tier.step + tier.offset;
      const end = Math.min(range.end + tier.step, 24000);
      if (start >= end) continue;

      context.save();
      context.globalAlpha = tier.alpha;

      for (let x = start; x < end; x += tier.step) {
        const seed = Math.sin(x * 0.013 + tier.z * 0.007) * 43758.5453;
        const rand = seed - Math.floor(seed);
        const flip = Math.abs(Math.floor(x / tier.step)) % 2 === 1;
        const scaleMod = 0.88 + rand * 0.26;
        const height = tier.baseHeight * scaleMod;
        const width = height * (sprite.width / sprite.height);

        const baseY = this.y(x) + 130 + Math.sin(x * 0.004) * 12;
        const point = this.p(x, baseY, z);

        const screenW = width * point.scale;
        const screenH = height * point.scale;

        if (point.x + screenW / 2 < -60 || point.x - screenW / 2 > this.view.width + 60) continue;

        context.save();
        context.translate(point.x, point.y);
        if (flip) context.scale(-1, 1);
        context.drawImage(sprite.image, -screenW / 2, -screenH, screenW, screenH);
        context.restore();
      }
      context.restore();
    }
  }

  private drawLandmarks() {
    const z = LANE.far + 435;
    const range = this.view.visibleSpan(z, z, 230);
    const step = this.course === 'sheep' ? 1800 : 1170;
    for (let x = Math.floor(range.start / step) * step; x < Math.min(range.end, STADIUM_START - 300); x += step) {
      const point = this.p(x + 270, this.terrain(x + 270), z);
      const image = this.art.landmarks[Math.abs(Math.round(x / step)) % 2];
      const height = (this.course === 'sheep' ? 230 : 250) * point.scale;
      const width = height * 270 / 330;
      if (point.x + width < -60 || point.x - width > this.view.width + 60) continue;
      this.context.drawImage(image, point.x - width / 2, point.y - height * 0.95, width, height);
    }
  }

  drawTrack() {
    const range = this.view.visibleSpan(LANE.near, LANE.far, 240);
    const start = Math.floor(range.start / 256) * 256;
    const end = Math.ceil(range.end / 256) * 256;
    const cuts: number[] = [];
    for (let x = start; x <= end; x += 256) cuts.push(x);
    const gaps = this.gaps.filter((gap) => gap.x + gap.width >= start && gap.x <= end);
    for (const gap of gaps) {
      if (gap.x > start && gap.x < end) cuts.push(gap.x);
      if (gap.x + gap.width > start && gap.x + gap.width < end) cuts.push(gap.x + gap.width);
      const bounds = obstacleBounds(gap);
      this.fill(this.quad(gap.x, gap.x + gap.width, bounds.near, bounds.far, 154), '#050b07');
      this.drawGapWall(gap);
    }
    cuts.sort((a, b) => a - b);
    for (let i = cuts.length - 2; i >= 0; i--) {
      const x = cuts[i]; const right = cuts[i + 1];
      if (x === right) continue;
      const y = this.y(x); const ny = this.y(right);
      const top = this.quad(x, right, LANE.near, LANE.far);
      if (top.every((p) => p.y > HEIGHT + 120) || top.every((p) => p.y < -160)) continue;
      const front: Quad = [this.p(x, y, LANE.near), this.p(right, ny, LANE.near), this.p(right, ny + 154, LANE.near), this.p(x, y + 154, LANE.near)];
      const middle = (x + right) / 2;
      const crop = { x: mod(x, 512), y: 0, width: right - x, height: 128 };
      if (!this.inGap(middle)) texturedQuad(this.context, this.wall, crop, front);
      const hasGap = gaps.some((gap) => middle > gap.x && middle < gap.x + gap.width);
      if (!hasGap) {
        texturedQuad(this.context, this.deck, { ...crop, height: 512 }, top);
        if (middle >= 24000 && middle <= 48000) {
          this.context.save();
          this.context.globalAlpha = 0.32;
          this.fill(top, '#4ec5e8');
          this.context.restore();
        }
      }
      else {
        let lane = 0;
        while (lane < LANE_COUNT) {
          if (this.inGap(middle, laneZ(lane))) { lane++; continue; }
          const first = lane;
          while (lane + 1 < LANE_COUNT && !this.inGap(middle, laneZ(lane + 1))) lane++;
          const near = laneZ(lane) - LANE_WIDTH / 2;
          const far = laneZ(first) + LANE_WIDTH / 2;
          texturedQuad(this.context, this.deck, { ...crop, y: first * 128, height: (lane - first + 1) * 128 }, this.quad(x, right, near, far));
          lane++;
        }
      }
    }
    for (const gap of gaps) this.drawGapTrim(gap);
    this.drawCheckers(START_X + 220);
    this.drawCheckers(FINISH);
    this.drawGridNumbers();
    for (let x = Math.ceil(start / 2000) * 2000; x < end; x += 2000) {
      if (x < 2000 || this.inGap(x)) continue;
      const p = this.p(x, this.y(x) + 28, LANE.near - 1);
      this.context.fillStyle = '#cfc29a9e'; this.context.font = `${9 * p.scale}px "Space Mono", monospace`;
      this.context.fillText(`${Math.round((x - START_X) / 2).toLocaleString()} m`, p.x, p.y);
    }
  }

  private drawGapWall(gap: Obstacle) {
    const bounds = obstacleBounds(gap);
    for (const [x, normal] of [[gap.x, 1], [gap.x + gap.width, -1]]) {
      const y = this.y(x);
      if (!this.view.facing({ x, y, z: 0 }, { x: normal, y: 0, z: 0 })) continue;
      const quad: Quad = [this.p(x, y, bounds.near), this.p(x, y, bounds.far), this.p(x, y + 154, bounds.far), this.p(x, y + 154, bounds.near)];
      texturedQuad(this.context, this.wall, { x: 32, y: 0, width: 200, height: 128 }, quad);
      this.fill(quad, '#030b0866');
    }
    if (bounds.far < LANE.far) {
      const x = gap.x; const end = x + gap.width;
      const wall: Quad = [this.p(x, this.y(x), bounds.far), this.p(end, this.y(end), bounds.far), this.p(end, this.terrain(end), bounds.far), this.p(x, this.terrain(x), bounds.far)];
      texturedQuad(this.context, this.wall, { x: 0, y: 0, width: 200, height: 128 }, wall);
      this.fill(wall, '#030b0870');
    }
  }

  private drawGapTrim(gap: Obstacle) {
    const bounds = obstacleBounds(gap);
    const stripes = Math.round((bounds.far - bounds.near) / 28);
    for (const [edge, direction] of [[gap.x, -1], [gap.x + gap.width, 1]]) {
      const a = edge + direction * 2; const b = edge + direction * 15;
      for (let i = 0; i < stripes; i++) this.fill(this.quad(Math.min(a, b), Math.max(a, b), bounds.near + i * 28, Math.min(bounds.far, bounds.near + (i + 1) * 28), -1), i % 2 ? '#282d1e' : '#cd9e56');
    }
  }

  private drawCheckers(x: number) {
    const point = this.p(x, this.y(x));
    if (point.x < -460 || point.x > this.view.width + 460) return;
    const size = (LANE.far - LANE.near) / 24;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 24; col++) {
      const z = LANE.near + col * size;
      this.fill(this.quad(x + row * 18, x + row * 18 + 18, z, z + size, -0.8), (row + col) % 2 ? '#d3c99b' : '#273126');
    }
  }

  private drawGridNumbers() {
    if (this.frame.camera > 700) return;
    const context = this.context;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const p = this.p(START_X + 262, this.y(START_X + 262) - 0.7, laneZ(lane));
      context.save(); context.translate(p.x, p.y); context.rotate(-0.13); context.scale(p.scale, p.scale * 0.62);
      context.font = '800 34px "Barlow Condensed", sans-serif'; context.textAlign = 'center'; context.fillStyle = '#e5d2a68c';
      context.fillText(String(lane + 1).padStart(2, '0'), 0, 0); context.restore();
    }
  }

  private drawFence(z: number, base: number, height: number) {
    const range = this.view.visibleSpan(z, z, 230);
    const context = this.context;
    for (let x = Math.floor(range.start / 256) * 256; x < range.end; x += 256) {
      const bottom = this.p(x, this.y(x) + base, z);
      const top = this.p(x, this.y(x) + base - height, z);
      const next = this.p(x + 256, this.y(x + 256) + base - height + 5, z);
      context.lineWidth = 4.2 * top.scale; context.strokeStyle = '#293923';
      context.beginPath(); context.moveTo(bottom.x, bottom.y); context.lineTo(top.x, top.y); context.stroke();
      context.lineWidth = 1.2 * top.scale; context.strokeStyle = '#b397586b';
      context.beginPath(); context.moveTo(top.x, top.y + 5); context.quadraticCurveTo((top.x + next.x) / 2, (top.y + next.y) / 2 + 13, next.x, next.y); context.stroke();
    }
  }

  private makeTorch() {
    this.torch.width = 64; this.torch.height = 90;
    const context = this.torch.getContext('2d')!;
    const glow = context.createRadialGradient(32, 31, 1, 32, 31, 31);
    glow.addColorStop(0, '#ffbb6b74'); glow.addColorStop(1, '#ff9c4300');
    context.fillStyle = glow; context.fillRect(0, 0, 64, 64);
    context.fillStyle = '#182820'; context.fillRect(21, 48, 22, 10);
    context.fillStyle = '#ffb765'; context.beginPath(); context.moveTo(26, 50); context.quadraticCurveTo(18, 38, 35, 10); context.quadraticCurveTo(47, 39, 38, 50); context.fill();
    context.fillStyle = '#ffe8af'; context.beginPath(); context.ellipse(32, 40, 3, 10, 0, 0, TAU); context.fill();
  }

  drawTracksideLights() {
    const z = LANE.near - 62;
    const range = this.view.visibleSpan(z, z, 150);
    for (let x = Math.floor((range.start - 430) / 1250) * 1250 + 430; x < range.end; x += 1250) {
      const tip = this.p(x, this.y(x) - 27, z);
      const base = this.p(x, this.terrain(x), z);
      this.context.strokeStyle = '#1b2b1f'; this.context.lineWidth = 5 * tip.scale;
      this.context.beginPath(); this.context.moveTo(tip.x, tip.y); this.context.lineTo(base.x, base.y); this.context.stroke();
      this.context.drawImage(this.torch, tip.x - 21 * tip.scale, tip.y - 34 * tip.scale, 42 * tip.scale, 59 * tip.scale);
    }
  }

  private makeStadium() {
    this.stadium.width = 1400; this.stadium.height = 500;
    const context = this.stadium.getContext('2d')!;
    context.fillStyle = this.palette.foreground;
    context.beginPath(); context.moveTo(0, 95); context.quadraticCurveTo(700, -36, 1400, 95); context.lineTo(1400, 500); context.lineTo(0, 500); context.fill();
    for (let row = 0; row < 4; row++) {
      const height = 148; const y = 46 + row * 104;
      for (let col = 0; col < 5; col++) {
        const x = col * 300 - 45;
        const curve = Math.pow((x + 150 - 700) / 700, 2) * 62;
        context.drawImage(this.assets.grandstand.image, x, y + curve, 302, height);
      }
      context.fillStyle = this.palette.middle; context.fillRect(0, y + 133, 1400, 14);
      context.fillStyle = this.palette.accent; context.fillRect(0, y + 133, 1400, 3);
    }
    for (let x = 16; x < 1400; x += 228) {
      context.fillStyle = '#283a2a'; context.fillRect(x, 36, 15, 440);
      context.fillStyle = '#b99962'; context.fillRect(x + 1, 30, 3, 435);
    }
    context.fillStyle = '#14231b'; context.fillRect(441, 2, 518, 56);
    context.strokeStyle = '#b39055'; context.lineWidth = 3; context.strokeRect(441, 2, 518, 56);
    context.fillStyle = this.palette.chalk; context.textAlign = 'center'; context.font = '900 33px sans-serif'; context.fillText(TRACKS[this.course].stadium, 700, 42);
  }

  private drawStadium() {
    const z = LANE.far + 590;
    const range = this.view.visibleSpan(z, z, 420);
    const left = Math.max(STADIUM_START - 350, range.start);
    const right = Math.min(FINISH + 700, range.end);
    if (left >= right) return;
    const width = 2100;
    const height = 515;
    const start = STADIUM_START - 350;
    for (let tile = Math.max(0, Math.floor((left - start) / width)); tile <= Math.floor((right - start) / width); tile++) {
      const x = start + tile * width;
      const y = this.y(Math.max(STADIUM_START, x)) + 85;
      for (let i = 0; i < 4; i++) {
        const a = x + i * width / 4; const b = a + width / 4;
        const quad: Quad = [this.p(a, y - height, z), this.p(b, y - height, z), this.p(b, y, z), this.p(a, y, z)];
        texturedQuad(this.context, this.stadium, { x: i * 350, y: 0, width: 350, height: 500 }, quad);
      }
    }
  }

  drawForeground() {
    this.drawFence(LANE.near - 55, 154, 87);
    this.crowdStrip(this.assets.crowd, LANE.near - 172, 196, 320, 0.96);
    if (!this.lowDetail) this.crowdStrip(this.assets.crowd, LANE.near - 310, 245, 360, 0.94, STADIUM_START - 420, FINISH + 1000);
    const context = this.context;
    const fade = context.createLinearGradient(0, HEIGHT * 0.79, 0, HEIGHT);
    fade.addColorStop(0, '#080f0a00'); fade.addColorStop(1, '#080f0af7');
    context.fillStyle = fade; context.fillRect(0, HEIGHT * 0.79, this.view.width, HEIGHT * 0.21);
    const top = context.createLinearGradient(0, 0, 0, 128);
    top.addColorStop(0, '#081510a6'); top.addColorStop(1, '#08151000');
    context.fillStyle = top; context.fillRect(0, 0, this.view.width, 128);
  }

  destroy() {
    this.stadium.width = this.torch.width = 1;
  }
}