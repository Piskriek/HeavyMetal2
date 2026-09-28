# RUN.world launch tickets (MP-R01 … MP-R08)

The plan and the research are in [docs/RUN_LAUNCH_PLAN.md](../../RUN_LAUNCH_PLAN.md). RUN.world's SDK
reference: `github.com/series-ai/venus-sdk-docs` (also `series-1.gitbook.io/rundot-docs`); the SDK is
`@series-inc/rundot-game-sdk` (pinned 5.29.0 in package.json).

**Already on `main`:** the platform layer (`src/platform/`: RUN detection, SDK boot, cloud-save
`localStorage` stand-in, identity, host fullscreen, subfolder-safe asset URLs), `npm run build:run`
(`vite build --mode run`, `.env.run`), Quick Races with custom events, Multiplayer → Profile, the gold
wallet and self-bets, and "Publish island to the game" (`public/courses/island.json`).

## How to test on RUN.world today (the owner, once)

1. In the 3D Map Editor on your own machine (`npm run dev`): **File → Publish island to the game**, then
   commit `public/courses/island.json`. Without it a new player's island has no props or finish lines.
2. Install the CLI and sign in (see MP-R01), `rundot init` in the repo root (writes
   `game.config.prod.json`: commit it).
3. `npm run build:run` then `rundot deploy` → an unlisted link. Open it on the web and in the RUN app
   (phone). Check: menu, a Quick Race, a custom event, Profile (your RUN username shows), a reload keeps
   your crew, gold and events (cloud saves).

## Tickets

| Ticket | Est. | What | Done when |
|---|---|---|---|
| **MP-R01** Setup & first deploy | 0.5 d | Install the CLI (`curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh \| bash`, Windows: `irm …/install.ps1 \| iex`), `rundot init`, commit `game.config.prod.json`. Add `rundotGameLibrariesPlugin()` and, for local testing, `rundotGamePlaygroundPlugin()` (+ `firebase` dev dependency) to `vite.config.ts` in run mode only; ES2022 build target. Set the game thumbnail. | An unlisted deploy runs on web and phone; the checks above pass; `npm run check` green. |
| **MP-R02** Storage audit | 0.5 d | On RUN every player save lives in `appStorage` (128 keys, 10 MiB, ~1 MB per value, rate-limited). List keys and sizes after a long session; keep builder-only keys out of player saves (the 3D Map Editor could be owner-only on RUN: check `RundotGameAPI.app` roles); surface `storageWriteFailures()` in Settings. | No `QUOTA_EXCEEDED` / `RATE_LIMITED` in a 30-minute session; a clear message if the cloud refuses a save. |
| **MP-R03** Race lobby room | 3 d | `rundot/realtime.config.json` + `src/rooms/RaceLobby.ts` (`GameRoom`): create / quick match (criteria: event, field) / join by 6-char code; host picks the event (a custom event's JSON); ready-up; lock; the room draws a seed and starts a countdown (server clock); finish reports in; results broadcast; reconnect 30 s. Client: `RundotGameAPI.realtime.*` behind `src/platform/`. Multiplayer → Race Online opens it. | Two browsers (Playground player switching) meet in a lobby by code and by quick match, start together, and both see the same results. |
| **MP-R04** Online race client | 4 d | Every client runs the same seeded race (the sim is deterministic); remote racers are drawn from their reported progress (10 Hz position/state messages, interpolated), AI fills empty grid slots; finish order from the room. Disconnect: the racer finishes under AI. | A 4-player online race on the island, finish order agreed, no desync in the reported order across 20 test races. |
| **MP-R05** Leaderboards + shared events | 2 d | Leaderboards per island track × finish (best time), weekly and all-time; Multiplayer → Leaderboards. UGC: publish a custom event (`contentType: 'hm2-event'`, the My Events JSON), browse, like, race a shared event. | A shared event made on one account races on another; best times show per track/finish. |
| **MP-R06** Gold on the server | 3 d | Move the wallet to the Simulation API (server-owned currency + recipes: race purse, bet stake/payout, shop). The local ledger keys become idempotency keys. Online bets and the shop go through it; offline Quick Races keep the local wallet or sync on reconnect. | Gold cannot be edited client-side; a bet placed on one device settles on another. |
| **MP-R07** Syncplay race | 8 d+ | Port the race step to Syncplay's deterministic runtime (input lockstep, prediction, rollback, checksums, replays). Needs MP-T14 (deterministic math) first. | Checksums agree across Chrome, Safari and the RUN app for 100 recorded races. |
| **MP-R08** Bookie online | 4 d | Pari-mutuel pools per lobby (MP-T11 rules: takeout, self-bet caps, lock 5 min before), settled by the room, paid through MP-R06. | A lobby with spectators betting settles correctly; no self-bet against yourself. |

## Rules for any agent working these

- Only `src/platform/` imports the RUN SDK. Game code asks `isRunHosted()` / `runApi()`.
- A plain build (`npm run build`, the dev server) must never load the SDK (vite.config.ts aliases it to a
  stub outside run mode). Keep `npm run check` green in plain mode.
- Never write to `localStorage` for data that must survive on RUN without going through the stand-in (it
  already does, transparently); never exceed ~256 KB in one key.
- Gold is a soft currency: never sell bets or gold for RUN Bits.
