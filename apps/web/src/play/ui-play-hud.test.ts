// Plan 57 §15: the play HUD's panels as `ui:` presets (the goal card, the floats pill, the plot's ore and power, the health): the
// screen validates against the HUD's real sources, and the renderer draws each part from its live value, nothing for a missing
// one, in the classes the hand-drawn HUD had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeScreen, encodeScreen, META_SHELL_SCREEN, META_SHELL_SOURCES } from '@hm/hudlayout';
import { PLAY_HUD_GOAL, PLAY_HUD_SCREEN, commsPanelProps, floatsPanelProps, goalValues, healthPanelProps, playHudIssues, plotPanelProps, systemPanelProps, type PlotFigures } from './ui-play-hud';
import { buildMetaShellValues, metaShellIssues } from './ui-meta-shell';
import { createDroneMemory } from './drone-memory';
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

// ---- the plot's ore and power, and the health, on the stat widget: each drawn as the hand-drawn markup was
/** A drawing's words, as a reader sees them (tags and React's text separators dropped). */
const words = (html: string): string => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const signed = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

/** The ore ticker and power line as play.tsx drew them by hand before the stat. */
function handPlot(o: PlotFigures) {
  return createElement('div', null,
    createElement('p', { className: `play-ore${o.oreOut ? ' out-of-ore' : ''}`, 'data-testid': 'plot-ore-ticker' },
      createElement('b', null, Math.floor(o.ore)), ' ore', o.oreLinked > 0 ? createElement('span', { className: 'play-ore-linked' }, ' (+', o.oreLinked, ')') : null, ' ', createElement('span', null, signed(o.oreRate), '/s'),
      o.oreOut ? createElement('em', { className: 'play-ore-warn' }, 'Out of ore: hold E on a boulder, or build a rock drill') : null),
    createElement('p', { className: `play-power${o.satisfaction < 0.999 ? ' short' : ''}` },
      createElement('b', null, o.demand.toFixed(0)), ' of ', o.supply.toFixed(0), ' kW ', createElement('span', { className: 'play-power-pct' }, Math.round(o.satisfaction * 100), '%')),
  );
}
const drawPlot = (o: PlotFigures): string => renderToStaticMarkup(createElement('div', null, createElement(UiPanelView, plotPanelProps(o))));

test('the ore ticker and the power line drawn as stats read exactly as the hand-drawn ones, in their classes', () => {
  const cases: PlotFigures[] = [
    { ore: 412.8, oreRate: 1.25, oreLinked: 600, oreOut: false, demand: 42.4, supply: 60, satisfaction: 1 },
    { ore: 0, oreRate: -0.5, oreLinked: 0, oreOut: true, demand: 80, supply: 60, satisfaction: 0.75 },
  ];
  for (const o of cases) {
    const html = drawPlot(o);
    assert.equal(words(html), words(renderToStaticMarkup(handPlot(o))), `the words for ${JSON.stringify(o)}`);
    assert.match(html, new RegExp(`<p class="play-ore${o.oreOut ? ' out-of-ore' : ''}"[^>]*data-testid="plot-ore-ticker"`));
    assert.match(html, new RegExp(`<p class="play-power${o.satisfaction < 0.999 ? ' short' : ''}"`));
    assert.match(html, /<span class="play-power-pct">\d+%<\/span>/);
    // the power line's "of 12 kW" stays plain words, as the hand-drawn line had: a span would take the section's dim span colour
    assert.match(html, /<b>\d+<\/b> of \d+ kW/);
    assert.equal(/play-ore-linked">\s*\(\+\d+\)/.test(html), o.oreLinked > 0, 'the linked crates\' ore only when there is some');
    assert.equal(/<em class="play-ore-warn">/.test(html), o.oreOut, 'the note only while the ore is out');
    assert.doesNotMatch(html, /<section|data-ui-panel/, 'its parts go into the plot section, with no wrapper of their own');
  }
});

/** MonsterHud's health plate as it was drawn by hand before the stat. */
function handHealth(hp: number, maxHp: number, low: boolean, shielded: boolean) {
  const lit = Math.ceil((Math.max(0, hp) / maxHp) * 20);
  const shown = Math.max(0, Math.round(hp));
  return createElement('section', { className: `mhud-plate mhud-vitals${low ? ' low' : ''}${shielded ? ' shielded' : ''}`, 'data-hud-zone': 'bottom-right', 'aria-label': 'Health' },
    createElement('p', { className: 'mhud-title' }, 'Health'),
    createElement('div', { className: 'mhud-figure' }, createElement('b', null, shown), createElement('span', null, 'of ', maxHp)),
    createElement('div', { className: 'mhud-bar', role: 'meter', 'aria-label': 'Health', 'aria-valuemin': 0, 'aria-valuemax': maxHp, 'aria-valuenow': shown },
      ...Array.from({ length: 20 }, (_, i) => createElement('i', { key: i, className: i < lit ? 'on' : '' }))),
    shielded ? createElement('p', { className: 'mhud-shield-note' }, 'Shield up: hits do a fifth of their damage.') : low ? createElement('p', { className: 'mhud-note' }, 'Low. Back off to the gate and patch up.') : null,
  );
}

test('the health plate drawn from its preset keeps the hand-drawn plate: figure, twenty segments, and one note', () => {
  for (const [hp, low, shielded] of [[100, false, false], [23.6, true, false], [23.6, true, true], [0, false, false], [61, false, true]] as const) {
    const html = renderToStaticMarkup(createElement(UiPanelView, healthPanelProps({ hp, maxHp: 100, low, shielded })));
    const hand = renderToStaticMarkup(handHealth(hp, 100, low, shielded));
    // the stat puts a space before "of 100", which the flex figure does not draw (and a reader now hears "100 of 100")
    assert.equal(words(html).replace(/\s/g, ''), words(hand).replace(/\s/g, ''), `the words at ${hp} hp`);
    assert.match(html, new RegExp(`^<section class="mhud-plate mhud-vitals${low ? ' low' : ''}${shielded ? ' shielded' : ''}"[^>]*aria-label="Health"`));
    assert.doesNotMatch(html, /aria-live/, 'it does not announce every hit');
    assert.match(html, /<div class="mhud-figure"[^>]*><b>\d+<\/b>/);
    const segments = html.match(/<div class="mhud-bar"[^>]*>(.*?)<\/div>/)?.[1] ?? '';
    assert.equal(segments, hand.match(/<div class="mhud-bar"[^>]*>(.*?)<\/div>/)?.[1], `the lit segments at ${hp} hp`);
    assert.match(html, new RegExp(`aria-valuenow="${Math.max(0, Math.round(hp))}"`));
    assert.equal((html.match(/mhud-(shield-)?note/g) ?? []).length, shielded || low ? 1 : 0, 'one note at most, the shield\'s first');
  }
});

test('the comms chip drawn from its preset is the hand-drawn chip, and it runs its command', () => {
  let toggled = 0;
  const props = commsPanelProps(() => { toggled += 1; });
  const html = renderToStaticMarkup(createElement(UiPanelView, props));
  const hand = renderToStaticMarkup(createElement('button', { className: 'companion-chat-toggle', 'data-testid': 'companion-comms-toggle', 'aria-label': 'Toggle Companion Comms (Enter to type, hold T to talk)' },
    createElement('span', { className: 'companion-chat-orb' }), createElement('span', null, 'COMMS · OVERWATCH [Enter]')));
  assert.equal(html.replace(/ data-ui-part="[^"]*"/, ''), hand);
  props.actions['comms.toggle']();
  assert.equal(toggled, 1);
  // with no handler for its command the chip is not drawn: no button that does nothing
  assert.equal(renderToStaticMarkup(createElement(UiPanelView, { ...props, actions: {} })), '');
});

test('the System window shows the notice now, its kind on the window for the edge colour, and tells a screen reader', () => {
  const html = renderToStaticMarkup(createElement(UiPanelView, systemPanelProps({ id: 'SYS-SKILL', text: 'Skill gained: Steady Fire.' })));
  assert.match(html, /^<section class="sys-notice" aria-live="polite" aria-label="System" data-hud-zone="top-centre"/);
  assert.match(html, /<p class="sys-notice-text"[^>]*data-notice="SYS-SKILL"[^>]*>Skill gained: Steady Fire\.<\/p>/);
});

test('Plan 58 W2: the in-game META_SHELL_SCREEN validates with 0 issues and renders all 3 panels via UiPanelView', () => {
  assert.deepEqual(metaShellIssues(), []);
  const values = buildMetaShellValues({
    stage: 3,
    droneMem: createDroneMemory(),
    lastCommsLine: 'Meet at the Stargate plinth.',
    lastClipCode: 'clip:abc123',
  });
  assert.equal(values['wanderer.bal'], 1);
  assert.match(String(values['party.doubling']), /2x/);
  const actions = {
    'comms.pingGate': () => {},
    'comms.pingCraft': () => {},
    'comms.pingEureka': () => {},
    'clip.capture': () => {},
    'harness.cueDream': () => {},
  };
  for (const panel of META_SHELL_SCREEN.panels) {
    const html = renderToStaticMarkup(createElement(UiPanelView, { panel, sources: META_SHELL_SOURCES, values, actions }));
    assert.ok(html.length > 20, `panel ${panel.id} rendered non-empty HTML`);
  }
});
