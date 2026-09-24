import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  type MaterialDescriptor,
  normalizeDescriptor,
  materialKey,
  effectiveColor,
} from '../src/game/materials/material-descriptor';
import { MaterialCache } from '../src/game/materials/material-cache';

test('T5 Materials: cache sharing and refcounted disposal', () => {
  const cache = new MaterialCache();
  const desc: MaterialDescriptor = {
    shadingMode: 'lit',
    color: '#ff8800',
    roughness: 0.5,
    metalness: 0.2,
    unlitGlow: 0,
    biomeTint: false,
    biomeTintStrength: 0,
    doubleSided: false,
    castShadow: true,
    receiveShadow: true,
  };

  const mat1 = cache.acquire(desc);
  assert.equal(cache.stats.liveMaterials, 1);
  assert.equal(cache.stats.totalAcquires, 1);

  const mat2 = cache.acquire(desc);
  assert.equal(mat1, mat2); // Identical instance shared
  assert.equal(cache.stats.liveMaterials, 1);
  assert.equal(cache.stats.totalAcquires, 2);

  // Release first ref
  cache.release(desc);
  assert.equal(cache.stats.liveMaterials, 1);

  // Release second ref -> disposed and cleared
  cache.release(desc);
  assert.equal(cache.stats.liveMaterials, 0);
});

test('T5 Materials: stable keys and normalization', () => {
  const rawA: Partial<MaterialDescriptor> = {
    color: '#112233',
    roughness: 1.5, // should clamp to 1.0
    metalness: -0.2, // should clamp to 0.0
  };

  const rawB: Partial<MaterialDescriptor> = {
    metalness: 0.0,
    roughness: 1.0,
    color: '#112233',
  };

  const keyA = materialKey(normalizeDescriptor(rawA), 'ridge');
  const keyB = materialKey(normalizeDescriptor(rawB), 'ridge');

  assert.equal(keyA, keyB);
});

test('T5 Materials: biome tint math and in-place color update', () => {
  const cache = new MaterialCache();
  const desc: MaterialDescriptor = {
    shadingMode: 'lit',
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0.0,
    unlitGlow: 0,
    biomeTint: true,
    biomeTintStrength: 1.0, // 100% biome color
    doubleSided: false,
    castShadow: true,
    receiveShadow: true,
  };

  const mat = cache.acquire(desc, 'ridge') as THREE.MeshStandardMaterial;
  const initialVersion = mat.version;

  // Initial color is ridge green
  const [rGreen, gGreen, bGreen] = effectiveColor(desc, 'ridge');
  assert.ok(Math.abs(mat.color.r - rGreen) < 1e-3);

  // Switch biome to canyon terracotta
  cache.setBiome('canyon');
  const [rTerracotta] = effectiveColor(desc, 'canyon');
  assert.ok(Math.abs(mat.color.r - rTerracotta) < 1e-3);

  // Assert version was NOT incremented (no shader recompile)
  assert.equal(mat.version, initialVersion);
});
