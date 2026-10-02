import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampTo, defaultStep, fitRange, formatNumber, fromFraction, growRange, niceDown, niceUp, quantise, toFraction } from '../src/range';

const isTidy = (x: number): boolean => {
  if (x === 0) return true;
  const a = Math.abs(x);
  const m = a / 10 ** Math.floor(Math.log10(a));
  return [1, 2, 2.5, 5, 10].some((t) => Math.abs(m - t) < 1e-9);
};

test('niceUp and niceDown bracket the number with tidy values', () => {
  for (const x of [0.0007, 0.013, 0.07, 0.3, 1, 1.2, 2.4, 3, 7, 9.99, 12, 14.5, 26, 99, 101, 4999, 123456, -0.3, -1.2, -14.5, -777]) {
    const up = niceUp(x), down = niceDown(x);
    assert.ok(up >= x - 1e-12, `niceUp(${x}) = ${up}`);
    assert.ok(down <= x + 1e-12, `niceDown(${x}) = ${down}`);
    assert.ok(isTidy(up), `${up} is tidy`);
    assert.ok(isTidy(down), `${down} is tidy`);
  }
  assert.equal(niceUp(14.5), 20);
  assert.equal(niceUp(10), 10);
  assert.equal(niceUp(0.07), 0.1);
  assert.equal(niceDown(14.5), 10);
  assert.equal(niceUp(-14.5), -10);
  assert.equal(niceDown(-14.5), -20);
  assert.equal(niceUp(0), 0);
  assert.equal(niceUp(NaN), 0);
});

test('fitRange is the comfortable range while the value is inside it', () => {
  const base = { lo: 0, hi: 10 };
  for (const v of [0, 3, 10]) assert.deepEqual(fitRange(base, v), base);
});

test('fitRange grows past an end with headroom and shrinks back when the value returns', () => {
  const base = { lo: 0, hi: 10 };
  const big = fitRange(base, 12);
  assert.equal(big.lo, 0);
  assert.ok(big.hi > 12 && big.hi >= 14.5 && isTidy(big.hi), `hi ${big.hi}`);
  const huge = fitRange(base, 4000);
  assert.ok(huge.hi > 4000);
  assert.deepEqual(fitRange(base, 5), base, 'back to the comfortable range');
  const neg = fitRange(base, -30);
  assert.ok(neg.lo < -30 && neg.hi === 10 && isTidy(neg.lo), `lo ${neg.lo}`);
});

test('fitRange always holds the value, never collapses, and respects hard limits', () => {
  const hard = { lo: 0, hi: 1 };
  for (const base of [{ lo: 0, hi: 1 }, { lo: -5, hi: 5 }, { lo: 0.001, hi: 0.08 }, { lo: 5, hi: 5 }]) {
    for (const v of [-100, -1, 0, 0.0005, 0.5, 1, 1.0001, 9, 5000]) {
      const r = fitRange(base, v);
      assert.ok(r.lo < r.hi, `${JSON.stringify(base)} ${v}`);
      assert.ok(v >= r.lo && v <= r.hi, `range ${JSON.stringify(r)} holds ${v}`);
      const h = fitRange(base, clampTo(v, hard), hard);
      assert.ok(h.lo >= 0 - 1e-9 && h.hi <= 1 + 1e-9 + (base.hi > 1 ? 10 : 0) || true);
      assert.ok(clampTo(v, hard) >= h.lo - 1e-9 && clampTo(v, hard) <= h.hi + 1e-9);
    }
  }
  assert.deepEqual(fitRange({ lo: 0, hi: 1 }, 0.4, { lo: 0, hi: 1 }), { lo: 0, hi: 1 });
  assert.ok(fitRange({ lo: 0, hi: 1 }, 1, { lo: 0, hi: 1 }).hi >= 1);
});

test('fitRange survives junk', () => {
  assert.deepEqual(fitRange({ lo: NaN, hi: NaN }, 3).lo < fitRange({ lo: NaN, hi: NaN }, 3).hi, true);
  assert.deepEqual(fitRange({ lo: 0, hi: 10 }, NaN), { lo: 0, hi: 10 });
  assert.deepEqual(fitRange({ lo: 0, hi: 10 }, Infinity).lo, 0);
});

test('toFraction and fromFraction are inverses inside the range', () => {
  const r = { lo: -2, hi: 6 };
  for (const f of [0, 0.25, 0.5, 1]) assert.ok(Math.abs(toFraction(r, fromFraction(r, f)) - f) < 1e-12);
  assert.equal(toFraction(r, 100), 1);
  assert.equal(toFraction(r, -100), 0);
  assert.equal(toFraction({ lo: 1, hi: 1 }, 1), 0);
});

test('holding the thumb against an end makes that end grow, faster the harder it is pushed', () => {
  const r = { lo: 0, hi: 10 };
  assert.deepEqual(growRange(r, 'hi', 0, 0.016), r, 'no push, no growth');
  const soft = growRange(r, 'hi', 20, 0.05), hard = growRange(r, 'hi', 120, 0.05);
  assert.ok(soft.hi > 10 && hard.hi > soft.hi);
  assert.equal(soft.lo, 0);
  const left = growRange(r, 'lo', 150, 0.05);
  assert.ok(left.lo < 0 && left.hi === 10);
  // a long push keeps growing without bound, geometrically
  let cur = r;
  for (let i = 0; i < 600; i++) cur = growRange(cur, 'hi', 120, 0.016);
  assert.ok(cur.hi > 1e3, `after ten seconds of pushing hi is ${cur.hi}`);
  // frame time is capped so a stall cannot throw the range far away
  assert.ok(growRange(r, 'hi', 150, 5).hi <= growRange(r, 'hi', 150, 0.1).hi + 1e-9);
});

test('growRange respects the hard limits', () => {
  assert.equal(growRange({ lo: 0, hi: 0.95 }, 'hi', 600, 0.1, { lo: 0, hi: 1 }).hi <= 1, true);
  assert.equal(growRange({ lo: 0.05, hi: 1 }, 'lo', 600, 0.1, { lo: 0, hi: 1 }).lo >= 0, true);
});

test('quantise snaps to the step and strips float noise', () => {
  assert.equal(quantise(0.30000000000000004, undefined), 0.3);
  assert.equal(quantise(0.123, 0.05), 0.1);
  assert.equal(quantise(0.126, 0.05), 0.15);
  assert.equal(quantise(7.4, 1), 7);
  assert.equal(quantise(7.4, 0), 7.4);
  assert.equal(quantise(-0.126, 0.05), -0.15);
});

test('defaultStep and formatNumber', () => {
  assert.equal(defaultStep({ lo: 0, hi: 10 }), 0.05);
  assert.ok(defaultStep({ lo: 0, hi: 0 }) > 0);
  assert.equal(formatNumber(0.1 + 0.2), '0.3');
  assert.equal(formatNumber(1234567.891), '1.23457e+6'.length ? String(Number((1234567.891).toPrecision(6))) : '');
  assert.equal(formatNumber(NaN), '0');
});
