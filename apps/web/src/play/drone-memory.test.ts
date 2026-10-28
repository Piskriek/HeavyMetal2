// Plan 56 W6a: the drone's memory host. Play becomes experience; leaving the Moon is a dream; the save round-trips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQ_DISTORTION_CATALOG } from '@hm/harness';
import { DRONE_MEMORY_OF, createDroneMemory, dreamNow, loadDroneMemory, noteCatalyst, saveDroneMemory, stageIdOf } from './drone-memory';

const ROOT = SQ_DISTORTION_CATALOG['root-reactivity'].rayIndex - 1;

test('a fight becomes the drone\'s experience: contact and kills in fire, hits on the player in flight', () => {
  let m = createDroneMemory();
  m = noteCatalyst(m, { kind: 'contact', distance: 9 }, 100, 1);
  m = noteCatalyst(m, { kind: 'down' }, 160, 1);
  m = noteCatalyst(m, { kind: 'clear' }, 200, 1);
  assert.deepEqual(m.presets.fire.ep.map((e) => e.cat), ['CONTACT', 'TARGET_DOWN']);
  assert.deepEqual(m.presets.flight.ep.map((e) => e.cat), ['AREA_CLEAR']);
  assert.ok(m.presets.fire.ep[0]!.ex > noteCatalyst(createDroneMemory(), { kind: 'contact', distance: 28 }, 1, 1).presets.fire.ep[0]!.ex, 'closer is more exciting');
  assert.equal(m.presets.fire.ep[0]!.stage, 'S1');
  // hard hits are felt as root-reactivity in flight; light ones are not
  const hard = noteCatalyst(m, { kind: 'hurt', damage: 20 }, 220, 1);
  assert.equal(hard.presets.flight.ep.at(-1)!.d, 'root-reactivity');
  assert.ok((hard.presets.flight.charge[ROOT] ?? 0) > 0);
  assert.equal(noteCatalyst(m, { kind: 'hurt', damage: 2 }, 220, 1).presets.flight.ep.at(-1)!.d, 'aligned');
  // an anchor's calm sets it softer
  const calmed = noteCatalyst(m, { kind: 'hurt', damage: 20 }, 220, 1, 0.6);
  assert.ok((calmed.presets.flight.charge[ROOT] ?? 0) < (hard.presets.flight.charge[ROOT] ?? 0));
  assert.deepEqual([stageIdOf(0), stageIdOf(3), stageIdOf(9)], ['S0a', 'S3', 'S6']);
});

test('leaving the Moon is a dream: the hits are replayed and balanced, and the drone says so on waking', () => {
  let m = createDroneMemory();
  for (let i = 0; i < 3; i++) m = noteCatalyst(m, { kind: 'hurt', damage: 20 }, 100 + i * 30, 2);
  const before = m.presets.flight.charge[ROOT] ?? 0;
  const { memory, line } = dreamNow(m, 400);
  assert.ok((memory.presets.flight.charge[ROOT] ?? 0) < before, 'the dream took some of it off');
  assert.match(line, /^I dreamed the hits on you again\. Presence came back/);
  assert.ok(memory.lastDream && memory.lastDream.replayed.length > 0);
  assert.equal(dreamNow(createDroneMemory(), 10).line, 'I slept without dreaming.');
});

test('the drone\'s memory saves as share codes and comes back exactly; anything else loads as nothing', () => {
  let m = createDroneMemory();
  m = noteCatalyst(m, { kind: 'contact', distance: 9 }, 100, 1);
  m = noteCatalyst(m, { kind: 'hurt', damage: 25 }, 120, 1);
  m = dreamNow(m, 300).memory;
  const back = loadDroneMemory(saveDroneMemory(m))!;
  assert.deepStrictEqual(back.presets, m.presets);
  assert.deepStrictEqual(back.ego, m.ego);
  assert.deepStrictEqual(back.weights, m.weights);
  for (const bad of [null, '', 'nope', '{"v":2}', JSON.stringify({ v: 1, ego: 'x', presets: [] })]) assert.equal(loadDroneMemory(bad), null);
  assert.equal(back.ego.of, DRONE_MEMORY_OF.ego);
});
