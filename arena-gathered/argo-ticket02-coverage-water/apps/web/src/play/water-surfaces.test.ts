// ============================================================================
// File: apps/web/src/play/water-surfaces.test.ts
// Unit tests for buildWaterSurfaces (TICKET-02 Item E).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flood, type Terrain } from '@hm/hydro';
import { buildWaterSurfaces } from './water-surfaces';

function makeBowlTerrain(n: number, cellM: number, x0: number, z0: number): {
  terrain: Terrain;
  heightAt: (x: number, z: number) => number;
} {
  const heightAt = (wx: number, wz: number): number => {
    const r = Math.hypot(wx, wz);
    return r < 24 ? -4 * (1 - (r / 24) ** 2) : 0.05 * (r - 24);
  };
  const heights: number[] = new Array<number>(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const wx = x0 + (x + 0.5) * cellM;
      const wz = z0 + (z + 0.5) * cellM;
      heights[z * n + x] = heightAt(wx, wz);
    }
  }
  return {
    terrain: { size: n, cell: cellM, heights },
    heightAt,
  };
}

test('buildWaterSurfaces returns empty group below stage 3 or when water volume is 0', () => {
  const { terrain, heightAt } = makeBowlTerrain(32, 2, -32, -32);
  const dryWater = flood(terrain, [{ x: 16, z: 16, share: 1 }], 0);
  const wetWater = flood(terrain, [{ x: 16, z: 16, share: 1 }], 400);

  assert.equal(buildWaterSurfaces(dryWater, heightAt, 4).children.length, 0);
  assert.equal(buildWaterSurfaces(wetWater, heightAt, 2).children.length, 0);
});

test('buildWaterSurfaces builds depth-faded lake mesh aligned with heightAt at stage 4+', () => {
  const { terrain, heightAt } = makeBowlTerrain(32, 2, -32, -32);
  const water = flood(terrain, [{ x: 16, z: 16, share: 1 }], 600);
  assert.ok(water.volume > 0);

  const group = buildWaterSurfaces(water, heightAt, 4);
  assert.equal(group.children.length, 1);

  const mesh = group.children[0] as THREE.Mesh;
  assert.ok(mesh.isMesh);
  const posAttr = mesh.geometry.getAttribute('position');
  const depthAttr = mesh.geometry.getAttribute('aDepth');
  assert.ok(posAttr && posAttr.count > 10);
  assert.ok(depthAttr && depthAttr.count === posAttr.count);

  let maxDepth = 0;
  let shorelineVerts = 0;
  for (let i = 0; i < depthAttr.count; i++) {
    const d = depthAttr.getX(i);
    if (d > maxDepth) maxDepth = d;
    if (d === 0) shorelineVerts++;
  }
  assert.ok(maxDepth > 0.5, `Expected deep lake centre > 0.5m, got ${maxDepth}`);
  assert.ok(shorelineVerts > 4, 'Expected zero-depth shoreline skirt vertices for soft shore fade');
});
