import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptiveQuality, guessQuality, parseQuality } from '../src/quality';

test('first guess: strong desktops ultra, desktops high, weak phones low, strong phones high', () => {
  assert.equal(guessQuality({ touch: false, cores: 16, dpr: 1, width: 1920 }), 'ultra');
  assert.equal(guessQuality({ touch: false, cores: 4, dpr: 1, width: 1920 }), 'high');
  assert.equal(guessQuality({ touch: false, cores: 2, dpr: 1, width: 1280 }), 'medium');
  assert.equal(guessQuality({ touch: true, cores: 4, dpr: 3, width: 390 }), 'low');
  assert.equal(guessQuality({ touch: true, cores: 8, dpr: 3, width: 390 }), 'medium');
  assert.equal(guessQuality({ touch: true, cores: 8, dpr: 2, width: 820 }), 'high');
});

test('parseQuality accepts only the four tiers', () => {
  assert.equal(parseQuality('medium'), 'medium');
  assert.equal(parseQuality('ultra'), 'ultra');
  assert.equal(parseQuality('extreme'), null);
  assert.equal(parseQuality(undefined), null);
});

test('slow frames drop one tier at a time after the warmup; fast frames never change it', () => {
  const q = createAdaptiveQuality('high', { window: 10, warmup: 5 });
  const feed = (n: number, ms: number): (string | null)[] => Array.from({ length: n }, () => q.frame(ms));
  assert.deepEqual(feed(40, 12).filter(Boolean), []);
  const dropped = feed(30, 40).filter(Boolean);
  assert.equal(dropped[0], 'medium');
  assert.equal(q.current === 'medium' || q.current === 'low', true);
  feed(200, 40);
  assert.equal(q.current, 'low');
  assert.deepEqual(feed(50, 40).filter(Boolean), []);
});

test('the warmup frames and absurd frame times are ignored; a locked tier never moves', () => {
  const q = createAdaptiveQuality('high', { window: 5, warmup: 20 });
  for (let i = 0; i < 20; i++) assert.equal(q.frame(200), null);
  assert.equal(q.frame(5000), null);
  assert.equal(q.frame(NaN), null);
  const locked = createAdaptiveQuality('high', { window: 5, warmup: 0, locked: true });
  for (let i = 0; i < 50; i++) assert.equal(locked.frame(100), null);
  assert.equal(locked.current, 'high');
});
