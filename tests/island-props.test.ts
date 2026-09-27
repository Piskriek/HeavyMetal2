/**
 * ISLAND-ROUTE: the island's own placed props (browser key + backups/island/), kept apart from the
 * owner's classic track.
 *
 *   node --import tsx --test tests/island-props.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { TrackBuilder3D } from '../src/game/track-builder-3d';
import { writeStorage, TRACK_STORAGE_KEY, TRACK_STORAGE_KEY_V2 } from '../src/game/track-storage';
import {
  ISLAND_BACKUP_ENDPOINTS, ISLAND_PROPS_BACKUP_KEY, ISLAND_PROPS_KEY, readIslandProps, writeIslandProps,
} from '../src/game/island-route/island-props-storage';
import {
  ISLAND_LATEST_FILE, SHRINK_GUARD_MIN, listIslandBackups, readIslandBackup, saveIslandBackup,
} from '../scripts/island-props-backup';
import type { TrackData } from '../src/game/renderer-3d';

function mockStorage() {
  const data = new Map<string, string>();
  const store = {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k), clear: () => data.clear(), key: () => null, get length() { return data.size; },
  } as unknown as Storage;
  return { data, store };
}

const prop = (id: string, x = 0) => ({ id, type: 'prop_14_scrapdome_gantry', x, y: 2, z: 3, rotY: 0, scale: 1 });
const track = { id: 't', name: 't', theme: 'ridge', points: [{ x: 0, y: 0, z: 0 }] } as unknown as TrackData;
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'island-props-'));

test('the island store round-trips, and keeps the previous save as its backup', () => {
  const { data, store } = mockStorage();
  assert.deepEqual(readIslandProps(store), [], 'nothing saved yet');
  assert.equal(writeIslandProps([prop('a')] as never, store, 1).ok, true);
  assert.equal(writeIslandProps([prop('a'), prop('b')] as never, store, 2).ok, true);
  assert.deepEqual(readIslandProps(store).map((p) => p.id), ['a', 'b']);
  assert.equal(JSON.parse(data.get(ISLAND_PROPS_BACKUP_KEY)!).props.length, 1, 'the previous save');
  data.set(ISLAND_PROPS_KEY, '{broken');
  assert.deepEqual(readIslandProps(store).map((p) => p.id), ['a'], 'an unreadable save falls back to the backup');
  assert.equal(writeIslandProps([prop('a'), prop('a')] as never, store).ok, false, 'duplicate ids are refused');
});

test('the island builder saves its own props and never touches the owner\'s track', async () => {
  const { data, store } = mockStorage();
  (globalThis as any).localStorage = store;
  writeStorage([prop('owner-1')] as never, 'ridge');
  const ownerV2 = data.get(TRACK_STORAGE_KEY_V2);
  const ownerV1 = data.get(TRACK_STORAGE_KEY);
  assert.ok(ownerV2, 'the owner\'s track is in storage');

  const urls: string[] = [];
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string) => { urls.push(url); return new Response(JSON.stringify({ success: true }), { status: 200 }); };
  try {
    const island = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'island');
    assert.equal(island.getCourse(), 'basalt');
    assert.equal(island.getProps().length, 0, 'the owner\'s props stay out of the island');
    island.importJson(JSON.stringify([prop('isle-1'), prop('isle-2', 50)]));
    assert.deepEqual(readIslandProps(store).map((p) => p.id), ['isle-1', 'isle-2'], 'saved under the island key');
    assert.equal(data.get(TRACK_STORAGE_KEY_V2), ownerV2, 'the owner\'s track is untouched');
    assert.equal(data.get(TRACK_STORAGE_KEY), ownerV1);
    assert.equal(data.has('hm2-3d-track-props-backup-latest'), false, 'no classic browser backups either');
    await island.backupToFile(true);
    assert.ok(urls.length > 0 && urls.every((u) => u.startsWith('/api/backup-island-props') || u.startsWith('/api/restore-island')),
      `only the island routes: ${urls.join(', ')}`);
    assert.equal(await island.restoreDefaultPreset(), false, 'the classic starter set never lands on the island');
    assert.equal(island.latestBackupName(), ISLAND_BACKUP_ENDPOINTS.latestFile);

    const reopened = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'island');
    assert.deepEqual(reopened.getProps().map((p) => p.id), ['isle-1', 'isle-2'], 'the island loads its props again');
    const classic = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track);
    assert.deepEqual(classic.getProps().map((p) => p.id), ['owner-1'], 'the classic builder still loads the owner\'s track');
    for (const b of [island, reopened, classic]) (b as any).backups.destroy();
  } finally {
    (globalThis as any).fetch = realFetch;
  }
});

test('a builder with no store saves nothing anywhere', async () => {
  const { data, store } = mockStorage();
  (globalThis as any).localStorage = store;
  const none = new TrackBuilder3D(new THREE.Scene(), new THREE.PerspectiveCamera(), track, undefined, 'none');
  none.importJson(JSON.stringify([prop('x')]));
  assert.equal(data.size, 0);
  assert.equal(await none.backupToFile(true), null);
});

test('the island disk backup writes only inside its folder, with history, and reads files back', () => {
  const root = tmpDir();
  const dir = path.join(root, 'backups', 'island');
  const saved = saveIslandBackup(dir, { props: [prop('a')], timestamp: 1000 });
  assert.equal(saved.success, true);
  saveIslandBackup(dir, { props: [prop('a'), prop('b')], timestamp: 2000 });
  assert.deepEqual(fs.readdirSync(root), ['backups'], 'nothing written outside');
  assert.deepEqual(fs.readdirSync(path.join(root, 'backups')), ['island']);
  const listed = listIslandBackups(dir) as { latest: any; history: any[] };
  assert.equal(listed.latest.props.length, 2);
  assert.equal(listed.latest.course, 'basalt');
  assert.deepEqual(listed.history.map((h) => h.filename), ['island-props-2000.json', 'island-props-1000.json']);
  assert.equal((readIslandBackup(dir, 'island-props-1000.json') as any).props.length, 1);
  assert.equal((readIslandBackup(dir, ISLAND_LATEST_FILE) as any).props.length, 2);
  assert.equal(readIslandBackup(dir, '../../../package.json'), null, 'names never leave the folder');
});

test('the shrink guard protects a large island but lets a small one delete props', () => {
  const dir = path.join(tmpDir(), 'island');
  saveIslandBackup(dir, { props: [prop('a'), prop('b'), prop('c')] });
  assert.equal(saveIslandBackup(dir, { props: [prop('a')] }).success, true, 'a small island may shrink');
  const many = Array.from({ length: SHRINK_GUARD_MIN + 4 }, (_, i) => prop(`p${i}`));
  saveIslandBackup(dir, { props: many });
  const wiped = saveIslandBackup(dir, { props: many.slice(0, 3) });
  assert.equal(wiped.success, false, 'a near-empty save cannot wipe a large island');
  assert.equal((readIslandBackup(dir, ISLAND_LATEST_FILE) as any).props.length, many.length);
});
