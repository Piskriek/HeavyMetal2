// Plan 57 §15: the interface as `ui:` presets. Tokens, widget looks, parts bound to real values, panels, a screen; the lens rule
// (no part without a real source); and the `uic:` code.
import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeScreen, encodeScreen, validateScreen, UI_CODE_PREFIX, type UiCommand, type UiScreen, type UiSource } from '../src/index';

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

// ---- the stat (Argon's yes, 29 Oct): one number with its other values, each bound to a real source
const STAT_SOURCES: UiSource[] = [
  ...SOURCES,
  { path: 'power.demand', kind: 'number', unit: 'kW' },
  { path: 'power.supply', kind: 'number', unit: 'kW' },
  { path: 'power.met', kind: 'ratio' },
  { path: 'power.short', kind: 'flag' },
  { path: 'plot.oreRate', kind: 'number' },
  { path: 'plot.oreLinked', kind: 'number' },
];
const statScreen = (part: UiScreen['panels'][number]['parts'][number]): UiScreen => ({ ...SCREEN, panels: [{ ...SCREEN.panels[1]!, parts: [part] }] });
const POWER = { id: 'power', look: { kind: 'stat', tone: 'ink', frame: 'none', size: 'm' }, binds: 'power.demand', label: 'Power', with: { of: 'power.supply', share: 'power.met', alert: 'power.short' }, note: 'Build a generator' } as const;

test('a stat shows one number with its other values, and each of them must be real too', () => {
  assert.deepEqual(validateScreen(statScreen(POWER), STAT_SOURCES), []);
  assert.deepEqual(validateScreen(statScreen({ ...POWER, with: { ...POWER.with, rate: 'power.trend' } }), STAT_SOURCES).map((i) => i.code), ['unbound'], 'there is no power trend to show');
  assert.deepEqual(validateScreen(statScreen({ ...POWER, with: { ...POWER.with, share: 'power.supply' } }), STAT_SOURCES).map((i) => i.code), ['wrong-widget'], 'a share reads a ratio');
  assert.deepEqual(validateScreen(statScreen({ ...POWER, with: { of: 'power.supply' }, note: 'Build a generator' }), STAT_SOURCES).map((i) => i.code), ['note-without-alert']);
  assert.deepEqual(validateScreen(statScreen({ ...POWER, look: { ...POWER.look, kind: 'readout' } }), STAT_SOURCES).map((i) => i.code), ['wrong-widget'], 'only a stat reads more than one value');
  // a readout of a flag is a notice: it shows its words while the flag is up
  assert.deepEqual(validateScreen(statScreen({ id: 'short', look: { kind: 'readout', tone: 'warn', frame: 'none', size: 's' }, binds: 'power.short', label: 'The power is short' }), STAT_SOURCES), []);
  assert.deepEqual(validateScreen(statScreen({ id: 'short', look: { kind: 'meter', tone: 'warn', frame: 'line', size: 's' }, binds: 'power.short', label: 'Short' }), STAT_SOURCES).map((i) => i.code), ['wrong-widget']);
});

test('a stat travels in a uic: code with its bindings and note, and a part without them comes back without them', () => {
  const screen = statScreen(POWER);
  const back = decodeScreen(encodeScreen(screen));
  assert.deepEqual(back, screen);
  assert.deepEqual(decodeScreen(encodeScreen(SCREEN)), SCREEN, 'no empty bindings appear');
});

test('a code from before the stat (version 1, the play HUD as it was at 9fa3fbd1) still reads', () => {
  const old = decodeScreen('uic:t14BlYRaXwhwbGF5LWh1ZAIABGdvYWwBkAGQAwpnb2FsLnRpdGxlBXRpdGxlBEdvYWwAAgIACWdvYWwuaGludARoaW50DVdoYXQgaXQgbmVlZHMAAAEDCWdvYWwubmV4dARuZXh0BE5leHQAAwADAQIGZmxvYXRzAZABkAUKcGxvdC5zdGFnZQVzdGFnZQVTdGFnZQIDAAAKZmxvYXRzLnB4ZANweGQHdGV4dHVyZQEBAAEKZmxvYXRzLnZ0eAN2dHgFc2hhcGUBAQABCWZsb2F0cy5seAJseAVsaWdodAEBAAEJZmxvYXRzLmFxAmFxBXdhdGVyAQEAAQGgUMiKlqMA8fT1DBAUBAAF4FAqxRxLew');
  assert.ok(old, 'it decodes');
  assert.equal(old.id, 'play-hud');
  assert.deepEqual(old.panels.map((p) => p.id), ['goal', 'floats']);
  assert.deepEqual(old.panels[1]!.parts.map((p) => p.label), ['Stage', 'texture', 'shape', 'light', 'water']);
  assert.ok(old.panels.every((p) => p.parts.every((part) => part.with === undefined && part.note === undefined)));
});

// ---- the action (Argon's yes, 29 Oct): a press bound to a real command, so there is no button that does nothing
const COMMANDS: UiCommand[] = [{ id: 'comms.toggle', does: 'Opens or closes the comms' }];
const TOGGLE = { id: 'comms', look: { kind: 'action', tone: 'accent', frame: 'fill', size: 's' }, binds: 'comms.toggle', label: 'Comms' } as const;

test('an action runs a declared command, and an action with no command to run cannot be placed', () => {
  assert.deepEqual(validateScreen(statScreen(TOGGLE), SOURCES, COMMANDS), []);
  assert.deepEqual(validateScreen(statScreen(TOGGLE), SOURCES).map((i) => i.code), ['unbound'], 'no command handles it');
  assert.deepEqual(validateScreen(statScreen({ ...TOGGLE, binds: 'plot.stage' }), SOURCES, COMMANDS).map((i) => i.code), ['unbound'], 'a value is not a command');
  assert.deepEqual(validateScreen(statScreen({ ...TOGGLE, with: { of: 'player.health' } }), SOURCES, COMMANDS).map((i) => i.code), ['wrong-widget'], 'an action reads no values');
  assert.deepEqual(decodeScreen(encodeScreen(statScreen(TOGGLE))), statScreen(TOGGLE), 'it travels in a uic: code');
});

test('a code from before the action (version 2, the play HUD with its stats as it was in wave 9) still reads', () => {
  const old = decodeScreen('uic:t14Bd8t9KQhwbGF5LWh1ZAQABGdvYWwBkAGQAwAKZ29hbC50aXRsZQV0aXRsZQRHb2FsAAACAgAAAAAAAAlnb2FsLmhpbnQEaGludA1XaGF0IGl0IG5lZWRzAAAAAQMAAAAAAAlnb2FsLm5leHQEbmV4dAROZXh0AAADAAMAAAAAAQIGZmxvYXRzAZABkAUACnBsb3Quc3RhZ2UFc3RhZ2UFU3RhZ2UAAgMAAAAAAAAACmZsb2F0cy5weGQDcHhkB3RleHR1cmUAAQEAAQAAAAAACmZsb2F0cy52dHgDdnR4BXNoYXBlAAEBAAEAAAAAAAlmbG9hdHMubHgCbHgFbGlnaHQAAQEAAQAAAAAACWZsb2F0cy5hcQJhcQV3YXRlcgABAQABAAAAAAEIBHBsb3QBkAGQAgtwbG90Lm9yZU91dAhwbG90Lm9yZQNvcmUDT3JlDnBsb3Qub3JlTGlua2VkAAUBADZPdXQgb2Ygb3JlOiBob2xkIEUgb24gYSBib3VsZGVyLCBvciBidWlsZCBhIHJvY2sgZHJpbGwADHBsb3Qub3JlUmF0ZQALcG93ZXIuc2hvcnQMcG93ZXIuZGVtYW5kBXBvd2VyBVBvd2VyAAAFAQAADHBvd2VyLnN1cHBseQAJcG93ZXIubWV0AQgGaGVhbHRoAZABkAQACXBsYXllci5ocAJocAZIZWFsdGgAAAUCAAAMcGxheWVyLmhwTWF4AAAACXBsYXllci5ocAZocC1iYXIGSGVhbHRoAAEBAQEAAAAAAA9wbGF5ZXIuc2hpZWxkZWQGc2hpZWxkK1NoaWVsZCB1cDogaGl0cyBkbyBhIGZpZnRoIG9mIHRoZWlyIGRhbWFnZS4AAAAAAQAAAAAAEXBsYXllci5sb3dXYXJuaW5nA2xvdydMb3cuIEJhY2sgb2ZmIHRvIHRoZSBnYXRlIGFuZCBwYXRjaCB1cC4AAAAAAgAAAAABoFDIipajAPH09QwQFAQABeBQKtFLB6U');
  assert.ok(old, 'it decodes');
  assert.deepEqual(old.panels.map((p) => p.id), ['goal', 'floats', 'plot', 'health']);
  const ore = old.panels[2]!.parts[0]!;
  assert.equal(ore.look.kind, 'stat');
  assert.deepEqual(ore.with, { rate: 'plot.oreRate', linked: 'plot.oreLinked', alert: 'plot.oreOut' });
  assert.equal(ore.note, 'Out of ore: hold E on a boulder, or build a rock drill');
});


test('Plan 58: UI_STYLE_SHELF, uiTokensToCssVars, HOME_HOLODECK_SCREEN, and META_SHELL_SCREEN validate and round-trip as uic: codes', async () => {
  const {
    UI_STYLE_SHELF,
    HOME_HOLODECK_SCREEN,
    HOME_HOLODECK_SOURCES,
    HOME_HOLODECK_COMMANDS,
    META_SHELL_SCREEN,
    META_SHELL_SOURCES,
    META_SHELL_COMMANDS,
    applyUiStylePreset,
    uiTokensToCssVars,
  } = await import('../src/index');

  assert.equal(UI_STYLE_SHELF.length, 6);
  for (const style of UI_STYLE_SHELF) {
    const vars = uiTokensToCssVars(style.tokens);
    assert.equal(vars['--ui-ink'], style.tokens.ink);
    assert.equal(vars['--ui-paper'], style.tokens.paper);
    assert.equal(vars['--ui-accent'], style.tokens.accent);
    assert.equal(vars['--ui-radius'], `${style.tokens.radius}px`);

    const restyledHome = applyUiStylePreset(HOME_HOLODECK_SCREEN, style.id);
    assert.deepEqual(validateScreen(restyledHome, HOME_HOLODECK_SOURCES, HOME_HOLODECK_COMMANDS), []);
    assert.deepEqual(decodeScreen(encodeScreen(restyledHome)), restyledHome);

    const restyledMeta = applyUiStylePreset(META_SHELL_SCREEN, style.id);
    assert.deepEqual(validateScreen(restyledMeta, META_SHELL_SOURCES, META_SHELL_COMMANDS), []);
    assert.deepEqual(decodeScreen(encodeScreen(restyledMeta)), restyledMeta);
  }
});
