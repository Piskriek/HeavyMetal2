/**
 * Share codes for custom locomotion and kit-motion presets (plan 51, the harness's mechanic mimicry).
 *
 * The curated shelves were the only `loc:` and `anim:` codes there were (`loc:<id>`), so a preset tuned from an observed
 * game had no way to travel. These are readable colon lists, short enough to say on the radio and safe in a URL:
 *
 *   loc:v1:<walk>:<run>:<jump>:<gravity>:<air>:<coyote>:<buffer>:<stepUp>:<ceiling>:<springK>:<springC>
 *   anim:<kind>:<axis>:<rateHz>:<amplitude>:<phaseRad>
 *
 * `loc:<id>` still names a curated preset. Decoding checks every value against the slider ranges, so a hand-edited or
 * hostile code yields null, never a broken body. Pure: no DOM, no clock, no randomness.
 */
import { LOCOMOTION_PRESETS, type KitMotionKind, type KitMotionSpec, type LocomotionPreset, type LocomotionPresetId } from './modular-motion';

/** The slider range of each locomotion field, in code order (a decoded value outside its range refuses the code). */
export const LOCOMOTION_RANGES: readonly (readonly [keyof LocomotionPreset, number, number])[] = [
  ['walkSpeedMps', 0.2, 20],
  ['runSpeedMps', 0.2, 40],
  ['jumpImpulseMps', 0, 30],
  ['gravityMps2', 0.1, 60],
  ['airControl', 0, 1],
  ['coyoteTimeSec', 0, 1],
  ['jumpBufferSec', 0, 1],
  ['stepUpM', 0, 2],
  ['ceilingHeightM', 1, 1000],
  ['landingSpringStiffness', 1, 2000],
  ['landingSpringDamping', 0, 400],
];

const fmt = (v: number): string => String(Math.round(v * 1000) / 1000);

/** A locomotion preset as a share code: a curated one by name, any other as its eleven numbers. */
export function encodeLocomotionCode(p: LocomotionPreset): string {
  const curated = LOCOMOTION_PRESETS[p.id as LocomotionPresetId];
  if (curated && LOCOMOTION_RANGES.every(([k]) => curated[k] === p[k])) return `loc:${p.id}`;
  return `loc:v1:${LOCOMOTION_RANGES.map(([k]) => fmt(p[k] as number)).join(':')}`;
}

/** The preset a code names, or null when the code is malformed or out of range. `name` labels a custom one. */
export function decodeLocomotionCode(code: string, name = 'Custom locomotion'): LocomotionPreset | null {
  if (!code.startsWith('loc:')) return null;
  const body = code.slice(4);
  const curated = LOCOMOTION_PRESETS[body as LocomotionPresetId];
  if (curated) return curated;
  const parts = body.split(':');
  if (parts[0] !== 'v1' || parts.length !== LOCOMOTION_RANGES.length + 1) return null;
  const out: Record<string, number | string> = { id: code, name };
  for (let i = 0; i < LOCOMOTION_RANGES.length; i++) {
    const [key, lo, hi] = LOCOMOTION_RANGES[i]!;
    const v = Number(parts[i + 1]);
    if (!Number.isFinite(v) || v < lo || v > hi) return null;
    out[key] = v;
  }
  return out as unknown as LocomotionPreset;
}

const MOTION_KINDS: readonly KitMotionKind[] = ['reciprocate', 'spin', 'oscillate', 'gantry-slide', 'iris-aperture'];

/** A kit motion as a share code: `anim:<kind>:<axis>:<rateHz>:<amplitude>:<phaseRad>`. */
export function encodeKitMotionCode(m: KitMotionSpec): string {
  return `anim:${m.kind}:${m.axis}:${fmt(m.rateHz)}:${fmt(m.amplitude)}:${fmt(m.phaseRad ?? 0)}`;
}

/** The motion a code names, or null when it is malformed or out of range (rate 0..120 Hz, amplitude 0..10). */
export function decodeKitMotionCode(code: string): KitMotionSpec | null {
  const p = code.split(':');
  if (p.length !== 6 || p[0] !== 'anim') return null;
  const kind = p[1] as KitMotionKind;
  const axis = p[2];
  const rateHz = Number(p[3]), amplitude = Number(p[4]), phaseRad = Number(p[5]);
  if (!MOTION_KINDS.includes(kind) || (axis !== 'x' && axis !== 'y' && axis !== 'z')) return null;
  if (!(rateHz >= 0 && rateHz <= 120) || !(amplitude >= 0 && amplitude <= 10) || !Number.isFinite(phaseRad)) return null;
  return { kind, axis, rateHz, amplitude, phaseRad };
}
