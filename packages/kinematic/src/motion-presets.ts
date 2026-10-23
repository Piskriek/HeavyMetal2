/**
 * PLAN-43 (motion): 5-rung modular motion presets. Pure deterministic TS:
 * no Date.now, no Math.random, no DOM/I-O.
 * Rung1 KinematicSpec, Rung2 JumpArcSpec, Rung3 GaitClipSpec,
 * Rung4 MotionPreset (entity), Rung5 MOTION_SHELF (world shelf).
 */
export interface ParamDescriptor {
  readonly key: string; readonly label: string; readonly min: number; readonly max: number;
  readonly step: number; readonly defaultValue: number; readonly unit?: string; readonly group?: string;
}
export interface ParamSchema { readonly id: string; readonly version: number; readonly params: readonly ParamDescriptor[] }
const p = (key: string, label: string, min: number, max: number, step: number, defaultValue: number, unit?: string, group = 'Motion'): ParamDescriptor =>
  ({ key, label, min, max, step, defaultValue, ...(unit ? { unit } : {}), group });

export interface KinematicSpec { readonly moveSpeed: number; readonly sprintMultiplier: number; readonly gravityScale: number; readonly airControl: number; readonly stepUpM: number }
export interface JumpArcSpec { readonly jumpHeight: number; readonly gravityScale: number; readonly airControl: number; readonly coyoteTimeMs: number; readonly jumpBufferMs: number }
export interface GaitClipSpec { readonly stepFrequency: number; readonly strideLength: number; readonly hipBob: number; readonly footIkWeight: number; readonly armSwingDeg: number; readonly leanDeg: number }
export interface MotionPreset { readonly id: string; readonly name: string; readonly kinematic: KinematicSpec; readonly jump: JumpArcSpec; readonly gait: GaitClipSpec }

export const KINEMATIC_SCHEMA: ParamSchema = { id: 'hm.motion.kinematic', version: 1, params: [
  p('moveSpeed', 'Move speed', 0, 12, 0.1, 3.4, 'm/s'), p('sprintMultiplier', 'Sprint multiplier', 1, 3, 0.05, 1.65, 'x'),
  p('gravityScale', 'Gravity scale', 0, 3, 0.05, 1, 'g'), p('airControl', 'Air control', 0, 1, 0.05, 0.45), p('stepUpM', 'Step-up height', 0, 1.5, 0.05, 0.55, 'm'),
]};
export const JUMP_ARC_SCHEMA: ParamSchema = { id: 'hm.motion.jump', version: 1, params: [
  p('jumpHeight', 'Jump height', 0, 5, 0.05, 1.1, 'm', 'Jump'), p('gravityScale', 'Gravity scale', 0, 3, 0.05, 1, 'g', 'Jump'),
  p('airControl', 'Air control', 0, 1, 0.05, 0.45, '', 'Jump'), p('coyoteTimeMs', 'Coyote time', 0, 500, 5, 120, 'ms', 'Jump'), p('jumpBufferMs', 'Jump buffer', 0, 500, 5, 120, 'ms', 'Jump'),
]};
export const GAIT_CLIP_SCHEMA: ParamSchema = { id: 'hm.motion.gait', version: 1, params: [
  p('stepFrequency', 'Step frequency', 0, 6, 0.05, 1.9, 'Hz', 'Gait'), p('strideLength', 'Stride length', 0, 3, 0.05, 0.75, 'm', 'Gait'),
  p('hipBob', 'Hip bob', 0, 0.3, 0.005, 0.035, 'm', 'Gait'), p('footIkWeight', 'Foot IK weight', 0, 1, 0.05, 0.8, '', 'Gait'),
  p('armSwingDeg', 'Arm swing', 0, 90, 1, 28, 'deg', 'Gait'), p('leanDeg', 'Forward lean', -20, 30, 0.5, 4, 'deg', 'Gait'),
]};
/** Flattened slider schema for a whole MotionPreset (Studio/Lab benches). */
export const MOTION_PRESET_SCHEMA: ParamSchema = { id: 'hm.motion.preset', version: 1, params: [
  // The ten canonical tunables named by Plan 43, plus step-up / jump-buffer:
  p('moveSpeed', 'Move speed', 0, 12, 0.1, 3.4, 'm/s'), p('sprintMultiplier', 'Sprint multiplier', 1, 3, 0.05, 1.65, 'x'),
  p('jumpHeight', 'Jump height', 0, 5, 0.05, 1.1, 'm', 'Jump'), p('gravityScale', 'Gravity scale', 0, 3, 0.05, 1, 'g', 'Jump'),
  p('airControl', 'Air control', 0, 1, 0.05, 0.45), p('coyoteTimeMs', 'Coyote time', 0, 500, 5, 120, 'ms', 'Jump'),
  p('stepFrequency', 'Step frequency', 0, 6, 0.05, 1.9, 'Hz', 'Gait'), p('strideLength', 'Stride length', 0, 3, 0.05, 0.75, 'm', 'Gait'),
  p('hipBob', 'Hip bob', 0, 0.3, 0.005, 0.035, 'm', 'Gait'), p('footIkWeight', 'Foot IK weight', 0, 1, 0.05, 0.8, '', 'Gait'),
  p('stepUpM', 'Step-up height', 0, 1.5, 0.05, 0.55, 'm'), p('jumpBufferMs', 'Jump buffer', 0, 500, 5, 120, 'ms', 'Jump'),
  p('armSwingDeg', 'Arm swing', 0, 90, 1, 28, 'deg', 'Gait'), p('leanDeg', 'Forward lean', -20, 30, 0.5, 4, 'deg', 'Gait'),
]};
export type MotionParamSchema = ParamSchema;

const inRange = (errs: string[], name: string, v: number, lo: number, hi: number): void => {
  if (!Number.isFinite(v) || v < lo || v > hi) errs.push(`${name} must be a finite number in [${lo}, ${hi}], got ${v}`);
};
export function validateKinematicSpec(s: KinematicSpec): string[] { const e: string[] = [];
  inRange(e, 'moveSpeed', s.moveSpeed, 0, 12); inRange(e, 'sprintMultiplier', s.sprintMultiplier, 1, 3);
  inRange(e, 'gravityScale', s.gravityScale, 0, 3); inRange(e, 'airControl', s.airControl, 0, 1); inRange(e, 'stepUpM', s.stepUpM, 0, 1.5); return e; }
export function validateJumpArcSpec(s: JumpArcSpec): string[] { const e: string[] = [];
  inRange(e, 'jumpHeight', s.jumpHeight, 0, 5); inRange(e, 'gravityScale', s.gravityScale, 0, 3);
  inRange(e, 'airControl', s.airControl, 0, 1); inRange(e, 'coyoteTimeMs', s.coyoteTimeMs, 0, 500); inRange(e, 'jumpBufferMs', s.jumpBufferMs, 0, 500); return e; }
export function validateGaitClipSpec(s: GaitClipSpec): string[] { const e: string[] = [];
  inRange(e, 'stepFrequency', s.stepFrequency, 0, 6); inRange(e, 'strideLength', s.strideLength, 0, 3);
  inRange(e, 'hipBob', s.hipBob, 0, 0.3); inRange(e, 'footIkWeight', s.footIkWeight, 0, 1);
  inRange(e, 'armSwingDeg', s.armSwingDeg, 0, 90); inRange(e, 'leanDeg', s.leanDeg, -20, 30); return e; }
export function validateMotionPreset(preset: MotionPreset): string[] { const e: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(preset.id)) e.push(`id must be a lowercase slug, got "${preset.id}"`);
  if (!preset.name.trim()) e.push('name must not be empty');
  for (const m of validateKinematicSpec(preset.kinematic)) e.push(`kinematic.${m}`);
  for (const m of validateJumpArcSpec(preset.jump)) e.push(`jump.${m}`);
  for (const m of validateGaitClipSpec(preset.gait)) e.push(`gait.${m}`);
  // Cross-rung coherence: gait cadence implied by speed/stride should not be absurd.
  const implied = preset.gait.strideLength > 0 ? preset.kinematic.moveSpeed / preset.gait.strideLength : 0;
  if (implied > 12) e.push(`gait stride too short for moveSpeed (implied ${implied.toFixed(2)} Hz)`);
  return e; }
export const validateMotionSpec = validateMotionPreset;

const mk = (id: string, name: string, kinematic: KinematicSpec, jump: Partial<JumpArcSpec>, gait: GaitClipSpec): MotionPreset => ({
  id, name, kinematic, jump: { jumpHeight: 1.1, gravityScale: kinematic.gravityScale, airControl: kinematic.airControl, coyoteTimeMs: 120, jumpBufferMs: 120, ...jump }, gait,
});
export const MOTION_SHELF: Readonly<Record<string, MotionPreset>> = Object.freeze({
  'hazmat-standard': mk('hazmat-standard', 'Hazmat Standard', { moveSpeed: 3.4, sprintMultiplier: 1.65, gravityScale: 1, airControl: 0.45, stepUpM: 0.55 }, {}, { stepFrequency: 1.9, strideLength: 0.75, hipBob: 0.035, footIkWeight: 0.8, armSwingDeg: 28, leanDeg: 4 }),
  'lunar-low-g': mk('lunar-low-g', 'Lunar Low-G', { moveSpeed: 3.2, sprintMultiplier: 1.6, gravityScale: 0.25, airControl: 0.7, stepUpM: 0.65 }, { jumpHeight: 2.2, coyoteTimeMs: 180, jumpBufferMs: 160 }, { stepFrequency: 1.3, strideLength: 1.05, hipBob: 0.055, footIkWeight: 0.65, armSwingDeg: 22, leanDeg: 3 }),
  'heavy-exo-march': mk('heavy-exo-march', 'Heavy Exo March', { moveSpeed: 2.4, sprintMultiplier: 1.35, gravityScale: 1.15, airControl: 0.25, stepUpM: 0.7 }, { jumpHeight: 0.65, coyoteTimeMs: 80 }, { stepFrequency: 1.25, strideLength: 0.9, hipBob: 0.022, footIkWeight: 1, armSwingDeg: 14, leanDeg: 6 }),
  'scout-agile': mk('scout-agile', 'Scout Agile', { moveSpeed: 4.4, sprintMultiplier: 1.9, gravityScale: 0.95, airControl: 0.75, stepUpM: 0.6 }, { jumpHeight: 1.45, coyoteTimeMs: 150 }, { stepFrequency: 2.5, strideLength: 0.85, hipBob: 0.045, footIkWeight: 0.7, armSwingDeg: 42, leanDeg: 9 }),
  'zero-g-thruster': mk('zero-g-thruster', 'Zero-G Thruster', { moveSpeed: 2.8, sprintMultiplier: 1.8, gravityScale: 0.02, airControl: 1, stepUpM: 0 }, { jumpHeight: 0.8, coyoteTimeMs: 250, jumpBufferMs: 200 }, { stepFrequency: 0.6, strideLength: 0.4, hipBob: 0.008, footIkWeight: 0, armSwingDeg: 12, leanDeg: 2 }),
  'retro-doom-glide': mk('retro-doom-glide', 'Retro Doom Glide', { moveSpeed: 5.2, sprintMultiplier: 1.45, gravityScale: 1.05, airControl: 0.9, stepUpM: 0.45 }, { jumpHeight: 1, coyoteTimeMs: 100 }, { stepFrequency: 2.8, strideLength: 1.1, hipBob: 0.015, footIkWeight: 0, armSwingDeg: 18, leanDeg: 7 }),
});

export interface KinematicMotionState {
  readonly pos: readonly [number, number, number]; readonly vy: number; readonly onGround: boolean;
  readonly coyoteMs: number; readonly jumpBufferMs: number; readonly gaitPhase: number; readonly bobOffset: number;
  readonly speedMps: number; readonly justJumped: boolean; readonly justLanded: boolean;
}
export interface KinematicMotionInput { readonly move: readonly [number, number]; readonly sprint?: boolean; readonly jumpPressed?: boolean; readonly jumpHeld?: boolean; readonly groundY?: number }
export const createKinematicMotionState = (pos: readonly [number, number, number] = [0, 0, 0]): KinematicMotionState =>
  ({ pos: [pos[0], pos[1], pos[2]], vy: 0, onGround: true, coyoteMs: 0, jumpBufferMs: 0, gaitPhase: 0, bobOffset: 0, speedMps: 0, justJumped: false, justLanded: false });
export const initialKinematicMotionState = createKinematicMotionState;

/** Velocity (m/s) needed to reach `jump.jumpHeight` under the preset gravity. */
export const jumpVelocityFor = (spec: MotionPreset): number => Math.sqrt(2 * 9.8 * Math.max(0, spec.jump.gravityScale) * Math.max(0, spec.jump.jumpHeight));

/**
 * One fixed step of locomotion+jump+gait. Horizontal control is direct on the
 * ground and scaled by airControl in the air; gravity is 9.8*gravityScale and
 * jump velocity is derived from jumpHeight so apex honours the slider.
 */
export function stepKinematicMotion(spec: MotionPreset, state: KinematicMotionState, input: KinematicMotionInput, dt: number): KinematicMotionState {
  const step = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
  const groundY = input.groundY ?? 0;
  const gravity = 9.8 * spec.jump.gravityScale;
  let coyoteMs = state.onGround ? spec.jump.coyoteTimeMs : Math.max(0, state.coyoteMs - step * 1000);
  let jumpBufferMs = input.jumpPressed ? spec.jump.jumpBufferMs : Math.max(0, state.jumpBufferMs - step * 1000);
  let vy = state.vy; let onGround = state.onGround; let justJumped = false; let justLanded = false;
  if ((onGround || coyoteMs > 0) && (jumpBufferMs > 0 || (input.jumpPressed && spec.jump.jumpBufferMs === 0))) {
    vy = jumpVelocityFor(spec); onGround = false; justJumped = true; coyoteMs = 0; jumpBufferMs = 0;
  }
  const [mx, mz] = input.move; const mag = Math.hypot(mx, mz);
  const nx = mag > 1 ? mx / mag : mx, nz = mag > 1 ? mz / mag : mz;
  const control = onGround ? 1 : spec.kinematic.airControl;
  const targetSpeed = spec.kinematic.moveSpeed * (input.sprint ? spec.kinematic.sprintMultiplier : 1);
  const speedMps = targetSpeed * Math.min(1, mag) * (onGround ? 1 : Math.max(control, 0));
  // In air, horizontal velocity is simply the controlled wish velocity (deterministic arcade model).
  const vx = nx * targetSpeed * (onGround ? 1 : control), vz = nz * targetSpeed * (onGround ? 1 : control);
  let y = state.pos[1]; let x = state.pos[0] + vx * step; let z = state.pos[2] + vz * step;
  if (!onGround) { y += vy * step; vy -= gravity * step; if (gravity === 0 && vy !== 0) { /* drift */ }
    if (y <= groundY && vy <= 0) { y = groundY; vy = 0; onGround = true; justLanded = true; } }
  else { y = groundY; vy = 0; }
  const moving = onGround && speedMps > 0.01;
  const gaitPhase = moving ? (state.gaitPhase + step * spec.gait.stepFrequency * (speedMps / Math.max(0.01, spec.kinematic.moveSpeed))) % 1 : state.gaitPhase;
  const bobOffset = moving ? Math.abs(Math.sin(gaitPhase * Math.PI * 2)) * spec.gait.hipBob : 0;
  return { pos: [x, y, z], vy, onGround, coyoteMs, jumpBufferMs, gaitPhase, bobOffset, speedMps: moving || !onGround ? Math.hypot(vx, vz) : 0, justJumped, justLanded };
}

/** Gait sample at a phase in [0,1): foot lifts + bob, scaled by foot-IK weight. */
export function evaluateGaitClip(spec: GaitClipSpec, phase: number, speedRatio = 1): { readonly leftFootLift: number; readonly rightFootLift: number; readonly bobOffset: number; readonly footIkWeight: number } {
  const ph = ((phase % 1) + 1) % 1; const s = Math.max(0, Math.min(2, speedRatio));
  return { leftFootLift: Math.max(0, Math.sin(ph * Math.PI * 2)) * 0.12 * s, rightFootLift: Math.max(0, Math.sin((ph + 0.5) * Math.PI * 2)) * 0.12 * s, bobOffset: Math.abs(Math.sin(ph * Math.PI * 2)) * spec.hipBob * s, footIkWeight: spec.footIkWeight };
}
export const serializeMotionPreset = (preset: MotionPreset): string => JSON.stringify(preset);
export function parseMotionPreset(json: string): MotionPreset | null {
  try { const v = JSON.parse(json) as MotionPreset; return v && typeof v === 'object' && validateMotionPreset(v).length === 0 ? v : null; } catch { return null; }
}
/* Cartridge hook (`mot:<presetId>`, Beam Rifle Apply mode). */
export const motionCartridgeId = (presetId: string): string => `mot:${presetId}`;
export function resolveMotionCartridge(cartridgeId: string): MotionPreset | null {
  if (!cartridgeId.startsWith('mot:')) return null; const id = cartridgeId.slice(4); return MOTION_SHELF[id] ?? null; }
export const parseMotionCartridgeId = resolveMotionCartridge;
export function applyMotionCartridge<T extends object>(target: T, cartridgeId: string): (T & { readonly motion: MotionPreset; readonly motionPresetId: string }) | null {
  const motion = resolveMotionCartridge(cartridgeId); if (!motion) return null; return { ...target, motion, motionPresetId: motion.id }; }
export const applyMotionPreset = applyMotionCartridge;
