// TICKET-13 (T13a): the perimeter turret is a corner-socket piece. It sits on a wall top (the corner or joint of two walls
// one level down), on a floor or foundation corner, and nowhere else: place() refuses it when nothing under its corner
// holds it, and snap() offers only corners.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decode, empty, encode, found, place, snap, toWorld, type Base, type Env, type Piece } from '../src/index';

const E: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 } } };
type Spec = Omit<Piece, 'id' | 'mat' | 's'>;

function start(): { b: Base; s: number } {
  const b = found(empty(), E, 2, 2, 0, 'reg').base;
  return { b, s: b.structures[0]!.id };
}
function put(b: Base, s: number, p: Spec): Base {
  const r = place(b, E, { ...p, s, mat: 'reg' });
  assert.ok(r.ok, `${p.kind} at ${p.i},${p.j},${p.k} r${p.r}: ${r.why}`);
  return r.base;
}
function refused(b: Base, s: number, p: Spec): string {
  const r = place(b, E, { ...p, s, mat: 'reg' });
  assert.equal(r.ok, false, `${p.kind} at ${p.i},${p.j},${p.k} should be refused`);
  return r.why;
}

/** Four foundations, with one wall along the x edge of cell (0,0) at level 0: its top is the level-1 corner sockets. */
function walled(): { b: Base; s: number } {
  let { b, s } = start();
  for (const [i, j] of [[1, 0], [0, 1], [1, 1]] as const) b = put(b, s, { kind: 'foundation', i, j, k: 0, r: 0 });
  b = put(b, s, { kind: 'wall', i: 0, j: 0, k: 0, r: 0 });
  return { b, s };
}

test('a turret stands on a wall top, at the corner or joint of the walls, and nowhere else', () => {
  const { b, s } = walled();
  // the wall runs from corner (0,0) to corner (1,0): the turret on its joint at (1,0), one level up, is held by it
  const placed = put(b, s, { kind: 'turret', i: 1, j: 0, k: 1, r: 0 });
  assert.equal(placed.pieces.filter((p) => p.kind === 'turret').length, 1);
  // the same corner and level twice: refused
  assert.equal(refused(placed, s, { kind: 'turret', i: 1, j: 0, k: 1, r: 0 }), 'occupied');
  // a corner with nothing under it floats: refused as unsupported
  assert.equal(refused(b, s, { kind: 'turret', i: 2, j: 2, k: 1, r: 0 }), 'unsupported');
  // a level higher than any wall or floor: refused
  assert.equal(refused(b, s, { kind: 'turret', i: 0, j: 0, k: 3, r: 0 }), 'unsupported');
});

test('a turret stands on a floor corner too (a flat roof deck over the walls)', () => {
  let { b, s } = walled();
  // a floor on cell (0,0) at level 1 is held by the wall beneath its edge; the turret takes its far corner (1,1)
  b = put(b, s, { kind: 'floor', i: 0, j: 0, k: 1, r: 0 });
  const onDeck = put(b, s, { kind: 'turret', i: 1, j: 1, k: 1, r: 0 });
  assert.equal(onDeck.pieces.filter((p) => p.kind === 'turret').length, 1);
});

test('snap offers the corner socket under the aim, and refuses a corner that floats', () => {
  const { b, s } = walled();
  const st = b.structures[0]!;
  // aim at corner (4, 0) at wall-top height (level 1)
  const top = toWorld(st, 4, 0, 1);
  const hit = snap(b, E, 'turret', { x: top.x, y: top.y, z: top.z, yaw: 0 }, 'reg');
  assert.ok(hit && hit.mode === 'place', 'a turret snaps to a corner');
  if (hit && hit.mode === 'place') {
    assert.equal(hit.piece.kind, 'turret');
    assert.equal(hit.piece.i, 1);
    assert.equal(hit.piece.j, 0);
    assert.equal(hit.piece.k, 1);
    assert.equal(hit.ok, true);
  }
  // aim high over the corner (2, 2) of the foundations, with nothing under it: refused as unsupported (never a floating turret)
  const air = toWorld(st, 8, 8, 3);
  const floating = snap(b, E, 'turret', { x: air.x, y: air.y, z: air.z, yaw: 0 }, 'reg');
  assert.ok(floating && floating.mode === 'place');
  if (floating && floating.mode === 'place') assert.equal(floating.ok, false);
  // a placed turret is saved and read back
  const placed = put(b, s, { kind: 'turret', i: 1, j: 0, k: 1, r: 0 });
  const back = decode(encode(placed));
  assert.ok(back, 'the base decodes');
  assert.ok(back?.pieces.some((p) => p.kind === 'turret' && p.i === 1 && p.j === 0 && p.k === 1));
});
