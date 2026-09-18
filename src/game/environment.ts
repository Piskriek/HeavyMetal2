import type { GameAssets, Sprite } from './assets';
import type { RangeCamera } from './projection';
import { FINISH, HEIGHT, LANE, LANE_COUNT, LANE_WIDTH, STADIUM_START, START_X, STAGE_2_END, STAGE_2_START, courseY, laneZ, obstacleBounds, occupiesLane, terrainY, type Obstacle, type SceneFrame } from './scene';
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
  private wetDeck: HTMLCanvasElement;
  private mossDeck: HTMLCanvasElement;
  private readonly waterfallBackdrop: HTMLCanvasElement;
  private art: CourseArt;
  private readonly stadium = document.createElement('canvas');
  private readonly torch = document.createElement('canvas');

  constructor(private context: CanvasRenderingContext2D, private readonly view: RangeCamera, private readonly assets: GameAssets, private course: CourseId = 'ridge') {
    this.art = buildCourseArt(course, assets);
    this.deck = this.art.dirt;
    this.wall = this.art.bank;
    this.wetDeck = this.makeTrackMaterial(assets.stripWood, '#3d5d5a');
    this.mossDeck = this.makeTrackMaterial(assets.stripMoss, '#526b59');
    this.waterfallBackdrop = this.makeWaterfallBackdrop();
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

    // ---- Section 2: opposite granite wall, primary falls, and canyon mist ----
    this.drawWaterfallBackdrop();

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
      this.fill(this.quad(x, x + step, LANE.near - 850, LANE.far + 1500, 153), stadium ? this.palette.grass : this.palette.soil);
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
    this.drawLandmarks();
    this.drawCliffScaffolding(false);
    const step = 256;
    for (let x = Math.floor(range.start / step) * step; x < range.end; x += step) {
      const y = this.y(x);
      const ny = this.y(x + step);
      this.fill([this.p(x, y + 67, z), this.p(x + step, ny + 67, z), this.p(x + step, ny + 155, z), this.p(x, y + 155, z)], '#2a301d');
      const context = this.context;
      context.strokeStyle = '#655b365e'; context.lineWidth = 4 * this.p(x, y).scale;
      const a = this.p(x + 16, y + 146, z - 1); const b = this.p(x + step - 12, ny + 72, z - 1);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    this.crowdStrip(this.assets.grandstand, z, 68, 200, 0.86);
    this.drawFence(LANE.far + 65, 142, 114);
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
      const trackMaterial = this.materialForTrack(middle);
      if (!hasGap) texturedQuad(this.context, trackMaterial, { ...crop, height: 512 }, top);
      else {
        let lane = 0;
        while (lane < LANE_COUNT) {
          if (this.inGap(middle, laneZ(lane))) { lane++; continue; }
          const first = lane;
          while (lane + 1 < LANE_COUNT && !this.inGap(middle, laneZ(lane + 1))) lane++;
          const near = laneZ(lane) - LANE_WIDTH / 2;
          const far = laneZ(first) + LANE_WIDTH / 2;
          texturedQuad(this.context, trackMaterial, { ...crop, y: first * 128, height: (lane - first + 1) * 128 }, this.quad(x, right, near, far));
          lane++;
        }
      }
    }
    for (const gap of gaps) this.drawGapTrim(gap);
    this.drawSwitchbackBerms();
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

  private drawSwitchbackBerms() {
    const range = this.view.visibleSpan(LANE.near - 80, LANE.far + 80, 260);
    const start = Math.max(range.start, STAGE_2_START - 700);
    const end = Math.min(range.end, STAGE_2_END + 300);
    if (start >= end) return;
    const step = 2100;
    for (let index = Math.floor(start / step); index * step < end; index++) {
      const x = index * step;
      if (x < start - step || x > end) continue;
      const right = Math.min(x + 980, end);
      const near = index % 2 === 0;
      const z = near ? LANE.near - 34 : LANE.far + 34;
      const height = 62 + (index % 3) * 14;
      const a = this.p(x, this.y(x) + 18, z);
      const b = this.p(right, this.y(right) + 18, z);
      const c = this.p(right, this.y(right) - height, z);
      const d = this.p(x, this.y(x) - height, z);
      this.context.save();
      polygon(this.context, [a, b, c, d]); this.context.fillStyle = near ? '#55351fdd' : '#70472ad9'; this.context.fill();
      this.context.strokeStyle = '#b27a4499'; this.context.lineWidth = Math.max(1, 3 * a.scale);
      this.context.beginPath(); this.context.moveTo(d.x, d.y); this.context.lineTo(c.x, c.y); this.context.stroke();
      for (let post = 0; post < 5; post++) {
        const t = post / 4; const px = x + (right - x) * t; const bottom = this.p(px, this.y(px) + 22, z); const top = this.p(px, this.y(px) - height - 4, z);
        this.context.strokeStyle = '#2b1a10cc'; this.context.lineWidth = Math.max(2, 6 * top.scale);
        this.context.beginPath(); this.context.moveTo(bottom.x, bottom.y); this.context.lineTo(top.x, top.y); this.context.stroke();
      }
      this.context.restore();
    }
  }

  private materialForTrack(x: number) {
    if (x >= STAGE_2_START && x < STAGE_2_END) return x < STAGE_2_START + 7800 ? this.wetDeck : this.mossDeck;
    return this.deck;
  }

  private makeTrackMaterial(sprite: Sprite, tint: string) {
    const target = document.createElement('canvas'); target.width = target.height = 512;
    const context = target.getContext('2d')!;
    context.fillStyle = tint; context.fillRect(0, 0, 512, 512);
    const height = Math.max(52, 512 * sprite.height / Math.max(1, sprite.width));
    for (let y = 0; y < 512; y += height - 1) context.drawImage(sprite.image, 0, y, 512, height);
    context.fillStyle = '#122d2d38'; context.fillRect(0, 0, 512, 512);
    for (const y of [0, 128, 256, 384, 508]) { context.fillStyle = '#e6d29b78'; context.fillRect(0, y, 512, 3); }
    for (let lane = 0; lane < 4; lane++) {
      context.strokeStyle = lane % 2 ? '#172c2b52' : '#f5e4af3a'; context.lineWidth = 3; context.setLineDash([34, 28]);
      context.beginPath(); context.moveTo(0, lane * 128 + 64); context.lineTo(512, lane * 128 + 64); context.stroke();
    }
    context.setLineDash([]);
    return target;
  }

  private makeWaterfallBackdrop() {
    const target = document.createElement('canvas'); target.width = 1800; target.height = 620;
    const context = target.getContext('2d')!;
    const rock = context.createLinearGradient(0, 0, 0, 620);
    rock.addColorStop(0, '#1c3440'); rock.addColorStop(0.52, '#29464a'); rock.addColorStop(1, '#10282c');
    context.fillStyle = rock; context.fillRect(0, 0, target.width, target.height);
    context.fillStyle = '#12252b';
    context.beginPath(); context.moveTo(0, 0); context.lineTo(360, 0); context.lineTo(300, 110); context.lineTo(380, 190); context.lineTo(260, 286); context.lineTo(335, 388); context.lineTo(220, 620); context.lineTo(0, 620); context.closePath(); context.fill();
    context.beginPath(); context.moveTo(1800, 0); context.lineTo(1440, 0); context.lineTo(1510, 115); context.lineTo(1415, 214); context.lineTo(1535, 300); context.lineTo(1450, 430); context.lineTo(1580, 620); context.lineTo(1800, 620); context.closePath(); context.fill();
    for (let i = 0; i < 13; i++) {
      const x = 90 + i * 137;
      const width = 34 + (i % 4) * 13;
      const start = 95 + (i % 3) * 28;
      const water = context.createLinearGradient(0, start, 0, 590);
      water.addColorStop(0, '#b8e8e58a'); water.addColorStop(0.24, '#7ec9d080'); water.addColorStop(0.72, '#4a9dab60'); water.addColorStop(1, '#d6f5e52e');
      context.fillStyle = water;
      context.beginPath(); context.moveTo(x, start); context.quadraticCurveTo(x + width * 0.7, start + 40, x + width * 0.48, 590); context.lineTo(x + width * 1.25, 590); context.quadraticCurveTo(x + width * 1.05, start + 30, x + width, start); context.closePath(); context.fill();
      context.fillStyle = '#e7fff0a0';
      for (let y = start + 54; y < 570; y += 74) { context.fillRect(x + (y * 0.13 + i * 11) % Math.max(8, width), y, Math.max(3, width * 0.25), 4); }
    }
    const mist = context.createLinearGradient(0, 360, 0, 620);
    mist.addColorStop(0, '#a8e7dd00'); mist.addColorStop(0.55, '#a8e7dd38'); mist.addColorStop(1, '#d8fff040');
    context.fillStyle = mist; context.fillRect(0, 300, 1800, 320);
    return target;
  }

  private drawWaterfallBackdrop() {
    const center = this.frame.camera + START_X + 1500;
    const fadeIn = Math.max(0, Math.min(1, (center - (STAGE_2_START - 3600)) / 4200));
    const fadeOut = Math.max(0, Math.min(1, ((STAGE_2_END + 3600) - center) / 4200));
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0.01) return;
    const context = this.context;
    const width = this.waterfallBackdrop.width;
    const offset = ((this.frame.camera * 0.18) % width + width) % width;
    context.save(); context.globalAlpha = alpha * 0.9;
    for (let x = -offset - width; x < this.view.width + width; x += width) context.drawImage(this.waterfallBackdrop, x, 0, width, HEIGHT + 40);
    // Animated spray threads are intentionally bounded; they sit between the
    // distant falls and the active track, not in the physics particle list.
    context.globalAlpha = alpha * (this.lowDetail ? 0.16 : 0.3);
    for (let i = 0; i < (this.lowDetail ? 18 : 34); i++) {
      const x = (i * 97 + this.frame.camera * 0.11) % (this.view.width + 80) - 40;
      const y = 265 + ((i * 47 + this.frame.time * (18 + i % 4 * 5)) % 280);
      context.fillStyle = i % 3 ? '#d7fff0' : '#a4e5da';
      context.fillRect(x, y, 1.5 + (i % 3), 8 + (i % 5) * 3);
    }
    context.restore();
  }

  private drawCliffScaffolding(near: boolean) {
    const z = near ? LANE.near - 250 : LANE.far + 270;
    const range = this.view.visibleSpan(z - 30, z + 30, 260);
    const start = Math.max(range.start, STAGE_2_START - 700);
    const end = Math.min(range.end, STAGE_2_END + 700);
    if (start >= end) return;
    const context = this.context;
    const step = near ? 920 : 1120;
    for (let x = Math.floor(start / step) * step; x < end; x += step) {
      const y = this.y(x);
      const platformOffset = near ? 184 : 150;
      const a = this.p(x, y + platformOffset, z);
      const b = this.p(x + step * 0.82, this.y(x + step * 0.82) + platformOffset, z);
      const scale = (a.scale + b.scale) / 2;
      context.save();
      context.strokeStyle = '#24170e'; context.lineWidth = Math.max(2, 7 * scale);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
      context.strokeStyle = '#9a6238'; context.lineWidth = Math.max(1, 3 * scale);
      context.beginPath(); context.moveTo(a.x, a.y - 5 * scale); context.lineTo(b.x, b.y - 5 * scale); context.stroke();
      for (const post of [0.08, 0.43, 0.78]) {
        const px = x + step * 0.82 * post;
        const bottom = this.p(px, this.y(px) + platformOffset + 26, z);
        const top = this.p(px, this.y(px) + 22, z);
        context.strokeStyle = '#332015'; context.lineWidth = Math.max(2, 5 * top.scale);
        context.beginPath(); context.moveTo(bottom.x, bottom.y); context.lineTo(top.x, top.y); context.stroke();
      }
      // A tiny row of goblin silhouettes and clan pennants gives the shelves
      // scale without adding four more full-resolution crowd layers.
      for (let i = 0; i < 4; i++) {
        const px = x + 95 + i * 132;
        const person = this.p(px, this.y(px) + platformOffset - 22 - (i % 2) * 5, z - (near ? 8 : -8));
        context.fillStyle = i % 2 ? '#d08b54' : '#79b39a';
        context.beginPath(); context.arc(person.x, person.y - 13 * person.scale, 5 * person.scale, 0, TAU); context.fill();
        context.fillRect(person.x - 5 * person.scale, person.y - 10 * person.scale, 10 * person.scale, 13 * person.scale);
        context.strokeStyle = '#e5bb70'; context.lineWidth = Math.max(1, 1.5 * person.scale);
        context.beginPath(); context.moveTo(person.x + 5 * person.scale, person.y - 8 * person.scale); context.lineTo(person.x + 15 * person.scale, person.y - 20 * person.scale); context.stroke();
      }
      const flag = this.p(x + 42, y + platformOffset - 62, z);
      context.strokeStyle = '#51351f'; context.lineWidth = Math.max(1, 2 * flag.scale); context.beginPath(); context.moveTo(flag.x, flag.y); context.lineTo(flag.x, flag.y + 45 * flag.scale); context.stroke();
      context.fillStyle = near ? '#e9804e' : '#78bfa0'; context.beginPath(); context.moveTo(flag.x, flag.y); context.lineTo(flag.x + 25 * flag.scale, flag.y + 7 * flag.scale); context.lineTo(flag.x, flag.y + 15 * flag.scale); context.closePath(); context.fill();
      context.restore();
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
    this.drawCliffScaffolding(true);
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
    this.stadium.width = this.torch.width = this.wetDeck.width = this.mossDeck.width = this.waterfallBackdrop.width = 1;
  }
}