# MP-T12: Integrity Engine: Server Re-Sim & Suspicion Audits

- **ID**: `MP-T12`
- **Priority**: High (Phase D / Anti-Cheat)
- **Track**: Integrity & Telemetry Heuristics
- **Estimate**: 5 days
- **Dependencies**: `MP-T11`, `MP-T09`
- **Target Files**: `server/integrity/replay.ts`, `server/integrity/suspicion.ts`, `src/game/sim/telemetry-tripwires.ts`, `server/integrity/cluster.ts`, `tests/integrity.test.ts`

---

## Goal
Build the match-fixing and fraud detection engine that evaluates player telemetry during high-stakes ranked races. Combine telemetry tripwires, payout anomaly tracking, and a composite Suspicion Score to freeze fraudulent payouts into escrow and penalize win-trading syndicates.

---

## Technical Specification

### 1. In-Race Telemetry Tripwires
During race replay re-simulation, inspect participant inputs:
- *Brake-Check Tripwire*: Sudden sustained braking on open straights with a following racer within drafting range.
- *Route Abandonment*: Intentional steering into hazard zones (lava lakes, pits) without evasive maneuvers.
- *Input Cessation*: Dropping throttle inputs for $> 2.0$ seconds while in a podium position.

### 2. Suspicion Score ($S in [0, 100]$)
A composite index calculated from:
$$S = 0.35 cdot S_{\text{telemetry}} + 0.35 cdot S_{\text{betting-volume}} + 0.30 cdot S_{\text{payout-deviation}}$$
- High underdog betting spikes from linked accounts increase $S_{\text{betting-volume}}$.
- Payout deviations $> 3.5\sigma$ above historical baseline elevate $S_{\text{payout-deviation}}$.

### 3. Automated Enforcement Ladder
- **$S ge 65$**: Payout is placed in Bookie Escrow for 1 hour pending automated audit.
- **$S ge 85$**: Bookie Cooldown applied (account wagering privileges suspended for 24 hours).
- **Syndicate Match-Fixing Flag**: Confiscates winnings to the Goblin Mob Fund and applies an Elo penalty.

---

## Acceptance Criteria
- [ ] Server re-simulation verifies bit-exact finishing order from uploaded input streams.
- [ ] Synthetic telemetry test streams trigger tripwires for deliberate deceleration and hazard steering.
- [ ] Accounts exceeding $S ge 65$ have payouts automatically held in escrow.
- [ ] Escrowed funds release automatically after 1 hour if audit score remains clean.

---

## Tests to Run
`node --import tsx --test tests/integrity.test.ts`
