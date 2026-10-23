import test from 'node:test';
import assert from 'node:assert/strict';
import { WIREGRAPH_SHELF, WIREGRAPH_PARAM_SCHEMA, createWireGraphState, evaluateWireGraph, validateWireGraph, resolveLogicCartridge, applyLogicCartridge, type WireGraphSpec } from '../src/index';

test('WIREGRAPH_SHELF: canonical presets validate cleanly', () => {
  for (const id of ['auto-airlock', 'brownout-load-shedder', 'leak-perimeter-alarm', 'stage6-earth-beacon']) assert.ok(WIREGRAPH_SHELF[id], id);
  for (const graph of Object.values(WIREGRAPH_SHELF)) assert.deepEqual(validateWireGraph(graph), [], graph.id);
  assert.ok(WIREGRAPH_PARAM_SCHEMA.params.length >= 4);
});
test('shelf presets evaluate deterministically across fixed dt steps', () => {
  const readings: Readonly<Record<string, number>>[] = [{ prox: 1 }, { prox: 1 }, { prox: 1 }, { power: 0.1 }, { leak: 1, prox: 1 }, { stage: 6, charge: 120 }, { stage: 0, charge: 0 }, { stage: 6, charge: 120 }];
  const runAll = () => Object.values(WIREGRAPH_SHELF).map((graph) => {
    let s = createWireGraphState(); const outs: unknown[] = [];
    for (const r of readings) { const res = evaluateWireGraph(graph, s, r, 100); s = res.state; outs.push(res.outputs); }
    return { s, outs };
  });
  assert.deepEqual(runAll(), runAll());
});
test('auto-airlock: proximity through delay opens the door', () => {
  const graph = WIREGRAPH_SHELF['auto-airlock']!;
  let s = createWireGraphState(); let fired: string[] = [];
  for (let i = 0; i < 6; i++) { const r = evaluateWireGraph(graph, s, { prox: 1 }, 100); s = r.state; fired = r.outputs.map((o) => o.kind); }
  assert.ok(fired.includes('open-door'));
});
test('stage6 beacon: counter needs repeated pulses before dial-gate fires', () => {
  const graph = WIREGRAPH_SHELF['stage6-earth-beacon']!;
  let s = createWireGraphState(); let gate = false;
  for (let pulse = 0; pulse < 3; pulse++) {
    for (const r of [{ stage: 6, charge: 120 }, { stage: 0, charge: 0 }]) { const res = evaluateWireGraph(graph, s, r, 16); s = res.state; if (res.outputs.some((o) => o.kind === 'dial-gate')) gate = true; }
  }
  assert.equal(gate, true);
});
test('validateWireGraph catches unknown references and combinational loops, passes stateful loops', () => {
  const badRef: WireGraphSpec = { id: 'bad', name: 'Bad', sensors: [], nodes: [{ id: 'a', kind: 'not', inputs: ['ghost'] }], actuators: [] };
  assert.ok(validateWireGraph(badRef).some((m) => m.includes('unknown')));
  const loop: WireGraphSpec = { id: 'loop', name: 'Loop', sensors: [{ id: 's', kind: 'proximity' }], nodes: [{ id: 'a', kind: 'and', inputs: ['b'] }, { id: 'b', kind: 'or', inputs: ['a', 's'] }], actuators: [] };
  assert.ok(validateWireGraph(loop).some((m) => m.includes('combinational loop')));
  const stateful: WireGraphSpec = { id: 'stateful', name: 'Stateful', sensors: [{ id: 's', kind: 'proximity' }], nodes: [{ id: 'd', kind: 'delay', inputs: ['d'], delayMs: 100 }], actuators: [] };
  assert.deepEqual(validateWireGraph(stateful), []);
});
test('logic: cartridge hook resolves and applies to doors/turrets/machines', () => {
  assert.equal(resolveLogicCartridge('logic:auto-airlock')?.id, 'auto-airlock');
  assert.equal(resolveLogicCartridge('mot:auto-airlock'), null);
  const applied = applyLogicCartridge({ kind: 'door' }, 'logic:auto-airlock');
  assert.equal(applied?.logicPresetId, 'auto-airlock'); assert.equal(applied?.kind, 'door');
  assert.equal(applyLogicCartridge({}, 'logic:nope'), null);
});
