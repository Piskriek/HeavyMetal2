import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchIndex, surfaceWithPatches } from '../src/game/collision/patch-index';
import { compilePatch } from '../src/game/collision/terrain-patch';
import type { RawMesh } from '../src/game/assets/model-import';

test('T6 PatchParity: empty patch set preserves baseline surface bit-identically', () => {
  const index = new PatchIndex([]);

  const testPoints = [
    { x: 0, z: 0, baseline: 478 },
    { x: 1200, z: -150, baseline: 520.125 },
    { x: 5000, z: 300, baseline: 610.75 },
  ];

  for (const pt of testPoints) {
    const resA = index.surfaceAt(pt.x, pt.z, pt.baseline);
    assert.equal(resA.y, pt.baseline);
    assert.equal(resA.fromPatch, false);
    assert.equal(resA.slopeX, 0);
    assert.equal(resA.slopeZ, 0);

    const resB = surfaceWithPatches([], pt.x, pt.z, pt.baseline);
    assert.equal(resB.y, pt.baseline);
    assert.equal(resB.fromPatch, false);
  }
});

test('T6 PatchParity: patch raises baseline surface only when patch elevation is higher', () => {
  const mesh: RawMesh = {
    name: 'raised_pad',
    positions: new Float32Array([
      0, 600, -100,
      200, 600, -100,
      200, 600, 100,
      0, 600, 100,
    ]),
    indices: new Uint32Array([
      0, 1, 2,
      0, 2, 3,
    ]),
  };

  const patch = compilePatch(mesh, { fillHoles: true });
  const index = new PatchIndex([patch]);

  // When baseline is 478 (lower than 600), patch raises ground to 600
  const hitRaised = index.surfaceAt(100, 0, 478);
  assert.equal(hitRaised.fromPatch, true);
  assert.equal(hitRaised.y, 600);

  // When baseline is 700 (higher than 600), baseline is preserved (patches never dig)
  const hitHigher = index.surfaceAt(100, 0, 700);
  assert.equal(hitHigher.fromPatch, false);
  assert.equal(hitHigher.y, 700);
});
