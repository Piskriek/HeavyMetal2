// Plan 56 W3: the dream. The Higher Self's cue opens a hardened distortion so the antidote can balance it; downscaling
// alone never does; the lowest ray goes first; a preset that is not open keeps its charge; links close on the repair only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIGNED, type Mem } from '@hm/shorthand';
import {
  DOWNSCALE_SPARE, OPEN_MIN, REST_AT, SQ_DISTORTION_CATALOG, createPresetMemory, dream, dreamOpenness, recordExperience, wakeLine,
  type DreamInput, type Experience,
} from '../src/index';

const SOLAR = SQ_DISTORTION_CATALOG['solar-control'].rayIndex - 1;
const ROOT = SQ_DISTORTION_CATALOG['root-reactivity'].rayIndex - 1;
const at = (t: number, over: Partial<Experience> = {}): Experience => ({
  t, stage: 'S1', cat: 'WEAPON_BURST_CADENCE', excitement: 1, error: 0.2, by: 'solar-control', ...over,
});
const write = (mem: Mem, xs: readonly Experience[]): Mem => xs.reduce(recordExperience, mem);
/** A preset that took control's distortion while very excited, six times: hard, charged, with an open link. */
const hardened = (): Mem => write(createPresetMemory('loc:ab12cd34'), Array.from({ length: 6 }, (_, i) => at(100 + i)));
const egoThinkingControl = (): Mem => ({ ...createPresetMemory('brain:0e90'), charge: [0, 0, 40, 0, 0, 0, 0], bal: 1 - 40 / 127 });
const cuesFor = (m: Mem) => m.ep.map((e) => ({ of: m.of, t: e.t }));
const base = (presets: readonly Mem[], over: Partial<DreamInput> = {}): DreamInput => ({ ego: egoThinkingControl(), presets, weights: { prefer: {} }, now: 200, ...over });

test('the Higher Self\'s cue opens a hardened distortion: cued dreams balance it, close its link, and the ego learns', () => {
  let m = hardened();
  assert.equal(m.charge[SOLAR], 127);
  assert.ok(m.hard > 0.8, String(m.hard));
  let ego = egoThinkingControl();
  let closedAt = -1;
  for (let night = 0; night < 4; night++) {
    const r = dream(base([m], { ego, cues: cuesFor(m) }));
    m = r.presets[0]!;
    ego = r.ego;
    if (r.digest.closed.length && closedAt < 0) closedAt = night;
    assert.equal(r.digest.refused.length, 0, 'a cued episode is open enough');
  }
  assert.ok((m.charge[SOLAR] ?? 0) <= REST_AT, `charge ${m.charge[SOLAR]}`);
  assert.ok(m.bal > 0.96, String(m.bal));
  assert.equal(m.cause.find((c) => c.by === 'solar-control' && c.d === 'solar-control')?.open, false, 'the link is closed (forgiveness)');
  assert.ok(closedAt >= 0);
  assert.equal(ego.charge[SOLAR], 40 - 16, 'the higher rung\'s own lean on control eased: it learned by teaching');
  assert.equal(m.ep.length, 6, 'balance, not removal: every episode is still remembered');
  // and it stays balanced: more dreams change nothing on that ray
  const again = dream(base([m], { ego, cues: cuesFor(m) }));
  assert.ok((again.presets[0]!.charge[SOLAR] ?? 0) <= REST_AT);
  assert.equal(again.digest.closed.length, 0, 'nothing left to close');
});

test('with no cue, dreams soften noise but leave the hardened distortion: it is not open, and it keeps its charge', () => {
  let m = hardened();
  // some light, calm noise too
  m = write(m, Array.from({ length: 8 }, (_, i) => at(150 + i, { excitement: 0.05, by: ALIGNED })));
  const noiseBefore = m.ep.filter((e) => e.d === ALIGNED).map((e) => e.h);
  let last = null as ReturnType<typeof dream> | null;
  for (let night = 0; night < 10; night++) { last = dream(base([m], { cues: [] })); m = last.presets[0]!; }
  assert.equal(m.charge[SOLAR], 127, 'downscaling alone never balances a hardened distortion');
  assert.ok(m.cause.every((c) => c.open), 'no link closes without a repair');
  assert.ok(last!.digest.refused.some((x) => x.why === 'not open'));
  assert.ok(dreamOpenness(m, false) < OPEN_MIN && dreamOpenness(m, true) >= OPEN_MIN, 'the cue is what opens it');
  const noiseAfter = m.ep.filter((e) => e.d === ALIGNED).map((e) => e.h);
  assert.ok(noiseAfter.every((h, i) => h < noiseBefore[i]!), 'the noise faded');
  assert.equal(last!.digest.open[0]?.d, 'solar-control', 'the wake digest says what is still open');
});

test('a soft distortion is open without any cue: the dream balances it on its own', () => {
  const m = recordExperience(createPresetMemory('mot:beef'), at(190, { excitement: 0.3 }));
  assert.equal(m.charge[SOLAR], 10);
  const r = dream(base([m], { cues: [] }));
  assert.ok((r.presets[0]!.charge[SOLAR] ?? 0) <= REST_AT);
  assert.equal(r.digest.closed.length, 1);
});

test('the built-in cue takes the lowest charged ray first', () => {
  const root = recordExperience(createPresetMemory('loc:0001'), at(190, { excitement: 0.5, felt: 'root-reactivity' }));
  const solar = recordExperience(createPresetMemory('loc:0002'), at(191, { excitement: 0.9 }));
  const r = dream(base([solar, root], { budget: 1 }));
  assert.deepEqual(r.digest.replayed.map((x) => [x.of, x.cued]), [['loc:0001', true]]);
  assert.ok((r.presets[1]!.charge[ROOT] ?? 0) < (root.charge[ROOT] ?? 0), 'root was repaired');
  assert.equal(r.presets[0]!.charge[SOLAR], solar.charge[SOLAR], 'solar waits for the next dream');
});

test('an imagined episode must show a lower error, or the repair is undone', () => {
  const m = hardened();
  const worse = dream(base([m], { cues: cuesFor(m), imagine: () => 1 }));
  assert.equal(worse.presets[0]!.charge[SOLAR], 127);
  assert.ok(worse.digest.refused.every((x) => x.why === 'not confirmed') && worse.digest.refused.length > 0);
  const better = dream(base([m], { cues: cuesFor(m), imagine: (_mem, e) => e.err / 2 }));
  assert.ok((better.presets[0]!.charge[SOLAR] ?? 0) < 127);
});

test('replay teaches the ego what to prefer: good outcomes up, bad ones down', () => {
  const good = write(createPresetMemory('logic:0a0a'), [at(190, { by: ALIGNED, error: 0 })]);
  const bad = write(createPresetMemory('logic:0b0b'), [at(191, { by: ALIGNED, error: 1 })]);
  const r = dream(base([good, bad], { cues: [] }));
  assert.ok((r.weights.prefer['logic:0a0a'] ?? 0) > 0);
  assert.ok((r.weights.prefer['logic:0b0b'] ?? 0) < 0);
});

test('bounded, checked and deterministic; the input is never changed', () => {
  const m = write(hardened(), Array.from({ length: 20 }, (_, i) => at(120 + i, { excitement: (i % 7) / 7, by: i % 2 ? ALIGNED : 'sacral-guilt' })));
  const frozen = JSON.stringify(m);
  const input = base([m], { budget: 5 });
  const a = dream(input), b = dream(input);
  assert.deepStrictEqual(a, b);
  assert.equal(JSON.stringify(m), frozen);
  assert.ok(a.digest.replayed.length <= 5);
  // the strongest episodes are spared by the downscale
  const strongest = [...m.ep].sort((x, y) => y.h - x.h).slice(0, DOWNSCALE_SPARE).map((e) => e.t);
  for (const t of strongest) {
    const was = m.ep.find((e) => e.t === t)!.h, now = a.presets[0]!.ep.find((e) => e.t === t)!.h;
    // a replayed episode may set softer by its repair; the others among the strongest are untouched
    if (!a.digest.replayed.some((x) => x.t === t)) assert.equal(now, was, `episode ${t} spared`);
  }
  assert.throws(() => dream(base([m, m])), /twice/);
  assert.throws(() => dream(base([m], { now: -1 })), /tick/);
});

test('the drone tells its dream on waking in its own body\'s words', () => {
  const m = hardened();
  const healed = dream(base([m], { cues: cuesFor(m) }));
  assert.match(wakeLine(healed.digest), /^I dreamed the weapon burst cadence again\. Wisdom & Surrender came back/);
  const held = dream(base([m], { cues: [] }));
  assert.equal(wakeLine(held.digest), 'I dreamed the weapon burst cadence again and held on to it. It is still in me.');
  assert.equal(wakeLine(dream(base([])).digest), 'I slept without dreaming.');
});
