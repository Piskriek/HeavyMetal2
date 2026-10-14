// ============================================================================
// File: packages/lattice/src/pylon-pulse-beads.ts
// Plan: Plan 11 (P2-LOOP-06 Automated Relay Pylon Catenary Logistics Pulse Beads)
// Purity: 100% pure deterministic functions for @hm/lattice.
// ============================================================================

export type LatticePacketType = 'power' | 'ore' | 'Pxd' | 'Vtx' | 'Lx' | 'Aq';

export interface CatenarySpan {
  id: string;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  sagMeters: number;
}

export interface PulseBeadSample {
  x: number;
  y: number;
  z: number;
  progress0to1: number;
  colorHex: number;
}

export function getPacketColorHex(packetType: LatticePacketType): number {
  switch (packetType) {
    case 'power': return 0xffffff;
    case 'ore':   return 0x9aa5b4;
    case 'Pxd':   return 0xff3d8a;
    case 'Vtx':   return 0x7cff4d;
    case 'Lx':    return 0xffc13d;
    case 'Aq':    return 0x3dc8ff;
  }
}

/**
 * Evaluates a point along a parabolic catenary sag cable between two pylons at t in [0..1].
 */
export function sampleCatenaryPoint(
  span: CatenarySpan,
  t0to1: number
): { x: number; y: number; z: number } {
  const t = Math.max(0.0, Math.min(1.0, t0to1));
  const x = span.startX + (span.endX - span.startX) * t;
  const z = span.startZ + (span.endZ - span.startZ) * t;
  const linearY = span.startY + (span.endY - span.startY) * t;
  // Parabolic sag peaks at t = 0.5: 4 * t * (1 - t)
  const sagOffset = 4.0 * t * (1.0 - t) * span.sagMeters;
  return {
    x: Number(x.toFixed(3)),
    y: Number((linearY - sagOffset).toFixed(3)),
    z: Number(z.toFixed(3)),
  };
}

/**
 * Evaluates the world position of a traveling energy/resource pulse bead along a span.
 * Speed scales proportionally with grid satisfactionRatio (0.25..1.0 during brownouts).
 */
export function evaluateTravelingPulseBead(
  span: CatenarySpan,
  timeSec: number,
  satisfactionRatio0to1: number,
  packetType: LatticePacketType = 'power',
  baseCyclesPerSec = 0.65
): PulseBeadSample | null {
  if (satisfactionRatio0to1 <= 0.01) return null;

  const effectiveRate = baseCyclesPerSec * Math.max(0.25, Math.min(1.0, satisfactionRatio0to1));
  const progress0to1 = (timeSec * effectiveRate) % 1.0;
  const pos = sampleCatenaryPoint(span, progress0to1);

  return {
    ...pos,
    progress0to1: Number(progress0to1.toFixed(3)),
    colorHex: getPacketColorHex(packetType),
  };
}
