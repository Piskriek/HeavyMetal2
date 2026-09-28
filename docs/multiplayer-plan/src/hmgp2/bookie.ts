/**
 * Goblin Bookie — pricing, bet validation and settlement (Deliverable 6/7 support).
 * Target in game repo: `server/bookie/pricing.ts` (authoritative) + read-only mirror on the client.
 */
import type { BetMarketKind } from './interfaces';

export const BOOKIE = {
  windowOpensBeforeStartMin: 25,
  windowLocksBeforeStartMin: 5,
  takeout: { outright: 0.1, podium: 0.08, 'head-to-head': 0.05, 'casualties-over-under': 0.05, 'first-blood': 0.12 } satisfies Record<BetMarketKind, number>,
  minStake: 10,
  maxStakeFractionOfPool: 0.2,     // one slip can't be > 20 % of a pool after placement (manipulation cap)
  selfWinCapFractionOfSnw: 0.1,    // backing yourself to win: max 10 % of SNW
  oddsFloor: 1.01,
  oddsCeiling: 500,
  /** Seed liquidity per selection from the house so odds exist before the first bet (Elo-weighted). */
  houseSeedPerRacer: 5,
} as const;

/** Pari-mutuel decimal odds after takeout. Pool P, selection stake s_i: odds_i = P(1−τ)/s_i. */
export function pariMutuelOdds(pool: number, selectionStake: number, takeout: number): number {
  if (selectionStake <= 0) return BOOKIE.oddsCeiling;
  return Math.min(BOOKIE.oddsCeiling, Math.max(BOOKIE.oddsFloor, (pool * (1 - takeout)) / selectionStake));
}

/** Elo-based win probability for the house seed (Plackett–Luce strengths w = 10^(E/400)). */
export function eloWinProbabilities(elos: readonly number[]): number[] {
  const w = elos.map((e) => Math.pow(10, e / 400));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

/** Head-to-head probability that A finishes above B. */
export const headToHead = (eloA: number, eloB: number) => 1 / (1 + Math.pow(10, (eloB - eloA) / 400));

export type BetRejection =
  | 'window-closed' | 'self-bet-against' | 'self-bet-death' | 'self-stake-cap'
  | 'stake-too-small' | 'pool-share-cap' | 'insufficient-funds' | 'bookie-cooldown';

export interface BetAttempt {
  kind: BetMarketKind;
  nowMs: number;
  startsAtMs: number;
  stake: number;
  wallet: number;
  snw: number;
  poolAfter: number;
  selectionStakeAfter: number;
  /** Racers owned by the bettor that are entered in this heat. */
  ownRacersInHeat: readonly string[];
  selectionRacer?: string;
  opponentRacer?: string;
  side?: 'over' | 'under';
  cooldownUntilMs?: number | null;
}

/** Validation order is fixed so rejection reasons are deterministic and testable. */
export function validateBet(a: BetAttempt): BetRejection | null {
  const opens = a.startsAtMs - BOOKIE.windowOpensBeforeStartMin * 60_000;
  const locks = a.startsAtMs - BOOKIE.windowLocksBeforeStartMin * 60_000;
  if (a.cooldownUntilMs && a.nowMs < a.cooldownUntilMs) return 'bookie-cooldown';
  if (a.nowMs < opens || a.nowMs >= locks) return 'window-closed';
  const own = new Set(a.ownRacersInHeat);
  if (own.size > 0) {
    // A racer may never profit from their own death or from losing.
    if (a.kind === 'first-blood' && a.selectionRacer && own.has(a.selectionRacer)) return 'self-bet-death';
    if (a.kind === 'casualties-over-under' && a.side === 'over') return 'self-bet-death';
    if (a.kind === 'head-to-head' && a.opponentRacer && own.has(a.opponentRacer)) return 'self-bet-against';
    if ((a.kind === 'outright' || a.kind === 'podium') && a.selectionRacer && !own.has(a.selectionRacer)) return 'self-bet-against';
    if (a.stake > a.snw * BOOKIE.selfWinCapFractionOfSnw) return 'self-stake-cap';
  }
  if (a.stake < BOOKIE.minStake) return 'stake-too-small';
  if (a.stake > a.wallet) return 'insufficient-funds';
  if (a.poolAfter > 1000 && a.stake / a.poolAfter > BOOKIE.maxStakeFractionOfPool) return 'pool-share-cap';
  return null;
}

/** Pari-mutuel settlement with integer floor rounding; "breakage" (rounding dust) is burned as a sink. */
export function settlePariMutuel(stakes: readonly { betId: string; selection: string; stake: number }[], winners: ReadonlySet<string>, takeout: number) {
  const pool = stakes.reduce((s, b) => s + b.stake, 0);
  const winningStake = stakes.filter((b) => winners.has(b.selection)).reduce((s, b) => s + b.stake, 0);
  if (winningStake === 0) {
    // Nobody picked it: refund everyone minus takeout (house never keeps the whole pool).
    return { payouts: stakes.map((b) => ({ betId: b.betId, payout: Math.floor(b.stake * (1 - takeout)) })), vig: Math.ceil(pool * takeout), breakage: 0 };
  }
  const net = pool * (1 - takeout);
  const payouts = stakes.map((b) => ({ betId: b.betId, payout: winners.has(b.selection) ? Math.floor((net * b.stake) / winningStake) : 0 }));
  const paid = payouts.reduce((s, p) => s + p.payout, 0);
  return { payouts, vig: Math.round(pool * takeout), breakage: Math.max(0, Math.round(net - paid)) };
}
