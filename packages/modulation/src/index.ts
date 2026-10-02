/**
 * @games/modulation — every value in the tool can be driven by a modulator:
 * a small, serialisable, deterministic value source.
 */

export type {
  Ease,
  Keyframe,
  ModContext,
  Modulator,
  ModulatorDef,
  Range,
} from './types';

export { applyEase, clamp01, clamp, lerp, frac, wrap, map01, smoothstep } from './ease';
export { hash01, hash32, gaussian01 } from './rng';

export { createModulator } from './modulator';
export type { Source } from './sources';
export { validateModulator, type ValidationResult } from './validate';
export { normalizeModulator } from './normalize';
export { describeModulator, rangeOf } from './describe';
export { MODULATOR_PRESETS, presetById, type ModulatorPreset } from './presets';
