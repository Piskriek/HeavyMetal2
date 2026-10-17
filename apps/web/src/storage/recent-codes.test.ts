// Unit tests for the Planetary Grid's recent codes (TICKET-08a): the pure list rules. Saves go through kv (no window here).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanRecentCodes, withRecentCode, RECENT_CODES_MAX } from './recent-codes';

test('withRecentCode puts the newest code first, drops a repeat, and keeps eight', () => {
  let list: string[] = [];
  for (let i = 1; i <= 10; i++) list = withRecentCode(list, `code-${i}`);
  assert.equal(list.length, RECENT_CODES_MAX);
  assert.equal(list[0], 'code-10');
  assert.equal(list[7], 'code-3');

  const again = withRecentCode(list, 'code-5');
  assert.equal(again[0], 'code-5');
  assert.equal(again.filter((c) => c === 'code-5').length, 1);
  assert.equal(again.length, RECENT_CODES_MAX);
});

test('withRecentCode ignores a blank code and trims the rest', () => {
  assert.deepEqual(withRecentCode(['a', 'b'], '   '), ['a', 'b']);
  assert.deepEqual(withRecentCode([], '  xyz  '), ['xyz']);
});

test('cleanRecentCodes keeps only non-empty strings from a damaged save', () => {
  assert.deepEqual(cleanRecentCodes(null), []);
  assert.deepEqual(cleanRecentCodes({ 0: 'x' }), []);
  assert.deepEqual(cleanRecentCodes(['a', 3, '', '  ', 'b', null]), ['a', 'b']);
  assert.equal(cleanRecentCodes(Array.from({ length: 12 }, (_, i) => `c${i}`)).length, RECENT_CODES_MAX);
});
