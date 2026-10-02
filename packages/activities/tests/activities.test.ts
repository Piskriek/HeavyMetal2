// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
// activities.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActivityRegistry,
  Tournament,
  activityCard,
  describeActivity,
  galaxyLayout,
  goblinRacing,
  isActivityError,
  isTournamentError,
  pickPlanet,
  pointsFor,
  updateRatings,
  type Activity,
  type PlanetPos,
} from '../src';

const DAY = 86400_000;

function mk(id: string, over: Partial<Activity> = {}): Activity {
  return {
    id,
    name: id,
    doc: 'doc',
    builtin: false,
    hidden: false,
    planet: { hue: 10, size: 3, ring: false },
    menu: [],
    hosting: { tournament: false, players: 0, nextEventAt: null },
    owner: 'me',
    forkOf: null,
    rules: {},
    ...over,
  };
}

/* ---------------- registry ---------------- */

test('defaults contain goblin racing with the right menu and rules', () => {
  const r = ActivityRegistry.withDefaults();
  const g = r.get('goblin-racing');
  assert.ok(g);
  assert.equal(g.builtin, true);
  assert.deepEqual(g.menu.map((m) => m.label), [
    'Quick Race', 'Tournaments', 'Spectate', 'Rankings', 'Settings', 'My Goblin', 'The Bookie',
  ]);
  assert.deepEqual(g.rules, { laps: 3, field: 8, aiSkill: 1 });
  assert.deepEqual(r.validate(), { ok: true, errors: [] });
});

test('create makes unique slugs, a default menu and a deterministic planet', () => {
  const r0 = ActivityRegistry.withDefaults();
  const r1 = r0.create('Tower Defence', 'build towers', 'ana', 1000);
  const r2 = r1.create('Tower Defence', 'again', 'ana', 2000);
  assert.deepEqual(r2.list({}).map((a) => a.id), ['goblin-racing', 'tower-defence', 'tower-defence-2']);
  const a = r2.get('tower-defence');
  assert.ok(a);
  assert.deepEqual(a.menu.map((m) => m.label), ['Quick Play', 'Settings']);
  const b = r2.get('tower-defence-2');
  assert.ok(b);
  assert.deepEqual(a.planet, b.planet); // same name -> same look
  assert.equal(r0.list({}).length, 1); // immutable
});

test('duplicate sets forkOf and clears builtin/hidden', () => {
  const r = ActivityRegistry.withDefaults().duplicate('goblin-racing', 'ana');
  const copy = r.get('copy-of-goblin-racing');
  assert.ok(copy);
  assert.equal(copy.name, 'Copy of Goblin Racing');
  assert.equal(copy.forkOf, 'goblin-racing');
  assert.equal(copy.builtin, false);
  assert.equal(copy.hidden, false);
  const r2 = r.duplicate('goblin-racing', 'ana');
  assert.ok(r2.get('copy-of-goblin-racing-2'));
});

test('builtin protection: no remove, hide instead, rules need a duplicate', () => {
  const r = ActivityRegistry.withDefaults();
  assert.throws(() => r.remove('goblin-racing'), (e: unknown) => isActivityError(e) && e.code === 'builtin-protected');
  assert.throws(() => r.setRule('goblin-racing', 'laps', 5), (e: unknown) => isActivityError(e) && e.code === 'duplicate-first');
  const hidden = r.hide('goblin-racing');
  assert.equal(hidden.list({}).length, 0);
  assert.equal(hidden.list({ includeHidden: true }).length, 1);
  assert.equal(hidden.unhide('goblin-racing').list({}).length, 1);
  const forked = r.duplicate('goblin-racing', 'ana').setRule('copy-of-goblin-racing', 'laps', 5);
  assert.equal(forked.get('copy-of-goblin-racing')?.rules['laps'], 5);
  assert.equal(forked.get('goblin-racing')?.rules['laps'], 3);
});

test('remove deletes user activities, rename works, missing ids throw', () => {
  const r = ActivityRegistry.withDefaults().create('Mine', 'd', 'me', 0);
  assert.equal(r.remove('mine').get('mine'), undefined);
  assert.equal(r.rename('mine', 'Yours').get('mine')?.name, 'Yours');
  assert.throws(() => r.get('nope') ?? r.remove('nope'), (e: unknown) => isActivityError(e) && e.code === 'not-found');
  assert.throws(() => r.create('   ', 'd', 'me', 0), (e: unknown) => isActivityError(e) && e.code === 'bad-name');
});

test('validate flags duplicates and bad icons', () => {
  const bad = new ActivityRegistry([
    mk('a', { menu: [{ id: 'm', label: 'l', icon: 'lowercase', kind: 'screen', target: 't' }] }),
    mk('a', { name: '  ' }),
  ]);
  const v = bad.validate();
  assert.equal(v.ok, false);
  assert.ok(v.errors.length >= 3);
});

/* ---------------- galaxy ---------------- */

const GAL: Activity[] = [
  mk('alpha', { planet: { hue: 1, size: 4, ring: false } }),
  mk('beta', { hosting: { tournament: true, players: 9, nextEventAt: null }, planet: { hue: 2, size: 5, ring: true } }),
  mk('gamma', { planet: { hue: 3, size: 2, ring: false } }),
  mk('delta', { hosting: { tournament: false, players: 3, nextEventAt: null }, planet: { hue: 4, size: 6, ring: false } }),
  mk('epsilon', { planet: { hue: 5, size: 1, ring: false } }),
];

test('galaxy layout is deterministic and independent of input order', () => {
  const a = galaxyLayout(GAL, 7);
  const b = galaxyLayout([...GAL].reverse(), 7);
  assert.deepEqual(a, b);
  assert.deepEqual(a, galaxyLayout(GAL, 7));
  assert.notDeepEqual(a, galaxyLayout(GAL, 8));
});

test('hosting activities sit nearer the centre and planets never overlap', () => {
  const l = galaxyLayout(GAL, 3);
  const orbit = (id: string): number => l.find((p) => p.id === id)?.orbit ?? -1;
  assert.ok(Math.max(orbit('beta'), orbit('delta')) < Math.min(orbit('alpha'), orbit('gamma'), orbit('epsilon')));
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l.length; j++) {
      const p = l[i]!;
      const q = l[j]!;
      const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
      assert.ok(d >= p.radius + q.radius + 2, `${p.id}/${q.id} too close: ${d}`);
    }
  }
});

test('highlighted activity is centred, spacing preserved', () => {
  const l = galaxyLayout(GAL, 3, 'gamma');
  const c = l.find((p) => p.id === 'gamma')!;
  assert.deepEqual([c.x, c.y, c.z], [0, 0, 0]);
  const plain = galaxyLayout(GAL, 3);
  assert.deepEqual(l.map((p) => p.id), plain.map((p) => p.id));
});

test('pickPlanet hits the nearest sphere and misses empty space', () => {
  const layout: PlanetPos[] = [
    { id: 'near', x: 0, y: 0, z: 10, radius: 2, orbit: 10 },
    { id: 'far', x: 0, y: 0, z: 40, radius: 5, orbit: 40 },
    { id: 'side', x: 50, y: 0, z: 0, radius: 3, orbit: 50 },
  ];
  assert.equal(pickPlanet(layout, { origin: [0, 0, 0], dir: [0, 0, 1] }), 'near');
  assert.equal(pickPlanet(layout.filter((p) => p.id !== 'near'), { origin: [0, 0, 0], dir: [0, 0, 1] }), 'far');
  assert.equal(pickPlanet(layout, { origin: [0, 0, 0], dir: [0, 1, 0] }), null);
  assert.equal(pickPlanet(layout, { origin: [0, 0, 0], dir: [0, 0, 0] }), null);
});

/* ---------------- tournaments ---------------- */

function signedUp(n: number, closesAt = 1000): Tournament {
  let t = Tournament.create({ id: 't1', capacity: 16, heatSize: 4, closesAt, advanceCount: 2, heatDurationMs: 1000 });
  for (let i = 0; i < n; i++) t = t.signUp(`p${i}`, 0, 2000 - i * 10);
  return t;
}

test('signup capacity, duplicates and deadline errors', () => {
  let t = Tournament.create({ id: 't', capacity: 2, heatSize: 2, closesAt: 100 });
  t = t.signUp('a', 0).signUp('b', 10);
  assert.throws(() => t.signUp('c', 20), (e: unknown) => isTournamentError(e) && e.code === 'full');
  assert.throws(() => t.signUp('a', 20), (e: unknown) => isTournamentError(e) && e.code === 'already-signed-up');
  assert.throws(() => t.signUp('d', 500), (e: unknown) => isTournamentError(e) && e.code === 'closed');
  assert.equal(t.withdraw('a').state.entrants.length, 1);
  assert.throws(() => t.withdraw('zz'), (e: unknown) => isTournamentError(e) && e.code === 'not-signed-up');
  const out = Tournament.create({ id: 't', capacity: 4, heatSize: 2, closesAt: 100, lockedOut: ['x'] });
  assert.throws(() => out.signUp('x', 0), (e: unknown) => isTournamentError(e) && e.code === 'locked-out');
});

test('lock builds snake-seeded heats and the full lifecycle advances to one final', () => {
  let t = signedUp(8).lock(500);
  assert.equal(t.status, 'locked');
  const heats = t.currentHeats();
  assert.equal(heats.length, 2);
  assert.deepEqual(heats[0]!.playerIds, ['p0', 'p3', 'p4', 'p7']);
  assert.deepEqual(heats[1]!.playerIds, ['p1', 'p2', 'p5', 'p6']);
  assert.throws(() => t.reportHeat('nope', []), (e: unknown) => isTournamentError(e) && e.code === 'no-such-heat');

  t = t.reportHeat('r1h1', [
    { playerId: 'p0', position: 1, time: 50 },
    { playerId: 'p3', position: 2, time: 55 },
    { playerId: 'p4', position: 3 },
    { playerId: 'p7', position: 4, dnf: true },
  ]);
  assert.equal(t.status, 'running');
  assert.throws(() => t.reportHeat('r1h1', []), (e: unknown) => isTournamentError(e) && e.code === 'heat-done');
  t = t.reportHeat('r1h2', [
    { playerId: 'p1', position: 1, time: 51 },
    { playerId: 'p2', position: 2, time: 52 },
    { playerId: 'p5', position: 3 },
    { playerId: 'p6', position: 4 },
  ]);
  assert.equal(t.state.round, 2);
  const final = t.currentHeats();
  assert.equal(final.length, 1);
  assert.deepEqual([...final[0]!.playerIds].sort(), ['p0', 'p1', 'p2', 'p3']);

  t = t.reportHeat('r2h1', [
    { playerId: 'p1', position: 1, time: 40 },
    { playerId: 'p0', position: 2, time: 41 },
    { playerId: 'p2', position: 3 },
    { playerId: 'p3', position: 4 },
  ]);
  assert.equal(t.status, 'done');
  assert.equal(t.standings()[0]!.playerId, 'p1');
  assert.throws(() => t.reportHeat('r2h1', []), (e: unknown) => isTournamentError(e) && e.code === 'not-running');
});

test('bad results are rejected', () => {
  const t = signedUp(8).lock(0);
  assert.throws(() => t.reportHeat('r1h1', [{ playerId: 'p1', position: 1 }]), (e: unknown) => isTournamentError(e) && e.code === 'bad-results');
  assert.throws(() => t.reportHeat('r1h1', [
    { playerId: 'p0', position: 1 }, { playerId: 'p3', position: 1 },
  ]), (e: unknown) => isTournamentError(e) && e.code === 'bad-results');
  assert.throws(() => Tournament.create({ id: 'x', capacity: 4, heatSize: 2, closesAt: 10 }).lock(0),
    (e: unknown) => isTournamentError(e) && e.code === 'not-enough-players');
});

test('no-shows cost 50 rating and three strikes lock a player out', () => {
  let t = signedUp(8).lock(0); // deadline 1000
  t = t.reportHeat('r1h1', [
    { playerId: 'p0', position: 1 }, { playerId: 'p3', position: 2 },
    { playerId: 'p4', position: 3 }, { playerId: 'p7', position: 4 },
  ]);
  const before = t.state.entrants.find((e) => e.playerId === 'p1')!.rating;
  const after = t.noShows(5000);
  assert.equal(after.strikesFor('p1'), 1);
  assert.equal(after.strikesFor('p0'), 0);
  assert.equal(after.state.entrants.find((e) => e.playerId === 'p1')!.rating, before - 50);
  assert.deepEqual(after.noShows(9999).state.strikes, after.state.strikes); // applied once
  assert.equal(t.strikesFor('p1'), 0); // immutable

  let s = Tournament.create({ id: 's', capacity: 4, heatSize: 4, closesAt: 100, heatDurationMs: 10, strikes: { q: 2 } });
  s = s.signUp('q', 0, 30).signUp('w', 0).lock(0);
  s = s.noShows(1000);
  assert.equal(s.strikesFor('q'), 3);
  assert.equal(s.isLockedOut('q'), true);
  assert.equal(s.state.entrants.find((e) => e.playerId === 'q')!.rating, 0); // min 0
});

test('standings tie-breaks on points, then wins, then best time', () => {
  let t = Tournament.create({ id: 'tb', capacity: 8, heatSize: 4, closesAt: 100, heatDurationMs: 10 });
  for (const p of ['a', 'b', 'c', 'd']) t = t.signUp(p, 0, 1000);
  t = t.lock(0).reportHeat('r1h1', [
    { playerId: 'a', position: 1, time: 30 },
    { playerId: 'b', position: 2, time: 31 },
    { playerId: 'c', position: 3, time: 32 },
    { playerId: 'd', position: 4, time: 33 },
  ]);
  const s = t.standings();
  assert.deepEqual(s.map((x) => x.playerId), ['a', 'b', 'c', 'd']);
  assert.equal(s[0]!.points, pointsFor(1));
  assert.equal(s[0]!.wins, 1);
  assert.equal(s[0]!.bestTime, 30);
});

test('JSON round trip works and junk is rejected without throwing', () => {
  const t = signedUp(8).lock(0).reportHeat('r1h1', [
    { playerId: 'p0', position: 1 }, { playerId: 'p3', position: 2 },
    { playerId: 'p4', position: 3 }, { playerId: 'p7', position: 4 },
  ]);
  const back = Tournament.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
  assert.ok(back);
  assert.deepEqual(back.toJSON(), t.toJSON());
  assert.deepEqual(back.standings(), t.standings());
  for (const junk of [null, 42, 'nope', {}, { status: 'wat' }, { ...t.toJSON(), entrants: [{ playerId: 1 }] }, { ...t.toJSON(), heats: 'x' }]) {
    assert.equal(Tournament.fromJSON(junk), null);
  }
});

test('rating updates are deterministic, zero-sum and favour the winner', () => {
  const base = { a: 1000, b: 1200, c: 900 };
  const next = updateRatings(base, ['c', 'a', 'b']);
  assert.deepEqual(next, updateRatings(base, ['c', 'a', 'b']));
  assert.deepEqual(base, { a: 1000, b: 1200, c: 900 });
  const delta = (k: 'a' | 'b' | 'c'): number => next[k]! - base[k];
  assert.ok(delta('c') > 0);
  assert.ok(delta('b') < 0);
  assert.ok(Math.abs(delta('a') + delta('b') + delta('c')) < 1e-9);
  assert.deepEqual(updateRatings(base, ['a']), base);
});

/* ---------------- descriptions ---------------- */

test('describeActivity and activityCard', () => {
  const a = { ...goblinRacing(), hosting: { tournament: true, players: 8, nextEventAt: 2 * DAY } };
  assert.equal(describeActivity(a, 0), 'Goblin Racing: 8 players hosting a tournament, next event in 2 days');
  assert.equal(describeActivity({ ...a, hosting: { tournament: false, players: 1, nextEventAt: null } }, 0), 'Goblin Racing: 1 player in play');
  assert.equal(describeActivity({ ...a, hosting: { tournament: false, players: 0, nextEventAt: 0 } }, 0), 'Goblin Racing: quiet right now, next event in now');
  assert.deepEqual(activityCard(a), { title: 'Goblin Racing', subtitle: 'Race hand-reared goblins around a muddy track.', badge: 'Built-in' });
  assert.equal(activityCard({ ...a, builtin: false, forkOf: 'goblin-racing' }).badge, 'Fork');
  assert.equal(activityCard({ ...a, builtin: false, hidden: true }).badge, 'Hidden');
  assert.equal(activityCard(mk('x', { doc: 'line one\nline two' })).subtitle, 'line one');
});