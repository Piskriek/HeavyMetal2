/**
 * T11 — Simulation-owned dent state
 * 
 * Three fixed dent slots per racer with deterministic merge/replacement.
 * Impact severity based on closing speed and specific impulse.
 * Aggregate displacement cap with exponential recovery.
 * Exactly-once 50% repair on shield absorption.
 */

export const DENT_SLOT_COUNT = 3;
export const MAX_DENT_DEPTH = 0.15; // 15% of radius
export const AGGREGATE_DENT_CAP = 0.35; // 35% total displacement
export const DENT_RECOVERY_RATE = 0.5; // exponential decay per second
export const REPAIR_FRACTION = 0.5; // exactly-once 50% repair

export interface DentSlot {
  readonly direction: { x: number; y: number; z: number }; // geometry-space unit vector
  readonly depth: number; // 0 to MAX_DENT_DEPTH
  readonly createdAt: number; // simulation time
}

export interface DentState {
  readonly slots: readonly (DentSlot | null)[];
  readonly totalDisplacement: number; // sum of all slot depths
}

/**
 * Calculate impact severity from closing speed and specific impulse.
 * Severity is normalized to [0, 1] where 1 is maximum dent depth.
 */
export function calculateImpactSeverity(
  closingSpeed: number, // m/s
  specificImpulse: number, // N·s/kg
  referenceSpeed = 20, // m/s for severity 1.0
): number {
  // Combine closing speed and specific impulse
  const speedFactor = Math.min(1, closingSpeed / referenceSpeed);
  const impulseFactor = Math.min(1, specificImpulse / (referenceSpeed * 2));
  
  // Weighted average, capped at 1.0
  return Math.min(1, speedFactor * 0.6 + impulseFactor * 0.4);
}

/**
 * Create initial dent state (all slots empty).
 */
export function createDentState(): DentState {
  return {
    slots: [null, null, null],
    totalDisplacement: 0,
  };
}

/**
 * Apply impact to dent state with deterministic merge/replacement.
 * Returns new state (immutable update).
 */
export function applyDentImpact(
  state: DentState,
  direction: { x: number; y: number; z: number },
  severity: number,
  currentTime: number,
): DentState {
  // Normalize direction
  const len = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
  if (len < 0.001) return state; // invalid direction
  
  const normDir = {
    x: direction.x / len,
    y: direction.y / len,
    z: direction.z / len,
  };
  
  // Calculate dent depth from severity
  const depth = severity * MAX_DENT_DEPTH;
  
  // Check aggregate cap
  const newTotal = state.totalDisplacement + depth;
  if (newTotal > AGGREGATE_DENT_CAP) {
    // Scale down to fit within cap
    const scale = (AGGREGATE_DENT_CAP - state.totalDisplacement) / depth;
    if (scale <= 0) return state; // already at cap
    return applyDentImpact(state, direction, severity * scale, currentTime);
  }
  
  // Find best slot: prefer merging similar directions, then use empty slot
  let bestSlot = -1;
  let bestDot = -Infinity;
  let firstEmptySlot = -1;
  
  for (let i = 0; i < DENT_SLOT_COUNT; i++) {
    const slot = state.slots[i];
    if (!slot) {
      // Remember first empty slot
      if (firstEmptySlot === -1) {
        firstEmptySlot = i;
      }
      continue;
    }
    
    // Check if directions are similar enough to merge (dot > 0.7)
    const dot = slot.direction.x * normDir.x + 
                slot.direction.y * normDir.y + 
                slot.direction.z * normDir.z;
    
    if (dot > 0.7 && dot > bestDot) {
      bestDot = dot;
      bestSlot = i;
    }
  }
  
  // Prefer merge over new slot
  if (bestSlot === -1) {
    bestSlot = firstEmptySlot;
  }
  
  // If no suitable slot, replace oldest dent
  if (bestSlot === -1) {
    let oldestTime = Infinity;
    for (let i = 0; i < DENT_SLOT_COUNT; i++) {
      const slot = state.slots[i];
      if (slot && slot.createdAt < oldestTime) {
        oldestTime = slot.createdAt;
        bestSlot = i;
      }
    }
  }
  
  if (bestSlot === -1) return state; // should never happen
  
  // Apply dent to slot
  const newSlots = [...state.slots];
  const existingSlot = newSlots[bestSlot];
  
  if (existingSlot) {
    // Merge: blend directions and add depths
    const blendFactor = 0.5;
    const blendedDir = {
      x: existingSlot.direction.x * (1 - blendFactor) + normDir.x * blendFactor,
      y: existingSlot.direction.y * (1 - blendFactor) + normDir.y * blendFactor,
      z: existingSlot.direction.z * (1 - blendFactor) + normDir.z * blendFactor,
    };
    
    // Normalize blended direction
    const blendLen = Math.sqrt(blendedDir.x ** 2 + blendedDir.y ** 2 + blendedDir.z ** 2);
    const normBlendDir = {
      x: blendedDir.x / blendLen,
      y: blendedDir.y / blendLen,
      z: blendedDir.z / blendLen,
    };
    
    newSlots[bestSlot] = {
      direction: normBlendDir,
      depth: Math.min(MAX_DENT_DEPTH, existingSlot.depth + depth),
      createdAt: currentTime,
    };
  } else {
    // New dent
    newSlots[bestSlot] = {
      direction: normDir,
      depth,
      createdAt: currentTime,
    };
  }
  
  // Recalculate total displacement
  const newTotalDisplacement = newSlots.reduce((sum, slot) => sum + (slot?.depth ?? 0), 0);
  
  return {
    slots: newSlots,
    totalDisplacement: newTotalDisplacement,
  };
}

/**
 * Apply exponential recovery to dent state.
 * Returns new state (immutable update).
 */
export function recoverDents(
  state: DentState,
  deltaTime: number,
): DentState {
  const decayFactor = Math.exp(-DENT_RECOVERY_RATE * deltaTime);
  
  const newSlots = state.slots.map(slot => {
    if (!slot) return null;
    
    const newDepth = slot.depth * decayFactor;
    
    // Remove dent if below threshold
    if (newDepth < 0.001) return null;
    
    return {
      ...slot,
      depth: newDepth,
    };
  });
  
  const newTotalDisplacement = newSlots.reduce((sum, slot) => sum + (slot?.depth ?? 0), 0);
  
  return {
    slots: newSlots,
    totalDisplacement: newTotalDisplacement,
  };
}

/**
 * Apply exactly-once 50% repair (e.g., from shield absorption).
 * Returns new state (immutable update).
 */
export function applyRepair(
  state: DentState,
): DentState {
  const newSlots = state.slots.map(slot => {
    if (!slot) return null;
    
    return {
      ...slot,
      depth: slot.depth * (1 - REPAIR_FRACTION),
    };
  });
  
  const newTotalDisplacement = newSlots.reduce((sum, slot) => sum + (slot?.depth ?? 0), 0);
  
  return {
    slots: newSlots,
    totalDisplacement: newTotalDisplacement,
  };
}

/**
 * Check if dent state has any active dents.
 */
export function hasActiveDents(state: DentState): boolean {
  return state.slots.some(slot => slot !== null);
}

/**
 * Get dent data for shader uniforms.
 * Returns flattened arrays for efficient GPU upload.
 */
export function getDentUniforms(state: DentState): {
  dentDirections: Float32Array; // [x0, y0, z0, x1, y1, z1, x2, y2, z2]
  dentDepths: Float32Array; // [d0, d1, d2]
  dentCount: number;
} {
  const directions = new Float32Array(DENT_SLOT_COUNT * 3);
  const depths = new Float32Array(DENT_SLOT_COUNT);
  let count = 0;
  
  for (let i = 0; i < DENT_SLOT_COUNT; i++) {
    const slot = state.slots[i];
    if (slot) {
      directions[i * 3] = slot.direction.x;
      directions[i * 3 + 1] = slot.direction.y;
      directions[i * 3 + 2] = slot.direction.z;
      depths[i] = slot.depth;
      count++;
    } else {
      directions[i * 3] = 0;
      directions[i * 3 + 1] = 0;
      directions[i * 3 + 2] = 0;
      depths[i] = 0;
    }
  }
  
  return {
    dentDirections: directions,
    dentDepths: depths,
    dentCount: count,
  };
}
