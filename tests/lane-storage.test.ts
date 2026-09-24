/**
 * M01 · T6 (IF-LANESTORE) — authored lane networks on disk, under the same rules as the props.
 *
 * The rules the ticket names, each one its own assertion below: validate before write (a refused save
 * leaves the previous document exactly as it was), back up before write, unknown fields survive a
 * round trip, quota is reported rather than thrown, a per-course entry that does not validate is
 * dropped while its neighbours are kept, and an import can never smuggle in a network the runtime
 * would refuse.
 *
 * Run with: `node --import tsx --test tests/lane-storage.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LANE_BACKUP_KEY, LANE_STORAGE_KEY, LANE_STORAGE_VERSION,
  buildLaneDocument, exportLaneNetworks, importLaneNetworks, loadLaneNetwork, readLaneStorage,
  restoreLaneBackup, validateLaneDocument, writeLaneStorage, type LaneStorageDocument,
} from '../src/game/lane-storage';
import {
  DEFAULT_HALF_WIDTH, LANE_NETWORK_VERSION, validateLaneNetwork, type LaneNetwork,
} from '../src/game/lane-network';
import { TRACK_STORAGE_KEY } from '../src/game/track-storage';
import { FINISH, START_X, laneZ } from '../src/game/scene';

/** In-memory `Storage`, in the shape `track-storage.test.ts` already uses. */
function createMockStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => { data.clear(); },
    get length() { return data.size; },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
  };
}

/** A storage that refuses everything, the way a browser with cookies off does. */
const blockedStorage = {
  getItem() { throw new Error('storage is blocked'); },
  setItem() { throw new Error('storage is blocked'); },
  removeItem() {}, clear() {}, length: 0, key: () => null,
} as unknown as Storage;

/** A network with author metadata sprinkled at every level. */
function networkWithMetadata(course: 'ridge' | 'sheep' = 'ridge'): LaneNetwork {
  return {
    version: LANE_NETWORK_VERSION, course,
    notes: 'authored by the hands',
    nodes: [
      { id: 'start', x: START_X, z: laneZ(2), kind: 'normal', label: 'grid' },
      { id: 'flag', x: FINISH, z: laneZ(2), kind: 'normal' },
    ],
    paths: [{ id: 'line', name: 'Line', nodeIds: ['start', 'flag'], halfWidth: DEFAULT_HALF_WIDTH, authorHint: 'keep to the ridge' }],
  } as LaneNetwork;
}

const field = (value: unknown, key: string): unknown => (value as Record<string, unknown>)[key];

test('storage: a document round-trips and unknown fields survive', () => {
  const storage = createMockStorage();
  const doc = buildLaneDocument({ ridge: networkWithMetadata() }, '2026-09-24T00:00:00.000Z');
  assert.equal(writeLaneStorage(storage, doc).ok, true);

  const read = readLaneStorage(storage);
  assert.ok(read, 'the document must come back');
  assert.equal(read!.version, LANE_STORAGE_VERSION);
  assert.equal(read!.savedAt, '2026-09-24T00:00:00.000Z');
  assert.deepEqual(Object.keys(read!.networks), ['ridge']);

  const network = read!.networks.ridge!;
  assert.equal(field(network, 'notes'), 'authored by the hands', 'network-level unknown field');
  assert.equal(field(network.nodes[0], 'label'), 'grid', 'node-level unknown field');
  assert.equal(field(network.paths[0], 'authorHint'), 'keep to the ridge', 'path-level unknown field');

  // The document as a whole carries what it does not understand.
  const future: LaneStorageDocument = { ...doc, buildMachine: 'goblin-v3' } as LaneStorageDocument;
  assert.equal(writeLaneStorage(storage, future).ok, true);
  assert.equal(readLaneStorage(storage)!.buildMachine, 'goblin-v3');

  // And the one semantic field that matters survives validation, not just JSON.
  assert.equal(validateLaneNetwork(network).ok, true);
  assert.equal(loadLaneNetwork('ridge', storage)!.paths[0].id, 'line');
  assert.equal(loadLaneNetwork('sheep', storage), null, 'a course with no entry has no network');

  // The lane document is its own key: it can never be mistaken for the prop document.
  assert.notEqual(LANE_STORAGE_KEY, TRACK_STORAGE_KEY);
  assert.equal(storage.getItem(TRACK_STORAGE_KEY), null);
});

test('storage: the previous document is backed up before the new one lands', () => {
  const storage = createMockStorage();
  const first = buildLaneDocument({ ridge: networkWithMetadata() }, '2026-09-24T00:00:00.000Z');
  const second = buildLaneDocument({ ridge: networkWithMetadata('ridge') }, '2026-09-24T00:01:00.000Z');

  writeLaneStorage(storage, first);
  const afterFirst = storage.getItem(LANE_STORAGE_KEY);
  assert.equal(storage.getItem(LANE_BACKUP_KEY), null, 'nothing to back up yet');

  writeLaneStorage(storage, second);
  assert.equal(storage.getItem(LANE_BACKUP_KEY), afterFirst, 'the backup holds the first document');

  // Restoring brings the first document back and reports what it restored.
  const restored = restoreLaneBackup(storage);
  assert.ok(restored);
  assert.equal(restored!.savedAt, '2026-09-24T00:00:00.000Z');
  assert.equal(readLaneStorage(storage)!.savedAt, '2026-09-24T00:00:00.000Z');

  // Asking twice is harmless — the key is still there and still valid.
  assert.equal(restoreLaneBackup(storage)!.savedAt, '2026-09-24T00:00:00.000Z');
  // A storage with no backup restores nothing.
  assert.equal(restoreLaneBackup(createMockStorage()), null);

  // An unchanged document is a genuine no-op: it may not clobber its own backup.
  const before = storage.getItem(LANE_BACKUP_KEY);
  assert.equal(writeLaneStorage(storage, first).ok, true);
  assert.equal(storage.getItem(LANE_BACKUP_KEY), before);
});

test('storage: an invalid document is refused and leaves the previous one alone', () => {
  const storage = createMockStorage();
  const good = buildLaneDocument({ ridge: networkWithMetadata() }, '2026-09-24T00:00:00.000Z');
  writeLaneStorage(storage, good);
  const stored = storage.getItem(LANE_STORAGE_KEY);
  const backup = storage.getItem(LANE_BACKUP_KEY);

  // Node outside the corridor: refused, with the code that names it.
  const outside = networkWithMetadata();
  outside.nodes[0].z = 5000;
  const result = writeLaneStorage(storage, buildLaneDocument({ ridge: outside }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'invalid');
    if (result.reason === 'invalid') {
      assert.ok(result.errors.some((error) => error.code === 'out_of_corridor'), JSON.stringify(result.errors));
    }
  }
  assert.equal(storage.getItem(LANE_STORAGE_KEY), stored, 'the previous document is untouched');
  assert.equal(storage.getItem(LANE_BACKUP_KEY), backup);

  // A document that is not shaped like one at all is refused, not thrown on.
  for (const rubbish of [
    { version: LANE_STORAGE_VERSION, savedAt: '', networks: undefined },
    { version: LANE_STORAGE_VERSION, savedAt: '', networks: 'ridge' },
    { version: LANE_STORAGE_VERSION, savedAt: '', networks: { ridge: { version: 1, course: 'ridge' } } },
  ]) {
    const refused = writeLaneStorage(storage, rubbish as unknown as LaneStorageDocument);
    assert.equal(refused.ok, false, JSON.stringify(rubbish));
    if (!refused.ok) assert.equal(refused.reason, 'invalid');
  }
  assert.equal(readLaneStorage(storage)!.savedAt, '2026-09-24T00:00:00.000Z');

  // `validateLaneDocument` is the same check, callable on its own.
  assert.equal(validateLaneDocument(good).length, 0);
  assert.ok(validateLaneDocument({ networks: undefined } as unknown as LaneStorageDocument).length > 0);
});

test('storage: quota is reported, never thrown', () => {
  const storage = createMockStorage();
  const good = buildLaneDocument({ ridge: networkWithMetadata() }, '2026-09-24T00:00:00.000Z');
  writeLaneStorage(storage, good);
  const stored = storage.getItem(LANE_STORAGE_KEY);

  const full = createMockStorage();
  full.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  full.getItem = () => stored;
  const refused = writeLaneStorage(full, buildLaneDocument({ ridge: networkWithMetadata('sheep') as unknown as LaneNetwork }));
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.reason, 'quotaExceeded');
  assert.equal(full.getItem(LANE_STORAGE_KEY), stored, 'the previous document is still readable');

  // A storage that throws on every call is "no storage": reads are null, writes report quota.
  assert.equal(readLaneStorage(blockedStorage), null);
  const blocked = writeLaneStorage(blockedStorage, good);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.reason, 'quotaExceeded');
  assert.equal(restoreLaneBackup(blockedStorage), null);
});

test('storage: one bad course does not take the others down with it', () => {
  const storage = createMockStorage();
  const broken = networkWithMetadata();
  broken.paths[0].halfWidth = 5000;
  // Written by hand, as a previous version of the game or an import would have left it.
  storage.setItem(LANE_STORAGE_KEY, JSON.stringify({
    version: LANE_STORAGE_VERSION,
    savedAt: '2026-09-24T00:00:00.000Z',
    networks: { ridge: networkWithMetadata(), sheep: broken },
    buildMachine: 'goblin-v3',
  }));

  const read = readLaneStorage(storage);
  assert.ok(read);
  assert.deepEqual(Object.keys(read!.networks), ['ridge'], 'only the valid entry is trusted');
  assert.equal(read!.buildMachine, 'goblin-v3', 'and the rest of the document is still there');
  assert.equal(loadLaneNetwork('ridge', storage)!.paths[0].id, 'line');
  assert.equal(loadLaneNetwork('sheep', storage), null);

  // Anything that cannot be trusted as a document is reported as absent, not partially read.
  for (const raw of [
    'not json at all', '[]', 'null', JSON.stringify({ version: 2, networks: {} }),
    JSON.stringify({ version: LANE_STORAGE_VERSION }), JSON.stringify({ version: LANE_STORAGE_VERSION, networks: [] }),
    JSON.stringify({ version: LANE_STORAGE_VERSION, networks: { moon: networkWithMetadata() } }),
  ]) {
    storage.setItem(LANE_STORAGE_KEY, raw);
    const result = readLaneStorage(storage);
    if (raw.includes('moon')) {
      assert.ok(result, 'an unknown course key is dropped, not fatal');
      assert.deepEqual(Object.keys(result!.networks), []);
    } else {
      assert.equal(result, null, `${raw} must read as absent`);
    }
  }
});

test('storage: export and import go through validation', () => {
  const doc = buildLaneDocument({ ridge: networkWithMetadata(), sheep: networkWithMetadata('sheep') }, '2026-09-24T00:02:00.000Z');
  const json = exportLaneNetworks(doc);
  assert.ok(json.includes('\n'), 'the export is readable JSON');

  const imported = importLaneNetworks(json);
  assert.equal(imported.ok, true);
  if (imported.ok) {
    assert.deepEqual(Object.keys(imported.doc.networks).sort(), ['ridge', 'sheep']);
    assert.equal(field(imported.doc.networks.ridge!, 'notes'), 'authored by the hands');
    assert.equal(imported.doc.savedAt, '2026-09-24T00:02:00.000Z');
  }

  // Broken JSON, a wrong version, and a network the runtime would refuse: all refused, all reported.
  const brokenJson = importLaneNetworks('{ oops');
  assert.equal(brokenJson.ok, false);
  if (!brokenJson.ok) assert.equal(brokenJson.errors[0].code, 'kind_mismatch');

  const wrongVersion = importLaneNetworks(JSON.stringify({ version: 99, networks: {} }));
  assert.equal(wrongVersion.ok, false);

  const badNetwork = networkWithMetadata();
  badNetwork.paths[0].nodeIds = ['start', 'missing'];
  const refused = importLaneNetworks(JSON.stringify(buildLaneDocument({ ridge: badNetwork })));
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.ok(refused.errors.some((error) => error.code === 'unknown_node'), JSON.stringify(refused.errors));
});

test('storage: the dev mirror writes to its own directory, and will not shrink a save', () => {
  // The disk mirror is a build-time convenience, but its two laws are the same as the storage's:
  // never touch the protected props directory, and never let a nearly-empty save wipe the file.
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf-8');
  assert.ok(config.includes('/api/backup-lane-paths'), 'the route must exist');
  assert.ok(config.includes('backups/lane-paths'), 'and it writes into its own directory');
  assert.ok(config.includes('incoming < existingNodes * 0.75'), 'a save that loses a quarter of its nodes is refused');
  const plugin = config.slice(config.indexOf('function lanePathsBackupPlugin'));
  assert.equal(plugin.includes('backups/props'), false, 'the protected props directory is never a target');
  // And the runtime never posts anywhere itself: the builder does, which is why this is structural.
  assert.equal(readFileSync(new URL('../src/game/lane-storage.ts', import.meta.url), 'utf-8').includes('fetch('), false);
});

test('storage: the runtime reads a network the builder could have written', () => {
  // The whole point of the round trip: what comes out of storage is a network the physics can steer
  // on, not a bag of numbers that merely looks like one.
  const storage = createMockStorage();
  const doc = buildLaneDocument({ ridge: networkWithMetadata() }, '2026-09-24T00:00:00.000Z');
  writeLaneStorage(storage, doc);
  const loaded = loadLaneNetwork('ridge', storage);
  assert.ok(loaded);
  const validated = validateLaneNetwork(loaded);
  assert.equal(validated.ok, true, JSON.stringify(validated.ok ? [] : validated.errors));
  if (validated.ok) {
    assert.equal(validated.network.nodes.length, 2);
    assert.equal(validated.network.paths[0].halfWidth, DEFAULT_HALF_WIDTH);
    assert.equal(validated.network.course, 'ridge');
  }
});
