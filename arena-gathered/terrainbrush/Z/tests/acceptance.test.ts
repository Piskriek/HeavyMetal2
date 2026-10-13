import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyField, apply, revert, heightAt, encodeField, decodeField, type Field, type Rules } from '../src/index';

const RULES: Rules = { maxDepth: 6, maxHeight: 4, orePerCubicMetre: 0.5, ratePerSecond: 2 };
const flat = (): number => 10;
const idx = (f: Field, x: number, z: number): number => z * f.size + x;
const volume = (a: Field, b: Field): number => b.delta.reduce((s, v, i) => s + (v - a.delta[i]!) * a.cell * a.cell, 0);

test('carving digs a smooth pit, clamped at maxDepth, and the dug rock is ore', () => {
  const f0 = emptyField(64, 2);
  const r = apply(f0, flat, { kind: 'carve', x: 64, z: 64, radius: 10, strength: 1, dt: 1 }, RULES, 0);
  const centre = r.field.delta[idx(f0, 31, 31)]!, edge = r.field.delta[idx(f0, 27, 31)]!;
  assert.ok(centre < edge && edge < 0, `centre ${centre}, edge ${edge}`);
  assert.equal(r.field.delta[idx(f0, 20, 31)], 0);
  assert.ok(Math.abs(r.ore - -volume(f0, r.field) * RULES.orePerCubicMetre) < 1e-6);
  let f = r.field;
  for (let i = 0; i < 20; i++) f = apply(f, flat, { kind: 'carve', x: 64, z: 64, radius: 10, strength: 1, dt: 1 }, RULES, 0).field;
  assert.ok(Math.min(...f.delta) >= -RULES.maxDepth - 1e-9);
});

test('raising costs ore and stops at what the ore can pay for', () => {
  const f0 = emptyField(64, 2);
  const rich = apply(f0, flat, { kind: 'raise', x: 64, z: 64, radius: 8, strength: 1, dt: 1 }, RULES, 1e6);
  assert.ok(rich.ore < 0);
  assert.ok(Math.abs(-rich.ore - volume(f0, rich.field) * RULES.orePerCubicMetre) < 1e-6);
  const poor = apply(f0, flat, { kind: 'raise', x: 64, z: 64, radius: 8, strength: 1, dt: 1 }, RULES, 5);
  assert.ok(poor.ore >= -5 - 1e-9 && poor.ore < 0, `spent ${-poor.ore}`);
  assert.ok(volume(f0, poor.field) < volume(f0, rich.field));
  const broke = apply(f0, flat, { kind: 'raise', x: 64, z: 64, radius: 8, strength: 1, dt: 1 }, RULES, 0);
  assert.equal(broke.changed.length, 0);
  let f = rich.field;
  for (let i = 0; i < 20; i++) f = apply(f, flat, { kind: 'raise', x: 64, z: 64, radius: 8, strength: 1, dt: 1 }, RULES, 1e6).field;
  assert.ok(Math.max(...f.delta) <= RULES.maxHeight + 1e-9);
});

test('smoothing evens bumps and moves no ore', () => {
  let f = emptyField(32, 1);
  const bumpy = f.delta.map((_, i) => ((i * 7919) % 13) / 13 - 0.5);
  f = { ...f, delta: bumpy };
  const variance = (g: Field): number => { const c: number[] = []; for (let z = 12; z < 20; z++) for (let x = 12; x < 20; x++) c.push(g.delta[idx(g, x, z)]!); const m = c.reduce((a, b) => a + b, 0) / c.length; return c.reduce((a, b) => a + (b - m) ** 2, 0) / c.length; };
  const r = apply(f, flat, { kind: 'smooth', x: 16, z: 16, radius: 6, strength: 1, dt: 0.5 }, RULES, 0);
  assert.ok(variance(r.field) < variance(f) * 0.8, `${variance(f)} -> ${variance(r.field)}`);
  assert.ok(Math.abs(volume(f, r.field)) < 1e-6);
  assert.ok(Math.abs(r.ore) < 1e-9);
});

test('flattening moves the ground toward the level, paying for fill and gaining from cut', () => {
  const f0 = emptyField(32, 2);
  const up = apply(f0, flat, { kind: 'flatten', x: 32, z: 32, radius: 8, strength: 1, dt: 0.25, level: 11 }, RULES, 1e6);
  const c = idx(f0, 15, 15);
  assert.ok(up.field.delta[c]! > 0 && up.field.delta[c]! <= 1 + 1e-9);
  assert.ok(up.ore < 0);
  const down = apply(f0, flat, { kind: 'flatten', x: 32, z: 32, radius: 8, strength: 1, dt: 0.25, level: 9 }, RULES, 0);
  assert.ok(down.field.delta[c]! < 0 && down.field.delta[c]! >= -1 - 1e-9);
  assert.ok(down.ore > 0);
  assert.ok(Math.abs(heightAt(up.field, flat, 31, 31) - (10 + up.field.delta[c]!)) < 0.2);
});

test('painting lays a preset with an amount from 0 to 1, and erasing takes it off', () => {
  const f0 = emptyField(32, 2);
  let f = apply(f0, flat, { kind: 'paint', x: 32, z: 32, radius: 6, strength: 1, dt: 2, preset: 'mud' }, RULES, 0).field;
  const c = idx(f0, 15, 15);
  assert.equal(f.paint[c], 'mud');
  assert.equal(f.amount[c], 1);
  assert.equal(f.paint[idx(f0, 2, 2)], '');
  for (const a of f.amount) assert.ok(a >= 0 && a <= 1);
  f = apply(f, flat, { kind: 'paint', x: 32, z: 32, radius: 6, strength: 0.25, dt: 1, preset: 'moss' }, RULES, 0).field;
  assert.equal(f.paint[c], 'moss');
  f = apply(f, flat, { kind: 'erase', x: 32, z: 32, radius: 20, strength: 1, dt: 5 }, RULES, 0).field;
  assert.ok(f.paint.every((p) => p === '') && f.amount.every((a) => a === 0));
  assert.throws(() => apply(f0, flat, { kind: 'paint', x: 32, z: 32, radius: 6, strength: 1, dt: 1 }, RULES, 0));
});

test('protected cells never change, and undo restores the field exactly', () => {
  const f0 = emptyField(32, 2);
  const guard = (i: number): boolean => i % 32 < 16;
  const r = apply(f0, flat, { kind: 'carve', x: 32, z: 32, radius: 12, strength: 1, dt: 1 }, RULES, 0, guard);
  for (let i = 0; i < r.field.delta.length; i++) if (guard(i)) assert.equal(r.field.delta[i], 0);
  assert.ok(r.changed.length > 0 && r.changed.every((i) => !guard(i)));
  const r2 = apply(r.field, flat, { kind: 'paint', x: 40, z: 30, radius: 5, strength: 1, dt: 1, preset: 'rust' }, RULES, 0, guard);
  assert.deepEqual(revert(revert(r2.field, r2.undo), r.undo), f0);
});

test('a field encodes compactly and decodes within a centimetre; junk is refused', () => {
  let f = emptyField(128, 4);
  f = apply(f, flat, { kind: 'carve', x: 200, z: 200, radius: 30, strength: 1, dt: 2 }, RULES, 0).field;
  f = apply(f, flat, { kind: 'paint', x: 300, z: 100, radius: 20, strength: 1, dt: 1, preset: 'road' }, RULES, 0).field;
  const text = encodeField(f);
  assert.match(text, /^[A-Za-z0-9_-]+$/);
  assert.ok(text.length < 20000, `${text.length} chars`);
  const back = decodeField(text);
  assert.ok(back);
  assert.equal(back.size, 128);
  for (let i = 0; i < f.delta.length; i++) assert.ok(Math.abs(back.delta[i]! - f.delta[i]!) <= 0.005 + 1e-9);
  assert.deepEqual(back.paint, f.paint);
  for (const t of ['', '!!!', 'AAAA', text.slice(0, text.length >> 1)]) assert.equal(decodeField(t), null);
});

test('the same inputs give the same field, and the input is left alone', () => {
  const f0 = emptyField(32, 2);
  const frozen = JSON.stringify(f0);
  const a = apply(f0, flat, { kind: 'carve', x: 20, z: 30, radius: 7, strength: 0.6, dt: 0.4 }, RULES, 0);
  const b = apply(f0, flat, { kind: 'carve', x: 20, z: 30, radius: 7, strength: 0.6, dt: 0.4 }, RULES, 0);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(f0), frozen);
  assert.throws(() => apply(f0, flat, { kind: 'carve', x: 0, z: 0, radius: 0, strength: 1, dt: 1 }, RULES, 0));
  assert.throws(() => apply(f0, flat, { kind: 'carve', x: 0, z: 0, radius: 2, strength: 2, dt: 1 }, RULES, 0));
});

test('performance: a thousand brush strokes on a 256 x 256 field in under a second (1 ms a stroke: the frame budget)', () => {
  let f = emptyField(256, 4);
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) {
    const kind = (['carve', 'raise', 'smooth', 'paint'] as const)[i % 4]!;
    f = apply(f, flat, { kind, x: 100 + (i % 37) * 20, z: 100 + (i % 23) * 30, radius: 8, strength: 0.7, dt: 0.05, preset: 'mud' }, RULES, 1e9).field;
  }
  assert.ok(performance.now() - t0 < 1000, `${performance.now() - t0} ms`);
});
