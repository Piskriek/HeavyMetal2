/**
 * T1 acceptance: the kernel (schema registry, preset graph, variables, commands, events, migrations).
 * Issue codes the store's validate() must use: 'cycle', 'missing-ref', 'slot-kind', 'param-range', 'unknown-param', 'depth', 'nodes'.
 * If a test contradicts the contract text in packages/contracts, follow the contract, fix the test minimally and say so in your report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSchema, type PresetBundle, type PresetStore, type SchemaRegistry } from '@hm/contracts';
import { createEventBus, createPresetStore, createSchemaRegistry, hashBundle, migrateBundle } from '@hm/kernel';

const racer = defineSchema({
  kind: 'racer', version: 2, label: 'Racer', doc: 'A ball that races.',
  variables: [
    { key: 'weight', type: 'number', label: 'Weight', doc: 'How heavy the ball is.', tier: 'play', default: 5, min: 0, max: 10, step: 1 },
    { key: 'bounce', type: 'number', label: 'Bounce', doc: 'How bouncy.', tier: 'play', default: 5, min: 0, max: 10 },
    { key: 'grip.rolling', type: 'number', label: 'Rolling grip', doc: 'Friction while rolling.', tier: 'pro', default: 0.8, min: 0, max: 2, unit: 'mu' },
    { key: 'colour', type: 'color', label: 'Colour', doc: 'Paint.', tier: 'build', default: '#ff8800' },
  ],
  slots: [{ key: 'mechanics', label: 'Mechanics', doc: 'Extra behaviours.', kinds: ['mechanic'], min: 0, max: 4, tier: 'build' }],
} as const);
const mechanic = defineSchema({
  kind: 'mechanic', version: 1, label: 'Mechanic', doc: 'A behaviour.', scriptInterface: 'Mechanic',
  variables: [{ key: 'power', type: 'number', label: 'Power', doc: 'Strength.', tier: 'build', default: 1, min: 0, max: 100 }],
  slots: [],
} as const);
const mode = defineSchema({
  kind: 'mode', version: 1, label: 'Mode', doc: 'A way to play.',
  variables: [{ key: 'laps', type: 'int', label: 'Laps', doc: 'How many laps.', tier: 'play', default: 3, min: 1, max: 20 }],
  slots: [{ key: 'racers', label: 'Racers', doc: 'Who races.', kinds: ['racer'], min: 0, max: null, tier: 'play' }],
} as const);

function setup(limits?: { maxDepth?: number; maxNodes?: number; maxBundleBytes?: number }) {
  const schemas = createSchemaRegistry();
  for (const s of [racer, mechanic, mode]) schemas.register(s);
  let n = 0, t = 1000;
  const store = createPresetStore({ schemas, ...(limits ? { limits } : {}), newId: () => `p${++n}`, now: () => ++t });
  const events = createEventBus();
  return { schemas, store, events };
}

test('registry: kinds, tier filtering, unknown kinds', () => {
  const { schemas } = setup();
  assert.deepEqual([...schemas.kinds()].sort(), ['mechanic', 'mode', 'racer']);
  assert.equal(schemas.get('nope'), undefined);
  assert.deepEqual(schemas.variablesFor('racer', 'play').map((v) => v.key), ['weight', 'bounce']);
  assert.deepEqual(schemas.variablesFor('racer', 'build').map((v) => v.key), ['weight', 'bounce', 'colour']);
  assert.equal(schemas.variablesFor('racer', 'pro').length, 4);
});

test('store: put makes revisions; old revisions stay readable; hash is content-only', () => {
  const { store } = setup();
  const a = store.put({ kind: 'racer', name: 'Ball', params: { weight: 7 } });
  assert.equal(a.id, 'p1'); assert.equal(a.revision, 1);
  const b = store.put({ id: a.id, kind: 'racer', name: 'Ball', params: { weight: 8 } });
  assert.equal(b.revision, 2);
  assert.equal(store.get(a.id)!.params['weight'], 8);
  assert.equal(store.get(a.id, 1)!.params['weight'], 7);
  assert.notEqual(a.hash, b.hash);
  const same = store.put({ kind: 'racer', name: 'Ball', params: { weight: 8 } });
  assert.equal(same.hash, b.hash, 'equal content, equal hash, whatever the id, revision or time');
});

test('store: resolve = schema defaults < fork chain < own params; fork copies and remembers', () => {
  const { store } = setup();
  const base = store.put({ kind: 'racer', name: 'Base', params: { weight: 8 } });
  const fork = store.fork(base.id, { name: 'Light', params: { bounce: 9 } });
  assert.notEqual(fork.id, base.id);
  assert.equal(fork.revision, 1);
  assert.deepEqual(fork.forkOf, { ref: base.id, rev: 1 });
  const r = store.resolve(fork.id);
  assert.equal(r.params['weight'], 8, 'inherited from the fork source');
  assert.equal(r.params['bounce'], 9, 'own override');
  assert.equal(r.params['grip.rolling'], 0.8, 'schema default');
  assert.deepEqual(r.chain.map((p) => p.id), [fork.id, base.id]);
  store.put({ id: base.id, kind: 'racer', name: 'Base', params: { weight: 2 } });
  assert.equal(store.resolve(fork.id).params['weight'], 8, 'a fork is pinned to the revision it was made from (copy-on-write)');
});

test('store: validate finds cycles, missing refs, wrong slot kinds, out-of-range and unknown params', () => {
  const { store } = setup();
  const m = store.put({ kind: 'mechanic', name: 'Nitro', params: { power: 500 } });
  const r = store.put({ kind: 'racer', name: 'R', params: { weight: 3, wat: 1 }, children: { mechanics: [{ ref: m.id }, { ref: 'ghost' }] } });
  const codes = store.validate(r.id).map((i) => i.code).sort();
  assert.deepEqual(codes, ['missing-ref', 'unknown-param']);
  const m2 = store.validate(m.id).map((i) => i.code);
  assert.deepEqual(m2, ['param-range']);
  const wrong = store.put({ kind: 'mode', name: 'M', children: { racers: [{ ref: m.id }] } });
  assert.ok(store.validate(wrong.id).some((i) => i.code === 'slot-kind'));
  // a cycle: a mode that holds a racer that holds ... the mode is not allowed by slots, so build one with two modes via a loose kind
  const loose = createSchemaRegistry();
  loose.register({ kind: 'node', version: 1, label: 'Node', doc: 'x', variables: [], slots: [{ key: 'kids', label: 'Kids', doc: 'x', kinds: ['node'], min: 0, max: null, tier: 'pro' }] });
  const s2 = createPresetStore({ schemas: loose, newId: (() => { let i = 0; return () => `n${++i}`; })() });
  const a = s2.put({ kind: 'node', name: 'A' });
  const b = s2.put({ kind: 'node', name: 'B', children: { kids: [{ ref: a.id }] } });
  s2.put({ id: a.id, kind: 'node', name: 'A', children: { kids: [{ ref: b.id }] } });
  assert.ok(s2.validate(a.id).some((i) => i.code === 'cycle' && i.severity === 'error'));
});

test('store: limits (depth, nodes) are enforced by validate', () => {
  const schemas = createSchemaRegistry();
  schemas.register({ kind: 'node', version: 1, label: 'Node', doc: 'x', variables: [], slots: [{ key: 'kids', label: 'Kids', doc: 'x', kinds: ['node'], min: 0, max: null, tier: 'pro' }] });
  const store = createPresetStore({ schemas, limits: { maxDepth: 3, maxNodes: 100 }, newId: (() => { let i = 0; return () => `n${++i}`; })() });
  let prev = store.put({ kind: 'node', name: 'leaf' });
  for (let i = 0; i < 5; i++) prev = store.put({ kind: 'node', name: `l${i}`, children: { kids: [{ ref: prev.id }] } });
  assert.ok(store.validate(prev.id).some((i) => i.code === 'depth'));
});

test('store: remove refuses while referenced; list filters; subscribe sees changes', () => {
  const { store } = setup();
  const seen: string[] = [];
  const off = store.subscribe((c) => seen.push(c.type));
  const m = store.put({ kind: 'mechanic', name: 'Nitro', tags: ['speed'], tier: 'build' });
  const r = store.put({ kind: 'racer', name: 'R', children: { mechanics: [{ ref: m.id }] } });
  assert.throws(() => store.remove(m.id));
  assert.deepEqual(store.dependents(m.id), [r.id]);
  assert.deepEqual(store.list({ kind: 'mechanic' }).map((p) => p.name), ['Nitro']);
  assert.deepEqual(store.list({ tag: 'speed' }).map((p) => p.name), ['Nitro']);
  assert.deepEqual(store.list({ text: 'nitr' }).map((p) => p.name), ['Nitro']);
  assert.deepEqual(store.list({ tier: 'play' }).map((p) => p.name), ['R'].filter(() => false), 'tier play hides build-tier presets');
  store.remove(r.id);
  off();
  store.remove(m.id);
  assert.deepEqual(seen, ['put', 'put', 'remove']);
});

test('bundles: export/import round-trip, size limit, conflicts', () => {
  const { store, schemas } = setup();
  const m = store.put({ kind: 'mechanic', name: 'Nitro' });
  const r = store.put({ kind: 'racer', name: 'R', children: { mechanics: [{ ref: m.id }] } });
  const bundle = store.exportBundle(r.id);
  assert.equal(bundle.format, 'hm-bundle');
  assert.equal(bundle.root, r.id);
  assert.deepEqual(bundle.presets.map((p) => p.id).sort(), [m.id, r.id].sort());
  assert.equal(bundle.schemaVersions['racer'], 2);
  const fresh = createPresetStore({ schemas, newId: (() => { let i = 100; return () => `q${++i}`; })() });
  const report = fresh.importBundle(JSON.parse(JSON.stringify(bundle)) as PresetBundle);
  assert.equal(report.imported, 2);
  assert.equal(fresh.get(r.id)!.name, 'R');
  const again = fresh.importBundle(bundle, { onConflict: 'keep' });
  assert.equal(again.skipped, 2);
  const renamed = fresh.importBundle(bundle, { onConflict: 'rename' });
  assert.equal(Object.keys(renamed.renamed).length, 2);
  assert.ok(fresh.resolve(renamed.renamed[r.id]!).preset.children['mechanics']![0]!.ref === renamed.renamed[m.id], 'children refs follow the renames');
  const tiny = setup({ maxBundleBytes: 50 });
  const big = tiny.store.put({ kind: 'racer', name: 'R'.repeat(200) });
  assert.throws(() => tiny.store.exportBundle(big.id), /bytes|limit|large/i);
});

test('hashBundle is stable and order-independent; migrateBundle upgrades old schema versions', () => {
  const { store, schemas } = setup();
  const m = store.put({ kind: 'mechanic', name: 'Nitro' });
  const r = store.put({ kind: 'racer', name: 'R', children: { mechanics: [{ ref: m.id }] } });
  const b = store.exportBundle(r.id);
  const reversed: PresetBundle = { ...b, presets: [...b.presets].reverse() };
  assert.equal(hashBundle(b), hashBundle(reversed));
  assert.notEqual(hashBundle(b), hashBundle({ ...b, presets: b.presets.map((p) => (p.id === m.id ? { ...p, hash: 'x', name: 'Other' } : p)) }));
  // racer v1 used "mass" instead of "weight"
  schemas.registerMigration('racer', 1, (params) => {
    const { mass, ...rest } = params as Record<string, unknown>;
    return (mass === undefined ? rest : { ...rest, weight: mass }) as never;
  });
  const old: PresetBundle = { ...b, schemaVersions: { ...b.schemaVersions, racer: 1 }, presets: b.presets.map((p) => (p.id === r.id ? { ...p, params: { mass: 9 } } : p)) };
  const migrated = migrateBundle(old, schemas);
  assert.equal(migrated.schemaVersions['racer'], 2);
  assert.deepEqual(migrated.presets.find((p) => p.id === r.id)!.params, { weight: 9 });
});

test('events: on, once, emit, onAny, unsubscribe', () => {
  const { events } = setup();
  const got: string[] = [];
  const off = events.on('a', (p) => got.push(`a:${String(p)}`));
  events.once('a', (p) => got.push(`once:${String(p)}`));
  events.onAny((n, p) => got.push(`any:${n}:${String(p)}`));
  events.emit('a', 1); events.emit('a', 2);
  off(); events.emit('a', 3);
  assert.deepEqual(got, ['a:1', 'once:1', 'any:a:1', 'a:2', 'any:a:2', 'any:a:3']);
});

test('performance: 5,000 presets put/resolve/list quickly', () => {
  const { store } = setup();
  const t0 = Date.now();
  const base = store.put({ kind: 'racer', name: 'seed' });
  let last = base;
  for (let i = 0; i < 5000; i++) last = store.fork(base.id, { name: `r${i}`, params: { weight: i % 10 } });
  store.resolve(last.id);
  assert.ok(store.list({ kind: 'racer' }).length >= 5000);
  assert.ok(Date.now() - t0 < 3000, `took ${Date.now() - t0} ms`);
});



export type { PresetStore, SchemaRegistry };
