/** PLAN-43 Rung-3 gait clips for @hm/anim: gait spec -> Pose, pure/deterministic. */
import { restPose, type Pose } from './index';
export interface GaitClipSpec { readonly stepFrequency: number; readonly strideLength: number; readonly hipBob: number; readonly footIkWeight: number; readonly armSwingDeg: number; readonly leanDeg: number }
export interface ParamDescriptor { readonly key: string; readonly label: string; readonly min: number; readonly max: number; readonly step: number; readonly defaultValue: number; readonly unit?: string; readonly group?: string }
export interface ParamSchema { readonly id: string; readonly version: number; readonly params: readonly ParamDescriptor[] }
const p = (key: string, label: string, min: number, max: number, step: number, defaultValue: number, unit?: string): ParamDescriptor => ({ key, label, min, max, step, defaultValue, ...(unit ? { unit } : {}), group: 'Gait' });
export const GAIT_CLIP_SCHEMA: ParamSchema = { id: 'hm.anim.gait', version: 1, params: [
  p('stepFrequency', 'Step frequency', 0, 6, 0.05, 1.9, 'Hz'), p('strideLength', 'Stride length', 0, 3, 0.05, 0.75, 'm'),
  p('hipBob', 'Hip bob', 0, 0.3, 0.005, 0.035, 'm'), p('footIkWeight', 'Foot IK weight', 0, 1, 0.05, 0.8),
  p('armSwingDeg', 'Arm swing', 0, 90, 1, 28, 'deg'), p('leanDeg', 'Forward lean', -20, 30, 0.5, 4, 'deg')] };
export function validateGaitClipSpec(s: GaitClipSpec): string[] { const e: string[] = [];
  const chk = (n: string, v: number, lo: number, hi: number): void => { if (!Number.isFinite(v) || v < lo || v > hi) e.push(`${n} must be in [${lo}, ${hi}], got ${v}`); };
  chk('stepFrequency', s.stepFrequency, 0, 6); chk('strideLength', s.strideLength, 0, 3); chk('hipBob', s.hipBob, 0, 0.3); chk('footIkWeight', s.footIkWeight, 0, 1); chk('armSwingDeg', s.armSwingDeg, 0, 90); chk('leanDeg', s.leanDeg, -20, 30); return e; }
/** Pose for a gait clip at timeSec (same sine gait family as the walk preset). */
export function gaitPoseAt(spec: GaitClipSpec, timeSec: number, pace = 1): Pose {
  const out = restPose(); if (validateGaitClipSpec(spec).length) return out;
  const t = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0; const k = Number.isFinite(pace) ? Math.max(0, pace) : 1;
  const ph = t * spec.stepFrequency * k * Math.PI * 2; const s = Math.sin(ph); const d = Math.PI / 180;
  const leg = Math.min(80, spec.strideLength * 55) * d;
  out.bones.legL.rx = leg * s; out.bones.legR.rx = -leg * s;
  out.bones.armL.rx = -spec.armSwingDeg * d * s; out.bones.armR.rx = spec.armSwingDeg * d * s;
  out.lift = spec.hipBob * (1 - Math.cos(2 * ph)) / 2; out.lean = spec.leanDeg * d;
  out.bones.body.ry = 6 * d * s; out.bones.body.rz = 3 * d * s; return out;
}
export const evaluateGaitClipPose = gaitPoseAt;
