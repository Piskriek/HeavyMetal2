// Plan 51 wave 3: the Mimic Reflex Slot. A bridged game's events drive FIDELITY reflexes by class, live, and its own
// rule graphs (delays included) play out in the slot; names may be anonymous labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WIREGRAPH_SHELF, validateWireGraph, type WireGraphSpec } from '@hm/wiregraph';
import { bindAnonymousEventToFidelitySlot, createReflexSlot, MIMIC_REFLEX_PRESET_ID } from './mimic-reflex';

test('the slot preset is on the logic shelf and validates', () => {
  const g = WIREGRAPH_SHELF[MIMIC_REFLEX_PRESET_ID];
  assert.ok(g);
  assert.deepEqual(validateWireGraph(g), []);
});

test('events bind by class: threat shields the suit and overclocks the drone 4 s, mobility reloads, outcome chains an arc; unknown does nothing', () => {
  assert.deepEqual(bindAnonymousEventToFidelitySlot('boss.state:#2').targets, ['class:threat', 'boss.state:#2']);
  assert.equal(bindAnonymousEventToFidelitySlot('weird.field:#1').eventClass, null);
  const slot = createReflexSlot();
  assert.deepEqual(slot.step(['boss.state:#2'], 16), [{ kind: 'pulse-shield', ms: 4000 }, { kind: 'overclock-fire', ms: 4000 }]);
  assert.deepEqual(slot.step(['player.dash:#1'], 1000), [{ kind: 'reload-weapon' }]);
  assert.deepEqual(slot.step(['round.phase:#3'], 1000), [{ kind: 'arc-chain', links: 3 }]);
  assert.deepEqual(slot.step(['weird.field:#1'], 1000), []);
  assert.deepEqual(slot.step([], 1000), [], 'nothing without an event');
  // objective and harm are pressure edges too; a mapping's class beats the keyword guess
  assert.deepEqual(slot.step(['round.bomb:#1'], 1000), [{ kind: 'pulse-shield', ms: 4000 }, { kind: 'overclock-fire', ms: 4000 }], 'bomb is an objective before round is an outcome');
  const custom = createReflexSlot({ classes: { 'round.phase': 'threat' } });
  assert.deepEqual(custom.step(['round.phase:#1'], 16), [{ kind: 'pulse-shield', ms: 4000 }, { kind: 'overclock-fire', ms: 4000 }], 'a mapping\'s class beats the keyword');
});

test('noisy telemetry cannot machine-gun a reflex: each kind waits out its refractory time', () => {
  const slot = createReflexSlot();
  assert.equal(slot.step(['movement.mode:#1'], 16).length, 1);
  assert.equal(slot.step(['movement.mode:#2'], 100).length, 0, 'a reload 100 ms later is swallowed');
  assert.equal(slot.step(['movement.mode:#1'], 600).length, 1, 'after 600 ms it fires again');
  assert.equal(slot.step(['boss.state:#1', 'wave.n:#2', 'player.state.health:#4'], 16).length, 2, 'one shield and one overclock per step, however many pressure edges');
});

test('a bridged rule graph plays out with its own delay, and its shot is the drone\'s arc', () => {
  // the harness read "boss.state:#2 is followed by boss.attack:#1 after 1.5 s" and an effect it named a shot
  const rule: WireGraphSpec = {
    id: 'mimic-rules-somegame', name: 'SomeGame rules',
    sensors: [{ id: 'on-enrage', kind: 'leak-active', threshold: 1, target: 'boss.state:#2' }],
    nodes: [{ id: 'after', kind: 'delay', inputs: ['on-enrage'], delayMs: 1500 }],
    actuators: [{ id: 'do-shot', kind: 'fire-turret', input: 'after', target: 'boss.attack:#1' }],
  };
  const slot = createReflexSlot();
  assert.ok(slot.addGraph(rule));
  assert.deepEqual(slot.graphIds(), [MIMIC_REFLEX_PRESET_ID, 'mimic-rules-somegame']);
  assert.deepEqual(slot.step(['boss.state:#2'], 100), [{ kind: 'pulse-shield', ms: 4000 }, { kind: 'overclock-fire', ms: 4000 }], 'the class reflex now');
  let fired: unknown[] = [];
  for (let k = 0; k < 20 && fired.length === 0; k++) fired = slot.step([], 100);
  assert.deepEqual(fired, [{ kind: 'arc-chain', links: 1 }], 'the bridged rule\'s effect 1.5 s later');
  assert.equal(slot.addGraph({ ...rule, id: 'Bad Id' }), false, 'an invalid graph is refused');
});
