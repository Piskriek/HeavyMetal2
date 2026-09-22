/** Real Three.js resource disposal, without constructing a WebGL context. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Renderer3D } from '../src/game/renderer-3d';

// Only bypass the DOM/WebGL constructor. Exercise the production pool methods and
// observe real Material/Texture/Geometry dispose events, not a replica of the pool.
function pool(canvases: HTMLCanvasElement[]) {
  return Object.assign(Object.create(Renderer3D.prototype), {
    scene: new THREE.Scene(), storedAssets: { raceBalls: canvases },
    racers3D: [], racerResources: null, racerTextures: new Map(), destroyed: false,
  }) as Pool;
}

// TypeScript private fields require a test-only structural view, not a production API.
type Pool = {
  setRacerCount(count: number): void;
  racers3D: Array<{ sphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> }>;
  racerResources: { sphereGeo: THREE.SphereGeometry };
  scene: THREE.Scene;
  disposeRacerPool(): void;
};

for (const count of [20, 50, 100]) {
  test(`racer pool: ${count} -> 4 -> ${count} releases only unused textures`, () => {
    const shared = {} as HTMLCanvasElement;
    const canvases = Array.from({ length: count }, (_, i) => i % 2 === 0 ? shared : {} as HTMLCanvasElement);
    const p = pool(canvases);
    p.setRacerCount(count);
    assert.equal(p.scene.children.length, count);
    const initialTextures = p.racers3D.map((m) => m.sphere.material.map!);
    const sharedTexture = initialTextures[0];
    assert.equal(initialTextures[4], sharedTexture);
    const textureDisposals = new Map<THREE.Texture, number>();
    for (const texture of new Set(initialTextures)) {
      textureDisposals.set(texture, 0);
      texture.addEventListener('dispose', () => textureDisposals.set(texture, textureDisposals.get(texture)! + 1));
    }
    let materialDisposals = 0, geometryDisposals = 0;
    for (const m of p.racers3D) m.sphere.material.addEventListener('dispose', () => materialDisposals++);
    p.racerResources.sphereGeo.addEventListener('dispose', () => geometryDisposals++);
    p.setRacerCount(4);
    assert.equal(p.scene.children.length, 4);
    assert.equal(materialDisposals, count - 4);
    assert.equal(geometryDisposals, 0, 'shared geometry remains reusable');
    assert.equal(textureDisposals.get(sharedTexture), 0, 'texture still used by retained slots');
    assert.equal(textureDisposals.get(initialTextures[5]), 1, 'unused texture is disposed on shrink');
    p.setRacerCount(count);
    assert.equal(p.racers3D[0].sphere.material.map, sharedTexture);
    assert.notEqual(p.racers3D[5].sphere.material.map, initialTextures[5], 'disposed texture is not reused');
    p.disposeRacerPool();
    assert.equal(p.scene.children.length, 0);
    assert.equal(materialDisposals, count, 'every original material disposed exactly once');
    assert.equal(geometryDisposals, 1);
    for (const n of textureDisposals.values()) assert.equal(n, 1);
    p.disposeRacerPool();
    assert.equal(geometryDisposals, 1, 'teardown is idempotent');
  });
}
