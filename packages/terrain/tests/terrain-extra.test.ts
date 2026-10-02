import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBrush, applyStroke, createTerrain, decodeTerrain, encodeTerrain, fromBase64, generateIsland, heightAt, rleDecode, rleEncode, toBase64 } from '../src/terrain';

test('base64 round-trips random bytes of every small length, and rejects garbage', () => {
  let seed = 12345;
  const rnd = (): number => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) & 255;
  for (let len = 0; len <= 40; len++) {
    const bytes = Uint8Array.from({ length: len }, rnd);
    assert.deepEqual([...fromBase64(toBase64(bytes))], [...bytes]);
  }
  assert.equal(toBase64(Uint8Array.from([77, 97, 110])), 'TWFu');
  assert.throws(() => fromBase64('@@@@'));
  assert.throws(() => fromBase64('A'));
});

test('run-length encoding splits runs longer than 255 and validates its input', () => {
  const bytes = new Uint8Array(1000).fill(7);
  const enc = rleEncode(bytes);
  assert.deepEqual([...enc], [255, 7, 255, 7, 255, 7, 235, 7]);
  assert.deepEqual([...rleDecode(enc, 1000)], [...bytes]);
  assert.throws(() => rleDecode(enc, 999));
  assert.throws(() => rleDecode(enc, 1001));
  assert.throws(() => rleDecode(Uint8Array.from([1]), 1));
  assert.throws(() => rleDecode(Uint8Array.from([0, 5]), 0));
});

test('decode rejects malformed input with a clear message', () => {
  const good = encodeTerrain(createTerrain({ cols: 4, rows: 4, cell: 1, originX: 0, originZ: 0 }));
  assert.throws(() => decodeTerrain({ ...good, v: 2 } as never), /encoded terrain/);
  assert.throws(() => decodeTerrain({ ...good, h: 'AAAA' }), /run-length/);
  assert.throws(() => decodeTerrain({ ...good, a: 42 } as never), /encoded terrain/);
  assert.throws(() => decodeTerrain(null as never), /encoded terrain/);
});

test('heights outside +-327 m are clamped by the encoding, negative heights survive', () => {
  const t = createTerrain({ cols: 2, rows: 2, cell: 1, originX: 0, originZ: 0 });
  t.heights.set([-12.34, 1000, -1000, 0.004]);
  const back = decodeTerrain(encodeTerrain(t));
  assert.ok(Math.abs(back.heights[0]! + 12.34) < 0.0051);
  assert.ok(Math.abs(back.heights[1]! - 327.67) < 0.0051);
  assert.ok(Math.abs(back.heights[2]! + 327.67) < 0.0051);
  assert.ok(Math.abs(back.heights[3]!) < 0.0051);
});

test('brushes at the grid corner clamp to the grid and report a clamped rect', () => {
  const t = createTerrain({ cols: 10, rows: 10, cell: 1, originX: 0, originZ: 0 });
  const rect = applyBrush(t, { kind: 'raise', x: 0, z: 0, radius: 3, strength: 1, falloff: 'flat' });
  assert.deepEqual(rect, { c0: 0, r0: 0, c1: 2, r1: 2 });
  const far = applyBrush(t, { kind: 'raise', x: 9, z: 9, radius: 2, strength: 1, falloff: 'flat' });
  assert.deepEqual(far, { c0: 8, r0: 8, c1: 9, r1: 9 });
  assert.equal(applyBrush(t, { kind: 'raise', x: 5, z: 5, radius: 0, strength: 1, falloff: 'flat' }), null);
});

test('stroke with zero spacing is just the two ends; a zero-length stroke is one dab', () => {
  const t = createTerrain({ cols: 21, rows: 5, cell: 1, originX: 0, originZ: 0 });
  applyStroke(t, { kind: 'raise', x: 0, z: 0, radius: 0.4, strength: 1, falloff: 'flat' }, { x: 2, z: 2 }, { x: 12, z: 2 }, 0);
  assert.equal(t.heights[2 * 21 + 2], 1); assert.equal(t.heights[2 * 21 + 12], 1); assert.equal(t.heights[2 * 21 + 7], 0);
  applyStroke(t, { kind: 'raise', x: 0, z: 0, radius: 0.4, strength: 1, falloff: 'flat' }, { x: 5, z: 2 }, { x: 5, z: 2 }, 1);
  assert.equal(t.heights[2 * 21 + 5], 1);
});

test('a stroke whose length is not a multiple of the spacing still ends on the target', () => {
  const t = createTerrain({ cols: 21, rows: 5, cell: 1, originX: 0, originZ: 0 });
  const rect = applyStroke(t, { kind: 'raise', x: 0, z: 0, radius: 0.4, strength: 1, falloff: 'flat' }, { x: 1, z: 2 }, { x: 8, z: 2 }, 3);
  assert.equal(t.heights[2 * 21 + 1], 1); assert.equal(t.heights[2 * 21 + 4], 1); assert.equal(t.heights[2 * 21 + 7], 1); assert.equal(t.heights[2 * 21 + 8], 1);
  assert.deepEqual(rect, { c0: 1, r0: 2, c1: 8, r1: 2 });
});

test('heightAt is monotonic along a ramp and exact at nodes', () => {
  const t = createTerrain({ cols: 9, rows: 9, cell: 2, originX: 0, originZ: 0 });
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) t.heights[r * 9 + c] = c * 0.5;
  let last = -Infinity;
  for (let x = 0; x <= 16; x += 0.37) { const h = heightAt(t, x, 5.3); assert.ok(h >= last - 1e-9); last = h; }
  assert.ok(Math.abs(heightAt(t, 6, 6) - 1.5) < 1e-6);
});

test('generateIsland works for other sizes and seeds (65x65, non-square 257x129) and keeps the mask valid', () => {
  const ids = { seabed: 1, sand: 2, grass: 3, rock: 4, cliff: 5 };
  for (const [cols, rows, seed] of [[65, 65, 7], [257, 129, 99], [33, 17, 1]] as const) {
    const t = generateIsland({ cols, rows, cell: 2, originX: 0, originZ: 0 }, seed, { surfaces: ids });
    assert.equal(t.heights.length, cols * rows);
    for (let i = 0; i < t.heights.length; i++) {
      assert.ok(Number.isFinite(t.heights[i]!));
      if (t.surfaceA[i] === t.surfaceB[i]) assert.equal(t.blend[i], 0);
      else assert.ok(t.blend[i]! > 0 && t.blend[i]! < 255);
      assert.ok(t.surfaceA[i]! >= 1 && t.surfaceA[i]! <= 5);
    }
  }
});

test('painting never leaves A == B with a non-zero blend, whatever the sequence', () => {
  const t = createTerrain({ cols: 3, rows: 3, cell: 1, originX: 0, originZ: 0 }, { surface: 1 });
  let seed = 7;
  const rnd = (): number => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 500; i++) {
    applyBrush(t, { kind: 'paint', x: 1, z: 1, radius: 0.4, strength: rnd(), falloff: 'flat', surface: 1 + Math.floor(rnd() * 5) });
    assert.ok(t.surfaceA[4] !== t.surfaceB[4] || t.blend[4] === 0);
  }
});

test('smooth and flatten never move nodes outside the radius, and smooth keeps a flat field flat', () => {
  const t = createTerrain({ cols: 9, rows: 9, cell: 1, originX: 0, originZ: 0 }, { height: 2 });
  applyBrush(t, { kind: 'smooth', x: 4, z: 4, radius: 3, strength: 1, falloff: 'smooth' });
  assert.ok(t.heights.every((h) => Math.abs(h - 2) < 1e-6));
  applyBrush(t, { kind: 'flatten', x: 4, z: 4, radius: 1.5, strength: 1, falloff: 'flat', target: 5 });
  assert.equal(t.heights[4 * 9 + 4], 5); assert.equal(t.heights[4 * 9 + 7], 2);
});
