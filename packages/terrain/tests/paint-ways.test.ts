import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, cropTerrain, paintWay, PAINT_WAYS, type PaintDab, type Terrain } from '../src/index';

const flat = (surface = 1): Terrain => createTerrain({ cols: 21, rows: 21, cell: 1, originX: -10, originZ: -10 }, { height: 1, surface });
const dab = (way: PaintDab['way'], extra: Partial<PaintDab> = {}): PaintDab => ({ way, x: 0, z: 0, radius: 4, strength: 1, falloff: 'flat', surface: 7, seed: 3, ...extra });
const count = (t: Terrain, s: number): number => t.surfaceA.reduce((n, a, i) => n + (a === s || (t.surfaceB[i] === s && t.blend[i]! > 0) ? 1 : 0), 0);
const at = (t: Terrain, x: number, z: number): number => t.surfaceA[(z + 10) * 21 + (x + 10)]!;

test('every way to paint changes the ground under it and says where', () => {
  for (const way of PAINT_WAYS) {
    const t = flat();
    if (way === 'smudge') { paintWay(t, dab('brush', { radius: 2 })); }
    const rect = paintWay(t, dab(way, way === 'clone' ? { from: { dx: 8, dz: 0 }, x: -4 } : way === 'eraser' ? { natural: () => 9 } : {}));
    if (way === 'clone') { assert.equal(rect !== null, true, 'clone covers its area'); continue; }
    assert.ok(rect, `${way} returns the changed area`);
    assert.ok(count(t, way === 'eraser' ? 9 : 7) > 0 || way === 'smudge', `${way} put something down`);
  }
});

test('a brush paints a disc, a stamp a shape, a pattern only every other patch', () => {
  const b = flat(); paintWay(b, dab('brush')); assert.equal(at(b, 0, 0), 7); assert.equal(at(b, 6, 0), 1);
  const sq = flat(); paintWay(sq, dab('stamp', { shape: 'square' })); assert.equal(at(sq, 2, 2), 7); assert.equal(at(sq, 3, 3), 1, 'a square stamp is smaller than the brush disc');
  const p = flat(); paintWay(p, dab('pattern', { pattern: 'checker' }));
  const painted = count(p, 7), inDisc = (() => { let n = 0; for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) if (Math.hypot(x, z) < 4) n++; return n; })();
  assert.ok(painted > inDisc * 0.3 && painted < inDisc * 0.7, `checker paints about half (${painted} of ${inDisc})`);
});

test('fill takes the whole connected patch of one surface, and stops at other surfaces', () => {
  const t = flat(1);
  for (let z = -10; z <= 10; z++) t.surfaceA[(z + 10) * 21 + 15] = 2; // a wall of surface 2 at x = 5
  paintWay(t, dab('fill', { x: -8, z: -8 }));
  assert.equal(at(t, -10, -10), 7, 'the far corner of the patch');
  assert.equal(at(t, 5, 0), 2, 'the wall stays');
  assert.equal(at(t, 8, 0), 1, 'beyond the wall stays');
  const capped = flat(1); paintWay(capped, dab('fill', { maxCells: 10 })); assert.equal(count(capped, 7), 10);
});

test('clone copies the ground from the offset; spray is the same for the same seed', () => {
  const t = flat(1); t.surfaceA[(0 + 10) * 21 + (8 + 10)] = 5;
  paintWay(t, dab('clone', { from: { dx: 8, dz: 0 }, radius: 2 }));
  assert.equal(at(t, 0, 0), 5);
  const a = flat(), b = flat();
  paintWay(a, dab('spray', { seed: 11 })); paintWay(b, dab('spray', { seed: 11 }));
  assert.deepEqual([...a.surfaceA], [...b.surfaceA]);
});

test('the eraser puts back what the world would grow; without a rule it does nothing', () => {
  const t = flat(7);
  paintWay(t, dab('eraser', { natural: (h) => (h > 0.5 ? 4 : 2) }));
  assert.equal(at(t, 0, 0), 4);
  const u = flat(7); assert.equal(paintWay(u, dab('eraser')), null);
});

test('a crop is a copy of the ground round a point, kept inside the island', () => {
  const t = flat(1); t.surfaceA[(0 + 10) * 21 + (0 + 10)] = 9;
  const c = cropTerrain(t, 0, 0, 5);
  assert.equal(c.spec.cols, 5);
  assert.equal(c.surfaceA[2 * 5 + 2], 9, 'the point is in the middle');
  const edge = cropTerrain(t, 10, 10, 5);
  assert.equal(edge.spec.originX, 6, 'pushed back inside at the edge');
  c.surfaceA[0] = 3; assert.equal(t.surfaceA[(8) * 21 + 8], 1, 'a copy, not the island');
});
