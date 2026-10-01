import type { Vec3 } from '@hm/contracts';
import { add, cross, dot, length, mul, sub, unit, type V3 } from './math';

export interface Triangle { a: V3; b: V3; c: V3; normal: V3; min: V3; max: V3 }
export interface SurfaceHit { point: V3; normal: V3; penetration: number }
export interface RayHit { distance: number; point: V3; normal: V3 }

export function triangle(a: V3, b: V3, c: V3): Triangle | null {
  const normal = cross(sub(b, a), sub(c, a));
  if (dot(normal, normal) < 1e-20) return null;
  return {
    a, b, c, normal: unit(normal),
    min: [Math.min(a[0], b[0], c[0]), Math.min(a[1], b[1], c[1]), Math.min(a[2], b[2], c[2])],
    max: [Math.max(a[0], b[0], c[0]), Math.max(a[1], b[1], c[1]), Math.max(a[2], b[2], c[2])],
  };
}

// Ericson's Voronoi-region test, including edges and vertices.
export function closestTriangle(p: Vec3, t: Triangle): V3 {
  const ab = sub(t.b, t.a), ac = sub(t.c, t.a), ap = sub(p, t.a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return t.a;
  const bp = sub(p, t.b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return t.b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add(t.a, mul(ab, d1 / (d1 - d3)));
  const cp = sub(p, t.c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return t.c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add(t.a, mul(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return add(t.b, mul(sub(t.c, t.b), (d4 - d3) / (d4 - d3 + d5 - d6)));
  const denom = 1 / (va + vb + vc);
  return add(t.a, add(mul(ab, vb * denom), mul(ac, vc * denom)));
}

export function triangleContact(p: Vec3, radius: number, t: Triangle): SurfaceHit | null {
  if (p[0] + radius < t.min[0] || p[0] - radius > t.max[0] ||
      p[1] + radius < t.min[1] || p[1] - radius > t.max[1] ||
      p[2] + radius < t.min[2] || p[2] - radius > t.max[2]) return null;
  const point = closestTriangle(p, t), delta = sub(p, point), distance = length(delta);
  if (distance >= radius - 1e-10) return null;
  const normal = distance > 1e-12 ? mul(delta, 1 / distance) :
    dot(sub(p, t.a), t.normal) >= 0 ? t.normal : mul(t.normal, -1);
  return { point, normal, penetration: radius - distance };
}

// Double-sided Moeller-Trumbore. The reported normal always opposes the ray.
export function rayTriangle(origin: Vec3, dir: Vec3, maxDistance: number, t: Triangle): RayHit | null {
  const ab = sub(t.b, t.a), ac = sub(t.c, t.a), p = cross(dir, ac), determinant = dot(ab, p);
  if (Math.abs(determinant) < 1e-12) return null;
  const inv = 1 / determinant, s = sub(origin, t.a), u = dot(s, p) * inv;
  if (u < -1e-10 || u > 1 + 1e-10) return null;
  const q = cross(s, ab), v = dot(dir, q) * inv;
  if (v < -1e-10 || u + v > 1 + 1e-10) return null;
  const distance = dot(ac, q) * inv;
  if (distance < 0 || distance > maxDistance) return null;
  return { distance, point: add(origin, mul(dir, distance)), normal: dot(t.normal, dir) > 0 ? mul(t.normal, -1) : t.normal };
}