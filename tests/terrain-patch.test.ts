import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compilePatch,
  surfaceAtPatch,
  F_COVERED,
  F_OVERHANG,
  F_OUTSIDE,
} from '../src/game/collision/terrain-patch';
import type { RawMesh } from '../src/game/assets/model-import';

test('T6 TerrainPatch: deterministic hash and winding independence', () => {
  // A simple flat quadrilateral deck (2 triangles)
  const meshCW: RawMesh = {
    name: 'deck_cw',
    positions: new Float32Array([
      0, 50, -50,
      100, 50, -50,
      100, 50, 50,
      0, 50, 50,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      0, 2, 3,
    ]),
  };

  const meshCCW: RawMesh = {
    name: 'deck_ccw',
    positions: new Float32Array(meshCW.positions),
    indices: new Uint32Array([
      0, 2, 1,
      0, 3, 2,
    ]),
  };

  const patchA = compilePatch(meshCW, { fillHoles: true });
  const patchB = compilePatch(meshCCW, { fillHoles: true });

  assert.equal(patchA.hash, patchB.hash);
  assert.equal(patchA.stats.covered, patchB.stats.covered);
});

test('T6 TerrainPatch: wedge slope calculation', () => {
  // Wedge ramping up from y=0 at x=0 to y=50 at x=100
  const wedge: RawMesh = {
    name: 'wedge',
    positions: new Float32Array([
      0, 0, -50,
      100, 50, -50,
      100, 50, 50,
      0, 0, 50,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      0, 2, 3,
    ]),
  };

  const patch = compilePatch(wedge, { fillHoles: false });
  assert.ok(patch.stats.covered > 0);

  // Surface query in middle of wedge
  const hit = surfaceAtPatch(patch, 50, 0, 0);
  assert.equal(hit.fromPatch, true);
  assert.ok(hit.y > 10 && hit.y < 40);
  assert.ok(hit.slopeX > 0); // Positive uphill slope
});

test('T6 TerrainPatch: bridge overhang flag on stacked layers', () => {
  // A two-deck bridge with lower deck at y=20 and upper deck at y=80
  const bridge: RawMesh = {
    name: 'bridge',
    positions: new Float32Array([
      // Lower deck
      0, 20, -50,
      100, 20, -50,
      100, 20, 50,
      // Middle deck
      0, 50, -50,
      100, 50, -50,
      100, 50, 50,
      // Upper deck
      0, 80, -50,
      100, 80, -50,
      100, 80, 50,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      3, 4, 5,
      6, 7, 8,
    ]),
  };

  const patch = compilePatch(bridge, { fillHoles: false });
  assert.ok(patch.stats.overhangs > 0);
  assert.ok(patch.flags.some((f) => (f & F_OVERHANG) !== 0));
});

test('T6 TerrainPatch: corridor clipping for outside geometry', () => {
  // Geometry located far off the road corridor at z = 600
  const farMesh: RawMesh = {
    name: 'far_prop',
    positions: new Float32Array([
      0, 10, 550,
      100, 10, 550,
      100, 10, 650,
    ]),
    indices: new Uint32Array([0, 1, 2]),
  };

  const patch = compilePatch(farMesh, { fillHoles: false, corridor: 480 });
  assert.ok(patch.stats.outside > 0);
  assert.ok(patch.flags.some((f) => (f & F_OUTSIDE) !== 0));
});
