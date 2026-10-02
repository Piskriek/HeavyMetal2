import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defineSchema, type Params, type Ref, type Tier, type Value } from '@hm/contracts';
import { Inspector, buildInspectorModel, numberToEmit } from '@hm/ui';

const schema = defineSchema({
  kind: 'widget', version: 1, label: 'Widget', doc: 'A test widget.',
  variables: [
    { key: 'power', type: 'number', label: 'Power', doc: 'How strong.', tier: 'play', default: 3, min: 0, max: 10, step: 1, unit: 'kW', group: 'Basics' },
    { key: 'count', type: 'int', label: 'Count', doc: 'How many.', tier: 'build', default: 2, group: 'Basics' },
    { key: 'on', type: 'boolean', label: 'Enabled', doc: 'Is it on.', tier: 'play', default: true, group: 'Basics' },
    { key: 'title', type: 'string', label: 'Title', doc: 'A title.', tier: 'build', default: 'Hello', group: 'Basics' },
    { key: 'mode', type: 'enum', label: 'Mode', doc: 'Which mode.', tier: 'build', default: 'a', options: ['a', 'b', 'c'], group: 'Basics' },
    { key: 'tint', type: 'color', label: 'Tint', doc: 'A tint.', tier: 'build', default: '#336699', group: 'Looks' },
    { key: 'pos', type: 'vec3', label: 'Position', doc: 'Where.', tier: 'build', default: [1, 2, 3], group: 'Looks' },
    { key: 'uv', type: 'vec2', label: 'Offset', doc: 'Offset.', tier: 'pro', default: [0, 0], group: 'Looks' },
    { key: 'speed', type: 'expr', label: 'Speed', doc: 'A formula.', tier: 'pro', default: { expr: '1' } },
    { key: 'target', type: 'ref', label: 'Target', doc: 'Points at one.', tier: 'build', default: { ref: 'ball-1' }, group: 'Links' },
    { key: 'items', type: 'list', label: 'Items', doc: 'Many.', tier: 'pro', default: [], group: 'Links' },
  ],
  slots: [
    { key: 'parts', label: 'Parts', doc: 'Pieces.', kinds: ['part'], min: 0, max: 4, tier: 'build' },
    { key: 'any', label: 'Anything', doc: 'No limit.', kinds: ['part'], min: 0, max: null, tier: 'build' },
  ],
} as const);

type Extra = { params?: Params; resolved?: Params; search?: string; children?: Record<string, readonly Ref[]>; onReset?: (k: string) => void; onChange?: (k: string, v: Value) => void };

const props = (tier: Tier, extra: Extra = {}) => ({
  schema, params: extra.params ?? {}, resolved: extra.resolved ?? {}, tier,
  ...(extra.search !== undefined ? { search: extra.search } : {}),
  ...(extra.children !== undefined ? { children: extra.children } : {}),
  ...(extra.onReset !== undefined ? { onReset: extra.onReset } : {}),
  onChange: extra.onChange ?? (() => undefined),
});
const render = (tier: Tier, extra: Extra = {}) => renderToStaticMarkup(createElement(Inspector, props(tier, extra)));

/** The html of one row (from its data-key up to the next row or section). */
function rowHtml(html: string, key: string): string {
  const start = html.indexOf(`data-key="${key}"`);
  assert.ok(start >= 0, `row ${key} is drawn`);
  const rest = html.slice(start + 10);
  const next = rest.search(/data-key="|<\/section>/);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Expands function components (the Inspector has no hooks) and returns every host element. */
function hostElements(node: unknown, out: ReactElement<Record<string, any>>[] = []): ReactElement<Record<string, any>>[] {
  if (Array.isArray(node)) { for (const n of node) hostElements(n, out); return out; }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<Record<string, any>>;
  if (typeof el.type === 'function') return hostElements((el.type as unknown as (p: unknown) => unknown)(el.props), out);
  out.push(el);
  hostElements(el.props['children'], out);
  return out;
}
const byAria = (tier: Tier, label: string, extra: Extra = {}) => {
  const found = hostElements(createElement(Inspector, props(tier, extra))).find((e) => e.props['aria-label'] === label);
  assert.ok(found, `control "${label}" exists`);
  return found.props;
};

test('slider shows the current value with its unit and carries limits', () => {
  const html = rowHtml(render('build', { resolved: { power: 7 } }), 'power');
  assert.match(html, /type="range"/);
  assert.match(html, /value="7"/);
  assert.match(html, /<input[^>]*type="number"[^>]*aria-label="Power value"[^>]*value="7"|<input[^>]*aria-label="Power value"[^>]*type="number"/, 'a box to type the exact number');
  assert.match(html, /<span class="hmi-unit">kW<\/span>/);
  assert.match(html, /class="hmi-src"/, 'every number has the input chooser');
});

test('number (no max) and int controls are number inputs holding the value', () => {
  const html = rowHtml(render('build', { resolved: { count: 5 } }), 'count');
  assert.match(html, /type="number"/);
  assert.match(html, /value="5"/);
});

test('toggle is a checkbox that reflects true/false', () => {
  assert.match(rowHtml(render('play', { resolved: { on: true } }), 'on'), /type="checkbox"[^>]*checked=""|checked=""[^>]*type="checkbox"/);
  assert.doesNotMatch(rowHtml(render('play', { resolved: { on: false } }), 'on'), /checked/);
});

test('text, select and colour controls show their values', () => {
  const html = render('build', { resolved: { title: 'Zed', mode: 'b', tint: '#ff0000' } });
  assert.match(rowHtml(html, 'title'), /type="text"[^>]*value="Zed"|value="Zed"[^>]*type="text"/);
  const select = rowHtml(html, 'mode');
  assert.match(select, /<select/);
  assert.equal((select.match(/<option/g) ?? []).length, 3);
  assert.match(select, /<option value="b"[^>]*selected/);
  assert.match(rowHtml(html, 'tint'), /type="color"[^>]*value="#ff0000"|value="#ff0000"[^>]*type="color"/);
});

test('vector draws one number input per component', () => {
  const html = render('pro');
  assert.equal((rowHtml(html, 'pos').match(/type="number"/g) ?? []).length, 3);
  assert.equal((rowHtml(html, 'uv').match(/type="number"/g) ?? []).length, 2);
  assert.match(rowHtml(html, 'pos'), /value="2"/);
});

test('expr shows the formula text with the ƒ badge, or the default expression', () => {
  const own = render('pro', { params: { speed: { expr: 'a*2+1' } }, resolved: { speed: { expr: 'a*2+1' } } });
  assert.match(rowHtml(own, 'speed'), /value="a\*2\+1"/);
  assert.match(rowHtml(own, 'speed'), /ƒ/);
  assert.match(rowHtml(render('pro'), 'speed'), /value="1"/);
});

test('ref and list are read-only summaries (no inputs), long values are shortened', () => {
  const long = Array.from({ length: 200 }, (_, i) => i);
  const html = render('pro', { resolved: { items: long } });
  const ref = rowHtml(html, 'target');
  assert.match(ref, /ball-1/);
  assert.doesNotMatch(ref, /<input|<select/);
  const items = rowHtml(html, 'items');
  assert.match(items, /…/);
  assert.doesNotMatch(items, /<input/);
  assert.doesNotMatch(items, /,198,199/);
});

test('text in labels, docs and values is escaped', () => {
  const evil = defineSchema({
    kind: 'evil', version: 1, label: 'Evil', doc: 'x',
    variables: [
      { key: 'a', type: 'string', label: '<i>Bold</i> & "co"', doc: 'say "hi" <script>', tier: 'play', default: '"><script>alert(1)</script>' },
    ],
    slots: [],
  } as const);
  const html = renderToStaticMarkup(createElement(Inspector, { schema: evil, params: {}, resolved: {}, tier: 'play', onChange: () => undefined }));
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /<i>Bold/);
  assert.match(html, /&lt;i&gt;Bold&lt;\/i&gt; &amp; &quot;co&quot;/);
  assert.match(html, /title="say &quot;hi&quot; &lt;script&gt;"/);
});

test('play has no group headings and uses the big layout; build and pro have headings', () => {
  const play = render('play');
  assert.doesNotMatch(play, /<h3/);
  assert.doesNotMatch(play, /Basics/);
  assert.match(play, /hmi-play/);
  const pro = render('pro');
  assert.match(pro, /<h3[^>]*>Basics<\/h3>/);
  assert.match(pro, /<h3[^>]*>Looks<\/h3>/);
  assert.match(pro, /hmi-pro/);
});

test('pro shows more rows than play', () => {
  const count = (h: string) => (h.match(/data-key="/g) ?? []).length;
  assert.equal(count(render('play')), 2);
  assert.equal(count(render('build')), 8);
  assert.equal(count(render('pro')), 11);
});

test('slots: "Contains" lists label, count and child ids at build/pro, never at play', () => {
  const children = { parts: [{ ref: 'wheel-1' }, { ref: 'wheel-2' }] };
  const html = render('build', { children });
  assert.match(html, /Contains/);
  assert.match(html, /Parts/);
  assert.match(html, /2 \/ 4/);
  assert.match(html, /wheel-1/); assert.match(html, /wheel-2/);
  assert.match(html, /0 \/ ∞/);
  assert.doesNotMatch(render('play', { children }), /Contains/);
});

test('reset buttons appear only for overridden rows and only with onReset', () => {
  const html = render('build', { params: { power: 8, title: 'x' }, resolved: { power: 8, title: 'x' }, onReset: () => undefined });
  assert.equal((html.match(/data-reset="/g) ?? []).length, 2);
  assert.match(html, /data-reset="power"/);
  assert.doesNotMatch(rowHtml(html, 'count'), /data-reset/);
  assert.doesNotMatch(render('build', { params: { power: 8 } }), /data-reset=/);
});

test('search narrows the rows', () => {
  const html = render('pro', { search: 'tint' });
  assert.match(html, /data-key="tint"/);
  assert.doesNotMatch(html, /data-key="power"/);
  assert.match(render('play', { search: 'zzzz' }), /Nothing to show/);
});

test('editing emits correctly typed values', () => {
  const calls: [string, Value][] = [];
  const onChange = (k: string, v: Value) => { calls.push([k, v]); };
  const fire = (tier: Tier, label: string, target: Record<string, unknown>, extra: Extra = {}) =>
    (byAria(tier, label, { onChange, ...extra })['onChange'] as (e: unknown) => void)({ target });
  fire('build', 'Enabled', { checked: false });
  fire('build', 'Title', { value: 'Yo' });
  fire('build', 'Mode', { value: 'c' });
  fire('build', 'Tint', { value: '#00ff00' });
  fire('pro', 'Speed', { value: 'a+b' });
  fire('build', 'Position y', { value: '9' });
  assert.deepEqual(calls, [
    ['on', false], ['title', 'Yo'], ['mode', 'c'], ['tint', '#00ff00'],
    ['speed', { expr: 'a+b' }], ['pos', [1, 9, 3]],
  ]);
});

test('numbers: typed values are whole for ints, never stopped by the slider range, and only a hard limit refuses them', () => {
  const rows = buildInspectorModel({ schema, params: {}, resolved: {}, tier: 'pro' }).groups.flatMap((g) => g.rows);
  const row = (key: string) => rows.find((r) => r.key === key)!;
  assert.equal(numberToEmit(row('power'), '7', true), 7);
  assert.equal(numberToEmit(row('count'), '4.6', false), 5);
  assert.equal(numberToEmit(row('count'), '', false), null, 'an empty box emits nothing');
  assert.equal(numberToEmit(row('count'), 'abc', false), null);
  assert.equal(row('power').max, 10);
  assert.equal(numberToEmit(row('power'), '70', false), 70, 'past the slider end is fine');
  assert.equal(numberToEmit(row('power'), '-4', false), 0, 'a range that starts at zero stops at zero');
  assert.equal(numberToEmit(row('power'), '7.3', true), 7, 'dragging snaps to the step, typing does not');
  assert.equal(numberToEmit(row('power'), '7.3', false), 7.3);
});

test('the hard limits reach the row; open sides stay open', () => {
  const frac = defineSchema({ kind: 'f', version: 1, label: 'F', doc: 'x', slots: [], variables: [
    { key: 'opacity', type: 'number', label: 'Opacity', doc: 'x', tier: 'play', default: 1, min: 0, max: 1 },
    { key: 'turn', type: 'number', label: 'Turn', doc: 'x', tier: 'play', default: 0, min: -180, max: 180 },
  ] } as const);
  const rows = buildInspectorModel({ schema: frac, params: {}, resolved: {}, tier: 'play' }).groups.flatMap((g) => g.rows);
  const o = rows.find((r) => r.key === 'opacity')!, t = rows.find((r) => r.key === 'turn')!;
  assert.equal(o.hardMin, 0); assert.equal(o.hardMax, 1);
  assert.equal(t.hardMin, undefined); assert.equal(t.hardMax, undefined);
  assert.equal(numberToEmit(o, '1.5', false), 1);
  assert.equal(numberToEmit(t, '900', false), 900);
});

test('every number gets an input chooser, formulas can switch back, and the slider is still a native range', () => {
  const html = render('pro', { params: { speed: { expr: 'power * 2' } } });
  assert.ok((html.match(/class="hmi-src/g) ?? []).length >= 3, 'power, count and speed each have one');
  assert.match(rowHtml(html, 'speed'), /hmi-src/);
  assert.doesNotMatch(rowHtml(html, 'title'), /hmi-src/, 'text settings have no number input');
});

test('the reset button calls onReset with the key', () => {
  const seen: string[] = [];
  const els = hostElements(createElement(Inspector, props('build', { params: { power: 1 }, onReset: (k) => { seen.push(k); } })));
  const btn = els.find((e) => e.props['data-reset'] === 'power');
  assert.ok(btn);
  (btn.props['onClick'] as () => void)();
  assert.deepEqual(seen, ['power']);
});
