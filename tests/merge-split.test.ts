/**
 * M01 · T1b — the player's split, and who the pool is waiting for.
 *
 * The run from the grid to the first loop is the first split of the course and it belongs to the
 * player, so two things have to hold: their split must be able to run to the end of that stretch
 * before any ready-up is offered, and the overlay must be able to say so honestly. `poolIsWaiting`
 * is that first question as a pure function; `formatSplit` is the clock they read while they set it.
 *
 * Run with: `node --import tsx --test tests/merge-split.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatSplit, poolIsWaiting, poolSnapshotIsWaiting } from '../src/game/merge/split';
import type { MergeEntryView, MergeSnapshot } from '../src/game/types';

function entry(overrides: Partial<MergeEntryView> = {}): MergeEntryView {
  return {
    id: 1, name: 'BOT', color: '#fff', isPlayer: false, position: 1, entryTime: 12.5,
    ready: false, released: false, flags: [], ...overrides,
  };
}

test('split: the pool is waiting until the player has queued', () => {
  assert.equal(poolIsWaiting([]), true, 'an empty queue has the player on approach');
  assert.equal(poolIsWaiting([entry(), entry({ id: 2, position: 2 })]), true, 'the field is in, the player is not');
  assert.equal(poolIsWaiting([entry({ isPlayer: true })]), false, 'the player has queued');
  assert.equal(poolIsWaiting([entry(), entry({ id: 0, isPlayer: true, position: 2 })]), false);

  assert.equal(poolSnapshotIsWaiting(undefined), false, 'no pool at all is not a wait');
  const snapshot = (entries: MergeEntryView[]): MergeSnapshot =>
    ({ phase: 'open', entries, countdownLabel: null, playerReady: false, holdTicks: 0 });
  assert.equal(poolSnapshotIsWaiting(snapshot([entry()])), true);
  assert.equal(poolSnapshotIsWaiting(snapshot([entry({ isPlayer: true })])), false);

  // The overlay is the thing that must not offer a READY before the player is in the queue, and the
  // screen must hand it the run clock so the split board has a number to animate.
  const overlay = readFileSync(new URL('../src/components/MergePoolOverlay.tsx', import.meta.url), 'utf-8');
  assert.match(overlay, /const waiting = poolIsWaiting\(merge\.entries\)/);
  assert.match(overlay, /merge-pool__panel--waiting/, 'the waiting panel is its own block');
  assert.equal(/merge-pool__button/.test(overlay.split('poolIsWaiting')[0].slice(-400)), false,
    'the READY button lives in the queued branch, not before it');
  const screen = readFileSync(new URL('../src/screens/RaceScreen.tsx', import.meta.url), 'utf-8');
  assert.match(screen, /raceTime=\{snapshot\.raceTime\}/, 'the screen passes the run clock');
});

test('split: the clock reads like a stopwatch', () => {
  assert.equal(formatSplit(0), '0:00.00');
  assert.equal(formatSplit(1.5), '0:01.50');
  assert.equal(formatSplit(12.345), '0:12.35');
  assert.equal(formatSplit(63.42), '1:03.42');
  assert.equal(formatSplit(600), '10:00.00');
  assert.equal(formatSplit(3599.99), '59:59.99');
  assert.equal(formatSplit(3661.5), '1:01:01.50', 'past an hour it grows, it does not wrap');

  // A run clock cannot go backwards, and a NaN is a broken frame, not a negative split.
  assert.equal(formatSplit(-5), '0:00.00');
  assert.equal(formatSplit(Number.NaN), '0:00.00');
  assert.equal(formatSplit(Number.POSITIVE_INFINITY), '0:00.00');

  // The pool's own ordering key is a sub-tick fraction, which is finer than the hundredths shown:
  // two riders a tick apart must still read differently.
  assert.notEqual(formatSplit(3000 / 120), formatSplit(3001 / 120));
});
