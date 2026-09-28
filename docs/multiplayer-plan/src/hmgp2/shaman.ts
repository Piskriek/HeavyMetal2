/**
 * Shaman Resurrection Engine — Hybrid High-Water Mark (Deliverable 4).
 * Target in game repo: `src/game/meta/shaman.ts`. Pure, deterministic, integer-gold output.
 *
 *   C(n, E, SNW) = max( B(E)·k^(n−1) , P(n)·SNW )
 *   B(E)        = 250·(E/1000)²
 *   k           = 1.75
 *   SNW         = max( wallet + inventory + escrow , λ·grossSeasonalInflow )     (λ = 0.6)
 */
import {
  gold,
  type Gold,
  type ResurrectionCalculation,
  type SeasonalNetWorthBreakdown,
  type SoulSicknessState,
} from './interfaces';

export const SHAMAN = {
  baseFloor: 250,
  eloPivot: 1000,
  eloExponent: 2,
  k: 1.75,
  /** P(n) for n = 1..5; index 4 is used for every n ≥ 5. */
  wealthTax: [0.15, 0.25, 0.4, 0.6, 0.85] as const,
  soulSicknessHours: [0, 2, 6, 12, 24] as const,
  /**
   * Death multiplier keeps compounding past n = 5 (the table row "5th+" shows n = 5).
   * Design choice: a 6th death costs 1.75× the 5th, which hardens the retirement funnel.
   * Set to 5 to freeze the floor at the 5th-death value instead.
   */
  floorExponentCapDeath: null as number | null,
  lambda: 0.6,
  /** Elo is clamped to protect against corrupted/injected values. */
  eloClamp: [100, 3500] as const,
} as const;

const clampInt = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.floor(value)));

export function eloFloorBase(elo: number): number {
  const e = Math.min(SHAMAN.eloClamp[1], Math.max(SHAMAN.eloClamp[0], elo));
  return SHAMAN.baseFloor * Math.pow(e / SHAMAN.eloPivot, SHAMAN.eloExponent);
}

export function wealthTaxRate(deaths: number): number {
  const n = clampInt(deaths, 1, Number.MAX_SAFE_INTEGER);
  return SHAMAN.wealthTax[Math.min(n, SHAMAN.wealthTax.length) - 1];
}

export function soulSicknessHours(deaths: number): SoulSicknessState['hours'] {
  const n = clampInt(deaths, 1, Number.MAX_SAFE_INTEGER);
  return SHAMAN.soulSicknessHours[Math.min(n, SHAMAN.soulSicknessHours.length) - 1];
}

/** SNW with the high-water-mark guard: moving gold to a mule lowers holdings, never gross inflow. */
export function seasonalNetWorth(input: {
  liquidWallet: number; inventoryValue: number; betEscrow: number; grossSeasonalInflow: number;
}): SeasonalNetWorthBreakdown {
  const liquidWallet = gold(input.liquidWallet);
  const inventoryValue = gold(input.inventoryValue);
  const betEscrow = gold(input.betEscrow);
  const grossSeasonalInflow = gold(input.grossSeasonalInflow);
  const holdings = gold(liquidWallet + inventoryValue + betEscrow);
  const snw = gold(Math.max(holdings, SHAMAN.lambda * grossSeasonalInflow));
  return { liquidWallet, inventoryValue, betEscrow, holdings, grossSeasonalInflow, snw, lambda: SHAMAN.lambda };
}

/**
 * @param deaths n — this racer's death count in the current season INCLUDING the death being cured (≥ 1).
 * @param elo    Elo of the deceased racer at time of death.
 * @param snw    Seasonal Net Worth (use `seasonalNetWorth().snw`).
 * @param liquidWallet optional — enables `affordable` / `liquidShortfall`. Defaults to snw.
 */
export function calculateResurrectionCost(deaths: number, elo: number, snw: number, liquidWallet?: number): ResurrectionCalculation {
  const n = clampInt(Number.isFinite(deaths) ? deaths : 1, 1, 10_000);
  const safeSnw = gold(Number.isFinite(snw) ? snw : 0);
  const wallet = gold(liquidWallet ?? safeSnw);
  const exponentDeath = SHAMAN.floorExponentCapDeath === null ? n : Math.min(n, SHAMAN.floorExponentCapDeath);
  const base = eloFloorBase(Number.isFinite(elo) ? elo : 1000);
  const multiplier = Math.pow(SHAMAN.k, exponentDeath - 1);
  // Clamp to a safe integer: n = 60+ would overflow into Infinity otherwise.
  const eloFloor = gold(Math.min(Number.MAX_SAFE_INTEGER, base * multiplier));
  const rate = wealthTaxRate(n);
  const wealthTax = gold(rate * safeSnw);
  const fee = gold(Math.max(eloFloor, wealthTax));
  // Funnel: n ≥ 4 (≥ 60 % SNW + ≥ 12 h lockout) → retire. n = 3 or unaffordable → think twice.
  const recommendation: ResurrectionCalculation['recommendation'] =
    n >= 4 ? 'retire'
    : n === 3 || fee > wallet ? 'consider-retiring'
    : 'resurrect';
  return {
    version: 1,
    inputs: { deaths: n, elo, snw: safeSnw },
    eloFloorBase: base,
    deathMultiplier: multiplier,
    eloFloor,
    wealthTaxRate: rate,
    wealthTax,
    fee,
    dominantTerm: eloFloor >= wealthTax ? 'elo-floor' : 'wealth-tax',
    soulSicknessHours: soulSicknessHours(n),
    affordable: fee <= wallet,
    liquidShortfall: gold(Math.max(0, fee - wallet)),
    recommendation,
  };
}

/** SNW at which the wealth tax overtakes the Elo floor: SNW* = B(E)·k^(n−1) / P(n). */
export function wealthCrossover(deaths: number, elo: number): Gold {
  const calc = calculateResurrectionCost(deaths, elo, 0);
  return gold(calc.eloFloor / calc.wealthTaxRate);
}

/** The spec's table, regenerated from code — used by the UI and asserted in tests. */
export function costTable(elos: readonly number[] = [1000, 1800, 2400]) {
  return [1, 2, 3, 4, 5].map((n) => ({
    n,
    floors: elos.map((e) => calculateResurrectionCost(n, e, 0).eloFloor as number),
    taxRate: wealthTaxRate(n),
    lockoutHours: soulSicknessHours(n),
  }));
}

export function soulSicknessAfterDeath(deaths: number, resurrectedAt: number): SoulSicknessState {
  const hours = soulSicknessHours(deaths);
  return hours === 0
    ? { active: false, lockoutUntil: null, hours }
    : { active: true, lockoutUntil: (resurrectedAt + hours * 3_600_000) as SoulSicknessState['lockoutUntil'], hours };
}
