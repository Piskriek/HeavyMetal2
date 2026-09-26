# 6 · Anti-Cheat & Telemetry Heuristics

Sources: **`src/hmgp2/suspicion.ts`** (score + tripwires) · **`src/hmgp2/bookie.ts`** (bet validation & settlement).

## 6.1 Trust model

Ranked clients upload **input streams** (per-tick steer/throttle/brake/boost, ≈ 2 KB/min compressed). The Meta Server re-runs the deterministic 120 Hz sim with the revealed seed; the replay is the source of truth for finishing order, deaths **and telemetry**. A client that edits its own speed produces a desync → heat result voided for that racer + `integrity:desync` strike. Everything below runs on the server replay.

## 6.2 Suspicion score

```
S = 100 · (1 − Π_i (1 − w_i · g(z_i)))            noisy-OR over evidence channels
g(z) = clamp((z − 1.5) / (4.5 − 1.5), 0, 1)        ignore z < 1.5, saturate at z = 4.5
```

| Channel | z definition | w |
|---|---|---|
| Underdog stake spike | log₂(stake / median_stake) · (1 − p_implied) · 1.5 | 0.45 |
| Linked-account cluster | 6·J(fingerprints) + 0.75·(coLobbyRate − base)/base | 0.55 |
| Late money flow | (share of pool placed in last 60 s before lock − μ)/σ over 30 heats | 0.30 |
| Throttle anomaly | tripwire magnitude 2 + 4·(1 − v/v_ref) | 0.50 |
| Brake check | 2 + decel/600 | 0.35 |
| Route abandonment | fixed 3 when tripped | 0.45 |
| Suicide collision | 3 + seconds steering into hazard | 0.70 |
| Payout deviation | (R − (−τ)) / σ_R over rolling 60 bets | 0.60 |

Properties: monotone, bounded in [0, 100], explainable (each channel's contribution is stored in `SuspicionAudit.signals`). A single saturated channel with w = 0.7 gives S = 70 (escrow). Two moderate channels (e.g. linked cluster 0.55 + throttle 0.5 at saturation) → 1 − 0.45·0.5 = 77.5; adding an underdog spike → 87.6 → cooldown. This matches the intended story: *money evidence + driving evidence* together are damning; either alone is only a hold.

**Payout deviation detail:** for bets with stake sᵢ and implied probability pᵢ, the variance of the realized return R = (Σpayout − Σs)/Σs is σ² = Σ sᵢ²(1 − pᵢ)/pᵢ / (Σsᵢ)². Expected R = −τ. Flag at z > 3.5 (spec).

## 6.3 Match-fixing graph

Win-trading needs a *beneficiary* (bettor) and a *thrower* (racer). Each settled heat adds edges:
`bettor ──stake on X──► heat ◄──threw (tripwire)── racer Y` where Y's underperformance benefited X.
Accounts linked by device/IP/payment Jaccard ≥ 0.3 are merged into **clusters**. A cluster that appears on both sides in ≥ 3 heats within 7 days is a *confirmed pattern* → `confiscate-and-penalize`: winnings to the Goblin Mob Fund (burned sink, published weekly), −150 Elo to the thrower, 30-day bookie ban for the cluster. All confirmations get human review before permanent bans.

## 6.4 Real-time telemetry tripwires (120 Hz)

| Tripwire | Condition (all on replay frames) | Window |
|---|---|---|
| Throttle anomaly | throttle < 0.2 ∧ v < 0.6·v_ref(s) ∧ no hazard ahead ∧ no rival within 6 m | 240 ticks (2 s) |
| Brake check | brake > 0.8 ∧ decel > 900 u/s² ∧ rival < 3 m behind ∧ no hazard | instantaneous |
| Route abandonment | \|lateral\| > 1.4 · lane half-width | 180 ticks (1.5 s) |
| Suicide collision | steering *toward* lethal hazard ≥ 60 ticks ∧ impact > 1,400 u/s | 0.5 s look-back |

`v_ref(s)` is the AI ghost's speed profile for the same capsule at arc-length s (precomputed per course; already available from the AI runner). Tripwires only *emit evidence*; they never kill or penalise in-race, so false positives cost nothing but an escrow hour.

**False-positive guards:** skip tripwires while the racer is in a recovery state (bumped, airborne, respawning); skip route abandonment on courses flagged `multi-line`; players with S ≥ 65 on ≥ 5% of heats but no betting linkage are routed to *coaching* telemetry, not enforcement.

## 6.5 Economic anti-abuse

- Sheep Hire diminishing returns (12 full / 24 half / then 10 %) + fee make bot farming unprofitable.
- AI Pilot Contracts require ≥ 60 % human-input ticks (anti-AFK) and are only offered with an eligibility snapshot.
- Pool-share cap: one slip ≤ 20 % of a pool > 1,000 g (limits odds manipulation / "whale the longshot then throw").
- Commit-reveal seed: sha256(seed) published at betting open; nobody (including admins) can pre-simulate hazards.
