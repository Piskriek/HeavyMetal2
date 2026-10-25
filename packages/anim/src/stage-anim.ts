/**
 * Plan 43 (`anim:`): the stage-fidelity animation cadence, as `@hm/anim`'s own contract.
 *
 * A pose is a pure function of `(preset, time)`; what a Fidelity Stage changes is how often that function is asked. S0
 * holds a pose for 1/8 s (wireframe stop-motion), S1 for 1/12 s (EGA), S2 for 1/18 s (VGA), S3 for 1/30 s (Gouraud), and
 * S4..S6 sample at the frame cadence — 60 Hz — so the spring-damper and IK poses read as continuous.
 *
 * The table itself lives once, in `@hm/kinematic` (it is the same ladder the kit motion presets evaluate on); this module
 * is the skeletal half: `poseAtStage` quantises the clock before the pose is interpolated, so the Studio's scrubbar can
 * seek to any timestamp and get the pose that frame showed — never a pose that depends on what the previous frame did.
 */
import { poseAt, type AnimPreset, type Pose } from './index';
import { quantizeStageTime, stageAnimRateHz } from '@hm/kinematic';

export { quantizeStageTime, stageAnimRateHz };

/** The animation sample rate a Fidelity Stage draws at (8, 12, 18, 30, then the 60 Hz frame cadence). */
export const STAGE_ANIM_HZ: readonly number[] = Object.freeze([8, 12, 18, 30, 60, 60, 60]);

/** `stageAnimRateHz`, clamped to the seven stages the ladder has. */
export function stageAnimHz(stage: number): number {
  const s = Number.isFinite(stage) ? Math.max(0, Math.min(6, Math.trunc(stage))) : 0;
  return STAGE_ANIM_HZ[s] as number;
}

/** How long a pose is held at this stage (seconds): the step a stop-motion stage moves in. */
export function stageAnimStepSeconds(stage: number): number {
  return 1 / stageAnimHz(stage);
}

/** The clock the stage samples: the sample's own timestamp, so a held pose is a value and not a running total. */
export function stageAnimTime(timeSec: number, stage: number): number {
  return quantizeStageTime(timeSec, stage);
}

/**
 * A skeletal pose at `timeSec` on a stage: the preset's pose evaluated at the stage's quantised clock. Pure: the same
 * arguments always give the same pose, so a scrubber, a replay and a networked peer all agree on the frame.
 */
export function poseAtStage(preset: AnimPreset, timeSec: number, stage: number, pace = 1): Pose {
  return poseAt(preset, stageAnimTime(timeSec, stage), pace);
}
