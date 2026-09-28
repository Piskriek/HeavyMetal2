/**
 * SHIPPED COURSES: the owner's published island (public/courses/island.json) is what a new player races
 * on: its tracks join the list, a track's props / ground / the lanes / the sky fall back to it when the
 * player has nothing of their own, and the player's own saves always win.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadShippedCourses, parseShippedCourses, setShippedCourses, shippedCourses, type ShippedCourses } from '../src/game/shipped-courses';
import { ISLAND_TRACKS_KEY, islandPropsKey, readIslandProps, readIslandTracks } from '../src/game/island-route/island-props-storage';
import { readGroundDoc } from '../src/game/island-route/island-ground';
import { loadLaneNetwork } from '../src/game/lane-storage';
import { islandLaneNetwork } from '../src/game/island-route/island-lanes';
import { _resetSkySettingsCache, getSkySettings } from '../src/game/sky/sky-settings';

function memoryStore(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); },
  };
}

const prop = (id: string) => ({ id, type: 'kit_rock', name: 'Rock', x: 0, y: 0, z: 0, rotY: 0, scale: 1, alignToTrack: false });
const published = (): ShippedCourses => ({
  version: 1, publishedAt: '2026-09-28T00:00:00Z', active: 'serpent-sprint',
  tracks: [
    { id: 'serpentine', name: 'Serpentine Isle', props: [prop('a')], ground: { version: 2, settings: {}, mask: null } },
    { id: 'serpent-sprint', name: 'Serpent Sprint', props: [prop('b'), prop('c')] },
  ],
  sky: { mode: 'gradient', gradient: { top: '#112233' } },
});

test('parse: only a version-1 document with tracks; a bad active track falls back to the first', () => {
  assert.equal(parseShippedCourses(null), null);
  assert.equal(parseShippedCourses({ version: 2, tracks: [] }), null);
  assert.equal(parseShippedCourses({ version: 1, tracks: [{ id: 'x' }] }), null, 'a track needs a name and props');
  assert.equal(parseShippedCourses({ ...published(), active: 'gone' })!.active, 'serpentine');
});

test('a new player gets the published tracks and starts on the published track', () => {
  setShippedCourses(published());
  try {
    const store = memoryStore();
    const index = readIslandTracks(store);
    assert.deepEqual(index.tracks.map((t) => t.id), ['serpentine', 'serpent-sprint']);
    assert.equal(index.active, 'serpent-sprint');
    assert.deepEqual(readIslandProps(store, 'serpent-sprint').map((p) => p.id), ['b', 'c']);
    assert.deepEqual(readIslandProps(store).map((p) => p.id), ['b', 'c'], 'the active track');
    assert.equal(readGroundDoc('serpentine')?.version, 2, 'ground paint from the published island');
  } finally { setShippedCourses(null); }
});

test('the player\'s own saves always win over the published island', () => {
  setShippedCourses(published());
  try {
    const store = memoryStore();
    store.setItem(ISLAND_TRACKS_KEY, JSON.stringify({ active: 'serpentine', tracks: [{ id: 'serpentine', name: 'Serpentine Isle', createdAt: 0 }, { id: 'mine', name: 'Mine', createdAt: 5 }] }));
    store.setItem(islandPropsKey('serpentine'), JSON.stringify({ version: 1, course: 'basalt', timestamp: 1, props: [prop('local')] }));
    const index = readIslandTracks(store);
    assert.equal(index.active, 'serpentine', 'a saved choice of track is kept');
    assert.deepEqual(index.tracks.map((t) => t.id), ['serpentine', 'mine', 'serpent-sprint'], 'published tracks are added after the player\'s own');
    assert.deepEqual(readIslandProps(store, 'serpentine').map((p) => p.id), ['local']);
  } finally { setShippedCourses(null); }
});

test('lanes: a published network is used only when valid; otherwise the island\'s own lanes', () => {
  setShippedCourses({ ...published(), lanes: { nonsense: true } });
  try {
    assert.deepEqual(loadLaneNetwork('basalt', memoryStore()), islandLaneNetwork());
    assert.equal(loadLaneNetwork('ridge', memoryStore()), null, 'the classic tracks are untouched');
  } finally { setShippedCourses(null); }
  const lanes = islandLaneNetwork();
  setShippedCourses({ ...published(), lanes });
  try { assert.deepEqual(loadLaneNetwork('basalt', memoryStore()), lanes); } finally { setShippedCourses(null); }
});

test('sky: never set on this device → the published look', () => {
  setShippedCourses(published());
  _resetSkySettingsCache();
  try {
    const s = getSkySettings();
    assert.equal(s.mode, 'gradient');
    assert.equal(s.gradient.top, '#112233');
  } finally { setShippedCourses(null); _resetSkySettingsCache(); }
});

test('load: fetched at boot; a missing file means no published island', async () => {
  const ok = await loadShippedCourses((async () => ({ ok: true, json: async () => published() })) as unknown as typeof fetch);
  assert.equal(ok?.tracks.length, 2);
  assert.equal(shippedCourses()?.active, 'serpent-sprint');
  const none = await loadShippedCourses((async () => ({ ok: false })) as unknown as typeof fetch);
  assert.equal(none, null);
  assert.equal(shippedCourses(), null, 'a later missing file clears the earlier island');
});
