import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CommandStack } from '../src/game/builder/history';
import { GizmoAdapter } from '../src/game/builder/gizmo-adapter';
import type { PlacedProp } from '../src/game/track-builder-3d';

function createMockDomElement(): HTMLElement {
  const listeners = new Map<string, Function[]>();
  return {
    addEventListener(event: string, fn: Function) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    },
    removeEventListener(event: string, fn: Function) {
      const arr = listeners.get(event) ?? [];
      listeners.set(event, arr.filter((f) => f !== fn));
    },
    dispatchEvent(event: any) {
      const arr = listeners.get(event.type) ?? [];
      for (const fn of arr) fn(event);
      return true;
    },
    ownerDocument: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    style: {},
  } as unknown as HTMLElement;
}

test('T2 GizmoAdapter: one command per drag', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const domElement = createMockDomElement();
  const history = new CommandStack<PlacedProp>();

  const adapter = new GizmoAdapter<PlacedProp>(camera, domElement, scene, history);

  const prop: PlacedProp = {
    id: 'p1',
    type: 'tree',
    name: 'Tree',
    x: 100,
    y: 0,
    z: 200,
    rotY: 0,
    scale: 1,
    alignToTrack: false,
  };

  adapter.attach([prop]);

  let dragEvents: boolean[] = [];
  adapter.onDrag((dragging) => dragEvents.push(dragging));

  // Simulate dragging-changed true
  adapter.controls.dispatchEvent({ type: 'dragging-changed', value: true });
  assert.equal(dragEvents.length, 1);
  assert.equal(dragEvents[0], true);
  assert.equal(history.canUndo(), false); // In progress, not committed yet

  // Mutate proxy and trigger objectChange
  adapter.proxy.position.set(150, 0, 250);
  adapter.controls.dispatchEvent({ type: 'objectChange' });
  assert.equal(prop.x, 150);
  assert.equal(prop.z, 250);

  // End drag
  adapter.controls.dispatchEvent({ type: 'dragging-changed', value: false });
  assert.equal(dragEvents.length, 2);
  assert.equal(dragEvents[1], false);
  assert.equal(history.canUndo(), true); // Committed exactly 1 command

  // Undo restores
  const reverted = history.undo([prop])!;
  assert.ok(reverted);
  assert.equal(reverted[0].x, 100);
  assert.equal(reverted[0].z, 200);

  adapter.dispose();
});

test('T2 GizmoAdapter: Esc cancels drag and restores original transform', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const domElement = createMockDomElement();
  const history = new CommandStack<PlacedProp>();

  const adapter = new GizmoAdapter<PlacedProp>(camera, domElement, scene, history);

  const prop: PlacedProp = {
    id: 'p2',
    type: 'rock',
    name: 'Rock',
    x: 50,
    y: 10,
    z: -30,
    rotY: 0.5,
    scale: 1.5,
    alignToTrack: false,
  };

  adapter.attach([prop]);
  adapter.controls.dispatchEvent({ type: 'dragging-changed', value: true });

  adapter.proxy.position.set(100, 10, -30);
  adapter.controls.dispatchEvent({ type: 'objectChange' });
  assert.equal(prop.x, 100);

  // Cancel via cancelDrag()
  adapter.cancelDrag();
  assert.equal(prop.x, 50);
  assert.equal(adapter.isDraggingActive(), false);
  assert.equal(history.canUndo(), false);

  adapter.dispose();
});

test('T2 GizmoAdapter: space cycling world -> local -> track', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const domElement = createMockDomElement();
  const history = new CommandStack<PlacedProp>();

  const adapter = new GizmoAdapter<PlacedProp>(camera, domElement, scene, history);

  assert.equal(adapter.getSpace(), 'world');
  adapter.cycleSpace();
  assert.equal(adapter.getSpace(), 'local');
  adapter.cycleSpace();
  assert.equal(adapter.getSpace(), 'track');
  adapter.cycleSpace();
  assert.equal(adapter.getSpace(), 'world');

  adapter.dispose();
});

test('T2 GizmoAdapter: rig disabled while dragging', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const domElement = createMockDomElement();
  const history = new CommandStack<PlacedProp>();

  const adapter = new GizmoAdapter<PlacedProp>(camera, domElement, scene, history);
  const prop: PlacedProp = {
    id: 'p3',
    type: 'boulder',
    name: 'Boulder',
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    scale: 1,
    alignToTrack: false,
  };

  adapter.attach([prop]);
  assert.equal(adapter.isDraggingActive(), false);

  adapter.controls.dispatchEvent({ type: 'dragging-changed', value: true });
  assert.equal(adapter.isDraggingActive(), true);

  adapter.controls.dispatchEvent({ type: 'dragging-changed', value: false });
  assert.equal(adapter.isDraggingActive(), false);

  adapter.dispose();
});
