/**
 * H10: a standard gamepad sends the keyboard's commands. The stick changes one lane per push (past
 * 50%, then back inside 25% before it can fire again), buttons fire on press, and triggers count
 * past half travel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GamepadMapper, RUMBLE, STICK_FIRE, STICK_REARM, type PadState } from '../src/game/input/gamepad';
import { GAMEPAD_BINDINGS, GAMEPAD_LABELS } from '../src/game/controls';

function pad(x = 0, down: Record<number, number> = {}): PadState {
  return {
    axes: [x, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: (down[i] ?? 0) >= 1, value: down[i] ?? 0 })),
  };
}
const types = (commands: { type: string }[]) => commands.map((c) => c.type);

test('H10: the stick steers once per push, with hysteresis', () => {
  const mapper = new GamepadMapper();
  assert.deepEqual(mapper.update(pad(-0.4)), [], 'under 50%: nothing');
  assert.deepEqual(mapper.update(pad(-(STICK_FIRE + 0.05))), [{ type: 'steer', direction: -1 }]);
  assert.deepEqual(mapper.update(pad(-0.9)), [], 'held over: no repeat');
  assert.deepEqual(mapper.update(pad(-0.35)), [], 'back to 35%: still not re-armed');
  assert.deepEqual(mapper.update(pad(-0.7)), [], 'so a wobble does not fire twice');
  mapper.update(pad(-(STICK_REARM - 0.05)));
  assert.deepEqual(mapper.update(pad(-0.8)), [{ type: 'steer', direction: -1 }], 're-armed inside 25%');
  mapper.update(pad(0));
  assert.deepEqual(mapper.update(pad(0.9)), [{ type: 'steer', direction: 1 }], 'and the other way');
});

test('H10: buttons fire on press, not while held; triggers past half travel', () => {
  const mapper = new GamepadMapper();
  assert.deepEqual(types(mapper.update(pad(0, { 0: 1 }))), ['bounce'], 'A');
  assert.deepEqual(mapper.update(pad(0, { 0: 1 })), [], 'A held');
  mapper.update(pad());
  assert.deepEqual(types(mapper.update(pad(0, { 7: 0.4 }))), [], 'right trigger at 40%');
  assert.deepEqual(types(mapper.update(pad(0, { 7: 0.8 }))), ['boost'], 'right trigger at 80%');
  assert.deepEqual(types(mapper.update(pad(0, { 7: 0.8, 5: 1 }))), ['boost'], 'a second boost button while one is held still fires once');
  mapper.update(pad());
  assert.deepEqual(types(mapper.update(pad(0, { 6: 1 }))), ['bounce'], 'left trigger');
  assert.deepEqual(types(mapper.update(pad(0, { 9: 1 }))), ['toggle-pause'], 'Start');
  assert.deepEqual(mapper.update(pad(0, { 14: 1 })), [{ type: 'steer', direction: -1 }], 'd-pad left');
  assert.deepEqual(mapper.update(pad(0, { 15: 1 })), [{ type: 'steer', direction: 1 }], 'd-pad right');
});

test('H10: the layout and rumble shapes are written down', () => {
  assert.deepEqual([...GAMEPAD_BINDINGS.bounce], [0, 6]);
  assert.deepEqual([...GAMEPAD_BINDINGS.boost], [2, 5, 7]);
  for (const id of Object.keys(GAMEPAD_BINDINGS)) assert.ok(GAMEPAD_LABELS[id as keyof typeof GAMEPAD_LABELS]);
  assert.ok(RUMBLE.bump.strongMagnitude > RUMBLE.bump.weakMagnitude, 'a hit is a low thud');
  assert.ok(RUMBLE.boost.weakMagnitude > RUMBLE.boost.strongMagnitude, 'a boost is a high buzz');
});

test('H10: the engine polls the pad each frame, dispatches it, and rumbles on hits and boosts', () => {
  const engine = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.match(engine, /for \(const command of this\.gamepad\.poll\(\)\) \{\s*this\.dispatch\(/);
  assert.match(engine, /if \(!this\.reducedMotion\) this\.gamepad\.rumble\('bump', closing \/ 380\);/);
  assert.match(engine, /this\.gamepad\.rumble\('boost'\)/);
  assert.match(engine, /CONTROLLER READY/);
});
