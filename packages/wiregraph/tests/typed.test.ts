// Typed pins (Plan 57 §16.2): wires run from outputs to commands and properties, types match where the meaning is plain, a
// property takes one source, and a clean contraption is one whose every pin is wired or deliberately free.
import test from 'node:test';
import assert from 'node:assert/strict';
import { balance, isClean, layout, toGraph, typedProblems, type TypedGraph } from '../src/index';

/** A button that starts a motor, its speed set by a knob: the first contraption of the Plasma session's checklist. */
const MACHINE: TypedGraph = {
  id: 'first-machine',
  name: 'Button motor',
  author: 'native:ada',
  nodes: [
    { id: 'button', of: 'part:button', pins: [{ id: 'pressed', kind: 'output', type: 'pulse', label: 'Pressed' }] },
    { id: 'knob', of: 'part:knob', pins: [{ id: 'value', kind: 'output', type: 'number', label: 'Value' }] },
    {
      id: 'motor', of: 'part:motor',
      pins: [
        { id: 'toggle', kind: 'command', type: 'pulse', label: 'Start or stop' },
        { id: 'speed', kind: 'property', type: 'number', label: 'Speed' },
        { id: 'running', kind: 'output', type: 'boolean', label: 'Running', free: true },
      ],
    },
  ],
  wires: [
    { from: { node: 'button', port: 'pressed' }, to: { node: 'motor', port: 'toggle' } },
    { from: { node: 'knob', port: 'value' }, to: { node: 'motor', port: 'speed' } },
  ],
};

test('a clean contraption: no problems, and every pin wired or deliberately free', () => {
  assert.deepEqual(typedProblems(MACHINE), []);
  assert.deepEqual(balance(MACHINE), { ports: 5, balanced: 5, loose: [] });
  assert.equal(isClean(MACHINE), true);
  assert.equal(MACHINE.author, 'native:ada', 'a native\'s work keeps its maker');
});

test('a loose pin keeps it from being clean, and balance names it', () => {
  const loose: TypedGraph = { ...MACHINE, wires: MACHINE.wires.slice(0, 1) };
  assert.deepEqual(typedProblems(loose), []);
  assert.deepEqual(balance(loose).loose, ['knob.value', 'motor.speed']);
  assert.equal(isClean(loose), false);
});

test('wires run from outputs to commands or properties, types match where the meaning is plain, and a property takes one source', () => {
  const codes = (wires: TypedGraph['wires']): string[] => typedProblems({ ...MACHINE, wires }).map((i) => i.code);
  assert.deepEqual(codes([{ from: { node: 'motor', port: 'speed' }, to: { node: 'motor', port: 'toggle' } }]), ['self-loop', 'from-not-output']);
  assert.deepEqual(codes([{ from: { node: 'knob', port: 'value' }, to: { node: 'button', port: 'pressed' } }]), ['to-output']);
  assert.deepEqual(codes([{ from: { node: 'button', port: 'pressed' }, to: { node: 'motor', port: 'speed' } }]), ['type-mismatch'], 'a pulse is no speed');
  assert.deepEqual(codes([{ from: { node: 'knob', port: 'value' }, to: { node: 'motor', port: 'toggle' } }]), [], 'any signal runs a command');
  assert.deepEqual(codes([...MACHINE.wires, { from: { node: 'knob', port: 'value' }, to: { node: 'motor', port: 'speed' } }]), ['property-two-sources']);
  assert.deepEqual(codes([{ from: { node: 'lamp', port: 'on' }, to: { node: 'motor', port: 'toggle' } }]), ['unknown-end']);
});

test('a boolean sets a number property as 0 or 1, and a number sets a boolean as not 0', () => {
  const g: TypedGraph = {
    id: 'convert', name: 'Convert',
    nodes: [
      { id: 'a', of: 'part:switch', pins: [{ id: 'on', kind: 'output', type: 'boolean', label: 'On' }] },
      { id: 'b', of: 'part:lamp', pins: [{ id: 'level', kind: 'property', type: 'number', label: 'Brightness' }, { id: 'colour', kind: 'property', type: 'color', label: 'Colour', free: true }] },
    ],
    wires: [{ from: { node: 'a', port: 'on' }, to: { node: 'b', port: 'level' } }],
  };
  assert.deepEqual(typedProblems(g), []);
  assert.deepEqual(typedProblems({ ...g, wires: [{ from: { node: 'a', port: 'on' }, to: { node: 'b', port: 'colour' } }] }).map((i) => i.code), ['type-mismatch'], 'a switch is no colour');
});

test('a typed graph lays out with the existing layout, commands and properties as inputs', () => {
  const plain = toGraph(MACHINE);
  assert.deepEqual(plain.nodes.find((n) => n.id === 'motor'), { id: 'motor', inputs: ['toggle', 'speed'], outputs: ['running'] });
  const placed = layout(plain);
  assert.equal(placed.length, 3);
  const x = (id: string): number => placed.find((p) => p.id === id)!.x;
  assert.ok(x('button') < x('motor') && x('knob') < x('motor'), 'sources stand left of what they drive');
});
