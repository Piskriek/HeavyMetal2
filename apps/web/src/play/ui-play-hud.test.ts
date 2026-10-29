// Plan 57 §15: the play HUD's goal card as a `ui:` panel: the screen validates against the HUD's real sources, and the renderer
// draws each part from its live value, nothing for a missing one, in the card's old classes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeScreen, encodeScreen } from '@hm/hudlayout';
import { PLAY_HUD_GOAL, PLAY_HUD_SCREEN, goalValues, playHudIssues } from './ui-play-hud';
import { UiPanelView } from './ui-panel';

const draw = (values: Readonly<Record<string, string | null>>): string =>
  renderToStaticMarkup(createElement(UiPanelView, { panel: PLAY_HUD_GOAL, values, className: 'play-goal', partClass: { next: 'play-next' }, hudZone: 'top-left' }));

test('the play HUD\'s screen holds to the values the HUD really has, and travels as a uic: code', () => {
  assert.deepEqual(playHudIssues(), []);
  assert.deepEqual(decodeScreen(encodeScreen(PLAY_HUD_SCREEN)), PLAY_HUD_SCREEN);
});

test('the goal card draws the live stage and what it needs, in its old classes', () => {
  const html = draw(goalValues({ title: 'Stage 3', hint: 'Stage 4 needs texture 50, shape 45.', next: null }));
  assert.match(html, /<section class="play-goal"[^>]*data-hud-zone="top-left"/);
  assert.match(html, /<h2[^>]*>Stage 3<\/h2>/);
  assert.match(html, /<p[^>]*>Stage 4 needs texture 50, shape 45\.<\/p>/);
  assert.doesNotMatch(html, /play-next/, 'no next step: nothing is drawn for it');
  const withNext = draw(goalValues({ title: 'Turn on the gate', hint: 'Pull the main lever.', next: 'Next: Step through the gate' }));
  assert.match(withNext, /<small class="play-next"[^>]*>Next: Step through the gate<\/small>/);
});

test('a part with no value draws nothing (the lens rule at run time)', () => {
  const html = draw({ 'goal.title': 'Stage 3', 'goal.hint': '', 'goal.next': null });
  assert.match(html, /<h2[^>]*>Stage 3<\/h2>/);
  assert.doesNotMatch(html, /<p/);
});
