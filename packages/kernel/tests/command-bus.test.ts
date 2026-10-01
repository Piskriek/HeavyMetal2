import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmd } from '@hm/contracts';
import type { Preset, PresetDraft, PresetStore } from '@hm/contracts';
import type { Value } from '@hm/contracts';
import type { VariableSystem } from '@hm/contracts';
import { createCommandBus } from '../src/command-bus';

/**
 * Small in-memory fakes. Only the store/vars methods the command bus calls
 * are implemented; they are cast to the full interfaces at the bus boundary.
 */

/** A fake preset store: revisions are numbered per preset id. */
function makeStore(): Pick<PresetStore, 'get' | 'put' | 'fork' | 'remove'> & {
  list(): readonly Preset[];
} {
  const presets = new Map<string, Preset>();
  const revisions = new Map<string, number>();
  let nextId = 1;

  function put(draft: PresetDraft): Preset {
    const id = draft.id ?? `p${nextId}`;
    nextId += 1;
    const revision = (revisions.get(id) ?? 0) + 1;
    revisions.set(id, revision);
    const preset: Preset = {
      id,
      kind: draft.kind,
      name: draft.name,
      revision,
      hash: `${id}@${revision}`,
      forkOf: draft.forkOf,
      params: draft.params ?? {},
      children: draft.children ?? {},
      script: draft.script,
      tags: draft.tags ?? [],
      tier: draft.tier ?? 'play',
      meta: { createdAt: 0, ...draft.meta },
    };
    presets.set(id, preset);
    return preset;
  }

  function get(id: string): Preset | undefined {
    return presets.get(id);
  }

  function fork(id: string, patch?: Partial<PresetDraft>): Preset {
    const source = presets.get(id);
    if (source === undefined) {
      throw new Error(`fork: preset "${id}" does not exist`);
    }
    return put({
      kind: source.kind,
      name: `${source.name} (fork)`,
      forkOf: { ref: source.id },
      params: source.params,
      children: source.children,
      script: source.script,
      tags: source.tags,
      tier: source.tier,
      meta: source.meta,
      ...patch,
    });
  }

  function remove(id: string): void {
    presets.delete(id);
    revisions.delete(id);
  }

  return { get, put, fork, remove, list: () => [...presets.values()] };
}

/** A fake variable system: write puts a new revision with the param set. */
function makeVars(
  store: Pick<PresetStore, 'get' | 'put'>,
): Pick<VariableSystem, 'read' | 'write'> {
  function read(path: string): Value | undefined {
    const dot = path.indexOf('.');
    if (dot < 0) {
      return undefined;
    }
    const preset = store.get(path.slice(0, dot));
    if (preset === undefined) {
      return undefined;
    }
    return preset.params[path.slice(dot + 1)];
  }

  function write(path: string, value: Value): void {
    const dot = path.indexOf('.');
    if (dot < 0) {
      throw new Error(`vars.write: path "${path}" must be "<presetId>.<param key>"`);
    }
    const id = path.slice(0, dot);
    const key = path.slice(dot + 1);
    const preset = store.get(id);
    if (preset === undefined) {
      throw new Error(`vars.write: preset "${id}" does not exist`);
    }
    store.put({
      id: preset.id,
      kind: preset.kind,
      name: preset.name,
      forkOf: preset.forkOf,
      params: { ...preset.params, [key]: value },
      children: preset.children,
      script: preset.script,
      tags: preset.tags,
      tier: preset.tier,
      meta: preset.meta,
    });
  }

  return { read, write };
}

/** Wires a fresh bus over fresh fakes; `maxHistory` is optional. */
function makeBus(maxHistory?: number) {
  const store = makeStore();
  const vars = makeVars(store);
  const commands = createCommandBus({
    store: store as PresetStore,
    vars: vars as VariableSystem,
    maxHistory,
  });
  return { store, vars, commands };
}

test('set-param writes through vars, touches the preset, undo restores, redo re-applies', () => {
  const { store, vars, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R', params: { weight: 3 } });
  const res = commands.execute(cmd.setParam(`${r.id}.weight`, 6, 'Heavier'));
  assert.equal(res.ok, true);
  assert.deepEqual(res.touched, [r.id]);
  assert.equal(vars.read(`${r.id}.weight`), 6);
  assert.equal(store.get(r.id)!.params['weight'], 6);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${r.id}.weight`), 3);
  assert.equal(commands.redo(), true);
  assert.equal(vars.read(`${r.id}.weight`), 6);
});

test('set-param fails cleanly on a missing preset or a malformed path', () => {
  const { store, vars, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  const bad = commands.execute(cmd.setParam('ghost.weight', 1));
  assert.equal(bad.ok, false);
  assert.ok(bad.error?.includes('ghost'));
  assert.deepEqual(bad.touched, []);
  const bad2 = commands.execute(cmd.setParam('no-dot', 1));
  assert.equal(bad2.ok, false);
  assert.ok(bad2.error);
  assert.equal(vars.read(`${r.id}.weight`), undefined);
  assert.equal(commands.canUndo, false);
});

test('set-param inverse removes a param the preset never declared itself', () => {
  const { store, vars, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  assert.equal(vars.read(`${r.id}.weight`), undefined);
  commands.execute(cmd.setParam(`${r.id}.weight`, 9, 'Set'));
  assert.equal(vars.read(`${r.id}.weight`), 9);
  commands.undo();
  assert.equal(vars.read(`${r.id}.weight`), undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(store.get(r.id)!.params, 'weight'), false);
});

test('put-preset creates a preset and undo removes it; redo recreates one', () => {
  const { store, commands } = makeBus();
  const res = commands.execute(cmd.put({ kind: 'racer', name: 'R' }, 'Create'));
  assert.equal(res.ok, true);
  assert.equal(store.list().length, 1);
  const id = res.touched[0]!;
  assert.equal(commands.undo(), true);
  assert.equal(store.get(id), undefined);
  assert.equal(store.list().length, 0);
  assert.equal(commands.redo(), true);
  assert.equal(store.list().length, 1);
});

test('put-preset updates an existing preset and undo restores the previous content', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R', params: { speed: 1 } });
  const before = store.get(r.id)!;
  commands.execute(cmd.put({ id: r.id, kind: 'racer', name: 'R2', params: { speed: 2 } }, 'Rename'));
  assert.equal(store.get(r.id)!.name, 'R2');
  assert.equal(store.get(r.id)!.revision, before.revision + 1);
  commands.undo();
  assert.equal(store.get(r.id)!.name, 'R');
  assert.equal(store.get(r.id)!.params['speed'], 1);
});

test('fork-preset forks an existing preset and undo removes the fork', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  const res = commands.execute({ type: 'fork-preset', payload: { id: r.id }, label: 'Fork' });
  assert.equal(res.ok, true);
  const forkId = res.touched[0]!;
  assert.notEqual(forkId, r.id);
  assert.equal(store.get(forkId)!.forkOf!.ref, r.id);
  assert.equal(commands.undo(), true);
  assert.equal(store.get(forkId), undefined);
});

test('fork-preset accepts a patch and fails on a missing source', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  const patched = commands.execute({
    type: 'fork-preset',
    payload: { id: r.id, patch: { name: 'Fast' } },
    label: 'Fork',
  });
  assert.equal(patched.ok, true);
  assert.equal(store.get(patched.touched[0]!)!.name, 'Fast');
  const bad = commands.execute({ type: 'fork-preset', payload: { id: 'ghost' }, label: 'Fork' });
  assert.equal(bad.ok, false);
  assert.ok(bad.error?.includes('ghost'));
  assert.deepEqual(bad.touched, []);
});

test('add-child inserts at the end by default and undo removes it', () => {
  const { store, commands } = makeBus();
  const m = store.put({ kind: 'mechanic', name: 'M' });
  const r = store.put({ kind: 'racer', name: 'R' });
  commands.execute(cmd.addChild(r.id, 'mechanics', m.id));
  assert.deepEqual(store.get(r.id)!.children['mechanics'], [{ ref: m.id }]);
  commands.undo();
  assert.deepEqual(store.get(r.id)!.children['mechanics'] ?? [], []);
});

test('add-child inserts at a given index and the inverse remove-child re-adds it', () => {
  const { store, commands } = makeBus();
  const a = store.put({ kind: 'mechanic', name: 'A' });
  const b = store.put({ kind: 'mechanic', name: 'B' });
  const r = store.put({ kind: 'racer', name: 'R' });
  commands.execute(cmd.addChild(r.id, 'mechanics', a.id));
  commands.execute(cmd.addChild(r.id, 'mechanics', b.id));
  assert.deepEqual(store.get(r.id)!.children['mechanics'], [{ ref: a.id }, { ref: b.id }]);
  commands.execute(cmd.addChild(r.id, 'mechanics', a.id, 0));
  assert.deepEqual(store.get(r.id)!.children['mechanics'], [{ ref: a.id }, { ref: a.id }, { ref: b.id }]);
  commands.undo();
  assert.deepEqual(store.get(r.id)!.children['mechanics'], [{ ref: a.id }, { ref: b.id }]);
});

test('add-child fails when the child preset does not exist', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  const before = store.get(r.id)!.revision;
  const bad = commands.execute(cmd.addChild(r.id, 'mechanics', 'ghost'));
  assert.equal(bad.ok, false);
  assert.ok(bad.error?.includes('ghost'));
  assert.equal(store.get(r.id)!.revision, before);
  assert.equal(commands.undo(), false);
});

test('remove-child removes the ref at the index and undo re-adds it', () => {
  const { store, commands } = makeBus();
  const m = store.put({ kind: 'mechanic', name: 'M' });
  const r = store.put({ kind: 'racer', name: 'R', children: { mechanics: [{ ref: m.id }] } });
  commands.execute(cmd.removeChild(r.id, 'mechanics', 0));
  assert.deepEqual(store.get(r.id)!.children['mechanics'] ?? [], []);
  commands.undo();
  assert.deepEqual(store.get(r.id)!.children['mechanics'], [{ ref: m.id }]);
});

test('remove-child fails on an out-of-range index without changes', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  const bad = commands.execute(cmd.removeChild(r.id, 'mechanics', 0));
  assert.equal(bad.ok, false);
  assert.ok(bad.error);
  assert.deepEqual(bad.touched, []);
  assert.equal(commands.canUndo, false);
});

test('set-script sets the script; undo removes it when there was none', () => {
  const { store, commands } = makeBus();
  const m = store.put({ kind: 'mechanic', name: 'M' });
  const res = commands.execute(cmd.setScript(m.id, 'export function update() {}'));
  assert.equal(res.ok, true);
  assert.deepEqual(store.get(m.id)!.script, {
    language: 'ts',
    source: 'export function update() {}',
    apiVersion: 1,
  });
  commands.undo();
  assert.equal(store.get(m.id)!.script, undefined);
});

test('set-script restores the previous script on undo when there was one', () => {
  const { store, commands } = makeBus();
  const m = store.put({
    kind: 'mechanic',
    name: 'M',
    script: { language: 'ts', source: 'old', apiVersion: 1 },
  });
  commands.execute(cmd.setScript(m.id, 'new'));
  assert.equal(store.get(m.id)!.script!.source, 'new');
  commands.undo();
  assert.equal(store.get(m.id)!.script!.source, 'old');
});

test('unknown command types fail without throwing or changing anything', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  const res = commands.execute({ type: 'no-such', payload: {}, label: 'x' });
  assert.equal(res.ok, false);
  assert.ok(res.error);
  assert.deepEqual(res.touched, []);
  assert.equal(store.get(r.id)!.revision, 1);
  assert.equal(commands.undo(), false);
});

test('a handler that throws is reported as a failure and changes nothing', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  commands.registerHandler('boom', {
    apply: () => {
      throw new Error('kaboom');
    },
  });
  const res = commands.execute({ type: 'boom', payload: {}, label: 'Boom' });
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes('kaboom'));
  assert.deepEqual(res.touched, []);
  assert.equal(store.get(r.id)!.revision, 1);
});

test('batch runs its commands in order and undoes as one step in reverse', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R', params: { a: 0, b: 0, c: 0 } });
  const res = commands.execute(
    cmd.batch(
      [cmd.setParam(`${r.id}.a`, 1), cmd.setParam(`${r.id}.b`, 2), cmd.setParam(`${r.id}.c`, 3)],
      'Batch',
    ),
  );
  assert.equal(res.ok, true);
  assert.deepEqual(res.touched, [r.id]);
  assert.equal(store.get(r.id)!.params['a'], 1);
  assert.equal(store.get(r.id)!.params['c'], 3);
  assert.equal(commands.undo(), true);
  assert.equal(store.get(r.id)!.params['a'], 0);
  assert.equal(store.get(r.id)!.params['b'], 0);
  assert.equal(store.get(r.id)!.params['c'], 0);
});

test('batch rolls back the steps it already ran when one step fails', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R', params: { a: 0 } });
  const res = commands.execute(
    cmd.batch([cmd.setParam(`${r.id}.a`, 5), cmd.setParam('ghost.b', 5)], 'Partial'),
  );
  assert.equal(res.ok, false);
  assert.ok(res.error?.includes('step 1'));
  assert.equal(store.get(r.id)!.params['a'], 0);
  assert.equal(commands.canUndo, false);
});

test('transaction collapses into one undo step and nesting joins the outer label', () => {
  const { store, vars, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R', params: { a: 0 } });
  commands.transaction('Outer', () => {
    commands.execute(cmd.setParam(`${r.id}.a`, 1));
    commands.transaction('Inner', () => {
      commands.execute(cmd.setParam(`${r.id}.a`, 2));
    });
    commands.execute(cmd.setParam(`${r.id}.a`, 3));
  });
  assert.equal(vars.read(`${r.id}.a`), 3);
  assert.equal(commands.history().length, 1);
  assert.equal(commands.history()[0]!.label, 'Outer');
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${r.id}.a`), 0);
});

test('transaction undoes everything and rethrows when the callback throws', () => {
  const { store, vars, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R', params: { a: 0 } });
  assert.throws(
    () =>
      commands.transaction('Boom', () => {
        commands.execute(cmd.setParam(`${r.id}.a`, 1));
        throw new Error('nope');
      }),
    /nope/,
  );
  assert.equal(vars.read(`${r.id}.a`), 0);
  assert.equal(commands.canUndo, false);
  assert.deepEqual(commands.history(), []);
});

test('maxHistory drops the oldest undo steps', () => {
  const { commands } = makeBus(3);
  for (let i = 1; i <= 5; i++) {
    commands.execute(cmd.put({ kind: 'racer', name: `R${i}` }, `Put ${i}`));
  }
  assert.equal(commands.history().length, 3);
  assert.deepEqual(commands.history().map((h) => h.label), ['Put 3', 'Put 4', 'Put 5']);
  assert.equal(commands.undo(), true);
  assert.equal(commands.history().length, 3);
  assert.equal(commands.history()[2]!.undone, true);
});

test('subscribe sees every executed command with its result', () => {
  const { store, commands } = makeBus();
  const r = store.put({ kind: 'racer', name: 'R' });
  const seen: string[] = [];
  commands.subscribe((c, res) => seen.push(`${c.type}:${res.ok}`));
  commands.execute(cmd.setParam(`${r.id}.x`, 1, 'ok'));
  commands.execute(cmd.setParam('ghost.x', 1, 'bad'));
  assert.deepEqual(seen, ['set-param:true', 'set-param:false']);
});

test('a custom handler with a null inverse executes but cannot be undone', () => {
  const { commands } = makeBus();
  commands.registerHandler('custom', {
    apply: () => ({ result: { ok: true, touched: [] }, inverse: null }),
  });
  const res = commands.execute({ type: 'custom', payload: {}, label: 'c' });
  assert.equal(res.ok, true);
  assert.equal(commands.canUndo, false);
  assert.equal(commands.undo(), false);
  assert.equal(commands.canRedo, false);
});

test('registerHandler can override a standard command type', () => {
  const { commands } = makeBus();
  commands.registerHandler('set-param', {
    apply: () => ({ result: { ok: true, touched: ['overridden'] }, inverse: null }),
  });
  const res = commands.execute(cmd.setParam('anything.x', 1, 'Overridden'));
  assert.equal(res.ok, true);
  assert.deepEqual(res.touched, ['overridden']);
  assert.equal(commands.undo(), false);
});

test('redo replays the original command after undo', () => {
  const { store, commands } = makeBus();
  const m = store.put({ kind: 'mechanic', name: 'M' });
  const r = store.put({ kind: 'racer', name: 'R' });
  commands.execute(cmd.addChild(r.id, 'mechanics', m.id));
  commands.execute(cmd.setScript(m.id, 'x'));
  commands.undo();
  assert.equal(store.get(m.id)!.script, undefined);
  commands.undo();
  assert.deepEqual(store.get(r.id)!.children['mechanics'] ?? [], []);
  commands.redo();
  commands.redo();
  assert.deepEqual(store.get(r.id)!.children['mechanics'], [{ ref: m.id }]);
  assert.equal(store.get(m.id)!.script!.source, 'x');
});
