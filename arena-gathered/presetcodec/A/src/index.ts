/* ==========================================================================
 * @hm/presetcodec
 *
 * Shareable, self-checking text codes for game-editor presets: a material, a
 * light rig, a VFX emitter, a sound.  A schema describes the preset; `encode`
 * turns a value that fits the schema into one short code; `decode` turns the
 * text back into a value that fits the schema, or `null`.
 *
 * Codes come from other people, so decoding treats the text as hostile: it
 * never throws, never loops for long, and returns either a value that fits the
 * schema exactly or `null`.
 *
 * The bytes behind a code are:
 *
 *   magic0 magic1 version fp0 fp1 fp2 fp3 | value | crc0 crc1 crc2 crc3
 *
 *   magic    two non-zero bytes
 *   version  the format version of this codec
 *   fp       the schema's 32-bit fingerprint, big-endian
 *   value    the preset, written in a fixed order
 *   crc      CRC-32 of every byte before it, little-endian
 *
 * The bytes are rendered as base64url without padding.  Decoding re-encodes
 * the bytes it read and demands the very same text back, so every accepted
 * code is canonical.
 *
 * This module imports nothing and touches nothing: no DOM, no Date, no
 * randomness, no Buffer, no btoa, no TextEncoder.  Base64url, UTF-8 and CRC-32
 * are written out below.  Every exported function is pure.
 * ========================================================================== */

/* ==========================================================================
 * Public shape
 * ========================================================================== */

/** One field of a preset.  Recursive through `array` and `object`. */
export type Field =
  | { readonly kind: 'bool' }
  | { readonly kind: 'int'; readonly min: number; readonly max: number }
  | { readonly kind: 'float'; readonly min: number; readonly max: number; readonly step: number }
  | { readonly kind: 'enum'; readonly options: readonly string[] }
  | { readonly kind: 'string'; readonly maxBytes: number }
  | { readonly kind: 'color' }
  | { readonly kind: 'vec3'; readonly min: number; readonly max: number; readonly step: number }
  | { readonly kind: 'array'; readonly of: Field; readonly maxLength: number }
  | { readonly kind: 'object'; readonly fields: Readonly<Record<string, Field>> };

/** A named, versioned preset description. */
export interface Schema {
  readonly id: string;
  readonly version: number;
  readonly root: Field;
}

/** Hard ceilings.  A code never encodes to more than `maxBytes` bytes. */
export const LIMITS: { readonly maxBytes: 65536 } = { maxBytes: 65536 };

/* ==========================================================================
 * Small numeric helpers
 * ========================================================================== */

const U32_MAX = 0xffffffff;
const MAX_DEPTH = 32;

/** Never hand back -0. */
const norm0 = (n: number): number => (n === 0 ? 0 : n);

const isU32 = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= U32_MAX;

/** How many base64url characters `n` bytes take (no padding). */
const b64Length = (n: number): number => Math.floor((n * 4 + 2) / 3);

/* ==========================================================================
 * UTF-8, written out (no TextEncoder)
 * ========================================================================== */

/** The code point starting at `i`, or `null` for a lone surrogate. */
const codePointAt = (s: string, i: number): number | null => {
  const c = s.charCodeAt(i);
  if (c < 0xd800 || c >= 0xe000) return c;
  if (c >= 0xdc00) return null; // stray low surrogate
  const lo = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
  if (lo < 0xdc00 || lo >= 0xe000) return null; // unpaired high surrogate
  return 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
};

const utf8Size = (cp: number): number => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Encode a JS string to UTF-8 bytes, or `null` if it holds a lone surrogate. */
const utf8Encode = (s: string): Uint8Array | null => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cp = codePointAt(s, i);
    if (cp === null) return null;
    n += utf8Size(cp);
    if (cp > 0xffff) i++;
  }
  const out = new Uint8Array(n);
  let p = 0;
  for (let i = 0; i < s.length; i++) {
    const cp = codePointAt(s, i);
    if (cp === null) return null;
    if (cp < 0x80) {
      out[p] = cp;
      p += 1;
    } else if (cp < 0x800) {
      out[p] = 0xc0 | (cp >> 6);
      out[p + 1] = 0x80 | (cp & 0x3f);
      p += 2;
    } else if (cp < 0x10000) {
      out[p] = 0xe0 | (cp >> 12);
      out[p + 1] = 0x80 | ((cp >> 6) & 0x3f);
      out[p + 2] = 0x80 | (cp & 0x3f);
      p += 3;
    } else {
      out[p] = 0xf0 | (cp >> 18);
      out[p + 1] = 0x80 | ((cp >> 12) & 0x3f);
      out[p + 2] = 0x80 | ((cp >> 6) & 0x3f);
      out[p + 3] = 0x80 | (cp & 0x3f);
      p += 4;
    }
    if (cp > 0xffff) i++;
  }
  return out;
};

/**
 * Strictly decode `bytes[start, end)` as UTF-8.  Overlong forms, surrogates,
 * code points above U+10FFFF and truncated sequences all give `null`.
 */
const utf8Decode = (b: ArrayLike<number>, start: number, end: number): string | null => {
  let out = '';
  let i = start;
  while (i < end) {
    const b0 = b[i];
    if (b0 === undefined) return null;
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
      continue;
    }
    let extra: number;
    let cp: number;
    if (b0 >= 0xc2 && b0 <= 0xdf) {
      extra = 1;
      cp = b0 & 0x1f;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      extra = 2;
      cp = b0 & 0x0f;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      extra = 3;
      cp = b0 & 0x07;
    } else {
      return null; // stray continuation byte or overlong lead
    }
    if (i + extra >= end) return null;
    for (let j = 1; j <= extra; j++) {
      const bc = b[i + j];
      if (bc === undefined || (bc & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (bc & 0x3f);
    }
    if (extra === 2 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff))) return null;
    if (extra === 3 && (cp < 0x10000 || cp > 0x10ffff)) return null;
    if (cp > 0xffff) {
      const c = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
    i += extra + 1;
  }
  return out;
};

/* ==========================================================================
 * Base64url, written out (no btoa)
 * ========================================================================== */

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const B64_LOOKUP: Int16Array = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) table[B64_ALPHABET.charCodeAt(i)] = i;
  return table;
})();

const b64Value = (code: number): number => {
  if (code >= 128 || code < 0) return -1;
  const v = B64_LOOKUP[code];
  return v === undefined ? -1 : v;
};

/** Base64url without padding. */
const b64uEncode = (b: ArrayLike<number>): string => {
  const n = b.length;
  let out = '';
  let i = 0;
  for (; i + 3 <= n; i += 3) {
    const x = ((b[i] ?? 0) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out +=
      B64_ALPHABET.charAt((x >> 18) & 63) +
      B64_ALPHABET.charAt((x >> 12) & 63) +
      B64_ALPHABET.charAt((x >> 6) & 63) +
      B64_ALPHABET.charAt(x & 63);
  }
  const left = n - i;
  if (left === 1) {
    const x = b[i] ?? 0;
    out += B64_ALPHABET.charAt((x >> 2) & 63) + B64_ALPHABET.charAt((x << 4) & 63);
  } else if (left === 2) {
    const x = ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
    out +=
      B64_ALPHABET.charAt((x >> 10) & 63) +
      B64_ALPHABET.charAt((x >> 4) & 63) +
      B64_ALPHABET.charAt((x << 2) & 63);
  }
  return out;
};

/** Base64url without padding, strictly: bad characters or stray bits give `null`. */
const b64uDecode = (text: string): Uint8Array | null => {
  const n = text.length;
  if (n % 4 === 1) return null;
  const out: number[] = [];
  let i = 0;
  for (; i + 4 <= n; i += 4) {
    const a = b64Value(text.charCodeAt(i));
    const b = b64Value(text.charCodeAt(i + 1));
    const c = b64Value(text.charCodeAt(i + 2));
    const d = b64Value(text.charCodeAt(i + 3));
    if ((a | b | c | d) < 0) return null;
    out.push((a << 2) | (b >> 4), ((b & 15) << 4) | (c >> 2), ((c & 3) << 6) | d);
  }
  const left = n - i;
  if (left === 2) {
    const a = b64Value(text.charCodeAt(i));
    const b = b64Value(text.charCodeAt(i + 1));
    if ((a | b) < 0) return null;
    if ((b & 15) !== 0) return null; // bits that no byte claims
    out.push((a << 2) | (b >> 4));
  } else if (left === 3) {
    const a = b64Value(text.charCodeAt(i));
    const b = b64Value(text.charCodeAt(i + 1));
    const c = b64Value(text.charCodeAt(i + 2));
    if ((a | b | c) < 0) return null;
    if ((c & 3) !== 0) return null; // bits that no byte claims
    out.push((a << 2) | (b >> 4), ((b & 15) << 4) | (c >> 2));
  }
  const bytes = new Uint8Array(out.length);
  bytes.set(out);
  return bytes;
};

/* ==========================================================================
 * CRC-32 (IEEE 802.3), written out
 * ========================================================================== */

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (b: ArrayLike<number>, from: number, to: number): number => {
  let c = 0xffffffff;
  for (let i = from; i < to; i++) {
    const x = b[i];
    if (x === undefined) return 0;
    const t = CRC_TABLE[(c ^ x) & 0xff];
    c = (t === undefined ? 0 : t) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

/* ==========================================================================
 * FNV-1a, 32-bit
 * ========================================================================== */

const fnv1a = (b: ArrayLike<number>): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    if (x === undefined) return 0;
    h = Math.imul(h ^ x, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

/* ==========================================================================
 * Schema: validation and canonical description
 * ========================================================================== */

const sortedKeys = (fields: Readonly<Record<string, Field>>): string[] => Object.keys(fields).sort();

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** How many steps of `step` fit between `min` and `max`. */
const floatSteps = (f: { readonly min: number; readonly max: number; readonly step: number }): number =>
  Math.round((f.max - f.min) / f.step);

const SAFE_INT = 9007199254740991;

/** An `int` field may be negative; only its width has to fit a 32-bit varint. */
const checkIntRange = (min: number, max: number, path: string): void => {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error(`${path}: min and max must be whole numbers`);
  }
  if (Math.abs(min) > SAFE_INT || Math.abs(max) > SAFE_INT) {
    throw new Error(`${path}: min and max are too large to be exact`);
  }
  if (min > max) throw new Error(`${path}: min ${min} is above max ${max}`);
  if (max - min > U32_MAX) throw new Error(`${path}: range wider than 32 bits`);
};

const validateField = (f: Field, path: string, depth: number): void => {
  if (depth > MAX_DEPTH) throw new Error(`${path}: schema nested more than ${MAX_DEPTH} deep`);
  if (typeof f !== 'object' || f === null) throw new Error(`${path}: not a field`);
  switch (f.kind) {
    case 'bool':
    case 'color':
      return;
    case 'int': {
      checkIntRange(f.min, f.max, path);
      return;
    }
    case 'float':
    case 'vec3': {
      if (!Number.isFinite(f.min) || !Number.isFinite(f.max)) throw new Error(`${path}: min and max must be finite`);
      if (!Number.isFinite(f.step) || !(f.step > 0)) throw new Error(`${path}: step must be above zero`);
      if (f.min > f.max) throw new Error(`${path}: min ${f.min} is above max ${f.max}`);
      const steps = floatSteps(f);
      if (steps < 0 || steps > U32_MAX) throw new Error(`${path}: too many steps`);
      return;
    }
    case 'enum': {
      if (!Array.isArray(f.options)) throw new Error(`${path}: options must be a list`);
      if (f.options.length === 0) throw new Error(`${path}: an enum needs at least one option`);
      if (f.options.length > U32_MAX) throw new Error(`${path}: too many options`);
      for (const o of f.options) if (typeof o !== 'string') throw new Error(`${path}: enum options must be text`);
      return;
    }
    case 'string': {
      if (!isU32(f.maxBytes) || f.maxBytes > LIMITS.maxBytes) {
        throw new Error(`${path}: maxBytes must be 0..${LIMITS.maxBytes}`);
      }
      return;
    }
    case 'array': {
      if (!isU32(f.maxLength)) throw new Error(`${path}: maxLength must be a 32-bit unsigned integer`);
      validateField(f.of, `${path}[]`, depth + 1);
      return;
    }
    case 'object': {
      if (typeof f.fields !== 'object' || f.fields === null) throw new Error(`${path}: fields must be an object`);
      for (const k of Object.keys(f.fields)) {
        if (k.length === 0) throw new Error(`${path}: field names must not be empty`);
        const sub = f.fields[k];
        if (sub === undefined) throw new Error(`${path}.${k}: field is missing`);
        validateField(sub, `${path}.${k}`, depth + 1);
      }
      return;
    }
    default:
      throw new Error(`${path}: unknown field kind`);
  }
};

const validateSchema = (s: Schema): void => {
  if (typeof s !== 'object' || s === null) throw new Error('schema: not an object');
  if (typeof s.id !== 'string') throw new Error('schema: id must be text');
  if (!isU32(s.version)) throw new Error('schema: version must be a 32-bit unsigned integer');
  validateField(s.root, 'root', 0);
};

/** Length-prefixed text, so the description stays unambiguous. */
const esc = (s: string): string => `${s.length}:${s}`;

const describeField = (f: Field, depth: number): string => {
  switch (f.kind) {
    case 'bool':
      return 'bool';
    case 'int':
      return `int(${f.min},${f.max})`;
    case 'float':
      return `float(${f.min},${f.max},${f.step})`;
    case 'enum':
      return `enum(${f.options.map(esc).join('|')})`;
    case 'string':
      return `string(${f.maxBytes})`;
    case 'color':
      return 'color';
    case 'vec3':
      return `vec3(${f.min},${f.max},${f.step})`;
    case 'array':
      return `array(${f.maxLength},${describeField(f.of, depth + 1)})`;
    case 'object': {
      let out = 'object(';
      let first = true;
      for (const k of sortedKeys(f.fields)) {
        const sub = f.fields[k];
        if (sub === undefined) throw new Error(`object field ${k} is missing`);
        out += `${first ? '' : ','}${esc(k)}=${describeField(sub, depth + 1)}`;
        first = false;
      }
      return `${out})`;
    }
    default:
      throw new Error('unknown field kind');
  }
};

/* ==========================================================================
 * The value, as a tree of quantised numbers
 *
 * Parsing builds this tree; writing turns it back into the exact bytes it came
 * from.  Comparing the two is what makes a code canonical: anything that would
 * not survive a round trip (a non-minimal varint, a padded base64 character,
 * trailing bytes, an overlong UTF-8 sequence) is refused.
 * ========================================================================== */

type Node =
  | { readonly kind: 'bool'; readonly v: boolean }
  | { readonly kind: 'int'; readonly k: number }
  | { readonly kind: 'float'; readonly k: number }
  | { readonly kind: 'enum'; readonly k: number }
  | { readonly kind: 'string'; readonly v: string }
  | { readonly kind: 'color'; readonly rgb: number }
  | { readonly kind: 'vec3'; readonly k: readonly [number, number, number] }
  | { readonly kind: 'array'; readonly items: readonly Node[] }
  | { readonly kind: 'object'; readonly entries: readonly (readonly [string, Node])[] };

/* ==========================================================================
 * Encoding a value
 * ========================================================================== */

const asArray = (v: unknown): readonly unknown[] | null => (Array.isArray(v) ? (v as readonly unknown[]) : null);

const asRecord = (v: unknown): Record<string, unknown> | null => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
};

const typeName = (v: unknown): string => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'a list';
  return typeof v;
};

const hexValue = (c: number): number | null => {
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 102) return c - 97 + 10;
  if (c >= 65 && c <= 70) return c - 65 + 10;
  return null;
};

const hexPair = (s: string, i: number): number | null => {
  const hi = hexValue(s.charCodeAt(i));
  const lo = hexValue(s.charCodeAt(i + 1));
  if (hi === null || lo === null) return null;
  return hi * 16 + lo;
};

const parseColor = (v: unknown): number | null => {
  if (typeof v !== 'string' || v.length !== 7 || v.charCodeAt(0) !== 35) return null;
  const r = hexPair(v, 1);
  const g = hexPair(v, 3);
  const b = hexPair(v, 5);
  if (r === null || g === null || b === null) return null;
  return ((r << 16) | (g << 8) | b) >>> 0;
};

const HEX = '0123456789abcdef';

const hexByte = (n: number): string => HEX.charAt((n >> 4) & 15) + HEX.charAt(n & 15);

/** The integer `round((v - min) / step)`, checked against the grid and range. */
const encodeFloat = (
  f: { readonly min: number; readonly max: number; readonly step: number },
  v: unknown,
  path: string,
): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${path}: expected a number, got ${typeName(v)}`);
  const steps = floatSteps(f);
  const k = Math.round((v - f.min) / f.step);
  if (k < 0 || k > steps) throw new Error(`${path}: ${v} is outside ${f.min}..${f.max}`);
  const onGrid = f.min + k * f.step;
  if (Math.abs(v - onGrid) > f.step / 1000) {
    throw new Error(`${path}: ${v} is not on the ${f.step} grid`);
  }
  return k + 0;
};

/**
 * Check `v` against `f` and write its bytes.  The first thing every call does
 * is look at the size of what has been written so far, so a value that cannot
 * possibly fit is abandoned after at most one more field rather than after the
 * whole preset.
 */
const encodeValue = (f: Field, v: unknown, buf: number[], path: string, depth: number): void => {
  if (buf.length > LIMITS.maxBytes) throw new Error(`code too large at ${path}`);
  if (depth > MAX_DEPTH) throw new Error(`${path}: nested more than ${MAX_DEPTH} deep`);
  switch (f.kind) {
    case 'bool': {
      if (typeof v !== 'boolean') throw new Error(`${path}: expected true or false, got ${typeName(v)}`);
      buf.push(v ? 1 : 0);
      return;
    }
    case 'int': {
      if (typeof v !== 'number' || !Number.isInteger(v)) {
        throw new Error(`${path}: expected a whole number, got ${typeName(v)}`);
      }
      if (v < f.min || v > f.max) throw new Error(`${path}: ${v} is outside ${f.min}..${f.max}`);
      writeVarint(buf, norm0(v - f.min));
      return;
    }
    case 'float': {
      writeVarint(buf, encodeFloat(f, v, path));
      return;
    }
    case 'vec3': {
      const arr = asArray(v);
      if (arr === null || arr.length !== 3) throw new Error(`${path}: expected three numbers`);
      writeVarint(buf, encodeFloat(f, arr[0], `${path}.x`));
      writeVarint(buf, encodeFloat(f, arr[1], `${path}.y`));
      writeVarint(buf, encodeFloat(f, arr[2], `${path}.z`));
      return;
    }
    case 'enum': {
      if (typeof v !== 'string') throw new Error(`${path}: expected one of ${f.options.join(', ')}`);
      const i = f.options.indexOf(v);
      if (i < 0) throw new Error(`${path}: ${v} is not one of ${f.options.join(', ')}`);
      writeVarint(buf, i);
      return;
    }
    case 'string': {
      if (typeof v !== 'string') throw new Error(`${path}: expected text, got ${typeName(v)}`);
      const bytes = utf8Encode(v);
      if (bytes === null) throw new Error(`${path}: text holds an unpaired surrogate`);
      if (bytes.length > f.maxBytes) {
        throw new Error(`${path}: ${bytes.length} bytes of text, at most ${f.maxBytes} allowed`);
      }
      writeVarint(buf, bytes.length);
      for (const x of bytes) buf.push(x);
      return;
    }
    case 'color': {
      const rgb = parseColor(v);
      if (rgb === null) throw new Error(`${path}: expected #rrggbb, got ${String(v)}`);
      buf.push((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
      return;
    }
    case 'array': {
      const arr = asArray(v);
      if (arr === null) throw new Error(`${path}: expected a list, got ${typeName(v)}`);
      if (arr.length > f.maxLength) {
        throw new Error(`${path}: ${arr.length} items, at most ${f.maxLength} allowed`);
      }
      writeVarint(buf, arr.length);
      for (let i = 0; i < arr.length; i++) {
        encodeValue(f.of, arr[i], buf, `${path}[${i}]`, depth + 1);
      }
      return;
    }
    case 'object': {
      const rec = asRecord(v);
      if (rec === null) throw new Error(`${path}: expected an object, got ${typeName(v)}`);
      for (const key of Object.keys(rec)) {
        if (!hasOwn(f.fields, key)) throw new Error(`${path}: unknown key ${key}`);
      }
      // Sorted key order, so the order the keys arrived in never matters.
      for (const key of sortedKeys(f.fields)) {
        if (!hasOwn(rec, key)) throw new Error(`${path}: missing key ${key}`);
        const sub = f.fields[key];
        if (sub === undefined) throw new Error(`${path}: field ${key} is missing`);
        encodeValue(sub, rec[key], buf, `${path}.${key}`, depth + 1);
      }
      return;
    }
    default:
      throw new Error(`${path}: unknown field kind`);
  }
};

/* ==========================================================================
 * Writing a tree back to bytes
 * ========================================================================== */

const writeVarint = (b: number[], v: number): void => {
  if (!Number.isInteger(v) || v < 0 || v > U32_MAX) throw new Error('varint out of range');
  let x = v;
  for (;;) {
    const digit = x % 128;
    if (x < 128) {
      b.push(digit);
      return;
    }
    b.push(digit | 0x80);
    x = Math.floor(x / 128);
  }
};

const writeNode = (b: number[], n: Node): void => {
  switch (n.kind) {
    case 'bool':
      b.push(n.v ? 1 : 0);
      return;
    case 'int':
    case 'float':
    case 'enum':
      writeVarint(b, n.k);
      return;
    case 'string': {
      const bytes = utf8Encode(n.v);
      if (bytes === null) return; // impossible: encode already checked this
      writeVarint(b, bytes.length);
      for (const x of bytes) b.push(x);
      return;
    }
    case 'color':
      b.push((n.rgb >> 16) & 255, (n.rgb >> 8) & 255, n.rgb & 255);
      return;
    case 'vec3':
      writeVarint(b, n.k[0]);
      writeVarint(b, n.k[1]);
      writeVarint(b, n.k[2]);
      return;
    case 'array': {
      writeVarint(b, n.items.length);
      for (const item of n.items) writeNode(b, item);
      return;
    }
    case 'object':
      for (const entry of n.entries) writeNode(b, entry[1]);
      return;
    default:
      return;
  }
};

/* ==========================================================================
 * Reading bytes back into a tree
 * ========================================================================== */

interface Cursor {
  readonly b: ArrayLike<number>;
  p: number;
  readonly end: number;
}

const readByte = (c: Cursor): number | null => {
  if (c.p >= c.end) return null;
  const x = c.b[c.p];
  if (x === undefined) return null;
  c.p += 1;
  return x;
};

/** A minimal LEB128 varint; a padded one is refused. */
const readVarint = (c: Cursor): number | null => {
  let v = 0;
  let mul = 1;
  for (let i = 0; i < 5; i++) {
    if (c.p + i >= c.end) return null;
    const byte = c.b[c.p + i];
    if (byte === undefined) return null;
    const digit = byte & 0x7f;
    if (i === 4 && digit > 15) return null; // would pass 2^32
    v += digit * mul;
    if ((byte & 0x80) === 0) {
      if (i > 0 && digit === 0) return null; // not minimal
      if (v > U32_MAX) return null;
      c.p += i + 1;
      return v;
    }
    mul *= 128;
  }
  return null; // five bytes and still going
};

const parseNode = (f: Field, c: Cursor, depth: number): Node | null => {
  if (depth > MAX_DEPTH) return null;
  switch (f.kind) {
    case 'bool': {
      const byte = readByte(c);
      if (byte === 0) return { kind: 'bool', v: false };
      if (byte === 1) return { kind: 'bool', v: true };
      return null;
    }
    case 'int': {
      const k = readVarint(c);
      if (k === null || k > f.max - f.min) return null;
      return { kind: 'int', k };
    }
    case 'float': {
      const k = readVarint(c);
      if (k === null || k > floatSteps(f)) return null;
      return { kind: 'float', k };
    }
    case 'enum': {
      const k = readVarint(c);
      if (k === null || k >= f.options.length) return null;
      return { kind: 'enum', k };
    }
    case 'string': {
      const len = readVarint(c);
      if (len === null || len > f.maxBytes) return null;
      if (len > c.end - c.p) return null;
      const s = utf8Decode(c.b, c.p, c.p + len);
      if (s === null) return null;
      c.p += len;
      return { kind: 'string', v: s };
    }
    case 'color': {
      const r = readByte(c);
      const g = readByte(c);
      const b = readByte(c);
      if (r === null || g === null || b === null) return null;
      return { kind: 'color', rgb: ((r << 16) | (g << 8) | b) >>> 0 };
    }
    case 'vec3': {
      const steps = floatSteps(f);
      const a = readVarint(c);
      const b = readVarint(c);
      const d = readVarint(c);
      if (a === null || b === null || d === null) return null;
      if (a > steps || b > steps || d > steps) return null;
      return { kind: 'vec3', k: [a, b, d] };
    }
    case 'array': {
      const count = readVarint(c);
      if (count === null || count > f.maxLength) return null;
      const items: Node[] = [];
      for (let i = 0; i < count; i++) {
        const item = parseNode(f.of, c, depth + 1);
        if (item === null) return null;
        items.push(item);
      }
      return { kind: 'array', items };
    }
    case 'object': {
      const entries: [string, Node][] = [];
      for (const key of sortedKeys(f.fields)) {
        const sub = f.fields[key];
        if (sub === undefined) return null;
        const child = parseNode(sub, c, depth + 1);
        if (child === null) return null;
        entries.push([key, child]);
      }
      return { kind: 'object', entries };
    }
    default:
      return null;
  }
};

/* ==========================================================================
 * A tree back to a plain value
 * ========================================================================== */

const toValue = (f: Field, n: Node): unknown => {
  switch (n.kind) {
    case 'bool':
      return n.v;
    case 'int':
      return f.kind === 'int' ? norm0(f.min + n.k) : null;
    case 'float':
      return f.kind === 'float' ? norm0(f.min + n.k * f.step) : null;
    case 'enum':
      return f.kind === 'enum' ? f.options[n.k] ?? null : null;
    case 'string':
      return n.v;
    case 'color':
      return `#${hexByte((n.rgb >> 16) & 255)}${hexByte((n.rgb >> 8) & 255)}${hexByte(n.rgb & 255)}`;
    case 'vec3': {
      if (f.kind !== 'vec3') return null;
      return [
        norm0(f.min + n.k[0] * f.step),
        norm0(f.min + n.k[1] * f.step),
        norm0(f.min + n.k[2] * f.step),
      ];
    }
    case 'array':
      return n.items.map((item) => (f.kind === 'array' ? toValue(f.of, item) : null));
    case 'object': {
      if (f.kind !== 'object') return null;
      const out: Record<string, unknown> = {};
      for (const entry of n.entries) {
        const sub = f.fields[entry[0]];
        if (sub === undefined) return null;
        out[entry[0]] = toValue(sub, entry[1]);
      }
      return out;
    }
    default:
      return null;
  }
};

/* ==========================================================================
 * The code itself
 * ========================================================================== */

const MAGIC_0 = 0x48; // 'H'
const MAGIC_1 = 0x50; // 'P'
const FORMAT = 1;
const HEADER = 7;
const CRC_LEN = 4;

/**
 * The 32-bit FNV-1a fingerprint of a schema, over a canonical description of
 * its id, its version and every field.  Object keys are sorted, so the order
 * they were written in never matters; any change to the schema changes it.
 */
export function fingerprint(schema: Schema): number {
  validateSchema(schema);
  const text = `${esc(schema.id)}@${schema.version};${describeField(schema.root, 0)}`;
  const bytes = utf8Encode(text);
  if (bytes === null) throw new Error('schema: id is not valid text');
  return fnv1a(bytes);
}

/** Turn a value that fits `schema` into a short text code.  Throws on anything else. */
export function encode(schema: Schema, value: unknown): string {
  validateSchema(schema);
  const fp = fingerprint(schema);
  const body: number[] = [];
  encodeValue(schema.root, value, body, '$', 0);
  if (HEADER + body.length + CRC_LEN > LIMITS.maxBytes) {
    throw new Error(`code too large: ${HEADER + body.length + CRC_LEN} bytes, at most ${LIMITS.maxBytes}`);
  }
  const all: number[] = [
    MAGIC_0,
    MAGIC_1,
    FORMAT,
    (fp >>> 24) & 255,
    (fp >>> 16) & 255,
    (fp >>> 8) & 255,
    fp & 255,
  ];
  for (const x of body) all.push(x);
  const crc = crc32(all, 0, all.length);
  all.push(crc & 255, (crc >>> 8) & 255, (crc >>> 16) & 255, (crc >>> 24) & 255);
  return b64uEncode(all);
}

/**
 * Turn a text code back into a value that fits `schema`, or `null`.
 * Never throws; junk, damage, another schema's code, trailing bytes and
 * out-of-range values all give `null`.
 */
export function decode(schema: Schema, text: string): unknown | null {
  try {
    if (typeof text !== 'string') return null;
    // Refused before any work: a code can never be longer than this.
    if (text.length > b64Length(LIMITS.maxBytes)) return null;
    const bytes = b64uDecode(text);
    if (bytes === null) return null;
    if (b64uEncode(bytes) !== text) return null; // not canonical base64url
    if (bytes.length < HEADER + CRC_LEN) return null;
    if (bytes[0] !== MAGIC_0 || bytes[1] !== MAGIC_1 || bytes[2] !== FORMAT) return null;
    const fp =
      (((bytes[3] ?? 0) << 24) | ((bytes[4] ?? 0) << 16) | ((bytes[5] ?? 0) << 8) | (bytes[6] ?? 0)) >>> 0;
    if (fp !== fingerprint(schema)) return null; // another schema, or another version of this one
    const bodyEnd = bytes.length - CRC_LEN;
    const stored =
      (((bytes[bodyEnd] ?? 0) << 24) |
        ((bytes[bodyEnd + 1] ?? 0) << 16) |
        ((bytes[bodyEnd + 2] ?? 0) << 8) |
        (bytes[bodyEnd + 3] ?? 0)) >>>
      0;
    if (crc32(bytes, 0, bodyEnd) !== stored) return null; // damage
    const cursor: Cursor = { b: bytes, p: HEADER, end: bodyEnd };
    const node = parseNode(schema.root, cursor, 0);
    if (node === null) return null;
    if (cursor.p !== bodyEnd) return null; // trailing bytes
    // Canonical: the bytes we would write must be the bytes we read.
    const again: number[] = [];
    writeNode(again, node);
    if (again.length !== bodyEnd - HEADER) return null;
    for (let i = 0; i < again.length; i++) {
      if (again[i] !== bytes[HEADER + i]) return null;
    }
    return toValue(schema.root, node);
  } catch {
    return null;
  }
}
