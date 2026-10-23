// ============================================================================
// File: packages/structure/tests/roof-level.test.ts
// Unit tests for roofLevel(base, s, i, j) (TICKET-01 Part E / BB-07):
// Verifies that a foundation and 4 walls at cell (0,0) with aim at y=0 snaps
// the roof to k = 1 (never ankle-level k = 0), and multi-story walls snap to 1 + maxK.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { roofLevel, isRoofKind } from '../src/roof-level';
import type { Base } from '../src/index';

test('foundation and 4 walls at cell (0,0) with aim at y=0 snaps roof to k = 1', () => {
  const mockBase = {
    structures: [
      {
        y: 0,
        pieces: [
          { kind: 'foundation', i: 0, j: 0, k: 0 },
          { kind: 'wall', i: 0, j: 0, k: 0, side: 0 },
          { kind: 'wall', i: 0, j: 0, k: 0, side: 1 },
          { kind: 'wall', i: 0, j: 0, k: 0, side: 2 },
          { kind: 'wall', i: 0, j: 0, k: 0, side: 3 },
        ],
      },
    ],
  } as unknown as Base;

  const aimY = 0;
  const LEVEL = 3.0;
  let k = Math.round((aimY - 0) / LEVEL); // 0 when aiming at the floor
  assert.equal(k, 0);

  if (isRoofKind('roof')) {
    k = Math.max(k, roofLevel(mockBase, 0, 0, 0));
  }
  assert.equal(k, 1, 'Expected roof level k = 1 on top of 4 k=0 walls when aiming at y=0');
});

test('roofLevel supports canonical shared-neighbor edges and second-story walls (k = 1 -> roof k = 2)', () => {
  const mockBaseSharedEdges = {
    structures: [
      {
        y: 0,
        pieces: [
          { kind: 'foundation', i: 0, j: 0, k: 0 },
          // East wall stored as West edge of neighbor cell (1, 0) at 2nd story k = 1
          { kind: 'window', i: 1, j: 0, k: 1, edge: 'w' },
          // South wall stored as North edge of neighbor cell (0, 1) at 1st story k = 0
          { kind: 'door', i: 0, j: 1, k: 0, edge: 'n' },
        ],
      },
    ],
  } as unknown as Base;

  assert.equal(roofLevel(mockBaseSharedEdges, 0, 0, 0), 2);
  // Bare foundation with zero walls still enforces minimum k = 1:
  const bareBase = {
    structures: [{ y: 0, pieces: [{ kind: 'foundation', i: 0, j: 0, k: 0 }] }],
  } as unknown as Base;
  assert.equal(roofLevel(bareBase, 0, 0, 0), 1);
});
