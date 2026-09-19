import type { GameAssets } from './assets';
import type { RangeCamera } from './projection';
import { FINISH, HEIGHT, LANE, LANE_COUNT, LANE_WIDTH, STADIUM_START, START_X, courseY, laneZ, obstacleBounds, occupiesLane, terrainY, type Obstacle, type SceneFrame } from './scene';
import { polygon, texturedQuad, type Quad } from './texture';
import { TRACKS } from './courses';
import { buildCourseArt, type CourseArt } from './world-art';
import type { CourseId } from './types';
import { SECTION_TWO, SECTION_TWO_START, mx, surfaceKindAt, type TrackSurface } from './stage-two';
import { buildStageTwoArt, type StageTwoArt } from './stage-two-art';

const TAU = Math.PI * 2;
const mod = (x: number, n: number) => ((x % n) + n) % n;
/** A cached sheet the shared tiler can draw: sprites and canvases both qualify. */
interface ArtSheet { image: CanvasImageSource; width: number; height: number }
/** Section 2 deck bands cover 1024 world units across 512 px (0.5 px per unit). */
const BAND_SCALE = 0.5;
/** A deck band is 256 pixels wide per lane, 120 pixels tall. */
const BAND_LANE = 120;

export class ArenaEnvironment {
  private frame!: SceneFrame;
  private gaps: Obstacle[] = [];
  private lastObstacles: Obstacle[] | null = null;
  private lowDetail = false;
  private deck: HTMLCanvasElement;
  private wall: HTMLCanvasElement;
  private art: CourseArt;
  private stageTwo!: StageTwoArt;
  /** Wrappers so the shared crowd/band tiler can draw the Section 2 sheets as sprites. */
  private cliffWall!: ArtSheet;
  private scaffold!: ArtSheet;
  private readonly stadium = document.createElement('canvas');
  private readonly torch = document.createElement('canvas');

  constructor(private context: CanvasRenderingContext2D, private readonly view: RangeCamera, private readonly assets: GameAssets, private course: CourseId = 'ridge') {
    this.art = buildCourseArt(course, assets);
    this.buildStageTwo();
    this.deck = this.art.dirt;
    this.wall = this.art.bank;
    this.makeStadium();
    this.makeTorch();
  }

  /** TICKET-08: Section 2 sheets are built once per course, never per frame. */
  private buildStageTwo() {
    this.stageTwo = buildStageTwoArt(this.assets, this.course);
    this.cliffWall = { image: this.stageTwo.chasm, width: this.stageTwo.chasm.width, height: this.stageTwo.chasm.height };
    this.scaffold = { image: this.stageTwo.scaffolding, width: this.stageTwo.scaffolding.width, height: this.stageTwo.scaffolding.height };
  }

  /** World x where Section 2 takes over: the waterfall cliff begins here. */
  private get cliffStart() { return SECTION_TWO_START; }
  private get gorgeStart() { return mx(SECTION_TWO.lip) - 150; }
  private get gorgeEnd() { return mx(SECTION_TWO.landing) + 120; }
  private get bridgeStart() { return mx(21660); }
  private get bridgeEnd() { return mx(21960); }

  /** How visible Section 2 is: 0 while Stage 1 fills the screen, 1 once the gorge does. */
  private cliffFade() {
    if (!this.frame.options.parallax) return 1;
    const camera = this.frame.camera;
    return Math.max(0, Math.min(1, (camera - (mx(10200) - 1400)) / 2600));
  }

  begin(frame: SceneFrame, lowDetail = false) {
    this.frame = frame;
    this.lowDetail = lowDetail;
    if (this.course !== frame.options.course) {
      this.course = frame.options.course;
      this.art = buildCourseArt(this.course, this.assets); this.deck = this.art.dirt; this.wall = this.art.bank;
      this.buildStageTwo();
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

    // ---- Layer 1: Far Sky (painted skybox if available, else procedural gradient) ----
    const skyImage = this.art.skyboxImage ?? this.art.sky;
    this.drawTiledLayer(skyImage, HEIGHT + 55, this.frame.camera * (parallax ? 0.05 : 0.15) + this.frame.drift * 0.1, -35);

    // ---- Atmospheric fog tint at horizon for mood ----
    const fogGrad = context.createLinearGradient(0, HEIGHT * 0.35, 0, HEIGHT * 0.7);
    fogGrad.addColorStop(0, `${lighting.fogColor}00`);
    fogGrad.addColorStop(1, `${lighting.fogColor}22`);
    context.fillStyle = fogGrad;
    context.fillRect(0, HEIGHT * 0.35, this.view.width, HEIGHT * 0.35);

    // ---- Layer 2: Distant mountains / city silhouettes (0.15x parallax) ----
    this.drawTiledLayerTransparent(this.art.farMountains, HEIGHT + 35, this.frame.camera * (parallax ? 0.15 : 0.35) + this.frame.drift * 0.15, 100);

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

    this.drawChasm();
    this.drawBlimps();
  }

  /**
   * TICKET-08 tier 4-5: the far canyon. The primary plunge falls behind the track from the
   * lip down past the horizon, sheeted mist rises out of the gorge floor, and a second
   * cliff face closes the far side. All of it is painted from cached sheets and scrolled
   * by source offset, so an animated waterfall costs two drawImage calls per layer.
   */
  private drawChasm() {
    const fade = this.cliffFade();
    if (fade <= 0.01) return;
    const context = this.context;
    const lip = mx(SECTION_TWO.lip);
    const deck = this.y(mx(12360));
    const anchor = this.p(mx(12360), deck, LANE.far + 520);
    const scale = anchor.scale;
    if (anchor.x < -1400 || anchor.x > this.view.width + 1400) return;
    context.save();
    context.globalAlpha = fade;
    const sheet = this.stageTwo.water.sheet;
    const scroll = this.frame.reducedMotion ? 0 : this.frame.time * 420;
    const fallHeight = 1560 * scale;
    const fallWidth = 1900 * scale;
    const top = anchor.y - 520 * scale;
    // Two stacked windows into the sheet give a seamless pour at any scroll offset.
    const window = 768;
    const offset = (scroll % window + window) % window;
    context.drawImage(sheet, 0, offset, 512, window, anchor.x - fallWidth * 0.5, top, fallWidth, fallHeight * (window / 768));
    context.drawImage(sheet, 0, offset + window > 1536 ? 0 : offset + window, 512, window,
      anchor.x - fallWidth * 0.62, top + fallHeight * (window / 768) * 0.86, fallWidth * 1.24, fallHeight * 0.6);
    // Far cliff wall behind the plunge (tier 4).
    const wall = this.p(lip + 2400, this.terrain(lip + 2400) - 240, LANE.far + 1500);
    const wallWidth = 2600 * wall.scale;
    const wallHeight = 900 * wall.scale;
    context.globalAlpha = fade * 0.92;
    context.drawImage(this.stageTwo.chasm, ((this.frame.camera * 0.05) % 512 + 512) % 512, 0, 640, 900, wall.x - wallWidth * 0.5, wall.y - wallHeight * 0.4, wallWidth, wallHeight);
    // Churning foam where the fall lands.
    const foam = this.stageTwo.water.foam;
    const foamWidth = 2400 * scale;
    const foamHeight = 420 * scale;
    const foamY = anchor.y + 640 * scale;
    context.globalAlpha = fade * 0.85;
    for (let tile = -1; tile <= 1; tile++) {
      context.drawImage(foam, 0, 0, 512, 256, anchor.x - foamWidth * 0.5 + tile * foamWidth * 0.5, foamY, foamWidth * 0.6, foamHeight);
    }
    // Sheet foam spilling over the lip itself.
    const lipPoint = this.p(lip, this.y(lip) + 40, LANE.far + 120);
    const lipWidth = 2200 * lipPoint.scale;
    context.globalAlpha = fade * 0.9;
    context.drawImage(foam, 0, 0, 512, 256, lipPoint.x - lipWidth * 0.5, lipPoint.y - 90 * lipPoint.scale, lipWidth, 210 * lipPoint.scale);
    // Mist rising out of the gorge (tier 3-4 boundary).
    const mist = this.stageTwo.water.mist;
    const mistWidth = 3200 * scale;
    const mistHeight = 700 * scale;
    const mistOffset = this.frame.reducedMotion ? 0 : this.frame.time * 26;
    context.globalAlpha = fade * 0.75;
    for (let tile = -1; tile <= 1; tile++) {
      context.drawImage(mist, 0, 0, 1024, 256, anchor.x - mistWidth * 0.5 + tile * mistWidth * 0.42 - (mistOffset % mistWidth) * 0.3,
        anchor.y + 300 * scale - mistHeight * 0.5 - mistOffset * 0.4, mistWidth * 0.5, mistHeight);
    }
    context.restore();
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
    const context = this.context;
    const spacing = 1450;
    const movement = this.frame.reducedMotion ? 0 : this.frame.time * 7;
    // TICKET-06: Layer 3 midground — watchtowers/blimps at 0.4x parallax.
    const offset = this.frame.camera * (this.frame.options.parallax ? 0.4 : 0.5) - movement;
    const first = Math.floor((offset - 950) / spacing) - 1;
    for (let index = first; index < first + Math.ceil(this.view.width / spacing) + 3; index++) {
      const x = 950 + index * spacing - offset;
      const w = Math.abs(index) % 2 ? 196 : 270;
      if (x < -w - 40 || x > this.view.width + 40) continue;
      const y = 100 + Math.abs(index % 3) * 27 + (this.frame.reducedMotion ? 0 : Math.sin(this.frame.time * 0.35 + index) * 4);
      const blimp = this.art.blimp;
      context.save(); context.globalAlpha = 0.66;
      // Uses the sprite's own aspect ratio: the painted airship is not 520x270.
      context.drawImage(blimp, x, y, w, w * blimp.height / blimp.width); context.restore();
    }
  }

  drawTerrain() {
    const range = this.view.visibleSpan(LANE.near - 850, LANE.far + 1500, 250);
    const step = 256;
    for (let x = Math.floor(range.start / step) * step; x < range.end; x += step) {
      const stadium = x >= STADIUM_START;
      // TICKET-08: the gorge has no floor. The chasm painted in drawLandscape shows
      // through instead, which is what makes the leap off the lip read as freefall.
      if (x + step <= this.gorgeStart || x >= this.gorgeEnd) {
        this.fill(this.quad(x, x + step, LANE.near - 850, LANE.far + 1500, 153), stadium ? this.palette.grass : this.palette.soil);
      }
      this.fill(this.quad(x, x + step, LANE.far + 6, LANE.far + 380, 153), this.palette.shoulder);
    }
  }

  private crowdStrip(sprite: ArtSheet, z: number, baseOffset: number, height: number, alpha: number, start?: number, end?: number) {
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
    this.drawLandmarks();
    const step = 256;
    const crest = this.cliffStart;
    for (let x = Math.floor(range.start / step) * step; x < range.end; x += step) {
      const y = this.y(x);
      const ny = this.y(x + step);
      this.fill([this.p(x, y + 67, z), this.p(x + step, ny + 67, z), this.p(x + step, ny + 155, z), this.p(x, y + 155, z)], '#2a301d');
      const context = this.context;
      context.strokeStyle = '#655b365e'; context.lineWidth = 4 * this.p(x, y).scale;
      const a = this.p(x + 16, y + 146, z - 1); const b = this.p(x + step - 12, ny + 72, z - 1);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    // TICKET-08: the meadow crowd stops at the crest; Section 2 gets scaffolding instead.
    this.crowdStrip(this.assets.grandstand, z, 68, 200, 0.86, undefined, crest - 120);
    this.drawFence(LANE.far + 65, 142, 114, undefined, crest - 120);
    this.drawCliffWall();
  }

  /**
   * TICKET-08 tier 2-3: the sheer granite wall the switchbacks hug, the multi-tiered
   * goblin spectator scaffolding bolted to it, and the midground buttresses behind both.
   * All three are the same cached sheets the Stage 1 grandstands use, re-z'd and re-lit.
   */
  private drawCliffWall() {
    const fade = this.cliffFade();
    if (fade <= 0.01) return;
    const crest = this.cliffStart;
    const end = FINISH + 700;
    const context = this.context;
    context.save();
    // Midground rock buttresses (tier 3): further away, softer, drawn first.
    this.crowdStrip(this.cliffWall, LANE.far + 690, -120, 470, fade * 0.5, crest - 200, end);
    // The wall itself, right behind the track (tier 2).
    this.crowdStrip(this.cliffWall, LANE.far + 300, 20, 430, fade * 0.95, crest - 60, end);
    // Goblin scaffolding clinging to the wall (tier 2), with lit torches in front.
    this.crowdStrip(this.scaffold, LANE.far + 140, 24, 340, fade, crest, end);
    this.crowdStrip(this.scaffold, LANE.far + 430, -40, 300, fade * 0.8, crest - 900, end);
    context.restore();
    this.drawScaffoldTorches(crest, end, fade);
  }

  /** Lanterns and torches along the scaffolding, drawn live so they flicker. */
  private drawScaffoldTorches(start: number, end: number, fade: number) {
    const context = this.context;
    const z = LANE.far + 140;
    const range = this.view.visibleSpan(z, z, 240);
    const from = Math.max(start, range.start);
    const to = Math.min(end, range.end);
    if (from >= to) return;
    for (let x = Math.ceil(from / 620) * 620; x < to; x += 620) {
      const base = this.p(x, this.y(x) - 210, z + 10);
      if (base.x < -60 || base.x > this.view.width + 60) continue;
      const flicker = this.frame.reducedMotion ? 0.5 : 0.5 + Math.sin(this.frame.time * 7 + x * 0.01) * 0.5;
      context.save();
      context.globalAlpha = fade * (0.55 + flicker * 0.35);
      context.fillStyle = '#ffb765';
      context.beginPath(); context.ellipse(base.x, base.y, 5 * base.scale, 9 * base.scale, 0, 0, TAU); context.fill();
      context.globalAlpha = fade * 0.35;
      context.fillStyle = '#ffd9a0';
      context.beginPath(); context.ellipse(base.x, base.y, 2.4 * base.scale, 5 * base.scale, 0, 0, TAU); context.fill();
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
      // Section 2 voids are cliff edges, not roadworks: the gorge below stays visible.
      this.fill(this.quad(gap.x, gap.x + gap.width, bounds.near, bounds.far, 154), gap.x >= this.cliffStart ? '#060d0ab4' : '#050b07');
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
      // TICKET-08: past the Scrape Fall Crest the deck is timber, mossy slate or riveted
      // steel instead of packed earth, so the surface under the ball always matches the
      // physics the engine is running (wet timber steers 40% looser than Stage 1 dirt).
      const surface: TrackSurface = right > this.cliffStart ? surfaceKindAt(middle, this.course) : 'dirt';
      if (surface !== 'dirt') {
        const band = this.stageTwo.deck[surface];
        const tile = 256 * BAND_SCALE;
        const cropX = (((Math.floor(x / 256) % 4) + 4) % 4) * tile;
        if (!hasGap) texturedQuad(this.context, band, { x: cropX, y: 0, width: tile, height: 480 }, top);
        else {
          let lane = 0;
          while (lane < LANE_COUNT) {
            if (this.inGap(middle, laneZ(lane))) { lane++; continue; }
            const first = lane;
            while (lane + 1 < LANE_COUNT && !this.inGap(middle, laneZ(lane + 1))) lane++;
            const near = laneZ(lane) - LANE_WIDTH / 2;
            const far = laneZ(first) + LANE_WIDTH / 2;
            texturedQuad(this.context, band, { x: cropX, y: first * BAND_LANE, width: tile, height: (lane - first + 1) * BAND_LANE }, this.quad(x, right, near, far));
            lane++;
          }
        }
      } else if (!hasGap) texturedQuad(this.context, this.deck, { ...crop, height: 512 }, top);
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
    this.drawRopeBridge();
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

  private drawFence(z: number, base: number, height: number, start?: number, end?: number) {
    const range = this.view.visibleSpan(z, z, 230);
    const context = this.context;
    const from = Math.max(range.start, start ?? -Infinity);
    const to = Math.min(range.end, end ?? Infinity);
    for (let x = Math.floor(from / 256) * 256; x < to; x += 256) {
      const bottom = this.p(x, this.y(x) + base, z);
      const top = this.p(x, this.y(x) + base - height, z);
      const next = this.p(x + 256, this.y(x + 256) + base - height + 5, z);
      context.lineWidth = 4.2 * top.scale; context.strokeStyle = '#293923';
      context.beginPath(); context.moveTo(bottom.x, bottom.y); context.lineTo(top.x, top.y); context.stroke();
      context.lineWidth = 1.2 * top.scale; context.strokeStyle = '#b397586b';
      context.beginPath(); context.moveTo(top.x, top.y + 5); context.quadraticCurveTo((top.x + next.x) / 2, (top.y + next.y) / 2 + 13, next.x, next.y); context.stroke();
    }
  }

  /**
   * TICKET-08: the swinging suspension bridge over the 120 m chasm between the two cliff
   * spires. Only lanes 1 and 2 keep planks; the outer lanes are void, so the bridge is a
   * real line choice. The sway is a decaying sine driven by the run clock, never by layout.
   */
  private drawRopeBridge() {
    const start = this.bridgeStart; const end = this.bridgeEnd;
    const range = this.view.visibleSpan(LANE.near, LANE.far, 300);
    if (end < range.start || start > range.end) return;
    const context = this.context;
    const span = end - start;
    const segments = 14;
    const sway = this.frame.reducedMotion ? 0 : Math.sin(this.frame.time * 1.35) * 9 + Math.sin(this.frame.time * 2.7) * 3;
    const near = laneZ(2) - LANE_WIDTH / 2 - 12;
    const far = laneZ(1) + LANE_WIDTH / 2 + 12;
    const deckAt = (x: number) => this.y(x) + 6;
    // Planks spanning the two centre lanes, each one sagging with the sway.
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const x = start + span * t;
      const next = start + span * (i + 1) / segments;
      const sag = Math.sin(t * Math.PI) * 34;
      const swing = sway * Math.sin(t * Math.PI + this.frame.time * 0.8);
      const a = this.p(x, deckAt(x) + sag, far + swing);
      const b = this.p(next, deckAt(next) + Math.sin((i + 1) / segments * Math.PI) * 34, far + swing * 0.9);
      const c = this.p(next, deckAt(next) + Math.sin((i + 1) / segments * Math.PI) * 34, near - swing * 0.9);
      const d = this.p(x, deckAt(x) + sag, near - swing);
      const quad: Quad = [a, b, c, d];
      this.fill(quad, i % 2 ? '#5a3c22' : '#4a3018');
      const plank = this.stageTwo.deck.wood;
      texturedQuad(context, plank, { x: 0, y: 0, width: 96, height: 480 }, quad);
      this.fill(quad, i % 2 ? '#3a271555' : '#2c1d0f66');
      // Rope rails and the vertical hangers.
      context.strokeStyle = '#c6b283c4'; context.lineWidth = 2.2 * a.scale;
      context.beginPath(); context.moveTo(a.x, a.y - 16 * a.scale); context.lineTo(b.x, b.y - 16 * b.scale); context.stroke();
      context.beginPath(); context.moveTo(d.x, d.y - 16 * d.scale); context.lineTo(c.x, c.y - 16 * c.scale); context.stroke();
      context.strokeStyle = '#9c8757a6'; context.lineWidth = 1.4 * a.scale;
      context.beginPath(); context.moveTo((a.x + d.x) / 2, (a.y + d.y) / 2 - 18 * a.scale); context.lineTo((a.x + d.x) / 2, (a.y + d.y) / 2); context.stroke();
    }
    // Spire posts at both ends, with lanterns.
    for (const x of [start, end]) {
      const side = x === start ? 1 : -1;
      for (const z of [LANE.far + 30, LANE.near - 30]) {
        const base = this.p(x, this.y(x), z);
        const top = this.p(x, this.y(x) - 150, z);
        context.strokeStyle = '#3d2a17'; context.lineWidth = 9 * base.scale;
        context.beginPath(); context.moveTo(base.x, base.y); context.lineTo(top.x, top.y); context.stroke();
        context.strokeStyle = '#8a6a41'; context.lineWidth = 3.4 * base.scale;
        context.beginPath(); context.moveTo(base.x, base.y); context.lineTo(top.x, top.y); context.stroke();
        const flicker = this.frame.reducedMotion ? 0.5 : 0.5 + Math.sin(this.frame.time * 6 + x * 0.02 + side) * 0.5;
        context.globalAlpha = 0.5 + flicker * 0.4;
        context.fillStyle = '#ffc07a';
        context.beginPath(); context.ellipse(top.x, top.y, 4.4 * top.scale, 8 * top.scale, 0, 0, TAU); context.fill();
        context.globalAlpha = 1;
      }
    }
  }

  /**
   * TICKET-08 tier 0: foreground water spray and the rock edges that frame the chute.
   * Both are screen-space parallax bands anchored to the gorge, so they cost two draws
   * and rise off the churning water instead of scrolling with the track.
   */
  private drawChasmSpray() {
    const fade = this.cliffFade();
    if (fade <= 0.01) return;
    const context = this.context;
    const anchor = this.p(mx(12400), this.y(mx(12400)), LANE.near - 260);
    const paint = this.frame.reducedMotion ? 0 : (this.frame.time * 34) % 1;
    context.save();
    context.globalAlpha = fade * 0.5;
    // Droplets thrown up off the plunge pool, drifting up the screen.
    for (let i = 0; i < 34; i++) {
      const seed = i * 12.9898;
      const baseX = (Math.sin(seed) * 43758.5453 % 1 + 1) % 1;
      const x = anchor.x + (baseX - 0.5) * this.view.width * 0.9;
      const rise = ((paint + i * 0.137) % 1);
      const y = anchor.y + 240 - rise * 520;
      const size = (1.2 + (i % 4) * 0.7) * (1 - rise * 0.35);
      context.fillStyle = `rgba(226, 244, 252, ${(1 - rise) * 0.5})`;
      context.beginPath(); context.ellipse(x + Math.sin(this.frame.time * 1.4 + i) * 12, y, size, size * 1.6, 0, 0, TAU); context.fill();
    }
    // Overhanging rock edges creeping in from the corners.
    this.crowdStrip(this.cliffWall, LANE.near - 520, 120, 300, fade * 0.55, this.cliffStart - 400, FINISH + 400);
    context.restore();
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
      context.fillStyle = this.palette.accent; context.beginPath(); context.moveTo(x + 3, 10); context.lineTo(x + 76, 25); context.lineTo(x + 3, 46); context.fill();
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
    this.drawFence(LANE.near - 55, 154, 87, undefined, this.cliffStart - 120);
    this.crowdStrip(this.assets.crowd, LANE.near - 172, 196, 320, 0.96, undefined, this.cliffStart - 60);
    if (!this.lowDetail) this.crowdStrip(this.assets.crowd, LANE.near - 310, 245, 360, 0.94, STADIUM_START - 420, FINISH + 1000);
    this.drawChasmSpray();
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