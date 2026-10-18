// ============================================================================
// File: apps/web/src/avatar/two-bone-ik.ts
// TICKET-10 (POL-28 — Analytical Two-Bone Limb IK Solver for Rifle Foregrip):
// - Pure Law-of-Cosines two-bone IK solver (`solveTwoBoneIk`) computing exact
//   elbow joint position, soft-clamped reach, and upper/lower limb rotations.
// - Direct scene-graph helper (`solveLeftArmForegripIk`) for posing Astro's
//   third-person left arm (`mixamorigLeftArm` -> `mixamorigLeftForeArm` -> `mixamorigLeftHand`)
//   onto the Extraction Beam's `foregrip` world socket.
// Pure TypeScript: zero runtime dependencies so Node tests run directly.
// ============================================================================

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface TwoBoneIkInput {
  /** World position of the root joint (shoulder / upper arm). */
  readonly rootPos: Vec3;
  /** World position of the middle joint (elbow) in the current animated pose. */
  readonly midPos: Vec3;
  /** World position of the end effector (left hand / wrist) in the current animated pose. */
  readonly endPos: Vec3;
  /** Desired world position for the end effector (rifle foregrip socket). */
  readonly targetPos: Vec3;
  /** World pole target guiding the elbow bend direction. */
  readonly polePos: Vec3;
}

export interface TwoBoneIkSolution {
  /** Upper bone length (shoulder to elbow, m). */
  readonly upperLen: number;
  /** Lower bone length (elbow to wrist, m). */
  readonly lowerLen: number;
  /** Clamped reach distance from rootPos to solvedEndPos (m). */
  readonly reachDist: number;
  /** Whether the target was within the arm's natural reach without clamping. */
  readonly withinReach: boolean;
  /** Interior elbow angle in radians (pi = straight arm). */
  readonly elbowAngleRad: number;
  /** Solved world-space elbow position. */
  readonly jointPos: Vec3;
  /** Solved world-space hand/wrist position. */
  readonly solvedEndPos: Vec3;
  /** World-space delta rotation quaternion to apply to the upper bone (`root -> mid`). */
  readonly upperDeltaQuat: Quat;
  /** World-space delta rotation quaternion to apply to the lower bone (`mid -> end`) after upper rotation. */
  readonly lowerDeltaQuat: Quat;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Vec3, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 {
  const l = len(v);
  return l > 1e-8 ? scale(v, 1 / l) : fallback;
}

/** Unit quaternion rotating unit vector `from` to unit vector `to`. */
export function quatFromUnitVectors(from: Vec3, to: Vec3): Quat {
  let r = dot(from, to) + 1;
  if (r < 1e-6) {
    r = 0;
    const axis =
      Math.abs(from.x) > Math.abs(from.z)
        ? { x: -from.y, y: from.x, z: 0 }
        : { x: 0, y: -from.z, z: from.y };
    const n = normalize(axis, { x: 1, y: 0, z: 0 });
    return { x: n.x, y: n.y, z: n.z, w: 0 };
  }
  const c = cross(from, to);
  const mag = Math.hypot(c.x, c.y, c.z, r);
  return { x: c.x / mag, y: c.y / mag, z: c.z / mag, w: r / mag };
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function applyQuatToVec3(v: Vec3, q: Quat): Vec3 {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

/**
 * Pure analytical two-bone IK solver using the Law of Cosines (`POL-28`).
 */
export function solveTwoBoneIk(input: TwoBoneIkInput): TwoBoneIkSolution {
  const { rootPos, midPos, endPos, targetPos, polePos } = input;
  const restUpper = sub(midPos, rootPos);
  const restLower = sub(endPos, midPos);
  const upperLen = Math.max(1e-4, len(restUpper));
  const lowerLen = Math.max(1e-4, len(restLower));

  const toTarget = sub(targetPos, rootPos);
  const rawDist = len(toTarget);
  const minReach = Math.abs(upperLen - lowerLen) + 1e-4;
  const maxReach = (upperLen + lowerLen) * 0.9995;
  const withinReach = rawDist >= minReach && rawDist <= maxReach;
  const reachDist = Math.max(minReach, Math.min(maxReach, rawDist));

  const dir = normalize(toTarget, { x: 0, y: 0, z: 1 });
  const rawPole = sub(polePos, rootPos);
  const poleProj = sub(rawPole, scale(dir, dot(rawPole, dir)));
  const poleDir = normalize(
    poleProj,
    Math.abs(dir.y) < 0.9 ? normalize(cross(dir, { x: 0, y: 1, z: 0 })) : { x: 1, y: 0, z: 0 },
  );

  // Law of Cosines at shoulder (alpha) and elbow (beta)
  const cosAlpha = Math.max(
    -1,
    Math.min(1, (upperLen * upperLen + reachDist * reachDist - lowerLen * lowerLen) / (2 * upperLen * reachDist)),
  );
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  const cosBeta = Math.max(
    -1,
    Math.min(1, (upperLen * upperLen + lowerLen * lowerLen - reachDist * reachDist) / (2 * upperLen * lowerLen)),
  );
  const elbowAngleRad = Math.acos(cosBeta);

  const jointPos = add(
    rootPos,
    add(scale(dir, upperLen * cosAlpha), scale(poleDir, upperLen * sinAlpha)),
  );
  const solvedEndPos = add(rootPos, scale(dir, reachDist));

  const restUpperDir = normalize(restUpper, { x: 0, y: -1, z: 0 });
  const solvedUpperDir = normalize(sub(jointPos, rootPos), restUpperDir);
  const upperDeltaQuat = quatFromUnitVectors(restUpperDir, solvedUpperDir);

  const rotatedLowerDir = applyQuatToVec3(normalize(restLower, { x: 0, y: -1, z: 0 }), upperDeltaQuat);
  const solvedLowerDir = normalize(sub(solvedEndPos, jointPos), rotatedLowerDir);
  const lowerDeltaQuat = quatFromUnitVectors(rotatedLowerDir, solvedLowerDir);

  return {
    upperLen,
    lowerLen,
    reachDist,
    withinReach,
    elbowAngleRad,
    jointPos,
    solvedEndPos,
    upperDeltaQuat,
    lowerDeltaQuat,
  };
}

/**
 * Structural interface matching Three.js `Object3D` bones so `solveLeftArmForegripIk`
 * works on real `THREE.Object3D` instances without importing `three` in pure tests.
 */
export interface Bone3DLike {
  readonly parent: Bone3DLike | null;
  readonly quaternion: { x: number; y: number; z: number; w: number; set(x: number, y: number, z: number, w: number): unknown };
  updateMatrixWorld(force?: boolean): void;
  getWorldPosition(target: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }): { x: number; y: number; z: number };
  getWorldQuaternion(target: { x: number; y: number; z: number; w: number; set(x: number, y: number, z: number, w: number): unknown }): { x: number; y: number; z: number; w: number };
}

/**
 * A column-major 4x4 (three.js `Matrix4.elements`) to a unit quaternion, as three.js `Quaternion.setFromRotationMatrix` does it.
 * The scale and any mirror are taken out first (three.js `decompose` does the same), so a scaled or mirrored bone still reads its rotation.
 */
function quatFromMatrixElements(te: ArrayLike<number>, out: { x: number; y: number; z: number; w: number }): void {
  const det = te[0]! * (te[5]! * te[10]! - te[9]! * te[6]!) - te[4]! * (te[1]! * te[10]! - te[9]! * te[2]!) + te[8]! * (te[1]! * te[6]! - te[5]! * te[2]!);
  const sx = (det < 0 ? -1 : 1) * (Math.hypot(te[0]!, te[1]!, te[2]!) || 1);
  const sy = Math.hypot(te[4]!, te[5]!, te[6]!) || 1;
  const sz = Math.hypot(te[8]!, te[9]!, te[10]!) || 1;
  const m11 = te[0]! / sx, m12 = te[4]! / sy, m13 = te[8]! / sz;
  const m21 = te[1]! / sx, m22 = te[5]! / sy, m23 = te[9]! / sz;
  const m31 = te[2]! / sx, m32 = te[6]! / sy, m33 = te[10]! / sz;
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    out.w = 0.25 / s; out.x = (m32 - m23) * s; out.y = (m13 - m31) * s; out.z = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
    out.w = (m32 - m23) / s; out.x = 0.25 * s; out.y = (m12 + m21) / s; out.z = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
    out.w = (m13 - m31) / s; out.x = (m12 + m21) / s; out.y = 0.25 * s; out.z = (m23 + m32) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
    out.w = (m21 - m12) / s; out.x = (m13 + m31) / s; out.y = (m23 + m32) / s; out.z = 0.25 * s;
  }
}

// three.js writes into the target it is given: Object3D.getWorldPosition calls target.setFromMatrixPosition and
// Object3D.getWorldQuaternion calls target.setFromRotationMatrix (through Matrix4.decompose). The targets below supply
// those methods, so the solver reads the real bones (POL-28 in the game; a plain `set` alone threw inside the frame).
function readWorldPos(b: Bone3DLike): Vec3 {
  const out = {
    x: 0, y: 0, z: 0,
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; },
    setFromMatrixPosition(m: { readonly elements: ArrayLike<number> }) { this.x = m.elements[12]!; this.y = m.elements[13]!; this.z = m.elements[14]!; return this; },
  };
  b.getWorldPosition(out);
  return { x: out.x, y: out.y, z: out.z };
}

function readWorldQuat(b: Bone3DLike): Quat {
  const out = {
    x: 0, y: 0, z: 0, w: 1,
    set(x: number, y: number, z: number, w: number) { this.x = x; this.y = y; this.z = z; this.w = w; return this; },
    setFromRotationMatrix(m: { readonly elements: ArrayLike<number> }) { quatFromMatrixElements(m.elements, this); return this; },
  };
  b.getWorldQuaternion(out);
  return { x: out.x, y: out.y, z: out.z, w: out.w };
}

/**
 * Applies the analytical two-bone IK solution directly to `upperArm` (`mixamorigLeftArm`)
 * and `foreArm` (`mixamorigLeftForeArm`) so `hand` (`mixamorigLeftHand`) meets `foregripWorld` (`POL-28`).
 */
export function solveLeftArmForegripIk(
  upperArm: Bone3DLike | null,
  foreArm: Bone3DLike | null,
  hand: Bone3DLike | null,
  foregripWorld: Vec3,
  poleWorld: Vec3,
): TwoBoneIkSolution | null {
  if (!upperArm || !foreArm || !hand) return null;
  upperArm.updateMatrixWorld(true);

  const rootPos = readWorldPos(upperArm);
  const midPos = readWorldPos(foreArm);
  const endPos = readWorldPos(hand);

  const sol = solveTwoBoneIk({
    rootPos,
    midPos,
    endPos,
    targetPos: foregripWorld,
    polePos: poleWorld,
  });

  // 1. Apply upperDeltaQuat in world space to upperArm
  const upperParentWorldQ = upperArm.parent ? readWorldQuat(upperArm.parent) : { x: 0, y: 0, z: 0, w: 1 };
  const upperWorldQ = readWorldQuat(upperArm);
  const newUpperWorldQ = quatMultiply(sol.upperDeltaQuat, upperWorldQ);
  const newUpperLocalQ = quatMultiply(quatConjugate(upperParentWorldQ), newUpperWorldQ);
  upperArm.quaternion.set(newUpperLocalQ.x, newUpperLocalQ.y, newUpperLocalQ.z, newUpperLocalQ.w);
  upperArm.updateMatrixWorld(true);

  // 2. Recompute lower delta from updated forearm pose so hand lands on solvedEndPos
  const updatedMidPos = readWorldPos(foreArm);
  const updatedEndPos = readWorldPos(hand);
  const curLowerDir = normalize(sub(updatedEndPos, updatedMidPos), { x: 0, y: -1, z: 0 });
  const wantLowerDir = normalize(sub(sol.solvedEndPos, updatedMidPos), curLowerDir);
  const lowerDelta = quatFromUnitVectors(curLowerDir, wantLowerDir);

  const foreParentWorldQ = foreArm.parent ? readWorldQuat(foreArm.parent) : newUpperWorldQ;
  const foreWorldQ = readWorldQuat(foreArm);
  const newForeWorldQ = quatMultiply(lowerDelta, foreWorldQ);
  const newForeLocalQ = quatMultiply(quatConjugate(foreParentWorldQ), newForeWorldQ);
  foreArm.quaternion.set(newForeLocalQ.x, newForeLocalQ.y, newForeLocalQ.z, newForeLocalQ.w);
  foreArm.updateMatrixWorld(true);

  return sol;
}
