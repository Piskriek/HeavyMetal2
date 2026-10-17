// Hidden oracle for the plotbiome battle (TICKET-02 item C). Not shown to the models. Run against one answer:
//   PLOTBIOME_MODULE=arena-out/plotbiome/A/src/plotbiome.ts node --import tsx --test docs/handoff/prompts/battle/tests/plotbiome.oracle.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const path = resolve(process.env.PLOTBIOME_MODULE ?? '');
const m: any = await import(pathToFileURL(path).href);

// ---- the test plot: a crater with a lake, a steep ridge, 3 machines and a keep-out
function terrain(n: number, cellM: number) {
  const height = new Float32Array(n * n), water = new Uint8Array(n * n);
  const L = n * cellM, cx = L / 2, cz = L / 2, R = L * 0.23;
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const wx = (x + 0.5) * cellM, wz = (z + 0.5) * cellM, r = Math.hypot(wx - cx, wz - cz);
    let h = r < R ? -8 * (1 - (r / R) ** 2) : 0;
    h += 3 * Math.exp(-(((r - R) / 8) ** 2));
    h += 25 * Math.exp(-(((wx - L * 0.8) / 10) ** 2));
    h += 0.6 * Math.sin(wx * 0.07) * Math.cos(wz * 0.05);
    height[z * n + x] = h;
    if (h < -5) water[z * n + x] = 1;
  }
  const machines = [{ x: L * 0.35, z: L * 0.5, r: 4 }, { x: L * 0.66, z: L * 0.55, r: 4 }, { x: L * 0.5, z: L * 0.23, r: 5 }];
  const keepouts = [{ x0: L * 0.08, z0: L * 0.08, x1: L * 0.16, z1: L * 0.16 }];
  return { n, cellM, height, water, machines, keepouts };
}
const T = terrain(128, 2);
const input = (o: Record<string, unknown> = {}) => ({ ...T, stage: 6, s: { pxd: 0.8, vtx: 0.8, lx: 0.8, aq: 0.8 }, seed: 1234, tier: 'high', ...o });
const bake = (o: Record<string, unknown> = {}) => m.bakePlotBiome(input(o));

function refSlope(h: Float32Array, n: number, cellM: number, x: number, z: number): number {
  const at = (i: number, j: number) => h[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))]!;
  const gx = x === 0 ? (at(1, z) - at(0, z)) / cellM : x === n - 1 ? (at(x, z) - at(x - 1, z)) / cellM : (at(x + 1, z) - at(x - 1, z)) / (2 * cellM);
  const gz = z === 0 ? (at(x, 1) - at(x, 0)) / cellM : z === n - 1 ? (at(x, z) - at(x, z - 1)) / cellM : (at(x, z + 1) - at(x, z - 1)) / (2 * cellM);
  return (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
}
const cellOf = (x: number, z: number) => [Math.floor(x / T.cellM), Math.floor(z / T.cellM)] as const;
const STAGES = [0, 1, 1.99, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
const byStage = new Map<number, { cover: Uint8Array; scatter: any[] }>();
for (const s of STAGES) byStage.set(s, bake({ stage: s }));
const full = byStage.get(6)!;

test('exports and constants', () => {
  for (const k of ['bakePlotBiome', 'slopeDeg']) assert.equal(typeof m[k], 'function', k);
  assert.deepEqual({ ...m.CAPS }, { low: 600, mid: 2000, high: 6000 });
  assert.deepEqual({ ...m.FIRST_STAGE }, { tuft: 2, bush: 4, pine: 5, oak: 5, birch: 5 });
  assert.equal(m.WET_REACH, 6);
});

test('slopeDeg matches central differences, one-sided at edges', () => {
  for (const [x, z] of [[0, 0], [5, 9], [127, 64], [64, 127], [102, 50], [60, 60]] as const) {
    assert.ok(Math.abs(m.slopeDeg(T.height, T.n, T.cellM, x, z) - refSlope(T.height, T.n, T.cellM, x, z)) < 1e-4, `${x},${z}`);
  }
});

test('wet channel: 255 on water, linear fall-off over WET_REACH', () => {
  const wet: [number, number][] = [];
  for (let i = 0; i < T.n * T.n; i++) if (T.water[i]) wet.push([i % T.n, Math.floor(i / T.n)]);
  assert.ok(wet.length > 50);
  let bad = 0;
  for (let k = 0; k < 400; k++) {
    const i = (k * 7919) % (T.n * T.n), x = i % T.n, z = Math.floor(i / T.n);
    let want = 255;
    if (!T.water[i]) { let d = Infinity; for (const [wx, wz] of wet) d = Math.min(d, Math.hypot(wx - x, wz - z) * T.cellM); want = Math.round(255 * Math.max(0, 1 - d / 6)); }
    if (Math.abs(full.cover[i * 4 + 3]! - want) > 1) bad++;
  }
  assert.equal(bad, 0);
});

test('below stage 2: no moss, no grass, no scatter', () => {
  for (const s of [0, 1, 1.99]) {
    const b = byStage.get(s)!;
    assert.equal(b.scatter.length, 0);
    for (let i = 0; i < T.n * T.n; i++) assert.ok(b.cover[i * 4 + 1] === 0 && b.cover[i * 4 + 2] === 0, `stage ${s}`);
  }
});

test('cover is monotone in stage (G, B up; R down; A fixed)', () => {
  for (let k = 1; k < STAGES.length; k++) {
    const a = byStage.get(STAGES[k - 1]!)!.cover, b = byStage.get(STAGES[k]!)!.cover;
    for (let i = 0; i < T.n * T.n; i++) {
      assert.ok(b[i * 4 + 1]! >= a[i * 4 + 1]! && b[i * 4 + 2]! >= a[i * 4 + 2]! && b[i * 4]! <= a[i * 4]! && b[i * 4 + 3] === a[i * 4 + 3], `cell ${i} ${STAGES[k - 1]}->${STAGES[k]}`);
    }
  }
});

test('cover is monotone in aq and lx; zero on water and steep cells', () => {
  for (const key of ['aq', 'lx'] as const) {
    const lo = bake({ stage: 5, s: { pxd: 0.8, vtx: 0.8, lx: 0.8, aq: 0.8, [key]: 0.2 } }).cover, hi = bake({ stage: 5, s: { pxd: 0.8, vtx: 0.8, lx: 0.8, aq: 0.8, [key]: 0.9 } }).cover;
    for (let i = 0; i < T.n * T.n; i++) assert.ok(hi[i * 4 + 1]! >= lo[i * 4 + 1]! && hi[i * 4 + 2]! >= lo[i * 4 + 2]!, `${key} cell ${i}`);
  }
  let steep = 0;
  for (let z = 0; z < T.n; z++) for (let x = 0; x < T.n; x++) {
    const i = z * T.n + x, sl = refSlope(T.height, T.n, T.cellM, x, z);
    if (T.water[i]) assert.ok(full.cover[i * 4 + 1] === 0 && full.cover[i * 4 + 2] === 0, 'water');
    if (sl > 35.5) { steep++; assert.equal(full.cover[i * 4 + 2], 0, `B on slope ${sl}`); }
    if (sl > 45.5) assert.equal(full.cover[i * 4 + 1], 0, `G on slope ${sl}`);
  }
  assert.ok(steep > 20, 'the test ridge has steep cells');
});

test('scatter grows monotonically: present iff appear <= stage, fields identical', () => {
  const key = (s: any) => `${s.kind}|${s.x}|${s.z}`;
  const all = new Map(full.scatter.map((s) => [key(s), s]));
  assert.ok(full.scatter.length < 6000, 'under the cap for this check');
  for (const st of STAGES) {
    const b = byStage.get(st)!;
    for (const s of b.scatter) assert.deepEqual(s, all.get(key(s)), 'same fields at every stage');
    const want = full.scatter.filter((s) => s.appear <= st).length;
    assert.equal(b.scatter.length, want, `count at stage ${st}`);
  }
});

test('placement rules, ranges and kinds', () => {
  const L = T.n * T.cellM;
  const kinds = new Set<string>();
  for (const s of full.scatter) {
    kinds.add(s.kind);
    for (const v of [s.x, s.z, s.scale, s.yaw, s.appear]) assert.ok(Number.isFinite(v));
    assert.ok(s.x >= 0 && s.x < L && s.z >= 0 && s.z < L, 'inside the plot');
    const [cx, cz] = cellOf(s.x, s.z), i = cz * T.n + cx;
    assert.equal(T.water[i], 0, 'not on water');
    assert.ok(refSlope(T.height, T.n, T.cellM, cx, cz) <= 35.5, 'not on a steep cell');
    for (const mc of T.machines) assert.ok(Math.hypot(s.x - mc.x, s.z - mc.z) >= mc.r - 1e-9, 'machine keep-out');
    for (const k of T.keepouts) assert.ok(!(s.x >= k.x0 && s.x <= k.x1 && s.z >= k.z0 && s.z <= k.z1), 'keep-out rect');
    assert.ok(s.appear >= m.FIRST_STAGE[s.kind] - 1e-9 && s.appear <= 6 + 1e-9, 'appear range');
    assert.ok(s.scale >= 0.7 && s.scale <= 1.3 && s.yaw >= 0 && s.yaw < 2 * Math.PI, 'scale/yaw');
    if (s.kind === 'pine' || s.kind === 'oak' || s.kind === 'birch') assert.ok(full.cover[i * 4 + 1]! >= 128 || full.cover[i * 4 + 2]! >= 128, 'trees on cover');
  }
  for (const k of ['tuft', 'bush']) assert.ok(kinds.has(k), `has ${k}`);
  assert.ok(['pine', 'oak', 'birch'].some((k) => kinds.has(k)), 'has trees');
});

test('spacing between every pair', () => {
  const sp = m.SPACING as Record<string, number>, maxSp = Math.max(...Object.values(sp));
  const grid = new Map<string, any[]>();
  for (const s of full.scatter) { const k = `${Math.floor(s.x / maxSp)},${Math.floor(s.z / maxSp)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(s); }
  for (const s of full.scatter) {
    const gx = Math.floor(s.x / maxSp), gz = Math.floor(s.z / maxSp);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const o of grid.get(`${gx + dx},${gz + dz}`) ?? []) {
      if (o === s) continue;
      assert.ok(Math.hypot(s.x - o.x, s.z - o.z) >= Math.max(sp[s.kind]!, sp[o.kind]!) - 1e-9, `${s.kind}/${o.kind} too close`);
    }
  }
});

test('tufts appear nearest the machines first', () => {
  const near: number[] = [], far: number[] = [];
  for (const s of full.scatter.filter((x) => x.kind === 'tuft')) {
    const d = Math.min(...T.machines.map((mc) => Math.hypot(s.x - mc.x, s.z - mc.z)));
    if (d < 15) near.push(s.appear); else if (d > 40) far.push(s.appear);
  }
  const avg = (a: number[]) => a.reduce((p, c) => p + c, 0) / Math.max(1, a.length);
  assert.ok(near.length > 3 && far.length > 3 && avg(near) < avg(far), `near ${avg(near)} far ${avg(far)}`);
});

test('caps hold, and growth stays monotone under the cap', () => {
  const big = terrain(256, 2);
  const run = (stage: number) => m.bakePlotBiome({ ...big, stage, s: { pxd: 1, vtx: 1, lx: 1, aq: 1 }, seed: 9, tier: 'low' });
  const a = run(5), b = run(6);
  assert.ok(b.scatter.length <= 600);
  const keys = new Set(b.scatter.map((s: any) => `${s.kind}|${s.x}|${s.z}`));
  for (const s of a.scatter) assert.ok(keys.has(`${s.kind}|${s.x}|${s.z}`), 'stage-5 instance kept at stage 6 under the cap');
});

test('deterministic, seed-sensitive, inputs untouched', () => {
  const h0 = T.height.slice(), w0 = T.water.slice();
  const a = bake(), b = bake();
  assert.deepEqual(a.cover, b.cover);
  assert.deepEqual(a.scatter, b.scatter);
  assert.notDeepEqual(bake({ seed: 99 }).scatter, a.scatter);
  assert.deepEqual(T.height, h0);
  assert.deepEqual(T.water, w0);
});

test('speed: n=256 at stage 6 (spec 40 ms; oracle allows 80)', () => {
  const big = terrain(256, 2), times: number[] = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); m.bakePlotBiome({ ...big, stage: 6, s: { pxd: 1, vtx: 1, lx: 1, aq: 1 }, seed: k, tier: 'high' }); times.push(performance.now() - t0); }
  times.sort((p, q) => p - q);
  console.log(`plotbiome n=256 median ${times[1]!.toFixed(1)} ms`);
  assert.ok(times[1]! < 80);
});

test('purity: no imports, randomness, clocks or DOM', () => {
  const src = readFileSync(path, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const bad of [/\bimport\s/, /\brequire\(/, /Math\.random/, /\bDate\b/, /\bdocument\b/, /\bwindow\b/, /performance\.now/]) assert.ok(!bad.test(src), String(bad));
});
