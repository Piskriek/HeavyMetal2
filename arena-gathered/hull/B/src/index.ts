export type V3 = [number, number, number];

export interface Hull {
  vertices: V3[];
  faces: [number, number, number][];
}

export interface Box {
  centre: V3;
  half: V3;
  axes: [V3, V3, V3];
}

type Matrix3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

interface Face {
  a: number;
  b: number;
  c: number;
  normal: V3;
  outside: number[];
  alive: boolean;
}

interface ProjectedPoint {
  index: number;
  u: number;
  v: number;
}

interface CellBox {
  min: V3;
  max: V3;
}

const HULL_TOLERANCE = 1e-9;

function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function multiply(a: V3, scalar: number): V3 {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
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

function magnitude(a: V3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function distance(a: V3, b: V3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function distanceSquared(a: V3, b: V3): number {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return x * x + y * y + z * z;
}

function unit(a: V3): V3 {
  const length = magnitude(a);
  if (length === 0) return [0, 0, 0];
  return [a[0] / length, a[1] / length, a[2] / length];
}

function component(point: V3, axis: number): number {
  if (axis === 0) return point[0];
  if (axis === 1) return point[1];
  return point[2];
}

function finitePoint(point: V3): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]) && Number.isFinite(point[2]);
}

function emptyHull(): Hull {
  return { vertices: [], faces: [] };
}

function projectedCoordinates(point: V3, droppedAxis: number): [number, number] {
  if (droppedAxis === 0) return [point[1], point[2]];
  if (droppedAxis === 1) return [point[0], point[2]];
  return [point[0], point[1]];
}

function cross2(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint): number {
  return (b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u);
}

function planarExtremeIndices(
  points: readonly V3[],
  indices: readonly number[],
  droppedAxis: number,
  tolerance: number,
): number[] {
  const projected: ProjectedPoint[] = [];
  for (const index of indices) {
    const point = points[index];
    if (point === undefined) continue;
    const [u, v] = projectedCoordinates(point, droppedAxis);
    projected.push({ index, u, v });
  }

  projected.sort((a, b) => a.u - b.u || a.v - b.v);

  const distinct: ProjectedPoint[] = [];
  for (const point of projected) {
    const previous = distinct[distinct.length - 1];
    if (previous === undefined || Math.hypot(point.u - previous.u, point.v - previous.v) > tolerance) {
      distinct.push(point);
    }
  }
  if (distinct.length <= 2) return distinct.map((point) => point.index);

  const lower: ProjectedPoint[] = [];
  for (const point of distinct) {
    while (lower.length >= 2) {
      const last = lower[lower.length - 1];
      const before = lower[lower.length - 2];
      if (last === undefined || before === undefined || cross2(before, last, point) > tolerance) break;
      lower.pop();
    }
    lower.push(point);
  }

  const upper: ProjectedPoint[] = [];
  for (let index = distinct.length - 1; index >= 0; index -= 1) {
    const point = distinct[index];
    if (point === undefined) continue;
    while (upper.length >= 2) {
      const last = upper[upper.length - 1];
      const before = upper[upper.length - 2];
      if (last === undefined || before === undefined || cross2(before, last, point) > tolerance) break;
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper).map((point) => point.index);
}

function makeFace(a: number, b: number, c: number, points: readonly V3[], inside: V3): Face | null {
  const pointA = points[a];
  const pointB = points[b];
  const pointC = points[c];
  if (pointA === undefined || pointB === undefined || pointC === undefined) return null;

  let normal = cross(subtract(pointB, pointA), subtract(pointC, pointA));
  const length = magnitude(normal);
  if (length === 0) return null;
  normal = multiply(normal, 1 / length);

  if (dot(normal, subtract(inside, pointA)) > 0) {
    const swap = b;
    b = c;
    c = swap;
    normal = multiply(normal, -1);
  }

  return { a, b, c, normal, outside: [], alive: true };
}

function faceDistance(face: Face, points: readonly V3[], point: V3): number {
  const origin = points[face.a];
  if (origin === undefined) return -Infinity;
  return dot(face.normal, subtract(point, origin));
}

/** Quickhull over the points (tolerance 1e-9 scaled by the size of the cloud). Fewer than 4 non-coplanar points: vertices = the distinct extreme points, faces = []. */
export function hull(points: readonly V3[]): Hull {
  const finite: V3[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let maxAbs = 0;

  for (const point of points) {
    if (!finitePoint(point)) continue;
    const copy: V3 = [point[0], point[1], point[2]];
    finite.push(copy);
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
    maxZ = Math.max(maxZ, point[2]);
    maxAbs = Math.max(maxAbs, Math.abs(point[0]), Math.abs(point[1]), Math.abs(point[2]));
  }
  if (finite.length === 0) return emptyHull();

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  const cloudScale = Math.max(spanX, spanY, spanZ);
  const canUseSpan = Number.isFinite(cloudScale) && cloudScale > 0;
  const scale = canUseSpan ? cloudScale : maxAbs > 0 ? maxAbs : 1;
  const normalized: V3[] = [];
  const originals: V3[] = [];
  const buckets = new Map<string, number[]>();

  for (const point of finite) {
    const candidate: V3 = canUseSpan
      ? [(point[0] - minX) / scale, (point[1] - minY) / scale, (point[2] - minZ) / scale]
      : [point[0] / scale - minX / scale, point[1] / scale - minY / scale, point[2] / scale - minZ / scale];
    const gx = Math.floor(candidate[0] / HULL_TOLERANCE);
    const gy = Math.floor(candidate[1] / HULL_TOLERANCE);
    const gz = Math.floor(candidate[2] / HULL_TOLERANCE);
    let duplicate = false;

    for (let dx = -1; dx <= 1 && !duplicate; dx += 1) {
      for (let dy = -1; dy <= 1 && !duplicate; dy += 1) {
        for (let dz = -1; dz <= 1 && !duplicate; dz += 1) {
          const nearby = buckets.get(`${gx + dx}|${gy + dy}|${gz + dz}`);
          if (nearby === undefined) continue;
          for (const index of nearby) {
            const previous = normalized[index];
            if (previous !== undefined && distance(previous, candidate) <= HULL_TOLERANCE) {
              duplicate = true;
              break;
            }
          }
        }
      }
    }

    if (duplicate) continue;
    const index = normalized.length;
    normalized.push(candidate);
    originals.push(point);
    const key = `${gx}|${gy}|${gz}`;
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, [index]);
    else bucket.push(index);
  }

  if (normalized.length === 0) return emptyHull();
  if (normalized.length === 1) return { vertices: [originals[0]!], faces: [] };

  let widestAxis = 0;
  if (spanY > spanX && spanY >= spanZ) widestAxis = 1;
  else if (spanZ > spanX && spanZ > spanY) widestAxis = 2;

  let firstIndex = 0;
  let secondIndex = 0;
  let smallest = Infinity;
  let largest = -Infinity;
  for (let index = 0; index < normalized.length; index += 1) {
    const point = normalized[index]!;
    const value = component(point, widestAxis);
    if (value < smallest) {
      smallest = value;
      firstIndex = index;
    }
    if (value > largest) {
      largest = value;
      secondIndex = index;
    }
  }

  const first = normalized[firstIndex]!;
  const second = normalized[secondIndex]!;
  const baseline = subtract(second, first);
  const baselineLength = magnitude(baseline);
  if (baselineLength <= HULL_TOLERANCE) {
    return { vertices: [originals[firstIndex]!], faces: [] };
  }

  let thirdIndex = -1;
  let greatestLineDistance = -1;
  for (let index = 0; index < normalized.length; index += 1) {
    if (index === firstIndex || index === secondIndex) continue;
    const offset = subtract(normalized[index]!, first);
    const lineDistance = magnitude(cross(baseline, offset)) / baselineLength;
    if (lineDistance > greatestLineDistance) {
      greatestLineDistance = lineDistance;
      thirdIndex = index;
    }
  }

  if (thirdIndex < 0 || greatestLineDistance <= HULL_TOLERANCE) {
    const direction = multiply(baseline, 1 / baselineLength);
    let lowIndex = firstIndex;
    let highIndex = firstIndex;
    let low = Infinity;
    let high = -Infinity;
    for (let index = 0; index < normalized.length; index += 1) {
      const projection = dot(subtract(normalized[index]!, first), direction);
      if (projection < low) {
        low = projection;
        lowIndex = index;
      }
      if (projection > high) {
        high = projection;
        highIndex = index;
      }
    }
    const extremes = lowIndex === highIndex ? [lowIndex] : [lowIndex, highIndex];
    return { vertices: extremes.map((index) => originals[index]!), faces: [] };
  }

  const third = normalized[thirdIndex]!;
  const planeNormal = unit(cross(baseline, subtract(third, first)));
  let fourthIndex = -1;
  let greatestPlaneDistance = -1;
  for (let index = 0; index < normalized.length; index += 1) {
    if (index === firstIndex || index === secondIndex || index === thirdIndex) continue;
    const planeDistance = Math.abs(dot(planeNormal, subtract(normalized[index]!, first)));
    if (planeDistance > greatestPlaneDistance) {
      greatestPlaneDistance = planeDistance;
      fourthIndex = index;
    }
  }

  if (fourthIndex < 0 || greatestPlaneDistance <= HULL_TOLERANCE) {
    let droppedAxis = 0;
    if (Math.abs(planeNormal[1]) > Math.abs(planeNormal[0])) droppedAxis = 1;
    if (Math.abs(planeNormal[2]) > Math.abs(planeNormal[droppedAxis])) droppedAxis = 2;
    const indices = normalized.map((_point, index) => index);
    const extremes = planarExtremeIndices(normalized, indices, droppedAxis, HULL_TOLERANCE);
    return { vertices: extremes.map((index) => originals[index]!), faces: [] };
  }

  const inside: V3 = [
    (first[0] + second[0] + third[0] + normalized[fourthIndex]![0]) / 4,
    (first[1] + second[1] + third[1] + normalized[fourthIndex]![1]) / 4,
    (first[2] + second[2] + third[2] + normalized[fourthIndex]![2]) / 4,
  ];
  const seedIndices = new Set<number>([firstIndex, secondIndex, thirdIndex, fourthIndex]);
  const faces: Face[] = [];
  const initialFaces = [
    makeFace(firstIndex, secondIndex, thirdIndex, normalized, inside),
    makeFace(firstIndex, fourthIndex, secondIndex, normalized, inside),
    makeFace(firstIndex, thirdIndex, fourthIndex, normalized, inside),
    makeFace(secondIndex, fourthIndex, thirdIndex, normalized, inside),
  ];
  for (const face of initialFaces) {
    if (face !== null) faces.push(face);
  }

  for (let index = 0; index < normalized.length; index += 1) {
    if (seedIndices.has(index)) continue;
    const point = normalized[index]!;
    let bestFace: Face | undefined;
    let bestDistance = HULL_TOLERANCE;
    for (const face of faces) {
      const separation = faceDistance(face, normalized, point);
      if (separation > bestDistance) {
        bestDistance = separation;
        bestFace = face;
      }
    }
    if (bestFace !== undefined) bestFace.outside.push(index);
  }

  while (true) {
    let eyeIndex = -1;
    let selectedDistance = HULL_TOLERANCE;
    for (const face of faces) {
      if (!face.alive) continue;
      for (const index of face.outside) {
        const separation = faceDistance(face, normalized, normalized[index]!);
        if (separation > selectedDistance) {
          selectedDistance = separation;
          eyeIndex = index;
        }
      }
    }
    if (eyeIndex < 0) break;

    const eye = normalized[eyeIndex]!;
    const visible: Face[] = [];
    for (const face of faces) {
      if (face.alive && faceDistance(face, normalized, eye) > HULL_TOLERANCE) visible.push(face);
    }
    if (visible.length === 0) break;

    const conflictPoints = new Set<number>();
    const horizon = new Map<string, { a: number; b: number; count: number }>();
    for (const face of visible) {
      for (const index of face.outside) {
        if (index !== eyeIndex) conflictPoints.add(index);
      }
      const edges: [number, number][] = [[face.a, face.b], [face.b, face.c], [face.c, face.a]];
      for (const [a, b] of edges) {
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const edge = horizon.get(key);
        if (edge === undefined) horizon.set(key, { a, b, count: 1 });
        else edge.count += 1;
      }
    }

    const newFaces: Face[] = [];
    for (const edge of horizon.values()) {
      if (edge.count !== 1) continue;
      const face = makeFace(edge.a, edge.b, eyeIndex, normalized, inside);
      if (face !== null) newFaces.push(face);
    }
    if (newFaces.length === 0) break;

    for (const face of visible) {
      face.alive = false;
      face.outside = [];
    }
    faces.push(...newFaces);

    for (const index of conflictPoints) {
      const point = normalized[index]!;
      let bestFace: Face | undefined;
      let bestDistance = HULL_TOLERANCE;
      for (const face of newFaces) {
        const separation = faceDistance(face, normalized, point);
        if (separation > bestDistance) {
          bestDistance = separation;
          bestFace = face;
        }
      }
      if (bestFace !== undefined) bestFace.outside.push(index);
    }
  }

  const activeFaces = faces.filter((face) => face.alive);
  const used = new Set<number>();
  const usedIndices: number[] = [];
  for (const face of activeFaces) {
    for (const index of [face.a, face.b, face.c]) {
      if (!used.has(index)) {
        used.add(index);
        usedIndices.push(index);
      }
    }
  }

  const resultVertices: V3[] = [];
  const remap = new Map<number, number>();
  for (const index of usedIndices) {
    remap.set(index, resultVertices.length);
    resultVertices.push(originals[index]!);
  }

  const resultFaces: [number, number, number][] = [];
  for (const face of activeFaces) {
    const a = remap.get(face.a);
    const b = remap.get(face.b);
    const c = remap.get(face.c);
    if (a !== undefined && b !== undefined && c !== undefined) resultFaces.push([a, b, c]);
  }
  return { vertices: resultVertices, faces: resultFaces };
}

/** Simplify to at most maxVerts vertices: keep the hull of a subset chosen by farthest point sampling (start at the vertex farthest from the centroid). */
export function simplify(h: Hull, maxVerts: number): Hull {
  const count = h.vertices.length;
  if (count === 0) return emptyHull();
  const requested = Number.isFinite(maxVerts)
    ? Math.max(0, Math.floor(maxVerts))
    : maxVerts === Infinity
      ? count
      : 0;
  const limit = Math.min(count, requested);
  if (limit === 0) return emptyHull();
  if (limit >= count) {
    return {
      vertices: h.vertices.map((point) => [point[0], point[1], point[2]]),
      faces: h.faces.map((face): [number, number, number] => [face[0], face[1], face[2]]),
    };
  }

  const centroid: V3 = [0, 0, 0];
  for (const point of h.vertices) {
    centroid[0] += point[0] / count;
    centroid[1] += point[1] / count;
    centroid[2] += point[2] / count;
  }

  let firstIndex = 0;
  let farthestFromCentre = -1;
  for (let index = 0; index < count; index += 1) {
    const point = h.vertices[index]!;
    const distanceFromCentre = distanceSquared(point, centroid);
    if (distanceFromCentre > farthestFromCentre) {
      farthestFromCentre = distanceFromCentre;
      firstIndex = index;
    }
  }

  const selected = [firstIndex];
  const selectedSet = new Set<number>(selected);
  while (selected.length < limit) {
    let bestIndex = -1;
    let bestDistance = -1;
    for (let index = 0; index < count; index += 1) {
      if (selectedSet.has(index)) continue;
      const point = h.vertices[index]!;
      let nearest = Infinity;
      for (const chosenIndex of selected) {
        const chosen = h.vertices[chosenIndex]!;
        nearest = Math.min(nearest, distanceSquared(point, chosen));
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    selected.push(bestIndex);
    selectedSet.add(bestIndex);
  }

  return hull(selected.map((index) => h.vertices[index]!));
}

export function volume(h: Hull): number {
  if (h.faces.length === 0 || h.vertices.length === 0) return 0;
  const reference = h.vertices[0];
  if (reference === undefined) return 0;
  let sixTimesVolume = 0;
  for (const face of h.faces) {
    const a = h.vertices[face[0]];
    const b = h.vertices[face[1]];
    const c = h.vertices[face[2]];
    if (a === undefined || b === undefined || c === undefined) continue;
    sixTimesVolume += dot(subtract(a, reference), cross(subtract(b, reference), subtract(c, reference)));
  }
  return Math.abs(sixTimesVolume / 6);
}

function pointSegmentDistance(point: V3, start: V3, end: V3): number {
  const segment = subtract(end, start);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared === 0) return distance(point, start);
  const amount = Math.max(0, Math.min(1, dot(subtract(point, start), segment) / lengthSquared));
  return distance(point, add(start, multiply(segment, amount)));
}

function containsDegenerate(vertices: readonly V3[], point: V3, tolerance: number): boolean {
  if (vertices.length === 0) return false;
  const origin = vertices[0]!;
  if (vertices.length === 1) return distance(point, origin) <= tolerance;

  let farthestIndex = 1;
  let longest = distance(origin, vertices[1]!);
  for (let index = 2; index < vertices.length; index += 1) {
    const candidateLength = distance(origin, vertices[index]!);
    if (candidateLength > longest) {
      longest = candidateLength;
      farthestIndex = index;
    }
  }
  const end = vertices[farthestIndex]!;
  if (vertices.length === 2) return pointSegmentDistance(point, origin, end) <= tolerance;
  if (longest <= tolerance) return distance(point, origin) <= tolerance;

  let normal: V3 = [0, 0, 0];
  let greatestLineDistance = 0;
  const baseline = subtract(end, origin);
  for (let index = 1; index < vertices.length; index += 1) {
    const candidateNormal = cross(baseline, subtract(vertices[index]!, origin));
    const candidateDistance = magnitude(candidateNormal) / longest;
    if (candidateDistance > greatestLineDistance) {
      greatestLineDistance = candidateDistance;
      normal = candidateNormal;
    }
  }

  if (greatestLineDistance <= tolerance) return pointSegmentDistance(point, origin, end) <= tolerance;
  normal = unit(normal);
  if (Math.abs(dot(normal, subtract(point, origin))) > tolerance) return false;

  let droppedAxis = 0;
  if (Math.abs(normal[1]) > Math.abs(normal[0])) droppedAxis = 1;
  if (Math.abs(normal[2]) > Math.abs(normal[droppedAxis])) droppedAxis = 2;
  const [pointU, pointV] = projectedCoordinates(point, droppedAxis);
  let positive = false;
  let negative = false;

  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index]!;
    const finish = vertices[(index + 1) % vertices.length]!;
    const [startU, startV] = projectedCoordinates(start, droppedAxis);
    const [finishU, finishV] = projectedCoordinates(finish, droppedAxis);
    const side = (finishU - startU) * (pointV - startV) - (finishV - startV) * (pointU - startU);
    const edgeTolerance = tolerance * Math.hypot(finishU - startU, finishV - startV);
    if (side > edgeTolerance) positive = true;
    if (side < -edgeTolerance) negative = true;
    if (positive && negative) return false;
  }
  return true;
}

export function contains(h: Hull, point: V3, eps = 1e-9): boolean {
  if (!finitePoint(point)) return false;
  const tolerance = Number.isFinite(eps) ? Math.max(0, eps) : 1e-9;
  let usableFaces = 0;
  for (const face of h.faces) {
    const a = h.vertices[face[0]];
    const b = h.vertices[face[1]];
    const c = h.vertices[face[2]];
    if (a === undefined || b === undefined || c === undefined) continue;
    const normal = cross(subtract(b, a), subtract(c, a));
    const length = magnitude(normal);
    if (length === 0) continue;
    usableFaces += 1;
    const signedDistance = dot(normal, subtract(point, a)) / length;
    if (signedDistance > tolerance) return false;
  }
  if (usableFaces > 0) return true;
  return containsDegenerate(h.vertices, point, tolerance);
}

function identityAxes(): [V3, V3, V3] {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
}

export function aabb(points: readonly V3[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let found = false;

  for (const point of points) {
    if (!finitePoint(point)) continue;
    found = true;
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
    maxZ = Math.max(maxZ, point[2]);
  }

  if (!found) return { centre: [0, 0, 0], half: [0, 0, 0], axes: identityAxes() };
  return {
    centre: [minX + (maxX - minX) / 2, minY + (maxY - minY) / 2, minZ + (maxZ - minZ) / 2],
    half: [(maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2],
    axes: identityAxes(),
  };
}

function readMatrix(matrix: Matrix3, row: number, column: number): number {
  const values = matrix[row];
  if (values === undefined) return 0;
  const value = values[column];
  return value === undefined ? 0 : value;
}

function writeMatrix(matrix: Matrix3, row: number, column: number, value: number): void {
  const values = matrix[row];
  if (values === undefined) return;
  if (column === 0) values[0] = value;
  else if (column === 1) values[1] = value;
  else if (column === 2) values[2] = value;
}

function canonicalAxis(axis: V3): V3 {
  const result = unit(axis);
  let dominant = 0;
  if (Math.abs(result[1]) > Math.abs(result[0])) dominant = 1;
  if (Math.abs(result[2]) > Math.abs(result[dominant])) dominant = 2;
  return result[dominant] < 0 ? multiply(result, -1) : result;
}

export function obb(points: readonly V3[]): Box {
  const samples = points.filter(finitePoint);
  if (samples.length === 0) return { centre: [0, 0, 0], half: [0, 0, 0], axes: identityAxes() };

  const mean: V3 = [0, 0, 0];
  for (const point of samples) {
    mean[0] += point[0] / samples.length;
    mean[1] += point[1] / samples.length;
    mean[2] += point[2] / samples.length;
  }

  const covariance: Matrix3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const point of samples) {
    const offset = subtract(point, mean);
    covariance[0][0] += offset[0] * offset[0];
    covariance[0][1] += offset[0] * offset[1];
    covariance[0][2] += offset[0] * offset[2];
    covariance[1][1] += offset[1] * offset[1];
    covariance[1][2] += offset[1] * offset[2];
    covariance[2][2] += offset[2] * offset[2];
  }
  covariance[1][0] = covariance[0][1];
  covariance[2][0] = covariance[0][2];
  covariance[2][1] = covariance[1][2];

  const eigenvectors: Matrix3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 40; iteration += 1) {
    let p = 0;
    let q = 1;
    let largestOffDiagonal = Math.abs(readMatrix(covariance, 0, 1));
    const off02 = Math.abs(readMatrix(covariance, 0, 2));
    const off12 = Math.abs(readMatrix(covariance, 1, 2));
    if (off02 > largestOffDiagonal) {
      p = 0;
      q = 2;
      largestOffDiagonal = off02;
    }
    if (off12 > largestOffDiagonal) {
      p = 1;
      q = 2;
      largestOffDiagonal = off12;
    }
    const matrixScale = Math.max(
      Math.abs(readMatrix(covariance, 0, 0)),
      Math.abs(readMatrix(covariance, 1, 1)),
      Math.abs(readMatrix(covariance, 2, 2)),
      largestOffDiagonal,
    );
    if (largestOffDiagonal <= Number.EPSILON * matrixScale * 8) break;

    const app = readMatrix(covariance, p, p);
    const aqq = readMatrix(covariance, q, q);
    const apq = readMatrix(covariance, p, q);
    const tau = (aqq - app) / (2 * apq);
    const tangent = tau === 0
      ? 1
      : (tau > 0 ? 1 : -1) / (Math.abs(tau) + Math.hypot(1, tau));
    const cosine = 1 / Math.sqrt(1 + tangent * tangent);
    const sine = tangent * cosine;

    writeMatrix(covariance, p, p, app - tangent * apq);
    writeMatrix(covariance, q, q, aqq + tangent * apq);
    writeMatrix(covariance, p, q, 0);
    writeMatrix(covariance, q, p, 0);

    for (let index = 0; index < 3; index += 1) {
      if (index === p || index === q) continue;
      const aip = readMatrix(covariance, index, p);
      const aiq = readMatrix(covariance, index, q);
      const newAip = cosine * aip - sine * aiq;
      const newAiq = sine * aip + cosine * aiq;
      writeMatrix(covariance, index, p, newAip);
      writeMatrix(covariance, p, index, newAip);
      writeMatrix(covariance, index, q, newAiq);
      writeMatrix(covariance, q, index, newAiq);

      const vip = readMatrix(eigenvectors, index, p);
      const viq = readMatrix(eigenvectors, index, q);
      writeMatrix(eigenvectors, index, p, cosine * vip - sine * viq);
      writeMatrix(eigenvectors, index, q, sine * vip + cosine * viq);
    }
  }

  const eigenaxes = [
    {
      value: readMatrix(covariance, 0, 0),
      axis: [readMatrix(eigenvectors, 0, 0), readMatrix(eigenvectors, 1, 0), readMatrix(eigenvectors, 2, 0)] as V3,
    },
    {
      value: readMatrix(covariance, 1, 1),
      axis: [readMatrix(eigenvectors, 0, 1), readMatrix(eigenvectors, 1, 1), readMatrix(eigenvectors, 2, 1)] as V3,
    },
    {
      value: readMatrix(covariance, 2, 2),
      axis: [readMatrix(eigenvectors, 0, 2), readMatrix(eigenvectors, 1, 2), readMatrix(eigenvectors, 2, 2)] as V3,
    },
  ];
  eigenaxes.sort((a, b) => b.value - a.value);
  const axes: [V3, V3, V3] = [
    canonicalAxis(eigenaxes[0]!.axis),
    canonicalAxis(eigenaxes[1]!.axis),
    canonicalAxis(eigenaxes[2]!.axis),
  ];
  if (dot(cross(axes[0], axes[1]), axes[2]) < 0) axes[2] = multiply(axes[2], -1);

  const minimum: V3 = [Infinity, Infinity, Infinity];
  const maximum: V3 = [-Infinity, -Infinity, -Infinity];
  for (const point of samples) {
    const offset = subtract(point, mean);
    for (let axis = 0; axis < 3; axis += 1) {
      const projection = dot(offset, axes[axis]!);
      minimum[axis] = Math.min(minimum[axis], projection);
      maximum[axis] = Math.max(maximum[axis], projection);
    }
  }

  const midpoint: V3 = [
    (minimum[0] + maximum[0]) / 2,
    (minimum[1] + maximum[1]) / 2,
    (minimum[2] + maximum[2]) / 2,
  ];
  const centre = add(mean, add(add(multiply(axes[0], midpoint[0]), multiply(axes[1], midpoint[1])), multiply(axes[2], midpoint[2])));
  return {
    centre,
    half: [
      (maximum[0] - minimum[0]) / 2,
      (maximum[1] - minimum[1]) / 2,
      (maximum[2] - minimum[2]) / 2,
    ],
    axes,
  };
}

function boxVolume(box: CellBox): number {
  return (box.max[0] - box.min[0]) * (box.max[1] - box.min[1]) * (box.max[2] - box.min[2]);
}

function mergeCellBoxes(a: CellBox, b: CellBox): CellBox {
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };
}

function overlapVolume(a: CellBox, b: CellBox): number {
  const x = Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]));
  const y = Math.max(0, Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]));
  const z = Math.max(0, Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]));
  return x * y * z;
}

/** Split a voxel model into greedy cell-space boxes, merging the smallest boxes when the limit is exceeded. */
export function voxelBoxes(
  cells: Uint8Array,
  sx: number,
  sy: number,
  sz: number,
  maxBoxes: number,
): { min: V3; max: V3 }[] {
  const width = Math.floor(sx);
  const height = Math.floor(sy);
  const depth = Math.floor(sz);
  if (width <= 0 || height <= 0 || depth <= 0 || cells.length === 0) return [];

  const planeSize = width * height;
  const expectedSize = planeSize * depth;
  if (!Number.isFinite(planeSize) || !Number.isFinite(expectedSize)) return [];
  const scanLength = Math.min(cells.length, expectedSize);
  const visited = new Uint8Array(scanLength);
  const boxes: CellBox[] = [];
  const isAvailable = (index: number): boolean => {
    if (index < 0 || index >= scanLength) return false;
    const value = cells[index];
    return value !== undefined && value > 0 && visited[index] === 0;
  };

  for (let index = 0; index < scanLength; index += 1) {
    if (!isAvailable(index)) continue;
    const z = Math.floor(index / planeSize);
    const remainder = index - z * planeSize;
    const y = Math.floor(remainder / width);
    const x = remainder - y * width;

    let xEnd = x + 1;
    while (xEnd < width && isAvailable(index + xEnd - x)) xEnd += 1;

    let yEnd = y + 1;
    while (yEnd < height) {
      const rowStart = index + (yEnd - y) * width;
      let fullRow = true;
      for (let currentX = x; currentX < xEnd; currentX += 1) {
        if (!isAvailable(rowStart + currentX - x)) {
          fullRow = false;
          break;
        }
      }
      if (!fullRow) break;
      yEnd += 1;
    }

    let zEnd = z + 1;
    while (zEnd < depth) {
      const layerStart = index + (zEnd - z) * planeSize;
      let fullLayer = true;
      for (let currentY = y; currentY < yEnd && fullLayer; currentY += 1) {
        for (let currentX = x; currentX < xEnd; currentX += 1) {
          const cellIndex = layerStart + (currentY - y) * width + currentX - x;
          if (!isAvailable(cellIndex)) {
            fullLayer = false;
            break;
          }
        }
      }
      if (!fullLayer) break;
      zEnd += 1;
    }

    for (let currentZ = z; currentZ < zEnd; currentZ += 1) {
      for (let currentY = y; currentY < yEnd; currentY += 1) {
        for (let currentX = x; currentX < xEnd; currentX += 1) {
          const cellIndex = index
            + (currentZ - z) * planeSize
            + (currentY - y) * width
            + currentX - x;
          if (cellIndex >= 0 && cellIndex < scanLength) visited[cellIndex] = 1;
        }
      }
    }
    boxes.push({ min: [x, y, z], max: [xEnd, yEnd, zEnd] });
  }

  const requested = Number.isFinite(maxBoxes)
    ? Math.max(1, Math.floor(maxBoxes))
    : maxBoxes === Infinity
      ? Infinity
      : 1;

  while (boxes.length > requested) {
    let smallestIndex = 0;
    let smallestVolume = boxVolume(boxes[0]!);
    for (let index = 1; index < boxes.length; index += 1) {
      const volume = boxVolume(boxes[index]!);
      if (volume < smallestVolume) {
        smallestVolume = volume;
        smallestIndex = index;
      }
    }

    const smallest = boxes[smallestIndex]!;
    let neighbourIndex = -1;
    let leastEmptySpace = Infinity;
    let leastMergedVolume = Infinity;
    for (let index = 0; index < boxes.length; index += 1) {
      if (index === smallestIndex) continue;
      const neighbour = boxes[index]!;
      const merged = mergeCellBoxes(smallest, neighbour);
      const mergedVolume = boxVolume(merged);
      const emptySpace = Math.max(
        0,
        mergedVolume - boxVolume(smallest) - boxVolume(neighbour) + overlapVolume(smallest, neighbour),
      );
      if (emptySpace < leastEmptySpace || (emptySpace === leastEmptySpace && mergedVolume < leastMergedVolume)) {
        leastEmptySpace = emptySpace;
        leastMergedVolume = mergedVolume;
        neighbourIndex = index;
      }
    }

    if (neighbourIndex < 0) break;
    const merged = mergeCellBoxes(smallest, boxes[neighbourIndex]!);
    const highIndex = Math.max(smallestIndex, neighbourIndex);
    const lowIndex = Math.min(smallestIndex, neighbourIndex);
    boxes.splice(highIndex, 1);
    boxes.splice(lowIndex, 1);
    boxes.push(merged);
  }

  boxes.sort((a, b) => boxVolume(b) - boxVolume(a));
  return boxes;
}