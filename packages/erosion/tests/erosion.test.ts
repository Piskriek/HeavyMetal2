import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DROP_DEFAULTS,
  flowAccumulation,
  hydraulic,
  mulberry32,
  thermal,
  type DropOptions,
  type Heightfield,
} from '../src/index';

const field = (cols: number, rows: number, f: (c: number, r: number) => number): Heightfield => {
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[c + r * cols] = f(c, r);
  return { cols, rows, cell: 1, heights };
};
const sum = (a: Float32Array): number => a.reduce((s, v) => s + v, 0);
const max = (a: Float32Array): number => a.reduce((s, v) => (v > s ? v : s), -Infinity);

test('thermal: a flat field stays flat, a spike slumps into a stable heap and nothing is lost', () => {
  const flat = field(9, 9, () => 3);
  assert.deepEqual(Array.from(thermal(flat, 20, 1)), Array.from(flat.heights));
  const spike = field(41, 41, (c, r) => (c === 20 && r === 20 ? 10 : 0));
  const out = thermal(spike, 1000, 1);
  assert.ok(Math.abs(sum(out) - 10) < 1e-3, String(sum(out)));
  assert.ok(out[20 + 20 * 41]! < 10 && out[21 + 20 * 41]! > 0);
  let worst = 0;
  for (let r = 0; r < 41; r++)
    for (let c = 0; c < 41; c++) {
      const h = out[c + r * 41]!;
      if (c < 40) worst = Math.max(worst, Math.abs(h - out[c + 1 + r * 41]!));
      if (r < 40) worst = Math.max(worst, Math.abs(h - out[c + (r + 1) * 41]!));
    }
  assert.ok(worst <= 1.05, String(worst));
  assert.equal(spike.heights[20 + 20 * 41], 10);
});

test('hydraulic: raindrops wear the peak down, keep every grain, and do it the same way each time', () => {
  const cone = field(41, 41, (c, r) => Math.max(0, 10 - Math.hypot(c - 20, r - 20)));
  const a = hydraulic(cone, 2000, 1),
    b = hydraulic(cone, 2000, 1);
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.ok(Math.abs(sum(a) - sum(cone.heights)) < 1e-3 * sum(cone.heights), `${sum(a)} vs ${sum(cone.heights)}`);
  assert.ok(a.some((v, i) => Math.abs(v - cone.heights[i]!) > 1e-4));
  assert.notDeepEqual(Array.from(hydraulic(cone, 2000, 2)), Array.from(a));
});

test('water collects down a slope and into a pit', () => {
  const ramp = field(5, 21, (_c, r) => 20 - r);
  const acc = flowAccumulation(ramp);
  assert.equal(acc[2 + 20 * 5], 21);
  assert.equal(acc[2 + 0 * 5], 1);
  const pit = field(5, 5, (c, r) => (c === 2 && r === 2 ? -1 : 0));
  assert.equal(flowAccumulation(pit)[2 + 2 * 5], 9);
});

/* ------------------------------------------------------------------ */
/* defaults and the seeded generator                                   */
/* ------------------------------------------------------------------ */

test('DROP_DEFAULTS are exactly the documented values', () => {
  const expected: DropOptions = {
    inertia: 0.05,
    capacity: 4,
    minSlope: 0.01,
    deposit: 0.3,
    erode: 0.3,
    evaporation: 0.01,
    gravity: 4,
    maxSteps: 64,
  };
  assert.deepEqual(DROP_DEFAULTS, expected);
});

test('mulberry32 is reproducible, in range, and seed sensitive', () => {
  const a = mulberry32(1234);
  const b = mulberry32(1234);
  const first: number[] = [];
  for (let i = 0; i < 64; i++) {
    const v = a();
    first.push(v);
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1, String(v));
  }
  const c = mulberry32(1235);
  let differs = false;
  for (let i = 0; i < 64; i++) if (c() !== first[i]) differs = true;
  assert.ok(differs);
  assert.equal(mulberry32(0)(), mulberry32(0)());
  assert.notEqual(mulberry32(0)(), mulberry32(1)());
});

/* ------------------------------------------------------------------ */
/* thermal                                                             */
/* ------------------------------------------------------------------ */

test('thermal moves only the excess, in one shared lump, from a snapshot of the iteration', () => {
  // Two cells 2 apart with no angle of repose: the top cell gives away 2 * 1 / 2.
  const pair = field(2, 1, (c) => (c === 0 ? 2 : 0));
  assert.deepEqual(Array.from(thermal(pair, 1, 0, 1)), [1, 1]);

  // Three cells on a ramp: every move reads the heights as the iteration began,
  // so the middle cell does not pass material on again within the same pass.
  const ramp = field(3, 1, (c) => 2 - c);
  assert.deepEqual(Array.from(thermal(ramp, 1, 0, 1)), [1.5, 1, 0.5]);

  // A corner shares its single lump between both low neighbours in proportion.
  const corner = field(2, 2, (c, r) => (c === 0 && r === 0 ? 4 : 0));
  // rate * max excess / 2 = 0.5 * 3 / 2 = 0.75 leaves the corner in all, 0.375 to each neighbour (the answer had 3.625, one share)
  assert.deepEqual(Array.from(thermal(corner, 1, 1, 0.5)), [3.25, 0.375, 0.375, 0]);
});

test('thermal is scaled by cell size and by rate', () => {
  const coarse = field(2, 1, (c) => (c === 0 ? 5 : 0));
  coarse.cell = 4;
  assert.deepEqual(Array.from(thermal(coarse, 1, 1, 0.5)), [4.75, 0.25]);
  const fine = field(2, 1, (c) => (c === 0 ? 5 : 0));
  assert.deepEqual(Array.from(thermal(fine, 1, 1, 0.5)), [4, 1]);
  const frozen = field(2, 1, (c) => (c === 0 ? 5 : 0));
  assert.deepEqual(Array.from(thermal(frozen, 1, 1, 0)), [5, 0]);
});

test('thermal never touches the input and hands back a new array', () => {
  const hills = field(6, 6, (c, r) => 3 + Math.sin(c) + Math.cos(r) * 2);
  const snapshot = Array.from(hills.heights);
  const out = thermal(hills, 5, 0.5);
  assert.deepEqual(Array.from(hills.heights), snapshot);
  assert.notEqual(out, hills.heights);
  assert.ok(sum(out) > 0);
});

test('thermal keeps the total for any rate, talus and iteration count', () => {
  const bumpy = field(23, 17, (c, r) => 5 + 4 * Math.sin(c * 0.7) * Math.cos(r * 0.4) + ((c * r) % 3));
  for (const rate of [0.1, 0.5, 1]) {
    for (const talus of [0, 0.25, 2]) {
      const out = thermal(bumpy, 200, talus, rate);
      const before = sum(bumpy.heights);
      assert.ok(
        Math.abs(sum(out) - before) < 1e-3 * Math.abs(before),
        `rate ${rate} talus ${talus}: ${sum(out)} vs ${before}`,
      );
      assert.equal(out.length, 23 * 17);
    }
  }
});

test('thermal is deterministic', () => {
  const hills = field(12, 12, (c, r) => 7 - Math.abs(c - 5) - Math.abs(r - 5));
  assert.deepEqual(Array.from(thermal(hills, 30, 0.5)), Array.from(thermal(hills, 30, 0.5)));
});

/* ------------------------------------------------------------------ */
/* hydraulic                                                           */
/* ------------------------------------------------------------------ */

test('hydraulic leaves a perfectly flat field alone and never mutates its input', () => {
  const flat = field(9, 9, () => 3);
  const snapshot = Array.from(flat.heights);
  const out = hydraulic(flat, 400, 9);
  assert.deepEqual(Array.from(flat.heights), snapshot);
  assert.deepEqual(Array.from(out), snapshot);
  assert.notEqual(out, flat.heights);
});

test('hydraulic with no drops, or no steps, changes nothing', () => {
  const cone = field(11, 11, (c, r) => Math.max(0, 5 - Math.hypot(c - 5, r - 5)));
  assert.deepEqual(Array.from(hydraulic(cone, 0, 3)), Array.from(cone.heights));
  assert.deepEqual(Array.from(hydraulic(cone, 50, 3, { maxSteps: 0 })), Array.from(cone.heights));
});

test('hydraulic keeps every grain for many seeds and option sets', () => {
  const bumpy = field(29, 29, (c, r) => 6 + 3 * Math.sin(c * 0.5) + 3 * Math.cos(r * 0.35) - 0.02 * c * r);
  const variants: Array<{ drops: number; seed: number; opts?: Partial<DropOptions> }> = [
    { drops: 500, seed: 1 },
    { drops: 500, seed: 2 },
    { drops: 500, seed: 987654321 },
    { drops: 1, seed: 7 },
    { drops: 300, seed: 4, opts: { inertia: 0, gravity: 1, maxSteps: 8 } },
    { drops: 300, seed: 4, opts: { inertia: 0.9, evaporation: 0.1, capacity: 1 } },
    { drops: 300, seed: 4, opts: { deposit: 1, erode: 1, minSlope: 0.5 } },
    { drops: 300, seed: 4, opts: { evaporation: 1 } },
    { drops: 300, seed: 4, opts: { gravity: 100 } },
    { drops: 300, seed: 4, opts: { maxSteps: 1 } },
  ];
  for (const v of variants) {
    const out = hydraulic(bumpy, v.drops, v.seed, v.opts);
    const before = sum(bumpy.heights);
    assert.ok(
      Math.abs(sum(out) - before) < 1e-3 * Math.abs(before),
      `drops ${v.drops} seed ${v.seed}: ${sum(out)} vs ${before}`,
    );
  }
});

test('hydraulic carves the high ground and drops soil in the low ground', () => {
  const cone = field(41, 41, (c, r) => Math.max(0, 10 - Math.hypot(c - 20, r - 20)));
  const snapshot = Array.from(cone.heights);
  const out = hydraulic(cone, 4000, 5);
  assert.deepEqual(Array.from(cone.heights), snapshot);
  let highEroded = 0;
  let lowRaised = 0;
  let touched = 0;
  for (let i = 0; i < out.length; i++) {
    const before = cone.heights[i]!;
    const delta = out[i]! - before;
    if (Math.abs(delta) > 1e-4) touched++;
    if (before > 8 && delta < -1e-4) highEroded++;
    if (before < 0.5 && delta > 1e-4) lowRaised++;
  }
  assert.ok(highEroded > 0, 'nothing near the peak was worn away');
  assert.ok(lowRaised > 0, 'no soil settled in the flats');
  assert.ok(touched > 20, String(touched));
  assert.ok(max(out) <= max(cone.heights) + 1e-3, `${max(out)} vs ${max(cone.heights)}`);
});

test('hydraulic honours every option it is given', () => {
  const cone = field(21, 21, (c, r) => Math.max(0, 8 - Math.hypot(c - 10, r - 10)));
  const base = Array.from(hydraulic(cone, 400, 3));
  const tuned: Array<[keyof DropOptions, number]> = [
    ['inertia', 0.8],
    ['capacity', 20],
    ['minSlope', 1],
    ['deposit', 0.9],
    ['erode', 0.9],
    ['evaporation', 0.2],
    ['gravity', 40],
    ['maxSteps', 2],
  ];
  for (const [key, value] of tuned) {
    const opts: Partial<DropOptions> = {};
    opts[key] = value;
    const out = Array.from(hydraulic(cone, 400, 3, opts));
    assert.notDeepEqual(out, base, `${key} had no effect`);
    assert.ok(
      Math.abs(sum(Float32Array.from(out)) - sum(cone.heights)) < 1e-2 * sum(cone.heights),
      `${key} lost soil`,
    );
  }
});

/* ------------------------------------------------------------------ */
/* flow accumulation                                                   */
/* ------------------------------------------------------------------ */

test('water with nowhere to go stays put', () => {
  const flat = field(4, 4, () => 2);
  const acc = flowAccumulation(flat);
  assert.equal(acc.length, 16);
  for (let i = 0; i < 16; i++) assert.equal(acc[i], 1, String(i));
});

test('the steepest descent wins and ties go to the first of N, NE, E, SE, S, SW, W, NW', () => {
  // A lone peak: N, E, S and W all fall 1 while the diagonals fall 1/sqrt(2).
  const peak = field(3, 3, (c, r) => (c === 1 && r === 1 ? 1 : 0));
  const acc = flowAccumulation(peak);
  assert.equal(acc[1], 2);
  assert.equal(acc[4], 1);
  assert.equal(sum(acc), 10);

  // Only the NE corner is lower, so the winner is a diagonal; it collects the
  // cells east, north and north-east of it.
  const ne = field(3, 3, (c, r) => (c === 2 && r === 0 ? -1 : 0));
  const accNe = flowAccumulation(ne);
  assert.equal(accNe[2], 4);
  assert.equal(accNe[1], 1);
  assert.equal(accNe[5], 1);
  assert.equal(accNe[4], 1);
});

test('a valley floor gathers the whole row that drains into it', () => {
  const valley = field(7, 7, (c) => Math.abs(c - 3));
  const acc = flowAccumulation(valley);
  assert.equal(acc[3 + 0 * 7], 7);
  assert.equal(acc[3 + 6 * 7], 7);
  assert.equal(acc[0 + 0 * 7], 1);
  assert.equal(acc[6 + 0 * 7], 1);
  assert.equal(acc[0 + 6 * 7], 1);
  assert.equal(acc[6 + 6 * 7], 1);
});

test('a terrace edge spills east before south', () => {
  const terrace = field(4, 4, (c, r) => (c < 2 && r < 2 ? 1 : 0));
  const acc = flowAccumulation(terrace);
  assert.equal(acc[0], 1);
  assert.equal(acc[1], 1);
  assert.equal(acc[2], 2);
  assert.equal(acc[2 + 4], 2);
  assert.equal(acc[0 + 8], 2);
});

test('pits swallow the eight cells around them', () => {
  const pits = field(6, 6, (c, r) => ((c === 1 && r === 4) || (c === 4 && r === 1) ? -5 : 0));
  const acc = flowAccumulation(pits);
  assert.equal(acc[1 + 4 * 6], 9);
  assert.equal(acc[4 + 1 * 6], 9);
});

test('accumulation grows strictly downstream and never mutates the input', () => {
  const cols = 19;
  const rows = 13;
  const terrain = field(cols, rows, (c, r) => 4 + 3 * Math.sin(c * 0.45) + 2 * Math.cos(r * 0.6) - 0.05 * c * r);
  const snapshot = Array.from(terrain.heights);
  const acc = flowAccumulation(terrain);
  assert.deepEqual(Array.from(terrain.heights), snapshot);
  assert.notEqual(acc, terrain.heights);

  const deltas = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = c + r * cols;
      assert.ok(acc[i]! >= 1, String(i));
      let best = 0;
      let target = -1;
      for (let k = 0; k < 8; k++) {
        const nc = c + deltas[k]![0]!;
        const nr = r + deltas[k]![1]!;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const drop = terrain.heights[i]! - terrain.heights[nc + nr * cols]!;
        if (drop <= 0) continue;
        const slope = drop / (k % 2 === 0 ? 1 : Math.SQRT2);
        if (slope > best) {
          best = slope;
          target = nc + nr * cols;
        }
      }
      if (target >= 0) assert.ok(acc[target]! > acc[i]!, `${i} -> ${target}`);
    }
});

test('flow accumulation is deterministic', () => {
  const terrain = field(15, 15, (c, r) => Math.sin(c * 1.1) * Math.cos(r * 0.9) * 3);
  const a = flowAccumulation(terrain);
  const b = flowAccumulation(terrain);
  assert.deepEqual(Array.from(a), Array.from(b));
  for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]!), String(i));
});