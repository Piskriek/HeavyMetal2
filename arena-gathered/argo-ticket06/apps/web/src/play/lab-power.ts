// The lab's power-on sequence, the dark wake and the wake camera (TASK-28, TICKET-06, P0-LIGHT-03 and P1-HOUR-03).
// Pure: every value is a function of t, the seconds since the main lever was thrown (or since the player woke).
// No DOM, no clock, no three.js, so it is testable.
// lab-room.ts drives its lamps from these numbers, and play-scene.ts drives the camera from wakeLift.
//
// The power-on, in seconds after the lever (6.5 s in all):
//   0.4 to 1.9   the relays click on in a row; their amber beacons light from 0.4 to 1.2;
//   1.2 to 2.4   power runs along the floor covers to the gate;
//   0.9 to 2.7   three banks of cold-white strip lights ignite back to front, 0.6 s each, 0.6 s apart (1.8 s in all);
//   2.0 to 5.5   the gate's coils light bottom to top, 3.5 s; the lights dip from 2.7 to 3.1 and stay down while the gate draws
//                (until 5.0), then recover by 6.3;
//   2.7 to 3.5   the planet table's hologram comes up;
//   1.2 to 2.2   the orange emergency lamps go out;
//   5.4 to 5.7   static resolves in the gate's opening, and the coils' amber arc flash (5.5 to 6.2) reveals the Moon in the opening.

/** The power at one moment: each level 0..1 (the lamps, the banks and the gate read them). */
export interface Power {
  /** Fraction of the relay lamps lit, in order. */
  readonly relays: number;
  /** The relay cabinets' amber beacons (they light with the relays). */
  readonly beacons: number;
  /** Power running along the floor covers. */
  readonly pulse: number;
  /** Fraction of the gate's coils lit, bottom to top (the ignition's sweep). */
  readonly coils: number;
  /** The three banks of cold-white strip lights, back to front (each already dipped while the gate draws). */
  readonly banks: readonly [number, number, number];
  /** The ceiling lights: the mean of the three banks. */
  readonly main: number;
  /** The planet table's hologram. */
  readonly hologram: number;
  /** The orange emergency lamps. */
  readonly emergency: number;
  /** Static in the gate's opening (1 = all static, 0 = a clear picture); the opening shows nothing while coils are 0. */
  readonly static: number;
  /** The gate's amber arc flash at the end of the ignition. */
  readonly arc: number;
}

export const POWER_OFF: Power = { relays: 0, beacons: 0, pulse: 0, coils: 0, banks: [0, 0, 0], main: 0, hologram: 0, emergency: 1, static: 1, arc: 0 };
export const POWER_ON: Power = { relays: 1, beacons: 1, pulse: 1, coils: 1, banks: [1, 1, 1], main: 1, hologram: 1, emergency: 0, static: 0, arc: 0 };
/** The power-on sequence's length, seconds. */
export const POWER_SECONDS = 6.5;

/** The gate's ignition: the coils light bottom to top over this span (3.5 s). */
export const IGNITION = { start: 2.0, end: 5.5 } as const;
export const IGNITION_SECONDS = IGNITION.end - IGNITION.start; // 3.5 s
export const GATE_COIL_COUNT = 6;
/** The three strip banks: the back bank's start, and each bank after it (0.6 s apart), each taking 0.6 s to ignite. */
export const BANK_START: readonly [number, number, number] = [0.9, 1.5, 2.1];
export const BANK_SECONDS = 0.6;

/** The dark wake: the red emergency strobe (1.2 Hz) and its sweep along the power wall (a 2.5 s back-and-forth). */
export const STROBE_HZ = 1.2;
export const SWEEP_HZ = 0.4;
/** The sweep's ends on the west wall, in lab z (south to north). */
export const SWEEP_Z: readonly [number, number] = [-8.0, 1.0];

/** The wake: the camera starts pitched 65 degrees up, at the dark ceiling, and eases to level over 2.2 s as the player sits up. */
export const WAKE_PITCH = (65 * Math.PI) / 180;
export const WAKE_SECONDS = 2.2;

const ramp = (t: number, a: number, b: number): number => Math.max(0, Math.min(1, (t - a) / (b - a)));

/**
 * Pure helper (TICKET-06 — 3.5 s gate coil ignition):
 * Given `coilsProgress` in `[0, 1]` (which spans `t = 2.0 s` to `t = 5.5 s`, i.e. `3.5 s`),
 * returns the individual `0..1` glow level for each of the `count` gate coils ordered bottom to top.
 * Each coil `i` ramps smoothly over its `[i / count, (i + 1) / count]` window, so lower coils
 * always ignite before upper coils and all coils reach `1` at `t = 5.5 s`.
 */
export function coilLevels(coilsProgress: number, count = GATE_COIL_COUNT): number[] {
  const n = Math.max(1, Math.floor(count));
  const c = Math.max(0, Math.min(1, Number.isFinite(coilsProgress) ? coilsProgress : 0));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = i / n;
    const end = (i + 1) / n;
    out.push(ramp(c, start, end));
  }
  return out;
}

/**
 * Returns which gate coils are lit (`level > 0.25`) at `t` seconds after throwing the lever.
 */
export function coilsLitAt(t: number, count = GATE_COIL_COUNT): boolean[] {
  const p = powerAt(t);
  return coilLevels(p.coils, count).map((lvl) => lvl > 0.25);
}

/** The lab at `t` seconds after the main lever is thrown. */
export function powerAt(t: number): Power {
  if (t >= POWER_SECONDS) return POWER_ON;
  // the lights dip while the gate draws (its coils take the power from everything else), once the three banks have lit, and recover after it
  const dip = ramp(t, 2.7, 3.1) * (1 - ramp(t, 5.0, 6.3));
  const k = 1 - 0.65 * dip;
  const bank = (i: number): number => ramp(t, BANK_START[i]!, BANK_START[i]! + BANK_SECONDS) * k;
  const banks: readonly [number, number, number] = [bank(0), bank(1), bank(2)];
  return {
    relays: ramp(t, 0.4, 1.9),
    beacons: ramp(t, 0.4, 1.2),
    pulse: ramp(t, 1.2, 2.4),
    coils: ramp(t, IGNITION.start, IGNITION.end),
    banks,
    main: (banks[0] + banks[1] + banks[2]) / 3,
    hologram: ramp(t, 2.7, 3.5),
    emergency: 1 - ramp(t, 1.2, 2.2),
    static: 1 - ramp(t, 5.4, 5.7),
    arc: ramp(t, IGNITION.end, IGNITION.end + 0.1) * (1 - ramp(t, IGNITION.end + 0.1, IGNITION.end + 0.7)),
  };
}

/** The red strobe in the dark, 0..1: a sharp pulse at 1.2 Hz (it reads as a beacon, not a flicker). */
export function darkStrobe(now: number): number {
  return Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * STROBE_HZ * now), 4);
}

/** Where the red strobe sweeps along the power wall, in lab z: it travels from one end to the other and back. */
export function strobeSweepZ(now: number): number {
  const [a, b] = SWEEP_Z;
  return a + (b - a) * (0.5 - 0.5 * Math.cos(2 * Math.PI * SWEEP_HZ * now));
}

/** The wake camera's pitch above level at `t` seconds after waking: 65 degrees, easing to level over 2.2 s (an ease-out cubic). */
export function wakeLift(t: number): number {
  if (t <= 0) return WAKE_PITCH;
  if (t >= WAKE_SECONDS) return 0;
  const s = t / WAKE_SECONDS;
  return WAKE_PITCH * (1 - s) * (1 - s) * (1 - s);
}
