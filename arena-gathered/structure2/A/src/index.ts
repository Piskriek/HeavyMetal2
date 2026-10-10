export type Kind =
  | 'foundation'
  | 'floor'
  | 'ramp'
  | 'wall'
  | 'airlock'
  | 'pillar'
  | 'hardpoint'
  | 'bin'
  | 'bench'
  | 'repeater';

export interface Material {
  readonly vKeep: number;
  readonly hKeep: number;
}

export interface Structure {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

export interface Piece {
  readonly id: number;
  readonly s: number;
  readonly kind: Kind;
  readonly i: number;
  readonly j: number;
  readonly k: number;
  readonly r: 0 | 1 | 2 | 3;
  readonly mat: string;
  readonly open?: boolean;
}

export interface Base {
  readonly v: 1;
  readonly structures: Structure[];
  readonly pieces: Piece[];
  readonly nextId: number;
}

export interface Env {
  readonly heightAt: (x: number, z: number) => number;
  readonly materials: Record<string, Material>;
}

export interface Result {
  readonly ok: boolean;
  readonly why: string;
  readonly base: Base;
  readonly id: number;
}

export interface Room {
  readonly s: number;
  readonly k: number;
  readonly cells: [number, number][];
  readonly sealed: boolean;
  readonly airlocks: number[];
}

export interface Aim {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

export type Snap =
  | {
      readonly mode: 'place';
      readonly piece: Omit<Piece, 'id'>;
      readonly ok: boolean;
      readonly why: string;
      readonly support: number;
    }
  | {
      readonly mode: 'found';
      readonly cx: number;
      readonly cz: number;
      readonly yaw: number;
      readonly ok: boolean;
      readonly why: string;
    };

export const CELL = 4;
export const LEVEL = 3;
export const SKIRT = 3;
export const MIN_SUPPORT = 0.2;

const CELL_KINDS: readonly Kind[] = ['foundation', 'floor', 'ramp'];
const EDGE_KINDS: readonly Kind[] = ['wall', 'airlock'];
const FIXTURE_KINDS: readonly Kind[] = ['hardpoint', 'bin', 'bench', 'repeater'];

interface Extents {
  readonly lowest: number;
  readonly highest: number;
}

interface SupportEdge {
  readonly to: number;
  readonly factor: number;
}

function isKind(value: unknown): value is Kind {
  return (
    value === 'foundation' ||
    value === 'floor' ||
    value === 'ramp' ||
    value === 'wall' ||
    value === 'airlock' ||
    value === 'pillar' ||
    value === 'hardpoint' ||
    value === 'bin' ||
    value === 'bench' ||
    value === 'repeater'
  );
}

function isCellKind(kind: Kind): boolean {
  return CELL_KINDS.includes(kind);
}

function isEdgeKind(kind: Kind): boolean {
  return EDGE_KINDS.includes(kind);
}

function isFixtureKind(kind: Kind): boolean {
  return FIXTURE_KINDS.includes(kind);
}

function materialFor(env: Env, name: string): Material | undefined {
  if (!Object.prototype.hasOwnProperty.call(env.materials, name)) return undefined;
  const material = env.materials[name];
  if (material === undefined) return undefined;
  if (!Number.isFinite(material.vKeep) || !Number.isFinite(material.hKeep)) return undefined;
  return material;
}

function cellKey(s: number, i: number, j: number, k: number): string {
  return `${s}:${i}:${j}:${k}`;
}

function edgeKey(s: number, i: number, j: number, k: number, r: number): string {
  return `${s}:${i}:${j}:${k}:${r}`;
}

function pillarKey(s: number, i: number, j: number, k: number): string {
  return `${s}:${i}:${j}:${k}`;
}

function terrainKey(s: number, i: number, j: number): string {
  return `${s}:${i}:${j}`;
}

function extentsAtCell(env: Env, structure: Structure, i: number, j: number): Extents {
  const points = [
    toWorld(structure, i * CELL, j * CELL, 0),
    toWorld(structure, (i + 1) * CELL, j * CELL, 0),
    toWorld(structure, i * CELL, (j + 1) * CELL, 0),
    toWorld(structure, (i + 1) * CELL, (j + 1) * CELL, 0),
    toWorld(structure, (i + 0.5) * CELL, (j + 0.5) * CELL, 0),
  ];
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const height = env.heightAt(point.x, point.z);
    if (height < lowest) lowest = height;
    if (height > highest) highest = height;
  }
  return { lowest, highest };
}

function cachedExtents(
  env: Env,
  structure: Structure,
  i: number,
  j: number,
  cache: Map<string, Extents>,
): Extents {
  const key = terrainKey(structure.id, i, j);
  const existing = cache.get(key);
  if (existing !== undefined) return existing;
  const extents = extentsAtCell(env, structure, i, j);
  cache.set(key, extents);
  return extents;
}

function squareOverlaps(
  first: Structure,
  firstI: number,
  firstJ: number,
  second: Structure,
  secondI: number,
  secondJ: number,
): boolean {
  const firstCos = Math.cos(first.yaw);
  const firstSin = Math.sin(first.yaw);
  const secondCos = Math.cos(second.yaw);
  const secondSin = Math.sin(second.yaw);
  const firstCenter = toWorld(first, (firstI + 0.5) * CELL, (firstJ + 0.5) * CELL, 0);
  const secondCenter = toWorld(second, (secondI + 0.5) * CELL, (secondJ + 0.5) * CELL, 0);
  const deltaX = secondCenter.x - firstCenter.x;
  const deltaZ = secondCenter.z - firstCenter.z;
  const axes = [
    { x: firstCos, z: firstSin },
    { x: -firstSin, z: firstCos },
    { x: secondCos, z: secondSin },
    { x: -secondSin, z: secondCos },
  ];
  const firstU = { x: firstCos, z: firstSin };
  const firstV = { x: -firstSin, z: firstCos };
  const secondU = { x: secondCos, z: secondSin };
  const secondV = { x: -secondSin, z: secondCos };

  for (const axis of axes) {
    const firstRadius = (CELL / 2) *
      (Math.abs(axis.x * firstU.x + axis.z * firstU.z) +
        Math.abs(axis.x * firstV.x + axis.z * firstV.z));
    const secondRadius = (CELL / 2) *
      (Math.abs(axis.x * secondU.x + axis.z * secondU.z) +
        Math.abs(axis.x * secondV.x + axis.z * secondV.z));
    const penetration =
      firstRadius + secondRadius - Math.abs(deltaX * axis.x + deltaZ * axis.z);
    if (penetration <= 0.05) return false;
  }
  return true;
}

function hasCellOverlap(
  base: Base,
  structure: Structure,
  i: number,
  j: number,
): boolean {
  const structuresById = new Map<number, Structure>();
  for (const item of base.structures) structuresById.set(item.id, item);
  for (const piece of base.pieces) {
    if (!isCellKind(piece.kind) || piece.s === structure.id) continue;
    const other = structuresById.get(piece.s);
    if (other !== undefined && squareOverlaps(structure, i, j, other, piece.i, piece.j)) {
      return true;
    }
  }
  return false;
}

function pointInHardpoint(hardpoint: Omit<Piece, 'id'>, i: number, j: number): boolean {
  return i >= hardpoint.i && i <= hardpoint.i + 1 && j >= hardpoint.j && j <= hardpoint.j + 1;
}

function occupied(base: Base, candidate: Omit<Piece, 'id'>): boolean {
  for (const existing of base.pieces) {
    if (existing.s !== candidate.s) continue;

    if (
      isCellKind(candidate.kind) &&
      isCellKind(existing.kind) &&
      existing.i === candidate.i &&
      existing.j === candidate.j &&
      existing.k === candidate.k
    ) {
      return true;
    }

    if (
      isEdgeKind(candidate.kind) &&
      isEdgeKind(existing.kind) &&
      existing.i === candidate.i &&
      existing.j === candidate.j &&
      existing.k === candidate.k &&
      existing.r === candidate.r
    ) {
      return true;
    }

    if (
      candidate.kind === 'pillar' &&
      existing.kind === 'pillar' &&
      existing.i === candidate.i &&
      existing.j === candidate.j &&
      existing.k === candidate.k
    ) {
      return true;
    }

    if (!isFixtureKind(candidate.kind) || !isFixtureKind(existing.kind)) continue;
    if (existing.k !== candidate.k) continue;

    if (candidate.kind === 'hardpoint' && existing.kind === 'hardpoint') {
      if (
        candidate.i <= existing.i + 1 &&
        candidate.i + 1 >= existing.i &&
        candidate.j <= existing.j + 1 &&
        candidate.j + 1 >= existing.j
      ) {
        return true;
      }
      continue;
    }

    if (candidate.kind === 'hardpoint') {
      if (pointInHardpoint(candidate, existing.i, existing.j)) return true;
      continue;
    }

    if (existing.kind === 'hardpoint') {
      if (pointInHardpoint(existing, candidate.i, candidate.j)) return true;
      continue;
    }

    if (existing.i === candidate.i && existing.j === candidate.j) return true;
  }
  return false;
}

function groundedFoundationAt(
  base: Base,
  env: Env,
  s: number,
  i: number,
  j: number,
  k: number,
  structuresById: ReadonlyMap<number, Structure>,
  terrainCache: Map<string, Extents>,
): boolean {
  const structure = structuresById.get(s);
  if (structure === undefined) return false;
  for (const piece of base.pieces) {
    if (
      piece.kind !== 'foundation' ||
      piece.s !== s ||
      piece.i !== i ||
      piece.j !== j ||
      piece.k !== k
    ) {
      continue;
    }
    const extents = cachedExtents(env, structure, i, j, terrainCache);
    return structure.y + piece.k * LEVEL - extents.lowest <= SKIRT;
  }
  return false;
}

function addPieceInIdOrder(pieces: readonly Piece[], added: Piece): Piece[] {
  return [...pieces, added].sort((a, b) => a.id - b.id);
}

function addStructureInIdOrder(
  structures: readonly Structure[],
  added: Structure,
): Structure[] {
  return [...structures, added].sort((a, b) => a.id - b.id);
}

function supportValues(
  pieces: readonly Piece[],
  structures: readonly Structure[],
  env: Env,
): number[] {
  const count = pieces.length;
  const cells = new Map<string, number>();
  const edges = new Map<string, number>();
  const pillars = new Map<string, number>();
  const structuresById = new Map<number, Structure>();
  const terrainCache = new Map<string, Extents>();

  for (const structure of structures) structuresById.set(structure.id, structure);
  for (let index = 0; index < count; index += 1) {
    const piece = pieces[index];
    if (piece === undefined) continue;
    if (isCellKind(piece.kind)) {
      cells.set(cellKey(piece.s, piece.i, piece.j, piece.k), index);
    } else if (isEdgeKind(piece.kind) && (piece.r === 0 || piece.r === 1)) {
      edges.set(edgeKey(piece.s, piece.i, piece.j, piece.k, piece.r), index);
    } else if (piece.kind === 'pillar') {
      pillars.set(pillarKey(piece.s, piece.i, piece.j, piece.k), index);
    }
  }

  const outgoing: SupportEdge[][] = Array.from({ length: count }, () => []);
  const values: number[] = Array.from({ length: count }, () => 0);
  const grounded: boolean[] = Array.from({ length: count }, () => false);
  let hasExpansiveFactor = false;

  for (let index = 0; index < count; index += 1) {
    const piece = pieces[index];
    if (piece === undefined || piece.kind !== 'foundation') continue;
    const structure = structuresById.get(piece.s);
    if (structure === undefined) continue;
    const extents = cachedExtents(env, structure, piece.i, piece.j, terrainCache);
    if (structure.y + piece.k * LEVEL - extents.lowest <= SKIRT) {
      grounded[index] = true;
      values[index] = 1;
    }
  }

  const addDependency = (
    targetIndex: number,
    sourceIndex: number | undefined,
    vertical: boolean,
  ): void => {
    if (sourceIndex === undefined || sourceIndex === targetIndex) return;
    const target = pieces[targetIndex];
    const material = target === undefined ? undefined : materialFor(env, target.mat);
    if (material === undefined) return;
    const factor = vertical ? material.vKeep : material.hKeep;
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (factor > 1) hasExpansiveFactor = true;
    const links = outgoing[sourceIndex];
    if (links !== undefined) links.push({ to: targetIndex, factor });
  };

  const addCellSupport = (
    targetIndex: number,
    s: number,
    i: number,
    j: number,
    k: number,
    vertical: boolean,
  ): void => addDependency(targetIndex, cells.get(cellKey(s, i, j, k)), vertical);

  const addEdgeSupport = (
    targetIndex: number,
    s: number,
    i: number,
    j: number,
    k: number,
    r: number,
    vertical: boolean,
  ): void => addDependency(targetIndex, edges.get(edgeKey(s, i, j, k, r)), vertical);

  const addPillarSupport = (
    targetIndex: number,
    s: number,
    i: number,
    j: number,
    k: number,
    vertical: boolean,
  ): void => addDependency(targetIndex, pillars.get(pillarKey(s, i, j, k)), vertical);

  for (let targetIndex = 0; targetIndex < count; targetIndex += 1) {
    const piece = pieces[targetIndex];
    if (piece === undefined || grounded[targetIndex] === true) continue;

    if (isCellKind(piece.kind)) {
      const { s, i, j, k } = piece;
      if (k > 0) {
        addEdgeSupport(targetIndex, s, i, j, k - 1, 0, true);
        addEdgeSupport(targetIndex, s, i, j + 1, k - 1, 0, true);
        addEdgeSupport(targetIndex, s, i, j, k - 1, 1, true);
        addEdgeSupport(targetIndex, s, i + 1, j, k - 1, 1, true);
        addPillarSupport(targetIndex, s, i, j, k - 1, true);
        addPillarSupport(targetIndex, s, i + 1, j, k - 1, true);
        addPillarSupport(targetIndex, s, i, j + 1, k - 1, true);
        addPillarSupport(targetIndex, s, i + 1, j + 1, k - 1, true);
        if (piece.kind === 'foundation') {
          const below = cells.get(cellKey(s, i, j, k - 1));
          if (below !== undefined) {
            const lower = pieces[below];
            if (lower?.kind === 'foundation') addDependency(targetIndex, below, true);
          }
        }
      }
      addCellSupport(targetIndex, s, i - 1, j, k, false);
      addCellSupport(targetIndex, s, i + 1, j, k, false);
      addCellSupport(targetIndex, s, i, j - 1, k, false);
      addCellSupport(targetIndex, s, i, j + 1, k, false);
      continue;
    }

    if (isEdgeKind(piece.kind) && (piece.r === 0 || piece.r === 1)) {
      const { s, i, j, k, r } = piece;
      if (r === 0) {
        addCellSupport(targetIndex, s, i, j, k, true);
        addCellSupport(targetIndex, s, i, j - 1, k, true);
        addPillarSupport(targetIndex, s, i, j, k, false);
        addPillarSupport(targetIndex, s, i + 1, j, k, false);
        addEdgeSupport(targetIndex, s, i - 1, j, k, 0, false);
        addEdgeSupport(targetIndex, s, i + 1, j, k, 0, false);
      } else {
        addCellSupport(targetIndex, s, i, j, k, true);
        addCellSupport(targetIndex, s, i - 1, j, k, true);
        addPillarSupport(targetIndex, s, i, j, k, false);
        addPillarSupport(targetIndex, s, i, j + 1, k, false);
        addEdgeSupport(targetIndex, s, i, j - 1, k, 1, false);
        addEdgeSupport(targetIndex, s, i, j + 1, k, 1, false);
      }
      if (k > 0) addEdgeSupport(targetIndex, s, i, j, k - 1, r, true);
      continue;
    }

    if (piece.kind === 'pillar') {
      const { s, i, j, k } = piece;
      addCellSupport(targetIndex, s, i, j, k, true);
      addCellSupport(targetIndex, s, i - 1, j, k, true);
      addCellSupport(targetIndex, s, i, j - 1, k, true);
      addCellSupport(targetIndex, s, i - 1, j - 1, k, true);
      if (k > 0) addPillarSupport(targetIndex, s, i, j, k - 1, true);
      continue;
    }

    if (isFixtureKind(piece.kind)) {
      const { s, i, j, k } = piece;
      addCellSupport(targetIndex, s, i, j, k, true);
      if (piece.kind === 'hardpoint') {
        addCellSupport(targetIndex, s, i + 1, j, k, true);
        addCellSupport(targetIndex, s, i, j + 1, k, true);
        addCellSupport(targetIndex, s, i + 1, j + 1, k, true);
      }
    }
  }

  const queue: number[] = [];
  const queued: boolean[] = Array.from({ length: count }, () => false);
  for (let index = 0; index < count; index += 1) {
    if (grounded[index] === true) {
      queue.push(index);
      queued[index] = true;
    }
  }

  const improvements: number[] = Array.from({ length: count }, () => 0);
  const maxImprovements = count + 1;
  let head = 0;
  while (head < queue.length) {
    const sourceIndex = queue[head];
    head += 1;
    if (sourceIndex === undefined) continue;
    queued[sourceIndex] = false;
    const links = outgoing[sourceIndex];
    if (links === undefined) continue;
    const sourceValue = values[sourceIndex] ?? 0;
    for (const link of links) {
      if (grounded[link.to] === true) continue;
      const nextValue = sourceValue * link.factor;
      if (nextValue <= (values[link.to] ?? 0)) continue;
      if (
        hasExpansiveFactor &&
        (improvements[link.to] ?? 0) >= maxImprovements
      ) {
        continue;
      }
      values[link.to] = nextValue;
      improvements[link.to] = (improvements[link.to] ?? 0) + 1;
      if (queued[link.to] !== true) {
        queue.push(link.to);
        queued[link.to] = true;
      }
    }
  }

  return values;
}

function validSlot(base: Base, piece: Omit<Piece, 'id'>): boolean {
  if (
    !Number.isInteger(piece.s) ||
    !Number.isInteger(piece.i) ||
    !Number.isInteger(piece.j) ||
    !Number.isInteger(piece.k) ||
    !Number.isInteger(piece.r) ||
    piece.k < 0 ||
    !isKind(piece.kind)
  ) {
    return false;
  }
  if (isEdgeKind(piece.kind) && piece.r !== 0 && piece.r !== 1) return false;
  return base.structures.some((structure) => structure.id === piece.s);
}

function candidateSupport(base: Base, env: Env, piece: Omit<Piece, 'id'>): number {
  const candidate: Piece = { ...piece, id: base.nextId };
  const values = supportValues([...base.pieces, candidate], base.structures, env);
  return values[values.length - 1] ?? 0;
}

export function empty(): Base {
  return { v: 1, structures: [], pieces: [], nextId: 1 };
}

export function toWorld(
  structure: Structure,
  u: number,
  v: number,
  k: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const cosine = Math.cos(structure.yaw);
  const sine = Math.sin(structure.yaw);
  return {
    x: structure.x + u * cosine - v * sine,
    y: structure.y + k * LEVEL,
    z: structure.z + u * sine + v * cosine,
  };
}

export function found(
  base: Base,
  env: Env,
  cx: number,
  cz: number,
  yaw: number,
  mat: string,
): Result {
  if (!Number.isFinite(cx) || !Number.isFinite(cz) || !Number.isFinite(yaw)) {
    return { ok: false, why: 'bad-slot', base, id: -1 };
  }
  if (materialFor(env, mat) === undefined) {
    return { ok: false, why: 'material', base, id: -1 };
  }

  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const structure: Structure = {
    id: base.nextId,
    x: cx - (CELL / 2) * cosine + (CELL / 2) * sine,
    y: 0,
    z: cz - (CELL / 2) * sine - (CELL / 2) * cosine,
    yaw,
  };
  const extents = extentsAtCell(env, structure, 0, 0);
  if (extents.highest - extents.lowest > SKIRT) {
    return { ok: false, why: 'steep', base, id: -1 };
  }
  const placedStructure: Structure = { ...structure, y: extents.highest };
  if (hasCellOverlap(base, placedStructure, 0, 0)) {
    return { ok: false, why: 'overlap', base, id: -1 };
  }

  const pieceId = base.nextId + 1;
  const foundation: Piece = {
    id: pieceId,
    s: placedStructure.id,
    kind: 'foundation',
    i: 0,
    j: 0,
    k: 0,
    r: 0,
    mat,
  };
  const nextBase: Base = {
    v: 1,
    structures: addStructureInIdOrder(base.structures, placedStructure),
    pieces: addPieceInIdOrder(base.pieces, foundation),
    nextId: base.nextId + 2,
  };
  return { ok: true, why: '', base: nextBase, id: pieceId };
}

export function check(
  base: Base,
  env: Env,
  piece: Omit<Piece, 'id'>,
): { readonly ok: boolean; readonly why: string; readonly support: number } {
  if (!validSlot(base, piece)) return { ok: false, why: 'bad-slot', support: 0 };
  if (materialFor(env, piece.mat) === undefined) {
    return { ok: false, why: 'material', support: 0 };
  }
  if (occupied(base, piece)) return { ok: false, why: 'occupied', support: 0 };

  const structure = base.structures.find((item) => item.id === piece.s);
  if (structure === undefined) return { ok: false, why: 'bad-slot', support: 0 };

  const terrainCache = new Map<string, Extents>();
  if (isCellKind(piece.kind)) {
    const extents = cachedExtents(env, structure, piece.i, piece.j, terrainCache);
    const floorTop = structure.y + piece.k * LEVEL;
    if (extents.highest > floorTop + 0.05) {
      return { ok: false, why: 'ground', support: 0 };
    }
    if (hasCellOverlap(base, structure, piece.i, piece.j)) {
      return { ok: false, why: 'overlap', support: 0 };
    }
    if (extents.highest - extents.lowest > SKIRT) {
      return { ok: false, why: 'steep', support: 0 };
    }
  }

  const structuresById = new Map<number, Structure>();
  for (const item of base.structures) structuresById.set(item.id, item);
  if (
    piece.kind === 'bin' ||
    piece.kind === 'bench' ||
    piece.kind === 'repeater'
  ) {
    const hasFloor = base.pieces.some(
      (existing) =>
        isCellKind(existing.kind) &&
        existing.s === piece.s &&
        existing.i === piece.i &&
        existing.j === piece.j &&
        existing.k === piece.k,
    );
    if (!hasFloor) return { ok: false, why: 'needs-floor', support: 0 };
  }

  if (piece.kind === 'hardpoint') {
    const terrainCacheForPad = new Map<string, Extents>();
    const hasPad =
      groundedFoundationAt(
        base,
        env,
        piece.s,
        piece.i,
        piece.j,
        piece.k,
        structuresById,
        terrainCacheForPad,
      ) &&
      groundedFoundationAt(
        base,
        env,
        piece.s,
        piece.i + 1,
        piece.j,
        piece.k,
        structuresById,
        terrainCacheForPad,
      ) &&
      groundedFoundationAt(
        base,
        env,
        piece.s,
        piece.i,
        piece.j + 1,
        piece.k,
        structuresById,
        terrainCacheForPad,
      ) &&
      groundedFoundationAt(
        base,
        env,
        piece.s,
        piece.i + 1,
        piece.j + 1,
        piece.k,
        structuresById,
        terrainCacheForPad,
      );
    if (!hasPad) return { ok: false, why: 'needs-pad', support: 0 };
  }

  const support = candidateSupport(base, env, piece);
  if (support < MIN_SUPPORT) return { ok: false, why: 'unsupported', support };
  return { ok: true, why: '', support };
}

export function place(base: Base, env: Env, piece: Omit<Piece, 'id'>): Result {
  const verdict = check(base, env, piece);
  if (!verdict.ok) return { ok: false, why: verdict.why, base, id: -1 };

  const placed: Piece = piece.kind === 'airlock'
    ? { ...piece, id: base.nextId }
    : {
        id: base.nextId,
        s: piece.s,
        kind: piece.kind,
        i: piece.i,
        j: piece.j,
        k: piece.k,
        r: piece.r,
        mat: piece.mat,
      };
  const nextBase: Base = {
    ...base,
    pieces: addPieceInIdOrder(base.pieces, placed),
    nextId: base.nextId + 1,
  };
  return { ok: true, why: '', base: nextBase, id: placed.id };
}

export function supports(base: Base, env: Env): ReadonlyMap<number, number> {
  const values = supportValues(base.pieces, base.structures, env);
  const result = new Map<number, number>();
  for (let index = 0; index < base.pieces.length; index += 1) {
    const piece = base.pieces[index];
    if (piece !== undefined) result.set(piece.id, values[index] ?? 0);
  }
  return result;
}

export function setOpen(base: Base, id: number, open: boolean): Base {
  const piece = base.pieces.find((item) => item.id === id);
  if (piece === undefined || piece.kind !== 'airlock') return base;
  if ((piece.open === true) === open) return base;

  const pieces = base.pieces.map((item): Piece => {
    if (item.id !== id) return item;
    if (open) return { ...item, open: true };
    return {
      id: item.id,
      s: item.s,
      kind: item.kind,
      i: item.i,
      j: item.j,
      k: item.k,
      r: item.r,
      mat: item.mat,
    };
  });
  return { ...base, pieces };
}

interface RoomCell {
  readonly s: number;
  readonly k: number;
  readonly i: number;
  readonly j: number;
}

interface RoomSide {
  readonly i: number;
  readonly j: number;
  readonly edgeI: number;
  readonly edgeJ: number;
  readonly r: 0 | 1;
}

function roomSides(cell: RoomCell): readonly RoomSide[] {
  return [
    { i: cell.i, j: cell.j - 1, edgeI: cell.i, edgeJ: cell.j, r: 0 },
    { i: cell.i, j: cell.j + 1, edgeI: cell.i, edgeJ: cell.j + 1, r: 0 },
    { i: cell.i - 1, j: cell.j, edgeI: cell.i, edgeJ: cell.j, r: 1 },
    { i: cell.i + 1, j: cell.j, edgeI: cell.i + 1, edgeJ: cell.j, r: 1 },
  ];
}

export function rooms(base: Base): Room[] {
  const cellSlots = new Set<string>();
  const edgePieces = new Map<string, Piece[]>();
  for (const piece of base.pieces) {
    if (isCellKind(piece.kind)) {
      cellSlots.add(cellKey(piece.s, piece.i, piece.j, piece.k));
    }
    if (isEdgeKind(piece.kind) && (piece.r === 0 || piece.r === 1)) {
      const key = edgeKey(piece.s, piece.i, piece.j, piece.k, piece.r);
      const atEdge = edgePieces.get(key);
      if (atEdge === undefined) edgePieces.set(key, [piece]);
      else atEdge.push(piece);
    }
  }

  const roomCellsByKey = new Map<string, RoomCell>();
  for (const piece of base.pieces) {
    if (piece.kind !== 'foundation' && piece.kind !== 'floor') continue;
    if (!cellSlots.has(cellKey(piece.s, piece.i, piece.j, piece.k + 1))) continue;
    const cell: RoomCell = { s: piece.s, k: piece.k, i: piece.i, j: piece.j };
    roomCellsByKey.set(cellKey(cell.s, cell.i, cell.j, cell.k), cell);
  }

  const orderedCells = [...roomCellsByKey.values()].sort(
    (a, b) => a.s - b.s || a.k - b.k || a.i - b.i || a.j - b.j,
  );
  const visited = new Set<string>();
  const result: Room[] = [];

  const piecesAtSide = (cell: RoomCell, side: RoomSide): readonly Piece[] =>
    edgePieces.get(edgeKey(cell.s, side.edgeI, side.edgeJ, cell.k, side.r)) ?? [];
  const isBarrier = (cell: RoomCell, side: RoomSide): boolean =>
    piecesAtSide(cell, side).some(
      (piece) => piece.kind === 'wall' || (piece.kind === 'airlock' && piece.open !== true),
    );

  for (const seed of orderedCells) {
    const seedKey = cellKey(seed.s, seed.i, seed.j, seed.k);
    if (visited.has(seedKey)) continue;

    const queue: RoomCell[] = [seed];
    const group: RoomCell[] = [];
    visited.add(seedKey);
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head];
      if (cell === undefined) continue;
      group.push(cell);
      for (const side of roomSides(cell)) {
        if (isBarrier(cell, side)) continue;
        const neighborKey = cellKey(cell.s, side.i, side.j, cell.k);
        const neighbor = roomCellsByKey.get(neighborKey);
        if (neighbor !== undefined && !visited.has(neighborKey)) {
          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }
    }

    const groupKeys = new Set(group.map((cell) => cellKey(cell.s, cell.i, cell.j, cell.k)));
    const airlockIds = new Set<number>();
    let sealed = true;
    for (const cell of group) {
      for (const side of roomSides(cell)) {
        const edge = piecesAtSide(cell, side);
        for (const piece of edge) {
          if (piece.kind === 'airlock') airlockIds.add(piece.id);
        }
        const neighborKey = cellKey(cell.s, side.i, side.j, cell.k);
        if (!isBarrier(cell, side) && !groupKeys.has(neighborKey)) sealed = false;
      }
    }

    group.sort((a, b) => a.i - b.i || a.j - b.j);
    result.push({
      s: seed.s,
      k: seed.k,
      cells: group.map((cell): [number, number] => [cell.i, cell.j]),
      sealed,
      airlocks: [...airlockIds].sort((a, b) => a - b),
    });
  }

  result.sort((a, b) => {
    if (a.s !== b.s) return a.s - b.s;
    if (a.k !== b.k) return a.k - b.k;
    return (
      (a.cells[0]?.[0] ?? 0) - (b.cells[0]?.[0] ?? 0) ||
      (a.cells[0]?.[1] ?? 0) - (b.cells[0]?.[1] ?? 0)
    );
  });
  return result;
}

interface SnapCandidate {
  readonly piece: Omit<Piece, 'id'>;
  readonly distance: number;
}

function cellDistance(u: number, v: number, i: number, j: number): number {
  const minU = i * CELL;
  const maxU = (i + 1) * CELL;
  const minV = j * CELL;
  const maxV = (j + 1) * CELL;
  const du = u < minU ? minU - u : u > maxU ? u - maxU : 0;
  const dv = v < minV ? minV - v : v > maxV ? v - maxV : 0;
  return Math.hypot(du, dv);
}

function orientationIndex(aimYaw: number, structureYaw: number): 0 | 1 | 2 | 3 {
  const rounded = Math.round((aimYaw - structureYaw) / (Math.PI / 2));
  return ((rounded % 4 + 4) % 4) as 0 | 1 | 2 | 3;
}

function slotKey(piece: Omit<Piece, 'id'>): string {
  const group = isCellKind(piece.kind)
    ? 'cell'
    : isEdgeKind(piece.kind)
      ? 'edge'
      : piece.kind === 'pillar'
        ? 'pillar'
        : 'fixture';
  const edgeRotation = group === 'edge' ? piece.r : 0;
  return `${piece.s}:${group}:${piece.i}:${piece.j}:${piece.k}:${edgeRotation}`;
}

export function snap(
  base: Base,
  env: Env,
  kind: Kind,
  aim: Aim,
  mat: string,
  reach = 3,
): Snap | null {
  const candidates: SnapCandidate[] = [];
  const structures = [...base.structures].sort((a, b) => a.id - b.id);
  for (const structure of structures) {
    const dx = aim.x - structure.x;
    const dz = aim.z - structure.z;
    const cosine = Math.cos(structure.yaw);
    const sine = Math.sin(structure.yaw);
    const u = dx * cosine + dz * sine;
    const v = -dx * sine + dz * cosine;
    const cellPieces = base.pieces.filter(
      (piece) => piece.s === structure.id && isCellKind(piece.kind),
    );
    if (!cellPieces.some((piece) => cellDistance(u, v, piece.i, piece.j) <= reach)) continue;

    const k = Math.max(0, Math.round((aim.y - structure.y) / LEVEL));
    const ci = Math.floor(u / CELL);
    const cj = Math.floor(v / CELL);
    const rotation = orientationIndex(aim.yaw, structure.yaw);
    const append = (
      i: number,
      j: number,
      r: 0 | 1 | 2 | 3,
      anchorU: number,
      anchorV: number,
    ): void => {
      const distance = Math.hypot(u - anchorU, v - anchorV);
      if (distance > reach) return;
      candidates.push({
        piece: { s: structure.id, kind, i, j, k, r, mat },
        distance,
      });
    };

    for (let i = ci - 1; i <= ci + 1; i += 1) {
      for (let j = cj - 1; j <= cj + 1; j += 1) {
        if (kind === 'wall' || kind === 'airlock') {
          append(i, j, 0, (i + 0.5) * CELL, j * CELL);
          append(i, j, 1, i * CELL, (j + 0.5) * CELL);
        } else if (kind === 'pillar') {
          append(i, j, 0, i * CELL, j * CELL);
        } else if (kind === 'hardpoint') {
          append(i, j, rotation, (i + 1) * CELL, (j + 1) * CELL);
        } else {
          const r = kind === 'ramp' || isFixtureKind(kind) ? rotation : 0;
          append(i, j, r, (i + 0.5) * CELL, (j + 0.5) * CELL);
        }
      }
    }
  }

  const ordered = candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.piece.s - b.piece.s ||
      a.piece.i - b.piece.i ||
      a.piece.j - b.piece.j ||
      a.piece.r - b.piece.r,
  );
  const seenSlots = new Set<string>();
  const unique: SnapCandidate[] = [];
  for (const candidate of ordered) {
    const key = slotKey(candidate.piece);
    if (seenSlots.has(key)) continue;
    seenSlots.add(key);
    unique.push(candidate);
  }

  let firstFailure: { readonly candidate: SnapCandidate; readonly why: string; readonly support: number } | undefined;
  for (const candidate of unique) {
    const verdict = check(base, env, candidate.piece);
    if (verdict.ok) {
      return {
        mode: 'place',
        piece: candidate.piece,
        ok: true,
        why: '',
        support: verdict.support,
      };
    }
    if (firstFailure === undefined) {
      firstFailure = { candidate, why: verdict.why, support: verdict.support };
    }
  }

  if (firstFailure !== undefined) {
    return {
      mode: 'place',
      piece: firstFailure.candidate.piece,
      ok: false,
      why: firstFailure.why,
      support: firstFailure.support,
    };
  }

  if (kind !== 'foundation') return null;
  const result = found(base, env, aim.x, aim.z, aim.yaw, mat);
  return {
    mode: 'found',
    cx: aim.x,
    cz: aim.z,
    yaw: aim.yaw,
    ok: result.ok,
    why: result.why,
  };
}

export function remove(
  base: Base,
  env: Env,
  id: number,
): { readonly base: Base; readonly collapsed: number[] } {
  if (!base.pieces.some((piece) => piece.id === id)) {
    return { base, collapsed: [] };
  }

  let remaining = base.pieces.filter((piece) => piece.id !== id);
  const collapsed: number[] = [];
  for (;;) {
    const values = supportValues(remaining, base.structures, env);
    const falling: number[] = [];
    for (let index = 0; index < remaining.length; index += 1) {
      if ((values[index] ?? 0) < MIN_SUPPORT) {
        const piece = remaining[index];
        if (piece !== undefined) falling.push(piece.id);
      }
    }
    if (falling.length === 0) break;
    const fallingIds = new Set(falling);
    remaining = remaining.filter((piece) => !fallingIds.has(piece.id));
    collapsed.push(...falling);
  }

  collapsed.sort((a, b) => a - b);
  const structures = base.structures.filter((structure) =>
    remaining.some((piece) => piece.s === structure.id),
  );
  const nextBase: Base = {
    ...base,
    structures,
    pieces: remaining,
  };
  return { base: nextBase, collapsed };
}
