// ============================================================================
// File: packages/terrainbrush/src/seam-stitch.test.ts
// Unit tests for seam-stitch.ts (POL-29 geomipmap border-vertex snapper).
// Imports ONLY modules in ticket10-context.json.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  snapBorderHeights,
  stitchChunkBorder,
  stitchChunkCandidates,
} from './index';

test('POL-29: snapBorderHeights and stitchChunkBorder snap odd border vertices to coarse neighbour edge lines', () => {
  const gridVerts = 5; // 4 segments (indices 0..4)
  const positions = new Float32Array(gridVerts * gridVerts * 3);

  // Fill a paraboloid y = x^2 + z^2 where midpoints deviate from coarse stride=2 chords
  for (let z = 0; z < gridVerts; z++) {
    for (let x = 0; x < gridVerts; x++) {
      const idx = (z * gridVerts + x) * 3;
      positions[idx] = x * 4;
      positions[idx + 1] = x * x + z * z;
      positions[idx + 2] = z * 4;
    }
  }

  // Before stitching, north edge (z=0) has y = [0, 1, 4, 9, 16]
  // With north stride = 2, x=1 must snap to (0 + 4)/2 = 2, and x=3 must snap to (4 + 16)/2 = 10
  const stitched = stitchChunkBorder(positions, gridVerts, { north: 2, east: 4 });
  assert.ok(stitched > 0);
  assert.equal(positions[1 * 3 + 1], 2, 'north odd vertex x=1 snapped to coarse chord midpoint');
  assert.equal(positions[3 * 3 + 1], 10, 'north odd vertex x=3 snapped to coarse chord midpoint');

  // East edge (x=4) has corners z=0 (y=16) and z=4 (y=32). With stride=4, z=1,2,3 lie linearly on 16..32
  assert.equal(positions[(1 * gridVerts + 4) * 3 + 1], 20);
  assert.equal(positions[(2 * gridVerts + 4) * 3 + 1], 24);
  assert.equal(positions[(3 * gridVerts + 4) * 3 + 1], 28);

  // Interior vertices (e.g. x=2, z=2) are untouched
  assert.equal(positions[(2 * gridVerts + 2) * 3 + 1], 8);
});

test('POL-29: stitchChunkCandidates detects refined 16 m chunk next to coarse 32 m chunk and stitches the shared edge', () => {
  const g = 5;
  const finePos = new Float32Array(g * g * 3);
  const coarsePos = new Float32Array(g * g * 3);
  for (let z = 0; z < g; z++) {
    for (let x = 0; x < g; x++) {
      const i = (z * g + x) * 3;
      finePos[i] = x * 4;
      finePos[i + 1] = Math.sin(x) * 3;
      finePos[i + 2] = z * 4;

      coarsePos[i] = x * 8;
      coarsePos[i + 1] = Math.sin(x * 2) * 3;
      coarsePos[i + 2] = -16 + z * 8;
    }
  }

  let notified = false;
  const count = stitchChunkCandidates([
    {
      minX: 0,
      maxX: 16,
      minZ: 0,
      maxZ: 16,
      gridVerts: g,
      positions: finePos,
      onStitched: () => {
        notified = true;
      },
    },
    {
      minX: 0,
      maxX: 32,
      minZ: -32,
      maxZ: 0,
      gridVerts: g,
      positions: coarsePos,
    },
  ]);

  assert.ok(count > 0);
  assert.equal(notified, true);
  const expectedMid02 = 0.5 * (finePos[0 * 3 + 1]! + finePos[2 * 3 + 1]!);
  assert.ok(Math.abs(finePos[1 * 3 + 1]! - expectedMid02) < 1e-5);
});
