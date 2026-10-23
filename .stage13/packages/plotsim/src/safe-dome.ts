/**
 * The safe domes (TASK-26; Argo's plan 12, P0-HOUR-01): the places where the player's suit sync holds.
 *
 *  - The Twin Gate's dome: 25 m round the gate.
 *  - A powered relay pylon's dome: 15 m round the pylon, only while the pylon stands on the grid and is switched on.
 *  - The starter shelter's dome: 15 m round the shelter.
 *
 * Inside a dome sync never drains and refills at 20% a second. Outside, on raw ground, it drains over 90 s.
 * The domes protect the player, not the base: sappers can still brown out structures outside them (POL-31 ruling).
 *
 * Pure and deterministic: no clock, no randomness, no I/O. The caller passes the machines and the grid's connected set.
 */

/** The Twin Gate's dome, in metres (round the gate). */
export const GATE_DOME_RADIUS_M = 25;
/** A powered relay pylon's dome, and the starter shelter's, in metres. */
export const POWERED_DOME_RADIUS_M = 15;
/** Sync refill inside a dome, per second (20% of a full buffer). */
export const DOME_REFILL_PER_SEC = 0.2;
/** Seconds for a full sync buffer to drain on raw ground outside every dome. */
export const OUTSIDE_DRAIN_SECONDS = 90;
/** Below this sync the amber return arrow and the radio-static cue show (the HUD reads it as 30%). */
export const WARN_LEVEL = 0.3;

export interface Point2 {
  readonly x: number;
  readonly z: number;
}

export interface DomeSource extends Point2 {
  readonly radius: number;
}

/** What a dome needs from a machine: where it stands, what it is, and whether it is switched on. */
export interface DomeMachine extends Point2 {
  readonly id: number;
  readonly kind: string;
  readonly on: boolean;
}

/** The Twin Gate's dome. */
export function gateDome(gate: Point2): DomeSource {
  return { x: gate.x, z: gate.z, radius: GATE_DOME_RADIUS_M };
}

/** A dome for every relay pylon that is switched on and wired to the grid (`connected` holds the wired machine ids). */
export function poweredPylonDomes(machines: readonly DomeMachine[], connected: ReadonlySet<number>): DomeSource[] {
  const out: DomeSource[] = [];
  for (const m of machines) {
    if (m.kind !== 'pylon' || !m.on || !connected.has(m.id)) continue;
    out.push({ x: m.x, z: m.z, radius: POWERED_DOME_RADIUS_M });
  }
  return out;
}

/** Every dome in play: the gate, the powered pylons, and the starter shelter when the player has one. */
export function safeDomes(
  gate: Point2,
  machines: readonly DomeMachine[],
  connected: ReadonlySet<number>,
  shelter: Point2 | null,
): DomeSource[] {
  const domes: DomeSource[] = [gateDome(gate), ...poweredPylonDomes(machines, connected)];
  if (shelter !== null) domes.push({ x: shelter.x, z: shelter.z, radius: POWERED_DOME_RADIUS_M });
  return domes;
}

/** True when the point is inside at least one dome (the edge counts as inside). */
export function inSafeDome(p: Point2, domes: readonly DomeSource[]): boolean {
  for (const d of domes) {
    const dx = p.x - d.x;
    const dz = p.z - d.z;
    if (dx * dx + dz * dz <= d.radius * d.radius) return true;
  }
  return false;
}

/** Sync change per second on raw ground outside every dome: a full buffer over OUTSIDE_DRAIN_SECONDS. */
export function outsideDrainPerSec(): number {
  return 1 / OUTSIDE_DRAIN_SECONDS;
}

/** True at or below the warning level (30%): the static cue and the return arrow. */
export function isWarnLevel(level: number): boolean {
  return level <= WARN_LEVEL + 1e-9;
}
