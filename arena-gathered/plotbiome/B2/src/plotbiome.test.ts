import assert from 'node:assert/strict';
import { test } from 'node:test';
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
} from './plotbiome.ts';

function pondInput(n = 32, cellM = 1, extra: Partial<BiomeInput> = {}): BiomeInput {
  const height = extra.height ?? new Float32Array(n * n);
  const water = extra.water ?? new Uint8Array(n * n);
  if (!extra.height || !extra.water) {
    const cx = n / 2;
    const cz = n / 2;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - cx;
        const dz = z + 0.5 - cz;
        const d = Math.sqrt(dx * dx + dz * dz);
        const i = z * n + x;
        if (!extra.height) {
          height[i] = 3 + 0.08 * x + 1.8 * Math.exp(-((x - n * 0.78) * (x - n * 0.78)) / 40);
        }
        if (!extra.water && d < 3.2) {
          if (!extra.height) height[i] = 0.2;
          water[i] = 1;
        }
      }
    }
  }
  const W = n * cellM;
  return {
    n,
    cellM,
    stage: 6,
    s: { pxd: 0.45, vtx: 0.8, lx: 0.9, aq: 0.9 },
    machines: [
      { x: 5.5 * cellM, z: 5.5 * cellM, r: 1.4 },
      { x: W - 7 * cellM, z: 8 * cellM, r: 1.2 },
      { x: 8 * cellM, z: W - 7 * cellM, r: 1.5 },
    ],
    keepouts: [{ x0: 0, z0: 0, x1: 2.2 * cellM, z1: 2.2 * cellM }],
    seed: 42,
    tier: 'high',
    ...extra,
    height,
    water,
  };
}

function cellOf(s: Scatter, cellM: number): { x: number; z: number } {
  return { x: Math.floor(s.x / cellM), z: Math.floor(s.z / cellM) };
}

test('slopeDeg uses central differences and one-sided edges as atan(|grad|) degrees', () => {
  const n = 5;
  const cellM = 2;
  const height = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) height[z * n + x] = x * cellM;
  }
  const deg45 = Math.atan(1) * (180 / Math.PI);
  assert.ok(Math.abs(slopeDeg(height, n, cellM, 2, 2) - deg45) < 1e-9);
  assert.ok(Math.abs(slopeDeg(height, n, cellM, 0, 2) - deg45) < 1e-9);
  assert.ok(Math.abs(slopeDeg(height, n, cellM, n - 1, 2) - deg45) < 1e-9);
  assert.ok(Math.abs(slopeDeg(height, n, cellM, 2, 0) - deg45) < 1e-9);
  assert.ok(Math.abs(slopeDeg(height, n, cellM, 2, n - 1) - deg45) < 1e-9);

  const h2 = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) h2[z * n + x] = z * cellM * 0.5;
  }
  const want = Math.atan(0.5) * (180 / Math.PI);
  assert.ok(Math.abs(slopeDeg(h2, n, cellM, 2, 2) - want) < 1e-9);
  assert.ok(Math.abs(slopeDeg(h2, n, cellM, 0, 0) - want) < 1e-9);
});

test('wetness A is 255 on water else round(255*max(0,1-d/WET_REACH)) and ignores stage', () => {
  const n = 16;
  const cellM = 1;
  const height = new Float32Array(n * n);
  const water = new Uint8Array(n * n);
  water[8 * n + 8] = 1;
  const a = bakePlotBiome(pondInput(n, cellM, { height, water, stage: 0 }));
  const b = bakePlotBiome(pondInput(n, cellM, { height, water, stage: 6 }));
  const idx = (x: number, z: number) => (z * n + x) * 4 + 3;
  assert.equal(a.cover[idx(8, 8)], 255);
  assert.equal(b.cover[idx(8, 8)], 255);
  const d = (x: number, z: number) => {
    const dx = x + 0.5 - 8.5;
    const dz = z + 0.5 - 8.5;
    return Math.sqrt(dx * dx + dz * dz);
  };
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      if (x === 8 && z === 8) continue;
      const want = Math.round(255 * Math.max(0, 1 - d(x, z) / WET_REACH));
      assert.equal(a.cover[idx(x, z)], want);
      assert.equal(b.cover[idx(x, z)], want);
      assert.equal(a.cover[idx(x, z)], b.cover[idx(x, z)]);
    }
  }
});

test('stage < 2 clears moss, grass and scatter', () => {
  const i = pondInput(24, 1, { stage: 1.99 });
  const baked = bakePlotBiome(i);
  assert.equal(baked.scatter.length, 0);
  for (let p = 0; p < i.n * i.n; p++) {
    assert.equal(baked.cover[p * 4 + 1], 0);
    assert.equal(baked.cover[p * 4 + 2], 0);
  }
  const zero = bakePlotBiome({ ...i, stage: 0 });
  assert.equal(zero.scatter.length, 0);
});

test('G and B never decrease and R never increases as stage grows', () => {
  const base = pondInput(28, 1);
  const stages = [0, 1.5, 2, 3.3, 4, 5.1, 6];
  const bakes = stages.map((stage) => bakePlotBiome({ ...base, stage }));
  const nn = base.n * base.n;
  for (let s = 1; s < bakes.length; s++) {
    const prev = bakes[s - 1];
    const cur = bakes[s];
    assert.ok(prev && cur);
    for (let p = 0; p < nn; p++) {
      assert.ok((cur.cover[p * 4 + 1] ?? 0) >= (prev.cover[p * 4 + 1] ?? 0));
      assert.ok((cur.cover[p * 4 + 2] ?? 0) >= (prev.cover[p * 4 + 2] ?? 0));
      assert.ok((cur.cover[p * 4 + 0] ?? 0) <= (prev.cover[p * 4 + 0] ?? 0));
    }
  }
  const lush = bakes[bakes.length - 1];
  assert.ok(lush);
  let maxGB = 0;
  for (let p = 0; p < nn; p++) {
    const g = lush.cover[p * 4 + 1] ?? 0;
    const b = lush.cover[p * 4 + 2] ?? 0;
    if (g > maxGB) maxGB = g;
    if (b > maxGB) maxGB = b;
  }
  assert.ok(maxGB > 0);
});

test('G and B never decrease as aq or lx grow', () => {
  const base = pondInput(24, 1, { stage: 6 });
  const aqBakes = [0, 0.4, 1].map((aq) =>
    bakePlotBiome({ ...base, s: { ...base.s, aq } }),
  );
  const lxBakes = [0, 0.5, 1].map((lx) =>
    bakePlotBiome({ ...base, s: { ...base.s, lx } }),
  );
  const nn = base.n * base.n;
  const check = (seq: ReturnType<typeof bakePlotBiome>[]) => {
    for (let s = 1; s < seq.length; s++) {
      const prev = seq[s - 1];
      const cur = seq[s];
      assert.ok(prev && cur);
      for (let p = 0; p < nn; p++) {
        assert.ok((cur.cover[p * 4 + 1] ?? 0) >= (prev.cover[p * 4 + 1] ?? 0));
        assert.ok((cur.cover[p * 4 + 2] ?? 0) >= (prev.cover[p * 4 + 2] ?? 0));
      }
    }
  };
  check(aqBakes);
  check(lxBakes);
});

test('G=B=0 on water; B=0 where slope>35; G=0 where slope>45', () => {
  const n = 20;
  const cellM = 1;
  const height = new Float32Array(n * n);
  const water = new Uint8Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if (x < 4) height[i] = 1;
      else if (x < 10) height[i] = (x - 4) * 0.85;
      else height[i] = 5.1 + (x - 10) * 1.4;
      if (z < 2 && x < 3) water[i] = 1;
    }
  }
  const baked = bakePlotBiome(
    pondInput(n, cellM, { height, water, stage: 6, s: { pxd: 1, vtx: 1, lx: 1, aq: 1 } }),
  );
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const sl = slopeDeg(height, n, cellM, x, z);
      const g = baked.cover[i * 4 + 1] ?? 0;
      const bch = baked.cover[i * 4 + 2] ?? 0;
      if ((water[i] ?? 0) > 0) {
        assert.equal(g, 0);
        assert.equal(bch, 0);
      }
      if (sl > 35) assert.equal(bch, 0);
      if (sl > 45) assert.equal(g, 0);
    }
  }
});

test('scatter appear range, presence iff appear<=stage, fields identical (monotone growth)', () => {
  const base = pondInput(36, 1);
  const hi = bakePlotBiome({ ...base, stage: 6 });
  assert.ok(hi.scatter.length > 0);
  for (const s of hi.scatter) {
    const first = FIRST_STAGE[s.kind];
    assert.ok(s.appear >= first && s.appear <= 6);
  }
  const stages = [2, 3.5, 4, 5, 5.5, 6];
  const bakes = stages.map((stage) => bakePlotBiome({ ...base, stage }));
  for (let s = 0; s < stages.length; s++) {
    const stage = stages[s] ?? 0;
    const baked = bakes[s];
    assert.ok(baked);
    for (const inst of baked.scatter) assert.ok(inst.appear <= stage);
    const later = bakes[bakes.length - 1];
    assert.ok(later);
    for (const inst of baked.scatter) {
      const found: Scatter | undefined = later.scatter.find(
        (o: Scatter) => o.kind === inst.kind && o.x === inst.x && o.z === inst.z,
      );
      assert.ok(found);
      assert.equal(found.scale, inst.scale);
      assert.equal(found.yaw, inst.yaw);
      assert.equal(found.appear, inst.appear);
    }
    if (s > 0) {
      const prev = bakes[s - 1];
      assert.ok(prev);
      assert.ok(baked.scatter.length >= prev.scatter.length);
      for (const inst of prev.scatter) {
        const found: Scatter | undefined = baked.scatter.find(
          (o: Scatter) => o.kind === inst.kind && o.x === inst.x && o.z === inst.z,
        );
        assert.deepEqual(found, inst);
      }
    }
  }
  const early = bakePlotBiome({ ...base, stage: 3 });
  assert.ok(early.scatter.every((s) => s.kind === 'tuft'));
});

test('never place scatter on water, steep cells, machines, keepouts, or outside bounds', () => {
  const n = 28;
  const cellM = 1;
  const W = n * cellM;
  const i = pondInput(n, cellM, {
    stage: 6,
    keepouts: [{ x0: 12, z0: 12, x1: 16, z1: 16 }],
    machines: [
      { x: 6, z: 6, r: 2 },
      { x: 22, z: 7, r: 1.8 },
      { x: 7, z: 21, r: 2.2 },
    ],
  });
  const baked = bakePlotBiome(i);
  assert.ok(baked.scatter.length > 0);
  for (const s of baked.scatter) {
    assert.ok(s.x >= 0 && s.x < W);
    assert.ok(s.z >= 0 && s.z < W);
    const c = cellOf(s, cellM);
    assert.ok(c.x >= 0 && c.x < n && c.z >= 0 && c.z < n);
    assert.equal(i.water[c.z * n + c.x], 0);
    assert.ok(slopeDeg(i.height, n, cellM, c.x, c.z) <= 35);
    for (const m of i.machines) {
      const d = Math.hypot(s.x - m.x, s.z - m.z);
      assert.ok(d > m.r);
    }
    for (const k of i.keepouts) {
      const inside = s.x >= k.x0 && s.x <= k.x1 && s.z >= k.z0 && s.z <= k.z1;
      assert.equal(inside, false);
    }
  }
});

test('any two instances are at least max(SPACING[a], SPACING[b]) apart', () => {
  const baked = bakePlotBiome(pondInput(40, 1, { stage: 6, tier: 'high' }));
  assert.ok(baked.scatter.length > 10);
  for (let a = 0; a < baked.scatter.length; a++) {
    const A = baked.scatter[a];
    if (!A) continue;
    for (let b = a + 1; b < baked.scatter.length; b++) {
      const B = baked.scatter[b];
      if (!B) continue;
      const need = Math.max(SPACING[A.kind], SPACING[B.kind]);
      const d = Math.hypot(A.x - B.x, A.z - B.z);
      assert.ok(d + 1e-9 >= need);
    }
  }
});

test('trees only on cells where G or B would be >= 128 at stage 6', () => {
  const base = pondInput(36, 1, { stage: 6 });
  const full = bakePlotBiome(base);
  const trees = full.scatter.filter((s) => s.kind === 'pine' || s.kind === 'oak' || s.kind === 'birch');
  assert.ok(trees.length > 0);
  for (const s of trees) {
    const c = cellOf(s, base.cellM);
    const i = c.z * base.n + c.x;
    const g = full.cover[i * 4 + 1] ?? 0;
    const b = full.cover[i * 4 + 2] ?? 0;
    assert.ok(g >= 128 || b >= 128);
  }
});

test('caps: at most CAPS[tier]; prefix by appear then seeded hash keeps monotone growth', () => {
  const base = pondInput(48, 1, { stage: 6 });
  const byTier: Record<Tier, Scatter[]> = {
    low: bakePlotBiome({ ...base, tier: 'low' }).scatter,
    mid: bakePlotBiome({ ...base, tier: 'mid' }).scatter,
    high: bakePlotBiome({ ...base, tier: 'high' }).scatter,
  };
  assert.ok(byTier.low.length <= CAPS.low);
  assert.ok(byTier.mid.length <= CAPS.mid);
  assert.ok(byTier.high.length <= CAPS.high);
  assert.ok(byTier.low.length <= byTier.mid.length);
  assert.ok(byTier.mid.length <= byTier.high.length);
  const key = (s: Scatter) => `${s.kind}:${s.x}:${s.z}:${s.appear}`;
  const midSet = new Set(byTier.mid.map(key));
  const highSet = new Set(byTier.high.map(key));
  for (const s of byTier.low) assert.ok(midSet.has(key(s)));
  for (const s of byTier.mid) assert.ok(highSet.has(key(s)));
  for (let i = 1; i < byTier.high.length; i++) {
    const a = byTier.high[i - 1];
    const b = byTier.high[i];
    assert.ok(a && b);
    assert.ok(a.appear <= b.appear + 1e-12);
  }
});

test('scale in [0.7,1.3] and yaw in [0, 2*PI)', () => {
  const baked = bakePlotBiome(pondInput(32, 1, { stage: 6 }));
  assert.ok(baked.scatter.length > 0);
  for (const s of baked.scatter) {
    assert.ok(s.scale >= 0.7 && s.scale <= 1.3);
    assert.ok(s.yaw >= 0 && s.yaw < Math.PI * 2);
  }
});

test('tufts appear first nearest machines; bushes favour wet; pines dry/high, birches wet, oaks in between', () => {
  const n = 48;
  const cellM = 1;
  const i = pondInput(n, cellM, { stage: 6, tier: 'high' });
  const baked = bakePlotBiome(i);
  const tufts = baked.scatter.filter((s) => s.kind === 'tuft');
  const bushes = baked.scatter.filter((s) => s.kind === 'bush');
  const pines = baked.scatter.filter((s) => s.kind === 'pine');
  const oaks = baked.scatter.filter((s) => s.kind === 'oak');
  const birches = baked.scatter.filter((s) => s.kind === 'birch');
  assert.ok(tufts.length > 4);
  assert.ok(bushes.length > 0);
  assert.ok(pines.length > 0);
  assert.ok(oaks.length > 0);
  assert.ok(birches.length > 0);

  const dM = (s: Scatter) =>
    Math.min(...i.machines.map((m) => Math.hypot(s.x - m.x, s.z - m.z)));
  const sorted = [...tufts].sort((a, b) => dM(a) - dM(b));
  const nTake = Math.max(2, Math.floor(sorted.length * 0.25));
  const near = sorted.slice(0, nTake);
  const far = sorted.slice(-nTake);
  const mean = (xs: Scatter[], f: (s: Scatter) => number) =>
    xs.reduce((a, s) => a + f(s), 0) / xs.length;
  assert.ok(mean(near, (s) => s.appear) <= mean(far, (s) => s.appear) + 1e-9);

  const wetAt = (s: Scatter) => {
    const c = cellOf(s, cellM);
    return baked.cover[(c.z * n + c.x) * 4 + 3] ?? 0;
  };
  const hAt = (s: Scatter) => {
    const c = cellOf(s, cellM);
    return i.height[c.z * n + c.x] ?? 0;
  };
  assert.ok(mean(bushes, wetAt) > mean(pines, wetAt));
  assert.ok(mean(birches, wetAt) > mean(oaks, wetAt));
  assert.ok(mean(oaks, wetAt) > mean(pines, wetAt) - 8);
  assert.ok(mean(pines, hAt) >= mean(birches, hAt) - 0.05);
});

test('stage 6 tufts grow on grass more than 40 m from machines', () => {
  const n = 128;
  const cellM = 1;
  const height = new Float32Array(n * n);
  const water = new Uint8Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const dx = x - 96;
      const dz = z - 96;
      const d = Math.sqrt(dx * dx + dz * dz);
      height[i] = 4 + 0.04 * x + 0.5 * Math.sin(x * 0.08) * Math.cos(z * 0.07);
      if (d < 10) {
        height[i] = 0.4;
        water[i] = 1;
      }
    }
  }
  const input = pondInput(n, cellM, {
    height,
    water,
    stage: 6,
    tier: 'high',
    machines: [
      { x: 14, z: 14, r: 2.2 },
      { x: 22, z: 18, r: 2 },
      { x: 16, z: 26, r: 2.4 },
    ],
  });
  const baked = bakePlotBiome(input);
  const tufts = baked.scatter.filter((s) => s.kind === 'tuft');
  const dM = (s: Scatter) => Math.min(...input.machines.map((m) => Math.hypot(s.x - m.x, s.z - m.z)));
  const far = tufts.filter((s) => dM(s) > 40);
  assert.ok(far.length > 0);
  for (const s of far) {
    const c = cellOf(s, cellM);
    const b = baked.cover[(c.z * n + c.x) * 4 + 2] ?? 0;
    assert.ok(b > 0);
    assert.ok(s.appear <= 6);
  }
  const near = tufts.filter((s) => dM(s) < 12);
  assert.ok(near.length > 0);
  const mean = (xs: Scatter[]) => xs.reduce((a, s) => a + s.appear, 0) / xs.length;
  assert.ok(mean(near) <= mean(far) + 1e-9);
  const later = bakePlotBiome({ ...input, stage: 5.5 });
  const farKeys = new Set(far.map((s) => `${s.x}:${s.z}`));
  for (const s of later.scatter) {
    if (s.kind !== 'tuft') continue;
    if (farKeys.has(`${s.x}:${s.z}`)) assert.ok(s.appear <= 5.5);
  }
});

test('no NaN; same input is byte-identical; different seed changes scatter', () => {
  const i = pondInput(32, 1, { stage: 5.4, seed: 99 });
  const a = bakePlotBiome(i);
  const b = bakePlotBiome(i);
  assert.equal(a.cover.length, b.cover.length);
  for (let p = 0; p < a.cover.length; p++) assert.equal(a.cover[p], b.cover[p]);
  assert.deepEqual(a.scatter, b.scatter);
  for (let p = 0; p < a.cover.length; p++) assert.equal(Number.isNaN(a.cover[p]), false);
  for (const s of a.scatter) {
    assert.equal(Number.isNaN(s.x), false);
    assert.equal(Number.isNaN(s.z), false);
    assert.equal(Number.isNaN(s.scale), false);
    assert.equal(Number.isNaN(s.yaw), false);
    assert.equal(Number.isNaN(s.appear), false);
  }
  const c = bakePlotBiome({ ...i, seed: 100 });
  assert.equal(c.cover.length, a.cover.length);
  let same = c.scatter.length === a.scatter.length;
  if (same) {
    same = JSON.stringify(c.scatter) === JSON.stringify(a.scatter);
  }
  assert.equal(same, false);
});

test('n=256 bakes in under 40 ms', () => {
  const n = 256;
  const cellM = 1;
  const height = new Float32Array(n * n);
  const water = new Uint8Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const dx = x - 90;
      const dz = z - 110;
      const d = Math.sqrt(dx * dx + dz * dz);
      height[i] = 6 + 0.02 * x + 12 * Math.exp(-((x - 180) * (x - 180)) / 900);
      if (d < 28) height[i] = 1 + d * 0.04;
      if (d < 16) water[i] = 1;
    }
  }
  const input = pondInput(n, cellM, {
    height,
    water,
    stage: 6,
    tier: 'high',
    machines: [
      { x: 40, z: 40, r: 3 },
      { x: 120, z: 70, r: 2.5 },
      { x: 70, z: 150, r: 3.2 },
    ],
  });
  bakePlotBiome(input);
  bakePlotBiome(input);
  const t0 = performance.now();
  const baked = bakePlotBiome(input);
  const ms = performance.now() - t0;
  assert.ok(baked.cover.length === n * n * 4);
  assert.ok(ms < 40, `bake took ${ms.toFixed(2)} ms`);
});

const KINDS: ScatterKind[] = ['tuft', 'bush', 'pine', 'oak', 'birch'];
test('constants match the published tables', () => {
  assert.deepEqual(CAPS, { low: 600, mid: 2000, high: 6000 });
  assert.deepEqual(SPACING, { tuft: 0.8, bush: 2, pine: 4, oak: 4.5, birch: 3.5 });
  assert.deepEqual(FIRST_STAGE, { tuft: 2, bush: 4, pine: 5, oak: 5, birch: 5 });
  assert.equal(WET_REACH, 6);
  assert.deepEqual(KINDS, ['tuft', 'bush', 'pine', 'oak', 'birch']);
});
