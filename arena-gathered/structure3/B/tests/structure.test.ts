// tests/structure.test.ts
import test from 'node:test'; import assert from 'node:assert/strict';
import { empty, found, place, check, remove, supports, rooms, setOpen, snap, encode, decode, LIMITS, toWorld, CELL, type Base, type Env, type Kind } from '../src/index';
const m = { reg: { vKeep: 0.9, hKeep: 0.6 } }, F: Env = { heightAt: () => 0, materials: m };
const P = (kind: Kind, i: number, j: number, k: number, s: number, r: 0|1|2|3 = 0) => ({ s, kind, i, j, k, r, mat: 'reg' });
const near = (a: number | undefined, b: number) => assert.ok(Math.abs((a ?? NaN) - b) < 1e-9, `${a} vs ${b}`);
const add = (b: Base, ...ps: ReturnType<typeof P>[]) => ps.reduce((x, p) => { const r = place(x, F, p); assert.ok(r.ok, `${p.kind} ${r.why}`); return r.base; }, b);

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

test('found centres cell (0,0) and sets y', () => {
  const f = found(empty(), F, 10, -4, 0, 'reg');
  assert.equal(f.ok, true);
  const s = f.base.structures[0]!;
  const w = toWorld(s, CELL / 2, CELL / 2, 0);
  near(w.x, 10); near(w.z, -4); near(s.y, 0);
  assert.equal(f.id, s.id + 1);
});

test('material + bad-slot + overlap', () => {
  const e0 = empty();
  assert.equal(found(e0, F, 0, 0, 0, 'nope').why, 'material');
  assert.equal(found(e0, F, 0, 0, 0, 'nope').base, e0);
  const f = found(e0, F, 0, 0, 0, 'reg'), s = f.base.structures[0]!.id;
  assert.equal(check(f.base, F, P('floor', 0.5, 0, 0, s)).why, 'bad-slot');
  assert.equal(check(f.base, F, P('floor', 0, 0, -1, s)).why, 'bad-slot');
  assert.equal(check(f.base, F, P('floor', 0, 0, 0, 999)).why, 'bad-slot');
  const g = found(f.base, F, 1, 1, 0, 'reg');
  assert.equal(g.why, 'overlap'); assert.equal(g.base, f.base); assert.equal(g.id, -1);
  assert.equal(found(f.base, F, 40, 40, 0, 'reg').ok, true);
});

test('terrain: steep and ground', () => {
  const hill: Env = { heightAt: (x) => (x > 0 ? 20 : 0), materials: m };
  assert.equal(found(empty(), hill, 0, 0, 0, 'reg').why, 'steep');
  const wall: Env = { heightAt: (x) => (x > 6 ? 20 : 0), materials: m };
  const f = found(empty(), wall, 0, 0, 0, 'reg'), s = f.base.structures[0]!.id;
  assert.equal(f.ok, true);
  assert.equal(check(f.base, wall, P('floor', 1, 0, 0, s)).why, 'ground');
});

test('hardpoint on a 2x2 grounded pad', () => {
  const f = found(empty(), F, 0, 0, 0, 'reg');
  const s = f.base.structures[0]!.id;
  const b = add(f.base, P('foundation', 1, 0, 0, s), P('foundation', 0, 1, 0, s), P('foundation', 1, 1, 0, s));
  const hp = place(b, F, P('hardpoint', 0, 0, 0, s));
  assert.equal(hp.ok, true);
  near(supports(hp.base, F).get(hp.id), 0.9);
  assert.equal(check(hp.base, F, P('bin', 1, 1, 0, s)).why, 'occupied');
});

test('remove of unknown id is a no-op', () => {
  const f = found(empty(), F, 0, 0, 0, 'reg');
  const r = remove(f.base, F, 12345);
  assert.equal(r.base, f.base); assert.deepEqual(r.collapsed, []);
  const r2 = remove(f.base, F, f.id);
  assert.deepEqual(r2.base.structures, []); assert.deepEqual(r2.base.pieces, []);
});

test('setOpen is a no-op when nothing changes, and is pure', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg'), s = f.base.structures[0]!.id;
  const b = add(f.base, P('foundation', 1, 0, 0, s));
  const a = place(b, F, P('airlock', 1, 0, 0, s, 1));
  assert.equal(setOpen(a.base, a.id, false), a.base);
  assert.equal(setOpen(a.base, 999, true), a.base);
  const copy = JSON.stringify(a.base);
  const o = setOpen(a.base, a.id, true);
  assert.notEqual(o, a.base);
  assert.equal(o.pieces.find((p) => p.id === a.id)!.open, true);
  assert.equal(JSON.stringify(a.base), copy);
  assert.equal(setOpen(o, a.id, true), o);
  assert.equal(setOpen(o, a.id, false).pieces.find((p) => p.id === a.id)!.open, undefined);
});

test('rooms: no roof = no room; sealed box', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg'), s = f.base.structures[0]!.id;
  assert.deepEqual(rooms(f.base), []);
  const b = add(f.base,
    P('wall', 0, 0, 0, s), P('wall', 0, 1, 0, s), P('wall', 0, 0, 0, s, 1), P('wall', 1, 0, 0, s, 1),
    P('floor', 0, 0, 1, s));
  const rs = rooms(b);
  assert.equal(rs.length, 1);
  assert.deepEqual(rs[0]!.cells, [[0, 0]]);
  assert.equal(rs[0]!.sealed, true);
  assert.deepEqual(rs[0]!.airlocks, []);
});

test('snap: pillar + hardpoint anchors, ramp rotation, occupied', () => {
  const f = found(empty(), F, 2, 2, 0, 'reg');
  const p = snap(f.base, F, 'pillar', { x: 0.2, y: 0, z: 0.2, yaw: 0 }, 'reg');
  assert.ok(p && p.mode === 'place'); assert.deepEqual([p.piece.i, p.piece.j], [0, 0]);
  const h = snap(f.base, F, 'hardpoint', { x: 4.1, y: 0, z: 4.1, yaw: 0 }, 'reg');
  assert.ok(h && h.mode === 'place'); assert.deepEqual([h.piece.i, h.piece.j], [0, 0]);
  const rp = snap(f.base, F, 'ramp', { x: 6, y: 0, z: 2, yaw: Math.PI / 2 }, 'reg');
  assert.ok(rp && rp.mode === 'place'); assert.equal(rp.piece.r, 1);
  assert.deepEqual([rp.piece.i, rp.piece.j], [1, 0]);
  const occ = snap(f.base, F, 'floor', { x: 2, y: 0, z: 2, yaw: 0 }, 'reg');
  assert.ok(occ && occ.mode === 'place'); assert.equal(occ.ok, false);
});

const FC: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.9, hKeep: 0.6 }, basalt: { vKeep: 0.9, hKeep: 0.6 } } };
function sample(n: number): Base {
  let b = found(empty(), FC, 12.3456, -7.891, 0.7, 'reg').base; const s = b.structures[0]!.id;
  for (let i = 0; b.pieces.length < n && i < 64; i++) for (let j = 0; b.pieces.length < n && j < 64; j++) {
    const kind: Kind = (i + j) % 3 ? 'foundation' : 'floor', r = place(b, FC, { s, kind, i, j, k: 0, r: 0, mat: (i + j) % 2 ? 'reg' : 'basalt' });
    if (r.ok) b = r.base;
  }
  return b;
}
const valid = (b: Base) => {
  const ids = new Set<number>(), st = new Set(b.structures.map((s) => s.id));
  for (const s of b.structures) { assert.ok(!ids.has(s.id) && s.id < b.nextId && [s.x, s.y, s.z, s.yaw].every(Number.isFinite)); ids.add(s.id); }
  for (const p of b.pieces) { assert.ok(!ids.has(p.id) && p.id < b.nextId && st.has(p.s) && Number.isInteger(p.i) && p.k >= 0); ids.add(p.id); }
};
test('codec: round trip, canonical, small, hostile-safe', () => {
  const b = sample(1000), t = encode(b), d = decode(t);
  assert.ok(d); assert.equal(encode(d), t); assert.equal(d.pieces.length, 1000); assert.ok(t.length <= 12000, `${t.length}`);
  assert.ok(Math.abs(d.structures[0]!.x - 12.3456) <= 0.005 && Math.abs(d.structures[0]!.yaw - 0.7) <= 0.0005);
  assert.deepEqual(d.pieces.map((p) => [p.id, p.kind, p.i, p.j, p.k, p.r, p.mat, p.open ?? false]), b.pieces.map((p) => [p.id, p.kind, p.i, p.j, p.k, p.r, p.mat, p.open ?? false]));
  assert.equal(decode(encode(empty()))?.pieces.length, 0);
  for (const bad of ['', '!!', t + 'A', t.slice(0, -3), 'A'.repeat(LIMITS.maxChars + 1)]) assert.equal(decode(bad), null);
  assert.throws(() => encode({ ...b, pieces: [...b.pieces, { ...b.pieces[0]!, id: b.nextId + 5 }] }));
  let seed = 7; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let n = 0; n < 3000; n++) {
    const i = Math.floor(rnd() * t.length); let d2: Base | null = null;
    assert.doesNotThrow(() => { d2 = decode(t.slice(0, i) + abc[Math.floor(rnd() * 64)] + t.slice(i + 1)); });
    if (d2) valid(d2);
  }
});

test('codec: airlock open survives, dup slots and bad fields throw', () => {
  const f = found(empty(), FC, 0, 0, 0, 'reg'), s = f.base.structures[0]!.id;
  const b1 = place(f.base, FC, P('foundation', 1, 0, 0, s));
  const a = place(b1.base, FC, { s, kind: 'airlock', i: 1, j: 0, k: 0, r: 1, mat: 'reg', open: true });
  const back = decode(encode(a.base));
  assert.ok(back);
  assert.equal(back.pieces.find((p) => p.id === a.id)!.open, true);
  assert.equal(encode(back), encode(a.base));
  const dup = { ...a.base, pieces: [...a.base.pieces, { ...a.base.pieces[0]!, id: a.base.nextId }], nextId: a.base.nextId + 1 };
  assert.throws(() => encode(dup));
  assert.throws(() => encode({ ...a.base, structures: [{ ...a.base.structures[0]!, x: 1e9 }] }));
  assert.throws(() => encode({ ...a.base, pieces: [{ ...a.base.pieces[0]!, mat: 'BAD MAT' }] }));
  assert.throws(() => encode({ ...a.base, pieces: [{ ...a.base.pieces[0]!, k: -1 }] }));
  assert.throws(() => encode({ ...a.base, v: 2 } as unknown as Base));
});

test('codec: truncation, magic and trailing bytes refused', () => {
  const t = encode(sample(20));
  assert.equal(decode(t.slice(0, 2)), null);
  assert.equal(decode('AAAAAAAA'), null);
  assert.equal(decode(t.slice(0, t.length - 4)), null);
  assert.ok(decode(t));
});

test('perf: 900 pieces x 50 supports()', () => {
  let b = empty();
  const flat: Env = { heightAt: () => 0, materials: { reg: { vKeep: 0.99, hKeep: 0.999 } } };
  const f = found(b, flat, 0, 0, 0, 'reg'); b = f.base;
  const s = f.base.structures[0]!.id;
  for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) {
    if (i === 0 && j === 0) continue;
    const r = place(b, flat, P('foundation', i, j, 0, s));
    if (r.ok) b = r.base;
  }
  assert.ok(b.pieces.length > 800);
  for (let n = 0; n < 50; n++) supports(b, flat);
});
