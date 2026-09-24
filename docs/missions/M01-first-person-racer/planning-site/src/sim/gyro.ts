// Reference implementation of IF-GYRO (roll law) and IF-COCKPIT (layout/yoke/arms).
export const RADIUS = 31;
export const TAU = Math.PI * 2;
export const CAP_THETA = 0.62;
export const AIR_ROLL_DECAY = 0.6;

export function advanceRoll(
  state: { rollPhase: number; rollRate: number },
  motion: { vx: number; vz: number; grounded: boolean; inLoop: boolean },
  dt: number,
) {
  let { rollPhase, rollRate } = state;
  if (motion.grounded || motion.inLoop) {
    rollRate = Math.hypot(motion.vx, motion.vz) / RADIUS;
  } else {
    rollRate *= Math.exp(-AIR_ROLL_DECAY * dt);
  }
  rollPhase = (((rollPhase + rollRate * dt) % TAU) + TAU) % TAU;
  return { rollPhase, rollRate };
}

// ---- cockpit -------------------------------------------------------------
export const YOKE_MAX_DEG = 38;
export const VZ_MAX = 650;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function steerFrom(vz: number, handling: number): number {
  const s = clamp(-vz / (VZ_MAX * handling), -1, 1);
  return s === 0 ? 0 : s; // normalise -0
}
export const yokeAngleDeg = (steer: number) => steer * YOKE_MAX_DEG;

export function needleAngle(value: number, min: number, max: number, sweepDeg: number): number {
  const t = clamp((value - min) / (max - min), 0, 1);
  return -sweepDeg / 2 + t * sweepDeg;
}

export interface CockpitLayout {
  w: number;
  h: number;
  aperture: { x: number; y: number; w: number; h: number; radius: number };
  horizonY: number;
  yokeHub: { x: number; y: number };
  yokeHalfSpan: number;
  shoulderL: { x: number; y: number };
  shoulderR: { x: number; y: number };
}

export function cockpitLayout(w: number, h: number): CockpitLayout {
  const aperture = { x: w * 0.07, y: h * 0.06, w: w * 0.86, h: h * 0.56, radius: h * 0.09 };
  const yokeHalfSpan = Math.min(w * 0.17, h * 0.3);
  return {
    w,
    h,
    aperture,
    horizonY: aperture.y + aperture.h / 2,
    yokeHub: { x: w / 2, y: h * 0.84 },
    yokeHalfSpan,
    shoulderL: { x: w / 2 - yokeHalfSpan * 1.55, y: h + h * 0.16 },
    shoulderR: { x: w / 2 + yokeHalfSpan * 1.55, y: h + h * 0.16 },
  };
}

export interface ArmPose {
  x: number;
  y: number;
  rotDeg: number;
  length: number;
  grip: { x: number; y: number };
}

export function gripPoints(layout: CockpitLayout, yokeDeg: number) {
  const a = (yokeDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // grip centres match the yoke art: viewBox (±93, 17) at scale yokeHalfSpan/100
  const off = layout.yokeHalfSpan * 0.93;
  const lift = layout.yokeHalfSpan * 0.17;
  const rot = (dx: number, dy: number) => ({ x: layout.yokeHub.x + dx * c - dy * s, y: layout.yokeHub.y + dx * s + dy * c });
  return { left: rot(-off, lift), right: rot(off, lift) };
}

export function armPose(layout: CockpitLayout, yokeDeg: number): { left: ArmPose; right: ArmPose } {
  const g = gripPoints(layout, yokeDeg);
  const mk = (sh: { x: number; y: number }, grip: { x: number; y: number }): ArmPose => ({
    x: sh.x,
    y: sh.y,
    rotDeg: (Math.atan2(grip.y - sh.y, grip.x - sh.x) * 180) / Math.PI,
    length: Math.hypot(grip.x - sh.x, grip.y - sh.y),
    grip,
  });
  return { left: mk(layout.shoulderL, g.left), right: mk(layout.shoulderR, g.right) };
}

// Lane steering PD spring (verbatim law from racer-physics.ts:320-333, dry branch).
export function steerStep(
  st: { z: number; vz: number },
  targetZ: number,
  dt: number,
  handling = 1,
  bounds: { zMin: number; zMax: number } = { zMin: -480 + 37, zMax: 480 - 37 },
  locked = false,
  wet = false,
) {
  const response = (locked ? 7 : wet ? 20 : 33) * handling;
  const steering = (targetZ - st.z) * response - st.vz * (wet ? 6.2 : 9.5) * Math.sqrt(handling);
  let vz = clamp(st.vz + steering * dt, -650 * handling, 650 * handling);
  const prevZ = st.z;
  const z = clamp(st.z + vz * dt, bounds.zMin, bounds.zMax);
  if (z === prevZ && Math.abs(vz) > 1) vz *= -0.25;
  return { z, vz };
}
