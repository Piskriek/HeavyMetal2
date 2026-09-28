/** MP-T03: one texture array for every ball, so all ball cores draw in one call. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BallTexturePool, BALL_LAYER_HEIGHT, BALL_LAYER_WIDTH, arrayBallMaterial } from '../src/game/ball-texture-pool';
import { Renderer3D } from '../src/game/renderer-3d';
import { getTrackSpace } from '../src/game/track-space';
import { RADIUS, START_X, courseY } from '../src/game/scene';

test('MP-T03: layers are shared by key, freed and reused without reallocating', () => {
  const pool = new BallTexturePool(4);
  const bytes = pool.bytes; const data = pool.texture.image.data;
  const a = {}; const b = {};
  const la = pool.acquire(a, () => new Uint8ClampedArray(BALL_LAYER_WIDTH * BALL_LAYER_HEIGHT * 4).fill(9));
  assert.equal(pool.acquire(a, () => null), la, 'the same design shares a layer');
  const lb = pool.acquire(b, () => null);
  assert.notEqual(lb, la);
  pool.release(a); assert.equal(pool.used, 2, 'still worn once');
  pool.release(a); assert.equal(pool.used, 1);
  assert.equal(pool.acquire({}, () => null), la, 'a freed layer is reused');
  assert.equal(pool.texture.image.data, data, 'never reallocated');
  assert.equal(pool.bytes, bytes);
  pool.acquire({}, () => null); pool.acquire({}, () => null);
  assert.equal(pool.acquire({}, () => null), null, 'a full pool says so (the renderer falls back)');
});

test('MP-T03: 100 layers fit in 25 MB and the material samples the array', () => {
  assert.ok(new BallTexturePool(100).bytes <= 25 * 1048576);
  const material = arrayBallMaterial(new BallTexturePool(2));
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\n#include <uv_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>' };
  material.onBeforeCompile(shader as never, undefined as never);
  assert.match(shader.fragmentShader, /texture\(uBallArray, vec3\(vBallUv/);
  assert.match(shader.vertexShader, /attribute float aBallLayer/);
});

test('MP-T03: 100 distinct balls draw their cores in one call', () => {
  const canvases = Array.from({ length: 100 }, () => ({}) as HTMLCanvasElement);
  const p = Object.assign(Object.create(Renderer3D.prototype), {
    scene: new THREE.Scene(), storedAssets: { raceBalls: canvases },
    racers3D: [], racerResources: null, racerTextures: new Map(), destroyed: false, ballPool: new BallTexturePool(128),
    racerMatrix: new THREE.Matrix4(), racerScale: new THREE.Vector3(1, 1, 1), racerOffset: new THREE.Vector3(),
    shadowQuat: new THREE.Quaternion(), shieldQuat: new THREE.Quaternion(), coreQuat: new THREE.Quaternion(), gyroQuat: new THREE.Quaternion(),
    shadowUp: new THREE.Vector3(), shadowScale: new THREE.Vector3(), shadowFade: new THREE.Color(),
    space: getTrackSpace(), track: { sampleAt: () => ({ pos: { y: 0 } }) },
  });
  p.setRacerCount(100);
  const racers = Array.from({ length: 100 }, (_, i) => ({ x: START_X + 500 + i * 60, y: courseY(START_X + 500 + i * 60, 'ridge') - RADIUS, z: 0, grounded: true, shieldUntil: 0 }));
  p.drawRacers({ racers, runTime: 1, options: { course: 'ridge' } }, 1 / 60, false, [], 0);
  const cores = (p.scene.children as THREE.InstancedMesh[]).filter((m) => m.count > 0 && /RacerCores/.test(m.name));
  assert.equal(cores.length, 1, 'one core draw');
  assert.equal(cores[0].count, 100);
  const layers = cores[0].geometry.getAttribute('aBallLayer');
  assert.equal(new Set(Array.from({ length: 100 }, (_, i) => layers.getX(i))).size, 100, 'each ball its own layer');
  p.disposeRacerPool();
});
