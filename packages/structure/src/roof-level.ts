// ============================================================================
// File: packages/structure/src/roof-level.ts
// Roof elevation for BB-07 (TICKET-01 Part E). roofLevel(base, s, i, j) is 1 plus the highest k of any
// carrying edge of structure s that touches cell (i, j), and never below 1. snap() in index.ts applies it to
// roof kinds only: k = max(k, roofLevel(base, s, i, j)).
// Edge storage (snap in index.ts): an edge at (i, j) with r = 0 lies on the cell's low-j side, so it touches
// cells (i, j) and (i, j - 1); with r = 1 it lies on the low-i side, touching (i, j) and (i - 1, j).
// So cell (i, j) is touched by r = 0 pieces at (i, j) or (i, j + 1), and by r = 1 pieces at (i, j) or (i + 1, j).
// Zero external dependencies; 100% strict (noUncheckedIndexedAccess) compliant.
// ============================================================================

import type { Base, Piece } from './index';

/** The same four kinds as ROOF_KINDS in index.ts. */
export function isRoofKind(kind: string): boolean {
  return kind === 'roof' || kind === 'lowRoof' || kind === 'roofOuter' || kind === 'roofInner';
}

/** The edges a roof rests on: the same kinds as CARRYING_EDGE_KINDS in index.ts (gables and caps sit on the roof, not under it). */
const CARRYING_EDGE_KINDS: ReadonlySet<string> = new Set(['wall', 'airlock', 'windowWall', 'doorframe', 'door']);

function touchesCell(p: Piece, i: number, j: number): boolean {
  if (p.i === i && p.j === j) return true;
  if (p.r === 0) return p.i === i && p.j === j + 1;
  if (p.r === 1) return p.i === i + 1 && p.j === j;
  return false;
}

/**
 * Roof elevation for cell (i, j) of structure s: 1 + the highest k of the carrying edges around it, minimum 1.
 * A bare foundation (no walls) gives 1.
 */
export function roofLevel(base: Base, s: number, i: number, j: number): number {
  let level = 1;
  for (const p of base.pieces) {
    if (p.s !== s || !CARRYING_EDGE_KINDS.has(p.kind) || !touchesCell(p, i, j)) continue;
    level = Math.max(level, 1 + p.k);
  }
  return level;
}
