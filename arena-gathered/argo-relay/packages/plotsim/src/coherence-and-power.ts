// ============================================================================
// File: packages/plotsim/src/coherence-and-power.ts
// Briefs: Brief 26 (25m Safe Dome & 12 kW Power Grid) + Brief 27b (2 kW Turret)
// Purity: 100% pure deterministic functions for @hm/plotsim.
// ============================================================================

export const GATE_SAFE_DOME_RADIUS_M = 25.0;
export const PYLON_SAFE_DOME_RADIUS_M = 15.0;
export const COHERENCE_RECHARGE_PER_SEC = 20.0; // +20%/s inside safe dome
export const COHERENCE_DRAIN_PER_SEC = 100.0 / 90.0; // 90s full buffer in unpowered wasteland

export const GATE_BASELINE_POWER_KW = 12.0; // Powers first 3 starter machines (3.5 + 4.0 + 3.0 = 10.5 kW)
export const POWER_UNIT_OUTPUT_KW = 36.0;   // Dedicated Power Unit (#7 on Sheet 12)
export const PERIMETER_TURRET_DRAW_KW = 2.0; // Sheet 20 Automated Perimeter Turret

export interface Point2D {
  x: number;
  z: number;
}

export interface CoherenceTickResult {
  coherencePct: number;
  inSafeDome: boolean;
  showReturnCompassArrow: boolean;
  triggerZeroLossRecall: boolean;
}

/**
 * Pure deterministic Suit Coherence tick (DEC-03 — Fixes the Brother's Quit Trigger).
 * Never deletes player inventory on 0% recall.
 */
export function stepSuitCoherence(
  currentPct: number,
  playerPos: Point2D,
  gatePos: Point2D,
  poweredPylons: Point2D[],
  isInsideShieldedLab: boolean,
  dtSec: number
): CoherenceTickResult {
  if (isInsideShieldedLab) {
    return {
      coherencePct: 100,
      inSafeDome: true,
      showReturnCompassArrow: false,
      triggerZeroLossRecall: false,
    };
  }

  const distToGate = Math.hypot(playerPos.x - gatePos.x, playerPos.z - gatePos.z);
  const nearGate = distToGate <= GATE_SAFE_DOME_RADIUS_M;
  const nearPylon = poweredPylons.some(
    (p) => Math.hypot(playerPos.x - p.x, playerPos.z - p.z) <= PYLON_SAFE_DOME_RADIUS_M
  );
  const inSafeDome = nearGate || nearPylon;

  const nextPct = inSafeDome
    ? Math.min(100, currentPct + COHERENCE_RECHARGE_PER_SEC * dtSec)
    : Math.max(0, currentPct - COHERENCE_DRAIN_PER_SEC * dtSec);

  if (nextPct <= 0) {
    return {
      coherencePct: 100, // Restored at Lab Gate threshold with 100% inventory intact
      inSafeDome: true,
      showReturnCompassArrow: false,
      triggerZeroLossRecall: true,
    };
  }

  return {
    coherencePct: nextPct,
    inSafeDome,
    showReturnCompassArrow: !inSafeDome && nextPct <= 30.0,
    triggerZeroLossRecall: false,
  };
}

export interface PowerGridSummary {
  totalSupplyKw: number;
  totalDemandKw: number;
  satisfactionRatio: number; // 1.0 = full speed; < 1.0 = proportional brownout (min 0.25)
  isBrownout: boolean;
}

/**
 * Pure deterministic Power Grid & Proportional Brownout calculator (P0-LOOP-02).
 * Gate supplies 12 kW baseline; each Power Unit adds +36 kW.
 */
export function computePowerGridSatisfaction(
  machineDrawsKw: number[],
  activePowerUnitCount: number,
  activeTurretCount = 0
): PowerGridSummary {
  const totalSupplyKw = GATE_BASELINE_POWER_KW + activePowerUnitCount * POWER_UNIT_OUTPUT_KW;
  const machineDemand = machineDrawsKw.reduce((acc, kw) => acc + Math.max(0, kw), 0);
  const turretDemand = activeTurretCount * PERIMETER_TURRET_DRAW_KW;
  const totalDemandKw = machineDemand + turretDemand;

  if (totalDemandKw <= totalSupplyKw || totalDemandKw <= 0.001) {
    return {
      totalSupplyKw,
      totalDemandKw,
      satisfactionRatio: 1.0,
      isBrownout: false,
    };
  }

  // Proportional brownout (clamped to 25% minimum so machines visibly chug rather than hard-stalling)
  const rawRatio = totalSupplyKw / totalDemandKw;
  return {
    totalSupplyKw,
    totalDemandKw,
    satisfactionRatio: Math.max(0.25, Math.min(1.0, rawRatio)),
    isBrownout: true,
  };
}

export interface TurretCandidateTarget {
  id: string;
  archetype: 'charger' | 'spitter' | 'swarmer' | 'flyer' | 'brute' | 'sapper';
  x: number;
  z: number;
  hp: number;
}

/**
 * Selects the highest-priority monster within 35m for a 2 kW Automated Perimeter Turret (Sheet 20).
 * Prioritizes 'sapper' units (which brown-out machines) first, then 'swarmer', then closest distance.
 */
export function selectTurretTarget(
  turretPos: Point2D,
  candidates: TurretCandidateTarget[],
  maxRangeM = 35.0
): TurretCandidateTarget | null {
  let best: TurretCandidateTarget | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const mob of candidates) {
    if (mob.hp <= 0) continue;
    const dist = Math.hypot(mob.x - turretPos.x, mob.z - turretPos.z);
    if (dist > maxRangeM) continue;

    const priorityBonus =
      mob.archetype === 'sapper' ? 1000 : mob.archetype === 'swarmer' ? 400 : 0;
    const score = priorityBonus - dist;
    if (score > bestScore) {
      bestScore = score;
      best = mob;
    }
  }

  return best;
}
