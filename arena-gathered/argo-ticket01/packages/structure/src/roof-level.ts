// ============================================================================
// File: packages/structure/src/roof-level.ts
// Pure helper for BB-07: roofLevel(base, s, i, j) returns 1 + the highest k
// of any edge piece around cell (i, j), minimum 1.
// In snap() (packages/structure/src/index.ts), roof kinds use:
//   k = Math.max(k, roofLevel(base, s, i, j));
// Zero external dependencies; 100% strict (noUncheckedIndexedAccess) compliant.
// ============================================================================

import type { Base } from './index';

interface PieceLike {
  kind?: string;
  slot?: string;
  type?: string;
  i?: number;
  j?: number;
  k?: number;
  x?: number;
  z?: number;
  y?: number;
  level?: number;
  side?: number | string;
  edge?: number | string;
  dir?: number | string;
  rot?: number;
  axis?: string;
}

interface StructureLike {
  pieces?: readonly PieceLike[] | Record<string, PieceLike>;
  edges?: readonly PieceLike[] | Record<string, PieceLike>;
  cells?: readonly PieceLike[] | Record<string, PieceLike>;
}

interface BaseLike {
  structures?: readonly StructureLike[];
  pieces?: readonly PieceLike[];
}

const EDGE_KINDS = new Set<string>([
  'wall',
  'window',
  'windowWall',
  'wallWindow',
  'door',
  'doorway',
  'wallDoor',
  'arch',
  'railing',
  'halfWall',
]);

export function isRoofKind(kind: string): boolean {
  return kind === 'roof' || kind === 'ceiling' || kind === 'roofSlab' || kind === 'roofTile';
}

function isEdgePiece(p: PieceLike): boolean {
  if (typeof p.slot === 'string') {
    return p.slot === 'edge' || p.slot === 'wall';
  }
  const kindStr = p.kind ?? p.type ?? '';
  if (EDGE_KINDS.has(kindStr)) {
    return true;
  }
  return p.side !== undefined || p.edge !== undefined || p.axis !== undefined;
}

/**
 * Checks whether an edge piece `p` lies on one of the 4 edges surrounding cell (i, j).
 * Handles:
 * 1. Direct cell ownership: (pi === i && pj === j)
 * 2. Canonical shared axis edges: X/North edge on (i, j+1), Z/West edge on (i+1, j)
 * 3. Cardinal 4-side neighbor ownership: neighbor at (i±1, j) or (i, j±1) whose side
 *    faces the shared boundary with (i, j).
 */
function edgePieceTouchesCell(p: PieceLike, i: number, j: number): boolean {
  const pi = p.i ?? p.x;
  const pj = p.j ?? p.z;
  if (typeof pi !== 'number' || typeof pj !== 'number') {
    return false;
  }

  if (pi === i && pj === j) {
    return true;
  }

  const tag = p.edge ?? p.side ?? p.dir ?? p.axis ?? p.rot;

  // Canonical 2-edge-per-cell storage: cell (i, j+1) owns the +j (south/horizontal) edge of (i, j),
  // and cell (i+1, j) owns the +i (east/vertical) edge of (i, j).
  if (pi === i && pj === j + 1) {
    if (
      tag === 'x' ||
      tag === 'h' ||
      tag === 'n' ||
      tag === 'north' ||
      tag === '-z' ||
      tag === 0
    ) {
      return true;
    }
  }
  if (pi === i + 1 && pj === j) {
    if (
      tag === 'z' ||
      tag === 'v' ||
      tag === 'w' ||
      tag === 'west' ||
      tag === '-x' ||
      tag === 3 ||
      tag === 1
    ) {
      return true;
    }
  }
  if (pi === i && pj === j - 1) {
    if (tag === 's' || tag === 'south' || tag === '+z' || tag === 2) {
      return true;
    }
  }
  if (pi === i - 1 && pj === j) {
    if (tag === 'e' || tag === 'east' || tag === '+x' || tag === 1) {
      return true;
    }
  }

  return false;
}

function collectPieces(struct: StructureLike | undefined, fallbackPieces?: readonly PieceLike[]): PieceLike[] {
  const out: PieceLike[] = [];
  if (struct) {
    const sources = [struct.pieces, struct.edges];
    for (let idx = 0; idx < sources.length; idx++) {
      const src = sources[idx];
      if (!src) continue;
      if (Array.isArray(src)) {
        for (let m = 0; m < src.length; m++) {
          const item = src[m];
          if (item) out.push(item);
        }
      } else {
        const vals = Object.values(src);
        for (let m = 0; m < vals.length; m++) {
          const item = vals[m];
          if (item) out.push(item);
        }
      }
    }
  }
  if (out.length === 0 && fallbackPieces) {
    for (let m = 0; m < fallbackPieces.length; m++) {
      const item = fallbackPieces[m];
      if (item) out.push(item);
    }
  }
  return out;
}

/**
 * Computes the roof elevation level for cell (i, j) in structure `s` of `base`:
 * Returns `1 +` the highest `k` of any edge piece around cell `(i, j)`, minimum `1`.
 */
export function roofLevel(base: Base, s: number, i: number, j: number): number {
  const b = base as unknown as BaseLike;
  const struct = b.structures ? b.structures[s] : undefined;
  const pieces = collectPieces(struct, b.pieces);

  let highestEdgeK = 0;
  let foundEdge = false;

  for (let idx = 0; idx < pieces.length; idx++) {
    const p = pieces[idx];
    if (!p || !isEdgePiece(p)) continue;
    if (!edgePieceTouchesCell(p, i, j)) continue;

    const pk = p.k ?? p.level ?? p.y ?? 0;
    if (!foundEdge || pk > highestEdgeK) {
      highestEdgeK = pk;
      foundEdge = true;
    }
  }

  return foundEdge ? Math.max(1, 1 + highestEdgeK) : 1;
}
