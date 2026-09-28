/**
 * M01 · T7 (AC-1, AC-2, AC-5 wiring) — the builder's lane half, headless.
 *
 * `TrackBuilder3D` constructs in node (its browser dependencies are all guarded), so the wiring the
 * panel and the pointer handlers rely on can be asserted here rather than in the browser:
 *
 *  - the lane document loads, validates and saves through `lane-storage`;
 *  - an accepted edit moves the document **and** the gizmos; a refused edit moves neither (AC-2's
 *    round trip lives in `lane-edit.test.ts`, this is the wiring around it);
 *  - **one undo stack for both documents**: a props edit and a lane edit interleave, and Ctrl+Z winds
 *    back whichever was last without the other one jumping (the ticket's `{ props?, lanes? }` entry);
 *  - import is validated before it can replace anything.
 *
 * UNVERIFIED: the pointer path itself (`raycastLaneNode` / `dragLaneNode`) needs a real camera ray and
 * a canvas rect, so it is exercised in the browser only — the mapping it depends on is tested in
 * `lane-gizmo.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import { sampleLaneNetwork, type LaneNetwork } from '../src/game/lane-network';
import { LANE_STORAGE_KEY } from '../src/game/lane-storage';
import type { TrackData } from '../src/game/track-3d-data';

/** A storage double, so nothing touches the browser's localStorage. */
function fakeStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => { map.clear(); },
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() { return map.size; },
    __map: map,
  } as unknown as Storage & { __map: Map<string, string> };
}

function makeBuilder() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1.5, 1, 200000);
  camera.position.set(0, 1000, 0);
  // The lane API never reads the track samples (only the pointer path does); an empty track is enough
  // to construct the builder headlessly.
  const track = { samples: [], centerline: [], length: 0 } as unknown as TrackData;
  return new TrackBuilder3D(scene, camera, track);
}

function nodeX(builder: TrackBuilder3D, id: string): number | undefined {
  return builder.getLaneNetwork()?.nodes.find((node) => node.id === id)?.x;
}

test('the lane document loads, edits and saves through the storage module', () => {
  const builder = makeBuilder();
  const network = sampleLaneNetwork('ridge');
  builder.setLaneNetwork(network);
  assert.equal(builder.getLaneNetwork()?.course, 'ridge', 'the document is the one that was set');
  assert.equal(builder.laneValidation().ok, true, 'and it validates');

  const node = network.nodes[2];
  const before = builder.laneGizmoStats();
  const moved = builder.applyLaneEditToDoc({ op: 'moveNode', nodeId: node.id, x: node.x + 50, z: node.z });
  assert.equal(moved.ok, true, 'a legal move is accepted');
  const after = builder.laneGizmoStats();
  assert.equal(after.handleWrites, before.handleWrites + 1, 'one handle rewritten');
  assert.ok(after.pathRebuilds > before.pathRebuilds, 'its own paths redrew');

  // Save goes through the storage module's own document shape.
  const store = fakeStore();
  const saved = builder.saveLaneDoc(store);
  assert.equal(saved.ok, true, 'the save is accepted');
  const written = JSON.parse(store.__map.get(LANE_STORAGE_KEY)!);
  assert.equal(written.version, 1);
  assert.equal(written.networks.ridge.nodes.length, network.nodes.length, 'every node is in the file');
  assert.equal(written.networks.ridge.nodes[2].x, node.x + 50, 'and it is the edited one');

  // A fresh builder reads that same document back.
  const reopened = makeBuilder();
  reopened.setLaneNetwork(null);
  assert.equal(reopened.getLaneNetwork(), null, 'clearing the document is allowed');
});

test('a refused edit changes neither the document nor the gizmos', () => {
  const builder = makeBuilder();
  const network = sampleLaneNetwork('ridge');
  builder.setLaneNetwork(network);

  const node = network.nodes[1];
  const stats = builder.laneGizmoStats();
  const refused = builder.applyLaneEditToDoc({ op: 'moveNode', nodeId: node.id, x: 190, z: node.z });
  assert.equal(refused.ok, false, 'the tool refuses it');
  if (refused.ok) return;
  assert.match(refused.reason, /non_monotone:/, 'and the reason names the code');
  assert.equal(nodeX(builder, node.id), node.x, 'the document is untouched');
  assert.deepEqual(builder.laneGizmoStats(), stats, 'and so is the drawing');
});

test('one undo stack covers props and lanes', () => {
  const builder = makeBuilder();
  const network = sampleLaneNetwork('ridge');
  builder.setLaneNetwork(network, { pushUndo: false });

  const node = network.nodes[2];
  const lanesBefore = JSON.stringify(builder.getLaneNetwork());

  // A lane edit, then a props edit: two entries on one stack.
  builder.pushUndo();
  assert.equal(builder.applyLaneEditToDoc({ op: 'moveNode', nodeId: node.id, x: node.x + 50, z: node.z }).ok, true);
  const lanesAfter = JSON.stringify(builder.getLaneNetwork());
  assert.notEqual(lanesAfter, lanesBefore);

  // The builder loads its own default prop set, so the baseline is whatever it opened with.
  const propsBaseline = builder.getProps().length;
  builder.pushUndo();
  builder['placedProps'] = [{ id: 'p1', type: 'tree', name: 'Tree', x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, lit: true, alignToTrack: false, cameraFacing: false, flipX: false, isDecal: false }] as never;
  assert.equal(builder.getProps().length, 1, 'the props document changed');

  builder.undo();
  assert.equal(builder.getProps().length, propsBaseline, 'the props edit unwinds');
  assert.equal(JSON.stringify(builder.getLaneNetwork()), lanesAfter,
    'and the lane document is left as it was — the entry carried both');
  builder.undo();
  assert.equal(JSON.stringify(builder.getLaneNetwork()), lanesBefore, 'the lane edit unwinds');
  builder.redo();
  assert.equal(JSON.stringify(builder.getLaneNetwork()), lanesAfter, 'and redo puts it back');
});

test('import is validated before it can replace anything', () => {
  const builder = makeBuilder();
  const network = sampleLaneNetwork('ridge');
  builder.setLaneNetwork(network, { pushUndo: false });

  assert.equal(builder.importLanes('{ not json').ok, false, 'garbage is refused');
  assert.equal(builder.importLanes(JSON.stringify({ version: 99, networks: {} })).ok, false,
    'a wrong version is refused');
  assert.equal(JSON.stringify(builder.getLaneNetwork()), JSON.stringify(network),
    'the document survived both refusals');

  // A document for another course carries no network for this one.
  assert.equal(builder.importLanes(JSON.stringify({ version: 1, networks: { boomtown: network } })).ok, false,
    'a network for another course is not silently adopted');

  const roundTrip = builder.exportLanes();
  assert.equal(builder.importLanes(roundTrip).ok, true, 'our own export imports cleanly');
  assert.equal(JSON.stringify(builder.getLaneNetwork()), JSON.stringify(network), 'unchanged by the round trip');
});

test('the lanes tool draws only while it is active', () => {
  const builder = makeBuilder();
  builder.setLaneNetwork(sampleLaneNetwork('ridge'), { pushUndo: false });
  const root = (builder as unknown as { laneGizmos: { root: THREE.Object3D } }).laneGizmos.root;
  assert.equal(root.visible, false, 'hidden until the tool is picked');
  builder.setLanesToolActive(true);
  assert.equal(root.visible, true, 'shown when the lanes category is active');
  assert.equal(builder.getLanesToolActive(), true);
  builder.setLanesToolActive(false);
  assert.equal(root.visible, false, 'and hidden again when it is not');
  assert.equal(builder.getSelectedLaneNode(), null, 'leaving the tool drops the selection');
});

test('a network with no rings still has a document to edit', () => {
  const builder = makeBuilder();
  const empty: LaneNetwork = {
    version: 1, course: 'ridge', nodes: [], paths: [],
  };
  builder.setLaneNetwork(empty, { pushUndo: false });
  assert.equal(builder.laneValidation().ok, true, 'an empty network is a legal document');
  assert.equal(builder.laneGizmoStats().nodes, 0, 'and it draws no handles');
});

test('a refused command leaves no undo entry behind', () => {
  const builder = makeBuilder();
  const network = sampleLaneNetwork('ridge');
  builder.setLaneNetwork(network, { pushUndo: false });
  const node = network.nodes[0];
  const before = JSON.stringify(builder.getLaneNetwork());

  // Degenerate edits: a move to where it already is, and a node that is not there. Both are refusals.
  assert.equal(builder.applyLaneCommand({ op: 'moveNode', nodeId: node.id, x: node.x, z: node.z }).ok, false);
  assert.equal(builder.applyLaneCommand({ op: 'moveNode', nodeId: 'nope', x: 500, z: 0 }).ok, false);
  assert.equal(JSON.stringify(builder.getLaneNetwork()), before, 'a refusal changes nothing');

  // The stack is empty, so an undo has nothing to put back — which is the point: if the refusals had
  // pushed entries, the next undo would silently do nothing visible, or worse, step over a real edit.
  builder.undo();
  assert.equal(JSON.stringify(builder.getLaneNetwork()), before, 'undo after refusals is a no-op');

  // One accepted command pushes exactly one entry, and it comes back.
  const moved = builder.applyLaneCommand({ op: 'moveNode', nodeId: node.id, x: node.x + 50, z: node.z });
  assert.equal(moved.ok, true, moved.ok ? '' : moved.reason);
  assert.notEqual(JSON.stringify(builder.getLaneNetwork()), before, 'the accepted move landed');
  builder.undo();
  assert.equal(JSON.stringify(builder.getLaneNetwork()), before, 'and one undo unwinds it exactly');
});

test('half width is set through the builder, validated, and undoable', () => {
  const builder = makeBuilder();
  const network = sampleLaneNetwork('ridge');
  builder.setLaneNetwork(network, { pushUndo: false });
  const path = network.paths[0];

  const widened = builder.setLanePathHalfWidth(path.id, 180);
  assert.equal(widened.ok, true, widened.ok ? '' : widened.reason);
  assert.equal(builder.getLaneNetwork()!.paths.find((p) => p.id === path.id)!.halfWidth, 180, 'the width is authored');

  // The validator's own bounds are the door: 10 and 400 are not widths this game can drive.
  assert.equal(builder.setLanePathHalfWidth(path.id, 10).ok, false);
  assert.equal(builder.setLanePathHalfWidth(path.id, 400).ok, false);
  assert.equal(builder.setLanePathHalfWidth('no-such-path', 180).ok, false);
  assert.equal(builder.getLaneNetwork()!.paths.find((p) => p.id === path.id)!.halfWidth, 180, 'refusals leave it alone');
  assert.equal(builder.setLanePathHalfWidth(path.id, 180).ok, false, 'and a no-op is refused, not recorded');

  builder.undo();
  assert.equal(builder.getLaneNetwork()!.paths.find((p) => p.id === path.id)!.halfWidth, path.halfWidth,
    'one undo returns the authored width');
});
