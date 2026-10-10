// Round 4c (in-house, 2026-10-10): free fixture placement (R2.5). Fixtures share a cell while their footprints fit
// inside it and stay apart; codec v3 carries the placement, and bases without one still encode as v2.
import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, rooms, encode, decode, type Base, type Env, type Piece } from '../src/index';
const E: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 } } };
type Spec = Omit<Piece, 'id' | 'mat' | 's'>;
function cell(): { b: Base; s: number } { const b = found(empty(), E, 2, 2, 0, 'reg').base; return { b, s: b.structures[0]!.id }; }
const put = (b: Base, s: number, p: Spec): Base => { const r = place(b, E, { ...p, s, mat: 'reg' }); assert.ok(r.ok, `${p.kind}: ${r.why}`); return r.base; };
const why = (b: Base, s: number, p: Spec) => place(b, E, { ...p, s, mat: 'reg' }).why;

test('fixtures share a cell while their footprints fit and stay apart', () => {
  let { b, s } = cell();
  b = put(b, s, { kind: 'bench', i: 0, j: 0, k: 0, r: 2, dx: 0, dz: -110, deg: 180 });
  b = put(b, s, { kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 0, dx: -130, dz: 100, deg: 0 });
  b = put(b, s, { kind: 'bin', i: 0, j: 0, k: 0, r: 0 });
  assert.equal(why(b, s, { kind: 'repeater', i: 0, j: 0, k: 0, r: 0 }), 'occupied', 'the centre is taken by the bin');
  assert.equal(why(b, s, { kind: 'bench', i: 0, j: 0, k: 0, r: 0, dx: 150, dz: 0, deg: 0 }), 'no-room', 'pokes out of the cell');
  const kept = b.pieces.filter((p) => p.kind !== 'foundation').map((p) => [p.kind, p.dx ?? null, p.dz ?? null, p.deg ?? null]);
  assert.deepEqual(kept, [['bench', 0, -110, 180], ['lifeSupport', -130, 100, 0], ['bin', null, null, null]]);
});

test('turned footprints: two benches side by side across the cell, a third across them does not fit', () => {
  let { b, s } = cell();
  b = put(b, s, { kind: 'bench', i: 0, j: 0, k: 0, r: 1, dx: -120, dz: 0, deg: 90 });
  b = put(b, s, { kind: 'bench', i: 0, j: 0, k: 0, r: 1, dx: 120, dz: 0, deg: 90 });
  assert.equal(why(b, s, { kind: 'bench', i: 0, j: 0, k: 0, r: 0 }), 'occupied');
  assert.equal(why(b, s, { kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 0, dx: 0, dz: 0, deg: 90 }), '', 'a small unit fits the 1.2 m gap, turned');
  assert.equal(why(b, s, { kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 0, dx: 0, dz: 0, deg: 45 }), 'occupied', 'at 45 degrees it is 1.27 m across');
});

test('placement is only for free fixtures, whole, and in range', () => {
  const { b, s } = cell();
  for (const p of [
    { kind: 'bench', i: 0, j: 0, k: 0, r: 0, dx: 151, dz: 0, deg: 0 },
    { kind: 'bench', i: 0, j: 0, k: 0, r: 0, dx: 0, dz: 0, deg: 360 },
    { kind: 'bench', i: 0, j: 0, k: 0, r: 0, dx: 0.5, dz: 0, deg: 0 },
    { kind: 'bench', i: 0, j: 0, k: 0, r: 0, dx: 10 },
    { kind: 'wall', i: 0, j: 0, k: 0, r: 0, dx: 0, dz: 0, deg: 0 },
    { kind: 'hardpoint', i: 0, j: 0, k: 0, r: 0, dx: 0, dz: 0, deg: 0 },
  ] as Spec[]) assert.equal(why(b, s, p), 'bad-slot', JSON.stringify(p));
});

test('codec v3 carries placement; a base without one stays v2; rooms list a placed unit', () => {
  let { b, s } = cell();
  for (const [i, j, r] of [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1]] as const) b = put(b, s, { kind: 'wall', i, j, k: 0, r });
  b = put(b, s, { kind: 'floor', i: 0, j: 0, k: 1, r: 0 });
  assert.ok(encode(b).startsWith('SE0C'), 'v2 without placement');
  b = put(b, s, { kind: 'bench', i: 0, j: 0, k: 0, r: 2, dx: 0, dz: -110, deg: 180 });
  b = put(b, s, { kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 0, dx: -130, dz: 100, deg: 0 });
  const t = encode(b);
  assert.ok(t.startsWith('SE0D'), 'v3 with placement');
  assert.deepEqual(decode(t), b); assert.equal(encode(decode(t)!), t);
  assert.equal(rooms(b)[0]!.lifeSupport.length, 1);
  const twice = { ...b, pieces: [...b.pieces, { ...b.pieces[b.pieces.length - 1]!, id: b.nextId }], nextId: b.nextId + 1 };
  assert.throws(() => encode(twice), 'two units on the same spot');
});
