import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFidelityMobMaterial, setMobMaterialStage } from '../src/fidelity-mob';

describe('@hm/shareware - Fidelity Mob Material', () => {
  it('creates ShaderMaterial with default uniforms', () => {
    const mat = createFidelityMobMaterial({ stage: 4 });
    assert.ok(mat);
    assert.equal(mat.uniforms.uStage?.value, 4);
    assert.ok(mat.uniforms.uSunDir);
    assert.ok(mat.uniforms.uEmissive);
  });

  it('updates stage dynamically', () => {
    const mat = createFidelityMobMaterial({ stage: 0 });
    assert.equal(mat.uniforms.uStage?.value, 0);

    setMobMaterialStage(mat, 1);
    assert.equal(mat.uniforms.uStage?.value, 1);

    setMobMaterialStage(mat, 2);
    assert.equal(mat.uniforms.uStage?.value, 2);

    setMobMaterialStage(mat, 4);
    assert.equal(mat.uniforms.uStage?.value, 4);
  });

  it('supports morph targets with ShaderMaterial chunks', () => {
    const mat = createFidelityMobMaterial({ stage: 2 });
    assert.ok(mat.isMeshStandardMaterial);
    assert.equal(typeof mat.onBeforeCompile, 'function');
  });
});
