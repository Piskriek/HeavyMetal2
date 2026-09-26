# MP-T10: Economy Faucets: Sheep Hire & AI Pilot Safety Net

- **ID**: `MP-T10`
- **Priority**: Medium (Phase C / Economy Balance)
- **Track**: Economic Balancing & Sim Entities
- **Estimate**: 3 days
- **Dependencies**: `MP-T08`, `MP-T09`
- **Target Files**: `server/contracts.ts`, `src/game/sim/sheep.ts`, `src/components/hub/AiPilotContractCard.tsx`, `scripts/sim/economy-season.ts`

---

## Goal
Balance the in-game gold economy by implementing two crucial faucets: Trackside Sheep Hire for steady unranked grinding, and the AI Pilot Bankruptcy Contract as an anti-softlock safety net for destitute players.

---

## Technical Specification

### 1. Trackside Sheep Hire
- **Contract Cost**: 25 gold rental fee per race.
- **Mechanism**: A friendly escort sheep spawns alongside the player's marble in unranked races, hoovering track scrap.
- **Payout**: Yields 50 to 100 gold depending on scrap collected.
- **Diminishing Returns**:
  - Races 1–12 per day: 100% payout (net +25g to +75g per race).
  - Races 13–24 per day: 50% payout.
  - Races 25+ per day: 10% payout (net-negative to deter botting).

### 2. AI Pilot Contract (The Broke Safety Net)
- **Eligibility Snapshot**: Enforced strictly server-side:
  - Account wallet $< 25$ gold (cannot afford sheep hire).
  - Active racer is dead and cannot afford Shaman fee.
  - No sellable inventory items remaining.
- **Contract Terms**:
  - Player joins an active race queue as an AI runner pilot.
  - Payout: Exactly **50% of an average sheep payout** (25 to 50 gold) with zero entry fee.
  - Anti-AFK Validation: Requires $ge 60%$ human input ticks during the race; otherwise voided.

### 3. Automated 30-Day Economy Simulation Test
- A simulation test in CI running 2,000 agents over 30 days under seed 1337.
- Asserts that faucet/sink ratio remains strictly $in [0.9, 1.2]$ and $ge 50%$ of bankrupt agents recover to $ge 1,000$ gold.

---

## Acceptance Criteria
- [ ] Sheep hire contract applies daily diminishing returns after 12 and 24 races.
- [ ] AI pilot contracts are available exclusively when the bankruptcy eligibility check passes.
- [ ] Anti-AFK check voids payout if input ticks drop below 60%.
- [ ] 30-day CI simulation test passes with zero runaway inflation.

---

## Tests to Run
`node --import tsx scripts/sim/economy-season.ts`
