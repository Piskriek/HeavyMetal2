# 4 · Economy & Shaman Math Simulator

Sources: **`src/hmgp2/shaman.ts`** (fee engine) · **`src/hmgp2/economy-sim.ts`** (30-day deterministic season simulator). Both run live in the panels below this section.

## 4.1 The Hybrid High-Water Mark, as implemented

```ts
export function calculateResurrectionCost(deaths: number, elo: number, snw: number, liquidWallet?: number): ResurrectionCalculation {
  const n = clampInt(deaths, 1, 10_000);
  const base = 250 * Math.pow(clamp(elo, 100, 3500) / 1000, 2);   // B(E)
  const eloFloor = gold(Math.min(MAX_SAFE_INTEGER, base * 1.75 ** (n - 1)));
  const rate = [0.15, 0.25, 0.40, 0.60, 0.85][Math.min(n, 5) - 1];  // P(n)
  const wealthTax = gold(rate * snw);
  const fee = gold(Math.max(eloFloor, wealthTax));
  return { …, fee, dominantTerm: eloFloor >= wealthTax ? 'elo-floor' : 'wealth-tax',
           soulSicknessHours: [0, 2, 6, 12, 24][Math.min(n, 5) - 1],
           affordable: fee <= wallet, recommendation: n >= 4 ? 'retire' : n === 3 || fee > wallet ? 'consider-retiring' : 'resurrect' };
}
```

`costTable()` regenerates the brief's §6.3 table from code and a test asserts it cell-by-cell: **250 / 810 / 1,440 → 438 / 1,418 / 2,520 → 766 / 2,481 / 4,410 → 1,340 / 4,341 / 7,718 → 2,345 / 7,597 / 13,506** (rounded half-up). ✔

**Design decision — n > 5:** the brief's "5th+" row is ambiguous. We keep compounding k^(n−1) (6th death at 2,400 Elo = 23,635 g) while P(n) and lockout cap at 85 % / 24 h. Flip `SHAMAN.floorExponentCapDeath = 5` to freeze instead.

## 4.2 Closing the laundering hole: SNW with a gross-inflow guard

Naive SNW = wallet + inventory + escrow can still be dodged by *moving* wealth off the racer's account before dying (mule alts, gifting, dumping into cosmetics that are later refunded). We therefore define:

```
holdings = liquidWallet + resaleValue(tradeable inventory) + openBetEscrow
SNW      = max( holdings , λ · grossSeasonalInflow )      λ = 0.6
```

`grossSeasonalInflow` is the sum of every *credit* this season (purses, sheep, bets won, rewards). It is monotone — no outflow ever reduces it. So a whale who earned 100 k this season and parks it all in a mule still faces SNW ≥ 60 k. λ < 1 forgives legitimate spending (cosmetics, entries, fees are real sinks, not laundering).

Additional hardening: (1) **no direct gold trading between accounts in v1** — the only cross-account flows are pari-mutuel pools (anonymous, raked); (2) inventory resale value is 40 % of shop price and only for tradeable items; (3) bet escrow is counted at stake value.

## 4.3 Crossover analysis

The wealth tax overtakes the floor when `SNW* = B(E)·k^(n−1) / P(n)` (`wealthCrossover()`):

| n | 1,000 Elo | 1,800 Elo | 2,400 Elo |
|---|---|---|---|
| 1 | 1,667 | 5,400 | 9,600 |
| 2 | 1,752 | 5,672 | 10,080 |
| 3 | 1,915 | 6,203 | 11,025 |
| 4 | 2,233 | 7,235 | 12,863 |
| 5 | 2,759 | 8,938 | 15,889 |

Reading: a typical player (SNW ≈ 2 k at equilibrium, see §4.6) pays the **Elo floor**; only the top ~10 % wealth tier pays the **wealth tax**. Both groups feel the same *relative* pain, which is the point.

## 4.4 Edge-case handling

| Case | Behaviour | Why it's safe |
|---|---|---|
| **Zero wealth** (SNW = 0) | Fee = Elo floor (≥ 250 g at 1,000 Elo). `affordable=false`, shortfall shown. | Player can grind unranked/sheep or AI-pilot; the racer stays dead (not deleted) until season end. |
| **Pauper god-racer** (2,400 Elo, 10 g) | Fee 1,440 g — 144× the wallet. | ~29 full-rate sheep races (≈ 2.5 days) to revive; the Elo floor makes elite racers never cheap. |
| **Whale hoarding** (1,800 Elo, 200 k SNW) | n=1: max(810, 30,000) = **30,000 g**. | Tax scales with wealth; hoarding is not punished per se (only on death), preserving the "saving feels good" incentive. |
| **Mule laundering** (moves 190 k out, earned 150 k this season) | SNW = max(10 k, 0.6·150 k) = 90 k → 13,500 g at n=1. | Gross inflow is monotone. |
| **Sudden death streak** (1,800 Elo, SNW 8 k) | 1,200 → 2,000 → 3,200 → 4,800 (cumulative 11,200 > starting SNW). | Funnel: can't afford n=4 → retirement prompt. Lockouts 0 → 2 → 6 → 12 h stop rage-queue streaks. |
| **Corrupted / hostile inputs** | NaN/∞ → defaults; Elo clamped [100, 3500]; n clamped [1, 10 000]; result capped at `MAX_SAFE_INTEGER`. | Pure function, no throw on bad input. |
| **Death while Soul-Sick** | Impossible: ranked queue refuses; unranked has no permadeath. | Enforced server-side at queue time. |
| **Season ends while dead** | Auto-retire to Hall of Fame; no fee charged. | Death is final at season close by design. |
| **Double-click "Pay"** | Idempotency key `resurrection:{racerId}:{seasonDeathIndex}`. | Ledger `ON CONFLICT DO NOTHING`. |

## 4.5 Faucets, sinks & parameters

| Flow | Direction | Parameter | Controls |
|---|---|---|---|
| Sheep Hire payout | Faucet | 50–100 g by scrap collected | Diminishing: 100 % for first **12** races/day, 50 % to 24, 10 % after |
| Sheep Hire fee | Sink | **25 g** per race | Makes pure AFK farming net-negative after the daily cap |
| AI Pilot Contract | Faucet | 50 % of sheep payout (25–50 g) | Only when bankrupt (eligibility snapshot) + ≥ 60 % human input ticks |
| Ranked purse | Transfer | Entry 100 / 150 / 250 g by Elo; pool paid to top 10 % | **12 % rake = sink** |
| Resurrection | Sink | Hybrid HWM | Primary *seasonal* sink for ranked players |
| Bookie takeout | Sink | 5–12 % by market + rounding breakage | Pari-mutuel: house has zero exposure |
| Cosmetics & dyes | Sink | 400–3,000 g catalogue | Wealth-elastic demand (richer players buy more) |
| Character slots | Sink | 2,500 / 6,000 / 12,000 / 25,000 g | Slots 2–5 |
| Season rewards | Faucet | Top 1 %: 3,000 g · top 10 %: 600 g + exclusive decals/titles | Small; prestige is the real reward |

## 4.6 Equilibrium argument

Let W be the per-capita wallet. Faucets are **bounded and W-independent**: F ≈ Σ_archetype share·(races/day × (E[payout]·dim − fee)) — the daily sheep cap makes F a constant ceiling (≈ 500 g/day for a heavy grinder). Sinks are **increasing in W**: cosmetic demand ∝ W (bounded by catalogue price), wealth tax ∝ SNW, rake ∝ entry tier (tiers rise with Elo, which correlates with wealth). Therefore S(W) − F crosses zero once, at a unique W*, with dS/dW > 0 ⇒ **stable fixed point**: above W* the economy deflates, below it inflates.

Analytic check for the grinder archetype (10 sheep races/day): F = 10·(75 − 25) = 500 g/day. Cosmetic sink ≈ appetite·0.35·W = 0.55·0.35·W ⇒ W* ≈ 2,600 g. The simulator (panel below) reports ≈ 2,300 g — agreement within model noise.

**What the sim told us (and what we changed):**
1. First draft (fee 20 g, cap 24/day, flat cosmetic appetite): faucet/sink = **1.41**, per-capita supply grew 21× in 30 days → runaway inflation. Fix → fee 25 g, full-rate cap 12, wealth-elastic shop demand.
2. The draft sim minted gold through an EV-style ranked payout. Real purses must be *strictly zero-sum minus rake*; the sim now pools entries per day and redistributes exactly. **Server purse settlement gets the same invariant as a test:** Σ payouts + rake = Σ entries.
3. Residual: supply rises from the 500 g starting grant toward W* ≈ 2 k (convergence, not runaway); the last 10 days drift ~0.5–1 %/day. Tuning knobs if live telemetry shows drift > 1 %/day for 7 days: raise cosmetic rotation cadence, add a limited "season-exclusive" decal drop (pure sink), or trim sheep payout ceiling 100 → 90.
4. Retirement happens mostly at **n = 1–2** because typical ranked wallets are thin. If retention data shows first-death rage-quits, add a *once-per-season "Shaman's Mercy"* (n = 1 fee halved for racers < 1,400 Elo). Kept out of v1 to protect the stakes.

## 4.7 Soul Sickness

`soulSicknessAfterDeath(n, resurrectedAt)` → `{ lockoutUntil = resurrectedAt + [0,2,6,12,24][n−1] h }`. Applies **only to the ranked queue**; unranked, sheep hire, bookie and garage remain open so a sick player still has things to do (and income). The lockout is shown as a live countdown on the Profile, the Hub's "Join Ranked" card, and the racer's slot card.
