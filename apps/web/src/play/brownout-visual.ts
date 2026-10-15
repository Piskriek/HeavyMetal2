/**
 * The brownout you can see (TASK-26). Pure rates, read from the grid's satisfaction (supply over demand, capped at 1) and from each
 * machine's run (`@hm/plotsim`'s running share, which already carries the satisfaction). No clock, no randomness.
 */

/** Plume share: how much of its full pour a machine puts out, rounded to tenths so the plume rebuilds only at a tenth's change. */
export function plumeShare(run: number): number {
  if (!Number.isFinite(run)) return 0;
  return Math.round(Math.min(1, Math.max(0, run)) * 10) / 10;
}

/** Pixels a plume pours at this run, from its full count. */
export function plumeCount(fullCount: number, run: number): number {
  return Math.round(fullCount * plumeShare(run));
}

/** Pulse beads on a relay line: metres of cable per second at full satisfaction. They slow with the grid and stop at 0%. */
export const BEAD_SPEED_FULL_MPS = 2.4;

export function beadSpeed(satisfaction: number): number {
  if (!Number.isFinite(satisfaction)) return 0;
  return BEAD_SPEED_FULL_MPS * Math.min(1, Math.max(0, satisfaction));
}

/** The sag of a cable span of this length (the same rule as the cable the beads ride, fieldkit's lineSpan). */
export function spanSag(length: number): number {
  return Math.max(0.4, length * 0.035);
}

/** A point at fraction `u` (0..1) along a sagged cable span from `a` to `b`: the same curve as fieldkit's cableSpan. */
export function spanPoint(a: { readonly x: number; readonly y: number; readonly z: number }, b: { readonly x: number; readonly y: number; readonly z: number }, sag: number, u: number): { readonly x: number; readonly y: number; readonly z: number } {
  const t = Math.min(1, Math.max(0, u));
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t - 4 * sag * t * (1 - t),
    z: a.z + (b.z - a.z) * t,
  };
}
