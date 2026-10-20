import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPS,
  FIRST_STAGE,
  SPACING,
  WET_REACH,
  bakePlotBiome,
  slopeDeg,
  type BiomeInput,
  type Scatter,
  type ScatterKind,
  type Tier,
} from '../src/index';

function makeTestInput(overrides: Partial<BiomeInput> = {}): BiomeInput {
  const n = overrides.n ?? 128;
  const cellM = overrides.cellM ?? 1;
  const total = n * n;
  const height = new Float32Array(total);
  const water = new Uint8Array(total);

  const cx = n * 0.35;
  const cz = n * 0.35;
  const lakeR = n * 0.12;

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const idx = z * n + x;
      const dx = x - cx;
      const dz = z - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Crater lake in lower-left, ridge toward upper-right, plus a steep cliff patch
      let h = 10 + 0.12 * (x + z) * cellM;
      if (dist < lakeR * 1.6) {
        h -= (lakeR * 1.6 - dist) * 0.6;
      }
      // Steep cliff in a small corner patch (x: 2..6, z: n-10..n-4)
      if (x >= 2 && x <= 6 && z >= n - 10 && z <= n - 4) {
        h += (x - 2) * 3.0 * cellM;
      }
      height[idx] = h;
      if (dist <= lakeR) {
        water[idx] = 1;
      }
    }
  }

  return {
    n,
    cellM,
    height,
    water,
    stage: 6,
    s: { pxd: 0.5, vtx: 0.5, lx: 0.6, aq: 0.6 },
    machines: [
      { x: 22 * cellM, z: 22 * cellM, r: 3 * cellM },
      { x: 36 * cellM, z: 20 * cellM, r: 2.5 * cellM },
      { x: 20 * cellM, z: 38 * cellM, r: 2.5 * cellM },
    ],
    keepouts: [
      { x0: 50 * cellM, z0: 50 * cellM, x1: 60 * cellM, z1: 58 * cellM },
    ],
    seed: 42,
    tier: 'mid',
    ...overrides,
  };
}

test('1. slopeDeg computes exact central differences and one-sided edge differences', () => {
  const n = 16;
  const cellM = 2;
  const h = new Float32Array(n * n);
  // Plane with dz = 0, dx = 1 => 45 degrees everywhere
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      h[z * n + x] = x * cellM * 1.0;
    }
  }
  assert.ok(Math.abs(slopeDeg(h, n, cellM, 0, 0) - 45) < 1e-5);
  assert.ok(Math.abs(slopeDeg(h, n, cellM, 8, 8) - 45) < 1e-5);
  assert.ok(Math.abs(slopeDeg(h, n, cellM, n - 1, n - 1) - 45) < 1e-5);

  // Non-linear heightfield to verify central vs one-sided formula directly
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      h[z * n + x] = x * x * 0.25 + z * 0.5;
    }
  }
  const x = 4;
  const z = 5;
  const dx = (h[z * n + (x + 1)]! - h[z * n + (x - 1)]!) / (2 * cellM);
  const dz = (h[(z + 1) * n + x]! - h[(z - 1) * n + x]!) / (2 * cellM);
  const expected = Math.atan(Math.hypot(dx, dz)) * (180 / Math.PI);
  assert.ok(Math.abs(slopeDeg(h, n, cellM, x, z) - expected) < 1e-5);

  // Edge (x = 0, z = n - 1)
  const dx0 = (h[(n - 1) * n + 1]! - h[(n - 1) * n + 0]!) / cellM;
  const dzEdge = (h[(n - 1) * n + 0]! - h[(n - 2) * n + 0]!) / cellM;
  const expectedEdge = Math.atan(Math.hypot(dx0, dzEdge)) * (180 / Math.PI);
  assert.ok(Math.abs(slopeDeg(h, n, cellM, 0, n - 1) - expectedEdge) < 1e-5);
});

test('2. Wetness channel A equals 255 on water, follows Euclidean WET_REACH falloff, and is stage-independent', () => {
  const n = 32;
  const cellM = 1.5;
  const water = new Uint8Array(n * n);
  const height = new Float32Array(n * n);
  const wx = 10;
  const wz = 12;
  water[wz * n + wx] = 1;

  const base = makeTestInput({ n, cellM, height, water, stage: 1 });
  const bake1 = bakePlotBiome(base);
  const bake5 = bakePlotBiome({ ...base, stage: 5.5 });

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const idx = z * n + x;
      const a1 = bake1.cover[idx * 4 + 3];
      const a5 = bake5.cover[idx * 4 + 3];
      assert.equal(a1, a5, 'Wetness A must be independent of stage');

      if (x === wx && z === wz) {
        assert.equal(a1, 255);
      } else {
        const d = Math.hypot((x - wx) * cellM, (z - wz) * cellM);
        const expectedA = Math.round(255 * Math.max(0, 1 - d / WET_REACH));
        assert.equal(a1, expectedA, `Mismatch at (${x},${z}) d=${d}`);
      }
    }
  }
});

test('3. Stage < 2 produces G=0, B=0 everywhere and empty scatter', () => {
  const input = makeTestInput({ n: 64, stage: 1.95 });
  const res = bakePlotBiome(input);
  assert.equal(res.scatter.length, 0);
  for (let i = 0; i < input.n * input.n; i++) {
    assert.equal(res.cover[i * 4 + 1], 0, 'G must be 0 when stage < 2');
    assert.equal(res.cover[i * 4 + 2], 0, 'B must be 0 when stage < 2');
  }
});

test('4. Cover monotonicity: G and B never decrease and R never increases with stage; G and B never decrease with aq or lx', () => {
  const base = makeTestInput({ n: 48 });
  const stages = [0, 1.5, 2.0, 2.7, 3.5, 4.2, 5.1, 6.0];
  let prev = bakePlotBiome({ ...base, stage: stages[0]! }).cover;

  for (let s = 1; s < stages.length; s++) {
    const cur = bakePlotBiome({ ...base, stage: stages[s]! }).cover;
    for (let i = 0; i < base.n * base.n; i++) {
      const p = i * 4;
      assert.ok(cur[p]! <= prev[p]!, `R increased at cell ${i} from stage ${stages[s - 1]} to ${stages[s]}`);
      assert.ok(cur[p + 1]! >= prev[p + 1]!, `G decreased at cell ${i} from stage ${stages[s - 1]} to ${stages[s]}`);
      assert.ok(cur[p + 2]! >= prev[p + 2]!, `B decreased at cell ${i} from stage ${stages[s - 1]} to ${stages[s]}`);
    }
    prev = cur;
  }

  const lowAq = bakePlotBiome({ ...base, stage: 5, s: { pxd: 0.5, vtx: 0.5, lx: 0.3, aq: 0.1 } }).cover;
  const highAq = bakePlotBiome({ ...base, stage: 5, s: { pxd: 0.5, vtx: 0.5, lx: 0.3, aq: 0.9 } }).cover;
  const highLx = bakePlotBiome({ ...base, stage: 5, s: { pxd: 0.5, vtx: 0.5, lx: 0.9, aq: 0.9 } }).cover;

  for (let i = 0; i < base.n * base.n; i++) {
    const p = i * 4;
    assert.ok(highAq[p + 1]! >= lowAq[p + 1]!, 'G must not decrease when aq grows');
    assert.ok(highAq[p + 2]! >= lowAq[p + 2]!, 'B must not decrease when aq grows');
    assert.ok(highLx[p + 1]! >= highAq[p + 1]!, 'G must not decrease when lx grows');
    assert.ok(highLx[p + 2]! >= highAq[p + 2]!, 'B must not decrease when lx grows');
  }
});

test('5. Water and slope limits on cover: G=B=0 on water; B=0 where slope>35; G=0 where slope>45', () => {
  const n = 48;
  const cellM = 1;
  const height = new Float32Array(n * n);
  const water = new Uint8Array(n * n);

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      if (x < 16) {
        height[z * n + x] = 0; // flat
      } else if (x < 32) {
        height[z * n + x] = (x - 16) * 0.85; // tan(40.36 deg) = 0.85 => slope ~ 40.4 deg (>35, <=45)
      } else {
        height[z * n + x] = (x - 16) * 1.2; // tan(50.19 deg) = 1.2 => slope > 45 deg
      }
    }
  }
  water[5 * n + 5] = 1;

  const res = bakePlotBiome(makeTestInput({ n, cellM, height, water, stage: 6 }));
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const idx = z * n + x;
      const p = idx * 4;
      const sl = slopeDeg(height, n, cellM, x, z);
      if (water[idx]! > 0) {
        assert.equal(res.cover[p + 1], 0, 'G=0 on water');
        assert.equal(res.cover[p + 2], 0, 'B=0 on water');
      }
      if (sl > 35) {
        assert.equal(res.cover[p + 2], 0, `B must be 0 at slope ${sl}`);
      }
      if (sl > 45) {
        assert.equal(res.cover[p + 1], 0, `G must be 0 at slope ${sl}`);
      }
    }
  }
});

test('6. Scatter appear bounds and monotone growth across stages', () => {
  const base = makeTestInput({ n: 96, tier: 'mid' });
  const bake6 = bakePlotBiome({ ...base, stage: 6 });
  assert.ok(bake6.scatter.length > 100);

  for (const s of bake6.scatter) {
    assert.ok(s.appear >= FIRST_STAGE[s.kind] && s.appear <= 6, `Invalid appear ${s.appear} for ${s.kind}`);
  }

  for (const st of [2.2, 3.0, 4.3, 5.2, 5.8, 6.0]) {
    const sub = bakePlotBiome({ ...base, stage: st }).scatter;
    const expected = bake6.scatter.filter((item) => item.appear <= st);
    assert.deepEqual(sub, expected, `Scatter at stage ${st} must exactly equal appear <= ${st} subset of stage 6`);
  }
});

test('7. Scatter never placed on water, slope > 35, within machine radius, inside keep-out, or out of bounds', () => {
  const input = makeTestInput({ n: 128, stage: 6, tier: 'high' });
  const { scatter } = bakePlotBiome(input);
  const worldSize = input.n * input.cellM;

  assert.ok(scatter.length > 0);
  for (const s of scatter) {
    assert.ok(s.x >= 0 && s.x < worldSize && s.z >= 0 && s.z < worldSize, 'Out of world bounds');
    const cx = Math.floor(s.x / input.cellM);
    const cz = Math.floor(s.z / input.cellM);
    const idx = cz * input.n + cx;
    assert.equal(input.water[idx], 0, 'Placed on water cell');
    const sl = slopeDeg(input.height, input.n, input.cellM, cx, cz);
    assert.ok(sl <= 35, `Placed on slope ${sl} > 35`);

    for (const m of input.machines) {
      const d = Math.hypot(s.x - m.x, s.z - m.z);
      assert.ok(d > m.r, `Placed inside machine keep-out: d=${d} <= r=${m.r}`);
    }
    for (const ko of input.keepouts) {
      const minX = Math.min(ko.x0, ko.x1);
      const maxX = Math.max(ko.x0, ko.x1);
      const minZ = Math.min(ko.z0, ko.z1);
      const maxZ = Math.max(ko.z0, ko.z1);
      const inside = s.x >= minX && s.x <= maxX && s.z >= minZ && s.z <= maxZ;
      assert.equal(inside, false, 'Placed inside keep-out rectangle');
    }
  }
});

test('8. Pairwise spacing between any two scatter instances is at least max(SPACING[a], SPACING[b])', () => {
  const input = makeTestInput({ n: 128, stage: 6, tier: 'mid' });
  const { scatter } = bakePlotBiome(input);
  assert.ok(scatter.length > 200);

  for (let i = 0; i < scatter.length; i++) {
    const a = scatter[i]!;
    for (let j = i + 1; j < scatter.length; j++) {
      const b = scatter[j]!;
      const req = Math.max(SPACING[a.kind], SPACING[b.kind]);
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(dist >= req - 1e-6, `Spacing violation between ${a.kind} and ${b.kind}: ${dist} < ${req}`);
    }
  }
});

test('9. Trees only on cells with stage-6 G>=128 or B>=128; scale in [0.7,1.3] and yaw in [0,2*PI)', () => {
  const input = makeTestInput({ n: 96, stage: 6, tier: 'high' });
  const { cover, scatter } = bakePlotBiome(input);
  const treeKinds = new Set<ScatterKind>(['pine', 'oak', 'birch']);
  let treeCount = 0;

  for (const s of scatter) {
    assert.ok(s.scale >= 0.7 && s.scale <= 1.3, `Scale out of range: ${s.scale}`);
    assert.ok(s.yaw >= 0 && s.yaw < Math.PI * 2, `Yaw out of range: ${s.yaw}`);
    if (treeKinds.has(s.kind)) {
      treeCount++;
      const cx = Math.floor(s.x / input.cellM);
      const cz = Math.floor(s.z / input.cellM);
      const p = (cz * input.n + cx) * 4;
      const g = cover[p + 1]!;
      const b = cover[p + 2]!;
      assert.ok(g >= 128 || b >= 128, `Tree ${s.kind} placed on infertile cell G=${g}, B=${b}`);
    }
  }
  assert.ok(treeCount > 50, 'Expected substantial number of trees at stage 6');
});

test('10. Tier caps respected and monotone prefix across tiers', () => {
  const base = makeTestInput({ n: 128, stage: 6 });
  for (const tier of ['low', 'mid', 'high'] as Tier[]) {
    const res = bakePlotBiome({ ...base, tier });
    assert.ok(res.scatter.length <= CAPS[tier], `Exceeded cap for ${tier}`);
  }
  const lowScatter = bakePlotBiome({ ...base, tier: 'low' }).scatter;
  const midScatter = bakePlotBiome({ ...base, tier: 'mid' }).scatter;
  assert.equal(lowScatter.length, CAPS.low);
  assert.deepEqual(midScatter.slice(0, lowScatter.length), lowScatter);
});

test('11. Tufts appear first near machines (appear rises with distance) AND grow >40m from machines at stage 6', () => {
  const input = makeTestInput({ n: 128, cellM: 1, stage: 6, tier: 'mid' });
  const { scatter } = bakePlotBiome(input);
  const tufts = scatter.filter((s) => s.kind === 'tuft');
  assert.ok(tufts.length > 40, 'Expected plenty of tufts');

  const distToMach = (s: Scatter) =>
    Math.min(...input.machines.map((m) => Math.hypot(s.x - m.x, s.z - m.z)));

  const nearTufts = tufts.filter((t) => distToMach(t) <= 25);
  const midTufts = tufts.filter((t) => distToMach(t) > 25 && distToMach(t) <= 40);
  const farTufts = tufts.filter((t) => distToMach(t) > 40);

  assert.ok(nearTufts.length > 10, 'Expected tufts near machines');
  assert.ok(farTufts.length > 20, `Expected tufts >40m from machines at stage 6, got ${farTufts.length}`);

  // Also verify >40m tufts exist even at tier 'low'
  const lowTuftsFar = bakePlotBiome({ ...input, tier: 'low' }).scatter.filter(
    (s) => s.kind === 'tuft' && distToMach(s) > 40
  );
  assert.ok(lowTuftsFar.length > 15, 'Expected >40m tufts even at tier low');

  const meanAppear = (arr: Scatter[]) => arr.reduce((acc, x) => acc + x.appear, 0) / arr.length;
  assert.ok(
    meanAppear(nearTufts) < meanAppear(farTufts),
    'Tufts near machines must have lower appear than tufts far from machines'
  );
  if (midTufts.length > 0) {
    assert.ok(meanAppear(nearTufts) < meanAppear(midTufts));
    assert.ok(meanAppear(midTufts) < meanAppear(farTufts));
  }
});

test('12. Bushes favour wet cells; birches near water, pines on drier higher ground, oaks in between', () => {
  const input = makeTestInput({ n: 128, cellM: 1, stage: 6, tier: 'high' });
  const { cover, scatter } = bakePlotBiome(input);

  const cellWet = (s: Scatter) => {
    const cx = Math.floor(s.x / input.cellM);
    const cz = Math.floor(s.z / input.cellM);
    return cover[(cz * input.n + cx) * 4 + 3]!;
  };
  const cellHeight = (s: Scatter) => {
    const cx = Math.floor(s.x / input.cellM);
    const cz = Math.floor(s.z / input.cellM);
    return input.height[cz * input.n + cx]!;
  };
  const waterCells: { x: number; z: number }[] = [];
  for (let z = 0; z < input.n; z++) {
    for (let x = 0; x < input.n; x++) {
      if (input.water[z * input.n + x]! > 0) {
        waterCells.push({ x: (x + 0.5) * input.cellM, z: (z + 0.5) * input.cellM });
      }
    }
  }
  const distToWater = (s: Scatter) => {
    let best = Infinity;
    for (const wc of waterCells) {
      const d = Math.hypot(s.x - wc.x, s.z - wc.z);
      if (d < best) best = d;
    }
    return best;
  };

  // Compute average wetness of all dry cells vs bush cells
  let dryWetSum = 0;
  let dryCount = 0;
  for (let i = 0; i < input.n * input.n; i++) {
    if (input.water[i] === 0) {
      dryWetSum += cover[i * 4 + 3]!;
      dryCount++;
    }
  }
  const avgDryWet = dryWetSum / dryCount;
  const bushes = scatter.filter((s) => s.kind === 'bush');
  assert.ok(bushes.length > 10, 'Expected bushes');
  const avgBushWet = bushes.reduce((a, b) => a + cellWet(b), 0) / bushes.length;
  assert.ok(avgBushWet > avgDryWet * 2, `Bushes must favour wet cells: ${avgBushWet} vs ${avgDryWet}`);

  const birches = scatter.filter((s) => s.kind === 'birch');
  const oaks = scatter.filter((s) => s.kind === 'oak');
  const pines = scatter.filter((s) => s.kind === 'pine');
  assert.ok(birches.length > 5 && oaks.length > 5 && pines.length > 5, 'Expected all three tree kinds');

  const avgH = (arr: Scatter[]) => arr.reduce((a, b) => a + cellHeight(b), 0) / arr.length;
  const avgDW = (arr: Scatter[]) => arr.reduce((a, b) => a + distToWater(b), 0) / arr.length;

  assert.ok(avgH(pines) > avgH(oaks), `Pines should be higher than oaks: ${avgH(pines)} vs ${avgH(oaks)}`);
  assert.ok(avgH(oaks) > avgH(birches), `Oaks should be higher than birches: ${avgH(oaks)} vs ${avgH(birches)}`);
  assert.ok(avgDW(birches) < avgDW(oaks), `Birches should be closer to water than oaks: ${avgDW(birches)} vs ${avgDW(oaks)}`);
  assert.ok(avgDW(oaks) < avgDW(pines), `Oaks should be closer to water than pines: ${avgDW(oaks)} vs ${avgDW(pines)}`);
});

test('13. Determinism, seed sensitivity, and no NaNs', () => {
  const input = makeTestInput({ n: 64, stage: 5.4, seed: 101 });
  const r1 = bakePlotBiome(input);
  const r2 = bakePlotBiome(input);
  const r3 = bakePlotBiome({ ...input, seed: 202 });

  assert.deepEqual(r1.cover, r2.cover);
  assert.deepEqual(r1.scatter, r2.scatter);
  assert.notDeepEqual(r1.scatter, r3.scatter);

  for (const s of r1.scatter) {
    assert.ok(!Number.isNaN(s.x) && !Number.isNaN(s.z) && !Number.isNaN(s.scale));
    assert.ok(!Number.isNaN(s.yaw) && !Number.isNaN(s.appear));
  }
});

/** FNV-1a over raw bytes, as 8 hex digits. */
function fnv1a(bytes: Uint8Array, h = 0x811c9dc5): number {
  for (let k = 0; k < bytes.length; k++) h = Math.imul(h ^ bytes[k]!, 0x01000193) >>> 0;
  return h;
}

/** One hash of the whole bake: every cover byte, then each scatter item's kind and its five numbers bit for bit. */
function bakeHash(input: BiomeInput): string {
  const { cover, scatter } = bakePlotBiome(input);
  const kinds: ScatterKind[] = ['tuft', 'bush', 'pine', 'oak', 'birch'];
  const nums = new Float64Array(scatter.length * 6);
  scatter.forEach((s, k) => nums.set([kinds.indexOf(s.kind), s.x, s.z, s.scale, s.yaw, s.appear], k * 6));
  const h = fnv1a(new Uint8Array(nums.buffer), fnv1a(cover));
  return `${scatter.length}:${h.toString(16).padStart(8, '0')}`;
}

test('14. Output hashes: cover bytes and scatter list are unchanged across seeds, stages, tiers and sizes', () => {
  const dryN = 80;
  const cases: [string, BiomeInput][] = [
    ['n128 seed42 stage6 mid', makeTestInput()],
    ['n128 seed42 stage6 low', makeTestInput({ tier: 'low' })],
    ['n256 seed777 stage6 high', makeTestInput({ n: 256, stage: 6, tier: 'high', seed: 777 })],
    ['n256 seed702 stage6 high', makeTestInput({ n: 256, stage: 6, tier: 'high', seed: 702 })],
    ['n96 cell1.5 seed9 stage4.3 mid', makeTestInput({ n: 96, cellM: 1.5, stage: 4.3, seed: 9 })],
    ['n64 seed5 stage2.5 low', makeTestInput({ n: 64, stage: 2.5, tier: 'low', seed: 5 })],
    ['n100 cell0.75 seed13 stage5.5 high', makeTestInput({ n: 100, cellM: 0.75, stage: 5.5, tier: 'high', seed: 13 })],
    ['n64 seed21 stage1.5', makeTestInput({ n: 64, stage: 1.5, seed: 21 })],
    ['n48 seed8 stage3.1 low aq', makeTestInput({ n: 48, stage: 3.1, seed: 8, s: { pxd: 0.1, vtx: 0.9, lx: 0.2, aq: 0.05 } })],
    ['n80 dry seed3 stage6 high', makeTestInput({ n: dryN, water: new Uint8Array(dryN * dryN), seed: 3, tier: 'high' })],
    ['n72 bare seed4 stage6 mid', makeTestInput({ n: 72, machines: [], keepouts: [], seed: 4 })],
  ];
  // scatter count : FNV-1a hash, captured from the bake before the speed work of 20 October 2026
  const golden: Record<string, string> = {
    'n128 seed42 stage6 mid': '602:1693163d',
    'n128 seed42 stage6 low': '600:fc4034cb',
    'n256 seed777 stage6 high': '1297:bec0de53',
    'n256 seed702 stage6 high': '1287:6883e26e',
    'n96 cell1.5 seed9 stage4.3 mid': '147:3d0ddca4',
    'n64 seed5 stage2.5 low': '24:72866e34',
    'n100 cell0.75 seed13 stage5.5 high': '448:41348c5f',
    'n64 seed21 stage1.5': '0:06a0de9c',
    'n48 seed8 stage3.1 low aq': '280:d506c4c7',
    'n80 dry seed3 stage6 high': '586:6966104e',
    'n72 bare seed4 stage6 mid': '428:155cb21e',
  };
  const actual = Object.fromEntries(cases.map(([name, input]) => [name, bakeHash(input)]));
  assert.deepEqual(actual, golden);
});

test('performance: n=256, stage 6, tier high runs in under 40 ms in Node', () => {
  const input = makeTestInput({ n: 256, cellM: 1, stage: 6, tier: 'high', seed: 777 });
  // Warmup
  bakePlotBiome(input);

  bakePlotBiome({ ...input, seed: 778 });
  const times: number[] = [];
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    const res = bakePlotBiome({ ...input, seed: 700 + r });
    times.push(performance.now() - t0);
    assert.ok(res.scatter.length > 0);
  }
  times.sort((a, b) => a - b);
  const medMs = times[2] ?? 0;
  assert.ok(medMs < 40, `Expected median < 40 ms for n=256 tier=high, took ${medMs.toFixed(2)} ms`);
});
