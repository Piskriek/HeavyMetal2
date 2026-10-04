import test from 'node:test';
import assert from 'node:assert/strict';
import { LogicGraph, validate, type Node } from '../src/index';
const box = { centre: [0, 0, 0] as [number, number, number], half: [1, 1, 1] as [number, number, number] };
const at = (x: number) => ({ dt: 0.1, actors: [[x, 0, 0] as [number, number, number]], pressed: [] as string[] });

test('stepping into a zone opens the door once per entry', () => {
  const g = new LogicGraph([{ id: 'in', kind: 'enter', ...box }, { id: 'door', kind: 'action', inputs: ['in'], action: { kind: 'open', target: 'door1' }, repeat: 0 }]);
  assert.equal(g.step(at(5)).length, 0);
  assert.deepEqual(g.step(at(0.5)), [{ node: 'door', action: { kind: 'open', target: 'door1' } }]);
  assert.equal(g.step(at(0.6)).length, 0);
  g.step(at(5));
  assert.equal(g.step(at(0)).length, 1);
});
test('repeat limits an action', () => {
  const g = new LogicGraph([{ id: 'p', kind: 'press', key: 'e' }, { id: 'a', kind: 'action', inputs: ['p'], action: { kind: 'say', text: 'hi' }, repeat: 1 }]);
  assert.equal(g.step({ dt: 0.1, actors: [], pressed: ['e'] }).length, 1);
  g.step({ dt: 0.1, actors: [], pressed: [] });
  assert.equal(g.step({ dt: 0.1, actors: [], pressed: ['e'] }).length, 0);
});
test('and, not, toggle', () => {
  const g = new LogicGraph([
    { id: 'in', kind: 'inside', ...box }, { id: 'p', kind: 'press', key: 'e' },
    { id: 'both', kind: 'and', inputs: ['in', 'p'] }, { id: 'out', kind: 'not', inputs: ['in'] }, { id: 't', kind: 'toggle', inputs: ['both'] },
  ]);
  g.step({ dt: 0.1, actors: [[0, 0, 0]], pressed: ['e'] });
  assert.equal(g.value('both'), true); assert.equal(g.value('out'), false); assert.equal(g.value('t'), true);
  g.step({ dt: 0.1, actors: [[0, 0, 0]], pressed: [] });
  assert.equal(g.value('t'), true);
  g.step({ dt: 0.1, actors: [[0, 0, 0]], pressed: ['e'] });
  assert.equal(g.value('t'), false);
});
test('a timer and a delay', () => {
  const g = new LogicGraph([{ id: 'tick', kind: 'timer', every: 1 }, { id: 'later', kind: 'delay', inputs: ['tick'], seconds: 0.5 }]);
  const seen: string[] = [];
  for (let i = 1; i <= 20; i++) { g.step({ dt: 0.1, actors: [], pressed: [] }); if (g.value('tick')) seen.push(`tick@${i}`); if (g.value('later')) seen.push(`later@${i}`); }
  assert.deepEqual(seen, ['tick@10', 'later@15', 'tick@20']);
});
test('validate finds unknown inputs and cycles', () => {
  assert.equal(validate([{ id: 'a', kind: 'not', inputs: ['missing'] }]).length > 0, true);
  assert.equal(validate([{ id: 'a', kind: 'not', inputs: ['b'] }, { id: 'b', kind: 'not', inputs: ['a'] }]).length > 0, true);
  assert.deepEqual(validate([{ id: 'p', kind: 'press', key: 'e' }, { id: 'n', kind: 'not', inputs: ['p'] }]), []);
  assert.throws(() => new LogicGraph([{ id: 'a', kind: 'not', inputs: ['a'] }] as Node[]));
});

test('gate passes only while open', () => {
  const g = new LogicGraph([
    { id: 'p', kind: 'press', key: 'e' },
    { id: 'in', kind: 'inside', ...box },
    { id: 'gt', kind: 'gate', inputs: ['p', 'in'] },
  ]);
  g.step({ dt: 0.1, actors: [], pressed: ['e'] });
  assert.equal(g.value('gt'), false);
  g.step({ dt: 0.1, actors: [[1, 1, 1]], pressed: ['e'] });
  assert.equal(g.value('gt'), true);
});

test('once fires a single frame and leave pulses', () => {
  const g = new LogicGraph([
    { id: 'lv', kind: 'leave', ...box },
    { id: 'o', kind: 'once', inputs: ['lv'] },
    { id: 'a', kind: 'action', inputs: ['o'], action: { kind: 'sound', sound: 'door' }, repeat: 0 },
  ]);
  assert.equal(g.step(at(0)).length, 0);
  assert.deepEqual(g.step(at(9)), [{ node: 'a', action: { kind: 'sound', sound: 'door' } }]);
  g.step(at(0));
  assert.equal(g.step(at(9)).length, 0);
});

test('reset restores the first frame', () => {
  const g = new LogicGraph([{ id: 't', kind: 'timer', every: 1 }, { id: 'tg', kind: 'toggle', inputs: ['t'] }]);
  for (let i = 0; i < 10; i++) g.step({ dt: 0.1, actors: [], pressed: [] });
  assert.equal(g.value('tg'), true);
  g.reset();
  assert.equal(g.value('tg'), false);
  for (let i = 0; i < 10; i++) g.step({ dt: 0.1, actors: [], pressed: [] });
  assert.equal(g.value('tg'), true);
});

test('validate reports wrong arity and negative times', () => {
  assert.equal(validate([{ id: 'g', kind: 'gate', inputs: ['g'] } as unknown as Node]).length > 0, true);
  assert.equal(validate([{ id: 'p', kind: 'press', key: 'e' }, { id: 'd', kind: 'delay', inputs: ['p'], seconds: -1 }]).length > 0, true);
});