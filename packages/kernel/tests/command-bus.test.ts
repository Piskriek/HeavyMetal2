import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cmd } from '@hm/contracts';
import type { Command, CommandBus, CommandHandler, CommandResult } from '@hm/contracts';
import type { Params, PresetId, Value } from '@hm/contracts';
import type { Preset, PresetDraft, PresetStore } from '@hm/contracts';
import type { VariableSystem } from '@hm/contracts';
import { createCommandBus } from '../src/command-bus';

/* ------------------------------------------------------------------- fakes */

/** The store methods the command bus actually calls. */
type UsedStore = Pick<PresetStore, 'get' | 'put' | 'fork' | 'remove'>;

/** Fails loudly if the bus ever reaches a store method these tests do not use. */
function notUsed(method: string): never {
  throw new Error(`fake store: ${method}() is not used by the command bus`);
}

/** The rest of PresetStore: present so the fake satisfies the interface, never called. */
const unusedStore: Omit<PresetStore, keyof UsedStore> = {
  limits: { maxDepth: 8, maxNodes: 1000, maxBundleBytes: 1_000_000 },
  list: () => notUsed('list'),
  resolve: () => notUsed('resolve'),
  dependents: () => notUsed('dependents'),
  validate: () => notUsed('validate'),
  exportBundle: () => notUsed('exportBundle'),
  importBundle: () => notUsed('importBundle'),
  subscribe: () => notUsed('subscribe'),
};

/** Completes the four methods the bus uses into a full PresetStore. */
function storeFrom(used: UsedStore): PresetStore {
  return { ...unusedStore, ...used };
}

/** Copies every field of a preset revision into a draft the fake store can put back. */
function draftOf(preset: Preset): PresetDraft {
  return {
    id: preset.id,
    kind: preset.kind,
    name: preset.name,
    forkOf: preset.forkOf,
    params: preset.params,
    children: preset.children,
    script: preset.script,
    tags: preset.tags,
    tier: preset.tier,
    meta: preset.meta,
  };
}

/**
 * A tiny in-memory store. A put replaces the whole preset from the draft (missing optional fields
 * fall back to their defaults) and keeps the older revisions readable, like the real one does.
 */
function createFakeStore(): PresetStore {
  const revisions = new Map<PresetId, Preset[]>();
  let seq = 0;

  const nextId = (): PresetId => {
    seq += 1;
    return `p${seq}`;
  };

  const build = (draft: PresetDraft, id: PresetId, revision: number): Preset => {
    const meta = draft.meta ?? {};
    return {
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
      meta: {
        author: meta.author,
        createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : revision,
        doc: meta.doc,
        icon: meta.icon,
      },
    };
  };

  const get = (id: PresetId, rev?: number): Preset | undefined => {
    const list = revisions.get(id);
    if (list === undefined) return undefined;
    if (rev === undefined) return list[list.length - 1];
    return list.find((preset) => preset.revision === rev);
  };

  const put = (draft: PresetDraft): Preset => {
    const id = draft.id ?? nextId();
    const older = revisions.get(id) ?? [];
    const preset = build(draft, id, older.length + 1);
    revisions.set(id, [...older, preset]);
    return preset;
  };

  const fork = (id: PresetId, patch?: Partial<PresetDraft>): Preset => {
    const source = get(id);
    if (source === undefined) throw new Error(`fake store: cannot fork unknown preset "${id}"`);
    const forkId = nextId();
    return put({ ...draftOf(source), id: forkId, forkOf: { ref: id, rev: source.revision }, ...(patch ?? {}) });
  };

  const remove = (id: PresetId): void => {
    revisions.delete(id);
  };

  return storeFrom({ get, put, fork, remove });
}

/** Reports whether a stored value is a plain param group rather than a ref, an expression or a list. */
function isGroup(value: Value | undefined): value is Readonly<Record<string, Value>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return !('ref' in value) && !('expr' in value);
}

/** Reads a possibly dotted key out of a param tree; undefined when nothing is stored there. */
function readParam(params: Params, key: string): Value | undefined {
  let current: Value | undefined = params;
  for (const part of key.split('.')) {
    if (!isGroup(current)) return undefined;
    current = current[part];
  }
  return current;
}

/** Writes a possibly dotted key into a param tree, copying the groups it passes through. */
function writeParam(params: Params, key: string, value: Value): Params {
  const parts = key.split('.');
  const head = parts[0];
  if (head === undefined) return params;
  if (parts.length === 1) return { ...params, [head]: value };
  const child = params[head];
  return { ...params, [head]: writeParam(isGroup(child) ? child : {}, parts.slice(1).join('.'), value) };
}

/** A tiny variable system: own params first, then the fork chain, then the schema defaults. */
function createFakeVars(store: PresetStore, defaults: Readonly<Record<string, Value>>): VariableSystem {
  const split = (path: string): { id: PresetId; key: string } => {
    const dot = path.indexOf('.');
    if (dot < 1) throw new Error(`fake vars: "${path}" is not a "<presetId>.<param key>" path`);
    return { id: path.slice(0, dot), key: path.slice(dot + 1) };
  };

  const read = (path: string): Value | undefined => {
    const { id, key } = split(path);
    let current = store.get(id);
    for (let hop = 0; current !== undefined && hop < 16; hop += 1) {
      const own = readParam(current.params, key);
      if (own !== undefined) return own;
      const parent = current.forkOf;
      current = parent === undefined ? undefined : store.get(parent.ref, parent.rev);
    }
    return defaults[key];
  };

  const write = (path: string, value: Value): void => {
    const { id, key } = split(path);
    const preset = store.get(id);
    if (preset === undefined) throw new Error(`fake vars: cannot write "${path}", preset "${id}" does not exist`);
    store.put({ ...draftOf(preset), params: writeParam(preset.params, key, value) });
  };

  return { read, write } as unknown as VariableSystem;
}

/** Everything one test needs, with two presets already in the store. */
type Harness = {
  readonly store: PresetStore;
  readonly vars: VariableSystem;
  readonly commands: CommandBus;
  readonly racer: Preset;
  readonly mechanic: Preset;
};

/** Builds a fake store, a fake variable system over it, and a bus wired to both. */
function setup(maxHistory?: number): Harness {
  const store = createFakeStore();
  const vars = createFakeVars(store, { weight: 5, bounce: 5, 'grip.rolling': 0.8, power: 20 });
  const commands = createCommandBus(maxHistory === undefined ? { store, vars } : { store, vars, maxHistory });
  const mechanic = store.put({ kind: 'mechanic', name: 'Spanner', params: { power: 20 } });
  const racer = store.put({ kind: 'racer', name: 'Rocket', params: { weight: 3 }, tags: ['fast'], tier: 'pro' });
  return { store, vars, commands, racer, mechanic };
}

/* ---------------------------------------------------------------- set-param */

test('set-param writes through vars and reports the preset it revised', () => {
  const { store, vars, commands, racer } = setup();
  const result = commands.execute(cmd.setParam(`${racer.id}.weight`, 6, 'Heavier'));
  assert.deepEqual(result, { ok: true, touched: [racer.id] });
  assert.equal(vars.read(`${racer.id}.weight`), 6);
  assert.equal(store.get(racer.id)?.revision, 2);
});

test('set-param undo restores the stored value and redo applies the command again', () => {
  const { vars, commands, racer } = setup();
  const path = `${racer.id}.weight`;
  commands.execute(cmd.setParam(path, 6, 'Heavier'));
  assert.equal(commands.canUndo, true);
  assert.equal(commands.canRedo, false);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(path), 3);
  assert.equal(commands.canRedo, true);
  assert.equal(commands.redo(), true);
  assert.equal(vars.read(path), 6);
  assert.equal(commands.canRedo, false);
});

test('set-param undo removes a param the preset never stored itself', () => {
  const { store, vars, commands, racer } = setup();
  const path = `${racer.id}.bounce`;
  assert.equal(vars.read(path), 5, 'bounce comes from the defaults before the write');
  commands.execute(cmd.setParam(path, 1, 'Bouncy'));
  assert.equal(vars.read(path), 1);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(path), 5, 'the default shows through again');
  assert.equal('bounce' in (store.get(racer.id)?.params ?? {}), false, 'the param was removed, not zeroed');
});

test('set-param keeps every other field of the preset', () => {
  const { store, commands, racer, mechanic } = setup();
  commands.execute(cmd.setScript(racer.id, 'export const a = 1;'));
  commands.execute(cmd.addChild(racer.id, 'mechanics', mechanic.id));
  commands.execute(cmd.setParam(`${racer.id}.weight`, 9));
  const after = store.get(racer.id);
  assert.equal(after?.name, 'Rocket');
  assert.equal(after?.kind, 'racer');
  assert.equal(after?.tier, 'pro');
  assert.deepEqual(after?.tags, ['fast']);
  assert.deepEqual(after?.children['mechanics'], [{ ref: mechanic.id }]);
  assert.equal(after?.script?.source, 'export const a = 1;');
  assert.equal(after?.forkOf, undefined);
});

test('set-param splits the path at the first dot only, so nested keys work', () => {
  const { store, vars, commands, racer } = setup();
  const path = `${racer.id}.grip.rolling`;
  assert.equal(vars.read(path), 0.8);
  commands.execute(cmd.setParam(path, 0.95, 'Grippier'));
  assert.equal(vars.read(path), 0.95);
  assert.deepEqual(store.get(racer.id)?.params['grip'], { rolling: 0.95 });
  assert.equal(store.get(`${racer.id}.grip`), undefined, 'the preset id is not split at the second dot');
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(path), 0.8);
  assert.equal(store.get(racer.id)?.params['grip'], undefined);
});

test('set-param fails on a malformed path, an unknown preset and an unstorable value', () => {
  const { store, commands, racer } = setup();
  const before = store.get(racer.id)?.revision;
  const cases: readonly Command[] = [
    cmd.setParam('no-dot-here', 1),
    cmd.setParam(`${racer.id}.`, 1),
    cmd.setParam('.weight', 1),
    cmd.setParam('ghost.weight', 1),
    { type: 'set-param', payload: { path: `${racer.id}.weight`, value: Number.NaN }, label: 'not a number' },
    { type: 'set-param', payload: { value: 1 }, label: 'no path' },
  ];
  for (const command of cases) {
    const result = commands.execute(command);
    assert.equal(result.ok, false, `the "${command.label}" command should fail`);
    assert.ok(result.error, 'a failed command says what was wrong');
    assert.deepEqual(result.touched, []);
  }
  assert.equal(store.get(racer.id)?.revision, before, 'no failed command revised anything');
  assert.equal(commands.canUndo, false);
  assert.deepEqual(commands.history(), []);
});

/* --------------------------------------------------------------- put-preset */

test('put-preset creates a preset and undo deletes it again', () => {
  const { store, commands } = setup();
  const result = commands.execute(cmd.put({ kind: 'racer', name: 'Comet' }, 'Add Comet'));
  assert.equal(result.ok, true);
  const id = result.touched[0] ?? '';
  assert.notEqual(id, '');
  assert.equal(store.get(id)?.name, 'Comet');
  assert.equal(commands.undo(), true);
  assert.equal(store.get(id), undefined);
  assert.equal(commands.redo(), true);
  assert.equal(store.get(id), undefined, 'redo re-runs the original create, which mints a fresh id');
});

test('put-preset revises an existing preset and undo restores the previous revision', () => {
  const { store, commands, racer } = setup();
  commands.execute(cmd.setScript(racer.id, 'export const a = 1;'));
  const result = commands.execute(cmd.put({ id: racer.id, kind: 'racer', name: 'Renamed' }, 'Rename'));
  assert.deepEqual(result, { ok: true, touched: [racer.id] });
  assert.equal(store.get(racer.id)?.name, 'Renamed');
  assert.equal(store.get(racer.id)?.script, undefined);
  assert.equal(commands.undo(), true);
  const restored = store.get(racer.id);
  assert.equal(restored?.name, 'Rocket');
  assert.equal(restored?.script?.source, 'export const a = 1;');
  assert.deepEqual(restored?.params, { weight: 3 });
  assert.deepEqual(restored?.tags, ['fast']);
});

test('put-preset fails without a usable draft', () => {
  const { commands } = setup();
  assert.equal(commands.execute({ type: 'put-preset', payload: {}, label: 'nothing' }).ok, false);
  assert.equal(commands.execute(cmd.put({ kind: 'racer' } as unknown as PresetDraft)).ok, false);
  assert.equal(commands.canUndo, false);
});

/* -------------------------------------------------------------- fork-preset */

test('fork-preset copies through the store and undo deletes the fork', () => {
  const { store, commands, racer } = setup();
  const command: Command = { type: 'fork-preset', payload: { id: racer.id, patch: { name: 'Rocket II' } }, label: 'Fork' };
  const result = commands.execute(command);
  assert.equal(result.ok, true);
  const forkId = result.touched[0] ?? '';
  const fork = store.get(forkId);
  assert.equal(fork?.name, 'Rocket II');
  assert.deepEqual(fork?.forkOf, { ref: racer.id, rev: racer.revision });
  assert.deepEqual(fork?.params, { weight: 3 }, 'the fork starts from the source params');
  assert.equal(commands.undo(), true);
  assert.equal(store.get(forkId), undefined);
  assert.equal(store.get(racer.id)?.name, 'Rocket', 'the source is untouched');
});

test('fork-preset fails for an unknown source or a bad payload', () => {
  const { commands } = setup();
  const unknown = commands.execute({ type: 'fork-preset', payload: { id: 'ghost' }, label: 'Fork ghost' });
  assert.equal(unknown.ok, false);
  assert.match(unknown.error ?? '', /ghost/);
  assert.equal(commands.execute({ type: 'fork-preset', payload: {}, label: 'no id' }).ok, false);
  assert.equal(commands.execute({ type: 'fork-preset', payload: { id: 'p2', patch: 3 }, label: 'bad patch' }).ok, false);
  assert.equal(commands.canUndo, false);
});

/* ------------------------------------------------- add-child / remove-child */

test('add-child appends a bare ref and undo removes it', () => {
  const { store, commands, racer, mechanic } = setup();
  const result = commands.execute(cmd.addChild(racer.id, 'mechanics', mechanic.id, undefined, 'Attach'));
  assert.deepEqual(result, { ok: true, touched: [racer.id] });
  assert.deepEqual(store.get(racer.id)?.children['mechanics'], [{ ref: mechanic.id }]);
  assert.equal(commands.undo(), true);
  assert.deepEqual(store.get(racer.id)?.children['mechanics'] ?? [], []);
  assert.equal(commands.redo(), true);
  assert.deepEqual(store.get(racer.id)?.children['mechanics'], [{ ref: mechanic.id }]);
});

test('add-child honours the index and undo removes exactly that entry', () => {
  const { store, commands, racer } = setup();
  const a = store.put({ kind: 'mechanic', name: 'A' });
  const b = store.put({ kind: 'mechanic', name: 'B' });
  const c = store.put({ kind: 'mechanic', name: 'C' });
  commands.execute(cmd.addChild(racer.id, 'mechanics', a.id));
  commands.execute(cmd.addChild(racer.id, 'mechanics', c.id));
  commands.execute(cmd.addChild(racer.id, 'mechanics', b.id, 1, 'Insert in the middle'));
  assert.deepEqual(store.get(racer.id)?.children['mechanics'], [{ ref: a.id }, { ref: b.id }, { ref: c.id }]);
  assert.equal(commands.undo(), true);
  assert.deepEqual(store.get(racer.id)?.children['mechanics'], [{ ref: a.id }, { ref: c.id }]);
});

test('add-child fails when the child does not exist and changes nothing', () => {
  const { store, commands, racer } = setup();
  const before = store.get(racer.id)?.revision;
  const result = commands.execute(cmd.addChild(racer.id, 'mechanics', 'ghost'));
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /child preset "ghost" does not exist/);
  assert.deepEqual(result.touched, []);
  assert.equal(store.get(racer.id)?.revision, before);
  assert.equal(commands.canUndo, false);
});

test('add-child and remove-child fail for an unknown parent', () => {
  const { commands } = setup();
  const added = commands.execute(cmd.addChild('ghost', 'mechanics', 'p1'));
  assert.equal(added.ok, false);
  assert.match(added.error ?? '', /parent preset "ghost" does not exist/);
  const removed = commands.execute(cmd.removeChild('ghost', 'mechanics', 0));
  assert.equal(removed.ok, false);
  assert.match(removed.error ?? '', /does not exist/);
});

test('remove-child takes the ref out and undo puts it back at the same index', () => {
  const { store, commands, racer } = setup();
  const a = store.put({ kind: 'mechanic', name: 'A' });
  const b = store.put({ kind: 'mechanic', name: 'B' });
  commands.execute(cmd.addChild(racer.id, 'mechanics', a.id));
  commands.execute(cmd.addChild(racer.id, 'mechanics', b.id));
  const result = commands.execute(cmd.removeChild(racer.id, 'mechanics', 0, 'Detach A'));
  assert.deepEqual(result, { ok: true, touched: [racer.id] });
  assert.deepEqual(store.get(racer.id)?.children['mechanics'], [{ ref: b.id }]);
  assert.equal(commands.undo(), true);
  assert.deepEqual(store.get(racer.id)?.children['mechanics'], [{ ref: a.id }, { ref: b.id }]);
});

test('remove-child fails for an index that is not there', () => {
  const { store, commands, racer } = setup();
  const before = store.get(racer.id)?.revision;
  const result = commands.execute(cmd.removeChild(racer.id, 'mechanics', 0));
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /no child at index 0/);
  assert.equal(store.get(racer.id)?.revision, before);
  assert.equal(commands.execute({ type: 'remove-child', payload: { parent: racer.id, slot: 'mechanics' }, label: 'no index' }).ok, false);
  assert.equal(commands.canUndo, false);
});

/* --------------------------------------------------------------- set-script */

test('set-script stores a ts script and undo removes it again', () => {
  const { store, commands, mechanic } = setup();
  const result = commands.execute(cmd.setScript(mechanic.id, 'export function update() {}'));
  assert.deepEqual(result, { ok: true, touched: [mechanic.id] });
  assert.deepEqual(store.get(mechanic.id)?.script, { language: 'ts', source: 'export function update() {}', apiVersion: 1 });
  assert.equal(commands.undo(), true);
  assert.equal(store.get(mechanic.id)?.script, undefined);
  assert.equal(store.get(mechanic.id)?.name, 'Spanner', 'nothing else moved');
});

test('set-script undo restores the previous script and keeps the params', () => {
  const { store, commands, racer } = setup();
  commands.execute(cmd.setScript(racer.id, 'const first = 1;'));
  commands.execute(cmd.setScript(racer.id, 'const second = 2;', 'Second'));
  assert.equal(store.get(racer.id)?.script?.source, 'const second = 2;');
  assert.equal(commands.undo(), true);
  assert.equal(store.get(racer.id)?.script?.source, 'const first = 1;');
  assert.deepEqual(store.get(racer.id)?.params, { weight: 3 });
  assert.equal(commands.execute(cmd.setScript('ghost', 'x')).ok, false);
});

/* ------------------------------------------------------------------- batch */

test('batch runs its commands in order as one undo step', () => {
  const { store, vars, commands, racer } = setup();
  const result = commands.execute(cmd.batch([cmd.setParam(`${racer.id}.weight`, 1), cmd.setParam(`${racer.id}.bounce`, 2)], 'Both'));
  assert.deepEqual(result, { ok: true, touched: [racer.id] });
  assert.deepEqual(commands.history().map((entry) => entry.label), ['Both']);
  assert.equal(vars.read(`${racer.id}.weight`), 1);
  assert.equal(vars.read(`${racer.id}.bounce`), 2);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 3);
  assert.equal(vars.read(`${racer.id}.bounce`), 5);
  assert.equal('bounce' in (store.get(racer.id)?.params ?? {}), false);
  assert.equal(commands.redo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 1);
  assert.equal(vars.read(`${racer.id}.bounce`), 2);
});

test('batch reports which command failed and rolls the earlier ones back', () => {
  const { store, vars, commands, racer } = setup();
  const result = commands.execute(
    cmd.batch([cmd.setParam(`${racer.id}.weight`, 1), cmd.addChild(racer.id, 'mechanics', 'ghost')], 'Broken'),
  );
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /command 2 of 2/);
  assert.match(result.error ?? '', /ghost/);
  assert.deepEqual(result.touched, []);
  assert.equal(vars.read(`${racer.id}.weight`), 3, 'the first command was rolled back');
  assert.deepEqual(store.get(racer.id)?.params, { weight: 3 }, 'the preset is back to the content it had');
  assert.equal(commands.canUndo, false);
});

test('batch reports every preset it touched once, in order', () => {
  const { store, commands, racer, mechanic } = setup();
  const result = commands.execute(
    cmd.batch(
      [cmd.setParam(`${racer.id}.weight`, 2), cmd.setScript(mechanic.id, 'export const b = 1;'), cmd.setParam(`${racer.id}.weight`, 3)],
      'Mixed',
    ),
  );
  assert.deepEqual(result.touched, [racer.id, mechanic.id]);
  assert.equal(store.get(mechanic.id)?.script?.source, 'export const b = 1;');
  assert.equal(commands.undo(), true);
  assert.equal(store.get(mechanic.id)?.script, undefined);
  assert.deepEqual(store.get(racer.id)?.params, { weight: 3 });
});

test('batch fails when its payload is not a list of commands', () => {
  const { commands } = setup();
  assert.equal(commands.execute({ type: 'batch', payload: {}, label: 'empty' }).ok, false);
  assert.equal(commands.execute({ type: 'batch', payload: { commands: [42] }, label: 'junk' }).ok, false);
  assert.equal(commands.execute(cmd.batch([], 'Nothing')).ok, true, 'an empty batch is a successful no-op');
});

/* ------------------------------------------------------ failures & handlers */

test('execute never throws for an unknown command type', () => {
  const { commands } = setup();
  const result = commands.execute({ type: 'no-such', payload: {}, label: 'x' });
  assert.deepEqual(result, { ok: false, error: 'no handler is registered for command type "no-such"', touched: [] });
  assert.deepEqual(commands.history(), []);
  assert.equal(commands.canUndo, false);
});

test('a handler that throws becomes a failed result and changes nothing', () => {
  const { store, commands, racer } = setup();
  const before = store.get(racer.id)?.revision;
  commands.registerHandler('boom', {
    apply: () => {
      throw new Error('kaboom');
    },
  });
  const result = commands.execute({ type: 'boom', payload: {}, label: 'Boom' });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /the handler for "boom" threw: kaboom/);
  assert.deepEqual(result.touched, []);
  assert.equal(store.get(racer.id)?.revision, before);
  assert.equal(commands.canUndo, false);
});

test('a handler that returns a broken result is reported instead of trusted', () => {
  const { commands } = setup();
  commands.registerHandler('no-flag', { apply: () => ({ result: {} as unknown as CommandResult, inverse: null }) });
  const flagless = commands.execute({ type: 'no-flag', payload: {}, label: 'x' });
  assert.equal(flagless.ok, false);
  assert.match(flagless.error ?? '', /without an "ok" flag/);

  commands.registerHandler('no-reason', { apply: () => ({ result: { ok: false, touched: [] }, inverse: null }) });
  const reasonless = commands.execute({ type: 'no-reason', payload: {}, label: 'x' });
  assert.equal(reasonless.ok, false);
  assert.match(reasonless.error ?? '', /without a reason/);

  commands.registerHandler('no-touched', { apply: () => ({ result: { ok: true } as unknown as CommandResult, inverse: null }) });
  assert.deepEqual(commands.execute({ type: 'no-touched', payload: {}, label: 'x' }), { ok: true, touched: [] });
});

test('a command without an inverse runs but cannot be undone', () => {
  const { vars, commands, racer } = setup();
  commands.registerHandler('custom', { apply: () => ({ result: { ok: true, touched: [] }, inverse: null }) });
  commands.execute(cmd.setParam(`${racer.id}.weight`, 6));
  assert.equal(commands.undo(), true);
  assert.equal(commands.canRedo, true);
  const result = commands.execute({ type: 'custom', payload: {}, label: 'One way' });
  assert.equal(result.ok, true);
  assert.equal(commands.canUndo, false, 'a one-way command gets no undo step');
  assert.equal(commands.canRedo, false, 'but it does drop the redo branch');
  assert.equal(vars.read(`${racer.id}.weight`), 3);
});

test('registerHandler rejects a type or a handler it cannot use', () => {
  const { commands } = setup();
  assert.throws(() => commands.registerHandler('', { apply: () => ({ result: { ok: true, touched: [] }, inverse: null }) }), /non-empty string/);
  assert.throws(() => commands.registerHandler('x', {} as unknown as CommandHandler), /apply\(command\)/);
});

test('createCommandBus rejects options it cannot work with', () => {
  const { store, vars } = setup();
  assert.throws(() => createCommandBus({ store, vars, maxHistory: 0 }), /maxHistory must be a positive integer/);
  assert.throws(() => createCommandBus({ store, vars, maxHistory: 2.5 }), /maxHistory must be a positive integer/);
  assert.throws(() => createCommandBus({ store: {} as unknown as PresetStore, vars }), /opts\.store/);
  assert.throws(() => createCommandBus({ store, vars: {} as unknown as VariableSystem }), /opts\.vars/);
});

/* ------------------------------------------------------------- transactions */

test('transaction groups its commands into one undo step and returns the run value', () => {
  const { vars, commands, racer } = setup();
  const returned = commands.transaction('Drag', () => {
    commands.execute(cmd.setParam(`${racer.id}.weight`, 7));
    commands.execute(cmd.setParam(`${racer.id}.weight`, 8));
    commands.execute(cmd.setParam(`${racer.id}.bounce`, 1));
    return 'done';
  });
  assert.equal(returned, 'done');
  assert.equal(vars.read(`${racer.id}.weight`), 8);
  assert.deepEqual(commands.history().map((entry) => entry.label), ['Drag']);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 3);
  assert.equal(vars.read(`${racer.id}.bounce`), 5, 'the whole transaction undid in one step');
  assert.equal(commands.redo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 8);
  assert.equal(vars.read(`${racer.id}.bounce`), 1);
});

test('a nested transaction joins the outer step', () => {
  const { vars, commands, racer } = setup();
  commands.transaction('Outer', () => {
    commands.execute(cmd.setParam(`${racer.id}.weight`, 7));
    commands.transaction('Inner', () => {
      commands.execute(cmd.setParam(`${racer.id}.weight`, 8));
    });
  });
  assert.deepEqual(commands.history().map((entry) => entry.label), ['Outer']);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 3);
});

test('a transaction that throws is rolled back and rethrows', () => {
  const { vars, commands, racer } = setup();
  assert.throws(
    () =>
      commands.transaction('Broken', () => {
        commands.execute(cmd.setParam(`${racer.id}.weight`, 7));
        commands.execute(cmd.setParam(`${racer.id}.bounce`, 2));
        throw new Error('stop');
      }),
    /stop/,
  );
  assert.equal(vars.read(`${racer.id}.weight`), 3);
  assert.equal(vars.read(`${racer.id}.bounce`), 5);
  assert.deepEqual(commands.history(), []);
  assert.equal(commands.canUndo, false);
});

test('a failed command inside a transaction does not become an undo step', () => {
  const { vars, commands, racer } = setup();
  commands.transaction('Half', () => {
    commands.execute(cmd.setParam(`${racer.id}.weight`, 7));
    const bad = commands.execute(cmd.addChild(racer.id, 'mechanics', 'ghost'));
    assert.equal(bad.ok, false);
  });
  assert.equal(vars.read(`${racer.id}.weight`), 7, 'the good command still applied');
  assert.deepEqual(commands.history().map((entry) => entry.label), ['Half']);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 3);
});

test('an empty transaction adds no undo step', () => {
  const { commands } = setup();
  commands.transaction('Nothing', () => undefined);
  assert.deepEqual(commands.history(), []);
  assert.equal(commands.undo(), false);
});

test('a batch inside a transaction is still one undo step', () => {
  const { vars, commands, racer } = setup();
  commands.execute(cmd.setParam(`${racer.id}.weight`, 4, 'First'));
  commands.transaction('Bulk', () => {
    commands.execute(cmd.batch([cmd.setParam(`${racer.id}.weight`, 9), cmd.setParam(`${racer.id}.bounce`, 9)], 'Inner batch'));
  });
  assert.deepEqual(commands.history().map((entry) => entry.label), ['First', 'Bulk']);
  assert.equal(vars.read(`${racer.id}.weight`), 9);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 4);
  assert.equal(vars.read(`${racer.id}.bounce`), 5);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 3);
});

/* --------------------------------------------------------- history & events */

test('undo and redo return false when there is nothing to do', () => {
  const { commands, racer } = setup();
  assert.equal(commands.undo(), false);
  assert.equal(commands.redo(), false);
  commands.execute(cmd.setParam(`${racer.id}.weight`, 6));
  assert.equal(commands.redo(), false);
  assert.equal(commands.undo(), true);
  assert.equal(commands.undo(), false);
  assert.equal(commands.redo(), true);
});

test('history lists steps oldest first with their undone flag, and a new command drops the redo branch', () => {
  const { commands, racer } = setup();
  commands.execute(cmd.setParam(`${racer.id}.weight`, 6, 'Heavier'));
  commands.execute(cmd.setParam(`${racer.id}.weight`, 7, 'Heaviest'));
  assert.equal(commands.undo(), true);
  assert.deepEqual(commands.history(), [
    { label: 'Heavier', undone: false },
    { label: 'Heaviest', undone: true },
  ]);
  commands.execute(cmd.setParam(`${racer.id}.weight`, 1, 'Light'));
  assert.deepEqual(commands.history(), [
    { label: 'Heavier', undone: false },
    { label: 'Light', undone: false },
  ]);
  assert.equal(commands.redo(), false);
});

test('maxHistory drops the oldest steps', () => {
  const { vars, commands, racer } = setup(2);
  commands.execute(cmd.setParam(`${racer.id}.weight`, 6, 'One'));
  commands.execute(cmd.setParam(`${racer.id}.weight`, 7, 'Two'));
  commands.execute(cmd.setParam(`${racer.id}.weight`, 8, 'Three'));
  assert.deepEqual(commands.history().map((entry) => entry.label), ['Two', 'Three']);
  assert.equal(commands.undo(), true);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${racer.id}.weight`), 6, 'only the two kept steps can be undone');
  assert.equal(commands.undo(), false);
});

test('clear empties the history but keeps handlers and subscribers', () => {
  const { commands, racer } = setup();
  const seen: string[] = [];
  commands.subscribe((command) => seen.push(command.type));
  commands.registerHandler('custom', { apply: () => ({ result: { ok: true, touched: [] }, inverse: null }) });
  commands.execute(cmd.setParam(`${racer.id}.weight`, 6));
  commands.clear();
  assert.deepEqual(commands.history(), []);
  assert.equal(commands.canUndo, false);
  assert.equal(commands.canRedo, false);
  assert.equal(commands.undo(), false);
  assert.equal(commands.execute({ type: 'custom', payload: {}, label: 'still here' }).ok, true);
  commands.execute(cmd.setParam(`${racer.id}.weight`, 7));
  assert.deepEqual(seen, ['set-param', 'custom', 'set-param']);
});

test('subscribe sees every executed command with its result until it is unsubscribed', () => {
  const { commands, racer } = setup();
  const seen: string[] = [];
  const off = commands.subscribe((command, result) => seen.push(`${command.type}:${String(result.ok)}`));
  commands.execute(cmd.setParam(`${racer.id}.weight`, 6));
  commands.execute({ type: 'no-such', payload: {}, label: 'x' });
  commands.undo();
  assert.deepEqual(seen, ['set-param:true', 'no-such:false'], 'undo replays an inverse, it is not a new command');
  off();
  off();
  commands.execute(cmd.setParam(`${racer.id}.weight`, 7));
  assert.deepEqual(seen, ['set-param:true', 'no-such:false'], 'an unsubscribed listener hears nothing more');
});

test('a throwing subscriber cannot break execute', () => {
  const { vars, commands, racer } = setup();
  commands.subscribe(() => {
    throw new Error('listener exploded');
  });
  const result = commands.execute(cmd.setParam(`${racer.id}.weight`, 6));
  assert.equal(result.ok, true);
  assert.equal(vars.read(`${racer.id}.weight`), 6);
});
