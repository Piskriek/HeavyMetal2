import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES,
  buildForest,
  changelog,
  classifyChange,
  diffPresets,
  evolve,
  lineage,
  tally,
  type Canon,
  type EvolveRules,
  type PresetRecord,
  type PresetRef,
  type TreeNode,
  type UsageEvent,
} from '../src';

// ------------------------------------------------------------ helpers

const TODAY = 100;
const R: EvolveRules = { ...DEFAULT_RULES, today: TODAY };

function rec(
  id: string,
  hash: string,
  forkOf?: PresetRef,
  params: PresetRecord['params'] = {},
): PresetRecord {
  const r: PresetRecord = { id, hash, kind: 'items', author: `author-${id}`, params };
  if (forkOf) r.forkOf = forkOf;
  return r;
}

function ref(id: string, hash: string = `h-${id}`): PresetRef {
  return { id, hash };
}

function ev(player: string, slot: string, preset: PresetRef, weight: number, at = TODAY): UsageEvent {
  return { player, slot, preset, weight, at };
}

/** n distinct players (prefix1..prefixN), each playing `weight` of `preset` in `slot`. */
function crowd(prefix: string, n: number, slot: string, preset: PresetRef, weight: number, at = TODAY): UsageEvent[] {
  const out: UsageEvent[] = [];
  for (let i = 1; i <= n; i++) out.push(ev(`${prefix}${i}`, slot, preset, weight, at));
  return out;
}

function shape(n: TreeNode): unknown {
  return { id: n.id, depth: n.depth, children: n.children.map(shape) };
}

function shuffled<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const STD = ref('std');
const ROCKET = ref('rocket');
const canon3: Canon = { version: 3, slots: { items: STD, track: ref('t1') } };

// ------------------------------------------------------------ forest

const forestRecords: PresetRecord[] = [
  rec('c', 'hc', ref('b', 'hb')),
  rec('a', 'ha'),
  rec('b', 'hb', ref('a', 'ha')),
  rec('o', 'ho', ref('missing', 'hm')), // parent does not exist
  rec('d', 'hd', ref('a', 'WRONG')), // parent id exists but hash does not match
  rec('y', 'hy', ref('x', 'hx')), // cycle x <-> y
  rec('x', 'hx', ref('y', 'hy')),
];

test('buildForest: fork chain, orphans and cycle', () => {
  const { roots, orphans } = buildForest(forestRecords);
  assert.deepEqual(orphans, ['d', 'o']);
  assert.deepEqual(
    roots.map((r) => r.id),
    ['a', 'd', 'o', 'x'],
  );
  assert.deepEqual(shape(roots[0]!), {
    id: 'a',
    depth: 0,
    children: [{ id: 'b', depth: 1, children: [{ id: 'c', depth: 2, children: [] }] }],
  });
  // the cycle is broken at its smallest member, nothing hangs
  assert.deepEqual(shape(roots[3]!), {
    id: 'x',
    depth: 0,
    children: [{ id: 'y', depth: 1, children: [] }],
  });
  assert.equal(roots[0]!.author, 'author-a');
  assert.equal(roots[0]!.hash, 'ha');
});

test('buildForest: deterministic regardless of input order and handles self-fork', () => {
  const withSelf = [...forestRecords, rec('s', 'hs', ref('s', 'hs'))];
  const one = buildForest(withSelf);
  const two = buildForest(shuffled(withSelf, 7));
  assert.deepEqual(one, two);
  assert.ok(one.roots.some((r) => r.id === 's'));
  assert.equal(buildForest([]).roots.length, 0);
});

// ------------------------------------------------------------ lineage

test('lineage: root ancestor down to id', () => {
  assert.deepEqual(
    lineage(forestRecords, 'c').map((r) => r.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    lineage(forestRecords, 'a').map((r) => r.id),
    ['a'],
  );
  assert.deepEqual(
    lineage(forestRecords, 'o').map((r) => r.id),
    ['o'],
  );
});

test('lineage: unknown id is empty and cycles terminate', () => {
  assert.deepEqual(lineage(forestRecords, 'nope'), []);
  assert.deepEqual(
    lineage(forestRecords, 'y').map((r) => r.id),
    ['x', 'y'],
  );
});

// ------------------------------------------------------------ diff

test('diffPresets: added, removed and changed params sorted by key', () => {
  const a = rec('p', 'h1', undefined, { speed: 1, color: 'red', gone: true });
  const b = rec('p', 'h2', undefined, { speed: 2, color: 'red', added: null });
  assert.deepEqual(diffPresets(a, b), [
    { key: 'added', from: undefined, to: null },
    { key: 'gone', from: true, to: undefined },
    { key: 'speed', from: 1, to: 2 },
  ]);
  assert.deepEqual(diffPresets(a, a), []);
});

// ------------------------------------------------------------ classify

test('classifyChange: none, cosmetic, gameplay', () => {
  const gameplay = new Set(['speed', 'laps']);
  assert.equal(classifyChange([], gameplay), 'none');
  assert.equal(classifyChange([{ key: 'color' }], gameplay), 'cosmetic');
  assert.equal(classifyChange([{ key: 'color' }, { key: 'laps' }], gameplay), 'gameplay');
});

// ------------------------------------------------------------ tally

test('tally: a player with weight 100 in one slot counts as 20', () => {
  const t = tally([ev('p1', 'items', ROCKET, 100)], R);
  assert.deepEqual(t, { items: [{ preset: ROCKET, weight: 20, players: 1 }] });
});

test('tally: cap applies to the per-slot total, split proportionally across presets', () => {
  const t = tally([ev('p1', 'items', ROCKET, 60), ev('p1', 'items', STD, 60), ev('p1', 'track', ref('t1'), 60)], R);
  assert.equal(t.items!.length, 2);
  assert.equal(t.items![0]!.weight, 10);
  assert.equal(t.items![1]!.weight, 10);
  assert.equal(t.track![0]!.weight, 20); // cap is per slot
});

test('tally: below the cap weight is untouched', () => {
  const t = tally([ev('p1', 'items', ROCKET, 7), ev('p1', 'items', ROCKET, 8)], R);
  assert.equal(t.items![0]!.weight, 15);
  assert.equal(t.items![0]!.players, 1);
});

test('tally: an event one half-life old counts half, two count a quarter', () => {
  const t = tally(
    [ev('p1', 'items', ROCKET, 10, TODAY - 14), ev('p2', 'items', STD, 10, TODAY - 28)],
    R,
  );
  assert.equal(t.items![0]!.preset.id, 'rocket');
  assert.equal(t.items![0]!.weight, 5);
  assert.equal(t.items![1]!.weight, 2.5);
});

test('tally: cap is applied before decay', () => {
  const t = tally([ev('p1', 'items', ROCKET, 100, TODAY - 14)], R);
  assert.equal(t.items![0]!.weight, 10);
});

test('tally: zero, negative and future events are ignored', () => {
  const t = tally(
    [
      ev('p1', 'items', ROCKET, 0),
      ev('p2', 'items', ROCKET, -5),
      ev('p3', 'items', ROCKET, 5, TODAY + 1),
      ev('p4', 'items', STD, 3),
    ],
    R,
  );
  assert.deepEqual(t, { items: [{ preset: STD, weight: 3, players: 1 }] });
});

test('tally: sorted by weight desc then hash asc, distinct players counted', () => {
  const a = ref('a', 'h2');
  const b = ref('b', 'h1');
  const c = ref('c', 'h3');
  const t = tally(
    [
      ev('p1', 'items', a, 5),
      ev('p2', 'items', a, 5),
      ev('p3', 'items', b, 10),
      ev('p4', 'items', c, 12),
    ],
    R,
  );
  assert.deepEqual(
    t.items!.map((e) => [e.preset.hash, e.weight, e.players]),
    [
      ['h3', 12, 1],
      ['h1', 10, 1],
      ['h2', 10, 2],
    ],
  );
});

// ------------------------------------------------------------ evolve

test('evolve: a clear winner replaces the canon preset', () => {
  const events = [...crowd('r', 6, 'items', ROCKET, 10), ...crowd('s', 2, 'items', STD, 10)];
  const res = evolve(canon3, events, R);
  assert.equal(res.next.version, 4);
  assert.deepEqual(res.next.slots.items, ROCKET);
  assert.deepEqual(res.next.slots.track, ref('t1'));
  assert.deepEqual(res.changes, [{ slot: 'items', from: STD, to: ROCKET, share: 0.75, players: 6 }]);
  assert.deepEqual(res.kept, ['track']);
  assert.ok(res.notes.includes("Slot 'items': 'rocket' overtook 'std' with 75% of play from 6 players."));
  assert.deepEqual(canon3.slots.items, STD); // input not mutated
  assert.equal(canon3.version, 3);
});

test('evolve: below minPlayers nothing changes and version stays', () => {
  const events = crowd('r', 4, 'items', ROCKET, 10);
  const res = evolve(canon3, events, R);
  assert.deepEqual(res.next, canon3);
  assert.equal(res.next.version, 3);
  assert.deepEqual(res.changes, []);
  assert.deepEqual(res.kept, ['items', 'track']);
  assert.equal(res.notes.length, 1);
  assert.match(res.notes[0]!, /at least 5 players/);
});

test('evolve: minShare blocks a plurality that is too small', () => {
  const events = [
    ...crowd('a', 5, 'items', ref('a'), 10),
    ...crowd('b', 5, 'items', ref('b'), 9),
    ...crowd('c', 5, 'items', ref('c'), 9),
    ...crowd('d', 5, 'items', ref('d'), 9),
  ];
  // 50 of 187 = 27% < 40%
  const res = evolve(canon3, events, R);
  assert.equal(res.next.version, 3);
  assert.deepEqual(res.next.slots.items, STD);
});

test('evolve: challengerMargin protects the incumbent', () => {
  const blocked = [...crowd('s', 6, 'items', STD, 10), ...crowd('r', 6, 'items', ROCKET, 11)];
  // 66 < 1.15 * 60 = 69
  const res1 = evolve(canon3, blocked, R);
  assert.equal(res1.next.version, 3);
  assert.deepEqual(res1.next.slots.items, STD);
  assert.deepEqual(res1.changes, []);

  const enough = [...crowd('s', 6, 'items', STD, 10), ...crowd('r', 6, 'items', ROCKET, 12)];
  // 72 >= 69
  const res2 = evolve(canon3, enough, R);
  assert.equal(res2.next.version, 4);
  assert.deepEqual(res2.next.slots.items, ROCKET);
});

test('evolve: an incumbent with no usage can be replaced without margin', () => {
  const res = evolve(canon3, crowd('r', 5, 'items', ROCKET, 10), R);
  assert.deepEqual(res.next.slots.items, ROCKET);
  assert.equal(res.changes[0]!.share, 1);
});

test('evolve: decay lets a fresh challenger beat stale incumbent usage', () => {
  const events = [...crowd('s', 6, 'items', STD, 10, TODAY - 28), ...crowd('r', 5, 'items', ROCKET, 10)];
  // std: 6 * 2.5 = 15; rocket 50
  const res = evolve(canon3, events, R);
  assert.deepEqual(res.next.slots.items, ROCKET);
});

test('evolve: a single spamming player cannot win', () => {
  const events = [ev('spam', 'items', ROCKET, 1000), ...crowd('s', 5, 'items', STD, 10)];
  const res = evolve(canon3, events, R);
  assert.equal(res.next.version, 3);
  assert.deepEqual(res.next.slots.items, STD);

  // even with minPlayers lowered, the cap (20) keeps spam below 5 real players (50)
  const lax = evolve(canon3, events, { ...R, minPlayers: 1 });
  assert.deepEqual(lax.next.slots.items, STD);
  assert.deepEqual(lax.changes, []);
});

test('evolve: deterministic with shuffled input order', () => {
  const events: UsageEvent[] = [];
  for (let i = 1; i <= 12; i++) {
    events.push(ev(`p${i}`, 'items', ROCKET, 3.3 + i * 0.7, TODAY - i));
    events.push(ev(`p${i}`, 'items', STD, 1.1 * i, TODAY - 2 * i));
    events.push(ev(`p${i}`, 'track', ref('t2'), 0.37 * i + 5, TODAY - 3 * i));
    events.push(ev(`q${i}`, 'looks', ref('neon'), 2.9 + i / 3, TODAY - (i % 5)));
  }
  const base = evolve(canon3, events, R);
  const baseTally = tally(events, R);
  for (const seed of [1, 2, 3, 4, 5]) {
    const sh = shuffled(events, seed);
    assert.deepEqual(evolve(canon3, sh, R), base);
    assert.deepEqual(tally(sh, R), baseTally);
  }
  assert.deepEqual(evolve(canon3, [...events].reverse(), R), base);
});

test('evolve: ties are broken by hash ascending', () => {
  const alpha = ref('alpha', 'h2');
  const beta = ref('beta', 'h1');
  const events = [...crowd('a', 5, 'items', alpha, 10), ...crowd('b', 5, 'items', beta, 10)];
  const res = evolve(canon3, events, R);
  assert.deepEqual(res.next.slots.items, beta);
  assert.equal(res.changes[0]!.share, 0.5);
  assert.deepEqual(evolve(canon3, shuffled(events, 9), R), res);
});

test('evolve: a tie with the incumbent keeps the incumbent', () => {
  const low = ref('low', 'a-first'); // sorts before the incumbent's hash
  const inc = ref('inc', 'z-last');
  const canon: Canon = { version: 1, slots: { items: inc } };
  const events = [...crowd('a', 5, 'items', low, 10), ...crowd('b', 5, 'items', inc, 10)];
  const res = evolve(canon, events, R);
  assert.equal(res.next.version, 1);
  assert.deepEqual(res.next.slots.items, inc);
});

test('evolve: slots that only appear in the tally are added', () => {
  const neon = ref('neon');
  const res = evolve(canon3, crowd('p', 6, 'looks', neon, 10), R);
  assert.equal(res.next.version, 4);
  assert.deepEqual(res.next.slots.looks, neon);
  assert.deepEqual(res.next.slots.items, STD);
  assert.equal(res.changes.length, 1);
  assert.equal(res.changes[0]!.slot, 'looks');
  assert.equal(res.changes[0]!.from, null);
  assert.deepEqual(res.kept, ['items', 'track']);
});

test('evolve: new slot still needs minPlayers', () => {
  const res = evolve(canon3, crowd('p', 3, 'looks', ref('neon'), 10), R);
  assert.equal(res.next.version, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(res.next.slots, 'looks'), false);
});

test('evolve: no events keeps everything, several slots can change at once', () => {
  const none = evolve(canon3, [], R);
  assert.deepEqual(none.next, canon3);
  assert.deepEqual(none.kept, ['items', 'track']);

  const events = [...crowd('r', 5, 'items', ROCKET, 10), ...crowd('t', 5, 'track', ref('t2'), 10)];
  const res = evolve(canon3, events, R);
  assert.equal(res.next.version, 4); // bumped once, not per slot
  assert.deepEqual(
    res.changes.map((c) => c.slot),
    ['items', 'track'],
  );
});

// ------------------------------------------------------------ changelog

test('changelog: one line per change', () => {
  const events = [...crowd('r', 6, 'items', ROCKET, 10), ...crowd('s', 2, 'items', STD, 10), ...crowd('n', 5, 'looks', ref('neon'), 10)];
  const res = evolve(canon3, events, R);
  assert.deepEqual(changelog(res), [
    'items: std -> rocket (75% of play, 6 players)',
    'looks: (new) -> neon (100% of play, 5 players)',
  ]);
  assert.deepEqual(changelog(evolve(canon3, [], R)), []);
});