/**
 * Builds FIDELITY's own 5x7 ASCII pixel font (POL-41) and writes it into apps/web/src/base/ui/pixel-font.css as a
 * base64 WOFF @font-face. Every glyph here is drawn by hand for this game (no third-party outlines), so the font carries its own
 * copyright and licence records, under its own family name, 'FidelityPixel5x7'.
 *
 *   node scripts/build-pixel-font.mjs          writes apps/web/src/base/ui/pixel-font.css
 *   node scripts/build-pixel-font.mjs --check  exits 1 if that file is out of date
 *
 * Glyph grid: 5 columns by 7 rows ('#' is ink, '.' is paper), covering ASCII 0x20 to 0x7E. The font is monospaced: each
 * glyph advances 6 pixels (5 of ink and 1 of space). Output is deterministic: a fixed table timestamp and fixed zlib
 * settings, so a rebuild with the same glyphs gives the same bytes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FONT_FAMILY = 'FidelityPixel5x7';
const PIXEL = 100; // font units per glyph pixel
// 1000 units to the em, so a glyph advances 0.6 em (the width the HUD's name columns were laid out for, as a monospace)
const UNITS_PER_EM = 1000;
const ADVANCE = 600; // 5 pixels of ink and one of space
const ASCENDER = 800;
const DESCENDER = -200;

/**
 * The glyphs, rows top to bottom. Index 0 is ' ' (0x20). Each glyph is 7 strings of 5 characters.
 * Keep every row exactly 5 characters wide; the build throws if not.
 */
const GLYPHS = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '##..#'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '*': ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '..##.', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '/': ['.....', '....#', '...#.', '..#..', '.#...', '#....', '.....'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  '\\': ['.....', '#....', '.#...', '..#..', '...#.', '....#', '.....'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '`': ['.#...', '..#..', '.....', '.....', '.....', '.....', '.....'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '#..#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '{': ['...##', '..#..', '..#..', '.#...', '..#..', '..#..', '...##'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '}': ['##...', '..#..', '..#..', '...#.', '..#..', '..#..', '##...'],
  '~': ['.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....'],
};

/** The code points in order: 0x20 to 0x7E, one glyph each. */
export function glyphCodes() {
  const codes = [];
  for (let c = 0x20; c <= 0x7e; c++) codes.push(c);
  return codes;
}

function glyphRows(code) {
  const ch = String.fromCharCode(code);
  const rows = GLYPHS[ch];
  if (!rows) throw new Error(`no glyph for ${JSON.stringify(ch)} (U+${code.toString(16)})`);
  if (rows.length !== 7) throw new Error(`glyph ${JSON.stringify(ch)} has ${rows.length} rows, want 7`);
  for (const r of rows) if (r.length !== 5) throw new Error(`glyph ${JSON.stringify(ch)} row ${JSON.stringify(r)} is not 5 wide`);
  return rows;
}

/**
 * The glyph's outline as rectangles (x0, y0, x1, y1) in font units. Each lit run in a row becomes one rectangle; a run that
 * repeats the previous row's run exactly is extended downwards instead, so the rectangles never overlap and never share
 * an edge that a rasteriser could seam.
 */
export function glyphRects(code) {
  const rows = glyphRows(code);
  const rects = [];
  let open = new Map(); // key "x0:x1" -> rect index, for runs that continue from the row above
  for (let r = 0; r < 7; r++) {
    const runs = [];
    const line = rows[r];
    for (let c = 0; c < 5; ) {
      if (line[c] !== '#') { c++; continue; }
      const start = c;
      while (c < 5 && line[c] === '#') c++;
      runs.push([start, c]);
    }
    const next = new Map();
    for (const [x0, x1] of runs) {
      const key = `${x0}:${x1}`;
      const yTop = (7 - r) * PIXEL; // row 0 is the top of the cap height
      const yBottom = yTop - PIXEL;
      if (open.has(key)) {
        const i = open.get(key);
        rects[i] = { x0: rects[i].x0, y0: yBottom, x1: rects[i].x1, y1: rects[i].y1 };
        next.set(key, i);
      } else {
        rects.push({ x0: x0 * PIXEL, y0: yBottom, x1: x1 * PIXEL, y1: yTop });
        next.set(key, rects.length - 1);
      }
    }
    open = next;
  }
  return rects;
}

/** The TrueType glyph record (simple glyph, straight contours, clockwise). Empty glyphs have no record at all. */
function glyfRecord(rects) {
  if (rects.length === 0) return Buffer.alloc(0);
  const pts = [];
  const ends = [];
  for (const r of rects) {
    // clockwise: up the left edge, across the top, down the right edge, back along the bottom
    pts.push([r.x0, r.y0], [r.x0, r.y1], [r.x1, r.y1], [r.x1, r.y0]);
    ends.push(pts.length - 1);
  }
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const [x, y] of pts) { xMin = Math.min(xMin, x); yMin = Math.min(yMin, y); xMax = Math.max(xMax, x); yMax = Math.max(yMax, y); }
  const head = Buffer.alloc(10 + ends.length * 2 + 2);
  head.writeInt16BE(ends.length, 0);
  head.writeInt16BE(xMin, 2); head.writeInt16BE(yMin, 4); head.writeInt16BE(xMax, 6); head.writeInt16BE(yMax, 8);
  ends.forEach((e, i) => head.writeUInt16BE(e, 10 + i * 2));
  head.writeUInt16BE(0, 10 + ends.length * 2); // no instructions
  const flags = Buffer.alloc(pts.length, 0x01); // on-curve, 16-bit deltas
  const xs = Buffer.alloc(pts.length * 2);
  const ys = Buffer.alloc(pts.length * 2);
  let px = 0, py = 0;
  pts.forEach(([x, y], i) => {
    xs.writeInt16BE(x - px, i * 2); px = x;
    ys.writeInt16BE(y - py, i * 2); py = y;
  });
  const body = Buffer.concat([head, flags, xs, ys]);
  // glyph records are padded to 4 bytes so the long loca offsets stay aligned
  const pad = (4 - (body.length % 4)) % 4;
  return Buffer.concat([body, Buffer.alloc(pad)]);
}

function pad4(buf) {
  const p = (4 - (buf.length % 4)) % 4;
  return p ? Buffer.concat([buf, Buffer.alloc(p)]) : buf;
}

function checksum(buf) {
  const b = pad4(buf);
  let sum = 0;
  for (let i = 0; i < b.length; i += 4) sum = (sum + b.readUInt32BE(i)) >>> 0;
  return sum;
}

function nameTable() {
  const records = [
    [0, 'Copyright (c) 2026 the FIDELITY project. Original glyphs drawn for this game; no third-party font data.'],
    [1, FONT_FAMILY],
    [2, 'Regular'],
    [3, `${FONT_FAMILY};Regular;2026`],
    [4, `${FONT_FAMILY} Regular`],
    [5, 'Version 1.000'],
    [6, `${FONT_FAMILY}-Regular`],
    [13, 'Original work of the FIDELITY project, embedded only in the FIDELITY game build.'],
  ];
  const strings = records.map(([, s]) => Buffer.from(s, 'utf16le').swap16());
  const count = records.length;
  const headerLen = 6 + count * 12;
  const out = Buffer.alloc(headerLen);
  out.writeUInt16BE(0, 0);
  out.writeUInt16BE(count, 2);
  out.writeUInt16BE(headerLen, 4);
  let off = 0;
  records.forEach(([id], i) => {
    const r = 6 + i * 12;
    out.writeUInt16BE(3, r); // Windows
    out.writeUInt16BE(1, r + 2); // Unicode BMP
    out.writeUInt16BE(0x409, r + 4); // en-US
    out.writeUInt16BE(id, r + 6);
    out.writeUInt16BE(strings[i].length, r + 8);
    out.writeUInt16BE(off, r + 10);
    off += strings[i].length;
  });
  return Buffer.concat([out, ...strings]);
}

function cmapTable(codes) {
  // one format 4 subtable mapping each code to glyph index (code - 0x20 + 1), a single contiguous segment, then the end marker
  const first = codes[0];
  const last = codes[codes.length - 1];
  const delta = (1 - first) & 0xffff;
  // format 4 header: format, length, language, segCountX2, searchRange, entrySelector, rangeShift
  const segs = 2;
  const len = 32; // format 4 header (14) + endCode (4) + reservedPad (2) + startCode (4) + idDelta (4) + idRangeOffset (4)
  const buf = Buffer.alloc(len);
  buf.writeUInt16BE(4, 0);
  buf.writeUInt16BE(len, 2);
  buf.writeUInt16BE(0, 4);
  buf.writeUInt16BE(segs * 2, 6);
  buf.writeUInt16BE(4, 8); // searchRange
  buf.writeUInt16BE(1, 10); // entrySelector (log2 of the segment count)
  buf.writeUInt16BE(0, 12); // rangeShift
  // endCode[]
  buf.writeUInt16BE(last, 14);
  buf.writeUInt16BE(0xffff, 16);
  buf.writeUInt16BE(0, 18); // reservedPad
  // startCode[]
  buf.writeUInt16BE(first, 20);
  buf.writeUInt16BE(0xffff, 22);
  // idDelta[]
  buf.writeUInt16BE(delta, 24);
  buf.writeUInt16BE(1, 26);
  // idRangeOffset[]
  buf.writeUInt16BE(0, 28);
  buf.writeUInt16BE(0, 30);
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0, 0); // version
  header.writeUInt16BE(1, 2); // numTables
  header.writeUInt16BE(3, 4); // platform Windows
  header.writeUInt16BE(1, 6); // encoding Unicode BMP
  header.writeUInt32BE(12, 8); // offset of the subtable
  return Buffer.concat([header, buf]);
}

/** Builds the whole SFNT (TrueType) font as one buffer. */
export function buildTtf() {
  const codes = glyphCodes();
  const glyphs = [Buffer.alloc(0)]; // glyph 0: .notdef, empty
  for (const code of codes) glyphs.push(glyfRecord(glyphRects(code)));
  const numGlyphs = glyphs.length;

  // glyf and loca (long offsets)
  const offsets = [0];
  for (const g of glyphs) offsets.push(offsets[offsets.length - 1] + g.length);
  const glyf = Buffer.concat(glyphs);
  const loca = Buffer.alloc((numGlyphs + 1) * 4);
  offsets.forEach((o, i) => loca.writeUInt32BE(o, i * 4));

  const hmtx = Buffer.alloc(numGlyphs * 4);
  for (let i = 0; i < numGlyphs; i++) { hmtx.writeUInt16BE(ADVANCE, i * 4); hmtx.writeInt16BE(0, i * 4 + 2); }

  const head = Buffer.alloc(54);
  head.writeUInt32BE(0x00010000, 0);
  head.writeUInt32BE(0x00010000, 4); // fontRevision 1.0
  head.writeUInt32BE(0, 8); // checkSumAdjustment, set below
  head.writeUInt32BE(0x5f0f3cf5, 12);
  head.writeUInt16BE(0x0003, 16); // baseline at y=0, left sidebearing at x=0
  head.writeUInt16BE(UNITS_PER_EM, 18);
  // fixed timestamp (seconds since 1904): keeps the output reproducible
  head.writeBigInt64BE(3_786_825_600n, 20);
  head.writeBigInt64BE(3_786_825_600n, 28);
  head.writeInt16BE(0, 36); head.writeInt16BE(0, 38); head.writeInt16BE(ADVANCE, 40); head.writeInt16BE(ASCENDER, 42); // xMin yMin xMax yMax
  head.writeInt16BE(0, 44); head.writeUInt16BE(0, 46); // macStyle, lowestRecPPEM
  head.writeInt16BE(2, 48); // fontDirectionHint
  head.writeInt16BE(1, 50); // indexToLocFormat: long
  head.writeInt16BE(0, 52);

  const hhea = Buffer.alloc(36);
  hhea.writeUInt32BE(0x00010000, 0);
  hhea.writeInt16BE(ASCENDER, 4);
  hhea.writeInt16BE(DESCENDER, 6);
  hhea.writeInt16BE(0, 8);
  hhea.writeUInt16BE(ADVANCE, 10);
  hhea.writeInt16BE(0, 12); hhea.writeInt16BE(0, 14);
  hhea.writeInt16BE(ADVANCE, 16);
  hhea.writeInt16BE(1, 18); hhea.writeInt16BE(0, 20);
  hhea.writeUInt16BE(numGlyphs, 34);

  const maxp = Buffer.alloc(32);
  maxp.writeUInt32BE(0x00010000, 0);
  maxp.writeUInt16BE(numGlyphs, 4);

  // The true per-glyph maxima of this build (points and contours), so the header is honest.
  let maxPoints = 0, maxContours = 0;
  for (const code of codes) {
    const n = glyphRects(code).length;
    maxContours = Math.max(maxContours, n);
    maxPoints = Math.max(maxPoints, n * 4);
  }
  maxp.writeUInt16BE(maxPoints, 6);
  maxp.writeUInt16BE(maxContours, 8);

  const os2 = Buffer.alloc(78);
  os2.writeUInt16BE(0, 0); // version 0
  os2.writeInt16BE(ADVANCE, 2);
  os2.writeUInt16BE(400, 4);
  os2.writeUInt16BE(5, 6);
  os2.writeUInt16BE(0, 8); // fsType: installable
  os2.writeUInt16BE(0x40, 62); // fsSelection: REGULAR
  os2.writeUInt16BE(0x20, 64); // usFirstCharIndex
  os2.writeUInt16BE(0x7e, 66); // usLastCharIndex
  os2.writeInt16BE(ASCENDER, 68); // sTypoAscender
  os2.writeInt16BE(DESCENDER, 70); // sTypoDescender
  os2.writeInt16BE(0, 72); // sTypoLineGap
  os2.writeUInt16BE(ASCENDER, 74); // usWinAscent
  os2.writeUInt16BE(-DESCENDER, 76); // usWinDescent

  const post = Buffer.alloc(32);
  post.writeUInt32BE(0x00030000, 0);
  post.writeInt16BE(-100, 8);
  post.writeInt16BE(50, 10);
  post.writeUInt32BE(1, 12); // fixed pitch

  const tables = [
    ['OS/2', os2],
    ['cmap', cmapTable(codes)],
    ['glyf', glyf],
    ['head', head],
    ['hhea', hhea],
    ['hmtx', hmtx],
    ['loca', loca],
    ['maxp', maxp],
    ['name', nameTable()],
    ['post', post],
  ];
  return assembleSfnt(tables);
}

function assembleSfnt(tables) {
  const numTables = tables.length;
  const dirLen = 12 + numTables * 16;
  let offset = dirLen;
  const dir = Buffer.alloc(dirLen);
  dir.writeUInt32BE(0x00010000, 0);
  dir.writeUInt16BE(numTables, 4);
  const sr = 16 * 2 ** Math.floor(Math.log2(numTables));
  dir.writeUInt16BE(sr, 6);
  dir.writeUInt16BE(Math.floor(Math.log2(numTables)), 8);
  dir.writeUInt16BE(numTables * 16 - sr, 10);
  const bodies = [];
  tables.forEach(([tag, data], i) => {
    const padded = pad4(data);
    const e = 12 + i * 16;
    dir.write(tag, e, 4, 'latin1');
    dir.writeUInt32BE(checksum(data), e + 4);
    dir.writeUInt32BE(offset, e + 8);
    dir.writeUInt32BE(data.length, e + 12);
    bodies.push(padded);
    offset += padded.length;
  });
  const font = Buffer.concat([dir, ...bodies]);
  const headIdx = tables.findIndex(([t]) => t === 'head');
  const headOff = readU32(dir, 12 + headIdx * 16 + 8);
  const adjust = (0xb1b0afba - checksum(font)) >>> 0;
  font.writeUInt32BE(adjust, headOff + 8);
  return font;
}

function readU32(buf, off) {
  return buf.readUInt32BE(off);
}

/** Wraps the SFNT in WOFF 1.0: each table deflated when that is smaller, stored otherwise. */
export function buildWoff(ttf) {
  const numTables = readU16(ttf, 4);
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const e = 12 + i * 16;
    const tag = ttf.toString('latin1', e, e + 4);
    const off = readU32(ttf, e + 8);
    const len = readU32(ttf, e + 12);
    const raw = ttf.subarray(off, off + len);
    const z = deflateSync(raw, { level: 9 });
    const useZ = z.length < raw.length;
    entries.push({ tag, origLength: len, origChecksum: readU32(ttf, e + 4), data: useZ ? z : raw });
  }
  entries.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const headerLen = 44 + entries.length * 20;
  let offset = headerLen;
  const dir = Buffer.alloc(entries.length * 20);
  const bodies = [];
  entries.forEach((t, i) => {
    const e = i * 20;
    dir.write(t.tag, e, 4, 'latin1');
    dir.writeUInt32BE(offset, e + 4);
    dir.writeUInt32BE(t.data.length, e + 8);
    dir.writeUInt32BE(t.origLength, e + 12);
    dir.writeUInt32BE(t.origChecksum, e + 16);
    const padded = pad4(t.data);
    bodies.push(padded);
    offset += padded.length;
  });
  const header = Buffer.alloc(44);
  header.write('wOFF', 0, 4, 'latin1');
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt32BE(offset, 8); // total length
  header.writeUInt16BE(entries.length, 12);
  header.writeUInt16BE(0, 14);
  header.writeUInt32BE(ttf.length, 16); // total uncompressed SFNT size
  header.writeUInt16BE(1, 20); // major
  header.writeUInt16BE(0, 22); // minor
  return Buffer.concat([header, dir, ...bodies]);
}

function readU16(buf, off) {
  return buf.readUInt16BE(off);
}

/** The generated stylesheet: one @font-face for the family, the base64 WOFF, and nothing else. */
export function renderStylesheet(woff) {
  return [
    '/* GENERATED by scripts/build-pixel-font.mjs (POL-41). Do not edit by hand. */',
    "/* FIDELITY's own 5x7 ASCII pixel font, drawn for this game: not derived from any third-party font. */",
    '@font-face {',
    `  font-family: '${FONT_FAMILY}';`,
    `  src: url("data:font/woff;base64,${woff.toString('base64')}") format("woff");`,
    '  font-weight: 400;',
    '  font-style: normal;',
    '  font-display: block;',
    '}',
    '',
  ].join('\n');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, '..', 'apps/web/src/base/ui/pixel-font.css');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const woff = buildWoff(buildTtf());
  const text = renderStylesheet(woff);
  if (process.argv.includes('--check')) {
    const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
    if (current !== text) {
      console.error(`pixel font out of date: run node scripts/build-pixel-font.mjs (${outFile})`);
      process.exit(1);
    }
    console.log(`pixel font up to date: ${woff.length} bytes WOFF`);
  } else {
    writeFileSync(outFile, text);
    console.log(`wrote ${outFile}: ${woff.length} bytes WOFF, ${text.length} bytes of CSS`);
  }
}
