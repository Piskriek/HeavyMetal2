/**
 * M01 · T5 — **the impact shake the engine has always computed, now applied to the camera.**
 *
 * The engine sets `shake` on every contact (2 for a shield hold, 4 for a nudge, up to 15 scaled by the
 * closing speed of a heavy bump) and decays it as `exp(-9t)`; it rides the frame and, until now, the 3D
 * renderer — the only renderer — read it nowhere. This suite pins the laws of the offset function, and
 * the wiring that applies it, because the shape of the motion is the thing a player feels.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SHAKE_FORWARD_SHARE, SHAKE_FREQUENCIES, SHAKE_MAX_OFFSET, SHAKE_MAX_UNITS,
  cameraShake, shakeStrength,
} from '../src/game/camera-shake';

test('the strength is the engine\'s own scale: 0 at rest, 1 at the ceiling, and it never exceeds it', () => {
  assert.equal(shakeStrength(0), 0, 'at rest');
  assert.equal(shakeStrength(-5), 0, 'a negative amount is no shake, not an inverted one');
  assert.equal(shakeStrength(SHAKE_MAX_UNITS), 1, 'the ceiling the engine clamps to');
  assert.equal(shakeStrength(SHAKE_MAX_UNITS * 10), 1, 'and it does not exceed it');
  assert.ok(Math.abs(shakeStrength(SHAKE_MAX_UNITS / 2) - 0.5) < 1e-12, 'halfway is halfway');
  for (const nonsense of [Number.NaN, Infinity, -Infinity]) {
    assert.equal(shakeStrength(nonsense), 0, `${nonsense} is no shake rather than a poisoned camera`);
  }
});

test('the travel is the impact\'s own, as a distance: constant magnitude, rotating direction', () => {
  for (let amount = 0.5; amount <= SHAKE_MAX_UNITS * 2; amount += 0.5) {
    const expected = shakeStrength(amount) * SHAKE_MAX_OFFSET;
    for (let time = 0; time < 4; time += 0.017) {
      const shake = cameraShake(amount, time, false);
      const total = Math.hypot(shake.right, shake.up, shake.forward);
      assert.ok(
        Math.abs(total - expected) < 1e-9,
        `amount ${amount} at t ${time.toFixed(3)}: travel ${total.toFixed(6)} should be ${expected.toFixed(6)}`,
      );
      assert.ok(total <= SHAKE_MAX_OFFSET + 1e-9, 'never further than the ceiling, whichever way it swings');
      assert.ok(Math.abs(shake.forward) <= total, 'the view axis cannot outrun the total');
    }
  }
  // Half the ceiling is half the travel, exactly — the strength is the damage, not a squashed curve.
  const full = cameraShake(SHAKE_MAX_UNITS, 0.37, false);
  const half = cameraShake(SHAKE_MAX_UNITS / 2, 0.37, false);
  assert.ok(Math.abs(Math.hypot(full.right, full.up, full.forward) / 2
    - Math.hypot(half.right, half.up, half.forward)) < 1e-9);
});

test('it is deterministic, and it actually moves', () => {
  const a = cameraShake(9, 1.2345, false);
  const b = cameraShake(9, 1.2345, false);
  assert.deepEqual(a, b, 'same amount and same clock: the same frame');

  // Over a second of race time the offset visits all four quadrants on the right axis, and the three
  // axes are never zero together (that is what the deliberate frequency split is for).
  const right = []; const up = []; const forward = [];
  for (let time = 0; time < 1; time += 0.005) {
    const shake = cameraShake(9, time, false);
    right.push(shake.right); up.push(shake.up); forward.push(shake.forward);
    assert.ok(Math.abs(shake.right) + Math.abs(shake.up) + Math.abs(shake.forward) > 1e-6,
      'the camera is never exactly still while the impact is live');
  }
  assert.ok(Math.max(...right) > 0.5 * SHAKE_MAX_OFFSET * 0.6 && Math.min(...right) < -0.5 * SHAKE_MAX_OFFSET * 0.6,
    'the right axis crosses the frame both ways');
  assert.ok(Math.max(...up) !== Math.min(...up), 'and so does the up axis');
  assert.ok(Math.max(...forward) - Math.min(...forward) < Math.max(...right) - Math.min(...right),
    'but the view axis moves least');
  // A full swing of the vector: the direction really rotates rather than trembling on one axis.
  const angles = new Set<number>();
  for (let time = 0; time < 1; time += 0.01) {
    const shake = cameraShake(9, time, false);
    angles.add(Math.round(Math.atan2(shake.up, shake.right) * 8));
  }
  assert.ok(angles.size > 20, `the direction visits many angles (${angles.size})`);

  // Incommensurate: the three frequencies share no small integer ratio, so the pattern does not repeat
  // within a race-length window the way a single-frequency shake would.
  const ratios = [
    SHAKE_FREQUENCIES.right / SHAKE_FREQUENCIES.up,
    SHAKE_FREQUENCIES.up / SHAKE_FREQUENCIES.forward,
  ];
  for (const ratio of ratios) {
    const nearest = Math.round(ratio);
    assert.ok(Math.abs(ratio - nearest) > 0.05, `frequency ratio ${ratio.toFixed(3)} is not a neat multiple`);
  }
});

test('reduced motion means still, at every amount and every time', () => {
  for (const amount of [0, 2, 4, 9, 15, 100]) {
    for (let time = 0; time < 3; time += 0.13) {
      const shake = cameraShake(amount, time, true);
      assert.deepEqual(shake, { right: 0, up: 0, forward: 0 }, `${amount} at ${time}`);
    }
  }
});

test('zero shake is exactly zero, and a nonsense clock cannot poison the camera', () => {
  assert.deepEqual(cameraShake(0, 12.5, false), { right: 0, up: 0, forward: 0 });
  assert.deepEqual(cameraShake(15, Number.NaN, false), { right: 0, up: 0, forward: 0 });
  assert.deepEqual(cameraShake(15, Infinity, false), { right: 0, up: 0, forward: 0 });
});

test('the wiring: the renderer applies the frame\'s shake to the placed camera', () => {
  const renderer = readFileSync(new URL('../src/game/renderer-3d.ts', import.meta.url), 'utf8');
  assert.match(renderer, /this\.applyImpactShake\(frame\.shake, frame\.time, frame\.reducedMotion\)/,
    'the shake rides the frame into the camera step');
  // Applied after both cameras are placed, so it can never move the aim.
  const order = renderer.indexOf('this.applyImpactShake(frame.shake');
  assert.ok(order > renderer.indexOf('this.placeFirstPersonCamera(frame.ball'), 'after the cockpit camera');
  assert.ok(order > renderer.indexOf('this.placeCamera(playerDist'), 'and after the chase camera');
  assert.match(renderer, /applyQuaternion\(this\.camera\.quaternion\)/,
    'along the camera\'s own axes rather than the world\'s');
  assert.match(renderer, /private readonly shakeRight = new THREE\.Vector3/,
    'with preallocated vectors: the render loop allocates nothing per frame');
});
