# **ARGO\_NOTE\_11: TICKET-11 (Co-Op Phase 2, POL-114 Design Call & Window B / F-14 Spec)**

**Author:** Gemini Argo (Creative Lead & PM)  
**To:** Claude Opus (Lead Engineer) & Francois (Owner)  
**Date:** 2026-10-18  
**References:** [OPUS\_NOTE\_18\_ticket11\_coop\_phase2](https://docs.google.com/document/d/1A8R97h1qbjoo36GKEU7OrRCKWGuYuBCfZx3erVkEg3k/edit?usp=drivesdk), [ticket11-context.json](https://drive.google.com/file/d/1X4lNeyxX8Zud3yvojMX9aXiX5EvIwx1M/view?usp=drivesdk), [argo-ticket11-bundle.json](https://drive.google.com/file/d/1FYVvzfo44SsjGJF3esAJrVAWHHDLJEXe/view?usp=drivesdk) (Drive ID: 1FYVvzfo44SsjGJF3esAJrVAWHHDLJEXe)

## **1\. Executive Summary & Bundle Manifest**

argo-ticket11-bundle.json (Drive ID: 1FYVvzfo44SsjGJF3esAJrVAWHHDLJEXe) is built directly on the installed Phase 1 co-op files and real @series-inc/rundot-game-sdk/mp-server types in ticket11-context.json. It delivers all 20 files for **TICKET-11 (Co-Op Phase 2\)**:

> * apps/web/src/crafter/shared-planet.ts — Adds claimPlotSlot, readStoredSlot, claimAndStoreSlot (POL-84), and readPlaySyncMode / writePlaySyncMode (POL-85).  
> * apps/web/src/base/plot-height.ts & apps/web/src/base/plot-height.test.ts — Exports canonical paint grid constants BOULDER\_SPAN \= 320, PAINT\_CELLS \= 256, PAINT\_CELL, PAINT\_ORIGIN (POL-111), and levels the Moon Twin Gate footing pad (\[±1.9 m, ±1.25 m\] in the gate's yaw frame at rawHeight(gx, gz) \+ 0.25 m, POL-112).  
> * apps/web/src/base/world.ts, apps/web/src/base/machine-inspect.ts, & apps/web/src/base/machine-inspect.test.ts — Adds the switch command ({ t: 'switch', machine, on }) and switched event (POL-73), scales station hopper capacity to real linked network storage so stock never overflows /100 (POL-77), and adds full unit tests for the env.plot plot-machine inspector branch (POL-74).  
> * apps/web/src/net/protocol.ts & apps/web/src/net/protocol.test.ts — Adds switched to WireBaseEvent, adds Phase 2 messages (kickPlayer, setDefaultRole, undoAuthor, beamIntent, kicked), and attaches usernames and defaultGuestRole to welcome, snapshot, and roleChanged (POL-117) while preserving hasNoPayloadTypeField.  
> * apps/web/src/net/coop-guardrails.ts & apps/web/src/net/coop-guardrails.test.ts — Implements TokenBucketLimiter (DEFAULT\_RATE\_LIMIT \= { capacity: 60, refillPerSec: 20 }, owner exempt), UndoLogEntry / recordAuthorBuild / findNextUndoCommandsForAuthor / undoLastByAuthor, and re-exports POL-84 / POL-85 helpers.  
> * apps/web/src/rooms/OutpostRoom.ts, apps/web/src/rooms/outpost-harness.ts, apps/web/src/rooms/OutpostRoom.test.ts, & apps/web/src/rooms/outpost-convergence.test.ts — Persists roles, usernames, defaultGuestRole, placedBy, shiftLog, undoLog, and terrain; enforces POL-115 (waiting-for-host-seed while version \=== 0); enforces token-bucket rate limiting; handles setRole, setDefaultRole, kickPlayer, undoAuthor, and server-authoritative 1 Hz machine/harvest ticks via OUTPOST\_TICK\_TIMER \+ beamIntent (POL-114).  
> * apps/web/src/net/outpost-client.ts, apps/web/src/net/outpost-client.test.ts, & apps/web/src/net/outpost-session.ts — Exposes setDefaultRole, kickPlayer, undoAuthor, sendBeamIntent, and uses state.usernames in rosterOf(client) (POL-117). Also skips sending locally-refused apply() geometry probes (occupied / unsupported) over the wire so rapid placement searches never drain the server rate-limit bucket.  
> * apps/web/src/shell/planetary-grid.tsx — Built strictly on ticket11-context.json's planetary-grid.tsx without touching planetary-grid.css (preserving Flash's F-15 lane). Adds Lead Architect Promote/Demote, per-author Undo, Kick, and Default Guest Role controls in the roster, plus POL-84 / POL-85 slot & sync-mode persistence.  
> * apps/web/src/play/remote-peers.ts & apps/web/src/play/remote-peers.test.ts — Self-contained Three.js remote peer avatar controller (createRemotePeersController) with role-tinted suit beacons and ROLE\_LABELS metadata for play-scene.ts Window B / F-14.

## **2\. Design Call: POL-114 (Shared Stock vs. Per-Player Stock & Server-Authoritative Ticks)**

### **2.1 Stock & Pack Model: Shared Outpost Stock via Linked Quantum Bridge**

**Decision:** Keep **one shared outpost stock** (BaseWorld.player \+ BRIDGE\_STORE \= \-2 \+ linked storage bins on networkAt(world, env, at)). Do **not** split BaseWorld into per-player inventories.  
**Rationale:**

> 1. **Fits the Linked Quantum Bridge Architecture:** In *FIDELITY*, building and crafting pay automatically from the outpost's Linked Quantum Bridge network (pay() pulls from PLAYER \+ networkAt(w, env, at) anchored by BRIDGE\_STORE \= \-2 at the gate). When friends join as **Co-Builders**, they are invited onto the host's construction crew to build the outpost together from its shared supply network — not to hoard separate pockets or drop items on the floor to trade.  
> 2. **Solo Saves Are Already Protected:** outpost-session.ts never overwrites a guest's local solo save; when a guest leaves a co-op session, their own enclave and inventory on their device are untouched, while the host's base keeps everything built and refined during the session.  
> 3. **Grief Protection Is Handled by Role Guardrails & Per-Author Undo:** Untrusted visitors can be set to **Field Observer** (visitor, strictly read-only, either per-player or as the room's defaultGuestRole). If a Co-Builder misplaces structures, the **Lead Architect** has one-click **Undo** (undoAuthor, which dismantles that author's piece and refunds its full cost right back into the outpost's shared bridge store), **Demote**, and **Kick**.

### **2.2 Machine & Extraction Beam Ticks: Server-Authoritative 1 Hz Tick on this.clock \+ Client BeamIntentMessage**

**Decision:** Accept Opus's proposal — **clients never round-trip { t: 'tick' } commands at 10 Hz**. Instead, OutpostRoom runs a deterministic 1 Hz tick timer (OUTPOST\_TICK\_TIMER \= 'outpost-world-tick-1hz') on this.clock and clients send lightweight beamIntent updates (client.sendBeamIntent({ at, beam, power, latched })) only when their Extraction Beam target or plot power share changes.  
**How It Works in argo-ticket11-bundle.json:**

> 1. **Intent-Only Client Updates:** When a player starts or stops firing the Extraction Beam at an anomaly node (or when plot power shares change), the client calls session.client.sendBeamIntent({ at, beam, power, latched }). Field Observers (visitor) are ignored.  
> 2. **Quiet When Idle:** OutpostRoom.flushWorldTick() fires once per second on this.clock. If this.version \=== 0 or neither an active machine job (m.on \!== false && m.jobs.length \> 0\) nor an active beamIntent exists, flushWorldTick() is a no-op (zero wire traffic, zero version churn during quiet building or unit tests).  
> 3. **Deterministic Broadcast:** When a machine job or Extraction Beam harvest is active, OutpostRoom.flushWorldTick() runs apply(this.world, this.env, tickCmd) once per second on the server and broadcasts the resulting EventsMessage (cmd: { t: 'tick', ... }) to all connected clients, keeping every client's worldHash and version locked in step. Direct { t: 'tick' } commands remain supported for deterministic replay and unit tests.

## **3\. Consolidated play-scene.ts Specification (Window B \+ F-14 \+ POL-112 / POL-113 / POL-114)**

When wiring play-scene.ts (or handing F-14 to Flash), apply these 4 small hooks:

> 1. **Remote Peer Avatars (apps/web/src/play/remote-peers.ts — F-14):**  
   * On scene setup: const remotePeers \= createRemotePeersController(scene);  
   * In the render loop (or session.client.onPresence): remotePeers.setRemotePeers(session ? session.client.samplePeers() : \[\]);  
   * On scene dispose: remotePeers.dispose();  
> 2. **Live Terrain Sculpt Sync (importBeamField — POL-113):**  
   * Expose importBeamField(sculpt: string): void on the terrain brush controller in play-scene.ts (calling decodeField(sculpt, PAINT\_CELLS, PAINT\_CELL) and rebuilding the displaced terrain mesh).  
   * Subscribe via session.client.onTerrain((t) \=\> importBeamField(t.sculpt)), and when the Lead Architect finishes a sculpt stroke, call session.client.setTerrain({ seed: OUTPOST\_PLOT\_SEED, sculpt: exportBeamField() }).  
> 3. **Server-Authoritative Harvest & Machine Intent (sendBeamIntent — POL-114):**  
   * When session is active (currentOutpostSession() \!== null), do **not** run local apply(world, env, { t: 'tick', ... }) on the client frame loop. Instead, whenever the player's Extraction Beam target ({ node, power } | null) or plot power map changes, call session.client.sendBeamIntent({ at: { x: player.x, z: player.z }, beam, power, latched }).  
> 4. **Moon Twin Gate Footing Pad (plotHeightAt — POL-112):**  
   * Pass the Moon Twin Gate's world pose { x: gateX, z: gateZ, yaw: gateYaw } into plotHeightAt({ seed, sculpt, gate: { x: gateX, z: gateZ, yaw: gateYaw } }) so the \[±1.9 m, ±1.25 m\] pad under the gate is levelled at rawHeight(gateX, gateZ) \+ 0.25 m.