# Heavy Metal GP 2 on RUN.world: launch plan

Written 2026-09-28. Source: the RUN.world SDK reference (`github.com/series-ai/venus-sdk-docs`, SDK v5.28,
also published at `series-1.gitbook.io/rundot-docs`) and the Season Zero plan in
`docs/multiplayer-plan/` + `docs/tickets/multiplayer/`. This file says what RUN.world gives us, what it
forbids, how the Season Zero plan changes because of it, and the order we ship in.

## 1. What RUN.world is (for us)

RUN.world (RUN.game) hosts web games in an iframe inside its web and mobile apps. A game is a Vite build
(`base: './'`, output `dist/`) uploaded with the `rundot` CLI:

```bash
curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh | bash
npm install @series-inc/rundot-game-sdk@latest
rundot init            # writes game.config.prod.json (game id, build settings)
npm run dev            # local Playground: RUN toolbar, sign-in, player switching
npm run build && rundot deploy   # unlisted share link until published
```

Every API is `RundotGameAPI` from `@series-inc/rundot-game-sdk/api`.

### The rules that shape our code

| RUN rule | What it means for HM2 |
|---|---|
| **No browser storage** in the game iframe: `localStorage`, `sessionStorage`, IndexedDB, cookies are unavailable. | We keep ~27 `localStorage` keys (settings, saves, island tracks, lanes, ground paint, crew, ball designs, sky). **Solution (built):** `src/platform/` installs a `localStorage` stand-in backed by `RundotGameAPI.appStorage` (cloud-synced, per player, per game) when hosted, so no call site changes. |
| Storage limits: **128 items / 10 MiB per bucket**, ~977 KiB per value (256 KiB comfortable), rate-limited, writes buffered ~100 ms. | Fine for player data. Builder data (island tracks, ground paint) is owner-only and ships as files instead (below). Larger player data (future: replays) goes to the Files API. |
| **No own backend.** The iframe can only reach its own origin + Google Fonts. Our own server/API is blocked. | The Season Zero plan's Next.js + Postgres meta server **cannot be used**. Server logic moves into RUN **GameRoom** classes (Multiplayer API) and the **Simulation API** (server-authoritative recipes, currencies, PvP). |
| **Platform auth only.** RUN signs players in; own login is blocked. | Identity = `RundotGameAPI.getProfile()` → `{ id, username, avatarUrl, isAnonymous }`. Multiplayer rejects anonymous players (`AccessDeniedError`; the SDK auto-prompts login). |
| Fullscreen / pointer lock only via the System API; respect `system.getSafeArea()`. | `src/platform/` routes the menu's fullscreen button through the SDK when hosted. |
| Assets load only from the game origin (`dist/`, `cdn-assets/`). | Already true: everything is under `public/`. Watch the 600 MB art budget (`tests/art-budget.test.ts`). |

### Multiplayer on RUN (three flavours)

1. **Multiplayer API (GameRoom)**: we write `class RaceLobby extends GameRoom` (server-side TypeScript,
   bundled by `rundotMultiplayerPlugin()` from `rundot/realtime.config.json`). Rooms: `createRoom`,
   `joinOrCreateRoom` (matchmaking with criteria), `joinRoomByCode` (6-char codes), max players, lock,
   kick, reconnect (30 s), named server timers, crash-safe persistence, and `this.services`
   (leaderboards, UGC, notifications, simulation).
2. **Advanced Multiplayer (BETA)**: persistent rooms (long-lived shared worlds keyed by a stable key),
   seasons, a shared economy, cross-instance PvP matchmaking, platform room chat (persisted,
   rate-limited, member-gated).
3. **Syncplay (deterministic, RC1)**: input-only lockstep with prediction, rollback, replay, late join
   and checksum desync detection for a *signed* deterministic simulation. This is the natural long-term
   home for HM2 races because our 120 Hz sim is already deterministic. It requires porting the sim step
   into their runtime shape (a real project: see MP-R07).

Other APIs we will use: **Leaderboards**, **UGC** (share custom races/tournaments: JSON up to 100 KB,
likes, weekly voting), **Purchases/Shop** (RUN Bits hard currency; only if we ever sell anything),
**Analytics**, **Notifications**.

## 2. How the Season Zero plan changes

| Season Zero piece | On RUN |
|---|---|
| MP-T07 meta server (ledger, seasons) | Local-first wallet now (built); later the **Simulation API** owns gold (server-authoritative currency + recipes) and **Advanced Multiplayer seasons**. |
| MP-T08 hub scheduler, 10/30-min heats | A persistent "heat scheduler" room (Advanced Multiplayer) or plain lobbies first. Start with lobbies (MP-R03). |
| MP-T11 Goblin Bookie (pari-mutuel) | Pools live in the race's GameRoom state, settled by the room; gold via Simulation recipes. **Local version first (built):** fixed-odds bets on your own finish in Quick Races. Keep gold a soft currency with no cash-out (RUN Bits must never buy bets). |
| MP-T12 / MP-T13 authoritative race + integrity | Phase 1: every client simulates the same seeded race (the sim is deterministic) and the room compares finish reports (majority/host-of-record). Phase 2: Syncplay checksums give real desync detection. |
| MP-T14 deterministic math | Still required (Syncplay needs it too). `scripts/check-transcendentals.mjs` exists. |
| Accounts, profiles | Platform auth + `getProfile()`; our goblin crew/ball designs are per-player data in `appStorage`. |

## 3. Shipping order

**Built in this pass (on `main`)**

- `src/platform/`: RUN detection, SDK boot, `localStorage` stand-in over `appStorage`, player identity
  (RUN profile, or a local guest), hosted fullscreen.
- Main menu: **Quick Races** · **Multiplayer** · 3D Map Editor · Settings · How to Play.
- **Quick Races**: Quick Race and Tournament (the existing flow), plus **Create your own**: custom events
  of 1–8 rounds, each round its own island track + finish, field size and CPU challenge; saved as
  "My Events" (UGC-ready JSON).
- **Multiplayer** hub: **Profile** (goblin + name, crew, balls → garage, owned items, wallet, bets,
  Hall of Chaos records), **Race Online** (RUN lobbies; disabled with a clear note off-platform).
- Gold wallet + integer ledger with idempotency keys; fixed-odds bets on your own finish, settled on the
  round result; the garage can now buy premium cosmetics with gold.
- **Publish course**: the builder writes the active island track (props + lanes + ground paint) into
  `public/courses/`, and a fresh player loads it. **The owner must run it once and commit the files**:
  today the island exists only in the owner's browser.

**How to test on RUN.world, and the tickets:** [docs/tickets/run/README.md](tickets/run/README.md).
Build for RUN with `npm run build:run` (`vite build --mode run`); a plain `npm run build` never contains the SDK.

**Next tickets** (`docs/tickets/run/`)

| Ticket | What |
|---|---|
| MP-R01 | `rundot init`, add the SDK Vite plugins (`rundotGameLibrariesPlugin`, `rundotGamePlaygroundPlugin`, `rundotMultiplayerPlugin`), set `VITE_RUN=1` for RUN builds, first unlisted deploy, smoke test on web + phone. |
| MP-R02 | Storage audit on RUN: keys, sizes, 128-item cap, rate limits; move builder-only keys out of player storage. |
| MP-R03 | `RaceLobby` GameRoom: create / quick match / join by code, ready-up, host picks event, seed + countdown, finish reports, results. |
| MP-R04 | Online race client: everyone runs the seeded race, remote racers drawn from their reported progress; results screen from the room. |
| MP-R05 | Leaderboards (best time per island track/finish) and UGC publishing of custom events. |
| MP-R06 | Gold on the server (Simulation API): entry fees, purses, bets, shop. |
| MP-R07 | Syncplay port of the race sim (deterministic lockstep, checksums, replays). |
| MP-R08 | Bookie parlor online (pari-mutuel pools per lobby), integrity checks. |
