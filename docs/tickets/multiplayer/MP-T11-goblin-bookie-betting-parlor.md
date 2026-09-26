# MP-T11: The Goblin Bookie Parlor & 100-Racer Wagering Engine

- **ID**: `MP-T11`
- **Priority**: High (Phase D / Social Track)
- **Track**: Wagering Engine & Compliance
- **Estimate**: 6 days
- **Dependencies**: `MP-T08`
- **Target Files**: `server/bookie/pricing.ts`, `server/bookie/settle.ts`, `src/components/bookie/BookieParlorModal.tsx`, `OddsBoard.tsx`, `BetSlip.tsx`, `tests/bookie.test.ts`

---

## Goal
Deliver the Goblin Bookie Betting Parlor, allowing players and spectators to place gold wagers on 100-racer ranked heats. Implement a zero-liability pari-mutuel wagering engine with strict lock timers, anti-match-fixing rules, and regional compliance toggles.

---

## Technical Specification

### 1. Betting Window & Schedule
- Opens at T-25:00 (25 minutes before race).
- **Hard Lock at T-05:00**: Server rejects any wagers placed within 5 minutes of race start (T-04:59.999 is rejected).

### 2. Wagering Markets
1. *Outright Winner*: Pari-mutuel pool with 8% house takeout (rake).
2. *Podium Place*: Pays on 1st, 2nd, or 3rd place finishes.
3. *Over/Under Casualties*: Will more than $X$ racers die in the heat?
4. *Head-to-Head*: Fixed decimal odds on which of two rival racers finishes higher (with liability caps).

### 3. Anti-Corruption & Match-Fixing Protections
- **No Self-Sabotage**: Racers cannot wager against themselves or bet on their own death.
- **Self-Win Cap**: A racer betting on themselves to win is capped at 10% of their Seasonal Net Worth.
- **Regional Compliance Toggle**: In-game gold cannot be bought or cashed out for real money. Bookie parlor includes an admin toggle to disable betting per jurisdiction without breaking the core loop.

### 4. UI Odds Board & Bet Slip
- Virtualized 100-racer odds board updating at 60 fps with 2-second throttled WebSocket odds diffs.
- Interactive bet slip with stake slider, potential return calculator, and "Submit Wager" confirmation.

---

## Acceptance Criteria
- [ ] Hard lock strictly enforces T-05:00 closure down to millisecond precision.
- [ ] Pari-mutuel settlement property test: `sum(payouts) + rake + breakage === totalPool` across 10,000 randomized pools.
- [ ] System automatically rejects any attempt by a participant to bet against their own racer.
- [ ] Regional toggle cleanly hides bookie interfaces when disabled.

---

## Tests to Run
`node --import tsx --test tests/bookie.test.ts`
