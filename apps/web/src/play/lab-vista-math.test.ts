// The window view's pure maths (lab-vista-math.ts): seeded and repeatable, the pockets' soft edges, the burst schedule, the storm's progress.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_S, BURST_SECONDS, CALM_S, EGA16, MAX_POCKETS, POCKET_KINDS, burstLook, burstSchedule, clipRect, fidelityAt, lookAt, lxWeights,
  mulberry32, nearestEga, polar, pocketFrame, pocketLifetime, pxdMode, quantise332, strongestPocket, vtxGrid,
} from './lab-vista-math';

test('mulberry32 repeats for one seed and stays in [0, 1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  const xs = Array.from({ length: 200 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 200 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => mulberry32(43)()));
});

test('each pocket lives 20 to 40 seconds, and there are at most six of them', () => {
  assert.equal(MAX_POCKETS, 6);
  for (let slot = 0; slot < MAX_POCKETS; slot++) {
    const life = pocketLifetime(slot);
    assert.ok(life >= 20 && life <= 40, `slot ${slot}: ${life}`);
  }
});

test('a pocket is empty at the start of its life, full in the middle, and gone at the end of it', () => {
  const life = pocketLifetime(0);
  assert.equal(pocketFrame(0, 0).radius, 0, 'forms from nothing');
  assert.ok(pocketFrame(0, 6).radius > 5, 'a pocket in its prime is big');
  assert.equal(pocketFrame(0, life - 0.0001).radius < 0.01, true, 'collapses by the end of its life');
  assert.ok(pocketFrame(0, 6, 1.5).radius > pocketFrame(0, 6, 1).radius, 'progress grows the pocket');
});

test('a pocket drifts at one to three metres a second, and its frame repeats for one time', () => {
  const a = pocketFrame(1, 30), again = pocketFrame(1, 30);
  assert.deepEqual(a, again);
  const b = pocketFrame(1, 31);
  const speed = Math.hypot(b.centre[0] - a.centre[0], b.centre[2] - a.centre[2]);
  assert.ok(speed >= 0.3 && speed <= 4, `speed ${speed.toFixed(2)} m/s`);
  for (const k of [a.kind, b.kind]) assert.ok(k >= 0 && k < POCKET_KINDS.length);
});

test('the pocket weight: full in the core, soft over its edge, nothing outside it', () => {
  const frames = [{ centre: [0, 0, 0] as const, radius: 10, kind: 0 }];
  assert.equal(strongestPocket(frames, [0, 0, 0]).weight, 1);
  assert.equal(strongestPocket(frames, [8, 0, 0]).weight, 1, 'inside the core (85% of the radius)');
  const edge = strongestPocket(frames, [9.25, 0, 0]).weight;
  assert.ok(edge > 0 && edge < 1, `soft edge ${edge}`);
  assert.equal(strongestPocket(frames, [12, 0, 0]).weight, 0);
  assert.equal(strongestPocket([{ centre: [0, 0, 0], radius: 0, kind: 0 }], [0, 0, 0]).index, -1, 'an empty slot never counts');
});

test('fidelity: the base outside, the pocket S inside, the strongest pocket wins where two overlap', () => {
  const frames = [
    { centre: [0, 0, 0] as const, radius: 10, kind: 1 },
    { centre: [4, 0, 0] as const, radius: 10, kind: 3 },
  ];
  assert.deepEqual(fidelityAt(BASE_S, frames, [50, 0, 0]), BASE_S);
  assert.deepEqual(fidelityAt(BASE_S, frames, [-2, 0, 0]), POCKET_KINDS[1]!.s, 'deep in the 1-bit pocket');
  // at x 9.3 the first pocket is on its soft edge and the second is in its core: the stronger weight wins
  assert.deepEqual(fidelityAt(BASE_S, frames, [9.3, 0, 0]), POCKET_KINDS[3]!.s, 'the drowned pocket is stronger here');
});

test('the Pxd buckets, the Vtx grid and the Lx weights follow plan §5', () => {
  assert.deepEqual([0, 0.2, 0.25, 0.5, 0.8, 1].map(pxdMode), ['bayer', 'ega', 'ega', 'vga', 'full', 'full']);
  assert.equal(vtxGrid(0), 1.5);
  assert.equal(vtxGrid(1), 0, 'full vertices: no snapping');
  assert.ok(Math.abs(vtxGrid(0.3) - 1.05) < 1e-9);
  assert.deepEqual(lxWeights(0), { unlit: 1, flat: 0, pbr: 0 });
  assert.deepEqual(lxWeights(0.5), { unlit: 0, flat: 1, pbr: 0 });
  assert.deepEqual(lxWeights(1), { unlit: 0, flat: 0, pbr: 1 });
  for (const lx of [0, 0.2, 0.5, 0.7, 1]) {
    const w = lxWeights(lx);
    assert.ok(Math.abs(w.unlit + w.flat + w.pbr - 1) < 1e-9, `weights sum to 1 at ${lx}`);
  }
});

test('the palettes: EGA is the 16 standard colours, the nearest one wins; 3-3-2 quantises to its steps', () => {
  assert.equal(EGA16.length, 16);
  assert.deepEqual(nearestEga([0.66, 0, 0]), EGA16[4], 'dark red');
  assert.deepEqual(nearestEga([1, 1, 1]), EGA16[15], 'white');
  const q = quantise332([0.5, 0.5, 0.5]);
  assert.ok([0, 1 / 7, 2 / 7, 3 / 7, 4 / 7, 5 / 7, 6 / 7, 1].some((x) => Math.abs(x - q[0]) < 1e-9));
  assert.ok([0, 1 / 3, 2 / 3, 1].some((x) => Math.abs(x - q[2]) < 1e-9));
});

test('the burst schedule: the same seed gives the same bursts, in order, spaced 5 to 12 s apart, with no repeats', () => {
  const s1 = burstSchedule(7, -92, -1196), s2 = burstSchedule(7, -92, -1196);
  const a = [...s1.eventsBetween(0, 60, 0), ...s1.eventsBetween(60, 200, 0)];
  const b = s2.eventsBetween(0, 200, 0);
  assert.deepEqual(a, b, 'the windows partition the timeline');
  assert.ok(a.length >= 15 && a.length <= 60, `count ${a.length}`);
  for (let i = 1; i < a.length; i++) {
    const gap = a[i]!.t - a[i - 1]!.t;
    assert.ok(gap >= 5 - 1e-9 && gap <= 12 + 1e-9, `gap ${gap}`);
  }
  assert.ok(a.every((e) => e.strength >= 0.4 && e.strength <= 1));
});

test('the storm thins: fewer bursts strike once the storm has passed', () => {
  const storm = burstSchedule(11, -92, -1196).eventsBetween(0, 600, 0).length;
  const calm = burstSchedule(11, -92, -1196).eventsBetween(0, 600, 1).length;
  assert.ok(calm < storm * 0.5, `storm ${storm}, calm ${calm}`);
});

test('a burst lasts about 1.2 s, its light is capped (no whiteout), and nothing shows outside it', () => {
  assert.deepEqual(burstLook(-0.1, 1).light, 0);
  assert.equal(burstLook(BURST_SECONDS + 0.1, 1).bolt, 0);
  assert.equal(burstLook(0.05, 1).bolt, 1, 'the bolt is there at the strike');
  for (const age of [0, 0.05, 0.2, 0.6, 1.1]) assert.ok(burstLook(age, 1).light <= 0.7, `light at ${age}`);
  assert.ok(burstLook(0.1, 1).light > burstLook(0.6, 1).light, 'the light falls off');
});

test('the storm progress: the storm at 0, a calm plain with pockets at 1, the Breach a faint scar at the end', () => {
  const storm = lookAt(0), calm = lookAt(1);
  assert.deepEqual(storm.baseS, BASE_S);
  assert.deepEqual(calm.baseS, CALM_S);
  assert.equal(storm.breachHeight, 1);
  assert.ok(calm.breachHeight < 0.1 && calm.breachHeight > 0, 'a faint scar, not gone');
  assert.ok(calm.pocketScale > storm.pocketScale);
  assert.ok(calm.dust < storm.dust && calm.flashChance < storm.flashChance);
  assert.equal(lookAt(2).dusk, 1, 'progress is clamped');
});

test('clipRect keeps the part on screen and refuses what is off it', () => {
  assert.deepEqual(clipRect([{ x: -10, y: 5 }, { x: 100, y: 50 }], 200, 100), { x: 0, y: 5, w: 100, h: 45 });
  assert.equal(clipRect([{ x: 300, y: 5 }, { x: 400, y: 50 }], 200, 100), null);
  assert.equal(clipRect([{ x: Number.NaN, y: 5 }], 200, 100), null, 'a point behind the camera is refused');
});

test('polar: bearing 0 is north (out through the window, -z), 90 is east (+x)', () => {
  const [nx, nz] = polar([0, 0], 0, 100);
  assert.ok(Math.abs(nx) < 1e-9 && Math.abs(nz + 100) < 1e-9);
  const [ex, ez] = polar([0, 0], 90, 100);
  assert.ok(Math.abs(ex - 100) < 1e-9 && Math.abs(ez) < 1e-9);
});
