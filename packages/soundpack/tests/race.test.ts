import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, renderRecipe, peakOf } from '@hm/soundlab';
import { RACE_NOTES, RACE_SOUNDS } from '../src';

const IDS = ['countdown-beep', 'go', 'boost', 'jump', 'item-pickup', 'hit-wall', 'hit-racer', 'splash', 'lap', 'finish', 'respawn', 'oil', 'shockwave', 'freeze'];

test('the race sound pack: 14 designed sounds, valid, distinct, balanced, with design notes', () => {
  assert.deepEqual(RACE_SOUNDS.map((s) => s.id), IDS);
  for (const s of RACE_SOUNDS) {
    const v = validateRecipe(s);
    assert.equal(v.ok, true, `${s.id}: ${v.errors.join('; ')}`);
    assert.ok(s.layers.reduce((a, l) => a + l.gain, 0) <= 1.2, `${s.id} gain sum`);
    assert.ok(RACE_NOTES[s.id] && RACE_NOTES[s.id]!.length > 10, `${s.id} note`);
    const pk = peakOf(renderRecipe(s as never, 11025));
    assert.ok(pk > 0.05 && pk <= 1, `${s.id} peak ${pk}`);
  }
  assert.equal(new Set(RACE_SOUNDS.map((s) => JSON.stringify(s.layers))).size, 14);
  assert.ok(RACE_SOUNDS.find((s) => s.id === 'countdown-beep')!.durationMs <= 250);
  assert.ok(RACE_SOUNDS.find((s) => s.id === 'finish')!.durationMs >= 600);
});
