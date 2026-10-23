import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditSingleMeshMultiPartAsset,
  segmentMeshIntoDisjointParts,
  retopologizeFusedMultiPartMesh,
} from '../src/part-split-retopo.ts';

/**
 * Helper: builds a synthetic fused multi-part mesh consisting of:
 * - Part A: A lower chassis box with subdivided coplanar top face
 * - Part B: An upper turret housing sitting atop the chassis at a 90-deg concave step
 * - Webbing: High-aspect-ratio sliver bridge triangles welding the turret lip to the chassis edge
 */
function buildSyntheticFusedMultiPartMesh(): {
  positions: Float32Array;
  indices: Uint32Array;
} {
  const verts: number[] = [];
  const tris: number[] = [];

  function addVert(x: number, y: number, z: number): number {
    const idx = verts.length / 3;
    verts.push(x, y, z);
    return idx;
  }

  // 1. Lower chassis top face (y = 1.0, x in [-2, 2], z in [-2, 2]) subdivided into a 4x4 grid (32 coplanar tris):
  const gridN = 4;
  const chassisGrid: number[][] = [];
  for (let gz = 0; gz <= gridN; gz++) {
    const row: number[] = [];
    for (let gx = 0; gx <= gridN; gx++) {
      const x = -2 + (4 * gx) / gridN;
      const z = -2 + (4 * gz) / gridN;
      row.push(addVert(x, 1.0, z));
    }
    chassisGrid.push(row);
  }
  for (let gz = 0; gz < gridN; gz++) {
    for (let gx = 0; gx < gridN; gx++) {
      const v00 = chassisGrid[gz]![gx]!;
      const v10 = chassisGrid[gz]![gx + 1]!;
      const v11 = chassisGrid[gz + 1]![gx + 1]!;
      const v01 = chassisGrid[gz + 1]![gx]!;
      tris.push(v00, v01, v11, v00, v11, v10);
    }
  }

  // 2. Upper turret vertical front wall (x in [-1.0, 1.0], y in [1.0, 2.2], z = 0.0) subdivided into 2x2 grid (8 tris)
  // welded directly to the chassis top face edge at y = 1.0, z = 0.0, x in {-1, 0, 1}:
  const turretGrid: number[][] = [];
  for (let gy = 0; gy <= 2; gy++) {
    const row: number[] = [];
    for (let gx = 0; gx <= 2; gx++) {
      const x = -1.0 + (2.0 * gx) / 2;
      const y = 1.0 + (1.2 * gy) / 2;
      row.push(addVert(x, y, 0.0));
    }
    turretGrid.push(row);
  }
  for (let gy = 0; gy < 2; gy++) {
    for (let gx = 0; gx < 2; gx++) {
      const v00 = turretGrid[gy]![gx]!;
      const v10 = turretGrid[gy]![gx + 1]!;
      const v11 = turretGrid[gy + 1]![gx + 1]!;
      const v01 = turretGrid[gy + 1]![gx]!;
      // Normal pointing +Z:
      tris.push(v00, v10, v11, v00, v11, v01);
    }
  }

  // 3. Fused marching-cubes webbing slivers bridging the chassis top face (y=1.0, z=0.04) to the turret wall (y=1.04, z=0.0):
  const w0 = addVert(-1.0, 1.0, 0.0);
  const w1 = addVert(1.0, 1.0, 0.0);
  const w2 = addVert(1.0, 1.04, 0.04);
  const w3 = addVert(-1.0, 1.04, 0.04);
  tris.push(w0, w1, w2, w0, w2, w3);

  return {
    positions: new Float32Array(verts),
    indices: new Uint32Array(tris),
  };
}

describe('TICKET-29: part-split-retopo', () => {
  it('audits a fused multi-part mesh and flags cross-part webbing & concave seams', () => {
    const mesh = buildSyntheticFusedMultiPartMesh();
    const audit = auditSingleMeshMultiPartAsset('fabricator-low.glb', mesh.positions, mesh.indices);

    assert.equal(audit.totalTriangles, 42);
    assert.ok(audit.detectedPartCount >= 2, `Expected >= 2 parts, got ${audit.detectedPartCount}`);
    assert.ok(audit.webbingBridgeTriangles >= 2, `Expected >= 2 webbing tris, got ${audit.webbingBridgeTriangles}`);
    assert.ok(audit.coplanarRedundantTriangles >= 20);
    assert.equal(audit.needsPartSplitRetopo, true);
  });

  it('segments a fused mesh into disjoint un-welded parts and strips webbing slivers', () => {
    const mesh = buildSyntheticFusedMultiPartMesh();
    const parts = segmentMeshIntoDisjointParts(mesh.positions, mesh.indices);

    assert.equal(parts.length, 2);
    const totalPartTris = parts.reduce((sum, p) => sum + p.triangleCount, 0);
    // The 2 high-aspect-ratio webbing bridge triangles are stripped:
    assert.equal(totalPartTris, 40);
  });

  it('collapses coplanar subdivisions per part while keeping parts un-welded in a single draw-call buffer', () => {
    const mesh = buildSyntheticFusedMultiPartMesh();
    const res = retopologizeFusedMultiPartMesh(mesh.positions, mesh.indices, 8);

    assert.equal(res.parts.length, 2);
    assert.equal(res.removedWebbingTriangles, 2);
    // 32 coplanar chassis tris collapse to 2 tris, 12 coplanar turret wall tris collapse to 2 tris -> 4 total tris!
    assert.equal(res.outputTriangleCount, 4);
    assert.equal(res.mergedIndices.length, 12);

    // Verify part 0 and part 1 share ZERO vertex indices in mergedIndices (un-welded across part seam):
    const part0VertCount = res.parts[0]!.positions.length / 3;
    const part0MaxIdx = Math.max(...Array.from(res.mergedIndices.slice(0, 6)));
    const part1MinIdx = Math.min(...Array.from(res.mergedIndices.slice(6, 12)));
    assert.ok(part0MaxIdx < part0VertCount);
    assert.ok(part1MinIdx >= part0VertCount);
  });
});
