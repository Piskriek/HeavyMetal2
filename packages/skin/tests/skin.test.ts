// ============================================================================
// File: packages/skin/tests/skin.test.ts
// Plan 43 step 4 (@hm/skin): palettes measured in OKLab — the stage ladder (1 bit, EGA, VGA, full colour), nearest-colour
// quantisation with ordered dithering, and a skin shift that moves lightness, chroma and hue the way the eye reads them.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asciiPreview,
  BAYER_2,
  BAYER_4,
  deltaOk,
  ditherBias,
  fromOklch,
  hexToOklab,
  indexedToRgba,
  nearestPaletteIndex,
  oklabToHex,
  paletteForStage,
  paletteLab,
  PALETTES,
  parseHex,
  quantiseRgba,
  shiftPalette,
  toHex,
  toOklch,
} from '../src/index';

const HEXES = ['#000000', '#ffffff', '#ff0000', '#00aa00', '#3f3f74', '#d9a066', '#7cff4d', '#14181f'];

test('sRGB to OKLab and back is lossless per channel, and lightness follows the eye', () => {
  for (const hex of HEXES) {
    const back = oklabToHex(hexToOklab(hex));
    const [r1, g1, b1] = parseHex(hex), [r2, g2, b2] = parseHex(back);
    for (const [a, b] of [[r1, r2], [g1, g2], [b1, b2]] as const) {
      assert.ok(Math.abs(a - b) <= 1 / 255 + 1e-9, `${hex} round trip: ${hex} -> ${back}`);
    }
  }
  const white = hexToOklab('#ffffff'), black = hexToOklab('#000000'), grey = hexToOklab('#808080');
  assert.ok(Math.abs(white.l - 1) < 1e-3 && Math.abs(black.l) < 1e-6);
  assert.ok(grey.l > 0.5 && grey.l < 0.65, `mid grey sits near the middle (${grey.l})`);
  // chroma reads as colour: pure red is far out on a, pure blue out on b
  assert.ok(hexToOklab('#ff0000').a > 0.2 && hexToOklab('#0000ff').b < -0.2);
  // a grey has no chroma at all, which is what lets a skin leave the ink alone
  assert.ok(toOklch(hexToOklab('#808080')).c < 1e-3);
  assert.equal(toHex([2, -1, 0.5]), '#ff0080', 'out of gamut channels clamp');
  assert.deepEqual(parseHex('not a colour'), [0, 0, 0]);
  assert.equal(toHex(parseHex('#abc')), '#aabbcc', 'short hex expands');
});

test('deltaOk measures what the eye sees: a red pair is closer than a red and a blue', () => {
  assert.equal(deltaOk(hexToOklab('#3f3f74'), hexToOklab('#3f3f74')), 0);
  assert.ok(deltaOk(hexToOklab('#000000'), hexToOklab('#ffffff')) > 0.9);
  const reds = deltaOk(hexToOklab('#aa0000'), hexToOklab('#cc2222'));
  const rb = deltaOk(hexToOklab('#aa0000'), hexToOklab('#0000aa'));
  assert.ok(reds < rb, `${reds} should be less than ${rb}`);
  // a shift in OKLCH round-trips: a hue rotation keeps the chroma
  const spun = fromOklch(0.6, 0.12, toOklch(hexToOklab('#aa3333')).h + Math.PI);
  assert.ok(Math.abs(toOklch(spun).c - 0.12) < 1e-6);
});

test('the stage ladder: 1 bit, EGA, VGA, then the honest colour', () => {
  assert.equal(paletteForStage(0).id, 'mono');
  assert.equal(paletteForStage(0).colours.length, 2, 'S0 has two inks');
  assert.equal(paletteForStage(1).id, 'ega');
  assert.equal(paletteForStage(1).colours.length, 16);
  assert.equal(paletteForStage(2).id, 'vga');
  assert.equal(paletteForStage(2).colours.length, 32);
  for (const stage of [3, 4, 5, 6]) assert.equal(paletteForStage(stage).id, 'true');
  // a bad stage is clamped rather than throwing
  assert.equal(paletteForStage(-4).id, 'mono');
  assert.equal(paletteForStage(99).id, 'true');
  assert.equal(paletteForStage(Number.NaN).id, 'mono');
  // every palette's colours are real, and the ladder's minStage is monotone
  for (const p of Object.values(PALETTES)) {
    assert.equal(new Set(p.colours).size, p.colours.length, `${p.id} has no duplicate inks`);
    for (const c of p.colours) assert.match(c, /^#[0-9a-f]{6}$/);
    assert.equal(paletteLab(p).length, p.colours.length);
  }
  const ladder = ['mono', 'ega', 'vga', 'true'].map((k) => PALETTES[k as keyof typeof PALETTES].minStage);
  assert.deepEqual(ladder, [0, 1, 2, 3]);
});

test('the nearest palette ink is the nearest to the eye, and stays stable', () => {
  const ega = PALETTES.ega;
  ega.colours.forEach((hex, i) => assert.equal(nearestPaletteIndex(hex, ega), i, `${hex} is its own nearest`));
  assert.equal(nearestPaletteIndex('#000000', PALETTES.mono), 0);
  assert.equal(nearestPaletteIndex('#ffffff', PALETTES.mono), 1);
  // a very dark grey goes to black, a very light one to white, and a bias can push the same colour either way
  assert.equal(nearestPaletteIndex('#202020', PALETTES.mono), 0);
  assert.equal(nearestPaletteIndex('#e0e0e0', PALETTES.mono), 1);
  assert.equal(nearestPaletteIndex('#808080', PALETTES.mono, -1), 0);
  assert.equal(nearestPaletteIndex('#808080', PALETTES.mono, 1), 1);
  // deterministic and total: a colour that is not readable still answers
  assert.equal(nearestPaletteIndex('#808080', PALETTES.mono), nearestPaletteIndex('#808080', PALETTES.mono));
  assert.equal(nearestPaletteIndex('nonsense', PALETTES.mono), 0);
});

test('the dither is a fixed threshold grid, and it turns banding into texture', () => {
  assert.equal(ditherBias(0, 0, 'none'), 0);
  assert.equal(BAYER_2.length, 4);
  assert.equal(BAYER_4.length, 16);
  const biases = new Set<number>();
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) biases.add(ditherBias(x, y, 'bayer4'));
  assert.equal(biases.size, 16, 'every cell of the 4×4 grid is its own threshold');
  assert.ok(Math.max(...biases) > 0 && Math.min(...biases) < 0);
  // a flat grey at the midpoint of the two inks: no dither is one ink, the dither is two
  const grey = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < 16 * 16; i += 1) {
    grey[i * 4] = 0x66;
    grey[i * 4 + 1] = 0x66;
    grey[i * 4 + 2] = 0x66;
    grey[i * 4 + 3] = 255;
  }
  const flat = quantiseRgba(grey, 16, 16, PALETTES.mono, 'none');
  const dithered = quantiseRgba(grey, 16, 16, PALETTES.mono, 'bayer4');
  assert.equal(new Set(flat.indices).size, 1);
  assert.equal(new Set(dithered.indices).size, 2, 'the dither mixes both inks');
  assert.deepEqual(quantiseRgba(grey, 16, 16, PALETTES.mono, 'bayer4'), dithered, 'and does it the same way every time');
});

test('transparency stays empty, and an indexed picture turns back into pixels', () => {
  const rgba = new Uint8ClampedArray(4 * 4 * 4);
  // three opaque amber pixels on the top row, everything else transparent
  for (let i = 0; i < 3; i += 1) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 193;
    rgba[i * 4 + 2] = 61;
    rgba[i * 4 + 3] = 255;
  }
  const image = quantiseRgba(rgba, 4, 4, PALETTES.ega, 'bayer2');
  assert.equal(image.indices[3], 0, 'a transparent pixel is index 0');
  for (let i = 0; i < image.indices.length; i += 1) assert.ok((image.indices[i] as number) < PALETTES.ega.colours.length);
  const back = indexedToRgba(image);
  assert.equal(back.length, 4 * 4 * 4);
  assert.equal(back[3], 255);
  // the amber lands near the EGA orange or yellow, and the pixels agree with the palette entry
  const ink = PALETTES.ega.colours[image.indices[0] as number];
  assert.deepEqual([back[0], back[1], back[2]], parseHex(ink as string).map((v) => Math.round(v * 255)));
  // the ascii preview is one line per row and only the ink ladder
  const lines = asciiPreview(image).split('\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[0]?.length, 4);
});

test('a skin shifts lightness, chroma and hue in OKLab, leaves the ink alone, and names itself', () => {
  const vga = PALETTES.vga;
  const warm = shiftPalette(vga, { lightness: 0.05, hue: 0.4, chroma: 1.1 });
  assert.equal(warm.colours.length, vga.colours.length);
  assert.equal(warm.minStage, vga.minStage);
  assert.notEqual(warm.id, vga.id);
  assert.match(warm.name, /skin/);
  // the black and the white are still black and white: a skin must not tint the paper or the ink
  assert.equal(warm.colours[0], '#000000');
  assert.equal(warm.colours[21], '#ffffff');
  // a colourful entry really moved, and the original palette is untouched
  assert.notEqual(warm.colours[27], vga.colours[27]);
  assert.equal(vga.colours[27], '#ac3232');
  assert.throws(() => {
    (vga.colours as string[])[0] = '#123456';
  }, 'a palette is frozen');
  // a hue rotation of a full turn is very nearly the identity
  const round = shiftPalette(vga, { hue: Math.PI * 2 });
  for (let i = 0; i < vga.colours.length; i += 1) {
    assert.ok(deltaOk(hexToOklab(round.colours[i] as string), hexToOklab(vga.colours[i] as string)) < 0.02, `entry ${i}`);
  }
  // a nonsense shift is the identity rather than NaN
  const same = shiftPalette(vga, { lightness: Number.NaN, chroma: Number.NaN, hue: Number.NaN });
  for (let i = 0; i < vga.colours.length; i += 1) assert.match(same.colours[i] as string, /^#[0-9a-f]{6}$/);
});
