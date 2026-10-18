// ============================================================================
// File: apps/web/src/play/outcrops.test.ts
// Unit tests for outcropGeometry and outcropMaterial (TICKET-05 Item F).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { outcropGeometry, outcropMaterial, type OutcropKind } from './outcrops';

const KINDS: readonly OutcropKind[] = ['dither', 'fold', 'chroma', 'spire'];

test('outcropGeometry builds deterministic <= 300 triangle grounded meshes for all 4 node kinds', () => {
  for (const kind of KINDS) {
    const g1 = outcropGeometry(kind, 42);
    const g2 = outcropGeometry(kind, 42);

    const pos1 = g1.getAttribute('position');
    const pos2 = g2.getAttribute('position');
    const col1 = g1.getAttribute('color');
    const norm1 = g1.getAttribute('normal');
    assert.ok(pos1 && pos2 && col1 && norm1);
    assert.equal(pos1.count, pos2.count);

    // Determinism check
    for (let i = 0; i < pos1.count; i++) {
      assert.equal(pos1.getX(i), pos2.getX(i));
      assert.equal(pos1.getY(i), pos2.getY(i));
      assert.equal(pos1.getZ(i), pos2.getZ(i));
    }

    const triCount = g1.index ? g1.index.count / 3 : pos1.count / 3;
    assert.ok(
      triCount > 20 && triCount <= 300,
      `${kind} triangle count ${triCount} must be in (20, 300]`
    );

    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos1.count; i++) {
      const y = pos1.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    // Must have a buried root skirt (minY <= -0.60) so it never floats even when offset +0.35/+0.7m
    const requiredRootDepth = kind === 'spire' ? -0.85 : -0.60;
    assert.ok(
      minY <= requiredRootDepth,
      `${kind} minY=${minY} must extend below ${requiredRootDepth} so it never floats`
    );
    assert.ok(maxY >= 0.45, `${kind} maxY=${maxY} must rise above ground`);

    const mat = outcropMaterial(kind);
    assert.equal(mat.vertexColors, true);
    assert.equal(mat.flatShading, true);
  }
});
