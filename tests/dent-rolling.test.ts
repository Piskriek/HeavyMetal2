/**
 * T11 — Tests for dent state, rolling state, and rolling resistance
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  createDentState,
  applyDentImpact,
  recoverDents,
  applyRepair,
  hasActiveDents,
  getDentUniforms,
  calculateImpactSeverity,
  DENT_SLOT_COUNT,
  MAX_DENT_DEPTH,
  AGGREGATE_DENT_CAP,
} from '../src/game/dent-state';
import {
  createRollingState,
  updateRollingState,
  getRollingUniforms,
} from '../src/game/rolling-state';
import {
  createRollingResistanceState,
  calculateRollingResistance,
  calculateLateralBias,
  applyRollingEffects,
} from '../src/game/rolling-resistance';

describe('T11: Dent State Management', () => {
  it('creates empty dent state with 3 slots', () => {
    const state = createDentState();
    assert.strictEqual(state.slots.length, DENT_SLOT_COUNT);
    assert.strictEqual(state.totalDisplacement, 0);
    state.slots.forEach(slot => assert.strictEqual(slot, null));
  });

  it('applies dent impact to empty slot', () => {
    const state = createDentState();
    const direction = { x: 1, y: 0, z: 0 };
    const severity = 0.8;
    const time = 1.0;
    
    const newState = applyDentImpact(state, direction, severity, time);
    
    assert.strictEqual(hasActiveDents(newState), true);
    assert.strictEqual(newState.slots[0] !== null, true);
    assert.strictEqual(newState.slots[1], null);
    assert.strictEqual(newState.slots[2], null);
    
    const slot = newState.slots[0]!;
    assert.strictEqual(slot.direction.x, 1);
    assert.strictEqual(slot.direction.y, 0);
    assert.strictEqual(slot.direction.z, 0);
    assert.ok(slot.depth > 0);
    assert.ok(slot.depth <= MAX_DENT_DEPTH);
    assert.strictEqual(slot.createdAt, time);
  });

  it('normalizes dent direction vector', () => {
    const state = createDentState();
    const direction = { x: 2, y: 0, z: 0 }; // unnormalized
    const severity = 0.5;
    const time = 1.0;
    
    const newState = applyDentImpact(state, direction, severity, time);
    const slot = newState.slots[0]!;
    
    const len = Math.sqrt(slot.direction.x ** 2 + slot.direction.y ** 2 + slot.direction.z ** 2);
    assert.ok(Math.abs(len - 1.0) < 0.001);
  });

  it('fills slots sequentially', () => {
    let state = createDentState();
    const time = 1.0;
    
    state = applyDentImpact(state, { x: 1, y: 0, z: 0 }, 0.3, time);
    assert.strictEqual(state.slots[0] !== null, true);
    assert.strictEqual(state.slots[1], null);
    assert.strictEqual(state.slots[2], null);
    
    state = applyDentImpact(state, { x: 0, y: 1, z: 0 }, 0.3, time + 1);
    assert.strictEqual(state.slots[0] !== null, true);
    assert.strictEqual(state.slots[1] !== null, true);
    assert.strictEqual(state.slots[2], null);
    
    state = applyDentImpact(state, { x: 0, y: 0, z: 1 }, 0.3, time + 2);
    assert.strictEqual(state.slots[0] !== null, true);
    assert.strictEqual(state.slots[1] !== null, true);
    assert.strictEqual(state.slots[2] !== null, true);
  });

  it('merges similar-direction dents', () => {
    let state = createDentState();
    const time = 1.0;
    
    // First dent
    state = applyDentImpact(state, { x: 1, y: 0, z: 0 }, 0.3, time);
    const depth1 = state.slots[0]!.depth;
    
    // Second dent in similar direction (dot > 0.7)
    state = applyDentImpact(state, { x: 0.9, y: 0.1, z: 0 }, 0.3, time + 1);
    
    // Should merge into slot 0, not create new slot
    assert.strictEqual(state.slots[0] !== null, true);
    // After merge, only one slot should be occupied
    const occupiedSlots = state.slots.filter(s => s !== null).length;
    assert.strictEqual(occupiedSlots, 1);
    
    // Depth should increase
    const depth2 = state.slots[0]!.depth;
    assert.ok(depth2 > depth1);
  });

  it('respects aggregate dent cap', () => {
    let state = createDentState();
    const time = 1.0;
    
    // Apply many high-severity dents
    for (let i = 0; i < 10; i++) {
      state = applyDentImpact(state, { x: Math.random(), y: Math.random(), z: Math.random() }, 1.0, time + i);
    }
    
    // Total displacement should not exceed cap
    assert.ok(state.totalDisplacement <= AGGREGATE_DENT_CAP);
  });

  it('recovers dents exponentially', () => {
    let state = createDentState();
    state = applyDentImpact(state, { x: 1, y: 0, z: 0 }, 0.8, 0);
    
    const initialDepth = state.slots[0]!.depth;
    
    // Recover over time
    state = recoverDents(state, 1.0); // 1 second
    const depth1 = state.slots[0]!.depth;
    assert.ok(depth1 < initialDepth);
    
    state = recoverDents(state, 1.0);
    const depth2 = state.slots[0]!.depth;
    assert.ok(depth2 < depth1);
    
    // Exponential decay: depth2 should be roughly depth1 * decay_factor
    // Not exact due to floating point, but should be close
    assert.ok(depth2 < depth1 * 0.8);
  });

  it('removes dents below threshold', () => {
    let state = createDentState();
    state = applyDentImpact(state, { x: 1, y: 0, z: 0 }, 0.1, 0);
    
    // Recover many times
    for (let i = 0; i < 50; i++) {
      state = recoverDents(state, 1.0);
    }
    
    // Dent should be removed
    assert.strictEqual(hasActiveDents(state), false);
  });

  it('applies exactly-once 50% repair', () => {
    let state = createDentState();
    state = applyDentImpact(state, { x: 1, y: 0, z: 0 }, 0.8, 0);
    
    const initialDepth = state.slots[0]!.depth;
    
    state = applyRepair(state);
    const repairedDepth = state.slots[0]!.depth;
    
    assert.ok(Math.abs(repairedDepth - initialDepth * 0.5) < 0.001);
  });

  it('calculates impact severity correctly', () => {
    // Low speed, low impulse
    const low = calculateImpactSeverity(5, 5);
    assert.ok(low > 0 && low < 0.5);
    
    // High speed, high impulse
    const high = calculateImpactSeverity(20, 40);
    assert.ok(high > 0.8 && high <= 1.0);
    
    // Medium values
    const medium = calculateImpactSeverity(10, 20);
    assert.ok(medium > low && medium < high);
  });

  it('generates correct shader uniforms', () => {
    let state = createDentState();
    state = applyDentImpact(state, { x: 1, y: 0, z: 0 }, 0.5, 0);
    state = applyDentImpact(state, { x: 0, y: 1, z: 0 }, 0.3, 1);
    
    const uniforms = getDentUniforms(state);
    
    assert.strictEqual(uniforms.dentDirections.length, DENT_SLOT_COUNT * 3);
    assert.strictEqual(uniforms.dentDepths.length, DENT_SLOT_COUNT);
    assert.strictEqual(uniforms.dentCount, 2);
    
    // First slot
    assert.strictEqual(uniforms.dentDirections[0], 1);
    assert.strictEqual(uniforms.dentDirections[1], 0);
    assert.strictEqual(uniforms.dentDirections[2], 0);
    assert.ok(uniforms.dentDepths[0] > 0);
    
    // Second slot
    assert.strictEqual(uniforms.dentDirections[3], 0);
    assert.strictEqual(uniforms.dentDirections[4], 1);
    assert.strictEqual(uniforms.dentDirections[5], 0);
    assert.ok(uniforms.dentDepths[1] > 0);
    
    // Third slot (empty)
    assert.strictEqual(uniforms.dentDirections[6], 0);
    assert.strictEqual(uniforms.dentDirections[7], 0);
    assert.strictEqual(uniforms.dentDirections[8], 0);
    assert.strictEqual(uniforms.dentDepths[2], 0);
  });
});

describe('T11: Rolling State Management', () => {
  it('creates initial rolling state', () => {
    const state = createRollingState();
    
    assert.strictEqual(state.orientation.x, 0);
    assert.strictEqual(state.orientation.y, 0);
    assert.strictEqual(state.orientation.z, 0);
    assert.strictEqual(state.orientation.w, 1); // identity quaternion
    assert.strictEqual(state.rollingPhase, 0);
    assert.strictEqual(state.angularVelocity.x, 0);
    assert.strictEqual(state.angularVelocity.y, 0);
    assert.strictEqual(state.angularVelocity.z, 0);
    assert.strictEqual(state.bobOffset, 0);
    assert.strictEqual(state.bobPhase, 0);
  });

  it('updates rolling phase when grounded', () => {
    const state = createRollingState();
    const velocity = { x: 10, y: 0, z: 0 };
    const radius = 1.0;
    const deltaTime = 0.1;
    
    const newState = updateRollingState(state, velocity, radius, true, deltaTime);
    
    assert.ok(newState.rollingPhase > 0);
    assert.ok(newState.angularVelocity.x !== 0 || newState.angularVelocity.z !== 0);
  });

  it('does not roll when airborne', () => {
    const state = createRollingState();
    const velocity = { x: 10, y: 0, z: 0 };
    const radius = 1.0;
    const deltaTime = 0.1;
    
    const newState = updateRollingState(state, velocity, radius, false, deltaTime);
    
    assert.strictEqual(newState.rollingPhase, 0);
    assert.strictEqual(newState.bobOffset, 0);
    assert.strictEqual(newState.bobPhase, 0);
  });

  it('wraps rolling phase at 2π', () => {
    let state = createRollingState();
    const velocity = { x: 10, y: 0, z: 0 };
    const radius = 1.0;
    const deltaTime = 1.0;
    
    // Update many times to accumulate phase
    for (let i = 0; i < 100; i++) {
      state = updateRollingState(state, velocity, radius, true, deltaTime);
    }
    
    // Phase should be wrapped to [0, 2π)
    assert.ok(state.rollingPhase >= 0);
    assert.ok(state.rollingPhase < Math.PI * 2);
  });

  it('calculates correct angular velocity for pure rolling', () => {
    const state = createRollingState();
    const velocity = { x: 10, y: 0, z: 0 }; // 10 m/s forward
    const radius = 1.0;
    const deltaTime = 0.1;
    
    const newState = updateRollingState(state, velocity, radius, true, deltaTime);
    
    // Pure rolling: ω = v / r = 10 rad/s
    // Axis should be perpendicular to velocity: (0, 0, -1) for forward motion
    const angularSpeed = Math.sqrt(
      newState.angularVelocity.x ** 2 +
      newState.angularVelocity.y ** 2 +
      newState.angularVelocity.z ** 2
    );
    
    assert.ok(Math.abs(angularSpeed - 10) < 0.1);
  });

  it('dampens angular velocity when stationary', () => {
    let state = createRollingState();
    
    // First, get some angular velocity
    state = updateRollingState(state, { x: 10, y: 0, z: 0 }, 1.0, true, 0.1);
    const initialAngularSpeed = Math.sqrt(
      state.angularVelocity.x ** 2 +
      state.angularVelocity.y ** 2 +
      state.angularVelocity.z ** 2
    );
    
    // Now become stationary
    state = updateRollingState(state, { x: 0, y: 0, z: 0 }, 1.0, true, 0.1);
    const dampedAngularSpeed = Math.sqrt(
      state.angularVelocity.x ** 2 +
      state.angularVelocity.y ** 2 +
      state.angularVelocity.z ** 2
    );
    
    assert.ok(dampedAngularSpeed < initialAngularSpeed);
  });

  it('generates visual bobbing when grounded and moving', () => {
    const state = createRollingState();
    const velocity = { x: 10, y: 0, z: 0 };
    const radius = 1.0;
    const deltaTime = 0.1;
    
    const newState = updateRollingState(state, velocity, radius, true, deltaTime);
    
    // Bob phase should advance
    assert.ok(newState.bobPhase > 0);
    
    // Bob offset should be small (visual only)
    assert.ok(Math.abs(newState.bobOffset) < radius * 0.1);
  });

  it('normalizes orientation quaternion', () => {
    let state = createRollingState();
    const velocity = { x: 10, y: 0, z: 0 };
    const radius = 1.0;
    const deltaTime = 0.1;
    
    // Update many times
    for (let i = 0; i < 100; i++) {
      state = updateRollingState(state, velocity, radius, true, deltaTime);
    }
    
    // Quaternion should remain normalized
    const len = Math.sqrt(
      state.orientation.x ** 2 +
      state.orientation.y ** 2 +
      state.orientation.z ** 2 +
      state.orientation.w ** 2
    );
    
    assert.ok(Math.abs(len - 1.0) < 0.001);
  });

  it('generates correct shader uniforms', () => {
    const state = createRollingState();
    const uniforms = getRollingUniforms(state);
    
    assert.strictEqual(uniforms.orientation.length, 4);
    assert.strictEqual(uniforms.orientation[0], 0);
    assert.strictEqual(uniforms.orientation[1], 0);
    assert.strictEqual(uniforms.orientation[2], 0);
    assert.strictEqual(uniforms.orientation[3], 1);
    assert.strictEqual(uniforms.rollingPhase, 0);
    assert.strictEqual(uniforms.bobOffset, 0);
  });
});

describe('T11: Rolling Resistance and Lateral Bias', () => {
  it('creates initial rolling resistance state', () => {
    const state = createRollingResistanceState();
    assert.strictEqual(state.accumulatedLateralDrift, 0);
  });

  it('calculates rolling resistance opposing motion', () => {
    const velocity = { x: 10, y: 0, z: 0 };
    const mass = 100;
    
    const resistance = calculateRollingResistance(velocity, mass, true);
    
    // Should oppose motion (negative x direction)
    assert.ok(resistance.x < 0);
    assert.ok(Math.abs(resistance.y) < 1e-10);
    assert.ok(Math.abs(resistance.z) < 1e-10);
  });

  it('returns zero resistance when airborne', () => {
    const velocity = { x: 10, y: 0, z: 0 };
    const mass = 100;
    
    const resistance = calculateRollingResistance(velocity, mass, false);
    
    assert.strictEqual(resistance.x, 0);
    assert.strictEqual(resistance.y, 0);
    assert.strictEqual(resistance.z, 0);
  });

  it('returns zero resistance when stationary', () => {
    const velocity = { x: 0, y: 0, z: 0 };
    const mass = 100;
    
    const resistance = calculateRollingResistance(velocity, mass, true);
    
    assert.strictEqual(resistance.x, 0);
    assert.strictEqual(resistance.y, 0);
    assert.strictEqual(resistance.z, 0);
  });

  it('bounds rolling resistance force', () => {
    const velocity = { x: 1000, y: 0, z: 0 }; // very high speed
    const mass = 10000; // very heavy
    
    const resistance = calculateRollingResistance(velocity, mass, true);
    const magnitude = Math.sqrt(resistance.x ** 2 + resistance.z ** 2);
    
    // Should be bounded
    assert.ok(magnitude <= 50); // MAX_RESISTANCE_FORCE
  });

  it('calculates lateral bias perpendicular to motion', () => {
    const velocity = { x: 10, y: 0, z: 0 };
    const mass = 100;
    const deltaTime = 0.1;
    const state = createRollingResistanceState();
    
    const { force } = calculateLateralBias(velocity, mass, true, deltaTime, state);
    
    // Should be perpendicular to velocity (in z direction for x-velocity)
    assert.ok(Math.abs(force.x) < 1e-10);
    assert.ok(Math.abs(force.y) < 1e-10);
    assert.ok(force.z !== 0);
  });

  it('bounds lateral drift accumulation', () => {
    let state = createRollingResistanceState();
    const velocity = { x: 10, y: 0, z: 0 };
    const mass = 100;
    const deltaTime = 0.1;
    
    // Apply lateral bias many times
    for (let i = 0; i < 1000; i++) {
      const { newState } = calculateLateralBias(velocity, mass, true, deltaTime, state);
      state = newState;
    }
    
    // Drift should be bounded
    assert.ok(Math.abs(state.accumulatedLateralDrift) <= 2.0);
  });

  it('applies rolling effects to velocity', () => {
    const velocity = { x: 10, y: 0, z: 0 };
    const mass = 100;
    const deltaTime = 0.1;
    const state = createRollingResistanceState();
    
    const { newVelocity } = applyRollingEffects(velocity, mass, true, deltaTime, state);
    
    // Velocity should decrease due to rolling resistance
    assert.ok(newVelocity.x < velocity.x);
    assert.strictEqual(newVelocity.y, velocity.y); // no vertical effect
  });

  it('does not apply rolling effects when airborne', () => {
    const velocity = { x: 10, y: 5, z: 0 };
    const mass = 100;
    const deltaTime = 0.1;
    const state = createRollingResistanceState();
    
    const { newVelocity } = applyRollingEffects(velocity, mass, false, deltaTime, state);
    
    // Velocity should be unchanged
    assert.strictEqual(newVelocity.x, velocity.x);
    assert.strictEqual(newVelocity.y, velocity.y);
    assert.strictEqual(newVelocity.z, velocity.z);
  });

  it('prevents velocity reversal from rolling resistance', () => {
    const velocity = { x: 0.1, y: 0, z: 0 }; // very slow
    const mass = 100;
    const deltaTime = 1.0; // long time step
    const state = createRollingResistanceState();
    
    const { newVelocity } = applyRollingEffects(velocity, mass, true, deltaTime, state);
    
    // Should clamp to zero, not reverse
    assert.ok(newVelocity.x >= 0);
  });
});

describe('T11: Integration and Edge Cases', () => {
  it('dent state remains immutable', () => {
    const state1 = createDentState();
    const state2 = applyDentImpact(state1, { x: 1, y: 0, z: 0 }, 0.5, 0);
    
    // Original state should be unchanged
    assert.strictEqual(hasActiveDents(state1), false);
    assert.strictEqual(hasActiveDents(state2), true);
  });

  it('rolling state remains immutable', () => {
    const state1 = createRollingState();
    const state2 = updateRollingState(state1, { x: 10, y: 0, z: 0 }, 1.0, true, 0.1);
    
    // Original state should be unchanged
    assert.strictEqual(state1.rollingPhase, 0);
    assert.ok(state2.rollingPhase > 0);
  });

  it('handles zero deltaTime gracefully', () => {
    const dentState = createDentState();
    const recovered = recoverDents(dentState, 0);
    assert.strictEqual(recovered.totalDisplacement, 0);
    
    const rollingState = createRollingState();
    const updated = updateRollingState(rollingState, { x: 10, y: 0, z: 0 }, 1.0, true, 0);
    assert.strictEqual(updated.rollingPhase, 0);
  });

  it('handles negative deltaTime gracefully', () => {
    const dentState = createDentState();
    const recovered = recoverDents(dentState, -1);
    // Should not crash, behavior undefined but safe
    assert.ok(recovered);
  });

  it('handles invalid dent direction (zero vector)', () => {
    const state = createDentState();
    const newState = applyDentImpact(state, { x: 0, y: 0, z: 0 }, 0.5, 0);
    
    // Should return unchanged state
    assert.strictEqual(hasActiveDents(newState), false);
  });

  it('handles very small velocities', () => {
    const state = createRollingState();
    const velocity = { x: 0.001, y: 0, z: 0 };
    const newState = updateRollingState(state, velocity, 1.0, true, 0.1);
    
    // Should not crash
    assert.ok(newState);
  });

  it('handles very large velocities', () => {
    const state = createRollingState();
    const velocity = { x: 1000, y: 0, z: 0 };
    const newState = updateRollingState(state, velocity, 1.0, true, 0.1);
    
    // Should not crash, angular velocity should be large but finite
    assert.ok(isFinite(newState.angularVelocity.x));
    assert.ok(isFinite(newState.angularVelocity.z));
  });
});
