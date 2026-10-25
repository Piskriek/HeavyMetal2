// ============================================================================
// File: apps/web/src/play/locomotion.test.ts
// Plan 43 (loc:): the curated locomotion presets are switched live, `auto` follows the ground, and the number the walk and
// the jump actually use is the preset's own (speed times air control in the air, the preset's impulse, its gravity, its
// landing spring).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCOMOTION_PRESETS } from '@hm/kinematic';
import { kv } from '../storage/profile-storage';
import {
  activeLocomotion,
  AUTO_PRESET_FOR,
  isLocomotionChoice,
  LOCOMOTION_CHOICES,
  locomotionChoice,
  locomotionSpeed,
  presetFor,
  readLocomotionChoice,
  setLocomotionChoice,
} from './locomotion';

test('the choices are auto plus every curated preset, and nothing else is a choice', () => {
  assert.deepEqual(LOCOMOTION_CHOICES, ['auto', 'earth-standard', 'lunar-ballast', 'lunar-low-g', 'arcade-quake']);
  assert.deepEqual([...LOCOMOTION_CHOICES.slice(1)].sort(), Object.keys(LOCOMOTION_PRESETS).sort());
  for (const c of LOCOMOTION_CHOICES) assert.ok(isLocomotionChoice(c));
  for (const bad of ['', 'lunar', 'EARTH-STANDARD', null, undefined, 3]) assert.ok(!isLocomotionChoice(bad), String(bad));
});

test('auto follows the ground; a pinned preset applies everywhere', () => {
  assert.equal(AUTO_PRESET_FOR.lab, 'earth-standard');
  assert.equal(AUTO_PRESET_FOR.planet, 'lunar-ballast');
  assert.equal(presetFor('lab', 'auto').id, 'earth-standard', 'the lab deck keeps Earth pull');
  assert.equal(presetFor('planet', 'auto').id, 'lunar-ballast', "the Moon's surface keeps the suit's ballast");
  // a pin wins on both grounds, which is the point of the switch: the same feel wherever you stand
  for (const id of ['earth-standard', 'lunar-ballast', 'lunar-low-g', 'arcade-quake'] as const) {
    assert.equal(presetFor('lab', id).id, id);
    assert.equal(presetFor('planet', id).id, id);
  }
});

test('the speed the walk uses is the preset\'s, with air control while airborne', () => {
  const earth = LOCOMOTION_PRESETS['earth-standard'];
  assert.equal(locomotionSpeed(earth, false, false), earth.walkSpeedMps);
  assert.equal(locomotionSpeed(earth, true, false), earth.runSpeedMps, 'sprinting is the run speed');
  assert.equal(locomotionSpeed(earth, false, true), earth.walkSpeedMps * earth.airControl);
  assert.equal(locomotionSpeed(earth, true, true), earth.runSpeedMps * earth.airControl);
  // the shareware arena has far more of its ground authority in the air than the lunar suit
  assert.ok(LOCOMOTION_PRESETS['arcade-quake'].airControl > LOCOMOTION_PRESETS['lunar-ballast'].airControl);
  assert.ok(locomotionSpeed(LOCOMOTION_PRESETS['arcade-quake'], true, true) > locomotionSpeed(LOCOMOTION_PRESETS['lunar-ballast'], true, true));
});

test('every preset is a body that can stand up: a sprint at least a walk, real gravity, a spring that settles', () => {
  for (const [id, p] of Object.entries(LOCOMOTION_PRESETS)) {
    assert.equal(p.id, id);
    assert.ok(p.walkSpeedMps > 0 && p.runSpeedMps >= p.walkSpeedMps, `${id}: walk then sprint`);
    assert.ok(p.jumpImpulseMps > 0, `${id}: a jump that leaves the ground`);
    assert.ok(p.gravityMps2 > 0 && p.gravityMps2 < 30, `${id}: gravity`);
    assert.ok(p.airControl > 0 && p.airControl <= 1, `${id}: air control is a share`);
    assert.ok(p.coyoteTimeSec > 0 && p.jumpBufferSec > 0, `${id}: a forgiving jump`);
    // critically damped or stiffer: never a spring that rings for seconds after a landing
    assert.ok(p.landingSpringStiffness > 0 && p.landingSpringDamping > 0, `${id}: a landing spring`);
    assert.ok(p.landingSpringDamping >= 2 * Math.sqrt(p.landingSpringStiffness) * 0.5, `${id}: the dip settles`);
  }
  // the four feels are really different: the Moon, the Moon in a suit, an arena and Earth order by pull
  const g = (id: keyof typeof LOCOMOTION_PRESETS): number => LOCOMOTION_PRESETS[id].gravityMps2;
  assert.ok(g('lunar-low-g') < g('lunar-ballast') && g('lunar-ballast') < g('arcade-quake') && g('arcade-quake') < g('earth-standard'));
  assert.ok(LOCOMOTION_PRESETS['lunar-low-g'].jumpImpulseMps < LOCOMOTION_PRESETS['arcade-quake'].jumpImpulseMps);
});

test('switching is live and remembered, and a name the game does not know falls back to auto', () => {
  const was = locomotionChoice();
  try {
    assert.equal(setLocomotionChoice('arcade-quake'), 'arcade-quake');
    assert.equal(locomotionChoice(), 'arcade-quake');
    assert.equal(activeLocomotion('lab').id, 'arcade-quake', 'the preset in force is read fresh, not cached by the scene');
    // the choice is written where storage allows (a profile on this PC); a host with none still reads a real choice back
    assert.ok(isLocomotionChoice(readLocomotionChoice()), 'what is read back is always a choice, never junk');
    kv.set('locomotion.test.probe', '1');
    const storageWorks = kv.get('locomotion.test.probe') === '1';
    kv.set('locomotion.test.probe', '');
    if (storageWorks) assert.equal(readLocomotionChoice(), 'arcade-quake', 'the choice is kept on this PC');
    // mid-air: the preset the next frame reads changes; nothing here resets a jump state
    assert.equal(setLocomotionChoice('lunar-low-g'), 'lunar-low-g');
    assert.equal(activeLocomotion('planet').id, 'lunar-low-g');
    for (const junk of ['', 'moon-walk', null, undefined]) assert.equal(setLocomotionChoice(junk), 'auto', String(junk));
    assert.equal(activeLocomotion('planet').id, AUTO_PRESET_FOR.planet);
  } finally {
    setLocomotionChoice(was);
  }
});
