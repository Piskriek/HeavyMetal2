/** P8: the test-drive bar wears the gold-and-iron frame; its keys and callbacks are unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestDriveBar from '../src/components/TestDriveBar';

test('P8: framed bar, pill view buttons, riveted brass steppers and an inset speed plate', () => {
  const html = renderToStaticMarkup(createElement(TestDriveBar, {
    cameraMode: 'first_person', onCameraMode: () => {}, timeScale: 1, onTimeScale: () => {},
  }));
  assert.match(html, /class="test-drive-bar"/);
  assert.match(html, /class="td-button is-active"[^>]*aria-pressed="true"[^>]*>COCKPIT</, 'the selected view glows');
  assert.match(html, /class="td-button "[^>]*aria-pressed="false"[^>]*>CHASE</);
  assert.equal((html.match(/class="td-stepper"/g) ?? []).length, 2);
  assert.match(html, /class="td-readout"[^>]*>×1</);
  assert.doesNotMatch(html, /<button[^>]*style=/, 'no inline button styles left');
  const css = readFileSync(new URL('../src/hud.css', import.meta.url), 'utf8');
  for (const rule of ['.test-drive-bar {', '.td-button.is-active {', '.td-stepper {', '.td-readout {', '.td-panel {']) assert.ok(css.includes(rule), rule);
  const bar = readFileSync(new URL('../src/components/TestDriveBar.tsx', import.meta.url), 'utf8');
  for (const key of ["e.code === 'BracketLeft'", "e.code === 'BracketRight'", "e.code === 'KeyV'"]) assert.ok(bar.includes(key), key);
});
