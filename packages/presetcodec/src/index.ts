/**
 * @hm/presetcodec: a preset, described by a Schema, as one short text code.
 *
 * Text code = base64url (no padding) of:
 *   [0xB7, 0x5E]    magic
 *   [1]             format version
 *   [u32 BE]        schema fingerprint
 *   value           laid out by the schema (see below)
 *   [u32 BE]        CRC-32 (IEEE) of every byte before it
 *
 * Value layout:
 *   bool    one byte, 0 or 1
 *   int     offset from min, big-endian, as many bytes as (max - min) needs
 *   float   grid index k = round((v - min) / step), sized to the grid
 *   vec3    three grid indices
 *   enum    option index, sized to the option count
 *   string  UTF-8 byte length (sized to maxBytes), then the bytes
 *   color   r, g, b
 *   array   item count (sized to maxLength), then the items
 *   object  its fields in sorted key order, nothing else
 *
 * Decoding treats its input as hostile: it never throws, every loop is bounded,
 * and it returns either a value the schema accepts exactly or null.
 */

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

export interface Schema {
  readonly id: string;
  readonly version: number;
  readonly root: Field;
}

export const LIMITS = { maxBytes: 65536 } as const;

// ---------------------------------------------------------------- constants

const MAGIC_0 = 0xb7;
const MAGIC_1 = 0x5e;
const FORMAT_VERSION = 1;
const HEADER_LEN = 7; // magic (2) + format version (1) + fingerprint (4)
const CRC_LEN = 4;
const MIN_LEN = HEADER_LEN + CRC_LEN;
const MAX_TEXT = Math.ceil((LIMITS.maxBytes * 4) / 3); // base64url length of maxBytes
const MAX_NODES = 1 << 20; // work budget: counted the same way by encode and decode
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const HEX = '0123456789abcdef';
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const B64_REV: number[] = new Array<number>(128).fill(-1);
for (let i = 0; i < 64; i++) B64_REV[ALPHABET.charCodeAt(i)] = i;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

const FINGERPRINTS = new WeakMap<object, number>();
const KEY_ORDER = new WeakMap<object, readonly string[]>();

// ------------------------------------------------------------------ failure

const BAD = new Error('bad code');

/** Internal: aborts a decode. decode() turns it into null. */
function bad(): never {
  throw BAD;
}

/** Internal: aborts an encode with a message that names the path. */
function fail(path: string, why: string): never {
  throw new Error(`${path === '' ? 'value' : path}: ${why}`);
}

interface Reader {
  readonly b: Uint8Array;
  pos: number;
  readonly end: number;
  nodes: number;
}

interface Budget {
  nodes: number;
}

type Grid = { readonly min: number; readonly max: number; readonly step: number };

// ------------------------------------------------------------------ helpers

function hasOwn(o: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key);
}

function sortedKeys(fields: Readonly<Record<string, Field>>): readonly string[] {
  const known = KEY_ORDER.get(fields);
  if (known !== undefined) return known;
  const keys = Object.keys(fields).sort();
  KEY_ORDER.set(fields, keys);
  return keys;
}

function joinPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

/** Bytes needed to hold every integer from 0 to `range`. Always terminates. */
function widthFor(range: number): number {
  let n = 0;
  let r = range;
  while (r > 0 && n < 16) {
    n++;
    r = Math.floor(r / 256);
  }
  return n;
}

function put(w: number[], byte: number): void {
  if (w.length >= LIMITS.maxBytes) throw new Error(`code would exceed ${LIMITS.maxBytes} bytes`);
  w.push(byte);
}

function putUint(w: number[], value: number, width: number): void {
  for (let i = width - 1; i >= 0; i--) put(w, Math.floor(value / 2 ** (8 * i)) % 256);
}

function readUint(r: Reader, width: number): number {
  let v = 0;
  for (let i = 0; i < width; i++) {
    if (r.pos >= r.end) bad();
    v = v * 256 + (r.b[r.pos] ?? 0);
    r.pos++;
  }
  return v;
}

function tick(r: Reader): void {
  r.nodes++;
  if (r.nodes > MAX_NODES) bad();
}

function readBE32(b: Uint8Array, at: number): number {
  return (((b[at] ?? 0) << 24) | ((b[at + 1] ?? 0) << 16) | ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0)) >>> 0;
}

function crc32(bytes: ArrayLike<number>, end: number): number {
  let crc = 0xffffffff;
  for (let i = 0; i < end; i++) {
    crc = (CRC_TABLE[(crc ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** FNV-1a, 32-bit, over the low byte of each character (the description is ASCII). */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ (text.charCodeAt(i) & 0xff), 0x01000193);
  }
  return h >>> 0;
}

function b64Encode(bytes: ArrayLike<number>): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    acc = (acc << 8) | ((bytes[i] ?? 0) & 0xff);
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += ALPHABET.charAt((acc >> bits) & 63);
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET.charAt((acc << (6 - bits)) & 63);
  return out;
}

/** Strict base64url: returns null for bad characters or for non-zero unused bits (non-canonical). */
function b64Decode(text: string): Uint8Array | null {
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const v = c < 128 ? (B64_REV[c] ?? -1) : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o] = (acc >> bits) & 0xff;
      o++;
    }
    acc &= (1 << bits) - 1;
  }
  return acc === 0 ? out : null;
}

/** UTF-8 of a string, or null if it has a lone surrogate or runs past `limit` bytes. */
function utf8Encode(s: string, limit: number): number[] | null {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdfff) {
      const d = s.charCodeAt(i + 1);
      if (c > 0xdbff || !(d >= 0xdc00 && d <= 0xdfff)) return null;
      c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
      i++;
    }
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    if (out.length > limit) return null;
  }
  return out;
}

/** Strict UTF-8: overlongs, surrogates, code points past U+10FFFF and truncation give null. */
function utf8Decode(b: Uint8Array, start: number, end: number): string | null {
  let out = '';
  let i = start;
  while (i < end) {
    const c = b[i] ?? 0;
    if (c < 0x80) {
      out += String.fromCharCode(c);
      i++;
      continue;
    }
    let need = 0;
    let cp = 0;
    let least = 0;
    if (c >= 0xc2 && c <= 0xdf) {
      need = 1;
      cp = c & 0x1f;
      least = 0x80;
    } else if (c >= 0xe0 && c <= 0xef) {
      need = 2;
      cp = c & 0x0f;
      least = 0x800;
    } else if (c >= 0xf0 && c <= 0xf4) {
      need = 3;
      cp = c & 0x07;
      least = 0x10000;
    } else {
      return null;
    }
    if (i + need >= end) return null;
    for (let k = 1; k <= need; k++) {
      const cc = b[i + k] ?? 0;
      if ((cc & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (cc & 0x3f);
    }
    if (cp < least || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    out += String.fromCodePoint(cp);
    i += need + 1;
  }
  return out;
}

// ------------------------------------------------------------ float grids

function gridMax(g: Grid): number {
  return Math.floor((g.max - g.min) / g.step + 1e-9);
}

function gridOk(g: Grid): boolean {
  return (
    Number.isFinite(g.min) &&
    Number.isFinite(g.max) &&
    Number.isFinite(g.step) &&
    g.step > 0 &&
    g.max >= g.min &&
    Number.isFinite(gridMax(g))
  );
}

function gridValue(g: Grid, k: number): number {
  let v = g.min + k * g.step;
  if (v > g.max) v = g.max;
  if (v < g.min) v = g.min;
  return v + 0; // never -0
}

/** Encode side: the grid index of v, or a refusal. */
function gridIndex(g: Grid, v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < g.min || v > g.max) {
    fail(path, `expected a number from ${g.min} to ${g.max}`);
  }
  const k = Math.round((v - g.min) / g.step);
  if (k < 0 || k > gridMax(g)) fail(path, 'outside the grid');
  if (Math.abs(v - (g.min + k * g.step)) > g.step / 1000) {
    fail(path, `not a multiple of ${g.step} from ${g.min}`);
  }
  return k;
}

/** Decode side: the value of grid index k, read from the stream. */
function readGrid(g: Grid, r: Reader): number {
  if (!gridOk(g)) bad();
  const top = gridMax(g);
  const k = readUint(r, widthFor(top));
  if (k > top) bad();
  return gridValue(g, k);
}

// ------------------------------------------------------------ describe

/** Canonical text of a field: every kind and setting, object keys sorted. */
function describeField(f: Field): string {
  switch (f.kind) {
    case 'bool':
      return 'bool';
    case 'int':
      return `int(${f.min},${f.max})`;
    case 'float':
      return `float(${f.min},${f.max},${f.step})`;
    case 'enum':
      return `enum(${f.options.map((o) => JSON.stringify(o)).join(',')})`;
    case 'string':
      return `string(${f.maxBytes})`;
    case 'color':
      return 'color';
    case 'vec3':
      return `vec3(${f.min},${f.max},${f.step})`;
    case 'array':
      return `array(${f.maxLength},${describeField(f.of)})`;
    case 'object': {
      const parts = sortedKeys(f.fields).map((key) => {
        const sub = f.fields[key];
        return `${JSON.stringify(key)}:${sub === undefined ? '' : describeField(sub)}`;
      });
      return `object{${parts.join(',')}}`;
    }
  }
}

// ------------------------------------------------------------ encode side

function encodeField(f: Field, v: unknown, w: number[], path: string, budget: Budget): void {
  budget.nodes++;
  if (budget.nodes > MAX_NODES) fail(path, 'too many values');
  switch (f.kind) {
    case 'bool': {
      if (typeof v !== 'boolean') fail(path, 'expected true or false');
      put(w, v ? 1 : 0);
      return;
    }
    case 'int': {
      if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < f.min || v > f.max) {
        fail(path, `expected a whole number from ${f.min} to ${f.max}`);
      }
      putUint(w, v - f.min, widthFor(f.max - f.min));
      return;
    }
    case 'float': {
      if (!gridOk(f)) fail(path, 'schema grid is invalid');
      putUint(w, gridIndex(f, v, path), widthFor(gridMax(f)));
      return;
    }
    case 'enum': {
      const idx = typeof v === 'string' ? f.options.indexOf(v) : -1;
      if (idx < 0) fail(path, `expected one of: ${f.options.join(', ')}`);
      putUint(w, idx, widthFor(f.options.length - 1));
      return;
    }
    case 'string': {
      const bytes = typeof v === 'string' ? utf8Encode(v, f.maxBytes) : null;
      if (bytes === null) {
        fail(path, `expected text of at most ${f.maxBytes} UTF-8 bytes, with no broken characters`);
      }
      putUint(w, bytes.length, widthFor(f.maxBytes));
      for (const b of bytes) put(w, b);
      return;
    }
    case 'color': {
      if (typeof v !== 'string' || !COLOR_RE.test(v)) fail(path, 'expected a colour like #rrggbb');
      for (let i = 1; i < 7; i += 2) put(w, parseInt(v.slice(i, i + 2), 16));
      return;
    }
    case 'vec3': {
      if (!gridOk(f)) fail(path, 'schema grid is invalid');
      if (!Array.isArray(v) || v.length !== 3) fail(path, 'expected three numbers');
      const xs: readonly unknown[] = v;
      const width = widthFor(gridMax(f));
      for (let i = 0; i < 3; i++) putUint(w, gridIndex(f, xs[i], `${path}[${i}]`), width);
      return;
    }
    case 'array': {
      if (!Array.isArray(v) || v.length > f.maxLength) {
        fail(path, `expected a list of at most ${f.maxLength} items`);
      }
      const items: readonly unknown[] = v;
      putUint(w, items.length, widthFor(f.maxLength));
      for (let i = 0; i < items.length; i++) {
        encodeField(f.of, items[i], w, `${path}[${i}]`, budget);
      }
      return;
    }
    case 'object': {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'expected an object');
      const rec = v as Readonly<Record<string, unknown>>;
      for (const key of Object.keys(rec)) {
        if (!hasOwn(f.fields, key)) fail(joinPath(path, key), 'unknown key');
      }
      for (const key of sortedKeys(f.fields)) {
        const at = joinPath(path, key);
        const sub = f.fields[key];
        if (sub === undefined) fail(at, 'unknown key');
        if (!hasOwn(rec, key)) fail(at, 'missing');
        encodeField(sub, rec[key], w, at, budget);
      }
      return;
    }
  }
}

// ------------------------------------------------------------ decode side

function decodeField(f: Field, r: Reader): unknown {
  tick(r);
  switch (f.kind) {
    case 'bool': {
      const x = readUint(r, 1);
      if (x > 1) bad();
      return x === 1;
    }
    case 'int': {
      const span = f.max - f.min;
      const off = readUint(r, widthFor(span));
      if (off > span) bad();
      return f.min + off + 0;
    }
    case 'float':
      return readGrid(f, r);
    case 'enum': {
      const option = f.options[readUint(r, widthFor(f.options.length - 1))];
      if (option === undefined) bad();
      return option;
    }
    case 'string': {
      const len = readUint(r, widthFor(f.maxBytes));
      if (len > f.maxBytes || r.pos + len > r.end) bad();
      const text = utf8Decode(r.b, r.pos, r.pos + len);
      if (text === null) bad();
      r.pos += len;
      return text;
    }
    case 'color': {
      let hex = '#';
      for (let i = 0; i < 3; i++) {
        const x = readUint(r, 1);
        hex += HEX.charAt(x >> 4) + HEX.charAt(x & 15);
      }
      return hex;
    }
    case 'vec3': {
      const out: number[] = [];
      for (let i = 0; i < 3; i++) out.push(readGrid(f, r));
      return out;
    }
    case 'array': {
      const n = readUint(r, widthFor(f.maxLength));
      if (n > f.maxLength) bad();
      const out: unknown[] = [];
      for (let i = 0; i < n; i++) out.push(decodeField(f.of, r));
      return out;
    }
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const key of sortedKeys(f.fields)) {
        const sub = f.fields[key];
        if (sub === undefined) bad();
        Object.defineProperty(out, key, {
          value: decodeField(sub, r),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return out;
    }
  }
  return bad();
}

// ------------------------------------------------------------ public API

/** FNV-1a fingerprint of the schema's id, version and full canonical description. Cached per schema object. */
export function fingerprint(schema: Schema): number {
  const known = FINGERPRINTS.get(schema);
  if (known !== undefined) return known;
  const fp = fnv1a(`${JSON.stringify(schema.id)}|${String(schema.version)}|${describeField(schema.root)}`);
  FINGERPRINTS.set(schema, fp);
  return fp;
}

/** Turns a preset into a text code. Throws Error(why) when the value does not fit the schema or the code would be too large. */
export function encode(schema: Schema, value: unknown): string {
  const w: number[] = [MAGIC_0, MAGIC_1, FORMAT_VERSION];
  putUint(w, fingerprint(schema), 4);
  encodeField(schema.root, value, w, '', { nodes: 0 });
  putUint(w, crc32(w, w.length), CRC_LEN);
  return b64Encode(w);
}

/** Reads a text code. Returns a value the schema accepts exactly, or null. Never throws. */
export function decode(schema: Schema, text: string): unknown | null {
  try {
    if (typeof text !== 'string' || text.length > MAX_TEXT || text.length % 4 === 1) return null;
    const b = b64Decode(text);
    if (b === null || b.length < MIN_LEN || b.length > LIMITS.maxBytes) return null;
    const end = b.length - CRC_LEN;
    if (crc32(b, end) !== readBE32(b, end)) return null;
    if (b[0] !== MAGIC_0 || b[1] !== MAGIC_1 || b[2] !== FORMAT_VERSION) return null;
    if (readBE32(b, 3) !== fingerprint(schema)) return null;
    const r: Reader = { b, pos: HEADER_LEN, end, nodes: 0 };
    const value = decodeField(schema.root, r);
    return r.pos === end ? value : null;
  } catch {
    return null;
  }
}
