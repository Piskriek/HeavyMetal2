// Plan 56 W6a: the drone's memory host. Play becomes experience; leaving the Moon is a dream; the save round-trips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQ_DISTORTION_CATALOG } from '@hm/harness';
import { DRONE_MEMORY_OF, createDroneMemory, dreamNow, hasUndreamt, loadDroneMemory, noteCatalyst, saveDroneMemory, stageIdOf } from './drone-memory';

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

test('the Higher Self seat: the drone shows its digest and what is worth a cue; cues and words from the bridge are checked', async () => {
  const { checkCues, dronePerspective, higherSelfWords, MAX_CUES } = await import('./drone-memory');
  let m = createDroneMemory();
  m = noteCatalyst(m, { kind: 'contact', distance: 9 }, 100, 1);
  for (let i = 0; i < 3; i++) m = noteCatalyst(m, { kind: 'hurt', damage: 25 }, 110 + i, 1);
  const p = dronePerspective(m);
  assert.ok(p.lines[0]?.startsWith('System coherence'));
  assert.ok(p.lines.some((l) => l.includes('loc:f17e') && l.includes('root-reactivity')), 'the flight preset still carries the hits');
  assert.deepEqual(p.cueable.map((c) => [c.of, c.t, c.d]), [['loc:f17e', 112, 'root-reactivity'], ['loc:f17e', 111, 'root-reactivity'], ['loc:f17e', 110, 'root-reactivity']], 'the charged episodes, newest first');
  assert.equal(p.kundalini.flight, 0, 'the root ray is charged: it has not begun to rise');
  assert.equal(p.kundalini.fire, 7);
  // a cue from the seat steers the next dream to the cued episode
  const cues = checkCues([{ of: 'loc:f17e', t: 110 }])!;
  const { memory } = dreamNow(m, 400, cues);
  assert.deepEqual(memory.lastDream?.replayed.filter((r) => r.cued).map((r) => [r.of, r.t]), [['loc:f17e', 110]]);
  // checked: only the drone's own presets, whole ticks, 1 to 12 of them
  assert.equal(checkCues([{ of: 'kit:00aa', t: 1 }]), null);
  assert.equal(checkCues([{ of: 'loc:f17e', t: 1.5 }]), null);
  assert.equal(checkCues([]), null);
  assert.equal(checkCues(Array.from({ length: MAX_CUES + 1 }, (_, i) => ({ of: 'loc:f17e', t: i }))), null);
  assert.equal(checkCues('nope'), null);
  // the Higher Self's words: one plain line, capped
  assert.equal(higherSelfWords('  Rest in\nPresence.\u0007 '), 'Rest in Presence.');
  assert.equal(higherSelfWords('x'.repeat(400))?.length, 300);
  assert.equal(higherSelfWords('   '), null);
  assert.equal(higherSelfWords(42), null);
});

test('symptoms you can see: a balanced drone is steady; hits leave a sway in its flight; a dream steadies it', async () => {
  const { droneSymptoms, SYMPTOM_SWAY_M } = await import('./drone-memory');
  const steady = droneSymptoms(createDroneMemory());
  for (let s = 0; s < 50; s++) {
    assert.equal(steady.gapFactor(s), 1);
    assert.deepEqual(steady.sway(s), { x: 0, z: 0 });
  }
  let m = createDroneMemory();
  for (let i = 0; i < 4; i++) m = noteCatalyst(m, { kind: 'hurt', damage: 30 }, 100 + i, 1);
  const shaken = droneSymptoms(m);
  const amp = shaken.amplitude.flight;
  assert.ok(amp > 0, String(amp));
  const sways = Array.from({ length: 200 }, (_, s) => shaken.sway(s));
  assert.ok(sways.every((v) => Math.abs(v.x) <= SYMPTOM_SWAY_M * amp + 1e-9 && Math.abs(v.z) <= SYMPTOM_SWAY_M * amp + 1e-9));
  assert.ok(sways.some((v) => Math.abs(v.x) > SYMPTOM_SWAY_M * amp / 2), 'it visibly sways');
  assert.equal(shaken.gapFactor(7), 1, 'the hits were in flight, so the fire rhythm stays even');
  assert.deepEqual(Array.from({ length: 20 }, (_, s) => shaken.sway(s)), sways.slice(0, 20), 'the same sway every time');
  let calmer = m;
  for (let n = 0; n < 3; n++) calmer = dreamNow(calmer, 400 + n).memory;
  assert.ok(droneSymptoms(calmer).amplitude.flight < amp, 'dreaming steadies it');
});

test("a session is the drone's night (Plan 57): it knows what it has not dreamed over yet, and a save keeps when it last dreamed", () => {
  let m = createDroneMemory();
  assert.equal(hasUndreamt(m), false, 'nothing to dream over yet');
  m = noteCatalyst(m, { kind: 'hurt', damage: 20 }, 500, 3);
  assert.equal(hasUndreamt(m), true, 'a hit since its last dream');
  const d = dreamNow(m, 600);
  assert.equal(d.memory.dreamedAt, 600);
  assert.equal(hasUndreamt(d.memory), false, 'dreamed over');
  const back = loadDroneMemory(saveDroneMemory(d.memory))!;
  assert.equal(back.dreamedAt, 600);
  assert.equal(hasUndreamt(back), false);
  assert.equal(hasUndreamt(noteCatalyst(back, { kind: 'contact', distance: 9 }, 700, 3)), true, 'a new fight after it');
  // a save from before dreamedAt existed loads, and counts everything as undreamt
  assert.equal(loadDroneMemory(saveDroneMemory(m))!.dreamedAt, undefined);
});

test('Plan 56 W6e: the player is a Wanderer anchor (`wan.from = "player"`): steady play lends 0.3 calm to the drone, panic-spraying lends 0', async () => {
  const { noteCatalystWithPlayer } = await import('./drone-memory');
  const m = createDroneMemory();
  // Steady play: player Wanderer stays balanced and lends 0.3 calm to the drone
  const steadyHit = noteCatalystWithPlayer(m, { kind: 'hurt', damage: 20 }, 100, 2);
  assert.equal(steadyHit.playerMem.wan?.from, 'player');
  assert.equal(steadyHit.steady, true);
  assert.equal(steadyHit.calm, 0.3);

  // Panic-spraying: player Wanderer takes root-reactivity / solar-anxiety, drops below 0.9 balance, lends 0 calm
  const panicHit = noteCatalystWithPlayer(m, { kind: 'hurt', damage: 20 }, 100, 2, steadyHit.playerMem, { panicSpray: true });
  assert.equal(panicHit.steady, false);
  assert.equal(panicHit.calm, 0);
  assert.ok(
    (steadyHit.memory.presets.flight.charge[ROOT] ?? 0) < (panicHit.memory.presets.flight.charge[ROOT] ?? 0),
    'the steady player anchor softened the hit on the drone compared to a panic-spraying player',
  );
});

