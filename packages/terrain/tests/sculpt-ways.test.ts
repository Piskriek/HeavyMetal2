import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, heightAt, mirroredDab, sculptWay, SCULPT_WAYS, type SculptDab, type Terrain } from '../src/index';

const flat = (h = 1): Terrain => createTerrain({ cols: 41, rows: 41, cell: 0.5, originX: -10, originZ: -10 }, { height: h, surface: 1 });
const dab = (way: SculptDab['way'], extra: Partial<SculptDab> = {}): SculptDab => ({ way, x: 0, z: 0, radius: 4, strength: 0.6, falloff: 'smooth', seed: 5, ...extra });
const bumpy = (): Terrain => { const t = flat(); for (let i = 0; i < t.heights.length; i++) t.heights[i] = 1 + ((i * 7919) % 13) / 13; return t; };

test('every way to sculpt changes the ground under it and only there', () => {
  for (const way of SCULPT_WAYS) {
    const t = way === 'grab' || way === 'smooth' || way === 'pinch' || way === 'terrace' || way === 'erode' ? bumpy() : flat();
    if (way === 'erode') { for (let c = 0; c < 41; c++) for (let r = 0; r < 41; r++) t.heights[r * 41 + c] = c * 0.9; }
    const before = t.heights.slice();
    const base = t.heights.slice();
    const rect = sculptWay(t, dab(way, way === 'grab' ? { grab: { x: 0, z: 0, base, dx: 2, dz: 0 } } : way === 'flatten' ? { target: 3 } : {}));
    assert.ok(rect, `${way} returns the changed area`);
    let changed = 0, outside = 0;
    for (let i = 0; i < t.heights.length; i++) if (t.heights[i] !== before[i]) { changed++; const c = i % 41, r = Math.floor(i / 41); if (c < rect!.c0 || c > rect!.c1 || r < rect!.r0 || r > rect!.r1) outside++; }
    assert.ok(changed > 0, `${way} changed something`);
    assert.equal(outside, 0, `${way} changed only inside the area it reports`);
  }
});

test('Raise lifts, its other way lowers; Crease cuts and its other way builds a ridge', () => {
  const a = flat(); sculptWay(a, dab('raise')); assert.ok(heightAt(a, 0, 0) > 1);
  const b = flat(); sculptWay(b, dab('raise', { invert: true })); assert.ok(heightAt(b, 0, 0) < 1);
  const c = flat(); sculptWay(c, dab('crease')); assert.ok(heightAt(c, 0, 0) < 1 && heightAt(c, 0, 0) < heightAt(c, 2, 0));
  const d = flat(); sculptWay(d, dab('crease', { invert: true })); assert.ok(heightAt(d, 0, 0) > heightAt(d, 2, 0));
});

test('Clay builds up to a flat layer instead of a dome', () => {
  const t = flat();
  for (let k = 0; k < 40; k++) sculptWay(t, dab('clay', { falloff: 'flat', strength: 0.5 }));
  const mid = heightAt(t, 0, 0), side = heightAt(t, 2, 0);
  assert.ok(mid > 1.2, 'it rose');
  assert.ok(Math.abs(mid - side) < 0.05, `the top is flat (${mid} vs ${side})`);
});

test('Terrace snaps heights into steps', () => {
  const t = flat();
  for (let c = 0; c < 41; c++) for (let r = 0; r < 41; r++) t.heights[r * 41 + c] = c * 0.1;
  for (let k = 0; k < 30; k++) sculptWay(t, dab('terrace', { x: 0, falloff: 'flat', strength: 0.5, radius: 3 }));
  const step = 1;
  const h = heightAt(t, 0.25, 0);
  assert.ok(Math.abs(h - Math.round(h / step) * step) < 0.05, `on a step (${h})`);
});

test('Grab carries the ground under the press along with the pointer', () => {
  const t = flat();
  t.heights[20 * 41 + 20] = 3; // a spike at the origin
  const base = t.heights.slice();
  sculptWay(t, dab('grab', { falloff: 'flat', grab: { x: 0, z: 0, base, dx: 1, dz: 0 } }));
  assert.ok(heightAt(t, 1, 0) > 2, 'the spike moved 1 m along x');
  assert.ok(heightAt(t, 0, 0) < 2, 'and left its old place');
});

test('Erode lets too-steep ground slide down and keeps the amount of ground', () => {
  const t = flat(0);
  for (let c = 0; c < 41; c++) for (let r = 0; r < 41; r++) t.heights[r * 41 + c] = c * 1.2;
  const sum0 = t.heights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < 5; k++) sculptWay(t, dab('erode', { strength: 1 }));
  const sum1 = t.heights.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum0 - sum1) < 1e-3, 'ground is moved, not made or lost');
});

test('the mirrored dab lands on the other side of the line', () => {
  const m = mirroredDab(dab('raise', { x: 3, z: 1 }), 0);
  assert.equal(m.x, -3); assert.equal(m.z, 1);
  const g = mirroredDab(dab('grab', { x: 3, grab: { x: 3, z: 0, base: new Float32Array(1), dx: 1, dz: 2 } }), 0);
  assert.equal(g.grab!.x, -3); assert.equal(g.grab!.dx, -1); assert.equal(g.grab!.dz, 2);
});
