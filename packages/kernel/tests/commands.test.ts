/**
 * T1 acceptance: the kernel (schema registry, preset graph, variables, commands, events, migrations).
 * Issue codes the store's validate() must use: 'cycle', 'missing-ref', 'slot-kind', 'param-range', 'unknown-param', 'depth', 'nodes'.
 * If a test contradicts the contract text in packages/contracts, follow the contract, fix the test minimally and say so in your report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmd, defineSchema } from '@hm/contracts';
import { createCommandBus, createEventBus, createPresetStore, createSchemaRegistry, createVariableSystem } from '@hm/kernel';

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
  const vars = createVariableSystem({ store, schemas, events });
  const commands = createCommandBus({ store, vars });
  return { schemas, store, events, vars, commands };
}

test('commands: set-param, undo/redo, transactions as one step, history, batch', () => {
  const { store, commands, vars } = setup();
  const r = store.put({ kind: 'racer', name: 'R', params: { weight: 3 } });
  assert.equal(commands.canUndo, false);
  const res = commands.execute(cmd.setParam(`${r.id}.weight`, 6, 'Heavier'));
  assert.equal(res.ok, true); assert.deepEqual(res.touched, [r.id]);
  assert.equal(vars.read(`${r.id}.weight`), 6);
  assert.equal(commands.undo(), true);
  assert.equal(vars.read(`${r.id}.weight`), 3);
  assert.equal(commands.redo(), true);
  assert.equal(vars.read(`${r.id}.weight`), 6);
  commands.transaction('Drag', () => {
    commands.execute(cmd.setParam(`${r.id}.weight`, 7));
    commands.execute(cmd.setParam(`${r.id}.weight`, 8));
    commands.execute(cmd.setParam(`${r.id}.bounce`, 1));
  });
  assert.equal(vars.read(`${r.id}.weight`), 8);
  commands.undo();
  assert.equal(vars.read(`${r.id}.weight`), 6); assert.equal(vars.read(`${r.id}.bounce`), 5, 'the whole transaction undid in one step');
  assert.deepEqual(commands.history().map((h) => h.label), ['Heavier', 'Drag']);
  assert.equal(commands.history()[1]!.undone, true);
  commands.execute(cmd.batch([cmd.setParam(`${r.id}.weight`, 1), cmd.setParam(`${r.id}.bounce`, 2)], 'Both'));
  commands.undo();
  assert.equal(vars.read(`${r.id}.weight`), 6);
  assert.equal(commands.history().some((h) => h.label === 'Drag'), false, 'a new command drops the redo branch');
});

test('commands: add-child/remove-child/put/set-script undo cleanly; bad commands fail without changing anything', () => {
  const { store, commands } = setup();
  const m = store.put({ kind: 'mechanic', name: 'M' });
  const r = store.put({ kind: 'racer', name: 'R' });
  commands.execute(cmd.addChild(r.id, 'mechanics', m.id));
  assert.deepEqual(store.get(r.id)!.children['mechanics'], [{ ref: m.id }]);
  commands.execute(cmd.setScript(m.id, 'export function update() {}'));
  assert.equal(store.get(m.id)!.script!.source, 'export function update() {}');
  commands.undo(); assert.equal(store.get(m.id)!.script, undefined);
  commands.undo(); assert.deepEqual(store.get(r.id)!.children['mechanics'] ?? [], []);
  const before = store.get(r.id)!.revision;
  const bad = commands.execute(cmd.addChild(r.id, 'mechanics', 'ghost'));
  assert.equal(bad.ok, false); assert.ok(bad.error);
  assert.equal(store.get(r.id)!.revision, before);
  assert.equal(commands.execute({ type: 'no-such', payload: {}, label: 'x' }).ok, false);
  const seen: string[] = [];
  commands.subscribe((c, res) => seen.push(`${c.type}:${res.ok}`));
  commands.registerHandler('custom', { apply: () => ({ result: { ok: true, touched: [] }, inverse: null }) });
  commands.execute({ type: 'custom', payload: {}, label: 'c' });
  assert.deepEqual(seen, ['custom:true']);
});

