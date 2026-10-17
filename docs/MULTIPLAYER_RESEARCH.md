# FIDELITY // Multiplayer Research: co-op on RUN.world, what similar games do, and what players like and hate

> **Why this exists:** the owner, 2026-10-17: "we have to backend on run.studio, do they cover that?", then "install RUN's rundot-multiplayer and rundot-syncplay skills so you can read their APIs, then write a research doc and a co-op plan (Planetary Grid on RUN) for me and Argo."
> **Read with:** the plan, [`docs/argo/plans/36-planetary-grid-on-run.md`](argo/plans/36-planetary-grid-on-run.md). The research-first SOP is in CLAUDE.md §3.4.
> **Status:** research only. Nothing is wired, and every proposal here needs the owner's go.

---

## 1. The question

The Planetary Grid button today only starts play in "synced" mode (`shell.tsx:343`). **The client has no networking at all:** no WebSocket, WebRTC or server calls. "Synced" is a local simulation:
- `crafter/shared-planet.ts`: slot claims, the majority-merge `resolveSlots`, neighbours;
- `play/plot-code.ts`: `encodePlot` and `decodePlot`, a shareable plot code;
- the visiting flow in `play.tsx`: you visit a plot by its code.

A real co-op screen (friends, co-builders, a friend's live outpost) needs a backend. Does RUN.world cover it?

## 2. What RUN.world offers (from the CLI, rundot 7.17, and its two multiplayer skills, now installed in `.claude/skills/`)

### 2a. Already in this repo
- **The SDK is a dependency:** `@series-inc/rundot-game-sdk` ^5.29.0 in `apps/web/package.json`.
- **A RUN build exists:** `npm run build:run` (vite `--mode run`, `VITE_RUN=1`). `apps/web/src/platform/boot.ts` loads the SDK there, waits for the profile handshake, and installs a `localStorage` stand-in backed by the player's cloud `appStorage`. Saves follow the player across devices, and a failed RUN boot falls back to a plain browser game.
- **The plain single-file build** aliases the SDK to a stub (`platform/sdk-stub.ts`), so it carries no SDK.
- **No game is registered on RUN yet** (`rundot list-games`: none). `docs/RUNWORLD_PIPELINE.md` records registering (`rundot import`, `init`, `deploy`) as an owner decision.

### 2b. Platform services (CLI command groups)
- **Player storage:** key-value per player, with point-in-time restore exports.
- **Player file storage:** signed URLs, visibility, quota.
- **UGC:** publish, list, get and update entries, plus **collaborators** ("entries shared with you, where you are a collaborator") and cross-app entries.
- **Also:** leaderboards, stats, live-ops config (push and rollback without a deploy), analytics, profiles, collectibles.
- **Deploys and hosting:** versions and releases, private or public (`set-private` keeps a share link working).

### 2c. Real-time multiplayer: two systems, both BETA
| | **`rundot-multiplayer`** (server-authoritative rooms) | **`rundot-syncplay`** (deterministic lockstep and rollback) |
|---|---|---|
| Model | A `GameRoom` subclass on RUN's server owns the state. It validates every client message, then broadcasts. | Every client runs the same fixed-tick simulation from the same inputs. The authority orders inputs and owns nothing. |
| Fits | Building, base management, turn-based, async: anything where validation matters more than frame-exact agreement. | Physics and action: racing, shooters, RTS. Replays, rollback, late join by snapshot. |
| Joining | `joinOrCreateRoom(type)` (matchmaking), `createRoom`, `joinRoomByCode(code)` with a **6-character room code**, `getUserRooms`. | `createSyncplayRoom`, `quickMatchSyncplayRoom`, `joinSyncplayRoomByCode`. |
| Persistence | `getPersistState()` / `onRestore()`, `autoPersist` (default on), `this.save()` at key moments, crash recovery. | Snapshots for late join; byte-exact replays. |
| Disconnects | Automatic reconnect with backoff; `reconnectTimeout` (default 30 s) holds the player's slot. | A hard disconnect is terminal; you offer an explicit re-join. |
| Config | `rundot/realtime.config.json` maps room types to files (`maxPlayers`, `idleTimeout`, `reconnectTimeout`, `autoPersist`, `startLocked`, **`singleton`**: one shared room, no matchmaking). `rundotMultiplayerPlugin()` in `vite.config.ts` builds the room code **and runs a local dev server**. | A fileless room entry: `deterministic: true`, `tickRateHz` 10, 20, 30 or 60. No server code. |
| Server tools | `broadcast`, `sendTo`, players, lock, kick, `clock` (timers that survive a crash), `log`, and `services` (notifications, leaderboard, **UGC**, game config). | — |
| Cost to us | Small: our base world is already a pure action function (see §5). | Large: a hard determinism contract, plain-data state, a codec-validated input struct, and a fixed tick. Install pinned at version 5.26.0 or later: `latest` is stuck at 5.23.0. |

The skills' own coaching is worth keeping:
- Decide whether multiplayer is warranted before deciding how.
- Plan for the **empty lobby**, for **disconnects as normal**, and for **cheating**: never trust the client.
- Ship the **smallest slice** first.

## 3. How comparable co-op builders do it

| Game | How co-op works | What players like and hate |
|---|---|---|
| **The Planet Crafter** (our closest loop) | Host-and-join: one player's game is the server. Cap reports differ: 8 on PS5 per Co-optimus, "10+" per a host's marketing. | **Hate:** "when the host is offline, friends can't play"; players asked for password-protected private servers ([Steam thread](https://steamcommunity.com/app/1284190/discussions/0/596273145166470176)). Paid hosts now sell dedicated servers to fill the gap ([Shockbyte](https://shockbyte.com/games/the-planet-crafter-server-hosting), [Co-optimus](https://www.co-optimus.com/game/18622/playstation-5/the-planet-crafter.html)). |
| **Satisfactory** | Co-op with a host, or a dedicated server. | **Hate:** desync that shows up **only on foundations and walls**, not on machines, and that reconnecting fixes ([Steam](https://steamcommunity.com/app/526870/discussions/1/4843148768108099133)). Hosts say it's the game itself and server upgrades don't help ([Kinetic](https://www.kinetichosting.com/articles/satisfactory/basics/desync-issues-on-your-satisfactory-server)), and items exist on a client but not the server. Advice: zones per player, and coordinated building ([BerryByte](https://docs.berrybyte.net/games/satisfactory/common-issues), [LOW.MS](https://low.ms/knowledgebase/satisfactory-common-server-issues), [Winternode](https://winternode.com/blog/satisfactory/satisfactory-multiplayer-guide)). |
| **Enshrouded** | Dedicated servers with a hard cap of 16 players. **Permissions by user group** (Admin, Friend, Guest and sometimes Visitor), each with flags such as `canEditBase` and `canExtendBase`. | **Like:** per-group build rights stop griefing ([xGamingServer](https://xgamingserver.com/blog/how-to-create-enshrouded-dedicated-server-hosting/), [Host Havoc](https://hosthavoc.com/blog/enshrouded-dedicated-server-setup), [Hostman](https://hostman.com/tutorials/how-to-set-up-an-enshrouded-server/)). |
| **Valheim** (from prior knowledge; no fresh source this round) | Dedicated servers of 10 players; build protection only by placed "wards". | **Hate:** no real permission model, so griefing is handled by wards and trust. |

**The patterns:**
1. **Host-only co-op is the top complaint:** the world dies when the host logs off.
2. **Structure desync is the classic building-game bug**, and it comes from clients and server disagreeing on placement.
3. **Players want role-based build permissions.**
4. **Async visits and a persistent world beat "everyone online at once"** for small friend groups.

## 4. The newest techniques
- **Server-authoritative rooms with persisted state** (RUN's `GameRoom`) give a world that lives without its owner online. That answers complaint 1.
- **Running the same pure rules on the server and the client:** the client predicts, the server validates and confirms. That removes complaint 2's root cause, because there's one authority for placement.
- **Deterministic rollback** (SyncPlay): only worth it for frame-exact action. Keep it in reserve for shared rover driving or combat.

## 5. Why FIDELITY fits server-authority cheaply
- **The constitution already made the hard part true:** simulation packages are pure and deterministic, and the base world is a pure dispatcher, `apply(world, env, action) → { world, events }` (`apps/web/src/base/world.ts`). A `GameRoom` can import that same `apply` and run it server-side to validate every action. Clients send actions, the server applies and broadcasts the events, and the client applies the confirmed result. No rules get duplicated, so there's no rule drift.
- **Plot snapshots** (`plot-code.ts`) and **shared-planet slots** (`shared-planet.ts`) are already plain data, so they persist as room state or UGC entries.
- **The dual build** (plain single file vs RUN) is already in place, so co-op ships in the RUN build only, and the single file stays complete for solo play.

## 6. Risks and open questions (for the owner)
1. **Registering and deploying the game on RUN** (private at first) is the owner's call (`docs/RUNWORLD_PIPELINE.md`). The first slice can be built and tested on the plugin's **local dev server** before any registration.
2. **Both multiplayer systems are BETA.** Pin versions, and keep the plain build unaffected.
3. **Cost:** realtime and storage pricing isn't in the CLI help. Ask RUN, or check the `rundot credits` breakdown before launch.
4. **Bundle size:** the RUN build carries the SDK, so check it stays under the 16 MB cap.
5. **Empty lobby:** FIDELITY must stay fully playable solo. Co-op is an opt-in layer, and async visits keep the shared planet alive when no friend is online.

## 7. Recommendation
Build co-op on **`rundot-multiplayer`** (server-authoritative rooms), smallest slice first: **a friend's outpost, live, by room code**, with the room running our pure `apply`. Add role permissions next, then the shared-planet singleton room and async visits through UGC. Keep **SyncPlay** for later action modes. The phased plan is [`36-planetary-grid-on-run.md`](argo/plans/36-planetary-grid-on-run.md).
