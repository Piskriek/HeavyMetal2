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

test('bad manifests', () => {
  const base = JSON.parse(text) as {
    name: string;
    license: string;
    source: string;
    chunkSize: number;
    spawn: [number, number, number];
    chunks: Record<string, string>;
  };

  assert.ok(parseManifest(JSON.stringify({ ...base, name: '' })).errors.length > 0);
  assert.ok(parseManifest(JSON.stringify({ ...base, license: '' })).errors.length > 0);
  assert.ok(parseManifest(JSON.stringify({ ...base, source: '' })).errors.length > 0);
  assert.ok(parseManifest(JSON.stringify({ ...base, spawn: [0, 1] })).errors.length > 0);
  assert.ok(parseManifest(JSON.stringify({ ...base, spawn: [0, Number.POSITIVE_INFINITY, 0] })).errors.length > 0);
  assert.ok(parseManifest(JSON.stringify({ ...base, chunks: { 'x,1': 'https://example.org/a' } })).errors.length > 0);
  assert.ok(parseManifest(JSON.stringify({ ...base, chunks: { '1,2': 'ftp://example.org/a' } })).errors.length > 0);
});

test('retry then failed', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 1, maxLoaded: 10, maxInFlight: 2 });
  s.setView(0, 0, 0);

  const batch1 = s.next();
  assert.ok(batch1.includes('0,0'));
  s.done('0,0', null);
  assert.equal(s.state('0,0'), null);

  const batch2 = s.next();
  assert.ok(batch2.includes('0,0'));
  s.done('0,0', new Uint8Array([1, 2, 3]));
  assert.equal(s.state('0,0'), null);

  const batch3 = s.next();
  assert.ok(batch3.includes('0,0'));
  s.done('0,0', null);
  assert.equal(s.state('0,0'), 'failed');
  assert.ok(!s.next().includes('0,0'));
});

test('eviction keeps the radius', () => {
  const s = new ChunkStreamer(parseManifest(text).manifest!, { radius: 1, maxLoaded: 2, maxInFlight: 10 });
  s.setView(0, 0, 0);

  const all = s.next();
  for (const key of all) {
    s.done(key, encodeChunk(1, 1, new Uint8Array([1])));
  }

  s.setView(16 * 3, 16 * 3, 0);
  const evicted = s.evict();
  assert.ok(evicted.length > 0);

  for (const key of evicted) {
    const [cxs, czs] = key.split(',');
    const cx = Number(cxs);
    const cz = Number(czs);
    assert.ok(Math.abs(cx - 3) > 1 || Math.abs(cz - 3) > 1);
    assert.equal(s.state(key), null);
  }
});

test('front-first ordering', () => {
  const lineChunks: Record<string, string> = {
    '0,0': 'https://example.org/0_0',
    '1,1': 'https://example.org/1_1',
    '-1,1': 'https://example.org/m1_1',
    '1,-1': 'https://example.org/1_m1',
    '-1,-1': 'https://example.org/m1_m1',
  };
  const manifest = parseManifest(JSON.stringify({
    name: 'A',
    license: 'B',
    source: 'C',
    chunkSize: 16,
    spawn: [0, 0, 0],
    chunks: lineChunks,
  })).manifest!;

  const s = new ChunkStreamer(manifest, { radius: 2, maxLoaded: 20, maxInFlight: 5 });
  s.setView(0, 0, 0);
  const keys = s.next();

  assert.equal(keys[0], '0,0');
  const frontIndex = keys.indexOf('1,1');
  const sideIndex = keys.indexOf('1,-1');
  assert.ok(frontIndex >= 0 && sideIndex >= 0);
  assert.ok(frontIndex < sideIndex);
});

test('RLE round trip of random data', () => {
  const size = 4;
  const height = 3;
  const total = size * height * size;
  let seed = 123456789;

  const nextByte = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed >>> 24) & 3;
  };

  const cells = new Uint8Array(total);
  for (let i = 0; i < total; i++) cells[i] = nextByte();

  const encoded = encodeChunk(size, height, cells);
  const decoded = decodeChunk(encoded);
  assert.equal(decoded.error, null);
  assert.equal(decoded.size, size);
  assert.equal(decoded.height, height);
  assert.deepEqual([...decoded.cells!], [...cells]);
});

test('truncated chunk bytes', () => {
  const ok = encodeChunk(2, 2, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.ok(decodeChunk(ok.subarray(0, ok.length - 1)).error);
  assert.ok(decodeChunk(new Uint8Array([83, 77, 67, 75, 1, 2, 0, 2, 0, 9])).error);
});