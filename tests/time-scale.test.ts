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
