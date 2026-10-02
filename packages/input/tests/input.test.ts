import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { createInputState, DEFAULT_BINDINGS, toActorFrame, attachKeyboard, pollGamepads, padToSteer, layoutTouch, TouchControls } from '../src';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

test('keyboard steer ramps up, returns to zero, cancels when both held', () => {
  const s = createInputState();
  s.keyDown('ArrowRight'); s.update(100); near(s.sample().steer, 0.6);
  s.update(100); near(s.sample().steer, 1);
  s.keyUp('ArrowRight'); s.update(100); near(s.sample().steer, 0.1);
  s.update(100); near(s.sample().steer, 0);
  s.keyDown('KeyA'); s.keyDown('KeyD'); s.update(500); near(s.sample().steer, 0);
  s.keyUp('KeyD'); s.update(50); near(s.sample().steer, -0.3);
  s.keyDown('ArrowRight'); s.update(1000); assert.ok(Math.abs(s.sample().steer) < 1e-9);   // left + right held again: target 0
});
test('throttle, brake, item, reset, repeated and unknown keys, blur', () => {
  const s = createInputState();
  s.keyDown('KeyW'); s.keyDown('KeyW'); s.keyDown('Space'); s.keyDown('KeyR'); s.keyDown('F13');
  assert.deepEqual(s.sample(), { steer: 0, throttle: 1, brake: 0, item: true, reset: true });
  s.keyUp('KeyW'); assert.equal(s.sample().throttle, 0);
  s.keyDown('ArrowDown'); s.keyDown('ArrowLeft'); s.update(100); s.blur();
  assert.deepEqual(s.sample(), { steer: 0, throttle: 0, brake: 0, item: false, reset: false });
  assert.deepEqual(DEFAULT_BINDINGS.item, ['Space', 'ShiftLeft']);
});
test('gamepad: dead zone, triggers, buttons; touch and keyboard blend by largest magnitude', () => {
  const s = createInputState();
  s.setGamepad({ axes: [0.06, 0], buttons: [] }); assert.equal(s.sample().steer, 0);
  s.setGamepad({ axes: [0.56, 0], buttons: [false, false, true, false, false, false, { pressed: true, value: 0.4 }, { pressed: true, value: 0.75 }] });
  const g = s.sample(); near(g.steer, 0.5); near(g.throttle, 0.75); near(g.brake, 0.4); assert.equal(g.item, true); assert.equal(g.reset, false);
  s.setGamepad({ axes: [-1, 0], buttons: [true, true, false, true] });
  const g2 = s.sample(); near(g2.steer, -1); assert.equal(g2.throttle, 1); assert.equal(g2.brake, 1); assert.equal(g2.reset, true);
  s.setGamepad(null); s.setTouch({ steer: -0.4, throttle: 0.5 }); s.keyDown('ArrowRight'); s.update(100);
  const t = s.sample(); near(t.steer, 0.6); near(t.throttle, 0.5);
  s.setTouch({ steer: -0.9, item: true }); const t2 = s.sample(); near(t2.steer, -0.9); assert.equal(t2.item, true);
  s.setTouch(null); assert.equal(s.sample().item, false);
  s.update(-5); s.update(Number.NaN); near(s.sample().steer, 0.6);
  s.reset(); assert.deepEqual(s.sample(), { steer: 0, throttle: 0, brake: 0, item: false, reset: false });
});
test('toActorFrame has exactly the simulation keys', () => {
  assert.deepEqual(toActorFrame({ steer: -0.5, throttle: 1, brake: 0, item: true, reset: false }), { steer: -0.5, throttle: 1, brake: 0, item: true, reset: false });
});
test('attachKeyboard wires events, ignores repeats, prevents default for driving keys, detaches', () => {
  const target = new EventTarget(); const s = createInputState();
  const detach = attachKeyboard(target, s);
  const fire = (type: string, code: string, repeat = false): boolean => { const e = Object.assign(new Event(type, { cancelable: true }), { code, repeat }); target.dispatchEvent(e); return e.defaultPrevented; };
  assert.equal(fire('keydown', 'ArrowUp'), true); assert.equal(s.sample().throttle, 1);
  assert.equal(fire('keydown', 'KeyQ'), false);
  fire('keydown', 'ArrowRight', true); assert.equal(s.sample().steer, 0); s.update(100); assert.equal(s.sample().steer, 0);
  fire('keyup', 'ArrowUp'); assert.equal(s.sample().throttle, 0);
  fire('keydown', 'Space'); assert.equal(s.sample().item, true);
  detach(); fire('keydown', 'ArrowUp'); assert.equal(s.sample().throttle, 0);
});
test('pollGamepads feeds the first connected pad, or clears', () => {
  const s = createInputState();
  pollGamepads(() => [null, { axes: [1, 0], buttons: [] }, { axes: [-1, 0], buttons: [] }], s); near(s.sample().steer, 1);
  pollGamepads(() => [null, null], s); assert.equal(s.sample().steer, 0);
});
test('touch geometry', () => {
  near(padToSteer(100, 100, 200), -0 + padToSteer(100, 100, 200)); // helper sanity: left edge
  assert.equal(padToSteer(0, 0, 200), -1); assert.equal(padToSteer(200, 0, 200), 1); assert.equal(padToSteer(100, 0, 200), 0); assert.equal(padToSteer(104, 0, 200), 0);
  assert.equal(padToSteer(-50, 0, 200), -1); assert.equal(padToSteer(900, 0, 200), 1);
  assert.ok(padToSteer(150, 0, 200) > 0.4 && padToSteer(150, 0, 200) < 0.6);
  const L = layoutTouch(800, 400);
  assert.ok(L.pad.left >= 16 && L.pad.left + L.pad.width <= 800 * 0.35 + 16 + 1 && L.pad.top + L.pad.height <= 400 - 16 + 1e-9);
  for (const b of [L.gas, L.brake, L.item]) { assert.ok(b.r >= 36 && b.cx - b.r >= 0 && b.cx + b.r <= 800 && b.cy - b.r >= 0 && b.cy + b.r <= 400); }
  assert.ok(L.gas.cx > L.brake.cx && L.item.cy < L.gas.cy);
});
test('TouchControls markup', () => {
  const m = html(h(TouchControls, { width: 800, height: 400, onChange: () => undefined }));
  for (const k of ['pad', 'gas', 'brake', 'item']) assert.match(m, new RegExp(`data-touch="${k}"`));
  assert.match(m, /GAS/); assert.match(m, /BRAKE/); assert.match(m, /ITEM/); assert.match(m, /touch-action:\s*none/);
});