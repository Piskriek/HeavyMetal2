// The window view's pure maths (lab-vista-math.ts): seeded and repeatable, the pockets' limits from the spawn, the soft edges and the
// ground disc, the burst schedule, the storm's progress.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_S, BREACH_BEARING, BREACH_XZ, BURST_SECONDS, CALM_S, CORRIDOR_DEG, EGA16, GLASS, MAX_POCKETS, MULLIONS_X, POCKET_KINDS, POCKET_MAX_RATIO,
  POCKET_SECTORS, SPAWN_EYE_Y, SPAWN_XZ, WINDOW_DIST, angularRadius, bayOfBearing, bearingFromSpawn, burstLook, burstSchedule, clipRect,
  cloudLitAt, elevationFromSpawn, fidelityAt, groundFade, inCorridor, lookAt, lxWeights, mulberry32, nearestEga, polar, pocketFrame,
  pocketLifetime, pxdMode, quantise332, strongestPocket, vtxGrid,
} from './lab-vista-math';

/** Samples of time over ten minutes: the layout's limits must hold at every one of them. */
const TIMES = Array.from({ length: 360 }, (_, i) => i * 1.7);

test('mulberry32 repeats for one seed and stays in [0, 1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  const xs = Array.from({ length: 200 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 200 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => mulberry32(43)()));
});

test('each pocket lives 20 to 40 seconds (slot 0 never collapses: the crate lane flies through it), and there are at most six of them', () => {
  assert.equal(MAX_POCKETS, 6);
  assert.equal(POCKET_SECTORS.length, MAX_POCKETS);
  assert.equal(pocketLifetime(0) > 1e8, true);
  for (let slot = 1; slot < MAX_POCKETS; slot++) {
    const life = pocketLifetime(slot);
    assert.ok(life >= 20 && life <= 40, `slot ${slot}: ${life}`);
  }
});

test('a pocket is empty at the start of its life, full in the middle, and gone at the end of it', () => {
  const life = pocketLifetime(1);
  assert.equal(pocketFrame(1, 0).radius, 0, 'forms from nothing');
  assert.ok(pocketFrame(1, 6).radius > 1.5, 'a pocket in its prime has a visible radius');
  assert.equal(pocketFrame(1, life - 0.0001).radius < 0.01, true, 'collapses by the end of its life');
  assert.ok(pocketFrame(0, 6, 1.2).radius > pocketFrame(0, 6, 0.85).radius, 'progress grows the pocket');
});

test('from the spawn eye each pocket subtends at most 6 degrees (radius <= 0.07 x distance), at every time and progress', () => {
  for (const scale of [0.85, 1.2]) {
    for (let slot = 0; slot < MAX_POCKETS; slot++) {
      for (const t of TIMES) {
        const f = pocketFrame(slot, t, scale);
        const dist = Math.hypot(f.centre[0] - SPAWN_XZ[0], f.centre[2] - SPAWN_XZ[1]);
        assert.ok(f.radius <= POCKET_MAX_RATIO * dist + 1e-9, `slot ${slot} at ${t}: radius ${f.radius} at ${dist} m`);
        assert.ok(angularRadius(f.radius, dist) <= 6, 'under the 6 degree cap');
      }
    }
  }
});

test('the pockets float: the centre is above the ground by more than the radius, at every time', () => {
  for (let slot = 0; slot < MAX_POCKETS; slot++) {
    for (const t of TIMES) {
      const f = pocketFrame(slot, t, 1.2);
      assert.ok(f.centre[1] >= f.radius, `slot ${slot} at ${t}: height ${f.centre[1]} radius ${f.radius}`);
    }
  }
});

test('every pocket sits inside the glass from the spawn: its whole disc is within the window, at every time', () => {
  const leftB = bearingFromSpawn(GLASS.x0, SPAWN_XZ[1] - WINDOW_DIST), rightB = bearingFromSpawn(GLASS.x1, SPAWN_XZ[1] - WINDOW_DIST);
  const lowE = elevationFromSpawn(GLASS.y0, WINDOW_DIST), highE = elevationFromSpawn(GLASS.y1, WINDOW_DIST);
  for (let slot = 0; slot < MAX_POCKETS; slot++) {
    for (const t of TIMES) {
      const f = pocketFrame(slot, t, 1.2);
      if (f.radius <= 0) continue;
      const dist = Math.hypot(f.centre[0] - SPAWN_XZ[0], f.centre[2] - SPAWN_XZ[1]);
      const b = bearingFromSpawn(f.centre[0], f.centre[2]), e = elevationFromSpawn(f.centre[1], dist);
      const half = angularRadius(f.radius, dist);
      assert.ok(b - half >= leftB && b + half <= rightB, `slot ${slot} at ${t}: bearing ${b.toFixed(2)} +- ${half.toFixed(2)}`);
      assert.ok(e - half >= lowE && e + half <= highE, `slot ${slot} at ${t}: elevation ${e.toFixed(2)} +- ${half.toFixed(2)}`);
    }
  }
});

test('nothing stands in the Breach corridor: no pocket disc reaches within 6 degrees of the Breach, at any time', () => {
  for (let slot = 0; slot < MAX_POCKETS; slot++) {
    for (const t of TIMES) {
      const f = pocketFrame(slot, t, 1.2);
      const dist = Math.hypot(f.centre[0] - SPAWN_XZ[0], f.centre[2] - SPAWN_XZ[1]);
      const b = bearingFromSpawn(f.centre[0], f.centre[2]);
      const half = angularRadius(f.radius, dist);
      assert.ok(Math.abs(b - BREACH_BEARING) - half >= CORRIDOR_DEG, `slot ${slot} at ${t}: ${b.toFixed(2)} +- ${half.toFixed(2)}`);
    }
  }
  assert.equal(inCorridor(BREACH_BEARING), true);
  assert.equal(inCorridor(BREACH_BEARING + CORRIDOR_DEG + 0.5), false);
  const breachFromSpawn = bearingFromSpawn(BREACH_XZ[0], BREACH_XZ[1]);
  assert.ok(Math.abs(breachFromSpawn - BREACH_BEARING) < 1e-6, 'the Breach sits at its bearing');
});

test('at most two pockets show in any one bay of the window, from the spawn', () => {
  for (const t of TIMES) {
    const count = [0, 0, 0, 0];
    for (let slot = 0; slot < MAX_POCKETS; slot++) {
      const f = pocketFrame(slot, t, 1.2);
      if (f.radius <= 0) continue;
      const bay = bayOfBearing(bearingFromSpawn(f.centre[0], f.centre[2]));
      if (bay >= 0) count[bay]!++;
    }
    assert.ok(count.every((c) => c <= 2), `at ${t}: ${count.join(',')}`);
  }
  assert.equal(MULLIONS_X.length, 3, 'four bays');
  assert.deepEqual([-20, 0, 20, 40].map(bayOfBearing), [0, 1, 2, 3], 'the four bays from left to right');
  assert.equal(bayOfBearing(-40), -1, 'outside the glass is no bay');
  assert.equal(bayOfBearing(60), -1);
});

test('a pocket drifts at one to three metres a second, and its frame repeats for one time', () => {
  const a = pocketFrame(1, 30), again = pocketFrame(1, 30);
  assert.deepEqual(a, again);
  // the fastest the centre moves over one-second steps within one life (a new life picks a new place, so the jump is not drift)
  let fastest = 0;
  for (let t = 1; t < pocketLifetime(1) - 2; t++) {
    const p = pocketFrame(1, t), n = pocketFrame(1, t + 1);
    fastest = Math.max(fastest, Math.hypot(n.centre[0] - p.centre[0], n.centre[1] - p.centre[1], n.centre[2] - p.centre[2]));
  }
  assert.ok(fastest >= 0.5 && fastest <= 3, `fastest ${fastest.toFixed(2)} m/s`);
  const b = pocketFrame(1, 31);
  for (const k of [a.kind, b.kind]) assert.ok(k >= 0 && k < POCKET_KINDS.length);
});

test('the pocket weight: full in the core, soft over its edge, nothing outside it', () => {
  const frames = [{ centre: [0, 9, 0] as const, radius: 10, kind: 0 }];
  assert.equal(strongestPocket(frames, [0, 9, 0]).weight, 1);
  assert.equal(strongestPocket(frames, [8, 9, 0]).weight, 1, 'inside the core (85% of the radius)');
  const edge = strongestPocket(frames, [9.25, 9, 0]).weight;
  assert.ok(edge > 0 && edge < 1, `soft edge ${edge}`);
  assert.equal(strongestPocket(frames, [12, 9, 0]).weight, 0);
  assert.equal(strongestPocket([{ centre: [0, 9, 0], radius: 0, kind: 0 }], [0, 9, 0]).index, -1, 'an empty slot never counts');
});

test('the ground under a floating pocket: a soft disc straight down, fading as the pocket rises', () => {
  const low = [{ centre: [0, 6, 0] as const, radius: 6, kind: 1 }];
  const high = [{ centre: [0, 26, 0] as const, radius: 6, kind: 1 }];
  assert.equal(strongestPocket(low, [0, 0, 0]).weight, groundFade(6), 'the disc is there, faded by the height');
  assert.ok(strongestPocket(low, [0, 0, 0]).weight > 0.9, 'a low pocket casts nearly full strength');
  assert.ok(strongestPocket(high, [0, 0, 0]).weight < strongestPocket(low, [0, 0, 0]).weight, 'a higher one casts less');
  assert.equal(strongestPocket(low, [0, 0, 9]).weight, 0, 'the disc is no wider than the radius');
  const air = [{ centre: [0, 6, 0] as const, radius: 3, kind: 1 }];
  assert.equal(strongestPocket(air, [0, 1, 0]).weight, 0, 'a point in the air outside the sphere gets nothing');
  assert.equal(strongestPocket(air, [0, 5, 0]).weight, 1, 'a point in the air inside the sphere gets the pocket');
});

test('fidelity: the base outside, the pocket S inside, the strongest pocket wins where two overlap', () => {
  const frames = [
    { centre: [0, 9, 0] as const, radius: 10, kind: 1 },
    { centre: [4, 9, 0] as const, radius: 10, kind: 3 },
  ];
  assert.deepEqual(fidelityAt(BASE_S, frames, [50, 9, 0]), BASE_S);
  assert.deepEqual(fidelityAt(BASE_S, frames, [-2, 9, 0]), POCKET_KINDS[1]!.s, 'deep in the 1-bit pocket');
  // at x 9.3 the first pocket is on its soft edge and the second is in its core: the stronger weight wins
  assert.deepEqual(fidelityAt(BASE_S, frames, [9.3, 9, 0]), POCKET_KINDS[3]!.s, 'the drowned pocket is stronger here');
});

test('the rim of each pocket is its own colour: Old Earth blue, 1-bit white, EGA cyan (Argo, TICKET-06), drowned teal, wire-crunch green', () => {
  const rims = POCKET_KINDS.map((k) => k.rim);
  assert.ok(rims[0]![2] > rims[0]![0], 'Old Earth: blue');
  assert.deepEqual(rims[1], [1, 1, 1], '1-bit: white');
  assert.ok(rims[2]![1] > 0.8 && rims[2]![2] > 0.8 && rims[2]![0] < 0.5, 'EGA: cyan');
  assert.ok(rims[3]![1] > 0.8 && rims[3]![2] > 0.8 && rims[3]![0] < 0.4, 'drowned: teal');
  assert.ok(rims[4]![1] > rims[4]![0] && rims[4]![1] > rims[4]![2], 'wire-crunch: green');
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

test('the clouds under the Breach are lit within 1.5 km of it, and not beyond', () => {
  assert.equal(cloudLitAt(0), 1);
  assert.ok(cloudLitAt(800) > 0 && cloudLitAt(800) < 1, 'part lit at 800 m');
  assert.equal(cloudLitAt(1500), 0);
  assert.equal(cloudLitAt(3000), 0);
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

test('the sectors sit in the glass, clear of the corridor, with the disc above the ground at the spawn', () => {
  for (const s of POCKET_SECTORS) {
    assert.ok(Math.abs(s.bearing - BREACH_BEARING) >= CORRIDOR_DEG + 3, `bearing ${s.bearing}`);
    assert.ok(s.elev > 0 && s.elev < 6, 'elevation in the upper middle of the glass');
    assert.ok(SPAWN_EYE_Y + s.dist * Math.tan((s.elev * Math.PI) / 180) > POCKET_MAX_RATIO * s.dist, 'above the ground by its radius');
  }
  assert.ok(polar(SPAWN_XZ, 0, 1)[1] < SPAWN_XZ[1], 'north is -z');
});

test('each window burst flashes the lab floor from its own strike (POL-25): the light peaks at the strike, fades, and is gone after 1.2 s', () => {
  // the lab's floor light (the window light) follows the vista's flash, which comes from the same seeded schedule as the burst
  const events = burstSchedule(0xb7a5, BREACH_XZ[0], BREACH_XZ[1]).eventsBetween(0, 120, 0);
  assert.ok(events.length >= 6, `events in two minutes: ${events.length}`);
  for (const e of events) {
    const peak = burstLook(0, e.strength).light;
    assert.ok(peak > 0.2, `a strike lights the floor at ${e.t}`);
    assert.ok(burstLook(0.3, e.strength).light < peak, `the floor fades after the strike at ${e.t}`);
    assert.equal(burstLook(BURST_SECONDS + 0.01, e.strength).light, 0, `and is gone by 1.2 s after ${e.t}`);
    assert.equal(burstLook(-0.01, e.strength).light, 0, `and is dark before ${e.t}`);
    // the flash is timed by the schedule: the same event comes back at its own time
    assert.ok(burstSchedule(0xb7a5, BREACH_XZ[0], BREACH_XZ[1]).eventsBetween(e.t, e.t + 0.001, 0).some((x) => x.t === e.t));
  }
});
