import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bakeVertexLighting,
  hemisphereDirs,
  vertexNormals,
} from '../src/game/bake/vertex-baker';
import type { RawMesh } from '../src/game/assets/model-import';

test('T8 Baker: deterministic output for identical inputs', () => {
  const mesh: RawMesh = {
    name: 'cube_quad',
    positions: new Float32Array([
      -50, 0, -50,
      50, 0, -50,
      50, 100, 50,
      -50, 100, 50,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };

  const bakeA = bakeVertexLighting(mesh);
  const bakeB = bakeVertexLighting(mesh);

  assert.equal(bakeA.colors.length, bakeB.colors.length);
  for (let i = 0; i < bakeA.colors.length; i++) {
    assert.equal(bakeA.colors[i], bakeB.colors[i]);
  }
});

test('T8 Baker: hemisphere dirs are within unit hemisphere', () => {
  const dirs = hemisphereDirs(32);
  assert.equal(dirs.length, 32 * 3);

  for (let i = 0; i < 32; i++) {
    const x = dirs[i * 3];
    const y = dirs[i * 3 + 1];
    const z = dirs[i * 3 + 2];
    const len = Math.hypot(x, y, z);
    assert.ok(Math.abs(len - 1.0) < 1e-4);
    assert.ok(z >= -1e-6); // Z-up hemisphere
  }
});

test('T8 Baker: ground contact darkening', () => {
  // A vertical wall from y=0 (ground) to y=200
  const wall: RawMesh = {
    name: 'ground_wall',
    positions: new Float32Array([
      -50, 0, 0,   // vertex 0: at ground level
      50, 0, 0,    // vertex 1: at ground level
      50, 200, 0,  // vertex 2: top
      -50, 200, 0, // vertex 3: top
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };

  const bake = bakeVertexLighting(wall, {
    rays: 32,
    maxDist: 300,
    sunDir: [0, 1, 0],
    ambient: 0.5,
    sun: 0.5,
    ground: true,
    sunTint: [1, 1, 1],
    skyTint: [1, 1, 1],
  });

  const bottomBrightness = bake.colors[0]; // vertex 0 red
  const topBrightness = bake.colors[2 * 3]; // vertex 2 red

  // Bottom edge near ground plane must be darker than top
  assert.ok(bottomBrightness < topBrightness);
});
