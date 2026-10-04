export type Vec2 = [number, number];

export interface Heightfield {
  cols: number;
  rows: number;
  cell: number;
  originX: number;
  originZ: number;
  heights: Float32Array;
}

export interface RoadSpec {
  points: Vec2[];
  width: number;
  shoulder: number;
  depth: number;
  kind: 'road' | 'river';
  smooth: boolean;
}

export interface Rect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

interface Cubic {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

interface Nearest {
  distance: number;
  target: number;
}

const EPSILON = 1e-9;

function copyPoint(point: Vec2): Vec2 {
  return [point[0], point[1]];
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
}

function pointToSegmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;

  if (lengthSquared === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const t = clamp(
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dz * t));
}

function splitCubic(cubic: Cubic): [Cubic, Cubic] {
  const p01 = midpoint(cubic.p0, cubic.p1);
  const p12 = midpoint(cubic.p1, cubic.p2);
  const p23 = midpoint(cubic.p2, cubic.p3);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const middle = midpoint(p012, p123);

  return [
    { p0: cubic.p0, p1: p01, p2: p012, p3: middle },
    { p0: middle, p1: p123, p2: p23, p3: cubic.p3 },
  ];
}

function appendCubic(output: Vec2[], cubic: Cubic, step: number): void {
  const stack: Cubic[] = [cubic];
  const maximumDeviation = step / 8;

  while (stack.length > 0) {
    const current = stack.pop()!;
    const chord = distance(current.p0, current.p3);
    const deviation = Math.max(
      pointToSegmentDistance(current.p1, current.p0, current.p3),
      pointToSegmentDistance(current.p2, current.p0, current.p3),
    );

    if (chord <= step && deviation <= maximumDeviation) {
      output.push(copyPoint(current.p3));
      continue;
    }

    const [left, right] = splitCubic(current);
    stack.push(right, left);
  }
}

function catmullRomSegment(before: Vec2, start: Vec2, end: Vec2, after: Vec2): Cubic {
  const startTangent: Vec2 = [
    (end[0] - before[0]) * 0.5,
    (end[1] - before[1]) * 0.5,
  ];
  const endTangent: Vec2 = [
    (after[0] - start[0]) * 0.5,
    (after[1] - start[1]) * 0.5,
  ];

  return {
    p0: copyPoint(start),
    p1: [start[0] + startTangent[0] / 3, start[1] + startTangent[1] / 3],
    p2: [end[0] - endTangent[0] / 3, end[1] - endTangent[1] / 3],
    p3: copyPoint(end),
  };
}

/** Bilinear height at (x, z), clamped to the field's edges. */
export function heightAt(h: Heightfield, x: number, z: number): number {
  if (h.cols < 1 || h.rows < 1 || h.cell <= 0) {
    return 0;
  }

  const maxColumn = h.cols - 1;
  const maxRow = h.rows - 1;
  const fieldColumn = clamp((x - h.originX) / h.cell, 0, maxColumn);
  const fieldRow = clamp((z - h.originZ) / h.cell, 0, maxRow);
  const c0 = Math.floor(fieldColumn);
  const r0 = Math.floor(fieldRow);
  const c1 = Math.min(c0 + 1, maxColumn);
  const r1 = Math.min(r0 + 1, maxRow);
  const tc = fieldColumn - c0;
  const tr = fieldRow - r0;

  const h00 = h.heights[c0 + r0 * h.cols]!;
  const h10 = h.heights[c1 + r0 * h.cols]!;
  const h01 = h.heights[c0 + r1 * h.cols]!;
  const h11 = h.heights[c1 + r1 * h.cols]!;
  const top = h00 + (h10 - h00) * tc;
  const bottom = h01 + (h11 - h01) * tc;

  return top + (bottom - top) * tr;
}

/**
 * The path's centre line as points no more than `step` apart, the first and last points included.
 */
export function centreline(points: Vec2[], smooth: boolean, step: number): Vec2[] {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return [copyPoint(points[0]!)];
  }

  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError('step must be a positive finite number');
  }

  const output: Vec2[] = [copyPoint(points[0]!)];

  if (!smooth) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i]!;
      const end = points[i + 1]!;
      const pieces = Math.max(1, Math.ceil(distance(start, end) / step));

      for (let piece = 1; piece <= pieces; piece += 1) {
        if (piece === pieces) {
          output.push(copyPoint(end));
        } else {
          const t = piece / pieces;
          output.push([
            start[0] + (end[0] - start[0]) * t,
            start[1] + (end[1] - start[1]) * t,
          ]);
        }
      }
    }

    return output;
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]!;
    const end = points[i + 1]!;
    const before: Vec2 = i === 0
      ? [start[0] * 2 - end[0], start[1] * 2 - end[1]]
      : points[i - 1]!;
    const after: Vec2 = i + 2 < points.length
      ? points[i + 2]!
      : [end[0] * 2 - start[0], end[1] * 2 - start[1]];

    appendCubic(output, catmullRomSegment(before, start, end, after), step);
  }

  return output;
}

function roadProfile(line: Vec2[], ground: number[], width: number): number[] {
  const positions = new Array<number>(line.length);
  positions[0] = 0;

  for (let i = 1; i < line.length; i += 1) {
    positions[i] = positions[i - 1]! + distance(line[i - 1]!, line[i]!);
  }

  const profile = new Array<number>(ground.length);
  const halfWidth = width * 0.5;
  let left = 0;
  let right = -1;
  let total = 0;

  for (let i = 0; i < ground.length; i += 1) {
    const low = positions[i]! - halfWidth;
    const high = positions[i]! + halfWidth;

    while (left <= right && positions[left]! < low - EPSILON) {
      total -= ground[left]!;
      left += 1;
    }

    while (
      right + 1 < ground.length
      && positions[right + 1]! <= high + EPSILON
    ) {
      right += 1;
      total += ground[right]!;
    }

    const count = right - left + 1;
    profile[i] = count > 0 ? total / count : ground[i]!;
  }

  return profile;
}

function riverProfile(ground: number[], depth: number): number[] {
  const profile = new Array<number>(ground.length);
  let level = ground[0]!;
  profile[0] = level - depth;

  for (let i = 1; i < ground.length; i += 1) {
    level = Math.min(level, ground[i]!);
    profile[i] = level - depth;
  }

  return profile;
}

function nearestOnLine(x: number, z: number, line: Vec2[], profile: number[]): Nearest {
  if (line.length === 1) {
    const point = line[0]!;
    return {
      distance: Math.hypot(x - point[0], z - point[1]),
      target: profile[0]!,
    };
  }

  let closestSquared = Infinity;
  let closestTarget = profile[0]!;

  for (let i = 0; i < line.length - 1; i += 1) {
    const start = line[i]!;
    const end = line[i + 1]!;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared === 0
      ? 0
      : clamp(((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared, 0, 1);
    const nearestX = start[0] + dx * t;
    const nearestZ = start[1] + dz * t;
    const distanceX = x - nearestX;
    const distanceZ = z - nearestZ;
    const squared = distanceX * distanceX + distanceZ * distanceZ;

    if (squared < closestSquared) {
      closestSquared = squared;
      closestTarget = profile[i]! + (profile[i + 1]! - profile[i]!) * t;
    }
  }

  return { distance: Math.sqrt(closestSquared), target: closestTarget };
}

export function carve(
  h: Heightfield,
  spec: RoadSpec,
): { heights: Float32Array; rect: Rect | null; changed: number } {
  const heights = new Float32Array(h.heights);
  const line = centreline(spec.points, spec.smooth, h.cell / 2);

  if (line.length === 0 || h.cols < 1 || h.rows < 1) {
    return { heights, rect: null, changed: 0 };
  }

  const width = Math.max(0, spec.width);
  const shoulder = Math.max(0, spec.shoulder);
  const ground = line.map((point) => heightAt(h, point[0], point[1]));
  const profile = spec.kind === 'road'
    ? roadProfile(line, ground, width)
    : riverProfile(ground, spec.depth);
  const coreRadius = width * 0.5;
  const outerRadius = coreRadius + shoulder;

  let changed = 0;
  let c0 = h.cols;
  let r0 = h.rows;
  let c1 = -1;
  let r1 = -1;

  for (let r = 0; r < h.rows; r += 1) {
    const z = h.originZ + r * h.cell;

    for (let c = 0; c < h.cols; c += 1) {
      const x = h.originX + c * h.cell;
      const index = c + r * h.cols;
      const original = h.heights[index]!;
      const nearest = nearestOnLine(x, z, line, profile);
      let next = original;

      if (nearest.distance <= coreRadius) {
        next = nearest.target;
      } else if (shoulder > 0 && nearest.distance < outerRadius) {
        const blend = (nearest.distance - coreRadius) / shoulder;
        next = nearest.target + (original - nearest.target) * blend;
      }

      heights[index] = next;

      if (Math.abs(heights[index]! - original) > 1e-6) {
        changed += 1;
        c0 = Math.min(c0, c);
        r0 = Math.min(r0, r);
        c1 = Math.max(c1, c);
        r1 = Math.max(r1, r);
      }
    }
  }

  return {
    heights,
    rect: changed === 0 ? null : { c0, r0, c1, r1 },
    changed,
  };
}