# 36: The Planetary Grid on RUN.world, a co-op plan

> **For:** the owner and Argo. **By:** Opus, 2026-10-17. **Research:** [`docs/MULTIPLAYER_RESEARCH.md`](../../MULTIPLAYER_RESEARCH.md).
> **Status:** a proposal. Phase 0 needs the owner's go; Argo, as creative lead, may reshape the player-facing parts.
> **Relation to TICKET-08a:** 08a builds an *honest local* Planetary Grid screen now: your code, visit by code, spawn point, and the sync toggle. This plan grows that same screen into real co-op once RUN's backend is wired. Nothing in 08a gets thrown away.

## The goal in one line
Friends build on each other's moon plots together, live or while the owner is away. The shared planet shows everyone's terraforming. And FIDELITY stays fully playable solo.

## Principles (from the research)
1. **Server-authoritative, with one set of rules.**
   - A RUN `GameRoom` runs our existing pure `apply(world, env, action)` (`apps/web/src/base/world.ts`) to validate every action.
   - The client predicts with the same `apply` and corrects to the server's confirmed events.
   - That kills Satisfactory-style structure desync at the root.
2. **The world lives without its owner online** (the top Planet Crafter complaint). Room state persists, through `getPersistState`, `onRestore` and `autoPersist`.
3. **Role permissions from day one** (the Enshrouded pattern): owner, co-builder and visitor, enforced on the server.
4. **There's no empty-lobby problem by design:** solo is the default; co-op and the shared planet are layers on top.
5. **The plain single-file build stays solo.** Co-op ships in the RUN build (`npm run build:run`), which already loads the SDK and cloud saves (`platform/boot.ts`).
6. **Smallest slice first,** each phase shippable on its own.

## Phase 0: decisions and setup (owner's go needed for 0.3)
- 0.1 Pin the realtime pieces: `rundotMultiplayerPlugin()` in `apps/web/vite.config.ts` (RUN mode only), and `rundot/realtime.config.json` with an `outpost` room type.
- 0.2 Prove a room on the plugin's **local dev server**: two headless browsers join one room by code, with no registration needed.
- 0.3 **Owner decision:** register the game on RUN (`rundot import` or `init`) and deploy a **private** build (`set-private`, share link only). Ask RUN about realtime and storage pricing first.

## Phase 1: a friend's outpost, live, by room code (the smallest slice)
- **Room type `outpost`:**
  - `maxPlayers` 4, `reconnectTimeout` 60 s, `autoPersist` on.
  - The room owns one plot's `BaseWorld`.
  - `onGameMessage` receives a `BaseCommand` (the same union the client uses today), checks the sender's role, runs `apply`, then broadcasts the resulting `events` and a world version number.
  - A refused command goes back to the sender only, as a toast.
- **Presence:** each client sends its pose at 10 Hz (position, yaw, avatar look). The room relays poses and doesn't validate them. Remote players render as their avatars, interpolated 100 ms behind.
- **Client net layer** (`apps/web/src/net/`):
  - `connectOutpost(code | 'host')` returns `{ send(cmd), onEvents(cb), onPresence(cb), state() }`.
  - Local predict-and-confirm: apply locally at once; if the server's confirmed version differs, resync from the server's snapshot.
- **The Planetary Grid screen** (08a's): "Host my outpost" creates a room and shows its 6-character code; "Join by code" calls `joinRoomByCode`.
- **Persistence:** the host's plot lives in the room, and the host's local save syncs from it on leave.
- **Test:** two Playwright clients on the local dev server. Both place pieces, and both end with an identical world hash (`hashValue`). A disconnect followed by a reconnect restores the same world.

## Phase 2: roles and co-builder permissions
- **Roles:** `owner` (everything), `cobuilder` (build, remove their own pieces, run machines; can't remove the owner's core pieces or the gate), `visitor` (walk, look, inspect only).
- **Server enforcement:** a role table checked in `onGameMessage` before `apply`. The roles persist with the room.
- **UI:** the screen's Co-Builders column (owner only) promotes or demotes visitors in the room, and invites by code with a chosen default role.

## Phase 3: the shared planet, live
- **A `singleton` room type, `grid`:** one shared world room that holds slot claims. `resolveSlots`' majority merge moves to the server, so the 40,000 km planet has one truth.
- **Each player's plot snapshot** (`plot-code.ts` `snapshotOf`) is published as a **UGC entry**. Neighbours on the planet render from those entries, whether or not their owners are online.
- **The sync toggle keeps its meaning:** Synced claims a slot on the grid; Desynced plays your own branch.

## Phase 4: async visits and co-building while the owner is away
- **Visit any published plot by code without a live host:** load its UGC snapshot read-only, or open its persisted `outpost` room if it exists.
- **Co-builders can open the owner's persisted outpost room while the owner is offline** (role-checked). The world keeps evolving, and the owner sees the changes and who made them in a short log on return.

## Later, not now: SyncPlay
Deterministic rollback rooms are for frame-exact action: shared rover races, joint combat against leak monsters. They need a plain-data, fixed-tick simulation. Revisit when an action mode is designed.

## Who builds what
| Piece | Who | Notes |
|---|---|---|
| `apps/web/src/rooms/OutpostRoom.ts` (the `GameRoom` running `apply`, the role table, persistence, presence relay) | **Argo** | Server code. It must import only pure modules: `base/world.ts`, `@hm/*`. |
| `apps/web/src/net/outpost-client.ts` (predict and confirm, resync, presence interpolation) | **Argo** | The protocol types are shared with the room. |
| A pure `net/protocol.ts` (message unions, version and hash checks) | an **Arena battle**, with Opus's hidden oracle | Self-contained and testable; a good battle candidate. |
| Wiring: the vite plugin, the config, Grid screen actions, remote avatars, tests | **a sidecar** (Haiku or Flash) | After 08a lands. |
| Phase 0.3 registration and deploy, and the pricing check | **the owner's** go, then Opus runs the CLI | |

## Acceptance (Phase 1)
- Two clients hosted on the local dev server reach the same world hash after 50 random valid builds each.
- A disconnect followed by a reconnect within 60 s restores the same world.
- A visitor's build command is refused on the server.
- The plain single-file build is unchanged, and the RUN build stays under 16 MB.
