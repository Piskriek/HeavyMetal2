import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PROPS_SAVE, clearedProp, parsePropsSave, readLog, sealedSite, serializePropsSave } from './props-save';

test('a prop is cleared once: a second clear returns the same save, so a prop is never salvaged twice', () => {
  const a = clearedProp(EMPTY_PROPS_SAVE, 'crate-large-1');
  assert.deepEqual(a.cleared, ['crate-large-1']);
  const b = clearedProp(a, 'crate-large-1');
  assert.equal(b, a);
});

test('logs and sealed sites are recorded once and kept in order', () => {
  let s = readLog(EMPTY_PROPS_SAVE, 'LOG-03');
  s = readLog(s, 'LOG-01');
  s = readLog(s, 'LOG-03');
  assert.deepEqual(s.logs, ['LOG-03', 'LOG-01']);
  let t = sealedSite(EMPTY_PROPS_SAVE, 4);
  t = sealedSite(t, 1);
  t = sealedSite(t, 4);
  assert.deepEqual(t.sealed, [1, 4]);
});

test('a save round-trips through its text, and a bad or old save reads as the empty one', () => {
  const s = sealedSite(clearedProp(readLog(EMPTY_PROPS_SAVE, 'LOG-02'), 'locker'), 0);
  assert.deepEqual(parsePropsSave(serializePropsSave(s)), s);
  assert.equal(parsePropsSave(null), EMPTY_PROPS_SAVE);
  assert.equal(parsePropsSave('not json'), EMPTY_PROPS_SAVE);
  assert.equal(parsePropsSave(JSON.stringify({ v: 2, cleared: ['x'] })), EMPTY_PROPS_SAVE);
  // junk entries are dropped, duplicates merged
  const dirty = parsePropsSave(JSON.stringify({ v: 1, cleared: ['a', 'a', 7, ''], logs: [null], sealed: [3, 3, -1, 2.5, 'x'] }));
  assert.deepEqual(dirty, { v: 1, cleared: ['a'], logs: [], sealed: [3] });
});
