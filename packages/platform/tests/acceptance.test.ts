import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UGC_MAX_BYTES, UgcTooLargeError, type PresetBundle } from '@hm/contracts';
import { createPlatform } from '@hm/platform';

const bundle = (name: string, pad = 0): PresetBundle => ({
  format: 'hm-bundle', version: 1, root: 'p1', schemaVersions: { racer: 1 },
  presets: [{ id: 'p1', kind: 'racer', name, revision: 1, hash: 'h', params: pad ? { note: 'x'.repeat(pad) } : {}, children: {}, tags: [], tier: 'build', meta: { createdAt: 1 } }],
});

test('stub: kind and profile', async () => {
  const p = createPlatform('stub', { user: 'Mo' });
  assert.equal(p.kind, 'stub');
  const me = await p.profile();
  assert.equal(me.name, 'Mo'); assert.equal(me.isAnonymous, false);
  assert.equal((await createPlatform('stub').profile()).isAnonymous, true, 'no user given = anonymous guest');
});

test('stub storage: get/set/remove/keys with prefix; independent platforms do not share data', async () => {
  const p = createPlatform('stub');
  assert.equal(await p.storage.get('a'), null);
  await p.storage.set('a/1', 'x'); await p.storage.set('a/2', 'y'); await p.storage.set('b/1', 'z');
  assert.equal(await p.storage.get('a/1'), 'x');
  assert.deepEqual([...(await p.storage.keys('a/'))].sort(), ['a/1', 'a/2']);
  assert.equal((await p.storage.keys()).length, 3);
  await p.storage.remove('a/1');
  assert.equal(await p.storage.get('a/1'), null);
  assert.equal(await createPlatform('stub').storage.get('b/1'), null);
});

test('stub ugc: publish/list/load/remove, the 100 KB limit, tags, mine', async () => {
  const p = createPlatform('stub', { user: 'Mo' });
  const item = await p.ugc.publish('Fast ball', bundle('Fast'), ['racer']);
  assert.ok(item.id); assert.equal(item.title, 'Fast ball'); assert.equal(item.author, 'Mo'); assert.deepEqual(item.tags, ['racer']);
  assert.equal(item.bytes, JSON.stringify(bundle('Fast')).length);
  assert.deepEqual((await p.ugc.list()).map((i) => i.id), [item.id]);
  assert.deepEqual((await p.ugc.list({ tag: 'nope' })).length, 0);
  assert.equal((await p.ugc.list({ mine: true })).length, 1);
  assert.deepEqual(await p.ugc.load(item.id), bundle('Fast'));
  await assert.rejects(p.ugc.publish('Huge', bundle('Huge', UGC_MAX_BYTES)), (e) => e instanceof UgcTooLargeError && e.bytes > UGC_MAX_BYTES);
  await p.ugc.remove(item.id);
  assert.equal((await p.ugc.list()).length, 0);
  await assert.rejects(p.ugc.load(item.id));
});

test('stub leaderboard: submit keeps the best per player, top is ranked and limited', async () => {
  const p = createPlatform('stub', { user: 'Mo' });
  await p.leaderboard.submit('ranked', 900); await p.leaderboard.submit('ranked', 1200); await p.leaderboard.submit('ranked', 1000);
  const top = await p.leaderboard.top('ranked', 10);
  assert.deepEqual(top.map((t) => [t.rank, t.name, t.score]), [[1, 'Mo', 1200]], 'one row per player: the best score');
  assert.deepEqual(await p.leaderboard.top('empty'), []);
});

test('stub rooms: create/join/list, messages reach the others (not the sender), members update, leave', async () => {
  const hub = createPlatform('stub', { user: 'A' });
  const room = await hub.rooms.create({ maxPlayers: 2, metadata: { mode: 'race' } });
  assert.deepEqual(room.members, ['A']);
  assert.equal((await hub.rooms.list())[0]!.metadata['mode'], 'race');
  const got: string[] = [];
  room.onMessage((m) => got.push(`${m.from}:${m.name}:${JSON.stringify(m.payload)}`));
  const joined = await hub.rooms.join(room.id);
  assert.ok(joined.members.length >= 1);
  const members: string[][] = [];
  room.onMembers((m) => members.push([...m]));
  joined.send('hello', { n: 1 });
  assert.equal(got.length, 1); assert.match(got[0]!, /:hello:\{"n":1\}/);
  await assert.rejects(hub.rooms.join(room.id).then((r) => hub.rooms.join(r.id)).then((r) => hub.rooms.join(r.id)), /full|max/i, 'maxPlayers is enforced');
  await joined.leave();
  assert.ok(members.length >= 1);
});

test('run adapter: builds on an injected sdk, fails clearly without one', async () => {
  assert.throws(() => createPlatform('run'), /sdk/i);
  // the agent writes ./fake-run-sdk.ts; this test only requires that it exists and the adapter accepts it
  const fakePath = './fake-run-sdk.ts';
  const mod = (await import(fakePath).catch(() => null)) as { createFakeRunSdk?: () => unknown } | null;
  assert.ok(mod && typeof mod.createFakeRunSdk === 'function' && mod.createFakeRunSdk, 'write packages/platform/tests/fake-run-sdk.ts exporting createFakeRunSdk()');
  const p = createPlatform('run', { sdk: mod!.createFakeRunSdk!() });
  assert.equal(p.kind, 'run');
  await p.storage.set('k', 'v');
  assert.equal(await p.storage.get('k'), 'v');
});
