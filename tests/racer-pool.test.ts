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
type RacerMesh = {
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  capLeft: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  capRight: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
};
type Pool = {
  setRacerCount(count: number): void;
  racers3D: RacerMesh[];
  racerResources: {
    sphereGeo: THREE.SphereGeometry;
    capLeftGeo: THREE.SphereGeometry;
    capRightGeo: THREE.SphereGeometry;
    capMat: THREE.MeshStandardMaterial;
  };
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
    const initialTextures = p.racers3D.map((m) => m.core.material.map!);
    const sharedTexture = initialTextures[0];
    assert.equal(initialTextures[4], sharedTexture);
    // M01 · T3 (IF-GYRO): the ball is a rolling core between two level caps. Three geometries exist
    // in total however big the grid is, and the caps share the one brass material.
    const first = p.racers3D[0];
    assert.equal(first.capLeft.geometry, p.racers3D[count - 1].capLeft.geometry, 'cap geometry is shared');
    assert.equal(first.capRight.geometry, p.racers3D[count - 1].capRight.geometry);
    assert.notEqual(first.capLeft.geometry, first.capRight.geometry, 'the two caps are mirrored');
    assert.equal(first.capLeft.material, p.racers3D[1].capLeft.material, 'one brass material per grid');
    assert.equal(first.capLeft.geometry, p.racerResources.capLeftGeo);
    const textureDisposals = new Map<THREE.Texture, number>();
    for (const texture of new Set(initialTextures)) {
      textureDisposals.set(texture, 0);
      texture.addEventListener('dispose', () => textureDisposals.set(texture, textureDisposals.get(texture)! + 1));
    }
    let materialDisposals = 0, geometryDisposals = 0, capMaterialDisposals = 0;
    for (const m of p.racers3D) m.core.material.addEventListener('dispose', () => materialDisposals++);
    p.racerResources.capMat.addEventListener('dispose', () => capMaterialDisposals++);
    for (const geo of [p.racerResources.sphereGeo, p.racerResources.capLeftGeo, p.racerResources.capRightGeo]) {
      geo.addEventListener('dispose', () => geometryDisposals++);
    }
    p.setRacerCount(4);
    assert.equal(p.scene.children.length, 4);
    assert.equal(materialDisposals, count - 4);
    assert.equal(geometryDisposals, 0, 'shared geometry remains reusable');
    assert.equal(capMaterialDisposals, 0, 'the shared brass material outlives a shrink');
    assert.equal(textureDisposals.get(sharedTexture), 0, 'texture still used by retained slots');
    assert.equal(textureDisposals.get(initialTextures[5]), 1, 'unused texture is disposed on shrink');
    p.setRacerCount(count);
    assert.equal(p.racers3D[0].core.material.map, sharedTexture);
    assert.notEqual(p.racers3D[5].core.material.map, initialTextures[5], 'disposed texture is not reused');
    p.disposeRacerPool();
    assert.equal(p.scene.children.length, 0);
    assert.equal(materialDisposals, count, 'every original material disposed exactly once');
    assert.equal(capMaterialDisposals, 1, 'the shared brass material is disposed once');
    assert.equal(geometryDisposals, 3, 'one shell and two caps, however many racers there were');
    for (const n of textureDisposals.values()) assert.equal(n, 1);
    p.disposeRacerPool();
    assert.equal(geometryDisposals, 3, 'teardown is idempotent');
  });
}
