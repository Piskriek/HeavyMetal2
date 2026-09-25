/** MP-T14: deterministic transcendentals for the sim, and the checker that keeps native ones out. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datan2, dcos, dexp, dhypot, dlog, dpow, dsin } from '../src/game/sim/det-math';

test('MP-T14: det-math is within 1e-7 of the reference doubles', () => {
  for (let x = -40; x <= 40; x += 0.0137) {
    assert.ok(Math.abs(dsin(x) - Math.sin(x)) < 1e-9, `sin ${x}`);
    assert.ok(Math.abs(dcos(x) - Math.cos(x)) < 1e-9, `cos ${x}`);
    assert.ok(Math.abs(dexp(x / 8) - Math.exp(x / 8)) / Math.exp(x / 8) < 1e-12, `exp ${x}`);
  }
  for (let y = -5; y <= 5; y += 0.37) for (let x = -5; x <= 5; x += 0.41) {
    assert.ok(Math.abs(datan2(y, x) - Math.atan2(y, x)) < 1e-9, `atan2 ${y} ${x}`);
    assert.equal(dhypot(x, y), Math.sqrt(x * x + y * y));
  }
  for (let x = 0.001; x < 1000; x *= 1.37) {
    assert.ok(Math.abs(dlog(x) - Math.log(x)) < 1e-9, `log ${x}`);
    assert.ok(Math.abs(dpow(x, 0.6) - Math.pow(x, 0.6)) / Math.pow(x, 0.6) < 1e-10, `pow ${x}`);
  }
  assert.equal(dpow(0, 0.6), 0);
  assert.ok(Number.isNaN(dsin(Infinity)));
});

test('MP-T14: the sim has no engine-dependent Math calls left', async () => {
  const { findTranscendentals } = await import('../scripts/check-transcendentals.mjs');
  assert.deepEqual(findTranscendentals(), []);
});
