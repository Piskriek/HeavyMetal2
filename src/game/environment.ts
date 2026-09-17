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

  drawLandscape() {
    const context = this.context;
    const image = this.art.sky;
    const height = HEIGHT + 55;
    const width = image.width / image.height * height;
    const offset = this.frame.camera * (this.frame.options.parallax ? 0.08 : 0.23) + this.frame.drift * 0.2;
    const start = Math.floor(offset / width) - 1;
    for (let i = start; i < start + Math.ceil(this.view.width / width) + 4; i++) {
      const x = i * width - offset;
      context.save();
      if (Math.abs(i) % 2) { context.translate(x + width, 0); context.scale(-1, 1); context.drawImage(image, 0, -35, width + 1, height); }
      else context.drawImage(image, x, -35, width + 1, height);
      context.restore();
    }
    this.drawBlimps();
  }

  private drawBlimps() {
    const context = this.context;
    const spacing = 1450;
    const movement = this.frame.reducedMotion ? 0 : this.frame.time * 7;
    const offset = this.frame.camera * (this.frame.options.parallax ? 0.13 : 0.2) - movement;
    const first = Math.floor((offset - 950) / spacing) - 1;
    for (let index = first; index < first + Math.ceil(this.view.width / spacing) + 3; index++) {
      const x = 950 + index * spacing - offset;
      const w = Math.abs(index) % 2 ? 196 : 270;
      if (x < -w - 40 || x > this.view.width + 40) continue;
      const y = 100 + Math.abs(index % 3) * 27 + (this.frame.reducedMotion ? 0 : Math.sin(this.frame.time * 0.35 + index) * 4);
      context.save(); context.globalAlpha = 0.66;
      context.drawImage(this.art.blimp, x, y, w, w * 270 / 520); context.restore();
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
      if (!hasGap) texturedQuad(this.context, this.deck, { ...crop, height: 512 }, top);
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