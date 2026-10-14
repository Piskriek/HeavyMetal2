// The leak overlay's rules (overlay.ts): the rim colours, the quantisation by stage, the wind-up pulse, the slices, and the roster's
// remap strength (Argo's O3: 0.20 by default, per skin).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RIM, levelsFor, pulseFor, rimOf, sliceFor } from './overlay';
import { SKINS } from './roster';

test('the rim colours are Argo\'s: magenta for melee, amber for ranged, cyan for the rest', () => {
  assert.equal(RIM.melee, 0xff3d8a);
  assert.equal(RIM.ranged, 0xffc13d);
  assert.equal(RIM.other, 0x3dc8ff);
  assert.equal(rimOf('charger'), RIM.melee);
  assert.equal(rimOf('brute'), RIM.melee);
  assert.equal(rimOf('swarmer'), RIM.melee);
  assert.equal(rimOf('spitter'), RIM.ranged);
  assert.equal(rimOf('flyer'), RIM.ranged);
  assert.equal(rimOf('sapper'), RIM.other);
});

test('the ground\'s stage quantises the monster: 1-bit on stage 0, 16-colour look on 1, 256-colour look on 2, smooth from 3', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(levelsFor), [1, 3, 5, 0, 0, 0, 0]);
  assert.equal(levelsFor(-2), 1, 'below zero reads as stage 0');
});

test('the wind-up pulse rises from 0.2 to 2.0 over the first 350 ms, and rests at 0.2', () => {
  assert.equal(pulseFor(null), 0.2);
  assert.equal(pulseFor(0), 0.2);
  assert.ok(Math.abs(pulseFor(0.175) - 1.1) < 1e-9, 'halfway is 1.1');
  assert.equal(pulseFor(0.35), 2.0);
  assert.equal(pulseFor(5), 2.0, 'held after the rise');
});

test('the glitch slices come up on the wind-up and the pain, and not at rest', () => {
  assert.equal(sliceFor('other'), 0);
  assert.ok(sliceFor('windup') > 0);
  assert.equal(sliceFor('pain'), 1);
});

test('every skin carries a remap strength from 0 to 1, 0.20 by default (Argo O3)', () => {
  for (const s of SKINS) {
    assert.ok(s.remapStrength >= 0 && s.remapStrength <= 1, `${s.id}: ${s.remapStrength}`);
    assert.equal(s.remapStrength, 0.2, `${s.id} is not at the default`);
  }
});

test('the early-3D skins turn by pi onto the camera; the others do not turn (checked on the front shots)', () => {
  for (const s of SKINS) {
    assert.equal(s.turn, s.era === 'early3d' ? Math.PI : 0, `${s.id}`);
  }
});
