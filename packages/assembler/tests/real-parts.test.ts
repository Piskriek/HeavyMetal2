import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAD_PARTS, PART_PALETTES } from '@hm/voxpartshead';
import { BODY_PARTS } from '@hm/voxpartsbody';
import { assemble, cacheKey, defaultGoblinSpec, randomSpec } from '../src';

// acceptance against the REAL part libraries, not a synthetic one
const LIB = [...HEAD_PARTS, ...BODY_PARTS] as never[];

test('the default goblin assembles from real parts with nothing skipped', () => {
  const spec = defaultGoblinSpec(LIB);
  const { model, report } = assemble(spec, LIB, PART_PALETTES as never);
  assert.deepEqual(report.skipped, [], JSON.stringify(report.skipped));
  assert.ok(report.voxels > 2500 && report.voxels < 8000, `${report.voxels} voxels`);
  assert.ok(model.size[1] >= 38 && model.size[1] <= 56, `height ${model.size[1]}`);
  assert.ok(model.palette.length >= 6);
  assert.equal(model.cells.filter((c) => c).length, report.voxels);
});

test('the character is left-right symmetric about the torso centre (pairs mirrored)', () => {
  const spec = { ...defaultGoblinSpec(LIB), parts: { ...defaultGoblinSpec(LIB).parts, nose: undefined } };
  const { model, report } = assemble(spec, LIB, PART_PALETTES as never);
  const [sx, sy, sz] = model.size;
  const at = (x: number, y: number, z: number): number => model.cells[x + sx * (y + sy * z)] ?? 0;
  const minX = report.bounds.min[0];
  let occupied = 0, mismatched = 0;
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
    if (!at(x, y, z)) continue;
    occupied++;
    const worldX = x + minX - 1; // 1 voxel margin
    const mirror = 1 - worldX - minX + 1;
    if (mirror < 0 || mirror >= sx || !at(mirror, y, z)) mismatched++;
  }
  assert.ok(mismatched / occupied < 0.08, `${mismatched}/${occupied} voxels have no mirror image`);
});

test('assembling is deterministic and the cache key follows the spec', () => {
  const spec = defaultGoblinSpec(LIB);
  const a = assemble(spec, LIB, PART_PALETTES as never), b = assemble(spec, LIB, PART_PALETTES as never);
  assert.deepEqual(Array.from(a.model.cells), Array.from(b.model.cells));
  assert.equal(cacheKey(spec), cacheKey({ ...spec }));
  assert.notEqual(cacheKey(spec), cacheKey({ ...spec, palette: Object.keys(PART_PALETTES)[1]! }));
});

test('random goblins always assemble something that stands up', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const spec = randomSpec(seed, LIB, PART_PALETTES as never);
    const { model, report } = assemble(spec, LIB, PART_PALETTES as never);
    assert.ok(report.voxels > 800, `seed ${seed}: ${report.voxels} voxels`);
    assert.ok(model.size[1] > 25);
  }
});
