import { GROUND, START_X } from './scene';
import type { Vec3 } from './geometry';

export interface ScreenPoint {
  x: number;
  y: number;
  scale: number;
  depth: number;
}

export class RangeCamera {
  width = 1440;
  offset = 0;
  heightOffset = 0;
  readonly zoom = 0.86;
  private focal = 2880;
  private originX = 209;
  private readonly originY = 447;
  private readonly elevation = 0.32;
  private sine = Math.sin(20 * Math.PI / 180);
  private cosine = Math.cos(20 * Math.PI / 180);
  private downrange = true;
  private cameraX = START_X - 2880 * Math.sin(20 * Math.PI / 180);
  private cameraY = GROUND - 2880 * 0.32;
  private cameraZ = -2880 * Math.cos(20 * Math.PI / 180);
  revision = 0;

  configure(width: number, offset: number, downrange = true, heightOffset = this.heightOffset) {
    if (width !== this.width || downrange !== this.downrange || this.revision === 0) {
      this.width = width;
      this.downrange = downrange;
      this.focal = Math.max(2400, width * 2);
      this.originX = Math.max(143, Math.min(250, width * 0.155));
      const yaw = downrange ? 20 * Math.PI / 180 : 0;
      this.sine = Math.sin(yaw);
      this.cosine = Math.cos(yaw);
      this.cameraY = GROUND - this.focal * this.elevation;
      this.cameraZ = -this.focal * this.cosine;
      this.revision++;
    }
    this.offset = offset;
    this.heightOffset = heightOffset;
    this.cameraY = GROUND + heightOffset - this.focal * this.elevation;
    this.cameraX = offset + START_X - this.focal * this.sine;
  }

  // Physics stays in its original plane; only rendering gains range and lateral depth.
  project(x: number, y = GROUND, lateral = 0, parallax = 1): ScreenPoint {
    return this.projectInto(x, y, lateral, { x: 0, y: 0, scale: 1, depth: 0 }, parallax);
  }

  projectInto(x: number, y: number, lateral: number, target: ScreenPoint, parallax = 1) {
    const range = x - this.offset * parallax - START_X;
    const depth = range * this.sine + lateral * this.cosine;
    const scale = this.zoom * this.focal / Math.max(this.focal * 0.2, this.focal + depth);
    target.x = this.originX + (range * this.cosine - lateral * this.sine) * scale;
    target.y = this.originY + (y - GROUND - this.heightOffset - depth * this.elevation) * scale;
    target.scale = scale;
    target.depth = depth;
    return target;
  }

  depthAt(x: number, z: number) { return (x - this.offset - START_X) * this.sine + z * this.cosine; }

  unproject(screenX: number, screenY: number, lateral = 0, parallax = 1) {
    const u = (screenX - this.originX) / this.zoom;
    const denominator = this.focal * this.cosine - u * this.sine;
    const range = (u * (this.focal + lateral * this.cosine) + this.focal * lateral * this.sine) / Math.max(1, denominator);
    const depth = range * this.sine + lateral * this.cosine;
    const scale = this.zoom * this.focal / (this.focal + depth);
    return {
      x: this.offset * parallax + START_X + range,
      y: GROUND + this.heightOffset + (screenY - this.originY) / scale + depth * this.elevation,
    };
  }

  visibleRange(lateral = 0, padding = 160, parallax = 1) {
    return {
      start: this.unproject(-padding, GROUND, lateral, parallax).x,
      end: this.unproject(this.width + padding, GROUND, lateral, parallax).x,
    };
  }

  visibleSpan(near: number, far: number, padding = 220) {
    // Far scenery projects left of the track center. Cover both lateral extremes
    // and a complete tile beyond the viewport so a new right edge never pops in.
    const a = this.visibleRange(near, padding);
    const b = this.visibleRange(far, padding);
    return { start: Math.min(a.start, b.start) - 256, end: Math.max(a.end, b.end) + 512 };
  }

  followOffset(x: number, z = 0) {
    const focusX = Math.max(this.originX, this.width * 0.3);
    const relative = this.unproject(focusX, GROUND, z).x - this.offset;
    return Math.max(0, x - relative);
  }

  facing(point: Vec3, normal: Vec3) {
    // Cull against the camera behind the launch axis, not a hard-coded screen side.
    const dx = this.cameraX - point.x;
    const dy = this.cameraY - point.y;
    const dz = this.cameraZ - point.z;
    return dx * normal.x + dy * normal.y + dz * normal.z > 0.001;
  }
}