/**
 * Slow motion (test-drive toolbar): the physics step never changes, only how much simulated time a
 * real second feeds the fixed-step accumulator.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIME_SCALES, scaledDt, snapTimeScale, stepTimeScale, timeScaleLabel } from '../src/game/time-scale';
import { nextCameraMode } from '../src/components/TestDriveBar';

const STEP = 1 / 120;

/** The engine's own accumulator loop, fed `seconds` of real 60 fps frames. */
function ticksFor(seconds: number, scale: number): number {
  let acc = 0; let ticks = 0;
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f++) {
    acc = Math.min(0.1, acc + scaledDt(1 / 60, scale));
    while (acc >= STEP - 1e-12) { ticks += 1; acc -= STEP; }
  }
  return ticks;
}

test('slow motion feeds fewer fixed steps per real second, never a different step', () => {
  assert.equal(ticksFor(1, 1), 120);
  assert.equal(ticksFor(1, 0.5), 60);
  assert.equal(ticksFor(1, 0.25), 30);
  assert.equal(ticksFor(2, 0.1), 24);
  assert.equal(ticksFor(4, 0.05), 24);
});

test('the − / + steps walk the scale list and stop at the ends', () => {
  assert.deepEqual([...TIME_SCALES], [0.05, 0.1, 0.25, 0.5, 1]);
  assert.equal(stepTimeScale(1, -1), 0.5);
  assert.equal(stepTimeScale(0.5, -1), 0.25);
  assert.equal(stepTimeScale(0.05, -1), 0.05);
  assert.equal(stepTimeScale(1, 1), 1);
  assert.equal(stepTimeScale(0.1, 1), 0.25);
  assert.equal(snapTimeScale(Number.NaN), 1);
  assert.equal(snapTimeScale(-3), 1);
  assert.equal(snapTimeScale(0.3), 0.25);
  assert.equal(timeScaleLabel(0.25), '×0.25');
});

test('the camera toggle flips cockpit ↔ chase', () => {
  assert.equal(nextCameraMode('first_person'), 'follow_ball');
  assert.equal(nextCameraMode('follow_ball'), 'first_person');
  assert.equal(nextCameraMode('fixed'), 'first_person');
});

test('the wiring: the engine scales its frame dt and switches camera live', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /const dt = scaledDt\(realDt, this\.timeScale\);/);
  assert.match(engine, /setCameraMode\(mode: GameOptions\['cameraMode'\]\)/);
  assert.match(engine, /this\.accumulator = Math\.min\(0\.1, this\.accumulator \+ dt\)/, 'the step loop is unchanged');
  const editor = readFileSync(new URL('../src/screens/MapEditorScreen.tsx', import.meta.url), 'utf8');
  assert.match(editor, /<TestDriveBar /);
  const race = readFileSync(new URL('../src/screens/RaceScreen.tsx', import.meta.url), 'utf8');
  assert.match(race, /config\.mode === 'quick'[^\n]*\n\s*<TestDriveBar /);
});

// P9: every sound follows slow motion (pitch s^0.4, length 1/s^0.6), and the new cues exist.
class FakeParam { values: number[] = []; times: number[] = []; setValueAtTime(v: number, t: number) { this.values.push(v); this.times.push(t); } exponentialRampToValueAtTime(v: number, t: number) { this.values.push(v); this.times.push(t); } }
class FakeNode { frequency = new FakeParam(); gain = new FakeParam(); type = ''; buffer: unknown = null; connect(n: unknown) { return n; } start() {} stop(t?: number) { FakeContext.stops.push(t ?? 0); } }
class FakeContext {
  static made: FakeNode[] = []; static stops: number[] = [];
  currentTime = 10; sampleRate = 8000; state = 'running'; destination = {};
  private node() { const n = new FakeNode(); FakeContext.made.push(n); return n; }
  createOscillator() { return this.node(); } createGain() { return this.node(); } createBiquadFilter() { return this.node(); } createBufferSource() { return this.node(); }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
}

test('P9: slow motion lowers the pitch and stretches every sound', async () => {
  const { GameAudio, slowMotionAudio } = await import('../src/game/audio');
  assert.deepEqual(slowMotionAudio(1), { pitch: 1, stretch: 1 });
  const half = slowMotionAudio(0.5);
  assert.ok(Math.abs(half.pitch - 0.5 ** 0.4) < 1e-12 && Math.abs(half.stretch - 1 / 0.5 ** 0.6) < 1e-12);
  const g = globalThis as unknown as { AudioContext?: unknown };
  const saved = g.AudioContext;
  g.AudioContext = FakeContext;
  try {
    const audio = new GameAudio();
    audio.setEnabled(true);
    const played = (name: Parameters<typeof audio.play>[0], scale: number) => {
      FakeContext.made = []; FakeContext.stops = [];
      audio.setTimeScale(scale);
      audio.play(name);
      const first = FakeContext.made.find((n) => n.frequency.values.length > 0)!;
      return { hz: first.frequency.values[0], end: Math.max(...FakeContext.stops) - 10 };
    };
    for (const name of ['bump', 'thud', 'lane_clunk', 'go', 'tree_smash', 'rope_reel'] as const) {
      const normal = played(name, 1); const slow = played(name, 0.5);
      assert.ok(Math.abs(slow.hz / normal.hz - half.pitch) < 1e-9, `${name}: pitch follows slow motion`);
      assert.ok(Math.abs(slow.end / normal.end - half.stretch) < 1e-9, `${name}: and lasts longer`);
    }
    assert.ok(played('rope_reel', 1).end > 0.2, 'the ratchet is a run of teeth, not one click');
  } finally {
    g.AudioContext = saved;
  }
});

test('P9: the engine cues the new sounds and hands it the time scale', async () => {
  const { readFileSync } = await import('node:fs');
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /this\.audio\.setTimeScale\(this\.timeScale\)/);
  assert.match(engine, /this\.audio\.play\('lane_clunk', 0\.7\)/);
  assert.match(engine, /this\.audio\.play\('rope_reel'\)/);
  assert.equal((engine.match(/this\.audio\.play\('go'/g) ?? []).length, 3, 'the start and both ways out of the pool');
  const physics = readFileSync(new URL('../src/game/sim/racer-physics.ts', import.meta.url), 'utf8');
  assert.match(physics, /ctx\.fx\.audio\('tree_smash'\)/);
});
