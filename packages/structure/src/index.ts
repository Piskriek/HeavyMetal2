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
  | 'repeater'
  | 'halfWall'
  | 'windowWall'
  | 'doorframe'
  | 'door'
  | 'railing'
  | 'ladder'
  | 'stairs'
  | 'lifeSupport'
  | 'roof'
  | 'lowRoof'
  | 'roofOuter'
  | 'roofInner'
  | 'gable'
  | 'ridgeCap';

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
  /**
   * Free placement for a bin, bench, repeater or life-support unit (R2.5): its centre's offset from the cell centre in
   * whole centimetres along the structure's x and z (at most 150), and its yaw in whole degrees (0..359, the sense r
   * turns). All three are present or none; none means centred, turned r quarter turns.
   */
  readonly dx?: number;
  readonly dz?: number;
  readonly deg?: number;
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
  readonly doors: number[];
  readonly lifeSupport: number[];
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
export const LIMITS = {
  maxStructures: 64,
  maxPieces: 4096,
  maxChars: 65536,
  maxMats: 16,
  coord: 100000,
  cell: 1023,
  maxLevel: 63,
} as const;

/** Roof cells take the cell slot of the storey they cap; their eave sits on that level's floor top. */
const ROOF_KINDS: readonly Kind[] = ['roof', 'lowRoof', 'roofOuter', 'roofInner'];
const CELL_KINDS: readonly Kind[] = ['foundation', 'floor', 'ramp', 'stairs', ...ROOF_KINDS];
const EDGE_KINDS: readonly Kind[] = [
  'wall',
  'airlock',
  'halfWall',
  'windowWall',
  'doorframe',
  'door',
  'railing',
  'ladder',
  'gable',
  'ridgeCap',
];
const FIXTURE_KINDS: readonly Kind[] = [
  'hardpoint',
  'bin',
  'bench',
  'repeater',
  'lifeSupport',
];
const CARRYING_EDGE_KINDS: readonly Kind[] = [
  'wall',
  'airlock',
  'windowWall',
  'doorframe',
  'door',
];

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
    value === 'repeater' ||
    value === 'halfWall' ||
    value === 'windowWall' ||
    value === 'doorframe' ||
    value === 'door' ||
    value === 'railing' ||
    value === 'ladder' ||
    value === 'stairs' ||
    value === 'lifeSupport' ||
    value === 'roof' ||
    value === 'lowRoof' ||
    value === 'roofOuter' ||
    value === 'roofInner' ||
    value === 'gable' ||
    value === 'ridgeCap'
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

function isRoofKind(kind: Kind): boolean {
  return ROOF_KINDS.includes(kind);
}

/** A side of a cell. A quarter turn (r + 1) takes +z to -x, -x to -z, -z to +x and +x to +z, as the renderer turns pieces. */
type Side = '+z' | '-x' | '-z' | '+x';
const TURN: readonly Side[] = ['+z', '-x', '-z', '+x'];
const turned = (side: Side, r: number): Side => TURN[(TURN.indexOf(side) + r) % 4] ?? side;

/** The edge slot on one side of cell (i, j), as [i, j, r]. */
function sideEdge(i: number, j: number, side: Side): readonly [number, number, 0 | 1] {
  switch (side) {
    case '+z': return [i, j + 1, 0];
    case '-z': return [i, j, 0];
    case '+x': return [i + 1, j, 1];
    case '-x': return [i, j, 1];
  }
}

/**
 * Which sides of a roof cell are high (the ridge), low (the eave, on the floor line) and rising sides. For r = 0 a roof
 * or low roof rises toward +z; a hip corner (roofOuter) has its eaves on -z and -x and rises to the (+x, +z) corner; a
 * valley corner (roofInner) rises from the (-x, -z) corner to high edges on +z and +x.
 */
function roofSides(kind: Kind, r: number): { readonly high: readonly Side[]; readonly low: readonly Side[]; readonly sides: readonly Side[] } {
  if (kind === 'roof' || kind === 'lowRoof') return { high: [turned('+z', r)], low: [turned('-z', r)], sides: [turned('+x', r), turned('-x', r)] };
  if (kind === 'roofOuter') return { high: [], low: [turned('-z', r), turned('-x', r)], sides: [turned('+z', r), turned('+x', r)] };
  if (kind === 'roofInner') return { high: [turned('+z', r), turned('+x', r)], low: [], sides: [turned('-z', r), turned('-x', r)] };
  return { high: [], low: [], sides: [] };
}

const isEdge = (e: readonly [number, number, number], i: number, j: number, r: number): boolean => e[0] === i && e[1] === j && e[2] === r;

/** The two cells either side of edge (i, j, r). */
function edgeCells(i: number, j: number, r: number): readonly (readonly [number, number])[] {
  return r === 0 ? [[i, j - 1], [i, j]] : [[i - 1, j], [i, j]];
}

/** Whether edge slot (i, j, k, r) is the eave of a roof cell beside it: the slope meets the floor line there, so nothing stands on it. */
function roofEaveAt(base: Base, s: number, i: number, j: number, k: number, r: number): boolean {
  for (const [ci, cj] of edgeCells(i, j, r)) {
    for (const p of base.pieces) {
      if (p.s !== s || p.k !== k || p.i !== ci || p.j !== cj || !isRoofKind(p.kind)) continue;
      if (roofSides(p.kind, p.r).low.some((side) => isEdge(sideEdge(ci, cj, side), i, j, r))) return true;
    }
  }
  return false;
}

/** Fixtures that may be placed freely inside their cell, with their footprint (width along x, depth along z, metres). */
const FOOTPRINT: Readonly<Partial<Record<Kind, readonly [number, number]>>> = {
  bin: [1.2, 0.9],
  bench: [2.4, 1.2],
  repeater: [1.6, 1.6],
  lifeSupport: [1.1, 0.7],
};
export const PLACE_LIMIT_CM = 150;
const CELL_MARGIN = 0.05;

const hasPlacement = (p: Omit<Piece, 'id'>): boolean => p.dx !== undefined || p.dz !== undefined || p.deg !== undefined;

/** A free fixture's footprint in its cell's frame (corner at 0, 0): centre, half sizes and its two axes. */
function footprint(p: Omit<Piece, 'id'>): { readonly cx: number; readonly cz: number; readonly hw: number; readonly hd: number; readonly ax: readonly [number, number]; readonly az: readonly [number, number] } | null {
  const size = FOOTPRINT[p.kind];
  if (size === undefined) return null;
  const theta = ((p.deg ?? p.r * 90) * Math.PI) / 180;
  const c = Math.cos(theta), sn = Math.sin(theta);
  return { cx: CELL / 2 + (p.dx ?? 0) / 100, cz: CELL / 2 + (p.dz ?? 0) / 100, hw: size[0] / 2, hd: size[1] / 2, ax: [c, sn], az: [-sn, c] };
}

function footprintInside(p: Omit<Piece, 'id'>): boolean {
  const fp = footprint(p);
  if (fp === null) return true;
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const x = fp.cx + a * fp.hw * fp.ax[0] + b * fp.hd * fp.az[0], z = fp.cz + a * fp.hw * fp.ax[1] + b * fp.hd * fp.az[1];
    if (x < CELL_MARGIN || x > CELL - CELL_MARGIN || z < CELL_MARGIN || z > CELL - CELL_MARGIN) return false;
  }
  return true;
}

/** Whether two free fixtures' footprints overlap (separating axes; touching is fine). */
function footprintsOverlap(p: Omit<Piece, 'id'>, q: Omit<Piece, 'id'>): boolean {
  const a = footprint(p), b = footprint(q);
  if (a === null || b === null) return false;
  const dx = b.cx - a.cx, dz = b.cz - a.cz;
  for (const axis of [a.ax, a.az, b.ax, b.az]) {
    const ra = a.hw * Math.abs(a.ax[0] * axis[0] + a.ax[1] * axis[1]) + a.hd * Math.abs(a.az[0] * axis[0] + a.az[1] * axis[1]);
    const rb = b.hw * Math.abs(b.ax[0] * axis[0] + b.ax[1] * axis[1]) + b.hd * Math.abs(b.az[0] * axis[0] + b.az[1] * axis[1]);
    if (Math.abs(dx * axis[0] + dz * axis[1]) >= ra + rb - 1e-9) return false;
  }
  return true;
}

/** Whether a gable (on a rising side of a pitched roof) or a ridge cap (on the high edge of a roof or low roof) has its roof beside it. */
function roofFor(base: Base, piece: Omit<Piece, 'id'>): boolean {
  for (const [ci, cj] of edgeCells(piece.i, piece.j, piece.r)) {
    for (const p of base.pieces) {
      if (p.s !== piece.s || p.k !== piece.k || p.i !== ci || p.j !== cj) continue;
      const on = (sides: readonly Side[]): boolean => sides.some((side) => isEdge(sideEdge(ci, cj, side), piece.i, piece.j, piece.r));
      if (piece.kind === 'gable' && p.kind === 'roof' && on(roofSides(p.kind, p.r).sides)) return true;
      if (piece.kind === 'ridgeCap' && (p.kind === 'roof' || p.kind === 'lowRoof') && on(roofSides(p.kind, p.r).high)) return true;
    }
  }
  return false;
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

    if (existing.i === candidate.i && existing.j === candidate.j && footprintsOverlap(existing, candidate)) return true;
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
  ): void => {
    const sourceIndex = edges.get(edgeKey(s, i, j, k, r));
    if (sourceIndex === undefined) return;
    const source = pieces[sourceIndex];
    if (source !== undefined && CARRYING_EDGE_KINDS.includes(source.kind)) {
      addDependency(targetIndex, sourceIndex, vertical);
    }
  };

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
      if (piece.kind === 'roof' || piece.kind === 'lowRoof') {
        // back to back: the roof across the shared high edge (the ridge) holds this one up vertically
        for (const side of roofSides(piece.kind, piece.r).high) {
          const [ei, ej, er] = sideEdge(i, j, side);
          for (const [ci, cj] of edgeCells(ei, ej, er)) {
            if (ci === i && cj === j) continue;
            const across = cells.get(cellKey(s, ci, cj, k)), other = across === undefined ? undefined : pieces[across];
            if (other !== undefined && (other.kind === 'roof' || other.kind === 'lowRoof') && roofSides(other.kind, other.r).high.some((h) => isEdge(sideEdge(ci, cj, h), ei, ej, er))) {
              addDependency(targetIndex, across, true);
            }
          }
        }
      }
      if (piece.kind === 'roof') {
        // a gable under a rising side holds the roof up vertically
        for (const side of roofSides(piece.kind, piece.r).sides) {
          const [ei, ej, er] = sideEdge(i, j, side);
          const gable = edges.get(edgeKey(s, ei, ej, k, er));
          if (gable !== undefined && pieces[gable]?.kind === 'gable') addDependency(targetIndex, gable, true);
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
    piece.r < 0 ||
    piece.r > 3 ||
    !isKind(piece.kind)
  ) {
    return false;
  }
  if (isEdgeKind(piece.kind) && piece.r !== 0 && piece.r !== 1) return false;
  if (hasPlacement(piece)) {
    if (FOOTPRINT[piece.kind] === undefined) return false;
    const { dx, dz, deg } = piece;
    if (!Number.isInteger(dx) || !Number.isInteger(dz) || !Number.isInteger(deg)) return false;
    if (Math.abs(dx as number) > PLACE_LIMIT_CM || Math.abs(dz as number) > PLACE_LIMIT_CM || (deg as number) < 0 || (deg as number) > 359) return false;
  }
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

/** A quantised value as the codec decodes it: the integer count over its scale. */
const mm = (count: number, scale: number): number => count / scale;

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

  // the pose is kept on the codec's grid (1 mm, 0.0001 rad, yaw in [-PI, PI]), so decode(encode(base)) is exact
  const turn = mm(Math.max(-CODEC_MAX_YAW_Q, Math.min(CODEC_MAX_YAW_Q, Math.round(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 10000))), 10000);
  const cosine = Math.cos(turn);
  const sine = Math.sin(turn);
  const structure: Structure = {
    id: base.nextId,
    x: mm(Math.round((cx - (CELL / 2) * cosine + (CELL / 2) * sine) * 1000), 1000),
    y: 0,
    z: mm(Math.round((cz - (CELL / 2) * sine - (CELL / 2) * cosine) * 1000), 1000),
    yaw: turn,
  };
  const extents = extentsAtCell(env, structure, 0, 0);
  if (extents.highest - extents.lowest > SKIRT) {
    return { ok: false, why: 'steep', base, id: -1 };
  }
  const placedStructure: Structure = { ...structure, y: mm(Math.round(extents.highest * 1000), 1000) };
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
  if (!footprintInside(piece)) return { ok: false, why: 'no-room', support: 0 };
  if (occupied(base, piece)) return { ok: false, why: 'occupied', support: 0 };
  if (isEdgeKind(piece.kind) && roofEaveAt(base, piece.s, piece.i, piece.j, piece.k, piece.r)) {
    return { ok: false, why: 'occupied', support: 0 };
  }
  if (isRoofKind(piece.kind)) {
    for (const side of roofSides(piece.kind, piece.r).low) {
      const [ei, ej, er] = sideEdge(piece.i, piece.j, side);
      const taken = base.pieces.some((p) => p.s === piece.s && p.k === piece.k && isEdgeKind(p.kind) && p.i === ei && p.j === ej && p.r === er);
      if (taken) return { ok: false, why: 'occupied', support: 0 };
    }
  }
  if ((piece.kind === 'gable' || piece.kind === 'ridgeCap') && !roofFor(base, piece)) {
    return { ok: false, why: 'no-roof', support: 0 };
  }

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
    piece.kind === 'repeater' ||
    piece.kind === 'lifeSupport'
  ) {
    const hasFloor = base.pieces.some(
      (existing) =>
        (piece.kind === 'lifeSupport'
          ? existing.kind === 'foundation' || existing.kind === 'floor'
          : isCellKind(existing.kind) && !isRoofKind(existing.kind)) &&
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

  const placed: Piece = piece.kind === 'airlock' || piece.kind === 'door'
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
        ...(hasPlacement(piece) ? { dx: piece.dx, dz: piece.dz, deg: piece.deg } : {}),
      };
  const nextBase: Base = {
    ...base,
    pieces: addPieceInIdOrder(base.pieces, placed),
    nextId: base.nextId + 1,
  };
  return { ok: true, why: '', base: nextBase, id: placed.id };
}

/**
 * The roof a gable or ridge cap belongs to (the renderer turns a gable to rise toward its roof's high side), and a roof
 * cell's sides: which of '+z' | '-x' | '-z' | '+x' are its high edges, its eaves and its rising sides for its kind and r.
 */
export function roofOf(base: Base, piece: Piece): Piece | null {
  if (piece.kind !== 'gable' && piece.kind !== 'ridgeCap') return null;
  for (const [ci, cj] of edgeCells(piece.i, piece.j, piece.r)) {
    for (const p of base.pieces) {
      if (p.s !== piece.s || p.k !== piece.k || p.i !== ci || p.j !== cj) continue;
      const list = piece.kind === 'gable' ? (p.kind === 'roof' ? roofSides(p.kind, p.r).sides : []) : p.kind === 'roof' || p.kind === 'lowRoof' ? roofSides(p.kind, p.r).high : [];
      if (list.some((side) => isEdge(sideEdge(ci, cj, side), piece.i, piece.j, piece.r))) return p;
    }
  }
  return null;
}

export const roofSidesOf = (kind: Kind, r: number): { readonly high: readonly string[]; readonly low: readonly string[]; readonly sides: readonly string[] } => roofSides(kind, r);

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
  if (piece === undefined || (piece.kind !== 'airlock' && piece.kind !== 'door')) return base;
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
    piecesAtSide(cell, side).some((piece) =>
      piece.kind === 'wall' ||
      piece.kind === 'windowWall' ||
      ((piece.kind === 'airlock' || piece.kind === 'door') && piece.open !== true),
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
    const doorIds = new Set<number>();
    let sealed = true;
    for (const cell of group) {
      for (const side of roomSides(cell)) {
        const edge = piecesAtSide(cell, side);
        for (const piece of edge) {
          if (piece.kind === 'airlock') airlockIds.add(piece.id);
          if (piece.kind === 'door') doorIds.add(piece.id);
        }
        const neighborKey = cellKey(cell.s, side.i, side.j, cell.k);
        if (!isBarrier(cell, side) && !groupKeys.has(neighborKey)) sealed = false;
      }
    }

    group.sort((a, b) => a.i - b.i || a.j - b.j);
    const lifeSupportIds = base.pieces
      .filter(
        (piece) =>
          piece.kind === 'lifeSupport' &&
          groupKeys.has(cellKey(piece.s, piece.i, piece.j, piece.k)),
      )
      .map((piece) => piece.id)
      .sort((a, b) => a - b);
    const room = Object.defineProperties(
      {
        s: seed.s,
        k: seed.k,
        cells: group.map((cell): [number, number] => [cell.i, cell.j]),
        sealed,
        airlocks: [...airlockIds].sort((a, b) => a - b),
      },
      {
        doors: { value: [...doorIds].sort((a, b) => a - b), enumerable: false },
        lifeSupport: { value: lifeSupportIds, enumerable: false },
      },
    ) as Room;
    result.push(room);
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
        if (isEdgeKind(kind)) {
          append(i, j, 0, (i + 0.5) * CELL, j * CELL);
          append(i, j, 1, i * CELL, (j + 0.5) * CELL);
        } else if (kind === 'pillar') {
          append(i, j, 0, i * CELL, j * CELL);
        } else if (kind === 'hardpoint') {
          append(i, j, rotation, (i + 1) * CELL, (j + 1) * CELL);
        } else {
          const r = kind === 'ramp' || kind === 'stairs' || isRoofKind(kind) || isFixtureKind(kind) ? rotation : 0;
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

const CODEC_MAGIC_0 = 0x48;
const CODEC_MAGIC_1 = 0x4d;
const CODEC_VERSION_V1 = 1;
const CODEC_VERSION_V2 = 2;
const CODEC_MAX_ID = 2 ** 31;
const CODEC_MAX_ID_DELTA = CODEC_MAX_ID - 1;
const CODEC_MAX_UVARINT = 2 ** 32 - 1;
const CODEC_MAX_COORD_MM = LIMITS.coord * 1000;
const CODEC_MAX_YAW_Q = Math.floor(Math.PI * 10000);
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const MATERIAL_PATTERN = /^[a-z0-9-]{1,24}$/;
const CODEC_KINDS_V1: readonly Kind[] = [
  'foundation',
  'floor',
  'ramp',
  'wall',
  'airlock',
  'pillar',
  'hardpoint',
  'bin',
  'bench',
  'repeater',
];
const CODEC_KINDS: readonly Kind[] = [
  ...CODEC_KINDS_V1,
  'halfWall',
  'windowWall',
  'doorframe',
  'door',
  'railing',
  'ladder',
  'stairs',
  'lifeSupport',
  'roof',
  'lowRoof',
  'roofOuter',
  'roofInner',
  'gable',
  'ridgeCap',
];

function codecValidationError(
  base: Base,
  allowedKinds: readonly Kind[] = CODEC_KINDS,
): string {
  if (typeof base !== 'object' || base === null) return 'bad-base';
  if (base.v !== 1) return 'bad-version';
  if (!Array.isArray(base.structures) || !Array.isArray(base.pieces)) return 'bad-arrays';
  if (base.structures.length > LIMITS.maxStructures) return 'too-many-structures';
  if (base.pieces.length > LIMITS.maxPieces) return 'too-many-pieces';
  if (
    !Number.isInteger(base.nextId) ||
    base.nextId < 0 ||
    base.nextId > CODEC_MAX_ID
  ) {
    return 'bad-next-id';
  }

  const ids = new Set<number>();
  const structureIds = new Set<number>();
  for (const structure of base.structures) {
    if (typeof structure !== 'object' || structure === null) return 'bad-structure';
    if (!Number.isInteger(structure.id) || structure.id < 0 || structure.id >= base.nextId) {
      return 'bad-id';
    }
    if (ids.has(structure.id)) return 'duplicate-id';
    ids.add(structure.id);
    structureIds.add(structure.id);
    if (
      !Number.isFinite(structure.x) ||
      !Number.isFinite(structure.y) ||
      !Number.isFinite(structure.z) ||
      Math.abs(structure.x) > LIMITS.coord ||
      Math.abs(structure.y) > LIMITS.coord ||
      Math.abs(structure.z) > LIMITS.coord
    ) {
      return 'bad-coordinate';
    }
    if (
      !Number.isFinite(structure.yaw) ||
      structure.yaw < -Math.PI ||
      structure.yaw > Math.PI
    ) {
      return 'bad-yaw';
    }
  }

  const materials = new Set<string>();
  const cellSlots = new Set<string>();
  const edgeSlots = new Set<string>();
  const pillarSlots = new Set<string>();
  const fixtureSlots = new Set<string>();
  const hardpointSpots = new Set<string>();

  for (const piece of base.pieces) {
    if (typeof piece !== 'object' || piece === null) return 'bad-piece';
    if (!Number.isInteger(piece.id) || piece.id < 0 || piece.id >= base.nextId) {
      return 'bad-id';
    }
    if (ids.has(piece.id)) return 'duplicate-id';
    ids.add(piece.id);
    if (!Number.isInteger(piece.s) || !structureIds.has(piece.s)) return 'bad-structure-id';
    if (!isKind(piece.kind) || !allowedKinds.includes(piece.kind)) return 'bad-kind';
    if (
      !Number.isInteger(piece.i) ||
      !Number.isInteger(piece.j) ||
      Math.abs(piece.i) > LIMITS.cell ||
      Math.abs(piece.j) > LIMITS.cell ||
      !Number.isInteger(piece.k) ||
      piece.k < 0 ||
      piece.k > LIMITS.maxLevel
    ) {
      return 'bad-cell';
    }
    const maxRotation = isEdgeKind(piece.kind) ? 1 : 3;
    if (!Number.isInteger(piece.r) || piece.r < 0 || piece.r > maxRotation) {
      return 'bad-rotation';
    }
    if (piece.kind === 'airlock' || piece.kind === 'door') {
      if (piece.open !== undefined && typeof piece.open !== 'boolean') return 'bad-open';
    } else if (piece.open !== undefined) {
      return 'bad-open';
    }
    if (typeof piece.mat !== 'string' || !MATERIAL_PATTERN.test(piece.mat)) {
      return 'bad-material';
    }
    materials.add(piece.mat);
    if (materials.size > LIMITS.maxMats) return 'too-many-materials';

    if (isCellKind(piece.kind)) {
      const key = cellKey(piece.s, piece.i, piece.j, piece.k);
      if (cellSlots.has(key)) return 'duplicate-slot';
      cellSlots.add(key);
      continue;
    }

    if (isEdgeKind(piece.kind)) {
      const key = edgeKey(piece.s, piece.i, piece.j, piece.k, piece.r);
      if (edgeSlots.has(key)) return 'duplicate-slot';
      edgeSlots.add(key);
      continue;
    }

    if (piece.kind === 'pillar') {
      const key = pillarKey(piece.s, piece.i, piece.j, piece.k);
      if (pillarSlots.has(key)) return 'duplicate-slot';
      pillarSlots.add(key);
      continue;
    }

    if (piece.kind === 'hardpoint') {
      for (let di = 0; di <= 1; di += 1) {
        for (let dj = 0; dj <= 1; dj += 1) {
          const key = cellKey(piece.s, piece.i + di, piece.j + dj, piece.k);
          if (fixtureSlots.has(key) || hardpointSpots.has(key)) return 'duplicate-slot';
        }
      }
      for (let di = 0; di <= 1; di += 1) {
        for (let dj = 0; dj <= 1; dj += 1) {
          hardpointSpots.add(cellKey(piece.s, piece.i + di, piece.j + dj, piece.k));
        }
      }
      continue;
    }

    const key = cellKey(piece.s, piece.i, piece.j, piece.k);
    if (fixtureSlots.has(key) || hardpointSpots.has(key)) return 'duplicate-slot';
    fixtureSlots.add(key);
  }

  return '';
}

function writeUnsigned(bytes: number[], value: number): void {
  let remaining = value;
  while (remaining >= 128) {
    const low = remaining % 128;
    bytes.push(low + 128);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining);
}

function writeSigned(bytes: number[], value: number): void {
  writeUnsigned(bytes, value >= 0 ? value * 2 : -value * 2 - 1);
}

function base64UrlEncode(bytes: readonly number[]): string {
  const result: string[] = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const block = first * 65536 + second * 256 + third;
    result.push(BASE64URL.charAt(Math.floor(block / 262144)));
    result.push(BASE64URL.charAt(Math.floor(block / 4096) % 64));
    if (index + 1 < bytes.length) {
      result.push(BASE64URL.charAt(Math.floor(block / 64) % 64));
    }
    if (index + 2 < bytes.length) result.push(BASE64URL.charAt(block % 64));
  }
  return result.join('');
}

function base64UrlDecode(text: string): number[] | null {
  if (text.length % 4 === 1) return null;
  const bytes: number[] = [];
  let offset = 0;
  while (offset + 4 <= text.length) {
    const a = BASE64URL.indexOf(text.charAt(offset));
    const b = BASE64URL.indexOf(text.charAt(offset + 1));
    const c = BASE64URL.indexOf(text.charAt(offset + 2));
    const d = BASE64URL.indexOf(text.charAt(offset + 3));
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;
    const block = a * 262144 + b * 4096 + c * 64 + d;
    bytes.push(Math.floor(block / 65536), Math.floor(block / 256) % 256, block % 256);
    offset += 4;
  }

  const remaining = text.length - offset;
  if (remaining === 2) {
    const a = BASE64URL.indexOf(text.charAt(offset));
    const b = BASE64URL.indexOf(text.charAt(offset + 1));
    if (a < 0 || b < 0) return null;
    bytes.push(Math.floor((a * 64 + b) / 16));
  } else if (remaining === 3) {
    const a = BASE64URL.indexOf(text.charAt(offset));
    const b = BASE64URL.indexOf(text.charAt(offset + 1));
    const c = BASE64URL.indexOf(text.charAt(offset + 2));
    if (a < 0 || b < 0 || c < 0) return null;
    // three characters carry 18 bits: two bytes and two zero bits (the re-encode check refuses non-zero ones)
    const block = a * 4096 + b * 64 + c;
    bytes.push(Math.floor(block / 1024), Math.floor(block / 4) % 256);
  }
  return bytes;
}

function quantizedYaw(yaw: number): number {
  const rounded = Math.round(yaw * 10000);
  return Math.max(-CODEC_MAX_YAW_Q, Math.min(CODEC_MAX_YAW_Q, rounded));
}

function encodeBaseVersion(base: Base, version: 1 | 2): string {
  const allowedKinds = version === CODEC_VERSION_V1 ? CODEC_KINDS_V1 : CODEC_KINDS;
  const why = codecValidationError(base, allowedKinds);
  if (why !== '') throw new Error(why);

  const bytes: number[] = [CODEC_MAGIC_0, CODEC_MAGIC_1, version];
  writeUnsigned(bytes, base.nextId);
  writeUnsigned(bytes, base.structures.length);

  let previousStructureId = 0;
  for (const structure of base.structures) {
    writeSigned(bytes, structure.id - previousStructureId);
    previousStructureId = structure.id;
    writeSigned(bytes, Math.round(structure.x * 1000));
    writeSigned(bytes, Math.round(structure.y * 1000));
    writeSigned(bytes, Math.round(structure.z * 1000));
    writeSigned(bytes, quantizedYaw(structure.yaw));
  }

  const materials = [...new Set(base.pieces.map((piece) => piece.mat))].sort();
  const materialIndices = new Map<string, number>();
  writeUnsigned(bytes, materials.length);
  for (let index = 0; index < materials.length; index += 1) {
    const material = materials[index];
    if (material === undefined) throw new Error('bad-material-table');
    materialIndices.set(material, index);
    writeUnsigned(bytes, material.length);
    for (let charIndex = 0; charIndex < material.length; charIndex += 1) {
      bytes.push(material.charCodeAt(charIndex));
    }
  }

  const structureIndices = new Map<number, number>();
  for (let index = 0; index < base.structures.length; index += 1) {
    const structure = base.structures[index];
    if (structure !== undefined) structureIndices.set(structure.id, index);
  }

  writeUnsigned(bytes, base.pieces.length);
  let previousPieceId = 0;
  for (const piece of base.pieces) {
    const structureIndex = structureIndices.get(piece.s);
    const materialIndex = materialIndices.get(piece.mat);
    const kinds = version === CODEC_VERSION_V1 ? CODEC_KINDS_V1 : CODEC_KINDS;
    const kindIndex = kinds.indexOf(piece.kind);
    if (structureIndex === undefined || materialIndex === undefined || kindIndex < 0) {
      throw new Error('bad-piece-reference');
    }

    writeSigned(bytes, piece.id - previousPieceId);
    previousPieceId = piece.id;
    writeUnsigned(bytes, structureIndex);
    if (version === CODEC_VERSION_V1) {
      bytes.push(kindIndex + piece.r * 16 + (piece.open === true ? 64 : 0));
    } else {
      writeUnsigned(bytes, kindIndex);
      bytes.push(piece.r + (piece.open === true ? 4 : 0));
    }
    writeSigned(bytes, piece.i);
    writeSigned(bytes, piece.j);
    writeUnsigned(bytes, piece.k);
    writeUnsigned(bytes, materialIndex);
  }

  const text = base64UrlEncode(bytes);
  if (text.length > LIMITS.maxChars) throw new Error('too-many-characters');
  return text;
}

function encodeBase(base: Base): string {
  return encodeBaseVersion(base, CODEC_VERSION_V2);
}

export function encode(base: Base): string {
  try {
    return encodeBase(base);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('invalid-base');
  }
}

export function decode(text: string): Base | null {
  try {
    if (typeof text !== 'string' || text.length > LIMITS.maxChars) return null;
    if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
    const bytes = base64UrlDecode(text);
    if (bytes === null || base64UrlEncode(bytes) !== text) return null;
    const version = bytes[2];
    if (
      bytes.length < 3 ||
      bytes[0] !== CODEC_MAGIC_0 ||
      bytes[1] !== CODEC_MAGIC_1 ||
      (version !== CODEC_VERSION_V1 && version !== CODEC_VERSION_V2)
    ) {
      return null;
    }

    let offset = 3;
    const readByte = (): number | undefined => {
      const value = bytes[offset];
      if (value === undefined) return undefined;
      offset += 1;
      return value;
    };
    const readUnsigned = (maximum = CODEC_MAX_UVARINT): number | undefined => {
      if (maximum < 0) return undefined;
      let value = 0;
      let multiplier = 1;
      for (let count = 0; count < 5; count += 1) {
        const byte = readByte();
        if (byte === undefined) return undefined;
        value += (byte % 128) * multiplier;
        if (value > maximum) return undefined;
        if (byte < 128) return value;
        multiplier *= 128;
      }
      return undefined;
    };
    const readSigned = (maximumAbsolute: number): number | undefined => {
      const encoded = readUnsigned(maximumAbsolute * 2 + 1);
      if (encoded === undefined) return undefined;
      return encoded % 2 === 0 ? encoded / 2 : -(encoded + 1) / 2;
    };

    const nextId = readUnsigned(CODEC_MAX_ID);
    const structureCount = readUnsigned(LIMITS.maxStructures);
    if (nextId === undefined || structureCount === undefined) return null;

    const structures: Structure[] = [];
    let previousStructureId = 0;
    for (let index = 0; index < structureCount; index += 1) {
      const delta = readSigned(CODEC_MAX_ID_DELTA);
      const x = readSigned(CODEC_MAX_COORD_MM);
      const y = readSigned(CODEC_MAX_COORD_MM);
      const z = readSigned(CODEC_MAX_COORD_MM);
      const yaw = readSigned(CODEC_MAX_YAW_Q);
      if (
        delta === undefined ||
        x === undefined ||
        y === undefined ||
        z === undefined ||
        yaw === undefined
      ) {
        return null;
      }
      const id = previousStructureId + delta;
      if (!Number.isInteger(id) || id < 0 || id >= CODEC_MAX_ID) return null;
      previousStructureId = id;
      structures.push({ id, x: x / 1000, y: y / 1000, z: z / 1000, yaw: yaw / 10000 });
    }

    const materialCount = readUnsigned(LIMITS.maxMats);
    if (materialCount === undefined) return null;
    const materials: string[] = [];
    for (let index = 0; index < materialCount; index += 1) {
      const length = readUnsigned(24);
      if (length === undefined || length < 1 || offset + length > bytes.length) return null;
      let material = '';
      for (let charIndex = 0; charIndex < length; charIndex += 1) {
        const code = readByte();
        if (code === undefined) return null;
        material += String.fromCharCode(code);
      }
      if (!MATERIAL_PATTERN.test(material)) return null;
      materials.push(material);
    }

    const pieceCount = readUnsigned(LIMITS.maxPieces);
    if (pieceCount === undefined) return null;
    if (pieceCount > 0 && (structureCount === 0 || materialCount === 0)) return null;

    const pieces: Piece[] = [];
    let previousPieceId = 0;
    for (let index = 0; index < pieceCount; index += 1) {
      const delta = readSigned(CODEC_MAX_ID_DELTA);
      const structureIndex = readUnsigned(structureCount - 1);
      let kindIndex: number | undefined;
      let rotation: number | undefined;
      let isOpen = false;
      if (version === CODEC_VERSION_V1) {
        const metadata = readByte();
        if (metadata === undefined || metadata >= 128) return null;
        kindIndex = metadata % 16;
        rotation = Math.floor(metadata / 16) % 4;
        isOpen = Math.floor(metadata / 64) % 2 === 1;
      } else {
        kindIndex = readUnsigned(CODEC_KINDS.length - 1);
        const flags = readByte();
        if (flags === undefined || flags >= 8) return null;
        rotation = flags % 4;
        isOpen = flags >= 4;
      }
      const i = readSigned(LIMITS.cell);
      const j = readSigned(LIMITS.cell);
      const k = readUnsigned(LIMITS.maxLevel);
      const materialIndex = readUnsigned(materialCount - 1);
      if (
        delta === undefined ||
        structureIndex === undefined ||
        kindIndex === undefined ||
        rotation === undefined ||
        i === undefined ||
        j === undefined ||
        k === undefined ||
        materialIndex === undefined
      ) {
        return null;
      }

      const kinds = version === CODEC_VERSION_V1 ? CODEC_KINDS_V1 : CODEC_KINDS;
      const kind = kinds[kindIndex];
      const structure = structures[structureIndex];
      const mat = materials[materialIndex];
      const id = previousPieceId + delta;
      if (
        kind === undefined ||
        structure === undefined ||
        mat === undefined ||
        !Number.isInteger(id) ||
        id < 0 ||
        id >= CODEC_MAX_ID ||
        (isOpen && kind !== 'airlock' && kind !== 'door') ||
        (isEdgeKind(kind) && rotation > 1)
      ) {
        return null;
      }
      previousPieceId = id;
      pieces.push(isOpen
        ? { id, s: structure.id, kind, i, j, k, r: rotation as Piece['r'], mat, open: true }
        : { id, s: structure.id, kind, i, j, k, r: rotation as Piece['r'], mat });
    }

    if (offset !== bytes.length) return null;
    const base: Base = { v: 1, structures, pieces, nextId };
    const allowedKinds = version === CODEC_VERSION_V1 ? CODEC_KINDS_V1 : CODEC_KINDS;
    if (codecValidationError(base, allowedKinds) !== '') return null;
    return encodeBaseVersion(base, version) === text ? base : null;
  } catch {
    return null;
  }
}
