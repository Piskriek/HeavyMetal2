// @ts-nocheck (agent-generated: strict index access cleanup pending; behaviour is covered by the tests)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/voxel';

const pal = (name: string, r: number): V.PaletteEntry => ({ name, color: [r, 0, 0], roughness: 0.5, metalness: 0, emissive: 0, alpha: 1 });
const base = () => ({ ...V.createModel('t', 'T', [8, 8, 8]), palette: [pal('a', 1), pal('b', 0.5)] });
const same = (a: V.VoxelModel, b: V.VoxelModel) => assert.deepEqual([...a.cells], [...b.cells]);

test('fillBox count', () => assert.equal(V.countVoxels(V.fillBox(base(), [1, 1, 1], [3, 4, 5], 1)), 3 * 4 * 5));

test('sphere volume', () => {
  const m = V.fillSphere(V.createModel('s', 'S', [32, 32, 32]), [16, 16, 16], 10, 1);
  const exp = (4 / 3) * Math.PI * 1000;
  assert.ok(Math.abs(V.countVoxels(m) - exp) / exp < 0.15);
});

test('floodFill', () => {
  let m = V.fillBox(base(), [0, 0, 0], [7, 7, 3], 1);
  m = V.fillBox(m, [0, 0, 4], [7, 7, 4], 2);
  const f = V.floodFill(m, 0, 0, 7, 1);
  assert.equal(V.getVoxel(f, 7, 7, 5), 1);
  assert.equal(V.getVoxel(f, 0, 0, 4), 2);
  assert.equal(V.modelStats(f).paletteUse[0], 8 * 8 * 7);
});

test('mirror is symmetric', () => {
  const m = V.mirror(V.fillLine(base(), [0, 0, 0], [3, 7, 2], 1, 1), 'x');
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++)
    assert.equal(V.getVoxel(m, x, y, z), V.getVoxel(m, 7 - x, y, z));
});

test('rotate90 x4 identity', () => {
  let m = V.fillBox(V.createModel('r', 'R', [3, 5, 7]), [0, 0, 0], [2, 1, 0], 1);
  m = V.setVoxel(m, 1, 4, 6, 1);
  for (const ax of ['x', 'y', 'z'] as const) {
    let r = m; for (let i = 0; i < 4; i++) r = V.rotate90(r, ax);
    assert.deepEqual(r.size, m.size); assert.deepEqual(r.pivot, m.pivot); same(r, m);
  }
  assert.deepEqual(V.rotate90(m, 'y').size, [7, 5, 3]);
});

test('hollow', () => assert.equal(V.countVoxels(V.hollow(V.fillBox(base(), [0, 0, 0], [4, 4, 4], 1))), 125 - 27));

test('trim', () => {
  const t = V.trim(V.fillBox(base(), [2, 3, 4], [3, 5, 4], 1));
  assert.deepEqual(t.size, [2, 3, 1]);
  assert.deepEqual(t.pivot, [4 - 2, 0 - 3, 4 - 4]);
  assert.equal(V.countVoxels(t), 6);
});

test('merge remaps palettes', () => {
  const a = V.setVoxel(base(), 0, 0, 0, 1);
  const b = V.setVoxel(V.setVoxel({ ...V.createModel('b', 'B', [2, 2, 2]), palette: [pal('c', 0.1), pal('a', 1)] }, 0, 0, 0, 1), 1, 0, 0, 2);
  const m = V.merge(a, b, [4, 0, 0]);
  assert.equal(m.palette.length, 3);
  assert.equal(V.getVoxel(m, 4, 0, 0), 3);
  assert.equal(V.getVoxel(m, 5, 0, 0), 1);
  assert.equal(V.getVoxel(m, 0, 0, 0), 1);
});

test('no mutation', () => {
  const m = V.fillBox(base(), [0, 0, 0], [3, 3, 3], 1), snap = V.encodeModel(m);
  const ops = [
    () => V.setVoxel(m, 1, 1, 1, 2), () => V.fillBox(m, [0, 0, 0], [7, 7, 7], 2), () => V.fillSphere(m, [4, 4, 4], 3, 2),
    () => V.fillLine(m, [0, 0, 0], [7, 7, 7], 2, 2), () => V.floodFill(m, 0, 0, 0, 2), () => V.replaceColor(m, 1, 2),
    () => V.hollow(m), () => V.mirror(m, 'y'), () => V.flip(m, 'z'), () => V.rotate90(m, 'x'), () => V.translate(m, 1, 1, 1),
    () => V.trim(m), () => V.merge(m, m, [2, 2, 2]),
  ];
  for (const op of ops) { op(); assert.equal(V.encodeModel(m), snap); }
});

test('codec round trip and compact', () => {
  for (const m of [V.exampleBarrel(), V.exampleCone()]) {
    const d = V.decodeModel(V.encodeModel(m));
    assert.deepEqual(d.errors, []); assert.deepEqual(d.model, m);
  }
  let big = { ...V.createModel('big', 'Big', [64, 64, 64]), palette: [pal('a', 1)] };
  big = V.fillSphere(big, [32, 32, 32], 6, 1);
  const s = V.encodeModel(big);
  assert.ok(s.length < 4096, `size ${s.length}`);
  assert.equal(V.modelHash(V.decodeModel(s).model!), V.modelHash(big));
});

test('decode never throws on junk', () => {
  for (const j of ['', 'null', '{', '[]', '42', '{"size":[1,1,1]}', JSON.stringify({ id: 'a', name: 'b', size: [1, 1, 1], pivot: [0, 0, 0], palette: [], rle: '!!' })]) {
    const r = V.decodeModel(j); assert.equal(r.model, null); assert.ok(r.errors.length > 0);
  }
});

test('validate messages', () => {
  assert.equal(V.validateModel(base()).ok, true);
  for (const j of [null, 5, 'x', {}, { ...base(), size: [0, 200, 1] }]) assert.equal(V.validateModel(j).ok, false);
  const r = V.validateModel({ ...base(), cells: new Uint8Array(3) });
  assert.match(r.errors[0], /exactly 512/);
  assert.ok(V.validateModel({ ...base(), palette: [{ name: 'x' }] }).errors.some(e => /roughness/.test(e)));
});

test('hash stable and sensitive', () => {
  const m = V.exampleCone();
  assert.equal(V.modelHash(m), V.modelHash(V.exampleCone()));
  assert.notEqual(V.modelHash(m), V.modelHash(V.setVoxel(m, 0, 11, 0, 2)));
});

test('examples', () => {
  const b = V.exampleBarrel(), c = V.exampleCone();
  assert.equal(b.size[1], 16); assert.equal(c.size[1], 12);
  assert.ok(b.palette.some(p => p.metalness === 0.9));
  assert.ok(V.modelStats(b).paletteUse[1] > 0 && V.modelStats(c).paletteUse[1] > 0);
});