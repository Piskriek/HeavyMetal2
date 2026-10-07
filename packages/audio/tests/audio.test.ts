import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX, SFX_IDS, midiToHz, engineParams, rollParams, musicPattern, patternDurationSec, createAudioEngine, type AudioContextLike, type MusicPattern } from '../src';

const near = (a: number, b: number, e = 1e-6): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

function fakeCtx() {
  const log = { osc: 0, gain: 0, filter: 0, src: 0, started: 0, stopped: 0, closed: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect: () => undefined, disconnect: () => undefined });
  const ctx: AudioContextLike = {
    currentTime: 1, sampleRate: 48000, destination: {}, state: 'suspended', resume() { this.state = 'running'; }, close() { log.closed++; },
    createOscillator: () => { log.osc++; return { ...node(), type: 'sine', frequency: param(), detune: param(), start() { log.started++; }, stop() { log.stopped++; } }; },
    createGain: () => { log.gain++; return { ...node(), gain: param() }; },
    createBiquadFilter: () => { log.filter++; return { ...node(), type: 'lowpass', frequency: param(), Q: param() }; },
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => { log.src++; return { ...node(), buffer: null, loop: false, start() { log.started++; }, stop() { log.stopped++; } }; },
  };
  return { ctx, log };
}

test('the sfx library: 40 ids, every recipe sane', () => {
  // 29, then 11 for the first Play (lever, relays, surge, coils, static, gate, sync warning and loss, mill, stage, steps)
  assert.equal(SFX_IDS.length, 40); assert.deepEqual(Object.keys(SFX).sort(), [...SFX_IDS].sort());
  for (const id of SFX_IDS) {
    const r = SFX[id]!; assert.equal(r.id, id); assert.ok(r.layers.length >= 1 && r.layers.length <= 4, id); assert.ok(r.durationMs > 20 && r.durationMs <= 1600, id);
    assert.ok(['race', 'editor', 'ui', 'game'].includes(r.category));
    let sum = 0;
    for (const l of r.layers) {
      sum += l.gain; assert.ok(l.gain > 0 && l.gain <= 0.8, `${id} gain`); assert.ok(l.attackMs >= 0 && l.decayMs > 0);
      assert.ok((l.delayMs ?? 0) + l.attackMs + l.decayMs <= r.durationMs + 1e-9, `${id} layer longer than the recipe`);
      if (l.wave !== 'noise') assert.ok(l.freq[0] >= 20 && l.freq[0] <= 20000 && l.freq[1] >= 20 && l.freq[1] <= 20000, `${id} freq`);
      if (l.filter) { assert.ok(l.filter.q > 0 && l.filter.freq[0] >= 20 && l.filter.freq[1] <= 20000); }
    }
    assert.ok(sum <= 1.6, `${id} total gain ${sum}`);
  }
  assert.ok(SFX['ui-click']!.durationMs <= 60 + 40 && SFX['paint-tick']!.durationMs <= 110 && SFX['sculpt-tick']!.durationMs <= 130 && SFX['snap']!.durationMs <= 80);
  assert.ok(SFX['ui-hover']!.layers[0]!.gain < SFX['ui-click']!.layers[0]!.gain);
  assert.equal(SFX['ui-click']!.category, 'ui'); assert.equal(SFX['boost']!.category, 'race'); assert.equal(SFX['place']!.category, 'editor');
  assert.ok(SFX['finish']!.durationMs >= 800);
});

test('midi and engine parameters', () => {
  near(midiToHz(69), 440); near(midiToHz(57), 220); near(midiToHz(81), 880, 1e-9);
  const idle = engineParams(0, 0, 40), mid = engineParams(20, 0.5, 40), fast = engineParams(40, 1, 40);
  assert.ok(idle.freq < mid.freq && mid.freq < fast.freq); assert.ok(idle.gain < mid.gain && mid.gain < fast.gain);
  assert.ok(idle.filterFreq < fast.filterFreq && idle.noiseGain < fast.noiseGain);
  near(idle.freq, 70); near(fast.freq, 70 + 190 + 30);
  assert.deepEqual(engineParams(Number.NaN, Number.POSITIVE_INFINITY, 0), engineParams(0, 0, 1));
  assert.ok(engineParams(100, 1, 40).freq < 70 + 190 * 1.5 + 31);
});
test('roll parameters by surface', () => {
  assert.equal(rollParams(30, 'air').gain, 0); assert.equal(rollParams(0, 'road').gain, 0);
  const road = rollParams(30, 'road'), sand = rollParams(30, 'sand'), grass = rollParams(30, 'grass'), water = rollParams(30, 'water');
  assert.ok(road.filterFreq > sand.filterFreq && road.gain > grass.gain && water.filterFreq > road.filterFreq);
  assert.ok(rollParams(10, 'road').gain < rollParams(30, 'road').gain && rollParams(300, 'road').gain <= 0.25 + 1e-9);
  assert.ok(rollParams(10, 'road').filterFreq < rollParams(30, 'road').filterFreq);
});

const PENTA = [0, 2, 4, 7, 9];
test('music: deterministic, in key, voices, bars, no overlaps', () => {
  const a = musicPattern(11, 8), b = musicPattern(11, 8), c = musicPattern(12, 8);
  assert.deepEqual(a, b); assert.notDeepEqual(a.notes, c.notes);
  assert.equal(a.bpm, 100); assert.equal(a.bars, 8); assert.ok([48, 50, 52, 55, 57].includes(a.key)); assert.equal(musicPattern(1, 4, { mood: 'energetic' }).bpm, 138); assert.equal(musicPattern(1, 4, { mood: 'dramatic' }).bpm, 112); assert.equal(musicPattern(1, 4, { bpm: 90 }).bpm, 90);
  for (let bar = 0; bar < 8; bar++) assert.ok(a.notes.some((n) => n.voice === 'bass' && n.beat === bar * 4), `bass on beat 1 of bar ${bar}`);
  for (const n of a.notes) { assert.ok(n.beat >= 0 && n.beat + n.duration <= 32 + 1e-9 && n.duration > 0); assert.ok(n.velocity >= 1 && n.velocity <= 127); }
  for (const n of a.notes.filter((x) => x.voice === 'lead')) assert.ok(PENTA.includes((((n.midi - a.key) % 12) + 12) % 12), `lead note ${n.midi} not in the pentatonic of ${a.key}`);
  for (const voice of ['bass', 'lead', 'pad', 'perc'] as const) { const ns = a.notes.filter((n) => n.voice === voice).sort((x, y) => x.beat - y.beat); for (let i = 1; i < ns.length; i++) if (voice !== 'pad' && voice !== 'perc') assert.ok(ns[i - 1]!.beat + ns[i - 1]!.duration <= ns[i]!.beat + 1e-9, `${voice} overlap`); }
  assert.ok(a.notes.some((n) => n.voice === 'pad') && a.notes.some((n) => n.voice === 'perc' && n.midi === 36));
  assert.ok(musicPattern(1, 4, { mood: 'energetic' }).notes.some((n) => n.voice === 'perc' && n.midi === 42)); assert.ok(!a.notes.some((n) => n.voice === 'perc' && n.midi === 42));
  near(patternDurationSec(a), (8 * 4 * 60) / 100); assert.deepEqual(musicPattern(1, 0).notes, []);
});
test('player: null context is a safe no-op, volumes clamp', () => {
  const e = createAudioEngine(null); e.resume(); e.playSfx('ui-click'); e.setEngine('p1', { freq: 100, gain: 0.1, filterFreq: 800, noiseGain: 0.02 }); e.stopEngine('p1'); e.playMusic(musicPattern(1, 2)); e.stopMusic(); e.dispose();
  e.setVolumes({ master: 3, sfx: -1 }); assert.deepEqual(e.volumes, { master: 1, sfx: 0, music: e.volumes.music });
});
test('player: sfx builds oscillators with envelopes and stops them; unknown ids ignored; noise buffer cached', () => {
  const { ctx, log } = fakeCtx(); const e = createAudioEngine(ctx);
  e.resume(); assert.equal(ctx.state, 'running');
  const before = log.osc + log.src; e.playSfx('ui-click'); assert.ok(log.osc + log.src > before); assert.equal(log.started, log.stopped);
  const n1 = log.src; e.playSfx('paint-tick'); e.playSfx('paint-tick'); assert.ok(log.src >= n1);
  const total = log.osc + log.src; e.playSfx('nope' as never); assert.equal(log.osc + log.src, total);
  e.dispose(); assert.equal(log.closed, 1);
});
test('player: engine nodes are created once and then only updated; music schedules every note', () => {
  const { ctx, log } = fakeCtx(); const e = createAudioEngine(ctx);
  e.setEngine('p1', engineParams(10, 0.5, 40)); const made = log.osc + log.src + log.gain; e.setEngine('p1', engineParams(30, 1, 40)); assert.equal(log.osc + log.src + log.gain, made);
  const s = log.started; e.stopEngine('p1'); assert.ok(log.stopped > 0 && log.started === s);
  const p: MusicPattern = musicPattern(3, 2); const o = log.osc + log.src; e.playMusic(p); assert.ok(log.osc + log.src - o >= p.notes.length);
  e.stopMusic(); assert.ok(log.stopped > 0);
});

test('an ambience bed starts its layers once, follows its gain, and stops when faded to nothing', () => {
  const { ctx, log } = fakeCtx(); const e = createAudioEngine(ctx);
  const layers = [
    { wave: 'noise' as const, freq: 200, gain: 0.4, lfoHz: 0.1, lfoDepth: 0.5, filter: 'lowpass' as const, cutoff: 800 },
    { wave: 'sine' as const, freq: 3000, gain: 0.2, lfoHz: 8, lfoDepth: 0.9, filter: 'bandpass' as const, cutoff: 3000 },
  ];
  e.setBed('forest', layers, 0); assert.equal(log.started, 0, 'silent: nothing starts');
  e.setBed('forest', layers, 0.7); const started = log.started; assert.equal(started, 4, 'two sources and two wobbles');
  e.setBed('forest', layers, 0.4); assert.equal(log.started, started, 'a new gain reuses the bed');
  e.setBed('forest', layers, 0); assert.equal(log.stopped, 4);
  e.setBed('forest', layers, 0.5); assert.equal(log.started, 8, 'it can come back');
  e.dispose(); assert.equal(log.stopped, 8);
});
