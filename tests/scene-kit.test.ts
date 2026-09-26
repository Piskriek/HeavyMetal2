/**
 * The builder's scene kit: placed lights, primitives with shaders, and edits to the course's own
 * scenery (select, move, hide, restore). Run with: node --import tsx --test tests/scene-kit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrackBuilder3D, type PlacedProp } from '../src/game/track-builder-3d';
import type { TrackData } from '../src/game/types';
import { SceneryIndex, unwrapPivot, wrapInPivot } from '../src/game/builder/scenery-index';
import { LightRig, POINT_SLOTS, lightSettingsFor } from '../src/game/builder/light-rig';
import { primitiveGeometry, primitiveSize } from '../src/game/builder/primitives';
import { injectBlend, maskWindow, setTileRandomization } from '../src/game/materials/blend-material';
import { DEFAULT_SHADER, STARTER_SHADERS, mergeShadersFromProps, normalizeShader } from '../src/game/materials/shader-library';

const mockTrack = { samples: [], length: 0 } as unknown as TrackData;

function sceneWithScenery() {
  const scene = new THREE.Scene();
  const rock = new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200).translate(1000, 100, 0), new THREE.MeshStandardMaterial());
  rock.name = 'TestRock';
  const road = new THREE.Mesh(new THREE.BoxGeometry(400, 10, 400).translate(-1000, 0, 0), new THREE.MeshStandardMaterial());
  road.name = 'TrackSurface';
  scene.add(new THREE.AmbientLight(), rock, road);
  return { scene, rock, road };
}

/** A camera at (1000, 100, 1000) looking at the rock, and a canvas whose centre pixel aims at it. */
function builderLookingAtRock() {
  const { scene, rock, road } = sceneWithScenery();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 100000);
  camera.position.set(1000, 100, 1000);
  camera.lookAt(1000, 100, 0);
  camera.updateMatrixWorld(true);
  const builder = new TrackBuilder3D(scene, camera, mockTrack);
  builder.clearAll();
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } as unknown as HTMLCanvasElement;
  return { scene, camera, builder, canvas, rock, road };
}

const worldCenter = (o: THREE.Object3D) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); };

test('scenery: the same build gives the same keys; a pivot round trip leaves the part as generated', () => {
  const a = new SceneryIndex(sceneWithScenery().scene);
  const b = new SceneryIndex(sceneWithScenery().scene);
  assert.deepEqual(a.all.map((p) => p.key), b.all.map((p) => p.key));
  assert.equal(a.all.length, 2, 'the light is not scenery');
  assert.equal(a.all.find((p) => p.root.name === 'TrackSurface')?.locked, true, 'the road is locked');

  const { scene, rock } = sceneWithScenery();
  const index = new SceneryIndex(scene);
  const part = index.partOf(rock)!;
  const before = worldCenter(rock);
  const pivot = wrapInPivot(part, scene);
  assert.ok(worldCenter(rock).distanceTo(before) < 1e-6, 'wrapping does not move it');
  pivot.position.x += 500; pivot.rotation.y = 1; pivot.scale.setScalar(2); pivot.updateMatrixWorld(true);
  unwrapPivot(part, pivot, scene);
  assert.ok(worldCenter(rock).distanceTo(before) < 1e-6, 'unwrapping puts it back exactly');
  assert.equal(rock.parent, scene);
});

test('primitives mode: click scenery, move it, delete (hide) it, restore it', () => {
  const { builder, canvas, rock, road } = builderLookingAtRock();
  const before = worldCenter(rock);

  // pickTerrain works in any mode; the UI only calls it in Primitives mode.
  builder.setTerrainPicking(true);
  const edit = builder.pickTerrain(50, 50, canvas);
  assert.ok(edit, 'the rock under the cursor is picked');
  assert.equal(edit!.type, 'terrain_edit');
  assert.equal(builder.getSelectedProp()?.id, edit!.id);

  builder.updatePropTransform(edit!.id, { x: edit!.x + 300 });
  assert.ok(Math.abs(worldCenter(rock).x - (before.x + 300)) < 1e-3, 'the part moved with its edit');

  builder.deleteSelected();
  assert.equal(rock.parent?.visible, false, 'delete hides the part');
  assert.ok(builder.getProps().some((p) => p.id === edit!.id), 'the edit is kept so it can be restored');
  assert.equal(builder.getTerrainEdits()[0].hidden, true);

  builder.undo();
  assert.notEqual(rock.parent?.visible, false, 'undo brings it back');

  builder.resetTerrainEdit(builder.getTerrainEdits()[0].prop.id);
  assert.equal(rock.parent?.type, 'Scene');
  assert.ok(worldCenter(rock).distanceTo(before) < 1e-6, 'reset puts the part back as generated');
  assert.equal(builder.getTerrainEdits().length, 0);
  void road;
});

test('primitives mode: a part that was only clicked is dropped, never saved; the road cannot be removed', () => {
  const { builder, canvas, road } = builderLookingAtRock();
  builder.setTerrainPicking(true);
  const edit = builder.pickTerrain(50, 50, canvas)!;
  builder.selectProp(null);
  assert.ok(!builder.getProps().some((p) => p.id === edit.id), 'an unchanged edit is dropped on deselect');

  // Select the road through its edit and try to delete it.
  const roadEdit: PlacedProp = { id: 'road-edit', type: 'terrain_edit', name: 'Road', x: 0, y: 0, z: 0, rotY: 0, scale: 1,
    terrainKey: new SceneryIndex(sceneWithScenery().scene).all.find((p) => p.locked)!.key, terrainOrigin: [-1000, 0, 0], shader: normalizeShader(DEFAULT_SHADER) };
  builder.importJson(JSON.stringify([roadEdit]));
  builder.selectProp('road-edit');
  builder.deleteSelected();
  assert.notEqual(road.parent?.visible, false, 'the road stays');
  assert.match(builder.getPlacementError() ?? '', /race line/);
});

test('primitives: sized by width/height/depth, dressed with a shader from the library', () => {
  const { builder } = builderLookingAtRock();
  const box: PlacedProp = { id: 'b1', type: 'prim_box', name: 'Box', x: 10, y: 0, z: 20, rotY: 0, scale: 1, width: 300, height: 120, depth: 50 };
  builder.importJson(JSON.stringify([box]));
  builder.selectProp('b1');
  const shader = builder.getShaderLibrary()[0];
  assert.equal(builder.applyShaderToSelected(shader.id), 1);
  const saved = builder.getProps().find((p) => p.id === 'b1')!;
  assert.equal((saved.shader as { id: string }).id, shader.id, 'the prop carries an inline copy');
  assert.deepEqual(primitiveSize(saved), [300, 120, 50]);
  // Every shape builds a unit-sized geometry with its base on the ground.
  for (const shape of ['box', 'sphere', 'cylinder', 'cone', 'torus', 'ramp', 'plane', 'rock', 'capsule', 'arch'] as const) {
    const bb = primitiveGeometry(shape).boundingBox!;
    assert.ok(Math.abs(bb.min.y) < 0.05, `${shape} sits on y = 0`);
    assert.ok(bb.max.y > 0.8 && bb.max.y < 1.05, `${shape} is about one unit tall`);
  }
});

test('lights: the nearest lights get the fixed pool; the rest wait', () => {
  const scene = new THREE.Scene();
  const rig = new LightRig(scene);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 0);
  camera.updateMatrixWorld(true);
  const s = lightSettingsFor({ type: 'light_lantern' });
  for (let i = 0; i < 12; i++) rig.set(`l${i}`, s, new THREE.Vector3(i * 300, 0, 0), new THREE.Vector3(0, -1, 0));
  const poolBefore = scene.children.length;
  rig.update(camera, 1, true);
  assert.equal(rig.lit, POINT_SLOTS, 'only the pool shines');
  assert.equal(scene.children.length, poolBefore, 'no lights are added while updating (no recompiles)');
  const shining = scene.children.filter((o) => (o as THREE.PointLight).isPointLight && o.visible).map((o) => o.position.x).sort((a, b) => a - b);
  assert.deepEqual(shining.slice(0, 3), [0, 300, 600], 'the nearest ones');
});

test('shaders: values are clamped, starters are valid, shaders on props join the library', () => {
  const s = normalizeShader({ ...DEFAULT_SHADER, masks: [{ seed: -5, size: 1, coverage: 3, softness: -1, detail: 99 }], roughness: 9 });
  assert.deepEqual(s.masks[0], { seed: 0, size: 100, coverage: 1, softness: 0, detail: 6 });
  assert.equal(s.roughness, 1);
  for (const starter of STARTER_SHADERS) assert.deepEqual(normalizeShader(starter), starter);
  const imported = { ...DEFAULT_SHADER, id: 'from-elsewhere', name: 'Elsewhere' };
  const merged = mergeShadersFromProps(STARTER_SHADERS, [{ shader: imported }, { shader: imported }, {}]);
  assert.equal(merged.added, 1);
  assert.equal(maskWindow(0, 0.5).threshold > 1, true, 'zero coverage never shows');
});

test('shaders: the blend is injected into the real standard shader, and the tile randomiser undoes cleanly', () => {
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} as Record<string, unknown> };
  injectBlend(shader, {} as never);
  assert.match(shader.fragmentShader, /hm2Mask\(hm2MaskA/);
  assert.doesNotMatch(shader.fragmentShader, /#include <map_fragment>/);
  assert.match(shader.vertexShader, /hm2WorldPos = /);

  const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  const original = mat.onBeforeCompile;
  assert.equal(setTileRandomization([mat], true), 1);
  const patched = { vertexShader: '', fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} as Record<string, unknown> };
  mat.onBeforeCompile(patched as never, {} as never);
  assert.match(patched.fragmentShader, /hm2NoTile\(map, vMapUv/);
  assert.equal(setTileRandomization([mat], false), 1);
  assert.equal(mat.onBeforeCompile, original);
});
