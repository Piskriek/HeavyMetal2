/**
 * TICKET-05 ambient backdrop contract.
 *
 * Pure node:test checks that pin the asset manifest, the ember clamp range and
 * the parallax constant exported by `ambient-motion.ts`. The accompanying
 * browser test (`tests/ticket05-visual.mjs`) covers the live rendering.
 */
import test from 'node:test';
import { strict as assert } from 'node:assert';
import { statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AMBIENT_EMBER_DEFAULT,
  AMBIENT_EMBER_MAX,
  AMBIENT_EMBER_MIN,
  AMBIENT_PARALLAX_PX,
  MENU_BACKDROPS,
  clampEmberCount,
  emberCountFor,
  resolveBackdrop,
  type MenuBackdropPreset,
} from '../src/components/ui/ambient-motion';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

interface ImageSize { width: number; height: number; }

/** Parse the pixel dimensions from a RIFF/WEBP container. Supports the VP8
 *  lossy format (most generated webps), the VP8L lossless format, and the
 *  VP8X extended-alpha format. Returns null for any other flavour. */
function readWebpDimensions(buffer: Buffer): ImageSize | null {
  if (buffer.length < 30) return null;
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;
  const tag = buffer.toString('ascii', 12, 16);
  if (tag === 'VP8 ') {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (tag === 'VP8L') {
    const b0 = buffer.readUInt8(21);
    const b1 = buffer.readUInt8(22);
    const b2 = buffer.readUInt8(23);
    const b3 = buffer.readUInt8(24);
    const width = ((b1 & 0x3f) << 8 | b0) + 1;
    const height = (((b3 & 0x0f) << 10 | b2 << 2) | ((b1 & 0xc0) >> 6)) + 1;
    return { width, height };
  }
  if (tag === 'VP8X') {
    const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
    const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
    return { width, height };
  }
  return null;
}

/** Parse the pixel dimensions from a JPEG by walking to the first SOFn
 *  marker (SOF0..SOF15, excluding the DHT variants). Most JPEGs use SOF0 (0xC0)
 *  or SOF2 (0xC2); the segment body is `[precision:1][height:2][width:2]`. */
function readJpegDimensions(buffer: Buffer): ImageSize | null {
  if (buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) return null;
    // Skip filler 0xff bytes.
    while (offset < buffer.length && buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset];
    offset++;
    // SOS (0xDA) and EOI (0xD9) terminate the search.
    if (marker === 0xda || marker === 0xd9) return null;
    const length = buffer.readUInt16BE(offset);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }
    offset += length;
  }
  return null;
}

/** Parse dimensions from a PNG via the IHDR chunk (always 16 bytes after
 *  the 8-byte signature). */
function readPngDimensions(buffer: Buffer): ImageSize | null {
  if (buffer.length < 24) return null;
  const sig = buffer.toString('ascii', 0, 8);
  if (sig !== '\x89PNG\r\n\x1a\n') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readImageDimensions(file: string): ImageSize | null {
  const buffer = readFileSync(file);
  return readWebpDimensions(buffer) ?? readJpegDimensions(buffer) ?? readPngDimensions(buffer);
}

test('ticket05: every menu backdrop URL exists on disk', () => {
  for (const preset of Object.keys(MENU_BACKDROPS) as MenuBackdropPreset[]) {
    const file = join(root, 'public', MENU_BACKDROPS[preset].url.replace(/^\//, ''));
    assert.ok(statSync(file).isFile(), `${preset} backdrop missing at ${file}`);
  }
});

test('ticket05: every menu backdrop decodes at 1920x1080', () => {
  for (const preset of Object.keys(MENU_BACKDROPS) as MenuBackdropPreset[]) {
    const file = join(root, 'public', MENU_BACKDROPS[preset].url.replace(/^\//, ''));
    const dims = readImageDimensions(file);
    assert.ok(dims, `${preset} backdrop is not a recognised WEBP/JPG/PNG (${file})`);
    assert.equal(dims.width, 1920, `${preset} backdrop is ${dims.width}px wide, expected 1920`);
    assert.equal(dims.height, 1080, `${preset} backdrop is ${dims.height}px tall, expected 1080`);
  }
});

test('ticket05: ember clamp keeps the count inside the 14..26 safe range', () => {
  assert.equal(clampEmberCount(0), AMBIENT_EMBER_MIN);
  assert.equal(clampEmberCount(9999), AMBIENT_EMBER_MAX);
  assert.equal(clampEmberCount(-50), AMBIENT_EMBER_MIN);
  assert.equal(clampEmberCount(NaN), AMBIENT_EMBER_DEFAULT);
  assert.equal(clampEmberCount(Infinity), AMBIENT_EMBER_MAX);
  assert.equal(clampEmberCount(20), 20);
});

test('ticket05: every preset exposes an ember count inside the safe range', () => {
  for (const preset of Object.keys(MENU_BACKDROPS) as MenuBackdropPreset[]) {
    const count = emberCountFor(preset);
    assert.ok(count >= AMBIENT_EMBER_MIN && count <= AMBIENT_EMBER_MAX, `${preset} ember count ${count} is out of range`);
  }
});

test('ticket05: parallax constant and preset parallax values are within ±16 px', () => {
  assert.equal(AMBIENT_PARALLAX_PX, 8);
  for (const preset of Object.keys(MENU_BACKDROPS) as MenuBackdropPreset[]) {
    const p = MENU_BACKDROPS[preset].parallax;
    assert.ok(p >= 0 && p <= 16, `${preset} parallax ${p} is outside the ±16 px envelope`);
  }
});

test('ticket05: resolveBackdrop falls back to main for unknown presets', () => {
  assert.equal(resolveBackdrop('arena').preset, 'arena');
  assert.equal(resolveBackdrop(null).preset, 'main');
  assert.equal(resolveBackdrop(undefined).preset, 'main');
  assert.equal(resolveBackdrop('nonsense').preset, 'main');
});

test('ticket05: every preset declares an overlay tint identifier', () => {
  const valid = new Set(['menu', 'dialog', 'round-result']);
  for (const preset of Object.keys(MENU_BACKDROPS) as MenuBackdropPreset[]) {
    assert.ok(valid.has(MENU_BACKDROPS[preset].overlay), `${preset} has unknown overlay ${MENU_BACKDROPS[preset].overlay}`);
  }
});

test('ticket05: preset embers count matches the ticket specification (15..25)', () => {
  for (const preset of Object.keys(MENU_BACKDROPS) as MenuBackdropPreset[]) {
    const count = MENU_BACKDROPS[preset].embers;
    assert.ok(count >= 15 && count <= 25, `${preset} ember count ${count} is outside the ticket's 15..25 spec`);
  }
});
