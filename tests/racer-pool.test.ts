/** Real Three.js resource disposal and instanced drawing, without constructing a WebGL context. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Renderer3D } from '../src/game/renderer-3d';
import { getTrackSpace } from '../src/game/track-space';
import { START_X } from '../src/game/scene';

// Only bypass the DOM/WebGL constructor. Exercise the production pool methods and
// observe real Material/Texture/Geometry dispose events, not a replica of the pool.
function pool(canvases: HTMLCanvasElement[]) {
  return Object.assign(Object.create(Renderer3D.prototype), {
    scene: new THREE.Scene(), storedAssets: { raceBalls: canvases },
    racers3D: [], racerResources: null, racerTextures: new Map(), destroyed: false,
    racerMatrix: new THREE.Matrix4(), racerScale: new THREE.Vector3(1, 1, 1), racerOffset: new THREE.Vector3(),
    shadowQuat: new THREE.Quaternion(), shieldQuat: new THREE.Quaternion(),
    coreQuat: new THREE.Quaternion(), gyroQuat: new THREE.Quaternion(),
    space: getTrackSpace(), track: { sampleAt: () => ({ pos: { y: 0 } }) },
  }) as Pool;
}

// TypeScript private fields require a test-only structural view, not a production API.
type CoreBatch = { key: HTMLCanvasElement | null; material: THREE.MeshLambertMaterial; texture: THREE.Texture | null; mesh: THREE.InstancedMesh; refs: number };
type Slot = { canvas: HTMLCanvasElement | null; core: CoreBatch };
type Pool = {
  setRacerCount(count: number): void;
  racers3D: Slot[];
  racerTextures: Map<HTMLCanvasElement | null, CoreBatch>;
  racerResources: {
    sphereGeo: THREE.SphereGeometry;
    capGeo: THREE.BufferGeometry;
    capMat: THREE.MeshLambertMaterial;
    capacity: number;
    caps: THREE.InstancedMesh; shadows: THREE.InstancedMesh; shields: THREE.InstancedMesh;
  };
  scene: THREE.Scene;
  disposeRacerPool(): void;
  drawRacers(frame: unknown, dt: number, firstPerson: boolean, ramps: readonly unknown[], playerDist: number): number;
};

for (const count of [20, 50, 100]) {
  test(`racer pool: ${count} -> 4 -> ${count} releases only unused textures`, () => {
    const shared = {} as HTMLCanvasElement;
    const canvases = Array.from({ length: count }, (_, i) => i % 2 === 0 ? shared : {} as HTMLCanvasElement);
    const p = pool(canvases);
    p.setRacerCount(count);
    // M7: one instanced core mesh per distinct texture, plus the caps, shadows and shields.
    const distinct = 1 + count / 2;
    assert.equal(p.racerTextures.size, distinct);
    assert.equal(p.scene.children.length, 3 + distinct, 'no per-racer scene objects');
    assert.ok(p.racerResources.capacity >= count);
    for (const mesh of p.scene.children as THREE.InstancedMesh[]) assert.ok(mesh.isInstancedMesh);
    const initialTextures = p.racers3D.map((m) => m.core.texture!);
    const sharedTexture = initialTextures[0];
    assert.equal(initialTextures[4], sharedTexture);
    assert.equal(p.racers3D[0].core, p.racers3D[2].core, 'slots wearing one texture share one batch');
    // M01 · T3 (IF-GYRO): the ball is a rolling core between two level caps; both caps are one
    // geometry and one brass material for the whole grid.
    assert.equal(p.racerResources.caps.geometry, p.racerResources.capGeo);
    assert.equal(p.racerResources.caps.material, p.racerResources.capMat);
    const textureDisposals = new Map<THREE.Texture, number>();
    for (const texture of new Set(initialTextures)) {
      textureDisposals.set(texture, 0);
      texture.addEventListener('dispose', () => textureDisposals.set(texture, textureDisposals.get(texture)! + 1));
    }
    let materialDisposals = 0, geometryDisposals = 0, capMaterialDisposals = 0;
    for (const batch of p.racerTextures.values()) batch.material.addEventListener('dispose', () => materialDisposals++);
    p.racerResources.capMat.addEventListener('dispose', () => capMaterialDisposals++);
    for (const geo of [p.racerResources.sphereGeo, p.racerResources.capGeo]) {
      geo.addEventListener('dispose', () => geometryDisposals++);
    }
    p.setRacerCount(4);
    // Slots 0..3 wear shared, u1, shared, u3: three batches stay.
    assert.equal(p.racerTextures.size, 3);
    assert.equal(p.scene.children.length, 3 + 3);
    assert.equal(materialDisposals, distinct - 3);
    assert.equal(geometryDisposals, 0, 'shared geometry remains reusable');
    assert.equal(capMaterialDisposals, 0, 'the shared brass material outlives a shrink');
    assert.equal(textureDisposals.get(sharedTexture), 0, 'texture still used by retained slots');
    assert.equal(textureDisposals.get(initialTextures[5]), 1, 'unused texture is disposed on shrink');
    p.setRacerCount(count);
    assert.equal(p.racers3D[0].core.texture, sharedTexture);
    assert.notEqual(p.racers3D[5].core.texture, initialTextures[5], 'disposed texture is not reused');
    p.disposeRacerPool();
    assert.equal(p.scene.children.length, 0);
    assert.equal(materialDisposals, distinct, 'every original core material disposed exactly once');
    assert.equal(capMaterialDisposals, 1, 'the shared brass material is disposed once');
    assert.equal(geometryDisposals, 2, 'one shell and one cap geometry, however many racers there were');
    for (const n of textureDisposals.values()) assert.equal(n, 1);
    p.disposeRacerPool();
    assert.equal(geometryDisposals, 2, 'teardown is idempotent');
  });
}

test('M7: 100 racers draw in a handful of instanced calls, not ~400 meshes', () => {
  // 13 distinct painted balls, as a 100-racer roster bakes them.
  const looks = Array.from({ length: 13 }, () => ({}) as HTMLCanvasElement);
  const p = pool(Array.from({ length: 100 }, (_, i) => looks[i % looks.length]));
  p.setRacerCount(100);
  const racers = Array.from({ length: 100 }, (_, i) => ({
    x: START_X + 400 + i * 60, y: 0, z: ((i % 4) - 1.5) * 120, grounded: true, rollPhase: i * 0.3,
    shieldUntil: i === 7 ? 99 : 0, hidden: i === 9,
  }));
  p.drawRacers({ racers, runTime: 1 }, 1 / 60, true, [], 0);
  const drawn = (p.scene.children as THREE.InstancedMesh[]).filter((mesh) => mesh.count > 0);
  assert.ok(drawn.length <= 16, `${drawn.length} draw calls`);
  const cores = [...p.racerTextures.values()].reduce((sum, batch) => sum + batch.mesh.count, 0);
  // First person hides the player's own ball; racer 9 is hidden.
  assert.equal(cores, 98);
  assert.equal(p.racerResources.caps.count, 98);
  assert.equal(p.racerResources.shadows.count, 98);
  assert.equal(p.racerResources.shields.count, 1, 'only the shielded racer draws a bubble');
  // Each instance sits where placement puts its racer.
  const m = new THREE.Matrix4(); const at = new THREE.Vector3();
  p.racers3D[1].core.mesh.getMatrixAt(0, m);
  at.setFromMatrixPosition(m);
  assert.ok(Number.isFinite(at.x) && at.lengthSq() > 0);
  p.disposeRacerPool();
});
