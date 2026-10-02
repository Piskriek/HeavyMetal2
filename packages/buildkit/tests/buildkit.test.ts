import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PaletteWheel, describeTool, pushRecent, type PaletteCategory } from '../src';

const cats: PaletteCategory[] = [
  { id: 'surfaces', label: 'Ground', items: [{ id: 'grass', label: 'Grass' }, { id: 'sand', label: 'Sand' }, { id: 'rock', label: 'Rock' }] },
  { id: 'models', label: 'Things', items: [{ id: 'palm', label: 'Palm' }, { id: 'barrel', label: 'Barrel' }] },
];

test('the palette starts on the first item and keeps it until something is chosen', () => {
  const p = new PaletteWheel(cats);
  assert.deepEqual(p.choice, { category: 'surfaces', id: 'grass' });
  assert.equal(p.isOpen, false);
  p.wheel(1);
  assert.deepEqual(p.choice, { category: 'surfaces', id: 'grass' }, 'a closed palette ignores the wheel');
});

test('hold, turn, let go: the highlighted item becomes the choice, and the wheel wraps both ways', () => {
  const p = new PaletteWheel(cats);
  p.press();
  p.wheel(1); p.wheel(1);
  assert.deepEqual(p.current(), { category: 'surfaces', id: 'rock' });
  assert.deepEqual(p.choice, { category: 'surfaces', id: 'grass' }, 'not kept until Tab is let go');
  p.wheel(1);
  assert.deepEqual(p.current(), { category: 'surfaces', id: 'grass' }, 'wraps forward');
  p.wheel(-1);
  assert.deepEqual(p.current(), { category: 'surfaces', id: 'rock' }, 'wraps back');
  assert.deepEqual(p.release(), { category: 'surfaces', id: 'rock' });
  assert.equal(p.isOpen, false);
  assert.deepEqual(p.choice, { category: 'surfaces', id: 'rock' });
});

test('switching category keeps each category place, and Esc puts the old choice back', () => {
  const p = new PaletteWheel(cats);
  p.press(); p.wheel(1); p.switchCategory(1); p.wheel(1);
  assert.deepEqual(p.current(), { category: 'models', id: 'barrel' });
  p.switchCategory(-1);
  assert.deepEqual(p.current(), { category: 'surfaces', id: 'sand' }, 'the surfaces place was remembered');
  p.cancel();
  assert.equal(p.isOpen, false);
  assert.deepEqual(p.current(), { category: 'surfaces', id: 'grass' });
  assert.deepEqual(p.choice, { category: 'surfaces', id: 'grass' });
});

test('select jumps to an item and refuses unknown ones', () => {
  const p = new PaletteWheel(cats, { category: 'models', id: 'barrel' });
  assert.deepEqual(p.choice, { category: 'models', id: 'barrel' });
  assert.equal(p.select({ category: 'models', id: 'nope' }), false);
  assert.equal(p.select({ category: 'nope', id: 'x' }), false);
  assert.equal(p.select({ category: 'surfaces', id: 'sand' }), true);
  assert.deepEqual(p.choice, { category: 'surfaces', id: 'sand' });
});

test('the palette copes with nothing in it and with junk input', () => {
  const none = new PaletteWheel([]);
  none.press(); none.wheel(1); none.switchCategory(1);
  assert.equal(none.current(), null);
  assert.equal(none.release(), null);
  const empty = new PaletteWheel([{ id: 'a', label: 'A', items: [] }]);
  empty.press(); empty.wheel(1);
  assert.equal(empty.current(), null);
  const p = new PaletteWheel(cats);
  p.press(); p.wheel(NaN); p.wheel(0);
  assert.deepEqual(p.current(), { category: 'surfaces', id: 'grass' });
  p.press();
  p.release(); p.release();
  assert.equal(p.isOpen, false);
});

test('describeTool tidies the words and flags tools that are not built in yet', () => {
  const live = describeTool({ setLabel: 'Sculpt ', subName: ' Draw', doc: 'Pull  the ground up.', primary: 'Raise', secondary: 'Lower', wired: true });
  assert.equal(live.title, 'Sculpt: Draw');
  assert.equal(live.line, 'Pull the ground up.');
  assert.equal(live.left, 'Raise');
  assert.equal(live.right, 'Lower');
  assert.equal(live.note, null);
  const soon = describeTool({ setLabel: 'Camera', subName: 'Lens', doc: 'x', primary: '', secondary: '', wired: false });
  assert.equal(soon.left, 'Use');
  assert.equal(soon.right, 'Nothing yet');
  assert.ok(soon.note && soon.note.length > 10);
});

test('pushRecent keeps newest first, no repeats, and a limit', () => {
  assert.deepEqual(pushRecent([], 'a'), ['a']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'd', 3), ['d', 'a', 'b']);
  assert.deepEqual(pushRecent(['a'], 'b', 0), ['b'], 'at least one');
});
