# T36P1: co-op Phase 1, a friend's outpost live by room code (plan 36)

**Plan:** [`docs/argo/plans/36-planetary-grid-on-run.md`](../../argo/plans/36-planetary-grid-on-run.md) (Phase 0.1, 0.2 and Phase 1, with Argo's review). **Source:** `arena-gathered/argo-coop-phase1/`, Argo's bundle:
- `apps/web/src/net/protocol.ts` and its test;
- `apps/web/src/rooms/OutpostRoom.ts` and its test;
- `apps/web/src/net/outpost-client.ts` and its test;
- `apps/web/rundot/realtime.config.json`;
- a full `apps/web/vite.config.ts`.

**Opus's staging run:** the protocol suite passes (4 of 4). The other two fail in the real repo, because Argo's sandbox mocked the RUN SDK. Fixes 1 to 3 below cover them.

## Fix while installing (Opus checked each against `@series-inc/rundot-game-sdk` 5.29.0)
1. **The room's constructor.** The real `GameRoom` is built by the harness with a `GameRoomProps` (`protocol`, `roomId`, `roomType`, `config`, `players`, `clock`, `log`, `services`; see `dist/mp-server/index.d.ts`). `new OutpostRoom()` with no argument throws while reading `protocol`.
   - Give `OutpostRoom` the `constructor(ctx: GameRoomProps)` pattern from `.claude/skills/rundot-multiplayer/rooms/ExampleRoom.ts`.
   - Rewrite its test around a small fake harness: a `RoomProtocol` that records `broadcast` and `sendTo`, a fake `Clock` and `Logger`, and a `players` map. Drive it the way the platform does, through `protocol.handleJoin` and `protocol.handleMessage(playerId, type, data)`. Don't monkey-patch the instance.
2. **The client's SDK import.** `outpost-client.ts` imports `@series-inc/rundot-game-sdk/api` at the top, and that module reads `window` as it loads, so the node test crashes. Keep the `realtime` and `room` injection Argo already has. When neither is passed, load the SDK inside `connectOutpost` with `await import(...)`. Nothing from the SDK loads at import time.
3. **The vite plugin.**
   - Replace Argo's loader (three guessed entry points, errors swallowed) with a direct `await import('@series-inc/rundot-game-sdk/vite')` and `rundotMultiplayerPlugin()`, only when `mode === 'run'`, the same test the config already uses for the SDK alias.
   - If the import fails in RUN mode, the build must fail loudly. The plain build must not load the plugin at all.
4. **The room config location.** The plugin resolves `rundot/realtime.config.json` from Vite's `config.root`, which is `apps/web`. So install `apps/web/rundot/realtime.config.json` (with `"file": "src/rooms/OutpostRoom.ts"`), and skip Argo's root copy.
5. **Same terrain on both sides (a real bug in the bundle).** The room checks `apply` against `heightAt: () => 0`, and the client's default env is also flat. But the play screen builds on the plot's real terrain. So the server places pieces at the wrong heights, and every hash check fails.
   - Add a pure `apps/web/src/base/plot-height.ts`: `plotHeightAt({ seed, sculpt? })` returns `(x, z) => number`, with the exact formula from `plot-ground.ts` (`heightAt` at about line 386: `terrain.height` from `@hm/plotterrain`'s `createTerrain({ seed })`, minus `drop` from `crafter/planet`, plus the sculpt field through `@hm/terrainbrush`'s `heightAt` with `PAINT_ORIGIN`). Copy the constant; don't edit `plot-ground.ts`, which has Flash's F-09 work in progress. Log a POL entry so `plot-ground.ts` imports it later.
   - The host sends a `terrain` message with the seed and the beam save's sculpt text (`encodeField`): on hosting, and after each finished sculpt stroke (debounced to about 1 s). Only the owner may send it. The room stores and persists it, and rebuilds its env with `plotHeightAt`. Check the size against `MAX_BROADCAST_BYTES`.
   - Guests receive the terrain on join and on change. They load it into their ground through the same path the beam save uses on load (find it in `play.tsx`). If that truly needs a `play-scene.ts` change, stop and report it.

## Do
1. **Install** the files above with fixes 1 to 5, and get their tests green in the repo.
2. **The Planetary Grid screen** (`apps/web/src/shell/planetary-grid.tsx`, from 08a):
   - **Host my outpost:** creates a room and shows its 6-character code with a Copy button.
   - **One Visit input:** a 6-character code joins the room with `joinRoomByCode`. A longer code keeps 08a's existing plot-code visit.
   - **In the plain build:** co-op has no backend, so Host and the room-code branch show a calm "Co-op runs in the RUN build" note. The rest of 08a works as it does today. Keep 08a's look and load the frontend-design skill (`frontend-design:frontend-design`) before any UI work.
3. **Wiring in `play.tsx`:**
   - While a session is active, `dispatchBase` (about line 881) goes through `client.send(cmd)`, which predicts locally. The play world follows the client's confirmed state, and a server refusal shows as the existing toast.
   - Remote players' builds appear as they're confirmed.
   - Show a small roster chip (role display names from Argo's `ROLE_LABELS`: Lead Architect, Co-Builder, Field Observer).
   - **Saves:** a guest's own save is never overwritten by the host's world; they get their own world back on leaving. The host's local save syncs from the room on leave.
4. **Not in this ticket:**
   - Rendering remote avatars needs `play-scene.ts`, which Flash owns. The client already samples peer poses (`samplePeers`), so send poses at 10 Hz and leave the rendering for a follow-up.
   - The Phase 2 role UI.

## Verify
- **Node:** a two-client convergence test through the real `GameRoom` base class and your fake harness. Two clients send 50 random valid builds each, on real plot terrain with a sculpt field, and end with the same `hashWorld` as the room. Also check:
  - a disconnect followed by a reconnect within 60 s restores the same world;
  - a visitor's build is refused, and only the visitor hears about it;
  - `plotHeightAt` matches the play screen's `scene.heightAt` at 50 sampled points (in the browser test).
- **A new `scripts/test-coop-outpost.mjs` (Playwright):** start `vite --mode run` (the plugin's local room server listens on port 9001), host in one page, join by code in a second, build in both, and compare world hashes (expose them through a dev hook). Save shots of both pages and the Grid's host card, and look at them.
  - If the SDK client can't reach the local room server outside the RUN host, don't fake it. Report exactly what blocks it (Opus will ask RUN), and keep the node test as the acceptance.
- **Builds:**
  - The plain build: `npm run build` stays under 16 MB, its output has no `dist/server-bundle.js`, and the game plays solo as before.
  - The RUN build: `npm run build:run -w @hm/web` passes, stays under 16 MB, and writes `dist/server-bundle.js`.
- Run typecheck on the laptop. Run the rest through `scripts/test-on-3dpc.sh --only "<your paths>" "npm run build && …"`: `npm test`, the new test, `test-grid-menus` and `test-campaign` (45 of 45).

## Stay inside
`apps/web/src/net/`, `apps/web/src/rooms/`, `apps/web/src/base/plot-height.ts` and its test, `apps/web/rundot/`, `apps/web/vite.config.ts`, `apps/web/src/shell/planetary-grid.tsx`, `play.tsx` (the dispatch, roster and session wiring only), and the new tests. Never touch `play-scene.ts`, `plot-ground.ts`, `plot-biome-view.ts`, `water-surfaces.ts` or `packages/groundshader`: those are Flash's F-09 work in progress.

## Git
- Commit by explicit paths, after checking `git diff --cached --stat`.
- End messages with `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Never commit `apps/web/dist/index.html`, and never push.
