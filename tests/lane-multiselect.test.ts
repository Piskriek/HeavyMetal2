/**
 * Lane editing in groups: select several nodes (Shift/Ctrl-click, a box, whole lanes, all), then move,
 * nudge or delete them together in one undoable step.
 *
 *   node --import tsx --test tests/lane-multiselect.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { applyLaneEdit, brushStrokePoints } from '../src/game/lane-path-tool';
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

test('the lane brush turns a stroke into nodes: spaced down the hill, far end kept, uphill strokes read downhill', () => {
  const stroke = Array.from({ length: 50 }, (_, i) => ({ x: 5000 + i * 97, z: 100 + i * 2 }));
  const points = brushStrokePoints(stroke, 600);
  assert.ok(points.length >= 8);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].x > points[i - 1].x, 'always down the hill');
  for (let i = 1; i < points.length - 1; i++) assert.ok(points[i].x - points[i - 1].x >= 600, 'at least the spacing apart');
  assert.equal(points[points.length - 1].x, stroke[stroke.length - 1].x, 'the far end is kept');
  assert.deepEqual(brushStrokePoints([...stroke].reverse(), 600), points, 'drawn uphill, read downhill');
  assert.deepEqual(brushStrokePoints(stroke.slice(0, 1), 600), [], 'a click is not a lane');
  assert.ok(brushStrokePoints(stroke, 1200).length < points.length, 'wider spacing, fewer nodes');
});

test('a brushed lane is added in one undo step and selected', () => {
  const b = builder();
  const before = b.getLaneNetwork()!.paths.length;
  const stroke = Array.from({ length: 40 }, (_, i) => ({ x: 8000 + i * 100, z: -150 }));
  const made = b.addLaneFromStroke(stroke, 500);
  assert.ok(made.ok, made.ok ? '' : made.reason);
  assert.equal(b.getLaneNetwork()!.paths.length, before + 1);
  assert.equal(b.getSelectedLaneNodeIds().length, made.ok ? made.nodes : -1, 'the new lane is selected');
  b.undo();
  assert.equal(b.getLaneNetwork()!.paths.length, before, 'one undo removes it');
  assert.equal(b.addLaneFromStroke([{ x: 9000, z: 0 }], 500).ok, false, 'too short: refused');
});

test('the test ball: placed on the road, remembered per track, cleared back to the grid', () => {
  const b = builder();
  assert.equal(b.getTestBall(), null, 'none placed: test drives use the grid');
  b.setTestBall({ x: 12345.4, z: 99.6 });
  assert.deepEqual(b.getTestBall(), { x: 12345, z: 100 });
  const again = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as never, undefined, 'none');
  again.setCourse('basalt');
  assert.deepEqual(again.getTestBall(), { x: 12345, z: 100 }, 'remembered on this device');
  b.setTestBall(null);
  const third = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as never, undefined, 'none');
  third.setCourse('basalt');
  assert.equal(third.getTestBall(), null, 'cleared');
});

test('a test drive starts at the ball on the nearest lane; a click on the gizmo never selects what is in front of it', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /player\.pathId = network \? nearestPath\(network, x, z\) : null;/, 'steers onto the nearest lane from that spot');
  assert.match(engine, /player\.y = this\.world\.surfaceAt\(x, z\)\.y - RADIUS - height;/, 'resting on what it was put on (a ramp top or the road), or hanging above it on the start hook');
  assert.match(engine, /this\.player\.y = this\.world\.surfaceAt\(this\.player\.x, this\.player\.z, this\.player\.y \+ RADIUS\)\.y - RADIUS;/, 'the push keeps it on that surface');
  assert.match(engine, /racer\.y = this\.y\(racer\.x\) - RADIUS; \}\n\s*this\.placeAtTestStart\(\);/, 'applied on every reset, after the grid');
  const editor = readFileSync(new URL('../src/screens/MapEditorScreen.tsx', import.meta.url), 'utf8');
  assert.match(editor, /setTestStart\(engineRef\.current\.trackBuilder\.getTestBall\(\)\);[\s\S]{0,200}reset\(\)/, 'the editor hands the ball over before the reset');
  const ui = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  const guard = ui.indexOf('if (builder.isGizmoInteracting() || builder.isGizmoHovered()) return;');
  assert.ok(guard > 0 && guard < ui.indexOf('let hitProp = builder.raycastProp('), 'the gizmo is checked before any selection');
});

test('the decal edge handles draw over every decal (transparent pass, drawn last)', () => {
  const b = builder();
  const group = (b as any).decalSideHandlesGroup as THREE.Group;
  let boxes = 0;
  group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (!m || !((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments)) return;
    boxes += 1;
    assert.equal(m.transparent, true, `${o.name} is in the transparent pass, after the decals`);
    assert.equal(m.depthTest, false, `${o.name} is never hidden behind anything`);
    assert.ok(o.renderOrder >= 10000, `${o.name} is drawn last`);
  });
  assert.ok(boxes >= 8, 'four handles and their outlines');
});

test('a hidden gizmo never swallows clicks: a stale hovered handle is cleared when it detaches', async () => {
  const { GizmoAdapter } = await import('../src/game/builder/gizmo-adapter');
  const src = readFileSync(new URL('../src/game/builder/gizmo-adapter.ts', import.meta.url), 'utf8');
  assert.match(src, /this\.controls\.enabled = false;\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*\(this\.controls as any\)\.axis = null;/, 'detaching clears the hovered axis');
  assert.match(src, /return this\.controls\.enabled && this\.helper\.visible && Boolean\(\(this\.controls as any\)\.axis\);/, 'only a showing gizmo counts as hovered');
  assert.ok(GizmoAdapter);
});

test('Ctrl-click joins nodes into a lane down the hill, and clicking on carries the same lane on', () => {
  const b = builder();
  // Three free-standing nodes: a short brushed lane gives us nodes to join across.
  const made = b.addLaneFromStroke(Array.from({ length: 40 }, (_, i) => ({ x: 20000 + i * 100, z: -400 })), 1000);
  assert.ok(made.ok);
  const net = () => b.getLaneNetwork()!;
  const lanes = net().paths.length;
  const groove = (x: number) => `groove2-x${x}`;
  assert.deepEqual(b.connectClick(groove(20590)), { ok: true, joined: false }, 'the first click picks the node');
  assert.deepEqual(b.connectClick(groove(21790)), { ok: true, joined: true }, 'the second joins them');
  assert.equal(net().paths.length, lanes + 1, 'a new lane between the two');
  assert.deepEqual(b.connectClick(groove(22990)), { ok: true, joined: true }, 'the third carries it on');
  assert.equal(net().paths.length, lanes + 1, 'the same lane, not another');
  const chain = net().paths[net().paths.length - 1];
  assert.deepEqual(chain.nodeIds, [groove(20590), groove(21790), groove(22990)]);
  b.endConnect();
  b.connectClick(groove(25390));
  assert.deepEqual(b.connectClick(groove(23590)), { ok: true, joined: true }, 'clicked uphill: still joined down the hill');
  const last = net().paths[net().paths.length - 1];
  assert.deepEqual(last.nodeIds, [groove(23590), groove(25390)]);
  assert.equal(b.connectClick(groove(24190)).ok, false, 'two nodes already next to each other on a lane are not joined twice');
  b.endConnect();
  b.undo();
  assert.equal(net().paths.some((p) => p.nodeIds.join() === [groove(23590), groove(25390)].join()), false, 'one undo removes a join');
});

test('lane nodes drag straight over the ground: the group follows, a refused move changes nothing, one undo', () => {
  const b = builder();
  let pointer = { x: 5590, z: -290 };
  (b as any).lanePointAt = () => pointer;
  const canvas = {} as HTMLCanvasElement;
  b.selectLaneNodes(['groove1-x5590', 'groove2-x5590']);
  b.beginLaneDrag('groove1-x5590');
  pointer = { x: 5690, z: -250 };
  assert.ok(b.dragLaneNodesTo(0, 0, canvas).ok);
  assert.equal(node(b, 'groove1-x5590').x, 5700, 'grid-snapped to 50');
  assert.equal(node(b, 'groove2-x5590').x, 5700, 'the rest of the selection moves with it');
  pointer = { x: 9000, z: -250 };
  assert.equal(b.dragLaneNodesTo(0, 0, canvas).ok, false, 'past the next node of the lane: refused');
  assert.equal(node(b, 'groove1-x5590').x, 5700, 'nothing moved');
  b.endLaneDrag();
  b.undo();
  assert.equal(node(b, 'groove1-x5590').x, 5590, 'one undo puts the whole drag back');
  assert.equal(node(b, 'groove2-x5590').x, 5590);
});
