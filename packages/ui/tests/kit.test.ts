import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { Palette, BrushPanel, SceneTree, filterTree, PresetBrowser, filterPresets, Toolbar, HUD, ordinal, formatTime, Minimap, fitBounds, darkTheme, themeVars, type TreeNode, type PresetCard, type Manip, type BrushState } from '../src/kit';

const noop = () => undefined;
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

test('theme vars', () => {
  const v = themeVars(darkTheme);
  assert.equal(v['--hm-accent'], '#ffd24a'); assert.equal(v['--hm-bg'], '#0f1318');
  assert.equal(Object.keys(v).length, 8);
});

test('Palette: one pressable button per item, selected flagged, image vs swatch', () => {
  const m = html(h(Palette, { items: [{ id: 1, name: 'Sand', swatch: '#d8c79a' }, { id: 2, name: 'Grass', swatch: '#4f8a3a', image: 'g.webp' }], selected: 2, onSelect: noop }));
  assert.equal(count(m, /<button/g), 2);
  assert.match(m, /data-id="2"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-id="2"/);
  assert.match(m, /data-id="1"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*data-id="1"/);
  assert.match(m, /data-selected="true"/); assert.equal(count(m, /data-selected="true"/g), 1);
  assert.match(m, /src="g\.webp"/); assert.match(m, /Sand/);
});

test('BrushPanel: tiers decide which controls exist', () => {
  const brush: BrushState = { kind: 'raise', radius: 12, strength: 0.5, falloff: 'smooth' };
  const play = html(h(BrushPanel, { brush, onChange: noop, tier: 'play' }));
  assert.equal(count(play, /data-kind="/g), 5); assert.match(play, /data-field="radius"/);
  assert.doesNotMatch(play, /data-field="strength"/); assert.doesNotMatch(play, /data-field="falloff"/);
  const pro = html(h(BrushPanel, { brush, onChange: noop, tier: 'pro' }));
  assert.match(pro, /data-field="strength"/); assert.match(pro, /data-field="falloff"/);
  assert.match(pro, /data-kind="raise"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-kind="raise"/);
});

const tree: TreeNode[] = [
  { id: 'a', name: 'Arena', kind: 'scene', children: [{ id: 'b', name: 'Gold ball', kind: 'entity' }, { id: 'c', name: 'Post', kind: 'entity', visible: false }] },
  { id: 'd', name: 'Camera', kind: 'camera' },
];
test('filterTree keeps matches and their ancestors only', () => {
  assert.deepEqual(filterTree(tree, ''), tree);
  const f = filterTree(tree, 'gold');
  assert.equal(f.length, 1); assert.equal(f[0]!.id, 'a'); assert.deepEqual(f[0]!.children!.map((n) => n.id), ['b']);
  assert.deepEqual(filterTree(tree, 'zzz'), []);
});
test('SceneTree: roles, selection, optional actions, nesting', () => {
  const m = html(h(SceneTree, { nodes: tree, selected: 'b', onSelect: noop, onToggleVisible: noop, onDelete: noop }));
  assert.match(m, /role="tree"/); assert.equal(count(m, /role="treeitem"/g), 4);
  assert.match(m, /data-id="b"[^>]*aria-selected="true"|aria-selected="true"[^>]*data-id="b"/);
  assert.equal(count(m, /data-action="toggle"/g), 4); assert.equal(count(m, /data-action="delete"/g), 4);
  assert.match(m, /role="group"/);
  const bare = html(h(SceneTree, { nodes: tree, selected: null, onSelect: noop }));
  assert.doesNotMatch(bare, /data-action=/);
  const filtered = html(h(SceneTree, { nodes: tree, selected: null, onSelect: noop, filter: 'camera' }));
  assert.equal(count(filtered, /role="treeitem"/g), 1);
});

const cards: PresetCard[] = [
  { id: '1', name: 'Gold', kind: 'material', tags: ['metal', 'shiny'], tier: 'play' },
  { id: '2', name: 'Basalt', kind: 'material', tags: ['rock'], tier: 'build' },
  { id: '3', name: 'Goblin Racer', kind: 'racer', tags: ['green', 'fast'], tier: 'play' },
];
test('filterPresets: words, kind, tag, sorted by name', () => {
  const all = { text: '', kind: null, tag: null };
  assert.deepEqual(filterPresets(cards, all).map((c) => c.name), ['Basalt', 'Goblin Racer', 'Gold']);
  assert.deepEqual(filterPresets(cards, { ...all, text: 'go' }).map((c) => c.id), ['3', '1']);
  assert.deepEqual(filterPresets(cards, { ...all, text: 'gob fast' }).map((c) => c.id), ['3']);
  assert.deepEqual(filterPresets(cards, { ...all, kind: 'material' }).map((c) => c.id), ['2', '1']);
  assert.deepEqual(filterPresets(cards, { ...all, tag: 'rock' }).map((c) => c.id), ['2']);
  assert.deepEqual(filterPresets(cards, { ...all, text: 'METAL' }).map((c) => c.id), ['1']);
});
test('PresetBrowser: search box, kind chips, cards, fork only above the play tier, empty state', () => {
  const f = { text: '', kind: null, tag: null };
  const build = html(h(PresetBrowser, { cards, filter: f, onFilter: noop, onPick: noop, onFork: noop, tier: 'build' }));
  assert.match(build, /data-field="search"/); assert.equal(count(build, /<article/g), 3);
  assert.equal(count(build, /data-kind="/g), 3); // All, material, racer
  assert.equal(count(build, /data-action="fork"/g), 3);
  const play = html(h(PresetBrowser, { cards, filter: f, onFilter: noop, onPick: noop, onFork: noop, tier: 'play' }));
  assert.equal(count(play, /data-action="fork"/g), 0);
  const none = html(h(PresetBrowser, { cards, filter: { ...f, text: 'zzzz' }, onFilter: noop, onPick: noop, tier: 'pro' }));
  assert.match(none, /role="status"[^>]*>No presets match/); assert.equal(count(none, /<article/g), 0);
});

test('Toolbar: tools and manipulation controls by tier', () => {
  const manip: Manip = { snapGrid: 1, snapAngle: 15, snapToSurface: true, alignToNormal: false, axes: 'free', mirror: 'none', arrayCount: 1 };
  const tools = [{ id: 'move', label: 'Move', icon: '✥', hotkey: 'G' }, { id: 'paint', label: 'Paint', icon: '🖌' }];
  const pro = html(h(Toolbar, { tools, active: 'paint', onSelect: noop, manip, onManip: noop, tier: 'pro' }));
  assert.equal(count(pro, /data-tool="/g), 2); assert.match(pro, /title="Move \(G\)"/);
  assert.match(pro, /data-tool="paint"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-tool="paint"/);
  for (const f of ['snapGrid', 'snapAngle', 'snapToSurface', 'alignToNormal', 'axes', 'mirror', 'arrayCount']) assert.match(pro, new RegExp(`data-field="${f}"`));
  const play = html(h(Toolbar, { tools, active: 'move', onSelect: noop, manip, onManip: noop, tier: 'play' }));
  assert.match(play, /data-field="snapGrid"/); assert.match(play, /data-field="snapToSurface"/);
  assert.doesNotMatch(play, /data-field="axes"/); assert.doesNotMatch(play, /data-field="snapAngle"/);
  const build = html(h(Toolbar, { tools, active: 'move', onSelect: noop, manip, onManip: noop, tier: 'build' }));
  assert.match(build, /data-field="snapAngle"/); assert.doesNotMatch(build, /data-field="mirror"/);
});

test('ordinal and formatTime', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  assert.equal(formatTime(83450), '1:23.45'); assert.equal(formatTime(0), '0:00.00'); assert.equal(formatTime(-5), '0:00.00'); assert.equal(formatTime(Number.NaN), '0:00.00');
  assert.equal(formatTime(600000), '10:00.00'); assert.equal(formatTime(999), '0:00.99');
});
test('HUD shows speed, lap, position, time, item, boost and message', () => {
  const m = html(h(HUD, { speed: 87.6, lap: 2, laps: 3, position: 3, racers: 8, timeMs: 83450, item: { id: 'boost', label: 'Boost', icon: '⚡' }, boost: 0.456, message: 'GO!' }));
  assert.match(m, /data-hud="speed"[^>]*>[^]*?88/); assert.match(m, /2\/3/); assert.match(m, /3rd/); assert.match(m, /1:23\.45/);
  assert.match(m, /⚡/); assert.match(m, /aria-valuenow="46"/); assert.match(m, /role="status"[^>]*>GO!/);
  const empty = html(h(HUD, { speed: 0, lap: 1, laps: 3, position: 1, racers: 1, timeMs: 0, item: null, boost: 9, message: undefined }));
  assert.match(empty, /data-hud="item"/); assert.match(empty, /aria-valuenow="100"/); assert.doesNotMatch(empty, /role="status"/);
});

test('fitBounds and Minimap', () => {
  assert.deepEqual(fitBounds([], 0.1), { minX: 0, minZ: 0, w: 1, h: 1 });
  const b = fitBounds([[0, 0], [100, 50]], 0.1);
  assert.ok(Math.abs(b.minX + 10) < 1e-9 && Math.abs(b.minZ + 10) < 1e-9 && Math.abs(b.w - 120) < 1e-9 && Math.abs(b.h - 70) < 1e-9, JSON.stringify(b));
  const m = html(h(Minimap, { track: [[0, 0], [100, 0], [100, 50], [0, 50]], racers: [{ id: 'p1', x: 10, z: 0, color: '#f00', me: true }, { id: 'p2', x: 50, z: 50, color: '#0f0' }] }));
  assert.match(m, /<svg[^>]*viewBox=/); assert.match(m, /data-minimap="track"/); assert.match(m, /d="M/); assert.match(m, /Z"/);
  assert.equal(count(m, /data-racer="/g), 2);
});
