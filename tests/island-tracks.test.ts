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
  getIslandTrackStartOffset, setIslandTrackStartOffset,
} from '../src/game/island-route/island-props-storage';
import { createRacers } from '../src/game/racers';
import { nearestPath, nearestPathOrStart, adoptNearestPaths, resolveLaneTarget, sampleLane, type LaneNetwork } from '../src/game/lane-network';
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

test('island tracks have a per-track startOffset that configures the grid, test ball and lane start nodes', () => {
  const { store } = mockStorage();
  const index = readIslandTracks(store);
  assert.equal(index.tracks[0].startOffset, 190, 'default track starts at 190');
  assert.equal(getIslandTrackStartOffset('serpentine', store), 190);

  // Set a custom start offset
  assert.ok(setIslandTrackStartOffset('serpentine', 350, store));
  assert.equal(getIslandTrackStartOffset('serpentine', store), 350);

  // Creating a new track can specify or inherit startOffset
  const custom = createIslandTrack('Summit Drop', undefined, store, 100, 50)!;
  assert.equal(custom.startOffset, 50);
  assert.equal(getIslandTrackStartOffset(custom.id, store), 50);

  // The grid places racers according to startOffset
  const standardRacers = createRacers({ fieldSize: 8 }, 190);
  assert.equal(standardRacers[0].x, 190);
  assert.equal(standardRacers[4].x, 190 - 90);

  const offsetRacers = createRacers({ fieldSize: 8 }, 50);
  assert.equal(offsetRacers[0].x, 50);
  assert.equal(offsetRacers[4].x, 50 - 90);

  // The builder reads and updates the start offset per track
  const b = islandBuilder();
  assert.equal(b.getStartOffset(), 50, 'opens active track which is custom');
  b.switchIslandTrack('serpentine');
  assert.equal(b.getStartOffset(), 350, 'switching to serpentine shows 350');
  b.setStartOffset(120);
  assert.equal(b.getStartOffset(), 120);

  // Start spots reflects the track start offset for the grid
  const spots = b.startSpots();
  const gridSpot = spots.find((s) => s.id === 'grid');
  assert.ok(gridSpot);
  assert.equal(gridSpot!.x, 120);

  (b as any).backups.destroy();
});

test('a ball can start anywhere and freefall to join the nearest lane from that point', () => {
  mockStorage();
  const network: LaneNetwork = {
    version: 1,
    nodes: [
      { id: 'n1', x: 200, z: 50, kind: 'normal' },
      { id: 'n2', x: 1000, z: 50, kind: 'normal' },
      { id: 'n3', x: 200, z: -150, kind: 'normal' },
      { id: 'n4', x: 1000, z: -150, kind: 'normal' },
    ],
    paths: [
      { id: 'p1', name: 'Right', nodeIds: ['n1', 'n2'], halfWidth: 60 },
      { id: 'p2', name: 'Left', nodeIds: ['n3', 'n4'], halfWidth: 60 },
    ],
  };

  // Ball placed at x = 0 (before the first node at x = 200), near z = 40
  // sampleLane strictly stays null outside node boundaries
  assert.equal(sampleLane(network, 'p1', 0), null);

  // nearestPathOrStart finds the closest lane's start node even before the lane starts
  assert.equal(nearestPathOrStart(network, 0, 40), 'p1', 'identifies the nearest line even before the line starts');
  assert.equal(nearestPathOrStart(network, 0, -120), 'p2', 'identifies the other lane when closer to it');

  // adoptNearestPaths adopts the closest start node for a ball placed anywhere
  const ballBearer = [{ pathId: null, x: -50, z: 40, finished: false }];
  adoptNearestPaths(ballBearer, network);
  assert.equal(ballBearer[0].pathId, 'p1');

  // resolveLaneTarget steers towards the start node during freefall
  const target = resolveLaneTarget({ targetLane: 0, pathId: 'p1', x: -50 }, network);
  assert.equal(target.targetZ, 50, 'steers to start node z during pre-start freefall');

  // Test ball reality in builder allows ball at x < 190 without clamping to 190
  const b = islandBuilder();
  b.setStartOffset(0);
  b.setTestBall({ x: -100, z: 40 });
  const reality = b.testStartReality();
  assert.ok(reality);
  assert.ok(reality!.laneName, 'identifies the nearest road lane even behind start');

  // Setting start offset on the builder also aligns lane start nodes
  b.setStartOffset(80);
  assert.equal(b.getStartOffset(), 80);
  (b as any).backups.destroy();
});

