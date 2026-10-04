// tests/vox.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitTo, readVox, writeVox, type VoxelModel } from '../src/index';

const i32 = (n: number): number[] => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
const str = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const chunk = (id: string, content: number[], children: number[] = []): number[] => [...str(id), ...i32(content.length), ...i32(children.length), ...content, ...children];

function file(): Uint8Array {
  const size = chunk('SIZE', [...i32(2), ...i32(3), ...i32(4)]); // vox x=2, y=3, z=4 (z up)
  const xyzi = chunk('XYZI', [...i32(2), 0, 0, 0, 5, 1, 2, 3, 9]); // (0,0,0) colour 5, (1,2,3) colour 9
  const rgba: number[] = []; for (let i = 0; i < 256; i++) rgba.push(i, 0, 0, 255);
  const main = chunk('MAIN', [], [...size, ...xyzi, ...chunk('RGBA', rgba)]);
  return new Uint8Array([...str('VOX '), ...i32(150), ...main]);
}

test('reads a tiny file and turns it y-up', () => {
  const r = readVox(file(), 'tiny');
  assert.deepEqual(r.errors, []);
  assert.equal(r.models.length, 1);
  const m = r.models[0]!;
  assert.deepEqual(m.size, [2, 4, 3]);
  assert.equal(m.palette.length, 2);
  assert.ok(Math.abs(m.palette[0]!.color[0] - 4 / 255) < 1e-9, 'colour 5 is file entry 4');
  assert.equal(m.cells[0 + 2 * (0 + 4 * 0)], 1);
  assert.equal(m.cells[1 + 2 * (3 + 4 * 2)], 2, 'vox (1,2,3) is game (1,3,2)');
  assert.equal(m.cells.filter((c) => c > 0).length, 2);
});

test('garbage never throws', () => {
  for (const b of [new Uint8Array(0), new Uint8Array([1, 2, 3]), file().slice(0, 30), new Uint8Array(100).fill(255)]) {
    const r = readVox(b);
    assert.equal(r.models.length, 0);
    assert.ok(r.errors.length > 0);
  }
});

test('write then read gives the same model', () => {
  const m = readVox(file()).models[0]!;
  const back = readVox(writeVox(m)).models[0]!;
  assert.deepEqual(back.size, m.size);
  assert.deepEqual([...back.cells], [...m.cells]);
});

test('fitTo halves until it fits', () => {
  const m: VoxelModel = { id: 'a', name: 'a', size: [4, 4, 4], pivot: [2, 0, 2], palette: [{ name: 'c', color: [1, 0, 0], roughness: 0.8, metalness: 0, emissive: 0, alpha: 1 }], cells: new Uint8Array(64) };
  m.cells[0] = 1;
  const f = fitTo(m, 2);
  assert.deepEqual(f.size, [2, 2, 2]);
  assert.equal(f.cells[0], 1);
  assert.equal(f.cells.filter((c) => c > 0).length, 1);
});

test('round trip random model', () => {
  const m: VoxelModel = {
    id: 'rand',
    name: 'rand',
    size: [3, 3, 3],
    pivot: [1, 0, 1],
    palette: [
      { name: 'c1', color: [1, 0, 0], roughness: 0.5, metalness: 0.1, emissive: 0, alpha: 1 },
      { name: 'c2', color: [0, 1, 0], roughness: 0.2, metalness: 0.8, emissive: 1, alpha: 0.5 },
    ],
    cells: new Uint8Array([1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2]),
  };
  const back = readVox(writeVox(m)).models[0]!;
  assert.deepEqual(back.size, m.size);
  assert.deepEqual([...back.cells], [...m.cells]);
  assert.equal(back.palette.length, m.palette.length);
});

test('truncated files', () => {
  const f = file();
  for (let i = 0; i < f.length; i += 10) {
    const r = readVox(f.slice(0, i));
    assert.equal(r.models.length, 0);
    assert.ok(r.errors.length > 0);
  }
});

test('lying chunk size', () => {
  const f = file();
  const lying = new Uint8Array(f);
  for (let i = 0; i < lying.length - 4; i++) {
    if (lying[i] === 77 && lying[i+1] === 65 && lying[i+2] === 73 && lying[i+3] === 78) {
      lying[i+4] = 255; lying[i+5] = 255; lying[i+6] = 255; lying[i+7] = 255;
      break;
    }
  }
  const r = readVox(lying);
  assert.ok(r.errors.length > 0);
});

test('oversized count', () => {
  const size = chunk('SIZE', [...i32(1), ...i32(1), ...i32(1)]);
  const xyzi = chunk('XYZI', [...i32(20000000)]); // 20M voxels
  const rgba: number[] = []; for (let i = 0; i < 256; i++) rgba.push(i, 0, 0, 255);
  const main = chunk('MAIN', [], [...size, ...xyzi, ...chunk('RGBA', rgba)]);
  const bytes = new Uint8Array([...str('VOX '), ...i32(150), ...main]);
  const r = readVox(bytes);
  assert.ok(r.errors.length > 0);
});

test('MATL properties', () => {
  const size = chunk('SIZE', [...i32(1), ...i32(1), ...i32(1)]);
  const xyzi = chunk('XYZI', [...i32(1), 0, 0, 0, 1]);
  const rgba: number[] = []; for (let i = 0; i < 256; i++) rgba.push(0, 0, 0, 255);
  
  const matlDict = [
    ...str('_rough'), ...i32(4), ...str('0.1'), 
    ...str('_metal'), ...i32(4), ...str('0.9'), 
    ...str('_emit'), ...i32(4), ...str('0.5'), 
    ...str('_type'), ...i32(6), ...str('_glass'), 
    ...str('_trans'), ...i32(3), ...str('0.3')
  ];
  const matl = chunk('MATL', [...i32(1), ...i32(1), ...matlDict]);
  
  const main = chunk('MAIN', [], [...size, ...xyzi, ...chunk('RGBA', rgba), ...matl]);
  const bytes = new Uint8Array([...str('VOX '), ...i32(150), ...main]);
  
  const r = readVox(bytes);
  const m = r.models[0]!;
  const p = m.palette[0]!;
  assert.equal(p.roughness, 0.1);
  assert.equal(p.metalness, 0.9);
  assert.equal(p.emissive, 0.5);
  assert.equal(p.alpha, 0.3);
});