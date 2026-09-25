/** MP-T15: the painted-avatar-part keyer (src/game/meta/chroma-key.ts), on synthetic parts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromaKey, detectKey, downsample, keyPart, spillOf, type Rgba } from '../src/game/meta/chroma-key';

/** A 256² magenta canvas with a painted brown disc (radius 70) and a soft pinkish rim. */
function part(): Rgba {
  const w = 256, h = 256, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; const d = Math.hypot(x - 128, y - 118);
    const t = Math.max(0, Math.min(1, (d - 68) / 4)); // 0 inside, 1 outside, antialiased edge
    const paint = [122, 78, 40];
    const bg = [248, 3, 240];
    for (let k = 0; k < 3; k++) data[i + k] = paint[k] * (1 - t) + bg[k] * t;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

test('MP-T15: the keyer finds the magenta and leaves no magenta behind', () => {
  const raw = part();
  const key = detectKey(raw);
  assert.ok(key[0] > 200 && key[1] < 40 && key[2] > 200, `key ${key}`);
  const { image } = chromaKey(raw);
  let residual = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const a = image.data[i + 3];
    if (a > 8 && spillOf(image.data[i], image.data[i + 1], image.data[i + 2]) > 40) residual++;
  }
  assert.equal(residual, 0, 'no visible pixel keeps a magenta cast');
  assert.equal(image.data[3], 0, 'the background corner is transparent');
  assert.equal(image.data[(118 * 256 + 128) * 4 + 3], 255, 'the painted centre is opaque');
});

test('MP-T15: keyPart trims to the painted part and passes QA', () => {
  const { master, qa } = keyPart(part(), undefined, 512);
  assert.notEqual(qa.verdict, 'fail');
  assert.ok(Math.abs(master.width - 141) <= 8 && Math.abs(master.height - 141) <= 8, `trimmed ${master.width}x${master.height}`);
});

test('MP-T15: downsampling is premultiplied: a half-transparent edge keeps its colour', () => {
  const w = 4, h = 4, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const opaque = i % 2 === 0; data.set(opaque ? [200, 100, 50, 255] : [0, 0, 0, 0], i * 4); }
  const small = downsample({ width: w, height: h, data }, 2);
  assert.deepEqual(Array.from(small.data.slice(0, 4)), [200, 100, 50, 128], 'no dark fringe from the transparent black');
});
