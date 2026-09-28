/**
 * T11 — Simulation-owned rolling state
 * 
 * Orientation and rolling phase owned by simulation.
 * Renderer reads but never writes back.
 * Visual-only bobbing initially; no airborne forces.
 */

export interface RollingState {
  readonly orientation: { x: number; y: number; z: number; w: number }; // quaternion
  readonly rollingPhase: number; // radians, wraps at 2π
  readonly angularVelocity: { x: number; y: number; z: number }; // rad/s
  readonly bobOffset: number; // visual-only vertical offset
  readonly bobPhase: number; // visual-only bobbing phase
}

/**
 * Create initial rolling state.
 */
export function createRollingState(): RollingState {
  return {
    orientation: { x: 0, y: 0, z: 0, w: 1 }, // identity quaternion
    rollingPhase: 0,
    angularVelocity: { x: 0, y: 0, z: 0 },
    bobOffset: 0,
    bobPhase: 0,
  };
}

/**
 * Update rolling state based on linear velocity and ground contact.
 * Pure rolling: angular velocity = linear velocity / radius.
 * Returns new state (immutable update).
 */
export function updateRollingState(
  state: RollingState,
  linearVelocity: { x: number; y: number; z: number },
  radius: number,
  grounded: boolean,
  deltaTime: number,
): RollingState {
  if (!grounded) {
    // No rolling when airborne
    return {
      ...state,
      bobOffset: 0,
      bobPhase: 0,
    };
  }
  
  // Calculate angular velocity from linear velocity (pure rolling)
  // ω = v / r, direction perpendicular to velocity and up vector
  const speed = Math.sqrt(linearVelocity.x ** 2 + linearVelocity.z ** 2);
  
  if (speed < 0.01) {
    // Stationary: dampen angular velocity
    const dampFactor = Math.exp(-5 * deltaTime);
    return {
      ...state,
      angularVelocity: {
        x: state.angularVelocity.x * dampFactor,
        y: state.angularVelocity.y * dampFactor,
        z: state.angularVelocity.z * dampFactor,
      },
      bobOffset: 0,
      bobPhase: 0,
    };
  }
  
  // Rolling axis: perpendicular to velocity and up (0, 1, 0)
  // axis = velocity × up = (vz, 0, -vx) normalized
  const axisLen = speed;
  const axis = {
    x: linearVelocity.z / axisLen,
    y: 0,
    z: -linearVelocity.x / axisLen,
  };
  
  // Angular velocity magnitude
  const angularSpeed = speed / radius;
  
  const newAngularVelocity = {
    x: axis.x * angularSpeed,
    y: axis.y * angularSpeed,
    z: axis.z * angularSpeed,
  };
  
  // Update rolling phase
  const phaseDelta = angularSpeed * deltaTime;
  const newRollingPhase = (state.rollingPhase + phaseDelta) % (Math.PI * 2);
  
  // Update orientation quaternion
  // q_new = q_old * Δq where Δq is rotation around axis by angle = angularSpeed * dt
  const halfAngle = phaseDelta / 2;
  const sinHalf = Math.sin(halfAngle);
  const cosHalf = Math.cos(halfAngle);
  
  const deltaQ = {
    x: axis.x * sinHalf,
    y: axis.y * sinHalf,
    z: axis.z * sinHalf,
    w: cosHalf,
  };
  
  const newOrientation = multiplyQuaternions(state.orientation, deltaQ);
  
  // Visual-only bobbing (no physics effect)
  const bobFrequency = 2; // Hz
  const bobAmplitude = Math.min(0.05, speed * 0.002); // max 5% of radius
  const newBobPhase = (state.bobPhase + deltaTime * bobFrequency * Math.PI * 2) % (Math.PI * 2);
  const newBobOffset = Math.sin(newBobPhase) * bobAmplitude * radius;
  
  return {
    orientation: normalizeQuaternion(newOrientation),
    rollingPhase: newRollingPhase,
    angularVelocity: newAngularVelocity,
    bobOffset: newBobOffset,
    bobPhase: newBobPhase,
  };
}

/**
 * Multiply two quaternions: result = a * b
 */
function multiplyQuaternions(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/**
 * Normalize quaternion to unit length.
 */
function normalizeQuaternion(
  q: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
  const len = Math.sqrt(q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2);
  if (len < 0.0001) {
    return { x: 0, y: 0, z: 0, w: 1 }; // identity
  }
  return {
    x: q.x / len,
    y: q.y / len,
    z: q.z / len,
    w: q.w / len,
  };
}

/**
 * Get rolling state data for shader uniforms.
 */
export function getRollingUniforms(state: RollingState): {
  orientation: Float32Array; // [x, y, z, w]
  rollingPhase: number;
  bobOffset: number;
} {
  return {
    orientation: new Float32Array([
      state.orientation.x,
      state.orientation.y,
      state.orientation.z,
      state.orientation.w,
    ]),
    rollingPhase: state.rollingPhase,
    bobOffset: state.bobOffset,
  };
}
