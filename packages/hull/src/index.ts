export type V3 = [number, number, number];
export interface Hull { vertices: V3[]; faces: [number, number, number][] }
export interface Box { centre: V3; half: V3; axes: [V3, V3, V3] }

interface PointMetrics {
  scale: number;
  eps: number;
  maxAbs: number;
}

interface ProjectedPoint {
  point: V3;
  x: number;
  y: number;
}

interface WorkFace {
  a: number;
  b: number;
  c: number;
  normal: V3;
  normalLength: number;
  outside: number[];
}

interface EdgeCount {
  a: number;
  b: number;
  count: number;
}

interface VoxelBox {
  min: V3;
  max: V3;
}

type Matrix3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

function copyVec(p: V3): V3 {
  return [p[0], p[1], p[2]];
}

function subtract(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function multiply(v: V3, scalar: number): V3 {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(v: V3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v: V3): V3 {
  const magnitude = length(v);
  if (magnitude === 0 || !Number.isFinite(magnitude)) return [0, 0, 0];
  return [v[0] / magnitude, v[1] / magnitude, v[2] / magnitude];
}

function finitePoints(points: readonly V3[]): V3[] {
  const result: V3[] = [];
  for (const point of points) {
    if (
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      Number.isFinite(point[2])
    ) {
      result.push(copyVec(point));
    }
  }
  return result;
}

function pointMetrics(points: readonly V3[]): PointMetrics {
  if (points.length === 0) return { scale: 0, eps: 0, maxAbs: 0 };

  const first = points[0];
  if (first === undefined) return { scale: 0, eps: 0, maxAbs: 0 };

  let minX = first[0];
  let minY = first[1];
  let minZ = first[2];
  let maxX = first[0];
  let maxY = first[1];
  let maxZ = first[2];
  let maxAbs = Math.max(Math.abs(first[0]), Math.abs(first[1]), Math.abs(first[2]));

  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
    maxZ = Math.max(maxZ, point[2]);
    maxAbs = Math.max(maxAbs, Math.abs(point[0]), Math.abs(point[1]), Math.abs(point[2]));
  }

  const scale = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  const eps = Math.max(scale * 1e-9, maxAbs * Number.EPSILON * 8);
  return { scale, eps, maxAbs };
}

function distinctPoints(points: readonly V3[], eps: number): V3[] {
  const result: V3[] = [];
  for (const point of points) {
    let duplicate = false;
    for (const existing of result) {
      if (length(subtract(point, existing)) <= eps) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) result.push(copyVec(point));
  }
  return result;
}

function projectPoint(point: V3, droppedAxis: number): [number, number] {
  if (droppedAxis === 0) return [point[1], point[2]];
  if (droppedAxis === 1) return [point[0], point[2]];
  return [point[0], point[1]];
}

function projectedCross(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function planarBoundary(points: readonly V3[], normal: V3, eps: number, scale: number): V3[] {
  const absX = Math.abs(normal[0]);
  const absY = Math.abs(normal[1]);
  const absZ = Math.abs(normal[2]);
  const droppedAxis = absX >= absY && absX >= absZ ? 0 : absY >= absZ ? 1 : 2;

  const projected: ProjectedPoint[] = points.map((point) => {
    const [x, y] = projectPoint(point, droppedAxis);
    return { point, x, y };
  });
  projected.sort((a, b) => a.x - b.x || a.y - b.y);

  const unique: ProjectedPoint[] = [];
  for (const candidate of projected) {
    const previous = unique[unique.length - 1];
    if (
      previous === undefined ||
      Math.hypot(candidate.x - previous.x, candidate.y - previous.y) > eps
    ) {
      unique.push(candidate);
    }
  }

  if (unique.length <= 2) return unique.map((entry) => copyVec(entry.point));

  const areaTolerance = eps * scale;
  const lower: ProjectedPoint[] = [];
  for (const point of unique) {
    while (lower.length >= 2) {
      const a = lower[lower.length - 2];
      const b = lower[lower.length - 1];
      if (a === undefined || b === undefined) break;
      if (projectedCross(a, b, point) > areaTolerance) break;
      lower.pop();
    }
    lower.push(point);
  }

  const upper: ProjectedPoint[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    if (point === undefined) continue;
    while (upper.length >= 2) {
      const a = upper[upper.length - 2];
      const b = upper[upper.length - 1];
      if (a === undefined || b === undefined) break;
      if (projectedCross(a, b, point) > areaTolerance) break;
      upper.pop();
    }
    upper.push(point);
  }

  const boundary = lower
    .slice(0, Math.max(0, lower.length - 1))
    .concat(upper.slice(0, Math.max(0, upper.length - 1)));
  return boundary.map((entry) => copyVec(entry.point));
}

function lineEndpoints(points: readonly V3[], firstIndex: number, secondIndex: number): V3[] {
  const origin = points[firstIndex];
  const second = points[secondIndex];
  if (origin === undefined) return [];
  if (second === undefined) return [copyVec(origin)];

  const direction = subtract(second, origin);
  const denominator = dot(direction, direction);
  if (denominator === 0) return [copyVec(origin)];

  let minT = Infinity;
  let maxT = -Infinity;
  let minIndex = firstIndex;
  let maxIndex = firstIndex;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point === undefined) continue;
    const t = dot(subtract(point, origin), direction) / denominator;
    if (t < minT) {
      minT = t;
      minIndex = index;
    }
    if (t > maxT) {
      maxT = t;
      maxIndex = index;
    }
  }

  if (minIndex === maxIndex) {
    const endpoint = points[minIndex];
    return endpoint === undefined ? [] : [copyVec(endpoint)];
  }

  const minPoint = points[minIndex];
  const maxPoint = points[maxIndex];
  if (minPoint === undefined || maxPoint === undefined) return [];
  return [copyVec(minPoint), copyVec(maxPoint)];
}

function makeFace(
  points: readonly V3[],
  aIndex: number,
  bIndex: number,
  cIndex: number,
  interior: V3,
): WorkFace | undefined {
  const a = points[aIndex];
  const b = points[bIndex];
  const c = points[cIndex];
  if (a === undefined || b === undefined || c === undefined) return undefined;

  let bIndexOriented = bIndex;
  let cIndexOriented = cIndex;
  let normal = cross(subtract(b, a), subtract(c, a));
  let normalLength = length(normal);
  if (normalLength === 0 || !Number.isFinite(normalLength)) return undefined;

  if (dot(normal, subtract(interior, a)) > 0) {
    bIndexOriented = cIndex;
    cIndexOriented = bIndex;
    normal = multiply(normal, -1);
    normalLength = length(normal);
  }

  return {
    a: aIndex,
    b: bIndexOriented,
    c: cIndexOriented,
    normal,
    normalLength,
    outside: [],
  };
}

function faceDistance(face: WorkFace, point: V3, points: readonly V3[]): number {
  const anchor = points[face.a];
  if (anchor === undefined) return -Infinity;
  return dot(face.normal, subtract(point, anchor)) / face.normalLength;
}

/** Quickhull over the points (tolerance 1e-9 scaled by the size of the cloud). Fewer than 4 non-coplanar points: vertices = the distinct extreme points, faces = []. */
export function hull(input: readonly V3[]): Hull {
  const finite = finitePoints(input);
  if (finite.length === 0) return { vertices: [], faces: [] };

  const { scale, eps } = pointMetrics(finite);
  const points = distinctPoints(finite, eps);
  if (points.length === 0) return { vertices: [], faces: [] };

  let firstIndex = 0;
  let secondIndex = 0;
  let farthestDistance = -1;
  const firstPoint = points[0];
  if (firstPoint === undefined) return { vertices: [], faces: [] };

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point === undefined) continue;
    const distance = length(subtract(point, firstPoint));
    if (distance > farthestDistance) {
      farthestDistance = distance;
      secondIndex = index;
    }
  }

  if (farthestDistance <= eps) {
    return { vertices: [copyVec(firstPoint)], faces: [] };
  }

  const secondPoint = points[secondIndex];
  if (secondPoint === undefined) return { vertices: [copyVec(firstPoint)], faces: [] };
  const lineDirection = subtract(secondPoint, firstPoint);
  const lineLength = length(lineDirection);

  let thirdIndex = firstIndex;
  let maxLineDistance = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point === undefined) continue;
    const distance = length(cross(lineDirection, subtract(point, firstPoint))) / lineLength;
    if (distance > maxLineDistance) {
      maxLineDistance = distance;
      thirdIndex = index;
    }
  }

  if (maxLineDistance <= eps) {
    return { vertices: lineEndpoints(points, firstIndex, secondIndex), faces: [] };
  }

  const thirdPoint = points[thirdIndex];
  if (thirdPoint === undefined) return { vertices: lineEndpoints(points, firstIndex, secondIndex), faces: [] };
  const baseNormal = cross(lineDirection, subtract(thirdPoint, firstPoint));
  const baseNormalLength = length(baseNormal);
  if (baseNormalLength === 0) {
    return { vertices: lineEndpoints(points, firstIndex, secondIndex), faces: [] };
  }

  let fourthIndex = -1;
  let maxPlaneDistance = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point === undefined) continue;
    const distance = Math.abs(dot(baseNormal, subtract(point, firstPoint))) / baseNormalLength;
    if (distance > maxPlaneDistance) {
      maxPlaneDistance = distance;
      fourthIndex = index;
    }
  }

  if (maxPlaneDistance <= eps) {
    return { vertices: planarBoundary(points, baseNormal, eps, scale), faces: [] };
  }

  if (fourthIndex < 0) {
    return { vertices: planarBoundary(points, baseNormal, eps, scale), faces: [] };
  }

  const fourthPoint = points[fourthIndex];
  if (fourthPoint === undefined) {
    return { vertices: planarBoundary(points, baseNormal, eps, scale), faces: [] };
  }

  const interior: V3 = [
    firstPoint[0] * 0.25 + secondPoint[0] * 0.25 + thirdPoint[0] * 0.25 + fourthPoint[0] * 0.25,
    firstPoint[1] * 0.25 + secondPoint[1] * 0.25 + thirdPoint[1] * 0.25 + fourthPoint[1] * 0.25,
    firstPoint[2] * 0.25 + secondPoint[2] * 0.25 + thirdPoint[2] * 0.25 + fourthPoint[2] * 0.25,
  ];

  const initialTriangles: [number, number, number][] = [
    [firstIndex, secondIndex, thirdIndex],
    [firstIndex, fourthIndex, secondIndex],
    [firstIndex, thirdIndex, fourthIndex],
    [secondIndex, fourthIndex, thirdIndex],
  ];
  let faces: WorkFace[] = [];
  for (const [a, b, c] of initialTriangles) {
    const face = makeFace(points, a, b, c, interior);
    if (face !== undefined) faces.push(face);
  }
  if (faces.length < 4) return { vertices: points.map(copyVec), faces: [] };

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    if (
      pointIndex === firstIndex ||
      pointIndex === secondIndex ||
      pointIndex === thirdIndex ||
      pointIndex === fourthIndex
    ) {
      continue;
    }

    const point = points[pointIndex];
    if (point === undefined) continue;
    let bestFace = -1;
    let bestDistance = eps;

    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
      const face = faces[faceIndex];
      if (face === undefined) continue;
      const distance = faceDistance(face, point, points);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestFace = faceIndex;
      }
    }

    if (bestFace >= 0) {
      const face = faces[bestFace];
      if (face !== undefined) face.outside.push(pointIndex);
    }
  }

  for (let iteration = 0; iteration < points.length; iteration += 1) {
    let eyeIndex = -1;
    let farthest = eps;

    for (const face of faces) {
      for (const pointIndex of face.outside) {
        const point = points[pointIndex];
        if (point === undefined) continue;
        const distance = faceDistance(face, point, points);
        if (distance > farthest) {
          farthest = distance;
          eyeIndex = pointIndex;
        }
      }
    }

    if (eyeIndex < 0) break;
    const eyePoint = points[eyeIndex];
    if (eyePoint === undefined) break;

    const visible = new Uint8Array(faces.length);
    const horizon = new Map<string, EdgeCount>();
    const orphaned: number[] = [];
    let visibleCount = 0;

    const addEdge = (a: number, b: number): void => {
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      const key = `${low}:${high}`;
      const existing = horizon.get(key);
      if (existing === undefined) {
        horizon.set(key, { a, b, count: 1 });
      } else {
        existing.count += 1;
      }
    };

    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
      const face = faces[faceIndex];
      if (face === undefined || faceDistance(face, eyePoint, points) <= eps) continue;

      visible[faceIndex] = 1;
      visibleCount += 1;
      for (const pointIndex of face.outside) {
        if (pointIndex !== eyeIndex) orphaned.push(pointIndex);
      }
      addEdge(face.a, face.b);
      addEdge(face.b, face.c);
      addEdge(face.c, face.a);
    }

    if (visibleCount === 0) break;

    const retained: WorkFace[] = [];
    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
      if (visible[faceIndex] === 1) continue;
      const face = faces[faceIndex];
      if (face !== undefined) retained.push(face);
    }

    const added: WorkFace[] = [];
    for (const edge of horizon.values()) {
      if (edge.count !== 1) continue;
      const face = makeFace(points, edge.a, edge.b, eyeIndex, interior);
      if (face !== undefined) added.push(face);
    }

    if (added.length === 0) break;
    faces = retained.concat(added);

    for (const pointIndex of orphaned) {
      const point = points[pointIndex];
      if (point === undefined) continue;

      let bestFace = -1;
      let bestDistance = eps;
      for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
        const face = faces[faceIndex];
        if (face === undefined) continue;
        const distance = faceDistance(face, point, points);
        if (distance > bestDistance) {
          bestDistance = distance;
          bestFace = faceIndex;
        }
      }

      if (bestFace >= 0) {
        const face = faces[bestFace];
        if (face !== undefined) face.outside.push(pointIndex);
      }
    }
  }

  const used = new Uint8Array(points.length);
  for (const face of faces) {
    used[face.a] = 1;
    used[face.b] = 1;
    used[face.c] = 1;
  }

  const remap = new Int32Array(points.length);
  remap.fill(-1);
  const vertices: V3[] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (used[index] !== 1) continue;
    const point = points[index];
    if (point === undefined) continue;
    remap[index] = vertices.length;
    vertices.push(copyVec(point));
  }

  const outputFaces: [number, number, number][] = [];
  for (const face of faces) {
    const a = remap[face.a] ?? -1;
    const b = remap[face.b] ?? -1;
    const c = remap[face.c] ?? -1;
    if (a >= 0 && b >= 0 && c >= 0) outputFaces.push([a, b, c]);
  }

  return { vertices, faces: outputFaces };
}

/** Simplify to at most maxVerts vertices: keep the hull of a subset chosen by farthest point sampling (start at the vertex farthest from the centroid). */
export function simplify(h: Hull, maxVerts: number): Hull {
  const count = h.vertices.length;
  const limit = Number.isFinite(maxVerts)
    ? Math.max(0, Math.floor(maxVerts))
    : maxVerts > 0
      ? count
      : 0;

  if (limit >= count) {
    return {
      vertices: h.vertices.map(copyVec),
      faces: h.faces.map((face): [number, number, number] => [face[0], face[1], face[2]]),
    };
  }
  if (limit === 0 || count === 0) return { vertices: [], faces: [] };

  const centroid: V3 = [0, 0, 0];
  for (const point of h.vertices) {
    centroid[0] += point[0] / count;
    centroid[1] += point[1] / count;
    centroid[2] += point[2] / count;
  }

  let startIndex = 0;
  let farthest = -1;
  for (let index = 0; index < count; index += 1) {
    const point = h.vertices[index];
    if (point === undefined) continue;
    const distance = length(subtract(point, centroid));
    if (distance > farthest) {
      farthest = distance;
      startIndex = index;
    }
  }

  const chosen = new Uint8Array(count);
  const selected: V3[] = [];
  const start = h.vertices[startIndex];
  if (start === undefined) return { vertices: [], faces: [] };
  chosen[startIndex] = 1;
  selected.push(copyVec(start));

  while (selected.length < limit) {
    let bestIndex = -1;
    let bestDistance = -1;

    for (let index = 0; index < count; index += 1) {
      if (chosen[index] === 1) continue;
      const candidate = h.vertices[index];
      if (candidate === undefined) continue;

      let nearest = Infinity;
      for (const selectedPoint of selected) {
        nearest = Math.min(nearest, length(subtract(candidate, selectedPoint)));
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) break;
    const point = h.vertices[bestIndex];
    if (point === undefined) break;
    chosen[bestIndex] = 1;
    selected.push(copyVec(point));
  }

  return hull(selected);
}

export function volume(h: Hull): number {
  const reference = h.vertices[0];
  if (reference === undefined) return 0;

  let signedVolume = 0;
  for (const face of h.faces) {
    const a = h.vertices[face[0]];
    const b = h.vertices[face[1]];
    const c = h.vertices[face[2]];
    if (a === undefined || b === undefined || c === undefined) continue;

    signedVolume += dot(
      subtract(a, reference),
      cross(subtract(b, reference), subtract(c, reference)),
    ) / 6;
  }
  return Math.abs(signedVolume);
}

function containsDegenerate(
  vertices: readonly V3[],
  point: V3,
  tolerance: number,
  scale: number,
): boolean {
  const first = vertices[0];
  if (first === undefined) return false;
  if (vertices.length === 1) return length(subtract(point, first)) <= tolerance;

  let secondIndex = 0;
  let farthest = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    if (vertex === undefined) continue;
    const distance = length(subtract(vertex, first));
    if (distance > farthest) {
      farthest = distance;
      secondIndex = index;
    }
  }

  const second = vertices[secondIndex];
  if (second === undefined) return false;
  const direction = subtract(second, first);
  const directionLength = length(direction);
  if (directionLength <= tolerance) return length(subtract(point, first)) <= tolerance;

  let maxLineDistance = 0;
  let thirdIndex = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    if (vertex === undefined) continue;
    const distance = length(cross(direction, subtract(vertex, first))) / directionLength;
    if (distance > maxLineDistance) {
      maxLineDistance = distance;
      thirdIndex = index;
    }
  }

  if (maxLineDistance <= tolerance) {
    const denominator = dot(direction, direction);
    if (denominator === 0) return length(subtract(point, first)) <= tolerance;
    const relative = subtract(point, first);
    const t = dot(relative, direction) / denominator;
    const perpendicular = length(subtract(relative, multiply(direction, t)));
    const padding = tolerance / directionLength;
    return perpendicular <= tolerance && t >= -padding && t <= 1 + padding;
  }

  const third = vertices[thirdIndex];
  if (third === undefined) return false;
  const normal = cross(direction, subtract(third, first));
  const normalLength = length(normal);
  if (normalLength === 0) return false;

  const planeDistance = Math.abs(dot(normal, subtract(point, first))) / normalLength;
  if (planeDistance > tolerance) return false;

  const absX = Math.abs(normal[0]);
  const absY = Math.abs(normal[1]);
  const absZ = Math.abs(normal[2]);
  const droppedAxis = absX >= absY && absX >= absZ ? 0 : absY >= absZ ? 1 : 2;
  const [pointX, pointY] = projectPoint(point, droppedAxis);
  const areaTolerance = tolerance * scale;

  for (let index = 0; index < vertices.length; index += 1) {
    const nextIndex = index + 1 === vertices.length ? 0 : index + 1;
    const a = vertices[index];
    const b = vertices[nextIndex];
    if (a === undefined || b === undefined) continue;
    const [ax, ay] = projectPoint(a, droppedAxis);
    const [bx, by] = projectPoint(b, droppedAxis);
    const side = (bx - ax) * (pointY - ay) - (by - ay) * (pointX - ax);
    if (side < -areaTolerance) return false;
  }

  return true;
}

export function contains(h: Hull, p: V3, eps?: number): boolean {
  if (
    !Number.isFinite(p[0]) ||
    !Number.isFinite(p[1]) ||
    !Number.isFinite(p[2]) ||
    h.vertices.length === 0
  ) {
    return false;
  }

  const metrics = pointMetrics(h.vertices);
  const tolerance =
    eps === undefined
      ? metrics.eps
      : Number.isFinite(eps)
        ? Math.max(0, eps)
        : 0;

  if (h.faces.length === 0) {
    return containsDegenerate(h.vertices, p, tolerance, metrics.scale);
  }

  for (const face of h.faces) {
    const a = h.vertices[face[0]];
    const b = h.vertices[face[1]];
    const c = h.vertices[face[2]];
    if (a === undefined || b === undefined || c === undefined) continue;

    const normal = cross(subtract(b, a), subtract(c, a));
    const normalLength = length(normal);
    if (normalLength === 0) continue;
    const distance = dot(normal, subtract(p, a)) / normalLength;
    if (distance > tolerance) return false;
  }

  return true;
}

function identityAxes(): [V3, V3, V3] {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
}

export function aabb(points: readonly V3[]): Box {
  const valid = finitePoints(points);
  if (valid.length === 0) {
    return { centre: [0, 0, 0], half: [0, 0, 0], axes: identityAxes() };
  }

  const first = valid[0];
  if (first === undefined) {
    return { centre: [0, 0, 0], half: [0, 0, 0], axes: identityAxes() };
  }

  let minX = first[0];
  let minY = first[1];
  let minZ = first[2];
  let maxX = first[0];
  let maxY = first[1];
  let maxZ = first[2];

  for (const point of valid) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
    maxZ = Math.max(maxZ, point[2]);
  }

  return {
    centre: [
      minX * 0.5 + maxX * 0.5,
      minY * 0.5 + maxY * 0.5,
      minZ * 0.5 + maxZ * 0.5,
    ],
    half: [
      maxX * 0.5 - minX * 0.5,
      maxY * 0.5 - minY * 0.5,
      maxZ * 0.5 - minZ * 0.5,
    ],
    axes: identityAxes(),
  };
}

function canonicalAxis(axis: V3): V3 {
  const absX = Math.abs(axis[0]);
  const absY = Math.abs(axis[1]);
  const absZ = Math.abs(axis[2]);
  const dominant =
    absX >= absY && absX >= absZ
      ? axis[0]
      : absY >= absZ
        ? axis[1]
        : axis[2];
  return dominant < 0 ? multiply(axis, -1) : axis;
}

export function obb(points: readonly V3[]): Box {
  const valid = finitePoints(points);
  if (valid.length === 0) return aabb([]);

  const mean: V3 = [0, 0, 0];
  for (let index = 0; index < valid.length; index += 1) {
    const point = valid[index];
    if (point === undefined) continue;
    const divisor = index + 1;
    mean[0] += (point[0] - mean[0]) / divisor;
    mean[1] += (point[1] - mean[1]) / divisor;
    mean[2] += (point[2] - mean[2]) / divisor;
  }

  let xx = 0;
  let yy = 0;
  let zz = 0;
  let xy = 0;
  let xz = 0;
  let yz = 0;

  for (const point of valid) {
    const x = point[0] - mean[0];
    const y = point[1] - mean[1];
    const z = point[2] - mean[2];
    xx += x * x;
    yy += y * y;
    zz += z * z;
    xy += x * y;
    xz += x * z;
    yz += y * z;
  }

  const divisor = valid.length;
  const matrix: Matrix3 = [
    [xx / divisor, xy / divisor, xz / divisor],
    [xy / divisor, yy / divisor, yz / divisor],
    [xz / divisor, yz / divisor, zz / divisor],
  ];
  const vectors: Matrix3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  for (let iteration = 0; iteration < 32; iteration += 1) {
    let p = 0;
    let q = 1;
    let largest = Math.abs(matrix[0][1]);

    if (Math.abs(matrix[0][2]) > largest) {
      p = 0;
      q = 2;
      largest = Math.abs(matrix[0][2]);
    }
    if (Math.abs(matrix[1][2]) > largest) {
      p = 1;
      q = 2;
      largest = Math.abs(matrix[1][2]);
    }

    const magnitude = Math.max(
      Math.abs(matrix[0][0]),
      Math.abs(matrix[1][1]),
      Math.abs(matrix[2][2]),
    );
    if (largest <= Number.EPSILON * magnitude * 8) break;

    const app = matrix[p]![p]!;
    const aqq = matrix[q]![q]!;
    const apq = matrix[p]![q]!;
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    for (let index = 0; index < 3; index += 1) {
      if (index === p || index === q) continue;

      const indexP = matrix[index]![p]!;
      const indexQ = matrix[index]![q]!;
      const updatedP = cosine * indexP - sine * indexQ;
      const updatedQ = sine * indexP + cosine * indexQ;
      matrix[index]![p] = updatedP;
      matrix[p]![index] = updatedP;
      matrix[index]![q] = updatedQ;
      matrix[q]![index] = updatedQ;
    }

    matrix[p]![p] =
      cosine * cosine * app - 2 * cosine * sine * apq + sine * sine * aqq;
    matrix[q]![q] =
      sine * sine * app + 2 * cosine * sine * apq + cosine * cosine * aqq;
    matrix[p]![q] = 0;
    matrix[q]![p] = 0;

    for (let index = 0; index < 3; index += 1) {
      const indexP = vectors[index]![p]!;
      const indexQ = vectors[index]![q]!;
      vectors[index]![p] = cosine * indexP - sine * indexQ;
      vectors[index]![q] = sine * indexP + cosine * indexQ;
    }
  }

  const eigenvalues = [matrix[0][0], matrix[1][1], matrix[2][2]];
  const order = [0, 1, 2];
  order.sort((left, right) => (eigenvalues[right] ?? 0) - (eigenvalues[left] ?? 0));

  const axisForColumn = (column: number): V3 =>
    normalize([
      vectors[0][column] ?? 0,
      vectors[1][column] ?? 0,
      vectors[2][column] ?? 0,
    ]);

  const firstColumn = order[0] ?? 0;
  const secondColumn = order[1] ?? 1;
  let axis0 = canonicalAxis(axisForColumn(firstColumn));
  if (length(axis0) === 0) axis0 = [1, 0, 0];

  let axis1 = axisForColumn(secondColumn);
  axis1 = normalize(subtract(axis1, multiply(axis0, dot(axis1, axis0))));
  if (length(axis1) === 0) {
    const seed: V3 = Math.abs(axis0[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    axis1 = normalize(subtract(seed, multiply(axis0, dot(seed, axis0))));
  }
  axis1 = canonicalAxis(axis1);

  const axis2 = normalize(cross(axis0, axis1));
  const axes: [V3, V3, V3] = [axis0, axis1, axis2];

  let min0 = Infinity;
  let min1 = Infinity;
  let min2 = Infinity;
  let max0 = -Infinity;
  let max1 = -Infinity;
  let max2 = -Infinity;

  for (const point of valid) {
    const projection0 = dot(point, axis0);
    const projection1 = dot(point, axis1);
    const projection2 = dot(point, axis2);
    min0 = Math.min(min0, projection0);
    min1 = Math.min(min1, projection1);
    min2 = Math.min(min2, projection2);
    max0 = Math.max(max0, projection0);
    max1 = Math.max(max1, projection1);
    max2 = Math.max(max2, projection2);
  }

  const middle0 = min0 * 0.5 + max0 * 0.5;
  const middle1 = min1 * 0.5 + max1 * 0.5;
  const middle2 = min2 * 0.5 + max2 * 0.5;

  return {
    centre: [
      axis0[0] * middle0 + axis1[0] * middle1 + axis2[0] * middle2,
      axis0[1] * middle0 + axis1[1] * middle1 + axis2[1] * middle2,
      axis0[2] * middle0 + axis1[2] * middle1 + axis2[2] * middle2,
    ],
    half: [
      max0 * 0.5 - min0 * 0.5,
      max1 * 0.5 - min1 * 0.5,
      max2 * 0.5 - min2 * 0.5,
    ],
    axes,
  };
}

function voxelBoxVolume(box: VoxelBox): number {
  return (
    (box.max[0] - box.min[0]) *
    (box.max[1] - box.min[1]) *
    (box.max[2] - box.min[2])
  );
}

function mergeVoxelBounds(a: VoxelBox, b: VoxelBox): VoxelBox {
  return {
    min: [
      Math.min(a.min[0], b.min[0]),
      Math.min(a.min[1], b.min[1]),
      Math.min(a.min[2], b.min[2]),
    ],
    max: [
      Math.max(a.max[0], b.max[0]),
      Math.max(a.max[1], b.max[1]),
      Math.max(a.max[2], b.max[2]),
    ],
  };
}

function voxelIntersectionVolume(a: VoxelBox, b: VoxelBox): number {
  const x = Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]));
  const y = Math.max(0, Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]));
  const z = Math.max(0, Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]));
  return x * y * z;
}

function boxesShareFace(a: VoxelBox, b: VoxelBox): boolean {
  for (let axis = 0; axis < 3; axis += 1) {
    const aMin = a.min[axis] ?? 0;
    const aMax = a.max[axis] ?? 0;
    const bMin = b.min[axis] ?? 0;
    const bMax = b.max[axis] ?? 0;
    if (aMax !== bMin && bMax !== aMin) continue;

    let overlapsOtherAxes = true;
    for (let otherAxis = 0; otherAxis < 3; otherAxis += 1) {
      if (otherAxis === axis) continue;
      const overlap =
        Math.min(a.max[otherAxis] ?? 0, b.max[otherAxis] ?? 0) -
        Math.max(a.min[otherAxis] ?? 0, b.min[otherAxis] ?? 0);
      if (overlap <= 0) {
        overlapsOtherAxes = false;
        break;
      }
    }
    if (overlapsOtherAxes) return true;
  }
  return false;
}

function boxGapSquared(a: VoxelBox, b: VoxelBox): number {
  let gapSquared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const aMin = a.min[axis] ?? 0;
    const aMax = a.max[axis] ?? 0;
    const bMin = b.min[axis] ?? 0;
    const bMax = b.max[axis] ?? 0;
    let gap = 0;
    if (aMax < bMin) gap = bMin - aMax;
    else if (bMax < aMin) gap = aMin - bMax;
    gapSquared += gap * gap;
  }
  return gapSquared;
}

/** Split filled cells into greedy boxes, merging the smallest boxes when the box budget requires it. */
export function voxelBoxes(
  cells: Uint8Array,
  sx: number,
  sy: number,
  sz: number,
  maxBoxes: number,
): { min: V3; max: V3 }[] {
  if (
    !Number.isSafeInteger(sx) ||
    !Number.isSafeInteger(sy) ||
    !Number.isSafeInteger(sz) ||
    sx <= 0 ||
    sy <= 0 ||
    sz <= 0
  ) {
    return [];
  }

  const plane = sx * sy;
  const total = plane * sz;
  if (!Number.isSafeInteger(plane) || !Number.isSafeInteger(total) || total <= 0) return [];

  const length = Math.min(cells.length, total);
  if (length === 0) return [];

  const visited = new Uint8Array(length);
  const boxes: VoxelBox[] = [];

  const isUnvisitedSolid = (x: number, y: number, z: number): boolean => {
    if (x < 0 || x >= sx || y < 0 || y >= sy || z < 0 || z >= sz) return false;
    const index = x + y * sx + z * plane;
    return index < length && cells[index] === 1 && visited[index] !== 1;
  };

  for (let index = 0; index < length; index += 1) {
    if (cells[index] !== 1 || visited[index] === 1) continue;

    const x = index % sx;
    const y = Math.floor(index / sx) % sy;
    const z = Math.floor(index / plane);

    let maxX = x;
    while (maxX + 1 < sx && isUnvisitedSolid(maxX + 1, y, z)) maxX += 1;

    let maxY = y;
    while (maxY + 1 < sy) {
      let canExtend = true;
      for (let testX = x; testX <= maxX; testX += 1) {
        if (!isUnvisitedSolid(testX, maxY + 1, z)) {
          canExtend = false;
          break;
        }
      }
      if (!canExtend) break;
      maxY += 1;
    }

    let maxZ = z;
    while (maxZ + 1 < sz) {
      let canExtend = true;
      for (let testY = y; testY <= maxY && canExtend; testY += 1) {
        for (let testX = x; testX <= maxX; testX += 1) {
          if (!isUnvisitedSolid(testX, testY, maxZ + 1)) {
            canExtend = false;
            break;
          }
        }
      }
      if (!canExtend) break;
      maxZ += 1;
    }

    for (let markZ = z; markZ <= maxZ; markZ += 1) {
      for (let markY = y; markY <= maxY; markY += 1) {
        for (let markX = x; markX <= maxX; markX += 1) {
          visited[markX + markY * sx + markZ * plane] = 1;
        }
      }
    }

    boxes.push({
      min: [x, y, z],
      max: [maxX + 1, maxY + 1, maxZ + 1],
    });
  }

  let limit = Number.isFinite(maxBoxes)
    ? Math.max(0, Math.floor(maxBoxes))
    : maxBoxes > 0
      ? boxes.length
      : 0;
  if (boxes.length > 0) limit = Math.max(1, limit);

  while (boxes.length > limit) {
    let smallestIndex = 0;
    let smallestVolume = Infinity;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (box === undefined) continue;
      const boxVolume = voxelBoxVolume(box);
      if (boxVolume < smallestVolume) {
        smallestVolume = boxVolume;
        smallestIndex = index;
      }
    }

    const smallest = boxes[smallestIndex];
    if (smallest === undefined) break;

    let hasFaceNeighbor = false;
    for (let index = 0; index < boxes.length; index += 1) {
      if (index === smallestIndex) continue;
      const candidate = boxes[index];
      if (candidate !== undefined && boxesShareFace(smallest, candidate)) {
        hasFaceNeighbor = true;
        break;
      }
    }

    let neighborIndex = -1;
    let bestGap = Infinity;
    let bestCost = Infinity;

    for (let index = 0; index < boxes.length; index += 1) {
      if (index === smallestIndex) continue;
      const candidate = boxes[index];
      if (candidate === undefined) continue;

      const isFaceNeighbor = boxesShareFace(smallest, candidate);
      if (hasFaceNeighbor && !isFaceNeighbor) continue;

      const merged = mergeVoxelBounds(smallest, candidate);
      const cost =
        voxelBoxVolume(merged) -
        voxelBoxVolume(smallest) -
        voxelBoxVolume(candidate) +
        voxelIntersectionVolume(smallest, candidate);

      if (hasFaceNeighbor) {
        if (cost < bestCost) {
          bestCost = cost;
          neighborIndex = index;
        }
      } else {
        const gap = boxGapSquared(smallest, candidate);
        if (gap < bestGap || (gap === bestGap && cost < bestCost)) {
          bestGap = gap;
          bestCost = cost;
          neighborIndex = index;
        }
      }
    }

    if (neighborIndex < 0) break;
    const neighbor = boxes[neighborIndex];
    if (neighbor === undefined) break;

    const merged = mergeVoxelBounds(smallest, neighbor);
    const lowerIndex = Math.min(smallestIndex, neighborIndex);
    const upperIndex = Math.max(smallestIndex, neighborIndex);
    boxes.splice(upperIndex, 1);
    boxes.splice(lowerIndex, 1, merged);
  }

  boxes.sort((a, b) => voxelBoxVolume(b) - voxelBoxVolume(a));
  return boxes;
}