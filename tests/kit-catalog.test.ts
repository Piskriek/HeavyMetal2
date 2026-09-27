/**
 * The Meshy models on the builder's shelves (models/kit-catalog.ts, models/kit-object.ts).
 *
 *   node --import tsx --test tests/kit-catalog.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { KIT_MODELS, KIT_DEFINITIONS, kitModelFor, kitModelUrl, kitThumbUrl } from '../src/game/models/kit-catalog';
import { KIT_BRIGHTNESS_MAX_GLOW, fitKitModel, setKitBrightness } from '../src/game/models/kit-object';
import { PROP_DEFINITIONS } from '../src/game/builder/prop-catalog';
import { isKitType } from '../src/game/builder/scene-kit';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import { readIslandProps } from '../src/game/island-route/island-props-storage';
import type { TrackData } from '../src/game/renderer-3d';

const publicFile = (url: string) => new URL(`../public${url}`, import.meta.url);

test('every model in the kit index is on a shelf, once', () => {
  const index: string[] = JSON.parse(readFileSync(publicFile('/models/kit/index.json'), 'utf8'));
  assert.deepEqual([...KIT_MODELS.map((m) => m.id)].sort(), [...index].sort());
  for (const def of KIT_DEFINITIONS) assert.ok(PROP_DEFINITIONS.includes(def), `${def.type} is placeable`);
  assert.equal(new Set(PROP_DEFINITIONS.map((d) => d.type)).size, PROP_DEFINITIONS.length, 'no duplicate prop types');
});

test('every model has its full and low tier and its own icon on disk', () => {
  for (const m of KIT_MODELS) {
    for (const url of [kitModelUrl(m.id), kitModelUrl(m.id, true), kitThumbUrl(m.id)]) {
      assert.ok(existsSync(publicFile(url)), `${url} exists`);
    }
    const png = readFileSync(publicFile(kitThumbUrl(m.id)));
    assert.equal(png.readUInt32BE(16), 256, `${m.id} icon is 256 wide`);
    assert.equal(png[25], 6, `${m.id} icon keeps its transparency`);
  }
});

test('the closed rings are decoration, the rideable loops are stunts', () => {
  for (const id of ['stunt-giant-loop', 'stunt-double-loop', 'stunt-hoop-tunnel']) assert.equal(kitModelFor(`kit_${id}`)?.shelf, 'decoration');
  for (const id of ['stunt-loop-ramp', 'stunt-double-loop-ramps', 'jump-ramp']) assert.equal(kitModelFor(`kit_${id}`)?.shelf, 'stunts');
  assert.ok(isKitType('kit_jump-ramp'));
  assert.equal(kitModelFor('kit_nope'), undefined);
});

test('a model is fitted to its size, centred and standing on the placement point', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5));
  mesh.position.set(3, 4, -1);
  const holder = new THREE.Group();
  holder.add(mesh);
  fitKitModel(holder, 1000);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 1000) < 1e-6);
  assert.ok(Math.abs(box.min.y) < 1e-6, 'base at 0');
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6 && Math.abs(box.min.z + box.max.z) < 1e-6, 'centred');
});

test('a placed model is an ordinary prop: it is saved, moved, scaled and removed like any other', () => {
  const data = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  };
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => new Response('{}', { status: 200 });
  try {
    const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
    const scene = new THREE.Scene();
    const builder = new TrackBuilder3D(scene, new THREE.PerspectiveCamera(), track, undefined, 'island');
    builder.importJson(JSON.stringify([{ id: 'ramp-1', type: 'kit_jump-ramp', x: 10, y: 20, z: 30, rotY: 0.5, scale: 1 }]));
    const obj = scene.getObjectByName('PlacedProp_ramp-1')!;
    assert.ok(obj, 'the model is in the scene');
    assert.equal(obj.userData.propId, 'ramp-1', 'clicks on it select the prop');
    assert.deepEqual(obj.position.toArray(), [10, 20, 30]);
    builder.updatePropTransform('ramp-1', { x: 50, scale: 2 });
    assert.equal(obj.position.x, 50);
    assert.equal(obj.scale.y, 2);
    assert.equal(readIslandProps()[0].x, 50, 'saved in the island store');
    builder.deleteProp('ramp-1');
    assert.equal(scene.getObjectByName('PlacedProp_ramp-1'), undefined, 'removed from the scene');
    (builder as any).backups.destroy();
  } finally {
    (globalThis as any).fetch = realFetch;
  }
});

test('brightness 0..100 glows a model on its own copy of the material, and 0 puts the original back', () => {
  const shared = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  const a = new THREE.Group(); a.add(new THREE.Mesh(new THREE.BoxGeometry(), shared));
  const b = new THREE.Group(); b.add(new THREE.Mesh(new THREE.BoxGeometry(), shared));
  setKitBrightness(a, 50);
  const meshA = a.children[0] as THREE.Mesh;
  const bright = meshA.material as THREE.MeshStandardMaterial;
  assert.notEqual(bright, shared, 'its own material');
  assert.equal(bright.emissiveIntensity, 0.5 * KIT_BRIGHTNESS_MAX_GLOW);
  assert.equal(bright.emissiveMap, shared.map, 'the texture itself glows');
  assert.equal(shared.emissiveIntensity, 1, 'the shared material is untouched');
  assert.equal((b.children[0] as THREE.Mesh).material, shared, 'other copies are untouched');
  setKitBrightness(a, 100);
  assert.equal((meshA.material as THREE.MeshStandardMaterial).emissiveIntensity, KIT_BRIGHTNESS_MAX_GLOW);
  setKitBrightness(a, 0);
  assert.equal(meshA.material, shared, '0 is the model exactly as lit');
});
