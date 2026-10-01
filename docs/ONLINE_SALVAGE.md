# Online layer salvaged from Heavy-Metal-GP (the 2D predecessor)

HeavyMetal2's launch plan (`RUN_LAUNCH_PLAN.md`, MP-R03 lobbies, MP-R05 leaderboards) needs ranked rating, matchmaking and a leaderboard
config. The predecessor repo already has them, tested. This branch copies the part that is **pure logic with no game coupling**:

| File | What | Tests |
|---|---|---|
| `src/net/rating.ts` | Elo rating, tiers, the arithmetic of a rated race (leaver = DNF, AI/friendly rooms unrated) | `tests/rating.test.ts` |
| `src/net/matchmake.ts` | rating-band matchmaking | `tests/matchmake.test.ts` |
| `src/game/rank-view.ts`, `src/game/rank-badge.ts` | tier labels, progress, badge art keys | `tests/rank-view.test.ts` |
| `src/assets/ui/rank/*.png`, `tools/make-rank-badges.mjs` | seven 96 px tier plates and the tool that derives them (needs `sharp` and the 2 MB master, not copied) | in `rating.test.ts` (RK-05) |
| `rundot/leaderboard.config.json` | RUN leaderboard config (ranked mode, anti-cheat limits) | - |

46 tests, all pass under `node --import tsx --test`.

## Not copied yet, and why

These depend on the old game's own types (`ITEM_TYPES`, `MarbleStats`, `TrackProfile`, sound cues) or on its Matter.js engine, so each needs a
port decision, not a copy: `protocol.ts` (2035 lines, the wire format), `lobby.ts`, `chat.ts`, `presence.ts` (all need protocol),
`transport.ts` (RUN SDK client), `rankstore.ts`, `rank-runtime.ts`, `ranked-queue.ts`, `src/rooms/RaceRoom.ts` (the RUN GameRoom, with
`rundot/realtime*.config.json`), and `host.ts` / `guest.ts` / `session.ts` (replay the old engine's stream; re-base on HM2's deterministic 120 Hz sim).
Order that makes sense: define HM2's race-result type, port `protocol`, then `RaceRoom` and `transport`, then lobby/chat/presence, then rank store/runtime.
