// Sounds as presets (plan 57 §14.2): every `snd:` preset names a recorded file the game ships, loops as that file loops, has a
// measured level to sit on, answers its own moment, and reads back from its name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_FALLOFF, LAB_SOUNDS, SOUND_PRESETS, loopRegionOf, soundName, soundPresetOfName } from './sound-presets';

const read = (file: string): unknown => JSON.parse(readFileSync(new URL(`../../public/audio/${file}`, import.meta.url), 'utf8'));
const INDEX = read('index.json') as readonly { readonly id: string; readonly loop?: boolean }[];
const LEVELS = (read('levels.json') as { readonly levels: Readonly<Record<string, { readonly start: number; readonly end: number }>> }).levels;

test('every sound preset plays a file the game ships, loops as it loops, and sits on its measured level', () => {
  for (const p of SOUND_PRESETS) {
    const entry = INDEX.find((e) => e.id === p.file);
    assert.ok(entry, `${p.id}: ${p.file} is in public/audio`);
    assert.equal(p.loop, entry.loop === true, `${p.id} loops as its file does`);
    assert.ok(LEVELS[p.file], `${p.id}: ${p.file} has a measured level`);
    assert.ok(p.volume > 0 && p.volume <= 1, `${p.id} volume`);
    if (p.falloff) assert.ok(p.falloff.refDistance > 0 && p.falloff.maxDistance > p.falloff.refDistance && p.falloff.rolloff > 0, `${p.id} falloff`);
  }
});

test('each sound answers its own moment, has its own id, and reads back from its snd: name', () => {
  assert.equal(new Set(SOUND_PRESETS.map((p) => p.id)).size, SOUND_PRESETS.length);
  assert.equal(new Set(SOUND_PRESETS.map((p) => p.trigger)).size, SOUND_PRESETS.length);
  for (const p of SOUND_PRESETS) {
    assert.match(p.trigger, /^[a-z]+:[a-z]+$/, `${p.id} trigger`);
    assert.equal(soundPresetOfName(soundName(p)), p);
  }
  assert.equal(soundPresetOfName('snd:no-such-sound'), undefined);
  assert.equal(soundPresetOfName('sfx-lever'), undefined, 'a file id is not a preset name');
  // the lab's positioned sounds keep the panner's old defaults; its music is heard everywhere
  assert.deepEqual(LAB_SOUNDS.lever.falloff, DEFAULT_FALLOFF);
  assert.equal('falloff' in LAB_SOUNDS.music, false);
});

test('a file loops over its measured region unless a preset sets its own', () => {
  const measured = LEVELS['sfx-gate-hum']!;
  assert.deepEqual(loopRegionOf('sfx-gate-hum', measured), { start: measured.start, end: measured.end });
  assert.equal(loopRegionOf('sfx-gate-hum', {}), null, 'no region: the whole file loops');
  const trimmed = { ...LAB_SOUNDS.gateHum, loopRegion: { start: 2, end: 9.5 } };
  assert.deepEqual(loopRegionOf('sfx-gate-hum', measured, [trimmed]), { start: 2, end: 9.5 }, 'the preset\'s own region wins');
});
