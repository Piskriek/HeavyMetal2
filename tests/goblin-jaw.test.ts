/**
 * GOBLIN JAW: neck wear registers to the head's measured jaw line (the 'jaw' anchor), not the old
 * 'chin' fraction, which sat 13–23 px up inside the jaw on every head and put collars, scarves and
 * medal ribbons over the mouth. HEAD_JAW must match the keyed head PNGs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { HEAD_JAW, PAINTED_PARTS, headRig, rigAnchor } from '../src/game/meta/painted-parts';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs') as { PNG: { sync: { read: (b: Buffer) => { width: number; height: number; data: Buffer } } } };

/** The last row still at least 35% as wide as the widest (below it only the chin's point). */
function jawFraction(file: string): number {
  const png = PNG.sync.read(readFileSync(new URL(`../public/avatar-parts/keyed/${file}.png`, import.meta.url)));
  const widths: number[] = [];
  for (let y = 0; y < png.height; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < png.width; x++) if (png.data[(y * png.width + x) * 4 + 3] > 128) { if (x0 < 0) x0 = x; x1 = x; }
    widths.push(x0 < 0 ? 0 : x1 - x0);
  }
  const max = Math.max(...widths);
  let row = png.height - 1;
  while (row > 0 && widths[row] === 0) row--;
  while (row > 0 && widths[row] < 0.35 * max) row--;
  return row / png.height;
}

test('HEAD_JAW matches every head master PNG', () => {
  for (const [head, frac] of Object.entries(HEAD_JAW)) {
    assert.ok(Math.abs(jawFraction(`head-${head}`) - frac) < 0.006, `${head}: re-measure HEAD_JAW`);
  }
});

test('neck wear hangs from the jaw line, which is below the old chin anchor on every head', () => {
  const neck = PAINTED_PARTS.filter((p) => p.layer === 'neck');
  assert.ok(neck.length >= 10);
  for (const p of neck) assert.equal(p.anchor, 'jaw', `${p.id} anchors to the jaw line`);
  for (const head of Object.keys(HEAD_JAW)) {
    const rig = headRig(head);
    const jaw = rigAnchor('jaw', rig).y;
    assert.ok(jaw > rigAnchor('chin', rig).y + 5, `${head}: the jaw line is below the old chin anchor`);
    assert.ok(jaw < rig.headTop + rig.headH, `${head}: and above the chin's point`);
  }
});
