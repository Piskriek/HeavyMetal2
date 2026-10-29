// Plan 57 §15: the play HUD's goal card as a `ui:` panel: the screen validates against the HUD's real sources, and the renderer
// draws each part from its live value, nothing for a missing one, in the card's old classes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeScreen, encodeScreen } from '@hm/hudlayout';
import { PLAY_HUD_GOAL, PLAY_HUD_SCREEN, floatsPanelProps, goalValues, playHudIssues } from './ui-play-hud';
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

test('the floats pill drawn from its preset keeps everything the hand-drawn pill (hud-zones.tsx FloatsPill) had', () => {
  const levels = { pxd: 12.7, vtx: 50, lx: 0, aq: 99.9 };
  const colours = { pxd: '#ff3d8a', vtx: '#7cff4d', lx: '#ffc13d', aq: '#3dc8ff' };
  const html = renderToStaticMarkup(createElement(UiPanelView, floatsPanelProps(3, levels, colours)));
  // the pill and its stage badge
  assert.match(html, /^<div class="hud-floats"[^>]*>/);
  assert.match(html, /<div[^>]*data-hud-zone="top-right"/);
  assert.match(html, /<div[^>]*aria-label="Fidelity floats, stage 3"/);
  assert.match(html, /<span class="hud-stage-badge"[^>]*aria-label="Stage 3"[^>]*>S3<\/span>/);
  // one list of four rows, each with its metric, colour, title, name, patterned bar, width and floored value
  assert.equal((html.match(/<ul class="hud-floats-bars">/g) ?? []).length, 1);
  const rows = [['pxd', 'texture', 'solid', '12.7', '12'], ['vtx', 'shape', 'hatch', '50', '50'], ['lx', 'light', 'steps', '0', '0'], ['aq', 'water', 'dots', '99.9', '99']] as const;
  for (const [k, name, pat, width, shown] of rows) {
    const row = new RegExp(`<li style="--c:${colours[k]}"[^>]*data-metric="${k}"[^>]*title="${name} ${shown}"><span class="hud-float-name">${name}</span><i class="hud-float-bar pat-${pat}"><s style="width:${width}%"></s></i><b>${shown}</b></li>`);
    assert.match(html, row, `the ${k} row`);
  }
});

test('a part with no value draws nothing (the lens rule at run time)', () => {
  const html = draw({ 'goal.title': 'Stage 3', 'goal.hint': '', 'goal.next': null });
  assert.match(html, /<h2[^>]*>Stage 3<\/h2>/);
  assert.doesNotMatch(html, /<p/);
});
