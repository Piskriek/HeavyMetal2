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

// landed at 600 ms: alone it took about 250 ms on the minimum-spec laptop, too close to 300 on a busy one
test('performance: ten thousand decodes of a material in under 600 ms', () => {
  const code = encode(MATERIAL, rusty);
  const t0 = performance.now();
  for (let i = 0; i < 10000; i++) assert.ok(decode(MATERIAL, code));
  assert.ok(performance.now() - t0 < 600, `${performance.now() - t0} ms`);
});

// ---------------------------------------------------------------------------
// Own tests. These craft hostile codes with their own base64url and CRC-32,
// so they do not depend on the codec's internals beyond the layout in the docs.
// ---------------------------------------------------------------------------

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function unb64(text: string): number[] {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of text) {
    acc = (acc << 6) | ALPHA.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
    }
    acc &= (1 << bits) - 1;
  }
  return out;
}

function b64(bytes: number[]): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += ALPHA.charAt((acc >> bits) & 63);
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHA.charAt((acc << (6 - bits)) & 63);
  return out;
}

function crc32(bytes: number[]): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Seals a code body (everything before the CRC) with a correct CRC, so only the content is wrong. */
function reseal(body: number[]): string {
  const c = crc32(body);
  return b64([...body, c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255]);
}

function be(n: number, width: number): number[] {
  return Array.from({ length: width }, (_, i) => Math.floor(n / 256 ** (width - 1 - i)) % 256);
}

test('the fingerprint covers the id, the version and every setting', () => {
  const base: Schema = { id: 'x', version: 1, root: { kind: 'float', min: 0, max: 1, step: 0.01 } };
  const variants: Schema[] = [
    { ...base, id: 'y' },
    { ...base, version: 2 },
    { ...base, root: { kind: 'float', min: 0, max: 1, step: 0.02 } },
    { ...base, root: { kind: 'float', min: 0, max: 2, step: 0.01 } },
    { ...base, root: { kind: 'float', min: -1, max: 1, step: 0.01 } },
    { ...base, root: { kind: 'vec3', min: 0, max: 1, step: 0.01 } },
  ];
  const all = new Set([fingerprint(base), ...variants.map((s) => fingerprint(s))]);
  assert.equal(all.size, variants.length + 1);
  assert.ok(Number.isInteger(fingerprint(base)) && fingerprint(base) >= 0 && fingerprint(base) < 2 ** 32);
  const code = encode(base, 0.5);
  for (const s of variants) assert.equal(decode(s, code), null);
});

test('floats decode exactly on the grid, -0 never appears, and the tolerance is step / 1000', () => {
  const S: Schema = { id: 'grid', version: 1, root: { kind: 'object', fields: {
    f: { kind: 'float', min: 0.25, max: 2.25, step: 0.125 },
    i: { kind: 'int', min: -5, max: 5 },
    v: { kind: 'vec3', min: -1, max: 1, step: 0.5 },
  } } };
  const back = decode(S, encode(S, { f: 1.5000001, i: -0, v: [-0, 0.5, -1] })) as { f: number; i: number; v: number[] };
  assert.equal(back.f, 1.5);
  assert.ok(Object.is(back.i, 0));
  assert.deepEqual(back.v, [0, 0.5, -1]);
  assert.ok(back.v.every((x) => !Object.is(x, -0)));
  assert.throws(() => encode(S, { f: 1.50013, i: 0, v: [0, 0, 0] }));
});

test('colours are read case-insensitively and always come back lower-case', () => {
  const C: Schema = { id: 'c', version: 1, root: { kind: 'color' } };
  assert.equal(decode(C, encode(C, '#ABCDEF')), '#abcdef');
  assert.equal(encode(C, '#ABCDEF'), encode(C, '#abcdef'));
  assert.throws(() => encode(C, '#abcde'));
});

test('a code with a valid CRC but broken UTF-8, a trailing byte or a bad length is refused', () => {
  const T: Schema = { id: 'text', version: 1, root: { kind: 'string', maxBytes: 8 } };
  assert.equal(decode(T, encode(T, 'ü')), 'ü');
  const body = unb64(encode(T, 'ab')).slice(0, -4); // header, length 2, 'a', 'b'
  assert.equal(decode(T, reseal(body)), 'ab');
  for (const seq of [[0xff], [0xc0, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe2, 0x82]]) {
    assert.equal(decode(T, reseal([...body.slice(0, 7), seq.length + 1, ...seq, 0x62])), null, `accepted ${seq.map((b) => b.toString(16))}`);
  }
  assert.equal(decode(T, reseal([...body, 0])), null, 'trailing byte');
  assert.equal(decode(T, reseal([...body.slice(0, 7), 9, ...body.slice(8)])), null, 'length above maxBytes');
  const badMagic = [...body];
  badMagic[0] = 0;
  assert.equal(decode(T, reseal(badMagic)), null, 'zero magic');
});

test('the size cap: encode refuses a code over 65536 bytes, and accepts one at the limit', () => {
  const B: Schema = { id: 'blob', version: 1, root: { kind: 'string', maxBytes: LIMITS.maxBytes } };
  const fits = 'a'.repeat(LIMITS.maxBytes - 7 - 3 - 4); // header, 3-byte length, CRC
  assert.equal(decode(B, encode(B, fits)), fits);
  assert.throws(() => encode(B, fits + 'a'), /65536/);
  assert.equal(safeDecode(B, 'A'.repeat(Math.ceil((LIMITS.maxBytes * 4) / 3) + 1)), null);
});

test('zero-width items cannot make decode loop long: the work budget is shared by encode and decode', () => {
  const Z: Schema = { id: 'z', version: 1, root: { kind: 'array', maxLength: 2 ** 40, of: { kind: 'enum', options: ['only'] } } };
  const head = unb64(encode(Z, [])).slice(0, 7);
  const thousand = decode(Z, reseal([...head, ...be(1000, 6)])) as unknown[];
  assert.equal(thousand.length, 1000);
  assert.equal(thousand[999], 'only');
  assert.equal(decode(Z, reseal([...head, ...be(2_000_000, 6)])), null);
  assert.throws(() => encode(Z, new Array<string>(2_000_000).fill('only')));
});

test('field names that look like Object.prototype members are ordinary fields', () => {
  const P: Schema = { id: 'p', version: 1, root: { kind: 'object', fields: {
    // as const: keys named like Object.prototype members lose the contextual type, so the kinds would widen to string
    toString: { kind: 'bool' as const },
    constructor: { kind: 'int' as const, min: 0, max: 9 },
  } } };
  const code = encode(P, { toString: true, constructor: 7 });
  assert.deepEqual(decode(P, code), { toString: true, constructor: 7 });
  assert.throws(() => encode(P, Object.create({ toString: true, constructor: 7 })));
  assert.throws(() => encode(P, { toString: true }));
});

test('decode refuses non-string input without throwing', () => {
  assert.equal(safeDecode(MATERIAL, null as unknown as string), null);
  assert.equal(safeDecode(MATERIAL, 42 as unknown as string), null);
});
