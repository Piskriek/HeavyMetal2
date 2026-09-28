/**
 * QUICK RACES: events of your own. An event's rounds become the session's rounds (each on its island
 * track, to its finish), a reload keeps them (the save validator accepts an event's own round list and
 * drops one that no longer matches), and My Events stores, replaces and deletes them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, eventTitle, sessionConfig, sessionTrackId, type RaceSetup } from '../src/game/session';
import { recoverSession, sanitizeSetup } from '../src/game/save';
import {
  EVENTS_KEY, MAX_EVENT_ROUNDS, deleteEvent, eventRef, eventSummary, listEvents, sanitizeEvent, saveEvent, type CustomEvent,
} from '../src/game/custom-events';
import { ISLAND_COURSE } from '../src/game/course-archive';
import { DEFAULT_LOADOUT } from '../src/game/loadouts';

const event = (rounds = 3): CustomEvent => ({
  id: 'ev-1', name: 'Serpent Sprint', fieldSize: 4, difficulty: 'veteran', createdAt: 1, updatedAt: 1,
  rounds: Array.from({ length: rounds }, (_, i) => ({ trackId: i % 2 ? 'track-b' : 'serpentine', trackName: i % 2 ? 'Track B' : 'Serpentine Isle', finish: i === 1 ? null : { x: 10000 + i * 5000, name: `Line ${i + 1}` } })),
});

const setupFor = (e: CustomEvent): RaceSetup => ({ mode: 'quick', course: ISLAND_COURSE, loadout: { ...DEFAULT_LOADOUT }, difficulty: e.difficulty, customPhysics: true, fieldSize: e.fieldSize, finish: { x: 1, name: 'stale' }, event: eventRef(e) });

test('an event session: one island round per event round, each to its own finish on its own track', () => {
  const s = createSession(setupFor(event()));
  assert.equal(s.setup.mode, 'tournament', 'more than one round is a tournament');
  assert.equal(s.setup.customPhysics, false, 'events race the fixed presets');
  assert.equal(s.setup.finish, undefined, 'a Quick Race finish left in the draft is dropped');
  assert.deepEqual(s.rounds, [ISLAND_COURSE, ISLAND_COURSE, ISLAND_COURSE]);
  assert.equal(sessionConfig(s).finishX, 10000);
  assert.equal(sessionTrackId(s), 'serpentine');
  const r2 = { ...s, round: 1 };
  assert.equal(sessionConfig(r2).finishX, undefined, 'round 2: down to the sea');
  assert.equal(sessionTrackId(r2), 'track-b');
  assert.equal(sessionConfig({ ...s, round: 2 }).finishX, 20000);
  assert.equal(eventTitle(s), 'Serpent Sprint');
  const one = createSession(setupFor(event(1)));
  assert.equal(one.setup.mode, 'quick', 'one round races as a Quick Race');
  assert.equal(sessionConfig(one).finishX, 10000);
});

test('a plain session has no event track; the cup and the quick race keep their titles', () => {
  const s = createSession({ mode: 'tournament', course: ISLAND_COURSE, loadout: { ...DEFAULT_LOADOUT }, difficulty: 'racer', customPhysics: false, fieldSize: 4 });
  assert.equal(sessionTrackId(s), null);
  assert.equal(eventTitle(s), 'The Scrapdome Cup');
});

test('reload: an event keeps its own round list (5 rounds); a mismatched event is dropped and repaired', () => {
  const s = createSession(setupFor(event(5)));
  const restored = recoverSession(JSON.parse(JSON.stringify(s)), 'grid');
  assert.ok(restored);
  assert.equal(restored!.session.rounds.length, 5, 'not reset to the three-round cup');
  assert.equal(restored!.session.setup.event?.rounds.length, 5);
  assert.equal(restored!.notices.length, 0, 'no repair notice');
  // The same event, but the saved round list lost two rounds: the cup order is restored, the event dropped.
  const broken = recoverSession({ ...JSON.parse(JSON.stringify(s)), rounds: [ISLAND_COURSE, ISLAND_COURSE, ISLAND_COURSE] }, 'grid');
  assert.ok(broken);
  assert.equal(broken!.session.setup.event, undefined);
  assert.equal(broken!.session.rounds.length, 3);
});

test('sanitize: events with no rounds, too many, or junk are refused; names are tidied', () => {
  assert.equal(sanitizeEvent({ ...event(), rounds: [] }), null);
  assert.equal(sanitizeEvent({ ...event(MAX_EVENT_ROUNDS + 1) }), null);
  assert.equal(sanitizeEvent({ ...event(), rounds: [{ trackId: 5 }] }), null);
  assert.equal(sanitizeEvent({ ...event(), name: '   ' })!.name, 'My Event');
  assert.equal(sanitizeEvent({ ...event(), fieldSize: 7 })!.fieldSize, 4);
  assert.equal(sanitizeSetup({ mode: 'quick', event: { id: 'x', name: 'y', rounds: [] } }, ISLAND_COURSE)?.event, undefined);
  assert.equal(eventSummary(event()), '3 rounds · 4 racers · Veteran');
});

test('My Events: save (newest first, replace by id), list, delete', () => {
  const data = new Map<string, string>();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  assert.deepEqual(listEvents(store), []);
  assert.ok(saveEvent(event(2), store, 10).ok);
  assert.ok(saveEvent({ ...event(1), id: 'ev-2', name: 'Solo' }, store, 20).ok);
  assert.ok(saveEvent({ ...event(3), name: 'Renamed' }, store, 30).ok);
  const list = listEvents(store);
  assert.deepEqual(list.map((e) => e.name), ['Renamed', 'Solo']);
  assert.equal(list[0]!.rounds.length, 3);
  assert.equal(list[0]!.updatedAt, 30);
  assert.equal(saveEvent({ ...event(), rounds: [] }, store).ok, false);
  assert.ok(deleteEvent('ev-1', store));
  assert.deepEqual(listEvents(store).map((e) => e.id), ['ev-2']);
  data.set(EVENTS_KEY, 'junk');
  assert.deepEqual(listEvents(store), []);
});
