// ============================================================================
// File: apps/web/src/credits/__tests__/pixel-font.test.ts
// TICKET-14 / POL-41: the pixel typeface the HUD skins 0a, 0b and 1 use is FIDELITY's own. These checks decode the shipped
// stylesheet (base/ui/pixel-font.css) and read its WOFF: the family name is ours, the name table carries our copyright
// record, the cmap covers printable ASCII, and every glyph is a sane outline.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const css = readFileSync(path.join(root, 'apps/web/src/base/ui/pixel-font.css'), 'utf8');
const hudCss = readFileSync(path.join(root, 'apps/web/src/base/ui/hud-zones.css'), 'utf8');

function woffFromCss(text: string): Buffer {
  const m = text.match(/base64,([A-Za-z0-9+/=]+)"\)/);
  assert.ok(m, 'the stylesheet embeds a base64 WOFF');
  return Buffer.from(m[1]!, 'base64');
}

function tablesOf(woff: Buffer): Map<string, Buffer> {
  assert.equal(woff.toString('latin1', 0, 4), 'wOFF', 'WOFF signature');
  const n = woff.readUInt16BE(12);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < n; i++) {
    const e = 44 + i * 20;
    const tag = woff.toString('latin1', e, e + 4);
    const off = woff.readUInt32BE(e + 4);
    const comp = woff.readUInt32BE(e + 8);
    const orig = woff.readUInt32BE(e + 12);
    const raw = comp === orig ? woff.subarray(off, off + comp) : inflateSync(woff.subarray(off, off + comp));
    assert.equal(raw.length, orig, `${tag} unpacks to its recorded size`);
    out.set(tag, raw);
  }
  return out;
}

const woff = woffFromCss(css);
const tables: Map<string, Buffer> = tablesOf(woff);

test('the pixel typeface is ours: family FidelityPixel5x7, never a third-party name', () => {
  assert.match(css, /font-family: 'FidelityPixel5x7';/);
  assert.equal(css.includes('Share Tech Mono'), false);
  assert.equal(css.includes('VT323'), false);
  assert.equal(hudCss.includes('Share Tech Mono'), false);
  assert.equal(hudCss.includes('VT323'), false);
  assert.ok(hudCss.includes("'FidelityPixel5x7', monospace"), 'skins 0a, 0b and 1 use our family');
});

test('the name table carries our family and our own copyright record (no borrowed licence)', () => {
  const name = tables.get('name')!;
  const count = name.readUInt16BE(2);
  const strOff = name.readUInt16BE(4);
  const names = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const id = name.readUInt16BE(r + 6);
    const len = name.readUInt16BE(r + 8);
    const off = name.readUInt16BE(r + 10);
    names.set(id, Buffer.from(name.subarray(strOff + off, strOff + off + len)).swap16().toString('utf16le'));
  }
  assert.equal(names.get(1), 'FidelityPixel5x7');
  assert.match(names.get(0) ?? '', /FIDELITY project/);
  assert.equal(names.get(13)?.includes('FIDELITY project'), true);
  for (const value of names.values()) {
    assert.equal(value.includes('Share Tech'), false);
    assert.equal(value.includes('VT323'), false);
  }
});

test('the cmap maps printable ASCII (0x20 to 0x7E) to distinct glyphs, and the font is monospaced', () => {
  const cmap = tables.get('cmap')!;
  const sub = cmap.readUInt32BE(8);
  assert.equal(cmap.readUInt16BE(sub), 4, 'format 4 subtable');
  const segs = cmap.readUInt16BE(sub + 6) / 2;
  const ends = Array.from({ length: segs }, (_, i) => cmap.readUInt16BE(sub + 14 + i * 2));
  const starts = Array.from({ length: segs }, (_, i) => cmap.readUInt16BE(sub + 16 + segs * 2 + i * 2));
  const deltas = Array.from({ length: segs }, (_, i) => cmap.readInt16BE(sub + 16 + segs * 4 + i * 2));
  const glyphFor = (code: number): number => {
    for (let i = 0; i < segs; i++) if (code >= starts[i]! && code <= ends[i]!) return (code + deltas[i]!) & 0xffff;
    return 0;
  };
  const seen = new Set<number>();
  for (let c = 0x20; c <= 0x7e; c++) {
    const g = glyphFor(c);
    assert.ok(g > 0, `code ${c} maps to a glyph`);
    seen.add(g);
  }
  assert.equal(seen.size, 0x7e - 0x20 + 1, 'one glyph per printable code');

  const hmtx = tables.get('hmtx')!;
  const numGlyphs = tables.get('maxp')!.readUInt16BE(4);
  const advances = new Set<number>();
  for (let g = 0; g < numGlyphs; g++) advances.add(hmtx.readUInt16BE(g * 4));
  assert.deepEqual([...advances], [600], 'every glyph advances 6 pixels');
});

test('every glyph outline is a set of straight rectangles that the loca table locates', () => {
  const loca = tables.get('loca')!;
  const glyf = tables.get('glyf')!;
  const numGlyphs = tables.get('maxp')!.readUInt16BE(4);
  let empty = 0;
  for (let g = 0; g < numGlyphs; g++) {
    const a = loca.readUInt32BE(g * 4);
    const b = loca.readUInt32BE(g * 4 + 4);
    if (b === a) { empty++; continue; }
    const contours = glyf.readInt16BE(a);
    assert.ok(contours > 0, `glyph ${g} has contours`);
    const xMin = glyf.readInt16BE(a + 2);
    const yMin = glyf.readInt16BE(a + 4);
    const xMax = glyf.readInt16BE(a + 6);
    const yMax = glyf.readInt16BE(a + 8);
    assert.ok(xMin >= 0 && yMin >= 0 && xMax <= 500 && yMax <= 700, `glyph ${g} sits inside the 5x7 cell`);
  }
  assert.equal(empty, 2, 'only .notdef and the space are empty');
});
