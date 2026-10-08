import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, emptyDoc, apply, check, createHistory, run, undo, redo, select, prune, path, descendants, findByType, save, load, MERGE_MS, type Doc, type Op, type TypeDef } from '../src/index';

const DEFS: TypeDef[] = [
  { type: 'group', version: 1, props: {} },
  {
    type: 'machine', version: 2,
    props: {
      kind: { kind: 'enum', options: ['drill', 'mill', 'press'], default: 'drill' },
      power: { kind: 'number', min: 0, max: 100, default: 10 },
      on: { kind: 'bool', default: true },
      pos: { kind: 'vec3', default: [0, 0, 0] },
      tint: { kind: 'color', default: '#ffffff' },
      feeds: { kind: 'ref', default: null },
    },
    migrate: (p, from) => (from < 2 ? { ...p, power: Number(p['watts']) / 1000 } : { ...p }),
  },
];
const reg = createRegistry(DEFS);

test('nodes are created with their type defaults, and values are checked against their types', () => {
  const r = apply(reg, emptyDoc(), { op: 'create', type: 'machine', name: 'Drill 1' });
  const id = r.created[0]!;
  const n = r.doc.nodes[id]!;
  assert.equal(n.type, 'machine');
  assert.equal(n.name, 'Drill 1');
  assert.equal(n.parent, null);
  assert.deepEqual(n.props, { kind: 'drill', power: 10, on: true, pos: [0, 0, 0], tint: '#ffffff', feeds: null });
  assert.deepEqual(r.doc.roots, [id]);
  for (const bad of [{ power: 101 }, { power: Number.NaN }, { kind: 'laser' }, { pos: [0, 0] }, { tint: 'red' }, { feeds: 'nope' }, { on: 1 }, { extra: 1 }]) {
    assert.equal(check(reg, r.doc, { op: 'set', id, props: bad }).ok, false, JSON.stringify(bad));
    assert.throws(() => apply(reg, r.doc, { op: 'set', id, props: bad }));
  }
  assert.equal(check(reg, r.doc, { op: 'create', type: 'spaceship' }).ok, false);
  assert.throws(() => createRegistry([...DEFS, DEFS[0]!]));
});

test('every step undoes exactly and redoes exactly', () => {
  let h = createHistory(emptyDoc());
  let seed = 7;
  const rnd = (): number => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const snapshots: Doc[] = [h.doc];
  for (let k = 0; k < 200; k++) {
    const ids = Object.keys(h.doc.nodes);
    const pick = (): string => ids[Math.floor(rnd() * ids.length)]!;
    const r = rnd();
    let op: Op;
    if (ids.length < 3 || r < 0.3) op = { op: 'create', type: rnd() < 0.3 ? 'group' : 'machine', parent: ids.length > 0 && rnd() < 0.6 ? pick() : null };
    else if (r < 0.5) { const id = pick(); op = h.doc.nodes[id]!.type === 'machine' ? { op: 'set', id, props: { power: Math.floor(rnd() * 100) } } : { op: 'rename', id, name: `g${k}` }; }
    else if (r < 0.65) op = { op: 'move', id: pick(), parent: rnd() < 0.5 ? null : pick() };
    else if (r < 0.8) op = { op: 'duplicate', id: pick() };
    else op = { op: 'remove', id: pick() };
    if (!check(reg, h.doc, op).ok) continue;
    h = run(reg, h, `step ${k}`, [op]).history;
    snapshots.push(h.doc);
  }
  assert.ok(snapshots.length > 120, `${snapshots.length} steps ran`);
  for (let i = snapshots.length - 1; i > 0; i--) { h = undo(reg, h).history; assert.deepEqual(h.doc, snapshots[i - 1], `undo to step ${i - 1}`); }
  for (let i = 1; i < snapshots.length; i++) { h = redo(reg, h).history; assert.deepEqual(h.doc, snapshots[i], `redo to step ${i}`); }
});

test('removing a node removes its subtree, clears refs to it, and undo brings it all back', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [{ op: 'create', type: 'group', id: 'g' }, { op: 'create', type: 'machine', id: 'a', parent: 'g' }, { op: 'create', type: 'machine', id: 'b', parent: 'a' }, { op: 'create', type: 'machine', id: 'c' }]).history;
  h = run(reg, h, 'link', [{ op: 'set', id: 'c', props: { feeds: 'b' } }]).history;
  const before = h.doc;
  const r = run(reg, h, 'remove g', [{ op: 'remove', id: 'g' }]);
  h = r.history;
  assert.deepEqual(Object.keys(h.doc.nodes).sort(), ['c']);
  assert.equal(h.doc.nodes['c']!.props['feeds'], null);
  assert.ok(r.changes.some((c) => c.id === 'c' && c.kind === 'changed'));
  h = undo(reg, h).history;
  assert.deepEqual(h.doc, before);
});

test('moves keep the tree a tree: no cycles, order kept, and undo puts it back', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [{ op: 'create', type: 'group', id: 'p' }, { op: 'create', type: 'group', id: 'q', parent: 'p' }, { op: 'create', type: 'group', id: 'r', parent: 'p' }, { op: 'create', type: 'group', id: 's', parent: 'p' }]).history;
  assert.deepEqual(h.doc.nodes['p']!.children, ['q', 'r', 's']);
  assert.deepEqual(descendants(h.doc, 'p'), ['q', 'r', 's']);
  assert.deepEqual(findByType(h.doc, 'group').length, 4);
  assert.equal(check(reg, h.doc, { op: 'move', id: 'p', parent: 'q' }).ok, false);
  assert.equal(check(reg, h.doc, { op: 'move', id: 'p', parent: 'p' }).ok, false);
  const before = h.doc;
  h = run(reg, h, 'reorder', [{ op: 'move', id: 's', parent: 'p', index: 0 }]).history;
  assert.deepEqual(h.doc.nodes['p']!.children, ['s', 'q', 'r']);
  h = run(reg, h, 'out', [{ op: 'move', id: 'q', parent: null }]).history;
  assert.deepEqual(h.doc.roots, ['p', 'q']);
  assert.deepEqual(path(h.doc, 'r'), ['p', 'r']);
  h = undo(reg, undo(reg, h).history).history;
  assert.deepEqual(h.doc, before);
});

test('duplicating a subtree gives new ids, keeps outside refs, and points inside refs at the copies', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [{ op: 'create', type: 'machine', id: 'x' }, { op: 'create', type: 'group', id: 'g' }, { op: 'create', type: 'machine', id: 'a', parent: 'g' }, { op: 'create', type: 'machine', id: 'b', parent: 'g' }]).history;
  h = run(reg, h, 'links', [{ op: 'set', id: 'a', props: { feeds: 'b' } }, { op: 'set', id: 'b', props: { feeds: 'x' } }]).history;
  const r = run(reg, h, 'dup', [{ op: 'duplicate', id: 'g' }]);
  const doc = r.history.doc;
  assert.equal(doc.roots.length, 3);
  const g2 = doc.roots[2]!;
  assert.notEqual(g2, 'g');
  const [a2, b2] = doc.nodes[g2]!.children as [string, string];
  assert.ok(a2 !== 'a' && b2 !== 'b');
  assert.equal(doc.nodes[a2]!.props['feeds'], b2);
  assert.equal(doc.nodes[b2]!.props['feeds'], 'x');
  assert.deepEqual(new Set(r.changes.filter((c) => c.kind === 'created').map((c) => c.id)), new Set([g2, a2, b2]));
});

test('a transaction is one step and all-or-nothing; slider drags merge into one step', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [{ op: 'create', type: 'machine', id: 'm' }]).history;
  const before = h.doc;
  assert.throws(() => run(reg, h, 'bad', [{ op: 'set', id: 'm', props: { power: 50 } }, { op: 'set', id: 'm', props: { power: 500 } }]));
  assert.deepEqual(h.doc, before);
  h = run(reg, h, 'drag', [{ op: 'set', id: 'm', props: { power: 20 } }], { mergeKey: 'm.power', at: 1000 }).history;
  h = run(reg, h, 'drag', [{ op: 'set', id: 'm', props: { power: 30 } }], { mergeKey: 'm.power', at: 1200 }).history;
  h = run(reg, h, 'drag', [{ op: 'set', id: 'm', props: { power: 40 } }], { mergeKey: 'm.power', at: 1400 }).history;
  h = run(reg, h, 'drag', [{ op: 'set', id: 'm', props: { power: 45 } }], { mergeKey: 'm.power', at: 1400 + MERGE_MS + 100 }).history;
  assert.equal(h.past.length, 3);
  h = undo(reg, h).history;
  assert.equal(h.doc.nodes['m']!.props['power'], 40);
  h = undo(reg, h).history;
  assert.equal(h.doc.nodes['m']!.props['power'], 10);
  h = redo(reg, h).history;
  assert.equal(h.doc.nodes['m']!.props['power'], 40);
});

test('selection: replace, add, toggle, and pruning after a removal; selection is not an undo step', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [{ op: 'create', type: 'machine', id: 'a' }, { op: 'create', type: 'machine', id: 'b' }, { op: 'create', type: 'machine', id: 'c' }]).history;
  let s = select(h.doc, { ids: [], primary: null }, ['a'], 'replace');
  s = select(h.doc, s, ['b', 'zzz'], 'add');
  assert.deepEqual(s, { ids: ['a', 'b'], primary: 'b' });
  s = select(h.doc, s, ['a'], 'toggle');
  assert.deepEqual(s, { ids: ['b'], primary: 'b' });
  s = select(h.doc, s, ['c'], 'toggle');
  assert.deepEqual(s, { ids: ['b', 'c'], primary: 'c' });
  h = run(reg, h, 'rm', [{ op: 'remove', id: 'c' }]).history;
  assert.deepEqual(prune(h.doc, s), { ids: ['b'], primary: 'b' });
  assert.equal(h.past.length, 2);
});

test('save and load round-trip; old versions migrate; junk is refused', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [{ op: 'create', type: 'group', id: 'g', name: 'Plot' }, { op: 'create', type: 'machine', id: 'm', parent: 'g', props: { power: 55, tint: '#ff3d8a' } }]).history;
  const saved = JSON.parse(JSON.stringify(save(reg, h.doc))) as Record<string, unknown>;
  const back = load(reg, saved);
  assert.ok(back);
  assert.deepEqual(back.doc, h.doc);
  assert.equal(back.migrated, 0);
  const old = { v: 1, nextId: 1, roots: ['m'], types: { machine: 1 }, nodes: { m: { id: 'm', type: 'machine', name: 'Old', parent: null, children: [], props: { kind: 'mill', watts: 25000, on: false, pos: [1, 2, 3], tint: '#00ff00', feeds: null } } } };
  const up = load(reg, old);
  assert.ok(up);
  assert.equal(up.migrated, 1);
  assert.deepEqual(up.doc.nodes['m']!.props, { kind: 'mill', power: 25, on: false, pos: [1, 2, 3], tint: '#00ff00', feeds: null });
  for (const junk of [null, 42, 'doc', {}, { v: 2 }, { ...saved, roots: ['nope'] }]) assert.equal(load(reg, junk), null);
});

test('performance: ten thousand nodes in one step, then a thousand undos and redos, each under 300 ms', () => {
  let h = createHistory(emptyDoc());
  const ops: Op[] = [{ op: 'create', type: 'group', id: 'root' }];
  for (let i = 0; i < 10000; i++) ops.push({ op: 'create', type: 'machine', parent: 'root', props: { power: i % 100 } });
  let t0 = performance.now();
  h = run(reg, h, 'many', ops).history;
  assert.ok(performance.now() - t0 < 300, `create ${performance.now() - t0} ms`);
  const ids = h.doc.nodes['root']!.children;
  assert.equal(ids.length, 10000);
  for (let i = 0; i < 1000; i++) h = run(reg, h, 'set', [{ op: 'set', id: ids[i]!, props: { on: false } }]).history;
  t0 = performance.now();
  for (let i = 0; i < 1000; i++) h = undo(reg, h).history;
  for (let i = 0; i < 1000; i++) h = redo(reg, h).history;
  assert.ok(performance.now() - t0 < 300, `undo/redo ${performance.now() - t0} ms`);
});

// ---------------------------------------------------------------------------
// Additional tests
// ---------------------------------------------------------------------------

const NOTE_DEF: TypeDef = {
  type: 'note', version: 1,
  props: {
    text: { kind: 'string', maxLength: 5, default: '' },
    count: { kind: 'int', min: 1, max: 9, default: 1 },
    meta: { kind: 'json', default: null },
  },
};
const reg2 = createRegistry([...DEFS, NOTE_DEF]);

test('string, int and json props follow their own rules', () => {
  const d = apply(reg2, emptyDoc(), { op: 'create', type: 'note', id: 'k' }).doc;
  assert.deepEqual(d.nodes['k']!.props, { text: '', count: 1, meta: null });
  assert.equal(check(reg2, d, { op: 'set', id: 'k', props: { text: 'abcdef' } }).ok, false);
  assert.equal(check(reg2, d, { op: 'set', id: 'k', props: { count: 2.5 } }).ok, false);
  assert.equal(check(reg2, d, { op: 'set', id: 'k', props: { count: 10 } }).ok, false);
  assert.equal(check(reg2, d, { op: 'set', id: 'k', props: { meta: { a: [1, 'x', null] } } }).ok, true);
  assert.equal(check(reg2, d, { op: 'set', id: 'k', props: { meta: { a: undefined } } }).ok, false);
  assert.equal(check(reg2, d, { op: 'set', id: 'k', props: { meta: Number.NaN } }).ok, false);
  const m = apply(reg2, d, { op: 'set', id: 'k', props: { meta: { a: [1] } } }).doc;
  assert.deepEqual(m.nodes['k']!.props['meta'], { a: [1] });
});

test('explicit ids are checked, generated ids skip taken ones, and "constructor" is an ordinary id', () => {
  const d = apply(reg, emptyDoc(), { op: 'create', type: 'group', id: 'n1' }).doc;
  assert.equal(check(reg, d, { op: 'create', type: 'group', id: 'n1' }).ok, false);
  assert.equal(check(reg, d, { op: 'create', type: 'group', id: 'bad id!' }).ok, false);
  const r = apply(reg, d, { op: 'create', type: 'group' });
  assert.deepEqual(r.created, ['n2']);
  assert.equal(check(reg, r.doc, { op: 'set', id: 'constructor', props: {} }).ok, false);
  const r2 = apply(reg, r.doc, { op: 'create', type: 'machine', id: 'constructor', props: { feeds: 'n2' } });
  assert.equal(r2.doc.nodes['constructor']!.props['feeds'], 'n2');
  assert.equal(check(reg, r.doc, { op: 'create', type: 'machine', props: { feeds: 'toString' } }).ok, false);
});

test('move indexes count positions after the node leaves its old parent', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [
    { op: 'create', type: 'group', id: 'p' },
    { op: 'create', type: 'group', id: 'a', parent: 'p' },
    { op: 'create', type: 'group', id: 'b', parent: 'p' },
    { op: 'create', type: 'group', id: 'c', parent: 'p' },
  ]).history;
  h = run(reg, h, 'to end', [{ op: 'move', id: 'a', parent: 'p' }]).history;
  assert.deepEqual(h.doc.nodes['p']!.children, ['b', 'c', 'a']);
  assert.equal(check(reg, h.doc, { op: 'move', id: 'a', parent: 'p', index: 3 }).ok, false);
  assert.equal(check(reg, h.doc, { op: 'move', id: 'a', parent: 'p', index: 2 }).ok, true);
  h = run(reg, h, 'to 1', [{ op: 'move', id: 'a', parent: 'p', index: 1 }]).history;
  assert.deepEqual(h.doc.nodes['p']!.children, ['b', 'a', 'c']);
});

test('empty transactions change nothing; undo and redo report what they change', () => {
  const fresh = createHistory(emptyDoc());
  assert.equal(run(reg, fresh, 'nothing', []).history, fresh);
  assert.equal(undo(reg, fresh).history, fresh);
  const made = run(reg, fresh, 'make', [{ op: 'create', type: 'group', id: 'g' }, { op: 'create', type: 'machine', id: 'm', parent: 'g' }]);
  assert.deepEqual(made.changes.filter((c) => c.kind === 'created').map((c) => c.id).sort(), ['g', 'm']);
  const u = undo(reg, made.history);
  assert.deepEqual(u.changes.filter((c) => c.kind === 'removed').map((c) => c.id).sort(), ['g', 'm']);
  assert.deepEqual(u.history.doc, emptyDoc());
  assert.deepEqual(redo(reg, u.history).history.doc, made.history.doc);
});

test('duplicating a node with a ref to itself points the copy at itself', () => {
  let h = run(reg, createHistory(emptyDoc()), 'make', [{ op: 'create', type: 'machine', id: 's' }]).history;
  h = run(reg, h, 'self', [{ op: 'set', id: 's', props: { feeds: 's' } }]).history;
  const r = apply(reg, h.doc, { op: 'duplicate', id: 's' });
  const copy = r.created[0]!;
  assert.equal(r.doc.nodes[copy]!.props['feeds'], copy);
  assert.equal(r.doc.nodes['s']!.props['feeds'], 's');
  assert.deepEqual(r.doc.roots, ['s', copy]);
});

test('select: remove mode and primary fallback', () => {
  const doc = run(reg, createHistory(emptyDoc()), 'make', [
    { op: 'create', type: 'machine', id: 'a' },
    { op: 'create', type: 'machine', id: 'b' },
    { op: 'create', type: 'machine', id: 'c' },
  ]).history.doc;
  let s = select(doc, { ids: [], primary: null }, ['a', 'b', 'c'], 'add');
  assert.deepEqual(s, { ids: ['a', 'b', 'c'], primary: 'c' });
  s = select(doc, s, ['c'], 'remove');
  assert.deepEqual(s, { ids: ['a', 'b'], primary: 'b' });
  assert.deepEqual(select(doc, s, ['zzz'], 'remove'), { ids: ['a', 'b'], primary: 'b' });
  assert.deepEqual(select(doc, s, ['a', 'b'], 'replace'), { ids: ['a', 'b'], primary: 'b' });
  assert.deepEqual(select(doc, { ids: ['a'], primary: 'a' }, ['a'], 'toggle'), { ids: [], primary: null });
});

test('steps merge only for the same key within MERGE_MS', () => {
  let h = createHistory(emptyDoc());
  h = run(reg, h, 'make', [{ op: 'create', type: 'machine', id: 'm' }]).history;
  h = run(reg, h, 'a', [{ op: 'set', id: 'm', props: { power: 20 } }], { mergeKey: 'k', at: 100 }).history;
  h = run(reg, h, 'b', [{ op: 'set', id: 'm', props: { power: 30 } }], { mergeKey: 'j', at: 150 }).history;
  h = run(reg, h, 'c', [{ op: 'set', id: 'm', props: { power: 40 } }], { at: 160 }).history;
  h = run(reg, h, 'd', [{ op: 'set', id: 'm', props: { power: 45 } }], { mergeKey: 'j', at: 160 }).history;
  assert.equal(h.past.length, 5);
  h = run(reg, h, 'e', [{ op: 'set', id: 'm', props: { power: 50 } }], { mergeKey: 'j', at: 170 }).history;
  assert.equal(h.past.length, 5);
  h = undo(reg, h).history;
  assert.equal(h.doc.nodes['m']!.props['power'], 40);
});

test('load refuses cycles, unlisted nodes and newer type versions, and fills defaults', () => {
  const base = {
    v: 1, nextId: 1, roots: ['a'], types: { machine: 2 },
    nodes: {
      a: { id: 'a', type: 'machine', name: 'A', parent: null, children: ['b'], props: {} },
      b: { id: 'b', type: 'machine', name: 'B', parent: 'a', children: [], props: {} },
    },
  };
  const ok = load(reg, base);
  assert.ok(ok);
  assert.equal(ok.migrated, 0);
  assert.deepEqual(ok.doc.nodes['b']!.props, { kind: 'drill', power: 10, on: true, pos: [0, 0, 0], tint: '#ffffff', feeds: null });
  const cyc = {
    v: 1, nextId: 1, roots: [], types: { machine: 2 },
    nodes: {
      a: { id: 'a', type: 'machine', name: 'A', parent: 'b', children: ['b'], props: {} },
      b: { id: 'b', type: 'machine', name: 'B', parent: 'a', children: ['a'], props: {} },
    },
  };
  assert.equal(load(reg, cyc), null);
  const extra = { ...base, nodes: { ...base.nodes, c: { id: 'c', type: 'machine', name: 'C', parent: null, children: [], props: {} } } };
  assert.equal(load(reg, extra), null);
  assert.equal(load(reg, { ...base, types: { machine: 3 } }), null);
  const badProp = { ...base, nodes: { ...base.nodes, a: { ...base.nodes.a, props: { power: 500 } } } };
  assert.equal(load(reg, badProp), null);
});
