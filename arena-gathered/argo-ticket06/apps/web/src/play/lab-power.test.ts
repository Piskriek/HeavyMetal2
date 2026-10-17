// ============================================================================
// File: apps/web/src/play/lab-power.test.ts
// Unit tests for the 3.5 s gate coil ignition and lab power sequence (TICKET-06).
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coilLevels,
  coilsLitAt,
  IGNITION,
  IGNITION_SECONDS,
  powerAt,
  POWER_SECONDS,
  wakeLift,
  WAKE_SECONDS,
} from './lab-power';

test('gate coil ignition spans exactly 3.5 s (t = 2.0 to 5.5 s) and lights coils strictly bottom to top', () => {
  assert.equal(IGNITION.start, 2.0);
  assert.equal(IGNITION.end, 5.5);
  assert.equal(IGNITION_SECONDS, 3.5);

  // Before 2.0 s: 0 coils lit
  assert.equal(powerAt(0).coils, 0);
  assert.equal(powerAt(2.0).coils, 0);
  assert.deepEqual(coilsLitAt(2.0, 6), [false, false, false, false, false, false]);

  // Mid-ignition progression: coils ignite in strict bottom-to-top order
  let prevLitCount = 0;
  for (let t = 2.0; t <= 5.5; t += 0.25) {
    const lit = coilsLitAt(t, 6);
    const litCount = lit.filter(Boolean).length;
    assert.ok(litCount >= prevLitCount, `Expected monotonic coil ignition at t=${t}`);
    prevLitCount = litCount;

    // Verify no upper coil is lit while a lower coil is unlit
    for (let i = 1; i < lit.length; i++) {
      if (lit[i]) {
        assert.equal(lit[i - 1], true, `Coil ${i} lit before lower coil ${i - 1} at t=${t}`);
      }
    }
  }

  // At 5.5 s (after 3.5 s ignition): all 6 coils are fully lit
  assert.equal(powerAt(5.5).coils, 1);
  assert.deepEqual(coilLevels(1, 6), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(coilsLitAt(5.5, 6), [true, true, true, true, true, true]);
});

test('powerAt dips ceiling strip banks while gate draws power and recovers by POWER_SECONDS', () => {
  const beforeDip = powerAt(2.65);
  const duringDraw = powerAt(4.0);
  const fullOn = powerAt(POWER_SECONDS);

  assert.ok(duringDraw.main < beforeDip.main, 'Ceiling lights dip while the gate coils draw power');
  assert.equal(fullOn.main, 1);
  assert.equal(fullOn.emergency, 0);
  assert.equal(fullOn.static, 0);

  assert.ok(wakeLift(0) > wakeLift(1.0));
  assert.equal(wakeLift(WAKE_SECONDS), 0);
});
