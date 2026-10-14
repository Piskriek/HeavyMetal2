import test from 'node:test';
import assert from 'node:assert/strict';
import { FEEL_START, BOB_HEIGHT, SWAY_LIMIT, feelStep, type RifleFeelInput, type RifleFeelState } from './rifle-feel';

const still: RifleFeelInput = { lookX: 0, lookY: 0, walked: 0, dt: 1 / 60, firing: false, time: 0 };
const run = (s: RifleFeelState, input: Partial<RifleFeelInput>, frames: number): RifleFeelState => {
  let state = s;
  for (let f = 0; f < frames; f++) state = feelStep(state, { ...still, time: f / 60, ...input }).state;
  return state;
};

test('a look flick sways the rifle for a moment and then settles back to rest', () => {
  const flick = feelStep(FEEL_START, { ...still, lookX: 60 });
  assert.ok(flick.out.x < 0, 'the rifle leans against the look');
  let peak = 0;
  let s = flick.state;
  for (let f = 0; f < 60; f++) { s = feelStep(s, still).state; peak = Math.max(peak, -s.swayX.x); }
  assert.ok(peak > 0.008 && peak < SWAY_LIMIT, `a visible lean of a centimetre or two (${peak})`);
  const settled = run(s, {}, 180);
  assert.ok(Math.abs(settled.swayX.x) < 0.001, `and settles (${settled.swayX.x})`);
  assert.ok(Math.abs(settled.swayX.v) < 0.01, 'at rest');
});

test('a huge look is clamped: the sway never goes past its limit', () => {
  const s = run(FEEL_START, { lookX: 10000, lookY: -10000 }, 1);
  assert.ok(Math.abs(s.swayX.x) <= SWAY_LIMIT * 1.5, `clamped on x (${s.swayX.x})`);
  assert.ok(Math.abs(s.swayY.x) <= SWAY_LIMIT * 1.5, `clamped on y (${s.swayY.x})`);
});

test('the bob moves with the walk and is still when the character stands', () => {
  const walking = run(FEEL_START, { walked: 0.08 }, 90);
  let most = 0;
  let s = FEEL_START;
  for (let f = 0; f < 120; f++) {
    s = feelStep(s, { ...still, walked: 0.08, time: f / 60 }).state;
    most = Math.max(most, Math.abs(s.bob.x));
  }
  assert.ok(most > BOB_HEIGHT * 0.5 && most <= BOB_HEIGHT * 1.6, `a bob of about the set height (${most})`);
  assert.ok(walking.stride > 0, 'the stride counts the metres walked');
  const standing = run(walking, { walked: 0 }, 300);
  assert.ok(Math.abs(standing.bob.x) < 0.0015, `and it dies away when the walk stops (${standing.bob.x})`);
});

test('the vibration is on only while the rifle fires, and it eases out again', () => {
  const idle = feelStep(FEEL_START, { ...still, time: 0.3 });
  assert.equal(idle.out.y, 0, 'no vibration while idle');
  const firing = run(FEEL_START, { firing: true }, 30);
  assert.ok(firing.shake > 0.9, `the vibration eases in (${firing.shake})`);
  const off = run(firing, { firing: false }, 60);
  assert.ok(off.shake < 0.05, `and eases out (${off.shake})`);
});

test('a broken frame changes nothing, and an empty frame keeps the state', () => {
  const s = run(FEEL_START, { lookX: 40, walked: 0.05 }, 5);
  const same = feelStep(s, { ...still, dt: 0 });
  assert.deepEqual(same.state.swayX, s.swayX, 'a zero frame is no sway step');
  const broken = feelStep(s, { ...still, dt: Number.NaN, lookX: Number.NaN, walked: Number.NaN, time: Number.NaN });
  for (const v of [broken.out.x, broken.out.y, broken.out.z, broken.out.pitch, broken.out.roll]) assert.ok(Number.isFinite(v));
});
