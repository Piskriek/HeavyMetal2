import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_STAGE_LADDER,
  STEM_SHELF,
  audioStageFor,
  brightEnergy,
  countAtoms,
  machineHumId,
  reducePatch,
  renderStem,
  resolveStem,
  stageSoundsLike,
  stemLengthMs,
  stemsOfRole,
  validateStem,
  type StemPreset,
} from '../src/stems';

const sine = (freqHz: number): StemPreset => ({
  id: 'test-sine',
  name: 'Test sine',
  role: 'machine',
  gain: 0.5,
  patch: { name: 'sine', atoms: [{ wave: 'sine', freqHz, gain: 0.5, attackMs: 4, decayMs: 480 }] },
});

test('the audio ladder climbs from a one-bit speaker to a spatial mix', () => {
  assert.equal(AUDIO_STAGE_LADDER.length, 7);
  for (let i = 1; i < AUDIO_STAGE_LADDER.length; i += 1) {
    const before = AUDIO_STAGE_LADDER[i - 1]!;
    const after = AUDIO_STAGE_LADDER[i]!;
    assert.ok(after.sampleRateHz >= before.sampleRateHz, `stage ${i} must not lose sample rate`);
    assert.ok(after.bitDepth >= before.bitDepth, `stage ${i} must not lose bits`);
    assert.ok(after.maxVoices >= before.maxVoices, `stage ${i} must not lose voices`);
  }
  // the speaker is one square channel and nothing else; the spatial mix can place a source
  assert.equal(AUDIO_STAGE_LADDER[0]!.channels, 1);
  assert.deepEqual([...AUDIO_STAGE_LADDER[0]!.waves], ['square']);
  assert.equal(AUDIO_STAGE_LADDER[0]!.spatial, false);
  assert.equal(audioStageFor(4).spatial, true);
  assert.equal(audioStageFor(6).channels, 2);
  assert.equal(audioStageFor(6).bitDepth, 16);
  // off the ladder is clamped, never undefined
  assert.equal(audioStageFor(-9).stage, 0);
  assert.equal(audioStageFor(99).stage, 6);
  assert.equal(audioStageFor(3.7).stage, 3);
});

test('a stage can only play what its hardware has, so the patch is reduced to it', () => {
  const stem = resolveStem('rifle-beam-fire')!;
  assert.equal(countAtoms(stem.patch), 3);

  const speaker = stageSoundsLike(stem, 0);
  assert.equal(countAtoms(speaker.patch), 1, 'one voice means one oscillator');
  const onlyAtom = (p: typeof speaker.patch): string => {
    if (p.atoms?.length) return p.atoms[0]!.wave;
    return p.children?.length ? onlyAtom(p.children[0]!) : 'none';
  };
  assert.equal(onlyAtom(speaker.patch), 'square', 'a speaker makes squares');
  assert.equal(onlyAtom(stageSoundsLike(resolveStem('gate-chevron-lock')!, 0).patch), 'square');

  // an FM chip can make a triangle and a sine, but still drops noise and filters
  const fm = stageSoundsLike({ ...stem, patch: { name: 'p', atoms: [{ wave: 'triangle', freqHz: 200, gain: 0.5, attackMs: 1, decayMs: 100, filter: { type: 'lowpass', freq: [800, 800], q: 1 } }] } }, 1);
  assert.equal(fm.patch.atoms?.[0]?.wave, 'triangle');
  assert.equal(fm.patch.atoms?.[0]?.filter, undefined, 'no filter hardware at S1');

  // at S2 noise appears and the filter still does not; at S3 the filter does
  const noisePatch = { name: 'p', atoms: [{ wave: 'noise' as const, freqHz: 1, gain: 0.5, attackMs: 1, decayMs: 100 }] };
  assert.equal(stageSoundsLike({ ...stem, patch: noisePatch }, 1).patch.atoms?.[0]?.wave, 'square');
  assert.equal(stageSoundsLike({ ...stem, patch: noisePatch }, 2).patch.atoms?.[0]?.wave, 'noise');
  const filtered = { name: 'p', atoms: [{ wave: 'sine' as const, freqHz: 200, gain: 0.5, attackMs: 1, decayMs: 100, filter: { type: 'lowpass' as const, freq: [800, 800] as const, q: 1 } }] };
  assert.ok(stageSoundsLike({ ...stem, patch: filtered }, 3).patch.atoms?.[0]?.filter);

  // the headroom bounds the loudness, and a monophonic stage has nowhere to put a pan
  const loud = stageSoundsLike({ ...resolveStem('machine-hum-drill')!, gain: 1.8, pan: 0.9, distanceM: 12 }, 0);
  assert.equal(loud.gain, audioStageFor(0).headroom);
  assert.equal(loud.pan, undefined);
  assert.equal(loud.distanceM, undefined);
  const placed = stageSoundsLike({ ...resolveStem('machine-hum-drill')!, gain: 0.2, pan: 0.9, distanceM: 12 }, 5);
  assert.equal(placed.pan, 0.9);
  assert.equal(placed.distanceM, 12);

  // the reduction is pure: the shelf is untouched
  assert.equal(countAtoms(resolveStem('rifle-beam-fire')!.patch), 3);
  assert.deepEqual(reducePatch({ name: 'x', children: [{ name: 'y', atoms: [] }] }, audioStageFor(6)).children?.[0]?.atoms, []);
});

test('a render obeys the hardware: rate, depth, channels and placement', () => {
  const stem = resolveStem('rifle-beam-fire')!;
  const s0 = renderStem(stem, 0, 7);
  assert.equal(s0.sampleRateHz, 11025);
  assert.equal(s0.channels.length, 1);
  const values = new Set<number>();
  for (const v of s0.channels[0]!) values.add(v);
  for (const v of values) assert.ok(v === -1 || v === 0 || v === 1, `1-bit cannot hold ${v}`);

  const s6 = renderStem(stem, 6, 7);
  assert.equal(s6.sampleRateHz, 48000);
  assert.equal(s6.channels.length, 2);
  assert.equal(s6.channels[0]!.length, s6.channels[1]!.length);
  const fine = new Set<number>();
  for (let i = 0; i < 4000; i += 1) fine.add(s6.channels[0]![i]!);
  assert.ok(fine.size > 50, 'a 16-bit render has many levels, not two');
  assert.ok(s6.peak > 0.05 && s6.peak <= 1, `peak ${s6.peak} must be audible and in range`);

  // a hard-left stem is silent on the right at a spatial stage, and centred at a mono one
  const left = renderStem({ ...stem, pan: -1 }, 5, 3);
  const rms = (a: Float32Array): number => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  assert.ok(rms(left.channels[0]!) > 0);
  assert.equal(rms(left.channels[1]!), 0);
  const monoLeft = renderStem({ ...stem, pan: -1 }, 2, 3);
  assert.equal(monoLeft.channels.length, 1);
  assert.ok(rms(monoLeft.channels[0]!) > 0);

  // distance only attenuates where the stage can hear distance
  const near = renderStem({ ...stem, distanceM: 0 }, 6, 2);
  const far = renderStem({ ...stem, distanceM: 40 }, 6, 2);
  assert.ok(rms(far.channels[0]!) < rms(near.channels[0]!));
});

test('a render is pure, and its pitch is the pitch that was asked for', () => {
  const stem = sine(440);
  const a = renderStem(stem, 6, 1);
  const b = renderStem(stem, 6, 1);
  assert.deepEqual([...a.channels[0]!], [...b.channels[0]!]);
  // the fundamental: about 880 zero crossings a second for a 440 Hz sine
  let crossings = 0;
  const ch = a.channels[0]!;
  for (let i = 1; i < ch.length; i += 1) if ((ch[i - 1]! < 0 && ch[i]! >= 0) || (ch[i - 1]! > 0 && ch[i]! <= 0)) crossings += 1;
  const seconds = ch.length / a.sampleRateHz;
  assert.ok(Math.abs(crossings / seconds / 2 - 440) < 25, `saw ${(crossings / seconds / 2).toFixed(1)} Hz`);

  // seeds only matter where noise is: a tonal stem renders the same for every seed, a noisy one does not
  const noisy: StemPreset = {
    id: 'test-noise', name: 'Noise', role: 'rifle', gain: 0.5,
    patch: { name: 'n', atoms: [{ wave: 'noise', freqHz: 1, gain: 0.5, attackMs: 1, decayMs: 120 }] },
  };
  assert.deepEqual([...renderStem(stem, 6, 4).channels[0]!], [...renderStem(stem, 6, 9).channels[0]!]);
  assert.notDeepEqual([...renderStem(noisy, 6, 4).channels[0]!], [...renderStem(noisy, 6, 9).channels[0]!]);
});

test('a stem is a tree, so a lock is nine ticks of one atom and a length is its last release', () => {
  const lock = resolveStem('gate-chevron-lock')!;
  assert.equal(countAtoms(lock.patch), 9);
  assert.equal(lock.patch.atoms ?? undefined, undefined, 'the ticks live in children, not in one flat list');
  // eight gaps of 150 ms, then the last tick's attack and decay
  assert.equal(stemLengthMs(lock), 8 * 150 + 2 + 90);

  const rendered = renderStem(lock, 6, 1);
  const ch = rendered.channels[0]!;
  const window = Math.round(rendered.sampleRateHz * 0.1);
  const loud: number[] = [];
  for (let start = 0; start + window < ch.length; start += window) {
    let peak = 0;
    for (let i = start; i < start + window; i += 1) peak = Math.max(peak, Math.abs(ch[i]!));
    if (peak > 0.01) loud.push(start);
  }
  assert.ok(loud.length >= 8, `expected the nine ticks to be spread over the cycle, saw ${loud.length} loud windows`);

  // a loop stem's length is its loop, not its tail
  assert.equal(stemLengthMs(resolveStem('machine-hum-drill')!), 500);
  assert.equal(stemLengthMs({ ...sine(300), loopSeconds: 2.5 }), 2500);
});

test('the shelf carries every machine, verb and gate voice, and each one validates', () => {
  for (const [id, stem] of Object.entries(STEM_SHELF)) {
    assert.equal(stem.id, id);
    assert.deepEqual(validateStem(stem), [], `${id} must validate`);
    assert.ok(stem.gain > 0 && stem.gain <= 1);
    assert.ok(stemLengthMs(stem) > 0);
  }
  for (const kind of ['drill', 'mill', 'press', 'power', 'pylon', 'projector', 'water']) {
    assert.ok(resolveStem(machineHumId(kind)), `a ${kind} needs a hum`);
  }
  for (const id of ['rifle-beam-fire', 'rifle-beam-sweep', 'rifle-beam-apply']) assert.ok(resolveStem(id));
  for (const id of ['gate-chevron-lock', 'gate-dial']) assert.ok(resolveStem(id));
  assert.equal(stemsOfRole('music').length, 4);
  assert.ok(stemsOfRole('machine').length >= 7);
  assert.equal(resolveStem('no-such-stem'), null);

  // what is broken is said in words
  assert.ok(validateStem(null).length > 0);
  assert.ok(validateStem({ ...resolveStem('gate-dial')!, id: 'Not A Slug' }).length > 0);
  assert.ok(validateStem({ ...resolveStem('gate-dial')!, patch: { name: 'empty' } }).length > 0);
  assert.ok(validateStem({ ...resolveStem('gate-dial')!, gain: 9 }).length > 0);
  assert.ok(validateStem({ ...resolveStem('gate-dial')!, pan: 2 }).length > 0);
});

test('brightness follows the hardware: a filtered hum is darker than an open square', () => {
  const hum = renderStem(resolveStem('machine-hum-drill')!, 6, 1);
  const square = renderStem({ ...sine(220), patch: { name: 'p', atoms: [{ wave: 'square', freqHz: 220, gain: 0.4, attackMs: 2, decayMs: 400 }] } }, 6, 1);
  const humBright = brightEnergy(hum.channels[0]!, 1500, hum.sampleRateHz);
  const squareBright = brightEnergy(square.channels[0]!, 1500, square.sampleRateHz);
  assert.ok(humBright < squareBright, `the filtered hum should be darker (${humBright.toFixed(4)} vs ${squareBright.toFixed(4)})`);
  // the speaker has no filter at all, so at S0 the hum is a raw square and is far brighter than its filtered self
  const raw = renderStem(resolveStem('machine-hum-drill')!, 0, 1);
  assert.ok(brightEnergy(raw.channels[0]!, 1500, raw.sampleRateHz) > humBright);
});
