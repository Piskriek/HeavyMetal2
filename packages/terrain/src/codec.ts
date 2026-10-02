import { createTerrain, type Terrain, type TerrainSpec } from './grid';

/**
 * Compact text encoding of a terrain for storing it in a preset param: base64 of run-length encoded byte planes.
 * Heights are quantised to 0.01 m (Int16), stored planar (all low bytes, then all high bytes) so flat ground makes long runs.
 * No Node Buffer and no btoa: it runs in the browser, in workers and in Node alike.
 */

export interface EncodedTerrain { v: 1; spec: TerrainSpec; h: string; a: string; b: string; w: string }

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => { const m = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) m[B64.charCodeAt(i)] = i; return m; })();

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = i + 1 < bytes.length ? bytes[i + 1]! : 0, c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? B64[n & 63]! : '=');
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  if (clean.length % 4 === 1) throw new Error('terrain: malformed base64');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const v = code < 128 ? B64_INDEX[code]! : -1;
    if (v < 0) throw new Error('terrain: malformed base64');
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; }
  }
  return out;
}

export function rleEncode(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length;) {
    const v = bytes[i]!;
    let n = 1;
    while (i + n < bytes.length && bytes[i + n] === v && n < 255) n++;
    out.push(n, v);
    i += n;
  }
  return Uint8Array.from(out);
}

export function rleDecode(data: Uint8Array, length: number): Uint8Array {
  if (data.length % 2 !== 0) throw new Error('terrain: malformed run-length data');
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i < data.length; i += 2) {
    const n = data[i]!, v = data[i + 1]!;
    if (n === 0 || o + n > length) throw new Error('terrain: run-length data does not match the grid size');
    out.fill(v, o, o + n);
    o += n;
  }
  if (o !== length) throw new Error('terrain: run-length data does not match the grid size');
  return out;
}

export function encodeTerrain(t: Terrain): EncodedTerrain {
  const n = t.heights.length;
  const planes = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    const q = Math.max(-32767, Math.min(32767, Math.round(t.heights[i]! * 100)));
    planes[i] = q & 255;
    planes[n + i] = (q >> 8) & 255;
  }
  return { v: 1, spec: { ...t.spec }, h: toBase64(rleEncode(planes)), a: toBase64(rleEncode(t.surfaceA)), b: toBase64(rleEncode(t.surfaceB)), w: toBase64(rleEncode(t.blend)) };
}

export function decodeTerrain(e: EncodedTerrain): Terrain {
  const spec = e?.spec;
  if (!e || e.v !== 1 || !spec || typeof e.h !== 'string' || typeof e.a !== 'string' || typeof e.b !== 'string' || typeof e.w !== 'string') {
    throw new Error('terrain: not an encoded terrain (expected { v: 1, spec, h, a, b, w })');
  }
  const t = createTerrain(spec);
  const n = t.heights.length;
  const planes = rleDecode(fromBase64(e.h), n * 2);
  for (let i = 0; i < n; i++) {
    const q = (planes[i]! | (planes[n + i]! << 8)) << 16 >> 16;
    t.heights[i] = q / 100;
  }
  t.surfaceA.set(rleDecode(fromBase64(e.a), n));
  t.surfaceB.set(rleDecode(fromBase64(e.b), n));
  t.blend.set(rleDecode(fromBase64(e.w), n));
  return t;
}
