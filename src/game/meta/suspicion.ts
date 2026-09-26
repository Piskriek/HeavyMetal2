/**
 * Anti-corruption engine: suspicion score S ∈ [0,100] + 120 Hz telemetry tripwires (Deliverable 6).
 * Target in game repo: `server/integrity/suspicion.ts` and `src/game/sim/telemetry-tripwires.ts`.
 *
 *   S = 100 · (1 − Π_i (1 − w_i · g(z_i)))       "noisy-OR" of independent evidence channels
 *   g(z) = clamp((z − z0) / (z1 − z0), 0, 1)       with z0 = 1.5 (ignore noise), z1 = 4.5 (saturate)
 *
 * Noisy-OR is monotone (more evidence never lowers S), bounded, and one saturated strong channel
 * (w ≥ 0.85) is enough to cross the 85 cooldown threshold on its own — deliberate for win-trading.
 */
import type { SuspicionAudit, SuspicionSignal } from './interfaces';

export const SUSPICION_WEIGHTS: Readonly<Record<SuspicionSignal, number>> = {
  'underdog-stake-spike': 0.45,
  'linked-account-cluster': 0.55,
  'late-money-flow': 0.3,
  'throttle-anomaly': 0.5,
  'brake-check': 0.35,
  'route-abandonment': 0.45,
  'suicide-collision': 0.7,
  'payout-deviation': 0.6,
};

export const THRESHOLDS = { escrow: 65, cooldown: 85 } as const;
const Z0 = 1.5, Z1 = 4.5;
export const g = (z: number) => Math.min(1, Math.max(0, (z - Z0) / (Z1 - Z0)));

export function suspicionScore(signals: readonly { signal: SuspicionSignal; z: number }[]) {
  let keep = 1;
  const parts = signals.map(({ signal, z }) => {
    const p = SUSPICION_WEIGHTS[signal] * g(z);
    keep *= 1 - p;
    return { signal, z, contribution: p };
  });
  return { score: Math.round((1 - keep) * 1000) / 10, parts };
}

export function actionFor(score: number, confirmedWinTrade: boolean): SuspicionAudit['action'] {
  if (confirmedWinTrade) return 'confiscate-and-penalize';
  if (score >= THRESHOLDS.cooldown) return 'bookie-cooldown-24h';
  if (score >= THRESHOLDS.escrow) return 'escrow-1h';
  return 'none';
}

/* ───────────── Betting-side z-scores ───────────── */

/**
 * Underdog stake spike. Kelly-style "information value": stake as a multiple of the account's median
 * stake, weighted by how unlikely the pick was. z = log2(stake / median) · (1 − p_implied) · 1.5
 */
export function underdogZ(stake: number, medianStake: number, impliedProbability: number) {
  if (medianStake <= 0) medianStake = 25;
  return Math.max(0, Math.log2(stake / medianStake)) * (1 - impliedProbability) * 1.5;
}

/**
 * Payout deviation: rolling 60-bet window, compares realized return R to expected E[R]=−τ with
 * binomial-ish variance σ² = Σ s_i²(1−p_i)/p_i / (Σ s_i)². Flag at z > 3.5σ (spec).
 */
export function payoutDeviationZ(bets: readonly { stake: number; p: number; payout: number }[], takeout: number) {
  const staked = bets.reduce((s, b) => s + b.stake, 0);
  if (staked === 0 || bets.length < 10) return 0;
  const realized = (bets.reduce((s, b) => s + b.payout, 0) - staked) / staked;
  const variance = bets.reduce((s, b) => s + (b.stake * b.stake * (1 - b.p)) / Math.max(b.p, 1e-3), 0) / (staked * staked);
  return (realized - -takeout) / Math.sqrt(Math.max(variance, 1e-9));
}

/**
 * Linked-account cluster: Jaccard over shared device/IP/payment fingerprints + co-lobby frequency.
 * z = 6·J + 3·(coLobbyRate − baseline)/baseline, where the bettor backed a racer in the cluster.
 */
export function linkageZ(jaccard: number, coLobbyRate: number, baseline = 0.02) {
  return 6 * jaccard + 3 * Math.max(0, (coLobbyRate - baseline) / baseline) * 0.25;
}

/* ───────────── Telemetry tripwires (evaluated on the deterministic replay, server-side) ───────────── */

export interface TelemetryFrame {
  tick: number;           // 120 Hz
  s: number;              // track progress (arc length)
  speed: number;          // units/s
  refSpeed: number;       // AI-ghost reference speed at this s for this capsule
  throttle: number;       // 0..1 player input
  brake: number;          // 0..1
  lateral: number;        // signed offset from racing line
  laneHalfWidth: number;
  hazardAhead: boolean;   // lava/TNT/drop within 1.0 s of travel
  steerTowardHazard: boolean;
  wallImpactSpeed: number | null;
  rivalWithin: number | null; // metres to closest rival behind
}

export const TRIPWIRES = {
  throttleWindowTicks: 240,          // 2 s
  throttleSpeedRatio: 0.6,           // v / v_ref below this while unobstructed
  brakeCheckRivalDist: 3,            // rival within 3 m behind
  brakeCheckDecel: 900,              // units/s² sudden decel with no hazard
  routeAbandonLateral: 1.4,          // |lateral| > 1.4 · half-width sustained
  routeAbandonTicks: 180,            // 1.5 s
  suicideImpact: 1400,               // lethal wall smash threshold (spec)
  suicideNoEvadeTicks: 60,           // 0.5 s of steering INTO the hazard with no corrective input
} as const;

export interface TripwireHit { signal: SuspicionSignal; fromTick: number; toTick: number; z: number; evidence: string }

export function scanTelemetry(frames: readonly TelemetryFrame[]): TripwireHit[] {
  const hits: TripwireHit[] = [];
  let slowRun = 0, offRun = 0, towardRun = 0;
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i], prev = frames[i - 1];
    const unobstructed = !f.hazardAhead && (f.rivalWithin === null || f.rivalWithin > 6);
    // 1. Throttle anomaly: sustained lift far below reference pace with nothing in the way.
    slowRun = unobstructed && f.throttle < 0.2 && f.speed < f.refSpeed * TRIPWIRES.throttleSpeedRatio ? slowRun + 1 : 0;
    if (slowRun === TRIPWIRES.throttleWindowTicks) {
      hits.push({ signal: 'throttle-anomaly', fromTick: f.tick - slowRun, toTick: f.tick, z: 2 + (1 - f.speed / f.refSpeed) * 4, evidence: `v/vref=${(f.speed / f.refSpeed).toFixed(2)} for 2 s, throttle<0.2` });
    }
    // 2. Brake check: hard decel with a rival tucked behind and no hazard ahead.
    const decel = (prev.speed - f.speed) * 120;
    if (f.brake > 0.8 && decel > TRIPWIRES.brakeCheckDecel && !f.hazardAhead && f.rivalWithin !== null && f.rivalWithin < TRIPWIRES.brakeCheckRivalDist) {
      hits.push({ signal: 'brake-check', fromTick: prev.tick, toTick: f.tick, z: 2 + decel / 600, evidence: `decel ${Math.round(decel)} u/s² with rival ${f.rivalWithin.toFixed(1)} m behind` });
    }
    // 3. Route abandonment: parking wide of the line for > 1.5 s.
    offRun = Math.abs(f.lateral) > f.laneHalfWidth * TRIPWIRES.routeAbandonLateral ? offRun + 1 : 0;
    if (offRun === TRIPWIRES.routeAbandonTicks) hits.push({ signal: 'route-abandonment', fromTick: f.tick - offRun, toTick: f.tick, z: 3, evidence: 'sustained off-line > 1.5 s' });
    // 4. Suicide collision: steering into a lethal hazard for 0.5 s then a lethal impact.
    towardRun = f.steerTowardHazard ? towardRun + 1 : 0;
    if (f.wallImpactSpeed !== null && f.wallImpactSpeed > TRIPWIRES.suicideImpact && towardRun >= TRIPWIRES.suicideNoEvadeTicks) {
      hits.push({ signal: 'suicide-collision', fromTick: f.tick - towardRun, toTick: f.tick, z: 3 + towardRun / 60, evidence: `impact ${Math.round(f.wallImpactSpeed)} u/s after ${(towardRun / 120).toFixed(2)} s of steering into it` });
    }
  }
  return hits;
}
