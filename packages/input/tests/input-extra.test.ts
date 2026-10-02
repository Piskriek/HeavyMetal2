import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import {
  attachKeyboard,
  createInputState,
  layoutTouch,
  padToSteer,
  pollGamepads,
  TouchControls,
  type Bindings,
} from '../src';

const closeTo = (actual: number, expected: number, tolerance = 1e-9): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);
};

test('custom bindings replace defaults and independently drive channels', () => {
  const bindings: Bindings = {
    steerLeft: ['J'],
    steerRight: ['L'],
    throttle: ['I'],
    brake: ['K'],
    item: ['U'],
    reset: ['O'],
  };
  const input = createInputState({ bindings });
  input.keyDown('ArrowUp');
  assert.equal(input.sample().throttle, 0);
  input.keyDown('J');
  input.keyDown('I');
  input.keyDown('U');
  input.keyDown('O');
  input.update(100);
  closeTo(input.sample().steer, -0.6);
  assert.deepEqual(input.sample(), { steer: -0.6000000000000001, throttle: 1, brake: 0, item: true, reset: true });
});

test('custom steering rates apply to ramp and return without overshoot', () => {
  const input = createInputState({ steerRate: 2, steerReturn: 4 });
  input.keyDown('ArrowRight');
  input.update(250);
  closeTo(input.sample().steer, 0.5);
  input.keyUp('ArrowRight');
  input.update(50);
  closeTo(input.sample().steer, 0.3);
  input.update(1000);
  closeTo(input.sample().steer, 0);
});

test('steer stays clamped after long updates and direction reversals', () => {
  const input = createInputState({ steerRate: 100, steerReturn: 100 });
  input.keyDown('ArrowRight');
  input.update(100_000);
  assert.equal(input.sample().steer, 1);
  input.keyDown('ArrowLeft');
  input.keyUp('ArrowRight');
  input.update(100_000);
  assert.equal(input.sample().steer, -1);
  input.keyUp('ArrowLeft');
  input.update(100_000);
  assert.equal(input.sample().steer, 0);
});

test('partial touch fields blend per channel and omitted fields do not erase keys', () => {
  const input = createInputState();
  input.keyDown('KeyW');
  input.keyDown('Space');
  input.setTouch({ brake: 0.7 });
  assert.deepEqual(input.sample(), { steer: 0, throttle: 1, brake: 0.7, item: true, reset: false });
  input.setTouch({ throttle: 0.4, item: false });
  assert.deepEqual(input.sample(), { steer: 0, throttle: 1, brake: 0, item: true, reset: false });
  input.setTouch(null);
  input.keyUp('KeyW');
  input.keyUp('Space');
  assert.deepEqual(input.sample(), { steer: 0, throttle: 0, brake: 0, item: false, reset: false });
});

test('boolean-only gamepad buttons map to full trigger and action values', () => {
  const input = createInputState();
  input.setGamepad({ axes: [], buttons: [false, true, true, true, false, false, true, true] });
  assert.deepEqual(input.sample(), { steer: 0, throttle: 1, brake: 1, item: true, reset: true });
});

test('custom gamepad deadzone rescales the remaining stick range', () => {
  const input = createInputState({ deadzone: 0.2 });
  input.setGamepad({ axes: [0.1], buttons: [] });
  assert.equal(input.sample().steer, 0);
  input.setGamepad({ axes: [0.6], buttons: [] });
  closeTo(input.sample().steer, 0.5);
});

test('sample results are fresh objects and reset clears all input sources', () => {
  const input = createInputState();
  input.setTouch({ steer: 0.8, item: true });
  const first = input.sample();
  const second = input.sample();
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  input.setGamepad({ axes: [-1], buttons: [false, false, false, true] });
  input.keyDown('KeyW');
  input.reset();
  assert.deepEqual(input.sample(), { steer: 0, throttle: 0, brake: 0, item: false, reset: false });
});

test('pollGamepads skips disconnected slots and clears when only null entries remain', () => {
  const input = createInputState();
  pollGamepads(() => [null, null, { axes: [-0.5], buttons: [] }], input);
  assert.ok(input.sample().steer < 0);
  pollGamepads(() => [null, null], input);
  assert.equal(input.sample().steer, 0);
});

test('portrait phone touch layout keeps all controls within the viewport', () => {
  const layout = layoutTouch(390, 844);
  assert.equal(layout.pad.left, 16);
  assert.ok(layout.pad.top + layout.pad.height <= 844 - 16);
  assert.ok(layout.pad.left + layout.pad.width <= 390 * 0.35 + 16);
  for (const button of [layout.gas, layout.brake, layout.item]) {
    assert.ok(button.r >= 36);
    assert.ok(button.cx - button.r >= 0 && button.cx + button.r <= 390);
    assert.ok(button.cy - button.r >= 0 && button.cy + button.r <= 844);
  }
  assert.ok(layout.gas.cx > layout.brake.cx);
  assert.ok(layout.item.cy < layout.gas.cy);
});

test('touch layout scales gracefully for tiny and extra-large viewports', () => {
  const dimensions: ReadonlyArray<readonly [number, number]> = [[48, 48], [320, 180], [3840, 2160]];
  for (const [width, height] of dimensions) {
    const layout = layoutTouch(width, height);
    for (const button of [layout.gas, layout.brake, layout.item]) {
      assert.ok(button.r >= 0);
      assert.ok(button.cx - button.r >= -1e-9 && button.cx + button.r <= width + 1e-9);
      assert.ok(button.cy - button.r >= -1e-9 && button.cy + button.r <= height + 1e-9);
    }
  }
});

test('TouchControls renders the full overlay at tiny and huge sizes', () => {
  const dimensions: ReadonlyArray<readonly [number, number]> = [[24, 24], [16_384, 9_216]];
  for (const [width, height] of dimensions) {
    const markup = html(h(TouchControls, { width, height, onChange: () => undefined }));
    for (const control of ['pad', 'gas', 'brake', 'item']) {
      assert.match(markup, new RegExp(`data-touch="${control}"`));
    }
    assert.match(markup, /touch-action:\s*none/);
  }
});

test('pad steering has a centered dead area and clamps outside its bounds', () => {
  assert.equal(padToSteer(0, 0, 100), -1);
  assert.equal(padToSteer(150, 0, 100), 1);
  assert.equal(padToSteer(50, 0, 100), 0);
  assert.equal(padToSteer(54, 0, 100), 0);
  assert.equal(padToSteer(0, 0, 0), 0);
});

test('keyboard helper applies a custom prevent-default list and blurs window-like targets', () => {
  const target = new EventTarget() as EventTarget & { self: EventTarget };
  target.self = target;
  const input = createInputState();
  const detach = attachKeyboard(target, input, { preventDefaultFor: ['KeyW'] });
  const down = Object.assign(new Event('keydown', { cancelable: true }), { code: 'KeyW' });
  target.dispatchEvent(down);
  assert.equal(down.defaultPrevented, true);
  assert.equal(input.sample().throttle, 1);
  target.dispatchEvent(new Event('blur'));
  assert.equal(input.sample().throttle, 0);
  detach();
  target.dispatchEvent(new Event('keydown', { cancelable: true }));
  assert.equal(input.sample().throttle, 0);
});