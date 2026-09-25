# 0 · Executive Summary & Architecture Decisions

**Heavy Metal GP 2 — Meta-game Evolution ("Season Zero" milestone)**
Scope: seven interlocking systems layered *around* the existing 120 Hz deterministic race sim without touching its physics contract.

## 0.1 Guiding constraints (inherited from the codebase)

| Constraint | Consequence for this plan |
|---|---|
| 120 Hz deterministic sim, 830+ tests in `scripts/check.mjs` | Every new module is a pure function over plain data. No `Date.now()`, no `Math.random()` inside meta logic — clocks and seeds are injected. Each ticket adds its own test block to `check.mjs`. |
| `InstancedMesh` racer pool keyed by canvas (`racerTextures`) | Custom balls must not explode the batch count at 100 racers. Solution: one `DataArrayTexture` layer per racer → **one draw call for all cores** (§2.4). |
| Cosmetics currently tied to `CapsuleId` art | Split **physics** (`CapsuleId`: iron/springsteel/siege — unchanged stats) from **cosmetics** (`CustomBallConfig`). Cosmetics are stat-neutral forever. |
| Fixed rider presets (`RiderId`) with stat offsets | Riders become **Racer archetypes** (stat offsets kept). The *face* becomes a `GoblinDna` string. Legacy portraits remain as "Legends" presets. |
| Vite SPA, no server today | Introduce an authoritative **Meta Server** (Node + Postgres). Races stay client-simulated but are **re-simulated server-side from inputs** for ranked (the determinism we already have becomes our anti-cheat). |

## 0.2 The seven systems at a glance

```
┌──────────────────────────── CLIENT (Vite · React 19 · Three 0.186) ────────────────────────────┐
│  MainMenu ─┬─ PLAY          (existing NewGameSetup)                                           │
│            ├─ MULTIPLAYER ── MultiplayerHubScreen ── LobbyRoom ── BookieParlorModal            │
│            ├─ PROFILE ────── GoblinProfileScreen ── ShamanAltar ── CharacterCreatorModal       │
│            └─ GARAGE ─────── BallCustomizerModal ── (sphere-baker.worker)                      │
│                                                                                                │
│  src/game/meta/*   pure contracts & math (interfaces, shaman, bookie pricing mirror)          │
│  src/game/ball/*   equirect baker, decal catalog, array-texture pool                          │
│  src/game/avatar/* DNA codec, layer registry, SVG compositor, rasterizer LRU                   │
└───────────────▲────────────────────────────────────────────────────────────────▲──────────────┘
                │ REST (profile, shop, quotes)          WebSocket (lobby clock, odds, heat feed)
┌───────────────┴──────────────────── META SERVER (Node · Postgres) ─────────────┴──────────────┐
│ Scheduler (10/30-min cadence) · Matchmaker (Elo brackets) · Ledger (idempotent double-entry)  │
│ Shaman service · Bookie (pari-mutuel engine) · Integrity (replay re-sim + suspicion scoring)  │
│ Season service (30-day lifecycle, soft reset, Hall of Fame)                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 0.3 Key architectural decisions (ADR summary)

1. **ADR-01 · Equirect + axle-aligned poles, not cube-sphere.** The balls already wear brass bearing caps on local ±X. Rotating `SphereGeometry` with `rotateZ(-π/2)` puts the equirect poles *under the caps*. The visible band is |lat| ≤ ~60°, where equirect distortion is ≤ 2× and the rolling circumference gets full, uniform resolution. `cube-sphere.ts` stays unwired: it adds 12 atlas seams, mip bleeding, and per-face decal clipping for no visible gain. (Revisit only for a future "caps off" cosmetic.)
2. **ADR-02 · Bake once, never composite in-race.** Base metal + decals + accent pin-line bake to one RGBA (and optional emissive) buffer in a Web Worker at save time; cached by `bakeKey` in IndexedDB. In-race cost is identical to today.
3. **ADR-03 · Gnomonic decal projection.** Decals are inverse-mapped through a tangent-plane projection → mathematically exact on the sphere, seam-safe, pole-safe. `cos(lat)` appears only in bounding-box widening.
4. **ADR-04 · Avatars are SVG fragments rasterized once.** Deterministic string output → snapshot tests in Node. DNA = 12 hex digits with checksum.
5. **ADR-05 · Hybrid High-Water Mark with a gross-inflow guard.** `SNW = max(holdings, 0.6 · grossSeasonalInflow)` — mule transfers reduce holdings but can never reduce inflow already earned.
6. **ADR-06 · Pari-mutuel by default.** The house never carries risk; takeout (5–12 %) is a clean gold sink. Fixed odds only for head-to-head (bounded risk).
7. **ADR-07 · Integrity from determinism.** Ranked heats upload input streams; the server re-simulates and derives telemetry. Tripwires run on the *server replay*, so a hacked client can't hide throttle-lifts.
8. **ADR-08 · Integer gold, idempotent ledger.** Every mutation is a `TransactionRecord` with an idempotency key; balances are derived & cached, never directly written.

## 0.4 What's live on this page

This document is backed by compilable code in `src/hmgp2/` (interfaces, Shaman engine, economy simulator, DNA codec, SVG compositor, sphere baker, bookie pricing, suspicion engine) and a reference Postgres schema in `src/db/schema.ts`. The interactive panels (Shaman calculator, 30-day economy run, goblin gallery) execute those exact modules.
