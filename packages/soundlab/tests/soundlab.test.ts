import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ENGINE_SPEC, DEFAULT_MUSIC_SPEC, LIMITS, SFX_KINDS, cloneRecipe, crossRecipes, describeLayer, describeMusicSpec, describeRecipe, engineParamsFor,
  engineSpecToPoints, moodDefaults, mutateRecipe, normalizeMusicSpec, normalizeRecipe, peakOf, randomEngineSpec, randomMusicSpec, randomRecipe, recipeFromJson,
  recipeToJson, renderRecipe, rmsOf, validateEngineSpec, validateMusicSpec, validateRecipe, waveformBins, type SfxRecipe,
} from '../src';

const beep: SfxRecipe = { id: 'beep', category: 'ui', durationMs: 150, layers: [{ wave: 'square', freq: [880, 880], gain: 0.25, attackMs: 2, decayMs: 148 }] };
const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

test('validation: good recipes pass, bad ones say what is wrong in sentences', () => {
  assert.deepEqual(validateRecipe(beep), { ok: true, errors: [] });
  const bad = validateRecipe({ ...beep, layers: [beep.layers[0], { ...beep.layers[0]!, gain: 3 }] });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(' '), /layer 2: gain must be between 0 and 2/);
  assert.equal(validateRecipe(null).ok, false);
  assert.equal(validateRecipe('x').ok, false);
  assert.equal(validateRecipe({ ...beep, layers: [] }).ok, false);
  assert.match(validateRecipe({ ...beep, durationMs: 50 }).errors.join(' '), /lasts until/);
  assert.match(validateRecipe({ ...beep, layers: [{ ...beep.layers[0], wave: 'zap' }] }).errors.join(' '), /wave must be one of/);
  assert.equal(validateRecipe({ ...beep, layers: Array.from({ length: 9 }, () => beep.layers[0]) }).ok, false);
  assert.doesNotThrow(() => validateRecipe({ layers: [null, 5, { freq: 3 }] }));
});

test('normalise clamps into the limits, keeps one to eight layers and covers every layer', () => {
  const wild = normalizeRecipe({ id: '', category: 'race', durationMs: 5, layers: [{ wave: 'sine', freq: [1, 99999], gain: 9, attackMs: -4, decayMs: 99999, delayMs: 100, detune: 5000, filter: { type: 'lowpass', freq: [0, 1e9], q: 100 } }] });
  const l = wild.layers[0]!;
  assert.ok(l.freq[0] >= LIMITS.freq.min && l.freq[1] <= LIMITS.freq.max);
  assert.equal(l.gain, LIMITS.gain.max); assert.equal(l.attackMs, 0);
  assert.ok(l.detune! <= LIMITS.detune.max);
  assert.ok(l.filter!.q <= LIMITS.q.max && l.filter!.freq[1] <= 20000 && l.filter!.freq[0] >= 20);
  assert.ok(wild.durationMs <= LIMITS.durationMs.max && wild.durationMs >= (l.delayMs ?? 0) + l.attackMs + l.decayMs);
  assert.equal(wild.id, 'sound');
  assert.equal(validateRecipe(wild).ok, true);
  assert.equal(normalizeRecipe({ ...beep, layers: [] }).layers.length, 1);
  assert.equal(normalizeRecipe({ ...beep, layers: Array.from({ length: 12 }, () => beep.layers[0]!) }).layers.length, 8);
  assert.deepEqual(normalizeRecipe(beep), beep);
});

test('json round trip, and readable errors for broken text', () => {
  const back = recipeFromJson(recipeToJson(beep));
  assert.deepEqual(back.recipe, beep);
  assert.equal(back.errors.length, 0);
  assert.equal(recipeFromJson('{nope').recipe, null);
  assert.match(recipeFromJson('{nope').errors[0]!, /not valid JSON/);
  assert.equal(recipeFromJson('{"id":"x"}').recipe, null);
  assert.ok(recipeToJson(beep).startsWith('{\n  "id": "beep"'));
  const copy = cloneRecipe(beep); copy.layers = []; assert.equal(beep.layers.length, 1);
});

test('rendering is deterministic, the right length, never clips and respects gain and filters', () => {
  const a = renderRecipe(beep), b = renderRecipe(beep);
  assert.equal(a.length, Math.ceil(0.15 * 22050));
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.ok(peakOf(a) <= 1 && peakOf(a) > 0.05);
  const loud: SfxRecipe = { ...beep, layers: Array.from({ length: 8 }, () => ({ wave: 'sine' as const, freq: [440, 440] as const, gain: 1, attackMs: 0, decayMs: 100 })), durationMs: 100 };
  assert.ok(peakOf(renderRecipe(loud)) <= 1 + 1e-6);
  assert.equal(peakOf(renderRecipe({ ...beep, layers: [{ ...beep.layers[0]!, gain: 0 }] })), 0);
  // a lowpass makes noise smoother: less first-difference energy than the same noise without a filter
  const noise = { wave: 'noise' as const, freq: [200, 200] as const, gain: 0.5, attackMs: 0, decayMs: 200 };
  const diffEnergy = (s: Float32Array): number => { let e = 0; for (let i = 1; i < s.length; i++) e += (s[i]! - s[i - 1]!) ** 2; return e / rmsOf(s) ** 2 / s.length; };
  const open = renderRecipe({ ...beep, durationMs: 200, layers: [noise] });
  const dark = renderRecipe({ ...beep, durationMs: 200, layers: [{ ...noise, filter: { type: 'lowpass', freq: [400, 400], q: 0.7 } }] });
  assert.ok(diffEnergy(dark) < diffEnergy(open) * 0.5, `${diffEnergy(dark)} vs ${diffEnergy(open)}`);
  const thin = renderRecipe({ ...beep, durationMs: 200, layers: [{ ...noise, filter: { type: 'highpass', freq: [6000, 6000], q: 0.7 } }] });
  assert.ok(diffEnergy(thin) > diffEnergy(open) * 1.2);
  assert.ok(rmsOf(renderRecipe(beep, 22050, 1)) > 0);
  const bins = waveformBins(a, 40);
  assert.equal(bins.length, 40);
  assert.ok(bins.every((x) => x.min <= 0 && x.max >= 0));
});

test('every kind is valid for many seeds, repeatable, and varies by seed', () => {
  for (const { kind } of SFX_KINDS) {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const r = randomRecipe(seed, kind);
      assert.equal(validateRecipe(r).ok, true, `${kind} ${seed}: ${validateRecipe(r).errors.join(';')}`);
      assert.deepEqual(randomRecipe(seed, kind), r);
      assert.equal(r.id, `${kind}-${seed}`);
      seen.add(recipeToJson(r));
    }
    assert.ok(seen.size >= 45, `${kind} varies (${seen.size})`);
  }
  assert.equal(randomRecipe(1, 'click', 'ui').category, 'ui');
});

test('kinds sound different from each other (length, layers and brightness)', () => {
  const sig = (k: (typeof SFX_KINDS)[number]['kind']): string => {
    const r = randomRecipe(3, k);
    const zc = (() => { const s = renderRecipe(r); let n = 0; for (let i = 1; i < s.length; i++) if ((s[i - 1]! < 0) !== (s[i]! < 0)) n++; return Math.round((n / s.length) * 20); })();
    return `${Math.round(r.durationMs / 100)}|${r.layers.length}|${zc}`;
  };
  assert.ok(new Set(SFX_KINDS.map((k) => sig(k.kind))).size >= 8);
  assert.ok(randomRecipe(1, 'explosion').durationMs > randomRecipe(1, 'click').durationMs * 10);
});

test('mutate: amount 0 is a copy, results are valid and keep the name, more amount moves further', () => {
  const base = randomRecipe(4, 'powerup');
  assert.deepEqual(mutateRecipe(base, 9, 0), base);
  const m = mutateRecipe(base, 9, 0.5);
  assert.equal(validateRecipe(m).ok, true);
  assert.equal(m.id, base.id);
  assert.notDeepEqual(m, base);
  const dist = (r: SfxRecipe): number => r.layers.reduce((s, l, i) => s + Math.abs(Math.log((l.freq[0] + 1) / ((base.layers[i]?.freq[0] ?? l.freq[0]) + 1))), 0);
  let small = 0, big = 0;
  for (let s = 1; s <= 30; s++) { small += dist(mutateRecipe(base, s, 0.1)); big += dist(mutateRecipe(base, s, 0.5)); }
  assert.ok(big > small);
  for (let s = 1; s <= 40; s++) assert.equal(validateRecipe(mutateRecipe(randomRecipe(s, 'laser'), s, 1)).ok, true);
  assert.deepEqual(mutateRecipe(base, 5, 0.7), mutateRecipe(base, 5, 0.7));
});

test('crossing two recipes mixes their layers and stays valid', () => {
  const a = randomRecipe(1, 'laser'), b = randomRecipe(2, 'powerup');
  const c = crossRecipes(a, b, 3);
  assert.equal(validateRecipe(c).ok, true);
  assert.ok(c.layers.length >= Math.min(a.layers.length, b.layers.length));
  assert.deepEqual(crossRecipes(a, b, 3), c);
});

test('descriptions are plain sentences', () => {
  assert.match(describeRecipe(beep), /^A short steady crunchy tone/);
  assert.match(describeRecipe(randomRecipe(1, 'pickup')), /rising/);
  assert.match(describeRecipe(randomRecipe(1, 'laser')), /falling/);
  assert.match(describeRecipe(randomRecipe(1, 'explosion')), /^A long/);
  assert.match(describeRecipe(beep), /\(0\.15 s\)$/);
  assert.equal(describeLayer({ wave: 'sawtooth', freq: [140, 600], gain: 0.3, attackMs: 30, decayMs: 370, filter: { type: 'lowpass', freq: [800, 800], q: 1 } }), 'Sawtooth sliding 140 to 600 Hz, 30 ms attack, 370 ms decay, lowpass 800 Hz');
  for (const { kind } of SFX_KINDS) assert.ok(describeRecipe(randomRecipe(2, kind)).length > 10);
});

test('engine hum: the formulas, the default spec and the random characters', () => {
  const p = engineParamsFor(DEFAULT_ENGINE_SPEC, 20, 1, 40);
  near(p.freq, 195); near(p.gain, 0.175); near(p.filterFreq, 2300); near(p.noiseGain, 0.04);
  const idle = engineParamsFor(DEFAULT_ENGINE_SPEC, 0, 0, 40);
  near(idle.freq, 70); near(idle.gain, 0.05);
  assert.deepEqual(engineParamsFor(DEFAULT_ENGINE_SPEC, NaN, NaN, NaN), engineParamsFor(DEFAULT_ENGINE_SPEC, 0, 0, 1));
  assert.ok(engineParamsFor(DEFAULT_ENGINE_SPEC, 1000, 1, 40).freq <= 70 + 190 * 1.5 + 30 + 1e-9);
  assert.equal(validateEngineSpec(DEFAULT_ENGINE_SPEC).ok, true);
  assert.equal(validateEngineSpec({ baseFreq: 1 }).ok, false);
  assert.equal(validateEngineSpec(null).ok, false);
  for (const c of ['smooth', 'buzzy', 'rumble'] as const) {
    for (let seed = 1; seed <= 100; seed++) {
      const s = randomEngineSpec(seed, c);
      assert.equal(validateEngineSpec(s).ok, true);
      const top = engineParamsFor(s, 40, 1, 40);
      assert.ok(top.gain <= 0.4 && top.gain > 0, `${c} ${seed}: ${top.gain}`);
      assert.ok(Object.values(s).every((v) => Number.isFinite(v) && v > 0));
    }
  }
  assert.ok(randomEngineSpec(1, 'rumble').baseFreq < randomEngineSpec(1, 'buzzy').baseFreq);
  const pts = engineSpecToPoints(DEFAULT_ENGINE_SPEC, 40, 8);
  assert.equal(pts.length, 9);
  assert.ok(pts[8]!.freq > pts[0]!.freq);
});

test('music settings: defaults, validation, normalising, randomising and words', () => {
  assert.deepEqual(DEFAULT_MUSIC_SPEC, { seed: 7, bars: 8, mood: 'energetic', bpm: 138 });
  assert.deepEqual([moodDefaults('chill').bpm, moodDefaults('energetic').bpm, moodDefaults('dramatic').bpm], [100, 138, 112]);
  assert.equal(validateMusicSpec(DEFAULT_MUSIC_SPEC).ok, true);
  assert.equal(validateMusicSpec({ ...DEFAULT_MUSIC_SPEC, bars: 40 }).ok, false);
  assert.equal(validateMusicSpec({ ...DEFAULT_MUSIC_SPEC, mood: 'sad' }).ok, false);
  assert.equal(validateMusicSpec({ ...DEFAULT_MUSIC_SPEC, bpm: 10 }).ok, false);
  assert.equal(validateMusicSpec(undefined).ok, false);
  assert.deepEqual(normalizeMusicSpec({ seed: -3.4, bars: 99, mood: 'x' as never, bpm: 5 }), { seed: 0, bars: 16, mood: 'energetic', bpm: 60 });
  for (let s = 1; s < 60; s++) assert.equal(validateMusicSpec(randomMusicSpec(s)).ok, true);
  assert.deepEqual(randomMusicSpec(4), randomMusicSpec(4));
  assert.equal(describeMusicSpec(DEFAULT_MUSIC_SPEC), '8 bars of energetic music at 138 BPM, seed 7');
  assert.equal(describeMusicSpec({ ...DEFAULT_MUSIC_SPEC, bars: 1 }), '1 bar of energetic music at 138 BPM, seed 7');
});
