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

// Additional tests

test('bad manifest errors', () => {
  const bad = parseManifest(JSON.stringify({ name: '', license: 'L', source: 'S', chunkSize: 10, spawn: [0, 0, 0], chunks: {} }));
  assert.ok(bad.errors.some((e) => e.includes('name')));
});

test('retry then failed', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 2, maxLoaded: 50, maxInFlight: 4 });
  s.setView(8, 8, 0);
  const key = s.next()[0]!;
  s.done(key, null);
  assert.equal(s.state(key), 'wanted');
  s.next();
  s.done(key, null);
  assert.equal(s.state(key), 'wanted');
  s.next();
  s.done(key, null);
  assert.equal(s.state(key), 'failed');
  assert.equal(s.next().filter((k) => k === key).length, 0);
});

test('eviction keeps the radius', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 2, maxLoaded: 5, maxInFlight: 10 });
  s.setView(8, 8, 0);
  const keys = s.next();
  for (const k of keys) {
    s.done(k, encodeChunk(2, 1, new Uint8Array([1, 1, 1, 1])));
  }
  const evicted = s.evict();
  for (const k of evicted) {
    const [cx, cz] = k.split(',').map(Number) as [number, number];
    const dist = Math.sqrt(cx * cx + cz * cz);
    assert.ok(dist > 2 + 1e-6, `evicted ${k} should be outside radius`);
  }
});

test('front-first ordering', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 8, maxLoaded: 400, maxInFlight: 10 });
  s.setView(8, 8, 0);
  const keys = s.next();
  assert.equal(keys[0], '0,0');
  const camChunk = [0, 0];
  const sortedByDist = keys.slice();
  for (let i = 1; i < sortedByDist.length; i++) {
    const [ax, az] = sortedByDist[i - 1]!.split(',').map(Number) as [number, number];
    const [bx, bz] = sortedByDist[i]!.split(',').map(Number) as [number, number];
    const distA = Math.sqrt((ax - camChunk[0]) ** 2 + (az - camChunk[1]) ** 2);
    const distB = Math.sqrt((bx - camChunk[0]) ** 2 + (bz - camChunk[1]) ** 2);
    assert.ok(distA <= distB + 1e-6, `ordering distance violated at ${i}`);
    if (Math.abs(distA - distB) < 1e-6) {
      const frontA = Math.abs(Math.atan2(ax - camChunk[0], az - camChunk[1])) < (60 * Math.PI) / 180;
      const frontB = Math.abs(Math.atan2(bx - camChunk[0], bz - camChunk[1])) < (60 * Math.PI) / 180;
      assert.ok(frontA || !frontB, `front-first violated at ${i}: ${sortedByDist[i - 1]} vs ${sortedByDist[i]}`);
    }
  }
});

test('RLE round trip of random data', () => {
  const size = 4;
  const height = 3;
  const data = new Uint8Array(size * height * size);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i * 7 + 13) % 256;
  }
  const encoded = encodeChunk(size, height, data);
  const decoded = decodeChunk(encoded);
  assert.equal(decoded.error, null);
  assert.deepEqual([...decoded.cells!], [...data]);
});

test('truncated chunk bytes', () => {
  assert.ok(decodeChunk(new Uint8Array([83, 77, 67, 75, 1, 2, 0, 2, 0, 1])).error);
});