/**
 * Dragging a lane node: the handle, its path line and the selection wireframe follow the node on the
 * same frame. They used to read the builder's *previous* document, so the node only moved visually
 * after some later full rebuild (~30 s) and a white wireframe stayed at the old spot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { LaneGizmos } from '../src/game/lane-gizmos';
import { createDefaultLaneNetwork } from '../src/game/lane-network';
import { applyLaneEdit } from '../src/game/lane-path-tool';

function handlePosition(scene: THREE.Scene, index: number): THREE.Vector3 {
  const handles = scene.getObjectByName('LaneHandles') as THREE.InstancedMesh;
  const m = new THREE.Matrix4();
  handles.getMatrixAt(index, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
}

test('the handle and the selection wireframe follow a drag on the same frame', () => {
  const scene = new THREE.Scene();
  const gizmos = new LaneGizmos(scene);
  let network = createDefaultLaneNetwork('ridge');
  gizmos.setNetwork(network);
  const index = 40;
  const node = network.nodes[index];
  gizmos.setSelectedNode(node.id);
  const childrenBefore = gizmos.root.children.length;

  for (let frame = 1; frame <= 50; frame++) {
    const result = applyLaneEdit(network, { op: 'moveNode', nodeId: node.id, x: node.x + frame * 2, z: node.z + frame });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    network = result.network;
    gizmos.moveNode(node.id, network); // what the builder does on every drag frame
    gizmos.setSelectedNode(node.id);
    const moved = network.nodes.find((n) => n.id === node.id)!;
    const expected = gizmos.worldFromEngine(moved.x, moved.z);
    assert.ok(handlePosition(scene, index).distanceTo(expected) < 0.01, `frame ${frame}: handle is on the moved node`);
    const selected = scene.getObjectByName('LaneSelectedNode')!;
    assert.ok(selected.position.distanceTo(expected) < 1e-6, `frame ${frame}: wireframe is on the moved node, not left behind`);
  }
  assert.equal(gizmos.root.children.length, childrenBefore, '50 moves add no objects (nothing left behind, no leak)');
});

test('the builder hands the new document to the gizmos on a move', () => {
  const builder = readFileSync(new URL('../src/game/track-builder-3d.ts', import.meta.url), 'utf8');
  assert.match(builder, /this\.laneGizmos\.moveNode\(edit\.nodeId, this\.laneDoc\)/);
});
