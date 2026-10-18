// ============================================================================
// File: apps/web/src/monsters/leak-visual.test.ts
// Unit tests for the leak visual (TICKET-07 Item A — MC-01): the S-Space rift replaces the cylinder and ring marker.
// The scene graph is built without a renderer, so these run in node.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { MonsterMarker } from '../play/monsters';
import { createLeakVisuals, riftStateFor } from './leak-visual';

const marker = (over: Partial<MonsterMarker> = {}): MonsterMarker => ({
  id: 4,
  site: 2,
  x: 30,
  z: -12,
  dormant: false,
  state: 'open',
  inSeconds: null,
  junk: 'wrecked-truck-cab-c',
  seal: 0,
  era: 'modern3d',
  ...over,
});

const frame = (markers: MonsterMarker[], sealing: number | null = null) => ({
  dt: 0.05,
  markers,
  sealing,
  camera: new THREE.PerspectiveCamera(),
  stage: 3,
});

const leakGroup = (scene: THREE.Scene): THREE.Object3D => {
  const g = scene.getObjectByName('leak:4');
  assert.ok(g, 'the leak has a group');
  return g;
};

test('the leak is an S-Space rift with no cylinder column or ring marker', () => {
  const scene = new THREE.Scene();
  const visuals = createLeakVisuals(scene, () => 0);
  visuals.update(frame([marker()]));

  const group = leakGroup(scene);
  assert.ok(group.getObjectByName('s-space-rift'), 'the rift stands in the leak group');
  let cylinders = 0;
  let rings = 0;
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o.geometry instanceof THREE.CylinderGeometry) cylinders += 1;
    if (o.geometry instanceof THREE.RingGeometry) rings += 1;
  });
  assert.equal(cylinders, 0, 'no cylinder column');
  assert.equal(rings, 0, 'no ring marker');
  visuals.dispose();
});

test('the rift turns amber while sealing and collapses to its scar once sealed', () => {
  const scene = new THREE.Scene();
  const visuals = createLeakVisuals(scene, () => 0);
  const rift = (): THREE.Object3D => leakGroup(scene).getObjectByName('s-space-rift')!;
  const tear = (): THREE.Object3D => rift().getObjectByName('rift-tear')!;
  // the rift is one merged mesh (POL-98): its state is the shader's uState (0 open, 1 sealing, 2 sealed), and its palette follows it
  const uState = (): number => ((rift().getObjectByName('rift-unified-mesh') as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uState!.value as number;

  visuals.update(frame([marker()]));
  assert.equal(tear().visible, true, 'an open leak shows its tear');
  assert.equal(uState(), 0, 'the open seam is magenta (uState 0)');

  visuals.update(frame([marker({ seal: 0.4 })], 4));
  assert.equal(tear().visible, true, 'a sealing leak still shows its tear');
  assert.equal(uState(), 1, 'the sealing seam is amber (uState 1)');

  visuals.update(frame([marker({ state: 'sealed', seal: 1 })], null));
  assert.equal(tear().visible, false, 'a sealed leak hides its tear');
  assert.equal(rift().getObjectByName('rift-scar')!.visible, true, 'the scar stays');
  visuals.dispose();
});

test('riftStateFor: sealed is a scar, sealing is amber, a dormant leak is a scar until it is sealed', () => {
  assert.equal(riftStateFor({ state: 'open', dormant: false }, false), 'open');
  assert.equal(riftStateFor({ state: 'warned', dormant: false }, false), 'open');
  assert.equal(riftStateFor({ state: 'open', dormant: false }, true), 'sealing');
  assert.equal(riftStateFor({ state: 'sealed', dormant: false }, true), 'sealed');
  assert.equal(riftStateFor({ state: 'dormant', dormant: true }, false), 'sealed');
  assert.equal(riftStateFor({ state: 'dormant', dormant: true }, true), 'sealing');
});

test('beyond the detail distance the tear is not drawn, and the collar and scar stay (the draw-call budget)', () => {
  const scene = new THREE.Scene();
  const visuals = createLeakVisuals(scene, () => 0);
  // the camera sits at the origin: a leak 200 m away is far, a leak 32 m away (the test above) is near
  visuals.update(frame([marker({ x: 200, z: 0 })]));
  const rift = leakGroup(scene).getObjectByName('s-space-rift')!;
  assert.equal(rift.getObjectByName('rift-tear')!.visible, false, 'the far tear is not drawn');
  assert.equal(rift.getObjectByName('rift-scar')!.visible, true, 'the far scar stays');
  assert.equal(rift.getObjectByName('rift-collar')!.visible, true, 'the far collar stays');
  // a leak is placed once (its group keeps the position it was created at), so the near leak is a second set of visuals
  const nearScene = new THREE.Scene();
  const near = createLeakVisuals(nearScene, () => 0);
  near.update(frame([marker({ x: 30, z: 0 })]));
  const nearRift = nearScene.getObjectByName('leak:4')!.getObjectByName('s-space-rift')!;
  assert.equal(nearRift.getObjectByName('rift-tear')!.visible, true, 'the tear is drawn when the leak is near');
  near.dispose();
  visuals.dispose();
});
