/**
 * H5: touch screens get thumb controls (lanes, bounce, boost, GO / pause) that go through the same
 * command gate as the keyboard; a mouse-and-keyboard desk never mounts them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TouchRaceControls } from '../src/components/RaceControls';
import { INITIAL_SNAPSHOT, type GameSnapshot } from '../src/game/types';

const noop = () => {};
const render = (snapshot: Partial<GameSnapshot>) => renderToStaticMarkup(createElement(TouchRaceControls, {
  snapshot: { ...INITIAL_SNAPSHOT, ...snapshot } as GameSnapshot, onLane: noop, onBounce: noop, onBoost: noop, onPrimary: noop,
}));
const disabled = (html: string, label: string) => new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${label}`).test(html);

test('H5: on the grid the thumb controls offer GO; steering and abilities wait for the start', () => {
  const html = render({ status: 'ready' });
  assert.match(html, /aria-label="Start the race"[^>]*>GO</);
  assert.ok(disabled(html, 'Change to the lane on the left'));
  assert.ok(disabled(html, 'Bounce'));
});

test('H5: racing, every control is live and GO becomes pause', () => {
  const html = render({ status: 'flying', bounces: 3, boosts: 2 });
  assert.match(html, /aria-label="Pause race"/);
  for (const label of ['Change to the lane on the left', 'Change to the lane on the right', 'Bounce', 'Boost']) {
    assert.ok(!disabled(html, label), `${label} is live`);
  }
  assert.equal((html.match(/class="charged"/g) ?? []).length, 5, 'three bounce and two boost charges');
});

test('H5: a spent ability and a locked lane are shown disabled', () => {
  const html = render({ status: 'flying', boosts: 0, laneLocked: true });
  assert.ok(disabled(html, 'Boost'));
  assert.ok(disabled(html, 'Change to the lane on the right'));
});

test('H5: the buttons claim the touch gesture and fire on pointer-down', () => {
  const css = readFileSync(new URL('../src/hud.css', import.meta.url), 'utf8');
  assert.match(css, /\.touch-button \{[^}]*touch-action: none;/);
  const source = readFileSync(new URL('../src/components/RaceControls.tsx', import.meta.url), 'utf8');
  assert.match(source, /onPointerDown: \(event: PointerEvent<HTMLButtonElement>\) => \{/);
});

test('H5: the race screen mounts them for a coarse pointer and routes them through dispatch', () => {
  const screen = readFileSync(new URL('../src/screens/RaceScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /matchMedia\?\.\('\(pointer: coarse\)'\)/);
  assert.match(screen, /\{touchControls && assets && !buildMode && engineRef\.current && \(\s*<TouchRaceControls/);
  assert.match(screen, /onLane=\{\(direction\) => engineRef\.current\?\.dispatch\(\{ type: 'steer', direction \}\)\}/);
  assert.match(screen, /onBounce=\{\(\) => engineRef\.current\?\.dispatch\(\{ type: 'bounce' \}\)\}/);
  assert.match(screen, /onBoost=\{\(\) => engineRef\.current\?\.dispatch\(\{ type: 'boost' \}\)\}/);
});
