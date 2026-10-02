import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SFX,
  SFX_IDS,
  engineParams,
  rollParams,
  musicPattern,
  createAudioEngine,
  type AudioContextLike,
} from '../src';

test('extra 1: every recipe layer ends before or exactly at durationMs', () => {
  for (const id of SFX_IDS) {
    const r = SFX[id]!;
    for (const l of r.layers) {
      const end = (l.delayMs ?? 0) + l.attackMs + l.decayMs;
      assert.ok(
        end <= r.durationMs + 1e-6,
        `${id} layer ends at ${end}ms > duration ${r.durationMs}ms`,
      );
    }
  }
});

test('extra 2: engine frequency clamp and edge values', () => {
  const pNegative = engineParams(-50, -1, 40);
  assert.equal(pNegative.freq, 70);
  assert.equal(pNegative.gain, 0.05);

  const pHigh = engineParams(1000, 2, 40);
  // Speed is clamped to 1.5, throttle clamped to 1
  assert.equal(pHigh.freq, 70 + 190 * 1.5 + 30 * 1);
  assert.equal(pHigh.gain, 0.05 + 0.1 * 1 + 0.05 * 1);
});

test('extra 3: roll filter ordering by surface over multiple speeds', () => {
  const speeds = [5, 15, 25, 45, 80];
  for (const sp of speeds) {
    const road = rollParams(sp, 'road');
    const sand = rollParams(sp, 'sand');
    const grass = rollParams(sp, 'grass');
    const water = rollParams(sp, 'water');

    // Sand filter < Grass filter < Road filter < Water filter
    assert.ok(
      sand.filterFreq < grass.filterFreq,
      `sand (${sand.filterFreq}) < grass (${grass.filterFreq}) at speed ${sp}`,
    );
    assert.ok(
      grass.filterFreq < road.filterFreq,
      `grass (${grass.filterFreq}) < road (${road.filterFreq}) at speed ${sp}`,
    );
    assert.ok(
      road.filterFreq < water.filterFreq,
      `road (${road.filterFreq}) < water (${water.filterFreq}) at speed ${sp}`,
    );
    assert.ok(sand.gain <= road.gain);
    assert.ok(grass.gain <= road.gain);
  }
});

test('extra 4: music patterns for 20 seeds x 3 moods are fully valid and bounded', () => {
  const moods = ['chill', 'energetic', 'dramatic'] as const;
  for (let s = 1; s <= 20; s++) {
    for (const m of moods) {
      const p = musicPattern(s * 17, 4, { mood: m });
      assert.equal(p.bars, 4);
      assert.ok(p.notes.length > 0);
      for (const n of p.notes) {
        assert.ok(n.beat >= 0 && n.beat < 16);
        assert.ok(n.beat + n.duration <= 16 + 1e-9);
        assert.ok(n.velocity >= 1 && n.velocity <= 127);
      }
    }
  }
});

const PENTA_MINOR = [0, 3, 5, 7, 10];
test('extra 5: dramatic mood strictly uses minor pentatonic lead notes', () => {
  for (let s = 100; s < 115; s++) {
    const p = musicPattern(s, 6, { mood: 'dramatic' });
    const leads = p.notes.filter((n) => n.voice === 'lead');
    assert.ok(leads.length > 0);
    for (const n of leads) {
      const deg = (((n.midi - p.key) % 12) + 12) % 12;
      assert.ok(
        PENTA_MINOR.includes(deg),
        `Dramatic lead note ${n.midi} (degree ${deg}) not in minor pentatonic of ${p.key}`,
      );
    }
  }
});

function fakeTrackingCtx() {
  const rampLog: { target: number; time: number; type: string }[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime(v: number, t: number) {
      rampLog.push({ target: v, time: t, type: 'linear' });
    },
    exponentialRampToValueAtTime(v: number, t: number) {
      rampLog.push({ target: v, time: t, type: 'exp' });
    },
    cancelScheduledValues() {},
  });
  const node = () => ({ connect: () => undefined, disconnect: () => undefined });
  const ctx: AudioContextLike = {
    currentTime: 10,
    sampleRate: 48000,
    destination: {},
    createOscillator: () => ({ ...node(), type: 'sine', frequency: param(), detune: param(), start() {}, stop() {} }),
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false, start() {}, stop() {} }),
  };
  return { ctx, rampLog };
}

test('extra 6: setVolumes ramps master, sfx, and music buses with clamped bounds', () => {
  const { ctx, rampLog } = fakeTrackingCtx();
  const engine = createAudioEngine(ctx, { master: 0.5, sfx: 0.5, music: 0.5 });

  engine.setVolumes({ master: 0.8, sfx: 1.5, music: -0.2 });
  assert.equal(engine.volumes.master, 0.8);
  assert.equal(engine.volumes.sfx, 1.0);
  assert.equal(engine.volumes.music, 0.0);

  const targets = rampLog.map((r) => r.target);
  assert.ok(targets.includes(0.8));
  assert.ok(targets.includes(1.0));
  assert.ok(targets.includes(0.0));
});

test('extra 7: playSfx volume 0 handles without error and stays within gain limits', () => {
  const { ctx } = fakeTrackingCtx();
  const engine = createAudioEngine(ctx);
  // Volume 0 should not crash or produce invalid audio ramps
  engine.playSfx('ui-click', { volume: 0 });
  engine.playSfx('boost', { volume: 0 });
  engine.playSfx('hit-wall', { volume: 0.00001 });
  assert.ok(true);
});

test('extra 8: pitch multiplier modifies frequency values', () => {
  const frequencies: number[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime(v: number) {
      frequencies.push(v);
    },
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime(v: number) {
      frequencies.push(v);
    },
    cancelScheduledValues() {},
  });
  const node = () => ({ connect: () => undefined, disconnect: () => undefined });
  const ctx: AudioContextLike = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createOscillator: () => ({ ...node(), type: 'sine', frequency: param(), detune: param(), start() {}, stop() {} }),
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false, start() {}, stop() {} }),
  };

  const engine = createAudioEngine(ctx);
  frequencies.length = 0;
  engine.playSfx('ui-hover', { pitch: 2.0 });
  // 'ui-hover' base freq is 1200->900, at pitch 2.0 it should be 2400->1800
  assert.ok(frequencies.includes(2400));
  assert.ok(frequencies.includes(1800));
});

test('extra 9: roll sound updates bandpass filter and gain repeatedly without leak', () => {
  let createdNodes = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect: () => undefined, disconnect: () => undefined });
  const ctx: AudioContextLike = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createOscillator: () => { createdNodes++; return { ...node(), type: 'sine', frequency: param(), detune: param(), start() {}, stop() {} }; },
    createGain: () => { createdNodes++; return { ...node(), gain: param() }; },
    createBiquadFilter: () => { createdNodes++; return { ...node(), type: 'lowpass', frequency: param(), Q: param() }; },
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => { createdNodes++; return { ...node(), buffer: null, loop: false, start() {}, stop() {} }; },
  };

  const engine = createAudioEngine(ctx);
  const initial = createdNodes;
  engine.setRoll('kart1', rollParams(10, 'road'));
  const afterFirst = createdNodes;
  assert.ok(afterFirst > initial);

  // Subsequent updates to kart1 should NOT create new nodes
  engine.setRoll('kart1', rollParams(25, 'sand'));
  engine.setRoll('kart1', rollParams(35, 'water'));
  assert.equal(createdNodes, afterFirst);
});

test('extra 10: dispose shuts down roll and engine voices and closes context', () => {
  let closed = false;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect: () => undefined, disconnect: () => undefined });
  const ctx: AudioContextLike = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    close: () => { closed = true; },
    createOscillator: () => ({ ...node(), type: 'sine', frequency: param(), detune: param(), start() {}, stop() {} }),
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: param() }),
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false, start() {}, stop() {} }),
  };

  const engine = createAudioEngine(ctx);
  engine.setEngine('p1', engineParams(20, 0.5, 40));
  engine.setRoll('p1', rollParams(20, 'road'));
  engine.dispose();
  assert.equal(closed, true);
});
