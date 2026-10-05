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

test('a floating part is not connected', () => {
  assert.ok(readiness({
    ...r,
    parts: [...r.parts, { kind: 'hull', x: 10, y: 0 }],
  }).some((p) => p.includes('connected')));
});

test('an engine cannot have a part beneath it', () => {
  assert.ok(readiness({
    ...r,
    parts: [...r.parts, { kind: 'hull', x: 0, y: -1 }],
  }).some((p) => p.includes('bottom')));
});

test('a nose is required at the top', () => {
  assert.ok(readiness({
    ...r,
    parts: r.parts.filter((p) => p.kind !== 'nose'),
  }).some((p) => p.includes('nose')));
});

test('every engine needs a wire from a button', () => {
  assert.ok(readiness({ ...r, wires: [] }).some((p) => p.includes('wire')));
});

test('a heavy rocket cannot lift off', () => {
  const parts: Blueprint['parts'] = [
    { kind: 'engine', x: 0, y: 0 },
    ...Array.from({ length: 7 }, (_, i) => ({
      kind: 'tank' as const, x: 0, y: i + 1,
    })),
    { kind: 'cabin', x: 0, y: 8 },
    { kind: 'nose', x: 0, y: 9 },
    { kind: 'button', x: 1, y: 8 },
  ];
  assert.ok(readiness({
    parts,
    wires: [{ from: 10, to: 0 }],
  }).some((p) => p.includes('weight')));
});

test('a launch rises and eventually falls back to the ground', () => {
  const flight = launch(r, 500, 0.5);
  assert.ok(flight.some((sample) => sample.height > 100));
  assert.equal(flight[flight.length - 1]!.height, 0);
  assert.ok(flight[flight.length - 1]!.t < 500);
});