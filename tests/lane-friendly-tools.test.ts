/**
 * THE FRIENDLY LANE TOOLS: start fresh, a lone start node, drawing a line out of a node (down or up
 * the hill, joining a node at the end), cutting a connection, colouring lanes and nodes, doubling a
 * line into two lanes, and the line between junctions a double-click picks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLaneEdit, laneLineThrough, type LaneEdit } from '../src/game/lane-path-tool';
import { validateLaneNetwork, type LaneNetwork } from '../src/game/lane-network';
import { START_X } from '../src/game/scene';

const base = (): LaneNetwork => ({
  version: 1, course: 'basalt',
  nodes: [
    { id: 'a', x: START_X + 1000, z: 0, kind: 'normal' },
    { id: 'b', x: START_X + 2000, z: 0, kind: 'normal' },
    { id: 'c', x: START_X + 3000, z: 0, kind: 'normal' },
    { id: 'd', x: START_X + 4000, z: 0, kind: 'oob' },
  ],
  paths: [{ id: 'p', name: 'Lane 1', nodeIds: ['a', 'b', 'c', 'd'], halfWidth: 120 }],
});
const run = (net: LaneNetwork, edit: LaneEdit) => {
  const r = applyLaneEdit(net, edit);
  assert.ok(r.ok, r.ok ? '' : r.reason);
  assert.ok(validateLaneNetwork(r.network).ok, 'the runtime accepts the result');
  return r;
};

test('start fresh empties the network; a lone start node is allowed', () => {
  const empty = run(base(), { op: 'clear' }).network;
  assert.equal(empty.nodes.length, 0);
  assert.equal(empty.paths.length, 0);
  const started = run(empty, { op: 'addNode', x: START_X + 500, z: 100 });
  assert.equal(started.network.nodes.length, 1);
  assert.equal(started.focus, started.network.nodes[0].id);
  assert.equal(applyLaneEdit(empty, { op: 'addNode', x: START_X + 500, z: 9999 }).ok, false, 'not off the road');
});

test('drawing out of a start node makes a lane; drawing on from its end grows the same lane', () => {
  const start = run(run(base(), { op: 'clear' }).network, { op: 'addNode', x: START_X + 500, z: 0 });
  const s = start.focus!;
  const drawn = run(start.network, { op: 'drawFrom', fromId: s, at: [{ x: START_X + 1100, z: 40 }, { x: START_X + 1700, z: 80 }] });
  assert.equal(drawn.network.paths.length, 1);
  assert.equal(drawn.network.paths[0].nodeIds.length, 3);
  const end = drawn.focus!;
  const more = run(drawn.network, { op: 'drawFrom', fromId: end, at: [{ x: START_X + 2300, z: 80 }] });
  assert.equal(more.network.paths.length, 1, 'the same lane grew');
  assert.equal(more.network.paths[0].nodeIds.length, 4);
});

test('drawing uphill runs back into the node; drawing from mid-lane branches; letting go on a node joins it', () => {
  const up = run(base(), { op: 'drawFrom', fromId: 'a', at: [{ x: START_X + 600, z: 0 }, { x: START_X + 200, z: 0 }] });
  assert.deepEqual(up.network.paths[0].nodeIds.slice(-4), ['a', 'b', 'c', 'd'], 'grew backwards from its first node');
  assert.equal(up.network.paths[0].nodeIds.length, 6);
  const branch = run(base(), { op: 'drawFrom', fromId: 'b', at: [{ x: START_X + 2500, z: 300 }], toId: 'd' });
  const lane = branch.network.paths.find((p) => p.id !== 'p')!;
  assert.equal(lane.nodeIds[0], 'b');
  assert.equal(lane.nodeIds[lane.nodeIds.length - 1], 'd', 'joined the node it was let go on');
  assert.equal(applyLaneEdit(base(), { op: 'drawFrom', fromId: 'b', at: [{ x: START_X + 2500, z: 0 }, { x: START_X + 2200, z: 0 }] }).ok, false, 'a line has to keep running one way');
});

test('cutting a connection splits the lane; the cut ends are plain nodes Ctrl-click can join again', () => {
  const cut = run(base(), { op: 'disconnect', fromId: 'b', toId: 'c' });
  assert.deepEqual(cut.network.paths.map((p) => p.nodeIds).sort(), [['a', 'b'], ['c', 'd']]);
  const join = run(cut.network, { op: 'connect', fromId: 'b', toId: 'c' });
  assert.ok(join.network.paths.some((p) => p.nodeIds.join() === 'a,b,c,d'), 'back as one lane');
  const end = run(base(), { op: 'disconnect', fromId: 'a', toId: 'b' });
  assert.deepEqual(end.network.paths.map((p) => p.nodeIds), [['b', 'c', 'd']]);
  assert.ok(end.network.nodes.some((n) => n.id === 'a'), 'the cut-off node stays, joined to nothing');
});

test('colours: whole lanes, and nodes on their own (and back)', () => {
  const lanes = run(base(), { op: 'recolorPaths', pathIds: ['p'], color: '#FF8800' });
  assert.equal(lanes.network.paths[0].color, '#ff8800');
  const nodes = run(base(), { op: 'recolorNodes', nodeIds: ['b', 'c'], color: '#00ff00' });
  assert.equal(nodes.network.nodes.find((n) => n.id === 'b')!.color, '#00ff00');
  const back = run(nodes.network, { op: 'recolorNodes', nodeIds: ['b'], color: null });
  assert.equal(back.network.nodes.find((n) => n.id === 'b')!.color, undefined);
  assert.equal(applyLaneEdit(base(), { op: 'recolorPaths', pathIds: ['p'], color: 'red' }).ok, false);
});

test('split into 2 lanes: a twin beside the line, leaving its first node and rejoining its last', () => {
  const twin = run(base(), { op: 'twin', pathId: 'p', nodeIds: ['b', 'c'] });
  const t = twin.network.paths.find((p) => p.id !== 'p')!;
  assert.equal(t.nodeIds[0], 'b');
  assert.equal(t.nodeIds[t.nodeIds.length - 1], 'c');
  assert.equal(t.nodeIds.length, 3, 'a node in the middle so it runs beside the line');
  const mid = twin.network.nodes.find((n) => n.id === t.nodeIds[1])!;
  assert.ok(Math.abs(mid.z) >= 200, 'one lane width over');
  const whole = run(base(), { op: 'twin', pathId: 'p', nodeIds: ['a', 'b', 'c', 'd'] });
  const w = whole.network.paths.find((p) => p.id !== 'p')!;
  assert.equal(w.nodeIds.length, 4, 'a whole lane doubles into its own parallel lane');
  assert.ok(!w.nodeIds.includes('a') && !w.nodeIds.includes('d'));
});

test('a double-click line runs out to the junctions either side', () => {
  const branched = run(base(), { op: 'drawFrom', fromId: 'b', at: [{ x: START_X + 2600, z: 300 }], toId: 'd' }).network;
  assert.deepEqual(laneLineThrough(branched, 'p', 0)!.nodeIds, ['a', 'b'], 'stops at the split');
  assert.deepEqual(laneLineThrough(branched, 'p', 2)!.nodeIds, ['b', 'c', 'd'], 'split to merge');
  assert.deepEqual(laneLineThrough(base(), 'p', 1)!.nodeIds, ['a', 'b', 'c', 'd'], 'no junctions: the whole lane');
});
