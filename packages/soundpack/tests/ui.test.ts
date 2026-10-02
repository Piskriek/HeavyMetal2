import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe } from '@hm/soundlab';
import { UI_NOTES, UI_SOUNDS, UI_SOUNDS_ALT } from '../src';

const IDS = ['ui-click', 'ui-hover', 'ui-toggle', 'ui-error', 'ui-success', 'paint-tick', 'sculpt-tick', 'place', 'delete', 'undo', 'redo', 'snap', 'select', 'tool-switch', 'save'];

test('menu and editor sounds: 15 designed, valid, quiet and short (and an alternative take)', () => {
  for (const set of [UI_SOUNDS, UI_SOUNDS_ALT]) {
    assert.deepEqual(set.map((s) => s.id), IDS);
    for (const s of set) assert.equal(validateRecipe(s).ok, true, s.id);
  }
  for (const s of UI_SOUNDS) {
    assert.ok(s.layers.reduce((a, l) => a + l.gain, 0) <= 0.8, `${s.id} gain`);
    assert.ok(s.durationMs <= 700, `${s.id} length`);
    assert.ok(UI_NOTES[s.id], `${s.id} note`);
  }
  for (const id of ['paint-tick', 'sculpt-tick']) assert.ok(UI_SOUNDS.find((s) => s.id === id)!.durationMs <= 80);
});
