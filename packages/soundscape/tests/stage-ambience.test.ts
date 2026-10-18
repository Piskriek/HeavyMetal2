import test from 'node:test';
import assert from 'node:assert/strict';
import { ambiencePlan, reverbImpulse, whiteNoise, type AmbienceFloats, type AmbienceQuery } from '../src/index';

const floats = (o: Partial<AmbienceFloats> = {}): AmbienceFloats => ({ pxd: 0.3, vtx: 0.3, lx: 0.1, aq: 0.1, ...o });
const planet = (stage: number, o: Partial<AmbienceFloats> = {}, nearWater = false): AmbienceQuery => ({ where: 'planet', stage, floats: floats(o), nearWater });
const ids = (q: AmbienceQuery): string[] => ambiencePlan(q).layers.map((l) => l.id);

test('the lab: a 50 Hz hum, the vent air, and the muffled storm bed, no weather layers', () => {
  const plan = ambiencePlan({ where: 'lab', stage: 0, floats: floats(), nearWater: false });
  assert.deepEqual(plan.layers.map((l) => l.id), ['amb-lab-hum', 'amb-lab-vent']);
  assert.equal(plan.layers[0]?.freq, 50);
  assert.ok(plan.storm && plan.storm.gain > 0 && plan.storm.cutoffHz < 2000);
  assert.equal(plan.reverbWet, 0);
  assert.equal(ambiencePlan({ where: 'lab', stage: 6, floats: floats({ lx: 1, aq: 1 }), nearWater: true }).layers.length, 2);
});

test('stages 0 and 1: helmet breath, dry crunch, a thin low wind', () => {
  for (const s of [0, 1]) {
    assert.deepEqual(ids(planet(s)), ['amb-crunch', 'amb-breath', 'amb-wind-thin'], `stage ${s}`);
  }
  assert.equal(ambiencePlan(planet(1)).reverbWet, 0);
});

test('from stage 2 with Lx at least 0.35: the helmet opens, the gravel is crisper, the wind sweeps the rims', () => {
  const low = ambiencePlan(planet(2, { lx: 0.34 }));
  assert.deepEqual(low.layers.map((l) => l.id), ['amb-crunch', 'amb-breath', 'amb-wind-thin'], 'below the light threshold: still helmet on');
  const open = ambiencePlan(planet(2, { lx: 0.35, pxd: 0.5 }));
  const idsOpen = open.layers.map((l) => l.id);
  assert.ok(idsOpen.includes('amb-air-open') && idsOpen.includes('amb-wind-rims'), idsOpen.join(','));
  assert.ok(!idsOpen.includes('amb-breath'), 'the breath stops with the helmet');
  const crisp = open.layers.find((l) => l.id === 'amb-crunch')!;
  const dry = ambiencePlan(planet(1)).layers.find((l) => l.id === 'amb-crunch')!;
  assert.ok(crisp.cutoff > dry.cutoff, 'crisper gravel once open');
  assert.ok(ambiencePlan(planet(3, { lx: 0.6 })).layers.some((l) => l.id === 'amb-wind-rims'));
});

test('from stage 3, near water with Aq at least 0.40: lapping and wet steps, and not otherwise', () => {
  assert.ok(!ids(planet(3, { aq: 0.4 }, false)).includes('amb-lapping'), 'not near the water');
  assert.ok(!ids(planet(3, { aq: 0.39 }, true)).includes('amb-lapping'), 'too dry');
  assert.ok(!ids(planet(2, { aq: 0.9 }, true)).includes('amb-lapping'), 'stage 2 is too early');
  const wet = ids(planet(3, { aq: 0.4 }, true));
  assert.ok(wet.includes('amb-lapping') && wet.includes('amb-wet-steps'), wet.join(','));
});

test('from stage 4: wind in the growth, and a warmer reverb that grows with the stage', () => {
  assert.ok(!ids(planet(3)).includes('amb-growth-wind'));
  assert.ok(ids(planet(4)).includes('amb-growth-wind'));
  assert.ok(ambiencePlan(planet(4)).reverbWet > 0);
  assert.ok(ambiencePlan(planet(6)).reverbWet > ambiencePlan(planet(4)).reverbWet);
  const lush = ambiencePlan(planet(4, { vtx: 1 })).layers.find((l) => l.id === 'amb-growth-wind')!;
  const bare = ambiencePlan(planet(4, { vtx: 0 })).layers.find((l) => l.id === 'amb-growth-wind')!;
  assert.ok(lush.gain > bare.gain);
});

test('the layers change between stage 0 and stage 4', () => {
  const a = ids(planet(0));
  const b = ids(planet(4, { lx: 0.5, aq: 0.5 }, true));
  assert.notDeepEqual(a, b);
  assert.ok(b.length > a.length);
});

test('every layer is a legal synth recipe with unique ids', () => {
  const cases: AmbienceQuery[] = [
    { where: 'lab', stage: 0, floats: floats(), nearWater: false },
    planet(0), planet(2, { lx: 0.9 }), planet(3, { aq: 0.9 }, true), planet(6, { lx: 1, aq: 1, vtx: 1, pxd: 1 }, true),
  ];
  for (const q of cases) {
    const plan = ambiencePlan(q);
    const names = plan.layers.map((l) => l.id);
    assert.equal(new Set(names).size, names.length, names.join(','));
    for (const l of plan.layers) {
      assert.ok(l.gain > 0 && l.gain < 1, l.id);
      assert.ok(l.freq >= 20 && l.freq <= 16000 && l.cutoff >= 20 && l.cutoff <= 16000, l.id);
      assert.ok(l.lfoHz >= 0 && l.lfoHz <= 20 && l.lfoDepth >= 0 && l.lfoDepth <= 1, l.id);
      assert.ok(['sine', 'triangle', 'noise'].includes(l.wave));
    }
    assert.ok(plan.reverbWet >= 0 && plan.reverbWet <= 0.2);
  }
});

test('bad input is clamped: a stage fraction rounds down, NaN is stage 0', () => {
  assert.deepEqual(ids(planet(1.9)), ids(planet(1)));
  assert.deepEqual(ids(planet(Number.NaN)), ids(planet(0)));
  assert.deepEqual(ids(planet(99)), ids(planet(6)));
});

test('the noise and the reverb tail are deterministic, in range, and the tail decays', () => {
  const a = whiteNoise(1000, 7);
  const b = whiteNoise(1000, 7);
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.notDeepEqual(Array.from(a), Array.from(whiteNoise(1000, 8)));
  for (const v of a) assert.ok(v >= -1 && v < 1);
  const ir = reverbImpulse(1, 1000, 3);
  assert.equal(ir.length, 1000);
  const rms = (xs: Float32Array, from: number, to: number): number => {
    let s = 0;
    for (let i = from; i < to; i++) s += (xs[i] ?? 0) ** 2;
    return Math.sqrt(s / (to - from));
  };
  assert.ok(rms(ir, 900, 1000) < rms(ir, 0, 100) * 0.05, 'the tail is much quieter at the end');
});
