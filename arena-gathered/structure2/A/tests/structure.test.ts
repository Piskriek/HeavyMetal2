import test from 'node:test'; import assert from 'node:assert/strict';
import {
  empty,
  found,
  place,
  check,
  remove,
  supports,
  rooms,
  setOpen,
  snap,
  toWorld,
  CELL,
  LEVEL,
  type Base,
  type Env,
  type Kind,
} from '../src/index';
const m = { reg: { vKeep: 0.9, hKeep: 0.6 } }, F: Env = { heightAt: () => 0, materials: m };
const P = (kind: Kind, i: number, j: number, k: number, s: number, r: 0|1|2|3 = 0) => ({ s, kind, i, j, k, r, mat: 'reg' });
const near = (a: number | undefined, b: number) => assert.ok(Math.abs((a ?? NaN) - b) < 1e-9, `${a} vs ${b}`);
test('support, slots, collapse', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg'), s = f.base.structures[0]!.id;
  const a = place(f.base, F, P('floor', 1, 0, 0, s)), c = place(a.base, F, P('floor', 2, 0, 0, s)), d = place(c.base, F, P('bench', 2, 0, 0, s));
  const w = place(d.base, F, P('wall', 0, 0, 0, s)), p = place(w.base, F, P('pillar', 1, 1, 0, s)), u = place(p.base, F, P('floor', 0, 0, 1, s));
  const e = place(u.base, F, P('floor', 3, 0, 0, s)), sup = supports(e.base, F);
  [[f.id, 1], [a.id, 0.6], [c.id, 0.36], [d.id, 0.324], [w.id, 0.9], [p.id, 0.9], [u.id, 0.81], [e.id, 0.216]].forEach(([id, v]) => near(sup.get(id!), v!));
  const x = check(e.base, F, P('floor', 4, 0, 0, s)); assert.equal(x.why, 'unsupported'); near(x.support, 0.1296);
  assert.equal(place(e.base, F, P('floor', 4, 0, 0, s)).base, e.base);
  const why = (q: ReturnType<typeof P>) => check(e.base, F, q).why;
  assert.deepEqual([P('wall', 0, 0, 0, s), P('wall', 5, 0, 0, s, 2), P('bin', 0, 1, 0, s), P('hardpoint', 0, 0, 0, s)].map(why), ['occupied', 'bad-slot', 'needs-floor', 'needs-pad']);
  const copy = JSON.stringify(e.base), r = remove(e.base, F, a.id);
  assert.deepEqual(r.collapsed, [c.id, d.id, e.id]); assert.equal(JSON.stringify(e.base), copy);
});

test('world transform, allocation, and rejected calls are immutable', () => {
  const initial = empty();
  const result = found(initial, F, 10, -3, Math.PI / 2, 'reg');
  assert.equal(result.ok, true);
  const structure = result.base.structures[0]!;
  const origin = toWorld(structure, 0, 0, 0);
  near(origin.x, 12);
  near(origin.z, -5);
  near(toWorld(structure, CELL, 0, 2).y, structure.y + 2 * LEVEL);
  assert.equal(result.id, result.base.pieces[0]!.id);
  assert.equal(initial.structures.length, 0);
  assert.equal(initial.pieces.length, 0);
  const refused = found(result.base, F, 10, -3, Math.PI / 2, 'missing');
  assert.equal(refused.ok, false);
  assert.equal(refused.why, 'material');
  assert.equal(refused.base, result.base);
  assert.equal(refused.id, -1);
});

test('terrain, slope, and rotated footprint overlap checks', () => {
  const rough: Env = {
    heightAt: (x) => (x < 0.001 ? 3.1 : 0),
    materials: m,
  };
  const steep = found(empty(), rough, 2, 2, 0, 'reg');
  assert.equal(steep.why, 'steep');
  assert.equal(steep.base.pieces.length, 0);

  const first = found(empty(), F, 2, 2, 0, 'reg');
  const highGround: Env = { heightAt: () => 5, materials: m };
  const s = first.base.structures[0]!.id;
  assert.equal(check(first.base, highGround, P('floor', 1, 0, 0, s)).why, 'ground');
  assert.equal(found(first.base, F, 2, 2, 0, 'reg').why, 'overlap');
  assert.equal(found(first.base, F, 5.94, 2, 0, 'reg').why, 'overlap');
  assert.equal(found(first.base, F, 5.96, 2, 0, 'reg').ok, true);
});

test('slot validation and hardpoint pad reservations', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg');
  const s = f.base.structures[0]!.id;
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), i: 0.5 }).why, 'bad-slot');
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), k: -1 }).why, 'bad-slot');
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), s: 999 }).why, 'bad-slot');
  assert.equal(check(f.base, F, { ...P('floor', 1, 0, 0, s), mat: 'unknown' }).why, 'material');
  assert.equal(check(f.base, F, P('airlock', 0, 0, 0, s)).ok, true);
  const airlock = place(f.base, F, P('airlock', 0, 0, 0, s));
  assert.equal(check(airlock.base, F, P('wall', 0, 0, 0, s)).why, 'occupied');

  let base = f.base;
  for (const [i, j] of [[1, 0], [0, 1], [1, 1]]) {
    base = place(base, F, P('foundation', i!, j!, 0, s)).base;
  }
  const hardpoint = place(base, F, P('hardpoint', 0, 0, 0, s));
  assert.equal(hardpoint.ok, true);
  assert.equal(check(hardpoint.base, F, P('bench', 1, 1, 0, s)).why, 'occupied');
});

test('vertical foundation support and empty structure cleanup', () => {
  const slope: Env = { heightAt: (x) => (x < 0.001 ? 1 : 0), materials: m };
  const f = found(empty(), slope, 2, 2, 0, 'reg');
  const s = f.base.structures[0]!.id;
  const upper = place(f.base, slope, P('foundation', 0, 0, 1, s));
  assert.equal(upper.ok, true);
  near(supports(upper.base, slope).get(upper.id), 0.9);
  const removed = remove(upper.base, slope, f.id);
  assert.deepEqual(removed.collapsed, [upper.id]);
  assert.equal(removed.base.structures.length, 0);
  assert.equal(remove(upper.base, F, 999).base, upper.base);
});

const add = (b: Base, ...ps: ReturnType<typeof P>[]) => ps.reduce((x, p) => { const r = place(x, F, p); assert.ok(r.ok, `${p.kind} ${r.why}`); return r.base; }, b);
test('rooms, airlocks, snap, overlap', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg'), s = f.base.structures[0]!.id;
  let b = add(f.base, P('foundation', 1, 0, 0, s), P('wall', 0, 0, 0, s), P('wall', 1, 0, 0, s), P('wall', 0, 1, 0, s), P('wall', 1, 1, 0, s), P('wall', 0, 0, 0, s, 1));
  const lock = place(b, F, P('airlock', 2, 0, 0, s, 1)); b = add(lock.base, P('floor', 0, 0, 1, s), P('floor', 1, 0, 1, s));
  assert.deepEqual(rooms(b), [{ s, k: 0, cells: [[0, 0], [1, 0]], sealed: true, airlocks: [lock.id] }]);
  const open = setOpen(b, lock.id, true); assert.equal(rooms(open)[0]!.sealed, false); assert.equal(setOpen(b, f.id, true), b);
  assert.equal(rooms(remove(b, F, b.pieces.find((p) => p.kind === 'wall')!.id).base)[0]!.sealed, false);
  const w = snap(f.base, F, 'wall', { x: 2.2, y: 0, z: 3.9, yaw: 0 }, 'reg');
  assert.ok(w && w.mode === 'place' && w.ok); assert.deepEqual([w.piece.i, w.piece.j, w.piece.k, w.piece.r], [0, 1, 0, 0]);
  const fd = snap(f.base, F, 'foundation', { x: 6, y: 0, z: 2, yaw: 0 }, 'reg');
  assert.ok(fd && fd.mode === 'place' && fd.ok); assert.deepEqual([fd.piece.i, fd.piece.j], [1, 0]);
  const far = snap(f.base, F, 'foundation', { x: 50, y: 0, z: 50, yaw: 1 }, 'reg');
  assert.deepEqual(far, { mode: 'found', cx: 50, cz: 50, yaw: 1, ok: true, why: '' });
  assert.equal(snap(f.base, F, 'bin', { x: 20, y: 0, z: 20, yaw: 0 }, 'reg'), null);
  const up = snap(f.base, F, 'floor', { x: 2, y: 3, z: 2, yaw: 0 }, 'reg');
  assert.ok(up && up.mode === 'place' && !up.ok); assert.equal(up.why, 'unsupported'); assert.deepEqual([up.piece.i, up.piece.j, up.piece.k], [0, 0, 1]);
  const two = found(add(f.base, P('foundation', 1, 0, 0, s)), F, 10.5, 2, 0, 'reg'); assert.ok(two.ok, two.why);
  assert.equal(check(two.base, F, P('foundation', 2, 0, 0, s)).why, 'overlap');
});

test('airlock state transitions and rotated snap orientation', () => {
  const f = found(empty(), F, 2, 2, Math.PI / 2, 'reg');
  const s = f.base.structures[0]!.id;
  const door = place(f.base, F, P('airlock', 0, 0, 0, s, 1));
  assert.equal(door.ok, true);
  assert.equal(setOpen(door.base, door.id, false), door.base);
  const opened = setOpen(door.base, door.id, true);
  assert.notEqual(opened, door.base);
  assert.equal(door.base.pieces.find((piece) => piece.id === door.id)!.open, undefined);
  assert.equal(opened.pieces.find((piece) => piece.id === door.id)!.open, true);
  const closed = setOpen(opened, door.id, false);
  assert.equal(closed.pieces.find((piece) => piece.id === door.id)!.open, undefined);
  assert.equal(setOpen(closed, door.id, false), closed);

  const ramp = snap(
    f.base,
    F,
    'ramp',
    { x: 2, y: 0, z: 2, yaw: Math.PI },
    'reg',
  );
  assert.ok(ramp && ramp.mode === 'place');
  assert.equal(ramp.piece.r, 1);
  assert.equal(ramp.ok, false);
  assert.equal(ramp.why, 'occupied');
});
