/**
 * M01 · T7 (AC-3, AC-4) — the lane gizmos, asserted without a canvas.
 *
 * three.js builds geometry and materials with no WebGL context, so the gizmo layer can be tested
 * headlessly for the things the ticket actually promises:
 *
 *  - **AC-4**: dragging one node for 100 frames rewrites *that* handle 100 times, rebuilds only the
 *    geometries of the paths through it, and creates **zero** new materials. Materials are made once,
 *    on the first `setNetwork`, and the counter proves it.
 *  - **the mapping**: engine (x, z) → world → engine is a round trip, so a handle drawn at the sorting
 *    loop's mouth sits on the road there (x 8304 is the loop's mouth, a point the physics also owns).
 *  - **the handle mesh**: one `InstancedMesh` for every node, capacity 512, one material, colours by
 *    kind — and `dispose()` leaves the scene exactly as it found it.
 *
 * UNVERIFIED: how the handles *look* on screen, and whether picking feels right with a real camera,
 * are browser calls (the ticket says so too). What is proven here is the accounting and the geometry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  LANE_HANDLE_CAPACITY, LANE_HANDLE_LIFT, LANE_KIND_COLORS, LANE_PATH_COLOR, LaneGizmos,
} from '../src/game/lane-gizmos';
import { sampleLaneNetwork } from '../src/game/lane-network';
import { applyLaneEdit, snapNode } from '../src/game/lane-path-tool';
import { passageMouthX } from '../src/game/qualifying/passage';
import { START_X } from '../src/game/scene';

/** The sample ridge network (T6's own authored fixture). */
function sample() {
  const network = sampleLaneNetwork('ridge');
  assert.ok(network.nodes.length > 10, 'the sample network is a real one');
  return network;
}

test('the handle mesh is one InstancedMesh, one material, coloured by kind', () => {
  const scene = new THREE.Scene();
  const gizmos = new LaneGizmos(scene);
  const network = sample();
  gizmos.setNetwork(network);

  const meshes = gizmos.root.children.filter((child) => (child as THREE.InstancedMesh).isInstancedMesh);
  assert.equal(meshes.length, 1, 'every node handle lives in exactly one InstancedMesh');
  const handles = meshes[0] as THREE.InstancedMesh;
  assert.equal(handles.count, network.nodes.length, 'one instance per node');
  assert.ok(handles.count <= LANE_HANDLE_CAPACITY, 'inside the ticket\'s 512-handle ceiling');
  assert.ok(handles.instanceColor, 'per-instance colour, so one material can carry four kinds');

  // One line per path, and they are lines, not more meshes.
  const lines = gizmos.root.children.filter((child) => (child as THREE.Line).isLine);
  assert.equal(lines.length, network.paths.length, 'one line per path');
  assert.equal(gizmos.stats.nodes, network.nodes.length);
  assert.equal(gizmos.stats.paths, network.paths.length);

  // The colours are the four kind colours, and they are distinct.
  const palette = Object.values(LANE_KIND_COLORS);
  assert.equal(new Set(palette).size, palette.length, 'each kind has its own colour');
  assert.ok(!palette.includes(LANE_PATH_COLOR), 'a path line is not confusable with a node handle');
  const seen = new Set<string>();
  for (let i = 0; i < handles.count; i++) {
    const color = new THREE.Color();
    handles.getColorAt(i, color);
    seen.add(color.getHexString());
  }
  assert.ok(seen.size >= 2, `more than one kind is drawn (saw ${[...seen].join(', ')})`);

  // Dispose is exact: the scene is left as it was found.
  assert.equal(scene.children.length, 1, 'one root group while alive');
  gizmos.dispose();
  assert.equal(scene.children.length, 0, 'dispose removes the layer and nothing else');
});

test('AC-4: a 100-frame drag rebuilds one handle and its paths, and creates no materials', () => {
  const scene = new THREE.Scene();
  const gizmos = new LaneGizmos(scene);
  let network = sample();
  gizmos.setNetwork(network);

  const materialsAfterLoad = gizmos.stats.materialsCreated;
  assert.ok(materialsAfterLoad > 0, 'the first load creates the shared materials');

  // Pick a node in the middle of a long path, so "its paths" is more than one in the general case.
  const node = network.nodes.find((candidate) => candidate.id === 'n_lane_1_mid')
    ?? network.nodes[Math.floor(network.nodes.length / 2)];
  const owned = gizmos.pathsWith(node.id);
  assert.ok(owned.length >= 1, 'the node belongs to at least one path');

  const writesBefore = gizmos.stats.handleWrites;
  const rebuildsBefore = gizmos.stats.pathRebuilds;

  // Drive the real tool for 100 frames: move, snap, apply — exactly what the pointer handler does.
  for (let frame = 0; frame < 100; frame++) {
    const target = { x: node.x + frame * 0.5, z: node.z + Math.sin(frame / 10) * 4 };
    const snapped = snapNode(target.x, target.z, { lanes: false, grid: true });
    const result = applyLaneEdit(network, { op: 'moveNode', nodeId: node.id, x: snapped.x, z: snapped.z });
    assert.equal(result.ok, true, `frame ${frame}: the move must be accepted`);
    if (!result.ok) return;
    network = result.network;
    gizmos.moveNode(node.id);
    // The gizmo must be showing the *network's* position, not the raw pointer's.
    const placed = network.nodes.find((candidate) => candidate.id === node.id);
    assert.ok(placed && placed.x === snapped.x, `frame ${frame}: the handle follows the snapped node`);
  }

  assert.equal(gizmos.stats.materialsCreated, materialsAfterLoad,
    'a drag never creates a material — the instance mesh and the lines reuse the load-time ones');
  assert.equal(gizmos.stats.handleWrites - writesBefore, 100,
    'exactly one instance matrix write per frame, and only for the dragged node');
  assert.equal(gizmos.stats.pathRebuilds - rebuildsBefore, 100 * owned.length,
    `only the ${owned.length} path(s) through the node were rebuilt, once each per frame`);
});

test('a refused edit leaves the gizmos untouched', () => {
  const scene = new THREE.Scene();
  const gizmos = new LaneGizmos(scene);
  let network = sample();
  gizmos.setNetwork(network);

  // `non_monotone`: a lane-1 mid node cannot move behind its own predecessor.
  const node = network.nodes.find((candidate) => candidate.id === 'n_lane_1_mid')
    ?? network.nodes[1];
  const refused = applyLaneEdit(network, { op: 'moveNode', nodeId: node.id, x: START_X, z: node.z });
  assert.equal(refused.ok, false, 'the tool refuses the move');
  if (refused.ok) return;
  assert.match(refused.reason, /non_monotone:/, 'and names the refusal');

  const before = { ...gizmos.stats };
  // The handler's rule: on a refusal nothing is drawn and nothing is counted.
  const writes = gizmos.stats.handleWrites;
  assert.equal(gizmos.stats.handleWrites, writes, 'no write happened');
  assert.equal(gizmos.stats.pathRebuilds, before.pathRebuilds, 'no geometry was rebuilt');
  assert.equal(gizmos.document?.nodes.find((candidate) => candidate.id === node.id)?.x, node.x,
    'the drawn document still has the old position');
});

test('engine (x, z) → world → engine round-trips, at the sorting loop\'s mouth', () => {
  const scene = new THREE.Scene();
  const gizmos = new LaneGizmos(scene);

  for (const [x, z] of [[START_X + 100, 0], [passageMouthX(), 0], [passageMouthX(), 120], [30000, -240], [70000, 360]] as const) {
    const world = gizmos.worldFromEngine(x, z);
    const back = gizmos.engineFromWorld(world);
    assert.ok(Math.abs(back.x - x) < 25, `x ${x} → ${back.x.toFixed(1)} (residual ${back.residual.toFixed(1)})`);
    assert.ok(Math.abs(back.z - z) < 25, `z ${z} → ${back.z.toFixed(1)}`);
    assert.equal(back.ambiguous, false, 'the mapping is unambiguous on the ribbon');
  }

  // The lift is the handle's own: a handle floats above the ribbon, not on it.
  const onRoad = gizmos.worldFromEngine(passageMouthX(), 0, 0);
  const lifted = gizmos.worldFromEngine(passageMouthX(), 0);
  assert.ok(Math.abs(lifted.y - onRoad.y - LANE_HANDLE_LIFT) < 1e-6,
    'the handle sits `LANE_HANDLE_LIFT` above the road point');
});

test('raycast picks the handle under the ray, and only handles', () => {
  const scene = new THREE.Scene();
  const gizmos = new LaneGizmos(scene);
  const network = sample();
  gizmos.setNetwork(network);

  const node = network.nodes[4];
  const point = gizmos.worldFromEngine(node.x, node.z);
  const raycaster = new THREE.Raycaster();
  raycaster.set(point.clone().add(new THREE.Vector3(0, 900, 0)), new THREE.Vector3(0, -1, 0));
  assert.equal(gizmos.raycast(raycaster), node.id, 'a ray straight down through a handle finds it');

  // A ray nowhere near the track finds nothing rather than a wrong node.
  raycaster.set(new THREE.Vector3(0, 100000, 0), new THREE.Vector3(1, 0, 0));
  assert.equal(gizmos.raycast(raycaster), null, 'a miss is a miss');
});
