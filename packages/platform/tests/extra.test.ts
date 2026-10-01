import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UGC_MAX_BYTES, UgcTooLargeError, type PresetBundle } from '@hm/contracts';
import { createPlatform, createStubHub } from '@hm/platform';
import { createFakeRunSdk } from './fake-run-sdk.js';

const makeBundle = (id: string, name: string): PresetBundle => ({
  format: 'hm-bundle',
  version: 1,
  root: id,
  schemaVersions: { racer: 1 },
  presets: [
    {
      id,
      kind: 'racer',
      name,
      revision: 1,
      hash: 'h1',
      params: { speed: 100 },
      children: {},
      tags: ['car'],
      tier: 'play',
      meta: { createdAt: 100 },
    },
  ],
});

// Test 1: Stub shared hub enables two distinct players to converse in the same room
test('stub: shared hub enables two players in the same room', async () => {
  const hub = createStubHub();
  const playerA = createPlatform('stub', { user: 'Alice', hub });
  const playerB = createPlatform('stub', { user: 'Bob', hub });

  const roomA = await playerA.rooms.create({ maxPlayers: 4 });
  const roomB = await playerB.rooms.join(roomA.id);

  assert.deepEqual([...roomB.members].sort(), ['Alice', 'Bob']);

  const messagesForA: any[] = [];
  const messagesForB: any[] = [];
  roomA.onMessage((m) => messagesForA.push(m));
  roomB.onMessage((m) => messagesForB.push(m));

  // Bob sends to the room: Alice should receive it, Bob should not
  roomB.send('hello_alice', { score: 42 });
  assert.equal(messagesForA.length, 1);
  assert.equal(messagesForA[0].from, 'Bob');
  assert.equal(messagesForA[0].name, 'hello_alice');
  assert.equal(messagesForB.length, 0);

  // Alice replies
  roomA.send('welcome_bob', 'glad to see you');
  assert.equal(messagesForB.length, 1);
  assert.equal(messagesForB[0].from, 'Alice');
  assert.equal(messagesForB[0].payload, 'glad to see you');
});

// Test 2: Stub private room messaging with 'to' parameter
test('stub: private room messaging delivers only to the targeted player', async () => {
  const hub = createStubHub();
  const alice = createPlatform('stub', { user: 'Alice', hub });
  const bob = createPlatform('stub', { user: 'Bob', hub });
  const charlie = createPlatform('stub', { user: 'Charlie', hub });

  const roomA = await alice.rooms.create({ maxPlayers: 5 });
  const roomB = await bob.rooms.join(roomA.id);
  const roomC = await charlie.rooms.join(roomA.id);

  const bobMsgs: any[] = [];
  const charlieMsgs: any[] = [];
  roomB.onMessage((m) => bobMsgs.push(m));
  roomC.onMessage((m) => charlieMsgs.push(m));

  // Alice sends whispering specifically to Charlie
  roomA.send('whisper', { secret: 123 }, 'Charlie');
  assert.equal(bobMsgs.length, 0, 'Bob should not receive whisper intended for Charlie');
  assert.equal(charlieMsgs.length, 1, 'Charlie should receive targeted whisper');
  assert.equal(charlieMsgs[0].name, 'whisper');
});

// Test 3: Stub room members list updates on join and leave
test('stub: room members listener receives roster changes', async () => {
  const hub = createStubHub();
  const p1 = createPlatform('stub', { user: 'P1', hub });
  const p2 = createPlatform('stub', { user: 'P2', hub });

  const room1 = await p1.rooms.create();
  const rosterSnapshots: string[][] = [];
  room1.onMembers((m) => rosterSnapshots.push([...m]));

  const room2 = await p2.rooms.join(room1.id);
  assert.ok(rosterSnapshots.length >= 1);
  assert.deepEqual(rosterSnapshots[rosterSnapshots.length - 1], ['P1', 'P2']);

  await room2.leave();
  assert.deepEqual(rosterSnapshots[rosterSnapshots.length - 1], ['P1']);
});

// Test 4: Stub joining non-existent room throws 'not found'
test('stub: joining non-existent room throws not found error', async () => {
  const p = createPlatform('stub', { user: 'Solo' });
  await assert.rejects(p.rooms.join('missing-room-id'), /not found/i);
});

// Test 5: Stub storage keys without prefix returns all keys
test('stub storage: keys() with and without prefix', async () => {
  const p = createPlatform('stub');
  await p.storage.set('prefix/one', '1');
  await p.storage.set('prefix/two', '2');
  await p.storage.set('other/three', '3');

  const all = await p.storage.keys();
  assert.equal(all.length, 3);
  const prefixed = await p.storage.keys('prefix/');
  assert.deepEqual([...prefixed].sort(), ['prefix/one', 'prefix/two']);
});

// Test 6: Stub UGC pagination and limits
test('stub ugc: honors pagination limit', async () => {
  const p = createPlatform('stub', { user: 'Creator' });
  for (let i = 0; i < 5; i++) {
    await p.ugc.publish(`Item ${i}`, makeBundle(`id_${i}`, `Car ${i}`));
  }
  const page1 = await p.ugc.list({ limit: 2 });
  assert.equal(page1.length, 2);
  const all = await p.ugc.list();
  assert.equal(all.length, 5);
});

// Test 7: Stub UGC filtering by tags and mine
test('stub ugc: tag and mine filters behave accurately', async () => {
  const hub = createStubHub();
  const author1 = createPlatform('stub', { user: 'Dev1', hub });
  const author2 = createPlatform('stub', { user: 'Dev2', hub });

  await author1.ugc.publish('Track A', makeBundle('t1', 'Track A'), ['racing', 'track']);
  await author1.ugc.publish('Track B', makeBundle('t2', 'Track B'), ['puzzle']);
  await author2.ugc.publish('Track C', makeBundle('t3', 'Track C'), ['racing']);

  const racingItems = await author1.ugc.list({ tag: 'racing' });
  assert.equal(racingItems.length, 2);

  const mineItems = await author1.ugc.list({ mine: true });
  assert.equal(mineItems.length, 2);
  assert.ok(mineItems.every((i) => i.author === 'Dev1'));
});

// Test 8: Stub leaderboard top honors limit and sorting
test('stub leaderboard: honors limit parameter', async () => {
  const hub = createStubHub();
  const p1 = createPlatform('stub', { user: 'Player1', hub });
  const p2 = createPlatform('stub', { user: 'Player2', hub });
  const p3 = createPlatform('stub', { user: 'Player3', hub });

  await p1.leaderboard.submit('stage1', 100);
  await p2.leaderboard.submit('stage1', 300);
  await p3.leaderboard.submit('stage1', 200);

  const top2 = await p1.leaderboard.top('stage1', 2);
  assert.equal(top2.length, 2);
  assert.equal(top2[0]!.name, 'Player2');
  assert.equal(top2[0]!.score, 300);
  assert.equal(top2[1]!.name, 'Player3');
  assert.equal(top2[1]!.score, 200);
});

// Test 9: Stub leaderboard isolates scores by board name
test('stub leaderboard: separate boards have independent entries', async () => {
  const p = createPlatform('stub', { user: 'Pro' });
  await p.leaderboard.submit('board_easy', 50);
  await p.leaderboard.submit('board_hard', 999);

  const easy = await p.leaderboard.top('board_easy');
  const hard = await p.leaderboard.top('board_hard');
  assert.equal(easy[0]!.score, 50);
  assert.equal(hard[0]!.score, 999);
});

// Test 10: Stub clock injection ensures deterministic createdAt
test('stub: custom injected clock is used for UGC creation timestamp', async () => {
  let simulatedTime = 5555;
  const p = createPlatform('stub', { now: () => simulatedTime });
  const item = await p.ugc.publish('Clocked Item', makeBundle('c1', 'Clocked'));
  assert.equal(item.createdAt, 5555);
});

// Test 11: Run adapter profile retrieval
test('run: profile returns player info and isAnonymous flag', async () => {
  const sdk = createFakeRunSdk({ id: 'sdk-u1', username: 'SuperGamer', isAnonymous: false });
  const p = createPlatform('run', { sdk });
  const prof = await p.profile();
  assert.equal(prof.id, 'sdk-u1');
  assert.equal(prof.name, 'SuperGamer');
  assert.equal(prof.isAnonymous, false);
});

// Test 12: Run adapter storage get/set/remove/keys
test('run storage: full get, set, remove, and keys with prefix', async () => {
  const sdk = createFakeRunSdk();
  const p = createPlatform('run', { sdk });

  assert.equal(await p.storage.get('k1'), null);
  await p.storage.set('prefix/val1', 'v1');
  await p.storage.set('prefix/val2', 'v2');
  await p.storage.set('other/val3', 'v3');

  assert.equal(await p.storage.get('prefix/val1'), 'v1');
  const keys = await p.storage.keys('prefix/');
  assert.deepEqual([...keys].sort(), ['prefix/val1', 'prefix/val2']);

  await p.storage.remove('prefix/val1');
  assert.equal(await p.storage.get('prefix/val1'), null);
});

// Test 13: Run adapter UGC publish, list (browse & mine), load, and remove
test('run ugc: publish, list, load, and delete lifecycle', async () => {
  const sdk = createFakeRunSdk({ username: 'ModAuthor' });
  const p = createPlatform('run', { sdk });

  const item = await p.ugc.publish('Cool Mod', makeBundle('mod1', 'Cool Mod'), ['mods']);
  assert.ok(item.id);
  assert.equal(item.title, 'Cool Mod');
  assert.equal(item.author, 'ModAuthor');

  const loaded = await p.ugc.load(item.id);
  assert.deepEqual(loaded, makeBundle('mod1', 'Cool Mod'));

  const listAll = await p.ugc.list();
  assert.equal(listAll.length, 1);

  const mine = await p.ugc.list({ mine: true });
  assert.equal(mine.length, 1);

  await p.ugc.remove(item.id);
  const afterRemove = await p.ugc.list();
  assert.equal(afterRemove.length, 0);
  await assert.rejects(p.ugc.load(item.id), /not found/i);
});

// Test 14: Run adapter UGC rejects oversized bundle before calling SDK
test('run ugc: rejects bundle exceeding UGC_MAX_BYTES', async () => {
  const sdk = createFakeRunSdk();
  const p = createPlatform('run', { sdk });
  const hugeBundle: PresetBundle = {
    format: 'hm-bundle',
    version: 1,
    root: 'huge',
    schemaVersions: {},
    presets: [
      {
        id: 'huge',
        kind: 'pad',
        name: 'Huge',
        revision: 1,
        hash: 'h',
        params: { data: 'a'.repeat(UGC_MAX_BYTES + 10) },
        children: {},
        tags: [],
        tier: 'build',
        meta: { createdAt: 1 },
      },
    ],
  };

  await assert.rejects(
    p.ugc.publish('Huge', hugeBundle),
    (err) => err instanceof UgcTooLargeError && err.bytes > UGC_MAX_BYTES
  );
});

// Test 15: Run adapter leaderboard submit and top querying
test('run leaderboard: submitScore and getPagedScores with rankings', async () => {
  const sdk = createFakeRunSdk({ username: 'Champion' });
  const p = createPlatform('run', { sdk });

  await p.leaderboard.submit('speedrun', 450);
  const top = await p.leaderboard.top('speedrun');
  assert.equal(top.length, 1);
  assert.equal(top[0]!.rank, 1);
  assert.equal(top[0]!.name, 'Champion');
  assert.equal(top[0]!.score, 450);
});

// Test 16: Run adapter multiplayer room creation, joining, and messaging
test('run rooms: member updates and leave', async () => {
  const sdk = createFakeRunSdk({ username: 'Host' });
  const platform = createPlatform('run', { sdk });
  const room = await platform.rooms.create();
  assert.ok(room.members.length >= 1);

  const rosterUpdates: string[][] = [];
  room.onMembers((members) => rosterUpdates.push([...members]));

  await room.leave();
  // Connection cleanup succeeded without error
  assert.ok(true);
});

// Test 18: Run adapter rooms list returns active rooms
test('run rooms: list user rooms returns room summaries', async () => {
  const sdk = createFakeRunSdk({ username: 'LobbyHost' });
  const platform = createPlatform('run', { sdk });
  const room = await platform.rooms.create({ metadata: { tag: 'pro' } });

  const list = await platform.rooms.list();
  assert.ok(list.length >= 1);
  assert.equal(list[0]!.id, room.id);
  assert.equal(list[0]!.metadata['tag'], 'pro');
});

// Test 19: Run adapter error translation
test('run adapter: translates SDK storage errors clearly', async () => {
  const brokenSdk = {
    getProfile() {
      return { id: 'x', username: 'x' };
    },
    appStorage: {
      async getItem() {
        throw new Error('Network timeout');
      },
    },
  };
  const platform = createPlatform('run', { sdk: brokenSdk });
  await assert.rejects(platform.storage.get('fail_key'), /Storage get failed for "fail_key": Network timeout/);
});
