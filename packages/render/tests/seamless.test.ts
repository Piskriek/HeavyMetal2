import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSeamless } from '../src/terrain/surface-set';

/** A tile with a dark frame (like the painted ground tiles) and a gradient inside. */
function framed(size: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y) < size * 0.06;
    const o = (y * size + x) * 4;
    const v = edge ? 30 : 120 + Math.round((x / size) * 60);
    px[o] = v; px[o + 1] = v; px[o + 2] = v; px[o + 3] = 255;
  }
  return px;
}
const at = (px: Uint8ClampedArray, size: number, x: number, y: number): number => px[(y * size + x) * 4]!;

test('a framed tile loses its frame and wraps without a jump; the middle is untouched', () => {
  const size = 64;
  const before = framed(size);
  const px = before.slice();
  makeSeamless(px, size);
  // the dark frame is gone
  for (let i = 0; i < size; i++) { assert.ok(at(px, size, i, 0) > 90, `top ${i}`); assert.ok(at(px, size, 0, i) > 90, `left ${i}`); }
  // across the wrap, neighbours stay close (no seam): right edge next to left edge, bottom next to top
  for (let i = 0; i < size; i++) {
    assert.ok(Math.abs(at(px, size, size - 1, i) - at(px, size, 0, i)) <= 6, `wrap x at ${i}`);
    assert.ok(Math.abs(at(px, size, i, size - 1) - at(px, size, i, 0)) <= 6, `wrap y at ${i}`);
  }
  // the centre keeps the original pixels
  assert.equal(at(px, size, 32, 32), at(before, size, 32, 32));
});
