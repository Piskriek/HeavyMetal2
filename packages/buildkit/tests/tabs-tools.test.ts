import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAINTS, SLOTS, TABS, TAB_IDS, THINGS, TOOLS, TOOL_VARIANTS, assignSlot, normalizeHotbars, normalizeTool, stepSlot, tabForKey, toolById, toolEdit, toolParams, toolVariables, toolsFor, variantNow, variantsOf, type Hotbars } from '../src';

const empty = (): Hotbars => Object.fromEntries(TAB_IDS.map((t) => [t, []])) as unknown as Hotbars;

test('F1 to F10 open the tabs in the order of the hotbar spec V3, the backtick still opens Logic; P opens the avatar; F11 and F12 stay with the browser', () => {
  assert.deepEqual(TABS.map((t) => t.id), ['select', 'paint', 'things', 'animate', 'sound', 'lights', 'logic', 'camera', 'characters', 'sculpt', 'effects', 'avatar']);
  assert.equal(tabForKey('F9'), 'characters');
  assert.equal(tabForKey('F12'), 'effects'); assert.equal(tabForKey('F2', true), 'effects'); assert.equal(tabForKey('F3', true), 'things');
  assert.equal(tabForKey('F7'), 'logic'); assert.equal(tabForKey('F10'), 'sculpt');
  assert.equal(tabForKey('`'), 'logic');
  for (let i = 1; i <= 10; i++) assert.equal(tabForKey(`F${i}`), TABS.find((t) => t.key === `F${i}`)!.id);
  assert.equal(tabForKey('p'), 'avatar');
  assert.equal(tabForKey('P'), 'avatar');
  assert.equal(tabForKey('F11'), null);
  assert.equal(tabForKey('x'), null);
  assert.equal(tabForKey(''), null);
});

test('hotbars come back in shape: every tab, nine slots, unknown ids dropped, missing tabs from the defaults', () => {
  const defaults = empty();
  defaults.paint = ['paint-4', 'paint-2'];
  const valid = (_tab: string, id: string): boolean => id.startsWith('paint-') || id === 'raise';
  const h = normalizeHotbars({ paint: ['paint-5', 'nonsense', 7], sculpt: ['raise'] }, defaults, valid);
  for (const t of TAB_IDS) assert.equal(h[t].length, SLOTS);
  assert.deepEqual(h.paint.slice(0, 3), ['paint-5', null, null]);
  assert.equal(h.sculpt[0], 'raise');
  assert.deepEqual(normalizeHotbars('junk', defaults, valid).paint.slice(0, 2), ['paint-4', 'paint-2']);
});

test('assigning a slot swaps with the slot that already held the preset', () => {
  let h = normalizeHotbars(null, { ...empty(), paint: ['a', 'b', 'c'] }, () => true);
  h = assignSlot(h, 'paint', 0, 'c');
  assert.deepEqual(h.paint.slice(0, 3), ['c', 'b', 'a']);
  h = assignSlot(h, 'paint', 5, 'z');
  assert.equal(h.paint[5], 'z');
  assert.equal(assignSlot(h, 'paint', 9, 'q'), h, 'out of range is ignored');
  assert.equal(stepSlot(8, 1), 0);
  assert.equal(stepSlot(0, -1), 8);
});

test('the tool library: unique ids, every tab of tools filled, Paint holds the ways to paint (the surfaces are the palette), every thing has a tool', () => {
  assert.equal(new Set(TOOLS.map((t) => t.id)).size, TOOLS.length);
  for (const tab of ['select', 'paint', 'sculpt', 'things'] as const) assert.ok(toolsFor(tab).length >= 8, tab);
  for (const w of ['brush', 'spray', 'fill', 'gradient', 'stamp', 'pattern', 'clone', 'smudge', 'eraser']) {
    const t = toolById(`paint-${w}`);
    assert.ok(t && t.way === w && t.surface === 0, `paint-${w} is a way to paint, its surface comes from the palette`);
    assert.ok(variantsOf(t!.id, 'pro').length >= 2 && variantsOf(t!.id, 'easy').length >= 1, `paint-${w} has presets, the best ones in Easy`);
  }
  assert.ok(PAINTS.length >= 20, 'the palette has the surfaces');
  for (const m of THINGS) assert.ok(TOOLS.some((t) => t.action === 'place' && t.model === m.id), m.name);
  for (const t of TOOLS) { assert.ok(t.left && t.right && t.doc, t.id); }
});

test('a tool with the player changes on top is legal; junk falls back; tools only take what fits them', () => {
  assert.equal(normalizeTool('nope', {}), null);
  const raise = normalizeTool('raise', { size: 9, strength: 99, falloff: 'odd', surface: 4, model: 'palm', name: '  Big lift  ' })!;
  assert.equal(raise.size, 9);
  assert.equal(raise.strength, 10);
  assert.equal(raise.falloff, 'smooth');
  assert.equal(raise.surface, 0, 'a sculpt tool does not paint');
  assert.equal(raise.model, '');
  assert.equal(raise.name, 'Big lift');
  assert.equal(normalizeTool('paint-stamp', { shape: 'star' })!.shape, 'star');
  assert.equal(normalizeTool('paint-stamp', { shape: 'blobby' })!.shape, 'blob', 'junk shapes fall back');
  assert.equal(normalizeTool('paint-pattern', { pattern: 'dots' })!.pattern, 'dots');
  assert.equal(normalizeTool('paint-brush', { shape: 'star' })!.shape, undefined, 'a brush has no shape');
});

test('a tool is set to one of its presets by taking its values; Easy shows the best ones', () => {
  const stamp = normalizeTool('paint-stamp', {})!;
  assert.equal(variantNow(stamp)?.id, 'blob');
  const star = TOOL_VARIANTS['paint-stamp']!.find((v) => v.id === 'star')!;
  assert.equal(variantNow(normalizeTool('paint-stamp', star.patch)!)?.id, 'star');
  assert.ok(variantsOf('paint-brush', 'easy').every((v) => v.best));
  assert.ok(variantsOf('paint-brush', 'pro').length > variantsOf('paint-brush', 'easy').length);
  assert.deepEqual(variantsOf('dig', 'pro'), [], 'tools without presets show none');
});

test('a tool shows only the variables that matter to it, and edits come back as ids', () => {
  const sounds = ['place', 'select'];
  const keys = (id: string): string[] => toolVariables(normalizeTool(id, {})!, sounds).map((v) => v.key);
  assert.ok(keys('raise').includes('strength') && !keys('raise').includes('surface'));
  assert.ok(keys('paint-brush').includes('size') && !keys('paint-brush').includes('surface'), 'a way to paint takes its surface from the palette');
  assert.ok(keys('place-palm').includes('model') && !keys('place-palm').includes('falloff'));
  assert.ok(!keys('delete').includes('size'));
  assert.equal(toolParams(normalizeTool('place-palm', {})!).model, 'Palm');
  assert.deepEqual(toolEdit('surface', 'Sand'), ['surface', 2]);
  assert.deepEqual(toolEdit('model', 'Rock'), ['model', 'rock']);
  assert.deepEqual(toolEdit('size', 3), ['size', 3]);
  for (const t of TOOLS) for (const v of toolVariables(t, sounds)) if (v.type === 'enum') assert.ok(v.options?.includes(String(v.default)), `${t.id}.${v.key}`);
});
