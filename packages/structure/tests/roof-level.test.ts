// ============================================================================
// File: packages/structure/tests/roof-level.test.ts
// Unit tests for roofLevel(base, s, i, j) (TICKET-01 Part E / BB-07), on the real Base and Piece shapes:
// a foundation and 4 walls at cell (0,0) with aim at y=0 snap the roof to k = 1 (never ankle-level k = 0);
// second-story walls lift it to 1 + maxK; other structures and walls on other cells do not count.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { roofLevel, isRoofKind } from '../src/roof-level';
import { empty, found, place, snap } from '../src/index';
import type { Base, Piece } from '../src/index';

function baseWith(pieces: Piece[], structureIds: number[] = [0]): Base {
  return {
    v: 1,
    structures: structureIds.map((id) => ({ id, x: 0, y: 0, z: 0, yaw: 0 })),
    pieces,
    nextId: pieces.length + 1,
  };
}

function piece(id: number, s: number, kind: Piece['kind'], i: number, j: number, k: number, r: 0 | 1 | 2 | 3 = 0): Piece {
  return { id, s, kind, i, j, k, r, mat: 'test' };
}

test('foundation and 4 walls at cell (0,0) with aim at y=0 snaps roof to k = 1', () => {
  const base = baseWith([
    piece(1, 0, 'foundation', 0, 0, 0),
    piece(2, 0, 'wall', 0, 0, 0, 0),
    piece(3, 0, 'wall', 0, 0, 0, 1),
    piece(4, 0, 'wall', 0, 1, 0, 0),
    piece(5, 0, 'wall', 1, 0, 0, 1),
  ]);

  const aimY = 0;
  const LEVEL = 3.0;
  let k = Math.max(0, Math.round((aimY - 0) / LEVEL)); // 0 when aiming at the floor
  assert.equal(k, 0);

  assert.ok(isRoofKind('roof'));
  k = Math.max(k, roofLevel(base, 0, 0, 0));
  assert.equal(k, 1, 'Expected roof level k = 1 on top of 4 k=0 walls when aiming at y=0');
});

test('roofLevel lifts for second-story walls on shared edges (k = 1 -> roof k = 2) and ignores other cells and structures', () => {
  const base = baseWith(
    [
      piece(1, 0, 'foundation', 0, 0, 0),
      // East wall of cell (0,0) stored as the low-i edge of cell (1,0), second story
      piece(2, 0, 'windowWall', 1, 0, 1, 1),
      // South wall of cell (0,0) stored as the low-j edge of cell (0,1), first story
      piece(3, 0, 'door', 0, 1, 0, 0),
    ],
    [0, 1],
  );
  assert.equal(roofLevel(base, 0, 0, 0), 2);

  // The same wall, on a different structure id, does not count for structure 0
  const otherStructure = baseWith([piece(1, 0, 'foundation', 0, 0, 0), piece(2, 1, 'wall', 0, 0, 1, 0)], [0, 1]);
  assert.equal(roofLevel(otherStructure, 0, 0, 0), 1);
  assert.equal(roofLevel(otherStructure, 1, 0, 0), 2);

  // A wall on the far side of the neighbour (low-i edge of cell (-1,0)) does not touch cell (0,0)
  const farSide = baseWith([piece(1, 0, 'foundation', 0, 0, 0), piece(2, 0, 'wall', -1, 0, 2, 1)]);
  assert.equal(roofLevel(farSide, 0, 0, 0), 1);

  // A gable or ridge cap on an edge is not a carrying wall
  const gable = baseWith([piece(1, 0, 'foundation', 0, 0, 0), piece(2, 0, 'gable', 0, 0, 1, 0)]);
  assert.equal(roofLevel(gable, 0, 0, 0), 1);

  // Bare foundation with zero walls still enforces minimum k = 1
  assert.equal(roofLevel(baseWith([piece(1, 0, 'foundation', 0, 0, 0)]), 0, 0, 0), 1);
});

test('isRoofKind covers the four roof kinds only', () => {
  for (const kind of ['roof', 'lowRoof', 'roofOuter', 'roofInner']) assert.ok(isRoofKind(kind), kind);
  for (const kind of ['wall', 'gable', 'ridgeCap', 'foundation', 'ramp']) assert.ok(!isRoofKind(kind), kind);
});

test('a roof snapped while aiming at floor height lands at k = 1 (BB-07, through snap)', () => {
  const env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 } } };
  let b = found(empty(), env, 2, 2, 0, 'reg').base;
  const s = b.structures[0]!.id;
  for (const [i, j, r] of [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1]] as const) {
    const res = place(b, env, { s, kind: 'wall', i, j, k: 0, r, mat: 'reg' });
    assert.ok(res.ok, res.why);
    b = res.base;
  }
  const st = b.structures[0]!;
  const snapped = snap(b, env, 'roof', { x: st.x + 2, y: 0, z: st.z + 2, yaw: st.yaw }, 'reg');
  assert.ok(snapped && snapped.mode === 'place', 'the roof snaps onto the cell');
  assert.equal(snapped.piece.k, 1, `roof level ${snapped.piece.k}, verdict ${snapped.why}`);
  assert.ok(snapped.ok, snapped.why);
});
