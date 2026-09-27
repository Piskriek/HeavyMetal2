/**
 * Island tracks (New / Duplicate in build mode) and the placed-item tools: sections shown or hidden,
 * select all by section.
 *
 *   node --import tsx --test tests/island-tracks.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import {
  ISLAND_PROPS_KEY, createIslandTrack, islandEndpoints, islandPropsKey, readIslandProps, readIslandTracks, writeIslandProps,
} from '../src/game/island-route/island-props-storage';
import type { TrackData } from '../src/game/renderer-3d';

function mockStorage() {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  } as unknown as Storage;
  (globalThis as any).localStorage = store;
  return { data, store };
}
const prop = (id: string, type = 'kit_palm-tall') => ({ id, type, x: 0, y: 0, z: 0, rotY: 0, scale: 1 });
const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
const islandBuilder = () => new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'island');

test('Serpentine Isle is always the first track, on the original key and folder', () => {
  const { store } = mockStorage();
  const index = readIslandTracks(store);
  assert.deepEqual(index.tracks.map((t) => t.name), ['Serpentine Isle']);
  assert.equal(index.active, 'serpentine');
  assert.equal(islandPropsKey('serpentine'), ISLAND_PROPS_KEY);
  assert.deepEqual(islandEndpoints('serpentine'), { backup: '/api/backup-island-props', restore: '/api/restore-island-backup' });
  assert.equal(islandEndpoints('beach-run').backup, '/api/backup-island-props?track=beach-run');
});

test('a new track starts empty; a duplicate copies the props under new ids; each opens as active', () => {
  const { store } = mockStorage();
  writeIslandProps([prop('a'), prop('b')] as never, store, 1, 'serpentine');
  const empty = createIslandTrack('Beach Run', undefined, store, 10)!;
  assert.equal(empty.id, 'beach-run');
  assert.deepEqual(readIslandProps(store, 'beach-run'), []);
  const copy = createIslandTrack('Beach Run', 'serpentine', store, 20)!;
  assert.equal(copy.id, 'beach-run-2', 'names may repeat, ids never do');
  const copied = readIslandProps(store, copy.id);
  assert.equal(copied.length, 2);
  assert.ok(copied.every((p) => !['a', 'b'].includes(p.id)), 'the copy has its own ids');
  assert.equal(readIslandTracks(store).active, copy.id);
  assert.equal(createIslandTrack('   ', undefined, store), null, 'an empty name is refused');
  assert.deepEqual(readIslandProps(store, 'serpentine').map((p) => p.id), ['a', 'b'], 'the original is untouched');
});

test('the builder switches tracks, saving each on its own, and undo never reaches across', () => {
  mockStorage();
  (globalThis as any).fetch = async () => new Response('{}', { status: 200 });
  const b = islandBuilder();
  b.importJson(JSON.stringify([prop('s1')]));
  const dup = b.createIslandTrack('Serpent Copy', true)!;
  assert.equal(b.getIslandTracks()!.active, dup.id);
  assert.equal(b.getProps().length, 1, 'the duplicate opened with the copied item');
  b.importJson(JSON.stringify([prop('c1'), prop('c2')]));
  assert.ok(b.switchIslandTrack('serpentine'));
  assert.deepEqual(b.getProps().map((p) => p.id), ['s1'], 'Serpentine Isle as it was');
  b.undo();
  assert.deepEqual(b.getProps().map((p) => p.id), ['s1'], 'undo does not bring the other track back');
  assert.ok(b.switchIslandTrack(dup.id));
  assert.deepEqual(b.getProps().map((p) => p.id), ['c1', 'c2']);
  const fresh = b.createIslandTrack('Blank', false)!;
  assert.equal(b.getProps().length, 0);
  assert.equal(islandBuilder().getIslandTracks()!.active, fresh.id, 'the last opened track is the one a new builder (and a race) opens');
  (b as any).backups.destroy();
});

test('sections: hidden items vanish from view (not from the track) and select all takes a whole shelf', () => {
  mockStorage();
  const b = islandBuilder();
  b.importJson(JSON.stringify([prop('p1'), prop('p2'), prop('r1', 'kit_rock-pile'), prop('f1', 'kit_finish-line')]));
  assert.deepEqual(Object.fromEntries(b.sectionCounts()), { foliage_3d: 2, rocks_3d: 1, race: 1 });
  assert.equal(b.selectSection('foliage_3d'), 2);
  assert.deepEqual(b.getSelectedProps().map((p) => p.id).sort(), ['p1', 'p2']);
  b.setSectionShown('foliage_3d', false);
  assert.equal(b.getSelectedProps().length, 0, 'hidden items leave the selection');
  const scene = (b as any).scene as THREE.Scene;
  assert.equal(scene.getObjectByName('PlacedProp_p1')!.visible, false);
  assert.equal(scene.getObjectByName('PlacedProp_r1')!.visible, true);
  assert.equal(b.getProps().find((p) => p.id === 'p1')!.visible, undefined, 'a view filter: the item itself is unchanged');
  assert.equal(b.selectSection('foliage_3d'), 0, 'a hidden section selects nothing');
  b.setSectionShown('foliage_3d', true);
  assert.equal(scene.getObjectByName('PlacedProp_p1')!.visible, true);
  (b as any).backups.destroy();
});
