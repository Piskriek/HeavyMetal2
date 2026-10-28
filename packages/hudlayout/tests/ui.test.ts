// Plan 57 §15: the interface as `ui:` presets. Tokens, widget looks, parts bound to real values, panels, a screen; the lens rule
// (no part without a real source); and the `uic:` code.
import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeScreen, encodeScreen, validateScreen, UI_CODE_PREFIX, type UiScreen, type UiSource } from '../src/index';

const SOURCES: UiSource[] = [
  { path: 'plot.stage', kind: 'stage' },
  { path: 'plot.next', kind: 'text' },
  { path: 'player.health', kind: 'number', max: 100 },
  { path: 'plot.ore', kind: 'number' },
  { path: 'drone.sync', kind: 'ratio' },
];

const SCREEN: UiScreen = {
  id: 'play-hud',
  tokens: { ink: '#f1f4f5', paper: '#0c1014', accent: '#a050c8', warn: '#e0502a', dim: '#8a96a3', font: 'setmix', scale: 1, radius: 4, reducedMotion: false },
  panels: [
    {
      id: 'goal', anchor: 'top-left', offsetX: 24, offsetY: 24, visible: true,
      parts: [
        { id: 'stage', look: { kind: 'card', tone: 'ink', frame: 'fill', size: 'l' }, binds: 'plot.stage', label: 'Stage' },
        { id: 'next', look: { kind: 'readout', tone: 'dim', frame: 'none', size: 's' }, binds: 'plot.next', label: 'Next' },
      ],
    },
    {
      id: 'vitals', anchor: 'bottom-right', offsetX: 24, offsetY: 120, visible: true,
      parts: [
        { id: 'health', look: { kind: 'meter', tone: 'accent', frame: 'line', size: 'm' }, binds: 'player.health', label: 'Health' },
        { id: 'ore', look: { kind: 'readout', tone: 'ink', frame: 'none', size: 'm' }, binds: 'plot.ore', label: 'Ore' },
      ],
    },
  ],
};

test('a screen climbs the five rungs and validates against the values it really has', () => {
  assert.deepEqual(validateScreen(SCREEN, SOURCES), []);
});

test('the lens rule: a part with nothing real to read cannot be placed, and a widget shows only what it can', () => {
  const lie: UiScreen = { ...SCREEN, panels: [{ ...SCREEN.panels[0]!, parts: [{ id: 'mana', look: { kind: 'meter', tone: 'accent', frame: 'line', size: 'm' }, binds: 'player.mana', label: 'Mana' }] }] };
  assert.deepEqual(validateScreen(lie, SOURCES).map((i) => i.code), ['unbound'], 'there is no mana to show');
  // a meter over a number with no max would invent its own scale
  const noRange: UiScreen = { ...SCREEN, panels: [{ ...SCREEN.panels[1]!, parts: [{ id: 'ore-bar', look: { kind: 'meter', tone: 'ink', frame: 'line', size: 's' }, binds: 'plot.ore', label: 'Ore' }] }] };
  assert.deepEqual(validateScreen(noRange, SOURCES).map((i) => i.code), ['meter-without-range']);
  // a list widget cannot show a number
  const wrong: UiScreen = { ...SCREEN, panels: [{ ...SCREEN.panels[1]!, parts: [{ id: 'h', look: { kind: 'list', tone: 'ink', frame: 'none', size: 's' }, binds: 'player.health', label: 'Health' }] }] };
  assert.deepEqual(validateScreen(wrong, SOURCES).map((i) => i.code), ['wrong-widget']);
});

test('the screen\'s own rules: colours, ranges, ids, offsets and empty panels', () => {
  const bad: UiScreen = {
    ...SCREEN,
    tokens: { ...SCREEN.tokens, accent: 'purple', scale: 3 },
    panels: [{ ...SCREEN.panels[0]!, offsetX: 900 }, { ...SCREEN.panels[1]!, id: 'goal', parts: [] }],
  };
  const codes = validateScreen(bad, SOURCES).map((i) => i.code).sort();
  assert.deepEqual(codes, ['bad-colour', 'duplicate-id', 'empty-panel', 'off-screen', 'out-of-range']);
});

test('a screen travels as a uic: code and comes back exactly; a damaged or foreign code reads as null', () => {
  const code = encodeScreen(SCREEN);
  assert.ok(code.startsWith(UI_CODE_PREFIX));
  assert.deepEqual(decodeScreen(code), SCREEN);
  assert.equal(decodeScreen(code.slice(0, -3) + 'AAA'), null, 'a damaged code');
  assert.equal(decodeScreen('matc:' + code.slice(UI_CODE_PREFIX.length)), null, 'another kind of code');
  assert.equal(decodeScreen('uic:not-a-code'), null);
  // deterministic: the same screen, the same code
  assert.equal(encodeScreen(SCREEN), code);
});
