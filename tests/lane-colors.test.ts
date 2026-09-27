/**
 * Lanes have colours, and a ball changes only to a lane of its own colour. Split cuts the lane at the
 * selected node into two lanes leaving that node: the original colour carries on, and the new branch
 * (parallel, one lane over) gets a colour of its own, so past the split a ball is committed. Colour
 * cycles a lane's colour. Nodes are picked by screen distance, and a rebuild never leaves the old
 * selection ball behind.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyLaneEdit } from '../src/game/lane-path-tool';
import { LANE_COLORS, adjacentPath, advancePaths, inferKind, laneColorOf, validateLaneNetwork, type LaneNetwork } from '../src/game/lane-network';
import { LaneGizmos } from '../src/game/lane-gizmos';
import { laneEditForCommand } from '../src/game/lane-panel-model';

const twoLanes = (): LaneNetwork => ({
  version: 1, course: 'basalt',
  nodes: [
    { id: 'a1', x: 1000, z: 120, kind: 'normal' }, { id: 'a2', x: 3000, z: 120, kind: 'normal' }, { id: 'a3', x: 5000, z: 120, kind: 'normal' }, { id: 'a4', x: 7000, z: 120, kind: 'normal' },
    { id: 'b1', x: 1000, z: -120, kind: 'normal' }, { id: 'b2', x: 7000, z: -120, kind: 'normal' },
  ],
  paths: [
    { id: 'A', name: 'A', nodeIds: ['a1', 'a2', 'a3', 'a4'], halfWidth: 120 },
    { id: 'B', name: 'B', nodeIds: ['b1', 'b2'], halfWidth: 120 },
  ],
} as LaneNetwork);

const ok = (network: LaneNetwork, edit: Parameters<typeof applyLaneEdit>[1]) => {
  const r = applyLaneEdit(network, edit);
  assert.ok(r.ok, r.ok ? '' : r.reason);
  return (r as { network: LaneNetwork }).network;
};

test('a ball changes only to a lane of its own colour', () => {
  const n = twoLanes();
  assert.equal(adjacentPath(n, 'A', 2000, 1), 'B', 'same colour (both default): B is next door');
  const recoloured = { ...n, paths: n.paths.map((p) => p.id === 'B' ? { ...p, color: LANE_COLORS[1] } : p) };
  assert.equal(adjacentPath(recoloured, 'A', 2000, 1), null, 'another colour: no lane change');
  assert.equal(laneColorOf(n.paths[0]), LANE_COLORS[0], 'no colour = the default');
});

test('Split cuts the lane at the node into two lanes leaving it; the branch has its own colour', () => {
  const forked = ok(twoLanes(), { op: 'fork', nodeId: 'a2' });
  assert.equal(validateLaneNetwork(forked).ok, true);
  assert.equal(inferKind(forked, 'a2'), 'split', 'the node is now a split');
  const A = forked.paths.find((p) => p.id === 'A')!;
  assert.deepEqual(A.nodeIds, ['a1', 'a2'], 'the lane ends at the split');
  const onward = forked.paths.find((p) => p.nodeIds[0] === 'a2' && p.nodeIds.includes('a3'))!;
  assert.deepEqual(onward.nodeIds, ['a2', 'a3', 'a4'], 'and carries on in its own colour');
  assert.equal(laneColorOf(onward), laneColorOf(A));
  const branch = forked.paths.find((p) => p.nodeIds[0] === 'a2' && p !== onward)!;
  assert.equal(branch.nodeIds.length, 3, 'the branch runs parallel all the way down');
  assert.notEqual(laneColorOf(branch), laneColorOf(A), 'in a colour of its own');
  const second = forked.nodes.find((node) => node.id === branch.nodeIds[1])!;
  assert.equal(second.x, 5000); assert.equal(Math.abs(second.z - 120), 240, 'one lane width over');

  // A ball on the branch cannot hop back; one arriving at the split takes the branch on its side.
  assert.equal(adjacentPath(forked, branch.id, 6000, second.z < 120 ? -1 : 1), null);
  const ball = { pathId: 'A', x: 3100, z: second.z < 120 ? 20 : 220, finished: false };
  advancePaths([ball], forked);
  assert.equal(ball.pathId, branch.id, 'steering to the branch side at the junction takes the branch');
});

test('Split refuses where it cannot work, and names why', () => {
  const at = (nodeId: string) => applyLaneEdit(twoLanes(), { op: 'fork', nodeId });
  assert.match((at('a1') as { reason: string }).reason, /^split_at_start:/);
  assert.match((at('a4') as { reason: string }).reason, /^nothing_after:/);
  const panel = laneEditForCommand({ op: 'split' }, twoLanes(), { nodeId: 'a2' });
  assert.ok(panel.ok && panel.action.kind === 'edit' && panel.action.edit.op === 'fork', 'the Split button forks');
});

test('Colour cycles the lane leaving a node; Ctrl-click joins take the colour they leave from', () => {
  const coloured = ok(twoLanes(), { op: 'recolor', nodeId: 'a2' });
  assert.equal(laneColorOf(coloured.paths.find((p) => p.id === 'A')), LANE_COLORS[1]);
  const joined = ok(coloured, { op: 'connect', fromId: 'a2', toId: 'b2' });
  const join = joined.paths.find((p) => p.nodeIds.join() === 'a2,b2')!;
  assert.equal(laneColorOf(join), LANE_COLORS[1]);
});

test('nodes pick by screen distance; a rebuild leaves no old selection ball behind', () => {
  const scene = new THREE.Scene();
  const gizmos = new LaneGizmos(scene);
  gizmos.setNetwork(twoLanes());
  const camera = new THREE.PerspectiveCamera(50, 1, 10, 1e7);
  const p = gizmos.worldFromEngine(3000, 120);
  camera.position.set(p.x, p.y + 60000, p.z + 1); camera.lookAt(p); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const ndc = p.clone().project(camera);
  assert.equal(gizmos.pickNear(camera, ndc.x + 10 / 400, ndc.y, 800, 800), 'a2', '10 px off the handle still picks it');
  assert.equal(gizmos.pickNear(camera, ndc.x + 0.5, ndc.y, 800, 800), null, 'far away picks nothing');

  gizmos.setSelectedNode('a2');
  const count = () => { let n = 0; scene.traverse((o) => { if (o.name === 'LaneSelectedNode') n++; }); return n; };
  for (let i = 0; i < 5; i++) { gizmos.setNetwork(twoLanes()); gizmos.setSelectedNode('a3'); }
  assert.equal(count(), 1, 'one selection ball, however many rebuilds');
});
