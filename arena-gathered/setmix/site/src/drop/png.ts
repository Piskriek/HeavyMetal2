/* ============================================================================
 *  packages/export-ue5/src/png.ts
 *  ---------------------------------------------------------------------------
 *  DEBT #2, SETTLED: a complete PNG encoder in pure TypeScript.
 *
 *  No sharp. No pngjs. No native bindings. No node:zlib. Runs identically in
 *  Node, Bun, Deno, a browser and a worker, because it touches nothing but
 *  Uint8Array and arithmetic.
 *
 *  Why this matters more than it looks: @hm/export-ue5 bakes 16-bit
 *  displacement at 4096². A native binding would have made the one package
 *  that must run in CI, in the editor AND in the browser the only package
 *  with a platform-specific install step.
 *
 *  Contents:
 *    · CRC-32 (PNG chunk integrity)
 *    · Adler-32 (zlib stream check)
 *    · DEFLATE — fixed-Huffman, hash-chain LZ77, RFC 1951
 *    · PNG scanline filters with the libpng minimum-sum-of-absolutes heuristic
 *    · 8-bit GRAY / RGB / RGBA and 16-bit GRAY / RGB (big-endian, per spec)
 * ==========================================================================*/

/* ───────────────────────────────────────────────────────────── CRC-32 ── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array, start = 0, end = buf.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32 over the *uncompressed* data — the zlib trailer. */
export function adler32(buf: Uint8Array): number {
  let a = 1, b = 0;
  // 5552 is the largest n for which 255n(n+1)/2 + (n+1)(65520-1) stays in 32 bits
  for (let i = 0; i < buf.length; ) {
    const end = Math.min(i + 5552, buf.length);
    for (; i < end; i++) { a += buf[i]; b += a; }
    a %= 65521; b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/* ═══════════════════════════════════════════════ DEFLATE (RFC 1951) ══ */

/** LSB-first bit stream, as DEFLATE requires. Huffman codes are the one
 *  exception: they are packed MSB-first, which is the classic footgun. */
class BitWriter {
  private buf: Uint8Array;
  private len = 0;
  private cur = 0;
  private nbits = 0;

  constructor(capacity: number) {
    this.buf = new Uint8Array(Math.max(64, capacity));
  }
  private grow(n: number) {
    if (this.len + n <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.len + n + 64));
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  /** value's low `count` bits, LSB first */
  bits(value: number, count: number) {
    this.cur |= (value & ((1 << count) - 1)) << this.nbits;
    this.nbits += count;
    while (this.nbits >= 8) {
      this.grow(1);
      this.buf[this.len++] = this.cur & 0xff;
      this.cur >>>= 8;
      this.nbits -= 8;
    }
  }
  /** a Huffman code: the same bits, but emitted MSB first */
  huff(code: number, length: number) {
    for (let i = length - 1; i >= 0; i--) this.bits((code >>> i) & 1, 1);
  }
  finish(): Uint8Array {
    if (this.nbits > 0) { this.grow(1); this.buf[this.len++] = this.cur & 0xff; this.cur = 0; this.nbits = 0; }
    return this.buf.subarray(0, this.len);
  }
}

// RFC 1951 §3.2.5
const LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const LEN_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

/** Fixed-Huffman literal/length alphabet, RFC 1951 §3.2.6. */
function writeLiteral(w: BitWriter, sym: number) {
  if (sym <= 143) w.huff(0x30 + sym, 8);
  else if (sym <= 255) w.huff(0x190 + sym - 144, 9);
  else if (sym <= 279) w.huff(sym - 256, 7);
  else w.huff(0xc0 + sym - 280, 8);
}

const WINDOW = 32768;
const MIN_MATCH = 3;
const MAX_MATCH = 258;

/**
 *  Fixed-Huffman DEFLATE with a 3-byte-hash chain matcher.
 *
 *  Why fixed and not dynamic Huffman: dynamic saves a further 8–15% but costs
 *  a frequency pass, a code-length tree and ~250 lines of table construction.
 *  On the data we actually emit — tiled procedural heightmaps and masks —
 *  the PNG *filters* do the heavy lifting and fixed Huffman lands within a
 *  few percent of `zlib -6`. Correctness per line of code is the right trade
 *  for a package that must never fail to install.
 */
export function deflate(data: Uint8Array, level: 0 | 1 = 1): Uint8Array {
  const w = new BitWriter(data.length >> 1);
  w.bits(1, 1);   // BFINAL
  w.bits(1, 2);   // BTYPE = 01, fixed Huffman

  if (level === 0 || data.length < MIN_MATCH) {
    for (let i = 0; i < data.length; i++) writeLiteral(w, data[i]);
    writeLiteral(w, 256);
    return w.finish();
  }

  const HASH_BITS = 15;
  const HASH_SIZE = 1 << HASH_BITS;
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(data.length).fill(-1);
  const hash3 = (i: number) =>
    ((data[i] << 10) ^ (data[i + 1] << 5) ^ data[i + 2]) & (HASH_SIZE - 1);

  let i = 0;
  while (i < data.length) {
    let bestLen = 0, bestDist = 0;
    if (i + MIN_MATCH <= data.length) {
      const h = hash3(i);
      let cand = head[h];
      let chain = 128;                       // bounded search: predictable cost
      while (cand >= 0 && chain-- > 0) {
        const dist = i - cand;
        if (dist > WINDOW) break;
        if (data[cand + bestLen] === data[i + bestLen]) {
          let l = 0;
          const max = Math.min(MAX_MATCH, data.length - i);
          while (l < max && data[cand + l] === data[i + l]) l++;
          if (l > bestLen) { bestLen = l; bestDist = dist; if (l >= MAX_MATCH) break; }
        }
        cand = prev[cand];
      }
      prev[i] = head[h];
      head[h] = i;
    }

    if (bestLen >= MIN_MATCH) {
      let lc = 0;
      while (lc < 28 && LEN_BASE[lc + 1] <= bestLen) lc++;
      writeLiteral(w, 257 + lc);
      if (LEN_EXTRA[lc]) w.bits(bestLen - LEN_BASE[lc], LEN_EXTRA[lc]);
      let dc = 0;
      while (dc < 29 && DIST_BASE[dc + 1] <= bestDist) dc++;
      w.huff(dc, 5);
      if (DIST_EXTRA[dc]) w.bits(bestDist - DIST_BASE[dc], DIST_EXTRA[dc]);
      // insert the interior positions so later matches can find them
      for (let k = 1; k < bestLen; k++) {
        const j = i + k;
        if (j + MIN_MATCH <= data.length) {
          const h = hash3(j);
          prev[j] = head[h];
          head[h] = j;
        }
      }
      i += bestLen;
    } else {
      writeLiteral(w, data[i]);
      i++;
    }
  }
  writeLiteral(w, 256);
  return w.finish();
}

/** zlib container (RFC 1950): 2-byte header + DEFLATE + Adler-32. */
export function zlib(data: Uint8Array, level: 0 | 1 = 1): Uint8Array {
  const body = deflate(data, level);
  const out = new Uint8Array(2 + body.length + 4);
  out[0] = 0x78;                       // CM=8, CINFO=7 (32 kB window)
  out[1] = 0x01;                       // FCHECK so (0x78<<8|0x01) % 31 === 0
  out.set(body, 2);
  const a = adler32(data);
  const o = 2 + body.length;
  out[o] = (a >>> 24) & 255; out[o + 1] = (a >>> 16) & 255;
  out[o + 2] = (a >>> 8) & 255; out[o + 3] = a & 255;
  return out;
}

/* ═══════════════════════════════════════════════ PNG scanline filters ══ */

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 *  Per-scanline adaptive filtering with libpng's minimum-sum-of-absolute-
 *  differences heuristic. This is where almost all the compression on a
 *  heightmap actually comes from: a smooth gradient filters to near-zero
 *  residuals, which DEFLATE then runs-length-encodes to nothing.
 */
function filterScanlines(
  raw: Uint8Array, width: number, height: number, bpp: number,
): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array((stride + 1) * height);
  const lines: Uint8Array[] = [
    new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride),
    new Uint8Array(stride), new Uint8Array(stride),
  ];

  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const up = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const A = x >= bpp ? raw[row + x - bpp] : 0;
      const B = y > 0 ? raw[up + x] : 0;
      const C = x >= bpp && y > 0 ? raw[up + x - bpp] : 0;
      const V = raw[row + x];
      lines[0][x] = V;
      lines[1][x] = (V - A) & 255;
      lines[2][x] = (V - B) & 255;
      lines[3][x] = (V - ((A + B) >> 1)) & 255;
      lines[4][x] = (V - paeth(A, B, C)) & 255;
    }
    let best = 0, bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      let s = 0;
      const L = lines[f];
      // signed-magnitude sum: values near 0 or 255 are both "small residuals"
      for (let x = 0; x < stride; x++) s += L[x] < 128 ? L[x] : 256 - L[x];
      if (s < bestScore) { bestScore = s; best = f; }
    }
    const o = y * (stride + 1);
    out[o] = best;
    out.set(lines[best], o + 1);
  }
  return out;
}

/* ═══════════════════════════════════════════════════ PNG CONTAINER ══ */

const SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32(out, 4, 8 + body.length));
  return out;
}

export type PngColour = "GRAY" | "RGB" | "RGBA";
const COLOUR_TYPE: Record<PngColour, number> = { GRAY: 0, RGB: 2, RGBA: 6 };
const CHANNELS: Record<PngColour, number> = { GRAY: 1, RGB: 3, RGBA: 4 };

export interface PngOptions {
  width: number;
  height: number;
  colour: PngColour;
  bitDepth: 8 | 16;
  /** 0 = store only (instant, large) · 1 = LZ77 + fixed Huffman (default) */
  level?: 0 | 1;
  /** written as a tEXt chunk; UE shows it in asset metadata */
  text?: Record<string, string>;
}

/**
 *  Encode a PNG.
 *
 *  `data` is interpreted as width × height × channels samples. For bitDepth
 *  16 pass a Uint16Array — PNG stores 16-bit samples BIG-ENDIAN, which this
 *  function handles; getting that backwards is the classic "my heightmap is
 *  noise" bug.
 */
export function encodePng(data: Uint8Array | Uint16Array, opts: PngOptions): Uint8Array {
  const { width, height, colour, bitDepth } = opts;
  const ch = CHANNELS[colour];
  const sampleBytes = bitDepth === 16 ? 2 : 1;
  const bpp = ch * sampleBytes;
  const expected = width * height * ch;
  if (data.length < expected)
    throw new Error(`png: need ${expected} samples, received ${data.length}`);

  // pack to raw bytes, big-endian for 16-bit
  let raw: Uint8Array;
  if (bitDepth === 16) {
    raw = new Uint8Array(expected * 2);
    for (let i = 0; i < expected; i++) {
      const v = data[i] & 0xffff;
      raw[i * 2] = v >>> 8;
      raw[i * 2 + 1] = v & 0xff;
    }
  } else {
    raw = data instanceof Uint8Array && data.length === expected
      ? data
      : Uint8Array.from(data.subarray(0, expected) as ArrayLike<number>);
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = COLOUR_TYPE[colour];
  ihdr[10] = 0;   // deflate
  ihdr[11] = 0;   // adaptive filtering
  ihdr[12] = 0;   // no interlace

  const filtered = filterScanlines(raw, width, height, bpp);
  const idat = zlib(filtered, opts.level ?? 1);

  const parts: Uint8Array[] = [SIG, chunk("IHDR", ihdr)];
  for (const [k, v] of Object.entries(opts.text ?? {})) {
    const key = k.slice(0, 79);
    const body = new Uint8Array(key.length + 1 + v.length);
    for (let i = 0; i < key.length; i++) body[i] = key.charCodeAt(i) & 255;
    body[key.length] = 0;
    for (let i = 0; i < v.length; i++) body[key.length + 1 + i] = v.charCodeAt(i) & 255;
    parts.push(chunk("tEXt", body));
  }
  parts.push(chunk("IDAT", idat), chunk("IEND", new Uint8Array(0)));

  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/* ───────────────────────── the @hm/export-ue5 PngEncoder adapter ─────── */

/** Drop-in for `ExportOptions.encodePng`. Matches the signature exactly. */
export const pngEncoder = (
  width: number, height: number, data: Uint8Array | Uint16Array,
  channels: 1 | 3 | 4, bitDepth: 8 | 16,
): Uint8Array =>
  encodePng(data, {
    width, height, bitDepth,
    colour: channels === 1 ? "GRAY" : channels === 3 ? "RGB" : "RGBA",
    level: 1,
    text: { Software: "SetMix @hm/export-ue5", Source: "procedural TexGraph bake" },
  });

/** Reports what the encoder achieved — surfaced in the bake UI and in CI. */
export function pngStats(data: Uint8Array | Uint16Array, opts: PngOptions) {
  const ch = CHANNELS[opts.colour];
  const rawBytes = opts.width * opts.height * ch * (opts.bitDepth === 16 ? 2 : 1);
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const png = encodePng(data, opts);
  const ms = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
  return {
    bytes: png.length,
    rawBytes,
    ratio: rawBytes / Math.max(1, png.length),
    ms,
    mbPerSec: rawBytes / 1048576 / Math.max(0.001, ms / 1000),
    png,
  };
}
