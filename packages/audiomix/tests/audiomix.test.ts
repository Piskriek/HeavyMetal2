import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUS_IDS,
  BUS_START,
  CHIME_IDLE,
  DUCK,
  busOfSound,
  chimeRatio,
  chimeStep,
  crushForStage,
  dbToGain,
  duckGainAt,
  duckLevelDb,
  type ChimeState,
} from '../src/index';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('every approved sound and every source id lands on exactly one of the five buses', () => {
  const index = JSON.parse(readFileSync(new URL('../../../apps/web/public/audio/index.json', import.meta.url), 'utf8')) as { id: string; kind: string }[];
  assert.ok(index.length >= 40, 'the approved index is read');
  for (const e of index) {
    const bus = busOfSound(e.id);
    assert.ok(BUS_IDS.includes(bus), e.id);
  }
  assert.equal(BUS_IDS.length, 5);
  assert.equal(new Set(BUS_IDS).size, 5);
});

test('the routing: UI and weapons on combat and UI, music on music, ambience on ambience, the rest on world', () => {
  assert.equal(busOfSound('sfx-ui-select'), 'combatUi');
  assert.equal(busOfSound('sfx-ui-hover'), 'combatUi');
  assert.equal(busOfSound('sfx-refuse'), 'combatUi');
  assert.equal(busOfSound('sfx-fire-semi'), 'combatUi');
  assert.equal(busOfSound('sfx-fire-beam'), 'combatUi');
  assert.equal(busOfSound('sfx-reload'), 'combatUi');
  assert.equal(busOfSound('sfx-empty'), 'combatUi');
  assert.equal(busOfSound('music-lab'), 'music');
  assert.equal(busOfSound('music-moon-s3'), 'music');
  assert.equal(busOfSound('amb-lab-vent'), 'ambience');
  assert.equal(busOfSound('sfx-breaker'), 'world');
  assert.equal(busOfSound('sfx-storm'), 'world');
  assert.equal(busOfSound('sfx-pickup-2'), 'world');
  assert.equal(busOfSound('sfx-impact'), 'world');
});

test('starting gains: voice and music are the owner mix, the rest are Argo levels in dB', () => {
  near(BUS_START.voice, 0.8);
  near(BUS_START.music, 0.45);
  near(BUS_START.combatUi, dbToGain(-4));
  near(BUS_START.world, dbToGain(-6));
  near(BUS_START.ambience, dbToGain(-12));
  near(dbToGain(-6), 0.5012, 1e-3);
});

test('the duck depths and times are the brief numbers', () => {
  assert.equal(DUCK.attackS, 0.08);
  assert.equal(DUCK.releaseS, 0.45);
  assert.equal(DUCK.depthDb.world, -6.5);
  assert.equal(DUCK.depthDb.music, -8);
  assert.equal(DUCK.depthDb.ambience, -5);
  assert.equal(DUCK.depthDb.combatUi, -2);
  assert.equal(DUCK.depthDb.voice, 0);
  assert.equal(DUCK.worldLowpassHz, 1800);
});

test('the duck ramps in over 80 ms and out over 450 ms, and the voice itself is never ducked', () => {
  near(duckLevelDb('world', 0, null), 0);
  near(duckLevelDb('world', 0.04, null), -3.25, 1e-9);
  near(duckLevelDb('world', 0.08, null), -6.5, 1e-9);
  near(duckLevelDb('world', 3, null), -6.5, 1e-9);
  // released at 2 s: halfway through the 450 ms release is half the depth
  near(duckLevelDb('music', 2.225, 2), -4, 1e-9);
  near(duckLevelDb('music', 2.45, 2), 0, 1e-9);
  near(duckLevelDb('music', 3, 2), 0, 1e-9);
  for (const t of [0, 0.5, 1, 4]) near(duckLevelDb('voice', t, null), 0);
  near(duckGainAt('music', 1, null), dbToGain(-8));
});

test('a release that comes before the attack finishes starts from the level reached', () => {
  // released at 0.04 s: the attack was half done, so the level is -3.25 dB and falls to 0 over 450 ms from there
  near(duckLevelDb('world', 0.04, 0.04), -3.25, 1e-9);
  near(duckLevelDb('world', 0.04 + 0.225, 0.04), -3.25 / 2, 1e-9);
  near(duckLevelDb('world', 0.04 + 0.45, 0.04), 0, 1e-9);
});

test('the bit-depth mirror: 8 kHz at 4 bits, 11 kHz at 8, 22 kHz at 12, full from stage 3', () => {
  assert.deepEqual(crushForStage(0), { rateHz: 8000, bits: 4 });
  assert.deepEqual(crushForStage(1), { rateHz: 11025, bits: 8 });
  assert.deepEqual(crushForStage(2), { rateHz: 22050, bits: 12 });
  for (const s of [3, 4, 5, 6]) assert.equal(crushForStage(s), null, `stage ${s}`);
  assert.equal(crushForStage(9), null);
  assert.deepEqual(crushForStage(-1), { rateHz: 8000, bits: 4 });
  assert.deepEqual(crushForStage(1.7), { rateHz: 11025, bits: 8 });
  assert.deepEqual(crushForStage(Number.NaN), { rateHz: 8000, bits: 4 });
});

test('the chime ladder rises a semitone per consecutive chunk and resets after 1.2 s', () => {
  let st: ChimeState = CHIME_IDLE;
  const seen: number[] = [];
  for (const t of [10, 10.4, 10.9, 11.3]) {
    const r = chimeStep(st, t);
    seen.push(r.semitones);
    st = r.state;
  }
  assert.deepEqual(seen, [0, 1, 2, 3]);
  // a gap of 1.5 s after the last chunk: a new run
  const after = chimeStep(st, 11.3 + 1.5);
  assert.equal(after.semitones, 0);
  // a gap just inside 1.2 s continues the run, just outside starts a new one
  assert.equal(chimeStep(chimeStep(CHIME_IDLE, 5).state, 6.1).semitones, 1);
  assert.equal(chimeStep(chimeStep(CHIME_IDLE, 5).state, 6.3).semitones, 0);
});

test('the chime stops at an octave, and a semitone is 2^(n/12)', () => {
  let st: ChimeState = CHIME_IDLE;
  let last = 0;
  for (let i = 0; i < 20; i++) {
    const r = chimeStep(st, i * 0.5);
    last = r.semitones;
    st = r.state;
  }
  assert.equal(last, 12);
  near(chimeRatio(0), 1);
  near(chimeRatio(12), 2);
  near(chimeRatio(1), 2 ** (1 / 12));
});
