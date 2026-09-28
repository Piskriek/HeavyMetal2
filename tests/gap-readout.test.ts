/**
 * H9: the cockpit shows the gap to the rider directly ahead ("+0.8 s to P36"), coloured by whether
 * it is closing, and a strip map draws the whole field (up to 100) along the top of the screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAP_MIN_SPEED, gapLabel, gapSeconds, gapTrend } from '../src/game/gap';
import { createCockpitState, fillCockpitState } from '../src/game/cockpit';
import { INITIAL_SNAPSHOT } from '../src/game/types';

test('H9: the gap is distance over the player\'s speed, or time since the rider ahead finished', () => {
  assert.equal(gapSeconds(10800, 10000, 1000, null, 30), 0.8);
  assert.equal(gapSeconds(10800, 10000, 0, null, 30), 800 / GAP_MIN_SPEED, 'a stopped player uses the floor speed, not a divide by zero');
  assert.equal(gapSeconds(9000, 10000, 1000, null, 30), 0, 'never negative');
  assert.equal(gapSeconds(80000, 70000, 900, 41.5, 43), 1.5, 'behind a finished rider: time since they crossed');
});

test('H9: the trend is closing, steady or falling, and resets when the rider ahead changes', () => {
  const previous = { place: 36, seconds: 1.2, name: 'NIX', trend: 'steady' as const };
  assert.equal(gapTrend(previous, 36, 1.0, 1), 'closing');
  assert.equal(gapTrend(previous, 36, 1.21, 1), 'steady');
  assert.equal(gapTrend(previous, 36, 1.6, 1), 'falling');
  assert.equal(gapTrend(previous, 35, 0.4, 1), 'steady', 'a new rider ahead starts steady');
  assert.equal(gapTrend(null, 36, 1, 1), 'steady');
});

test('H9: the chip reads "+0.8 s to P36"', () => {
  assert.equal(gapLabel({ place: 36, seconds: 0.8 }), '+0.8 s to P36');
  assert.equal(gapLabel({ place: 2, seconds: 12.4 }), '+12 s to P2');
});

test('H9: the cockpit channel carries the gap; no rider ahead hides the chip', () => {
  const state = createCockpitState();
  const snapshot = { ...INITIAL_SNAPSHOT, gapAhead: { place: 36, seconds: 0.8, name: 'NIX', trend: 'closing' as const } };
  fillCockpitState(state, snapshot as never, 0);
  assert.deepEqual([state.gapPlace, state.gapSeconds, state.gapTrend], [36, 0.8, 'closing']);
  fillCockpitState(state, { ...INITIAL_SNAPSHOT, gapAhead: null } as never, 0);
  assert.equal(state.gapPlace, 0);
});

test('H9: the engine measures from the nearest rider ahead, never during the solo split', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /if \(!ahead \|\| raceOrder\(ahead, racer\) < 0\) ahead = racer;/);
  assert.match(engine, /if \(!ahead \|\| !this\.splitReached \|\| player\.finished\) \{ this\.snapshot\.gapAhead = null; return; \}/);
  assert.match(engine, /fillStripProgress\(out: Float32Array\): number \{/);
});

test('H9: the strip map draws from a reused buffer in its own frame loop', () => {
  const strip = readFileSync(new URL('../src/components/TrackStripMap.tsx', import.meta.url), 'utf8');
  assert.match(strip, /const progress = new Float32Array\(MAX_DOTS\);/, 'allocated once');
  assert.match(strip, /frame = requestAnimationFrame\(draw\);/);
  assert.doesNotMatch(strip.slice(strip.indexOf('const draw = () =>')), /new Float32Array|\.map\(|useState/, 'nothing allocated or set as state per frame');
  const screen = readFileSync(new URL('../src/screens/RaceScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /<TrackStripMap fill=\{fillStrip\} colors=\{stripColors\} \/>/);
});
