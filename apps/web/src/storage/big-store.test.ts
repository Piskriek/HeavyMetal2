import test from 'node:test';
import assert from 'node:assert/strict';
import { BigStore, isBigKey, migrateFromLocalStorage, type KeyValueBackend } from './big-store';

/** A backend that records writes and can be told the disk is full. */
function fakeBackend(full = false) {
  const disk = new Map<string, string>();
  const backend: KeyValueBackend = {
    async getAll() { return Object.fromEntries(disk); },
    async set(k, v) { if (full) throw new DOMException('full', 'QuotaExceededError'); disk.set(k, v); },
    async remove(k) { disk.delete(k); },
  };
  return { backend, disk };
}

/** A minimal Storage over a Map (localStorage in the tests). */
function fakeStorage(init: Record<string, string>): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

test('big keys are islands, the island list and the racetrack; settings are not', () => {
  assert.ok(isBigKey('hm.island.abc') && isBigKey('hm.islands.v1') && isBigKey('hm.racing.map.v2'));
  assert.ok(!isBigKey('hm.profile.v2') && !isBigKey('hm.settings'));
});

test('reads come from memory at once; writes reach the disk', async () => {
  const { backend, disk } = fakeBackend();
  const s = new BigStore(backend, { 'hm.island.a': 'old' });
  assert.equal(s.get('hm.island.a'), 'old');
  s.set('hm.island.a', 'new');
  assert.equal(s.get('hm.island.a'), 'new', 'no waiting');
  await s.flush();
  assert.equal(disk.get('hm.island.a'), 'new');
  s.remove('hm.island.a');
  await s.flush();
  assert.equal(s.get('hm.island.a'), null);
  assert.equal(disk.has('hm.island.a'), false);
});

test('a full disk keeps the island working and says so in plain words', async () => {
  const { backend } = fakeBackend(true);
  const s = new BigStore(backend);
  const said: string[] = [];
  s.onStorageFull((m) => said.push(m));
  s.set('hm.island.a', 'x'.repeat(100));
  await s.flush();
  assert.equal(s.get('hm.island.a')?.length, 100, 'memory keeps it');
  assert.equal(s.failures, 1);
  assert.match(said[0] ?? '', /out of room/);
});

test('localStorage saves move into the store once, and leave localStorage', async () => {
  const { backend, disk } = fakeBackend();
  const store = new BigStore(backend, { 'hm.island.kept': 'store copy' });
  const ls = fakeStorage({ 'hm.island.a': 'A', 'hm.islands.v1': 'list', 'hm.island.kept': 'old copy', 'hm.profile.v2': 'prefs' });
  const moved = await migrateFromLocalStorage(store, ls);
  assert.equal(moved, 2);
  assert.equal(disk.get('hm.island.a'), 'A');
  assert.equal(store.get('hm.island.kept'), 'store copy', 'the store is newer');
  assert.equal(ls.getItem('hm.island.a'), null);
  assert.equal(ls.getItem('hm.profile.v2'), 'prefs', 'settings stay');
});

test('a failed migration leaves localStorage alone', async () => {
  const { backend } = fakeBackend(true);
  const store = new BigStore(backend);
  const ls = fakeStorage({ 'hm.island.a': 'A' });
  await migrateFromLocalStorage(store, ls);
  assert.equal(ls.getItem('hm.island.a'), 'A');
});

test('bytes counts what is held', () => {
  const s = new BigStore(null, { 'hm.island.a': 'abcd' });
  assert.equal(s.bytes(), ('hm.island.a'.length + 4) * 2);
});
