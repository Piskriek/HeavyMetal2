import * as THREE from 'three';

export type Species = 'pine' | 'oak' | 'birch';

export interface TreeOptions {
  readonly species: Species;
  readonly seed: number;
  readonly height: number;
  readonly detail: 0 | 1 | 2 | 3;
}

export interface Branch {
  readonly id: number;
  readonly parent: number | null;
  readonly start: readonly [number, number, number];
  readonly end: readonly [number, number, number];
  readonly r0: number;
  readonly r1: number;
}

export interface Tree {
  readonly species: Species;
  readonly branches: readonly Branch[];
  readonly bark: THREE.BufferGeometry;
  readonly leaves: THREE.BufferGeometry;
  readonly height: number;
  readonly radius: number;
  readonly triangles: number;
}

export const BUDGET: readonly [number, number, number, number] = [400, 2000, 8000, 24000];

type Vec3 = readonly [number, number, number];
type UV = readonly [number, number];

interface MutableBranch {
  readonly id: number;
  readonly parent: number | null;
  readonly start: Vec3;
  readonly end: Vec3;
  readonly order: number;
  readonly mainLimb: number;
  readonly growthStep: number;
  readonly primary: boolean;
  readonly r0: number;
  readonly r1: number;
}

interface Tip {
  readonly branch: number;
  readonly order: number;
  readonly mainLimb: number;
  readonly growthStep: number;
  readonly direction: Vec3;
  readonly radial: Vec3;
}

interface Attraction {
  readonly point: Vec3;
  active: boolean;
}

interface SpeciesShape {
  readonly trunkHeight: number;
  readonly trunkSegments: number;
  readonly crownBottom: number;
  readonly crownTop: number;
  readonly crownRadius: number;
  readonly trunkRadius: number;
  readonly whorls: readonly number[];
  readonly branchesPerWhorl: number;
  readonly initialLength: number;
  readonly stepLength: number;
  readonly upwardBias: number;
  readonly leafWidth: number;
  readonly leafHeight: number;
  readonly attractionCount: number;
  readonly influenceRadius: number;
  readonly killRadius: number;
}

interface RadiusInfo {
  readonly r0: number;
  readonly r1: number;
}

const MAX_BRANCHES = 420;
const MAX_ITERATIONS = 34;

function speciesShape(species: Species, height: number): SpeciesShape {
  if (species === 'pine') {
    return {
      trunkHeight: height * 0.985,
      trunkSegments: 15,
      crownBottom: height * 0.29,
      crownTop: height * 0.985,
      crownRadius: height * 0.235,
      trunkRadius: height * 0.047,
      whorls: [0.34, 0.45, 0.56, 0.67, 0.78, 0.88],
      branchesPerWhorl: 5,
      initialLength: height * 0.052,
      stepLength: height * 0.038,
      upwardBias: 0.075,
      leafWidth: height * 0.022,
      leafHeight: height * 0.062,
      attractionCount: 290,
      influenceRadius: height * 0.28,
      killRadius: height * 0.055,
    };
  }

  if (species === 'oak') {
    return {
      trunkHeight: height * 0.59,
      trunkSegments: 10,
      crownBottom: height * 0.31,
      crownTop: height * 0.94,
      crownRadius: height * 0.385,
      trunkRadius: height * 0.073,
      whorls: [0.34, 0.41, 0.48, 0.55],
      branchesPerWhorl: 6,
      initialLength: height * 0.092,
      stepLength: height * 0.048,
      upwardBias: 0.11,
      leafWidth: height * 0.053,
      leafHeight: height * 0.061,
      attractionCount: 360,
      influenceRadius: height * 0.36,
      killRadius: height * 0.062,
    };
  }

  return {
    trunkHeight: height * 0.915,
    trunkSegments: 17,
    crownBottom: height * 0.23,
    crownTop: height * 0.985,
    crownRadius: height * 0.225,
    trunkRadius: height * 0.034,
    whorls: [0.33, 0.45, 0.57, 0.69, 0.8],
    branchesPerWhorl: 4,
    initialLength: height * 0.054,
    stepLength: height * 0.034,
    upwardBias: 0.12,
    leafWidth: height * 0.019,
    leafHeight: height * 0.056,
    attractionCount: 280,
    influenceRadius: height * 0.27,
    killRadius: height * 0.05,
  };
}

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function multiply(a: Vec3, scalar: number): Vec3 {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize(a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 {
  const magnitude = length(a);
  if (magnitude < 1e-12) return fallback;
  return [a[0] / magnitude, a[1] / magnitude, a[2] / magnitude];
}

function distanceSquared(a: Vec3, b: Vec3): number {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return x * x + y * y + z * z;
}

function crownRadiusAt(species: Species, shape: SpeciesShape, y: number): number {
  const position = Math.min(1, Math.max(0, (y - shape.crownBottom) / (shape.crownTop - shape.crownBottom)));
  if (species === 'pine') {
    return shape.crownRadius * Math.max(0.035, Math.pow(1 - position, 0.92));
  }
  if (species === 'oak') {
    const centred = (position - 0.52) / 0.51;
    return shape.crownRadius * Math.pow(Math.max(0, Math.cos(centred * Math.PI * 0.5)), 0.82);
  }
  const centre = (shape.crownBottom + shape.crownTop) * 0.5;
  const half = (shape.crownTop - shape.crownBottom) * 0.5;
  const normalizedY = (y - centre) / half;
  return shape.crownRadius * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
}

function makeAttractions(
  species: Species,
  shape: SpeciesShape,
  random: () => number,
): Attraction[] {
  const attractions: Attraction[] = [];
  for (let index = 0; index < shape.attractionCount; index += 1) {
    const y = shape.crownBottom + random() * (shape.crownTop - shape.crownBottom);
    const radius = crownRadiusAt(species, shape, y) * Math.sqrt(random());
    const angle = random() * Math.PI * 2;
    const bias = species === 'oak' ? Math.sin(y * 0.31) * shape.crownRadius * 0.06 : 0;
    attractions.push({
      point: [Math.cos(angle) * radius + bias, y, Math.sin(angle) * radius],
      active: true,
    });
  }
  return attractions;
}

function newBranch(
  branches: MutableBranch[],
  parent: number | null,
  end: Vec3,
  order: number,
  mainLimb: number,
  growthStep: number,
  primary: boolean,
): MutableBranch {
  const start = parent === null
    ? [0, 0, 0] as const
    : branches[parent]?.end;
  if (start === undefined) throw new Error('A branch must follow an existing parent segment.');

  const branch: MutableBranch = {
    id: branches.length,
    parent,
    start,
    end,
    order,
    mainLimb,
    growthStep,
    primary,
    r0: 0,
    r1: 0,
  };
  branches.push(branch);
  return branch;
}

function trunkOffset(species: Species, height: number, index: number, random: () => number): Vec3 {
  if (index === 0 || species === 'pine') return [0, 0, 0];
  const amount = species === 'oak' ? height * 0.012 : height * 0.006;
  const progress = index / (species === 'oak' ? 10 : 17);
  const x = Math.sin(index * 1.7) * amount * progress + (random() - 0.5) * amount * 0.35;
  const z = Math.cos(index * 1.23) * amount * progress + (random() - 0.5) * amount * 0.35;
  return [x, 0, z];
}

function nearestTrunkNode(branches: readonly MutableBranch[], trunkCount: number, y: number): number {
  let nearest = 0;
  let delta = Infinity;
  for (let index = 0; index < trunkCount; index += 1) {
    const branch = branches[index];
    if (branch === undefined) continue;
    const nextDelta = Math.abs(branch.end[1] - y);
    if (nextDelta < delta) {
      nearest = branch.id;
      delta = nextDelta;
    }
  }
  return nearest;
}

function initialBranches(
  species: Species,
  height: number,
  shape: SpeciesShape,
  branches: MutableBranch[],
  random: () => number,
): Tip[] {
  const trunkCount = branches.length;
  const tips: Tip[] = [];
  const phase = random() * Math.PI * 2;

  for (let layer = 0; layer < shape.whorls.length; layer += 1) {
    const level = shape.whorls[layer];
    if (level === undefined) continue;
    const count = shape.branchesPerWhorl + (species === 'oak' && layer % 2 === 1 ? 1 : 0);
    const anchor = nearestTrunkNode(branches, trunkCount, level * height);
    for (let index = 0; index < count; index += 1) {
      if (branches.length >= MAX_BRANCHES) break;
      const angle = phase + (index * Math.PI * 2) / count + (random() - 0.5) * 0.16;
      const radial: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
      const slope = species === 'pine'
        ? 0.02 + random() * 0.055
        : species === 'oak'
          ? 0.3 + random() * 0.31
          : 0.15 + random() * 0.24;
      const direction = normalize([radial[0], slope, radial[2]]);
      const limbLength = shape.initialLength * (species === 'oak' ? 1.2 : 1);
      const parentEnd = branches[anchor]?.end;
      if (parentEnd === undefined) continue;
      const firstEnd = add(parentEnd, multiply(direction, limbLength));
      const branch = newBranch(branches, anchor, firstEnd, 1, -1, 0, true);
      const rooted: MutableBranch = { ...branch, mainLimb: branch.id };
      branches[branch.id] = rooted;
      tips.push({
        branch: branch.id,
        order: 1,
        mainLimb: branch.id,
        growthStep: 0,
        direction,
        radial,
      });
    }
  }

  if (species === 'oak' && branches.length < MAX_BRANCHES) {
    const top = branches[trunkCount - 1];
    if (top !== undefined) {
      const leaderEnd: Vec3 = [top.end[0] + height * 0.018, height * 0.88, top.end[2] - height * 0.014];
      const leader = newBranch(branches, top.id, leaderEnd, 1, -1, 0, true);
      branches[leader.id] = { ...leader, mainLimb: leader.id };
      tips.push({
        branch: leader.id,
        order: 1,
        mainLimb: leader.id,
        growthStep: 0,
        direction: normalize(subtract(leaderEnd, top.end)),
        radial: normalize([leaderEnd[0], 0, leaderEnd[2]], [1, 0, 0]),
      });
    }
  }

  return tips;
}

function averageDirection(points: readonly Vec3[], origin: Vec3, fallback: Vec3): Vec3 {
  let total: Vec3 = [0, 0, 0];
  for (const point of points) total = add(total, normalize(subtract(point, origin), fallback));
  return normalize(total, fallback);
}

function growBranches(
  species: Species,
  shape: SpeciesShape,
  branches: MutableBranch[],
  attractions: Attraction[],
  tips: Tip[],
  random: () => number,
): void {
  const influenceSquared = shape.influenceRadius * shape.influenceRadius;
  const killSquared = shape.killRadius * shape.killRadius;

  for (let iteration = 0; iteration < MAX_ITERATIONS && tips.length > 0 && branches.length < MAX_BRANCHES; iteration += 1) {
    const assignments: Vec3[][] = Array.from({ length: tips.length }, () => []);
    for (const attraction of attractions) {
      if (!attraction.active) continue;

      let nearestTip = -1;
      let nearestSquared = Infinity;
      for (let tipIndex = 0; tipIndex < tips.length; tipIndex += 1) {
        const tip = tips[tipIndex];
        if (tip === undefined) continue;
        const branch = branches[tip.branch];
        if (branch === undefined) continue;
        const squared = distanceSquared(attraction.point, branch.end);
        if (squared < nearestSquared) {
          nearestSquared = squared;
          nearestTip = tipIndex;
        }
      }

      if (nearestTip >= 0 && nearestSquared <= killSquared) {
        attraction.active = false;
        continue;
      }
      if (nearestTip >= 0 && nearestSquared <= influenceSquared) {
        assignments[nearestTip]?.push(attraction.point);
      }
    }

    const nextTips: Tip[] = [];
    for (let tipIndex = 0; tipIndex < tips.length; tipIndex += 1) {
      if (branches.length >= MAX_BRANCHES) break;
      const tip = tips[tipIndex];
      const assigned = assignments[tipIndex];
      if (tip === undefined || assigned === undefined || assigned.length === 0) continue;

      const parent = branches[tip.branch];
      if (parent === undefined) continue;
      const directions = assigned.map((point) => normalize(subtract(point, parent.end), tip.direction));
      const pull = averageDirection(assigned, parent.end, tip.direction);
      const verticalBias = species === 'birch' && tip.order >= 2
        ? -0.13
        : shape.upwardBias * (tip.order <= 1 ? 1 : 0.72);
      const crookedness = species === 'oak' ? 0.14 : species === 'birch' ? 0.07 : 0.035;
      const jitter: Vec3 = [
        (random() - 0.5) * crookedness,
        (random() - 0.5) * crookedness * 0.6,
        (random() - 0.5) * crookedness,
      ];
      const mainDirection = normalize(
        add(add(pull, multiply(tip.direction, 0.13)), add(multiply(tip.radial, species === 'pine' ? 0.11 : 0.04), add([0, verticalBias, 0], jitter))),
        tip.direction,
      );
      const stepScale = Math.max(0.58, 1 - Math.max(0, tip.order - 1) * 0.12);
      const stepLength = shape.stepLength * stepScale;
      const mainEnd = add(parent.end, multiply(mainDirection, stepLength));
      const main = newBranch(
        branches,
        parent.id,
        mainEnd,
        tip.order,
        tip.mainLimb,
        tip.growthStep + 1,
        false,
      );
      nextTips.push({
        branch: main.id,
        order: tip.order,
        mainLimb: tip.mainLimb,
        growthStep: tip.growthStep + 1,
        direction: mainDirection,
        radial: tip.radial,
      });

      if (
        branches.length < MAX_BRANCHES &&
        tip.order < 4 &&
        tip.growthStep >= 2 &&
        tip.growthStep % 4 === 2 &&
        assigned.length >= 8 &&
        random() < 0.52
      ) {
        const alternatePoints: Vec3[] = [];
        for (let index = 0; index < directions.length; index += 1) {
          const direction = directions[index];
          const point = assigned[index];
          if (direction !== undefined && point !== undefined && dot(direction, mainDirection) < 0.56) {
            alternatePoints.push(point);
          }
        }
        if (alternatePoints.length >= 3 && alternatePoints.length < assigned.length - 2) {
          const alternatePull = averageDirection(alternatePoints, parent.end, tip.direction);
          const forkDirection = normalize(
            add(alternatePull, add(multiply(tip.radial, 0.06), [0, verticalBias * 0.8, 0])),
            alternatePull,
          );
          const forkEnd = add(parent.end, multiply(forkDirection, stepLength * 0.88));
          const fork = newBranch(
            branches,
            parent.id,
            forkEnd,
            tip.order + 1,
            tip.mainLimb,
            tip.growthStep + 1,
            false,
          );
          nextTips.push({
            branch: fork.id,
            order: tip.order + 1,
            mainLimb: tip.mainLimb,
            growthStep: tip.growthStep + 1,
            direction: forkDirection,
            radial: tip.radial,
          });
        }
      }
    }
    tips = nextTips;
  }
}

function assignPipeRadii(branches: readonly MutableBranch[], baseRadius: number): MutableBranch[] {
  const children: number[][] = Array.from({ length: branches.length }, () => []);
  for (const branch of branches) {
    if (branch.parent !== null) children[branch.parent]?.push(branch.id);
  }

  const foliageWeight = new Array<number>(branches.length).fill(0);
  for (let index = branches.length - 1; index >= 0; index -= 1) {
    const branchChildren = children[index] ?? [];
    let weight = 0;
    for (const child of branchChildren) weight += foliageWeight[child] ?? 0;
    foliageWeight[index] = branchChildren.length === 0 ? 1 : weight;
  }
  const total = foliageWeight[0] ?? 1;
  const radii: RadiusInfo[] = branches.map((_branch, index) => {
    const weight = foliageWeight[index] ?? 1;
    return { r0: baseRadius * Math.sqrt(weight / total), r1: 0 };
  });

  return branches.map((branch, index) => {
    const childIds = children[index] ?? [];
    const r0 = radii[index]?.r0 ?? baseRadius * 0.01;
    let r1 = r0 * 0.62;
    if (childIds.length > 0) {
      let area = 0;
      for (const child of childIds) {
        const childRadius = radii[child]?.r0 ?? 0;
        area += childRadius * childRadius;
      }
      r1 = Math.min(r0, Math.sqrt(area));
    }
    return { ...branch, r0, r1 };
  });
}

function unitNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize(cross(subtract(b, a), subtract(c, a)));
}

class GeometryBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];

  addTriangle(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    uvA: UV,
    uvB: UV,
    uvC: UV,
    smoothNormals?: readonly [Vec3, Vec3, Vec3],
  ): void {
    const faceNormal = unitNormal(a, b, c);
    const vertices: readonly [Vec3, Vec3, Vec3] = [a, b, c];
    const uvs: readonly [UV, UV, UV] = [uvA, uvB, uvC];
    for (let index = 0; index < 3; index += 1) {
      const vertex = vertices[index];
      const uv = uvs[index];
      const normal = smoothNormals?.[index] ?? faceNormal;
      if (vertex === undefined || uv === undefined) continue;
      this.positions.push(vertex[0], vertex[1], vertex[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.uvs.push(uv[0], uv[1]);
    }
  }

  addTube(start: Vec3, end: Vec3, r0: number, r1: number, sides: number, flat: boolean): void {
    const axisVector = subtract(end, start);
    const span = length(axisVector);
    if (span < 1e-8 || r0 <= 0 || r1 <= 0) return;
    const axis = normalize(axisVector);
    const reference: Vec3 = Math.abs(axis[1]) < 0.88 ? [0, 1, 0] : [1, 0, 0];
    const around = normalize(cross(axis, reference), [1, 0, 0]);
    const across = normalize(cross(axis, around), [0, 0, 1]);
    const slope = (r0 - r1) / span;

    for (let side = 0; side < sides; side += 1) {
      const angle0 = (side * Math.PI * 2) / sides;
      const angle1 = ((side + 1) * Math.PI * 2) / sides;
      const u0 = side / sides;
      const u1 = (side + 1) / sides;
      const radial0 = normalize(add(multiply(around, Math.cos(angle0)), multiply(across, Math.sin(angle0))));
      const radial1 = normalize(add(multiply(around, Math.cos(angle1)), multiply(across, Math.sin(angle1))));
      const start0 = add(start, multiply(radial0, r0));
      const start1 = add(start, multiply(radial1, r0));
      const end0 = add(end, multiply(radial0, r1));
      const end1 = add(end, multiply(radial1, r1));
      const normal0 = normalize(add(radial0, multiply(axis, slope)));
      const normal1 = normalize(add(radial1, multiply(axis, slope)));

      this.addTriangle(start0, start1, end1, [u0, 0], [u1, 0], [u1, span], flat ? undefined : [normal0, normal1, normal1]);
      this.addTriangle(start0, end1, end0, [u0, 0], [u1, span], [u0, span], flat ? undefined : [normal0, normal1, normal0]);
    }
  }

  addCard(center: Vec3, normal: Vec3, width: number, height: number, twist: number): void {
    const worldUp: Vec3 = [0, 1, 0];
    const baseRight = normalize(cross(worldUp, normal), [1, 0, 0]);
    const baseUp = normalize(cross(normal, baseRight), worldUp);
    const right = normalize(add(multiply(baseRight, Math.cos(twist)), multiply(baseUp, Math.sin(twist))));
    const up = normalize(cross(normal, right), worldUp);
    const halfRight = multiply(right, width * 0.5);
    const halfUp = multiply(up, height * 0.5);
    const bottomLeft = subtract(subtract(center, halfRight), halfUp);
    const bottomRight = add(subtract(center, halfUp), halfRight);
    const topRight = add(add(center, halfRight), halfUp);
    const topLeft = add(subtract(center, halfRight), halfUp);

    this.addTriangle(bottomLeft, bottomRight, topRight, [0, 0], [1, 0], [1, 1], [normal, normal, normal]);
    this.addTriangle(bottomLeft, topRight, topLeft, [0, 0], [1, 1], [0, 1], [normal, normal, normal]);
  }

  addBlob(center: Vec3, rx: number, ry: number, rz: number, rotation: number): void {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const radial = (x: number, z: number): Vec3 => [
      center[0] + x * cosine - z * sine,
      center[1],
      center[2] + x * sine + z * cosine,
    ];
    const top: Vec3 = [center[0], center[1] + ry, center[2]];
    const bottom: Vec3 = [center[0], center[1] - ry, center[2]];
    const east = radial(rx, 0);
    const west = radial(-rx, 0);
    const north = radial(0, rz);
    const south = radial(0, -rz);
    const uv: UV = [0.5, 0.5];
    const faces: readonly (readonly [Vec3, Vec3, Vec3])[] = [
      [top, north, east], [top, west, north], [top, south, west], [top, east, south],
      [bottom, east, north], [bottom, north, west], [bottom, west, south], [bottom, south, east],
    ];
    for (const face of faces) this.addTriangle(face[0], face[1], face[2], uv, uv, uv);
  }

  build(stableName: string): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.name = stableName;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.uuid = geometryKey(this.positions, stableName);
    return geometry;
  }
}

function geometryKey(positions: readonly number[], name: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < name.length; index += 1) {
    first = Math.imul(first ^ name.charCodeAt(index), 0x01000193);
    second = Math.imul(second ^ name.charCodeAt(index), 0x85ebca6b);
  }
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index] ?? 0;
    const value = Math.round(position * 100000);
    first = Math.imul(first ^ value, 0x01000193);
    second = Math.imul(second ^ (value + index), 0x85ebca6b);
  }
  const a = (first >>> 0).toString(16).padStart(8, '0');
  const b = (second >>> 0).toString(16).padStart(8, '0');
  return `${a}-${b.slice(0, 4)}-4${b.slice(4, 7)}-a${a.slice(1, 4)}-${a.slice(4)}${b}`;
}

function treeMetrics(bark: THREE.BufferGeometry, leaves: THREE.BufferGeometry): { readonly height: number; readonly radius: number } {
  let highest = -Infinity;
  let radius = 0;
  for (const geometry of [bark, leaves]) {
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      if (y > highest) highest = y;
      const radial = Math.hypot(x, z);
      if (radial > radius) radius = radial;
    }
  }
  return { height: Number.isFinite(highest) ? highest : 0, radius };
}

function buildDetailZero(
  species: Species,
  height: number,
  branches: readonly MutableBranch[],
  children: readonly (readonly number[])[],
  seed: number,
): { readonly bark: GeometryBuilder; readonly leaves: GeometryBuilder } {
  const bark = new GeometryBuilder();
  const leaves = new GeometryBuilder();
  for (const branch of branches) {
    if (branch.order === 0) bark.addTube(branch.start, branch.end, branch.r0, branch.r1, 3, true);
  }

  const roots = branches.filter((branch) => branch.primary && branch.order === 1);
  for (const root of roots) {
    let endBranch = root;
    for (const branch of branches) {
      if (branch.mainLimb === root.id && branch.growthStep > endBranch.growthStep) endBranch = branch;
    }
    const terminalRadius = Math.max(root.r0 * 0.19, Math.min(root.r1, endBranch.r0 * 0.65));
    bark.addTube(root.start, endBranch.end, root.r0 * 0.72, terminalRadius, 3, true);
  }

  const candidates = branches.filter((branch) =>
    branch.order === 1 && (children[branch.id]?.length ?? 0) === 0,
  );
  const stride = Math.max(1, Math.ceil(candidates.length / 11));
  const random = makeRandom((seed ^ 0x6d2b79f5) >>> 0);
  for (let index = 0; index < candidates.length; index += stride) {
    const branch = candidates[index];
    if (branch === undefined) continue;
    const size = height * (species === 'oak' ? 0.087 : species === 'pine' ? 0.067 : 0.058);
    const center = add(branch.end, [0, size * 0.1, 0]);
    leaves.addBlob(center, size, size * 0.72, size * 0.86, random() * Math.PI * 2);
  }

  if (candidates.length === 0) {
    const top = branches[branches.length - 1];
    if (top !== undefined) leaves.addBlob(top.end, height * 0.08, height * 0.07, height * 0.08, 0);
  }
  return { bark, leaves };
}

function buildDetailedGeometry(
  species: Species,
  height: number,
  detail: 1 | 2 | 3,
  branches: readonly MutableBranch[],
  children: readonly (readonly number[])[],
  seed: number,
): { readonly bark: GeometryBuilder; readonly leaves: GeometryBuilder } {
  const bark = new GeometryBuilder();
  const leaves = new GeometryBuilder();
  const sides = detail === 1 ? 5 : detail === 2 ? 8 : 12;
  const maxOrder = detail === 1 ? 2 : detail === 2 ? 3 : Number.POSITIVE_INFINITY;
  const cardsPerTip = detail === 1 ? 3 : detail === 2 ? 5 : 8;
  const candidates = branches.filter((branch) => branch.order <= maxOrder);
  const terminals = branches.filter((branch) =>
    branch.order >= 1 && branch.order <= maxOrder && (children[branch.id]?.length ?? 0) === 0,
  );

  const essentialCount = candidates.filter((branch) => branch.order === 0 || branch.primary).length;
  const essentialTriangles = essentialCount * sides * 2;
  const budget = BUDGET[detail] ?? 0;
  const availableLeafTriangles = Math.max(0, budget - essentialTriangles);
  let actualCardsPerTip = cardsPerTip;
  if (terminals.length > 0) {
    actualCardsPerTip = Math.min(cardsPerTip, Math.floor(availableLeafTriangles / (terminals.length * 2)));
  }
  const leafTerminals = actualCardsPerTip > 0 ? terminals : terminals.slice(0, Math.floor(availableLeafTriangles / 2));
  const leafCards = actualCardsPerTip > 0 ? leafTerminals.length * actualCardsPerTip : leafTerminals.length;
  const leafTriangles = leafCards * 2;
  const maxTubes = Math.max(essentialCount, Math.floor((budget - leafTriangles) / (sides * 2)));

  const selected = chooseTubeSegments(candidates, maxTubes);
  for (const branch of selected) bark.addTube(branch.start, branch.end, branch.r0, branch.r1, sides, false);

  const random = makeRandom((seed ^ (0x9e3779b9 + detail * 4099)) >>> 0);
  for (const branch of leafTerminals) {
    const count = actualCardsPerTip > 0 ? actualCardsPerTip : 1;
    for (let card = 0; card < count; card += 1) {
      const angle = random() * Math.PI * 2;
      const scatter = height * (species === 'oak' ? 0.018 : 0.011);
      const center = add(branch.end, [
        Math.cos(angle) * scatter * (random() - 0.25),
        (random() - 0.25) * scatter,
        Math.sin(angle) * scatter * (random() - 0.25),
      ]);
      const facing = normalize([
        Math.cos(angle),
        species === 'birch' ? -0.13 + random() * 0.3 : -0.08 + random() * 0.48,
        Math.sin(angle),
      ]);
      const scale = detail === 3 ? 0.8 : detail === 2 ? 0.96 : 1.12;
      const cardWidth = shapeLeafWidth(species, height) * scale;
      const cardHeight = shapeLeafHeight(species, height) * scale;
      leaves.addCard(center, facing, cardWidth, cardHeight, random() * Math.PI * 2);
    }
  }

  return { bark, leaves };
}

function chooseTubeSegments(candidates: readonly MutableBranch[], maximum: number): MutableBranch[] {
  if (maximum >= candidates.length) return [...candidates];
  if (maximum <= 0) return [];

  const essential = candidates.filter((branch) => branch.order === 0 || branch.primary);
  const selected = [...essential];
  const selectedIds = new Set(selected.map((branch) => branch.id));
  const remaining = candidates.filter((branch) => !selectedIds.has(branch.id));
  const slots = Math.max(0, maximum - selected.length);
  if (slots >= remaining.length) return [...selected, ...remaining];

  for (let index = 0; index < slots; index += 1) {
    const pick = remaining[Math.floor(((index + 0.5) * remaining.length) / slots)];
    if (pick !== undefined) selected.push(pick);
  }
  selected.sort((a, b) => a.id - b.id);
  return selected;
}

function shapeLeafWidth(species: Species, height: number): number {
  if (species === 'oak') return height * 0.049;
  if (species === 'pine') return height * 0.021;
  return height * 0.018;
}

function shapeLeafHeight(species: Species, height: number): number {
  if (species === 'oak') return height * 0.057;
  if (species === 'pine') return height * 0.063;
  return height * 0.055;
}

function makeChildren(branches: readonly MutableBranch[]): number[][] {
  const children: number[][] = Array.from({ length: branches.length }, () => []);
  for (const branch of branches) {
    if (branch.parent !== null) children[branch.parent]?.push(branch.id);
  }
  return children;
}

export function growTree(options: TreeOptions): Tree {
  if (options.species !== 'pine' && options.species !== 'oak' && options.species !== 'birch') {
    throw new Error('Species must be pine, oak, or birch.');
  }
  if (!Number.isFinite(options.seed)) throw new Error('Tree seed must be finite.');
  if (!Number.isFinite(options.height) || options.height <= 0) throw new Error('Tree height must be finite and positive.');
  if (options.detail !== 0 && options.detail !== 1 && options.detail !== 2 && options.detail !== 3) {
    throw new Error('Tree detail must be 0, 1, 2, or 3.');
  }

  const shape = speciesShape(options.species, options.height);
  const seed = options.seed >>> 0;
  const random = makeRandom(seed ^ (options.species === 'pine' ? 0x11 : options.species === 'oak' ? 0x27 : 0x43));
  const branches: MutableBranch[] = [];
  let parent: number | null = null;
  let driftX = 0;
  let driftZ = 0;
  for (let index = 0; index < shape.trunkSegments; index += 1) {
    const offset = trunkOffset(options.species, options.height, index, random);
    driftX += offset[0];
    driftZ += offset[2];
    const endY = shape.trunkHeight * ((index + 1) / shape.trunkSegments);
    const end: Vec3 = index === 0 ? [0, endY, 0] : [driftX, endY, driftZ];
    const branch = newBranch(branches, parent, end, 0, -1, index + 1, false);
    parent = branch.id;
  }

  const tips = initialBranches(options.species, options.height, shape, branches, random);
  const attractions = makeAttractions(options.species, shape, random);
  growBranches(options.species, shape, branches, attractions, tips, random);
  const radiused = assignPipeRadii(branches, shape.trunkRadius);
  const children = makeChildren(radiused);

  const geometry = options.detail === 0
    ? buildDetailZero(options.species, options.height, radiused, children, seed)
    : buildDetailedGeometry(options.species, options.height, options.detail, radiused, children, seed);
  const bark = geometry.bark.build(`${options.species}-bark-d${options.detail}`);
  const leaves = geometry.leaves.build(`${options.species}-leaves-d${options.detail}`);
  const metrics = treeMetrics(bark, leaves);
  const triangles = (bark.getAttribute('position').count + leaves.getAttribute('position').count) / 3;
  const publicBranches: Branch[] = radiused.map((branch) => ({
    id: branch.id,
    parent: branch.parent,
    start: [branch.start[0], branch.start[1], branch.start[2]],
    end: [branch.end[0], branch.end[1], branch.end[2]],
    r0: branch.r0,
    r1: branch.r1,
  }));

  if (triangles > (BUDGET[options.detail] ?? 0)) {
    bark.dispose();
    leaves.dispose();
    throw new Error('Generated tree exceeded its triangle budget.');
  }

  return {
    species: options.species,
    branches: publicBranches,
    bark,
    leaves,
    height: metrics.height,
    radius: metrics.radius,
    triangles,
  };
}
