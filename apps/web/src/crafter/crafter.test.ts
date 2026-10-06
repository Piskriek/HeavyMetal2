// The Resolution Crafter preview's pure parts: the moon, the stage ladder, the wave, the looks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceFor, fidelityIndex, stageOf } from '@hm/fidelity';
import { VAULT_BY_ID } from '@hm/vault';
import { CRATERS, MAIN_CRATER, SPAN, facetedHeight, gridHeights, gridNormals, makeGrid, moonHeight } from './moon';
import { STAGE_STARTS, WAVE_BAND, WAVE_REACH, WAVE_SPEED, WaveQueue, stageAt, stateAt, waveFactor } from './progress';
import { bakeLook, stageMiddle, waterLevel } from './looks';

test('the moon is the same moon every time, with its craters where they should be', () => {
  assert.equal(moonHeight(12.5, -7.25), moonHeight(12.5, -7.25));
  assert.ok(CRATERS.length >= 10);
  // the main crater's floor is well below its rim, and its central peak keeps the chimney above the highest lake
  const floor = moonHeight(MAIN_CRATER.r * 0.45, 0), rim = moonHeight(MAIN_CRATER.r, 0);
  assert.ok(rim - floor > 4, `rim ${rim.toFixed(2)} floor ${floor.toFixed(2)}`);
  assert.ok(moonHeight(0, 0) > waterLevel(1) + 0.3, 'the chimney stands above the water at every stage');
  for (const c of CRATERS.slice(1)) assert.ok(moonHeight(c.x, c.z) < moonHeight(c.x + c.r, c.z), 'a crater dips');
});

test('low-poly facets are flat: a point inside a facet lies on its plane', () => {
  const cell = 8;
  for (const [x, z] of [[3.1, 2.2], [-17.5, 30.25], [40.4, -9.9]] as const) {
    const i = Math.floor(x / cell), j = Math.floor(z / cell), u = x / cell - i, v = z / cell - j;
    const h = facetedHeight(x, z, cell);
    // the same triangle's plane through its three corners
    const h00 = moonHeight(i * cell, j * cell), h10 = moonHeight((i + 1) * cell, j * cell), h01 = moonHeight(i * cell, (j + 1) * cell), h11 = moonHeight((i + 1) * cell, (j + 1) * cell);
    const expected = u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
    assert.ok(Math.abs(h - expected) < 1e-9);
  }
  // at the lattice points the facets touch the true moon
  assert.ok(Math.abs(facetedHeight(16, -24, cell) - moonHeight(16, -24)) < 1e-9);
});

test('the grid covers the patch, faces up, and lines its diagonals up with the facets', () => {
  const grid = makeGrid(2);
  assert.equal(grid.n, SPAN / 2);
  assert.equal(grid.index.length, grid.n * grid.n * 6);
  const flat = new Float32Array(grid.xz.length / 2);
  const normals = gridNormals(grid, flat);
  assert.ok(Math.abs(normals[1]! - 1) < 1e-9, 'flat ground faces straight up');
  // every triangle winds counter-clockwise seen from above (its normal points up)
  for (let t = 0; t < grid.index.length; t += 3) {
    const [a, b, c] = [grid.index[t]!, grid.index[t + 1]!, grid.index[t + 2]!];
    const ax = grid.xz[a * 2]!, az = grid.xz[a * 2 + 1]!, bx = grid.xz[b * 2]!, bz = grid.xz[b * 2 + 1]!, cx = grid.xz[c * 2]!, cz = grid.xz[c * 2 + 1]!;
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    assert.ok(ny > 0, `triangle ${t / 3} faces down`);
  }
  // facets 8 m wide on a 2 m grid: every grid point sits on the faceted surface
  const h = gridHeights(grid, 8);
  for (let k = 0; k < h.length; k += 97) assert.ok(Math.abs(h[k]! - facetedHeight(grid.xz[k * 2]!, grid.xz[k * 2 + 1]!, 8)) < 1e-5);
});

test('progress climbs the six stages in order, and each stage starts where the ladder says', () => {
  assert.equal(STAGE_STARTS.length, 6);
  for (let s = 1; s <= 6; s++) {
    assert.equal(stageAt(STAGE_STARTS[s - 1]! + 1e-6), s, `stage ${s} start`);
    if (s > 1) assert.equal(stageAt(STAGE_STARTS[s - 1]! - 1e-6), s - 1, `just before stage ${s}`);
    assert.equal(stageOf(fidelityIndex(stateAt(stageMiddle(s as 1 | 2 | 3 | 4 | 5 | 6)))), s);
  }
  let previous = -1;
  for (let p = 0; p <= 1; p += 0.01) {
    const fi = fidelityIndex(stateAt(p));
    assert.ok(fi > previous);
    previous = fi;
  }
});

test('the wave: new look behind the front, old ahead, smooth between', () => {
  assert.equal(waveFactor(0, 20), 1);
  assert.equal(waveFactor(30, 20), 0);
  const mid = waveFactor(20 - WAVE_BAND / 2, 20);
  assert.ok(mid > 0.4 && mid < 0.6);
  // C1: the slope is zero at both ends of the band
  const slope = (d: number) => (waveFactor(d + 1e-4, 20) - waveFactor(d - 1e-4, 20)) / 2e-4;
  assert.ok(Math.abs(slope(20 - WAVE_BAND + 1e-3)) < 1e-2 && Math.abs(slope(20 - 1e-3)) < 1e-2);
});

test('waves queue: one at a time, in order, and a look already on its way is not queued twice', () => {
  const q = new WaveQueue();
  q.push('a', 0);
  q.push('b', 1);
  q.push('b', 2);
  assert.equal(q.queued, 1);
  const crossing = (WAVE_REACH + WAVE_BAND) / WAVE_SPEED;
  assert.equal(q.step(1).wave?.to, 'a');
  const handover = q.step(crossing + 0.01);
  assert.equal(handover.done, 'a');
  assert.equal(handover.wave?.to, 'b');
  const end = q.step(crossing * 2 + 0.1);
  assert.equal(end.done, 'b');
  assert.equal(end.wave, null);
});

test('looks climb with the stages on every tier, and the minimum spec stays inside its caps', () => {
  const cart = VAULT_BY_ID.get('lunar_anorthosite')!;
  for (const tier of ['potato', 'low', 'ultra']) {
    const dev = deviceFor(tier);
    let previousSize = 0, previousFacet = Infinity;
    for (let s = 1; s <= 6; s++) {
      const look = bakeLook(cart, s as 1 | 2 | 3 | 4 | 5 | 6, dev, 1);
      assert.equal(look.colour.length, look.size * look.size * 4);
      assert.ok(look.size >= previousSize && look.size <= dev.maxTexel, `${tier} stage ${s}: ${look.size}`);
      assert.ok(look.facetCell <= previousFacet, `${tier}: facets must not grow`);
      previousSize = look.size; previousFacet = look.facetCell;
    }
  }
  const first = bakeLook(cart, 1, deviceFor('low'), 1), last = bakeLook(cart, 6, deviceFor('low'), 1);
  assert.ok(first.pixelated && !last.pixelated);
  assert.equal(first.water, -99, 'the first stage is dry');
  assert.ok(last.water > -MAIN_CRATER.depth, 'the last stage has lakes');
  assert.ok(first.atmosphere < 0.05 && last.atmosphere > 0.9, 'from black void to blue sky');
  assert.equal(waterLevel(0), -99);
});
