import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, METRICS, LIMITS, encode, decode, type Snapshot } from '../src/index';

const snap = (n: number): Snapshot => ({
  v: 1, owner: 'Ada', stage: 3, time: 5025.5,
  points: { pxd: 1234.5, vtx: 99, lx: 0, aq: 7 },
  cartridges: [{ name: 'Mud + Terrain shaping', affinity: { pxd: 1.55, vtx: 1.5, lx: 1, aq: 1 } }],
  machines: Array.from({ length: n }, (_, i) => ({
    kind: KINDS[i % KINDS.length]!, x: Math.cos(i) * (i % 480), z: Math.sin(i) * (i % 480),
    yaw: ((i * 0.37) % (2 * Math.PI)) - Math.PI, on: i % 5 !== 0, cartridge: i % 7 === 0 ? 0 : -1,
  })),
});
const safeDecode = (t: string): Snapshot | null => { try { return decode(t); } catch (e) { assert.fail(`decode threw: ${String(e)}`); } };

test('a snapshot survives encode and decode within the stated precision', () => {
  const s = snap(50);
  const d = decode(encode(s));
  assert.ok(d);
  assert.equal(d.v, 1); assert.equal(d.owner, 'Ada'); assert.equal(d.stage, 3);
  assert.equal(d.machines.length, 50);
  for (let i = 0; i < 50; i++) {
    const a = s.machines[i]!, b = d.machines[i]!;
    assert.equal(b.kind, a.kind); assert.equal(b.on, a.on); assert.equal(b.cartridge, a.cartridge);
    assert.ok(Math.abs(b.x - a.x) <= 0.005 && Math.abs(b.z - a.z) <= 0.005, `machine ${i} moved`);
    assert.ok(Math.abs(b.yaw - a.yaw) <= 0.0005, `machine ${i} turned`);
  }
  assert.equal(d.cartridges[0]!.name, 'Mud + Terrain shaping');
  assert.ok(Math.abs(d.cartridges[0]!.affinity.pxd - 1.55) <= 0.0005);
  for (const m of METRICS) assert.ok(Math.abs(d.points[m] - s.points[m]) <= Math.abs(s.points[m]) * 1e-6 + 1e-9);
  assert.ok(Math.abs(d.time - s.time) <= s.time * 1e-6);
});

test('the same snapshot always gives the same URL-safe text, and re-encoding changes nothing', () => {
  const a = encode(snap(20)), b = encode(snap(20));
  assert.equal(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.equal(encode(decode(a)!), a);
  const intl: Snapshot = { ...snap(2), owner: 'Zoë 🚀', cartridges: [{ name: 'Mousse ünd Moos', affinity: { pxd: 0.5, vtx: 3, lx: 1, aq: 1.25 } }] };
  assert.equal(decode(encode(intl))!.owner, 'Zoë 🚀');
  assert.equal(decode(encode(intl))!.cartridges[0]!.name, 'Mousse ünd Moos');
});

test('machines are compact, and the largest allowed plot fits', () => {
  const plain: Snapshot = { ...snap(LIMITS.maxMachines), cartridges: [], machines: snap(LIMITS.maxMachines).machines.map((m) => ({ ...m, cartridge: -1 })) };
  assert.ok(encode(plain).length <= Math.ceil(((LIMITS.maxMachines * 16) + 256) * 4 / 3), `${encode(plain).length} chars`);
  const big: Snapshot = { ...snap(LIMITS.maxMachines), cartridges: Array.from({ length: LIMITS.maxCartridges }, (_, i) => ({ name: 'x'.repeat(LIMITS.nameBytes), affinity: { pxd: 1 + (i % 1000) / 1000, vtx: 1, lx: 1, aq: 1 } })) };
  assert.ok(decode(encode(big)));
  assert.throws(() => encode(snap(LIMITS.maxMachines + 1)));
  assert.equal(safeDecode('A'.repeat(Math.ceil(LIMITS.maxBytes * 4 / 3) + 100)), null);
});

test('encode refuses what decode would refuse', () => {
  const s = snap(3);
  assert.throws(() => encode({ ...s, owner: '' }));
  assert.throws(() => encode({ ...s, owner: '   ' }));
  assert.throws(() => encode({ ...s, owner: 'x'.repeat(LIMITS.ownerBytes + 1) }));
  assert.throws(() => encode({ ...s, owner: 'bad\u0007name' }));
  assert.throws(() => encode({ ...s, stage: 7 }));
  assert.throws(() => encode({ ...s, stage: 1.5 }));
  assert.throws(() => encode({ ...s, time: Number.NaN }));
  assert.throws(() => encode({ ...s, points: { ...s.points, lx: -1 } }));
  assert.throws(() => encode({ ...s, machines: [{ ...s.machines[0]!, x: 600, z: 0 }] }));
  assert.throws(() => encode({ ...s, machines: [{ ...s.machines[0]!, yaw: 4 }] }));
  assert.throws(() => encode({ ...s, machines: [{ ...s.machines[0]!, cartridge: 5 }] }));
  assert.throws(() => encode({ ...s, cartridges: [{ name: 'Hot', affinity: { pxd: 3.5, vtx: 1, lx: 1, aq: 1 } }] }));
});

test('decode never throws: junk, truncation, extra characters and random damage give null or a valid snapshot', () => {
  const good = encode(snap(30));
  for (const bad of ['', '!!!', 'AAAA', good.slice(0, good.length >> 1), good + 'A', good + 'AAAA', '\u0000' + good]) {
    assert.equal(safeDecode(bad), null, `accepted ${bad.slice(0, 12)}...`);
  }
  let seed = 12345;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let k = 0; k < 3000; k++) {
    const i = Math.floor(rnd() * good.length);
    const d = safeDecode(good.slice(0, i) + alphabet[Math.floor(rnd() * 64)] + good.slice(i + 1));
    if (!d) continue;
    assert.ok(d.machines.length <= LIMITS.maxMachines && d.stage >= 0 && d.stage <= 6 && Number.isInteger(d.stage));
    assert.ok(Number.isFinite(d.time) && d.time >= 0);
    for (const m of d.machines) {
      assert.ok(KINDS.includes(m.kind) && Math.hypot(m.x, m.z) <= LIMITS.plotRadius + 1e-6);
      assert.ok(m.yaw >= -Math.PI - 1e-9 && m.yaw <= Math.PI + 1e-9);
      assert.ok(m.cartridge >= -1 && m.cartridge < d.cartridges.length && Number.isInteger(m.cartridge));
    }
    for (const c of d.cartridges) for (const mt of METRICS) assert.ok(c.affinity[mt] >= 0.5 && c.affinity[mt] <= 3);
  }
});

test('performance: decoding a full plot a hundred times takes under 300 ms', () => {
  const text = encode({ ...snap(LIMITS.maxMachines), machines: snap(LIMITS.maxMachines).machines.map((m) => ({ ...m, cartridge: -1 })), cartridges: [] });
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) assert.ok(decode(text));
  assert.ok(performance.now() - t0 < 300, `${performance.now() - t0} ms`);
});
