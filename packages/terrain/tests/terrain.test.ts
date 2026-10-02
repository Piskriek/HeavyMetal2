import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, heightAt, normalAt, applyBrush, applyStroke, encodeTerrain, decodeTerrain, toHeightfield, generateIsland, cloneTerrain, normalYAtCell, type Terrain } from '../src/terrain';

const near = (a: number, b: number, eps = 1e-6): void => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const T = (cols = 9, rows = 9, cell = 1, fill?: { height?: number; surface?: number }): Terrain => createTerrain({ cols, rows, cell, originX: 0, originZ: 0 }, fill);

test('createTerrain: dimensions, fill, solid surface (A == B, blend 0)', () => {
  const t = T(5, 4, 2, { height: 3, surface: 7 });
  assert.equal(t.heights.length, 20); assert.equal(t.surfaceA.length, 20); assert.equal(t.surfaceB.length, 20); assert.equal(t.blend.length, 20);
  assert.ok(t.heights.every((h) => h === 3)); assert.ok(t.surfaceA.every((s) => s === 7) && t.surfaceB.every((s) => s === 7) && t.blend.every((b) => b === 0));
  assert.throws(() => createTerrain({ cols: 1, rows: 4, cell: 1, originX: 0, originZ: 0 }));
});

test('heightAt follows the physics triangulation (diagonal from node (c,r) to (c+1,r+1)) and clamps outside', () => {
  const t = createTerrain({ cols: 2, rows: 2, cell: 2, originX: 10, originZ: 20 });
  // nodes: a=(0,0) b=(1,0) c=(0,1) d=(1,1)
  t.heights.set([0, 1, 2, 4]);
  near(heightAt(t, 10, 20), 0); near(heightAt(t, 12, 20), 1); near(heightAt(t, 10, 22), 2); near(heightAt(t, 12, 22), 4);
  near(heightAt(t, 11, 20.5), 1.25);   // u=.5 v=.25 (u >= v): a + u*(b-a) + v*(d-b)
  near(heightAt(t, 10.5, 21), 1.5);    // u=.25 v=.5 (v > u): a + v*(c-a) + u*(d-c)
  near(heightAt(t, 0, 0), 0); near(heightAt(t, 99, 99), 4); near(heightAt(t, 99, 20), 1);
});

test('normalAt: flat is up, a plane tilts the normal, result is unit length', () => {
  const flat = T();
  near(normalAt(flat, 3.3, 4.1)[1], 1);
  const ramp = T();
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) ramp.heights[r * 9 + c] = c * 0.5;
  const n = normalAt(ramp, 4.2, 4.2);
  near(Math.hypot(...n), 1);
  near(n[0], -0.5 / Math.hypot(0.5, 1), 1e-6); near(n[1], 1 / Math.hypot(0.5, 1), 1e-6); near(n[2], 0, 1e-9);
  near(normalYAtCell(ramp, 4, 4), 1 / Math.hypot(0.5, 1), 1e-6);
});

test('raise: smooth falloff, full strength at the centre, nothing outside the radius, dirty rect returned', () => {
  const t = T(21, 21, 1);
  const dirty = applyBrush(t, { kind: 'raise', x: 10, z: 10, radius: 3, strength: 1, falloff: 'smooth' });
  near(t.heights[10 * 21 + 10]!, 1);
  assert.ok(t.heights[10 * 21 + 11]! > 0.5 && t.heights[10 * 21 + 11]! < 1);
  assert.equal(t.heights[10 * 21 + 13], 0); assert.equal(t.heights[10 * 21 + 14], 0);
  near(t.heights[10 * 21 + 11]!, t.heights[11 * 21 + 10]!); near(t.heights[10 * 21 + 9]!, t.heights[10 * 21 + 11]!);
  assert.deepEqual(dirty, { c0: 8, r0: 8, c1: 12, r1: 12 });
  assert.equal(applyBrush(t, { kind: 'raise', x: 500, z: 500, radius: 3, strength: 1, falloff: 'smooth' }), null);
});

test('falloff shapes: linear and flat', () => {
  const a = T(21, 21, 1); applyBrush(a, { kind: 'raise', x: 10, z: 10, radius: 4, strength: 2, falloff: 'linear' });
  near(a.heights[10 * 21 + 12]!, 1);   // d/r = .5 -> weight .5
  const b = T(21, 21, 1); applyBrush(b, { kind: 'raise', x: 10, z: 10, radius: 4, strength: 2, falloff: 'flat' });
  near(b.heights[10 * 21 + 13]!, 2); assert.equal(b.heights[10 * 21 + 15]!, 0);
});

test('lower, flatten (towards target by weight*strength) and smooth (towards the neighbour mean)', () => {
  const t = T(21, 21, 1, { height: 5 });
  applyBrush(t, { kind: 'lower', x: 10, z: 10, radius: 2, strength: 2, falloff: 'flat' });
  near(t.heights[10 * 21 + 10]!, 3);
  applyBrush(t, { kind: 'flatten', x: 10, z: 10, radius: 2, strength: 0.5, falloff: 'flat', target: 0 });
  near(t.heights[10 * 21 + 10]!, 1.5); near(t.heights[10 * 21 + 3]!, 5);
  const s = T(21, 21, 1); s.heights[10 * 21 + 10] = 8;
  applyBrush(s, { kind: 'smooth', x: 10, z: 10, radius: 0.4, strength: 1, falloff: 'flat' });  // only the centre node
  near(s.heights[10 * 21 + 10]!, 0);   // the mean of its 8 neighbours is 0
});

test('paint: keeps two surfaces per cell with a blend byte, rules for same / second / new surface', () => {
  const t = T(3, 3, 1, { surface: 1 });
  const dab = (surface: number, strength: number) => applyBrush(t, { kind: 'paint', x: 1, z: 1, radius: 0.4, strength, falloff: 'flat', surface });
  const at = () => [t.surfaceA[4], t.surfaceB[4], t.blend[4]];
  dab(2, 1); assert.deepEqual(at(), [2, 2, 0]);          // a full dab replaces the surface
  dab(3, 0.5); assert.deepEqual(at(), [2, 3, 128]);       // half a dab adds a second surface
  dab(3, 0.2); assert.deepEqual(at(), [2, 3, 153]);       // painting the second surface raises its share: .50196 + (1-.50196)*.2 = .6016 -> 153
  dab(2, 1); assert.deepEqual(at(), [2, 2, 0]);           // painting the first surface at full strength removes the second
  dab(4, 0.25); assert.deepEqual(at(), [2, 4, 64]);       // a new surface replaces the minor one
  dab(5, 0.5); assert.deepEqual(at(), [2, 5, 128]);
  dab(6, 0.25); assert.deepEqual(at(), [5, 6, 64]);       // when the second one dominates (>= .5) the roles swap
  assert.deepEqual([t.surfaceA[0], t.surfaceB[0], t.blend[0]], [1, 1, 0]);   // other cells untouched
});

test('applyStroke places evenly spaced dabs along the path and returns the union of the dirty rects', () => {
  const t = T(21, 5, 1);
  const dirty = applyStroke(t, { kind: 'raise', x: 0, z: 2, radius: 0.4, strength: 1, falloff: 'flat' }, { x: 2, z: 2 }, { x: 12, z: 2 }, 2);
  assert.deepEqual([...t.heights.slice(2 * 21, 3 * 21)].map((h) => h), [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(dirty, { c0: 2, r0: 2, c1: 12, r1: 2 });
});

test('encode/decode round-trips (heights to 0.01 m) and compresses flat ground; cloneTerrain is deep', () => {
  const t = T(129, 129, 2, { height: 1.5, surface: 3 });
  const flat = encodeTerrain(t);
  assert.ok(JSON.stringify(flat).length < 12000, `flat size ${JSON.stringify(flat).length}`);
  applyBrush(t, { kind: 'raise', x: 100, z: 100, radius: 20, strength: 3.3333, falloff: 'smooth' });
  applyBrush(t, { kind: 'paint', x: 60, z: 60, radius: 15, strength: 0.7, falloff: 'smooth', surface: 9 });
  const back = decodeTerrain(JSON.parse(JSON.stringify(encodeTerrain(t))));
  assert.deepEqual(back.spec, t.spec);
  for (let i = 0; i < t.heights.length; i += 37) near(back.heights[i]!, t.heights[i]!, 0.0051);
  assert.deepEqual([...back.surfaceA], [...t.surfaceA]); assert.deepEqual([...back.surfaceB], [...t.surfaceB]); assert.deepEqual([...back.blend], [...t.blend]);
  const c = cloneTerrain(t); c.heights[0] = 99; assert.notEqual(t.heights[0], 99);
  assert.throws(() => decodeTerrain({ nonsense: true } as never));
});

test('toHeightfield gives the physics collider data (row-major heights, origin position)', () => {
  const t = createTerrain({ cols: 3, rows: 2, cell: 4, originX: -4, originZ: 8 });
  t.heights.set([1, 2, 3, 4, 5, 6]);
  const hf = toHeightfield(t);
  assert.equal(hf.cols, 3); assert.equal(hf.rows, 2); assert.equal(hf.cell, 4);
  assert.deepEqual(hf.heights, [1, 2, 3, 4, 5, 6]); assert.deepEqual(hf.position, [-4, 0, 8]);
});

test('generateIsland: deterministic, an island in the sea, surfaces follow height and slope', () => {
  const ids = { seabed: 1, sand: 2, grass: 3, rock: 4, cliff: 5 };
  const spec = { cols: 129, rows: 129, cell: 2, originX: -128, originZ: -128 };
  const a = generateIsland(spec, 42, { surfaces: ids });
  const b = generateIsland(spec, 42, { surfaces: ids });
  const c = generateIsland(spec, 43, { surfaces: ids });
  assert.deepEqual([...a.heights], [...b.heights]); assert.deepEqual([...a.surfaceA], [...b.surfaceA]);
  assert.notDeepEqual([...a.heights], [...c.heights]);
  assert.ok(heightAt(a, 0, 0) > 4, `centre ${heightAt(a, 0, 0)}`);
  assert.ok(heightAt(a, -126, -126) < -1, 'corner is under water');
  const land = a.heights.filter((h) => h > 0).length / a.heights.length;
  assert.ok(land > 0.2 && land < 0.7, `land fraction ${land}`);
  let steep = 0, wetOk = true, cliffOk = true;
  for (let r = 1; r < 128; r++) for (let col = 1; col < 128; col++) {
    const i = r * 129 + col, h = a.heights[i]!, ny = normalYAtCell(a, col, r);
    if (h < -0.5 && a.surfaceA[i] !== ids.seabed) wetOk = false;
    if (h > -0.5 && ny < 0.35) { steep++; if (a.surfaceA[i] !== ids.cliff) cliffOk = false; }
  }
  assert.ok(wetOk, 'underwater cells are seabed'); assert.ok(cliffOk, 'very steep cells are cliff');
  const dry = [...a.surfaceA].filter((s, i) => a.heights[i]! > 1 && s === ids.grass).length;
  assert.ok(dry > 100, `grass cells ${dry}`);
  void steep;
});
