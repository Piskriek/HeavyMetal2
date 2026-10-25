/**
 * Every moving part of a plot machine, written down as data (plan 43, `anim:`): a `KitMotionSpec` names what moves, on
 * which axis, how fast and how far — and nothing else.
 *
 * The pose itself comes from `@hm/kinematic`'s `evaluateKitMotion`, which is pure in `(simTime, stage)`. That is the point of
 * the table: the ram's stroke, the projector head's sway and the drill's spin are no longer `Math.sin` closures buried in a
 * builder, so the Studio scrubbar, a replayed session and a net peer running at a different frame rate all put the part in
 * the same place at the same timestamp. There is no `pos += vel * dt` here, and any `t` can be evaluated without replaying
 * the ticks before it.
 *
 * Rates are in Hz (cycles per second). The plume cadences in `machine-props.ts` (ARGO_NOTE_08 section 3) are written in
 * radians per second, so the ram stroke is derived from its pour cadence with `strokeHz`: the pour pulses when the ram
 * strikes, because both read the same number.
 */
import type { KitMotionSpec } from '@hm/kitspec';
import type { MachineKind } from '@hm/plotsim';

const TAU = Math.PI * 2;

/** A cadence written in radians per second (the plume table's unit) as the Hz a motion spec takes. */
export const strokeHz = (radPerSec: number): number => radPerSec / TAU;

/**
 * The angular rates the plume cadences and the part strokes share (ARGO_NOTE_08 section 3): a Shape Press pours on
 * `ram-fast`'s beat and its rams strike on it, and a Heavy Shape Press does both on `ram-heavy`'s. One number, two users.
 */
export const RAM_CADENCE_RAD = { fast: 3.1, heavy: 2.0 } as const;

/** The Shape Press's ram stroke: one strike per `ram-fast` pulse, 0.35 m down from its rest. */
export const PRESS_RAM_STROKE: KitMotionSpec = {
  kind: 'reciprocate', axis: 'y', rateHz: strokeHz(RAM_CADENCE_RAD.fast), amplitude: 0.35,
};

/** The other ram of the twin: half a cycle behind, so one is down while the other is up. */
export const PRESS_RAM_STROKE_B: KitMotionSpec = { ...PRESS_RAM_STROKE, phaseRad: Math.PI };

/** A generated press core's rams: the same beat, a shorter tap (the core's die bed gives less room than the kit frame). */
export const PRESS_CORE_RAM_STROKE: KitMotionSpec = {
  kind: 'reciprocate', axis: 'y', rateHz: strokeHz(RAM_CADENCE_RAD.fast), amplitude: 0.18,
};

/** The Heavy Shape Press's ram: the `ram-heavy` beat, a full 0.6 m of travel. */
export const HEAVY_PRESS_RAM_STROKE: KitMotionSpec = {
  kind: 'reciprocate', axis: 'y', rateHz: strokeHz(RAM_CADENCE_RAD.heavy), amplitude: 0.6,
};

/** The Heavy Shape Press's second ram, half a cycle behind (the kit frame's twin). */
export const HEAVY_PRESS_RAM_STROKE_B: KitMotionSpec = { ...HEAVY_PRESS_RAM_STROKE, phaseRad: Math.PI };

/** A projector head's slow sway on its mount: +-0.08 rad, a little under three seconds a cycle. */
export const PROJECTOR_HEAD_TILT: KitMotionSpec = {
  kind: 'oscillate', axis: 'x', rateHz: strokeHz(0.35), amplitude: 0.08,
};

/** A drill bit's spin: 9 rad/s, positive about its own y (`spin` ignores `amplitude` and turns at `rateHz`). */
export const DRILL_BIT_SPIN: KitMotionSpec = { kind: 'spin', axis: 'y', rateHz: 9 / TAU, amplitude: 1 };

/** The housing status LED's amber blink while a machine is idle or browned out: 2 Hz, mostly on (`>= -0.1` of the wave). */
export const HOUSING_LED_BLINK: KitMotionSpec = { kind: 'oscillate', axis: 'y', rateHz: 2, amplitude: 1 };

/** One moving part of a kind's prop: the handle its builder gives the object, and what that object does. */
export interface MachineMotionPart {
  readonly part: string;
  readonly spec: KitMotionSpec;
}

/**
 * What each kind's machine does while it runs, by handle. A builder binds the handle it built (`bit`, `ram-a`, `ram-b`,
 * `head`) and the scene animates it; a kind with no moving part lists none, and its `animate` is `still`.
 *
 * The rarer builders (a generated core, the heavygear model, the field kit) differ in geometry, so where the travel has to
 * differ too — the press's core rams tap rather than strike — they name their own spec from this module. Nothing here is a
 * closure: `machine-motion.ts` turns a spec into a pose.
 */
export const MACHINE_MOTION: Readonly<Record<MachineKind, readonly MachineMotionPart[]>> = {
  drill: [{ part: 'bit', spec: DRILL_BIT_SPIN }],
  mill: [],
  pylon: [],
  press: [{ part: 'ram-a', spec: PRESS_RAM_STROKE }, { part: 'ram-b', spec: PRESS_RAM_STROKE_B }],
  power: [],
  projector: [{ part: 'head', spec: PROJECTOR_HEAD_TILT }],
  water: [],
  'heavy-mill': [],
  'heavy-press': [{ part: 'ram-a', spec: HEAVY_PRESS_RAM_STROKE }, { part: 'ram-b', spec: HEAVY_PRESS_RAM_STROKE_B }],
  'heavy-projector': [{ part: 'head', spec: PROJECTOR_HEAD_TILT }],
  'heavy-water': [],
};

/** The spec a kind's named part runs, or null when nothing by that name moves (the drill's core, a mill's drum). */
export function motionFor(kind: MachineKind, part: string): KitMotionSpec | null {
  return MACHINE_MOTION[kind].find((m) => m.part === part)?.spec ?? null;
}

/** One cycle of a spec in seconds: the period its pose repeats on. Pure. */
export function motionPeriodSeconds(spec: KitMotionSpec): number {
  return spec.rateHz > 0 ? 1 / spec.rateHz : Number.POSITIVE_INFINITY;
}

/**
 * Where a spec's own pose must sit to be legal: a rate that is a positive finite number, an amplitude that is a finite
 * number of metres (a stroke) or radians (a sway). Returns the problems, so a hand-written kit or a saved preset can be
 * checked before its motion is bound rather than animating to NaN.
 */
export function validateMotionSpec(spec: KitMotionSpec): readonly string[] {
  const out: string[] = [];
  if (!Number.isFinite(spec.rateHz) || spec.rateHz <= 0) out.push(`rateHz ${spec.rateHz} is not a positive rate`);
  if (!Number.isFinite(spec.amplitude) || spec.amplitude < 0) out.push(`amplitude ${spec.amplitude} is not a distance`);
  if (spec.phaseRad !== undefined && !Number.isFinite(spec.phaseRad)) out.push(`phaseRad ${spec.phaseRad} is not an angle`);
  return out;
}
