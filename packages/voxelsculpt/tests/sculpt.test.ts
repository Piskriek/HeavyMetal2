import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SculptSession, brushCells, raycast, raycastGround, paletteAdd, paletteRemove, paletteMove, paletteMerge, paletteUse, paletteSort,
  visibleCells, modelBounds, cellAt, type Model, type V3,
} from '../src';

const RED: V3 = [1, 0, 0], GREEN: V3 = [0, 1, 0], BLUE: V3 = [0, 0, 1];
const blank = (x: number, y = x, z = x): Model => ({ size: [x, y, z], palette: [{ color: RED }, { color: GREEN }, { color: BLUE }], cells: new Uint8Array(x * y * z) });
const at = (m: Model, x: number, y: number, z: number): number => m.cells[x + m.size[0] * (y + m.size[1] * z)]!;
const put = (m: Model, x: number, y: number, z: number, v: number): void => { m.cells[x + m.size[0] * (y + m.size[1] * z)] = v; };
const count = (m: Model): number => m.cells.reduce((s, c) => s + (c ? 1 : 0), 0);
const lcg = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
/** What each voxel renders as, so palette shuffles can be checked by appearance. */
const looks = (m: Model): string[] => Array.from(m.cells, (c) => (c ? m.palette[c - 1]!.color.join(',') : '-'));

test('raycast hits a lone voxel from all six sides with the right face', () => {
  const m = blank(7);
  put(m, 3, 3, 3, 1);
  const cases: [V3, V3, V3][] = [
    [[3.5, 3.5, -2], [0, 0, 1], [0, 0, -1]], [[3.5, 3.5, 9], [0, 0, -1], [0, 0, 1]],
    [[3.5, -2, 3.5], [0, 1, 0], [0, -1, 0]], [[3.5, 9, 3.5], [0, -1, 0], [0, 1, 0]],
    [[-2, 3.5, 3.5], [1, 0, 0], [-1, 0, 0]], [[9, 3.5, 3.5], [-1, 0, 0], [1, 0, 0]],
  ];
  for (const [o, d, n] of cases) {
    const r = raycast(m, o, d)!;
    assert.ok(r, `missed from ${o}`);
    assert.deepEqual(r.cell, [3, 3, 3]);
    assert.deepEqual(r.normal.map((v) => v + 0), n.map((v) => v + 0));
    assert.deepEqual(r.before!.map((v) => v + 0), [3 + n[0], 3 + n[1], 3 + n[2]]);
    assert.ok(r.dist > 0);
  }
});

test('raycast misses, grazes, starts inside and starts in a solid cell', () => {
  const m = blank(5);
  assert.equal(raycast(m, [2.5, 2.5, -3], [0, 0, 1]), null, 'empty grid');
  put(m, 2, 2, 2, 1);
  assert.equal(raycast(m, [2.5, 2.5, -3], [0, 1, 0]), null, 'aimed away');
  assert.equal(raycast(m, [0.5, 0.5, -3], [0, 0, 1]), null, 'passes beside it');
  const inside = raycast(m, [2.5, 2.5, 0.5], [0, 0, 1])!;
  assert.deepEqual(inside.cell, [2, 2, 2]);
  assert.deepEqual(inside.normal.map((v) => v + 0), [0, 0, -1]);
  const within = raycast(m, [2.5, 2.5, 2.5], [0, 0, 1])!;
  assert.equal(within.dist, 0);
  const diag = raycast(m, [-1, -1, -1], [1, 1, 1])!;
  assert.deepEqual(diag.cell, [2, 2, 2]);
  assert.equal(raycast(m, [2.5, 2.5, -3], [0, 0, 1], 1), null, 'max distance');
});

test('raycastGround finds the plane and ignores rays that never reach it', () => {
  assert.deepEqual(raycastGround([0, 10, 0], [0, -1, 0])!.point.map((v) => v + 0), [0, 0, 0]);
  const p = raycastGround([0, 10, 0], [1, -1, 0], 2)!.point;
  assert.ok(Math.abs(p[0] - 8) < 1e-9 && p[1] === 2);
  assert.equal(raycastGround([0, 10, 0], [0, 1, 0]), null);
  assert.equal(raycastGround([0, 10, 0], [1, 0, 0]), null);
});

test('brush shapes cover the right cells', () => {
  const cube = brushCells('cube', [5, 5, 5], 3, [0, 1, 0]);
  assert.equal(cube.length, 27);
  assert.equal(new Set(cube.map((c) => c.join())).size, 27);
  assert.equal(brushCells('cube', [5, 5, 5], 2, [0, 1, 0]).length, 8);
  const sph = brushCells('sphere', [10, 10, 10], 5, [0, 1, 0]);
  const ideal = (4 / 3) * Math.PI * 2.5 ** 3;
  assert.ok(Math.abs(sph.length - ideal) / ideal < 0.3, // lattice points inside the radius run a bit above the ideal volume
     `sphere ${sph.length} vs ${ideal}`);
  const set = new Set(sph.map((c) => c.join()));
  for (const [x, y, z] of sph) assert.ok(set.has([20 - x, y, z].join()), 'sphere is mirror symmetric');
  const disc = brushCells('disc', [5, 5, 5], 5, [0, 1, 0]);
  assert.ok(disc.length > 8 && disc.every((c) => c[1] === 5));
  assert.ok(brushCells('disc', [5, 5, 5], 5, [1, 0, 0]).every((c) => c[0] === 5));
  const line = brushCells('line', [0, 0, 0], 1, [0, 1, 0], { to: [4, 2, 0] });
  assert.deepEqual(line[0], [0, 0, 0]);
  assert.deepEqual(line[line.length - 1], [4, 2, 0]);
  assert.equal(line.length, 5);
});

test('add only fills empty cells, remove only clears solid ones, paint only recolours solid ones', () => {
  const m = blank(4);
  put(m, 1, 1, 1, 1);
  const s = new SculptSession(m);
  s.beginStroke('add'); s.dab('add', [[1, 1, 1], [2, 2, 2]], 2); s.endStroke();
  assert.equal(at(s.model(), 1, 1, 1), 1, 'add does not overwrite');
  assert.equal(at(s.model(), 2, 2, 2), 2);
  s.beginStroke('paint'); s.dab('paint', [[1, 1, 1], [3, 3, 3]], 3); s.endStroke();
  assert.equal(at(s.model(), 1, 1, 1), 3);
  assert.equal(at(s.model(), 3, 3, 3), 0, 'paint leaves empty cells empty');
  s.beginStroke('remove'); s.dab('remove', [[1, 1, 1], [0, 0, 0], [9, 9, 9], [-1, 0, 0]], 0); s.endStroke();
  assert.equal(at(s.model(), 1, 1, 1), 0);
  assert.equal(count(s.model()), 1);
});

test('smooth shaves lonely bumps and fills pits', () => {
  const m = blank(5);
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) { put(m, x, 0, z, 1); put(m, x, 1, z, 1); }
  put(m, 2, 2, 2, 1); // a lonely bump on the flat top
  const s = new SculptSession(m);
  s.beginStroke('smooth'); s.dab('smooth', [[2, 2, 2]], 1); s.endStroke();
  assert.equal(at(s.model(), 2, 2, 2), 0);
  const pit = blank(5);
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) for (let y = 0; y < 3; y++) put(pit, x, y, z, 2);
  put(pit, 2, 2, 2, 0);
  const s2 = new SculptSession(pit);
  s2.beginStroke('smooth'); s2.dab('smooth', [[2, 2, 2]], 1); s2.endStroke();
  assert.equal(at(s2.model(), 2, 2, 2), 2, 'filled with the surrounding colour');
});

test('mirror symmetry repeats a dab, the union is applied once', () => {
  const m = blank(8);
  const s = new SculptSession(m);
  s.symmetry.x = true;
  s.beginStroke('sym'); s.dab('add', [[1, 2, 3]], 1); s.endStroke();
  const r = s.model();
  assert.equal(at(r, 1, 2, 3), 1);
  assert.equal(at(r, 6, 2, 3), 1);
  assert.equal(count(r), 2);
  assert.equal(s.history()[0]!.cells, 2);
  const s2 = new SculptSession(blank(8));
  s2.symmetry.x = true; s2.symmetry.y = true; s2.symmetry.z = true;
  s2.beginStroke('sym'); s2.dab('add', [[1, 1, 1], [6, 6, 6]], 1); s2.endStroke();
  assert.equal(count(s2.model()), 8, 'overlapping mirrored dabs are not double counted');
});

test('radial symmetry gives four-fold copies around the vertical axis', () => {
  const s = new SculptSession(blank(9));
  s.symmetry.radial = 4;
  s.beginStroke('r'); s.dab('add', [[6, 3, 4]], 1); s.endStroke();
  const m = s.model();
  assert.equal(count(m), 4);
  // the four copies are rotations of each other about the grid centre: equal distance from it
  const d = new Set<number>();
  for (let x = 0; x < 9; x++) for (let z = 0; z < 9; z++) if (at(m, x, 3, z)) d.add(Math.round(Math.hypot(x + 0.5 - 4.5, z + 0.5 - 4.5) * 100) / 100);
  assert.ok(d.size <= 2, `distances ${[...d]}`);
  const none = new SculptSession(blank(9));
  none.symmetry.radial = 1;
  none.beginStroke('r'); none.dab('add', [[6, 3, 4]], 1); none.endStroke();
  assert.equal(count(none.model()), 1);
});

test('undo and redo restore the exact bytes across many random strokes', () => {
  const rnd = lcg(7);
  const s = new SculptSession(blank(10, 8, 9));
  const states: Uint8Array[] = [s.model().cells];
  const modes = ['add', 'remove', 'paint', 'smooth'] as const;
  for (let i = 0; i < 20; i++) {
    const cells: V3[] = Array.from({ length: 12 }, () => [Math.floor(rnd() * 10), Math.floor(rnd() * 8), Math.floor(rnd() * 9)] as V3);
    s.beginStroke(`s${i}`);
    s.dab(modes[i % 4]!, cells, 1 + (i % 3));
    if (s.endStroke()) states.push(s.model().cells);
  }
  assert.ok(states.length > 8);
  for (let i = states.length - 2; i >= 0; i--) { assert.ok(s.undo()); assert.deepEqual(s.model().cells, states[i]); }
  assert.equal(s.canUndo, false);
  assert.equal(s.undo(), false);
  for (let i = 1; i < states.length; i++) { assert.ok(s.redo()); assert.deepEqual(s.model().cells, states[i]); }
  assert.equal(s.canRedo, false);
});

test('a new stroke clears redo; empty strokes record nothing; strokes merge per cell', () => {
  const s = new SculptSession(blank(4));
  s.beginStroke('a'); s.dab('add', [[0, 0, 0]], 1); s.endStroke();
  s.undo();
  assert.equal(s.canRedo, true);
  s.beginStroke('b'); s.endStroke();
  s.beginStroke('c'); s.dab('add', [[1, 1, 1]], 1); s.endStroke();
  assert.equal(s.canRedo, false);
  assert.equal(s.history().length, 1);
  const t = new SculptSession(blank(4));
  t.beginStroke('twice'); t.dab('add', [[2, 2, 2]], 1); t.dab('paint', [[2, 2, 2]], 3); t.endStroke();
  assert.equal(t.history()[0]!.cells, 1);
  t.undo();
  assert.equal(at(t.model(), 2, 2, 2), 0, 'undo goes back to before the first dab');
});

test('history is capped by recorded cells, dropping the oldest', () => {
  const s = new SculptSession(blank(10), { maxHistoryCells: 30 });
  for (let i = 0; i < 6; i++) { s.beginStroke(`s${i}`); s.dab('add', Array.from({ length: 10 }, (_, k) => [k, i, 0] as V3), 1); s.endStroke(); }
  const h = s.history();
  assert.ok(h.reduce((n, x) => n + x.cells, 0) <= 30);
  assert.equal(h[h.length - 1]!.label, 's5');
  assert.ok(h.length < 6);
});

test('strokeFromSamples fills the gaps between far apart samples', () => {
  const s = new SculptSession(blank(20, 4, 4));
  s.strokeFromSamples('line', 'add', 'cube', 1, 1, [{ point: [1, 1, 1], normal: [0, 1, 0] }, { point: [15, 1, 1], normal: [0, 1, 0] }], 1);
  const m = s.model();
  for (let x = 1; x <= 15; x++) assert.equal(at(m, x, 1, 1), 1, `gap at ${x}`);
  assert.equal(count(m), 15);
  assert.equal(s.history().length, 1);
});

test('selection: box, sphere, add and subtract, invert, grow, shrink, bounds', () => {
  const s = new SculptSession(blank(6));
  s.selectBox([1, 1, 1], [3, 3, 3], 'replace');
  assert.equal(s.selection!.indices.size, 27);
  assert.deepEqual(s.selectionBounds(), { min: [1, 1, 1], max: [3, 3, 3] });
  s.selectBox([3, 3, 3], [4, 4, 4], 'add');
  assert.equal(s.selection!.indices.size, 27 + 7);
  s.selectBox([1, 1, 1], [3, 3, 3], 'subtract');
  assert.equal(s.selection!.indices.size, 7);
  s.selectBox([0, 0, 0], [5, 5, 5], 'replace');
  s.invertSelection();
  assert.equal(s.selection!.indices.size, 0);
  s.selectBox([2, 2, 2], [2, 2, 2], 'replace');
  s.growSelection();
  assert.equal(s.selection!.indices.size, 7);
  s.shrinkSelection();
  assert.equal(s.selection!.indices.size, 1);
  s.selectSphere([3, 3, 3], 1.5, 'replace');
  assert.ok(s.selection!.indices.size >= 7);
  s.selectAll();
  assert.equal(s.selection!.indices.size, 216);
  s.selectNone();
  assert.equal(s.selection, null);
  assert.equal(s.selectionBounds(), null);
});

test('selection: wand follows same-colour connected cells only', () => {
  const m = blank(6);
  put(m, 0, 0, 0, 1); put(m, 1, 0, 0, 1); put(m, 2, 0, 0, 2); put(m, 4, 0, 0, 1);
  const s = new SculptSession(m);
  s.selectWand([0, 0, 0], 'replace');
  assert.equal(s.selection!.indices.size, 2);
  s.selectWand([0, 0, 0], 'replace', { tolerance: 'any' });
  assert.equal(s.selection!.indices.size, 3);
});

test('selection restricts dabs, delete / fill / move are single undo steps', () => {
  const s = new SculptSession(blank(6));
  s.selectBox([0, 0, 0], [2, 2, 2], 'replace');
  s.beginStroke('in'); s.dab('add', [[1, 1, 1], [4, 4, 4]], 1); s.endStroke();
  assert.equal(count(s.model()), 1);
  s.fillSelection(2);
  assert.equal(at(s.model(), 1, 1, 1), 2);
  s.moveSelection(2, 0, 0);
  assert.equal(at(s.model(), 3, 1, 1), 2);
  assert.equal(at(s.model(), 1, 1, 1), 0);
  assert.deepEqual(s.selectionBounds(), { min: [2, 0, 0], max: [4, 2, 2] });
  const steps = s.history().length;
  s.deleteSelection();
  assert.equal(count(s.model()), 0);
  assert.equal(s.history().length, steps + 1);
  s.undo();
  assert.equal(at(s.model(), 3, 1, 1), 2);
  s.undo();
  assert.equal(at(s.model(), 3, 1, 1), 0);
  assert.equal(at(s.model(), 1, 1, 1), 2);
});

test('copy and paste round trip, paste can skip occupied cells', () => {
  const m = blank(8);
  put(m, 1, 1, 1, 1); put(m, 2, 1, 1, 2); put(m, 2, 2, 1, 3);
  const s = new SculptSession(m);
  s.selectBox([1, 1, 1], [2, 2, 1], 'replace');
  const clip = s.copySelection()!;
  assert.equal(clip.cells.length, 3);
  s.paste(clip, [4, 4, 4]);
  const r = s.model();
  assert.equal(at(r, 4, 4, 4), 1); assert.equal(at(r, 5, 4, 4), 2); assert.equal(at(r, 5, 5, 4), 3);
  put(m, 0, 0, 0, 0);
  const s2 = new SculptSession(blank(8));
  const w = s2.model(); put(w, 4, 4, 4, 3);
  const s3 = new SculptSession(w);
  s3.paste(clip, [4, 4, 4], { onlyEmpty: true });
  assert.equal(at(s3.model(), 4, 4, 4), 3);
  assert.equal(at(s3.model(), 5, 4, 4), 2);
  const none = new SculptSession(blank(3));
  assert.equal(none.copySelection(), null);
});

test('rotate four quarter turns and flip twice give back the original', () => {
  const m = blank(7);
  put(m, 1, 1, 1, 1); put(m, 2, 1, 1, 2); put(m, 2, 3, 2, 3); put(m, 3, 2, 4, 1);
  for (const axis of ['x', 'y', 'z'] as const) {
    const s = new SculptSession({ ...m, cells: m.cells.slice() });
    s.selectBox([0, 0, 0], [6, 6, 6], 'replace');
    const before = s.model().cells;
    s.rotateSelection(axis, 4);
    assert.deepEqual(s.model().cells, before, `rotate ${axis} x4`);
    s.rotateSelection(axis, 1);
    assert.equal(count(s.model()), 4, 'a turn keeps every voxel');
    assert.notDeepEqual(s.model().cells, before);
    s.rotateSelection(axis, 3);
    assert.deepEqual(s.model().cells, before, `rotate ${axis} 1+3`);
    s.flipSelection(axis); s.flipSelection(axis);
    assert.deepEqual(s.model().cells, before, `flip ${axis} x2`);
    s.flipSelection(axis);
    assert.equal(count(s.model()), 4);
  }
});

test('scale 2 then 0.5 restores a model made of 2x2x2 blocks', () => {
  const m = blank(8);
  for (const [x, y, z, v] of [[0, 0, 0, 1], [2, 0, 0, 2], [0, 2, 2, 3]] as const) for (let i = 0; i < 8; i++) put(m, x + (i & 1), y + ((i >> 1) & 1), z + ((i >> 2) & 1), v);
  const s = new SculptSession({ ...m, cells: m.cells.slice() });
  s.selectBox([0, 0, 0], [3, 3, 3], 'replace');
  const before = s.model().cells;
  s.scaleSelection(0.5);
  assert.equal(count(s.model()), 3);
  s.selectBox([0, 0, 0], [1, 1, 1], 'replace');
  s.scaleSelection(2);
  assert.equal(count(s.model()), 24);
  assert.deepEqual(s.model().cells, before);
});

test('resize is one undoable step and keeps cells relative to the anchor', () => {
  const m = blank(6);
  put(m, 1, 1, 1, 1); put(m, 5, 5, 5, 2);
  const s = new SculptSession(m);
  s.resize([4, 4, 4], 'min');
  assert.deepEqual(s.model().size, [4, 4, 4]);
  assert.equal(at(s.model(), 1, 1, 1), 1);
  assert.equal(count(s.model()), 1, 'the cell outside is cut');
  s.undo();
  assert.deepEqual(s.model().size, [6, 6, 6]);
  assert.equal(count(s.model()), 2);
  s.resize([10, 10, 10], 'centre');
  assert.equal(count(s.model()), 2);
  assert.equal(at(s.model(), 3, 3, 3), 1);
});

test('palette tools never change what a voxel looks like', () => {
  const base = blank(4);
  base.palette = [{ color: RED }, { color: GREEN }, { color: [0.001, 0.999, 0] }, { color: BLUE }];
  put(base, 0, 0, 0, 1); put(base, 1, 0, 0, 2); put(base, 2, 0, 0, 3); put(base, 3, 0, 0, 4); put(base, 0, 1, 0, 4);
  const look = looks(base);
  const dup = paletteAdd(base, GREEN);
  assert.equal(dup.index, 2, 'existing colour reused');
  assert.equal(dup.model.palette.length, 4);
  const added = paletteAdd(base, [0.5, 0.5, 0.5]);
  assert.equal(added.index, 5);
  const moved = paletteMove(base, 1, 4).model;
  assert.deepEqual(looks(moved), look);
  const merged = paletteMerge(base, 0.01).model;
  assert.equal(merged.palette.length, 3);
  assert.deepEqual(looks(merged).map((l) => (l === '0.001,0.999,0' ? '0,1,0' : l)), look.map((l) => (l === '0.001,0.999,0' ? '0,1,0' : l)));
  for (const by of ['hue', 'lightness', 'use'] as const) assert.deepEqual(looks(paletteSort(base, by).model), look, by);
  assert.deepEqual(paletteUse(base), [1, 1, 1, 2]);
  assert.equal(paletteSort(base, 'use').model.palette[0]!.color.join(), BLUE.join());
  const removed = paletteRemove(base, 2, 0).model;
  assert.equal(removed.palette.length, 3);
  assert.equal(at(removed, 1, 0, 0), 0);
  assert.equal(looks(removed)[2], '0.001,0.999,0');
  assert.equal(looks(removed)[3], '0,0,1');
  const replaced = paletteRemove(base, 2, 1).model;
  assert.equal(looks(replaced)[1], '1,0,0');
});

test('visibleCells slices layers, cellAt and modelBounds', () => {
  const m = blank(5);
  put(m, 1, 1, 1, 1); put(m, 3, 3, 3, 2);
  assert.deepEqual(modelBounds(m), { min: [1, 1, 1], max: [3, 3, 3] });
  assert.equal(modelBounds(blank(3)), null);
  assert.equal(cellAt(m, [3, 3, 3]), 2);
  assert.equal(cellAt(m, [9, 9, 9]), 0);
  const v = visibleCells(m, { sliceAxis: 'y', sliceMin: 0, sliceMax: 2 });
  assert.equal(at(v, 1, 1, 1), 1);
  assert.equal(at(v, 3, 3, 3), 0);
  assert.equal(at(m, 3, 3, 3), 2, 'the model itself is untouched');
  assert.equal(count(visibleCells(m, {})), 2);
});

test('the session does not change the model it was given', () => {
  const m = blank(4);
  const s = new SculptSession(m);
  s.beginStroke('x'); s.dab('add', [[1, 1, 1]], 1); s.endStroke();
  assert.equal(count(m), 0);
  const out = s.model();
  out.cells[0] = 3;
  assert.equal(at(s.model(), 0, 0, 0), 0, 'model() hands out a copy');
});
