import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCOMOTION_PRESETS,
  createVerticalJumpState,
  evaluateKitMotion,
  quantizeStageTime,
  stageAnimRateHz,
  stepVerticalJump,
} from '../src/modular-motion.js';

describe('Plan 43: Modular Locomotion, Jump & Stage-Fidelity Motion Presets', () => {
  it('launches on jump press, reaches apex under preset gravity, and lands with knee-dip spring', () => {
    let st = createVerticalJumpState();
    const preset = LOCOMOTION_PRESETS['lunar-ballast'];

    // Frame 1: press Space
    st = stepVerticalJump(st, { dt: 1 / 60, jumpHeld: true }, preset);
    assert.equal(st.justJumped, true);
    assert.equal(st.onGround, false);
    assert.equal(st.jumping, true);
    assert.ok(st.vy > 4.5);

    let maxHeight = 0;
    let landed = false;
    for (let i = 0; i < 120; i++) {
      st = stepVerticalJump(st, { dt: 1 / 60, jumpHeld: false }, preset);
      if (st.heightAboveFloor > maxHeight) maxHeight = st.heightAboveFloor;
      if (st.justLanded) {
        landed = true;
        break;
      }
    }
    assert.ok(maxHeight > 1.2 && maxHeight < 1.6, `expected lunar ballast jump apex ~1.38m, got ${maxHeight}`);
    assert.equal(landed, true);
    assert.equal(st.onGround, true);
    assert.equal(st.jumping, false);
    assert.ok(st.landingDipVel < 0, 'landing injects downward knee-dip impulse');
  });

  it('respects coyote time and headroom ceiling clamp in the Lab', () => {
    let st = createVerticalJumpState();
    st = stepVerticalJump(st, { dt: 1 / 60, jumpHeld: true, maxHeadroomM: 0.4 }, LOCOMOTION_PRESETS['earth-standard']);
    for (let i = 0; i < 30; i++) {
      st = stepVerticalJump(st, { dt: 1 / 60, jumpHeld: false, maxHeadroomM: 0.4 }, LOCOMOTION_PRESETS['earth-standard']);
      assert.ok(st.heightAboveFloor <= 0.4 + 1e-6);
    }
  });

  it('quantizes animation time across Fidelity Stages S0..S6 and evaluates declarative KitMotionSpec', () => {
    assert.equal(stageAnimRateHz(0), 8);
    assert.equal(stageAnimRateHz(1), 12);
    assert.equal(stageAnimRateHz(2), 18);
    assert.equal(stageAnimRateHz(3), 30);
    // S4..S6 sample at the frame cadence: 60 Hz is continuous for a screen that draws 60+ frames a second
    assert.equal(stageAnimRateHz(4), 60);
    assert.equal(stageAnimRateHz(6), 60);

    const q0 = quantizeStageTime(0.11, 0);
    assert.equal(q0, 0);
    // stage 6 holds a pose for one frame (1/60 s), so 0.11 s snaps to 6/60
    assert.equal(quantizeStageTime(0.11, 6), 0.1);
    assert.ok(Math.abs(quantizeStageTime(0.11, 6) - 0.11) <= 1 / 60, 'within one frame of the true time');
    assert.equal(quantizeStageTime(0.11, 3), 0.1, '30 Hz holds a pose for a 1/30 s');

    const ramMotion = evaluateKitMotion(
      { kind: 'reciprocate', axis: 'y', rateHz: 0.5, amplitude: 0.35 },
      0.5,
      1.0,
      6,
    );
    assert.ok(ramMotion.posOffset[1] < -0.3, `expected downward stroke, got ${ramMotion.posOffset[1]}`);
  });
});
