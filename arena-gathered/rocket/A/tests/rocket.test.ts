import test from 'node:test';
import assert from 'node:assert/strict';
import { launch, numbers, readiness, shopRocket, type Blueprint } from '../src/index';

const r: Blueprint = { parts: [
  { kind: 'engine', x: 0, y: 0 }, { kind: 'tank', x: 0, y: 1 }, { kind: 'cabin', x: 0, y: 2 }, { kind: 'nose', x: 0, y: 3 }, { kind: 'button', x: 1, y: 2 },
], wires: [{ from: 4, to: 0 }] };

test('a simple stack is ship ready', () => {
  assert.deepEqual(readiness(r), []);
  assert.deepEqual(readiness(shopRocket()), []);
});

test('its numbers', () => {
  const n = numbers(r);
  assert.equal(n.dryMass, 701); assert.equal(n.fuel, 900); assert.equal(n.mass, 1601);
  assert.equal(n.thrust, 60000); assert.equal(n.burnTime, 30);
  assert.ok(Math.abs(n.twr - 60000 / (1601 * 9.8)) < 1e-9);
  assert.ok(Math.abs(n.deltaV - 2000 * Math.log(1601 / 701)) < 1e-6);
});

test('no cabin, no wire: not ready', () => {
  assert.ok(readiness({ parts: r.parts.filter((p) => p.kind !== 'cabin'), wires: [] }).length >= 2);
});

test('it flies', () => {
  const f = launch(r, 20, 0.1);
  assert.equal(f[0]!.height, 0);
  assert.ok(f[f.length - 1]!.height > 100);
});

// --- our own tests ---

test('a floating part is a problem', () => {
  const b: Blueprint = {
    parts: [...r.parts, { kind: 'fin', x: 5, y: 5 }],
    wires: r.wires,
  };
  const p = readiness(b);
  assert.equal(p.length, 1);
  assert.match(p[0]!, /floating/);
});

test('an engine with a part under it is a problem', () => {
  const b: Blueprint = {
    parts: [
      { kind: 'hull', x: 0, y: 0 },
      { kind: 'engine', x: 0, y: 1 },
      { kind: 'tank', x: 0, y: 2 },
      { kind: 'cabin', x: 0, y: 3 },
      { kind: 'nose', x: 0, y: 4 },
      { kind: 'button', x: 1, y: 3 },
    ],
    wires: [{ from: 5, to: 1 }],
  };
  assert.deepEqual(readiness(b), ['engine at 0,1 has a part under it']);
});

test('a missing nose is a problem', () => {
  const b: Blueprint = {
    parts: r.parts.filter((p) => p.kind !== 'nose'),
    wires: r.wires,
  };
  assert.deepEqual(readiness(b), ['no nose on top of the highest column']);
});

test('an unwired engine is a problem', () => {
  const p = readiness({ parts: r.parts, wires: [] });
  assert.deepEqual(p, ['engine at 0,0 is not wired to a launch button']);
});

test('too heavy to lift off', () => {
  const heavy: Blueprint = {
    parts: [
      { kind: 'engine', x: 0, y: 0 },
      { kind: 'tank', x: 0, y: 1 },
      { kind: 'tank', x: 0, y: 2 },
      { kind: 'tank', x: 0, y: 3 },
      { kind: 'tank', x: 0, y: 4 },
      { kind: 'tank', x: 0, y: 5 },
      { kind: 'tank', x: 0, y: 6 },
      { kind: 'cabin', x: 0, y: 7 },
      { kind: 'nose', x: 0, y: 8 },
      { kind: 'button', x: 1, y: 7 },
    ],
    wires: [{ from: 9, to: 0 }],
  };
  const n = numbers(heavy);
  assert.ok(n.twr < 1, `twr ${n.twr}`);
  assert.deepEqual(readiness(heavy), ['too heavy to lift off']);

  const f = launch(heavy, 10, 0.1);
  assert.equal(f[0]!.height, 0);
  assert.ok(f.every((s) => s.height === 0));
  assert.ok(f[f.length - 1]!.fuel < 5400);
});

test('launch reaches a height and falls back', () => {
  const f = launch(r, 600, 2);
  assert.equal(f[0]!.height, 0);
  const apex = Math.max(...f.map((s) => s.height));
  assert.ok(apex > 1000, `apex ${apex}`);
  assert.equal(f[f.length - 1]!.height, 0);
  assert.equal(f[f.length - 1]!.speed, 0);
});

test('launch samples start at t = 0 and step by dt', () => {
  const f = launch(r, 2, 0.5);
  assert.equal(f.length, 5);
  assert.deepEqual(f.map((s) => s.t), [0, 0.5, 1, 1.5, 2]);
});

test('fuel runs out and stops burning', () => {
  const f = launch(r, 60, 1);
  assert.equal(f[0]!.fuel, 900);
  assert.equal(f[f.length - 1]!.fuel, 0);
  assert.equal(numbers(r).burnTime, 30);
});

test('readiness of an empty blueprint', () => {
  assert.ok(readiness({ parts: [], wires: [] }).length >= 3);
});