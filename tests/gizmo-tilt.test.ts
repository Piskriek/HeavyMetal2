/**
 * The rotate gizmo tilts: its X and Z rings turn an item's pitch and roll, not only its heading (it read
 * only the heading, so the tilt rings did nothing). R is the scale gizmo, as the toolbar says. A lane
 * node dragged past its neighbours drops them, so a lane's start can be pulled down the hill. Hidden
 * start and finish lines show see-through in the Lanes tool, to be picked and moved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CommandStack } from '../src/game/builder/history';
import { BuilderKeys } from '../src/game/builder/builder-keys';
import { GizmoAdapter } from '../src/game/builder/gizmo-adapter';
import { applyLaneEdit } from '../src/game/lane-path-tool';
import type { LaneNetwork } from '../src/game/lane-network';
import type { PlacedProp } from '../src/game/track-builder-3d';

const dom = () => ({
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  ownerDocument: { addEventListener() {}, removeEventListener() {} }, style: {},
}) as unknown as HTMLElement;

const prop = (id: string, x: number, rotY = 0): PlacedProp => ({ id, type: 'rock', name: 'Rock', x, y: 0, z: 0, rotY, scale: 1, alignToTrack: false });

test('the X ring tilts an item (pitch), keeping its heading', () => {
  const adapter = new GizmoAdapter<PlacedProp>(new THREE.PerspectiveCamera(), dom(), new THREE.Scene(), new CommandStack<PlacedProp>());
  const rock = prop('r', 0, 0.5);
  adapter.setMode('rotate');
  adapter.attach([rock]);
  adapter.controls.dispatchEvent({ type: 'dragging-changed', value: true } as never);
  adapter.proxy.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
  adapter.controls.dispatchEvent({ type: 'objectChange' } as never);
  const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3)
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, 0, 'YXZ')));
  const got = new THREE.Quaternion().setFromEuler(new THREE.Euler(rock.rotX ?? 0, rock.rotY, rock.rotZ ?? 0, 'YXZ'));
  assert.ok(Math.abs(Math.abs(got.dot(want)) - 1) < 1e-6, 'the item turned by the ring');
  assert.ok(Math.abs(rock.rotX ?? 0) > 0.05 || Math.abs(rock.rotZ ?? 0) > 0.05, 'it is tilted');
  adapter.cancelDrag();
  assert.equal(rock.rotY, 0.5); assert.ok(!rock.rotX);
  adapter.dispose();
});

test('the Y ring turns the heading only; a group swings round its middle', () => {
  const adapter = new GizmoAdapter<PlacedProp>(new THREE.PerspectiveCamera(), dom(), new THREE.Scene(), new CommandStack<PlacedProp>());
  const a = prop('a', -100); const b = prop('b', 100);
  adapter.setMode('rotate');
  adapter.attach([a, b]);
  adapter.controls.dispatchEvent({ type: 'dragging-changed', value: true } as never);
  adapter.proxy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  adapter.controls.dispatchEvent({ type: 'objectChange' } as never);
  assert.ok(Math.abs(a.rotY - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(a.rotX ?? 0) < 1e-6 && Math.abs(a.rotZ ?? 0) < 1e-6);
  assert.ok(Math.abs(a.x) < 1e-6 && Math.abs(a.z - 100) < 1e-6, 'a swung round the pivot');
  adapter.dispose();
});

test('the gizmo keys come from the bindings: G moves, R rotates, T scales (no old R = turn 15 degrees handler)', () => {
  const keys = new BuilderKeys();
  assert.equal(keys.match({ code: 'KeyG' }, 'pro'), 'gizmo.move');
  assert.equal(keys.match({ code: 'KeyR' }, 'pro'), 'gizmo.rotate');
  assert.equal(keys.match({ code: 'KeyT' }, 'pro'), 'gizmo.scale');
  const ui = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /\[Key: R\]/);
  assert.doesNotMatch(ui, /e\.code === 'KeyR'/, 'no hard-wired R left in the editor');
  assert.match(ui, /case 'gizmo\.scale': gizmo\('scale'/);
});

test('standing items show their pitch too (yaw, pitch, roll)', () => {
  const b = readFileSync(new URL('../src/game/track-builder-3d.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(b, /rotation\.y = prop\.rotY;/);
});

const network = (): LaneNetwork => ({
  version: 1, course: 'basalt',
  nodes: [{ id: 'a', x: 190, z: 0, kind: 'normal' }, { id: 'b', x: 790, z: 0, kind: 'normal' }, { id: 'c', x: 1390, z: 0, kind: 'normal' }, { id: 'd', x: 1990, z: 0, kind: 'normal' }],
  paths: [{ id: 'p', name: 'Lane', nodeIds: ['a', 'b', 'c', 'd'], halfWidth: 120 }],
});

test('a lane start dragged down past its neighbours drops them', () => {
  assert.equal(applyLaneEdit(network(), { op: 'moveNode', nodeId: 'a', x: 1500, z: 0 }).ok, false, 'a plain move still refuses');
  const r = applyLaneEdit(network(), { op: 'moveNode', nodeId: 'a', x: 1500, z: 0, passThrough: true });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.network.paths[0].nodeIds, ['a', 'd']);
  assert.deepEqual(r.network.nodes.map((n) => n.id), ['a', 'd']);
});

test('a junction stops the drag; a lane is never left with one node', () => {
  const shared = network();
  shared.nodes.push({ id: 'e', x: 2500, z: 200, kind: 'normal' });
  shared.paths.push({ id: 'q', name: 'Branch', nodeIds: ['b', 'e'], halfWidth: 120 });
  assert.equal(applyLaneEdit(shared, { op: 'moveNode', nodeId: 'a', x: 1000, z: 0, passThrough: true }).ok, false);
  assert.equal(applyLaneEdit(network(), { op: 'moveNode', nodeId: 'a', x: 2100, z: 0, passThrough: true }).ok, false);
});

test('hidden start and finish lines are see-through, pickable ghosts in the Lanes tool', () => {
  const b = readFileSync(new URL('../src/game/track-builder-3d.ts', import.meta.url), 'utf8');
  assert.match(b, /setLanesToolActive\(active: boolean\) \{\r?\n\s*this\.lanesVisible = active;\r?\n\s*this\.laneGizmos\.root\.visible = active;\r?\n\s*this\.refreshRaceMarkGhosts\(\);/);
  const ui = readFileSync(new URL('../src/components/TrackBuilderUI.tsx', import.meta.url), 'utf8');
  assert.match(ui, /const mark = builder\.raycastRaceMark\(e\.clientX, e\.clientY, canvas\);/);
});
