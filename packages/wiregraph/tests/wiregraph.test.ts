import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, crossings, layers, layout, portAt, portPos, problems, wirePath, type Graph } from '../src/index';
const n = (id: string, inputs: string[] = ['in'], outputs: string[] = ['out']) => ({ id, inputs, outputs });
const w = (a: string, b: string, pa = 'out', pb = 'in') => ({ from: { node: a, port: pa }, to: { node: b, port: pb } });

test('problems: unknown ports, two wires into one input, cycles', () => {
  assert.deepEqual(problems({ nodes: [n('a'), n('b')], wires: [w('a', 'b')] }), []);
  assert.ok(problems({ nodes: [n('a'), n('b')], wires: [w('a', 'b', 'nope')] }).length > 0);
  assert.ok(problems({ nodes: [n('a'), n('b'), n('c')], wires: [w('a', 'c'), w('b', 'c')] }).length > 0);
  assert.ok(problems({ nodes: [n('a'), n('b')], wires: [w('a', 'b'), w('b', 'a')] }).length > 0);
  assert.ok(problems({ nodes: [n('a'), n('b')], wires: [w('a', 'b', 'in', 'in')] }).length > 0);
});
test('columns follow the longest path', () => {
  const g: Graph = { nodes: [n('a'), n('b'), n('c', ['x', 'y'])], wires: [w('a', 'b'), w('b', 'c', 'out', 'x'), w('a', 'c', 'out', 'y')] };
  assert.deepEqual(layers(g), [['a'], ['b'], ['c']]);
});
test('the sweeps untangle crossing wires', () => {
  const g: Graph = { nodes: [n('s1', []), n('s2', []), n('t1'), n('t2')], wires: [w('s1', 't2'), w('s2', 't1')] };
  assert.equal(crossings(g, [['s1', 's2'], ['t1', 't2']]), 1);
  const order = layers(g);
  assert.deepEqual(order, [['s1', 's2'], ['t2', 't1']]);
  assert.equal(crossings(g, order), 0);
});
test('layout, ports and finding a port', () => {
  const g: Graph = { nodes: [n('a', [], ['o1', 'o2']), n('b'), n('c')], wires: [w('a', 'b', 'o1'), w('a', 'c', 'o2')] };
  const p = layout(g);
  const b = p.find((q) => q.id === 'c')!;
  assert.deepEqual([b.x, b.y, b.w, b.h], [240, 90, 160, 60]);
  const a = p.find((q) => q.id === 'a')!;
  assert.deepEqual(portPos(a, g.nodes[0]!, 'out', 'o2'), [160, 40]);
  assert.deepEqual(portPos(a, g.nodes[0]!, 'out', 'o1'), [160, 20]);
  assert.deepEqual(portAt(p, g, 159, 41, 6), { node: 'a', port: 'o2', side: 'out' });
  assert.deepEqual(portAt(p, g, 241, 120), { node: 'c', port: 'in', side: 'in' });
  assert.equal(portAt(p, g, 80, 30), null);
});
test('a wire is a gentle S; connecting into a fed input replaces its wire', () => {
  assert.deepEqual(wirePath([0, 0], [100, 50]), [[0, 0], [50, 0], [50, 50], [100, 50]]);
  assert.deepEqual(wirePath([0, 0], [20, 0]), [[0, 0], [40, 0], [-20, 0], [20, 0]]);
  const g: Graph = { nodes: [n('x'), n('y'), n('z')], wires: [w('x', 'y')] };
  const h = connect(g, { node: 'z', port: 'out' }, { node: 'y', port: 'in' });
  assert.deepEqual(h.wires, [w('z', 'y')]);
  assert.deepEqual(g.wires, [w('x', 'y')]);
});

/* ------------------------------- further tests ------------------------------- */

test('an empty graph and a lone node are fine', () => {
  assert.deepEqual(problems({ nodes: [], wires: [] }), []);
  assert.deepEqual(layers({ nodes: [], wires: [] }), []);
  assert.deepEqual(layout({ nodes: [], wires: [] }), []);
  const g: Graph = { nodes: [n('switch', [], ['out']), n('lamp', ['in'], [])], wires: [] };
  assert.deepEqual(problems(g), []);
  assert.deepEqual(layers(g), [['switch', 'lamp']]);
});

test('problems names unknown nodes and wires into outputs, and a self loop', () => {
  assert.ok(problems({ nodes: [n('a')], wires: [w('a', 'ghost')] }).length > 0);
  assert.ok(problems({ nodes: [n('a'), n('b')], wires: [w('a', 'b', 'out', 'out')] }).length > 0);
  assert.ok(problems({ nodes: [n('a')], wires: [w('a', 'a')] }).length > 0);
  assert.ok(problems({ nodes: [n('a'), n('a')], wires: [] }).length > 0);
  const long: Graph = { nodes: [n('a'), n('b'), n('c')], wires: [w('a', 'b'), w('b', 'c'), w('c', 'a')] };
  assert.ok(problems(long).some((m) => m.includes('cycle')));
});

test('problems never touches the graph it is given', () => {
  const g: Graph = { nodes: [n('a'), n('b')], wires: [w('a', 'b'), w('b', 'a')] };
  const before = JSON.stringify(g);
  problems(g);
  layers(g);
  layout(g);
  crossings(g, layers(g));
  assert.equal(JSON.stringify(g), before);
});

test('three tangled wires straighten out', () => {
  const g: Graph = {
    nodes: [n('s1', []), n('s2', []), n('s3', []), n('t1'), n('t2'), n('t3')],
    wires: [w('s1', 't3'), w('s2', 't2'), w('s3', 't1')],
  };
  assert.equal(crossings(g, [['s1', 's2', 's3'], ['t1', 't2', 't3']]), 3);
  const order = layers(g);
  assert.deepEqual(order, [['s1', 's2', 's3'], ['t3', 't2', 't1']]);
  assert.equal(crossings(g, order), 0);
});

test('crossings only counts wires between neighbouring columns', () => {
  const g: Graph = {
    nodes: [n('a', [], ['out']), n('b', ['in'], ['out']), n('c', ['p', 'q'])],
    wires: [w('a', 'b'), w('b', 'c', 'out', 'p'), w('a', 'c', 'out', 'q')],
  };
  assert.equal(crossings(g, [['a'], ['b'], ['c']]), 0);
});

test('layout honours the given sizes', () => {
  const g: Graph = { nodes: [n('a', [], ['out']), n('b'), n('c')], wires: [w('a', 'b'), w('a', 'c')] };
  const p = layout(g, { nodeW: 100, nodeH: 40, colGap: 20, rowGap: 10 });
  assert.deepEqual(p.find((q) => q.id === 'a'), { id: 'a', x: 0, y: 0, w: 100, h: 40 });
  assert.deepEqual(p.find((q) => q.id === 'b'), { id: 'b', x: 120, y: 0, w: 100, h: 40 });
  assert.deepEqual(p.find((q) => q.id === 'c'), { id: 'c', x: 120, y: 50, w: 100, h: 40 });
});

test('port places: single port is centred, unknown port is null', () => {
  const box = { id: 'a', x: 10, y: 20, w: 160, h: 60 };
  const node = n('a', ['in'], ['out']);
  assert.deepEqual(portPos(box, node, 'in', 'in'), [10, 50]);
  assert.deepEqual(portPos(box, node, 'out', 'out'), [170, 50]);
  assert.equal(portPos(box, node, 'in', 'out'), null);
  assert.equal(portPos(box, node, 'out', 'nope'), null);
});

test('portAt picks the nearest port and respects the radius', () => {
  const g: Graph = { nodes: [n('a', [], ['o1', 'o2']), n('b')], wires: [w('a', 'b', 'o1')] };
  const p = layout(g);
  assert.deepEqual(portAt(p, g, 160, 25, 20), { node: 'a', port: 'o1', side: 'out' });
  assert.deepEqual(portAt(p, g, 160, 36, 20), { node: 'a', port: 'o2', side: 'out' });
  assert.equal(portAt(p, g, 160, 30, 2), null);
});

test('connect adds, replaces, and leaves a clean graph', () => {
  const g: Graph = { nodes: [n('zone', [], ['out']), n('switch', [], ['out']), n('door', ['open'])], wires: [] };
  const one = connect(g, { node: 'zone', port: 'out' }, { node: 'door', port: 'open' });
  assert.deepEqual(one.wires, [w('zone', 'door', 'out', 'open')]);
  assert.deepEqual(g.wires, []);
  const two = connect(one, { node: 'switch', port: 'out' }, { node: 'door', port: 'open' });
  assert.deepEqual(two.wires, [w('switch', 'door', 'out', 'open')]);
  assert.deepEqual(problems(two), []);
  two.nodes[0]!.outputs.push('extra');
  assert.deepEqual(g.nodes[0]!.outputs, ['out']);
});

test('wirePath is symmetric about its ends', () => {
  const [a, c1, c2, b] = wirePath([5, 5], [205, 105]);
  assert.deepEqual(a, [5, 5]);
  assert.deepEqual(b, [205, 105]);
  assert.deepEqual(c1, [105, 5]);
  assert.deepEqual(c2, [105, 105]);
  assert.deepEqual(wirePath([100, 0], [0, 0]), [[100, 0], [150, 0], [-50, 0], [0, 0]]);
});

test('a fan of wires keeps every column non-empty and ordered', () => {
  const g: Graph = {
    nodes: [n('src', [], ['o']), n('m1'), n('m2'), n('sink', ['p', 'q'])],
    wires: [w('src', 'm1', 'o'), w('src', 'm2', 'o'), w('m1', 'sink', 'out', 'p'), w('m2', 'sink', 'out', 'q')],
  };
  const order = layers(g);
  assert.deepEqual(order, [['src'], ['m1', 'm2'], ['sink']]);
  assert.equal(crossings(g, order), 0);
  assert.deepEqual(problems(g), []);
});