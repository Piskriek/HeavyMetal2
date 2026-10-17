// The lab's power-on sequence, the dark wake and the wake camera (lab-power.ts): the cold state, the strip banks in order, the coils'
// 3.5 s bottom-to-top ignition, the arc flash, POWER_ON at the end, the strobe and its sweep, and the 2.2 s wake.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANK_START, BANK_SECONDS, coilLevels, coilsLitAt, IGNITION, IGNITION_SECONDS, POWER_OFF, POWER_ON, POWER_SECONDS, SWEEP_Z, WAKE_PITCH, WAKE_SECONDS, darkStrobe, powerAt,
  strobeSweepZ, wakeLift,
} from './lab-power';

/** The first time (seconds) at which `level(t)` rises above `eps`, sampled every 1 ms from 0 to the end of the sequence. */
function firstAbove(level: (t: number) => number, eps = 0.001): number {
  for (let t = 0; t <= POWER_SECONDS; t += 0.001) if (level(t) > eps) return t;
  return Infinity;
}

test('the cold state: the lab is dark before the lever (ambient and strips off, emergency lamps and static up)', () => {
  const p = powerAt(0);
  assert.equal(p.main, 0);
  assert.deepEqual([...p.banks], [0, 0, 0]);
  assert.equal(p.relays, 0);
  assert.equal(p.beacons, 0);
  assert.equal(p.coils, 0);
  assert.equal(p.hologram, 0);
  assert.equal(p.arc, 0);
  assert.equal(p.emergency, 1);
  assert.equal(p.static, 1);
  assert.deepEqual(powerAt(0), POWER_OFF);
});

test('the sequence ends in POWER_ON: from the last tick on, every level is full and the static and the arc are gone', () => {
  assert.deepEqual(powerAt(POWER_SECONDS), POWER_ON);
  assert.deepEqual(powerAt(POWER_SECONDS + 4), POWER_ON);
  const late = powerAt(POWER_SECONDS - 0.01);
  assert.equal(late.static, 0);
  assert.equal(late.arc, 0);
  assert.equal(late.emergency, 0);
  assert.equal(late.relays, 1);
  assert.equal(late.hologram, 1);
});

test('the three strip banks ignite back to front, 1.8 s in all', () => {
  const first = [0, 1, 2].map((i) => firstAbove((t) => powerAt(t).banks[i]!));
  assert.ok(first[0]! < first[1]! && first[1]! < first[2]!, `order ${first.join(', ')}`);
  for (let i = 0; i < 3; i++) assert.equal(BANK_START[i], [0.9, 1.5, 2.1][i]);
  assert.ok(Math.abs(BANK_START[2]! + BANK_SECONDS - BANK_START[0]! - 1.8) < 1e-9);
  // each bank is lit (not dipped to nothing) once it has ignited, before the gate draws
  const at = powerAt(2.6);
  assert.ok(at.banks[0]! > 0.9 && at.banks[1]! > 0.5 && at.banks[2]! > 0.1, `banks at 2.6 s: ${at.banks.join(', ')}`);
});

test('the main level is the mean of the three banks', () => {
  for (const t of [0.5, 1.0, 1.6, 2.2, 2.8, 4.0, 5.2, 6.0]) {
    const p = powerAt(t);
    assert.ok(Math.abs(p.main - (p.banks[0] + p.banks[1] + p.banks[2]) / 3) < 1e-12, `at ${t}`);
  }
});

test('the gate ignites over 3.5 s, bottom to top: each coil lights after the one below it', () => {
  assert.equal(IGNITION.end - IGNITION.start, 3.5);
  const n = 8;
  // a coil i is lit when the sweep has passed its height: coils * n > i (the play scene's rule)
  const lit = (t: number, i: number): boolean => powerAt(t).coils * n > i;
  const firsts = Array.from({ length: n }, (_, i) => {
    for (let t = IGNITION.start; t <= IGNITION.end + 0.01; t += 0.001) if (lit(t, i)) return t;
    return Infinity;
  });
  for (let i = 1; i < n; i++) assert.ok(firsts[i]! >= firsts[i - 1]!, `coil ${i} lights at ${firsts[i]} before coil ${i - 1} at ${firsts[i - 1]}`);
  assert.ok(firsts[0]! >= IGNITION.start && firsts[n - 1]! <= IGNITION.end + 0.01, `span ${firsts[0]} to ${firsts[n - 1]}`);
  assert.equal(powerAt(IGNITION.end).coils, 1);
});

test('the coils never light out of order at any moment of the ignition (the sweep only rises)', () => {
  let last = -1;
  for (let t = 0; t <= POWER_SECONDS; t += 0.01) {
    const c = powerAt(t).coils;
    assert.ok(c >= last - 1e-12, `coils fell at ${t}`);
    last = c;
  }
});

test('the amber arc flash follows the ignition, and reveals the Moon as the static resolves', () => {
  assert.equal(powerAt(IGNITION.end - 0.05).arc, 0);
  assert.ok(powerAt(IGNITION.end + 0.1).arc > 0.9, 'the flash is full at the top of the coils');
  assert.equal(powerAt(IGNITION.end + 0.8).arc, 0);
  assert.equal(powerAt(IGNITION.end + 0.2).static, 0);
  assert.equal(powerAt(IGNITION.end - 0.5).static > 0, true);
});

test('the planet table hologram comes up after the banks, and the emergency lamps go out before the gate', () => {
  assert.equal(powerAt(2.6).hologram, 0);
  assert.ok(powerAt(3.5).hologram === 1 && powerAt(3.0).hologram > 0 && powerAt(3.0).hologram < 1);
  assert.equal(powerAt(2.2).emergency, 0);
  assert.ok(powerAt(1.5).emergency > 0 && powerAt(1.5).emergency < 1);
});

test('the dark strobe is a 1.2 Hz pulse in 0..1: it repeats every 1/1.2 s and peaks once per cycle', () => {
  const period = 1 / 1.2;
  for (const t of [0, 0.13, 0.4, 0.77, 1.9]) {
    assert.ok(Math.abs(darkStrobe(t) - darkStrobe(t + period)) < 1e-9, `period at ${t}`);
    assert.ok(darkStrobe(t) >= 0 && darkStrobe(t) <= 1);
  }
  let peak = 0;
  for (let t = 0; t < period; t += 0.001) peak = Math.max(peak, darkStrobe(t));
  assert.ok(peak > 0.999, `peak ${peak}`);
});

test('the strobe sweeps the power wall between its two ends and back', () => {
  const [a, b] = SWEEP_Z;
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t <= 5; t += 0.01) {
    const z = strobeSweepZ(t);
    lo = Math.min(lo, z);
    hi = Math.max(hi, z);
    assert.ok(z >= a - 1e-9 && z <= b + 1e-9, `z ${z} out of the wall at ${t}`);
  }
  assert.ok(Math.abs(lo - a) < 0.01 && Math.abs(hi - b) < 0.01, `swept ${lo} to ${hi}`);
});

test('the wake camera starts 65 degrees up, eases to level over 2.2 s, and stays level', () => {
  assert.ok(Math.abs(WAKE_PITCH - (65 * Math.PI) / 180) < 1e-12);
  assert.equal(wakeLift(0), WAKE_PITCH);
  assert.equal(wakeLift(WAKE_SECONDS), 0);
  assert.equal(wakeLift(WAKE_SECONDS + 3), 0);
  let last = Infinity;
  for (let t = 0; t <= WAKE_SECONDS + 0.5; t += 0.01) {
    const v = wakeLift(t);
    assert.ok(v <= last + 1e-12, `the lift rose at ${t}`);
    last = v;
  }
  // an ease-out: most of the turn is done early (half way through the time, the lift is an eighth of the start)
  assert.ok(Math.abs(wakeLift(WAKE_SECONDS / 2) - WAKE_PITCH / 8) < 1e-9);
});

test('the coil helpers: the gate ignition spans exactly 3.5 s (t = 2.0 to 5.5 s), and the coils light strictly bottom to top', () => {
  assert.equal(IGNITION.start, 2.0);
  assert.equal(IGNITION.end, 5.5);
  assert.equal(IGNITION_SECONDS, 3.5);
  assert.equal(powerAt(2.0).coils, 0);
  assert.deepEqual(coilsLitAt(2.0, 6), [false, false, false, false, false, false]);
  let prevLit = 0;
  for (let t = 2.0; t <= 5.5; t += 0.25) {
    const lit = coilsLitAt(t, 6);
    assert.ok(lit.filter(Boolean).length >= prevLit, `monotonic ignition at t=${t}`);
    prevLit = lit.filter(Boolean).length;
    for (let i = 1; i < lit.length; i++) if (lit[i]) assert.equal(lit[i - 1], true, `coil ${i} lit before coil ${i - 1} at t=${t}`);
  }
  assert.equal(powerAt(5.5).coils, 1);
  assert.deepEqual(coilLevels(1, 6), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(coilsLitAt(5.5, 6), [true, true, true, true, true, true]);
});

test('the gate draws power during the ignition: the ceiling strip banks dip, and recover by POWER_SECONDS', () => {
  const beforeDip = powerAt(2.65);
  const duringDraw = powerAt(4.0);
  assert.ok(duringDraw.main < beforeDip.main, 'the ceiling lights dip while the gate coils draw power');
  assert.equal(powerAt(POWER_SECONDS).main, 1);
  assert.equal(powerAt(POWER_SECONDS).emergency, 0);
  assert.equal(powerAt(POWER_SECONDS).static, 0);
  assert.equal(wakeLift(WAKE_SECONDS), 0);
});
