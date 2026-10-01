/**
 * UI acceptance: the tiered, schema-generated inspector.
 * `buildInspectorModel` is a PURE function (no React): schema + stored params + resolved params + tier + search -> a list of groups of rows.
 * `Inspector` is a React component that renders that model (tested with react-dom/server renderToStaticMarkup).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defineSchema } from '@hm/contracts';
import { buildInspectorModel, Inspector } from '@hm/ui';

const racer = defineSchema({
  kind: 'racer', version: 1, label: 'Racer', doc: 'A ball that races.',
  variables: [
    { key: 'weight', type: 'number', label: 'Weight', doc: 'How heavy the ball is.', tier: 'play', default: 5, min: 0, max: 10, step: 1, group: 'Handling' },
    { key: 'bounce', type: 'number', label: 'Bounce', doc: 'How bouncy.', tier: 'play', default: 5, min: 0, max: 10, group: 'Handling' },
    { key: 'grip.rolling', type: 'number', label: 'Rolling grip', doc: 'Friction while rolling.', tier: 'pro', default: 0.8, min: 0, max: 2, unit: 'mu', group: 'Handling' },
    { key: 'colour', type: 'color', label: 'Colour', doc: 'Paint.', tier: 'build', default: '#ff8800', group: 'Looks' },
    { key: 'shiny', type: 'boolean', label: 'Shiny', doc: 'Glossy paint.', tier: 'build', default: false, group: 'Looks' },
    { key: 'style', type: 'enum', label: 'Style', doc: 'Pattern.', tier: 'build', default: 'plain', options: ['plain', 'stripes'], group: 'Looks' },
    { key: 'name2', type: 'string', label: 'Nickname', doc: 'A name.', tier: 'build', default: '' },
    { key: 'boost', type: 'expr', label: 'Boost', doc: 'A formula.', tier: 'pro', default: { expr: '1' } },
  ],
  slots: [{ key: 'mechanics', label: 'Mechanics', doc: 'Extra behaviours.', kinds: ['mechanic'], min: 0, max: 4, tier: 'build' }],
} as const);

const rows = (m: ReturnType<typeof buildInspectorModel>) => m.groups.flatMap((g) => g.rows);

test('model: tier filtering (play < build < pro) keeps declaration order', () => {
  const play = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'play' });
  assert.deepEqual(rows(play).map((r) => r.key), ['weight', 'bounce']);
  const build = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'build' });
  assert.deepEqual(rows(build).map((r) => r.key), ['weight', 'bounce', 'colour', 'shiny', 'style', 'name2']);
  const pro = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'pro' });
  assert.equal(rows(pro).length, 8);
});

test('model: groups follow the schema group name, in first-appearance order; ungrouped rows go to "General" last', () => {
  const m = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'pro' });
  assert.deepEqual(m.groups.map((g) => g.name), ['Handling', 'Looks', 'General']);
  assert.deepEqual(m.groups[0]!.rows.map((r) => r.key), ['weight', 'bounce', 'grip.rolling']);
});

test('model: each row carries the control to draw and its limits', () => {
  const m = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'pro' });
  const by = Object.fromEntries(rows(m).map((r) => [r.key, r]));
  assert.equal(by['weight']!.control, 'slider');          // number with min and max
  assert.equal(by['weight']!.min, 0); assert.equal(by['weight']!.max, 10); assert.equal(by['weight']!.step, 1);
  assert.equal(by['grip.rolling']!.unit, 'mu');
  assert.equal(by['colour']!.control, 'color');
  assert.equal(by['shiny']!.control, 'toggle');
  assert.equal(by['style']!.control, 'select'); assert.deepEqual(by['style']!.options, ['plain', 'stripes']);
  assert.equal(by['name2']!.control, 'text');
  assert.equal(by['boost']!.control, 'expr');
  assert.equal(by['weight']!.label, 'Weight'); assert.equal(by['weight']!.doc, 'How heavy the ball is.');
});

test('model: value shows the resolved value; overridden is true only when the preset itself stores the key', () => {
  const m = buildInspectorModel({ schema: racer, params: { weight: 8 }, resolved: { weight: 8, bounce: 3 }, tier: 'play' });
  const w = rows(m).find((r) => r.key === 'weight')!;
  const b = rows(m).find((r) => r.key === 'bounce')!;
  assert.equal(w.value, 8); assert.equal(w.overridden, true);
  assert.equal(b.value, 3); assert.equal(b.overridden, false, 'inherited, not stored here');
  const d = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'play' });
  assert.equal(rows(d).find((r) => r.key === 'weight')!.value, 5, 'falls back to the schema default');
});

test('model: a stored expression is shown as an expression row, not a number', () => {
  const m = buildInspectorModel({ schema: racer, params: { weight: { expr: '$p1.weight * 2' } }, resolved: { weight: 6 }, tier: 'play' });
  const w = rows(m).find((r) => r.key === 'weight')!;
  assert.equal(w.control, 'expr'); assert.equal(w.expression, '$p1.weight * 2'); assert.equal(w.value, 6);
});

test('model: search filters rows by label, key or doc (case-insensitive) within the tier', () => {
  const m = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'pro', search: 'FRICTION' });
  assert.deepEqual(rows(m).map((r) => r.key), ['grip.rolling']);
  const none = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'play', search: 'friction' });
  assert.equal(rows(none).length, 0, 'a pro-tier row is not found from the play tier');
  assert.deepEqual(none.groups, [], 'empty groups are dropped');
});

test('model: slots appear from the build tier up, with their limits', () => {
  assert.equal(buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'play' }).slots.length, 0);
  const s = buildInspectorModel({ schema: racer, params: {}, resolved: {}, tier: 'build', children: { mechanics: [{ ref: 'm1' }] } }).slots;
  assert.equal(s.length, 1); assert.equal(s[0]!.key, 'mechanics'); assert.equal(s[0]!.max, 4); assert.deepEqual(s[0]!.children, [{ ref: 'm1' }]);
});

test('component: renders labels, docs as tooltips (title), and the right inputs', () => {
  const html = renderToStaticMarkup(createElement(Inspector, { schema: racer, params: {}, resolved: {}, tier: 'build', onChange: () => undefined }));
  assert.match(html, /Weight/); assert.match(html, /Looks/); assert.match(html, /Handling/);
  assert.match(html, /title="How heavy the ball is\."/);
  assert.match(html, /type="range"[^>]*min="0"[^>]*max="10"|min="0"[^>]*max="10"[^>]*type="range"/);
  assert.match(html, /type="checkbox"/); assert.match(html, /type="color"/); assert.match(html, /<select/);
  assert.doesNotMatch(html, /Rolling grip/, 'pro-tier rows are not drawn at the build tier');
});

test('component: a child-friendly play tier draws only big simple controls and no group headings clutter', () => {
  const html = renderToStaticMarkup(createElement(Inspector, { schema: racer, params: {}, resolved: {}, tier: 'play', onChange: () => undefined }));
  assert.match(html, /Weight/); assert.match(html, /Bounce/);
  assert.doesNotMatch(html, /Colour/); assert.doesNotMatch(html, /type="color"/);
});

test('component: overridden rows are marked, and have a reset control only when onReset is given', () => {
  const withReset = renderToStaticMarkup(createElement(Inspector, { schema: racer, params: { weight: 8 }, resolved: { weight: 8 }, tier: 'play', onChange: () => undefined, onReset: () => undefined }));
  assert.match(withReset, /data-overridden="true"/);
  assert.match(withReset, /data-reset="weight"/);
  const without = renderToStaticMarkup(createElement(Inspector, { schema: racer, params: { weight: 8 }, resolved: { weight: 8 }, tier: 'play', onChange: () => undefined }));
  assert.doesNotMatch(without, /data-reset=/);
});

test('component: every row has a data-key so tools and tests can find it', () => {
  const html = renderToStaticMarkup(createElement(Inspector, { schema: racer, params: {}, resolved: {}, tier: 'pro', onChange: () => undefined }));
  for (const k of ['weight', 'bounce', 'grip.rolling', 'colour', 'shiny', 'style', 'name2', 'boost']) assert.match(html, new RegExp(`data-key="${k.replace('.', '\\.')}"`));
});
