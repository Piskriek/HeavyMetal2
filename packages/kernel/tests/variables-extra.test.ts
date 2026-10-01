/**
 * Extra variable-system coverage. The real expression compiler is written in parallel, so these tests
 * inject a tiny FAKE compiler through `compile`: 'const:<n>', 'sum:$a:$b...' and 'double:$a' are all it knows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSchema, type Value, type VariableProvider } from '@hm/contracts';
import {
  createEventBus,
  createPresetStore,
  createSchemaRegistry,
  createVariableSystem,
  type CompiledExpression,
  type ExprValue,
} from '@hm/kernel';

const racer = defineSchema({
  kind: 'racer', version: 1, label: 'Racer', doc: 'A ball that races.',
  variables: [
    { key: 'weight', type: 'number', label: 'Weight', doc: 'How heavy the ball is.', tier: 'play', default: 5, min: 0, max: 10 },
    { key: 'bounce', type: 'number', label: 'Bounce', doc: 'How bouncy it is.', tier: 'play', default: 5, min: 0, max: 10 },
    { key: 'grip.rolling', type: 'number', label: 'Rolling grip', doc: 'Friction while rolling.', tier: 'pro', default: 0.8 },
  ],
  slots: [],
} as const);

/** A deliberately dumb stand-in for the real compiler, enough to exercise reads, bindings and errors. */
const fakeCompile = (source: string): CompiledExpression => {
  const reads: string[] = [];
  for (const match of source.matchAll(/\$([A-Za-z0-9_.:/]+)/g)) {
    const path = match[1] as string;
    if (!reads.includes(path)) reads.push(path);
  }
  const ok = source.startsWith('const:') || source.startsWith('sum:') || source.startsWith('double:');
  const issues = ok ? [] : [{ message: `the fake compiler only knows const:, sum: and double:, got '${source}'`, position: 0 }];
  return {
    ok,
    issues,
    reads,
    evaluate: (_scope?: Readonly<Record<string, ExprValue>>, read?: (path: string) => ExprValue | undefined): ExprValue => {
      if (!ok) throw new Error('the fake compiler cannot evaluate a bad source');
      if (source.startsWith('const:')) return Number(source.slice('const:'.length));
      const values = reads.map((path) => Number(read?.(path) ?? 0));
      if (source.startsWith('double:')) return (values[0] ?? 0) * 2;
      return values.reduce((total, value) => total + value, 0);
    },
  };
};

const setup = () => {
  const schemas = createSchemaRegistry();
  schemas.register(racer);
  let n = 0;
  const store = createPresetStore({ schemas, newId: () => `p${++n}`, now: () => 1 });
  const events = createEventBus();
  const vars = createVariableSystem({ store, schemas, events, compile: fakeCompile });
  return { schemas, store, events, vars };
};

const counterProvider = (data: Record<string, number>): VariableProvider => ({
  scheme: 'global',
  read: (rest) => data[rest],
  write: (rest, value) => { data[rest] = Number(value); },
  describe: (rest) => (rest in data ? { key: rest, type: 'number', label: `Global ${rest}`, doc: 'A global knob.', tier: 'pro', default: 0 } : undefined),
  all: () => Object.keys(data),
});

test('read: defaults, overrides and unknown paths', () => {
  const { store, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'R', params: { weight: 7 } });
  assert.equal(vars.read(`${r.id}.weight`), 7);
  assert.equal(vars.read(`${r.id}.bounce`), 5, 'schema default');
  assert.equal(vars.read(`${r.id}.unknown`), undefined);
  assert.equal(vars.read('ghost.weight'), undefined);
  assert.equal(vars.read('no-dot-here'), undefined);
  assert.equal(vars.read('global:mass'), undefined, 'no provider owns the scheme yet');
});

test('write: makes one new revision and keeps everything else about the preset', () => {
  const { store, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'R', params: { weight: 7 }, tags: ['fast'], tier: 'play' });
  vars.write(`${r.id}.grip.rolling`, 1.5);
  const next = store.get(r.id)!;
  assert.equal(next.revision, 2);
  assert.deepEqual(next.params, { weight: 7, 'grip.rolling': 1.5 });
  assert.deepEqual(next.tags, ['fast']);
  assert.equal(next.tier, 'play');
  assert.equal(next.meta.createdAt, r.meta.createdAt);
  assert.equal(store.get(r.id, 1)!.params['grip.rolling'], undefined, 'the old revision is untouched');
});

test('write: a bad path says what a path looks like', () => {
  const { vars } = setup();
  assert.throws(() => vars.write('nodot', 1), /variable path/);
  assert.throws(() => vars.write('ghost.weight', 1), /does not exist/);
});

test('write: emits variable:changed with the source label', () => {
  const { store, events, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'R' });
  const seen: unknown[] = [];
  events.on('variable:changed', (payload) => seen.push(payload));
  vars.write(`${r.id}.weight`, 2, 'sim');
  assert.deepEqual(seen, [{ path: `${r.id}.weight`, value: 2, source: 'sim' }]);
});

test('describe: owner, unknown keys and unknown presets', () => {
  const { store, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'R' });
  const def = vars.describe(`${r.id}.grip.rolling`)!;
  assert.equal(def.owner, r.id);
  assert.equal(def.tier, 'pro');
  assert.equal(def.label, 'Rolling grip');
  assert.equal(vars.describe(`${r.id}.nope`), undefined);
  assert.equal(vars.describe('ghost.weight'), undefined);
  assert.equal(vars.describe('plain'), undefined);
});

test('search: matches path, label and doc, is case-insensitive and honours the limit', () => {
  const { store, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'Rocket' });
  assert.ok(vars.search('BOUNCY').some((h) => h.path === `${r.id}.bounce`), 'matches the doc');
  assert.ok(vars.search('Rolling grip').some((h) => h.path === `${r.id}.grip.rolling`), 'matches the label');
  assert.ok(vars.search(`${r.id}.weight`).length === 1, 'matches the path');
  assert.equal(vars.search('', 2).length, 2, 'limit caps the result');
  assert.equal(vars.search('nothing-matches-this').length, 0);
  const hit = vars.search('weight')[0]!;
  assert.equal(hit.ownerLabel, 'Rocket');
  assert.equal(hit.value, 5);
});

test('all: lists every declared preset path and every provider path', () => {
  const { store, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'R' });
  const data: Record<string, number> = { gravity: 9.8, wind: 0 };
  vars.registerProvider(counterProvider(data));
  const paths = [...vars.all()];
  assert.deepEqual(paths.filter((p) => p.startsWith(r.id)), [`${r.id}.weight`, `${r.id}.bounce`, `${r.id}.grip.rolling`]);
  assert.deepEqual(paths.filter((p) => p.startsWith('global:')), ['global:gravity', 'global:wind']);
});

test('providers: registering the same scheme twice replaces it; unsubscribing frees the scheme', () => {
  const { vars } = setup();
  const first: Record<string, number> = { mass: 1 };
  const second: Record<string, number> = { mass: 2 };
  vars.registerProvider(counterProvider(first));
  const off = vars.registerProvider(counterProvider(second));
  assert.equal(vars.read('global:mass'), 2, 'the newest provider wins');
  off();
  assert.equal(vars.read('global:mass'), undefined, 'the scheme is free again');
  assert.throws(() => vars.write('global:mass', 3), /variable path/);
});

test('observe: fires on change only, with previous value, and stops after unsubscribe', () => {
  const { store, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'R', params: { weight: 1 } });
  const seen: string[] = [];
  const off = vars.observe(`${r.id}.weight`, (value, previous) => seen.push(`${String(previous)}->${String(value)}`));
  vars.write(`${r.id}.weight`, 4);
  vars.write(`${r.id}.weight`, 4);
  vars.write(`${r.id}.bounce`, 9);
  off();
  vars.write(`${r.id}.weight`, 6);
  assert.deepEqual(seen, ['1->4']);
});

test('bind: a plain path source tracks writes and unbinding restores the stored value', () => {
  const { store, vars } = setup();
  const a = store.put({ kind: 'racer', name: 'A', params: { weight: 3 } });
  const b = store.put({ kind: 'racer', name: 'B', params: { weight: 1 } });
  const off = vars.bind(`${b.id}.weight`, `${a.id}.weight`);
  assert.equal(vars.read(`${b.id}.weight`), 3);
  vars.write(`${a.id}.weight`, 8);
  assert.equal(vars.read(`${b.id}.weight`), 8);
  assert.equal(store.get(b.id)!.params['weight'], 1, 'the overlay is never stored');
  assert.equal(store.get(b.id)!.revision, 1, 'binding makes no revisions');
  off();
  assert.equal(vars.read(`${b.id}.weight`), 1);
  off();
  assert.equal(vars.read(`${b.id}.weight`), 1, 'unbinding twice is harmless');
});

test('bind: an expression source re-evaluates through the injected compiler and notifies observers', () => {
  const { store, vars } = setup();
  const a = store.put({ kind: 'racer', name: 'A', params: { weight: 2 } });
  const b = store.put({ kind: 'racer', name: 'B', params: { weight: 0 } });
  const seen: Array<Value | undefined> = [];
  vars.observe(`${b.id}.weight`, (value) => seen.push(value));
  const off = vars.bind(`${b.id}.weight`, { expr: `double:$${a.id}.weight` });
  assert.equal(vars.read(`${b.id}.weight`), 4);
  vars.write(`${a.id}.weight`, 5);
  assert.deepEqual(seen, [4, 10]);
  off();
  assert.deepEqual(seen, [4, 10, 0]);
});

test('bind: direct, indirect and self cycles are refused with the word cycle', () => {
  const { store, vars } = setup();
  const a = store.put({ kind: 'racer', name: 'A' });
  const b = store.put({ kind: 'racer', name: 'B' });
  const c = store.put({ kind: 'racer', name: 'C' });
  assert.throws(() => vars.bind(`${a.id}.weight`, `${a.id}.weight`), /cycle/i);
  vars.bind(`${b.id}.weight`, `${a.id}.weight`);
  vars.bind(`${c.id}.weight`, `${b.id}.weight`);
  assert.throws(() => vars.bind(`${a.id}.weight`, `${c.id}.weight`), /cycle/i);
  assert.throws(() => vars.bind(`${a.id}.weight`, { expr: `sum:$${c.id}.weight` }), /cycle/i);
});

test('bind: a bad expression source is refused with the compiler issues in the message', () => {
  const { store, vars } = setup();
  const a = store.put({ kind: 'racer', name: 'A' });
  assert.throws(() => vars.bind(`${a.id}.weight`, { expr: 'nonsense()' }), /fake compiler only knows/);
});

test('expressions: a stored {expr} param is evaluated on read and sums several paths', () => {
  const { store, vars } = setup();
  const a = store.put({ kind: 'racer', name: 'A', params: { weight: 3 } });
  const b = store.put({ kind: 'racer', name: 'B', params: { bounce: 4 } });
  const c = store.put({ kind: 'racer', name: 'C', params: { weight: { expr: `sum: $${a.id}.weight $${b.id}.bounce` } } });
  assert.equal(vars.read(`${c.id}.weight`), 7);
  vars.write(`${a.id}.weight`, 10);
  assert.equal(vars.read(`${c.id}.weight`), 14, 'the stored expression is live');
});

test('compile/evaluate: issues are mapped and evaluating a broken source throws', () => {
  const { vars } = setup();
  const good = vars.compile('const:42');
  assert.equal(good.ok, true);
  assert.equal(good.source, 'const:42');
  assert.equal(good.evaluate(), 42);
  const bad = vars.compile('oops');
  assert.equal(bad.ok, false);
  assert.equal(bad.issues[0]!.severity, 'error');
  assert.equal(bad.issues[0]!.code, 'expr');
  assert.throws(() => bad.evaluate(), /Fix the expression/);
  assert.throws(() => vars.evaluate('oops'), /Cannot evaluate expression/);
  assert.equal(vars.evaluate('const:1'), 1);
});
