// ============================================================================
// File: packages/groundshader/tests/coverage.test.ts
// Unit tests for makeCoverTextures and setCoverage in @hm/groundshader (TICKET-02 Item B).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  COVER_LAYERS,
  createGroundMaterial,
  makeCoverTextures,
  makeGroundTextures,
  setCoverage,
} from '../src/index';

test('makeCoverTextures builds deterministic 2-layer moss & grass DataArrayTextures', () => {
  assert.deepEqual(COVER_LAYERS, ['moss', 'grass']);
  const cov1 = makeCoverTextures({ size: 64, seed: 42 });
  const cov2 = makeCoverTextures({ size: 64, seed: 42 });
  const covDiff = makeCoverTextures({ size: 64, seed: 99 });

  assert.equal(cov1.size, 64);
  assert.equal(cov1.metres.length, 2);
  assert.equal(cov1.albedoHeight.image.depth, 2);
  assert.equal(cov1.normalRough.image.depth, 2);

  const d1 = cov1.albedoHeight.image.data as Uint8Array;
  const d2 = cov2.albedoHeight.image.data as Uint8Array;
  const d3 = covDiff.albedoHeight.image.data as Uint8Array;
  assert.equal(d1.byteLength, 64 * 64 * 4 * 2);
  assert.deepEqual(d1, d2, 'same seed yields byte-identical cover tiles');
  assert.notDeepEqual(d1, d3, 'different seed yields different cover tiles');

  // Verify grass (layer 1) is greener than red/blue on average
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  const layer1Offset = 64 * 64 * 4;
  for (let i = 0; i < 64 * 64; i++) {
    sumR += d1[layer1Offset + i * 4] ?? 0;
    sumG += d1[layer1Offset + i * 4 + 1] ?? 0;
    sumB += d1[layer1Offset + i * 4 + 2] ?? 0;
  }
  assert.ok(sumG > sumR && sumG > sumB, 'grass layer has dominant green channel');
});

test('setCoverage binds RGBA cover mask and rect onto GroundMaterial uniforms', () => {
  const groundTex = makeGroundTextures({ size: 64, seed: 1 });
  const coverTiles = makeCoverTextures({ size: 64, seed: 2 });
  const mat = createGroundMaterial(groundTex, {
    stage: 5,
    sunDir: new THREE.Vector3(0.4, 0.5, -0.7),
    cover: coverTiles,
  });

  assert.equal(mat.uniforms.uCoverOn?.value, 0);

  const maskData = new Uint8Array(32 * 32 * 4);
  const maskTex = new THREE.DataTexture(maskData, 32, 32, THREE.RGBAFormat);
  setCoverage(mat, { tex: maskTex, x0: -128, z0: -128, size: 256 });

  assert.equal(mat.uniforms.uCoverOn?.value, 1);
  assert.equal(mat.uniforms.uCoverMask?.value, maskTex);
  const rect = mat.uniforms.uCoverRect?.value as THREE.Vector4;
  assert.equal(rect.x, -128);
  assert.equal(rect.y, -128);
  assert.equal(rect.z, 256);
  assert.equal(rect.w, 256);
  assert.equal(maskTex.magFilter, THREE.LinearFilter);

  setCoverage(mat, null);
  assert.equal(mat.uniforms.uCoverOn?.value, 0);
  assert.equal(mat.uniforms.uCoverMask?.value, null);
});
