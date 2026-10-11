import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as THREE from 'three';
import * as S from '@hm/structure';
import { PieceMeshManager } from './piece-meshes';
import { createWorld, structureEnv, type BaseWorld, type WorldEnv } from './world';

const env: WorldEnv = { heightAt: () => 0, bridge: { x: 0, z: 0, range: 60 } };

test('PieceMeshManager renders static pieces through @hm/batcher instanced meshes', () => {
  const manager = new PieceMeshManager();
  const w0 = createWorld();
  const bEnv = structureEnv(env);

  // Place starter foundation
  const f = S.found(w0.base, bEnv, 0, 0, 0, 'regolith');
  assert.ok(f.ok);
  const s = f.base.pieces[0]!.s;

  // Place floor, wall, and a door
  const p1 = S.place(f.base, bEnv, { s, kind: 'floor', i: 1, j: 0, k: 0, r: 0, mat: 'regolith' });
  assert.ok(p1.ok);
  const p2 = S.place(p1.base, bEnv, { s, kind: 'wall', i: 0, j: 0, k: 0, r: 0, mat: 'regolith' });
  assert.ok(p2.ok);
  const p3 = S.place(p2.base, bEnv, { s, kind: 'door', i: 0, j: 1, k: 0, r: 0, mat: 'regolith' });
  assert.ok(p3.ok);

  const world: BaseWorld = { ...w0, base: p3.base };

  manager.sync(world, env, false);

  // Verify batcher has live instances for every piece
  assert.equal(manager.batcherInstances, world.base.pieces.length);
  assert.ok(manager.batcherDrawCalls > 0);

  // Verify root contains InstancedMeshes
  const instancedMeshes = manager.root.children.filter((c) => c instanceof THREE.InstancedMesh);
  assert.ok(instancedMeshes.length > 0);

  // Door leaf must exist as a separate dynamic mesh
  const doorDynamic = manager.root.children.find((c) => c.name.startsWith('dynamic-door-'));
  assert.ok(doorDynamic);
  const leaf = doorDynamic.getObjectByName('door-leaf');
  assert.ok(leaf);

  // Raycast piece identification via pieceIdFromHit
  const wallMesh = instancedMeshes.find((m) => m.name.startsWith('wall|'));
  if (wallMesh) {
    const id = manager.pieceIdFromHit(wallMesh, 0);
    assert.ok(typeof id === 'number');
  }

  // Integrity tint test
  manager.sync(world, env, true);
  // Restore normal
  manager.sync(world, env, false);

  // Removal & collapse test
  const removedId = p2.base.pieces.find((p) => p.kind === 'wall')!.id;
  manager.handleRemoval(removedId, []);
  assert.equal(manager.batcherInstances, world.base.pieces.length - 1);

  manager.dispose();
  assert.equal(manager.batcherInstances, 0);
  assert.equal(manager.batcherDrawCalls, 0);
});
