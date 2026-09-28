# 7 · Phased Implementation Tickets (T01 – T12)

Estimates in engineer-days (1 senior). Every ticket extends `scripts/check.mjs`; the 830+ existing tests must stay green at every merge.

```
Phase A — Foundations        T01 ─┬─► T02 ─► T03
                                  └─► T05 ─► T06
Phase B — Identity & Looks   T02/T03 ─► T04 ;  T05 ─► T06
Phase C — Server & Stakes    T01 ─► T07 ─► T08 ─► T09 ─► T10
Phase D — Social & Integrity T07 ─► T11 ─► T12
```

---

### T01 · Meta contracts & pure math core — **3 d** · deps: none
**Files:** `src/game/meta/interfaces.ts`, `src/game/meta/shaman.ts`, `src/game/meta/prng.ts`, `scripts/check.mjs`
**Acceptance:**
- All interfaces from §1 compile under `strict` with zero `any`.
- `costTable()` equals the §6.3 table cell-for-cell (15 asserts).
- `calculateResurrectionCost` handles NaN/∞/negative inputs without throwing; n = 10 000 returns ≤ `MAX_SAFE_INTEGER`.
- `seasonalNetWorth` returns `λ·gross` when holdings < λ·gross (mule test).
- No imports of `three`/`react` in `src/game/meta/**` (lint rule `no-restricted-imports`).

### T02 · Axle-aligned sphere & equirect baker — **4 d** · deps: T01
**Files:** `src/game/ball/sphere-baker.ts`, `src/game/ball/materials.ts`, `src/game/ball/sphere-baker.worker.ts`, `src/game/renderer-3d.ts` (`ensureRacerMeshes`), `src/game/loadout-art.ts`
**Acceptance:**
- `sphereGeo.rotateZ(-π/2)`; poles verified inside cap geometry (vertex test: every vertex with |x| > cos(CAP_THETA)·r is occluded by caps).
- `uvToDir` matches `SphereGeometry` vertices within 1e-6.
- Seam test (seam column-pair mean Δ ≤ matched interior control + 0.5); gnomonic solid-angle test ±3 %; all output alpha = 255.
- Base layer cached per `(base, accentColor)`; decal-only rebake is what runs on each edit.
- Default finishes reproduce each legacy capsule look (iron/springsteel/siege) — screenshot diff reviewed.
- `prepareRaceBalls(Loadout[])` signature unchanged (adapter); legacy tests pass untouched.
- Decal-only rebake at 512×256 ≤ 40 ms in the worker on the reference laptop; cold full bake (incl. base noise) logged, not gating (reference TS ≈ 400 ms in Node).

### T03 · Array-texture racer pool (1 draw call) — **3 d** · deps: T02
**Files:** `src/game/ball/ball-texture-pool.ts`, `src/game/renderer-3d.ts` (`coreBatch`, `buildRacerSlot`, `growRacerBatches`)
**Acceptance:**
- 100-racer field: cores render in ≤ 2 draw calls (`renderer.info`).
- `aBallLayer` attribute grows with capacity; no texture re-upload on capacity growth.
- WebGL1 path falls back to per-canvas batches; test toggles `isWebGL2 = false`.
- Memory at field 100 ≤ 25 MB for ball textures (256×128 LOD).
- Emissive map drives obsidian fissures; far-side luminance ≥ 18 % (render-target readback test).

### T04 · `BallCustomizerModal` + decal catalog — **5 d** · deps: T02, T03
**Files:** `src/components/garage/BallCustomizerModal.tsx`, `DecalGizmo.tsx`, `UnwrapMinimap.tsx`, `src/game/ball/decal-catalog.ts`, `public/decals/*.png`
**Acceptance:**
- Layout per §5C at 1440×900 and ≥ 1024 wide; gamepad map works end-to-end.
- Raycast placement puts a decal centre within 1 texel of the hit uv.
- Undo/redo 50 steps; drag coalesced to one history entry.
- Try-before-buy: save blocked until cart paid; server rejects unowned items at queue.
- 12-decal cap enforced; invalid presets clamped on load (fuzz test 1 000 random configs).

### T05 · Goblin DNA codec & compositor — **3 d** · deps: T01
**Files:** `src/game/avatar/goblin-dna.ts`, `goblin-compositor.ts`, `layer-registry.ts`, `rasterize.ts`
**Acceptance:**
- Round-trip 10 000 seeds; single-digit corruption rejected in exhaustive test.
- `generateRandomGoblin('lobby:17')` identical across Node & browser (SVG SHA pinned).
- Occlusion rules: no pickelhaube+mohawk output across 10 000 seeds.
- Rasterizer LRU (256 entries) evicts correctly; HUD badge + off-screen pointer consume DNA portraits.

### T06 · `CharacterCreatorModal` & legacy migration — **4 d** · deps: T05
**Files:** `src/components/profile/CharacterCreatorModal.tsx`, `src/game/loadouts.ts` (archetypes), `src/game/avatar/legends.ts`
**Acceptance:**
- Wizard ① archetype → ② appearance → ③ name; edit mode skips ①/③.
- Contextual thumbnails reflect current goblin; layer locks survive Randomize.
- Paste DNA validates with friendly errors; unowned items show lock + price.
- Legacy riders selectable as "Legends"; existing `RiderId` saves migrate to archetype + legend source.

### T07 · Meta server: ledger, profiles, seasons — **6 d** · deps: T01
**Files:** `server/db/schema.ts`, `server/ledger.ts`, `server/profile.ts`, `server/season.ts`, `src/net/meta-client.ts`
**Acceptance:**
- Double-entry ledger with unique idempotency keys; concurrent double-spend test (50 parallel requests) never overdraws.
- Season close job: soft reset Elo `E' = 1000 + 0.5·(E − 1000)`, rewards paid, dead racers → Hall of Fame, gross inflow counters reset.
- Up to 5 slots; slot purchase is a ledger tx; profile endpoints return `RacerProfile v1`.

### T08 · Hub scheduler, matchmaking & `MultiplayerHubScreen` — **6 d** · deps: T07
**Files:** `server/scheduler.ts`, `server/matchmaker.ts`, `server/ws.ts`, `src/components/hub/MultiplayerHubScreen.tsx`, `LobbyRoomDrawer.tsx`, `CreateRaceDialog.tsx`, `src/game/session.ts` (new `RaceMode` 'unranked' | 'ranked' | 'custom')
**Acceptance:**
- Unranked every 10 min, ranked every 30 min on server clock; countdown skew ≤ 250 ms after WS sync.
- Ranked Elo brackets fill to 100 with AI fill-ins (DNA from lobby seed); `FIELD_SIZES` contract unchanged.
- Queue state machine incl. refund on leave before T-2:00; all rejection reasons render inline.
- Commit-reveal seed: sha256 published at open, seed revealed at start, verified by client.

### T09 · Permadeath, Shaman Altar & `GoblinProfileScreen` — **5 d** · deps: T07, T08, T05
**Files:** `src/game/sim/hazards.ts` (death flag in ranked only), `server/shaman.ts`, `src/components/profile/GoblinProfileScreen.tsx`, `ShamanAltar.tsx`, `HoldToConfirmButton.tsx`
**Acceptance:**
- Death triggers only when `lobby.permadeath` (lava, TNT, terminal fall, wall smash > 1,400 u/s); unranked uses existing recovery. Sim determinism tests unchanged for non-ranked modes.
- Altar displays server quote; breakdown matches client mirror; pay is idempotent; Soul Sickness blocks ranked queue only.
- Retire flow writes Hall of Fame snapshot and opens creator with descendant seed.
- Profile layout per §5B incl. SNW breakdown and "next fee if slain".

### T10 · Economy faucets: Sheep Hire & AI Pilot Contracts — **3 d** · deps: T08, T09
**Files:** `server/contracts.ts`, `src/game/sim/sheep.ts` (scrap pickup entity), `src/components/hub/AiPilotContractCard.tsx`, `scripts/sim/economy-season.ts`
**Acceptance:**
- Sheep payout 50–100 by scrap; diminishing 12/24; fee 25 g.
- AI pilot eligibility snapshot enforced server-side; payout = 50 % of equivalent sheep payout; ≥ 60 % input ticks else void.
- `economy-season.ts` (seed 1337, 2 000 players) in CI: faucet/sink ratio ∈ [0.9, 1.2], last-10-day per-capita drift ≤ 1.5 %/day, ≥ 50 % of ever-broke players recover to 1 000 g.

### T11 · Goblin Bookie & `BookieParlorModal` — **6 d** · deps: T08
**Files:** `server/bookie/pricing.ts`, `server/bookie/settle.ts`, `src/components/bookie/BookieParlorModal.tsx`, `OddsBoard.tsx`, `BetSlip.tsx`
**Acceptance:**
- Window opens T-25:00, hard lock T-5:00 (server clock; bet at T-4:59.999 rejected).
- Self-bet rules: death/against markets unavailable for own racers; self-win cap 10 % SNW.
- Pari-mutuel settlement: Σ payouts + vig + breakage = pool (property test, 10 000 random pools).
- H2H fixed odds with liability cap; void heat refunds including takeout.
- 100-row odds board virtualized at 60 fps; WS odds diffs throttled to 2 s.

### T12 · Integrity: replay re-sim, tripwires & suspicion audits — **5 d** · deps: T11, T09
**Files:** `server/integrity/replay.ts`, `server/integrity/suspicion.ts`, `src/game/sim/telemetry-tripwires.ts`, `server/integrity/cluster.ts`
**Acceptance:**
- Server re-sim reproduces client finishing order for 100 recorded heats (bit-exact positions at finish tick).
- Tripwire unit tests with synthetic frame streams for each rule, incl. recovery-state exemptions.
- S thresholds: 65 → 1 h escrow, 85 → 24 h cooldown; audits store per-signal contributions & replay tick ranges.
- Cluster rule (≥ 3 heats / 7 days both sides) produces confiscation to Mob Fund + Elo penalty, gated behind human review flag.

---

**Total ≈ 53 engineer-days.** Critical path: T01 → T07 → T08 → T11 → T12 (26 d). Visual track (T02–T06, 19 d) runs in parallel and can ship early as "Garage Update" without any server.
