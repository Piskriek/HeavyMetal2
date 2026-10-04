import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SFX_IDS } from '@hm/audio';
import { test } from 'node:test';
import {
  AMBIENCE_ICONS, CHAR_BRAINS, CHAR_WAYS, EFFECT_ICONS, EFFECT_WAYS, LOGIC_WAYS, PAINTS, PHYS_ITEMS, PHYS_WAYS, SOUND_WAYS, THINGS, V3_MODES, V3_TABS, WIRE_DOS,
  levelOfMode, modeOfLevel, nextMode, toolById, v3Button, v3Find, v3Matches, v3Slots, v3TabForKey, v3TabName, type V3Button,
} from '../src';

// The owner's spec, kept verbatim in the docs: the names here must be its names, word for word, in its order.
const doc = readFileSync(new URL('../../../docs/HOTBAR_V3_SPEC.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const yaml = doc.slice(doc.indexOf('```yaml'), doc.indexOf('```', doc.indexOf('```yaml') + 7));
const part = (from: string, to: string | null): string => yaml.slice(yaml.indexOf(`\n${from}:`), to ? yaml.indexOf(`\n${to}:`) : undefined);
const tabsOf = (s: string): { key: string; words: string; body: string }[] => {
  const re = /\n {2}(F\d+)_([A-Z_]+):/g;
  const hits = [...s.matchAll(re)];
  return hits.map((h, i) => ({ key: h[1]!, words: h[2]!, body: s.slice(h.index! + h[0].length, hits[i + 1]?.index ?? s.length) }));
};
const list = (line: string | undefined): string[] => {
  if (!line) return [];
  const inner = line.slice(line.indexOf('[') + 1, line.lastIndexOf(']')).trim();
  return inner === 'None' || !inner ? [] : inner.split(', ').map((x) => x.trim());
};
const numbered = (body: string): string[] => [...body.matchAll(/\n\s+\d+: "(.*)"/g)].map((r) => r[1]!);
const letters = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const game = tabsOf(part('GAME_MODE', 'SIMPLIFIED_MODE'));
const simplified = tabsOf(part('SIMPLIFIED_MODE', 'ADVANCED_MODE'));
const advanced = tabsOf(part('ADVANCED_MODE', null));

// V3.1 (docs/HOTBAR_V3_SPEC.md, the end): what was added on top of the spec, and the keys that changed
const ADDED = new Set(['Prop Box', 'Creek Digger', 'Save as Toy', 'Ground Material', 'Place Props', 'Paths & Water', 'Prop Placer']);
const CHANGED_KEYS: Readonly<Record<string, string>> = {
  'C Pilot Light as Viewport Camera': 'Alt+C Pilot Light as Viewport Camera',
  'Ctrl+1..9 Save Slot': 'Shift+1..9 Save Slot',
  '1..9 Recall Slot': '1..9 Recall Slot (holding Viewport Bookmark)',
  'Ctrl+Shift+P Pilot Mode': 'Alt+P Pilot Mode',
  'Spacebar Re-trigger Particle Burst': 'R Re-trigger Particle Burst',
};
const ours = (names: readonly string[]): string[] => names.filter((n) => !ADDED.has(n));

test('the spec has twelve tabs in each mode, and so does the hotbar', () => {
  assert.equal(game.length, 12); assert.equal(simplified.length, 12); assert.equal(advanced.length, 12);
  assert.equal(V3_TABS.length, 12);
  V3_TABS.forEach((t, i) => assert.equal(t.key, `F${i + 1}`));
});

test('Game Mode: the tab names and the numbered presets are the spec\'s, in order', () => {
  game.forEach((g, i) => {
    const t = V3_TABS[i]!;
    assert.equal(letters(t.game.name), letters(g.words), `${g.key} name`);
    const presets = numbered(g.body.slice(g.body.indexOf('Presets:'))).map((x) => (x.includes(' (') ? x.slice(0, x.indexOf(' (')) : x));
    assert.deepEqual(ours(t.game.presets.map((q) => q.name)), presets, `${g.key} presets`);
  });
});

test('Simplified Mode: tab names, titles, sub-tools, sliders and presets are the spec\'s, in order', () => {
  simplified.forEach((s, i) => {
    const t = V3_TABS[i]!;
    assert.equal(letters(t.simplified.name), letters(s.words), `${s.key} name`);
    assert.equal(t.simplified.title, /Name: "(.*)"/.exec(s.body)![1], `${s.key} title`);
    const subs = [...s.body.matchAll(/\n\s+\d+: "(.*)"\n\s+Sliders: (.*)\n\s+Presets: (.*)/g)];
    const mine = t.simplified.subtools.filter((x) => !ADDED.has(x.name));
    assert.deepEqual(mine.map((x) => x.name), subs.map((r) => r[1]), `${s.key} sub-tools`);
    subs.forEach((r, j) => {
      const st = mine[j]!;
      assert.deepEqual(st.sliders.map((x) => x.name), list(r[2]).map((x) => x.slice(0, x.indexOf(':'))), `${s.key} ${st.name} sliders`);
      assert.deepEqual(ours(st.presets.map((q) => q.name)), list(r[3]), `${s.key} ${st.name} presets`);
    });
  });
});

test('Advanced Mode: tools, presets, filters and modifiers are the spec\'s, in order (V3.1 keys where the browser or walking needs them)', () => {
  advanced.forEach((a, i) => {
    const t = V3_TABS[i]!;
    assert.equal(letters(t.advanced.name), letters(a.words), `${a.key} name`);
    const line = (k: string): string | undefined => a.body.split('\n').find((l) => l.trim().startsWith(`${k}:`));
    assert.deepEqual(ours(t.advanced.tools.map((q) => q.name)), list(line('Tools')), `${a.key} tools`);
    assert.deepEqual(t.advanced.filters.map((x) => x.name), list(line('Filters')), `${a.key} filters`);
    assert.deepEqual(t.advanced.modifiers.map((x) => `${x.keys} ${x.does}`), list(line('Modifiers')).map((x) => CHANGED_KEYS[x] ?? x), `${a.key} modifiers`);
    if (a.body.includes('Presets:')) assert.deepEqual((t.advanced.presets ?? []).map((q) => q.name), numbered(a.body.slice(a.body.indexOf('Presets:'))), `${a.key} presets`);
    else assert.equal(t.advanced.presets, undefined);
  });
});

const every = (): V3Button[] => V3_TABS.flatMap((t) => [...t.game.presets, ...t.simplified.subtools.flatMap((s) => s.presets), ...t.advanced.tools, ...(t.advanced.presets ?? [])]);

test('every button that is not coming binds to something the island has, with palette picks it knows', () => {
  const known: Record<string, readonly string[]> = {
    physics: PHYS_WAYS.map((w) => w.id), characters: CHAR_WAYS.map((w) => w.id), effects: EFFECT_WAYS.map((w) => w.id), sound: SOUND_WAYS.map((w) => w.id),
    logic: [...LOGIC_WAYS.map((w) => w.id), 'logic-graph'],
    lights: ['light-look', 'light-sun', 'light-lamp'], camera: ['cam-photo', 'cam-orbit', 'cam-slowmo', 'studio'],
    animate: ['anim-path', 'idle', 'walk', 'run', 'jump', 'cheer', 'dance'],
  };
  // the ways the island adds for V3 (island.tsx, useV3Way)
  const added = new Set(['v3-hierarchy', 'v3-clay-plump', 'v3-clay-scoop', 'v3-funny', 'v3-roar', 'v3-doorbell', 'v3-noon', 'v3-night', 'v3-cord', 'v3-cutter']);
  for (const q of every()) {
    const { tab, way, palette, todo } = q.bind;
    if (todo) continue;
    const ok = added.has(way) || (['select', 'paint', 'sculpt', 'things'].includes(tab) ? !!toolById(way) && toolById(way)!.tab === tab : (known[tab] ?? []).includes(way));
    assert.ok(ok, `${q.name}: ${tab}/${way}`);
    if (palette?.things) assert.ok(THINGS.some((x) => x.id === palette.things), `${q.name}: thing ${palette.things}`);
    if (palette?.paint) assert.ok(PAINTS.some((x) => String(x.id) === palette.paint), `${q.name}: paint ${palette.paint}`);
    if (palette?.road) assert.ok(PAINTS.some((x) => String(x.id) === palette.road), `${q.name}: road ${palette.road}`);
    if (palette?.physics) assert.ok(PHYS_ITEMS.some((x) => x.id === palette.physics), `${q.name}: material ${palette.physics}`);
    if (palette?.characters) assert.ok(CHAR_BRAINS.some((x) => x.id === palette.characters), `${q.name}: brain ${palette.characters}`);
    if (palette?.wire) assert.ok(WIRE_DOS.some((x) => x.id === palette.wire), `${q.name}: wire ${palette.wire}`);
    if (palette?.effects) assert.ok(palette.effects in EFFECT_ICONS, `${q.name}: effect ${palette.effects}`);
    if (palette?.sound) assert.ok(palette.sound in AMBIENCE_ICONS || (SFX_IDS as readonly string[]).includes(palette.sound), `${q.name}: sound ${palette.sound}`);
  }
});

test('ids are unique within each tab, so a remembered pick finds its button again', () => {
  for (const t of V3_TABS) {
    for (const ids of [t.game.presets.map((q) => q.id), t.simplified.subtools.map((s) => s.id), t.advanced.tools.map((q) => q.id), ...t.simplified.subtools.map((s) => s.presets.map((q) => q.id))]) {
      assert.equal(new Set(ids).size, ids.length, `${t.key}: ${ids.join(', ')}`);
    }
  }
});

test('modes map onto the internal levels and the backtick goes round them', () => {
  assert.deepEqual(V3_MODES.map((x) => x.name), ['Game', 'Simplified', 'Advanced']);
  for (const x of V3_MODES) assert.equal(modeOfLevel(levelOfMode(x.id)), x.id);
  assert.equal(nextMode('game'), 'simplified'); assert.equal(nextMode('simplified'), 'advanced'); assert.equal(nextMode('advanced'), 'game');
  assert.equal(modeOfLevel('nonsense'), 'game');
});

test('F keys open tabs; Shift+F1 and Shift+F2 open F11 and F12', () => {
  assert.equal(v3TabForKey('F1'), 0); assert.equal(v3TabForKey('F12'), 11); assert.equal(v3TabForKey('F13'), null); assert.equal(v3TabForKey('a'), null);
  assert.equal(v3TabForKey('F1', true), 10); assert.equal(v3TabForKey('F2', true), 11); assert.equal(v3TabForKey('F3', true), 2);
  assert.equal(v3TabName(V3_TABS[2]!, 'game'), 'Blocks and Clay'); assert.equal(v3TabName(V3_TABS[2]!, 'simplified'), 'Shapes and Sculpt'); assert.equal(v3TabName(V3_TABS[2]!, 'advanced'), 'Geometry');
});

test('slots and the button in hand follow the mode\'s layout', () => {
  const f3 = V3_TABS[2]!;
  assert.equal(v3Slots(f3, 'game').length, 8);
  assert.deepEqual(v3Slots(f3, 'simplified').map((s) => s.name), ['Add Building Block', 'Clay Modeling', 'Cut & Carve (Booleans)', 'Place Props']);
  assert.equal(v3Button(f3, 'simplified', 0, 3)?.name, 'Wedge');
  assert.equal(v3Button(f3, 'simplified', 0, 99)?.name, 'Cube');
  assert.equal(v3Button(f3, 'advanced', 1, -1)?.name, 'ZBrush Clay Sculpt');
  assert.equal(v3Button(f3, 'advanced', 1, 2)?.name, 'Texture Heightmap Sculpt (16-bit Float Displacement)');
  assert.equal(v3Button(f3, 'game', 42), null);
  assert.ok(v3Slots(V3_TABS[11]!, 'simplified')[1]!.todo, 'Screen Mood Filter has nothing built yet');
});

test('Find a tool finds buttons by the start of their words, in every mode', () => {
  assert.ok(v3Matches('Clay Plump', 'cl pl')); assert.ok(!v3Matches('Clay Plump', 'lump')); assert.ok(!v3Matches('Anything', ''));
  const g = v3Find('game').filter((x) => v3Matches(x.name, 'clay'));
  assert.deepEqual(g.map((x) => x.name), ['Clay Plump', 'Clay Scoop', 'Clay Flatten']);
  const s = v3Find('simplified').find((x) => x.name === 'Wedge');
  assert.deepEqual(s && [s.tab, s.slot, s.preset], [2, 0, 3]);
  const a = v3Find('advanced').find((x) => x.name.startsWith('Quad-Remesh'));
  assert.deepEqual(a && [a.tab, a.preset, a.todo], [2, 6, true]);
});
