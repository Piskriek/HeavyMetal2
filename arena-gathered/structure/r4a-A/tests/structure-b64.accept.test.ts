// Landing regression (2026-10-10): base64url texts whose byte length is 2 more than a multiple of 3 did not decode
// (the three-character tail was read as 16 bits, not 18). Every byte-length residue must round trip.
import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, encode, decode, type Base, type Env } from '../src/index';
const E: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 } } };

test('codec round trips bases of every size from 1 to 40 pieces', () => {
  let b: Base = found(empty(), E, 2, 2, 0, 'reg').base; const s = b.structures[0]!.id;
  const seen = new Set<number>();
  for (let n = 1; n <= 40; n++) {
    const t = encode(b), back = decode(t);
    assert.ok(back, `${b.pieces.length} pieces, ${t.length} chars`); assert.deepEqual(back, b); assert.equal(encode(back), t);
    seen.add(t.length % 4);
    const r = place(b, E, { s, kind: 'foundation', i: n % 8, j: Math.floor(n / 8), k: 0, r: 0, mat: 'reg' });
    if (r.ok) b = r.base;
  }
  assert.deepEqual([...seen].sort(), [0, 2, 3], 'all three tail lengths were exercised');
});
