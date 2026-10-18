// ============================================================================
// File: apps/web/src/play/remote-peers.test.ts
// Unit tests for remote-peers.ts (F-14 / play-scene.ts Window B remote avatar controller).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRemotePeersController } from './remote-peers';

test('createRemotePeersController adds, updates, and removes remote peer avatars in Three.js scene', () => {
  const scene = new THREE.Scene();
  const ctrl = createRemotePeersController(scene);
  assert.equal(ctrl.getAvatarCount(), 0);

  ctrl.setRemotePeers([
    { id: 'cb-1', username: 'BuilderBob', role: 'cobuilder', x: 10, y: 1.5, z: -4, yaw: 0.75, look: 'default', at: 100 },
    { id: 'vis-1', username: 'ObserverEve', role: 'visitor', x: -3, y: 0, z: 8, yaw: -0.5, look: 'default', at: 100 },
  ]);
  assert.equal(ctrl.getAvatarCount(), 2);
  assert.deepEqual(ctrl.getPeerIds().sort(), ['cb-1', 'vis-1']);

  const bobNode = ctrl.group.getObjectByName('remote-peer-cb-1')!;
  assert.ok(bobNode);
  assert.equal(bobNode.position.x, 10);
  assert.equal(bobNode.position.z, -4);
  assert.equal(bobNode.userData.roleLabel, 'Co-Builder');

  // Role demotion updates badge metadata and removes disconnected peer
  ctrl.setRemotePeers([
    { id: 'cb-1', username: 'BuilderBob', role: 'visitor', x: 12, y: 1.5, z: -2, yaw: 1.0, look: 'default', at: 200 },
  ]);
  assert.equal(ctrl.getAvatarCount(), 1);
  assert.equal(bobNode.userData.roleLabel, 'Field Observer');
  assert.equal(bobNode.position.x, 12);

  ctrl.dispose();
  assert.equal(ctrl.getAvatarCount(), 0);
});

test('POL-174: peer join then leave disposes both geometries and materials', () => {
  const scene = new THREE.Scene();
  const ctrl = createRemotePeersController(scene);

  ctrl.setRemotePeers([
    { id: 'peer-temp', username: 'TempBob', role: 'cobuilder', x: 0, y: 0, z: 0, yaw: 0, look: 'default', at: 1 },
  ]);
  assert.equal(ctrl.getAvatarCount(), 1);

  const node = ctrl.group.getObjectByName('remote-peer-peer-temp')!;
  assert.ok(node);

  let geosDisposed = 0;
  let matsDisposed = 0;
  const trackedGeos = new Set<THREE.BufferGeometry>();
  const trackedMats = new Set<THREE.Material>();

  node.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry && !trackedGeos.has(obj.geometry)) {
        trackedGeos.add(obj.geometry);
        obj.geometry.addEventListener('dispose', () => { geosDisposed++; });
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m && !trackedMats.has(m)) {
          trackedMats.add(m);
          m.addEventListener('dispose', () => { matsDisposed++; });
        }
      }
    }
  });

  assert.equal(trackedGeos.size, 4, 'avatar rig has 4 mesh geometries');
  assert.equal(trackedMats.size, 3, 'avatar rig has 3 distinct materials');
  assert.equal(geosDisposed, 0);
  assert.equal(matsDisposed, 0);

  // Peer leaves: setRemotePeers without peer-temp
  ctrl.setRemotePeers([]);
  assert.equal(ctrl.getAvatarCount(), 0);

  assert.equal(geosDisposed, 4, 'all 4 geometries disposed on leave');
  assert.equal(matsDisposed, 3, 'all 3 materials disposed on leave');
});
