import type { RangeCamera, ScreenPoint } from './projection';
import { polygon, texturedQuad, type Point, type Quad } from './texture';

export interface Vec3 { x: number; y: number; z: number }
export interface Material {
  color: string;
  image?: CanvasImageSource;
  crop?: { x: number; y: number; width: number; height: number };
  opacity?: number;
  unlit?: boolean;
  edge?: string;
  transparent?: boolean;
}
export interface Face {
  points: Vec3[];
  normal: Vec3;
  material: Material;
  center: Vec3;
}
interface DrawCommand { depth: number; order: number; draw: () => void }

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3) => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: Vec3, value: number) => vec(a.x * value, a.y * value, a.z * value);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const unit = (a: Vec3) => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));
export const mix = (a: Vec3, b: Vec3, t: number) => add(a, mul(sub(b, a), t));
export const LIGHT = unit(vec(0.42, -0.84, -0.34));

export class Mesh {
  readonly faces: Face[] = [];
  rasterSlice = 32;
  readonly bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };

  face(points: Vec3[], material: Material, normal?: Vec3) {
    const center = mul(points.reduce(add, vec(0, 0, 0)), 1 / points.length);
    const direction = normal ?? unit(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    this.faces.push({ points, normal: direction, material, center });
    for (const point of points) {
      this.bounds.minX = Math.min(this.bounds.minX, point.x);
      this.bounds.maxX = Math.max(this.bounds.maxX, point.x);
      this.bounds.minY = Math.min(this.bounds.minY, point.y);
      this.bounds.maxY = Math.max(this.bounds.maxY, point.y);
      this.bounds.minZ = Math.min(this.bounds.minZ, point.z);
      this.bounds.maxZ = Math.max(this.bounds.maxZ, point.z);
    }
  }

  box(min: Vec3, max: Vec3, material: Material) {
    const p = (x: number, y: number, z: number) => vec(x ? max.x : min.x, y ? max.y : min.y, z ? max.z : min.z);
    this.face([p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)], material, vec(0, -1, 0));
    this.face([p(0, 1, 1), p(1, 1, 1), p(1, 1, 0), p(0, 1, 0)], material, vec(0, 1, 0));
    this.face([p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)], material, vec(0, 0, -1));
    this.face([p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)], material, vec(0, 0, 1));
    this.face([p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)], material, vec(-1, 0, 0));
    this.face([p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)], material, vec(1, 0, 0));
  }

  beam(a: Vec3, b: Vec3, width: number, depth: number, material: Material, taper = 1) {
    const axis = unit(sub(b, a));
    const u = unit(cross(axis, Math.abs(axis.z) < 0.9 ? vec(0, 0, 1) : vec(0, 1, 0)));
    const v = unit(cross(axis, u));
    const profile = [[-1, -0.74], [-0.74, -1], [0.74, -1], [1, -0.74], [1, 0.74], [0.74, 1], [-0.74, 1], [-1, 0.74]];
    const ring = (center: Vec3, scale: number) => profile.map(([x, y]) => add(center, add(mul(u, x * width * scale / 2), mul(v, y * depth * scale / 2))));
    const start = ring(a, 1);
    const end = ring(b, taper);
    this.face([...start].reverse(), material, mul(axis, -1));
    this.face(end, material, axis);
    for (let i = 0; i < profile.length; i++) {
      const next = (i + 1) % profile.length;
      this.face([start[i], start[next], end[next], end[i]], material, unit(sub(mix(start[i], start[next], 0.5), a)));
    }
  }

  cylinder(a: Vec3, b: Vec3, radius: number, material: Material, segments = 12, endRadius = radius) {
    const axis = unit(sub(b, a));
    const u = unit(cross(axis, Math.abs(axis.z) < 0.9 ? vec(0, 0, 1) : vec(0, 1, 0)));
    const v = unit(cross(axis, u));
    const ring = (center: Vec3, r: number) => Array.from({ length: segments }, (_, index) => {
      const angle = index / segments * Math.PI * 2;
      return add(center, add(mul(u, Math.cos(angle) * r), mul(v, Math.sin(angle) * r)));
    });
    const start = ring(a, radius);
    const end = ring(b, endRadius);
    this.face([...start].reverse(), { ...material, image: undefined }, mul(axis, -1));
    this.face(end, { ...material, image: undefined }, axis);
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      this.face([start[i], start[next], end[next], end[i]], material, unit(sub(mix(start[i], start[next], 0.5), a)));
    }
  }
}

export class WorldPainter {
  private commands: DrawCommand[] = [];
  private sequence = 0;

  constructor(private context: CanvasRenderingContext2D, private readonly view: RangeCamera, private readonly cache?: MeshRasterCache) {}

  reset() { this.commands.length = 0; this.sequence = 0; }

  setContext(context: CanvasRenderingContext2D) { this.context = context; }

  image(image: CanvasImageSource, x: number, y: number, width: number, height: number) {
    this.context.drawImage(image, x, y, width, height);
  }

  command(position: Vec3, draw: () => void, bias = 0) {
    this.commands.push({ depth: this.view.depthAt(position.x, position.z) + bias, order: this.sequence++, draw });
  }

  mesh(mesh: Mesh) {
    if (this.cache) {
      this.cache.enqueue(mesh, this);
      return;
    }
    for (const face of mesh.faces) {
      if (!this.view.facing(face.center, face.normal)) continue;
      const points = face.points.map((point) => this.view.project(point.x, point.y, point.z));
      if (points.every((p) => p.x < -40) || points.every((p) => p.x > this.view.width + 40) || points.every((p) => p.y < -80) || points.every((p) => p.y > 900)) continue;
      this.command(face.center, () => paintFace(this.context, face, points));
    }
  }

  flush() {
    this.commands.sort((a, b) => b.depth - a.depth || a.order - b.order);
    for (const command of this.commands) command.draw();
    this.reset();
  }
}

function paintFace(context: CanvasRenderingContext2D, face: Face, points: Point[]) {
  const material = face.material;
  context.save();
  context.globalAlpha = material.opacity ?? 1;
  if (!material.transparent) {
    polygon(context, points);
    context.fillStyle = material.color;
    context.fill();
  }
  if (material.image && material.crop && points.length === 4) {
    texturedQuad(context, material.image, material.crop, points as Quad);
  }
  if (!material.unlit) {
    const light = Math.max(0, dot(face.normal, LIGHT));
    polygon(context, points);
    context.fillStyle = `rgba(6, 15, 12, ${0.48 - light * 0.42})`;
    context.fill();
    if (light > 0.58) {
      context.fillStyle = `rgba(255, 192, 111, ${(light - 0.58) * 0.13})`;
      context.fill();
    }
  }
  if (material.edge) {
    polygon(context, points);
    context.strokeStyle = material.edge;
    context.lineWidth = 0.7;
    context.stroke();
  }
  context.restore();
}

interface RasterLayer {
  image: HTMLCanvasElement;
  anchor: Vec3;
  projected: ScreenPoint;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RasterEntry {
  layers: RasterLayer[];
  offset: number;
  used: number;
  pixels: number;
}

export class MeshRasterCache {
  private readonly entries = new Map<Mesh, RasterEntry>();
  private revision = -1;
  private scale = 1;
  private pixels = 0;
  private clock = 0;
  private buildTime = 0;
  private lowDetail = false;
  private readonly scratch: ScreenPoint = { x: 0, y: 0, scale: 1, depth: 0 };

  constructor(private readonly view: RangeCamera) {}

  beginFrame(scale: number, lowDetail: boolean) {
    const density = Math.round(Math.max(0.5, Math.min(1.4, scale)) * 10) / 10;
    if (this.revision !== this.view.revision || density !== this.scale) {
      this.clear();
      this.revision = this.view.revision;
      this.scale = density;
    }
    this.lowDetail = lowDetail;
    this.clock++;
    this.buildTime = 0;
  }

  enqueue(mesh: Mesh, painter: WorldPainter) {
    if (!mesh.faces.length) return;
    let entry = this.entries.get(mesh);
    const travel = entry ? Math.abs(this.view.offset - entry.offset) : Infinity;
    const refresh = !entry || travel > 360;
    // Reuse narrow depth slices between samples. Each slice follows the exact
    // camera scale/translation at its own depth, keeping front/back occlusion.
    if (refresh && (!entry || this.buildTime < 4 || travel > 1050)) {
      const started = performance.now();
      if (entry) this.remove(mesh, entry);
      entry = this.bake(mesh);
      this.entries.set(mesh, entry);
      this.pixels += entry.pixels;
      this.buildTime += performance.now() - started;
      this.trim();
    }
    if (!entry) return;
    entry.used = this.clock;
    for (const layer of entry.layers) {
      const point = this.view.projectInto(layer.anchor.x, layer.anchor.y, layer.anchor.z, this.scratch);
      const ratio = point.scale / layer.projected.scale;
      const left = point.x + (layer.left - layer.projected.x) * ratio;
      const top = point.y + (layer.top - layer.projected.y) * ratio;
      const width = layer.width * ratio;
      const height = layer.height * ratio;
      if (left + width < -16 || left > this.view.width + 16 || top + height < -16 || top > 740) continue;
      painter.command(layer.anchor, () => painter.image(layer.image, left, top, width, height));
    }
  }

  private bake(mesh: Mesh): RasterEntry {
    const groups = new Map<number, { face: Face; points: Point[]; depth: number }[]>();
    const base = this.view.depthAt(mesh.bounds.minX, mesh.bounds.minZ);
    for (const face of mesh.faces) {
      if (!this.view.facing(face.center, face.normal)) continue;
      const depth = this.view.depthAt(face.center.x, face.center.z);
      const index = Math.floor((depth - base) / mesh.rasterSlice);
      let group = groups.get(index);
      if (!group) { group = []; groups.set(index, group); }
      group.push({ face, points: face.points.map((p) => this.view.project(p.x, p.y, p.z)), depth });
    }
    const layers: RasterLayer[] = [];
    let pixels = 0;
    for (const group of groups.values()) {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      const anchor = vec(0, 0, 0);
      for (const item of group) {
        anchor.x += item.face.center.x;
        anchor.y += item.face.center.y;
        anchor.z += item.face.center.z;
        for (const point of item.points) {
          left = Math.min(left, point.x); top = Math.min(top, point.y);
          right = Math.max(right, point.x); bottom = Math.max(bottom, point.y);
        }
      }
      anchor.x /= group.length; anchor.y /= group.length; anchor.z /= group.length;
      left -= 2; top -= 2; right += 2; bottom += 2;
      const width = right - left;
      const height = bottom - top;
      if (!Number.isFinite(width + height) || width <= 0 || height <= 0) continue;
      const scale = Math.min(this.scale, 900 / width, 900 / height);
      const image = document.createElement('canvas');
      image.width = Math.max(1, Math.ceil(width * scale));
      image.height = Math.max(1, Math.ceil(height * scale));
      const context = image.getContext('2d')!;
      context.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
      context.imageSmoothingQuality = 'medium';
      group.sort((a, b) => b.depth - a.depth);
      for (const { face, points } of group) paintFace(context, face, points);
      layers.push({ image, anchor, projected: this.view.project(anchor.x, anchor.y, anchor.z), left, top, width: image.width / scale, height: image.height / scale });
      pixels += image.width * image.height;
    }
    return { layers, offset: this.view.offset, used: this.clock, pixels };
  }

  private trim() {
    const limit = this.lowDetail ? 5_000_000 : 8_000_000;
    if (this.pixels <= limit && this.entries.size <= 100) return;
    const oldest = [...this.entries.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [mesh, entry] of oldest) {
      if (entry.used === this.clock) continue;
      this.remove(mesh, entry);
      if (this.pixels <= limit && this.entries.size <= 100) break;
    }
  }

  private remove(mesh: Mesh, entry: RasterEntry) {
    this.entries.delete(mesh);
    this.pixels -= entry.pixels;
    for (const layer of entry.layers) layer.image.width = layer.image.height = 1;
  }

  clear() {
    for (const [mesh, entry] of this.entries) this.remove(mesh, entry);
    this.pixels = 0;
  }

  get memoryBytes() { return this.pixels * 4; }

  get buildsMilliseconds() { return this.buildTime; }
}