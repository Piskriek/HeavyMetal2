// Plan 56 W4 and §12: polarity (a lean between the structure and flow poles), dyads (complementary partners, symmetric),
// and the Overwatch's inherited pack (data exact, behaviour distilled, pooled when aligned, a digest any AI can read).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIGNED, type Mem } from '@hm/shorthand';
import {
  DYAD_INV_MAX, POLE_MIN, SQ_DISTORTION_CATALOG, compileSystemMemory, createPresetMemory, digestLines, dream, dyadInvestment,
  findDyads, higherSelfFrame, packFromJson, packToJson, polarityFromFloats, polarityOf, poleOf, recordExperience,
  type Experience, type SystemEgo,
} from '../src/index';

const SOLAR = SQ_DISTORTION_CATALOG['solar-control'].rayIndex - 1;
const at = (t: number, over: Partial<Experience> = {}): Experience => ({
  t, stage: 'S2', cat: 'WEAPON_BURST_CADENCE', excitement: 0.6, error: 0.2, by: ALIGNED, ...over,
});
const write = (mem: Mem, xs: readonly Experience[]): Mem => xs.reduce(recordExperience, mem);
/** Two presets of opposite poles that worked the same catalysts side by side, three times. */
const pair = (): [Mem, Mem] => [
  write(createPresetMemory('kit:00aa'), [at(100), at(200), at(300)]),
  write(createPresetMemory('species:00bb'), [at(110), at(205), at(330)]),
];

test('polarity is a lean: declared wins, else the kind\'s float family, else balanced; an ego\'s comes from its four floats', () => {
  assert.equal(polarityOf(createPresetMemory('kit:0001')), 96, 'parts and kits (Vtx): intent');
  assert.equal(polarityOf(createPresetMemory('matc:0001')), 64, 'materials (Pxd): intent');
  assert.equal(polarityOf(createPresetMemory('lx:0001')), -64, 'light (Lx): context');
  assert.equal(polarityOf(createPresetMemory('species:0001')), -96, 'species (Aq): context');
  assert.equal(polarityOf(createPresetMemory('loc:0001')), 0, 'behaviour kinds: balanced until measured');
  assert.equal(polarityOf({ ...createPresetMemory('kit:0001'), pol: -20 }), -20, 'a declaration wins');
  assert.deepEqual([poleOf(POLE_MIN), poleOf(POLE_MIN - 1), poleOf(-POLE_MIN), poleOf(0)], ['intent', 'balanced', 'context', 'balanced']);
  assert.deepEqual([polarityFromFloats([1, 1, 0, 0]), polarityFromFloats([0, 0, 1, 1]), polarityFromFloats([0.5, 0.5, 0.5, 0.5])], [127, -127, 0]);
});

test('a dyad is two presets of opposite poles that acted on the same catalyst together, with good outcomes', () => {
  const [kit, species] = pair();
  const d = findDyads([species, kit]);
  assert.deepEqual(d, [{ a: 'kit:00aa', b: 'species:00bb', strength: 3, whole: true }], 'sorted partners; both balanced and nearly cancelling: whole');
  assert.deepEqual(findDyads([kit, species]), d, 'the order of the presets does not matter');
  // the same pole twice is no dyad; another catalyst, too far apart, or bad outcomes are no co-act
  assert.equal(findDyads([kit, write(createPresetMemory('part:00cc'), [at(100)])]).length, 0);
  assert.equal(findDyads([kit, write(createPresetMemory('lx:00dd'), [at(100, { cat: 'OBJECTIVE_PLANT_OR_HARMONIZE' })])]).length, 0);
  assert.equal(findDyads([kit, write(createPresetMemory('lx:00dd'), [at(1000)])]).length, 0);
  assert.equal(findDyads([kit, write(createPresetMemory('lx:00dd'), [at(100, { error: 0.9 })])]).length, 0);
  // not whole while one partner is distorted
  const bent = write(createPresetMemory('species:00bb'), [at(110), at(205, { by: 'solar-control', excitement: 1 }), at(330, { by: 'solar-control', excitement: 1 }), at(340, { by: 'solar-control', excitement: 1 }), at(350, { by: 'solar-control', excitement: 1 })]);
  assert.equal(findDyads([kit, bent])[0]?.whole, false);
});

test('a partner lends investment: a floor for both, the same each time it is counted, never over the player\'s own', () => {
  const [kit, species] = pair();
  const d = findDyads([kit, species]);
  const once = dyadInvestment([kit, species], d);
  assert.deepEqual(once.map((m) => m.inv), [0.15, 0.15], 'symmetric: both partners');
  assert.deepEqual(dyadInvestment(once, d).map((m) => m.inv), [0.15, 0.15], 'a floor, not a sum');
  assert.equal(dyadInvestment([{ ...kit, inv: 0.8 }, species], d)[0]!.inv, 0.8, 'the player\'s higher investment stands');
  const strong = [{ a: 'kit:00aa', b: 'species:00bb', strength: 99, whole: false }];
  assert.equal(dyadInvestment([kit, species], strong)[0]!.inv, DYAD_INV_MAX);
});

test('in a dream a balanced partner of the other pole lends its cue, both ways; a distorted partner lends nothing', () => {
  // a rigid structure preset (hardened under control), and its balanced flow partner
  const [kit0, species] = pair();
  const kit = write(kit0, Array.from({ length: 6 }, (_, i) => at(400 + i, { by: 'solar-control', excitement: 1 })));
  const dyads = findDyads([kit, species]);
  assert.equal(dyads.length, 1);
  const input = { ego: createPresetMemory('brain:0e90'), presets: [kit, species], weights: { prefer: {} }, now: 500, cues: [] as const };
  const alone = dream(input);
  assert.equal(alone.presets[0]!.charge[SOLAR], kit.charge[SOLAR], 'with the Higher Self silent and no partner, it holds on');
  const paired = dream({ ...input, dyads });
  assert.ok((paired.presets[0]!.charge[SOLAR] ?? 0) < (kit.charge[SOLAR] ?? 0), 'the flow partner\'s cue opened it');
  assert.ok(paired.digest.replayed.some((r) => r.partner === 'species:00bb'));
  // the other way round: a distorted flow preset with a balanced structure partner
  const [kit2, species0] = pair();
  const bentFlow = write(species0, Array.from({ length: 6 }, (_, i) => at(400 + i, { by: 'sacral-insecurity', excitement: 1 })));
  const flowDream = dream({ ...input, presets: [kit2, bentFlow], dyads: findDyads([kit2, bentFlow]) });
  assert.ok(flowDream.digest.replayed.some((r) => r.of === 'species:00bb' && r.partner === 'kit:00aa'), 'symmetric');
  // a partner that is itself distorted lends nothing (only a balanced teacher teaches)
  const bothBent = findDyads([kit, bentFlow]);
  assert.equal(bothBent.length, 1, 'still a pair: they worked together well before');
  const both = dream({ ...input, presets: [kit, bentFlow], dyads: bothBent });
  assert.ok(both.digest.replayed.every((r) => r.partner === undefined));
});

test('the built-in Higher Self frames the antidote in the other pole\'s terms', () => {
  assert.equal(higherSelfFrame('solar-control', 96), 'Let it move through you. Wisdom & Surrender is the way back.');
  assert.equal(higherSelfFrame('sacral-insecurity', -96), 'Stand on your line. Confidence is the way back.');
  assert.equal(higherSelfFrame('root-lack', 0), 'Rest in Gratitude.');
});

/** A small system: the pair, a distorted locomotion preset, and two egos that use them. */
const system = (): { presets: Mem[]; egos: SystemEgo[] } => {
  const [kit, species] = pair();
  const loc = write(createPresetMemory('loc:0c0c'), Array.from({ length: 4 }, (_, i) => at(600 + i, { by: 'solar-control', excitement: 1, felt: 'root-reactivity' })));
  return {
    presets: [loc, species, kit],
    egos: [
      { ego: createPresetMemory('brain:0e01'), presets: ['kit:00aa', 'loc:0c0c'], weights: { prefer: { 'kit:00aa': 60, 'loc:0c0c': -20 } } },
      { ego: createPresetMemory('brain:0e02'), presets: ['kit:00aa', 'species:00bb'], weights: { prefer: { 'kit:00aa': 20, 'species:00bb': -40 } } },
    ],
  };
};

test('taking Overwatch: the data is copied exactly, behaviour is distilled, dyads are inherited whole', () => {
  const { presets, egos } = system();
  const pack = compileSystemMemory(presets, egos);
  assert.equal(pack.schema, 'hm2:system-memory:v1');
  assert.deepEqual(pack.presets.map((m) => m.of), ['kit:00aa', 'loc:0c0c', 'species:00bb'], 'sorted');
  assert.deepStrictEqual(pack.presets.find((m) => m.of === 'loc:0c0c'), presets[0], 'every memory exactly');
  // kit: (60 + 20) / 2 = 40; species: -40 alone; the pair shares its mean (40 + -40) / 2 = 0; loc: -20
  assert.deepEqual(pack.distilled.prefer, { 'kit:00aa': 0, 'loc:0c0c': -20, 'species:00bb': 0 });
  assert.deepEqual(pack.dyads.map((d) => [d.a, d.b]), [['kit:00aa', 'species:00bb']]);
});

test('the pack pools only when aligned, and its digest says what any AI in the seat needs to know', () => {
  const { presets, egos } = system();
  const unaligned = compileSystemMemory(presets, egos);
  assert.ok(unaligned.coherence < 0.95);
  assert.equal(unaligned.pooled, false);
  assert.equal(unaligned.pool, null, 'each ego stands apart; nothing is lost');
  assert.deepEqual(unaligned.digest.open, [{ of: 'loc:0c0c', d: 'root-reactivity', cause: 'solar-control', pole: 'balanced' }]);
  const lines = digestLines(unaligned);
  assert.match(lines[0]!, /not aligned yet, so each ego stands apart/);
  assert.ok(lines.some((l) => /^loc:0c0c \(balanced pole\) still carries root-reactivity, left by solar-control thinking above it\.$/.test(l)));
  assert.ok(lines.some((l) => /^kit:00aa and species:00bb work as a pair, and are whole\.$/.test(l)));
  // without the distorted preset everything is balanced: one pool, its cause links merged
  const aligned = compileSystemMemory(presets.slice(1), [egos[1]!]);
  assert.equal(aligned.pooled, true);
  assert.ok(Array.isArray(aligned.pool?.cause));
});

test('the pack crosses as canonical JSON, and a hand-edited digest cannot lie: it is rebuilt from the memories', () => {
  const { presets, egos } = system();
  const pack = compileSystemMemory(presets, egos);
  const json = packToJson(pack);
  assert.equal(json, packToJson(compileSystemMemory([...presets].reverse(), [...egos].reverse())), 'the same system, the same text');
  assert.deepStrictEqual(packFromJson(json), pack);
  const lie = JSON.parse(json);
  lie.digest.open = [];
  lie.pooled = true;
  const back = packFromJson(JSON.stringify(lie))!;
  assert.equal(back.pooled, false);
  assert.equal(back.digest.open.length, 1);
  assert.equal(packFromJson('not json'), null);
  assert.equal(packFromJson(JSON.stringify({ ...lie, schema: 'other' })), null);
  assert.throws(() => compileSystemMemory([...presets, presets[0]!], egos), /twice/);
  assert.throws(() => compileSystemMemory(presets, [{ ...egos[0]!, presets: ['kit:ffff'] }]), /not in the system/);
  assert.throws(() => compileSystemMemory(presets, [{ ...egos[0]!, weights: { prefer: { 'kit:00aa': 1.5 } } }]), /whole number/);
});

test('the 3/6/9 frame: nested triads (two poles and the rung that harmonizes them), six steps, and the 9 (macro, micro, nano)', async () => {
  const { LOOP_STEPS } = await import('../src/index');
  assert.deepEqual(LOOP_STEPS.map((s) => s.step), ['observe', 'orient', 'design', 'act', 'verify', 'refine']);
  const { presets, egos } = system();
  const pack = compileSystemMemory(presets, egos);
  // the pair kit (intent) + species (context) is used by ego 0e02 only: it is their harmonizer
  assert.deepEqual(pack.triads, [{ intent: 'kit:00aa', context: 'species:00bb', observer: 'brain:0e02', strength: 3, whole: true, level: 'preset' }]);
  // nano: the locomotion preset is distorted; micro: both egos balanced, their triads whole; macro: not pooled
  assert.deepEqual(pack.alignment, {
    nano: { aligned: false, balanced: 2, of: 3 }, micro: { aligned: true, balanced: 2, of: 2 }, macro: { aligned: false, coherence: pack.coherence }, complete: false,
  });
  const lines = digestLines(pack);
  assert.ok(lines.includes('Triad: kit:00aa (intent) and species:00bb (context), harmonized by brain:0e02: whole.'));
  assert.ok(lines.some((l) => /^Alignment, the 9: nano 2\/3 presets balanced; micro 2\/2 egos balanced with whole triads; macro not yet\. Not complete\.$/.test(l)));
  // without the distorted preset the 9 is complete
  const whole = compileSystemMemory(presets.slice(1), [egos[1]!]);
  assert.equal(whole.alignment.complete, true);
  // it nests: two egos of opposite poles that worked together form a triad the Overwatch seat harmonizes
  const egoA = write({ ...createPresetMemory('brain:0e0a'), pol: 80 }, [at(100), at(200)]);
  const egoB = write({ ...createPresetMemory('brain:0e0b'), pol: -80 }, [at(105), at(210)]);
  const nested = compileSystemMemory(presets.slice(1), [
    { ego: egoA, presets: ['kit:00aa'], weights: { prefer: {} } },
    { ego: egoB, presets: ['species:00bb'], weights: { prefer: {} } },
  ]);
  assert.deepEqual(nested.triads.filter((t) => t.level === 'ego'), [{ intent: 'brain:0e0a', context: 'brain:0e0b', observer: 'overwatch', strength: 2, whole: true, level: 'ego' }]);
  assert.equal(nested.alignment.macro.aligned, true);
});
