/**
 * T11 — Bounded rolling resistance and lateral bias
 * 
 * Visual-only effects initially; no airborne forces.
 * Bounded to prevent runaway behavior.
 */

export const ROLLING_RESISTANCE_COEFFICIENT = 0.02; // 2% of normal force
export const LATERAL_BIAS_STRENGTH = 0.05; // 5% lateral drift
export const MAX_RESISTANCE_FORCE = 50; // N, bounded
export const MAX_LATERAL_FORCE = 20; // N, bounded

export interface RollingResistanceState {
  readonly accumulatedLateralDrift: number; // meters, bounded
}

/**
 * Create initial rolling resistance state.
 */
export function createRollingResistanceState(): RollingResistanceState {
  return {
    accumulatedLateralDrift: 0,
  };
}

/**
 * Calculate rolling resistance force.
 * Opposes motion direction, bounded to prevent runaway.
 * Returns force vector in world space.
 */
export function calculateRollingResistance(
  velocity: { x: number; y: number; z: number },
  mass: number,
  grounded: boolean,
): { x: number; y: number; z: number } {
  if (!grounded) {
    return { x: 0, y: 0, z: 0 };
  }
  
  const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
  if (speed < 0.01) {
    return { x: 0, y: 0, z: 0 };
  }
  
  // Normal force (assuming flat ground)
  const normalForce = mass * 9.81; // N
  
  // Rolling resistance magnitude
  let resistanceMag = ROLLING_RESISTANCE_COEFFICIENT * normalForce;
  
  // Bound the force
  resistanceMag = Math.min(resistanceMag, MAX_RESISTANCE_FORCE);
  
  // Direction: opposite to velocity (horizontal only)
  const dirX = -velocity.x / speed;
  const dirZ = -velocity.z / speed;
  
  return {
    x: dirX * resistanceMag,
    y: 0,
    z: dirZ * resistanceMag,
  };
}

/**
 * Calculate lateral bias force.
 * Small drift perpendicular to motion direction, bounded.
 * Returns force vector in world space.
 */
export function calculateLateralBias(
  velocity: { x: number; y: number; z: number },
  mass: number,
  grounded: boolean,
  deltaTime: number,
  state: RollingResistanceState,
): {
  force: { x: number; y: number; z: number };
  newState: RollingResistanceState;
} {
  if (!grounded) {
    return {
      force: { x: 0, y: 0, z: 0 },
      newState: state,
    };
  }
  
  const speed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
  if (speed < 0.01) {
    return {
      force: { x: 0, y: 0, z: 0 },
      newState: state,
    };
  }
  
  // Lateral direction: perpendicular to velocity (horizontal)
  // If velocity is (vx, 0, vz), lateral is (-vz, 0, vx) normalized
  const lateralDir = {
    x: -velocity.z / speed,
    y: 0,
    z: velocity.x / speed,
  };
  
  // Lateral force magnitude (proportional to speed)
  let lateralMag = LATERAL_BIAS_STRENGTH * mass * speed;
  
  // Bound the force
  lateralMag = Math.min(lateralMag, MAX_LATERAL_FORCE);
  
  // Alternate direction based on accumulated drift to prevent runaway
  const maxDrift = 2.0; // meters
  let direction = 1;
  
  if (Math.abs(state.accumulatedLateralDrift) > maxDrift) {
    // Reverse direction
    direction = -Math.sign(state.accumulatedLateralDrift);
  }
  
  const force = {
    x: lateralDir.x * lateralMag * direction,
    y: 0,
    z: lateralDir.z * lateralMag * direction,
  };
  
  // Update accumulated drift
  const driftDelta = (force.x * lateralDir.x + force.z * lateralDir.z) / mass * deltaTime;
  const newAccumulatedDrift = state.accumulatedLateralDrift + driftDelta;
  
  // Bound accumulated drift
  const boundedDrift = Math.max(-maxDrift, Math.min(maxDrift, newAccumulatedDrift));
  
  return {
    force,
    newState: {
      accumulatedLateralDrift: boundedDrift,
    },
  };
}

/**
 * Apply rolling resistance and lateral bias to velocity.
 * Visual-only: does not affect airborne motion.
 * Returns new velocity (immutable update).
 */
export function applyRollingEffects(
  velocity: { x: number; y: number; z: number },
  mass: number,
  grounded: boolean,
  deltaTime: number,
  state: RollingResistanceState,
): {
  newVelocity: { x: number; y: number; z: number };
  newState: RollingResistanceState;
} {
  if (!grounded) {
    return {
      newVelocity: velocity,
      newState: state,
    };
  }
  
  // Calculate forces
  const resistance = calculateRollingResistance(velocity, mass, grounded);
  const { force: lateral, newState } = calculateLateralBias(
    velocity, mass, grounded, deltaTime, state
  );
  
  // Apply forces: F = ma, so Δv = F * dt / m
  const dvx = (resistance.x + lateral.x) / mass * deltaTime;
  const dvz = (resistance.z + lateral.z) / mass * deltaTime;
  
  const newVelocity = {
    x: velocity.x + dvx,
    y: velocity.y, // no vertical effect
    z: velocity.z + dvz,
  };
  
  // Prevent reversal: if velocity reversed direction, clamp to zero
  const origSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
  const newSpeed = Math.sqrt(newVelocity.x ** 2 + newVelocity.z ** 2);
  
  if (origSpeed > 0.01 && newSpeed < 0.01) {
    return {
      newVelocity: { x: 0, y: velocity.y, z: 0 },
      newState,
    };
  }
  
  // Check for direction reversal
  const dot = velocity.x * newVelocity.x + velocity.z * newVelocity.z;
  if (dot < 0) {
    // Reversed: clamp to zero
    return {
      newVelocity: { x: 0, y: velocity.y, z: 0 },
      newState,
    };
  }
  
  return {
    newVelocity,
    newState,
  };
}
