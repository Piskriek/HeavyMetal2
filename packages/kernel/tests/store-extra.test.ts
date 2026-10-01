/**
 * Extra kernel coverage: schema validation errors, event-bus error reporting, deep fork chains,
 * pinned revisions in bundles, replace-imports, multi-step migrations and index-backed listing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineSchema, type PresetBundle, type PresetSchema } from '@hm/contracts';
import {
  createEventBus,
  createPresetStore,
  createSchemaRegistry,
  hashBundle,
  hashValue,
  migrateBundle,
  stableStringify,
} from '@hm/kernel';

const node = defineSchema({
  kind: 'node', version: 1, label: 'Node', doc: 'A plain node.',
  variables: [
    { key: 'size', type: 'number', label: 'Size', doc: 'How big.', tier: 'play', default: 1, min: 0, max: 10 },
    { key: 'note', type: 'string', label: 'Note', doc: 'A note.', tier: 'pro', default: '' },
  ],
  slots: [{ key: 'kids', label: 'Kids', doc: 'Children.', kinds: ['node'], min: 0, max: null, tier: 'build' }],
} as const);

const freshStore = (limits?: { maxDepth?: number; maxNodes?: number; maxBundleBytes?: number }) => {
  const schemas = createSchemaRegistry();
  schemas.register(node);
  let n = 0;
  const store = createPresetStore({ schemas, ...(limits ? { limits } : {}), newId: () => `n${++n}`, now: () => 7 });
  return { schemas, store };
};

test('registry: rejects malformed schemas with a message that says what to fix', () => {
  const schemas = createSchemaRegistry();
  const bad = (patch: Partial<PresetSchema>): PresetSchema =>
    ({ kind: 'bad', version: 1, label: 'Bad', doc: 'x', variables: [], slots: [], ...patch }) as PresetSchema;
  assert.throws(
    () => schemas.register(bad({ variables: [
      { key: 'a', type: 'number', label: 'A', doc: 'x', tier: 'play', default: 1 },
      { key: 'a', type: 'number', label: 'A again', doc: 'x', tier: 'play', default: 1 },
    ] })),
    /declared twice/,
  );
  assert.throws(() => schemas.register(bad({ variables: [{ key: 'e', type: 'enum', label: 'E', doc: 'x', tier: 'play', default: 'a' }] })), /options/);
  assert.throws(() => schemas.register(bad({ variables: [{ key: 'r', type: 'ref', label: 'R', doc: 'x', tier: 'play', default: null }] })), /refKinds/);
  assert.throws(() => schemas.register(bad({ variables: [{ key: 'n', type: 'number', label: 'N', doc: 'x', tier: 'play', default: 1, min: 5, max: 2 }] })), /min 5 greater than max 2/);
  assert.throws(() => schemas.register(bad({ variables: [{ key: 'n', type: 'number', label: 'N', doc: 'x', tier: 'play', default: 99, min: 0, max: 10 }] })), /above max/);
  assert.equal(schemas.get('bad'), undefined, 'nothing is registered when the schema is rejected');
  assert.deepEqual(schemas.variablesFor('bad', 'pro'), []);
});

test('events: a throwing listener does not stop the others and is reported as an "error" event', () => {
  const bus = createEventBus();
  const seen: string[] = [];
  bus.onAny((name, payload) => seen.push(`${name}:${payload instanceof Error ? payload.message : String(payload)}`));
  bus.on('tick', () => { throw new Error('boom'); });
  bus.on('tick', () => seen.push('second listener ran'));
  bus.emit('tick', 1);
  assert.deepEqual(seen, ['error:boom', 'second listener ran', 'tick:1']);
});

test('events: once fires a single time and can be cancelled before it fires', () => {
  const bus = createEventBus();
  const seen: number[] = [];
  bus.once('x', (p) => seen.push(Number(p)));
  bus.emit('x', 1);
  bus.emit('x', 2);
  const off = bus.once('x', () => seen.push(-1));
  off();
  bus.emit('x', 3);
  assert.deepEqual(seen, [1]);
});

test('store: a fork of a fork resolves oldest-first and reports the chain nearest-first', () => {
  const { store } = freshStore();
  const a = store.put({ kind: 'node', name: 'A', params: { size: 2, note: 'root' } });
  const b = store.fork(a.id, { name: 'B', params: { size: 5 } });
  const c = store.fork(b.id, { name: 'C', params: { note: 'leaf' } });
  const resolved = store.resolve(c.id);
  assert.deepEqual(resolved.chain.map((p) => p.name), ['C', 'B', 'A']);
  assert.equal(resolved.params['size'], 5, 'nearest fork source wins over the older one');
  assert.equal(resolved.params['note'], 'leaf', 'own params win over everything');
  assert.deepEqual(c.params, { note: 'leaf' }, 'a fork stores only its overrides');
});

test('store: revisions are immutable snapshots and unknown revisions are undefined', () => {
  const { store } = freshStore();
  const first = store.put({ kind: 'node', name: 'A', params: { size: 1 } });
  store.put({ id: first.id, kind: 'node', name: 'A', params: { size: 3 } });
  assert.equal(first.params['size'], 1, 'the object handed out earlier never changes');
  assert.equal(store.get(first.id, 1)!.params['size'], 1);
  assert.equal(store.get(first.id, 9), undefined);
  assert.equal(store.get('nope'), undefined);
  assert.throws(() => store.resolve('nope'), /no such preset/);
  assert.throws(() => store.remove('nope'), /no such preset/);
  assert.throws(() => store.fork('nope'), /no such preset/);
});

test('store: validate reports unknown slots and the node limit', () => {
  const { store } = freshStore({ maxNodes: 2 });
  const leafA = store.put({ kind: 'node', name: 'a' });
  const leafB = store.put({ kind: 'node', name: 'b' });
  const root = store.put({ kind: 'node', name: 'root', children: { kids: [{ ref: leafA.id }, { ref: leafB.id }], wings: [] } });
  const codes = store.validate(root.id).map((i) => i.code).sort();
  assert.deepEqual(codes, ['nodes', 'slot-kind']);
  const clean = store.put({ kind: 'node', name: 'clean', params: { size: 4 } });
  assert.deepEqual(store.validate(clean.id), []);
});

test('store: dependents and list stay correct across revisions and removals', () => {
  const { store } = freshStore();
  const leaf = store.put({ kind: 'node', name: 'leaf', tags: ['small'] });
  const holder = store.put({ kind: 'node', name: 'holder', children: { kids: [{ ref: leaf.id }] } });
  assert.deepEqual(store.dependents(leaf.id), [holder.id]);
  // A new revision that drops the child must drop the dependency too.
  store.put({ id: holder.id, kind: 'node', name: 'holder' });
  assert.deepEqual(store.dependents(leaf.id), []);
  store.remove(leaf.id);
  assert.deepEqual(store.list().map((p) => p.name), ['holder']);
  assert.deepEqual(store.list({ tag: 'small' }), []);
});

test('store: list combines kind, tag, tier and text filters in insertion order', () => {
  const { store } = freshStore();
  store.put({ kind: 'node', name: 'Alpha', tags: ['fast'], tier: 'play' });
  store.put({ kind: 'node', name: 'Beta', tags: ['fast'], tier: 'pro', meta: { doc: 'a secret tool' } });
  store.put({ kind: 'node', name: 'Gamma', tags: ['slow'], tier: 'play' });
  assert.deepEqual(store.list().map((p) => p.name), ['Alpha', 'Beta', 'Gamma']);
  assert.deepEqual(store.list({ tag: 'fast', tier: 'play' }).map((p) => p.name), ['Alpha']);
  assert.deepEqual(store.list({ kind: 'node', text: 'SECRET' }).map((p) => p.name), ['Beta'], 'text also matches the doc, case-insensitively');
  assert.deepEqual(store.list({ kind: 'missing' }), []);
});

test('bundles: export carries the pinned fork source revision, not the newest one', () => {
  const { store, schemas } = freshStore();
  const base = store.put({ kind: 'node', name: 'Base', params: { size: 2 } });
  const fork = store.fork(base.id, { name: 'Fork' });
  store.put({ id: base.id, kind: 'node', name: 'Base', params: { size: 9 } });
  const bundle = store.exportBundle(fork.id);
  assert.deepEqual(bundle.presets.map((p) => `${p.id}@${p.revision}`).sort(), [`${base.id}@1`, `${fork.id}@1`].sort());
  const fresh = createPresetStore({ schemas, newId: () => 'unused' });
  fresh.importBundle(bundle);
  assert.equal(fresh.resolve(fork.id).params['size'], 2, 'inheritance still resolves after a round-trip');
  assert.throws(() => store.exportBundle('ghost'), /no such preset/);
});

test('bundles: onConflict replace overwrites, keep leaves the original alone', () => {
  const { store, schemas } = freshStore();
  const only = store.put({ kind: 'node', name: 'Original' });
  const bundle = store.exportBundle(only.id);
  const edited: PresetBundle = { ...bundle, presets: bundle.presets.map((p) => ({ ...p, name: 'Edited' })) };
  const kept = store.importBundle(edited, { onConflict: 'keep' });
  assert.deepEqual([kept.imported, kept.skipped], [0, 1]);
  assert.equal(store.get(only.id)!.name, 'Original');
  const replaced = store.importBundle(edited, { onConflict: 'replace' });
  assert.deepEqual([replaced.imported, replaced.skipped], [1, 0]);
  assert.equal(store.get(only.id)!.name, 'Edited');
  const schemaless = createSchemaRegistry();
  const other = createPresetStore({ schemas: schemaless, newId: () => 'x1' });
  const report = other.importBundle(bundle);
  assert.equal(report.imported, 1);
  assert.ok(report.issues.some((i) => i.code === 'unknown-kind' && i.severity === 'warning'));
  assert.equal(migrateBundle(bundle, schemaless).presets[0]!.name, 'Original', 'unknown kinds pass through migration');
  assert.ok(schemas.get('node') !== undefined);
});

test('migrateBundle runs one step per version and refuses bundles from the future', () => {
  const schemas = createSchemaRegistry();
  schemas.register({ ...node, version: 3 });
  const steps: string[] = [];
  schemas.registerMigration('node', 1, (params) => { steps.push('1->2'); return { ...params, size: Number(params['size'] ?? 0) + 1 }; });
  schemas.registerMigration('node', 2, (params) => { steps.push('2->3'); return { ...params, size: Number(params['size'] ?? 0) * 10 }; });
  const store = createPresetStore({ schemas, newId: () => 'm1' });
  const root = store.put({ kind: 'node', name: 'N', params: { size: 1 } });
  const bundle = store.exportBundle(root.id);
  const old: PresetBundle = { ...bundle, schemaVersions: { node: 1 } };
  const migrated = migrateBundle(old, schemas);
  assert.deepEqual(steps, ['1->2', '2->3']);
  assert.equal(migrated.presets[0]!.params['size'], 20);
  assert.equal(migrated.schemaVersions['node'], 3);
  assert.notEqual(migrated.presets[0]!.hash, bundle.presets[0]!.hash, 'migrated params give a new content hash');
  assert.throws(() => migrateBundle({ ...bundle, schemaVersions: { node: 9 } }, schemas), /Update the app/);
  assert.throws(() => schemas.registerMigration('node', 0, (p) => p), /at least 1/);
});

test('hashing: stableStringify sorts keys and hashBundle notices a different root', () => {
  assert.equal(stableStringify({ b: 1, a: [2, { d: 4, c: 3 }] }), '{"a":[2,{"c":3,"d":4}],"b":1}');
  assert.equal(hashValue({ a: 1, b: 2 }), hashValue({ b: 2, a: 1 }));
  assert.notEqual(hashValue({ a: 1 }), hashValue({ a: 2 }));
  const { store } = freshStore();
  const leaf = store.put({ kind: 'node', name: 'leaf' });
  const root = store.put({ kind: 'node', name: 'root', children: { kids: [{ ref: leaf.id }] } });
  const bundle = store.exportBundle(root.id);
  assert.equal(hashBundle(bundle), hashBundle({ ...bundle, presets: [...bundle.presets].reverse() }));
  assert.notEqual(hashBundle(bundle), hashBundle({ ...bundle, root: leaf.id }));
});

test('store: bundle size limit is reported in bytes and subscribe can be cancelled', () => {
  const { store } = freshStore({ maxBundleBytes: 60 });
  const changes: string[] = [];
  const off = store.subscribe((c) => changes.push(c.type === 'put' ? `put:${c.preset.name}` : `remove:${c.id}`));
  const big = store.put({ kind: 'node', name: 'N'.repeat(300) });
  assert.throws(() => store.exportBundle(big.id), /bytes/);
  off();
  store.remove(big.id);
  assert.deepEqual(changes, [`put:${'N'.repeat(300)}`]);
});
