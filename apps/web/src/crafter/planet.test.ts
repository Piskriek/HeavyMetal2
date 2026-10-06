// The planet round your plot against its own claims: the plains meet your plot without a step, the neighbours keep off
// it and each other, boulders keep off their plots, the rings face up, sunlight finds shadows, smooth models come out
// the size they say.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moonHeight } from './moon';
import { BOULDERS, NEIGHBOURS, PLOT_RADIUS, drop, heightGrid, makeDisc, makeRing, planetHeight, sunlight } from './planet';
import { boulderModel, halve, meshSmooth } from './smooth-models';

test('the plains meet your plot: on and round it the planet is your moon', () => {
  for (let a = 0; a < 6.28; a += 0.4) for (const r of [0, 20, PLOT_RADIUS, 75]) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    assert.equal(planetHeight(x, z), moonHeight(x, z));
  }
  for (let x = -4000; x <= 4000; x += 250) for (let z = -4000; z <= 4000; z += 250) assert.ok(Number.isFinite(planetHeight(x, z)));
});

test('neighbours keep off your plot and each other; boulders keep off their plots and the plot centre', () => {
  for (const [i, p] of NEIGHBOURS.entries()) {
    assert.ok(Math.hypot(p.x, p.z) > p.r + PLOT_RADIUS + 60, `${p.name} crowds your plot`);
    for (const q of NEIGHBOURS.slice(i + 1)) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > p.r + q.r, `${p.name} overlaps ${q.name}`);
  }
  assert.ok(BOULDERS.length > 300);
  for (const b of BOULDERS) {
    assert.ok(Math.hypot(b.x, b.z) >= 12);
    for (const p of NEIGHBOURS) assert.ok(Math.hypot(b.x - p.x, b.z - p.z) >= p.r + 40);
  }
});

test('a neighbour levels its plot: gentler ground inside than the plains round it', () => {
  const p = NEIGHBOURS.find((n) => n.name === 'Rangi')!;
  const spread = (r: number) => {
    const hs = Array.from({ length: 24 }, (_, k) => planetHeight(p.x + Math.cos(k) * r, p.z + Math.sin(k) * r));
    return Math.max(...hs) - Math.min(...hs);
  };
  assert.ok(spread(p.r * 0.6) < spread(p.r + 120), 'the plot is flatter than the plains round it');
});

test('rings and discs face up and sit where they say', () => {
  for (const ring of [makeRing(54, 4200, 32, 20), makeDisc(NEIGHBOURS[0]!)]) {
    for (let t = 0; t < ring.index.length; t += 3) {
      const [a, b, c] = [ring.index[t]!, ring.index[t + 1]!, ring.index[t + 2]!].map((v) => [ring.xz[v * 2]!, ring.xz[v * 2 + 1]!] as const);
      // y of (b - a) x (c - a), with x and z on the ground: positive means facing up
      const up = (b![1] - a![1]) * (c![0] - a![0]) - (b![0] - a![0]) * (c![1] - a![1]);
      assert.ok(up > 0, 'a triangle faces down');
    }
  }
  const disc = makeDisc(NEIGHBOURS[0]!);
  assert.ok(Math.abs(disc.xz[0]! - NEIGHBOURS[0]!.x) < 1 && Math.abs(disc.xz[1]! - NEIGHBOURS[0]!.z) < 1);
});

test('sunlight: open ground is lit, ground behind a wall is in its shadow', () => {
  const flat = heightGrid(() => 0, 200, 200);
  const wall = heightGrid((x) => (x > 20 && x < 24 ? 12 : 0), 200, 200);
  const sun: [number, number, number] = [0.94, 0.34, 0];
  assert.equal(sunlight([flat], 0, 0, 0.05, sun), 1);
  assert.ok(sunlight([wall], 0, 0, 0.05 - drop(0, 0), sun) < 0.05, 'the wall shades the point in front of it');
  assert.equal(sunlight([wall], 30, 0, 0.05, sun), 1, 'past the wall the sun is open again');
});

test('smooth models: a boulder meshes smooth, about a metre and a half across, and halving keeps it whole', () => {
  const half = halve(boulderModel(1));
  assert.ok(half.cells.some((v) => v > 0));
  const { near, far } = meshSmooth('boulder1');
  assert.ok(near.triangleCount > 800 && far.triangleCount > 100 && far.triangleCount < near.triangleCount);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < near.positions.length; i += 3) { lo = Math.min(lo, near.positions[i]!); hi = Math.max(hi, near.positions[i]!); }
  assert.ok(hi - lo > 1 && hi - lo < 2, `boulder is ${hi - lo} m across`);
});
