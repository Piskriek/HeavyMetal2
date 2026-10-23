// Hidden landing suite for structure round 4a (not sent to Arena). Run beside the package's own tests.
import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, rooms, setOpen, encode, decode, type Base, type Env, type Kind, type Piece } from '../src/index';
const E: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 } } };
const put = (b: Base, p: Omit<Piece, 'id' | 'mat'>): Base => { const r = place(b, E, { ...p, mat: 'reg' }); assert.ok(r.ok, `${p.kind}: ${r.why}`); return r.base; };
/** One cell room at (i, 0): foundation, four edges (z = 0, z = 1, x = i, x = i + 1) and a floor above. */
function cell(edges: [Kind, Kind, Kind, Kind], i = 0): { b: Base; s: number } {
  let b = found(empty(), E, 0, 0, 0, 'reg').base; const s = b.structures[0]!.id;
  if (i !== 0) b = put(b, { s, kind: 'foundation', i, j: 0, k: 0, r: 0 });
  b = put(b, { s, kind: edges[0], i, j: 0, k: 0, r: 0 }); b = put(b, { s, kind: edges[1], i, j: 1, k: 0, r: 0 });
  b = put(b, { s, kind: edges[2], i, j: 0, k: 0, r: 1 }); b = put(b, { s, kind: edges[3], i: i + 1, j: 0, k: 0, r: 1 });
  b = put(b, { s, kind: 'floor', i, j: 0, k: 1, r: 0 });
  return { b, s };
}
const sealedAt = (b: Base, k = 0) => rooms(b).filter((rm) => rm.k === k).map((rm) => rm.sealed);

test('only walls, window walls and shut doors/airlocks seal', () => {
  assert.deepEqual(sealedAt(cell(['wall', 'windowWall', 'wall', 'windowWall']).b), [true]);
  for (const open of ['halfWall', 'doorframe', 'railing', 'ladder'] as const) assert.deepEqual(sealedAt(cell(['wall', 'wall', 'wall', open]).b), [false], open);
  const { b } = cell(['door', 'airlock', 'wall', 'wall']);
  assert.deepEqual(sealedAt(b), [true]);
  const door = b.pieces.find((p) => p.kind === 'door')!, lock = b.pieces.find((p) => p.kind === 'airlock')!;
  assert.deepEqual(sealedAt(setOpen(b, door.id, true)), [false]); assert.deepEqual(sealedAt(setOpen(b, lock.id, true)), [false]);
  assert.deepEqual(rooms(b)[0]!.doors, [door.id]); assert.deepEqual(rooms(b)[0]!.airlocks, [lock.id]);
  const win = b.pieces.find((p) => p.kind === 'wall')!; assert.equal(setOpen(b, win.id, true), b);
});

test('half walls, railings and ladders carry nothing; every full-height edge carries', () => {
  for (const kind of ['wall', 'airlock', 'windowWall', 'doorframe', 'door', 'halfWall', 'railing', 'ladder'] as const) {
    let b = found(empty(), E, 0, 0, 0, 'reg').base; const s = b.structures[0]!.id;
    b = put(b, { s, kind, i: 0, j: 0, k: 0, r: 0 });
    const carries = !['halfWall', 'railing', 'ladder'].includes(kind);
    const floor = place(b, E, { s, kind: 'floor', i: 0, j: -1, k: 1, r: 0, mat: 'reg' });
    const above = place(b, E, { s, kind: 'wall', i: 0, j: 0, k: 1, r: 0, mat: 'reg' });
    assert.equal(floor.ok, carries, `${kind} floor`); assert.equal(above.ok, carries, `${kind} wall above`);
    if (!carries) { assert.equal(floor.why, 'unsupported'); assert.equal(above.why, 'unsupported'); }
  }
});

test('life support is listed in its room in id order; stairs take the ramp slot', () => {
  let { b, s } = cell(['wall', 'wall', 'wall', 'wall']);
  b = put(b, { s, kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 1 });
  assert.equal(place(b, E, { s, kind: 'bin', i: 0, j: 0, k: 0, r: 0, mat: 'reg' }).ok, false, 'one fixture per cell');
  assert.deepEqual(rooms(b)[0]!.lifeSupport, [b.pieces.find((p) => p.kind === 'lifeSupport')!.id]);
  b = put(b, { s, kind: 'stairs', i: 0, j: -1, k: 0, r: 2 });
  assert.equal(place(b, E, { s, kind: 'ramp', i: 0, j: -1, k: 0, r: 2, mat: 'reg' }).ok, false, 'stairs hold the ramp slot');
});

test('codec v2 round trip with every new kind; v1 texts still decode; hostile open flags refused', () => {
  let { b, s } = cell(['door', 'windowWall', 'doorframe', 'halfWall']);
  b = put(b, { s, kind: 'lifeSupport', i: 0, j: 0, k: 0, r: 3 }); b = put(b, { s, kind: 'stairs', i: 0, j: -1, k: 0, r: 1 });
  b = put(b, { s, kind: 'railing', i: 0, j: 0, k: 1, r: 0 }); b = put(b, { s, kind: 'ladder', i: 0, j: 1, k: 1, r: 0 });
  b = setOpen(b, b.pieces.find((p) => p.kind === 'door')!.id, true);
  const t = encode(b); assert.deepEqual(decode(t), b); assert.equal(encode(decode(t)!), t);
  const v1 = decode('SE0BBwEC6AIAn0rwLgEDcmVnBQQAAAAAAAACAAMAAAAAAgBUAAAAAAIAJwAAAAACAAACAAAA');
  assert.ok(v1); assert.equal(v1.pieces.length, 5); assert.equal(v1.pieces[2]!.open, true);
  const bad = { ...b, pieces: b.pieces.map((p) => (p.kind === 'windowWall' ? { ...p, open: true } : p)) };
  assert.throws(() => encode(bad));
  for (let cut = 1; cut < t.length; cut += 3) assert.equal(decode(t.slice(0, cut)), null);
});
