# MP-T09: High-Stakes Permadeath, Shaman Altar & Profile Screen

- **ID**: `MP-T09`
- **Priority**: High (Phase C / Core Loop)
- **Track**: Gameplay Logic & UI
- **Estimate**: 5 days
- **Dependencies**: `MP-T07`, `MP-T08`, `MP-T05`
- **Target Files**: `src/game/sim/hazards.ts`, `server/shaman.ts`, `src/components/profile/GoblinProfileScreen.tsx`, `ShamanAltar.tsx`, `HoldToConfirmButton.tsx`, `tests/shaman-flow.test.ts`

---

## Goal
Implement the high-stakes permadeath trigger in ranked mode and build the Goblin Profile screen featuring career statistics, rank tier badges, and the Shaman's Resurrection Altar with Soul Sickness lockout management.

---

## Technical Specification

### 1. In-Sim Ranked Permadeath Triggers
In `src/game/sim/hazards.ts`:
- Permadeath triggers **only** when `lobby.permadeath === true`:
  1. *Lava Lake Submersion*: Staying submerged $> 1.2$ seconds.
  2. *TNT Chain Detonation*: Contact with high-yield explosives at high speed.
  3. *Terminal Chasm Fall*: Falling below course death planes.
  4. *High-Speed Impact Smash*: Wall collision velocity $Delta v > 1,400$ units/sec.
- On death: Mark racer status `dead`, log `DeathRecord` with timestamp, track, and sim tick for replay seeking.

### 2. Goblin Profile Screen Layout
- **Racer Dossier**: 256x256 modular goblin portrait, custom ball 3D orbit preview, career rank tier (Rookie $	o$ Grease Monkey $	o$ Gearhead $	o$ Pit Boss $	o$ Grand Champion).
- **Career Stats Grid**: Races, Wins, Podium %, DNF Count, Elo Rating, Seasonal Net Worth.
- **Badge Showcase**: Visual badges earned through achievements.

### 3. The Shaman's Resurrection Altar (When Dead)
- Displays tombstone graphic and cause of death.
- Live cost breakdown calculated via `calculateResurrectionCost`:
  - Base Elo Floor: $B(E) cdot 1.75^{n-1}$.
  - Wealth Tax: $P(n) cdot 	ext{SNW}$.
  - Active Dominant Term highlighted in gold.
- "Hold to Resurrect" button (requires 1.5s press to prevent misclicks).
- Soul Sickness timer: Ranked queue lockout (2h, 6h, 12h, 24h). Unranked/Garage remains accessible.
- "Retire to Hall of Fame" option: Retires veteran permanently and opens Character Creator for a new slot.

---

## Acceptance Criteria
- [ ] Permadeath triggers strictly in ranked heats; unranked races retain standard recovery.
- [ ] Shaman Altar fee matches the exact formula output cell-for-cell.
- [ ] Soul Sickness locks players out of ranked queues while keeping unranked and garage modes active.
- [ ] Retiring a racer creates an immutable Hall of Fame record and frees the character slot.

---

## Tests to Run
`node --import tsx --test tests/shaman-flow.test.ts`
