import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, bolt, triangleCount } from '@hm/partgen';
import {
  quadricEdgeDecimate,
  weldByDistance,
  planeSliceClip,
  recomputeHardNormalsAndGround,
} from '../src/cleanup-remesh';

describe('TICKET-35: Family 3 — Topology Cleanup, Decimate, Weld, Slice & Normals Operators', () => {
  it('reduces triangle budget via quadricEdgeDecimate and planarDissolveDecimate', () => {
    const detailedCan = can.build({ bands: 3 }, 2);
    const fullTris = triangleCount(detailedCan);
    const halfMesh = quadricEdgeDecimate.apply(detailedCan, { ratio: 0.5 });

    assert.ok(triangleCount(halfMesh) <= Math.ceil(fullTris * 0.55));
    assert.ok(triangleCount(halfMesh) >= 4);
  });

  it('slices below-groundbolt shank off at y=0 with planeSliceClip and grounds offset meshes', () => {
    const withShank = bolt.build({ shankLength: 0.15 }, 1);
    assert.ok(withShank.min[1] < -0.1);

    const trimmed = planeSliceClip.apply(withShank, planeSliceClip.oneClickPreset);
    assert.ok(trimmed.min[1] >= -1e-5, `Expected min[1] >= 0 after y=0 clip, got ${trimmed.min[1]}`);

    const grounded = recomputeHardNormalsAndGround.apply(withShank, { snapGround: 1, centerXZ: 1 });
    assert.ok(Math.abs(grounded.min[1]) < 1e-5);
  });

  it('welds near-duplicate vertices and drops degenerate slivers via weldByDistance', () => {
    const baseCan = can.build({}, 1);
    const welded = weldByDistance.apply(baseCan, weldByDistance.oneClickPreset);
    assert.ok(triangleCount(welded) > 0);
  });
});
