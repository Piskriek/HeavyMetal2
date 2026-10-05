import test from 'node:test';
import assert from 'node:assert/strict';
import { blockColour, buildPalette, isGzip, readBuild, readNbt } from '../src/index';
const s16 = (n: number): number[] => [(n >> 8) & 255, n & 255];
const s32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const name = (s: string): number[] => [...s16(s.length), ...[...s].map((c) => c.charCodeAt(0))];
const tag = (type: number, key: string, payload: number[]): number[] => [type, ...name(key), ...payload];
// Sponge v2: 2 wide, 1 high, 1 long; block 0 = stone (id 1), block 1 = air (id 0)
function sponge(): Uint8Array {
  const palette = [10, ...name('Palette'), ...tag(3, 'minecraft:air', s32(0)), ...tag(3, 'minecraft:stone', s32(1)), 0];
  const data = tag(7, 'BlockData', [...s32(2), 1, 0]);
  return new Uint8Array([10, ...name('Schematic'), ...tag(2, 'Width', s16(2)), ...tag(2, 'Height', s16(1)), ...tag(2, 'Length', s16(1)), ...palette, ...data, ...tag(3, 'Version', s32(2)), 0]);
}
test('reads NBT', () => {
  const r = readNbt(sponge());
  assert.equal(r.error, null);
  assert.equal(r.name, 'Schematic');
  assert.equal(r.root?.type, 'compound');
});
test('reads a Sponge schematic into a coloured model', () => {
  const b = readBuild(sponge(), 'tiny');
  assert.deepEqual(b.errors, []);
  assert.equal(b.format, 'sponge');
  assert.deepEqual(b.model?.size, [2, 1, 1]);
  assert.equal(b.blocks, 1);
  assert.equal(b.model?.cells[0], 1);
  assert.equal(b.model?.cells[1], 0);
  assert.equal(b.model?.palette[0]?.name, 'minecraft:stone');
});
test('colours come from names, not textures', () => {
  const w = blockColour('minecraft:red_wool');
  assert.ok(w.known && w.color[0] > w.color[1] && w.color[0] > w.color[2]);
  assert.ok(blockColour('minecraft:glass').alpha < 1);
  assert.equal(blockColour('minecraft:lava').emissive, 1);
  assert.equal(blockColour('minecraft:oak_planks[axis=y]').known, true);
  assert.equal(blockColour('mod:mystery_block').known, false);
});
test('garbage never throws', () => {
  for (const b of [new Uint8Array(0), new Uint8Array([10, 0]), sponge().slice(0, 20), new Uint8Array(64).fill(9)]) {
    const r = readBuild(b);
    assert.equal(r.model, null);
    assert.ok(r.errors.length > 0);
  }
  assert.equal(isGzip(new Uint8Array([0x1f, 0x8b, 8])), true);
});

// ---- additional tests

// Sponge v3: root "" -> Schematic { Width, Height, Length, Blocks { Palette, Data } }; 1x2x1, bottom planks, top air
function spongeV3(): Uint8Array {
  const palette = [10, ...name('Palette'), ...tag(3, 'minecraft:oak_planks', s32(0)), ...tag(3, 'minecraft:air', s32(1)), 0];
  const blocks = [10, ...name('Blocks'), ...palette, ...tag(7, 'Data', [...s32(2), 0, 1]), 0];
  const schem = [10, ...name('Schematic'), ...tag(3, 'Version', s32(3)), ...tag(2, 'Width', s16(1)), ...tag(2, 'Height', s16(2)), ...tag(2, 'Length', s16(1)), ...blocks, 0];
  return new Uint8Array([10, ...name(''), ...schem, 0]);
}
test('reads Sponge v3', () => {
  const b = readBuild(spongeV3(), 'v3');
  assert.deepEqual(b.errors, []);
  assert.equal(b.format, 'sponge');
  assert.deepEqual(b.model?.size, [1, 2, 1]);
  assert.equal(b.blocks, 1);
  assert.equal(b.model?.cells[0], 1);
  assert.equal(b.model?.cells[1], 0);
  assert.equal(b.model?.palette[0]?.name, 'minecraft:oak_planks');
});

test('reads MCEdit schematic with legacy ids', () => {
  const bytes = new Uint8Array([10, ...name('Schematic'), ...tag(2, 'Width', s16(2)), ...tag(2, 'Height', s16(1)), ...tag(2, 'Length', s16(1)),
    ...tag(7, 'Blocks', [...s32(2), 1, 0]), ...tag(7, 'Data', [...s32(2), 0, 0]), 0]);
  const b = readBuild(bytes, 'old');
  assert.deepEqual(b.errors, []);
  assert.equal(b.format, 'mcedit');
  assert.equal(b.blocks, 1);
  assert.equal(b.model?.cells[0], 1);
  assert.equal(b.model?.palette[0]?.name, 'minecraft:stone');
});

test('reads structure .nbt', () => {
  const size = tag(9, 'size', [3, ...s32(3), ...s32(2), ...s32(1), ...s32(1)]);
  const palette = tag(9, 'palette', [10, ...s32(1), ...tag(8, 'Name', name('minecraft:glowstone')), 0]);
  const blocks = tag(9, 'blocks', [10, ...s32(1), ...tag(9, 'pos', [3, ...s32(3), ...s32(1), ...s32(0), ...s32(0)]), ...tag(3, 'state', s32(0)), 0]);
  const bytes = new Uint8Array([10, ...name(''), ...size, ...palette, ...blocks, ...tag(3, 'DataVersion', s32(3000)), 0]);
  const b = readBuild(bytes, 'struct');
  assert.deepEqual(b.errors, []);
  assert.equal(b.format, 'structure');
  assert.deepEqual(b.model?.size, [2, 1, 1]);
  assert.equal(b.model?.cells[0], 0);
  assert.equal(b.model?.cells[1], 1);
  assert.equal(b.model?.palette[0]?.emissive, 1);
  assert.deepEqual(b.model?.pivot, [1, 0, 0]);
});

test('truncated input gives an error, never throws', () => {
  const full = spongeV3();
  for (let n = 0; n < full.length; n++) {
    const r = readBuild(full.slice(0, n));
    assert.equal(r.model, null);
    assert.ok(r.errors.length > 0);
  }
});

test('huge claimed lengths are refused', () => {
  const bigArray = new Uint8Array([10, ...name(''), ...tag(7, 'BlockData', s32(60_000_000)), 0]);
  assert.match(readNbt(bigArray).error ?? '', /limit/);
  const bigList = new Uint8Array([10, ...name(''), ...tag(9, 'blocks', [1, ...s32(0x7fffffff)]), 0]);
  assert.match(readNbt(bigList).error ?? '', /limit/);
  const bigBuild = new Uint8Array([10, ...name(''), ...tag(2, 'Width', s16(30000)), ...tag(2, 'Height', s16(30000)), ...tag(2, 'Length', s16(30000)),
    ...tag(7, 'Blocks', [...s32(1), 1]), 0]);
  const r = readBuild(bigBuild);
  assert.equal(r.model, null);
  assert.ok(r.errors.length > 0);
});

test('unknown blocks are reported but still placed', () => {
  const palette = [10, ...name('Palette'), ...tag(3, 'mod:mystery', s32(0)), ...tag(3, 'minecraft:air', s32(1)), 0];
  const bytes = new Uint8Array([10, ...name('Schematic'), ...tag(2, 'Width', s16(1)), ...tag(2, 'Height', s16(1)), ...tag(2, 'Length', s16(1)),
    ...palette, ...tag(7, 'BlockData', [...s32(1), 0]), 0]);
  const b = readBuild(bytes);
  assert.deepEqual(b.errors, []);
  assert.deepEqual(b.unknown, ['mod:mystery']);
  assert.equal(b.blocks, 1);
  assert.equal(b.model?.palette[0]?.name, 'mod:mystery');
});

test('more than 255 distinct colours are merged to at most 255', () => {
  const names = Array.from({ length: 400 }, (_, i) => `test:block_${i}`);
  const { palette, indices } = buildPalette(names, (n) => {
    const i = Number(n.split('_')[1]);
    return { color: [i / 400, (i % 20) / 20, 0.5], alpha: 1, emissive: 0, known: true };
  });
  assert.equal(palette.length, 255);
  assert.equal(indices.length, 400);
  assert.ok(indices.every((v) => v >= 1 && v <= 255));
  assert.equal(buildPalette(['minecraft:stone', 'minecraft:stone[axis=y]', 'minecraft:air']).palette.length, 1);
});