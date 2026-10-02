import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stats } from '@hm/voxelart';
import { NATURE_BLOCK, NATURE_MODELS } from '../src';

test('every plant is deterministic, uses its palette, and stands on the ground', () => {
  for (const e of NATURE_MODELS) {
    const a = e.build(), b = e.build();
    assert.deepEqual(a.cells, b.cells, `${e.id} deterministic`);
    assert.ok(a.palette.length >= 6 && a.palette.length <= 16, `${e.id} palette ${a.palette.length}`);
    let filled = 0, floor = 0;
    for (let i = 0; i < a.cells.length; i++) {
      const v = a.cells[i]!;
      if (v === 0) continue;
      filled++;
      assert.ok(v <= a.palette.length, `${e.id} cell ${v} is outside the palette`);
      if (Math.floor(i / a.size[0]) % a.size[1] === 0) floor++;
    }
    assert.ok(filled > 40, `${e.id} has ${filled} voxels`);
    assert.ok(floor > 0, `${e.id} touches y = 0`);
    assert.equal(a.pivot[1], 0);
  }
});

test('every plant is one connected piece', () => {
  for (const e of NATURE_MODELS) {
    const s = stats(e.build());
    assert.equal(s.components, 1, `${e.id} has ${s.components} pieces`);
  }
});

test('plants have a block size and look different from each other', () => {
  for (const e of NATURE_MODELS) assert.ok(NATURE_BLOCK[e.id]! > 0.05 && NATURE_BLOCK[e.id]! < 0.5);
  assert.equal(new Set(NATURE_MODELS.map((e) => e.id)).size, NATURE_MODELS.length);
  const pals = new Set(NATURE_MODELS.map((e) => JSON.stringify(e.build().palette.map((p) => p.color))));
  assert.equal(pals.size, NATURE_MODELS.length);
});
