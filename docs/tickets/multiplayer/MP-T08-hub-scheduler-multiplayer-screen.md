# MP-T08: Hub Scheduler, Matchmaking & Multiplayer Hub Screen

- **ID**: `MP-T08`
- **Priority**: High (Phase C / Server Track)
- **Track**: Multiplayer Systems & UI
- **Estimate**: 6 days
- **Dependencies**: `MP-T07`
- **Target Files**: `server/scheduler.ts`, `server/matchmaker.ts`, `server/ws.ts`, `src/components/hub/MultiplayerHubScreen.tsx`, `LobbyRoomDrawer.tsx`, `CreateRaceDialog.tsx`, `src/game/session.ts`

---

## Goal
Implement the central Multiplayer Hub screen with WebSocket lobby clocks and matchmaking. Schedule unranked races every 10 minutes and high-stakes ranked heats every 30 minutes. Support 100-racer Elo matchmaking with provably fair commit-reveal seed generation and custom lobby creation.

---

## Technical Specification

### 1. Cadence & Scheduling Architecture
- **Unranked Heats**: Start every 10 minutes on the server clock (e.g. :00, :10, :20, :30, :40, :50). Free entry, casual matchmaking, zero permadeath.
- **Ranked Heats**: Start every 30 minutes (:00, :30). 100-racer grid, strict Elo brackets, permadeath enabled.
- **Provably Fair Commit-Reveal**:
  - At T-25:00, server publishes `seedCommit = sha256(secretSeed)`.
  - At T-00:00 (race start), server reveals `secretSeed`. Clients independently verify `sha256(secretSeed) === seedCommit`.

### 2. Matchmaking Engine
- Bins queued players into Elo brackets (`[0-1199]`, `[1200-1599]`, `[1600-1999]`, `[2000+]`).
- Fills remaining grid slots up to 100 racers with deterministic AI racers generated via `generateRandomGoblin(`${lobby.seed}:${slot}`)`.

### 3. Hub UI Components
- **Top Navigation Bar**: Server status, active season countdown, current wallet gold.
- **Queue Cards**:
  - *Join Unranked*: Live countdown, entry fee ("FREE"), active player count.
  - *Join Ranked*: Live countdown, Elo requirements, permadeath warning skull, Shaman fee preview.
  - *Create Race*: Custom lobby setup modal (track, laps, entry stakes, collisions).
  - *Bookie Betting Parlor*: Direct link to active wagering markets.

---

## Acceptance Criteria
- [ ] Client countdown clocks sync to server time with `≤ 250 ms` drift over WebSocket.
- [ ] Ranked lobbies assemble up to 100 racers with deterministic AI fill-ins matching the seed.
- [ ] Players leaving a queue before T-02:00 receive immediate, automated entry fee refunds.
- [ ] Revealed seeds match the published SHA-256 commit hash in 100% of tested heats.

---

## Tests to Run
`node --import tsx --test tests/matchmaking.test.ts`
