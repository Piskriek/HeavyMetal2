// Plan 56 W2: the experience writer. A preset's memory hardens with excitement, takes on the distortion of the
// thinking above it, learns how its distortions relate, knows which rule left what, and keeps everything on "repeat".
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIGNED, MAX_EPISODES, decodeMem, encodeMem, formatFrame, parseFrame, type Mem } from '@hm/shorthand';
import {
  BALANCED_AT, CHARGE_GAIN, CURRICULUM_START, SQ_DISTORTION_CATALOG, createPresetMemory, dominantDistortion, openCausesFrom,
  predictDistortion, recordExperience, repeatCurriculum, symptomOffset, type Experience,
} from '../src/index';

const at = (t: number, over: Partial<Experience> = {}): Experience => ({
  t, stage: 'S1', cat: 'WEAPON_BURST_CADENCE', excitement: 0.8, error: 0.2, by: 'solar-control', ...over,
});
const write = (mem: Mem, xs: readonly Experience[]): Mem => xs.reduce(recordExperience, mem);

test('a new memory is soft, balanced and empty, and its rung thinks aligned', () => {
  const m = createPresetMemory('loc:ab12cd34');
  assert.equal(m.hard, 0);
  assert.equal(m.bal, 1);
  assert.deepEqual(m.charge, [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(m.ep.length, 0);
  assert.equal(dominantDistortion(m), ALIGNED);
  assert.equal(symptomOffset(m, 99), 0);
});

test('excitement hardens; distorted thinking above charges the ray of the distortion it leaves', () => {
  const m0 = createPresetMemory('loc:ab12cd34');
  const excited = recordExperience(m0, at(1, { excitement: 1 }));
  const calm = recordExperience(m0, at(1, { excitement: 0.1, by: ALIGNED }));
  assert.ok(excited.hard > calm.hard, `${excited.hard} > ${calm.hard}`);
  assert.equal(excited.ep[0]?.h, 1, 'the episode weighs its excitement');
  const solar = SQ_DISTORTION_CATALOG['solar-control'].rayIndex - 1;
  assert.equal(excited.charge[solar], CHARGE_GAIN);
  assert.equal(excited.ep[0]?.d, 'solar-control', 'with nothing learned yet, the same type comes down');
  assert.deepEqual(calm.charge, [0, 0, 0, 0, 0, 0, 0], 'aligned thinking leaves no charge');
  assert.equal(calm.ep[0]?.d, ALIGNED);
  // more excitement, harder memory (monotone)
  const hs = [0, 0.25, 0.5, 0.75, 1].map((e) => recordExperience(m0, at(1, { excitement: e })).hard);
  for (let i = 1; i < hs.length; i++) assert.ok(hs[i]! >= hs[i - 1]!, hs.join(' '));
  // hardness saturates below 1 and never falls on a write
  const long = write(m0, Array.from({ length: 60 }, (_, i) => at(i, { excitement: 1 })));
  assert.ok(long.hard > 0.99 && long.hard <= 1, String(long.hard));
});

test('the record holds 32: the lightest episode goes first (the oldest of equals), and the newest always enters', () => {
  let m = createPresetMemory('logic:00ff');
  for (let i = 0; i < 40; i++) m = recordExperience(m, at(i, { excitement: i % 2 === 0 ? 0.9 : 0.1, by: ALIGNED }));
  assert.equal(m.ep.length, MAX_EPISODES);
  assert.equal(m.ep[m.ep.length - 1]?.t, 39, 'the newest is in');
  // 8 light ones went, oldest first: the light ones left are the 12 newest odd ticks
  const light = m.ep.filter((e) => e.h < 0.5).map((e) => e.t);
  assert.deepEqual(light, [17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39]);
  assert.equal(m.ep.filter((e) => e.h > 0.5).length, 20, 'every excited episode is kept');
});

test('how distortions relate: observed distortions teach the cause links, which then predict the unobserved', () => {
  let m = createPresetMemory('loc:ab12cd34');
  // three times an observer sees control above leave reactivity here
  for (let i = 0; i < 3; i++) m = recordExperience(m, at(i, { felt: 'root-reactivity' }));
  const link = m.cause.find((c) => c.by === 'solar-control' && c.d === 'root-reactivity');
  assert.equal(link?.n, 3);
  assert.equal(link?.open, true);
  assert.equal(predictDistortion(m, 'solar-control'), 'root-reactivity');
  // the next time nobody observes: the link predicts it, and the root ray takes the charge
  const next = recordExperience(m, at(10));
  assert.equal(next.ep[next.ep.length - 1]?.d, 'root-reactivity');
  assert.equal(next.charge[0], 4 * Math.round(0.8 * CHARGE_GAIN));
  // a type it has learned nothing about comes down as itself; aligned stays aligned
  assert.equal(predictDistortion(m, 'sacral-guilt'), 'sacral-guilt');
  assert.equal(predictDistortion(m, ALIGNED), ALIGNED);
  // an observer seeing nothing wrong overrides the prediction
  const fine = recordExperience(m, at(11, { felt: ALIGNED }));
  assert.equal(fine.ep[fine.ep.length - 1]?.d, ALIGNED);
  assert.deepEqual(fine.charge, m.charge);
});

test('the cause links stay within 64: a closed link goes before an open one, the smallest first', () => {
  let m = createPresetMemory('loc:ab12cd34');
  const ids = ['root-lack', 'root-fear', 'root-reactivity', 'root-apathy', 'root-trauma', 'sacral-guilt', 'sacral-shame', 'solar-pride'] as const;
  const bys = ['solar-control', 'solar-anxiety', 'sacral-resistance', 'root-fear', 'sacral-frustration', 'solar-pride', 'root-trauma', 'sacral-addiction'] as const;
  let t = 0;
  for (const by of bys) for (const d of ids) m = recordExperience(m, at(t++, { by, felt: d, excitement: 0.01 }));
  assert.equal(m.cause.length, 64);
  // close one link by hand (the dream's job, W3) and add a 65th pair: the closed one goes
  const closed = { ...m, cause: m.cause.map((c, i) => (i === 5 ? { ...c, open: false } : c)) };
  const gone = closed.cause[5]!;
  const after = recordExperience(closed, at(t++, { by: 'thirdeye-illumination', felt: 'heart-awakening', excitement: 0.01 }));
  assert.equal(after.cause.length, 64);
  assert.ok(!after.cause.some((c) => c.by === gone.by && c.d === gone.d), 'the closed link made room');
  assert.ok(after.cause.some((c) => c.by === 'thirdeye-illumination' && c.d === 'heart-awakening'));
});

test('a rung thinks its own dominant distortion: memory as a rung is presets inside presets', () => {
  let m = createPresetMemory('brain:0a0b');
  for (let i = 0; i < 4; i++) m = recordExperience(m, at(i, { excitement: 1 }));
  assert.ok(m.bal < BALANCED_AT, String(m.bal));
  assert.equal(dominantDistortion(m), 'solar-control');
  // a heavier sacral charge takes over
  for (let i = 0; i < 6; i++) m = recordExperience(m, at(10 + i, { excitement: 1, by: 'sacral-guilt' }));
  assert.equal(dominantDistortion(m), 'sacral-guilt');
  // a memory past rest the other way (antidote overshoot) thinks aligned
  assert.equal(dominantDistortion({ ...m, charge: [0, -90, -40, 0, 0, 0, 0], bal: 0.3 }), ALIGNED);
});

test('which upper-rung rule left which offset: the rule that opened a distortion answers for it', () => {
  let m = createPresetMemory('mot:beef');
  m = recordExperience(m, at(1, { src: 'logic:mimic-reflex' }));
  m = recordExperience(m, at(2, { src: 'logic:turret' }));
  m = recordExperience(m, at(3, { src: 'logic:mimic-reflex', by: ALIGNED }));
  const reflex = openCausesFrom(m, 'logic:mimic-reflex');
  assert.deepEqual(reflex.map((e) => e.t), [1], 'only its distorted episode with an open link');
  assert.deepEqual(openCausesFrom(m, 'logic:turret').map((e) => e.t), [2]);
  // once the link is closed (balanced, W3) the rule answers for nothing
  const closed = { ...m, cause: m.cause.map((c) => ({ ...c, open: false })) };
  assert.equal(openCausesFrom(closed, 'logic:mimic-reflex').length, 0);
});

test('"repeat" goes round the curriculum again from S0a and keeps every memory', () => {
  let m = createPresetMemory('loc:ab12cd34');
  for (let i = 0; i < 12; i++) m = recordExperience(m, at(i, { felt: i % 2 === 0 ? 'root-reactivity' : undefined, src: 'logic:reflex' }));
  const { mem: again, stage } = repeatCurriculum(m);
  assert.equal(stage, CURRICULUM_START);
  assert.equal(again.cyc, m.cyc + 1);
  assert.deepEqual(again.ep, m.ep);
  assert.deepEqual(again.cause, m.cause);
  assert.deepEqual(again.charge, m.charge);
  assert.equal(again.hard, m.hard);
  assert.equal(again.bal, m.bal);
  // it keeps learning from S0a, on top of what it had
  const next = recordExperience(again, at(100, { stage }));
  assert.equal(next.ep.length, m.ep.length + 1);
  assert.equal(next.ep[next.ep.length - 1]?.stage, 'S0a');
  assert.equal(repeatCurriculum({ ...m, cyc: 65535 }).mem.cyc, 65535, 'the count saturates');
});

test('deterministic, and the memory crosses the shorthand: text form and share code', () => {
  const run = (): Mem => write(createPresetMemory('loc:ab12cd34'), Array.from({ length: 40 }, (_, i) => at(i * 3, {
    excitement: (i * 37 % 100) / 100, error: (i * 11 % 100) / 100, by: i % 3 === 0 ? ALIGNED : 'solar-control',
    ...(i % 5 === 0 ? { felt: 'root-fear' as const } : {}), ...(i % 4 === 0 ? { src: 'logic:reflex' } : {}),
  })));
  const a = run(), b = run();
  assert.equal(encodeMem(a), encodeMem(b));
  assert.deepStrictEqual(decodeMem(encodeMem(a)), a);
  const frame = { schema: 'hm2:shorthand:v1' as const, game: 'fidelity', src: 'api' as const, t: 1, seq: 1, perm: ['mem' as const], ents: [], facts: [], rules: [], orders: [], mems: [a] };
  assert.deepStrictEqual(parseFrame(formatFrame(frame))?.mems[0], a);
});

test('the symptom: balanced memories are still, distorted ones jitter within 1 − bal, the same way every time', () => {
  let m = createPresetMemory('loc:ab12cd34');
  for (let i = 0; i < 3; i++) m = recordExperience(m, at(i, { excitement: 1 }));
  const amp = 1 - m.bal;
  const xs = Array.from({ length: 200 }, (_, t) => symptomOffset(m, t));
  assert.ok(xs.every((x) => Math.abs(x) <= amp + 1e-12));
  assert.ok(xs.some((x) => x > amp / 2) && xs.some((x) => x < -amp / 2), 'it moves both ways');
  assert.deepEqual(xs, Array.from({ length: 200 }, (_, t) => symptomOffset(m, t)));
  assert.notDeepEqual(xs, Array.from({ length: 200 }, (_, t) => symptomOffset(m, t, 1)), 'the seed changes the pattern');
});

test('invalid experiences are refused', () => {
  const m = createPresetMemory('loc:ab12cd34');
  assert.throws(() => recordExperience(m, at(-1)), /tick/);
  assert.throws(() => recordExperience(m, at(1.5)), /tick/);
  assert.throws(() => recordExperience(m, at(1, { excitement: Number.NaN })), /excitement/);
  assert.throws(() => recordExperience(m, at(1, { by: 'not-a-type' as never })));
  assert.throws(() => recordExperience(m, at(1, { src: 'https://x' })));
  // out-of-range excitement and error are clamped, not refused
  assert.equal(recordExperience(m, at(1, { excitement: 7, error: -2 })).ep[0]?.ex, 1);
});
