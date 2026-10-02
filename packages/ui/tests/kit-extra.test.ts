import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import {
  Palette, BrushPanel, SceneTree, filterTree, PresetBrowser, filterPresets, Toolbar, HUD, Minimap,
  fitBounds, ordinal, formatTime, darkTheme, paperTheme, themeVars,
  type TreeNode, type PresetCard, type Manip,
} from '../src/kit';

const noop = () => undefined;
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const KEYS = ['bg', 'panel', 'line', 'text', 'dim', 'accent', 'danger', 'ok'];
const VARS = ['--hm-bg', '--hm-panel', '--hm-line', '--hm-text', '--hm-dim', '--hm-accent', '--hm-danger', '--hm-ok'];

test('themes are complete, valid hex and distinct', () => {
  for (const theme of [darkTheme, paperTheme]) {
    assert.deepEqual(Object.keys(theme).sort(), KEYS.slice().sort());
    assert.deepEqual(Object.keys(themeVars(theme)).sort(), VARS.slice().sort());
    for (const key of KEYS) assert.match(theme[key as keyof typeof theme], /^#[0-9a-f]{6}$/i);
  }
  assert.equal(darkTheme.bg, '#0f1318');
  assert.notEqual(darkTheme.bg, paperTheme.bg);
  assert.notEqual(darkTheme.text, paperTheme.text);
  assert.equal(paperTheme.accent, themeVars(paperTheme)['--hm-accent']);
});

test('Palette: escaping, columns, 44px targets and empty lists', () => {
  const m = html(h(Palette, { items: [{ id: 7, name: 'Sand & "Stone"', swatch: '#d8c79a' }], selected: 8, onSelect: noop, columns: 6 }));
  assert.match(m, /Sand &amp; &quot;Stone&quot;/);
  assert.match(m, /title="Sand &amp; &quot;Stone&quot;"/);
  assert.doesNotMatch(m, /data-selected=/);
  assert.match(m, /repeat\(6, minmax\(44px, 1fr\)\)/);
  assert.match(m, /min-height:\s*44px/);
  assert.match(m, /min-width:\s*44px/);
  const empty = html(h(Palette, { items: [], selected: 0, onSelect: noop }));
  assert.match(empty, /data-kit="palette"/);
  assert.equal(count(empty, /<button/g), 0);
});

test('BrushPanel: controlled values, option sets and tier parity', () => {
  const brush = { kind: 'flatten', radius: 33, strength: 0.75, falloff: 'linear' } as const;
  const pro = html(h(BrushPanel, { brush, onChange: noop, tier: 'pro' }));
  assert.match(pro, /data-field="radius"[^>]*min="1"[^>]*max="60"[^>]*step="1"[^>]*value="33"/);
  assert.match(pro, /data-field="strength"[^>]*min="0.05"[^>]*max="1"[^>]*step="0.05"[^>]*value="0.75"/);
  assert.match(pro, /<option value="smooth"/);
  assert.match(pro, /<option value="linear"/);
  assert.match(pro, /<option value="flat"/);
  assert.match(pro, /data-kind="flatten"[^>]*aria-pressed="true"/);
  assert.match(html(h(BrushPanel, { brush, onChange: noop, tier: 'build' })), /data-field="falloff"/);
});

test('filterTree: deep nesting, trimming and case folding', () => {
  const deep: TreeNode[] = [{
    id: 'root', name: 'World', kind: 'scene',
    children: [{
      id: 'mid', name: 'Props', kind: 'group',
      children: [{ id: 'leaf', name: 'Neon Sign', kind: 'entity' }, { id: 'other', name: 'Crate', kind: 'entity' }],
    }, { id: 'sky', name: 'Sky', kind: 'light' }],
  }];
  const found = filterTree(deep, '  NEON  ');
  assert.equal(found.length, 1);
  assert.equal(found[0]!.id, 'root');
  assert.equal(found[0]!.children!.length, 1);
  assert.equal(found[0]!.children![0]!.id, 'mid');
  assert.deepEqual(found[0]!.children![0]!.children!.map((n) => n.id), ['leaf']);
  const sky = filterTree(deep, 'sky');
  assert.deepEqual(sky[0]!.children!.map((n) => n.id), ['sky']);
  assert.equal(sky[0]!.children![0]!.children, undefined);
  assert.equal(found[0]!.name, 'World');
});

test('SceneTree: escaping, empty state and case-insensitive filtering', () => {
  const nodes: TreeNode[] = [{ id: 'x1', name: 'Wall & <Gate>', kind: 'prop' }];
  const m = html(h(SceneTree, { nodes, selected: null, onSelect: noop }));
  assert.match(m, /Wall &amp; &lt;Gate&gt;/);
  assert.doesNotMatch(m, /<Gate>/);
  assert.equal(count(m, /role="treeitem"/g), 1);
  assert.match(m, /data-kind="prop"/);
  const none = html(h(SceneTree, { nodes: [], selected: null, onSelect: noop }));
  assert.match(none, /role="tree"/);
  assert.equal(count(none, /role="treeitem"/g), 0);
  const mixed: TreeNode[] = [{ id: 'a', name: 'Alpha', kind: 'scene' }, { id: 'b', name: 'beta', kind: 'scene' }];
  assert.equal(count(html(h(SceneTree, { nodes: mixed, selected: null, onSelect: noop, filter: 'BET' })), /role="treeitem"/g), 1);
});

test('filterPresets: words, kind, tag, sorting and empty input', () => {
  const list: PresetCard[] = [
    { id: 'a', name: 'apple', kind: 'food', tags: ['red'], tier: 'play' },
    { id: 'b', name: 'Banana', kind: 'food', tags: ['yellow'], tier: 'play' },
    { id: 'c', name: 'Cherry', kind: 'prop', tags: ['red'], tier: 'pro' },
  ];
  const base = { text: '', kind: null, tag: null };
  assert.deepEqual(filterPresets(list, base).map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(filterPresets(list, { ...base, text: 'red' }).map((c) => c.id), ['a', 'c']);
  assert.deepEqual(filterPresets(list, { ...base, kind: 'food', tag: 'yellow' }).map((c) => c.id), ['b']);
  assert.deepEqual(filterPresets(list, { ...base, kind: 'prop', tag: 'yellow' }), []);
  assert.deepEqual(filterPresets(list, { ...base, text: '   ' }).map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(filterPresets([], base), []);
});

test('PresetBrowser: escaping, tag cap, thumbnails, fork gating and empty state', () => {
  const list: PresetCard[] = [
    { id: 'p1', name: 'Amp & <Loud>', kind: 'audio', tags: ['t1', 't2', 't3', 't4'], tier: 'build', thumb: 't.webp' },
    { id: 'p2', name: 'Plain', kind: 'audio', tags: [], tier: 'build' },
  ];
  const filter = { text: '', kind: null, tag: null };
  const m = html(h(PresetBrowser, { cards: list, filter, onFilter: noop, onPick: noop, tier: 'build' }));
  assert.match(m, /Amp &amp; &lt;Loud&gt;/);
  assert.doesNotMatch(m, /<Loud>/);
  assert.equal(count(m, /data-action="fork"/g), 0);
  assert.match(m, /src="t\.webp"/);
  assert.equal(count(m, /<article/g), 2);
  assert.doesNotMatch(m, /data-id="p1"[^>]*data-kind=/);
  assert.equal(count(m, /data-kind="/g), 2); // All + audio
  const active = html(h(PresetBrowser, { cards: list, filter: { ...filter, kind: 'audio' }, onFilter: noop, onPick: noop, onFork: noop, tier: 'pro' }));
  assert.match(active, /data-kind="audio"[^>]*aria-pressed="true"/);
  assert.match(active, /data-kind=""[^>]*aria-pressed="false"/);
  const bare = html(h(PresetBrowser, { cards: [], filter: { text: 'x', kind: null, tag: null }, onFilter: noop, onPick: noop, tier: 'play' }));
  assert.match(bare, /data-field="search"/);
  assert.match(bare, /role="status"[^>]*>No presets match/);
});

test('Toolbar: field counts per tier and reflected control values', () => {
  const manip: Manip = { snapGrid: 0.5, snapAngle: 45, snapToSurface: true, alignToNormal: true, axes: 'xz', mirror: 'x', arrayCount: 4 };
  const tools = [{ id: 'move', label: 'Move', icon: '✥', hotkey: 'G' }, { id: 'rot', label: 'Rotate', icon: '⟳' }];
  const pro = html(h(Toolbar, { tools, active: 'rot', onSelect: noop, manip, onManip: noop, tier: 'pro' }));
  assert.equal(count(pro, /data-field="/g), 7);
  assert.match(pro, /title="Rotate"/);
  assert.match(pro, /<option value="0.5" selected=""/);
  assert.match(pro, /<option value="45" selected=""/);
  assert.match(pro, /<option value="xz" selected=""/);
  assert.match(pro, /data-field="snapToSurface"[^>]*checked/);
  assert.match(pro, /data-field="alignToNormal"[^>]*checked/);
  assert.match(pro, /data-field="arrayCount"[^>]*min="1"[^>]*max="64"[^>]*value="4"/);
  assert.match(pro, /data-kit="manip"/);
  const play = html(h(Toolbar, { tools, active: 'move', onSelect: noop, manip, onManip: noop, tier: 'play' }));
  assert.equal(count(play, /data-field="/g), 2);
  const build = html(h(Toolbar, { tools, active: 'move', onSelect: noop, manip, onManip: noop, tier: 'build' }));
  assert.equal(count(build, /data-field="/g), 4);
  assert.doesNotMatch(build, /data-field="arrayCount"/);
});

test('HUD: boost clamping, position formatting and message escaping', () => {
  const m = html(h(HUD, { speed: 12.4, lap: 21, laps: 22, position: 21, racers: 12, timeMs: 0, item: null, boost: -3, message: 'Go & <win>' }));
  assert.match(m, /aria-valuenow="0"/);
  assert.match(m, /21\/22/);
  assert.match(m, /21st/);
  assert.match(m, /\/ 12/);
  assert.match(m, /Go &amp; &lt;win&gt;/);
  assert.match(m, /0:00\.00/);
  assert.match(m, /data-hud="item"/);
  const mid = html(h(HUD, { speed: 0, lap: 1, laps: 1, position: 1, racers: 1, timeMs: 1, item: null, boost: 0.5 }));
  assert.match(mid, /aria-valuenow="50"/);
});

test('Minimap: survives an empty track, draws "me" last, honours size', () => {
  const m = html(h(Minimap, { track: [], racers: [{ id: 'p2', x: 1, z: 1, color: '#0f0' }, { id: 'me', x: 2, z: 2, color: '#f00', me: true }] }));
  assert.match(m, /<svg[^>]*viewBox="/);
  assert.ok(m.indexOf('data-racer="me"') > m.indexOf('data-racer="p2"'));
  const sized = html(h(Minimap, { track: [[0, 0], [10, 10]], racers: [], size: 320 }));
  assert.match(sized, /width="320"/);
  assert.match(sized, /height="320"/);
});

test('pure helpers: fitBounds, ordinal and formatTime edge cases', () => {
  assert.deepEqual(fitBounds([[5, 5]], 0.1), { minX: 4.9, minZ: 4.9, w: 0.2, h: 0.2 });
  assert.deepEqual(fitBounds([[0, 0], [10, 10]], 0), { minX: 0, minZ: 0, w: 10, h: 10 });
  assert.deepEqual(fitBounds([[-50, -20], [-10, -5]], 0.1), { minX: -54, minZ: -24, w: 48, h: 23 });
  assert.equal(ordinal(0), '0th');
  assert.equal(ordinal(112), '112th');
  assert.equal(ordinal(1000), '1000th');
  assert.equal(ordinal(102), '102nd');
  assert.equal(ordinal(103), '103rd');
  assert.equal(ordinal(1111), '1111th');
  assert.equal(formatTime(1234), '0:01.23');
  assert.equal(formatTime(3599999), '59:59.99');
  assert.equal(formatTime(1), '0:00.00');
  assert.equal(formatTime(999.9), '0:00.99');
  assert.equal(formatTime(Infinity), '0:00.00');
  assert.equal(formatTime(-Infinity), '0:00.00');
  assert.equal(formatTime(60000), '1:00.00');
});
