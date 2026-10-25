// The noise atlas: one byte-identical noise / tile source for the shader, the CPU coverage report, the review sheets and (later) an
// agent's `studio.material.coverage`. These tests hold it to the two things that make that claim true — determinism, and a sampler
// that returns exactly what a bilinear texture fetch returns — and to the channel order the shader's uniform assumes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAT_TILE_SAMPLE,
  MATERIAL_NOISE_GRAPHS,
  NOISE_ATLAS_INDEX,
  NOISE_ATLAS_ORDER,
  NOISE_ATLAS_SIZE,
  TILE_ATLAS_SIZE,
  TILE_LIBRARY,
  atlasNoiseSource,
  atlasTileSource,
  bilinearChannel,
  clearTileBytesCache,
  evaluateGraph,
  noiseAtlasBytes,
  tileBytesAt,
  type TexGraph,
} from '../src';

test('the atlas is RGBA at the shader size, one noise per channel, bytes in 0..255', () => {
  assert.equal(NOISE_ATLAS_SIZE, 256);
  const bytes = noiseAtlasBytes();
  assert.equal(bytes.length, NOISE_ATLAS_SIZE * NOISE_ATLAS_SIZE * 4);
  assert.equal(MATERIAL_NOISE_GRAPHS.length, 4);
  assert.deepEqual([...NOISE_ATLAS_ORDER], ['clouds', 'cells', 'speckle', 'scratches']);
  assert.deepEqual(
    NOISE_ATLAS_ORDER.map((kind) => NOISE_ATLAS_INDEX[kind]),
    [0, 1, 2, 3],
  );
  for (let i = 0; i < bytes.length; i += 1) assert.ok(bytes[i]! >= 0 && bytes[i]! <= 255);
});

test('every channel carries the noise it names, and none of them is flat', () => {
  const bytes = noiseAtlasBytes();
  NOISE_ATLAS_ORDER.forEach((kind, channel) => {
    let lo = 255;
    let hi = 0;
    let sum = 0;
    const n = NOISE_ATLAS_SIZE * NOISE_ATLAS_SIZE;
    for (let i = 0; i < n; i += 1) {
      const v = bytes[i * 4 + channel]!;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      sum += v;
    }
    const mean = sum / n / 255;
    assert.ok((hi - lo) / 255 > 0.25, `${kind} channel range ${lo}..${hi} is too flat`);
    // a scratch noise is mostly dark with a few bright lines (that is what a scratch is), the other three are cloud-like;
    // what matters here is that no channel is empty and none is saturated
    const floor = kind === 'scratches' ? 0.03 : 0.15;
    assert.ok(mean > floor && mean < 0.85, `${kind} channel mean ${mean.toFixed(2)} is outside ${floor}..0.85`);
    if (kind === 'scratches') {
      const bright = [...Array(n).keys()].filter((i) => bytes[i * 4 + channel]! > 200).length / n;
      assert.ok(bright > 0.01 && bright < 0.35, `scratches cover ${(bright * 100).toFixed(1)}% of the tile at full white`);
    }
  });
  // the four channels are different noises, not one noise written four times
  const seen = new Set<string>();
  for (let c = 0; c < 4; c += 1) seen.add(String(bytes[c]));
  assert.ok(seen.size > 1);
});

test('the atlas is deterministic: a second call is the same array, and a rebuild is byte-identical', () => {
  const first = noiseAtlasBytes();
  assert.equal(noiseAtlasBytes(), first, 'the atlas should be built once and reused');
  // rebuild the channels by hand exactly as the module does: same graphs, same bytes
  const rebuilt = new Uint8Array(NOISE_ATLAS_SIZE * NOISE_ATLAS_SIZE * 4);
  MATERIAL_NOISE_GRAPHS.forEach((graph, channel) => {
    const height = evaluateGraph(graph, { size: NOISE_ATLAS_SIZE }).height;
    for (let i = 0; i < NOISE_ATLAS_SIZE * NOISE_ATLAS_SIZE; i += 1) {
      rebuilt[i * 4 + channel] = Math.round(255 * Math.min(1, Math.max(0, height?.[i] ?? 0.5)));
    }
  });
  assert.deepEqual(rebuilt, first);
});

test('bilinearChannel wraps at the seam, and lands on the texel centre at the texel centre', () => {
  const size = 4;
  const bytes = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) bytes[i * 4] = i * 16; // a ramp, R channel
  const centre = (x: number, y: number): number => bytes[(y * size + x) * 4]! / 255;
  // u,v at texel (1,2)'s centre reads texel (1,2)
  assert.ok(Math.abs(bilinearChannel(bytes, size, 0, 1.5 / size, 2.5 / size) - centre(1, 2)) < 1e-9);
  // u = -0.5/size is one texel left of 0: it wraps to the last column, not to black
  assert.ok(Math.abs(bilinearChannel(bytes, size, 0, -0.5 / size, 2.5 / size) - centre(3, 2)) < 1e-9);
  // u = 1 + ... is the same as u = ...
  assert.ok(Math.abs(bilinearChannel(bytes, size, 0, 1.5 / size, 2.5 / size) - bilinearChannel(bytes, size, 0, 1 + 1.5 / size, 2.5 / size)) < 1e-9);
  // halfway between two texels is their mean
  const mid = bilinearChannel(bytes, size, 0, 1.5 / size + 0.5 / size, 2.5 / size);
  assert.ok(Math.abs(mid - (centre(1, 2) + centre(2, 2)) / 2) < 1e-9);
});

test('the CPU noise source matches the bytes the shader uploads', () => {
  const bytes = noiseAtlasBytes();
  const noise = atlasNoiseSource();
  for (const kind of NOISE_ATLAS_ORDER) {
    const channel = NOISE_ATLAS_INDEX[kind];
    for (const [u, v] of [
      [0.5, 0.5],
      [0.125, 0.875],
      [0.31, 0.77],
      [0.999, 0.001],
    ] as const) {
      assert.equal(noise.sample(kind, u, v), bilinearChannel(bytes, NOISE_ATLAS_SIZE, channel, u, v), `${kind} @ ${u},${v}`);
    }
  }
  // and the noise does not depend on which sampler instance asked
  assert.equal(atlasNoiseSource().sample('clouds', 0.4, 0.6), noise.sample('clouds', 0.4, 0.6));
});

test('a tile is RGBA bytes (grey, height, roughness, 255) and unknown ids read flat', () => {
  const bytes = tileBytesAt(TILE_LIBRARY, 'brushed-metal', 32);
  assert.ok(bytes, 'brushed-metal should be in the tile library');
  assert.equal(bytes!.length, 32 * 32 * 4);
  for (let i = 0; i < 32 * 32; i += 1) assert.equal(bytes![i * 4 + 3], 255, 'alpha should be opaque');
  // grey is the luminance of the tile's albedo, height its height map: a tile with bumps has a height spread
  const heights = new Set<number>();
  for (let i = 0; i < 32 * 32; i += 1) heights.add(bytes![i * 4 + 1]!);
  assert.ok(heights.size > 4, 'the height channel is flat');

  assert.equal(tileBytesAt(TILE_LIBRARY, 'no-such-tile', 32), null);
  assert.equal(tileBytesAt(TILE_LIBRARY, 'brushed-metal', 16)!.length, 16 * 16 * 4, 'the size is part of the cache key');
});

test('tile bytes are cached per id and size, and cleared on demand', () => {
  const a = tileBytesAt(TILE_LIBRARY, 'cells', 16);
  assert.equal(tileBytesAt(TILE_LIBRARY, 'cells', 16), a, 'a second read should be the same array');
  clearTileBytesCache();
  const b = tileBytesAt(TILE_LIBRARY, 'cells', 16);
  assert.notEqual(b, a, 'the cache should have been dropped');
  assert.deepEqual(b, a, 'but rebuilding gives the same bytes');
});

test('the tile sampler reads the same numbers as the CPU tile builder, wrapping at the seam', () => {
  const size = TILE_ATLAS_SIZE;
  const tiles = atlasTileSource(TILE_LIBRARY, size);
  const bytes = tileBytesAt(TILE_LIBRARY, 'carbon-weave', size)!;
  const at = (u: number, v: number) => tiles.sample('carbon-weave', u, v);
  const s = at(0.375, 0.625);
  assert.equal(s.grey, bilinearChannel(bytes, size, 0, 0.375, 0.625));
  assert.equal(s.height, bilinearChannel(bytes, size, 1, 0.375, 0.625));
  assert.equal(s.rough, bilinearChannel(bytes, size, 2, 0.375, 0.625));
  // wrapping: the seam is continuous, so 0 and 1 sample the same place
  assert.deepEqual(at(0, 0.25), at(1, 0.25));
  // and an unknown tile is the flat sample, not a thrown error
  assert.deepEqual(tiles.sample('nope', 0.5, 0.5), FLAT_TILE_SAMPLE);
});

test('the sampler follows the graphs it is given, not a hardcoded library', () => {
  clearTileBytesCache();
  const graphs: Record<string, TexGraph> = {
    'test-flat': { id: 'test-flat', name: 'Flat', nodes: [{ id: 'c', type: 'constant', value: 1 }], out: { height: 'c' } },
  };
  const tiles = atlasTileSource(graphs, 16);
  const s = tiles.sample('test-flat', 0.3, 0.3);
  assert.equal(s.height, 1);
  assert.equal(tiles.sample('brushed-metal', 0.3, 0.3).height, FLAT_TILE_SAMPLE.height, 'the library is not registered here');
  clearTileBytesCache();
});
