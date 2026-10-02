import type { Value } from './types';

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Number(v) with NaN/Infinity mapped to 0 (for loose input values). */
export const num0 = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Read a finite number from a component or throw an Error naming entity and field. */
export function finite(rec: Readonly<Record<string, Value>> | undefined, entity: number, comp: string, field: string): number {
  const v = rec?.[field];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`racers: entity ${entity} has invalid ${comp}.${field} (${String(v)})`);
  return v;
}

/** Deterministic polynomial rotation (no Math.sin/cos), renormalised. */
export function rotate(hx: number, hz: number, a: number): [number, number] {
  const a2 = a * a;
  const sinA = a - (a2 * a) / 6 + (a2 * a2 * a) / 120;
  const cosA = 1 - a2 / 2 + (a2 * a2) / 24;
  const nx = hx * cosA - hz * sinA, nz = hx * sinA + hz * cosA;
  const len = Math.sqrt(nx * nx + nz * nz);
  return len > 0 ? [nx / len, nz / len] : [1, 0];
}
