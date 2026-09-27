/**
 * Lane editing in groups: select several nodes (Shift/Ctrl-click, a box, whole lanes, all), then move,
 * nudge or delete them together in one undoable step.
 *
 *   node --import tsx --test tests/lane-multiselect.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyLaneEdit } from '../src/game/lane-path-tool';
import { islandLaneNetwork } from '../src/game/island-route/island-lanes';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import type { TrackData } from '../src/game/renderer-3d';

function builder() {
  const data = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  };
  const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
  const b = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'none');
  b.setCourse('basalt');
  b.setLaneNetwork(islandLaneNetwork(), { pushUndo: false });
  return b;
}
const node = (b: TrackBuilder3D, id: string) => b.getLaneNetwork()!.nodes.find((n) => n.id === id)!;

test('moveNodes moves a group at once, or refuses and changes nothing', () => {
  const net = islandLaneNetwork();
  const ids = ['groove1-x5590', 'groove2-x5590', 'groove3-x5590'];
  const moved = applyLaneEdit(net, { op: 'moveNodes', moves: ids.map((nodeId) => ({ nodeId, x: 5690, z: net.nodes.find((n) => n.id === nodeId)!.z + 40 })) });
  assert.ok(moved.ok, moved.ok ? '' : moved.reason);
  if (moved.ok) for (const id of ids) assert.equal(moved.network.nodes.find((n) => n.id === id)!.x, 5690);
  // Past the next node of the same lane: out of order, so nothing moves.
  const bad = applyLaneEdit(net, { op: 'moveNodes', moves: [{ nodeId: 'groove1-x5590', x: 7000, z: -290 }] });
  assert.equal(bad.ok, false);
  assert.equal(net.nodes.find((n) => n.id === 'groove1-x5590')!.x, 5590, 'the original is untouched');
});

test('Shift-click adds and removes nodes; a plain click selects just one', () => {
  const b = builder();
  b.selectLaneNode('groove1-x5590');
  b.selectLaneNode('groove2-x5590', true);
  b.selectLaneNode('groove3-x5590', true);
  assert.deepEqual(b.getSelectedLaneNodeIds().sort(), ['groove1-x5590', 'groove2-x5590', 'groove3-x5590']);
  assert.equal(b.getSelectedLaneNode()?.id, 'groove3-x5590', 'the last one clicked carries the gizmo');
  b.selectLaneNode('groove2-x5590', true);
  assert.deepEqual(b.getSelectedLaneNodeIds().sort(), ['groove1-x5590', 'groove3-x5590'], 'clicking a selected node with Shift takes it out');
  b.selectLaneNode('groove1-x6190');
  assert.deepEqual(b.getSelectedLaneNodeIds(), ['groove1-x6190']);
  b.selectLaneNode(null);
  assert.deepEqual(b.getSelectedLaneNodeIds(), []);
});

test('a whole lane is one key away, and nudging moves the group in one undo step', () => {
  const b = builder();
  b.selectLaneNodes(['groove2-x5590', 'groove2-x6190']);
  const before = [node(b, 'groove2-x5590').z, node(b, 'groove2-x6190').z];
  assert.ok(b.nudgeLaneNodes(0, 20).ok);
  assert.deepEqual([node(b, 'groove2-x5590').z, node(b, 'groove2-x6190').z], before.map((z) => z + 20));
  b.undo();
  assert.deepEqual([node(b, 'groove2-x5590').z, node(b, 'groove2-x6190').z], before, 'one undo puts both back');
  b.selectLanePaths();
  assert.equal(b.getSelectedLaneNodeIds().length, islandLaneNetwork().paths[1].nodeIds.length, 'the whole centre lane');
  assert.ok(b.nudgeLaneNodes(0, -30).ok, 'a whole lane slides across the road');
});

test('deleting a group removes every node a lane can spare', () => {
  const b = builder();
  const total = b.getLaneNetwork()!.nodes.length;
  b.selectLaneNodes(['groove1-x5590', 'groove1-x6190', 'groove3-x5590']);
  assert.equal(b.deleteSelectedLaneNodes(), 3);
  assert.equal(b.getLaneNetwork()!.nodes.length, total - 3);
  assert.deepEqual(b.getSelectedLaneNodeIds(), []);
});
