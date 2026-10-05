import test from 'node:test';
import assert from 'node:assert/strict';
import { ChunkStreamer, decodeChunk, encodeChunk, parseManifest, visibleFaces } from '../src/index';
const chunks: Record<string, string> = {};
for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) chunks[`${x},${z}`] = `https://example.org/c/${x}_${z}.bin`;
const text = JSON.stringify({ name: 'Test', license: 'CC0', source: 'example.org', chunkSize: 16, spawn: [0, 10, 0], chunks });
test('manifest checks', () => {
  assert.equal(parseManifest(text).errors.length, 0);
  assert.ok(parseManifest('{').errors.length > 0);
  assert.ok(parseManifest(JSON.stringify({ ...JSON.parse(text), chunkSize: 3 })).errors.length > 0);
});
test('nearest first, limited in flight', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 2, maxLoaded: 50, maxInFlight: 3 });
  s.setView(8, 8, 0); // inside chunk 0,0
  const first = s.next();
  assert.equal(first.length, 3);
  assert.equal(first[0], '0,0');
  assert.equal(s.next().length, 0);
  s.done('0,0', encodeChunk(2, 1, new Uint8Array([1, 0, 0, 1])));
  assert.equal(s.state('0,0'), 'ready');
  assert.equal(s.next().length, 1);
});
test('chunk bytes round trip and faces', () => {
  const cells = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]);
  const d = decodeChunk(encodeChunk(2, 2, cells));
  assert.equal(d.error, null); assert.deepEqual([...d.cells!], [...cells]);
  assert.deepEqual(visibleFaces(2, 2, cells), [1, 1, 1, 1, 1, 1]);
  assert.ok(decodeChunk(new Uint8Array([1, 2, 3])).error);
});

test('bad manifests are rejected without throwing', () => {
  const base = JSON.parse(text) as Record<string, unknown>;
  assert.equal(parseManifest(JSON.stringify({ ...base, name: '' })).manifest, null);
  assert.equal(parseManifest(JSON.stringify({ ...base, spawn: [0, Infinity, 0] })).manifest, null);
  assert.equal(parseManifest(JSON.stringify({ ...base, chunks: { 'x,0': 'ftp://bad' } })).manifest, null);
  assert.doesNotThrow(() => parseManifest('null'));
});

test('a failed chunk is retried twice and then remains failed', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 0, maxLoaded: 2, maxInFlight: 1 });
  s.setView(0, 0, 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.deepEqual(s.next(), ['0,0']);
    s.done('0,0', null);
  }
  assert.equal(s.state('0,0'), 'failed');
  assert.deepEqual(s.next(), []);
});

test('eviction drops the farthest ready chunk but keeps the radius', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 1, maxLoaded: 1, maxInFlight: 20 });
  s.setView(0, 0, 0);
  for (const key of s.next()) s.done(key, encodeChunk(1, 1, new Uint8Array([1])));
  s.setView(48, 48, 0);
  const fetched = s.next();
  for (const key of fetched) s.done(key, encodeChunk(1, 1, new Uint8Array([1])));
  const evicted = s.evict();
  assert.ok(evicted.length > 0);
  assert.ok(!evicted.includes('3,3'));
  assert.equal(s.state('3,3'), 'ready');
});

test('equal-distance chunks in front are ordered first', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 1, maxLoaded: 10, maxInFlight: 5 });
  s.setView(0, 0, 0);
  const order = s.next();
  assert.equal(order[0], '0,0');
  assert.equal(order[1], '0,1');
});

test('RLE round trips deterministic pseudo-random data', () => {
  let seed = 123456789;
  const cells = new Uint8Array(16 * 5 * 16);
  for (let i = 0; i < cells.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    cells[i] = seed & 7;
  }
  const decoded = decodeChunk(encodeChunk(16, 5, cells));
  assert.equal(decoded.error, null);
  assert.deepEqual(decoded.cells, cells);
});

test('truncated chunk bytes return an error', () => {
  const encoded = encodeChunk(2, 2, new Uint8Array(8).fill(4));
  assert.ok(decodeChunk(encoded.slice(0, encoded.length - 1)).error);
});