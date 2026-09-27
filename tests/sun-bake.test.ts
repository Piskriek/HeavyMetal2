/**
 * The sun bake puts a model's shadow on the ground beneath it, offset away from the sun, and leaves the
 * rest lit; the terrain shader dims only direct light with it, and its shine makes dark rock glossy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bakeSunShadows } from '../src/game/island-route/sun-bake';
import { TriangleGrid } from '../src/game/bake/vertex-baker';
import { injectIslandGround, normalizeIslandGround } from '../src/game/island-route/island-ground';

const quad = (a: number[], b: number[], c: number[], d: number[]) => [
  ...a, b[0] - a[0], b[1] - a[1], b[2] - a[2], c[0] - a[0], c[1] - a[1], c[2] - a[2],
  ...a, c[0] - a[0], c[1] - a[1], c[2] - a[2], d[0] - a[0], d[1] - a[1], d[2] - a[2],
];

test('first hit along a ray: the nearest of two stacked floors', () => {
  const tris = Float64Array.from([...quad([-100, 0, -100], [100, 0, -100], [100, 0, 100], [-100, 0, 100]), ...quad([-100, 50, -100], [100, 50, -100], [100, 50, 100], [-100, 50, 100])]);
  const grid = new TriangleGrid(tris);
  assert.ok(Math.abs(grid.nearest(0, 200, 0, 0, -1, 0, 1000) - 150) < 1e-6, 'the top floor, 150 below');
  assert.equal(grid.nearest(500, 200, 0, 0, -1, 0, 1000), Infinity, 'off both floors: no hit');
});

test('a floating slab shadows the ground beneath it, offset away from the sun', () => {
  const half = 1000, res = 64;
  const ground = Float64Array.from(quad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half]));
  // A 400-wide slab 300 up over the middle; the sun is straight up and a little towards +x.
  const slab = Float64Array.from(quad([-200, 300, -200], [200, 300, -200], [200, 300, 200], [-200, 300, 200]));
  const sun = new THREE.Vector3(0.5, 1, 0).normalize();
  const map = bakeSunShadows({ terrain: ground, casters: slab, sunDir: [sun.x, sun.y, sun.z], half, res, samples: 1 });
  const at = (x: number, z: number) => map[Math.floor(((z + half) / (2 * half)) * res) * res + Math.floor(((x + half) / (2 * half)) * res)];
  assert.equal(at(-150, 0), 0, 'under the slab, shifted away from the sun: shadow');
  assert.equal(at(-800, 0), 255, 'far away: sun');
  assert.equal(at(180, 0), 255, 'the sun side of the slab edge is lit (the shadow falls the other way)');
});

test('the terrain shader: shadows dim direct light only; shine lowers roughness on dark rock', () => {
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, THREE.IUniform> };
  injectIslandGround(shader, {});
  assert.match(shader.fragmentShader, /#include <lights_fragment_end>[\s\S]*reflectedLight\.directDiffuse \*= vis;\s*reflectedLight\.directSpecular \*= vis;/);
  assert.doesNotMatch(shader.fragmentShader, /indirectDiffuse \*= vis/, 'the sky still fills the shadows');
  assert.match(shader.fragmentShader, /#include <roughnessmap_fragment>[\s\S]*float shineMask = max\(gStoneCover \* gNear,[\s\S]*roughnessFactor = mix\(roughnessFactor, 1\.0, clamp\(gCrack/, 'pebbles shine, cracks stay dull');
  assert.match(shader.fragmentShader, /#include <normal_fragment_maps>[\s\S]*normal = gBump\(-vViewPosition, normal, dh\);/, 'relief on the normal');
  const s = normalizeIslandGround({});
  assert.equal(s.roughness, 0.95); assert.equal(s.shadowStrength, 0.8);
});
