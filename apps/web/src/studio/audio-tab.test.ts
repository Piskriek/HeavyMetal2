// ============================================================================
// File: apps/web/src/studio/audio-tab.test.ts
// Unit tests for AudioTab helpers against public/audio/levels.json (TICKET-08a Item C).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  audioCategoryOf,
  clampAudioPatch,
  dbToLinear,
  normalizeAudioLevels,
  type AudioLevels,
} from './audio-tab';

const candidatePaths = [
  path.resolve(process.cwd(), 'apps/web/public/audio/levels.json'),
  path.resolve(process.cwd(), 'public/audio/levels.json'),
];
const levelsPath = candidatePaths.find((p) => fs.existsSync(p)) ?? candidatePaths[0]!;
const rawLevelsJson = JSON.parse(fs.readFileSync(levelsPath, 'utf8')) as AudioLevels;

test('normalizeAudioLevels parses both wrapper and flat levels.json structures', () => {
  const mapFromWrapper = normalizeAudioLevels(rawLevelsJson);
  const keys = Object.keys(mapFromWrapper);
  assert.ok(keys.length >= 40, `Expected >= 40 sounds in levels.json, got ${keys.length}`);
  assert.ok(mapFromWrapper['music-lab'], 'Has music-lab');
  assert.ok(mapFromWrapper['sfx-mill'], 'Has sfx-mill');

  const mapFromFlat = normalizeAudioLevels(mapFromWrapper);
  assert.deepEqual(Object.keys(mapFromFlat), keys);
});

test('dbToLinear, audioCategoryOf, and clampAudioPatch cover all sounds in levels.json', () => {
  assert.ok(Math.abs(dbToLinear(0) - 1) < 1e-6);
  assert.ok(Math.abs(dbToLinear(-6) - 0.501187) < 1e-3);
  assert.ok(dbToLinear(6) > 1.99);

  assert.equal(audioCategoryOf('music-moon-s3'), 'music');
  assert.equal(audioCategoryOf('sfx-mill'), 'machines');
  assert.equal(audioCategoryOf('sfx-fire-beam'), 'combat');
  assert.equal(audioCategoryOf('sfx-motor-scout'), 'vehicles');
  assert.equal(audioCategoryOf('sfx-ui-select'), 'ui');

  const clamped = clampAudioPatch({ gain: 99, loopStart: -4, loopEnd: 12.3456 });
  assert.equal(clamped.gain, 18);
  assert.equal(clamped.loopStart, 0);
  assert.equal(clamped.loopEnd, 12.346);
});
