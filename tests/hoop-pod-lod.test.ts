/**
 * Hoop-Pod LOD + garage-bake mapping (docs/HOOP_POD.md §LOD, §Garage).
 *
 * three.js geometry builds headless in Node, so the triangle budgets are measured, not asserted
 * from the spec. Rendering itself is verified in the browser checks and by playtesting.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  HOOP_W, HOOP_X, PAINT_LAT_MAX, POD_LOD_HYSTERESIS, POD_LOD_PIXELS, bakeUvForPoint, bakeV, podGeometry,
  projectedRadiusPx, selectPodLodBand, type PodLodBand,
} from '../src/game/pod/pod-geometry';

test('LOD triangle budgets: far is very low poly, each step is cheaper', () => {
  const tris = (['hero', 'standard', 'lite', 'far'] as const).map((lod) => podGeometry(lod).triangles);
  const [hero, standard, lite, far] = tris;
  assert.ok(hero > standard && standard > lite && lite > far, `ordered: ${tris.join(' > ')}`);
  assert.ok(hero <= 3300, `hero ${hero}`);
  assert.ok(standard <= 2300, `standard ${standard}`);
  assert.ok(lite <= 1300, `lite ${lite}`);
  assert.ok(far <= 300, `far ${far} must stay very low poly`);
  // 100 distant pods cost less than four near ones.
  assert.ok(far * 100 < standard * 12);
});

test('every LOD keeps the silhouette: same ride height within 2%', () => {
  const ride = (['hero', 'standard', 'lite', 'far'] as const).map((lod) => podGeometry(lod).rideHeight);
  for (const r of ride) assert.ok(Math.abs(r - ride[0]) / ride[0] < 0.02, ride.join(', '));
});

test('screen-space LOD picks bands by projected size and never flickers on a threshold', () => {
  const [t0, t1] = POD_LOD_PIXELS;
  assert.equal(selectPodLodBand(t0 + 1, -1), 0);
  assert.equal(selectPodLodBand((t0 + t1) / 2, -1), 1);
  assert.equal(selectPodLodBand(t1 - 1, -1), 2);
  // Oscillating ±5% around a threshold keeps the current band.
  let band: PodLodBand = selectPodLodBand(t0 * 1.3, -1);
  for (let k = 0; k < 20; k++) band = selectPodLodBand(t0 * (k % 2 ? 1.05 : 0.95), band);
  assert.equal(band, 0);
  // Crossing beyond the hysteresis ratio switches.
  assert.equal(selectPodLodBand(t0 / (POD_LOD_HYSTERESIS * 1.01), 0), 1);
  assert.equal(selectPodLodBand(t1 / (POD_LOD_HYSTERESIS * 1.01), 0), 2, 'can drop two bands in one frame');
  assert.equal(selectPodLodBand(t0 * POD_LOD_HYSTERESIS * 1.01, 2), 0, 'can climb two bands in one frame');
  assert.equal(selectPodLodBand(Number.NaN, 1), 2);
});

test('projected radius shrinks with distance and grows with viewport', () => {
  const near = projectedRadiusPx(31, 400, 62, 720);
  const far = projectedRadiusPx(31, 4000, 62, 720);
  assert.ok(near > far * 9.9 && near < far * 10.1);
  assert.ok(projectedRadiusPx(31, 400, 62, 1440) > near * 1.99);
});

test('garage bake latitude tiles the paintable band across the crowns with no gaps', () => {
  const side = HOOP_X.filter((x) => x > 0);
  assert.equal(bakeV(side[0] - HOOP_W / 2, side[0]), 0.5, 'slot edge = rolling equator');
  const top = bakeV(side[2] + HOOP_W / 2, side[2]);
  assert.ok(Math.abs(top - (0.5 + PAINT_LAT_MAX / Math.PI)) < 1e-9, 'outer crown edge = cap edge');
  for (let k = 0; k < side.length - 1; k++) {
    const out = bakeV(side[k] + HOOP_W / 2, side[k]);
    const inn = bakeV(side[k + 1] - HOOP_W / 2, side[k + 1]);
    assert.ok(Math.abs(out - inn) < 1e-9, `hoop ${k} → ${k + 1} continuous`);
  }
  // Monotonic across a crown, and mirrored on the −X side.
  let prev = -1;
  for (let t = 0; t <= 1; t += 0.1) {
    const x = side[1] - HOOP_W / 2 + t * HOOP_W;
    const v = bakeV(x, side[1]);
    assert.ok(v >= prev);
    prev = v;
    assert.ok(Math.abs(bakeV(-x, -side[1]) - (1 - v)) < 1e-9);
  }
});

test('bake u matches the crown lathe (u = latheU + ¼) and the garage sphere convention', () => {
  for (const phi of [0, 0.7, 2.1, 3.9, 5.5]) {
    const r = 0.9;
    // Lathe vertex after rotateZ(−π/2): (lateral, −sinφ·r, cosφ·r)
    const { u } = bakeUvForPoint(0.64, -Math.sin(phi) * r, Math.cos(phi) * r);
    const expected = ((phi / (Math.PI * 2) + 0.25) % 1 + 1) % 1;
    assert.ok(Math.abs(u - expected) < 1e-9, `φ=${phi}`);
  }
  // Garage sphere (SphereGeometry rotateZ(−π/2)): dir = (cosθ, cosφ·sinθ, sinφ·sinθ), u = φ/2π.
  const phi = 1.3;
  const { u } = bakeUvForPoint(0.5, Math.cos(phi), Math.sin(phi));
  assert.ok(Math.abs(u - phi / (Math.PI * 2)) < 1e-9);
});

test('crown bake attribute agrees with the analytic mapping the garage click uses', () => {
  const g = podGeometry('hero').geometry;
  const part = g.getAttribute('aPart') as THREE.BufferAttribute;
  const bake = g.getAttribute('aBakeUv') as THREE.BufferAttribute;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  let checked = 0;
  for (let i = 0; i < part.count; i += 7) {
    if (part.getX(i) < 1.5) continue;
    p.fromBufferAttribute(pos, i);
    const a = { x: -p.x, y: p.y, z: -p.z }; // post-build → authored
    const { u, v } = bakeUvForPoint(a.x, a.y, a.z);
    const du = Math.abs(((bake.getX(i) - u) % 1 + 1.5) % 1 - 0.5);
    assert.ok(du < 1e-4, `u at ${i}`);
    assert.ok(Math.abs(bake.getY(i) - v) < 1e-4, `v at ${i}`);
    checked++;
  }
  assert.ok(checked > 50);
});
