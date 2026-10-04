import test from 'node:test';
import assert from 'node:assert/strict';
import { AMBIENCES, emitterGain, mixAt, panOf, zoneGain, type Emitter, type Zone } from '../src/index';
const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const em = (id: string, x: number, volume = 1): Emitter => ({ id, pos: [x, 0, 0], sound: id, volume, radius: 2, falloff: 4, loop: true });
const zone = (id: string, ambience: string, x: number, volume = 1): Zone => ({ id, centre: [x, 0, 0], half: [5, 5, 5], fade: 10, ambience, volume });

test('an emitter is full inside its radius and fades to nothing', () => {
  near(emitterGain(em('a', 0), [1, 0, 0]), 1);
  near(emitterGain(em('a', 0), [4, 0, 0]), 0.5);
  near(emitterGain(em('a', 0), [6, 0, 0]), 0);
  near(emitterGain(em('a', 0, 0.4), [0, 0, 0]), 0.4);
  near(emitterGain({ ...em('a', 0), falloff: 0 }, [2.5, 0, 0]), 0);
});
test('a zone is full inside and fades over its edge', () => {
  near(zoneGain(zone('z', 'forest-birds', 0), [3, 0, 0]), 1);
  near(zoneGain(zone('z', 'forest-birds', 0), [10, 0, 0]), 0.5);
  near(zoneGain(zone('z', 'forest-birds', 0), [16, 0, 0]), 0);
});
test('pan: right is +1, left -1, ahead 0', () => {
  near(panOf([0, 0, 0], 0, [5, 0, 0]), 1);
  near(panOf([0, 0, 0], 0, [-5, 0, 0]), -1);
  near(panOf([0, 0, 0], 0, [0, 0, 5]), 0);
  near(panOf([0, 0, 0], 90, [0, 0, -5]), 1);
});
test('the mix: loudest voices first, limited; beds merged and normalised', () => {
  const mix = mixAt([0, 0, 0], 0, [em('far', 5), em('near', 1), em('mid', 3), em('gone', 50)], [zone('z1', 'rainy-day', 0), zone('z2', 'rainy-day', 0, 0.5), zone('z3', 'windy-hill', 0)], 2);
  assert.deepEqual(mix.voices.map((v) => v.id), ['near', 'mid']);
  assert.equal(mix.beds.length, 2);
  near(mix.beds[0]!.gain + mix.beds[1]!.gain, 1);
});
test('eight ambiences, each a legal synth recipe', () => {
  assert.deepEqual(AMBIENCES.map((a) => a.id).sort(), ['beach-waves', 'busy-city', 'campfire-night', 'creepy-cave', 'forest-birds', 'lava-rumble', 'rainy-day', 'windy-hill']);
  for (const a of AMBIENCES) {
    assert.ok(a.layers.length >= 2 && a.layers.length <= 5, a.id);
    assert.ok(a.layers.reduce((s, l) => s + l.gain, 0) <= 1 + 1e-9, a.id);
    for (const l of a.layers) assert.ok(l.gain > 0 && l.freq >= 20 && l.freq <= 16000 && l.cutoff >= 20 && l.cutoff <= 16000 && l.lfoHz >= 0 && l.lfoHz <= 20, a.id);
  }
});

test('emitter gain: hard edge, volume scaling, listener on the source', () => {
  near(emitterGain({ ...em('a', 0), falloff: 0 }, [2, 0, 0]), 1);
  near(emitterGain({ ...em('a', 0), falloff: 0 }, [2.5, 0, 0]), 0);
  near(emitterGain(em('a', 0, 0.25), [2, 0, 0]), 0.25);
  near(emitterGain(em('a', 0), [0, 0, 0]), 1);
  near(emitterGain({ ...em('a', 0), radius: 0, falloff: 0 }, [0, 0, 0]), 1);
  near(emitterGain({ ...em('a', 0), radius: 1, falloff: 3 }, [2, 0, 0]), 2 / 3);
});

test('zone gain: box corners, hard edge, volume scaling', () => {
  near(zoneGain(zone('z', 'forest-birds', 0), [4, 4, 4]), 1);
  near(zoneGain({ ...zone('z', 'forest-birds', 0), fade: 0 }, [5, 0, 0]), 1);
  near(zoneGain({ ...zone('z', 'forest-birds', 0), fade: 0 }, [6, 0, 0]), 0);
  near(zoneGain(zone('z', 'forest-birds', 0, 0.3), [10, 0, 0]), 0.15);
  near(zoneGain(zone('z', 'forest-birds', 0), [10, 10, 10]), 1 - Math.sqrt(75) / 10);
  near(zoneGain(zone('z', 'forest-birds', 0), [15, 15, 15]), 0);
});

test('pan: behind, above, and rotated', () => {
  near(panOf([0, 0, 0], 0, [0, 0, -5]), 0);
  near(panOf([0, 0, 0], 0, [3, 0, -3]), Math.SQRT1_2);
  near(panOf([0, 0, 0], 180, [5, 0, 0]), -1);
  near(panOf([0, 0, 0], 0, [0, 5, 0]), 0);
  near(panOf([1, 2, 3], 0, [1, 2, 3]), 0);
  near(panOf([4, 0, -4], 0, [0, 0, -4]), -1);
});

test('mix: silent emitters never become voices, maxVoices 0 mutes', () => {
  const mix = mixAt([0, 0, 0], 0, [em('quiet', 0, 0), em('loud', 0)], [], undefined);
  assert.deepEqual(mix.voices.map((v) => v.id), ['loud']);
  assert.deepEqual(mix.beds, []);
  assert.deepEqual(mixAt([0, 0, 0], 0, [em('loud', 0)], [], 0).voices, []);
});

test('mix: ties keep emitter order, a generous limit keeps everything', () => {
  const mix = mixAt([0, 0, 0], 0, [em('first', 3), em('second', 3), em('third', 3)], [], 99);
  assert.deepEqual(mix.voices.map((v) => v.id), ['first', 'second', 'third']);
  near(mix.voices[0]!.gain, 0.75);
  near(mix.voices[0]!.pan, 1);
  near(mix.voices[2]!.gain, 0.75);
});

test('voices keep the emitter sound and the pan of the facing direction', () => {
  const mix = mixAt(
    [0, 0, 0],
    45,
    [{ id: 'e', pos: [10, 0, 10], sound: 'bell.wav', volume: 1, radius: 2, falloff: 40, loop: false }],
    [],
    8,
  );
  const v = mix.voices[0]!;
  assert.equal(v.id, 'e');
  assert.equal(v.sound, 'bell.wav');
  near(v.gain, 1 - (Math.sqrt(200) - 2) / 40);
  near(v.pan, 0);
});

test('beds: zero-gain zones dropped, the loudest zone of a name wins', () => {
  const mix = mixAt(
    [0, 0, 0],
    0,
    [],
    [zone('far', 'forest-birds', 200), zone('a', 'busy-city', 0, 0.25), zone('b', 'busy-city', 0, 0.5), zone('c', 'lava-rumble', 0, 0.25)],
    undefined,
  );
  assert.deepEqual(mix.beds, [
    { ambience: 'busy-city', gain: 0.5 },
    { ambience: 'lava-rumble', gain: 0.25 },
  ]);
});

test('beds: an over-unity stack is scaled to exactly 1', () => {
  const mix = mixAt([0, 0, 0], 0, [], [zone('a', 'rainy-day', 0), zone('b', 'beach-waves', 0, 0.75), zone('c', 'lava-rumble', 0, 0.5)], undefined);
  let total = 0;
  for (const b of mix.beds) total += b.gain;
  near(total, 1);
  assert.deepEqual(mix.beds.map((b) => b.ambience), ['rainy-day', 'beach-waves', 'lava-rumble']);
  near(mix.beds[0]!.gain, 1 / 2.25);
  near(mix.beds[1]!.gain, 0.75 / 2.25);
  near(mix.beds[2]!.gain, 0.5 / 2.25);
});

test('ambience recipes sound like their names', () => {
  const by = new Map(AMBIENCES.map((a) => [a.id, a] as const));
  const get = (id: string) => {
    const a = by.get(id);
    assert.ok(a, id);
    return a;
  };

  const birds = get('forest-birds');
  assert.ok(birds.layers.some((l) => l.wave === 'sine' && l.freq >= 1000 && l.lfoHz >= 5 && l.lfoDepth >= 0.5));
  assert.ok(birds.layers.some((l) => l.wave === 'noise'));

  const wind = get('windy-hill');
  assert.ok(wind.layers.some((l) => l.wave === 'noise' && l.filter === 'lowpass' && l.lfoHz < 1 && l.lfoDepth >= 0.4));

  const cave = get('creepy-cave');
  assert.ok(cave.layers.some((l) => l.wave === 'sine' && l.freq < 100));
  assert.ok(cave.layers.some((l) => l.filter === 'bandpass' && l.freq >= 500));

  const city = get('busy-city');
  assert.ok(city.layers.some((l) => l.wave === 'noise' && l.filter === 'bandpass' && l.freq >= 500));
  assert.ok(city.layers.some((l) => l.wave === 'sine' && l.freq < 200));

  const rain = get('rainy-day');
  assert.ok(rain.layers.some((l) => l.filter === 'highpass'));
  assert.ok(rain.layers.every((l) => l.wave === 'noise'));

  const waves = get('beach-waves');
  assert.ok(waves.layers.some((l) => l.wave === 'noise' && l.filter === 'lowpass'));
  assert.ok(waves.layers.some((l) => l.lfoHz >= 0.1 && l.lfoHz <= 0.2 && l.lfoDepth >= 0.5));

  const fire = get('campfire-night');
  assert.ok(fire.layers.some((l) => l.filter === 'bandpass' && l.lfoHz >= 5));
  assert.ok(fire.layers.some((l) => l.wave === 'sine' && l.freq < 200));

  const lava = get('lava-rumble');
  assert.ok(lava.layers.some((l) => l.freq < 60 && l.filter === 'lowpass'));
  assert.ok(lava.layers.every((l) => l.freq <= 400));
});

test('every ambience is named and its layers stay within (0, 1] in total', () => {
  for (const a of AMBIENCES) {
    assert.equal(typeof a.name, 'string');
    assert.ok(a.name.length > 0, a.id);
    let sum = 0;
    for (const l of a.layers) {
      sum += l.gain;
      assert.ok(l.lfoDepth >= 0 && l.lfoDepth <= 1, a.id);
    }
    assert.ok(sum <= 1, a.id);
  }
});