import test from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_EDGE_HEX, PRINT_SETTLE_M, PRINT_SWEEP_S, printFrame, printSettleM, printSweepClip } from '../src/index';

const near = (a: number, b: number, e = 1e-9): void => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('the sweep runs 0.65 s from the base to the top, linearly and monotonically', () => {
  assert.equal(PRINT_SWEEP_S, 0.65);
  near(printSweepClip(0), 0);
  near(printSweepClip(PRINT_SWEEP_S / 2), 0.5);
  near(printSweepClip(PRINT_SWEEP_S), 1);
  near(printSweepClip(3), 1);
  near(printSweepClip(-1), 0);
  let prev = -1;
  for (let i = 0; i <= 65; i++) {
    const c = printSweepClip(i / 100);
    assert.ok(c >= prev, `clip falls at ${i}`);
    prev = c;
  }
});

test('the leading edge is the bright #7cff4d', () => {
  assert.equal(PRINT_EDGE_HEX, '#7cff4d');
});

test('during the sweep the piece holds 4 cm above its footprint, so the spring never jumps', () => {
  assert.equal(PRINT_SETTLE_M, 0.04);
  for (const t of [0, 0.1, 0.4, 0.64]) {
    const f = printFrame(t);
    near(f.offsetM, 0.04);
    assert.equal(f.settled, false);
  }
  const at = printFrame(PRINT_SWEEP_S);
  near(at.clip, 1);
  near(at.offsetM, 0.04, 1e-9);
});

test('the settle starts at rest, overshoots by a few millimetres, and is inside 0.5 mm by about 0.3 s', () => {
  near(printSettleM(0), 0.04);
  // starts with zero speed: the first few milliseconds barely move
  assert.ok(Math.abs(printSettleM(0.001) - 0.04) < 1e-4, 'under a tenth of a millimetre in the first millisecond');
  let lowest = 1;
  for (let i = 0; i <= 200; i++) lowest = Math.min(lowest, printSettleM(i / 1000));
  assert.ok(lowest < 0 && lowest > -0.01, `overshoot ${lowest}`);
  assert.equal(printFrame(PRINT_SWEEP_S + 0.6).settled, true);
  assert.equal(printFrame(PRINT_SWEEP_S + 0.2).settled, false);
  const restAt = (() => { for (let i = 0; i <= 1000; i++) if (printFrame(PRINT_SWEEP_S + i / 1000).settled) return i / 1000; return Infinity; })();
  assert.ok(restAt > 0.25 && restAt < 0.4, `rest at ${restAt}`);
});

test('bad times are clamped, not thrown', () => {
  assert.equal(printFrame(Number.NaN).clip, 0);
  near(printFrame(-5).clip, 0);
  near(printFrame(99).offsetM, printSettleM(99 - PRINT_SWEEP_S));
});
