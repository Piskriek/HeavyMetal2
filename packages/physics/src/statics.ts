import type { BodySpec, EntityId, Vec3 } from '@hm/contracts';
import { add, clamp, mul, normalizeQuat, rotate, type Q4, type V3 } from './math';
import { buildGrid, nearby, type TriangleGrid } from './grid';
import { boxContact, rayBox, type BoxShape } from './boxes';
import { rayTriangle, triangle, triangleContact, type RayHit, type SurfaceHit, type Triangle } from './triangles';

interface Base { id: EntityId; friction: number; restitution: number; tier: 'racing' | 'decor' | 'trigger' }
export type StaticBody =
  | (Base & { shape: 'box' } & BoxShape)
  | (Base & { shape: 'heightfield'; position: V3; cols: number; rows: number; cell: number; heights: readonly number[] })
  | (Base & { shape: 'mesh'; triangles: readonly Triangle[]; grid: TriangleGrid });

function finite(id: EntityId, key: string, n: number): number {
  if (!Number.isFinite(n)) throw new Error(`Physics entity ${id}: invalid ${key}`);
  return n;
}

export function makeStatic(id: EntityId, spec: BodySpec): StaticBody {
  const p: V3 = [finite(id, 'position[0]', spec.position[0]), finite(id, 'position[1]', spec.position[1]), finite(id, 'position[2]', spec.position[2])];
  const r = spec.rotation ?? [0, 0, 0, 1];
  const q: Q4 = normalizeQuat([finite(id, 'rotation[0]', r[0]), finite(id, 'rotation[1]', r[1]), finite(id, 'rotation[2]', r[2]), finite(id, 'rotation[3]', r[3])]);
  const base: Base = {
    id, friction: finite(id, 'friction', spec.friction ?? 0.5),
    restitution: finite(id, 'restitution', spec.restitution ?? 0), tier: spec.tier ?? 'racing',
  };
  if (base.friction < 0) throw new Error(`Physics entity ${id}: invalid friction`);
  if (base.restitution < 0 || base.restitution > 1) throw new Error(`Physics entity ${id}: invalid restitution`);
  if (base.tier !== 'racing' && base.tier !== 'decor' && base.tier !== 'trigger') throw new Error(`Physics entity ${id}: invalid tier`);
  const c = spec.collider;
  if (base.tier === 'trigger' && c.shape !== 'box') throw new Error('Only box colliders can be triggers');
  if (c.shape === 'box') {
    const half: V3 = [finite(id, 'half[0]', c.half[0]), finite(id, 'half[1]', c.half[1]), finite(id, 'half[2]', c.half[2])];
    if (half[0] <= 0 || half[1] <= 0 || half[2] <= 0) throw new Error(`Physics entity ${id}: box half-extents must be positive`);
    return { ...base, shape: 'box', position: p, rotation: q, half };
  }
  if (c.shape === 'heightfield') {
    if (!Number.isInteger(c.cols) || !Number.isInteger(c.rows) || c.cols < 2 || c.rows < 2 ||
        !Number.isFinite(c.cell) || c.cell <= 0 || c.heights.length !== c.cols * c.rows)
      throw new Error(`Physics entity ${id}: invalid heightfield dimensions`);
    const heights: number[] = [];
    for (let i = 0; i < c.heights.length; i++) heights.push(finite(id, `heights[${i}]`, c.heights[i]!));
    return { ...base, shape: 'heightfield', position: p, cols: c.cols, rows: c.rows, cell: c.cell, heights };
  }
  if (c.shape === 'mesh') {
    if (c.positions.length % 3 !== 0 || c.indices.length % 3 !== 0) throw new Error(`Physics entity ${id}: invalid mesh arrays`);
    const vertices: V3[] = [];
    for (let i = 0; i < c.positions.length; i += 3) {
      const local: V3 = [finite(id, `positions[${i}]`, c.positions[i]!), finite(id, `positions[${i + 1}]`, c.positions[i + 1]!), finite(id, `positions[${i + 2}]`, c.positions[i + 2]!)];
      vertices.push(add(p, rotate(local, q)));
    }
    const triangles: Triangle[] = [];
    for (let i = 0; i < c.indices.length; i += 3) {
      const ids = [c.indices[i]!, c.indices[i + 1]!, c.indices[i + 2]!];
      if (ids.some((v) => !Number.isInteger(v) || v < 0 || v >= vertices.length)) throw new Error(`Physics entity ${id}: invalid mesh index`);
      const t = triangle(vertices[ids[0]!]!, vertices[ids[1]!]!, vertices[ids[2]!]!);
      if (t) triangles.push(t);
    }
    return { ...base, shape: 'mesh', triangles, grid: buildGrid(triangles) };
  }
  throw new Error('Static colliders must be a box, heightfield or mesh');
}

function heightTriangles(s: Extract<StaticBody, { shape: 'heightfield' }>, x: number, z: number): readonly Triangle[] {
  const y = (cx: number, cz: number): number => s.position[1] + s.heights[cz * s.cols + cx]!;
  const a: V3 = [s.position[0] + x * s.cell, y(x, z), s.position[2] + z * s.cell];
  const b: V3 = [a[0] + s.cell, y(x + 1, z), a[2]];
  const c: V3 = [a[0], y(x, z + 1), a[2] + s.cell];
  const d: V3 = [b[0], y(x + 1, z + 1), c[2]];
  return [triangle(a, d, b), triangle(a, c, d)].filter((t): t is Triangle => t !== null);
}

function cellRange(min: number, max: number, origin: number, cell: number, count: number): [number, number] {
  return [clamp(Math.floor((min - origin) / cell), 0, count - 2), clamp(Math.floor((max - origin) / cell), 0, count - 2)];
}

export function staticContact(s: StaticBody, p: Vec3, radius: number): SurfaceHit | null {
  if (s.shape === 'box') return boxContact(s, p, radius);
  let best: SurfaceHit | null = null;
  const visit = (t: Triangle): void => {
    const hit = triangleContact(p, radius, t);
    if (hit && (!best || hit.penetration > best.penetration)) best = hit;
  };
  if (s.shape === 'mesh') {
    for (const i of nearby(s.grid, p, radius)) visit(s.triangles[i]!);
  } else {
    if (p[0] + radius < s.position[0] || p[0] - radius > s.position[0] + (s.cols - 1) * s.cell ||
        p[2] + radius < s.position[2] || p[2] - radius > s.position[2] + (s.rows - 1) * s.cell) return null;
    const [x0, x1] = cellRange(p[0] - radius, p[0] + radius, s.position[0], s.cell, s.cols);
    const [z0, z1] = cellRange(p[2] - radius, p[2] + radius, s.position[2], s.cell, s.rows);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      for (const t of heightTriangles(s, x, z)) visit(t);
    }
  }
  return best;
}

export function staticRay(s: StaticBody, origin: Vec3, dir: Vec3, maxDistance: number): RayHit | null {
  if (s.shape === 'box') return rayBox(s, origin, dir, maxDistance);
  let best: RayHit | null = null;
  const visit = (t: Triangle): void => {
    const hit = rayTriangle(origin, dir, best?.distance ?? maxDistance, t);
    if (hit && (!best || hit.distance < best.distance)) best = hit;
  };
  if (s.shape === 'mesh') {
    for (const t of s.triangles) visit(t);
  } else {
    const end = add(origin, mul(dir, maxDistance));
    const [x0, x1] = cellRange(Math.min(origin[0], end[0]), Math.max(origin[0], end[0]), s.position[0], s.cell, s.cols);
    const [z0, z1] = cellRange(Math.min(origin[2], end[2]), Math.max(origin[2], end[2]), s.position[2], s.cell, s.rows);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      for (const t of heightTriangles(s, x, z)) visit(t);
    }
  }
  return best;
}