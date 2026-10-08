import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, fingerprint, encode, decode, type Schema } from '../src/index';

const MATERIAL: Schema = {
  id: 'material', version: 3,
  root: { kind: 'object', fields: {
    name: { kind: 'string', maxBytes: 48 },
    base: { kind: 'color' },
    roughness: { kind: 'float', min: 0, max: 1, step: 0.01 },
    metalness: { kind: 'float', min: 0, max: 1, step: 0.01 },
    style: { kind: 'enum', options: ['clean', 'worn', 'rusted', 'painted'] },
    emissive: { kind: 'bool' },
    layers: { kind: 'array', maxLength: 8, of: { kind: 'object', fields: {
      mask: { kind: 'enum', options: ['edges', 'cavities', 'noise', 'top'] },
      tint: { kind: 'color' },
      amount: { kind: 'float', min: 0, max: 1, step: 0.001 },
      scale: { kind: 'vec3', min: -10, max: 10, step: 0.05 },
      seed: { kind: 'int', min: 0, max: 65535 },
    } } },
  } },
};
const rusty = {
  name: 'Rusted panel ünd Zoë 🚀', base: '#7A4A2B', roughness: 0.83, metalness: 0.4, style: 'rusted', emissive: false,
  layers: [
    { mask: 'edges', tint: '#c9c2b8', amount: 0.35, scale: [1, 1, 1], seed: 42 },
    { mask: 'cavities', tint: '#3b2a1c', amount: 0.6, scale: [2.5, -0.5, 9.95], seed: 65535 },
  ],
};
const safeDecode = (s: Schema, t: string): unknown => { try { return decode(s, t); } catch (e) { assert.fail(`decode threw: ${String(e)}`); } };

test('a preset survives encode and decode: exact where exact, on the grid where quantised', () => {
  const back = decode(MATERIAL, encode(MATERIAL, rusty)) as typeof rusty;
  assert.ok(back);
  assert.equal(back.name, rusty.name);
  assert.equal(back.base, '#7a4a2b');
  assert.equal(back.style, 'rusted');
  assert.equal(back.emissive, false);
  assert.ok(Math.abs(back.roughness - 0.83) < 1e-9 && Math.abs(back.metalness - 0.4) < 1e-9);
  assert.equal(back.layers.length, 2);
  assert.deepEqual(back.layers[1]!.scale.map((v) => Math.round(v * 100) / 100), [2.5, -0.5, 9.95]);
  assert.equal(back.layers[1]!.seed, 65535);
  assert.ok(Math.abs(back.layers[0]!.amount - 0.35) < 1e-9);
});

test('codes are canonical: the same preset gives the same code whatever its key order, and re-encoding changes nothing', () => {
  const a = encode(MATERIAL, rusty);
  const shuffled = { layers: rusty.layers, emissive: false, style: 'rusted', metalness: 0.4, roughness: 0.83, base: '#7A4A2B', name: rusty.name };
  assert.equal(encode(MATERIAL, shuffled), a);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.equal(encode(MATERIAL, decode(MATERIAL, a)), a);
});

test('encode refuses what does not fit the schema', () => {
  const bad: unknown[] = [
    { ...rusty, roughness: 1.5 },
    { ...rusty, roughness: 0.833 },
    { ...rusty, style: 'shiny' },
    { ...rusty, base: 'red' },
    { ...rusty, name: 'x'.repeat(49) },
    { ...rusty, extra: 1 },
    { name: rusty.name },
    { ...rusty, layers: Array.from({ length: 9 }, () => rusty.layers[0]) },
    { ...rusty, layers: [{ ...rusty.layers[0], seed: 1.5 }] },
    { ...rusty, layers: [{ ...rusty.layers[0], scale: [1, 1] }] },
    { ...rusty, emissive: 'yes' },
    null,
  ];
  for (const v of bad) assert.throws(() => encode(MATERIAL, v), JSON.stringify(v)?.slice(0, 60));
});

test('another schema, or another version of this one, cannot read the code', () => {
  const code = encode(MATERIAL, rusty);
  const v4: Schema = { ...MATERIAL, version: 4 };
  const other: Schema = { id: 'light', version: 3, root: MATERIAL.root };
  assert.notEqual(fingerprint(v4), fingerprint(MATERIAL));
  assert.notEqual(fingerprint(other), fingerprint(MATERIAL));
  assert.equal(safeDecode(v4, code), null);
  assert.equal(safeDecode(other, code), null);
  const reordered: Schema = { id: 'material', version: 3, root: { kind: 'object', fields: Object.fromEntries(Object.entries((MATERIAL.root as { fields: Record<string, unknown> }).fields).reverse()) } as Schema['root'] };
  assert.equal(fingerprint(reordered), fingerprint(MATERIAL), 'key order does not change the fingerprint');
});

test('decode never throws: junk, damage, truncation and extra characters give null or a value that fits', () => {
  const good = encode(MATERIAL, rusty);
  for (const t of ['', '!!!', 'AAAA', good.slice(0, good.length >> 1), good + 'A', good + 'AAAA', ' ' + good]) assert.equal(safeDecode(MATERIAL, t), null, `accepted ${t.slice(0, 12)}`);
  let seed = 99;
  const rnd = (): number => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let survived = 0;
  for (let k = 0; k < 3000; k++) {
    const i = Math.floor(rnd() * good.length);
    const t = good.slice(0, i) + alphabet[Math.floor(rnd() * 64)] + good.slice(i + 1);
    if (t === good) continue;
    const d = safeDecode(MATERIAL, t);
    if (d === null) continue;
    survived++;
    assert.equal(encode(MATERIAL, d), t, 'a value that decodes re-encodes to the same text');
  }
  assert.ok(survived < 30, `${survived} damaged codes were accepted`);
  assert.equal(safeDecode(MATERIAL, 'A'.repeat(Math.ceil((LIMITS.maxBytes * 4) / 3) + 100)), null);
});

test('codes are compact: a 200-value preset stays small', () => {
  const big: Schema = { id: 'curve', version: 1, root: { kind: 'array', maxLength: 200, of: { kind: 'float', min: 0, max: 1, step: 0.01 } } };
  const values = Array.from({ length: 200 }, (_, i) => Math.round(((Math.sin(i) + 1) / 2) * 100) / 100);
  const code = encode(big, values);
  assert.ok(code.length <= Math.ceil(((200 * 1) + 32) * 4 / 3), `${code.length} chars`);
  assert.deepEqual((decode(big, code) as number[]).map((v) => Math.round(v * 100) / 100), values);
});

test('performance: ten thousand decodes of a material in under 300 ms', () => {
  const code = encode(MATERIAL, rusty);
  const t0 = performance.now();
  for (let i = 0; i < 10000; i++) assert.ok(decode(MATERIAL, code));
  assert.ok(performance.now() - t0 < 300, `${performance.now() - t0} ms`);
});
