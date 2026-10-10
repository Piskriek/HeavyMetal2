// Round 4b (written in-house, 2026-10-10): roof cells, the ridge, gables and ridge caps; plus snap for every edge kind.
import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, rooms, snap, supports, encode, decode, type Base, type Env, type Kind, type Piece } from '../src/index';
const R: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 } } };
const add = (b: Base, p: Omit<Piece, 'id' | 'mat'>): Base => { const r = place(b, R, { ...p, mat: 'reg' }); assert.ok(r.ok, `${p.kind} ${p.i},${p.j},${p.k},${p.r}: ${r.why}`); return r.base; };
const why = (b: Base, p: Omit<Piece, 'id' | 'mat'>) => place(b, R, { ...p, mat: 'reg' }).why;
/** Cell (0,0) on a foundation with walls on all four edges at level 0: a roof cell at level 1 rests on them. */
function walled(): { b: Base; s: number } {
  let b = found(empty(), R, 2, 2, 0, 'reg').base; const s = b.structures[0]!.id;
  for (const [i, j, r] of [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1]] as const) b = add(b, { s, kind: 'wall', i, j, k: 0, r });
  return { b, s };
}

test('roofs rest on walls, cap rooms, meet at the ridge; gables and caps need their roof', () => {
  let b = found(empty(), R, 0, 0, 0, 'reg').base; const s = b.structures[0]!.id;
  b = add(b, { s, kind: 'foundation', i: 0, j: 1, k: 0, r: 0 });
  for (const [i, j, r] of [[0, 0, 0], [0, 2, 0], [0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 1]] as const) b = add(b, { s, kind: 'wall', i, j, k: 0, r });
  assert.equal(why(b, { s, kind: 'roof', i: 5, j: 0, k: 1, r: 0 }), 'unsupported');
  b = add(b, { s, kind: 'roof', i: 0, j: 0, k: 1, r: 0 }); b = add(b, { s, kind: 'roof', i: 0, j: 1, k: 1, r: 2 });
  const room = rooms(b).filter((rm) => rm.k === 0); assert.equal(room.length, 1); assert.equal(room[0]!.sealed, true); assert.equal(room[0]!.cells.length, 2);
  assert.equal(rooms(b).some((rm) => rm.k === 1), false);
  assert.equal(why(b, { s, kind: 'wall', i: 0, j: 0, k: 1, r: 0 }), 'occupied', 'nothing on the eave');
  assert.equal(why(b, { s, kind: 'ridgeCap', i: 0, j: 2, k: 1, r: 0 }), 'occupied', 'the far eave');
  b = add(b, { s, kind: 'ridgeCap', i: 0, j: 1, k: 1, r: 0 });
  assert.equal(why(b, { s, kind: 'wall', i: 0, j: 1, k: 1, r: 0 }), 'occupied');
  b = add(b, { s, kind: 'gable', i: 0, j: 0, k: 1, r: 1 }); b = add(b, { s, kind: 'gable', i: 1, j: 1, k: 1, r: 1 });
  assert.equal(why(b, { s, kind: 'gable', i: 5, j: 0, k: 1, r: 0 }), 'no-roof');
  assert.equal(why(b, { s, kind: 'ridgeCap', i: 0, j: 1, k: 1, r: 1 }), 'no-roof', 'a side is not a ridge');
  assert.equal(why(b, { s, kind: 'bin', i: 0, j: 0, k: 1, r: 0 }), 'needs-floor', 'nothing stands on a roof');
  const back = decode(encode(b)); assert.ok(back); assert.deepEqual(back, b);
});

test('back to back roofs hold each other up at the ridge (vertically), so one side needs no walls', () => {
  let c = found(empty(), R, 2, 2, 0, 'reg').base; const t = c.structures[0]!.id;
  c = add(c, { s: t, kind: 'foundation', i: 0, j: 1, k: 0, r: 0 });
  for (const [i, j, r] of [[0, 0, 0], [0, 0, 1], [1, 0, 1]] as const) c = add(c, { s: t, kind: 'wall', i, j, k: 0, r });
  c = add(c, { s: t, kind: 'roof', i: 0, j: 0, k: 1, r: 0 }); c = add(c, { s: t, kind: 'roof', i: 0, j: 1, k: 1, r: 2 });
  const sup = supports(c, R), [a, d] = c.pieces.filter((p) => p.kind === 'roof');
  assert.ok(Math.abs(sup.get(a!.id)! - 0.81) < 1e-9, `${sup.get(a!.id)}`); assert.ok(Math.abs(sup.get(d!.id)! - 0.729) < 1e-9, `${sup.get(d!.id)}`);
  // two roofs side by side that do not share a ridge only hold each other horizontally
  let e = found(empty(), R, 2, 2, 0, 'reg').base; const u = e.structures[0]!.id;
  e = add(e, { s: u, kind: 'foundation', i: 0, j: 1, k: 0, r: 0 });
  for (const [i, j, r] of [[0, 0, 0], [0, 0, 1], [1, 0, 1]] as const) e = add(e, { s: u, kind: 'wall', i, j, k: 0, r });
  e = add(e, { s: u, kind: 'roof', i: 0, j: 0, k: 1, r: 0 });
  e = add(e, { s: u, kind: 'roof', i: 0, j: 1, k: 1, r: 1 });
  const side = e.pieces.filter((p) => p.kind === 'roof')[1]!;
  assert.ok(Math.abs(supports(e, R).get(side.id)! - 0.81 * 0.6) < 1e-9);
});

test('r turns a roof a quarter at a time; corners keep their eaves', () => {
  // [kind, r, the level-1 edges that must be refused as eaves]
  const cases: [Kind, 0 | 1 | 2 | 3, [number, number, 0 | 1][]][] = [
    ['roof', 0, [[0, 0, 0]]], ['roof', 1, [[1, 0, 1]]], ['roof', 2, [[0, 1, 0]]], ['roof', 3, [[0, 0, 1]]],
    ['lowRoof', 1, [[1, 0, 1]]], ['roofOuter', 0, [[0, 0, 0], [0, 0, 1]]], ['roofOuter', 2, [[0, 1, 0], [1, 0, 1]]], ['roofInner', 0, []],
  ];
  for (const [kind, r, eaves] of cases) {
    const w = walled(); const b = add(w.b, { s: w.s, kind, i: 0, j: 0, k: 1, r });
    for (const [i, j, er] of [[0, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1]] as const) {
      const eave = eaves.some(([a, c, d]) => a === i && c === j && d === er);
      const verdict = why(b, { s: w.s, kind: 'halfWall', i, j, k: 1, r: er });
      assert.equal(verdict === 'occupied', eave, `${kind} r${r} edge ${i},${j},${er}: ${verdict}`);
    }
  }
  // and a roof cannot go where its eave is already taken
  const w = walled(); const b = add(w.b, { s: w.s, kind: 'halfWall', i: 0, j: 0, k: 1, r: 0 });
  assert.equal(why(b, { s: w.s, kind: 'roof', i: 0, j: 0, k: 1, r: 0 }), 'occupied');
  assert.equal(add(b, { s: w.s, kind: 'roof', i: 0, j: 0, k: 1, r: 2 }).pieces.length, b.pieces.length + 1, 'its high side may meet a wall');
});

test('every edge kind snaps to an edge, in both directions; roofs snap with the aim', () => {
  const b = found(empty(), R, 2, 2, 0, 'reg').base;
  for (const kind of ['wall', 'halfWall', 'windowWall', 'doorframe', 'door', 'railing', 'ladder'] as const) {
    const along = snap(b, R, kind, { x: 2, y: 0, z: 0.3, yaw: 0 }, 'reg'), across = snap(b, R, kind, { x: 0.3, y: 0, z: 2, yaw: 0 }, 'reg');
    assert.ok(along?.mode === 'place' && across?.mode === 'place', kind);
    if (along?.mode === 'place' && across?.mode === 'place') {
      assert.deepEqual([along.piece.i, along.piece.j, along.piece.r], [0, 0, 0], kind); assert.deepEqual([across.piece.i, across.piece.j, across.piece.r], [0, 0, 1], kind);
    }
  }
  const turnedTo = (yaw: number) => { const s = snap(b, R, 'roof', { x: 2, y: 3, z: 2, yaw }, 'reg'); return s?.mode === 'place' ? s.piece.r : -1; };
  assert.equal(new Set([0, Math.PI / 2, Math.PI, -Math.PI / 2].map(turnedTo)).size, 4, 'four aims, four turns');
});

test('roofOf finds the roof a gable or ridge cap belongs to', async () => {
  const { roofOf } = await import('../src/index');
  const w = walled(); let b = add(w.b, { s: w.s, kind: 'roof', i: 0, j: 0, k: 1, r: 0 });
  b = add(b, { s: w.s, kind: 'gable', i: 0, j: 0, k: 1, r: 1 }); b = add(b, { s: w.s, kind: 'ridgeCap', i: 0, j: 1, k: 1, r: 0 });
  const roof = b.pieces.find((p) => p.kind === 'roof')!;
  for (const kind of ['gable', 'ridgeCap'] as const) assert.equal(roofOf(b, b.pieces.find((p) => p.kind === kind)!)?.id, roof.id, kind);
  assert.equal(roofOf(b, roof), null);
});
