import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bolt, can, bracket, triangleCount } from '@hm/partgen';
import {
  mirrorSymmetry,
  linearArray,
  radialPolarArray,
  gridHoneycombCloner,
} from '../src/symmetry-cloner';

describe('TICKET-37: Family 5 — Symmetry, Array & Modular Cloners', () => {
  it('mirrors an L-bracket with outward-facing flipped winding and doubles triangles', () => {
    const baseBracket = bracket.build({}, 1);
    const mirrored = mirrorSymmetry.apply(baseBracket, mirrorSymmetry.oneClickPreset);
    assert.equal(triangleCount(mirrored), triangleCount(baseBracket) * 2);
  });

  it('clones linear and radial polar bolt rings deterministically', () => {
    const baseBolt = bolt.build({}, 1);
    const tris = triangleCount(baseBolt);

    const row3 = linearArray.apply(baseBolt, linearArray.oneClickPreset);
    assert.equal(triangleCount(row3), tris * 3);

    const ring6 = radialPolarArray.apply(baseBolt, radialPolarArray.oneClickPreset);
    assert.equal(triangleCount(ring6), tris * 6);
  });

  it('builds a 3x2 capacitor bank / honeycomb grid via gridHoneycombCloner', () => {
    const baseCan = can.build({}, 0);
    const grid6 = gridHoneycombCloner.apply(baseCan, gridHoneycombCloner.oneClickPreset);
    assert.equal(triangleCount(grid6), triangleCount(baseCan) * 6);
  });
});
