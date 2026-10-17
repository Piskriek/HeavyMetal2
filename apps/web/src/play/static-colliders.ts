// ============================================================================
// File: apps/web/src/play/static-colliders.ts
// Pure TypeScript static AABB transform, swept circle-vs-box collision,
// Moon Twin Gate exit pose math. The unpowered doorway shader lives in portal-shaders.ts.
// Zero THREE imports; 100% strict (noUncheckedIndexedAccess) compliant.
// ============================================================================

import type { Box } from '../base/kit-pieces';

export interface Bounds3D {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

interface FlexibleBoxShape {
  minX?: number;
  minY?: number;
  minZ?: number;
  maxX?: number;
  maxY?: number;
  maxZ?: number;
  x0?: number;
  y0?: number;
  z0?: number;
  x1?: number;
  y1?: number;
  z1?: number;
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  h?: number;
  d?: number;
  hx?: number;
  hy?: number;
  hz?: number;
  min?: readonly [number, number, number] | { x: number; y: number; z: number };
  max?: readonly [number, number, number] | { x: number; y: number; z: number };
}

const EPS = 1e-6;
const BODY_MIN_Y_OFFSET = 0.1;
const BODY_MAX_Y_OFFSET = 1.8;

/**
 * Normalizes any Box representation from base/kit-pieces into [minX..maxZ].
 */
export function unpackBoxBounds(box: Box): Bounds3D {
  const b = box as unknown as FlexibleBoxShape;
  if (
    typeof b.minX === 'number' &&
    typeof b.maxX === 'number' &&
    typeof b.minY === 'number' &&
    typeof b.maxY === 'number' &&
    typeof b.minZ === 'number' &&
    typeof b.maxZ === 'number'
  ) {
    return {
      minX: Math.min(b.minX, b.maxX),
      minY: Math.min(b.minY, b.maxY),
      minZ: Math.min(b.minZ, b.maxZ),
      maxX: Math.max(b.minX, b.maxX),
      maxY: Math.max(b.minY, b.maxY),
      maxZ: Math.max(b.minZ, b.maxZ),
    };
  }
  if (
    typeof b.x0 === 'number' &&
    typeof b.x1 === 'number' &&
    typeof b.y0 === 'number' &&
    typeof b.y1 === 'number' &&
    typeof b.z0 === 'number' &&
    typeof b.z1 === 'number'
  ) {
    return {
      minX: Math.min(b.x0, b.x1),
      minY: Math.min(b.y0, b.y1),
      minZ: Math.min(b.z0, b.z1),
      maxX: Math.max(b.x0, b.x1),
      maxY: Math.max(b.y0, b.y1),
      maxZ: Math.max(b.z0, b.z1),
    };
  }
  if (
    typeof b.x === 'number' &&
    typeof b.y === 'number' &&
    typeof b.z === 'number' &&
    typeof b.hx === 'number' &&
    typeof b.hy === 'number' &&
    typeof b.hz === 'number'
  ) {
    const hx = Math.abs(b.hx);
    const hy = Math.abs(b.hy);
    const hz = Math.abs(b.hz);
    return {
      minX: b.x - hx,
      minY: b.y - hy,
      minZ: b.z - hz,
      maxX: b.x + hx,
      maxY: b.y + hy,
      maxZ: b.z + hz,
    };
  }
  if (
    typeof b.x === 'number' &&
    typeof b.y === 'number' &&
    typeof b.z === 'number' &&
    typeof b.w === 'number' &&
    typeof b.h === 'number' &&
    typeof b.d === 'number'
  ) {
    const hw = Math.abs(b.w) * 0.5;
    const hh = Math.abs(b.h) * 0.5;
    const hd = Math.abs(b.d) * 0.5;
    return {
      minX: b.x - hw,
      minY: b.y - hh,
      minZ: b.z - hd,
      maxX: b.x + hw,
      maxY: b.y + hh,
      maxZ: b.z + hd,
    };
  }
  if (b.min !== undefined && b.max !== undefined) {
    if (Array.isArray(b.min) && Array.isArray(b.max)) {
      const mx0 = (b.min[0] as number | undefined) ?? 0;
      const my0 = (b.min[1] as number | undefined) ?? 0;
      const mz0 = (b.min[2] as number | undefined) ?? 0;
      const mx1 = (b.max[0] as number | undefined) ?? 0;
      const my1 = (b.max[1] as number | undefined) ?? 0;
      const mz1 = (b.max[2] as number | undefined) ?? 0;
      return {
        minX: Math.min(mx0, mx1),
        minY: Math.min(my0, my1),
        minZ: Math.min(mz0, mz1),
        maxX: Math.max(mx0, mx1),
        maxY: Math.max(my0, my1),
        maxZ: Math.max(mz0, mz1),
      };
    }
    const minObj = b.min as { x: number; y: number; z: number };
    const maxObj = b.max as { x: number; y: number; z: number };
    return {
      minX: Math.min(minObj.x, maxObj.x),
      minY: Math.min(minObj.y, maxObj.y),
      minZ: Math.min(minObj.z, maxObj.z),
      maxX: Math.max(minObj.x, maxObj.x),
      maxY: Math.max(minObj.y, maxObj.y),
      maxZ: Math.max(minObj.z, maxObj.z),
    };
  }
  return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
}

/**
 * Constructs a Box matching base/kit-pieces conventions.
 */
export function packBoxBounds(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number
): Box {
  const x0 = Math.min(minX, maxX);
  const y0 = Math.min(minY, maxY);
  const z0 = Math.min(minZ, maxZ);
  const x1 = Math.max(minX, maxX);
  const y1 = Math.max(minY, maxY);
  const z1 = Math.max(minZ, maxZ);
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const out: FlexibleBoxShape = {
    minX: x0,
    minY: y0,
    minZ: z0,
    maxX: x1,
    maxY: y1,
    maxZ: z1,
    x0,
    y0,
    z0,
    x1,
    y1,
    z1,
    x: (x0 + x1) * 0.5,
    y: (y0 + y1) * 0.5,
    z: (z0 + z1) * 0.5,
    w,
    h,
    d,
    hx: w * 0.5,
    hy: h * 0.5,
    hz: d * 0.5,
    min: [x0, y0, z0],
    max: [x1, y1, z1],
  };
  return out as unknown as Box;
}

/**
 * Transforms an array of local-space AABBs into world-space AABBs using a
 * column-major 4x4 matrix `m` (such as THREE.Matrix4.elements).
 */
export function boxesToWorld(
  local: readonly Box[],
  m: ArrayLike<number> /* column-major 4x4 */
): Box[] {
  const m0 = m[0] ?? 1;
  const m1 = m[1] ?? 0;
  const m2 = m[2] ?? 0;
  const m4 = m[4] ?? 0;
  const m5 = m[5] ?? 1;
  const m6 = m[6] ?? 0;
  const m8 = m[8] ?? 0;
  const m9 = m[9] ?? 0;
  const m10 = m[10] ?? 1;
  const m12 = m[12] ?? 0;
  const m13 = m[13] ?? 0;
  const m14 = m[14] ?? 0;

  const result: Box[] = [];

  for (let idx = 0; idx < local.length; idx++) {
    const item = local[idx];
    if (!item) continue;
    const b = unpackBoxBounds(item);

    const xs: readonly [number, number] = [b.minX, b.maxX];
    const ys: readonly [number, number] = [b.minY, b.maxY];
    const zs: readonly [number, number] = [b.minZ, b.maxZ];

    let wMinX = Infinity;
    let wMinY = Infinity;
    let wMinZ = Infinity;
    let wMaxX = -Infinity;
    let wMaxY = -Infinity;
    let wMaxZ = -Infinity;

    for (let xi = 0; xi < 2; xi++) {
      const lx = xs[xi] ?? 0;
      for (let yi = 0; yi < 2; yi++) {
        const ly = ys[yi] ?? 0;
        for (let zi = 0; zi < 2; zi++) {
          const lz = zs[zi] ?? 0;
          const wx = m0 * lx + m4 * ly + m8 * lz + m12;
          const wy = m1 * lx + m5 * ly + m9 * lz + m13;
          const wz = m2 * lx + m6 * ly + m10 * lz + m14;

          if (wx < wMinX) wMinX = wx;
          if (wy < wMinY) wMinY = wy;
          if (wz < wMinZ) wMinZ = wz;
          if (wx > wMaxX) wMaxX = wx;
          if (wy > wMaxY) wMaxY = wy;
          if (wz > wMaxZ) wMaxZ = wz;
        }
      }
    }

    result.push(packBoxBounds(wMinX, wMinY, wMinZ, wMaxX, wMaxY, wMaxZ));
  }

  return result;
}

/**
 * Checks whether the 2D segment (px, pz) -> (nx, nz) intersects the open
 * expanded rectangle (x0, x1) x (z0, z1).
 */
function segmentIntersectsExpandedBox(
  px: number,
  pz: number,
  nx: number,
  nz: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number
): boolean {
  if (nx > x0 && nx < x1 && nz > z0 && nz < z1) {
    return true;
  }

  const dx = nx - px;
  const dz = nz - pz;
  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-9) {
    if (px <= x0 || px >= x1) return false;
  } else {
    const invDx = 1 / dx;
    let t1 = (x0 - px) * invDx;
    let t2 = (x1 - px) * invDx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin >= tMax) return false;
  }

  if (Math.abs(dz) < 1e-9) {
    if (pz <= z0 || pz >= z1) return false;
  } else {
    const invDz = 1 / dz;
    let t1 = (z0 - pz) * invDz;
    let t2 = (z1 - pz) * invDz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin >= tMax) return false;
  }

  return tMin < tMax && tMax > EPS && tMin < 1 - EPS;
}

/**
 * Swept circle-vs-AABB resolver in XZ.
 * - Body spans [feetY + 0.1, feetY + 1.8]. Boxes outside this Y span are ignored.
 * - Ejects strictly through the face that `prev` was outside of (never the nearest
 *   face), preventing a 0.56 m step from tunnelling through a 0.2 m wall.
 */
export function pushCircle(
  prev: { x: number; z: number },
  next: { x: number; z: number },
  feetY: number,
  radius: number,
  boxes: readonly Box[]
): { x: number; z: number } {
  const r = Math.max(0, radius);
  const bodyMinY = feetY + BODY_MIN_Y_OFFSET;
  const bodyMaxY = feetY + BODY_MAX_Y_OFFSET;

  let curX = next.x;
  let curZ = next.z;

  // Two passes resolve multi-box interior L-corners cleanly after wall sliding.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < boxes.length; i++) {
      const rawBox = boxes[i];
      if (!rawBox) continue;
      const b = unpackBoxBounds(rawBox);

      // Ignore step-height boxes (<= feetY + 0.1) and overhead lintels (>= feetY + 1.8)
      if (b.maxY <= bodyMinY + EPS || b.minY >= bodyMaxY - EPS) {
        continue;
      }

      const x0 = b.minX - r;
      const x1 = b.maxX + r;
      const z0 = b.minZ - r;
      const z1 = b.maxZ + r;

      if (!segmentIntersectsExpandedBox(prev.x, prev.z, curX, curZ, x0, x1, z0, z1)) {
        continue;
      }

      // Determine which face(s) `prev` was outside of on the expanded box;
      // if `prev` was already slightly inside the radius margin, fall back to
      // which face of the raw box `prev` was outside of.
      let outLeft = prev.x <= x0 + EPS;
      let outRight = prev.x >= x1 - EPS;
      let outBack = prev.z <= z0 + EPS;
      let outFront = prev.z >= z1 - EPS;

      if (!outLeft && !outRight && !outBack && !outFront) {
        outLeft = prev.x <= b.minX + EPS;
        outRight = prev.x >= b.maxX - EPS;
        outBack = prev.z <= b.minZ + EPS;
        outFront = prev.z >= b.maxZ - EPS;
      }

      const outX = outLeft || outRight;
      const outZ = outBack || outFront;
      const targetX = outLeft ? x0 : x1;
      const targetZ = outBack ? z0 : z1;

      if (outX && !outZ) {
        curX = targetX;
      } else if (outZ && !outX) {
        curZ = targetZ;
      } else if (outX && outZ) {
        // Diagonal approach from outside an exterior corner:
        // Compare slab entry times along prev -> cur; the axis entered LATER is
        // the face the swept circle actually struck.
        const dx = curX - prev.x;
        const dz = curZ - prev.z;
        const tx = Math.abs(dx) > EPS ? (targetX - prev.x) / dx : -Infinity;
        const tz = Math.abs(dz) > EPS ? (targetZ - prev.z) / dz : -Infinity;

        if (Math.abs(tx - tz) <= 1e-5) {
          curX = targetX;
          curZ = targetZ;
        } else if (tx > tz) {
          curX = targetX;
        } else {
          curZ = targetZ;
        }
      } else {
        // Fallback only if `prev` was already spawned deep inside the raw box core:
        // eject along the axis opposite to movement direction (or smallest overlap).
        const dx = curX - prev.x;
        const dz = curZ - prev.z;
        if (Math.abs(dx) >= Math.abs(dz) && Math.abs(dx) > EPS) {
          curX = dx > 0 ? x0 : x1;
        } else if (Math.abs(dz) > EPS) {
          curZ = dz > 0 ? z0 : z1;
        } else {
          const dLeft = Math.abs(curX - x0);
          const dRight = Math.abs(x1 - curX);
          const dBack = Math.abs(curZ - z0);
          const dFront = Math.abs(z1 - curZ);
          const minD = Math.min(dLeft, dRight, dBack, dFront);
          if (minD === dLeft) curX = x0;
          else if (minD === dRight) curX = x1;
          else if (minD === dBack) curZ = z0;
          else curZ = z1;
        }
      }
    }
  }

  return { x: curX, z: curZ };
}

/**
 * Pure helper for PlayScene.gateExit(dist = 3) (GATE-05):
 * Computes the twin-local point (0, 0, -dist) in world space from the twin gate's
 * column-major 4x4 world matrix `m`, with `yaw = gateYawDelta`.
 */
export function computeGateExitPose(
  m: ArrayLike<number>,
  gateYawDelta: number,
  dist = 3
): { x: number; z: number; yaw: number } {
  const m8 = m[8] ?? 0;
  const m10 = m[10] ?? 1;
  const m12 = m[12] ?? 0;
  const m14 = m[14] ?? 0;
  return {
    x: m8 * -dist + m12,
    z: m10 * -dist + m14,
    yaw: gateYawDelta,
  };
}

/**
 * LAB-10: colliders for the part of a generated model's visible bounds that sticks out past the prop's own colliders.
 * For each horizontal face (x and z) where `visible` reaches more than `margin` past the union of `own`, one slab covers
 * that overhang over the visible height and depth. A slab that meets a keep-clear zone (a doorway, a walkway) is left out.
 */
export function overhangBoxes(
  visible: Bounds3D,
  own: readonly Bounds3D[],
  keepClear: readonly Bounds3D[] = [],
  margin = 0.1
): Box[] {
  if (own.length === 0) return [];
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const b of own) {
    minX = Math.min(minX, b.minX);
    minZ = Math.min(minZ, b.minZ);
    maxX = Math.max(maxX, b.maxX);
    maxZ = Math.max(maxZ, b.maxZ);
  }
  const slabs: Bounds3D[] = [];
  if (visible.maxX - maxX > margin) slabs.push({ ...visible, minX: maxX });
  if (minX - visible.minX > margin) slabs.push({ ...visible, maxX: minX });
  if (visible.maxZ - maxZ > margin) slabs.push({ ...visible, minZ: maxZ });
  if (minZ - visible.minZ > margin) slabs.push({ ...visible, maxZ: minZ });
  const overlaps = (a: Bounds3D, k: Bounds3D): boolean =>
    a.minX < k.maxX && a.maxX > k.minX && a.minY < k.maxY && a.maxY > k.minY && a.minZ < k.maxZ && a.maxZ > k.minZ;
  return slabs
    .filter((s) => !keepClear.some((k) => overlaps(s, k)))
    .map((s) => packBoxBounds(s.minX, s.minY, s.minZ, s.maxX, s.maxY, s.maxZ));
}

/**
 * pushCircle against boxes that live in their own frame (a gate, a machine), placed by `m`: a column-major world matrix with a
 * yaw and a position (no scale). The walker is taken into the frame, pushed there with the frame's own boxes, and taken back.
 * A rotated frame's boxes stay exact this way: boxesToWorld would turn each rotated box into a larger world box.
 */
export function pushCircleInFrame(
  prev: { x: number; z: number },
  next: { x: number; z: number },
  feetY: number,
  radius: number,
  boxes: readonly Box[],
  m: ArrayLike<number>
): { x: number; z: number } {
  const m0 = m[0] ?? 1, m2 = m[2] ?? 0, m8 = m[8] ?? 0, m10 = m[10] ?? 1;
  const tx = m[12] ?? 0, ty = m[13] ?? 0, tz = m[14] ?? 0;
  const det = m0 * m10 - m8 * m2;
  if (Math.abs(det) < 1e-12) return { x: next.x, z: next.z };
  // world = A * local + t, with A = [[m0, m8], [m2, m10]] on (x, z)
  const toLocal = (p: { x: number; z: number }): { x: number; z: number } => {
    const dx = p.x - tx, dz = p.z - tz;
    return { x: (m10 * dx - m8 * dz) / det, z: (-m2 * dx + m0 * dz) / det };
  };
  const pushed = pushCircle(toLocal(prev), toLocal(next), feetY - ty, radius, boxes);
  return { x: m0 * pushed.x + m8 * pushed.z + tx, z: m2 * pushed.x + m10 * pushed.z + tz };
}
