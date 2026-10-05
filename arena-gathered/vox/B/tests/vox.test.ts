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

/* ---------------- extra helpers ---------------- */

type Entry = VoxelModel['palette'][number];
type Vec = VoxelModel['size'];

const voxFile = (...chunks: number[][]): Uint8Array => {
  const kids: number[] = [];
  for (const c of chunks) kids.push(...c);
  return new Uint8Array([...str('VOX '), ...i32(150), ...chunk('MAIN', [], kids)]);
};
const dict = (pairs: [string, string][]): number[] => {
  const body: number[] = [...i32(pairs.length)];
  for (const [k, v] of pairs) body.push(...i32(k.length), ...str(k), ...i32(v.length), ...str(v));
  return body;
};
const rgbaAll = (r: number, g: number, b: number, a: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 256; i++) out.push(r, g, b, a);
  return out;
};
const rgbaRamp = (): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 256; i++) out.push(i, 255 - i, (i * 7) & 255, 255);
  return out;
};
function randomModel(seed: number): VoxelModel {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const size: Vec = [3 + Math.floor(next() * 6), 2 + Math.floor(next() * 7), 4 + Math.floor(next() * 5)];
  const count = 1 + Math.floor(next() * 12);
  const palette: Entry[] = [];
  for (let i = 0; i < count; i++) {
    palette.push({ name: `Colour ${i + 1}`, color: [next(), next(), next()], roughness: next(), metalness: next(), emissive: next(), alpha: next() });
  }
  const cells = new Uint8Array(size[0] * size[1] * size[2]);
  for (let i = 0; i < cells.length; i++) cells[i] = next() < 0.45 ? 0 : 1 + Math.floor(next() * count);
  for (let i = 0; i < count; i++) cells[i] = i + 1; // every palette entry gets used
  return { id: 'rand', name: 'rand', size, pivot: [Math.floor(size[0] / 2), 0, Math.floor(size[2] / 2)], palette, cells };
}

/* ---------------- extra tests ---------------- */

test('a random model survives a round trip', () => {
  for (const seed of [1, 7, 99, 12345, 999983]) {
    const m = randomModel(seed);
    const r = readVox(writeVox(m), 'rand');
    assert.deepEqual(r.errors, []);
    assert.equal(r.models.length, 1);
    const back = r.models[0]!;
    assert.deepEqual(back.size, m.size);
    assert.deepEqual(back.pivot, [Math.floor(m.size[0] / 2), 0, Math.floor(m.size[2] / 2)]);
    assert.deepEqual([...back.cells], [...m.cells]);
    assert.equal(back.palette.length, m.palette.length);
    for (let i = 0; i < m.palette.length; i++) {
      const got = back.palette[i]!;
      const want = m.palette[i]!;
      assert.equal(got.name, `Colour ${i + 1}`);
      assert.ok(Math.abs(got.color[0] - want.color[0]) <= 1 / 255 + 1e-9);
      assert.ok(Math.abs(got.color[1] - want.color[1]) <= 1 / 255 + 1e-9);
      assert.ok(Math.abs(got.color[2] - want.color[2]) <= 1 / 255 + 1e-9);
      assert.ok(Math.abs(got.alpha - want.alpha) <= 1 / 255 + 1e-9);
    }
  }
});

test('every truncation reports an error and never throws', () => {
  const full = file();
  for (let cut = 0; cut < full.length; cut++) {
    const r = readVox(full.slice(0, cut));
    assert.ok(r.errors.length > 0, `cut at ${cut} should be an error`);
    assert.equal(r.offsets.length, r.models.length);
    for (const m of r.models) assert.equal(m.cells.length, m.size[0] * m.size[1] * m.size[2]);
  }
});

test('a chunk that lies about its size is refused', () => {
  const size = chunk('SIZE', [...i32(2), ...i32(2), ...i32(2)]);
  const lying: number[] = [...str('XYZI'), ...i32(1 << 20), ...i32(0), ...i32(1), 0, 0, 0, 1];
  const r = readVox(new Uint8Array([...str('VOX '), ...i32(150), ...chunk('MAIN', [], [...size, ...lying])]));
  assert.equal(r.models.length, 0);
  assert.ok(r.errors.some((e) => e.includes('truncated')));
  assert.ok(r.errors.some((e) => e.includes('no XYZI')));
});

test('absurd counts and dimensions are refused without grinding', () => {
  const started = Date.now();
  const huge = readVox(voxFile(chunk('SIZE', [...i32(4096), ...i32(4096), ...i32(4096)])));
  assert.equal(huge.models.length, 0);
  assert.ok(huge.errors.some((e) => e.includes('16000000')));

  const lyingCount = readVox(
    voxFile(chunk('SIZE', [...i32(4), ...i32(4), ...i32(4)]), [...str('XYZI'), ...i32(8), ...i32(0), ...i32(0x7ffffff0), 0, 0, 0, 1]),
  );
  assert.equal(lyingCount.models.length, 0);
  assert.ok(lyingCount.errors.some((e) => e.includes('claims')));

  const manySizes: number[][] = [];
  for (let i = 0; i < 40; i++) manySizes.push(chunk('SIZE', [...i32(1000), ...i32(1000), ...i32(1000)]));
  const flooded = readVox(voxFile(...manySizes));
  assert.equal(flooded.models.length, 0);
  assert.ok(flooded.errors.some((e) => e.includes('16000000')));
  assert.ok(Date.now() - started < 5000, 'refusals must be immediate');
});

test('a file over 32 MB is refused', () => {
  const r = readVox(new Uint8Array(32 * 1024 * 1024 + 1));
  assert.equal(r.models.length, 0);
  assert.ok(r.errors.some((e) => e.includes('33554432')));
});

test('MATL drives roughness, metalness, emissive and glass alpha', () => {
  const size = chunk('SIZE', [...i32(3), ...i32(1), ...i32(1)]);
  const xyzi = chunk('XYZI', [...i32(3), 0, 0, 0, 3, 1, 0, 0, 7, 2, 0, 0, 11]);
  const rgba = chunk('RGBA', rgbaAll(255, 128, 0, 255));
  const r = readVox(
    voxFile(
      size,
      xyzi,
      rgba,
      chunk('MATL', [...i32(3), ...dict([['_rough', '0.25'], ['_metal', '1'], ['_emit', '0.5']])]),
      chunk('MATL', [...i32(7), ...dict([['_type', '_glass'], ['_trans', '0.3']])]),
      chunk('MATL', [...i32(11), ...dict([['_type', '_glass']])]),
    ),
    'mat',
  );
  assert.deepEqual(r.errors, []);
  const m = r.models[0]!;
  assert.deepEqual(m.size, [3, 1, 1]);
  assert.deepEqual([...m.cells], [1, 2, 3]);
  assert.equal(m.palette.length, 3);
  const a = m.palette[0]!;
  const b = m.palette[1]!;
  const c = m.palette[2]!;
  assert.equal(a.name, 'Colour 3');
  assert.equal(a.roughness, 0.25);
  assert.equal(a.metalness, 1);
  assert.equal(a.emissive, 0.5);
  assert.equal(a.alpha, 1);
  assert.ok(Math.abs(a.color[0] - 1) < 1e-9 && Math.abs(a.color[1] - 128 / 255) < 1e-9 && a.color[2] === 0);
  assert.equal(b.name, 'Colour 7');
  assert.equal(b.roughness, 0.8);
  assert.equal(b.metalness, 0);
  assert.equal(b.emissive, 0);
  assert.ok(Math.abs(b.alpha - 0.7) < 1e-9, '_trans 0.3 means alpha 0.7');
  assert.ok(Math.abs(c.alpha - 0.5) < 1e-9, 'glass without _trans means alpha 0.5');

  const junk = readVox(voxFile(size, xyzi, rgba, chunk('MATL', [...i32(3), ...dict([['_rough', 'shiny']])])), 'mat');
  assert.ok(junk.warnings.some((w) => w.includes('not a number')));
  assert.equal(junk.models[0]!.palette[0]!.roughness, 0.8);
});

test('without RGBA the default palette is used and warned about', () => {
  const r = readVox(voxFile(chunk('SIZE', [...i32(1), ...i32(1), ...i32(1)]), chunk('XYZI', [...i32(1), 0, 0, 0, 5])), 'grey');
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.includes('default palette'));
  const m = r.models[0]!;
  assert.equal(m.palette.length, 1);
  assert.equal(m.palette[0]!.name, 'Colour 5');
  const grey = 4 / 15;
  assert.ok(Math.abs(m.palette[0]!.color[0] - grey) < 1e-9);
  assert.ok(Math.abs(m.palette[0]!.color[2] - grey) < 1e-9);
  assert.equal(m.palette[0]!.alpha, 1);
  assert.equal(m.id, 'grey-0');
  assert.equal(m.name, 'grey-0');
  assert.deepEqual(m.pivot, [0, 0, 0]);
});

test('the scene graph gives y-up offsets', () => {
  const shp = chunk('nSHP', [...i32(1), ...dict([]), ...i32(1), ...i32(0), ...dict([])]);
  const trn = chunk('nTRN', [...i32(2), ...dict([['_name', 'crate']]), ...i32(1), ...i32(-1), ...i32(-1), ...i32(2), ...dict([['_t', '1 2 3']]), ...dict([['_t', '9 9 9']])]);
  const r = readVox(
    voxFile(chunk('SIZE', [...i32(1), ...i32(1), ...i32(1)]), chunk('XYZI', [...i32(1), 0, 0, 0, 1]), chunk('RGBA', rgbaRamp()), shp, trn),
    'scene',
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.models.length, 1);
  assert.deepEqual(r.offsets, [[1, 3, 2]], 'vox _t "1 2 3" is game [1, 3, 2]; frame 0 only');
  assert.equal(r.models[0]!.palette[0]!.name, 'Colour 1');
});

test('voxels outside the size and colour 0 are dropped with a warning', () => {
  const r = readVox(
    voxFile(
      chunk('SIZE', [...i32(1), ...i32(1), ...i32(1)]),
      chunk('XYZI', [...i32(3), 0, 0, 0, 1, 5, 5, 5, 2, 0, 0, 0, 0]),
      chunk('RGBA', rgbaRamp()),
    ),
    'oob',
  );
  assert.deepEqual(r.errors, []);
  const m = r.models[0]!;
  assert.equal(m.cells.filter((c) => c > 0).length, 1);
  assert.ok(r.warnings.some((w) => w.includes('outside')));
  assert.ok(r.warnings.some((w) => w.includes('colour index 0')));
});

test('writeVox emits a well formed chunk tree', () => {
  const out = writeVox(readVox(file()).models[0]!);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const tag = (at: number): string => String.fromCharCode(out[at]!, out[at + 1]!, out[at + 2]!, out[at + 3]!);
  assert.equal(tag(0), 'VOX ');
  assert.equal(view.getInt32(4, true), 150);
  assert.equal(tag(8), 'MAIN');
  assert.equal(view.getInt32(12, true), 0);
  assert.equal(view.getInt32(16, true), out.length - 20);
  assert.equal(tag(20), 'SIZE');
  assert.equal(view.getInt32(24, true), 12);
  assert.equal(tag(44), 'XYZI'); assert.equal(view.getInt32(48, true), 12, 'XYZI holds a count plus two voxels');
  assert.ok(readVox(out).errors.length === 0);
});

test('fitTo keeps the busiest value, handles odd axes and no-ops', () => {
  const palette: Entry[] = [
    { name: 'Colour 1', color: [1, 0, 0], roughness: 0.8, metalness: 0, emissive: 0, alpha: 1 },
    { name: 'Colour 2', color: [0, 1, 0], roughness: 0.8, metalness: 0, emissive: 0, alpha: 1 },
  ];
  const m: VoxelModel = { id: 'b', name: 'b', size: [2, 2, 2], pivot: [1, 0, 1], palette, cells: new Uint8Array(8) };
  m.cells[0] = 1;
  m.cells[1] = 2;
  m.cells[2] = 2;
  m.cells[4] = 2;
  const small = fitTo(m, 1);
  assert.deepEqual(small.size, [1, 1, 2 - 1]);
  assert.equal(small.cells.length, 1);
  assert.equal(small.cells[0], 2, 'three 2s beat one 1');
  assert.deepEqual(small.pivot, [0, 0, 0]);
  assert.equal(small.palette.length, 2);
  assert.equal(small.id, 'b');

  const same = fitTo(m, 8);
  assert.deepEqual(same.size, [2, 2, 2]);
  assert.deepEqual([...same.cells], [...m.cells]);
  same.cells[0] = 0;
  assert.equal(m.cells[0], 1, 'fitTo must not alias the source cells');

  const odd: VoxelModel = { id: 'c', name: 'c', size: [5, 1, 3], pivot: [2, 0, 1], palette, cells: new Uint8Array(15) };
  odd.cells[0] = 1;
  const g = fitTo(odd, 2);
  assert.deepEqual(g.size, [2, 1, 1]);
  assert.equal(g.cells[0], 1);
  assert.equal(g.cells.filter((c) => c > 0).length, 1);

  const empty: VoxelModel = { id: 'd', name: 'd', size: [8, 8, 8], pivot: [4, 0, 4], palette: [], cells: new Uint8Array(512) };
  const flat = fitTo(empty, 1);
  assert.deepEqual(flat.size, [1, 1, 1]);
  assert.equal(flat.cells[0], 0, 'empty only when all eight are empty');
});