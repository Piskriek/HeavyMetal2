/** Depth masks: a painted front/back map is lined up with its keyed part (scripts/build-depth-mask.mjs). */
import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error — plain .mjs script without types
import { depthMaskFromMap, halfResolution } from '../scripts/build-depth-mask.mjs';

type Img = { w: number; h: number; data: Uint8Array };
function image(w: number, h: number, px: (x: number, y: number) => [number, number, number, number]): Img {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(px(x, y), (y * w + x) * 4);
  return { w, h, data };
}

// A 40×20 part (fully opaque, with 4 px of transparent margin), and its map painted at twice the size
// on a wider magenta canvas: the left half in front (white), the right half behind (black).
const part = image(48, 28, (x, y) => (x >= 4 && x < 44 && y >= 4 && y < 24 ? [90, 140, 60, 255] : [0, 0, 0, 0]));
const map = image(120, 60, (x, y) => {
  if (x < 20 || x >= 100 || y < 10 || y >= 50) return [255, 0, 255, 255];
  return x < 60 ? [250, 250, 250, 255] : [8, 8, 8, 255];
});

test('depth mask: the map is lined up by bounding box, so a larger, offset map still labels the right halves', () => {
  const { mask, stats, verdict } = depthMaskFromMap(part, map);
  assert.equal(verdict, 'pass');
  assert.equal(mask[10 * 48 + 8], 255, 'left side of the part is in front');
  assert.equal(mask[10 * 48 + 40], 0, 'right side of the part is behind');
  assert.ok(Math.abs(stats.back - 0.5) < 0.05);
});

test('depth mask: a map with nothing marked behind, or the wrong shape, fails QA', () => {
  const allFront = image(120, 60, (x, y) => (x < 20 || x >= 100 || y < 10 || y >= 50 ? [255, 0, 255, 255] : [250, 250, 250, 255]));
  assert.equal(depthMaskFromMap(part, allFront).verdict, 'fail');
  const tall = image(60, 120, (x, y) => (x < 10 || x >= 50 || y < 10 || y >= 110 ? [255, 0, 255, 255] : [250, 250, 250, 255]));
  assert.match(depthMaskFromMap(part, tall).notes.join(' '), /off the part's shape/);
});

test('depth mask: the shipped mask is half resolution greyscale', () => {
  const { mask } = depthMaskFromMap(part, map);
  const half = halfResolution(mask, 48, 28);
  assert.deepEqual([half.w, half.h], [24, 14]);
  assert.equal(half.data[(5 * 24 + 4) * 4], 255);
  assert.equal(half.data[(5 * 24 + 20) * 4], 0);
});
