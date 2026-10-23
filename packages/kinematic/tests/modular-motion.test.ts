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
    assert.equal(stageAnimRateHz(4), 0);
    assert.equal(stageAnimRateHz(6), 0);

    const q0 = quantizeStageTime(0.11, 0);
    assert.equal(q0, 0);
    const q6 = quantizeStageTime(0.11, 6);
    assert.equal(q6, 0.11);

    const ramMotion = evaluateKitMotion(
      { kind: 'reciprocate', axis: 'y', rateHz: 0.5, amplitude: 0.35 },
      0.5,
      1.0,
      6,
    );
    assert.ok(ramMotion.posOffset[1] < -0.3, `expected downward stroke, got ${ramMotion.posOffset[1]}`);
  });
});
