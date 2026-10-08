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

/* ==========================================================================
 * Our own tests
 * ========================================================================== */

/* A tiny base64url writer and CRC-32, so we can build codes by hand and see
 * what the decoder makes of bytes it would never have written itself. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const b64 = (bytes: readonly number[]): string => {
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const x = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64.charAt(x >> 18) + B64.charAt((x >> 12) & 63) + B64.charAt((x >> 6) & 63) + B64.charAt(x & 63);
  }
  const left = bytes.length - i;
  if (left === 1) {
    const x = bytes[i] ?? 0;
    out += B64.charAt(x >> 2) + B64.charAt((x << 4) & 63);
  } else if (left === 2) {
    const x = ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0);
    out += B64.charAt(x >> 10) + B64.charAt((x >> 4) & 63) + B64.charAt((x << 2) & 63);
  }
  return out;
};
const crc = (bytes: readonly number[]): number[] => {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c & 1) === 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
  }
  const v = (c ^ 0xffffffff) >>> 0;
  return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
};
const head = (schema: Schema): number[] => {
  const fp = fingerprint(schema);
  return [0x48, 0x50, 1, (fp >>> 24) & 255, (fp >>> 16) & 255, (fp >>> 8) & 255, fp & 255];
};
const build = (schema: Schema, body: readonly number[]): string => {
  const bytes = [...head(schema), ...body];
  return b64([...bytes, ...crc(bytes)]);
};
const buildRaw = (header: readonly number[], body: readonly number[]): string => {
  const bytes = [...header, ...body];
  return b64([...bytes, ...crc(bytes)]);
};

const LIGHT: Schema = {
  id: 'light-rig', version: 7,
  root: { kind: 'object', fields: {
    label: { kind: 'string', maxBytes: 24 },
    intensity: { kind: 'float', min: 0, max: 20, step: 0.05 },
    hue: { kind: 'color' },
    falloff: { kind: 'enum', options: ['none', 'linear', 'squared'] },
    position: { kind: 'vec3', min: -100, max: 100, step: 0.5 },
    casts_shadows: { kind: 'bool' },
    gobo: { kind: 'array', maxLength: 4, of: { kind: 'string', maxBytes: 6 } },
  } },
};
const VFX: Schema = {
  id: 'vfx-emitter', version: 1,
  root: { kind: 'array', maxLength: 16, of: { kind: 'object', fields: {
    kind: { kind: 'enum', options: ['spark', 'smoke', 'shard'] },
    rate: { kind: 'float', min: 0, max: 500, step: 1 },
    spread: { kind: 'vec3', min: 0, max: 1, step: 0.01 },
    life: { kind: 'float', min: 0, max: 30, step: 0.5 },
  } } },
};

test('every field kind survives a round trip', () => {
  const kitchen: Schema = {
    id: 'kitchen', version: 1,
    root: { kind: 'object', fields: {
      flag: { kind: 'bool' },
      count: { kind: 'int', min: -1000, max: 1000 },
      gain: { kind: 'float', min: -1, max: 1, step: 0.25 },
      mode: { kind: 'enum', options: ['a', 'b', 'c'] },
      label: { kind: 'string', maxBytes: 12 },
      tint: { kind: 'color' },
      offset: { kind: 'vec3', min: -1, max: 1, step: 0.5 },
      list: { kind: 'array', maxLength: 4, of: { kind: 'int', min: 0, max: 255 } },
      nested: { kind: 'object', fields: { deep: { kind: 'bool' } } },
    } },
  };
  const value = {
    flag: true, count: -7, gain: -0.25, mode: 'c', label: 'h\u00e9llo \ud83d\ude80', tint: '#0a0b0c',
    offset: [-1, 0, 1], list: [0, 255, 7], nested: { deep: false },
  };
  const code = encode(kitchen, value);
  assert.deepEqual(decode(kitchen, code), value);
  assert.equal(encode(kitchen, decode(kitchen, code)), code);
});

test('a light rig and a VFX emitter are just schemas too', () => {
  const rig = {
    label: 'key light', intensity: 12.5, hue: '#ffd9a0', falloff: 'squared',
    position: [10, -25.5, 100], casts_shadows: true, gobo: ['grate', 'soft'],
  };
  assert.deepEqual(decode(LIGHT, encode(LIGHT, rig)), rig);

  const burst = [
    { kind: 'spark', rate: 240, spread: [0.1, 0.2, 0.3], life: 1.5 },
    { kind: 'shard', rate: 0, spread: [1, 0, 0.5], life: 30 },
  ];
  assert.deepEqual(decode(VFX, encode(VFX, burst)), burst);
});

test('the two schemas cannot read each other', () => {
  assert.equal(decode(LIGHT, encode(VFX, [{ kind: 'smoke', rate: 1, spread: [0, 0, 0], life: 1 }])), null);
  assert.equal(decode(VFX, encode(LIGHT, {
    label: 'rim', intensity: 1, hue: '#000000', falloff: 'none', position: [0, 0, 0],
    casts_shadows: false, gobo: [],
  })), null);
});

test('negative and wide int ranges work', () => {
  const s: Schema = { id: 'n', version: 1, root: { kind: 'int', min: -5, max: 5 } };
  assert.equal(decode(s, encode(s, -5)), -5);
  assert.equal(decode(s, encode(s, 0)), 0);
  assert.equal(decode(s, encode(s, 5)), 5);
  assert.throws(() => encode(s, -6));
  assert.throws(() => encode(s, 6));
  assert.throws(() => encode(s, 1.5));
  const wide: Schema = { id: 'w', version: 1, root: { kind: 'int', min: 0, max: 0xffffffff } };
  assert.equal(decode(wide, encode(wide, 0xffffffff)), 0xffffffff);
  assert.equal(decode(wide, encode(wide, 0)), 0);
  assert.throws(() => encode(wide, 0x100000000));
});

test('a string is limited by bytes, not by characters', () => {
  const s: Schema = { id: 'b', version: 1, root: { kind: 'string', maxBytes: 4 } };
  assert.equal(decode(s, encode(s, 'abcd')), 'abcd');
  assert.equal(decode(s, encode(s, '\u00e9\u00e9')), '\u00e9\u00e9'); // e-acute twice, 4 bytes
  assert.equal(decode(s, encode(s, '\u20acx')), '\u20acx'); // euro sign and x, 4 bytes
  assert.throws(() => encode(s, 'abcde'));
  assert.throws(() => encode(s, '\u00e9\u00e9\u00e9')); // 6 bytes
  assert.throws(() => encode(s, '\u20ac\u20ac')); // 6 bytes
  assert.throws(() => encode(s, 'ok\ud83d')); // unpaired surrogate
  const empty: Schema = { id: 'b0', version: 1, root: { kind: 'string', maxBytes: 0 } };
  assert.equal(decode(empty, encode(empty, '')), '');
  assert.throws(() => encode(empty, 'a'));
});

test('an empty list and an empty object round trip', () => {
  const list: Schema = { id: 'e1', version: 1, root: { kind: 'array', maxLength: 3, of: { kind: 'bool' } } };
  assert.deepEqual(decode(list, encode(list, [])), []);
  const obj: Schema = { id: 'e2', version: 1, root: { kind: 'object', fields: {} } };
  assert.deepEqual(decode(obj, encode(obj, {})), {});
  assert.equal(encode(obj, {}).length, 16); // 12 bytes, exactly four base64 groups
});

test('a decoded zero is never -0', () => {
  const s: Schema = { id: 'z', version: 1, root: { kind: 'float', min: -1, max: 1, step: 0.5 } };
  for (const v of [-1, -0.5, 0, 0.5, 1]) {
    const back = decode(s, encode(s, v)) as number;
    assert.equal(back, v);
    assert.ok(!Object.is(back, -0), `${v} came back as -0`);
  }
  const v3: Schema = { id: 'z3', version: 1, root: { kind: 'vec3', min: -1, max: 1, step: 0.5 } };
  for (const x of decode(v3, encode(v3, [0, 0, 0])) as number[]) assert.ok(!Object.is(x, -0));
  const i: Schema = { id: 'zi', version: 1, root: { kind: 'int', min: -1, max: 1 } };
  assert.ok(!Object.is(decode(i, encode(i, 0)), -0));
});

test('integers are packed to their range, not to 32 bits', () => {
  const one: Schema = { id: 'p1', version: 1, root: { kind: 'array', maxLength: 100, of: { kind: 'int', min: 0, max: 1 } } };
  const wide: Schema = { id: 'p2', version: 1, root: { kind: 'array', maxLength: 100, of: { kind: 'int', min: 0, max: 0xffffffff } } };
  const bits = Array.from({ length: 100 }, (_, i) => i % 2);
  const big = Array.from({ length: 100 }, (_, i) => i * 40000000);
  assert.ok(encode(one, bits).length * 3 < encode(wide, big).length);
  assert.deepEqual(decode(one, encode(one, bits)), bits);
  assert.deepEqual(decode(wide, encode(wide, big)), big);
});

test('a code is refused unless its bytes are canonical', () => {
  const s: Schema = { id: 'c', version: 1, root: { kind: 'array', maxLength: 4, of: { kind: 'int', min: 0, max: 1000 } } };
  assert.deepEqual(decode(s, build(s, [1, 0xc8, 0x01])), [200]);
  assert.deepEqual(decode(s, build(s, [2, 0xc8, 0x01, 0xc8, 0x01])), [200, 200]);
  // 200 written as a padded varint
  assert.equal(decode(s, build(s, [1, 0xc8, 0x81, 0x00])), null);
  // a trailing byte, a truncated item, a value past the range
  assert.equal(decode(s, build(s, [1, 0xc8, 0x01, 0x00])), null);
  assert.equal(decode(s, build(s, [1, 0xc8])), null);
  assert.equal(decode(s, build(s, [1, 0xe9, 0x07])), null);
  // more items than the schema allows
  assert.equal(decode(s, build(s, [5, 0x00, 0x00, 0x00, 0x00, 0x00])), null);
  // no CRC at all, a broken CRC, the wrong magic, the wrong format version
  assert.equal(decode(s, b64([...head(s), 1, 0xc8, 0x01])), null);
  const withCrc = [...head(s), 1, 0xc8, 0x01, ...crc([...head(s), 1, 0xc8, 0x01])];
  const last = withCrc[withCrc.length - 1] ?? 0;
  assert.equal(decode(s, b64([...withCrc.slice(0, withCrc.length - 1), last ^ 0x01])), null);
  assert.equal(decode(s, buildRaw([0x00, 0x50, 1, ...head(s).slice(3)], [1, 0xc8, 0x01])), null);
  assert.equal(decode(s, buildRaw([0x48, 0x50, 2, ...head(s).slice(3)], [1, 0xc8, 0x01])), null);
  // another schema's fingerprint in the header
  assert.equal(decode({ ...s, id: 'c2' }, build(s, [1, 0xc8, 0x01])), null);
});

test('text that is not canonical base64url is refused', () => {
  const s: Schema = { id: 'q', version: 1, root: { kind: 'bool' } };
  const good = encode(s, true);
  assert.equal(decode(s, good), true);
  assert.equal(decode(s, good + '='), null);
  assert.equal(decode(s, good + 'AA'), null);
  assert.equal(decode(s, good.slice(0, 3) + '+' + good.slice(4)), null);
  assert.equal(decode(s, good.slice(0, 3) + '/' + good.slice(4)), null);
  assert.equal(decode(s, good.slice(0, 3) + ' ' + good.slice(4)), null);
  // a final character changed for another one: the bytes move, the CRC does not
  const lastChar = good.charAt(good.length - 1);
  const other = B64.split('').find((c) => c !== lastChar) ?? 'B';
  assert.equal(decode(s, good.slice(0, good.length - 1) + other), null);
  // a lone character, and one character too many
  assert.equal(decode(s, good.slice(0, good.length - 1)), null);
  assert.equal(decode(s, good.slice(0, good.length - 2)), null);
});

test('the fingerprint notices every change to the schema', () => {
  const fields: Readonly<Record<string, Schema['root']>> = {
    a: { kind: 'int', min: 0, max: 10 },
    b: { kind: 'float', min: 0, max: 1, step: 0.1 },
    c: { kind: 'enum', options: ['x', 'y'] },
    d: { kind: 'string', maxBytes: 8 },
    e: { kind: 'array', maxLength: 2, of: { kind: 'bool' } },
  };
  const base: Schema = { id: 'f', version: 1, root: { kind: 'object', fields } };
  const fp = fingerprint(base);
  const changed: Schema[] = [
    { ...base, id: 'g' },
    { ...base, version: 2 },
    { ...base, root: { kind: 'object', fields: { ...fields, a: { kind: 'int', min: 1, max: 10 } } } },
    { ...base, root: { kind: 'object', fields: { ...fields, b: { kind: 'float', min: 0, max: 1, step: 0.2 } } } },
    { ...base, root: { kind: 'object', fields: { ...fields, c: { kind: 'enum', options: ['x', 'z'] } } } },
    { ...base, root: { kind: 'object', fields: { ...fields, d: { kind: 'string', maxBytes: 9 } } } },
    { ...base, root: { kind: 'object', fields: { ...fields, e: { kind: 'array', maxLength: 3, of: { kind: 'bool' } } } } },
    { ...base, root: { kind: 'object', fields: { ...fields, f: { kind: 'bool' } } } },
  ];
  for (const c of changed) assert.notEqual(fingerprint(c), fp);
  assert.ok(fp >= 0 && fp <= 0xffffffff && Number.isInteger(fp));
  const reordered = Object.fromEntries(Object.entries(fields).reverse());
  assert.equal(fingerprint({ id: 'f', version: 1, root: { kind: 'object', fields: reordered } }), fp);
});

test('the same value gives the same code every time', () => {
  const first = encode(MATERIAL, rusty);
  for (let i = 0; i < 5; i++) assert.equal(encode(MATERIAL, rusty), first);
  const rig = {
    label: 'a', intensity: 0, hue: '#000000', falloff: 'none', position: [0, 0, 0],
    casts_shadows: false, gobo: [],
  };
  const code = encode(LIGHT, rig);
  assert.equal(encode(LIGHT, decode(LIGHT, code)), code);
});

test('encode says why it refused', () => {
  const messages: string[] = [];
  for (const v of [
    { ...rusty, base: 'nope' },
    { ...rusty, roughness: 2 },
    { ...rusty, layers: [{ ...rusty.layers[0], seed: -1 }] },
  ]) {
    try {
      encode(MATERIAL, v);
      assert.fail('should have thrown');
    } catch (e) {
      assert.ok(e instanceof Error);
      messages.push((e as Error).message);
    }
  }
  assert.ok(messages.every((m) => m.length > 0 && m.includes('.')));
  assert.ok((messages[0] ?? '').includes('base'));
});

test('a code is refused when the text is longer than the ceiling', () => {
  assert.equal(LIMITS.maxBytes, 65536);
  const ceiling = Math.ceil((LIMITS.maxBytes * 4) / 3);
  assert.equal(safeDecode(MATERIAL, 'A'.repeat(ceiling + 1)), null);
  assert.equal(safeDecode(MATERIAL, 'A'.repeat(ceiling)), null);
  const big: Schema = { id: 'big', version: 1, root: { kind: 'string', maxBytes: LIMITS.maxBytes - 32 } };
  assert.throws(() => encode(big, 'x'.repeat(LIMITS.maxBytes + 1)));
  const code = encode(big, 'x'.repeat(LIMITS.maxBytes - 32));
  assert.equal(decode(big, code), 'x'.repeat(LIMITS.maxBytes - 32));
});

test('a preset that cannot fit is refused rather than truncated', () => {
  const wide: Schema = { id: 'wide', version: 1, root: { kind: 'array', maxLength: 100000, of: { kind: 'string', maxBytes: 32 } } };
  const many = Array.from({ length: 100000 }, (_, i) => `layer-${i}`);
  assert.throws(() => encode(wide, many));
  const fits = Array.from({ length: 1000 }, (_, i) => `layer-${i}`);
  assert.deepEqual(decode(wide, encode(wide, fits)), fits);
});

test('decode never throws, whatever it is handed', () => {
  const good = encode(MATERIAL, rusty);
  const nasty: unknown[] = [
    good, good.toUpperCase(), good + '\n', '\n' + good, '\u00ff'.repeat(50), good.slice(1), good.slice(2),
    'A', 'AA', 'AAA', 'AAAA', '====', good.replace(/./g, 'A'),
  ];
  for (const t of nasty) {
    const d = safeDecode(MATERIAL, t as string);
    if (d !== null) assert.equal(encode(MATERIAL, d), t as string);
  }
  assert.equal(safeDecode(MATERIAL, undefined as unknown as string), null);
  assert.equal(safeDecode(MATERIAL, null as unknown as string), null);
  assert.equal(safeDecode(MATERIAL, 42 as unknown as string), null);
});

test('a schema that makes no sense is refused by encode, and ignored by decode', () => {
  const broken: Schema[] = [
    { id: 'x', version: -1, root: { kind: 'bool' } },
    { id: 'x', version: 1.5, root: { kind: 'bool' } },
    { id: 'x', version: 1, root: { kind: 'int', min: 5, max: 1 } },
    { id: 'x', version: 1, root: { kind: 'int', min: 0.5, max: 1 } },
    { id: 'x', version: 1, root: { kind: 'float', min: 0, max: 1, step: 0 } },
    { id: 'x', version: 1, root: { kind: 'enum', options: [] } },
    { id: 'x', version: 1, root: { kind: 'string', maxBytes: -1 } },
    { id: 'x', version: 1, root: { kind: 'array', maxLength: -1, of: { kind: 'bool' } } },
    { id: 'x', version: 1, root: { kind: 'object', fields: { '': { kind: 'bool' } } } },
    { id: 'x', version: 1, root: { kind: 'wat' } as unknown as Schema['root'] },
  ];
  for (const s of broken) {
    assert.throws(() => encode(s, true));
    assert.throws(() => fingerprint(s));
    assert.equal(safeDecode(s, encode(MATERIAL, rusty)), null);
  }
});
